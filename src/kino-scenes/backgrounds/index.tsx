/**
 * `src/kino-scenes/backgrounds` — the upgraded scene BACKDROP.
 *
 * The craft upgrade over the flat CSS aurora: a studio-grade WebGL shader
 * mesh-gradient field (`<ShaderMesh>`, dossier §1a) drives the base, with the
 * proven CSS layers (drifting grid, film grain, vignette, an accent orb tint)
 * composited ON TOP via DOM so adjacent scenes can still alternate `hue` and the
 * grain reads as film, not banding.
 *
 * The shader's character (flow/warp/scale/grain/vignette/paper + which palette
 * keys feed `uColors`) is the frozen per-preset `Treatment`, resolved from the
 * active `preset` threaded through `PaletteProvider` (falls back to
 * `dark-cinematic`). Because the backdrop paints a `<canvas>` UNDER DOM text in
 * every archetype, these scenes capture through the DOM-screenshot path — the
 * shader is still fully deterministic (`uTime = frame/fps`, `antialias:false`,
 * `preserveDrawingBuffer`), it just is not canvas-only.
 *
 * `canvasOnly` mode renders ONLY the shader (no DOM overlay) and requests the
 * orchestrator's `gl.readPixels` fast path — used for a standalone full-bleed
 * shader beat where the read-back throughput win applies.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2/§4/§5`.
 */
import * as React from "react";

import { useFrame, interpolate, spring } from "../../engine";
import { palette, usePreset, useMotion, motionToken } from "../../design";
import type { PaletteKey } from "../../spec";
import { ShaderMesh } from "./ShaderMesh";
import { treatmentFor } from "./treatments";

/** Display family for the hero wordmark (kept local — backgrounds owns no kit dep). */
const WORDMARK_FONT =
  '"Space Grotesk", "Inter", system-ui, -apple-system, sans-serif';

/** Default shader uniform resolution (16:9). The shader is resolution-stable. */
const FORMATS_DEFAULT = [1920, 1080] as const;

/** Full-frame absolute layer (local copy — backgrounds owns no kit dependency). */
const Fill: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties }>
> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      ...style,
    }}
  >
    {children}
  </div>
);

export { ShaderMesh } from "./ShaderMesh";
export { TREATMENTS, treatmentFor, type Treatment } from "./treatments";
export { paletteRgb, paletteSeed, cssToRgb, type Rgb } from "./color";

/* -------------------------------------------------------------------------- */
/*  Grain tile (DOM overlay — anti-banding on the shader field)                */
/* -------------------------------------------------------------------------- */

const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`;

/* -------------------------------------------------------------------------- */
/*  Backdrop                                                                   */
/* -------------------------------------------------------------------------- */

export type BackdropProps = {
  /** Shift the dominant accent orb between the two accents (adjacent-scene variation). */
  hue?: "accent" | "accent2";
  /**
   * Standalone shader mode: render ONLY the shader mesh (no DOM overlay) and
   * request the `gl.readPixels` canvas-only fast path. Use for a full-bleed
   * shader beat with no sibling text/UI.
   *
   * NOTE: a `wordmark` (below) forces the DOM-screenshot path even in canvasOnly
   * mode, because DOM text cannot be captured by the canvas read-back — an empty
   * shader beat (CD punch-list #4: "no empty background frames") gets a single
   * hero word so a paused viewer never sees a naked smoke loop.
   */
  canvasOnly?: boolean;
  /**
   * A single hero word/wordmark centered over the field — fills an otherwise
   * empty `canvasOnly` beat (CD punch-list #4). When set, the backdrop composites
   * through the DOM path (text is not capturable via canvas read-back) and the
   * read-back fast path is disabled for the beat.
   */
  wordmark?: string;
  /**
   * READABILITY SCRIM. Text-bearing scenes (Hook, Stats, CTA, Problem, Proof)
   * lay type DIRECTLY over the field, so they darken the center band to guarantee
   * contrast (the rich field stays at the edges). The ProductShot/FeatureBeat
   * path passes `scrim={false}` because its `DofBackdrop` already darkens + blurs
   * the field behind the device. Default ON (the common text-scene case).
   */
  scrim?: boolean;
  /** Canvas size for the shader uniforms. Defaults to 1920×1080. */
  width?: number;
  height?: number;
};

/**
 * Cinematic field: a WebGL shader mesh-gradient base + DOM aurora orb tint +
 * drifting grid + film grain + vignette. The shader is the depth; the DOM layers
 * are the hand-tuned finish. Every value is a pure function of the Kino frame.
 */
export const Backdrop: React.FC<BackdropProps> = ({
  hue = "accent",
  canvasOnly = false,
  scrim = true,
  width = FORMATS_DEFAULT[0],
  height = FORMATS_DEFAULT[1],
  wordmark,
}) => {
  const { frame, fps } = useFrame();
  const c = palette();
  const preset = usePreset();
  const tok = motionToken(useMotion());
  const treatment = treatmentFor(preset ?? "dark-cinematic");

  // Standalone shader beat. With a `wordmark` it MUST composite through the DOM
  // path (text isn't capturable by canvas read-back) — and a single hero word
  // means the beat is never an empty smoke loop (CD #4). With no wordmark it takes
  // the `gl.readPixels` fast path as before.
  if (canvasOnly && !wordmark) {
    return (
      <Fill style={{ backgroundColor: c("bg"), overflow: "hidden" }}>
        <ShaderMesh
          treatment={treatment}
          width={width}
          height={height}
          requestCanvasReadback
        />
      </Fill>
    );
  }

  // Hero-wordmark beat: the shader field + a single confident word. A weight bloom
  // riding a clip reveal (one deliberate move, on-token), settled by the active
  // motion token's spring. Pure function of the frame.
  if (canvasOnly && wordmark) {
    const s = spring({ frame: frame - 6, fps, config: tok.spring });
    const p = Math.min(Math.max(s, 0), 1);
    const wght = Math.round(interpolate(p, [0, 1], [300, 760]));
    return (
      <Fill style={{ backgroundColor: c("bg"), overflow: "hidden" }}>
        <ShaderMesh treatment={treatment} width={width} height={height} />
        {/* central readability pool so the word reads with confident contrast */}
        <Fill
          style={{
            background: `radial-gradient(ellipse 70% 55% at 50% 50%, ${c("bg", 0.6)} 0%, transparent 72%)`,
          }}
        />
        <Fill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: WORDMARK_FONT,
              fontSize: 150,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: c("text"),
              fontVariationSettings: `'wght' ${wght}`,
              opacity: interpolate(s, [0, 0.4], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${((1 - p) * 26).toFixed(3)}px)`,
              textAlign: "center",
            }}
          >
            {wordmark}
          </div>
        </Fill>
      </Fill>
    );
  }

  // The SHADER now owns the gradient, the drifting highlight bloom, the grain
  // and the vignette — it is the whole look. The DOM layers above it are a thin,
  // tasteful finish only: a single faint per-scene `hue` wash (so adjacent scenes
  // still vary), a barely-there masked grid for structure, and a light film
  // grain for tooth. NO floating lens-flare/dash orbs (killed), NO second
  // DOM vignette (the shader's own vignette is the only one — no double-darken).
  const drift = frame * 0.3;
  const wash: PaletteKey = hue;

  return (
    <Fill style={{ backgroundColor: c("bg"), overflow: "hidden" }}>
      {/* shader mesh-gradient field — the depth, the color, the light, the grade */}
      <ShaderMesh treatment={treatment} width={width} height={height} />

      {/* single faint per-scene hue wash — keeps adjacent-scene `hue` variation
          without reintroducing a floating garnish (static, centered, very low). */}
      <Fill
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% 52%, ${c(wash, 0.1)} 0%, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />

      {/* barely-there masked grid (frame-driven drift) — structure, not texture */}
      <Fill
        style={{
          backgroundImage: `linear-gradient(${c("text", 0.03)} 1px, transparent 1px), linear-gradient(90deg, ${c("text", 0.03)} 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 20%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 20%, transparent 100%)",
        }}
      />

      {/* light film grain (DOM tooth on top of the shader's own grain) */}
      <Fill
        style={{
          backgroundImage: GRAIN_URI,
          // MONOTONIC drift (was `(frame%6)*40` / `(frame%5)*53`). The modulo
          // grain reset to the SAME offset every lcm(6,5)=30 frames — i.e. on
          // every whole-second boundary — so a held foreground (the Hook turn,
          // the CTA card) sampled at t=1 and t=5 was byte-identical (CD R7 P2:
          // "t=1≡t=5 pixel-identical static cards"). A slow continuous drift
          // tiles forever without repeating, so no two sampled frames match.
          backgroundPosition: `${frame * 0.7}px ${frame * 0.5}px`,
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />

      {/* READABILITY SCRIM — text scenes only. The v2 scrim buried the gradient:
          a flat 32% bg dim + a 66% center pool meant the luminous field never
          reached the eye on the 4 text scenes (they read dark + flat). The fix:
          NO flat overall dim, and a SOFTER, TIGHTER central pool that protects
          only the headline band while the lit field stays fully alive around it.
          The premium read is contrast — bright gradient framing crisp type — so
          we darken the type band just enough for AA contrast, never the frame. */}
      {scrim ? (
        <>
          {/* a central pool deep enough to seat the type with confident contrast
              AND to restore the deep-bg anchor that makes the lit field read as a
              gradient, not a flat fog — but tight, so the bright core still shows
              around the headline band */}
          <Fill
            style={{
              background: `radial-gradient(ellipse 78% 52% at 50% 50%, ${c("bg", 0.62)} 0%, ${c("bg", 0.34)} 46%, transparent 76%)`,
            }}
          />
          {/* edge settle: top + bottom + a touch of corner darken so type never
              floats on a hot band and the frame keeps cinematic deep corners */}
          <Fill
            style={{
              background: `linear-gradient(180deg, ${c("bg", 0.34)} 0%, transparent 26%, transparent 74%, ${c("bg", 0.42)} 100%)`,
            }}
          />
        </>
      ) : null}
    </Fill>
  );
};
