/**
 * `<Three>` — deterministic React-Three-Fiber adapter.
 *
 * R3F normally drives animation off `requestAnimationFrame` and exposes
 * `useFrame((state) => …)` whose `state.clock` reads a wall-clock. Both are
 * BANNED here (SAAS_ROADMAP §4 lint-ban; ENGINE_DESIGN §5): under parallel
 * frame-range capture they flicker. This adapter replaces R3F's clock with the
 * Kino frame:
 *
 *   1. `<Canvas frameloop="never">` — R3F never schedules its own rAF render.
 *   2. A `<FrameDriver>` mounted inside the canvas reads `useFrameClock()` (the
 *      Kino frame) and on every render: sets `state.clock.elapsedTime = uTime`,
 *      then calls R3F's `advance(uTime)` to render exactly one frame at that
 *      time. Because the Kino `<FrameProvider>` re-renders the whole tree each
 *      captured frame, this fires once per frame, deterministically.
 *   3. Scene code reads time via the `useThreeTime()` hook (NOT R3F's
 *      `useFrame`) — `uTime = frame / fps`. Same frame → same `uTime` → identical
 *      draw → identical pixels.
 *
 * Raw-three users who don't want the R3F scene-graph can pass `render` instead
 * of `children`: it receives `(uTime, ctx)` and draws imperatively; it is still
 * called via `advance`, so the same determinism guarantee holds.
 *
 * DETERMINISM NOTE
 * ----------------
 * The only time input to anything drawn is `uTime = frame / fps`, supplied by
 * `useFrameClock()` → `useFrame()`. There is no rAF, no `Date.now`, no
 * `clock.getDelta()` accumulation (we SET `elapsedTime`, never advance by an
 * elapsed wall-delta). Two renders of frame N therefore call `advance(N/fps)`
 * with the identical argument and produce identical output. See
 * `__proof__/adapters.proof.ts` (`three`) for the math proof.
 *
 * npm deps (integrator installs): `@react-three/fiber`, `three` — both already
 * in package.json. We deliberately do NOT use `@remotion/three`: this is the
 * Kino engine, which must not depend on Remotion.
 */

import * as React from "react";
import { Canvas, advance, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";

import { useFrameClock } from "./frame-time";

/* -------------------------------------------------------------------------- */
/*  Time context (the sanctioned replacement for R3F's useFrame clock)         */
/* -------------------------------------------------------------------------- */

/** Time handed to scene code inside `<Three>`. All frame-derived. */
export type ThreeTime = {
  /** Seconds since this sequence's frame 0 — feed shader `uTime`, rotations, … */
  readonly uTime: number;
  /** Kino frame index. */
  readonly frame: number;
  /** Composition fps. */
  readonly fps: number;
};

const ThreeTimeContext = React.createContext<ThreeTime | null>(null);
ThreeTimeContext.displayName = "KinoThreeTimeContext";

/**
 * Read the frame-derived time inside a `<Three>` subtree. Use this for any
 * motion (rotation, shader `uTime`, position). It is the ONLY sanctioned clock —
 * R3F's own `useFrame`/`state.clock` is lint-banned.
 */
export function useThreeTime(): ThreeTime {
  const ctx = React.useContext(ThreeTimeContext);
  if (ctx === null) {
    throw new Error(
      "useThreeTime() must be called inside a <Three> adapter subtree.",
    );
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Frame driver — runs inside the Canvas, steps the clock to the Kino frame   */
/* -------------------------------------------------------------------------- */

type FrameDriverProps = {
  /** Optional imperative draw, for raw-three users (no R3F scene graph). */
  readonly onRender?: (uTime: number, state: RootState) => void;
  readonly children?: React.ReactNode;
};

/**
 * Mounted inside `<Canvas frameloop="never">`. On every render it pins R3F's
 * internal clock to the Kino frame and renders exactly one frame at that time.
 *
 * `useLayoutEffect` (not `useEffect`) so the imperative render is flushed before
 * the browser paints the frame the Kino renderer is about to screenshot. With
 * `frameloop="never"`, nothing else ever calls `advance`, so this is the sole
 * render trigger — fully under our control and fully frame-pure.
 */
const FrameDriver: React.FC<FrameDriverProps> = ({ onRender, children }) => {
  const { uTime } = useThreeTime();
  const get = useThree((s) => s.get);

  React.useLayoutEffect(() => {
    const state = get();
    // Pin the clock: SET elapsed time, never accumulate a wall-delta. This is
    // what makes a frame independent of render order (ENGINE_DESIGN §4).
    state.clock.elapsedTime = uTime;
    // Make any legacy `state.clock.getElapsedTime()` agree too.
    state.clock.oldTime = state.clock.startTime;
    // Drive R3F's scene-graph FIRST (renders `children` meshes, or the empty
    // default scene). Then run the imperative `onRender` LAST so an explicit
    // fullscreen draw (e.g. ShaderMesh's gradient quad) is what survives in the
    // framebuffer — otherwise `advance`'s autoClear wipes a pre-draw to black,
    // which is exactly the bug that made shader backgrounds render black.
    advance(uTime, true);
    onRender?.(uTime, state);
  }, [uTime, get, onRender]);

  return <>{children}</>;
};

/* -------------------------------------------------------------------------- */
/*  Public component                                                           */
/* -------------------------------------------------------------------------- */

export type ThreeProps = {
  /**
   * R3F scene graph (meshes, lights, …). Read time inside via `useThreeTime()`,
   * never R3F's `useFrame`.
   */
  readonly children?: React.ReactNode;
  /**
   * Raw-three escape hatch: draw imperatively each frame with `(uTime, state)`.
   * Runs in addition to `children`; use one or the other in practice.
   */
  readonly render?: (uTime: number, state: RootState) => void;
  /** Forwarded to R3F `<Canvas>` (camera, gl flags, style…). `frameloop` is forced. */
  readonly canvasProps?: Omit<
    React.ComponentProps<typeof Canvas>,
    "frameloop" | "children"
  >;
  /** Canvas pixel ratio. Fixed (default 1) so output is resolution-stable. */
  readonly dpr?: number;
  readonly style?: React.CSSProperties;
};

/**
 * Deterministic R3F surface. Renders one three.js frame per Kino frame at
 * `uTime = frame / fps`, with R3F's own animation loop disabled.
 */
export const Three: React.FC<ThreeProps> = ({
  children,
  render,
  canvasProps,
  dpr = 1,
  style,
}) => {
  const { frame, fps, timeSec } = useFrameClock();

  // Stable per-frame time value handed to scene code via context.
  const time = React.useMemo<ThreeTime>(
    () => ({ uTime: timeSec, frame, fps }),
    [timeSec, frame, fps],
  );

  return (
    <ThreeTimeContext.Provider value={time}>
      <Canvas
        // CRITICAL: never let R3F schedule its own rAF render loop.
        frameloop="never"
        dpr={dpr}
        style={{ width: "100%", height: "100%", ...style }}
        {...canvasProps}
      >
        <FrameDriver onRender={render}>{children}</FrameDriver>
      </Canvas>
    </ThreeTimeContext.Provider>
  );
};
