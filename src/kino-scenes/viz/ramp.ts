/**
 * `src/kino-scenes/viz` — count-up ramp + denominator math (shared by all vizzes).
 *
 * The single eased ramp every data-viz rides (the count-up number, the ring
 * sweep, the bar fill) so the digits, the arc, and the bar land in lockstep. A
 * data-viz scene reads as "designed", not "flat", precisely because every moving
 * part settles on the SAME curve — this module is that curve, factored out.
 *
 * DETERMINISM (ENGINE_DESIGN §2): pure functions of `(frame, delay)`. No
 * wall-clock, no random — two renders of the same frame are byte-identical.
 */

/**
 * The eased `0→1` ramp. `easeOutCubic` so it decelerates INTO the target without
 * overshooting past it (a count-up that rings past its value reads as a glitch).
 * `dur` is the ramp length in frames; the count starts `delay` frames in.
 */
export const countUpProgress = (
  frame: number,
  delay: number,
  dur = 50,
): number => {
  const t = Math.min(Math.max((frame - delay) / dur, 0), 1);
  return 1 - Math.pow(1 - t, 3);
};

/**
 * A short, slightly-overshooting "settle" ramp for the value's final tick — a
 * hair of bounce as the number locks, then clamps. Used to drive a tiny scale
 * pop on the digit when it reaches `to` (the odometer "lock" feel), NEVER the
 * value itself (which must stay monotonic via {@link countUpProgress}).
 */
export const lockPop = (frame: number, delay: number, dur = 50): number => {
  const t = Math.min(Math.max((frame - delay) / dur, 0), 1);
  if (t >= 1) return 0;
  // a single damped half-sine that peaks just as the count lands, then to 0
  const w = Math.max(0, 1 - Math.abs(t - 0.92) / 0.12);
  return w * w;
};

/**
 * Choose the denominator a "fill" value (ring arc, bar width) maps against.
 *
 *  - explicit `full` wins (e.g. 100 for a percentage);
 *  - values ≤ 1 are treated as already-normalized fractions;
 *  - otherwise round UP to the next power of ten so e.g. `42 → 100`, `850 → 1000`
 *    — a sensible visual ceiling that keeps the arc/bar from pinning at 100%.
 */
export const fillDenominator = (to: number, full?: number): number => {
  if (full != null) return full;
  if (to <= 1) return 1;
  return Math.pow(10, Math.ceil(Math.log10(to + 1)));
};

/** Format a count-up value with fixed decimals (tabular-nums width-stable). */
export const formatValue = (value: number, decimals: number): string =>
  value.toFixed(decimals);
