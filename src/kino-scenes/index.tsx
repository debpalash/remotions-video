/**
 * `src/kino-scenes` — the 7 Kino scene archetypes, as a render map.
 *
 * The single export the host binds: `KINO_SCENES`, a `Record<SceneName,
 * React.FC<any>>` matching the frozen registry (`src/spec`). Each archetype is a
 * prop-driven, frame-driven React component on the Kino runtime — it reads
 * `useFrame()` (`src/engine`) and `palette()`/motion tokens (`src/design`), and
 * renders the ported `src/promo` look WITHOUT any Remotion import.
 *
 * The keys are exactly the registry's `SceneName`s, in narrative order. The
 * `satisfies` check guarantees every registry component is provided and no stray
 * name sneaks in — the host can `bindComponents(KINO_SCENES)` safely.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4/§5`, `docs/ENGINE_DESIGN.md`.
 */
import type * as React from "react";
import type { SceneName } from "../spec";

import {
  Hook,
  Problem,
  ProductShot,
  FeatureBeat,
  Stats,
  Proof,
  CTA,
} from "./archetypes";

/**
 * The scene render map. `React.FC<any>` per the shared render interface — the
 * host validates props against each scene's Zod schema before render, so the
 * components trust their already-parsed props.
 */
export const KINO_SCENES: Record<SceneName, React.FC<any>> = {
  Hook,
  Problem,
  ProductShot,
  FeatureBeat,
  Stats,
  Proof,
  CTA,
} satisfies Record<SceneName, React.FC<any>>;

export {
  Hook,
  Problem,
  ProductShot,
  FeatureBeat,
  Stats,
  Proof,
  CTA,
} from "./archetypes";

// Re-export the shared kit so the host/storyboard path can compose primitives
// (Backdrop, ScreenFrame, etc.) without reaching into the archetype internals.
export * from "./kit";
