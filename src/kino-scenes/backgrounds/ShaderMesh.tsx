/**
 * `<ShaderMesh>` — the studio-grade shader mesh-gradient quad.
 *
 * A full-screen triangle running the `FRAG` shader (dossier §1a), mounted via the
 * Kino `<Three>` adapter so its clock is `uTime = frame/fps` — never R3F's
 * `useFrame`, never a wall-clock. R3F's loop is off (`frameloop="never"` inside
 * `<Three>`); we set uniforms in the adapter's imperative `render(uTime)` hook,
 * then the adapter's single `advance(uTime)` draws exactly one deterministic
 * frame.
 *
 * Why a raw `ShaderMaterial` + a hand-built mesh (not JSX `<mesh>` + drei
 * `shaderMaterial`): drei is not a guaranteed dep here, and a raw mesh keeps the
 * uniform object identity stable across frames (we mutate `.value`, never
 * recreate the material) — which is exactly what byte-identical re-renders need.
 *
 * DETERMINISM:
 *   - uniforms are a pure function of `(uTime, palette, treatment)`;
 *   - the geometry/material are built ONCE (memoised) and only their uniform
 *     `.value`s are mutated per frame — no per-frame allocation that could
 *     reorder floats;
 *   - the host forces `antialias:false`; `dpr={1}` pins resolution;
 *   - no random, no clock inside this component.
 */
import * as React from "react";
import * as THREE from "three";

import type { RootState } from "@react-three/fiber";

import { Three } from "../../engine/adapters";
import { usePalette } from "../../design";
import type { Palette } from "../../spec";

import { FRAG, VERT } from "./glsl";
import { paletteRgb, paletteSeed } from "./color";
import type { Treatment } from "./treatments";

/* -------------------------------------------------------------------------- */
/*  Uniform construction (pure)                                                */
/* -------------------------------------------------------------------------- */

type Uniforms = {
  uTime: { value: number };
  uSeed: { value: number };
  uResolution: { value: THREE.Vector2 };
  uColors: { value: THREE.Vector3[] };
  uFlow: { value: number };
  uWarp: { value: number };
  uScale: { value: number };
  uGrain: { value: number };
  uGrainRate: { value: number };
  uVignette: { value: number };
  uPaper: { value: number };
  uSecond: { value: number };
};

/** Build the uniform object once; per-frame we mutate `uTime` only. Pure inputs. */
function buildUniforms(
  pal: Palette,
  t: Treatment,
  width: number,
  height: number,
): Uniforms {
  const colors = t.colors.map((k) => {
    const [r, g, b] = paletteRgb(pal, k);
    return new THREE.Vector3(r, g, b);
  });
  return {
    uTime: { value: 0 },
    uSeed: { value: paletteSeed(pal) },
    uResolution: { value: new THREE.Vector2(width, height) },
    uColors: { value: colors },
    uFlow: { value: t.flow },
    uWarp: { value: t.warp },
    uScale: { value: t.scale },
    uGrain: { value: t.grain },
    uGrainRate: { value: t.grainRate },
    uVignette: { value: t.vignette },
    uPaper: { value: t.paper },
    uSecond: { value: t.second },
  };
}

/* -------------------------------------------------------------------------- */
/*  Deterministic presentation (the byte-identical fix)                        */
/* -------------------------------------------------------------------------- */

/**
 * Blit the WebGL framebuffer into a 2D `<canvas>` via `gl.readPixels`.
 *
 * WHY THIS EXISTS — the determinism fix. The fragment shader is a closed-form
 * pure function of `(uv, uTime, seed)` and `gl.readPixels` returns byte-identical
 * pixels for the same frame across re-renders (verified). But when the LIVE WebGL
 * canvas is left to the browser COMPOSITOR to present into a `page.screenshot()`,
 * two things break under headless SwiftShader:
 *   1. a COLD context's first composite can land AFTER the screenshot → the
 *      backdrop captures BLACK (then a warm re-render shows the gradient); and
 *   2. successive composites can differ by a few bytes (compositor nondeterminism).
 * Both are render-ORDER-dependent → they violate "two renders byte-identical".
 *
 * The GL pipeline itself is deterministic; only the compositor is not. So we take
 * the compositor out of the loop: read the framebuffer back (deterministic) and
 * `putImageData` it into a plain 2D canvas. A 2D canvas composites synchronously
 * and deterministically into the page, so the screenshot now sees stable, never-
 * black pixels for every frame regardless of context warmth or capture order.
 *
 * `readPixels` is bottom-up (GL origin is bottom-left); we flip rows into the 2D
 * canvas (top-left origin) so the gradient is upright. Pure given the GL state.
 */
function presentReadback(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  present: HTMLCanvasElement | null,
): void {
  if (!present) return;
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  if (w === 0 || h === 0) return;
  if (present.width !== w) present.width = w;
  if (present.height !== h) present.height = h;
  const ctx2d = present.getContext("2d");
  if (!ctx2d) return;

  const pixels = new Uint8ClampedArray(w * h * 4);
  // Read from the DEFAULT framebuffer (the backbuffer our quad drew into). R3F /
  // three may leave a render target bound; binding null guarantees we read the
  // on-screen buffer, not an offscreen FBO (which reads back as cleared/zero).
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Flip vertically: GL row 0 is the BOTTOM; ImageData row 0 is the TOP.
  const flipped = new Uint8ClampedArray(w * h * 4);
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    const src = y * rowBytes;
    const dst = (h - 1 - y) * rowBytes;
    flipped.set(pixels.subarray(src, src + rowBytes), dst);
  }
  ctx2d.putImageData(new ImageData(flipped, w, h), 0, 0);
}

/* -------------------------------------------------------------------------- */
/*  The mesh (built once, drawn imperatively)                                  */
/* -------------------------------------------------------------------------- */

export type ShaderMeshProps = {
  /** The resolved preset treatment (uniform bundle minus time/seed/resolution). */
  readonly treatment: Treatment;
  /** Canvas size in px — feeds `uResolution` (grain/dither scale). */
  readonly width: number;
  readonly height: number;
  /**
   * When true, the host's canvas-only readback fast path is requested for this
   * frame (`window.__KINO_CANVAS_ONLY__ = true`) so the orchestrator captures via
   * `gl.readPixels` instead of a DOM screenshot. Only safe when the shader is the
   * SOLE thing painting (no sibling DOM/text) — the `<Backdrop>` sets this only
   * in its `canvasOnly` standalone mode.
   */
  readonly requestCanvasReadback?: boolean;
};

/**
 * Inner component: lives inside `<Three>`, owns the fullscreen-quad scene, and
 * pushes `uTime` each frame via the adapter's imperative `render` callback. We do
 * NOT use R3F's scene-graph JSX or `useFrame` — only `<Three render={...}>`,
 * which the adapter calls once per Kino frame with the frame-derived `uTime`.
 */
const Quad: React.FC<{
  uniforms: Uniforms;
  /**
   * A ref to the 2D presentation canvas. After the deterministic GL draw we
   * `gl.readPixels` the framebuffer and blit it here. The screenshot then captures
   * THIS 2D canvas — see `presentReadback` for why this is the determinism fix.
   * A REF (not a value) so the imperative `render` callback always sees the
   * current canvas without a state round-trip: React sets refs during commit,
   * BEFORE `FrameDriver`'s layout effect runs the first GL draw — so the very
   * first frame of a cold context blits immediately and never captures black.
   */
  presentRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ uniforms, presentRef }) => {
  // Build geometry + material ONCE. A single oversized triangle covers the clip
  // space; positions are already in NDC (the vertex shader passes them through).
  const { scene, camera, material } = React.useMemo(() => {
    const geom = new THREE.BufferGeometry();
    // Fullscreen triangle: covers [-1,1]^2 with one primitive (no seam).
    const pos = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    const uv = new Float32Array([0, 0, 2, 0, 0, 2]);
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = false;
    const sc = new THREE.Scene();
    sc.add(mesh);
    // Camera is irrelevant (positions are NDC) but R3F's `advance` needs one.
    const cam = new THREE.Camera();
    return { scene: sc, camera: cam, material: mat };
  }, [uniforms]);

  // Dispose GPU resources on unmount (avoids context leaks across scenes).
  React.useEffect(() => {
    return () => {
      material.dispose();
      (material as THREE.ShaderMaterial).vertexShader = "";
    };
  }, [material]);

  // The R3F render state, captured by the draw callback. We keep the WHOLE state
  // (not just gl) so the host's pre-capture "present" pass can RE-DRAW the quad at
  // the final, ResizeObserver-settled canvas size and then read it back — see the
  // registration below for why a re-draw (not just a re-readback) is required.
  const stateRef = React.useRef<RootState | null>(null);

  // Build the present closure once. It blits the ALREADY-DRAWN GL framebuffer
  // into the 2D present canvas via readPixels — it does NOT re-draw. WHY no
  // re-draw: a fresh `gl.render` on headless SwiftShader is NOT bit-identical
  // frame-to-frame (sub-pixel variance), so re-drawing here reintroduces exactly
  // the nondeterminism this fix removes. A pure `readPixels` of the existing
  // backbuffer is byte-stable (verified). By the time the host present pass calls
  // this — after the paint gate — R3F's ResizeObserver has settled and its last
  // `advance` already drew the quad at FULL frame size, so the backbuffer holds
  // the correct full-res pixels; we just copy them out, deterministically.
  const presentNow = React.useCallback((): void => {
    const state = stateRef.current;
    if (!state) return;
    presentReadback(state.gl.getContext(), presentRef.current);
  }, [presentRef]);

  // REGISTER the present closure on a global set the HOST drains after its paint
  // gate (`afterPaint`), right before it captures. WHY the host and not here:
  // R3F sizes its canvas via an async ResizeObserver, so at first-commit (when a
  // layout-effect or the draw callback runs) the canvas is still the 300×150
  // default — a readback then reads a tiny/empty buffer (black). By the time the
  // host's double-rAF paint gate resolves, the canvas IS frame-sized and R3F has
  // re-advanced; the host then calls every registered present fn, which re-draws
  // at the correct size and blits. This makes the blit deterministic and full-res
  // regardless of when ResizeObserver fired (kills the size race AND the black).
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      __KINO_PRESENT__?: Set<() => void>;
    };
    const set = (w.__KINO_PRESENT__ ??= new Set<() => void>());
    set.add(presentNow);
    return () => {
      set.delete(presentNow);
    };
  }, [presentNow]);

  return (
    <Three
      dpr={1}
      canvasProps={{
        // `gl` flags merge with the host's forced antialias:false patch. We do
        // NOT hand R3F our `scene`/`camera` via props (its `camera` prop takes a
        // config object, not an Object3D instance) — instead the `render`
        // callback below draws our own fullscreen scene/camera explicitly, so
        // R3F's default scene is never what paints.
        gl: { antialias: false, preserveDrawingBuffer: true },
      }}
      render={(t, state) => {
        // The ONE per-frame mutation: pin uTime. Everything else is constant.
        uniforms.uTime.value = t;
        // Draw our fullscreen scene explicitly (R3F's advance renders state.scene,
        // which we replaced via canvasProps.scene above).
        state.gl.render(scene, camera);
        // Flush so the GL backing store is complete before any read-back.
        state.gl.getContext().finish();
        // Stash the state for the host's present pass. We deliberately do NOT blit
        // here: this callback can fire while R3F's canvas is still the cold
        // 300×150 default (async ResizeObserver), so an eager blit would capture a
        // wrong-size frame. The single blit happens in the host present pass, AFTER
        // the canvas has settled to full size — so exactly ONE deterministic,
        // full-resolution readback reaches the present canvas per frame.
        stateRef.current = state;
      }}
    />
  );
};

/**
 * `<ShaderMesh>` — public surface. Reads the threaded palette, builds the uniform
 * bundle for the given treatment, and renders the deterministic quad. Sets the
 * canvas-only readback flag when asked (standalone shader, no sibling paint).
 */
export const ShaderMesh: React.FC<ShaderMeshProps> = ({
  treatment,
  width,
  height,
  requestCanvasReadback = false,
}) => {
  const pal = usePalette();
  const uniforms = React.useMemo(
    () => buildUniforms(pal, treatment, width, height),
    [pal, treatment, width, height],
  );

  // The 2D presentation canvas the GL framebuffer is blitted into (the
  // determinism fix — see `presentReadback`). A REF, populated during commit
  // BEFORE `FrameDriver`'s layout-effect draw, so the first cold-context frame
  // blits immediately (no state round-trip → never captures black).
  const presentRef = React.useRef<HTMLCanvasElement | null>(null);

  // Request the gl.readPixels fast path for this frame when the shader is the
  // only painter. The host re-evaluates `detectCanvasOnly` after paint and would
  // otherwise see a lone <canvas> and agree — this flag makes the intent explicit
  // and survives even if a future sibling layer is added in canvasOnly mode.
  React.useLayoutEffect(() => {
    if (!requestCanvasReadback) return;
    if (typeof window !== "undefined") {
      (window as { __KINO_CANVAS_ONLY__?: boolean }).__KINO_CANVAS_ONLY__ = true;
    }
  });

  // BOTH paths now route through the deterministic 2D present canvas (the
  // byte-identical fix — see `presentReadback`). The ONLY difference is which
  // surface the orchestrator captures:
  //   - canvasOnly → the present 2D canvas alone, read via `gl.readPixels`-blit
  //     then `toDataURL` (the throughput fast path) — NO racy live-GL composite;
  //   - DOM-composited → the present 2D canvas screenshotted under sibling DOM.
  // canvasOnly previously rendered the live WebGL canvas and let the orchestrator
  // `toDataURL` it directly, which bypassed the present readback the rest of this
  // file is built around (det. review B3). Sharing the present surface closes that
  // gap while keeping the read-back win.
  //
  // The live WebGL canvas is sized in EXACT PIXELS (not %) in BOTH paths so R3F's
  // ResizeObserver can never resize the preserved drawing buffer between the
  // warmup draw and the present-pass readback (det. review F2). The opaque present
  // 2D canvas is rendered AFTER it (later DOM order ⇒ painted on top) so the
  // compositor's racy/black present of the live GL surface is fully occluded while
  // readPixels still returns the real full-res framebuffer.
  return (
    <div
      data-kino-shadermesh=""
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* Live WebGL canvas — sized in EXACT PIXELS (not %) so R3F's first
          layout measurement is already the frame size and its drawing buffer is
          never the 300×150 default. Removing the cold-size step removes the only
          remaining source of a stale/partial readback. NOT what the screenshot
          reads (the present canvas above occludes it). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
        }}
      >
        <Quad uniforms={uniforms} presentRef={presentRef} />
      </div>

      {/* The deterministic presentation surface the orchestrator captures. */}
      <canvas
        data-kino-shader-present=""
        ref={presentRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
};
