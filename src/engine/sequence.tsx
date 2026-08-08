/**
 * Kino runtime — sequencing.
 *
 * `<Sequence>` offsets the child frame and bounds its visibility window;
 * `<Series>` / `<Series.Sequence>` stacks children back-to-back, computing
 * each offset from the running cursor. All time stays a pure function of the
 * root frame (ENGINE_DESIGN §2) — nesting just shifts the origin.
 *
 * Clean-room: re-implements the offset-the-frame concept; copies no Remotion source.
 */

import * as React from "react";
import { Children, isValidElement } from "react";
import { FrameProvider, useFrame } from "./frame";

export type SequenceProps = {
  /** Frame (in the parent timeline) at which this sequence's frame 0 begins. */
  from?: number;
  /** Length of this sequence in frames. `Infinity` keeps it mounted forever. */
  durationInFrames?: number;
  /**
   * When false (default), children unmount outside [from, from+duration).
   * When true, children stay mounted and just receive an out-of-range frame.
   */
  layout?: "absolute" | "none";
  children?: React.ReactNode;
};

/**
 * Shifts the frame so children see `parentFrame - from` and clips the mount
 * window to `[from, from + durationInFrames)`. Reads the *parent* duration from
 * context so a bare `<Sequence>` without `durationInFrames` inherits it.
 */
export const Sequence: React.FC<SequenceProps> = ({
  from = 0,
  durationInFrames = Infinity,
  layout = "none",
  children,
}) => {
  const parent = useFrame();

  if (durationInFrames < 0) {
    throw new Error(
      `Sequence durationInFrames must be >= 0, got ${durationInFrames}`,
    );
  }

  const localFrame = parent.frame - from;
  const localDuration = Number.isFinite(durationInFrames)
    ? durationInFrames
    : parent.durationInFrames;

  // Outside the active window: do not render children (saves work + prevents
  // a clipped scene from painting). `layout: "none"` only affects mount window.
  const active = localFrame >= 0 && localFrame < durationInFrames;
  if (!active) {
    return null;
  }

  void layout;

  return (
    <FrameProvider
      frame={localFrame}
      fps={parent.fps}
      durationInFrames={localDuration}
    >
      {children}
    </FrameProvider>
  );
};

export type SeriesSequenceProps = {
  /** Length of this segment in frames. Required — drives the running cursor. */
  durationInFrames: number;
  /** Frames to overlap with the *previous* sequence (transition overlap). */
  offset?: number;
  children?: React.ReactNode;
};

/**
 * Marker component. Carries timing only; `<Series>` reads its props to compute
 * the absolute `from`. Rendering it directly is a misuse and throws.
 */
const SeriesSequence: React.FC<SeriesSequenceProps> = () => {
  throw new Error(
    "<Series.Sequence> must be a direct child of <Series>, not rendered alone.",
  );
};

export type SeriesProps = {
  children?: React.ReactNode;
};

type SeriesType = React.FC<SeriesProps> & {
  Sequence: React.FC<SeriesSequenceProps>;
};

/**
 * Stacks `<Series.Sequence>` children sequentially. Each child's `from` is the
 * running sum of prior durations, minus any per-child `offset` (used to overlap
 * neighbours for transitions). Children may use the full `<Sequence>` feature
 * set because each is wrapped in one.
 */
const SeriesImpl: React.FC<SeriesProps> = ({ children }) => {
  let cursor = 0;
  const wrapped: React.ReactNode[] = [];

  Children.forEach(children, (child, index) => {
    if (child === null || child === undefined || child === false) {
      return;
    }
    if (!isValidElement(child) || child.type !== SeriesSequence) {
      throw new Error(
        "<Series> only accepts <Series.Sequence> children (or falsy slots).",
      );
    }

    const props = child.props as SeriesSequenceProps;
    const { durationInFrames, offset = 0, children: inner } = props;

    if (
      typeof durationInFrames !== "number" ||
      !Number.isFinite(durationInFrames) ||
      durationInFrames < 0
    ) {
      throw new Error(
        `<Series.Sequence> #${index} needs a finite durationInFrames >= 0, got ${durationInFrames}`,
      );
    }

    const from = cursor - offset;
    wrapped.push(
      <Sequence
        key={child.key ?? index}
        from={from}
        durationInFrames={durationInFrames}
      >
        {inner}
      </Sequence>,
    );

    // Advance the cursor by this segment's net contribution to the timeline.
    cursor = from + durationInFrames;
  });

  return <>{wrapped}</>;
};

export const Series = SeriesImpl as SeriesType;
Series.Sequence = SeriesSequence;

/**
 * Total frame length of a `<Series>`'s children, accounting for offsets.
 * Pure helper for `calculateMetadata` — mirrors the cursor math above.
 */
export function measureSeries(
  segments: ReadonlyArray<{ durationInFrames: number; offset?: number }>,
): number {
  let cursor = 0;
  for (const seg of segments) {
    const from = cursor - (seg.offset ?? 0);
    cursor = from + seg.durationInFrames;
  }
  return Math.max(0, cursor);
}
