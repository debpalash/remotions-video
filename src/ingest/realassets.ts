/**
 * src/ingest/realassets.ts — REAL-ASSET OVERRIDE.
 *
 * When a user drops real product screenshots into
 * `brand-assets/<brandSlug>/`, those files are the truth — they take
 * PRECEDENCE over anything the Playwright crawl scraped (or over an empty
 * `screens[]` on a degraded/keyless run). This module is the loader:
 *
 *   loadRealAssetScreens(slug, opts)  → BrandScreen[]   (real dropped stills)
 *   applyRealAssetOverride(kit, opts) → BrandKit         (merged kit)
 *   stageRealAssets(kit, assetRoot)   → copies files into the served root
 *
 * Role is inferred from the FILENAME so the director places each screen well:
 *   dashboard / home / app / overview / main / hero → "hero"   (→ ProductShot hero)
 *   interview / ranking / score / result / candidate
 *     / pipeline / chat / report / analysis / feature → "screenshot" (→ FeatureBeat)
 *   everything else                                 → "image"  (generic)
 *
 * RESOLUTION CONTRACT (no src/kino-scenes or src/render change needed) —
 * the emitted `BrandScreen.key` is the value the director hands the renderer as
 * `ProductShot.screen` / `FeatureBeat.region`, and it is a CLEAN RELATIVE key:
 *
 *   key = "brand-assets/<slug>/<file>"        e.g. "brand-assets/yupcha/dashboard.webp"
 *
 * Why this exact form:
 *   - `resolveAsset(key)` (kit.tsx) only appends ".webp" when the key has NO
 *     extension; our keys carry a real image extension, so it returns the key
 *     VERBATIM → `<img src="brand-assets/yupcha/dashboard.webp">`, fetched as
 *     `/assets/brand-assets/yupcha/dashboard.webp` by the host page.
 *   - The host asset server (orchestrator.ts / storyboard.ts) strips `/assets/`
 *     and does `join(assetRoot, key)` → so the file must live UNDER the served
 *     asset root. `stageRealAssets` copies the dropped files into
 *     `<assetRoot>/brand-assets/<slug>/` exactly once before render — turning a
 *     drop in the repo's `brand-assets/` into a served still with a clean key.
 *   - A clean relative key (no absolute path, no `video`/`clip`/`.mp4` substring)
 *     is also anti-slop-lint clean (`screen-is-still`); embedding an absolute
 *     path would falsely trip the lint on incidental substrings.
 *
 * DETERMINISM (ENGINE_DESIGN §2): a pure function of the directory listing —
 * files are sorted (role priority, then name) so the SAME drop yields the SAME
 * screens, the SAME keys, and the SAME spec every time. No clock, no RNG. The
 * staging copy is byte-for-byte (content preserved); same source → same served
 * bytes.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

import type { BrandKit, BrandScreen } from "./brandkit";

/** Image extensions we accept as a real still. Videos are deliberately excluded
 *  (the `screen` slot must be a still — `OffthreadVideo` is banned, §7 risk row;
 *  a dropped `.mp4`/`.mov` would also trip the anti-slop lint downstream). */
const STILL_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

/** Filename stems (substring match, case-insensitive) → "hero" role. */
const HERO_HINTS = ["dashboard", "home", "app", "overview", "main", "hero"];
/** Filename stems → "screenshot" role (a FeatureBeat region). */
const FEATURE_HINTS = [
  "interview",
  "ranking",
  "rank",
  "score",
  "scoring",
  "result",
  "candidate",
  "pipeline",
  "chat",
  "report",
  "analysis",
  "feature",
];

/** The served key prefix (under the asset root) where real drops are staged. */
const STAGED_PREFIX = "brand-assets";

export interface RealAssetOptions {
  /** Root that holds `<brandSlug>/` folders. Default `<repo>/brand-assets`. */
  brandAssetsRoot?: string;
  /** Logger sink for provenance. Default: silent. */
  log?: (msg: string) => void;
}

/** `<repo>/brand-assets` — this file is `<repo>/src/ingest/realassets.ts`. */
function defaultBrandAssetsRoot(): string {
  return resolve(__dirname, "..", "..", "brand-assets");
}

/** Lowercased file extension including the dot, e.g. ".png". "" if none. */
function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/** Infer the director-facing role from a filename. Deterministic substring map. */
function roleFromFilename(name: string): BrandScreen["role"] {
  const stem = name.toLowerCase();
  if (HERO_HINTS.some((h) => stem.includes(h))) return "hero";
  if (FEATURE_HINTS.some((h) => stem.includes(h))) return "screenshot";
  return "image";
}

/** Role sort priority so hero screens land first (director prefers them). */
const ROLE_PRIORITY: Record<BrandScreen["role"], number> = {
  hero: 0,
  screenshot: 1,
  og: 2,
  image: 3,
  logo: 4,
  favicon: 5,
};

/**
 * Normalize an arbitrary brand identifier into the slug forms a dropped folder
 * is likely named: the lowercased alphanumeric brand name and the bare hostname
 * label. Returns a de-duplicated, order-stable candidate list.
 */
export function slugCandidates(kit: Pick<BrandKit, "name" | "url">): string[] {
  const out: string[] = [];
  const push = (s: string | undefined) => {
    const v = (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (v && !out.includes(v)) out.push(v);
  };
  push(kit.name);
  if (kit.url) {
    try {
      const u = new URL(kit.url.includes("://") ? kit.url : `https://${kit.url}`);
      push(u.hostname.replace(/^www\./, "").split(".")[0]);
    } catch {
      /* ignore unparseable url */
    }
  }
  return out;
}

/**
 * Scan ONE brand-assets folder for still images → ordered `BrandScreen[]`.
 * Pure given the directory contents. Returns `[]` if the folder is absent or
 * holds no usable stills. `key` is the CLEAN served key `brand-assets/<slug>/<file>`;
 * `path`/`src` carry the absolute source path (for staging + provenance).
 */
export function loadRealAssetScreens(
  slug: string,
  opts: RealAssetOptions = {},
): BrandScreen[] {
  const root = opts.brandAssetsRoot ?? defaultBrandAssetsRoot();
  const dir = join(root, slug);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    if (!statSync(dir).isDirectory()) return [];
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const screens = entries
    .filter((name) => STILL_EXT.has(extOf(name)) && !name.startsWith("."))
    .map((name) => {
      const abs = join(dir, name);
      return {
        // Clean served key — resolves under the asset root after staging.
        key: `${STAGED_PREFIX}/${slug}/${name}`,
        path: abs,
        src: abs,
        role: roleFromFilename(name),
        _name: name, // sort helper only; stripped below
      } as BrandScreen & { _name: string };
    })
    // Deterministic order: role priority, then filename (case-insensitive).
    .sort((a, b) => {
      const pr = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
      if (pr !== 0) return pr;
      const an = a._name.toLowerCase();
      const bn = b._name.toLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    })
    .map(({ _name, ...screen }) => screen);

  if (screens.length) {
    opts.log?.(
      `[real-assets] ${slug}/: ${screens.length} dropped still(s) → ` +
        screens.map((s) => `${s.role}:${(s.path ?? "").split("/").pop()}`).join(", "),
    );
  }
  return screens;
}

/**
 * Apply the real-asset override to a BrandKit. If `brand-assets/<slug>/` (for
 * any slug candidate derived from the kit's name/url) contains dropped stills,
 * those screens REPLACE the kit's scraped/empty `screens[]` (taking precedence,
 * SAAS_ROADMAP §3: uploads beat scrape). Otherwise the kit is returned
 * unchanged. Pure given the kit + directory contents.
 */
export function applyRealAssetOverride(
  kit: BrandKit,
  opts: RealAssetOptions = {},
): BrandKit {
  for (const slug of slugCandidates(kit)) {
    const real = loadRealAssetScreens(slug, opts);
    if (real.length) {
      opts.log?.(
        `[real-assets] override ENGAGED for "${kit.name}" via brand-assets/${slug}/ ` +
          `— ${real.length} real screen(s) take precedence over ${kit.screens.length} scraped.`,
      );
      return { ...kit, screens: real };
    }
  }
  return kit;
}

/**
 * Stage any real (dropped) screens of a kit into the served asset root so their
 * clean `brand-assets/<slug>/<file>` keys resolve to real `<img>` stills through
 * the host. A real screen is one whose `path` lives under the brand-assets root
 * (i.e. it came from `applyRealAssetOverride`, not the crawler). Copies are
 * byte-for-byte and idempotent (skipped when already present). Returns the count
 * staged. The caller invokes this once before render/storyboard.
 */
export function stageRealAssets(
  kit: BrandKit,
  assetRoot: string,
  opts: RealAssetOptions = {},
): number {
  const brandRoot = opts.brandAssetsRoot ?? defaultBrandAssetsRoot();
  let staged = 0;
  for (const screen of kit.screens) {
    // Only stage screens whose served key targets the staged prefix AND whose
    // source path exists on disk under the brand-assets root.
    if (!screen.key.startsWith(`${STAGED_PREFIX}/`)) continue;
    const src = screen.path ?? screen.src;
    if (!src || !existsSync(src) || !resolve(src).startsWith(resolve(brandRoot)))
      continue;
    const dest = join(assetRoot, screen.key);
    try {
      if (!existsSync(dest)) {
        mkdirSync(join(dest, ".."), { recursive: true });
        copyFileSync(src, dest);
      }
      staged++;
    } catch (err) {
      opts.log?.(
        `[real-assets] WARN could not stage ${screen.key} (${(err as Error).message}).`,
      );
    }
  }
  if (staged) {
    opts.log?.(
      `[real-assets] staged ${staged} real screen(s) under ${assetRoot}/${STAGED_PREFIX}/.`,
    );
  }
  return staged;
}

/**
 * Stage real assets referenced by a list of asset KEYS (e.g. a spec's
 * `ProductShot.screen` / `FeatureBeat.region` values) — the brandKit-free path
 * used by the standalone storyboard gate. A staged key has the form
 * `brand-assets/<slug>/<file>`; its source is `<brandAssetsRoot>/<slug>/<file>`.
 * Copies are byte-for-byte and idempotent. Returns the count staged.
 */
export function stageRealAssetKeys(
  keys: readonly string[],
  assetRoot: string,
  opts: RealAssetOptions = {},
): number {
  const brandRoot = opts.brandAssetsRoot ?? defaultBrandAssetsRoot();
  const prefix = `${STAGED_PREFIX}/`;
  let staged = 0;
  for (const key of new Set(keys)) {
    if (!key.startsWith(prefix)) continue;
    const rel = key.slice(prefix.length); // "<slug>/<file>"
    const src = join(brandRoot, rel);
    if (!existsSync(src)) continue;
    const dest = join(assetRoot, key);
    try {
      if (!existsSync(dest)) {
        mkdirSync(join(dest, ".."), { recursive: true });
        copyFileSync(src, dest);
      }
      staged++;
    } catch (err) {
      opts.log?.(
        `[real-assets] WARN could not stage ${key} (${(err as Error).message}).`,
      );
    }
  }
  if (staged) {
    opts.log?.(
      `[real-assets] staged ${staged} real screen(s) (by key) under ${assetRoot}/${STAGED_PREFIX}/.`,
    );
  }
  return staged;
}
