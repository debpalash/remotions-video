/**
 * `screens/index.ts` — the ResuBird product-UI REGISTRY.
 *
 * Binds each screen's render ↔ its hot-rects so the FeatureBeat focus ring is
 * GUARANTEED to land on a real, content-full element (no more content-less
 * glow). One app shell (`ResuBirdShell`) wraps three real screens — ATS gauge,
 * bullet before→after diff, cover-letter draft — sharing one warm design
 * language. `screenFor` resolves a stable, byte-identical screen id from a seed.
 *
 * DETERMINISM: `screenFor` is a pure function of `seed`; `seededRandom` is the
 * only entropy and only for the no-hint fallback pick. All semantic data is
 * pinned in the screen modules.
 */
import * as React from "react";

import { seededRandom } from "../../../engine";
import { AtsScreen, atsHotRects, atsMeta } from "./ats";
import { BulletsScreen, bulletsHotRects, bulletsMeta } from "./bullets";
import { CoverScreen, coverHotRects, coverMeta } from "./cover";

export type ResuBirdScreenId = "ats" | "bullets" | "cover";

export type HotRect = {
  rect: { x: number; y: number; w: number; h: number };
  label: string;
};

export type ScreenSpec = {
  id: ResuBirdScreenId;
  /** Content-header title. */
  title: string;
  /** Active stepper node. */
  step: "ATS" | "Build";
  /** Active left-nav row. */
  nav: string;
  /** Resolved StatusPill text (pinned). */
  status: string;
  /** The screen BODY (shell adds the shared chrome around it). */
  render: (p: { seed: string; width: number }) => React.ReactNode;
  /** Hot-rects (fractions of the still box); `[0]` = this screen's hero element. */
  hotRects: readonly HotRect[];
};

export const SCREENS: Record<ResuBirdScreenId, ScreenSpec> = {
  ats: {
    id: "ats",
    ...atsMeta,
    render: (p) => React.createElement(AtsScreen, p),
    hotRects: atsHotRects,
  },
  bullets: {
    id: "bullets",
    ...bulletsMeta,
    render: (p) => React.createElement(BulletsScreen, p),
    hotRects: bulletsHotRects,
  },
  cover: {
    id: "cover",
    ...coverMeta,
    render: (p) => React.createElement(CoverScreen, p),
    hotRects: coverHotRects,
  },
};

const ORDER: ResuBirdScreenId[] = ["ats", "bullets", "cover"];

/**
 * Whether a `screen` asset key resolves to a LIVE bespoke ResuBird screen
 * (rendered in-engine via `MockUI`/`ResuBirdShell`) rather than an external
 * still image. The three ResuBird views have NO `.webp`/`.png` asset on disk —
 * they are drawn live — so resolving them to an `<img src>` yields a broken,
 * zero-height image that collapses the hero to an empty browser bar (the blank-
 * hero bug). ProductShot uses this to skip the still and render the live UI.
 * Deterministic string predicate; no I/O.
 */
export const isLiveScreenKey = (key: string | undefined): boolean =>
  !!key &&
  // A `resubird/…` brand-path key, OR a BARE bespoke screen id (`ats` / `bullets`
  // / `cover`). The hero/feature pipeline can hand the ProductShot a bare screen
  // id; without this it failed the `resubird\b` test, fell through to
  // `resolveAsset("ats") → "ats.webp"` (no such still) → a broken `<img>` that
  // collapsed the hero to an empty browser bar (CD R7 P0). Treating the bare ids
  // as live makes `src` resolve to `undefined` → the bespoke screen mounts.
  (/(^|\/)resubird\b/i.test(key) || /^(ats|bullets|cover)$/i.test(key.trim()));

/**
 * Resolve a screen id from a seed. Byte-stable & deterministic.
 *  - `opts.hero` → always `"ats"` (the signature gauge — the ProductShot hero).
 *  - else a seeded pick across the three.
 *
 * NOTE: the old keyword regex (bullet/rewrite → bullets, cover/letter → cover)
 * was REMOVED — it silently collapsed every FeatureBeat onto the ATS gauge
 * whenever the director's caption/asset-key happened not to contain those tokens
 * (the v6 Cerebras script never said "bullet/rewrite"). The FeatureBeat screen is
 * now chosen EXPLICITLY by beat index (`FeatureBeatProps.screen`, assigned in the
 * pipeline) and `screenFor` survives only as a deterministic, distributing
 * FALLBACK for a beat with no explicit screen.
 */
export function screenFor(seed: string, opts?: { hero?: boolean }): ResuBirdScreenId {
  if (opts?.hero) return "ats";
  const idx = Math.floor(seededRandom(`${seed}:screen`)() * 3);
  return ORDER[Math.min(2, Math.max(0, idx))];
}
