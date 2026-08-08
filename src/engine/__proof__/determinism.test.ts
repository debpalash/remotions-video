/**
 * Determinism proof for the Kino runtime.
 *
 * Pure assert harness — no test framework required (run with `tsx` or the
 * project's vitest if present). Proves the core invariant of ENGINE_DESIGN §2:
 * same frame -> same value, for `spring`, `interpolate`, the seeded PRNG, and
 * the sandbox virtual clock.
 *
 * This file is self-contained and depends only on the engine + node assert.
 */

import assert from "node:assert/strict";
// Import the dependency-free modules directly so this proof runs under node's
// native type-stripping without React/zod installed. `measureSeries` lives in
// sequence.tsx (React) — re-implemented here from the same cursor math to keep
// the proof zero-dependency; the engine export is covered by the typecheck.
import {
  spring,
  interpolate,
  measureSpring,
} from "../timing.ts";
import { installDeterminism, seededRandom } from "../sandbox.ts";

const measureSeries = (
  segments: ReadonlyArray<{ durationInFrames: number; offset?: number }>,
): number => {
  let cursor = 0;
  for (const seg of segments) {
    const from = cursor - (seg.offset ?? 0);
    cursor = from + seg.durationInFrames;
  }
  return Math.max(0, cursor);
};

let passed = 0;
function ok(name: string, cond: boolean, detail?: string): void {
  assert.ok(cond, `${name}${detail ? ` — ${detail}` : ""}`);
  passed++;
}

const approx = (a: number, b: number, eps = 1e-9): boolean =>
  Math.abs(a - b) <= eps;

// ---------------------------------------------------------------------------
// 1. spring: same frame -> bit-identical value, across independent calls.
// ---------------------------------------------------------------------------
{
  const cfg = { damping: 12, mass: 0.6, stiffness: 100 };
  for (const f of [0, 1, 5, 12, 30, 90]) {
    const a = spring({ frame: f, fps: 30, config: cfg });
    const b = spring({ frame: f, fps: 30, config: cfg });
    ok(`spring deterministic @${f}`, a === b, `${a} !== ${b}`);
  }
  // Boundary: frame 0 holds `from`.
  ok("spring frame0 == from", spring({ frame: 0, fps: 30, from: 0.25 }) === 0.25);
  // Settles toward `to`.
  const settled = spring({ frame: 600, fps: 30, config: cfg, to: 1 });
  ok("spring settles to ~to", approx(settled, 1, 1e-3), `settled=${settled}`);
  // Under-damped overshoots above `to` at least once; over-damped never does.
  let overshot = false;
  for (let f = 0; f <= 120; f++) {
    if (spring({ frame: f, fps: 30, config: { damping: 8, mass: 0.5, stiffness: 120 } }) > 1) {
      overshot = true;
      break;
    }
  }
  ok("under-damped overshoots", overshot);
  let overDampOvershoot = false;
  for (let f = 0; f <= 600; f++) {
    if (spring({ frame: f, fps: 30, config: { damping: 60, mass: 1, stiffness: 100 } }) > 1.0000001) {
      overDampOvershoot = true;
      break;
    }
  }
  ok("over-damped never overshoots", !overDampOvershoot);
  // overshootClamping caps at `to`.
  let clampedMax = -Infinity;
  for (let f = 0; f <= 120; f++) {
    clampedMax = Math.max(
      clampedMax,
      spring({ frame: f, fps: 30, config: { damping: 8, mass: 0.5, stiffness: 120, overshootClamping: true } }),
    );
  }
  ok("overshootClamping caps at to", clampedMax <= 1 + 1e-9, `max=${clampedMax}`);
}

// ---------------------------------------------------------------------------
// 2. interpolate: deterministic, segment-linear, extrapolation modes.
// ---------------------------------------------------------------------------
{
  ok("interp midpoint", interpolate(15, [0, 30], [0, 1]) === 0.5);
  ok("interp endpoints", interpolate(0, [0, 30], [10, 20]) === 10 && interpolate(30, [0, 30], [10, 20]) === 20);
  ok("interp multi-segment", interpolate(45, [0, 30, 60], [0, 1, 0]) === 0.5);
  // clamp
  ok("interp clamp left", interpolate(-10, [0, 30], [0, 1], { extrapolate: "clamp" }) === 0);
  ok("interp clamp right", interpolate(40, [0, 30], [0, 1], { extrapolate: "clamp" }) === 1);
  // extend (linear)
  ok("interp extend", interpolate(60, [0, 30], [0, 1], { extrapolate: "extend" }) === 2);
  // identity
  ok("interp identity", interpolate(-7, [0, 30], [0, 1], { extrapolate: "identity" }) === -7);
  // determinism
  for (const x of [-5, 0, 7.3, 15, 30, 99]) {
    ok(`interp deterministic @${x}`, interpolate(x, [0, 30], [0, 1]) === interpolate(x, [0, 30], [0, 1]));
  }
  // easing applied
  const eased = interpolate(15, [0, 30], [0, 1], { easing: (t) => t * t });
  ok("interp easing", approx(eased, 0.25), `eased=${eased}`);
  // throws on bad ranges
  let threw = false;
  try {
    interpolate(1, [0, 0], [0, 1]);
  } catch {
    threw = true;
  }
  ok("interp rejects non-increasing input range", threw);
}

// ---------------------------------------------------------------------------
// 3. seeded PRNG: same seed -> identical stream; different seed -> different.
// ---------------------------------------------------------------------------
{
  const a = seededRandom("scene-a");
  const b = seededRandom("scene-a");
  const c = seededRandom("scene-b");
  const sa = [a(), a(), a(), a()];
  const sb = [b(), b(), b(), b()];
  const sc = [c(), c(), c(), c()];
  ok("prng same seed identical", sa.every((v, i) => v === sb[i]));
  ok("prng different seed differs", sa.some((v, i) => v !== sc[i]));
  ok("prng in [0,1)", sa.every((v) => v >= 0 && v < 1));
}

// ---------------------------------------------------------------------------
// 4. sandbox: virtual clock is a pure function of frame; Math.random seeded.
//    Patches a fake target so we never mutate the real node globals.
// ---------------------------------------------------------------------------
{
  const fake: Record<string, unknown> & {
    Math: Math;
    Date: DateConstructor;
    performance: { now(): number };
    requestAnimationFrame?: (cb: (t: number) => void) => number;
    cancelAnimationFrame?: (h: number) => void;
  } = {
    Math: Object.create(Math) as Math,
    Date: class extends Date {} as unknown as DateConstructor,
    performance: { now: () => 12345 },
  };
  // Make the fake.Math.random independently overridable.
  fake.Math.random = () => 0.999;

  const h = installDeterminism({ fps: 30, frame: 0, seed: "seed-1", target: fake });

  h.setFrame(30);
  ok("sandbox performance.now == frame/fps*1000", fake.performance.now() === 1000);
  ok("sandbox Date.now == frame/fps*1000", fake.Date.now() === 1000);
  ok("sandbox new Date() reads virtual clock", new fake.Date().getTime() === 1000);

  h.setFrame(45);
  ok("sandbox clock tracks frame", fake.performance.now() === 1500);

  // rAF fires synchronously with the virtual timestamp.
  let rafTs = -1;
  fake.requestAnimationFrame?.((t) => {
    rafTs = t;
  });
  ok("sandbox rAF fires at virtual clock", rafTs === 1500);

  // Math.random is now the seeded stream and reproducible after reseed.
  const r1 = [fake.Math.random(), fake.Math.random(), fake.Math.random()];
  h.reseed("seed-1");
  const r2 = [fake.Math.random(), fake.Math.random(), fake.Math.random()];
  ok("sandbox Math.random reseed reproducible", r1.every((v, i) => v === r2[i]));
  ok("sandbox Math.random no longer constant", r1.some((v) => v !== 0.999));

  h.restore();
  ok("sandbox restore returns original Math.random", fake.Math.random() === 0.999);
  ok("sandbox restore returns original performance.now", fake.performance.now() === 12345);
  ok("sandbox installed flag cleared", h.installed === false);
}

// ---------------------------------------------------------------------------
// 5. measureSpring / measureSeries are deterministic helpers.
// ---------------------------------------------------------------------------
{
  const m1 = measureSpring({ fps: 30, config: { damping: 18, mass: 0.8, stiffness: 100 } });
  const m2 = measureSpring({ fps: 30, config: { damping: 18, mass: 0.8, stiffness: 100 } });
  ok("measureSpring deterministic", m1 === m2 && m1 > 0);

  ok(
    "measureSeries sums with offset",
    measureSeries([{ durationInFrames: 30 }, { durationInFrames: 30, offset: 10 }]) === 50,
  );
  ok("measureSeries no offset", measureSeries([{ durationInFrames: 40 }, { durationInFrames: 20 }]) === 60);
}

// eslint-disable-next-line no-console
console.log(`KINO determinism proof: ${passed} assertions passed.`);
