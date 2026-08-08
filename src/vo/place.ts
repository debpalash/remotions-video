// Pure auto-placer: measured VO durations → per-scene frame counts + cursors.
//
// Mirrors the calculateMetadata math in SAAS_ROADMAP.md §5:
//   durationInFrames = max(minFrames, ceil(voSeconds * fps) + pad)
//   cursor advances by (dur - T) so adjacent scenes overlap by the transition T.
// A scene without VO falls back to its `minFrames` floor (e.g. a logo beat).
//
// Strictly a pure function of its inputs — no IO, no clock, no randomness — so
// it is trivially unit-testable and deterministic.

export interface PlaceSceneInput {
  /** Scene id (carried through for the caller's convenience). */
  id: string;
  /** Floor on duration; used directly when there is no VO. */
  minFrames: number;
  /**
   * Measured VO duration in seconds. `undefined`/`null` => no VO => use minFrames.
   */
  voSeconds?: number | null;
}

export interface PlaceOptions {
  /** Frames per second. Default 30 (repo convention). */
  fps?: number;
  /**
   * Transition overlap T in frames. Adjacent scenes overlap by T, so the cursor
   * advances by (dur - T). Default 15 (schema default).
   */
  overlap?: number;
  /**
   * Extra frames appended after each VO clause so audio doesn't butt the cut.
   * Default 6.
   */
  pad?: number;
}

export interface PlacedScene {
  id: string;
  /** Frame at which this scene's Sequence starts. */
  from: number;
  /** This scene's length in frames. */
  durationInFrames: number;
}

export interface PlacementResult {
  scenes: PlacedScene[];
  /**
   * Total composition length in frames:
   *   sum(durations) - T * (n - 1)
   * i.e. the cursor of the last scene plus that scene's full duration.
   */
  totalFrames: number;
}

/**
 * Compute frame layout for a list of scenes.
 *
 * @throws if fps/overlap/pad are out of range, or overlap >= any scene duration
 *   (which would make the running cursor non-monotonic / scenes vanish).
 */
export function placeScenes(
  scenes: readonly PlaceSceneInput[],
  opts: PlaceOptions = {},
): PlacementResult {
  const fps = opts.fps ?? 30;
  const overlap = opts.overlap ?? 15;
  const pad = opts.pad ?? 6;

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`placeScenes: fps must be > 0, got ${fps}`);
  }
  if (!Number.isInteger(overlap) || overlap < 0) {
    throw new RangeError(`placeScenes: overlap must be a non-negative integer, got ${overlap}`);
  }
  if (!Number.isInteger(pad) || pad < 0) {
    throw new RangeError(`placeScenes: pad must be a non-negative integer, got ${pad}`);
  }

  const placed: PlacedScene[] = [];
  let cursor = 0;

  for (const s of scenes) {
    if (!Number.isInteger(s.minFrames) || s.minFrames <= 0) {
      throw new RangeError(
        `placeScenes: scene "${s.id}" minFrames must be a positive integer, got ${s.minFrames}`,
      );
    }

    let durationInFrames: number;
    if (s.voSeconds == null) {
      durationInFrames = s.minFrames;
    } else {
      if (!Number.isFinite(s.voSeconds) || s.voSeconds < 0) {
        throw new RangeError(
          `placeScenes: scene "${s.id}" voSeconds must be a finite, non-negative number, got ${s.voSeconds}`,
        );
      }
      durationInFrames = Math.max(s.minFrames, Math.ceil(s.voSeconds * fps) + pad);
    }

    // The cursor advance subtracts T, so a scene shorter than the overlap would
    // make the next `from` regress — reject rather than emit a broken layout.
    if (overlap >= durationInFrames) {
      throw new RangeError(
        `placeScenes: scene "${s.id}" duration ${durationInFrames} must exceed overlap ${overlap}`,
      );
    }

    placed.push({ id: s.id, from: cursor, durationInFrames });
    cursor += durationInFrames - overlap;
  }

  // total = last cursor + last full duration; for n scenes this equals
  // sum(durations) - overlap*(n-1). Zero scenes => zero frames.
  const totalFrames =
    placed.length === 0
      ? 0
      : placed[placed.length - 1].from + placed[placed.length - 1].durationInFrames;

  return { scenes: placed, totalFrames };
}
