/**
 * src/pipeline/storyboard.ts — the cheap STORYBOARD gate.
 *
 * One real still PNG per scene (a mid-scene keyframe), rendered through the
 * ACTUAL host compositions — the same `buildHost`/`renderHostHtml` bundle the
 * full orchestrator uses (SAAS_ROADMAP §3: stills are the trusted surface;
 * `OffthreadVideo` is unreliable, so the still path is what the user approves).
 *
 * This is the orchestrator's still path: it reuses the host module + a single
 * persistent Playwright page, driving `window.__KINO_RENDER_FRAME__(frame)` to
 * the middle frame of each placed scene and screenshotting it. It does NOT
 * re-implement the renderer — it composes the host bundle + the pure placer.
 *
 * Cheap by construction: N screenshots, no ffmpeg, no audio, no per-frame video
 * encode. Seconds, not minutes.
 */
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";

import { chromium, type Browser, type Page } from "playwright";

import { placeScenes } from "../vo";
import { REGISTRY, type SceneName, type VideoSpec } from "../spec";
import { buildHost, renderHostHtml } from "../render/host/build";

const REPO_ROOT = resolve(__dirname, "..", "..");

const FORMATS: Record<VideoSpec["format"], readonly [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

export interface StoryboardOptions {
  /** Output dir for the per-scene PNGs. Default a temp dir per spec. */
  outDir?: string;
  /** Frames per second (for VO-derived placement). Default 30. */
  fps?: number;
  /** Asset root for `screen` keys + any local VO. Default `<repo>/public`. */
  assetRoot?: string;
  /** Progress logger. Default `console.log`. */
  log?: (msg: string) => void;
}

export interface StoryboardResult {
  /** Absolute paths to one still PNG per scene (scene order). */
  stills: string[];
}

/* -------------------------------------------------------------------------- */
/*  Asset serving (mirrors the orchestrator's resolver, read-only)            */
/* -------------------------------------------------------------------------- */

function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function resolveAssetPath(url: string, assetRoot: string): string | null {
  if (isRemote(url)) return null;
  if (url.startsWith("/") && existsSync(url)) return url;
  const cleaned = url.replace(/^public[\\/]/, "").replace(/^[\\/]+/, "");
  return join(assetRoot, cleaned);
}

/** Probe a local VO file's duration (seconds) so stills reflect real pacing. */
async function probeVoSeconds(
  spec: VideoSpec,
  assetRoot: string,
): Promise<Record<string, number>> {
  // Reuse @remotion-free probing via the same ffprobe binding the vo module uses.
  const { measureDuration } = await import("../vo");
  const out: Record<string, number> = {};
  await Promise.all(
    spec.scenes.map(async (scene) => {
      const url = scene.vo?.audioUrl;
      if (!url) return;
      const path = resolveAssetPath(url, assetRoot);
      if (!path || !existsSync(path)) return;
      try {
        out[scene.id] = await measureDuration(path);
      } catch {
        /* leave unset → minFrames floor */
      }
    }),
  );
  return out;
}

async function serveHost(
  spec: VideoSpec,
  fps: number,
  voSeconds: Record<string, number>,
  bundle: string,
  assetRoot: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const html = renderHostHtml({ spec, bundle, voDurations: voSeconds, fps });
  const server: Server = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/" || path === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    if (path.startsWith("/assets/")) {
      const key = decodeURIComponent(path.slice("/assets/".length));
      const file = resolveAssetPath(key, assetRoot);
      if (file && existsSync(file)) {
        try {
          res.writeHead(200);
          res.end(await readFile(file));
          return;
        } catch {
          /* fall through */
        }
      }
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("storyboard host server failed to bind a port");
  }
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** Drive the persistent page to `frame` and wait for the paint-ready gate. */
async function renderFrame(page: Page, frame: number): Promise<void> {
  await page.evaluate(async (f: number) => {
    const render = window.__KINO_RENDER_FRAME__;
    if (!render) throw new Error("host bundle did not expose __KINO_RENDER_FRAME__");
    await render(f);
  }, frame);
  // Fixed-interval poll (the sandbox makes rAF synchronous — the default rAF
  // poll would recurse infinitely; see orchestrator note).
  await page.waitForFunction(
    () =>
      window.__KINO_READY__ === true ||
      typeof window.__KINO_ERROR__ === "string",
    undefined,
    { timeout: 30_000, polling: 16 },
  );
  const err = (await page.evaluate(() => window.__KINO_ERROR__)) as
    | string
    | undefined;
  if (err) throw new Error(`host render failed at frame ${frame}:\n${err}`);
}

/* -------------------------------------------------------------------------- */
/*  Public: render one mid-scene still per scene                              */
/* -------------------------------------------------------------------------- */

export async function renderStoryboardStills(
  spec: VideoSpec,
  opts: StoryboardOptions = {},
): Promise<StoryboardResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const fps = opts.fps ?? 30;
  const assetRoot = opts.assetRoot ?? join(REPO_ROOT, "public");
  const outDir =
    opts.outDir ?? join(tmpdir(), "kino-storyboard", spec.brandKitId, String(Date.now()));
  await mkdir(outDir, { recursive: true });

  const [w, h] = FORMATS[spec.format];

  // 1. Measure VO (if any) so the still reflects real placement, then place.
  log(`[storyboard] probing VO durations…`);
  const voSeconds = await probeVoSeconds(spec, assetRoot);
  const placement = placeScenes(
    spec.scenes.map((s) => ({
      id: s.id,
      minFrames: REGISTRY[s.component as SceneName].minFrames,
      voSeconds: s.vo?.audioUrl ? voSeconds[s.id] ?? null : null,
    })),
    { fps, overlap: spec.transitions.durationInFrames },
  );

  // 2. Bundle the host + serve it.
  log(`[storyboard] bundling host…`);
  const { code: bundle } = await buildHost();
  const host = await serveHost(spec, fps, voSeconds, bundle, assetRoot);

  const stills: string[] = [];

  // 3. One persistent page; screenshot each scene's MID frame.
  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--hide-scrollbars",
    ],
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();

    // Mid frame of the first scene as the landing frame.
    const midOf = (i: number): number => {
      const p = placement.scenes[i];
      return Math.min(
        placement.totalFrames - 1,
        Math.max(0, p.from + Math.floor(p.durationInFrames / 2)),
      );
    };

    await page.goto(`${host.url}/?frame=${midOf(0)}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(
      () =>
        window.__KINO_READY__ === true ||
        typeof window.__KINO_ERROR__ === "string",
      undefined,
      { timeout: 60_000, polling: 16 },
    );
    const bootErr = (await page.evaluate(() => window.__KINO_ERROR__)) as
      | string
      | undefined;
    if (bootErr) throw new Error(`storyboard host boot failed:\n${bootErr}`);

    log(`[storyboard] capturing ${spec.scenes.length} stills (${w}×${h})…`);
    for (let i = 0; i < spec.scenes.length; i++) {
      const frame = midOf(i);
      await renderFrame(page, frame);
      const file = join(
        outDir,
        `scene-${String(i).padStart(2, "0")}-${spec.scenes[i].id}.png`,
      );
      const bytes = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: w, height: h },
        animations: "disabled",
        caret: "hide",
      });
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes as Buffer);
      stills.push(file);
      log(`[storyboard] scene ${i + 1}/${spec.scenes.length} (${spec.scenes[i].id}) → ${file}`);
    }
  } finally {
    await browser.close();
    await host.close();
  }

  return { stills };
}
