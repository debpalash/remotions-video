/**
 * Kino ORCHESTRATOR (node) — `renderVideo(spec, opts)`.
 *
 * Consumes a `VideoSpec` and produces an MP4. Implements `ENGINE_DESIGN §3/§4`:
 * rent the two commodity pieces (headless Chromium for capture, ffmpeg for
 * encode) and own the contract + the concurrency model.
 *
 * Pipeline:
 *   1. esbuild the host entry (`host/entry.tsx`) → one servable JS string.
 *   2. Probe VO durations node-side (ffprobe) for scenes with `vo.audioUrl`.
 *   3. `placeScenes` → total frame count + per-scene windows.
 *   4. Serve a static HTML page that injects `window.__KINO_SPEC__` (+ fps + the
 *      measured VO seconds) and the bundle.
 *   5. Spawn `workers` PERSISTENT Playwright pages (one `goto`, then re-render
 *      each frame by calling `window.__KINO_RENDER_FRAME__` — NOT goto-per-frame).
 *   6. Shard `[0, total)` into contiguous ranges, one per worker.
 *   7. Per frame: wait `__KINO_READY__`, then capture — DOM screenshot, or the
 *      `gl.readPixels` canvas-readback fast path for canvas-only scenes.
 *   8. Per-frame content-hash cache (`hash(sceneProps+palette+motion+frame)`).
 *   9. ffmpeg → h264; mux the concatenated master audio when any scene has VO.
 *  10. Log per-mode (DOM vs canvas) throughput.
 *
 * Determinism-review fixes are honoured in the host (real rAF captured before
 * the sandbox; double-rAF paint gate; no `antialias:true`). The orchestrator
 * additionally launches Chromium with `--disable-gpu`-free WebGL but never
 * forces MSAA.
 *
 * Only `playwright`, `esbuild`, and stdlib + the in-repo contract are used.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { cpus } from "node:os";

import { chromium, type Browser, type Page } from "playwright";

import { placeScenes, type PlacedScene } from "../vo/place";
import { REGISTRY, type SceneName } from "../spec/registry";
import type { VideoSpec, SceneSpec } from "../spec/schema";
// Caption cues + WebVTT serialisation. The SAME pure cue model the burned-in
// `CaptionBand` uses (single source of truth in `src/kino-scenes/captions`), so
// the sidecar `.vtt` lines up frame-for-frame with the on-screen band.
// Import the PURE cue/VTT helpers directly from `./cues`, NOT the captions
// barrel — the barrel also re-exports the React `CaptionBand`, which would drag
// the whole engine (createContext etc.) into this Node module and break any
// server bundler (e.g. Next's RSC compile in the web app).
import {
  buildCaptionTrack,
  captionTextForScene,
  trackToVtt,
  type CaptionSceneInput,
} from "../kino-scenes/captions/cues";
import { frameHash, specHash } from "./hash";
// Ducked ambient music bed (mixed UNDER the placed VO; sidechain-ducked, faded,
// loudnorm'd to the master target). Audio-only — never touches the video stream.
import { mixMusicBed, overlayAccent, DEFAULT_MUSIC_BED, DEFAULT_CTA_ACCENT } from "./musicbed";
// The host bundle + served-HTML are owned by the host module (single source of
// truth; `renderHostHtml` carries the `</script>`/U+2028 injection-safety the
// orchestrator must not re-implement). The orchestrator only adds asset serving.
import { buildHost, renderHostHtml } from "./host/build";

/* -------------------------------------------------------------------------- */
/*  Browser-side window contract (mirrors host/entry.tsx) — for `page.evaluate` */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    __KINO_READY__?: boolean;
    __KINO_ERROR__?: string;
    __KINO_CANVAS_ONLY__?: boolean;
    __KINO_RENDER_FRAME__?: (frame: number) => Promise<void>;
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export type RenderOptions = {
  /** Output mp4 path. Created (and parent dirs) if absent. */
  outPath: string;
  /**
   * Worker page count. When omitted the default is chosen by `capture` (see
   * below): the DOM-screenshot path on software-GL Chromium does NOT scale with
   * contexts — measured, 6 workers was SLOWER than 1 (the single shared
   * SwiftShader GL + screenshot round-trip serialises, and extra contexts only
   * add RAM pressure + scheduler contention). So the DOM default is a low,
   * non-oversubscribing 1; the canvas-readback path (`gl.readPixels`, no
   * screenshot round-trip) parallelises cleanly and defaults to `min(6,
   * cores-2)`. Pass an explicit value to override either default.
   */
  workers?: number;
  /**
   * Capture mode hint used ONLY to pick the default `workers` count (the actual
   * per-frame capture path is still auto-detected per scene via
   * `__KINO_CANVAS_ONLY__`). `"dom"` (default) = DOM-screenshot scenes →
   * conservative 1-worker default; `"canvas"` = pure-canvas/3D scenes that read
   * back from the GPU → parallel default. Ignored when `workers` is set.
   */
  capture?: "dom" | "canvas";
  /** Frames per second. Default 30. */
  fps?: number;
  /**
   * Draft mode: JPEG q90 capture (≈3× faster to encode) instead of PNG. Finals
   * use PNG for lossless frames. (`ENGINE_DESIGN §4`.)
   */
  draft?: boolean;
  /**
   * Root dir under which `vo.audioUrl` / `screen` asset keys resolve to local
   * files. Defaults to `<repo>/public`. (Asset URLs that are `http(s)://` or
   * absolute paths are used verbatim.)
   */
  assetRoot?: string;
  /** Optional per-frame cache dir. Default a temp dir keyed by spec hash. */
  cacheDir?: string;
  /**
   * Ambient music-bed path (asset key or absolute/remote). Mixed UNDER the VO,
   * looped/trimmed to the video length, faded, and SIDECHAIN-DUCKED so it dips
   * while the voice speaks and rises in gaps (`mixMusicBed`). Must be an
   * INSTRUMENTAL bed — never a vocal track under narration (CLAUDE.md).
   * Default: `audio/ncs-sky-high.mp3` (the instrumental NCS bed) when present.
   */
  musicBed?: string;
  /**
   * Enable the music bed. Default: ON when a bed file resolves AND at least one
   * scene carries VO (a bed only makes sense under narration). Set `false` to
   * force a VO-only / silent master.
   */
  music?: boolean;
  /** Optional logger. Default `console.log`. */
  log?: (msg: string) => void;
};

export type RenderResult = {
  outPath: string;
  /** Total frames rendered. */
  frames: number;
  /** Output duration in seconds. */
  durationS: number;
  /**
   * Path to the emitted WebVTT sidecar (`<outPath>.vtt`), or `null` when no
   * scene carried a VO line (nothing to caption). The burned-in band is the
   * primary deliverable; the `.vtt` ships alongside for players/SEO/a11y
   * (`SAAS_ROADMAP.md §5` — "MP4+thumb+.vtt").
   */
  vttPath: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const FORMATS: Record<VideoSpec["format"], readonly [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

const REPO_ROOT = resolve(__dirname, "..", "..");

/* -------------------------------------------------------------------------- */
/*  Asset path resolution                                                      */
/* -------------------------------------------------------------------------- */

function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Resolve an asset key/url to a local filesystem path (or `null` if remote). */
function resolveAssetPath(url: string, assetRoot: string): string | null {
  if (isRemote(url)) return null;
  if (url.startsWith("/") && existsSync(url)) return url;
  // Treat as a key under the asset root. Tolerate a leading "public/" or "/".
  const cleaned = url.replace(/^public[\\/]/, "").replace(/^[\\/]+/, "");
  return join(assetRoot, cleaned);
}

/* -------------------------------------------------------------------------- */
/*  VO duration probing (ffprobe)                                              */
/* -------------------------------------------------------------------------- */

function run(
  cmd: string,
  args: string[],
  opts: { input?: Buffer } = {},
): Promise<{ code: number; stdout: Buffer; stderr: Buffer }> {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));
    child.on("error", rej);
    child.on("close", (code) =>
      res({ code: code ?? 0, stdout: Buffer.concat(out), stderr: Buffer.concat(err) }),
    );
    if (opts.input) {
      child.stdin.write(opts.input);
    }
    child.stdin.end();
  });
}

/** Probe an audio file's duration in seconds via ffprobe. */
async function probeDurationS(file: string): Promise<number> {
  const { code, stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  if (code !== 0) {
    throw new Error(`ffprobe failed for ${file}`);
  }
  const s = Number.parseFloat(stdout.toString("utf8").trim());
  if (!Number.isFinite(s) || s <= 0) {
    throw new Error(`ffprobe returned a bad duration (${s}) for ${file}`);
  }
  return s;
}

/** Measure VO seconds for every scene whose `vo.audioUrl` resolves to a file. */
async function measureVoSeconds(
  spec: VideoSpec,
  assetRoot: string,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    spec.scenes.map(async (scene: SceneSpec) => {
      const url = scene.vo?.audioUrl;
      if (!url) return;
      const path = resolveAssetPath(url, assetRoot);
      if (!path || !existsSync(path)) {
        // No measurable audio on disk → fall back to minFrames (no entry).
        return;
      }
      out[scene.id] = await probeDurationS(path);
    }),
  );
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Host bundle (esbuild)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * esbuild the host entry into a single self-contained IIFE JS string.
 * Delegates to the host module's `buildHost()` (single source of truth) so the
 * bundle config never drifts between the orchestrator and the dev command.
 */
async function bundleHost(): Promise<{ code: string; css: string }> {
  const { code, css } = await buildHost();
  return { code, css };
}

/* -------------------------------------------------------------------------- */
/*  Static host server                                                          */
/* -------------------------------------------------------------------------- */

type HostServer = {
  url: string;
  close(): Promise<void>;
};

/**
 * Serve a single HTML page that injects the spec + measured VO seconds + the
 * bundle, and serves local asset files (screens, etc.) under `/assets/...`.
 */
async function serveHost(
  spec: VideoSpec,
  fps: number,
  voSeconds: Record<string, number>,
  bundle: string,
  css: string,
  assetRoot: string,
): Promise<HostServer> {
  // Use the host module's HTML renderer — it carries the `</script>` / U+2028
  // / U+2029 escaping that makes injecting an arbitrary spec safe, and embeds
  // the brand `@font-face` CSS so glyphs are real Space Grotesk/Inter.
  const html = renderHostHtml({ spec, bundle, css, voDurations: voSeconds, fps });

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
          const buf = await readFile(file);
          res.writeHead(200);
          res.end(buf);
          return;
        } catch {
          /* fall through to 404 */
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
    throw new Error("host server failed to bind a port");
  }
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    close: () =>
      new Promise<void>((res) => {
        server.close(() => res());
      }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Active-scene lookup (for cache keying)                                      */
/* -------------------------------------------------------------------------- */

/** Which scene ids are visible at `frame` (accounting for transition overlap). */
function activeSceneIds(placed: PlacedScene[], frame: number): string[] {
  const ids: string[] = [];
  for (const p of placed) {
    if (frame >= p.from && frame < p.from + p.durationInFrames) {
      ids.push(p.id);
    }
  }
  return ids;
}

/* -------------------------------------------------------------------------- */
/*  Capture                                                                     */
/* -------------------------------------------------------------------------- */

type CaptureMode = "dom" | "canvas";

/**
 * Capture one painted frame. Prefers the canvas `gl.readPixels` fast path when
 * the host flags the scene stack as canvas-only (`__KINO_CANVAS_ONLY__`),
 * otherwise a DOM screenshot. Returns the raw image bytes + which mode was used.
 */
async function captureFrame(
  page: Page,
  w: number,
  h: number,
  fmt: "png" | "jpeg",
): Promise<{ bytes: Buffer; mode: CaptureMode }> {
  const canvasOnly = (await page.evaluate(() => window.__KINO_CANVAS_ONLY__ === true)) as boolean;

  if (canvasOnly) {
    // Read the single full-bleed canvas straight out of the GPU as a PNG data
    // URL — no browser-screenshot round-trip (the biggest throughput win for
    // pure-3D/generative scenes, `ENGINE_DESIGN §4`).
    const dataUrl = (await page.evaluate(
      ([fw, fh]) => {
        const root = document.querySelector("[data-kino-stage]");
        // Capture the DETERMINISTIC 2D present canvas — the one the shader's
        // present pass blits its `gl.readPixels` framebuffer into — NOT the live
        // WebGL canvas. Reading the live GL surface here would bypass the present
        // readback the determinism fix is built around (det. review B3): a 2D
        // canvas `toDataURL`s its byte-stable backing store, whereas the live GL
        // canvas's contents depend on compositor timing. Fall back to any canvas
        // only if the present surface is somehow absent.
        const present = root?.querySelector(
          "canvas[data-kino-shader-present]",
        ) as HTMLCanvasElement | null;
        const canvas =
          present ?? (root?.querySelector("canvas") as HTMLCanvasElement | null);
        if (!canvas) return null;
        void fw;
        void fh;
        try {
          return canvas.toDataURL("image/png");
        } catch {
          return null;
        }
      },
      [w, h] as [number, number],
    )) as string | null;

    if (dataUrl && dataUrl.startsWith("data:image/png;base64,")) {
      const bytes = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
      return { bytes, mode: "canvas" };
    }
    // Fall through to DOM screenshot if read-back failed.
  }

  const bytes = await page.screenshot({
    type: fmt,
    quality: fmt === "jpeg" ? 90 : undefined,
    clip: { x: 0, y: 0, width: w, height: h },
    animations: "disabled",
    caret: "hide",
  });
  return { bytes: bytes as Buffer, mode: "dom" };
}

/* -------------------------------------------------------------------------- */
/*  Worker: render a contiguous frame range on one persistent page             */
/* -------------------------------------------------------------------------- */

type Shard = { start: number; end: number }; // [start, end)

type WorkerStats = {
  domFrames: number;
  domMs: number;
  canvasFrames: number;
  canvasMs: number;
  cacheHits: number;
};

async function renderShard(
  page: Page,
  shard: Shard,
  ctx: {
    spec: VideoSpec;
    placed: PlacedScene[];
    w: number;
    h: number;
    fmt: "png" | "jpeg";
    framePath: (frame: number) => string;
    cacheKey: (frame: number) => string;
    cacheLookupPath: (key: string) => string;
  },
): Promise<WorkerStats> {
  const stats: WorkerStats = {
    domFrames: 0,
    domMs: 0,
    canvasFrames: 0,
    canvasMs: 0,
    cacheHits: 0,
  };

  for (let frame = shard.start; frame < shard.end; frame++) {
    const outFile = ctx.framePath(frame);
    const key = ctx.cacheKey(frame);
    const cached = ctx.cacheLookupPath(key);

    // Cache hit: copy the cached image into the frame slot, skip rendering.
    if (existsSync(cached)) {
      await writeFile(outFile, await readFile(cached));
      stats.cacheHits++;
      continue;
    }

    // Drive the persistent page to this frame WITHOUT a navigation.
    await page.evaluate(async (f: number) => {
      const render = window.__KINO_RENDER_FRAME__;
      if (!render) throw new Error("host bundle did not expose __KINO_RENDER_FRAME__");
      await render(f);
    }, frame);

    // Paint gate: the host sets __KINO_READY__ only after a double real-rAF.
    // Race against __KINO_ERROR__ so a thrown scene fails the frame fast
    // instead of hanging until the timeout.
    // `polling` MUST be a fixed interval, NOT the default rAF: the determinism
    // sandbox makes `requestAnimationFrame` synchronous, so Playwright's default
    // rAF-driven poll would re-enter rAF inside its own callback → infinite
    // recursion (stack overflow). A 16ms interval poll sidesteps the patched rAF.
    await page.waitForFunction(
      () => window.__KINO_READY__ === true || typeof window.__KINO_ERROR__ === "string",
      undefined,
      { timeout: 30_000, polling: 16 },
    );
    const frameErr = (await page.evaluate(() => window.__KINO_ERROR__)) as
      | string
      | undefined;
    if (frameErr) {
      throw new Error(`host render failed at frame ${frame}:\n${frameErr}`);
    }

    const t0 = Date.now();
    const { bytes, mode } = await captureFrame(page, ctx.w, ctx.h, ctx.fmt);
    const dt = Date.now() - t0;
    if (mode === "canvas") {
      stats.canvasFrames++;
      stats.canvasMs += dt;
    } else {
      stats.domFrames++;
      stats.domMs += dt;
    }

    await writeFile(outFile, bytes);
    await writeFile(cached, bytes); // populate the per-frame cache
  }

  return stats;
}

/* -------------------------------------------------------------------------- */
/*  Frame-range sharding                                                        */
/* -------------------------------------------------------------------------- */

/** Split `[0,total)` into `n` contiguous, near-equal ranges. */
function shardRanges(total: number, n: number): Shard[] {
  const shards: Shard[] = [];
  const per = Math.ceil(total / n);
  for (let start = 0; start < total; start += per) {
    shards.push({ start, end: Math.min(start + per, total) });
  }
  return shards;
}

/* -------------------------------------------------------------------------- */
/*  Audio concat (master track for the mux)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build the master audio track: each scene's VO placed at its frame offset, so
 * the muxed audio lines up with the visuals. Uses ffmpeg `adelay` + `amix`.
 * Returns the path to a wav, or `null` when no scene has audio.
 */
async function buildMasterAudio(
  spec: VideoSpec,
  placed: PlacedScene[],
  fps: number,
  assetRoot: string,
  workDir: string,
): Promise<string | null> {
  const inputs: { file: string; delayMs: number }[] = [];
  for (let i = 0; i < spec.scenes.length; i++) {
    const url = spec.scenes[i].vo?.audioUrl;
    if (!url) continue;
    const file = resolveAssetPath(url, assetRoot);
    if (!file || !existsSync(file)) continue;
    inputs.push({ file, delayMs: Math.round((placed[i].from / fps) * 1000) });
  }
  if (inputs.length === 0) return null;

  const out = join(workDir, "master-audio.wav");
  const args: string[] = [];
  for (const inp of inputs) {
    args.push("-i", inp.file);
  }
  // Delay each input, then mix. `amix` normalizes by input count by default;
  // use `normalize=0` to preserve the already-loudnorm'd I=-14 levels.
  const filters = inputs
    .map((inp, i) => `[${i}:a]adelay=${inp.delayMs}|${inp.delayMs}[a${i}]`)
    .join(";");
  const mixInputs = inputs.map((_, i) => `[a${i}]`).join("");
  const filterComplex =
    inputs.length === 1
      ? `${filters}[aout]`
      : `${filters};${mixInputs}amix=inputs=${inputs.length}:normalize=0[aout]`;

  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    "[aout]",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-y",
    out,
  );

  const { code, stderr } = await run("ffmpeg", args);
  if (code !== 0) {
    throw new Error(`ffmpeg audio concat failed:\n${stderr.toString("utf8").slice(-2000)}`);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Encode (frames → h264) + mux                                                */
/* -------------------------------------------------------------------------- */

async function encodeVideo(
  framesGlob: { dir: string; ext: string },
  fps: number,
  masterAudio: string | null,
  outPath: string,
  draft: boolean,
): Promise<void> {
  await mkdir(dirname(resolve(outPath)), { recursive: true });

  const args: string[] = [
    "-framerate",
    String(fps),
    "-i",
    join(framesGlob.dir, `frame-%06d.${framesGlob.ext}`),
  ];

  if (masterAudio) {
    args.push("-i", masterAudio);
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    draft ? "veryfast" : "medium",
    "-crf",
    draft ? "26" : "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
  );

  if (masterAudio) {
    args.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  }

  args.push("-y", outPath);

  const { code, stderr } = await run("ffmpeg", args);
  if (code !== 0) {
    throw new Error(`ffmpeg encode failed:\n${stderr.toString("utf8").slice(-2000)}`);
  }
}

/* -------------------------------------------------------------------------- */
/*  Caption sidecar (.vtt)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Emit the WebVTT sidecar next to the MP4. Builds the caption track from each
 * scene's `vo.text` + the SAME measured placement the render used, via the shared
 * `src/kino-scenes/captions` cue model — so the sidecar timing is identical to
 * the burned-in band. Returns the `.vtt` path, or `null` when no scene has VO.
 */
async function writeVttSidecar(
  spec: VideoSpec,
  placed: PlacedScene[],
  fps: number,
  outPath: string,
): Promise<string | null> {
  const inputs: CaptionSceneInput[] = spec.scenes.map((scene, i) => ({
    id: scene.id,
    // Same shared rule the burned-in band uses (`captionTextForScene`): a
    // headline scene (the Hook) whose words are already on screen contributes no
    // cue, so the sidecar and the band drop it together and never diverge.
    text: captionTextForScene(scene.component, scene.vo?.text),
    from: placed[i].from,
    durationInFrames: placed[i].durationInFrames,
  }));
  const track = buildCaptionTrack(inputs);
  if (track.length === 0) return null;

  // `<outPath>.vtt` — keep the full mp4 name + `.vtt` so `out/foo.mp4` →
  // `out/foo.mp4.vtt` sits unambiguously beside its video.
  const vttPath = `${outPath}.vtt`;
  await mkdir(dirname(resolve(vttPath)), { recursive: true });
  await writeFile(vttPath, trackToVtt(track, fps), "utf8");
  return vttPath;
}

/* -------------------------------------------------------------------------- */
/*  renderVideo — the entry point                                              */
/* -------------------------------------------------------------------------- */

export async function renderVideo(
  spec: VideoSpec,
  opts: RenderOptions,
): Promise<RenderResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const fps = opts.fps ?? 30;
  const draft = opts.draft ?? false;
  const fmt: "png" | "jpeg" = draft ? "jpeg" : "png";
  const ext = draft ? "jpg" : "png";
  const assetRoot = opts.assetRoot ?? join(REPO_ROOT, "public");
  const cores = cpus().length;
  // Default worker count is gated on capture mode (see `RenderOptions.workers`).
  // DOM screenshots on software-GL Chromium do not scale with contexts (measured
  // 6-worker slower than 1), so the DOM default is a non-oversubscribing 1; the
  // canvas-readback path parallelises, so it defaults to `min(6, cores-2)`.
  const captureMode: "dom" | "canvas" = opts.capture ?? "dom";
  const parallelDefault = Math.min(6, Math.max(1, cores - 2));
  const defaultWorkers = captureMode === "canvas" ? parallelDefault : 1;
  const workers = Math.max(1, opts.workers ?? defaultWorkers);

  const [w, h] = FORMATS[spec.format];

  // 1. Measure VO durations (node-side) so placement is VO-derived.
  log(`[kino] probing VO durations…`);
  const voSeconds = await measureVoSeconds(spec, assetRoot);

  // 2. Placement → total frames + per-scene windows.
  const placement = placeScenes(
    spec.scenes.map((s: SceneSpec) => ({
      id: s.id,
      minFrames: REGISTRY[s.component as SceneName].minFrames,
      voSeconds: s.vo?.audioUrl ? voSeconds[s.id] ?? null : null,
    })),
    { fps, overlap: spec.transitions.durationInFrames },
  );
  const total = placement.totalFrames;
  if (total <= 0) {
    throw new Error("renderVideo: spec placed to zero frames.");
  }
  log(`[kino] ${total} frames @ ${fps}fps, ${spec.format} (${w}×${h}), ${workers} workers, ${draft ? "DRAFT/jpeg" : "FINAL/png"}`);

  // 3. Bundle the host entry (JS + embedded brand-font CSS).
  log(`[kino] bundling host…`);
  const { code: bundle, css: fontCss } = await bundleHost();
  // Hash of the rendering CODE — folded into every per-frame cache key so an
  // engine/scene/shader change invalidates stale cached frames (the data-only
  // key would otherwise serve pixels from old code after a refactor).
  const codeVersion = createHash("sha1")
    .update(bundle)
    .update(fontCss)
    .digest("hex")
    .slice(0, 12);

  // 4. Working dirs + cache.
  const sh = specHash(spec);
  const workDir = join(tmpdir(), `kino-${sh}-${process.pid}`);
  const framesDir = join(workDir, "frames");
  const cacheDir = opts.cacheDir ?? join(tmpdir(), "kino-cache", sh);
  await mkdir(framesDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  const framePath = (frame: number): string =>
    join(framesDir, `frame-${String(frame).padStart(6, "0")}.${ext}`);
  const cacheKey = (frame: number): string =>
    frameHash(spec, frame, activeSceneIds(placement.scenes, frame), fmt, codeVersion);
  const cacheLookupPath = (key: string): string => join(cacheDir, `${key}.${ext}`);

  // 5. Serve the host page.
  const host = await serveHost(spec, fps, voSeconds, bundle, fontCss, assetRoot);

  // 6. Launch one browser; open `workers` PERSISTENT pages.
  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      // Force a stable WebGL backend; NEVER request MSAA/antialias.
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--hide-scrollbars",
    ],
  });

  const shards = shardRanges(total, workers).slice(0, workers);
  const startedAt = Date.now();

  let agg: WorkerStats = {
    domFrames: 0,
    domMs: 0,
    canvasFrames: 0,
    canvasMs: 0,
    cacheHits: 0,
  };

  try {
    const pages = await Promise.all(
      shards.map(async () => {
        const ctxPage = await browser.newContext({
          viewport: { width: w, height: h },
          deviceScaleFactor: 1,
        });
        const page = await ctxPage.newPage();
        return page;
      }),
    );

    // ONE goto per page (persistent-page model). Land on the shard's first
    // frame; the worker then re-renders each subsequent frame in place.
    await Promise.all(
      shards.map(async (shard, i) => {
        await pages[i].goto(`${host.url}/?frame=${shard.start}`, {
          waitUntil: "domcontentloaded",
        });
        await pages[i].waitForFunction(
          () =>
            window.__KINO_READY__ === true ||
            typeof window.__KINO_ERROR__ === "string",
          undefined,
          // Interval poll (see note at the per-frame gate): the synchronous
          // sandboxed rAF makes the default rAF poll recurse infinitely.
          { timeout: 60_000, polling: 16 },
        );
        const bootErr = (await pages[i].evaluate(() => window.__KINO_ERROR__)) as
          | string
          | undefined;
        if (bootErr) {
          throw new Error(`host boot failed (shard ${i}):\n${bootErr}`);
        }
      }),
    );

    // Render every shard concurrently.
    const results = await Promise.all(
      shards.map((shard, i) =>
        renderShard(pages[i], shard, {
          spec,
          placed: placement.scenes,
          w,
          h,
          fmt,
          framePath,
          cacheKey,
          cacheLookupPath,
        }),
      ),
    );

    for (const r of results) {
      agg = {
        domFrames: agg.domFrames + r.domFrames,
        domMs: agg.domMs + r.domMs,
        canvasFrames: agg.canvasFrames + r.canvasFrames,
        canvasMs: agg.canvasMs + r.canvasMs,
        cacheHits: agg.cacheHits + r.cacheHits,
      };
    }
  } finally {
    await browser.close();
    await host.close();
  }

  const captureS = (Date.now() - startedAt) / 1000;

  // 7. Per-mode throughput log (`ENGINE_DESIGN §4` — "log per-mode throughput").
  const domFps = agg.domMs > 0 ? (agg.domFrames / (agg.domMs / 1000)).toFixed(1) : "n/a";
  const canvasFps =
    agg.canvasMs > 0 ? (agg.canvasFrames / (agg.canvasMs / 1000)).toFixed(1) : "n/a";
  log(
    `[kino] captured ${total} frames in ${captureS.toFixed(1)}s ` +
      `(${(total / captureS).toFixed(1)} fps wall) — ` +
      `DOM ${agg.domFrames} @ ${domFps} fps/page · ` +
      `canvas ${agg.canvasFrames} @ ${canvasFps} fps/page · ` +
      `cache hits ${agg.cacheHits}`,
  );

  // 8. Build the master audio track (placed VO), if any.
  log(`[kino] building master audio…`);
  let masterAudio = await buildMasterAudio(spec, placement.scenes, fps, assetRoot, workDir);

  // 8b. Ducked ambient music bed (audio-only — the video stream is untouched, so
  // it stays byte-identical across renders). Default ON when a bed resolves AND
  // there is VO to duck under; never a vocal track under narration (CLAUDE.md).
  const bedKey = opts.musicBed ?? DEFAULT_MUSIC_BED;
  const bedPath = resolveAssetPath(bedKey, assetRoot);
  const bedExists = !!bedPath && existsSync(bedPath);
  const musicEnabled = (opts.music ?? bedExists) && masterAudio !== null && bedExists;
  if (musicEnabled && masterAudio && bedPath) {
    log(`[kino] mixing ducked music bed (${bedKey})…`);
    try {
      masterAudio = await mixMusicBed(masterAudio, bedPath, total / fps, workDir, run);
    } catch (err) {
      // A bed-mix failure must not lose the VO — fall back to the VO-only master.
      log(`[kino] music bed mix failed (${(err as Error).message}); using VO-only master.`);
    }
  } else if (opts.music && !bedExists) {
    log(`[kino] music requested but bed not found (${bedKey}) — VO-only master.`);
  }

  // 8c. CTA accent — one short positive earcon overlaid at the final CTA's pill
  // reveal (the video's single rhythmic "signature moment"). Audio-only and
  // FAILURE-ISOLATED: any error keeps the prior master so the accent can never
  // regress the VO/bed. Placed at the CTA scene start + the pill-reveal offset
  // (`useEnter(34)` in the CTA archetype → the pill lands ~frame 38).
  if (masterAudio) {
    const ctaIndex = spec.scenes.findIndex((s) => s.component === "CTA");
    const accentPath = resolveAssetPath(DEFAULT_CTA_ACCENT, assetRoot);
    if (ctaIndex >= 0 && accentPath && existsSync(accentPath)) {
      const atFrame = placement.scenes[ctaIndex].from + 38;
      const atS = atFrame / fps;
      if (atS < total / fps) {
        log(`[kino] overlaying CTA accent (${DEFAULT_CTA_ACCENT}) @ ${atS.toFixed(2)}s…`);
        try {
          masterAudio = await overlayAccent(masterAudio, accentPath, atS, total / fps, workDir, run);
        } catch (err) {
          log(`[kino] CTA accent overlay failed (${(err as Error).message}); using prior master.`);
        }
      }
    }
  }

  // 9. Encode + mux.
  log(`[kino] encoding h264${masterAudio ? " + audio mux" : ""}…`);
  await encodeVideo({ dir: framesDir, ext }, fps, masterAudio, opts.outPath, draft);

  // 9b. Emit the WebVTT caption sidecar (same cue model as the burned-in band).
  const vttPath = await writeVttSidecar(spec, placement.scenes, fps, opts.outPath);
  if (vttPath) log(`[kino] wrote captions → ${vttPath}`);

  // 10. Clean the scratch frames (keep the cache dir).
  await rm(workDir, { recursive: true, force: true });

  const durationS = total / fps;
  log(`[kino] done → ${opts.outPath} (${total} frames, ${durationS.toFixed(2)}s)`);

  return { outPath: opts.outPath, frames: total, durationS, vttPath };
}

/* -------------------------------------------------------------------------- */
/*  Small helper kept local to avoid an extra import surface                    */
/* -------------------------------------------------------------------------- */

/** Short content hash of an arbitrary buffer (debug / dedupe convenience). */
export function bufferHash(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex").slice(0, 12);
}
