/**
 * KINETIC TYPE KIT — public surface.
 *
 * Advanced, art-directed kinetic typography for the Kino scene archetypes. All
 * frame-pure (ENGINE_DESIGN §2): per-glyph spring stagger, clip/mask line
 * reveals, variable-font weight animation, blur-in, gradient/accent emphasis,
 * baseline drift and tracking animation — choreographed, not uniform.
 *
 * The reusable trio (prompt): `<KineticLine>` / `<KineticWord>` / `<MaskReveal>`,
 * plus `<GradientWord>` and the deterministic split/hash helpers.
 */
export {
  KineticWord,
  KineticLine,
  ClipLine,
  MaskReveal,
  GradientWord,
  type KineticWordProps,
  type KineticLineProps,
  type ClipLineProps,
  type MaskRevealProps,
  type GradientWordProps,
  type KineticMode,
  type Emphasis,
  type WeightRange,
} from "./kinetic";

export {
  splitWords,
  splitGlyphs,
  glyphCount,
  hash01,
  jitter,
  type WordToken,
  type GlyphToken,
  type GlyphWord,
} from "./split";
