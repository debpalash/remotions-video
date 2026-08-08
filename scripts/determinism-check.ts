/**
 * Determinism check — byte-identical re-render proof (ENGINE_DESIGN §2/§5).
 *
 * Renders the SAME frame of the SAME spec TWICE, in two independent Playwright
 * page contexts (the worst case the sharded orchestrator can produce: two cold
 * pages, separate WebGL contexts), captures each via the exact orchestrator
 * capture path (DOM screenshot, or gl readback when the scene is canvas-only),
 * and asserts the two PNG buffers are byte-identical (sha256 match).
 *
 *   bun scripts/determinism-check.ts            # SAMPLE_SPEC, a shader frame
 *   bun scripts/determinism-check.ts <spec.json> <frame>
 *
 * The spec defaults to SAMPLE_SPEC (dark-cinematic → the shader backdrop path).
 * Exits non-zero on any mismatch.
 */
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium, type Page } from "playwright";

import { SAMPLE_SPEC, VideoSpec as VideoSpecSchema, type VideoSpec } from "../src/spec";
import { renderHostPage } from "../src/render/host/build";

const FORMATS: Record<VideoSpec["format"], [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

async function loadSpec(arg: string | undefined): Promise<VideoSpec> {
  if (!arg) return SAMPLE_SPEC;
  const raw = await readFile(resolve(arg), "utf8");
  return VideoSpecSchema.parse(JSON.parse(raw));
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function captureFrame(page: Page, w: number, h: number): Promise<Buffer> {
  const canvasOnly = await page.evaluate(() => window.__KINO_CANVAS_ONLY__ === true);
  if (canvasOnly) {
    const dataUrl = await page.evaluate(() => {
      const root = document.querySelector("[data-kino-stage]");
      const canvas = root?.querySelector("canvas") as HTMLCanvasElement | null;
      try {
        return canvas ? canvas.toDataURL("image/png") : null;
      } catch {
        return null;
      }
    });
    if (dataUrl?.startsWith("data:image/png;base64,")) {
      return Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    }
  }
  const bytes = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: w, height: h },
    animations: "disabled",
    caret: "hide",
  });
  return bytes as Buffer;
}

async function main(): Promise<void> {
  const [specArg, frameArg] = process.argv.slice(2);
  const spec = await loadSpec(specArg);
  const frame = frameArg ? Number.parseInt(frameArg, 10) : 0;
  const [w, h] = FORMATS[spec.format];

  console.log(`[det] spec preset=${spec.preset} format=${spec.format} frame=${frame}`);

  const { html } = await renderHostPage({ spec, fps: 30, frame });

  const server: Server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const url = `http://127.0.0.1:${addr.port}/?frame=${frame}`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--hide-scrollbars",
    ],
  });

  const renderOnce = async (): Promise<Buffer> => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => window.__KINO_READY__ === true || typeof window.__KINO_ERROR__ === "string",
      undefined,
      { timeout: 60_000, polling: 16 },
    );
    const err = await page.evaluate(() => window.__KINO_ERROR__);
    if (err) throw new Error(`host error: ${err}`);
    const buf = await captureFrame(page, w, h);
    await ctx.close();
    return buf;
  };

  try {
    const a = await renderOnce();
    const b = await renderOnce();
    const ha = sha256(a);
    const hb = sha256(b);
    console.log(`[det] render A: ${a.length} bytes  sha256=${ha.slice(0, 16)}…`);
    console.log(`[det] render B: ${b.length} bytes  sha256=${hb.slice(0, 16)}…`);
    if (ha === hb && a.equals(b)) {
      console.log(`[det] PASS — byte-identical (two independent renders of frame ${frame}).`);
    } else {
      console.error(`[det] FAIL — frame ${frame} differs between renders.`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err: unknown) => {
  console.error("[det] failed:", err);
  process.exit(1);
});
