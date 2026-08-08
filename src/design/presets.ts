/**
 * STYLE PRESETS — the four frozen token bundles (the moat).
 *
 * A preset is a frozen token bundle the LLM can only *pick by id* — never edit.
 * Ship exactly four (`docs/SAAS_ROADMAP.md §4`: "Range is the enemy; curation is
 * the asset"). Each bundle encodes type, palette rules, background treatment,
 * default motion register, sound register, and transition caps — copied verbatim
 * from the §4 "Style presets" table.
 *
 * Frozen spec — `docs/SAAS_ROADMAP.md §4` ("Style presets" + "Brand → preset
 * binding"). The `Preset` / `Motion` / `Format` ids come from `src/spec`.
 *
 * Determinism: pure data + pure lookups. No time, no random.
 *
 * The four presets and their registers (§4 table, verbatim):
 *
 * | Preset         | Type                    | Palette              | Background                  | Motion          | Sound           |
 * |----------------|-------------------------|----------------------|-----------------------------|-----------------|-----------------|
 * | minimal-mono   | Inter, opsz-correct     | near-mono + 1 accent | flat                        | punchy springs  | tick/click      |
 * | gradient-glass | Space Grotesk display   | accent gradient      | dithered gradient, grain    | standard curve  | soft whoosh     |
 * | editorial      | serif + grotesque ≤66CPL| off-white/ink        | flat/paper                  | calm, slow      | minimal SFX     |
 * | dark-cinematic | Space Grotesk, tight    | teal/orange @ ≤0.6   | aurora + vignette + grain   | calm holds      | bed + impacts   |
 */
import type { Preset, Motion, VideoSpec, Palette } from "../spec";
// `Format` is intentionally not imported here — presets are format-agnostic;
// aspect ratio is a spec-level concern resolved by the composition shell.

/* -------------------------------------------------------------------------- */
/*  Token sub-shapes                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Type tokens — the typographic rules a preset locks. The LLM supplies copy;
 * it never supplies type. `family` strings reference the repo's Fontsource
 * variable stacks (`promo/theme.ts:FONTS`); `opszCorrect` flips on optical-size
 * correctness for Inter; `maxCpl` caps line length (editorial restraint).
 */
export type TypeTokens = {
  /** Display/headline font stack. */
  display: string;
  /** Body/caption font stack. */
  body: string;
  /** Tracking for display text, in em (negative = tighter). */
  displayTracking: number;
  /** Honour Inter's optical-size axis (only meaningful for Inter). */
  opszCorrect: boolean;
  /** Max characters per line; `null` = no cap. */
  maxCpl: number | null;
};

/**
 * Palette rules — how a preset constrains the threaded `Palette`. These are
 * *rules over* the data palette, not colors themselves (colors stay data so the
 * brand-extracted swatches flow through `PaletteProvider`).
 */
export type PaletteRules = {
  /** Human-readable description of the palette character (§4 "Palette"). */
  character: string;
  /** Max accents beyond bg/surface/text (`minimal-mono` = 1). */
  maxAccents: number;
  /** Whether the preset uses the `gradientText` swatch pair for display. */
  gradientText: boolean;
  /**
   * Hard ceiling on accent saturation/strength, in `[0,1]`. `dark-cinematic`
   * caps teal/orange-class accents `@ ≤0.6`; others allow full strength.
   */
  accentMax: number;
};

/** The background field a preset renders behind scenes (`BgTreatment` token). */
export type BgKind = "flat" | "paper" | "gradient" | "aurora";

/**
 * Background tokens. `grain` is mandatory (> 0) wherever a gradient/aurora field
 * could band — enforced both here and by the anti-slop lint ("Grain-on-gradient:
 * any gradient/aurora bg requires `grain>0`"). `vignette` darkens edges
 * (cinematic). `grade`/`glow` honour the restraint cap (≤0.7; LUT never 100%).
 */
export type BgTokens = {
  kind: BgKind;
  /** Film grain intensity in `[0,1]`. MUST be > 0 for gradient/aurora kinds. */
  grain: number;
  /** Edge vignette strength in `[0,1]`. */
  vignette: number;
  /** Color-grade / LUT strength in `[0,1]` — capped ≤0.7 (restraint cap). */
  grade: number;
};

/** The sound register a preset sits in (§4 "Sound"). */
export type SoundKind =
  | "tick" // minimal-mono: tick/click
  | "whoosh" // gradient-glass: soft whoosh
  | "minimal" // editorial: minimal SFX
  | "bed-impacts"; // dark-cinematic: bed + sparse impacts

/**
 * Sound tokens. `bed` toggles a music bed (cinematic only; bed must avoid vocal
 * NCS tracks under narration — repo rule). `duckUnderVo` ducks SFX/bed under the
 * voiceover band.
 */
export type SoundTokens = {
  kind: SoundKind;
  /** Whether a continuous music bed plays under the video. */
  bed: boolean;
  /** Duck SFX/bed under the VO band (always true where VO is present). */
  duckUnderVo: boolean;
};

/** Native transition kinds (subset of the contract's `TransitionsSchema`). */
export type TransitionKind = "fade" | "slide" | "wipe";

/**
 * Transition caps — a preset caps the system to **≤2 transition kinds** (§4:
 * "preset caps to ≤2 transition kinds"). `allowed` is the whitelist; `default`
 * is the one used when the spec doesn't specify.
 */
export type TransitionTokens = {
  /** ≤2 kinds. The spec's transition must be one of these. */
  allowed: readonly TransitionKind[];
  default: TransitionKind;
};

/**
 * One full preset bundle. Frozen — the LLM picks the `id`; it cannot edit any
 * field. `motion` is the preset's DEFAULT register (the spec's `motion` field
 * may still override per the contract, but the preset declares the intended one).
 */
export type PresetBundle = {
  id: Preset;
  /** Illustrative register (Linear/Stripe/Apple/launch-film) — §4. */
  register: string;
  type: TypeTokens;
  palette: PaletteRules;
  bg: BgTokens;
  /** Default motion token id for this preset. */
  motion: Motion;
  sound: SoundTokens;
  transition: TransitionTokens;
};

/** The full preset map: every `Preset` id → its frozen bundle. */
export type PresetMap = Readonly<Record<Preset, PresetBundle>>;

/* -------------------------------------------------------------------------- */
/*  Font stacks (mirror `promo/theme.ts:FONTS` — referenced, not imported,     */
/*  so this module stays free of brand-specific consts)                        */
/* -------------------------------------------------------------------------- */

const SPACE_GROTESK = "'Space Grotesk Variable', sans-serif";
const INTER = "'Inter Variable', sans-serif";
/** A grotesque body to pair with a serif display (editorial). */
const GROTESQUE = "'Inter Variable', sans-serif";
/** Serif display for the editorial register (system serif until a face ships). */
const SERIF = "'Newsreader Variable', Georgia, serif";

/* -------------------------------------------------------------------------- */
/*  THE FOUR FROZEN PRESETS  (verbatim — `SAAS_ROADMAP.md §4`)                 */
/* -------------------------------------------------------------------------- */

/**
 * minimal-mono — Inter (optical-size correct), near-mono + 1 accent, flat bg,
 * punchy springs, tick/click. Register: Linear / Raycast.
 */
const MINIMAL_MONO: PresetBundle = {
  id: "minimal-mono",
  register: "Linear / Raycast",
  type: {
    display: INTER,
    body: INTER,
    displayTracking: -0.02,
    opszCorrect: true,
    maxCpl: null,
  },
  palette: {
    character: "near-mono + 1 accent",
    maxAccents: 1,
    gradientText: false,
    accentMax: 1,
  },
  bg: { kind: "flat", grain: 0, vignette: 0, grade: 0 },
  motion: "punchy",
  sound: { kind: "tick", bed: false, duckUnderVo: true },
  transition: { allowed: ["fade", "slide"], default: "fade" },
} as const;

/**
 * gradient-glass — Space Grotesk display, accent gradient, dithered gradient bg
 * with **grain mandatory**, standard curve, soft whoosh. Register: Stripe /
 * Vercel.
 */
const GRADIENT_GLASS: PresetBundle = {
  id: "gradient-glass",
  register: "Stripe / Vercel",
  type: {
    display: SPACE_GROTESK,
    body: INTER,
    displayTracking: -0.015,
    opszCorrect: false,
    maxCpl: null,
  },
  palette: {
    character: "accent gradient",
    maxAccents: 2,
    gradientText: true,
    accentMax: 1,
  },
  // grain MANDATORY on the gradient field (kills 8-bit banding).
  bg: { kind: "gradient", grain: 0.12, vignette: 0.1, grade: 0.2 },
  motion: "standard",
  sound: { kind: "whoosh", bed: false, duckUnderVo: true },
  transition: { allowed: ["fade", "slide"], default: "slide" },
} as const;

/**
 * editorial — serif + grotesque, ≤66 CPL, off-white/ink, flat/paper bg, calm &
 * slow, minimal SFX. Register: Apple story.
 */
const EDITORIAL: PresetBundle = {
  id: "editorial",
  register: "Apple story",
  type: {
    display: SERIF,
    body: GROTESQUE,
    displayTracking: 0,
    opszCorrect: false,
    maxCpl: 66,
  },
  palette: {
    character: "off-white / ink",
    maxAccents: 1,
    gradientText: false,
    accentMax: 1,
  },
  bg: { kind: "paper", grain: 0.05, vignette: 0, grade: 0 },
  motion: "calm",
  sound: { kind: "minimal", bed: false, duckUnderVo: true },
  transition: { allowed: ["fade"], default: "fade" },
} as const;

/**
 * dark-cinematic — Space Grotesk, tight tracking, teal/orange-class **@ ≤0.6**,
 * aurora + vignette + grain, calm holds / deep settle, bed + sparse impacts.
 * Register: launch film.
 */
const DARK_CINEMATIC: PresetBundle = {
  id: "dark-cinematic",
  register: "launch film",
  type: {
    display: SPACE_GROTESK,
    body: INTER,
    displayTracking: -0.03,
    opszCorrect: false,
    maxCpl: null,
  },
  palette: {
    character: "teal / orange-class @ ≤0.6",
    maxAccents: 2,
    gradientText: true,
    // accent strength capped at 0.6 (§4: "@ ≤0.6").
    accentMax: 0.6,
  },
  // aurora field → grain mandatory; vignette + restrained grade for cinema look.
  bg: { kind: "aurora", grain: 0.14, vignette: 0.35, grade: 0.5 },
  motion: "calm",
  sound: { kind: "bed-impacts", bed: true, duckUnderVo: true },
  transition: { allowed: ["fade", "wipe"], default: "fade" },
} as const;

/** THE preset map. Frozen. The four bundles, keyed by `Preset` id. */
export const PRESETS: PresetMap = {
  "minimal-mono": MINIMAL_MONO,
  "gradient-glass": GRADIENT_GLASS,
  editorial: EDITORIAL,
  "dark-cinematic": DARK_CINEMATIC,
} as const;

/* -------------------------------------------------------------------------- */
/*  Brand → preset binding (locked — `SAAS_ROADMAP.md §4`)                     */
/* -------------------------------------------------------------------------- */

/** The brands the system ships kits for today. */
export type Brand = "yupcha" | "resubird";

/**
 * Locked brand → preset binding (§4): Yupcha (dark) → `dark-cinematic` |
 * `minimal-mono`; ResuBird (warm) → `editorial` | `gradient-glass`. The first
 * entry is the brand's DEFAULT preset; the array is the full allow-list. The
 * director may pick any preset in a brand's list, never one outside it.
 */
export const BRAND_PRESETS: Readonly<Record<Brand, readonly Preset[]>> = {
  yupcha: ["dark-cinematic", "minimal-mono"],
  // ResuBird is the WARM brand. The allow-list is narrowed to `editorial` ONLY
  // (CD R2 P2): the cool `gradient-glass` field could win the director's pick and
  // make every scene read blue→magenta — off-brand for a warm editorial product.
  // With one allowed preset the warm paper register can never be overridden.
  resubird: ["editorial"],
} as const;

/* -------------------------------------------------------------------------- */
/*  House-brand style overrides (CD R2 P2)                                     */
/* -------------------------------------------------------------------------- */

/**
 * A curated, on-brand palette pinned to a shipped house brand. A scrape can
 * return an off-temperature or degraded palette (ResuBird came back cool
 * periwinkle/magenta — wrong for a WARM brand), so for the house brands we PIN
 * the correct swatches rather than trust the crawl. Arbitrary brands are never
 * overridden (their scraped palette flows through untouched). Plain hex →
 * `zColor()`-valid; threaded as DATA, never imported as a const by a scene.
 */
export const BRAND_PALETTES: Partial<Record<Brand, Palette>> = {
  resubird: {
    bg: "#fbf4ea", // warm paper
    surface: "#fffaf2", // warm card
    text: "#241a12", // warm ink
    textDim: "#8d7b68", // warm muted
    accent: "#ef6c2e", // warm orange (was periwinkle)
    accent2: "#e0457b", // warm rose
    gradientText: ["#ef6c2e", "#e0457b"],
  },
};

/** Detect a shipped house brand from a free-text hint (name + url + id). */
export const detectHouseBrand = (hint: string): Brand | undefined => {
  const h = hint.toLowerCase();
  if (h.includes("yupcha")) return "yupcha";
  if (h.includes("resubird")) return "resubird";
  return undefined;
};

/**
 * Post-director STYLE gate (CD R2 P2). Pure + deterministic, applied to a parsed
 * `VideoSpec` on every director path before it leaves the brain (alongside
 * `gateStatTrust`). For a shipped house brand it:
 *   - clamps `preset` into the brand's locked allow-list (correcting an
 *     off-binding pick — e.g. a cool `gradient-glass` for warm ResuBird → the
 *     first allowed preset, `editorial`); a pick already in-list is kept;
 *   - pins the curated on-brand palette when one exists (warms ResuBird's
 *     accents/field away from the scraped periwinkle).
 * Arbitrary (non-house) brands pass through byte-identical — no regression.
 */
export function gateBrandStyle(spec: VideoSpec, brandHint: string): VideoSpec {
  const brand = detectHouseBrand(brandHint);
  if (brand === undefined) return spec;

  const allowed = BRAND_PRESETS[brand];
  const preset = allowed.indexOf(spec.preset) !== -1 ? spec.preset : allowed[0];
  const override = BRAND_PALETTES[brand];

  if (preset === spec.preset && override === undefined) return spec;
  const palette = override ? { ...spec.palette, ...override } : spec.palette;
  return { ...spec, preset, palette };
}

/* -------------------------------------------------------------------------- */
/*  Accessors                                                                  */
/* -------------------------------------------------------------------------- */

/** Resolve a `Preset` id to its frozen bundle. */
export const preset = (id: Preset): PresetBundle => PRESETS[id];

/** The default (first) preset for a brand. */
export const defaultPresetFor = (brand: Brand): Preset => BRAND_PRESETS[brand][0];

/** Whether a preset is allowed for a brand (binding check for the lint). */
export const isPresetAllowedFor = (brand: Brand, id: Preset): boolean =>
  BRAND_PRESETS[brand].indexOf(id) !== -1;

/* -------------------------------------------------------------------------- */
/*  Construction-time invariants                                               */
/* -------------------------------------------------------------------------- */

/**
 * Assert the §4 structural rules at module load:
 *  - exactly four presets, ids matching their key;
 *  - ≤2 transition kinds per preset, default ∈ allowed;
 *  - grain > 0 on any gradient/aurora background (grain-on-gradient rule);
 *  - grade ≤ 0.7 (restraint cap).
 */
const assertPresetInvariants = (map: PresetMap): void => {
  const ids: Preset[] = [
    "minimal-mono",
    "gradient-glass",
    "editorial",
    "dark-cinematic",
  ];
  for (const id of ids) {
    const p = map[id];
    if (p.id !== id) {
      throw new Error(`Preset key "${id}" disagrees with bundle id "${p.id}".`);
    }
    if (p.transition.allowed.length > 2) {
      throw new Error(`Preset "${id}" exceeds the ≤2 transition-kinds cap.`);
    }
    if (p.transition.allowed.indexOf(p.transition.default) === -1) {
      throw new Error(`Preset "${id}" default transition is not in its allow-list.`);
    }
    if (
      (p.bg.kind === "gradient" || p.bg.kind === "aurora") &&
      p.bg.grain <= 0
    ) {
      throw new Error(
        `Preset "${id}" violates grain-on-gradient: a ${p.bg.kind} bg requires grain > 0.`,
      );
    }
    if (p.bg.grade > 0.7) {
      throw new Error(
        `Preset "${id}" violates the restraint cap: grade (${p.bg.grade}) must be ≤ 0.7.`,
      );
    }
  }
};

assertPresetInvariants(PRESETS);
