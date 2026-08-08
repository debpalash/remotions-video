/**
 * Kino runtime — frame context.
 *
 * One source of time for the whole render tree. Every scene reads `frame`
 * through `useFrame()`; nothing reads a wall-clock. This is the entire
 * correctness model (ENGINE_DESIGN §2): same `frame` -> same pixels.
 *
 * Clean-room: studies the concept of a current-frame context but copies no
 * Remotion source.
 */

import * as React from "react";
import { createContext, useContext, useMemo } from "react";

export type FrameState = {
  /** Current frame index, relative to the nearest enclosing Sequence. */
  readonly frame: number;
  /** Frames per second for the composition. Constant across the render. */
  readonly fps: number;
  /** Total duration, in frames, of the current Sequence (or composition). */
  readonly durationInFrames: number;
};

const FrameContext = createContext<FrameState | null>(null);
FrameContext.displayName = "KinoFrameContext";

export type FrameProviderProps = FrameState & {
  readonly children: React.ReactNode;
};

/**
 * Provides the current frame to the subtree. The renderer mounts one of these
 * at the root for each frame `t` it captures; `<Sequence>` nests further
 * providers that offset the frame for their children.
 */
export const FrameProvider: React.FC<FrameProviderProps> = ({
  frame,
  fps,
  durationInFrames,
  children,
}) => {
  const value = useMemo<FrameState>(
    () => ({ frame, fps, durationInFrames }),
    [frame, fps, durationInFrames],
  );
  return (
    <FrameContext.Provider value={value}>{children}</FrameContext.Provider>
  );
};

/**
 * Reads the current frame state. Throws when called outside a `FrameProvider`
 * so a missing provider fails loudly at render time instead of silently
 * producing frame 0.
 */
export function useFrame(): FrameState {
  const ctx = useContext(FrameContext);
  if (ctx === null) {
    throw new Error(
      "useFrame() must be called inside a <FrameProvider>. " +
        "The Kino renderer mounts one per captured frame.",
    );
  }
  return ctx;
}

/**
 * Convenience selector for the common case of only needing the frame index.
 * Mirrors the spec's `useCurrentFrame()` ergonomics without a second context.
 */
export function useCurrentFrame(): number {
  return useFrame().frame;
}

/** Internal: exposed so `Sequence`/`Series` can read the parent state. */
export const __FrameContext = FrameContext;
