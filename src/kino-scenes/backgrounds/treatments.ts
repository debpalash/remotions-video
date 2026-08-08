/**
 * Preset → background TREATMENT map.
 *
 * Each of the four frozen presets (`src/spec` `PresetSchema`) maps to a distinct
 * shader treatment — the uniform bundle that gives the mesh-gradient its
 * character, plus which palette keys feed `uColors`. This is the data the
 * `<Backdrop preset palette>` reads; it is PURE (no time, no random) so the same
 * preset always yields the same look.
 *
 * Treatments (dossier §1a + ROADMAP §4 "Style presets" Background column):
 *   - dark-cinematic → aurora mesh + grain + deep vignette (teal/orange @ ≤0.6)
 *   - gradient-glass → flowing accent gradient, grain mandatory, light vignette
 *   - minimal-mono   → near-flat field + fine grain only (Linear matte)
 *   - editorial      → paper: near-flat off-white/ink, the faintest tonal drift
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2/§4/§5`.
 */
import type { Preset, PaletteKey } from "../../spec";

/** The full uniform bundle a treatment supplies (minus time/seed/resolution). */
export type Treatment = {
  /** Which palette keys map to `uColors[0..3]` = [ground, hueA, hueB, highlight]. */
  readonly colors: readonly [PaletteKey, PaletteKey, PaletteKey, PaletteKey];
  /** Domain-warp speed — how fast the field breathes. */
  readonly flow: number;
  /** Domain-warp amplitude — how liquid the warp is. */
  readonly warp: number;
  /** Noise frequency — larger = more, smaller blobs. */
  readonly scale: number;
  /** Film-grain intensity `[0,1]`. */
  readonly grain: number;
  /** Grain refresh rate (new fields/sec). 24 reads as film; lower = calmer. */
  readonly grainRate: number;
  /** Edge vignette strength `[0,1]`. */
  readonly vignette: number;
  /** 0 = full mesh field, 1 = near-flat paper. */
  readonly paper: number;
  /**
   * Weight of the SECONDARY hue `[0,1]`. 0 = single-hue discipline (one accent
   * blooming out of the deep ground — the premium launch-film look the CD
   * punch-list demands; kills the teal/rust mud). A small value lets the
   * gradient-glass preset carry a faint cool/warm seam tint only.
   */
  readonly second: number;
};

/**
 * The four treatments, hand-tuned. Restraint caps honoured: cinematic accents sit
 * low, grain stays in the 0.03–0.07 film band, vignette ≤0.6.
 */
export const TREATMENTS: Record<Preset, Treatment> = {
  "dark-cinematic": {
    colors: ["bg", "accent", "accent2", "text"],
    flow: 0.13, // slow breathing — a deep, settled field, not boiling lava
    warp: 0.13, // a touch more liquid warp — the gradient drifts, not turbulent
    scale: 1.35, // larger, fewer blobs → one calm gradient sweep
    grain: 0.04, // CD #1: fine film grain ~4%, not a noise crush
    grainRate: 24,
    vignette: 0.46, // softer vignette — frames the eye WITHOUT crushing the field
    paper: 0,
    second: 0, // SINGLE-hue discipline — one teal glow out of near-black, NO rust
  },
  "gradient-glass": {
    colors: ["bg", "accent", "accent2", "surface"],
    flow: 0.16,
    warp: 0.12,
    scale: 1.4,
    grain: 0.045, // grain MANDATORY on gradient (anti-slop lint), film band
    grainRate: 20,
    vignette: 0.34,
    paper: 0,
    second: 0.5, // a faint cool/warm SEAM tint only — never a 50/50 fight
  },
  "minimal-mono": {
    colors: ["bg", "surface", "accent", "text"],
    flow: 0.08,
    warp: 0.05,
    scale: 1.6,
    grain: 0.035, // fine grain only — Linear matte
    grainRate: 18,
    vignette: 0.18,
    paper: 0.78, // near-flat
    second: 0,
  },
  editorial: {
    colors: ["bg", "surface", "textDim", "text"],
    flow: 0.05,
    warp: 0.04,
    scale: 1.3,
    grain: 0.03, // paper tooth
    grainRate: 12,
    vignette: 0.12,
    paper: 1, // paper ground
    second: 0,
  },
};

/** Resolve a preset to its treatment (defaults to dark-cinematic if unknown). */
export const treatmentFor = (preset: Preset): Treatment =>
  TREATMENTS[preset] ?? TREATMENTS["dark-cinematic"];
