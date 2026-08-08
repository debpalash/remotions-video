/**
 * src/pipeline/heuristic.ts — the KEYLESS director.
 *
 * `heuristicDirect(brandKit, goal)` produces a schema-valid, lint-clean
 * `VideoSpec` from a BrandKit + goal WITHOUT any LLM. It is the fallback the
 * shared pipeline uses when no LLM key is present in the environment, so a
 * keyless run on a real URL still yields a real video.
 *
 * It is deterministic and pure given its inputs (no clock, no RNG, no I/O) and
 * assembles the SAME frozen design system the LLM director assembles — it just
 * picks copy and structure with rules instead of a model:
 *
 *   pain Hook (first) → ProductShot → Stats (if any number found) → CTA (last)
 *
 * Output is guaranteed `VideoSpec.parse`-valid AND `lintSpec`-clean (narrative
 * grammar, palette-key colors, captionable VO, still-only screens). The caller
 * may still re-run `lintSpec`/repair defensively; this never emits a violation.
 *
 * Lives in `src/pipeline` (NOT `src/llm`) so this package owns its keyless path
 * and touches only its assigned tree. It imports the contract + design binding
 * read-only.
 */
import { z } from "zod";

import {
  VideoSpec,
  type SceneSpec,
  type Preset,
  lintSpec,
} from "../spec";
import { BRAND_PRESETS, gateBrandStyle } from "../design";
import type { DirectorBrandKit, DirectorGoal } from "../llm";

/* -------------------------------------------------------------------------- */
/*  FeatureBeat screen assignment                                              */
/* -------------------------------------------------------------------------- */

/**
 * The bespoke ResuBird screens a FeatureBeat tour cycles through, in order.
 * Kept as a local literal (no cross-package import from `kino-scenes`) so the
 * pipeline owns its own ordering; mirrors `ResuBirdScreenId`.
 */
const FEATURE_SCREEN_ORDER = ["ats", "bullets", "cover"] as const;
type FeatureScreenId = (typeof FEATURE_SCREEN_ORDER)[number];

/**
 * Recover the bespoke ResuBird screen id a key names, if any: a bare `ats` /
 * `bullets` / `cover`, or a `resubird/<id>` brand-path key. Returns `undefined`
 * for a real screenshot path or a crawl scaffold. Pure string predicate.
 */
function bareScreenId(key: string | undefined): FeatureScreenId | undefined {
  if (!key) return undefined;
  const m = /(?:^|\/)(ats|bullets|cover)$/i.exec(key.trim());
  return m ? (m[1].toLowerCase() as FeatureScreenId) : undefined;
}

/**
 * Assign `FeatureBeatProps.screen` so the product tour renders THREE genuinely
 * DISTINCT bespoke screens (ATS gauge → bullet diff → cover draft) under one app
 * shell, with the hero's screen shown exactly ONCE. This is the single engine
 * chokepoint the loop kept re-finding broken (R6/R7/R8: the first feature beat
 * re-rendered the hero's ATS gauge, an escape hatch admitted that duplicate, and
 * `bullets` silently dropped).
 *
 * Two passes, pure/deterministic/idempotent:
 *  1. Resolve the HERO screen. A scaffold-key hero on the warm/ResuBird binding
 *     is forced to the live `ats` gauge (the "blank ATS hero" 404 fix); a hero
 *     that already names a bespoke screen is recorded so the tour can avoid it.
 *  2. Walk the FeatureBeats and hand each the NEXT screen from a tour pool that
 *     EXCLUDES the hero's screen, with a global de-dup so no screen repeats. An
 *     explicit per-beat `screen` is honored ONLY when it neither duplicates the
 *     hero nor a screen already used this tour — otherwise it is overridden (the
 *     old `if (scene.props.screen) return scene` escape hatch is gone). The
 *     dark/Yupcha binding (real screenshots, no bespoke screen) passes through:
 *     `bareScreenId` returns `undefined`, the pool stays the full set.
 */
export function assignFeatureScreens(
  spec: z.infer<typeof VideoSpec>,
): z.infer<typeof VideoSpec> {
  const isResuBird = bindingFor(spec.palette.bg) === "resubird";

  // --- Pass 1: resolve the hero screen (force a scaffold hero to ats). ------
  let heroScreen: FeatureScreenId | undefined;
  const withHero = spec.scenes.map((scene) => {
    if (scene.component !== "ProductShot") return scene;
    if (isResuBird && isScaffoldKey(scene.props.screen)) {
      heroScreen = "ats";
      return { ...scene, props: { ...scene.props, screen: "ats" } };
    }
    const bare = bareScreenId(scene.props.screen);
    if (bare) heroScreen = bare;
    return scene;
  });

  // --- Pass 2: hand each FeatureBeat a DISTINCT, non-hero screen. -----------
  // Tour pool excludes the hero's screen so the first beat never repeats it.
  const pool = FEATURE_SCREEN_ORDER.filter((s) => s !== heroScreen);
  const used = new Set<FeatureScreenId>();
  let beat = 0;
  const scenes = withHero.map((scene) => {
    if (scene.component !== "FeatureBeat") return scene;
    const wanted = bareScreenId(scene.props.screen);
    const screen: FeatureScreenId =
      wanted && wanted !== heroScreen && !used.has(wanted)
        ? wanted
        : // next unused pool screen, else cycle the pool (more beats than
          // screens) — pool is always non-empty (hero owns ≤1 of three).
          pool.find((s) => !used.has(s)) ?? pool[beat % pool.length];
    used.add(screen);
    beat++;
    return { ...scene, props: { ...scene.props, screen } };
  });
  return { ...spec, scenes };
}

/* -------------------------------------------------------------------------- */
/*  Brand binding                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Decide which brand binding a kit reads as (dark/agentic vs warm/editorial),
 * purely from its palette luminance. Dark backgrounds → the Yupcha binding
 * (`dark-cinematic` | `minimal-mono`); light → the ResuBird binding
 * (`editorial` | `gradient-glass`). This is the locked §4 binding applied to an
 * arbitrary ingested brand, not just the two house brands.
 */
function bindingFor(bg: string): "yupcha" | "resubird" {
  return isDark(bg) ? "yupcha" : "resubird";
}

/** Relative luminance of a hex color; true when the color reads dark. */
function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true; // default to the dark binding when unparseable
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 110; // ~0.43 of 255
}

/** Pick the preset: honor an explicit goal preset if it's in the binding. */
function pickPreset(brandBg: string, goalPreset?: Preset): Preset {
  const binding = bindingFor(brandBg);
  const allowed = BRAND_PRESETS[binding];
  if (goalPreset && (allowed as readonly Preset[]).indexOf(goalPreset) !== -1) {
    return goalPreset;
  }
  return allowed[0];
}

/* -------------------------------------------------------------------------- */
/*  Copy selection                                                            */
/* -------------------------------------------------------------------------- */

type Copy = NonNullable<DirectorBrandKit["copy"]>[number];

/** First copy candidate of a given kind, trimmed; `undefined` if none. */
function firstOfKind(copy: Copy[], kind: string): string | undefined {
  const hit = copy.find((c) => c.kind === kind && c.text.trim().length > 0);
  return hit?.text.trim();
}

/** First copy candidate matching a predicate, trimmed. */
function firstWhere(copy: Copy[], pred: (c: Copy) => boolean): string | undefined {
  const hit = copy.find((c) => pred(c) && c.text.trim().length > 0);
  return hit?.text.trim();
}

/** Clamp a string to a sentence-ish length so a Hook line stays tight. */
function tight(s: string, max = 64): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/[\s,;:]+\S*$/, "") + "…";
}

/** A spoken sentence: ensure it ends with terminal punctuation. */
function sentence(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return t;
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/**
 * Mine a single numeric stat from the copy bank (e.g. "10x faster", "90%").
 * Returns the parsed pieces or `undefined` if no clean number is present.
 */
function mineStat(
  copy: Copy[],
): { to: number; suffix: string; decimals: number; label: string } | undefined {
  for (const c of copy) {
    const text = c.text.replace(/\s+/g, " ").trim();
    // Match "90%", "10x", "3.5×", "24/7", "2x faster", "500+ teams"…
    const m = /(\d+(?:\.\d+)?)\s*(%|x|×|\/7|\+|k|m)?/i.exec(text);
    if (!m) continue;
    const value = Number.parseFloat(m[1]);
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) continue;
    // Skip pure years / version numbers / prices that aren't a value-prop stat.
    if (/\$|©|20\d{2}|v\d/.test(text)) continue;
    let suffix = (m[2] ?? "").toLowerCase();
    if (suffix === "×") suffix = "x";
    const decimals = m[1].includes(".") ? Math.min(2, m[1].split(".")[1].length) : 0;
    const label = tight(
      text.replace(m[0], "").replace(/^[\s,–—:-]+/, "").trim() || "and counting",
      36,
    );
    return { to: value, suffix, decimals, label };
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Asset selection                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Pick the best still asset key for the ProductShot HERO. Prefer a hero screen
 * (a dropped `dashboard.*` lands here via the real-asset override), then a
 * screenshot, then og, then the first screen; finally a stable placeholder key
 * (the renderer degrades a missing asset to a seeded MockUI — never a video).
 *
 * Because the real-asset override REPLACES scraped screens before the director
 * runs, a dropped real screen is what this returns whenever one exists — i.e.
 * the hero prefers a real screen by construction.
 */
function pickScreenKey(brandKit: DirectorBrandKit): string {
  const screens = brandKit.screens ?? [];
  const byRole = (role: string) => screens.find((s) => s.role === role)?.key;
  return (
    byRole("hero") ??
    byRole("screenshot") ??
    byRole("og") ??
    screens[0]?.key ??
    "screenshot"
  );
}

/**
 * A crawl SCAFFOLD key (`hero-0`, `screenshot-1`, `image-2`, …) — the ingest's
 * own `<role>-<i>` placeholder. These NEVER stage to a real still on disk
 * (`resolveAsset("hero-0") → "hero-0.webp"` is missing → a broken `<img>` that
 * collapses the ProductShot hero to an empty browser bar). A REAL dropped screen
 * keys under a brand path (`brand-assets/<slug>/…`, i.e. it contains a slash), so
 * a slash-free `<role>-<i>` token is the tell.
 */
const isScaffoldKey = (key: string): boolean =>
  !key.includes("/") &&
  /^(hero|screenshot|shot|og|image|logo|favicon|capture|frame|section)-?\d*$/i.test(
    key.trim(),
  );

/**
 * Resolve the ProductShot HERO screen key. When the picked key is a real dropped
 * screenshot (brand-pathed), use it. But when it's a crawl scaffold that won't
 * resolve to a still, the warm/editorial (ResuBird) binding mounts the bespoke
 * LIVE ATS gauge instead — `"resubird/ats"` passes `isLiveScreenKey` → `src`
 * resolves to `undefined` → the signature gauge renders under the warm shell,
 * and `deriveUrl` reads a clean `app.resubird.com/ats` (no `app.hero-0.com`
 * scaffold leak). The dark (Yupcha) binding keeps the scaffold key unchanged —
 * there is no bespoke dark screen, so its behaviour is untouched.
 */
function heroScreenKey(brandKit: DirectorBrandKit, picked: string): string {
  if (!isScaffoldKey(picked)) return picked;
  return bindingFor(brandKit.palette.bg) === "resubird" ? "resubird/ats" : picked;
}

/**
 * Real screens to drive FeatureBeats: the `screenshot`-role screens NOT already
 * consumed as the hero. A dropped `interview.*` / `ranking.*` lands here via the
 * real-asset override. Capped at 2 (≤4 FeatureBeats per video; we keep it tight)
 * and order-stable from the kit's deterministic screen order.
 */
function featureScreenKeys(brandKit: DirectorBrandKit, heroKey: string): string[] {
  const screens = brandKit.screens ?? [];
  return screens
    .filter((s) => s.role === "screenshot" && s.key !== heroKey)
    .map((s) => s.key)
    .slice(0, 2);
}

/* -------------------------------------------------------------------------- */
/*  Director                                                                  */
/* -------------------------------------------------------------------------- */

/** Default profile id per binding (CLAUDE.md: Luxe for cinematic, else Helpdesk). */
function profileFor(preset: Preset): string {
  return preset === "dark-cinematic" ? "feat_20_the_luxe" : "fd085cf0";
}

/**
 * Build a lint-clean, schema-valid `VideoSpec` from a brand kit + goal, with no
 * LLM. Deterministic and pure. Throws only if the assembled spec somehow fails
 * the contract or the lint (it never should — this is a fail-closed assertion,
 * not expected control flow).
 */
export function heuristicDirect(
  brandKit: DirectorBrandKit,
  goal: DirectorGoal = {},
): z.infer<typeof VideoSpec> {
  const copy = (brandKit.copy ?? []).filter((c) => c.text.trim().length > 0);
  const name = brandKit.name.trim() || "your product";
  const preset = pickPreset(brandKit.palette.bg, goal.preset);
  const profile = profileFor(preset);
  const format = goal.format ?? "16:9";
  const screenKey = pickScreenKey(brandKit);
  // The HERO screen: a real dropped screenshot when present, else the bespoke
  // live ATS gauge for the warm binding (never an empty scaffold `<img>`).
  const heroScreen = heroScreenKey(brandKit, screenKey);

  // --- Hook copy: lead with pain, never a logo (§2 pain-led 3s hook). ----
  const headline =
    firstOfKind(copy, "headline") ??
    firstWhere(copy, (c) => c.kind === "value-prop") ??
    `${name} runs it for you.`;
  const hookPain =
    goal.angle?.trim() ||
    firstWhere(copy, (c) => /\b(slow|hard|manual|hours|waste|stuck|tedious|pain)\b/i.test(c.text)) ||
    "The old way eats your week.";
  const hookLines = [tight(hookPain), tight(headline)].filter(
    (l, i, arr) => l.length > 0 && arr.indexOf(l) === i,
  );

  // --- ProductShot: kicker + headline + hero screen + ≤2 callouts. -------
  const kicker = tight(firstOfKind(copy, "subhead") ?? brandKit.voice ?? name, 40);
  const valueProps = copy
    .filter((c) => c.kind === "value-prop" || c.kind === "subhead")
    .map((c) => c.text.trim())
    .filter((t) => t.length > 0 && t !== headline)
    .slice(0, 2);
  const calloutIcons = ["sparkles", "zap"] as const;
  const calloutAccents = ["accent", "accent2"] as const;
  const callouts = valueProps.map((vp, i) => ({
    title: tight(vp, 28),
    sub: undefined as string | undefined,
    icon: calloutIcons[i] ?? "sparkles",
    anchor: (i === 0 ? "tr" : "bl") as "tr" | "bl",
    accent: calloutAccents[i] ?? "accent",
  }));

  // --- Scenes ------------------------------------------------------------
  const scenes: z.input<typeof SceneSpec>[] = [];

  scenes.push({
    id: "hook",
    component: "Hook",
    props: { lines: hookLines.length ? hookLines : [tight(headline)] },
    vo: { text: sentence(hookPain), profile },
  });

  scenes.push({
    id: "product",
    component: "ProductShot",
    props: {
      kicker,
      headline: tight(headline, 72),
      screen: heroScreen,
      layout: "single",
      tilt: 6,
      callouts,
    },
    vo: {
      text: sentence(
        valueProps[0]
          ? `${stripTrail(headline)} — ${lower(valueProps[0])}`
          : `Meet ${name}: ${lower(stripTrail(headline))}`,
      ),
      profile,
    },
  });

  // --- FeatureBeats: one per extra REAL screenshot (interview/ranking/…). ---
  // FeatureBeats in one video share a layout (consistency IS the premium tell).
  // We caption from the next available value-props, falling back to a neutral
  // line so the beat always reads. Skipped entirely when no real region exists.
  const featureKeys = featureScreenKeys(brandKit, screenKey);
  const featureCopy = copy
    .filter((c) => c.kind === "value-prop" || c.kind === "subhead")
    .map((c) => c.text.trim())
    .filter((t) => t.length > 0 && t !== headline);
  featureKeys.forEach((region, i) => {
    const cap = featureCopy[valueProps.length + i] ?? featureCopy[i] ?? `${name} in action.`;
    scenes.push({
      id: `feature-${i + 1}`,
      component: "FeatureBeat",
      props: {
        label: tight(`See it work`, 24),
        region,
        caption: tight(cap, 48),
        // EXPLICIT, index-driven screen so the tour shows three DISTINCT screens
        // (ATS gauge → bullet diff → cover draft). The hero ProductShot owns the
        // ATS gauge, so the beats start AFTER it (offset +1 → bullets, cover):
        // no first-beat ats-on-ats repeat. `assignFeatureScreens` re-affirms this
        // with a hero-aware de-dup for the LLM path too.
        screen: FEATURE_SCREEN_ORDER[(i + 1) % FEATURE_SCREEN_ORDER.length],
      },
      vo: { text: sentence(cap), profile },
    });
  });

  const stat = mineStat(copy);
  if (stat) {
    scenes.push({
      id: "stats",
      component: "Stats",
      props: {
        items: [
          {
            to: stat.to,
            suffix: stat.suffix,
            decimals: stat.decimals,
            label: stat.label,
            // Heuristic-mined → unverified → renders an "e.g." affordance.
            verified: false,
          },
        ],
      },
      vo: {
        text: sentence(
          `${stat.to}${stat.suffix || ""} ${stat.label}`.replace(/\s+/g, " "),
        ),
        profile,
      },
    });
  }

  const url = cleanUrl(brandKit.url, name);
  scenes.push({
    id: "cta",
    component: "CTA",
    props: { headline: tight(`Try ${name} today.`, 60), url },
    vo: { text: sentence(`Get started with ${name} at ${url}`), profile },
  });

  // --- Assemble + validate (fail-closed) ---------------------------------
  const raw: z.input<typeof VideoSpec> = {
    version: 1,
    format,
    preset,
    motion: preset === "minimal-mono" ? "punchy" : "calm",
    palette: brandKit.palette,
    brandKitId: brandKit.id,
    transitions: { kind: "fade", durationInFrames: 15 },
    scenes,
  };

  const parsed = VideoSpec.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `heuristicDirect: assembled spec failed VideoSpec validation:\n${parsed.error.issues
        .map((i) => `- ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }

  // Lint the RAW object (parse strips off-contract fields the lint guards).
  const lint = lintSpec(raw as z.infer<typeof VideoSpec>);
  if (!lint.ok) {
    throw new Error(
      `heuristicDirect: assembled spec failed the anti-slop lint:\n${lint.violations
        .map((v) => `- [${v.rule}] ${v.path}: ${v.message}`)
        .join("\n")}`,
    );
  }

  // House-brand style gate (CD R2 P2): warm ResuBird's palette off any cool
  // scraped swatch + keep the preset inside the locked allow-list. No-op for any
  // non-house brand (its scraped palette/preset pass through unchanged).
  const brandHint = `${brandKit.name ?? ""} ${brandKit.url ?? ""} ${brandKit.id ?? ""}`;
  return gateBrandStyle(parsed.data, brandHint);
}

/* -------------------------------------------------------------------------- */
/*  Small text helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Lowercase the first letter (for mid-sentence splicing). */
function lower(s: string): string {
  const t = s.trim();
  return t ? t[0].toLowerCase() + t.slice(1) : t;
}

/** Strip a trailing period so a fragment can be spliced mid-sentence. */
function stripTrail(s: string): string {
  return s.replace(/\s*[.!?…]+\s*$/, "").trim();
}

/**
 * Derive a spoken/displayed URL from the brand url. Falls back to a slugged
 * brand name + ".com" when the url is missing/unparseable.
 */
function cleanUrl(url: string | undefined, name: string): string {
  if (url) {
    try {
      const u = new URL(url.includes("://") ? url : `https://${url}`);
      const host = u.hostname.replace(/^www\./, "");
      if (host) return host;
    } catch {
      /* fall through */
    }
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug || "yourbrand"}.com`;
}
