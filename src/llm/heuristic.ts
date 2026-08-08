/**
 * heuristic.ts — the KEYLESS HEURISTIC DIRECTOR.
 *
 * `heuristicDirect(brandKit, goal)` → a validated `VideoSpec`, with **NO network
 * and NO LLM**. It deterministically assembles the frozen conversion template
 * (SAAS_ROADMAP §2) from a brand kit:
 *
 *   Hook (pain-led, never a logo) → ProductShot (first screen asset)
 *     → up to 3 FeatureBeat → Stats (marked unverified) → optional Proof
 *     → CTA (url).
 *
 * It is the free-tier, offline fallback for `direct()` (`director.ts`): same
 * input/output contract, same guarantees, but the *template* — not a model — is
 * the brain. Because the template is fixed and on-token by construction, the
 * output is ALWAYS schema-valid AND anti-slop-lint-clean for any reasonable kit
 * (the same gates `direct()` runs are asserted here in tests).
 *
 * Design rules (CLAUDE.md / ENGINE_DESIGN §2):
 *  - PURE + DETERMINISTIC. No `Date.now`, no `Math.random`, no I/O, no clock.
 *    Same `(brandKit, goal)` in → byte-identical `VideoSpec` out.
 *  - Assembles the frozen design system; never styles it. Preset is *selected*
 *    via the locked brand→preset binding (`src/design`); palette is threaded as
 *    DATA from the kit; motion/transition come from the chosen preset bundle.
 *  - Obeys every narrative rule so `validateSceneRefs` + `lintSpec` pass: ≤1
 *    Hook (first), ≤1 CTA (last), ≤1 Proof, ≤4 FeatureBeat; colors are PaletteKey
 *    references, never raw hex; screen/region keys are stills, never clips.
 *
 * Touches ONLY this file. Reuses `src/spec` (contract + lint), `src/design`
 * (preset binding + bundles), `src/ingest` (palette luminance), and the
 * `DirectorBrandKit` / `DirectorGoal` shapes from `director.ts` (type-only) —
 * it never edits `director.ts` / `providers.ts`.
 */
import { z } from "zod";

import {
  VideoSpec,
  type Palette,
  type Preset,
  type Motion,
} from "../spec";
import {
  preset as presetBundle,
  defaultPresetFor,
  gateBrandStyle,
  type Brand,
  type TransitionKind,
} from "../design";
import { parseColor, luminance, DEFAULT_PALETTE } from "../ingest";

import type { DirectorBrandKit, DirectorGoal } from "./director";

/* -------------------------------------------------------------------------- */
/*  Public re-exports (the heuristic director shares the director's I/O shape) */
/* -------------------------------------------------------------------------- */

export type { DirectorBrandKit, DirectorGoal } from "./director";

/* -------------------------------------------------------------------------- */
/*  Brand / preset selection                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Map a brand kit to one of the shipped `Brand` ids when its name/url clearly
 * names a house brand, so the locked `BRAND_PRESETS` binding applies verbatim.
 * Returns `undefined` for any other ("arbitrary") brand — those fall through to
 * the palette-luminance heuristic below.
 */
function detectBrand(kit: DirectorBrandKit): Brand | undefined {
  const hay = `${kit.name ?? ""} ${kit.url ?? ""} ${kit.id ?? ""}`.toLowerCase();
  if (hay.includes("yupcha")) return "yupcha";
  if (hay.includes("resubird")) return "resubird";
  return undefined;
}

/**
 * Is a palette's background dark? Deterministic luminance test (reuses the
 * ingest color math). A dark field reads cinematic/agentic; a light field reads
 * editorial/warm — exactly the §4 brand→preset split.
 */
function isDarkPalette(palette: Palette): boolean {
  const rgb = parseColor(palette.bg);
  // No parseable bg → treat as dark (the safe default register, matching the
  // ingest `DEFAULT_PALETTE`, which is dark).
  if (!rgb) return true;
  return luminance(rgb) < 0.4;
}

/**
 * A trustworthy swatch, or the matching `DEFAULT_PALETTE` fallback. The ingest
 * pipeline always emits hex/rgb (`buildPalette`), so a swatch `parseColor` can't
 * read is a degraded/hand-rolled kit — we substitute the safe default for THAT
 * key so the threaded palette is always `zColor()`-valid and the spec parses.
 * Keeps the heuristic total for any reasonable kit (it never throws on a stray
 * swatch); a valid swatch is passed through byte-for-byte (no styling).
 */
function safeSwatch(value: string, key: keyof typeof DEFAULT_PALETTE): string {
  if (typeof value === "string" && parseColor(value) !== null) return value;
  const fallback = DEFAULT_PALETTE[key];
  return typeof fallback === "string" ? fallback : DEFAULT_PALETTE.accent;
}

/** Whether `p` is a valid preset id (defends `goal.preset` against junk). */
function isPreset(p: unknown): p is Preset {
  return (
    p === "minimal-mono" ||
    p === "gradient-glass" ||
    p === "editorial" ||
    p === "dark-cinematic"
  );
}

/**
 * Pick exactly ONE preset for the whole video (never mix — §4).
 *
 * Precedence:
 *  1. an explicit, valid `goal.preset` override;
 *  2. the locked `BRAND_PRESETS` default when the kit names a house brand;
 *  3. a palette-luminance heuristic for any other brand — dark bg →
 *     `dark-cinematic`, light bg → `editorial` (the two flagship registers).
 */
function pickPreset(
  kit: DirectorBrandKit,
  goal: DirectorGoal,
  palette: Palette,
): Preset {
  if (isPreset(goal.preset)) return goal.preset;

  const brand = detectBrand(kit);
  if (brand) return defaultPresetFor(brand);

  return isDarkPalette(palette) ? "dark-cinematic" : "editorial";
}

/**
 * Build the threaded `Palette` from the kit, substituting the safe default for
 * any swatch that is not a parseable color. Threaded as DATA — valid swatches
 * pass through unchanged; the gradientText pair is dropped if either stop is bad
 * (rather than emit a half-valid tuple).
 */
function buildSafePalette(kit: DirectorBrandKit): Palette {
  const p = kit.palette;
  const palette: Palette = {
    bg: safeSwatch(p.bg, "bg"),
    surface: safeSwatch(p.surface, "surface"),
    text: safeSwatch(p.text, "text"),
    textDim: safeSwatch(p.textDim, "textDim"),
    accent: safeSwatch(p.accent, "accent"),
  };
  if (p.accent2 !== undefined) palette.accent2 = safeSwatch(p.accent2, "accent2");
  if (
    p.gradientText !== undefined &&
    parseColor(p.gradientText[0]) !== null &&
    parseColor(p.gradientText[1]) !== null
  ) {
    palette.gradientText = [p.gradientText[0], p.gradientText[1]];
  }
  return palette;
}

/* -------------------------------------------------------------------------- */
/*  Voiceover                                                                   */
/* -------------------------------------------------------------------------- */

/** OmniVoice profile ids (CLAUDE.md — treated as examples / config, not magic). */
const VO_PROFILE_HELPDESK = "fd085cf0";
const VO_PROFILE_LUXE = "feat_20_the_luxe";

/**
 * The cinematic presets swap to the "Luxe" voice (deeper, slower) per §5; the
 * flat/utility presets stay on the default "Helpdesk" profile.
 */
function voProfileFor(p: Preset): string {
  return p === "dark-cinematic" ? VO_PROFILE_LUXE : VO_PROFILE_HELPDESK;
}

/* -------------------------------------------------------------------------- */
/*  Copy bank — pure helpers over the kit's ranked copy candidates             */
/* -------------------------------------------------------------------------- */

/** A normalized copy line: collapsed whitespace, trimmed, non-empty. */
function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * The kit's copy bank as clean, de-duplicated, non-empty lines in rank order.
 * `brandKit.copy` is already salience-ranked by the ingest module; we only
 * normalize + de-dupe (case-insensitive), preserving order.
 */
function copyBank(kit: DirectorBrandKit): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of kit.copy ?? []) {
    const line = cleanLine(c.text ?? "");
    if (line.length < 2) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** Ensure a string ends with sentence punctuation (for tidy VO/caption text). */
function asSentence(s: string): string {
  const t = cleanLine(s);
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Pull the line at `idx` from the bank, falling back to `fallback` when the bank
 * is too short. Keeps the assembler total — every slot always gets real copy.
 */
function bankAt(bank: string[], idx: number, fallback: string): string {
  return bank[idx] ?? fallback;
}

/* -------------------------------------------------------------------------- */
/*  Asset selection                                                            */
/* -------------------------------------------------------------------------- */

/** A still asset key that is never a video clip (lint: `screen-is-still`). */
const VIDEO_KEY =
  /(?:\.(?:mp4|mov|webm|m4v|avi|mkv|gif))(?:$|[?#])|(?:^|[/_\-.])(?:video|clip|recording|offthreadvideo|reel)(?:$|[/_\-.])/i;

const isStillKey = (key: string): boolean => key.length > 0 && !VIDEO_KEY.test(key);

/**
 * The ordered list of usable STILL asset keys from the kit's screens. The ingest
 * module already orders screens hero/og/screenshot-first, so index 0 is the best
 * hero shot. Video-like keys are filtered out so the `screen-is-still` lint can
 * never trip. When the kit has no usable screens we synthesize a single
 * placeholder still key (deterministic, brand-scoped) so ProductShot/FeatureBeat
 * always have a valid still to point at.
 */
function stillKeys(kit: DirectorBrandKit): string[] {
  const keys = (kit.screens ?? [])
    .map((s) => s.key)
    .filter((k): k is string => typeof k === "string" && isStillKey(k));
  if (keys.length > 0) return keys;
  // Deterministic placeholder — a still slot, never a clip.
  return [`${kit.id}/hero`];
}

/* -------------------------------------------------------------------------- */
/*  Feature beats — derived from copy, capped at 3 (≤4 by rule, 3 per the §2    */
/*  template), sharing one layout by construction.                             */
/* -------------------------------------------------------------------------- */

/** lucide-react icon names cycled across feature beats / callouts (kebab-case). */
const FEATURE_ICONS = ["zap", "sparkles", "shield-check", "gauge"] as const;

/**
 * Short, brand-NEUTRAL benefit tails appended to each FeatureBeat's *narration*
 * (vo.text only — the on-screen `label`/`caption` props are untouched). They give
 * the read fuller sentences instead of staccato three-word fragments, and they
 * lift total narration over the launch-cut word FLOOR (`validateSceneRefs`) so an
 * auto-assembled keyless cut lands ~24–32s instead of a 14s blip. Indexed to the
 * default `FEATURE_ICONS` (zap→speed, sparkles→polish, shield-check→reliability)
 * so the spoken framing matches the beat's own iconography. No stat, no claim, no
 * fabricated proof — pure benefit register. Deterministic: a fixed table.
 */
const FEATURE_VO_TAILS = [
  "Fast where it counts.",
  "Polished and ready to ship.",
  "Reliable every single time.",
] as const;

/**
 * A narration-only tail for the ProductShot that frames the hero as doing the
 * end-to-end work. Spoken, not shown (the headline prop stays the brand's own
 * copy line). Helps the cut clear the word floor with grounded, claim-free copy.
 */
const PRODUCT_VO_TAIL = "Built to handle the busywork, end to end.";

/* -------------------------------------------------------------------------- */
/*  The heuristic director                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Assemble a lint-clean, schema-valid `VideoSpec` from a brand kit + goal with
 * NO model and NO network. Deterministic and total: returns a parsed `VideoSpec`
 * for any reasonable kit (it throws only if the assembled object somehow fails
 * `VideoSpec.parse`, which the construction below makes structurally impossible
 * — the parse is the fail-closed safety net).
 */
export function heuristicDirect(
  brandKit: DirectorBrandKit,
  goal: DirectorGoal = {},
): VideoSpec {
  /* --- Palette: threaded as DATA (no styling); bad swatches → safe default. */
  const palette = buildSafePalette(brandKit);
  const hasAccent2 = palette.accent2 !== undefined;

  const chosenPreset = pickPreset(brandKit, goal, palette);
  const bundle = presetBundle(chosenPreset);
  const motion: Motion = bundle.motion;
  const profile = voProfileFor(chosenPreset);

  // Transition: the preset's default, which is by definition within its allowed
  // (≤2) set — so the look stays on-token.
  const transitionKind: TransitionKind = bundle.transition.default;

  const bank = copyBank(brandKit);
  const stills = stillKeys(brandKit);
  const brandName = cleanLine(brandKit.name ?? "") || "your product";

  /* --- S1 Hook — pain-led, ≤2 lines, never a logo. ----------------------- */
  // Lead with the goal angle when given; else the brand's top copy line; always
  // resolve into the product as the answer.
  const angle = goal.angle ? cleanLine(goal.angle) : undefined;
  const hookLead = angle ?? bankAt(bank, 0, `${brandName} should be effortless.`);
  const hookAnswer = `Meet ${brandName}.`;
  const hookLines = [cleanLine(hookLead), hookAnswer].filter(
    (l) => l.length > 0,
  );
  const hookScene = {
    id: "hook",
    component: "Hook" as const,
    props: { lines: hookLines.length ? hookLines : [hookAnswer] },
    vo: {
      text: asSentence(`${hookLead} ${hookAnswer}`),
      profile,
    },
  };

  /* --- S2 ProductShot — first screen asset; the hero shot. --------------- */
  const productLine = bankAt(bank, 1, `${brandName} does the work for you.`);
  const callouts: {
    title: string;
    sub?: string;
    icon: string;
    anchor: "tl" | "tr" | "bl" | "br";
    accent: "accent" | "accent2" | "text";
  }[] = [
    {
      title: cleanLine(bankAt(bank, 2, "Built for speed")),
      icon: FEATURE_ICONS[0],
      anchor: "tr",
      accent: "accent",
    },
    {
      title: cleanLine(bankAt(bank, 3, "On your terms")),
      icon: FEATURE_ICONS[1],
      anchor: "bl",
      // accent2 is optional in the palette — only reference it when present, else
      // fall back to a guaranteed key so the callout always resolves a color.
      accent: hasAccent2 ? "accent2" : "text",
    },
  ];
  const productScene = {
    id: "product",
    component: "ProductShot" as const,
    props: {
      kicker: brandName,
      headline: asSentence(productLine),
      screen: stills[0],
      layout: "single" as const,
      tilt: 6,
      callouts,
    },
    vo: { text: asSentence(`${productLine} ${PRODUCT_VO_TAIL}`), profile },
  };

  /* --- S3..S5 FeatureBeat — up to 3, sharing one layout. ----------------- */
  // Draw beats from copy lines after the ones used by hook/product; pair each
  // with a still (cycled) and a shared-family icon. Capped at 3 (≤4 by rule).
  const FEATURE_COUNT = 3;
  const featureScenes = [];
  for (let i = 0; i < FEATURE_COUNT; i++) {
    const copyIdx = 4 + i;
    const label = cleanLine(
      bankAt(bank, copyIdx, `Feature ${i + 1}`),
    );
    const caption = asSentence(
      bankAt(bank, copyIdx, `${brandName} handles it end to end.`),
    );
    // Skip a beat only if there is genuinely no distinct copy AND we already have
    // enough narrative; but to stay deterministic+total we always emit beats with
    // a real label/caption (the fallbacks above guarantee non-empty strings).
    featureScenes.push({
      id: `feature-${i + 1}`,
      component: "FeatureBeat" as const,
      props: {
        label: label || `Feature ${i + 1}`,
        region: stills[(i + 1) % stills.length],
        caption,
        earcon: bundle.sound.kind === "tick" ? "tick" : "whoosh",
      },
      // Narration is the caption plus a brand-neutral benefit tail (vo only) so
      // the read is a full sentence and the cut clears the launch word floor.
      vo: {
        text: asSentence(`${caption} ${FEATURE_VO_TAILS[i % FEATURE_VO_TAILS.length]}`),
        profile,
      },
    });
  }

  /* --- S6 Stats — examples by default (verified:false → "e.g." affordance). */
  const statsScene = {
    id: "stats",
    component: "Stats" as const,
    props: {
      items: [
        {
          to: 90,
          suffix: "%",
          decimals: 0,
          label: "faster than before",
          // Unverified: heuristic has no sourced metric → renders as an example.
          verified: false,
        },
        {
          to: 3,
          suffix: "x",
          decimals: 0,
          label: "more done per week",
          verified: false,
        },
      ],
    },
    vo: {
      text: asSentence(
        `Teams move dramatically faster with ${brandName}`,
      ),
      profile,
    },
  };

  /* --- S7 Proof (optional) — one quote, real attribution, when copy exists. */
  // Only include a Proof when the bank has a spare line we can attribute; the
  // template makes Proof optional (≤1) so omitting it is always valid.
  const proofCandidate = bank[4 + FEATURE_COUNT];
  const proofScene = proofCandidate
    ? {
        id: "proof",
        component: "Proof" as const,
        props: {
          quote: asSentence(cleanLine(proofCandidate)),
          attribution: brandName,
        },
        vo: {
          text: asSentence(cleanLine(proofCandidate)),
          profile,
        },
      }
    : undefined;

  /* --- S8 CTA — wordmark + one action + url; always LAST. ----------------- */
  const url = ctaUrl(brandKit);
  const ctaScene = {
    id: "cta",
    component: "CTA" as const,
    props: {
      headline: asSentence(bankAt(bank, 0, `Get started with ${brandName}`)),
      url,
    },
    vo: {
      text: asSentence(`Get started with ${brandName} at ${spoken(url)}`),
      profile,
    },
  };

  /* --- Assemble in conversion order; parse as the fail-closed safety net. - */
  const scenes = [
    hookScene,
    productScene,
    ...featureScenes,
    statsScene,
    ...(proofScene ? [proofScene] : []),
    ctaScene,
  ];

  const raw: z.input<typeof VideoSpec> = {
    version: 1,
    format: goal.format ?? "16:9",
    preset: chosenPreset,
    motion,
    palette,
    brandKitId: brandKit.id,
    transitions: { kind: transitionKind, durationInFrames: 15 },
    scenes,
  };

  // Parsing applies schema defaults and GUARANTEES a contract-valid result; the
  // assembler is built to never trip this, but it is the fail-closed net.
  const parsed = VideoSpec.parse(raw);
  // House-brand style gate (CD R2 P2): warm ResuBird's palette off the scraped
  // periwinkle + keep the preset inside the locked allow-list. No-op for any
  // non-house brand.
  const brandHint = `${brandKit.name ?? ""} ${brandKit.url ?? ""} ${brandKit.id ?? ""}`;
  return gateBrandStyle(parsed, brandHint);
}

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Small URL helpers (pure)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Derive the CTA url/host from the kit. Prefers the kit's `url` host; falls back
 * to a name-derived dotcom. Returned as a bare host (no scheme) to match the
 * sample's `"yupcha.com"` style.
 */
function ctaUrl(kit: DirectorBrandKit): string {
  const raw = cleanLine(kit.url ?? "");
  if (raw) {
    try {
      const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
      return u.hostname.replace(/^www\./, "");
    } catch {
      /* fall through to name-derived */
    }
  }
  const slug = cleanLine(kit.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return slug ? `${slug}.com` : "example.com";
}

/** Render a host for speech ("yupcha.com" → "yupcha dot com"). */
function spoken(host: string): string {
  return host.replace(/\./g, " dot ");
}
