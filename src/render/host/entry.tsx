/**
 * Kino render HOST (browser entry).
 *
 * Bundled by `buildHost()` (esbuild) into a single servable JS, then loaded in a
 * persistent Playwright page. For a `window.__KINO_SPEC__` (a `VideoSpec`) it
 * renders ONE frame — the frame named by `?frame=N` — of the full scene stack,
 * and signals readiness on `window.__KINO_READY__` once a real paint has landed.
 *
 * SHARED RENDER INTERFACE (honoured exactly):
 *  - Scene components come from `src/kino-scenes` as
 *    `KINO_SCENES: Record<SceneName, React.FC<any>>`.
 *  - The scene stack (placement + `<Series>` overlap + `<PaletteProvider>`) is
 *    built by `./stack` (single source of truth, shared with the dev harness).
 *  - Per-scene `durationInFrames` is derived with `placeScenes` from
 *    `src/vo/place.ts`: a scene with no `vo.audioUrl` uses its registry
 *    `minFrames`; a scene WITH VO uses its MEASURED seconds (probed node-side and
 *    injected as `window.__KINO_VO_SECONDS__`).
 *  - Scenes receive ONLY their schema props (no host-injected extras).
 *
 * DETERMINISM-REVIEW FIXES (mandatory):
 *  1. Capture the REAL `requestAnimationFrame` BEFORE `installDeterminism` (the
 *     sandbox replaces rAF with a synchronous virtual-clock shim; the readiness
 *     gate needs the genuine one to actually wait for paint).
 *  2. Set `window.__KINO_READY__` only after a DOUBLE real rAF — that proves the
 *     browser has PAINTED (layout alone is not enough).
 *  3. Never let a WebGL context be created with `antialias:true` — patch
 *     `getContext` to force `antialias:false` (MSAA resolve is nondeterministic
 *     across drivers → sub-pixel flicker between sharded frames).
 */

import { createRoot, type Root } from "react-dom/client";

// FONT EMBEDDING (review P0): import the brand variable-font stylesheets so
// their `@font-face` rules are bundled INTO the host. `build.ts` configures the
// `css` + `dataurl` loaders, so esbuild emits a CSS output with every woff2
// inlined as a data URL; the orchestrator/dev host inject that CSS into the
// page `<head>`. Without these imports the served page has no font faces and
// text falls back to a system sans — the exact regression this fixes. The
// faces match `kit.tsx:FONTS` ('Space Grotesk Variable' / 'Inter Variable' /
// 'JetBrains Mono Variable') and the four presets in `src/design/presets.ts`.
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";

import { installDeterminism, type DeterminismHandle } from "../../engine";
import type { VideoSpec } from "../../spec";
import { VideoSpec as VideoSpecSchema } from "../../spec";
import { KINO_SCENES } from "../../kino-scenes";

import { FrameStage, placeSpec, type VoDurations } from "./stack";

/* -------------------------------------------------------------------------- */
/*  Window contract (set by the served host page before this bundle loads)     */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    /** The spec to render. Injected as a literal by the static host page. */
    __KINO_SPEC__?: VideoSpec;
    /** Measured VO duration (seconds) per scene id — probed node-side. */
    __KINO_VO_SECONDS__?: VoDurations;
    /** Frames per second. Default 30 (repo convention). */
    __KINO_FPS__?: number;
    /** Set true after a painted frame is on screen. The capture gate. */
    __KINO_READY__?: boolean;
    /** Total composition length, exposed for the orchestrator to sanity-check. */
    __KINO_TOTAL_FRAMES__?: number;
    /**
     * Imperative re-render seam. The orchestrator calls this (via
     * `page.evaluate`) to move to a new frame WITHOUT a navigation — the
     * persistent-page fast path. Resolves once the new frame has painted.
     */
    __KINO_RENDER_FRAME__?: (frame: number) => Promise<void>;
    /**
     * Marks the scene stack as canvas-only (a single full-bleed WebGL canvas),
     * so the orchestrator may use the `gl.readPixels` fast path instead of a
     * DOM screenshot. Set by the host after mount.
     */
    __KINO_CANVAS_ONLY__?: boolean;
    /** Set if boot throws — lets the orchestrator fail fast instead of hanging. */
    __KINO_ERROR__?: string;
  }
}

/* -------------------------------------------------------------------------- */
/*  (1) Real rAF — captured BEFORE the determinism sandbox replaces it          */
/* -------------------------------------------------------------------------- */

// The sandbox swaps `requestAnimationFrame` for a SYNCHRONOUS virtual-clock shim
// (it fires the callback inline at the virtual clock). That shim is fine for a
// legacy rAF-driven scene, but it is poison for two things the render depends on:
//   - the paint gate (a synchronous rAF can't wait for a real composite), and
//   - any host-environment poller that schedules on rAF (React's scheduler,
//     Playwright's `waitForFunction`) — a synchronous, self-rescheduling rAF
//     recurses until the stack overflows.
// So we snapshot the GENUINE rAF/cAF here at module load, and (in `boot`) restore
// them onto `window` immediately after installing the sandbox. Determinism is
// unaffected: scenes express motion purely through `useFrame()`, never rAF — the
// parts that matter (Math.random / Date / performance.now) stay virtualised.
const REAL_RAF: (cb: FrameRequestCallback) => number =
  typeof window !== "undefined" &&
  typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (cb: FrameRequestCallback) =>
        // Headless fallback: a two-step macrotask still serialises after paint.
        setTimeout(() => cb(0), 0) as unknown as number;

const REAL_CAF: (handle: number) => void =
  typeof window !== "undefined" &&
  typeof window.cancelAnimationFrame === "function"
    ? window.cancelAnimationFrame.bind(window)
    : (handle: number) => clearTimeout(handle as unknown as NodeJS.Timeout);

/** (2) Resolve after a DOUBLE real rAF — proof of paint, not merely of layout. */
function afterPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    REAL_RAF(() => {
      REAL_RAF(() => resolve());
    });
  });
}

/**
 * Await decode of every `<img>` currently in the stage so a frame is never
 * captured with a half-decoded bitmap (the transition-frame nondeterminism).
 * `decode()` is idempotent and instant once a bitmap is cached, so this is cheap
 * after the first frame that touched a given source. Failures (e.g. a broken
 * src) are swallowed — a missing image must not hang the render.
 */
async function decodeAllImages(): Promise<void> {
  if (typeof document === "undefined") return;
  const imgs = Array.from(document.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        // Gate ONLY on `img.complete`. A loaded image (success) OR a settled
        // FAILURE (a 404/broken src) both report `complete === true` — for a
        // broken img `naturalWidth` is 0, so the old `|| naturalWidth === 0`
        // guard re-entered the wait on an ALREADY-FAILED image, where the
        // load/error listeners never fire again, so it burned the full 2000ms
        // timeout EVERY frame (and `decodeAllImages` runs twice per frame → +4s
        // per frame on any scene with a missing still). `complete` already means
        // "loading has finished, success or fail", so a broken img falls straight
        // through with no wait.
        if (!img.complete) {
          await new Promise<void>((res) => {
            let settled = false;
            const done = (): void => {
              if (settled) return;
              settled = true;
              res();
            };
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            // 2s is far above a localhost asset fetch yet bounds a stuck load.
            setTimeout(done, 2000);
          });
        }
        // Only decode a successfully-loaded bitmap; `decode()` on a broken img
        // rejects (caught below, but skip the throw entirely when we can tell).
        if (img.naturalWidth > 0 && typeof img.decode === "function") {
          await img.decode();
        }
      } catch {
        /* broken/cross-origin image — skip rather than hang */
      }
    }),
  );
}

/**
 * Restore the genuine `requestAnimationFrame`/`cancelAnimationFrame` on `window`
 * after the determinism sandbox has replaced them with its synchronous shim.
 * Leaves the sandbox's `Math.random`/`Date`/`performance.now` virtualisation in
 * place — only rAF/cAF are reverted, because the host (and the surrounding tools)
 * need a real async vsync, and scenes never read rAF for motion.
 */
function restoreRealRaf(): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame =
    REAL_RAF as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = REAL_CAF as typeof window.cancelAnimationFrame;
}

/* -------------------------------------------------------------------------- */
/*  (3) Forbid antialias:true on any WebGL context                              */
/* -------------------------------------------------------------------------- */

/**
 * Patch `HTMLCanvasElement.getContext` so any WebGL/WebGL2 context is forced to
 * `antialias:false` with a stable, deterministic attribute set. Done once, at
 * boot, BEFORE any scene can request a context. 2D and other contexts pass
 * through unchanged.
 */
function forbidWebglAntialias(): void {
  if (typeof HTMLCanvasElement === "undefined") return;
  const proto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
    __kinoPatched__?: boolean;
  };
  if (proto.__kinoPatched__) return;

  const original = proto.getContext;
  proto.getContext = function patched(
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown,
  ): ReturnType<HTMLCanvasElement["getContext"]> {
    if (
      contextId === "webgl" ||
      contextId === "webgl2" ||
      contextId === "experimental-webgl"
    ) {
      const opts = {
        ...((options as object | undefined) ?? {}),
      } as WebGLContextAttributes;
      opts.antialias = false;
      if (opts.preserveDrawingBuffer === undefined) {
        opts.preserveDrawingBuffer = true;
      }
      if (opts.powerPreference === undefined) {
        opts.powerPreference = "high-performance";
      }
      return original.call(this, contextId, opts) as ReturnType<
        HTMLCanvasElement["getContext"]
      >;
    }
    return original.call(this, contextId, options as never) as ReturnType<
      HTMLCanvasElement["getContext"]
    >;
  } as HTMLCanvasElement["getContext"];

  proto.__kinoPatched__ = true;
}

/* -------------------------------------------------------------------------- */
/*  Context resolution                                                          */
/* -------------------------------------------------------------------------- */

type HostContext = {
  spec: VideoSpec;
  fps: number;
  voDurations: VoDurations;
};

/**
 * Read + VALIDATE the injected context. Parsing the spec here (not trusting the
 * literal) is the review's "fail closed": a malformed spec throws at boot rather
 * than painting garbage. The parse is cheap and runs once before first render.
 */
function readContext(): HostContext {
  if (!window.__KINO_SPEC__) {
    throw new Error(
      "host/entry: window.__KINO_SPEC__ is not set. The served page must inject the spec before loading this bundle.",
    );
  }
  const spec = VideoSpecSchema.parse(window.__KINO_SPEC__);
  const fps = window.__KINO_FPS__ ?? 30;
  const voDurations = window.__KINO_VO_SECONDS__ ?? {};
  return { spec, fps, voDurations };
}

/** True when the whole scene stack is a single full-bleed canvas (read-back fast path). */
function detectCanvasOnly(container: HTMLElement): boolean {
  // EXPLICIT INTENT WINS. `<ShaderMesh requestCanvasReadback>` sets this flag in a
  // layout effect to opt into the read-back fast path. A standalone shader beat now
  // renders TWO canvases (the live WebGL surface + the deterministic 2D present
  // canvas the orchestrator captures), so the old "exactly one canvas" heuristic
  // would mis-classify it as DOM. Honour the flag the component asserted (det.
  // review B3 tie-in) and skip the fragile structural sniff.
  if (window.__KINO_CANVAS_ONLY__ === true) return true;

  const stage = container.querySelector("[data-kino-stage]");
  if (!stage) return false;
  // Otherwise sniff conservatively: a canvas-only scene paints canvas(es) and
  // nothing else (no real text/img/svg/video over them). The shader backdrop
  // renders a live GL canvas + a 2D present canvas, so allow >1 canvas as long as
  // there is no NON-canvas paint on top.
  const canvases = stage.querySelectorAll("canvas");
  if (canvases.length === 0) return false;
  const hasOtherPaint =
    stage.querySelectorAll("img,svg,video").length > 0 ||
    Boolean(stage.textContent && stage.textContent.trim().length > 0);
  return !hasOtherPaint;
}

/* -------------------------------------------------------------------------- */
/*  Mount + per-frame drive                                                     */
/* -------------------------------------------------------------------------- */

let reactRoot: Root | null = null;
let determinism: DeterminismHandle | null = null;
// The validated context is resolved once and memoised; the spec is constant for
// the page lifetime (one spec per served page), so re-parsing per frame is waste.
let ctx: HostContext | null = null;
let totalFrames = 0;

/**
 * Render the given frame and resolve once it has PAINTED. Installs the
 * determinism sandbox lazily on first call (the real rAF was already captured at
 * module top, before this can run).
 */
async function renderFrame(frame: number): Promise<void> {
  if (!ctx) {
    ctx = readContext();
    totalFrames = placeSpec(ctx.spec, ctx.voDurations, {
      fps: ctx.fps,
    }).totalFrames;
    window.__KINO_TOTAL_FRAMES__ = totalFrames;
  }
  const { spec, fps, voDurations } = ctx;

  // Clamp into range so a stray ?frame=99999 renders the last valid frame
  // rather than an empty (all-scenes-unmounted) tree.
  const clamped =
    totalFrames > 0 ? Math.min(Math.max(frame, 0), totalFrames - 1) : 0;

  if (!reactRoot) {
    const container = document.getElementById("kino-root");
    if (!container) {
      throw new Error("host/entry: missing #kino-root mount node.");
    }
    reactRoot = createRoot(container);
  }

  // Install the sandbox once; thereafter just advance the frame. The seed is the
  // brand kit id so per-video randomness is reproducible across shards.
  if (!determinism) {
    determinism = installDeterminism({
      fps,
      frame: clamped,
      seed: spec.brandKitId,
    });
    // The sandbox just replaced window.rAF with a synchronous shim; revert ONLY
    // rAF/cAF to the genuine async ones (paint gate + tooling need them), while
    // keeping Math/Date/performance virtualised. See REAL_RAF note above.
    restoreRealRaf();
  } else {
    determinism.setFrame(clamped);
  }

  // `FrameStage` owns the FrameProvider + format-sized stage + scene stack +
  // PaletteProvider. Scenes receive only their schema props (no host extras). A
  // FRESH element each render (not a shared reference) so React never bails out of
  // reconciliation and the warmup + captured renders each actually paint.
  const renderTree = (): void =>
    reactRoot!.render(
      <FrameStage
        spec={spec}
        scenes={KINO_SCENES}
        frame={clamped}
        fps={fps}
        totalFrames={totalFrames}
        voDurations={voDurations}
      />,
    );

  // WARMUP PASS (determinism): render + paint the frame ONCE before the captured
  // render. Chromium rasterises a variable-font glyph at a given weight lazily —
  // the FIRST draw of an interpolated weight (the Hook/Stats/CTA weight-bloom)
  // populates the glyph cache, and a frame captured on that first draw differs by
  // a few sub-pixels from a warm re-draw (the residual text flake). Drawing the
  // frame twice and capturing only the second makes every captured frame warm —
  // independent of cold-context vs persistent-page order. Pure: identical frame ⇒
  // the warmup and the captured render request identical pixels.
  renderTree();
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await decodeAllImages();
  await afterPaint();

  // The CAPTURED render (now warm).
  renderTree();

  // Gate on font readiness BEFORE the paint gate: a frame captured mid font-swap
  // renders fallback glyph metrics, which differ across shards with cold vs warm
  // font caches → flicker on shard boundaries. `document.fonts.ready` resolves
  // once every face the current tree requested has loaded (instant after frame 0
  // since faces are reused). Full @font-face embedding is handled at host-build.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Gate on IMAGE DECODE: a `ProductShot`/`FeatureBeat` still is a real `<img>`
  // (the real Yupcha screenshot). If captured before the bitmap has decoded, the
  // frame shows a partially/undecoded image — which differs across cold vs warm
  // contexts (the transition-frame flake). `img.decode()` resolves once the
  // bitmap is ready to paint; we await every still in the tree so the captured
  // frame is always the fully-decoded image. Deterministic: decode of a fixed
  // source yields fixed pixels.
  await decodeAllImages();

  await afterPaint();

  // SHADER PRESENT PASS (determinism): the shader backdrop draws on a live WebGL
  // canvas R3F sizes via an async ResizeObserver. Only after the paint gate above
  // has the canvas reached its final frame size; we now re-draw + read each
  // registered shader back into its 2D present canvas, so the captured pixels are
  // a deterministic, full-resolution readback (never the racy/black live-canvas
  // composite). Pure: each present fn re-renders the same uTime-pinned quad.
  const present = (window as unknown as { __KINO_PRESENT__?: Set<() => void> })
    .__KINO_PRESENT__;
  if (present && present.size > 0) {
    present.forEach((fn) => fn());
    // One more real-rAF so the 2D-canvas blit is composited before capture.
    await afterPaint();
  }

  const container = document.getElementById("kino-root");
  if (container) {
    window.__KINO_CANVAS_ONLY__ = detectCanvasOnly(container);
  }
}

/* -------------------------------------------------------------------------- */
/*  Boot                                                                        */
/* -------------------------------------------------------------------------- */

function initialFrame(): number {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("frame");
  const n = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function boot(): Promise<void> {
  // (3) strip antialias BEFORE any scene can create a WebGL context.
  forbidWebglAntialias();

  // The persistent-page seam: the orchestrator calls this to move frames with
  // NO navigation (the throughput win — one goto, then re-render per frame).
  window.__KINO_RENDER_FRAME__ = async (frame: number): Promise<void> => {
    window.__KINO_READY__ = false;
    await renderFrame(frame);
    window.__KINO_READY__ = true;
  };

  // First frame from the URL (?frame=N) — keeps a plain goto working too.
  window.__KINO_READY__ = false;
  await renderFrame(initialFrame());
  window.__KINO_READY__ = true;
}

// Kick off once the DOM is parseable. The bundle is injected at end-of-body by
// the host page, so the mount node already exists; guard anyway. Errors are
// stored on the window so the orchestrator fails fast instead of hanging on a
// __KINO_READY__ that never flips.
if (typeof window !== "undefined") {
  const start = (): void => {
    boot().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[kino-host] boot failed:", err);
      window.__KINO_ERROR__ =
        err instanceof Error ? (err.stack ?? err.message) : String(err);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}
