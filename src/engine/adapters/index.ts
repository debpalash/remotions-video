/**
 * Kino engine — deterministic library adapters.
 *
 * Lets art-studio scenes use 3D / generative / timeline libraries while staying
 * frame-pure (ENGINE_DESIGN §3 "E3 — Library adapters", §5 determinism sandbox).
 * Every adapter reads `useFrame()` from the Kino runtime and drives its library's
 * clock from the Kino frame ONLY — never `requestAnimationFrame`, never
 * `Date.now`, never the library's own animation loop:
 *
 *   - `<Three>`  — R3F with `frameloop="never"`; `advance(uTime)` at `uTime =
 *                  frame/fps`. Read time via `useThreeTime()`, not R3F `useFrame`.
 *   - `<P5>`     — p5 instance mode with `noLoop()`; `redraw()` once per frame;
 *                  the sketch reads the Kino frame from `ctx`, not `p.frameCount`.
 *   - `<Anime>`  — anime.js with `autoplay:false`; `.seek(frame/fps*1000)`.
 *
 * Determinism proof (two renders of the same frame match, render-order
 * independent): `./__proof__/adapters.proof.ts` — pure, runnable without the
 * 3D/generative packages installed.
 *
 * npm deps the integrator must install (NOT added to package.json by this
 * module): `p5`, `@types/p5`, `animejs`, `@types/animejs`. (`@react-three/fiber`
 * and `three` are already present.) The p5/anime modules are *injected* at the
 * call site (passed as props) so this engine code carries no hard import of an
 * uninstalled package.
 */

export {
  frameClock,
  useFrameClock,
  type FrameClock,
} from "./frame-time";

export {
  Three,
  useThreeTime,
  type ThreeProps,
  type ThreeTime,
} from "./Three";

export {
  P5,
  type P5Props,
  type P5Instance,
} from "./P5";

export {
  Anime,
  type AnimeProps,
  type AnimeInstance,
  type AnimeParams,
  type AnimeFactory,
} from "./Anime";
