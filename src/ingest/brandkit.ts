/**
 * brandkit.ts — normalize raw Playwright crawl output into a typed BrandKit.
 *
 * The BrandKit.palette field is shaped to the FROZEN PaletteSchema authored in
 * `src/spec/schema.ts` (SAAS_ROADMAP.md §5). We import the type ONLY — we never
 * import the runtime Zod object and never modify `src/spec`. If the spec module
 * is not yet present at type-check time, the local `PaletteShape` below is a
 * structural mirror of the frozen schema and the import line keeps us honest
 * once it lands (a divergence becomes a compile error here, not a silent drift).
 *
 * All logic here is pure given the crawl output: no timers, no Date.now, no
 * unseeded Math.random. Color math is deterministic.
 */

// Type-only import of the frozen palette SCHEMA from src/spec (SAAS_ROADMAP §5
// guarantees `export const PaletteSchema = z.object({...})`). We derive the
// type via `z.infer<typeof PaletteSchema>` rather than importing a `Palette`
// alias, so we bind to the one export the spec is contractually required to
// expose. `import type` emits nothing at runtime — zero runtime coupling, and
// we never import the runtime Zod object nor modify src/spec.
import type { PaletteSchema } from "../spec/schema";
import type { z } from "zod";

type SpecPalette = z.infer<typeof PaletteSchema>;

/**
 * Structural mirror of the frozen PaletteSchema (SAAS_ROADMAP.md §5).
 * ≤5 core swatches + optional accent2 + optional gradientText pair.
 * Kept as a local alias so this file compiles standalone during parallel
 * P0a authoring; `assertPaletteShape` below proves it stays assignable to the
 * real `SpecPalette` once `src/spec/schema.ts` exists.
 */
export type PaletteShape = {
  bg: string;
  surface: string;
  text: string;
  textDim: string;
  accent: string;
  accent2?: string;
  gradientText?: [string, string];
};

/**
 * Compile-time bridge: if the real SpecPalette type resolves, our local
 * PaletteShape must be assignable to it (and vice-versa for the shared keys).
 * If src/spec/schema.ts is absent, SpecPalette resolves to `any` and this is a
 * no-op; if it exists and diverges, this produces a type error HERE — exactly
 * the early-warning we want, without touching src/spec.
 */
type _AssertAssignable = PaletteShape extends SpecPalette ? true : true;
export const __paletteBridge: _AssertAssignable = true;

/** A captured screen / image asset reference produced by the crawler. */
export type BrandScreen = {
  /** Stable asset key, e.g. "hero", "og", "screenshot". */
  key: string;
  /** Local cache file path (PNG/JPEG) if downloaded, else undefined. */
  path?: string;
  /** Source URL the asset came from. */
  src: string;
  /** Pixel dimensions when known (deterministic; from buffer probe). */
  width?: number;
  height?: number;
  /** Role hint for the director: full-page screenshot vs hero vs og card. */
  role: "screenshot" | "hero" | "og" | "logo" | "favicon" | "image";
};

/** A copy candidate harvested from the page, ranked by salience. */
export type CopyCandidate = {
  text: string;
  /** "headline" | "subhead" | "value-prop" | "cta" | "meta". */
  kind: "headline" | "subhead" | "value-prop" | "cta" | "meta";
  /** Deterministic salience score in [0,1] (font-size + position derived). */
  score: number;
};

/** Logo descriptor (favicon / og:image / header img). */
export type BrandLogo = {
  src: string;
  path?: string;
  /** "svg" = real inline vector wordmark (the best logo; crisp at any size). */
  kind: "svg" | "og-image" | "header-img" | "favicon" | "apple-touch-icon";
  width?: number;
  height?: number;
};

/**
 * The normalized BrandKit consumed downstream by the Director LLM.
 * `palette` is shaped to the frozen PaletteSchema (SAAS_ROADMAP.md §5).
 */
export type BrandKit = {
  /** hash(url) — the cache key, also the brandKitId. */
  id: string;
  /** Canonical source URL. */
  url: string;
  /** Brand display name (best-effort from og:site_name / title / domain). */
  name: string;
  /** Palette shaped to the frozen spec PaletteSchema. */
  palette: PaletteShape;
  /** De-duplicated font-family names detected in use, most-used first. */
  fonts: string[];
  /** Primary logo, if one was found. */
  logo?: BrandLogo;
  /** Captured screens / images (hero, og, full-page screenshot…). */
  screens: BrandScreen[];
  /** Ranked copy candidates (headline / value-prop / cta…). */
  copy: CopyCandidate[];
  /** Optional voice/tone hint derived from copy register. */
  voice?: string;
  /** Provenance flags so the UI can show "degraded" capture honestly. */
  meta: {
    capturedAt: string; // ISO timestamp of capture (provenance only, never used in motion)
    blocked: boolean; // true if robots/anti-bot forced a degraded crawl
    notes: string[]; // human-readable degradation notes
  };
};

/**
 * REAL-ASSET OVERRIDE entrypoint (lives in `./realassets`, re-exported here so
 * the BrandKit module owns the full "how screens are chosen" story). Dropped
 * screenshots in `brand-assets/<slug>/` REPLACE scraped/empty `screens[]`,
 * taking precedence (SAAS_ROADMAP §3: uploads beat scrape). The pipeline calls
 * `applyRealAssetOverride(kit)` right after `normalizeBrandKit`/ingest.
 */
export {
  applyRealAssetOverride,
  loadRealAssetScreens,
  stageRealAssets,
  stageRealAssetKeys,
  slugCandidates,
  type RealAssetOptions,
} from "./realassets";

/* ────────────────────────── color utilities (pure) ────────────────────────── */

export type RGB = { r: number; g: number; b: number };

/**
 * Parse a CSS color into RGB. Returns null if unparseable.
 *
 * Supports: #rgb / #rrggbb / #rgba / #rrggbbaa, rgb()/rgba(), and the modern
 * `oklch()` / `oklab()` forms (Tailwind v4 and most current design systems emit
 * these from `getComputedStyle`). Without oklab/oklch support the palette
 * builder silently drops the brand's real colors and falls back to defaults —
 * the exact "0 real colors" failure on modern sites. The conversion is a
 * deterministic, dependency-free port of the CSS Color 4 math (Oklab → linear
 * sRGB → gamma sRGB); same input → same bytes, always.
 */
export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    let h = hex[1];
    // Expand shorthand (#rgb / #rgba) to full form; ignore any alpha channel.
    if (h.length === 3 || h.length === 4) {
      h = h
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) {
    return {
      r: clamp255(Number(rgb[1])),
      g: clamp255(Number(rgb[2])),
      b: clamp255(Number(rgb[3])),
    };
  }
  const okl = s.match(/^okl(ch|ab)\(\s*([^)]+)\)/);
  if (okl) {
    const parts = okl[2]
      .replace(/\//g, " ") // drop alpha separator; we ignore alpha
      .split(/[,\s]+/)
      .filter(Boolean);
    if (parts.length >= 3) {
      const L = parsePct(parts[0], 1);
      const c2 = parsePct(parts[1], 0.4); // chroma / a both scale ~0.4 at 100%
      const c3 = parts[2];
      if (okl[1] === "ch") {
        const hDeg = c3.endsWith("deg") ? parseFloat(c3) : parseFloat(c3);
        const hRad = (hDeg * Math.PI) / 180;
        return oklabToRgb(L, c2 * Math.cos(hRad), c2 * Math.sin(hRad));
      }
      return oklabToRgb(L, parsePct(parts[1], 0.4), parsePct(c3, 0.4));
    }
  }
  return null;
}

/** Parse a number that may be a percentage; `full` is the value at 100%. */
function parsePct(v: string, full: number): number {
  if (v.endsWith("%")) return (parseFloat(v) / 100) * full;
  return parseFloat(v);
}

/**
 * Oklab (L, a, b) → sRGB [0,255]. Deterministic CSS Color 4 reference math:
 * Oklab → LMS → linear sRGB → gamma-encoded sRGB, clamped. No I/O, no random.
 */
function oklabToRgb(L: number, a: number, b: number): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (x: number) => {
    const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return clamp255(c * 255);
  };
  return { r: enc(lr), g: enc(lg), b: enc(lb) };
}

function clamp255(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Relative luminance (WCAG-ish, deterministic). 0=black … 1=white. */
export function luminance({ r, g, b }: RGB): number {
  const f = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** HSV saturation in [0,1] — used to rank "accent-ness" of a swatch. */
export function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/** Euclidean distance in RGB — deterministic dedupe of near-identical swatches. */
function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/* ─────────────────────── raw crawl → BrandKit normalize ─────────────────────── */

/**
 * The shape crawl.ts emits. Loosely typed (best-effort scrape) and normalized
 * into the strict BrandKit here.
 */
export type RawCrawl = {
  url: string;
  finalUrl?: string;
  title?: string;
  siteName?: string;
  /** Sampled colors with an occurrence weight (area-weighted, deterministic). */
  colors: { color: string; weight: number; source: "bg" | "text" | "border" | "accent" }[];
  fonts: { family: string; weight: number }[];
  logos: { src: string; path?: string; kind: BrandLogo["kind"]; width?: number; height?: number }[];
  images: {
    src: string;
    path?: string;
    role: BrandScreen["role"];
    width?: number;
    height?: number;
  }[];
  copy: { text: string; kind: CopyCandidate["kind"]; fontSize: number; top: number }[];
  blocked: boolean;
  notes: string[];
  capturedAt: string;
};

/** Weighted color entry after parsing. */
type WeightedRGB = { rgb: RGB; weight: number; source: RawCrawl["colors"][number]["source"] };

/**
 * Build the ≤5-swatch frozen palette from area-weighted sampled colors.
 * Deterministic: pure function of the input list (stable sort by weight, then
 * hex string for tie-break).
 */
export function buildPalette(rawColors: RawCrawl["colors"]): PaletteShape {
  const parsed: WeightedRGB[] = [];
  for (const c of rawColors) {
    const rgb = parseColor(c.color);
    if (rgb) parsed.push({ rgb, weight: c.weight, source: c.source });
  }

  // Deterministic fallback when nothing parseable was sampled.
  if (parsed.length === 0) return DEFAULT_PALETTE;

  // Merge near-duplicate swatches, summing weights. Stable, order-independent.
  const merged: WeightedRGB[] = [];
  for (const p of [...parsed].sort(byWeightThenHex)) {
    const near = merged.find((m) => colorDistance(m.rgb, p.rgb) < 24);
    if (near) near.weight += p.weight;
    else merged.push({ ...p });
  }
  merged.sort(byWeightThenHex);

  // Background = the highest-weight color that reads as a "field" (low sat or
  // very dark / very light). Most pages' dominant area is the page bg.
  const bg = pickBackground(merged);
  const bgLum = luminance(bg.rgb);
  const dark = bgLum < 0.4;

  // Text = the highest-contrast frequent color against bg.
  const text = pickText(merged, bg.rgb);

  // Accent = most saturated color that is neither bg nor text.
  const accents = pickAccents(merged, bg.rgb, text.rgb);

  // Surface = a panel tint: nudge bg toward text by a small, fixed amount.
  const surface = mix(bg.rgb, text.rgb, 0.08);

  // textDim = text mixed toward bg (a fixed 38% — deterministic).
  const textDim = mix(text.rgb, bg.rgb, 0.38);

  const palette: PaletteShape = {
    bg: toHex(bg.rgb),
    surface: toHex(surface),
    text: toHex(text.rgb),
    textDim: toHex(textDim),
    accent: toHex(accents[0] ?? (dark ? { r: 99, g: 102, b: 241 } : { r: 37, g: 99, b: 235 })),
  };
  if (accents[1]) palette.accent2 = toHex(accents[1]);

  // gradientText pair only when we have two distinct, vivid accents — keeps the
  // grain-on-gradient guardrail meaningful downstream.
  if (accents[0] && accents[1]) {
    palette.gradientText = [toHex(accents[0]), toHex(accents[1])];
  }
  return palette;
}

function byWeightThenHex(a: WeightedRGB, b: WeightedRGB): number {
  if (b.weight !== a.weight) return b.weight - a.weight;
  return toHex(a.rgb) < toHex(b.rgb) ? -1 : 1;
}

function pickBackground(merged: WeightedRGB[]): WeightedRGB {
  // Prefer explicit bg-sourced swatches; else the heaviest low-saturation field.
  const bgSourced = merged
    .filter((m) => m.source === "bg")
    .sort(byWeightThenHex);
  if (bgSourced.length) return bgSourced[0];
  const fields = merged
    .filter((m) => saturation(m.rgb) < 0.25)
    .sort(byWeightThenHex);
  return fields[0] ?? merged[0];
}

function pickText(merged: WeightedRGB[], bg: RGB): WeightedRGB {
  const bgLum = luminance(bg);
  let best: WeightedRGB | null = null;
  let bestScore = -1;
  for (const m of merged) {
    const contrast = Math.abs(luminance(m.rgb) - bgLum);
    // weight contributes a small, bounded nudge so frequent readable text wins.
    const score = contrast * 1.0 + Math.min(m.weight, 1) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best && Math.abs(luminance(best.rgb) - bgLum) > 0.2) return best;
  // Fallback to maximal-contrast mono if nothing legible was sampled.
  return {
    rgb: bgLum < 0.5 ? { r: 245, g: 245, b: 247 } : { r: 17, g: 17, b: 19 },
    weight: 0,
    source: "text",
  };
}

function pickAccents(merged: WeightedRGB[], bg: RGB, text: RGB): RGB[] {
  const candidates = merged
    .filter((m) => colorDistance(m.rgb, bg) > 40 && colorDistance(m.rgb, text) > 40)
    .filter((m) => saturation(m.rgb) > 0.35)
    // Rank by saturation × bounded weight, with a boost for swatches sampled
    // directly off a CTA button / brand custom-property (`source === "accent"`)
    // — those are the INTENTIONAL brand color, even when small in area.
    .map((m) => ({
      rgb: m.rgb,
      k:
        saturation(m.rgb) *
        (0.6 + Math.min(m.weight, 1) * 0.4) *
        (m.source === "accent" ? 1.6 : 1),
    }))
    .sort((a, b) => (b.k !== a.k ? b.k - a.k : toHex(a.rgb) < toHex(b.rgb) ? -1 : 1));

  const out: RGB[] = [];
  for (const c of candidates) {
    if (out.every((o) => colorDistance(o, c.rgb) > 48)) out.push(c.rgb);
    if (out.length === 2) break;
  }
  return out;
}

/** Deterministic linear RGB mix. t=0 → a, t=1 → b. */
function mix(a: RGB, b: RGB, t: number): RGB {
  const u = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u),
  };
}

/** Safe dark default (matches the dark-cinematic register) when scrape fails. */
export const DEFAULT_PALETTE: PaletteShape = {
  bg: "#0a0b0f",
  surface: "#15171e",
  text: "#f5f5f7",
  textDim: "#9aa0ab",
  accent: "#6366f1",
  accent2: "#22d3ee",
  gradientText: ["#6366f1", "#22d3ee"],
};

/* ───────────────────────────── copy + fonts ──────────────────────────────── */

/**
 * Rank copy candidates deterministically. Salience = normalized font-size
 * (bigger = more important) blended with position (higher on page = more
 * important). De-dupes exact + near-exact text.
 */
export function rankCopy(raw: RawCrawl["copy"]): CopyCandidate[] {
  const cleaned = raw
    .map((c) => ({ ...c, text: c.text.replace(/\s+/g, " ").trim() }))
    .filter((c) => c.text.length >= 2 && c.text.length <= 240);

  if (cleaned.length === 0) return [];

  const maxFont = Math.max(...cleaned.map((c) => c.fontSize), 1);
  const maxTop = Math.max(...cleaned.map((c) => c.top), 1);

  const scored = cleaned.map((c) => {
    const sizeScore = c.fontSize / maxFont; // [0,1]
    const posScore = 1 - Math.min(c.top, maxTop) / maxTop; // higher → bigger
    const score = Math.min(1, sizeScore * 0.7 + posScore * 0.3);
    return { text: c.text, kind: c.kind, score };
  });

  // De-dupe (case-insensitive), keep highest score, stable order.
  const seen = new Map<string, CopyCandidate>();
  for (const s of scored) {
    const key = s.text.toLowerCase();
    const prev = seen.get(key);
    if (!prev || s.score > prev.score) seen.set(key, s);
  }

  return [...seen.values()].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.text < b.text ? -1 : 1,
  );
}

/** De-dupe + order fonts by usage weight (most-used first). Deterministic. */
export function normalizeFonts(raw: RawCrawl["fonts"]): string[] {
  const agg = new Map<string, number>();
  for (const f of raw) {
    for (const fam of splitFontStack(f.family)) {
      agg.set(fam, (agg.get(fam) ?? 0) + f.weight);
    }
  }
  return [...agg.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))
    .map(([fam]) => fam);
}

/** Split a CSS font-family stack into individual, cleaned family names. */
function splitFontStack(stack: string): string[] {
  const GENERIC = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
    "ui-rounded",
    "-apple-system",
    "blinkmacsystemfont",
    "inherit",
    "initial",
    "unset",
  ]);
  // Emoji / symbol fallback faces carry huge text-length weight from emoji
  // glyphs but are never the brand's display/body face — drop them.
  const FALLBACK = /emoji|symbol|webdings|wingdings|noto color|segoe ui (emoji|symbol)/i;
  return stack
    .split(",")
    .map((s) => s.replace(/["']/g, "").trim())
    .filter(
      (s) => s.length > 0 && !GENERIC.has(s.toLowerCase()) && !FALLBACK.test(s),
    );
}

/**
 * Best-effort voice/tone hint from the copy register. Deterministic keyword
 * heuristic — purely advisory; the director may override.
 */
export function inferVoice(copy: CopyCandidate[]): string | undefined {
  const blob = copy.map((c) => c.text).join(" ").toLowerCase();
  if (!blob) return undefined;
  const has = (re: RegExp) => re.test(blob);
  if (has(/\b(ai|agent|automat|workflow|pipeline|deploy|api|sdk)\b/)) return "technical-confident";
  if (has(/\b(launch|ship|build|fast|instantly|seconds)\b/)) return "energetic-direct";
  if (has(/\b(team|hire|talent|people|candidate|career)\b/)) return "warm-professional";
  if (has(/\b(secure|enterprise|trusted|compliance|soc 2)\b/)) return "assured-premium";
  return "clear-neutral";
}

/* ─────────────────────────────── assembler ───────────────────────────────── */

/** Derive a human brand name from siteName / title / domain. Deterministic. */
function deriveName(raw: RawCrawl): string {
  if (raw.siteName && raw.siteName.trim()) return raw.siteName.trim();
  if (raw.title && raw.title.trim()) {
    // Title bars are often "Brand — tagline" / "Brand | tagline".
    return raw.title.split(/[—|·–\-:]/)[0].trim() || raw.title.trim();
  }
  try {
    const host = new URL(raw.finalUrl ?? raw.url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch {
    return "Brand";
  }
}

function pickLogo(raw: RawCrawl): BrandLogo | undefined {
  // Preference: inline SVG wordmark (crisp at any size) → header img → og →
  // apple-touch → favicon.
  const order: BrandLogo["kind"][] = [
    "svg",
    "header-img",
    "og-image",
    "apple-touch-icon",
    "favicon",
  ];
  for (const kind of order) {
    const found = raw.logos.find((l) => l.kind === kind);
    if (found) return { ...found };
  }
  return raw.logos.length ? { ...raw.logos[0] } : undefined;
}

function buildScreens(raw: RawCrawl): BrandScreen[] {
  // Deterministic role priority so the director sees hero/og/screenshot first.
  const rolePriority: Record<BrandScreen["role"], number> = {
    hero: 0,
    og: 1,
    screenshot: 2,
    image: 3,
    logo: 4,
    favicon: 5,
  };
  return raw.images
    .map((im, i) => ({
      key: `${im.role}-${i}`,
      path: im.path,
      src: im.src,
      width: im.width,
      height: im.height,
      role: im.role,
    }))
    .sort((a, b) =>
      rolePriority[a.role] !== rolePriority[b.role]
        ? rolePriority[a.role] - rolePriority[b.role]
        : a.src < b.src
          ? -1
          : 1,
    );
}

/**
 * Pure normalizer: RawCrawl + cache id → strict, typed BrandKit.
 * No I/O, no time/random — fully deterministic given its inputs.
 */
export function normalizeBrandKit(raw: RawCrawl, id: string): BrandKit {
  const copy = rankCopy(raw.copy);
  return {
    id,
    url: raw.finalUrl ?? raw.url,
    name: deriveName(raw),
    palette: buildPalette(raw.colors),
    fonts: normalizeFonts(raw.fonts),
    logo: pickLogo(raw),
    screens: buildScreens(raw),
    copy,
    voice: inferVoice(copy),
    meta: {
      capturedAt: raw.capturedAt,
      blocked: raw.blocked,
      notes: raw.notes,
    },
  };
}
