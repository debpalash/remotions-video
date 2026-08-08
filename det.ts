/**
 * Single-frame determinism check (fast). Renders ONE frame of the shader-backed
 * stack TWICE in two independent Playwright contexts and compares the captured
 * PNG bytes. PNG is lossless, so byte-identical pixels hash identically. This
 * directly tests "shaders didn't break determinism" (ENGINE_DESIGN §2): every
 * visual is a pure function of useFrame(); uTime = frame/fps; antialias:false.
 *
 * Two renders of the same frame must be byte-identical.
 */
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";

import { chromium } from "playwright";

import { SAMPLE_SPEC } from "./src/spec";
import { renderHostPage } from "./src/render/host/build";

// ProductShot + Stats both ride the WebGL <Backdrop> shader — the surfaces most
// at risk if a clock/RNG leaked into the GL path.
const spec = {
  ...SAMPLE_SPEC,
  scenes: SAMPLE_SPEC.scenes.filter(
    (s) => s.component === "ProductShot" || s.component === "Stats",
  ),
} as typeof SAMPLE_SPEC;

const FRAMES = [40, 120]; // one mid-ProductShot (shader), one mid-Stats (shader)
const [W, H] = [1920, 1080];

async function main(): Promise<void> {
  const { html } = await renderHostPage({ spec, fps: 30, minify: true });

  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const url = `http://127.0.0.1:${addr.port}/`;

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

  // Capture one frame in a fresh context (independent GL context / state).
  async function capture(frame: number): Promise<string> {
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        (window as { __KINO_READY__?: boolean }).__KINO_READY__ === true ||
        typeof (window as { __KINO_ERROR__?: string }).__KINO_ERROR__ === "string",
      undefined,
      { timeout: 60_000, polling: 16 },
    );
    await page.evaluate(async (f: number) => {
      const r = (window as { __KINO_RENDER_FRAME__?: (n: number) => Promise<void> })
        .__KINO_RENDER_FRAME__;
      if (!r) throw new Error("no __KINO_RENDER_FRAME__");
      await r(f);
    }, frame);
    await page.waitForFunction(
      () => (window as { __KINO_READY__?: boolean }).__KINO_READY__ === true,
      undefined,
      { timeout: 60_000, polling: 16 },
    );
    const buf = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: W, height: H },
      animations: "disabled",
      caret: "hide",
    });
    await ctx.close();
    return createHash("sha256").update(buf as Buffer).digest("hex");
  }

  let allIdentical = true;
  try {
    for (const f of FRAMES) {
      const a = await capture(f);
      const b = await capture(f);
      const same = a === b;
      if (!same) allIdentical = false;
      console.log(
        `frame ${f}: A=${a.slice(0, 16)} B=${b.slice(0, 16)} ${same ? "IDENTICAL" : "DIFFER"}`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(allIdentical ? "DETERMINISM: PASS" : "DETERMINISM: FAIL");
  process.exit(allIdentical ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
