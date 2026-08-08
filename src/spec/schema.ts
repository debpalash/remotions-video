/**
 * THE CONTRACT — `VideoSpec` (Zod).
 *
 * This is the single interface every part of the system codes against. It
 * decouples the fragile, swappable *brain* (scrape + LLM + VO) from the
 * deterministic, pre-tested *renderer*. Everything upstream of this spec is
 * commodity plumbing that can fail and retry; everything downstream is the moat
 * and must be boringly reliable.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5` (the `VideoSpec` contract) and
 * `docs/ENGINE_DESIGN.md` (render = pure function of `t`).
 *
 * Design rules encoded here (not by convention — by construction):
 *  - Palette is threaded as DATA, never `import {COLORS}`. Colors are
 *    `PaletteKey` references, never raw hex inside scene props.
 *  - Per-scene props are a discriminated union on `component`, so each scene's
 *    `props` validate against *its own* schema.
 *  - Scenes carry NO `durationInFrames` — duration is derived from measured VO
 *    in `calculateMetadata` (floored at the registry `minFrames`).
 *  - Slots are enums/anchors, NOT free geometry — the LLM assembles, never
 *    styles. `screen` resolves to a still/Img asset key, NEVER `OffthreadVideo`.
 */
import { z } from "zod";
import { zColor } from "@remotion/zod-types";

/* -------------------------------------------------------------------------- */
/*  Tokens                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Palette — at most 5 swatches plus an optional gradient pair (craft rule).
 * Threaded through the tree via a `PaletteProvider`; scenes read tokens from
 * context instead of importing a `COLORS` const. This is the injection path
 * that unifies the two forked UI kits (`ui.tsx` / `resubird/ui.tsx`).
 */
export const PaletteSchema = z.object({
  bg: zColor(),
  surface: zColor(),
  text: zColor(),
  textDim: zColor(),
  accent: zColor(),
  accent2: zColor().optional(),
  /** Two-stop gradient used for hero/display text. */
  gradientText: z.tuple([zColor(), zColor()]).optional(),
});
export type Palette = z.infer<typeof PaletteSchema>;

/**
 * The set of palette keys a scene prop may reference instead of a raw hex.
 * `palette(key, alpha)` resolves these at render time. This is what kills the
 * `${COLORS.blue}55` string-concat anti-pattern.
 */
export const PaletteKeySchema = z.enum([
  "bg",
  "surface",
  "text",
  "textDim",
  "accent",
  "accent2",
]);
export type PaletteKey = z.infer<typeof PaletteKeySchema>;

/**
 * Motion token id. The preset selects one; scenes cannot override it. The token
 * layer (see `MotionToken` in the engine) enforces asymmetry (`exit < enter`),
 * overshoot discipline, and one signature motion per video.
 */
export const MotionSchema = z.enum(["calm", "standard", "punchy"]);
export type Motion = z.infer<typeof MotionSchema>;

/** Output aspect ratio — safe-zone-aware, multi-format from one spec. */
export const FormatSchema = z.enum(["16:9", "9:16", "1:1"]);
export type Format = z.infer<typeof FormatSchema>;

/**
 * Style preset id — a frozen token bundle. One per video, NEVER mixed. The LLM
 * picks an id; it cannot edit a preset. Brand binding (locked): Yupcha →
 * `dark-cinematic` | `minimal-mono`; ResuBird → `editorial` | `gradient-glass`.
 */
export const PresetSchema = z.enum([
  "minimal-mono",
  "gradient-glass",
  "editorial",
  "dark-cinematic",
]);
export type Preset = z.infer<typeof PresetSchema>;

/* -------------------------------------------------------------------------- */
/*  Voiceover                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Per-scene voiceover. `text` is authored by the director; `audioUrl` is filled
 * by the VO stage (TTS → loudnorm I=-14 → measured duration). The measured
 * duration of `audioUrl` is what drives the scene's frame count.
 *
 * `profile` defaults to the audition-chosen warm "Companion" id (fa99b1a5 — the
 * live `/profiles` source of truth; the CLAUDE.md "Helpdesk"/"Luxe" ids are
 * stale). `style` carries optional per-scene prosody (speed/seed/instruct) the
 * VO pipeline merges onto its deliberate, warm default read.
 */
export const VoStyleSchema = z
  .object({
    /** 0.25–4.0; <1 = slower / more deliberate (anti-mechanical). */
    speed: z.number().min(0.25).max(4).optional(),
    /** Deterministic sampling seed (keeps the read's character stable). */
    seed: z.number().int().optional(),
    /** Free-text tone/pace direction for the engine. */
    instruct: z.string().optional(),
  })
  .optional();
export type VoStyle = z.infer<typeof VoStyleSchema>;

export const VoSchema = z
  .object({
    text: z.string().min(1),
    profile: z.string().default("fa99b1a5"),
    /** Optional per-scene prosody override. */
    style: VoStyleSchema,
    /** Filled by the VO stage — a content-addressed audio asset URL/key. */
    audioUrl: z.string().optional(),
  })
  .optional();
export type Vo = z.infer<typeof VoSchema>;

/* -------------------------------------------------------------------------- */
/*  Shared scene-prop atoms                                                    */
/* -------------------------------------------------------------------------- */

/** lucide-react icon name (inline, tree-shakeable SVG) — not arbitrary svg. */
const IconSchema = z.string().min(1);

/** Asset key → resolves to a still/Img. NEVER an `OffthreadVideo` clip. */
const AssetKeySchema = z.string().min(1);

/* -------------------------------------------------------------------------- */
/*  Per-scene prop schemas  (registry source of truth)                        */
/*  Enums/anchors, NOT free geometry — the LLM assembles, never styles.       */
/* -------------------------------------------------------------------------- */

/** S1 Hook — one claim, ≤3s, always the shortest scene. */
export const HookProps = z.object({
  lines: z.array(z.string().min(1)).min(1).max(4),
});
export type HookProps = z.infer<typeof HookProps>;

/** S2 Problem — status-quo pain, muted; strike-stamps that then resolve. */
export const ProblemProps = z.object({
  stamps: z.array(z.string().min(1)).min(1).max(4),
  /** The single line the pain resolves into. */
  resolve: z.string().min(1),
});
export type ProblemProps = z.infer<typeof ProblemProps>;

/**
 * S3 ProductShot — hero UI + callouts; carries the signature motion. This is
 * the collapse of `DashboardShot` / `AnalysisShot` / `ResubirdShot` into one
 * prop-driven archetype (Kicker → headline → ScreenFrame → Callouts).
 */
export const ProductShotProps = z.object({
  kicker: z.string().min(1),
  headline: z.string().min(1),
  /** Asset key → still/Img, NEVER `OffthreadVideo`. */
  screen: AssetKeySchema,
  layout: z.enum(["single", "split"]).default("single"),
  /** Hero tilt in degrees, clamped to a tasteful range. */
  tilt: z.number().min(-12).max(12).default(6),
  callouts: z
    .array(
      z.object({
        title: z.string().min(1),
        sub: z.string().optional(),
        /** lucide enum, not arbitrary svg. */
        icon: IconSchema,
        /** Anchor corner — NOT absolute left/top literals. */
        anchor: z.enum(["tl", "tr", "bl", "br"]),
        /** PaletteKey reference — NOT a hex. */
        accent: z.enum(["accent", "accent2", "text"]),
      }),
    )
    .max(2)
    .default([]),
});
export type ProductShotProps = z.infer<typeof ProductShotProps>;

/** S4 FeatureBeat — repeatable ×2–4; FeatureBeats in one video share a layout. */
export const FeatureBeatProps = z.object({
  label: z.string().min(1),
  /** Asset key for the region/screenshot this beat highlights. */
  region: AssetKeySchema,
  caption: z.string().min(1),
  /**
   * Which bespoke ResuBird screen this beat renders, set EXPLICITLY by the
   * director (per-beat index), NOT inferred by keyword-matching the caption/key
   * (which silently collapsed every beat onto the ATS gauge). When omitted, the
   * pipeline's `assignFeatureScreens` fills it round-robin by beat index so the
   * tour always shows three distinct screens.
   */
  screen: z.enum(["ats", "bullets", "cover"]).optional(),
  /** Optional SFX earcon key, pitched off the voice band, ducked under VO. */
  earcon: z.string().optional(),
});
export type FeatureBeatProps = z.infer<typeof FeatureBeatProps>;

/** S5 Stats — count-up numbers. Unverified stats render an "e.g." affordance. */
export const StatsProps = z.object({
  items: z
    .array(
      z.object({
        to: z.number(),
        suffix: z.string().default(""),
        decimals: z.number().int().min(0).max(2).default(0),
        label: z.string().min(1),
        /** `false` → renders an "e.g." affordance (stats are examples). */
        verified: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(4),
});
export type StatsProps = z.infer<typeof StatsProps>;

/**
 * S6 Proof — one social-proof beat. Either a quote (with attribution) OR a logo
 * wall of real SVG marks. Exactly one of the two shapes.
 */
export const ProofProps = z.union([
  z.object({
    quote: z.string().min(1),
    attribution: z.string().min(1),
  }),
  z.object({
    /** Asset keys for real SVG logo marks — no stock people, no stock B-roll. */
    logos: z.array(AssetKeySchema).min(1).max(8),
  }),
]);
export type ProofProps = z.infer<typeof ProofProps>;

/** S7 CTA — wordmark + one action, longest hold; always last. */
export const CtaProps = z.object({
  headline: z.string().min(1),
  url: z.string().min(1),
});
export type CtaProps = z.infer<typeof CtaProps>;

/* -------------------------------------------------------------------------- */
/*  Scene — discriminated union on `component`                                 */
/* -------------------------------------------------------------------------- */

/**
 * Each scene's `props` validate against its own schema via a discriminated
 * union keyed on `component`. The model can ONLY pick these components, each
 * with exactly these props.
 */
export const SceneSpec = z.discriminatedUnion("component", [
  z.object({
    id: z.string().min(1),
    component: z.literal("Hook"),
    props: HookProps,
    vo: VoSchema,
  }),
  z.object({
    id: z.string().min(1),
    component: z.literal("Problem"),
    props: ProblemProps,
    vo: VoSchema,
  }),
  z.object({
    id: z.string().min(1),
    component: z.literal("ProductShot"),
    props: ProductShotProps,
    vo: VoSchema,
  }),
  z.object({
    id: z.string().min(1),
    component: z.literal("FeatureBeat"),
    props: FeatureBeatProps,
    vo: VoSchema,
  }),
  z.object({
    id: z.string().min(1),
    component: z.literal("Stats"),
    props: StatsProps,
    vo: VoSchema,
  }),
  z.object({
    id: z.string().min(1),
    component: z.literal("Proof"),
    props: ProofProps,
    vo: VoSchema,
  }),
  z.object({
    id: z.string().min(1),
    component: z.literal("CTA"),
    props: CtaProps,
    vo: VoSchema,
  }),
]);
export type SceneSpec = z.infer<typeof SceneSpec>;

/* -------------------------------------------------------------------------- */
/*  Transitions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Transition between consecutive scenes. A preset caps the system to ≤2
 * transition kinds; here the contract allows the native set and bounds the
 * overlap so timing math (cursor += dur - T) stays sane.
 */
export const TransitionsSchema = z
  .object({
    kind: z.enum(["fade", "slide", "wipe"]).default("fade"),
    durationInFrames: z.number().int().min(6).max(30).default(15),
  })
  .default({ kind: "fade", durationInFrames: 15 });
export type Transitions = z.infer<typeof TransitionsSchema>;

/* -------------------------------------------------------------------------- */
/*  VideoSpec — the top-level contract                                         */
/* -------------------------------------------------------------------------- */

/**
 * The whole video, as data. One preset, one motion token, one palette — all
 * singular per video so scenes cannot introduce off-token variance. The scene
 * count is hard-capped (2..12): the duration cap IS the cost cap.
 */
export const VideoSpec = z.object({
  version: z.literal(1),
  format: FormatSchema,
  /** One preset per video — never mixed. */
  preset: PresetSchema,
  motion: MotionSchema.default("standard"),
  palette: PaletteSchema,
  brandKitId: z.string().min(1),
  transitions: TransitionsSchema,
  /** Hard duration cap = cost cap. Narrative sanity is enforced by the lint. */
  scenes: z.array(SceneSpec).min(2).max(12),
});
export type VideoSpec = z.infer<typeof VideoSpec>;
