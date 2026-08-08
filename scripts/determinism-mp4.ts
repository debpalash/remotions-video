/**
 * Production-path determinism check — render the SAME spec to mp4 TWICE with
 * SEPARATE cache dirs (no cache sharing, so frames are genuinely re-rendered),
 * then assert the two mp4 files are byte-identical (sha256 match).
 *
 * This exercises the REAL orchestrator path (persistent warm Playwright page,
 * shard, capture, ffmpeg encode) — the way `out/yupcha-v2.mp4` is produced — so
 * it proves "two renders of the video are byte-identical", not just one frame.
 *
 *   bun scripts/determinism-mp4.ts <specModule|spec.json> [frames-spec]
 *
 * Defaults to SAMPLE_SPEC. Uses a tmp output + a fresh cacheDir per render.
 */
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SAMPLE_SPEC, VideoSpec as VideoSpecSchema, type VideoSpec } from "../src/spec";
import { renderVideo } from "../src/render";

async function loadSpec(arg: string | undefined): Promise<VideoSpec> {
  if (!arg) return SAMPLE_SPEC;
  const p = resolve(arg);
  if (p.endsWith(".json")) {
    return VideoSpecSchema.parse(JSON.parse(await readFile(p, "utf8")));
  }
  const mod = (await import(pathToFileURL(p).href)) as Record<string, unknown>;
  const raw = mod.default ?? mod.spec ?? mod.SAMPLE_SPEC;
  return VideoSpecSchema.parse(raw);
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function renderOnce(spec: VideoSpec, tag: string): Promise<Buffer> {
  const out = join(tmpdir(), `kino-det-${tag}-${randomUUID()}.mp4`);
  // A FRESH cacheDir per render so frames are genuinely re-rendered (not copied
  // from a shared cache — which would make the comparison vacuous).
  const cacheDir = join(tmpdir(), `kino-det-cache-${tag}-${randomUUID()}`);
  await renderVideo(spec, {
    outPath: out,
    cacheDir,
    workers: 1,
    log: () => {},
  });
  return readFile(out);
}

async function main(): Promise<void> {
  const spec = await loadSpec(process.argv[2]);
  console.log(`[det-mp4] rendering spec (preset=${spec.preset}, ${spec.scenes.length} scenes) TWICE…`);
  const a = await renderOnce(spec, "a");
  const b = await renderOnce(spec, "b");
  const ha = sha256(a);
  const hb = sha256(b);
  console.log(`[det-mp4] render A: ${a.length} bytes  sha256=${ha}`);
  console.log(`[det-mp4] render B: ${b.length} bytes  sha256=${hb}`);
  if (a.equals(b)) {
    console.log(`[det-mp4] PASS — the two mp4 renders are BYTE-IDENTICAL.`);
  } else {
    console.error(`[det-mp4] FAIL — the two mp4 renders differ.`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error("[det-mp4] failed:", err);
  process.exit(1);
});
