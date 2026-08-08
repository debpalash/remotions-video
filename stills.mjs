// Still-capture: render each scene's mid-frame as a PNG via Playwright.
// Usage: node stills.mjs <specModule.ts> <outDir> [label]
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";
import { register } from "node:module";

// Let node import the TS modules through bun? No — use a child to dump JSON.
// We import the prebuilt host bundle path instead by spawning bun for the build.
import { spawnSync } from "node:child_process";

const [specMod, outDir, label = "after"] = process.argv.slice(2);
const REPO = "/Users/user4/Desktop/remotions-video";
const assetRoot = join(REPO, "public");

// 1. Dump spec JSON + per-scene placement via bun (TS-aware).
const tmp = join(outDir, `_spec.json`);
await mkdir(outDir, { recursive: true });
const dump = spawnSync("bun", ["-e", `
  const s = require("${resolve(specMod)}");
  const spec = s.default ?? s.spec ?? s.SAMPLE_SPEC;
  const { placeScenes } = require("./src/vo/place.ts");
  const { REGISTRY } = require("./src/spec/registry.ts");
  const placement = placeScenes(
    spec.scenes.map(sc => ({ id: sc.id, minFrames: REGISTRY[sc.component].minFrames, voSeconds: null })),
    { fps: 30, overlap: spec.transitions.durationInFrames },
  );
  require("fs").writeFileSync("${tmp}", JSON.stringify({ spec, placement }));
`], { cwd: REPO, encoding: "utf8" });
if (dump.status !== 0) { console.error(dump.stderr || dump.stdout); process.exit(1); }
const { spec, placement } = JSON.parse(await readFile(tmp, "utf8"));

// 2. Build the host page HTML via bun (renderHostPage).
const htmlPath = join(outDir, `_host.html`);
const build = spawnSync("bun", ["-e", `
  const { renderHostPage } = require("./src/render/host/build.ts");
  const spec = JSON.parse(require("fs").readFileSync("${tmp}","utf8")).spec;
  renderHostPage({ spec, fps: 30, frame: 0, minify: true, sourcemap: false })
    .then(({ html }) => { require("fs").writeFileSync("${htmlPath}", html); });
`], { cwd: REPO, encoding: "utf8" });
if (build.status !== 0) { console.error(build.stderr || build.stdout); process.exit(1); }
const html = await readFile(htmlPath, "utf8");

// 3. Serve HTML + /assets/.
const server = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html); return;
  }
  if (path.startsWith("/assets/")) {
    const key = decodeURIComponent(path.slice("/assets/".length));
    const clean = key.replace(/^\/+/, "");
    const file = join(assetRoot, clean);
    if (existsSync(file)) { res.writeHead(200); res.end(await readFile(file)); return; }
    res.writeHead(404); res.end("nf"); return;
  }
  res.writeHead(404); res.end("nf");
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = server.address().port;
const url = `http://127.0.0.1:${port}`;

// 4. Playwright: drive each scene mid-frame, screenshot.
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`${url}/?frame=0`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__KINO_READY__ === true || typeof window.__KINO_ERROR__ === "string", undefined, { timeout: 60000, polling: 50 });

for (let i = 0; i < spec.scenes.length; i++) {
  const sc = spec.scenes[i];
  const p = placement.scenes[i];
  const mid = Math.round(p.from + p.durationInFrames * 0.6);
  await page.evaluate(async (f) => { await window.__KINO_RENDER_FRAME__(f); }, mid);
  await page.waitForFunction(() => window.__KINO_READY__ === true || typeof window.__KINO_ERROR__ === "string", undefined, { timeout: 30000, polling: 50 });
  const err = await page.evaluate(() => window.__KINO_ERROR__);
  if (err) { console.error(`scene ${sc.id} frame ${mid} ERROR: ${err}`); }
  const out = join(outDir, `${label}-${String(i).padStart(2, "0")}-${sc.component}.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1920, height: 1080 }, animations: "disabled", caret: "hide" });
  console.log(`${sc.id} @${mid} -> ${out}`);
}
await browser.close();
server.close();
console.log("DONE");
