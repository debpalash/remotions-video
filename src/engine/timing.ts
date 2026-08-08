/**
 * Kino runtime — timing primitives.
 *
 * Pure, deterministic, zero external dependencies. Every value is a function of
 * the frame `t` only (ENGINE_DESIGN §2). No `Date.now`, no `requestAnimationFrame`,
 * no unseeded `Math.random`.
 *
 * Clean-room: the spring is a hand-derived analytic/numeric solution of the
 * damped-harmonic-oscillator ODE; no Remotion source is copied.
 */

export type ExtrapolateType = "extend" | "clamp" | "identity";

export type InterpolateOptions = {
  /** Behaviour left of the first input (and, if `extrapolateRight` unset, right of the last). */
  extrapolateLeft?: ExtrapolateType;
  /** Behaviour right of the last input. */
  extrapolateRight?: ExtrapolateType;
  /** Shorthand: sets both left and right when the per-side options are unset. */
  extrapolate?: ExtrapolateType;
  /** Optional easing applied to the normalized [0,1] progress within a segment. */
  easing?: (t: number) => number;
};

function checkValidInputRange(arr: readonly number[]): void {
  for (let i = 1; i < arr.length; ++i) {
    if (!(arr[i] > arr[i - 1])) {
      throw new Error(
        `inputRange must be strictly monotonically increasing but got [${arr.join(
          ", ",
        )}]`,
      );
    }
  }
}

function findRange(input: number, inputRange: readonly number[]): number {
  // Returns the index `i` such that input lies in [inputRange[i], inputRange[i+1]].
  let i = 1;
  for (; i < inputRange.length - 1; ++i) {
    if (inputRange[i] >= input) {
      break;
    }
  }
  return i - 1;
}

function applyExtrapolate(
  result: number,
  value: number,
  leftEdge: number,
  rightEdge: number,
  outLeft: number,
  outRight: number,
  type: ExtrapolateType,
): number {
  if (type === "identity") {
    return value;
  }
  if (type === "clamp") {
    if (outLeft < outRight) {
      return Math.min(Math.max(result, outLeft), outRight);
    }
    return Math.min(Math.max(result, outRight), outLeft);
  }
  // "extend" -> leave the linearly-extrapolated value as-is.
  void leftEdge;
  void rightEdge;
  return result;
}

/**
 * Maps a value from an input range to an output range, segment-wise linearly.
 *
 * @example interpolate(frame, [0, 30], [0, 1]) // fade-in over 30 frames
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number {
  if (inputRange.length !== outputRange.length) {
    throw new Error(
      `inputRange (${inputRange.length}) and outputRange (${outputRange.length}) must have the same length`,
    );
  }
  if (inputRange.length < 2) {
    throw new Error("inputRange must have at least 2 elements");
  }
  if (Number.isNaN(input)) {
    throw new Error("Cannot interpolate a NaN input value");
  }
  checkValidInputRange(inputRange);

  const easing = options.easing ?? ((t: number) => t);
  const extrapolateLeft: ExtrapolateType =
    options.extrapolateLeft ?? options.extrapolate ?? "extend";
  const extrapolateRight: ExtrapolateType =
    options.extrapolateRight ?? options.extrapolate ?? "extend";

  const i = findRange(input, inputRange);
  const inLeft = inputRange[i];
  const inRight = inputRange[i + 1];
  const outLeft = outputRange[i];
  const outRight = outputRange[i + 1];

  // Normalized progress within the segment, then eased, then mapped to output.
  let progress = (input - inLeft) / (inRight - inLeft);
  progress = easing(progress);
  let result = outLeft + progress * (outRight - outLeft);

  if (input < inputRange[0]) {
    result = applyExtrapolate(
      result,
      input,
      inLeft,
      inRight,
      outLeft,
      outRight,
      extrapolateLeft,
    );
  } else if (input > inputRange[inputRange.length - 1]) {
    result = applyExtrapolate(
      result,
      input,
      inLeft,
      inRight,
      outLeft,
      outRight,
      extrapolateRight,
    );
  }

  return result;
}

export type SpringConfig = {
  /** Resistance. Higher = settles faster with less overshoot. */
  damping: number;
  /** Inertia. Higher = slower, heavier motion. */
  mass: number;
  /** Pull toward `to`. Higher = faster, snappier. */
  stiffness: number;
  /** When true, removes overshoot (critically clamped). Default false. */
  overshootClamping?: boolean;
};

export const DEFAULT_SPRING_CONFIG: Required<SpringConfig> = {
  damping: 18,
  mass: 0.8,
  stiffness: 100,
  overshootClamping: false,
};

export type SpringParams = {
  /** Current frame (relative to the spring's start). */
  frame: number;
  /** Composition fps — converts frames to seconds for the physics. */
  fps: number;
  config?: Partial<SpringConfig>;
  /** Value at frame 0. Default 0. */
  from?: number;
  /** Target value as t -> infinity. Default 1. */
  to?: number;
  /** Delay, in frames, before the spring begins. Default 0. */
  delay?: number;
};

/**
 * Deterministic damped-harmonic-oscillator spring.
 *
 * Analytic closed-form solution of  m·x'' + c·x' + k·x = 0  with x(0)=from-to,
 * x'(0)=0, evaluated at t = frame/fps. Pure function of `frame` — no stepping
 * state, no RNG, no clock — so any frame can be computed in isolation and in
 * parallel, which is exactly what frame-range sharding (ENGINE_DESIGN §4) needs.
 */
export function spring({
  frame,
  fps,
  config = {},
  from = 0,
  to = 1,
  delay = 0,
}: SpringParams): number {
  const damping = config.damping ?? DEFAULT_SPRING_CONFIG.damping;
  const mass = config.mass ?? DEFAULT_SPRING_CONFIG.mass;
  const stiffness = config.stiffness ?? DEFAULT_SPRING_CONFIG.stiffness;
  const overshootClamping =
    config.overshootClamping ?? DEFAULT_SPRING_CONFIG.overshootClamping;

  if (fps <= 0) {
    throw new Error("spring fps must be > 0");
  }
  if (mass <= 0) {
    throw new Error("spring mass must be > 0");
  }

  // Time in seconds since the spring began. Before the delay, hold `from`.
  const t = (frame - delay) / fps;
  if (t <= 0) {
    return from;
  }

  const delta = to - from;
  if (delta === 0) {
    return to;
  }

  // Displacement from equilibrium: x0 starts at -delta, settles to 0.
  const x0 = -delta;
  const v0 = 0; // start from rest

  const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // damping ratio
  const omega0 = Math.sqrt(stiffness / mass); // undamped angular freq

  let position: number;

  if (zeta < 1) {
    // Under-damped (overshoots — the lively, springy case).
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    const A = x0;
    const B = (v0 + zeta * omega0 * x0) / omegaD;
    position =
      envelope * (A * Math.cos(omegaD * t) + B * Math.sin(omegaD * t));
  } else if (zeta === 1) {
    // Critically damped (fastest non-overshooting).
    const envelope = Math.exp(-omega0 * t);
    const A = x0;
    const B = v0 + omega0 * x0;
    position = envelope * (A + B * t);
  } else {
    // Over-damped (slow, no overshoot) — two real roots of the characteristic eqn.
    const disc = Math.sqrt(zeta * zeta - 1);
    const r1 = -omega0 * (zeta - disc);
    const r2 = -omega0 * (zeta + disc);
    const A = (v0 - r2 * x0) / (r1 - r2);
    const B = x0 - A;
    position = A * Math.exp(r1 * t) + B * Math.exp(r2 * t);
  }

  // Convert displacement-from-equilibrium back to absolute value.
  let value = to + position;

  if (overshootClamping) {
    if (to >= from) {
      value = Math.min(value, to);
    } else {
      value = Math.max(value, to);
    }
  }

  return value;
}

/**
 * Frames until a spring is within `threshold` of `to` and stays there.
 * Useful for sizing a Sequence to a settle. Pure and deterministic.
 */
export function measureSpring({
  fps,
  config = {},
  threshold = 0.005,
  from = 0,
  to = 1,
}: {
  fps: number;
  config?: Partial<SpringConfig>;
  threshold?: number;
  from?: number;
  to?: number;
}): number {
  const range = Math.abs(to - from) || 1;
  const maxFrames = fps * 20; // hard cap: 20s
  let settledRun = 0;
  for (let frame = 0; frame <= maxFrames; frame++) {
    const v = spring({ frame, fps, config, from, to });
    if (Math.abs(v - to) / range < threshold) {
      settledRun++;
      if (settledRun >= Math.ceil(fps / 6)) {
        return frame;
      }
    } else {
      settledRun = 0;
    }
  }
  return maxFrames;
}
