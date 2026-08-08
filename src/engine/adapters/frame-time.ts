/**
 * Kino adapters — the single time bridge.
 *
 * Every library adapter (`<Three>`, `<P5>`, `<Anime>`) drives an external clock.
 * To stay frame-pure (ENGINE_DESIGN §2) that clock must be a function of the
 * Kino frame ONLY — never `requestAnimationFrame`, never wall-clock. This module
 * is the one place that converts `useFrame()` into the forms those libraries
 * want, so the conversion is defined once and is trivially auditable.
 *
 * Three forms an external lib ever asks for:
 *  - **frame index** (p5's `frameCount`)            → `frame`
 *  - **seconds since t=0** (three's `clock.elapsed`) → `frame / fps`
 *  - **milliseconds** (anime.js's `.seek(ms)`)      → `frame / fps * 1000`
 *
 * All three are derived from the same `(frame, fps)` so two renders of the same
 * frame produce byte-identical inputs to the library — which, given the library
 * itself is a pure function of that input, yields identical pixels.
 *
 * Pure: no side effects, no globals. Clean-room.
 */

import { useFrame } from "../frame";

/** The frame-derived clock, in every unit an adapter could need. */
export type FrameClock = {
  /** Kino frame index, relative to the nearest enclosing `<Sequence>`. */
  readonly frame: number;
  /** Composition fps. Constant across the render. */
  readonly fps: number;
  /** Seconds since this sequence's frame 0. `frame / fps`. */
  readonly timeSec: number;
  /** Milliseconds since this sequence's frame 0. `frame / fps * 1000`. */
  readonly timeMs: number;
};

/**
 * Convert a `(frame, fps)` pair into the full `FrameClock`. Exported as a pure
 * function (not just a hook) so the determinism proof can exercise the exact
 * math the adapters use without a React tree.
 */
export function frameClock(frame: number, fps: number): FrameClock {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`frameClock requires fps > 0, got ${fps}`);
  }
  const timeSec = frame / fps;
  return {
    frame,
    fps,
    timeSec,
    timeMs: timeSec * 1000,
  };
}

/**
 * Hook form: reads the current Kino frame and returns the derived clock. This is
 * the ONLY clock source an adapter is allowed to read. Using it (instead of the
 * library's own loop) is what makes the adapter deterministic.
 */
export function useFrameClock(): FrameClock {
  const { frame, fps } = useFrame();
  return frameClock(frame, fps);
}
