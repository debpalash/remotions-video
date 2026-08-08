/**
 * GET /api/asset?p=<out-relative-key>
 *
 * Streams a pipeline output (still PNG or rendered mp4) from the `out/` tree.
 * Confined to `out/` (traversal-hardened in `resolveAssetKey`). Supports HTTP
 * Range so the <video> player can scrub without downloading the whole file.
 */
import { stat, open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";

import { resolveAssetKey, contentTypeFor } from "../../../lib/assets.server";

/**
 * Wrap a FileHandle's bytes in a ReadableStream that EXPLICITLY closes the
 * handle when the stream finishes, errors, or is cancelled. `fh.readableWebStream()`
 * does NOT close the fd on its own; relying on GC to close it now throws a fatal
 * `ERR_INVALID_STATE` in modern Node, which would crash the server. Reading via
 * the handle and closing it here keeps the fd lifecycle deterministic.
 */
function closingStream(fh: FileHandle): ReadableStream<Uint8Array> {
  const src = fh.readableWebStream() as unknown as ReadableStream<Uint8Array>;
  const reader = src.getReader();
  let closed = false;
  const closeHandle = async () => {
    if (closed) return;
    closed = true;
    await fh.close().catch(() => {});
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await closeHandle();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        await closeHandle();
        controller.error(err);
      }
    },
    async cancel() {
      await reader.cancel().catch(() => {});
      await closeHandle();
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = url.searchParams.get("p") ?? "";
  const abs = resolveAssetKey(key);
  if (!abs) {
    return Response.json({ error: "invalid asset key" }, { status: 400 });
  }

  let size: number;
  try {
    const s = await stat(abs);
    if (!s.isFile()) throw new Error("not a file");
    size = s.size;
  } catch {
    return Response.json({ error: "asset not found" }, { status: 404 });
  }

  const contentType = contentTypeFor(abs);
  const range = req.headers.get("range");

  // Full-file response (stills, downloads, or no Range header).
  if (!range) {
    const fh = await open(abs, "r");
    const stream = closingStream(fh);
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length": String(size),
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      },
    });
  }

  // Range response (video scrubbing). Parse `bytes=start-end`.
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m) {
    return new Response("invalid range", {
      status: 416,
      headers: { "content-range": `bytes */${size}` },
    });
  }
  let start = m[1] ? Number.parseInt(m[1], 10) : 0;
  let end = m[2] ? Number.parseInt(m[2], 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
    return new Response("range not satisfiable", {
      status: 416,
      headers: { "content-range": `bytes */${size}` },
    });
  }
  start = Math.max(0, start);
  end = Math.min(end, size - 1);
  const chunkSize = end - start + 1;

  const fh = await open(abs, "r");
  const stream = closingStream(fh);
  // Slice via a transform: we read the whole web stream but only forward the
  // requested window. Simpler + robust for mp4 finals (a few MB).
  const sliced = sliceStream(stream, start, chunkSize);

  return new Response(sliced, {
    status: 206,
    headers: {
      "content-type": contentType,
      "content-length": String(chunkSize),
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    },
  });
}

/** Forward only `[offset, offset+length)` bytes of a byte ReadableStream. */
function sliceStream(
  source: ReadableStream,
  offset: number,
  length: number,
): ReadableStream {
  const reader = source.getReader();
  let pos = 0;
  let sent = 0;
  return new ReadableStream({
    async pull(controller) {
      while (sent < length) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = value as Uint8Array;
        const chunkStart = pos;
        const chunkEnd = pos + chunk.byteLength;
        pos = chunkEnd;
        if (chunkEnd <= offset) continue; // entirely before the window
        const from = Math.max(0, offset - chunkStart);
        const remaining = length - sent;
        const to = Math.min(chunk.byteLength, from + remaining);
        const piece = chunk.subarray(from, to);
        sent += piece.byteLength;
        controller.enqueue(piece);
        if (sent >= length) {
          controller.close();
          await reader.cancel().catch(() => {});
          return;
        }
        return;
      }
      controller.close();
    },
    async cancel() {
      await reader.cancel().catch(() => {});
    },
  });
}
