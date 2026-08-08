/**
 * `MockUI` — the ResuBird product-UI dispatcher.
 *
 * No longer a generic synthetic dashboard. `MockUI` now renders a REAL ResuBird
 * screen (ATS gauge / bullet rewrite / cover-letter draft) inside the shared
 * `ResuBirdShell` app chrome. Which screen is resolved deterministically from the
 * `seed` via `screenFor`; the `{hero:true}` pin keeps the ProductShot hero on the
 * signature ATS gauge. The shell + nav + stepper are byte-identical across every
 * screen, so the FeatureBeat tour reads as "one product, three features".
 *
 * Same public surface as before: `MockUI: React.FC<{ seed: string; width: number }>`
 * (consumed by `productshot/chrome.tsx` for the hero, and by the FeatureBeat
 * RegionHighlight for each beat).
 *
 * DETERMINISM: every screen is a pure function of `useFrame()`; all semantic data
 * is pinned in the screen modules; `seededRandom(`${seed}:…`)` is used only for
 * cosmetic skeleton widths. No `Math.random`/`Date.now`/rAF, no per-frame
 * backdrop-filter/blur, opaque `surface` fills, palette tokens only.
 */
import * as React from "react";

import { ResuBirdShell } from "./screens/shell";
import { SCREENS, screenFor } from "./screens";

export const MockUI: React.FC<{ seed: string; width: number }> = ({ seed, width }) => {
  const id = screenFor(seed, { hero: true });
  return <ResuBirdShell width={width} screen={SCREENS[id]} seed={seed} />;
};
