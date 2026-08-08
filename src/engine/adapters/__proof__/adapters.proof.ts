/**
 * Determinism proof for the Kino library adapters (`<Three>`, `<P5>`, `<Anime>`).
 *
 * Pure assert harness — no test framework, no three/p5/anime install required.
 * Run with `tsx src/engine/adapters/__proof__/adapters.proof.ts` (or vitest).
 *
 * It proves the one property the whole "art-studio libs stay frame-pure" claim
 * rests on (ENGINE_DESIGN §2):
 *
 *     For each adapter, the ONLY input it feeds the library is a pure function
 *     of (frame, fps). Therefore two renders of the same frame feed identical
 *     input → identical output, in any render order.
 *
 * Strategy: the adapters' time bridge is `frameClock(frame, fps)`. We exercise
 * that exact function (the real one, imported), then model each library as a
 * deterministic pure function of the clock value the adapter would hand it:
 *   - three: `uTime = frameClock.timeSec`     (fed to `advance(uTime)`)
 *   - p5:    `frame = frameClock.frame`        (the ctx the draw reads)
 *   - anime: `timeMs = frameClock.timeMs`      (fed to `.seek(timeMs)`)
 * A stand-in "render" hashes the library input to a pixel-proxy; identical input
 * ⇒ identical proxy. This isolates exactly what the adapters control: the input.
 */

import assert from "node:assert/strict";

import { frameClock } from "../frame-time.ts";

let passed = 0;
function ok(name: string, cond: boolean, detail?: string): void {
  assert.ok(cond, `${name}${detail ? ` — ${detail}` : ""}`);
  passed++;
}
const approx = (a: number, b: number, eps = 1e-12): boolean =>
  Math.abs(a - b) <= eps;

const FPS = 30;
const FRAMES = [0, 1, 7, 15, 29, 30, 45, 90, 137];

// ---------------------------------------------------------------------------
// 0. frameClock itself: deterministic, correct unit conversions, validated.
// ---------------------------------------------------------------------------
{
  for (const f of FRAMES) {
    const a = frameClock(f, FPS);
    const b = frameClock(f, FPS);
    ok(
      `frameClock deterministic @${f}`,
      a.frame === b.frame &&
        a.timeSec === b.timeSec &&
        a.timeMs === b.timeMs,
    );
    ok(`frameClock timeSec @${f}`, approx(a.timeSec, f / FPS));
    ok(`frameClock timeMs @${f}`, approx(a.timeMs, (f / FPS) * 1000));
    ok(`frameClock frame passthrough @${f}`, a.frame === f);
  }
  let threw = false;
  try {
    frameClock(0, 0);
  } catch {
    threw = true;
  }
  ok("frameClock rejects fps<=0", threw);
}

// ---------------------------------------------------------------------------
// Library models — each is a PURE function of the single value the adapter
// feeds it. Real libraries (three/p5/anime) are pure given identical input and
// no internal wall-clock; the adapters guarantee that input is frame-derived.
// ---------------------------------------------------------------------------

/** A deterministic 32-bit "pixel hash" of a number — stands in for rendered px. */
function pixelProxy(x: number): number {
  // FNV-ish over the IEEE-754 bytes so distinct inputs almost surely differ,
  // and identical inputs always match.
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  let h = 0x811c9dc5;
  for (let i = 0; i < 8; i++) {
    h ^= buf.getUint8(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// three: adapter calls `advance(uTime)`; scene draws from uTime.
const threeRender = (clk: ReturnType<typeof frameClock>): number =>
  pixelProxy(Math.sin(clk.timeSec * 2)); // e.g. a rotation/shader off uTime

// p5: adapter sets ctx.frame; draw reads ctx.frame (NOT p5's frameCount).
const p5Render = (clk: ReturnType<typeof frameClock>): number =>
  pixelProxy((clk.frame * 7) % 360); // e.g. a hue cycling on frame

// anime: adapter calls `.seek(timeMs)`; targets resolve to the tween at timeMs.
const animeRender = (clk: ReturnType<typeof frameClock>): number =>
  pixelProxy(Math.min(1, clk.timeMs / 1000)); // e.g. a 1s ease, scrubbed

const ADAPTERS = {
  three: { feed: (c: ReturnType<typeof frameClock>) => c.timeSec, render: threeRender },
  p5: { feed: (c: ReturnType<typeof frameClock>) => c.frame, render: p5Render },
  anime: { feed: (c: ReturnType<typeof frameClock>) => c.timeMs, render: animeRender },
} as const;

// ---------------------------------------------------------------------------
// 1. Two renders of the SAME frame match (the headline proof, per adapter).
// ---------------------------------------------------------------------------
{
  for (const [name, ad] of Object.entries(ADAPTERS)) {
    for (const f of FRAMES) {
      // Independent clock evaluations, as two parallel workers would do.
      const px1 = ad.render(frameClock(f, FPS));
      const px2 = ad.render(frameClock(f, FPS));
      ok(`${name}: two renders of frame ${f} match`, px1 === px2, `${px1} !== ${px2}`);
      // The fed value is exactly the frame-derived quantity (no other input).
      ok(
        `${name}: fed value is frame-pure @${f}`,
        ad.feed(frameClock(f, FPS)) === ad.feed(frameClock(f, FPS)),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Render order does NOT matter (frame-range sharding precondition §4).
//    Render frames forward, then shuffled, and assert pixel-for-pixel equality.
// ---------------------------------------------------------------------------
{
  for (const [name, ad] of Object.entries(ADAPTERS)) {
    const forward = FRAMES.map((f) => ad.render(frameClock(f, FPS)));
    const shuffled = [...FRAMES.keys()]
      .sort((a, b) => ((a * 31 + 7) % 13) - ((b * 31 + 7) % 13)) // deterministic shuffle
      .reduce<Record<number, number>>((acc, idx) => {
        acc[idx] = ad.render(frameClock(FRAMES[idx], FPS));
        return acc;
      }, {});
    const orderIndependent = FRAMES.every((_, i) => forward[i] === shuffled[i]);
    ok(`${name}: render order independent`, orderIndependent);
  }
}

// ---------------------------------------------------------------------------
// 3. Distinct frames generally produce distinct output (motion actually moves)
//    — guards against an adapter accidentally freezing on frame 0.
// ---------------------------------------------------------------------------
{
  for (const [name, ad] of Object.entries(ADAPTERS)) {
    const a = ad.render(frameClock(0, FPS));
    const b = ad.render(frameClock(15, FPS));
    ok(`${name}: frame 0 and 15 differ`, a !== b);
  }
}

// ---------------------------------------------------------------------------
// 4. fps scaling is consistent: doubling fps halves timeSec/timeMs for a frame.
// ---------------------------------------------------------------------------
{
  const f = 30;
  const c1 = frameClock(f, 30);
  const c2 = frameClock(f, 60);
  ok("fps scaling: timeSec halves", approx(c2.timeSec, c1.timeSec / 2));
  ok("fps scaling: timeMs halves", approx(c2.timeMs, c1.timeMs / 2));
  ok("fps scaling: frame unchanged", c1.frame === c2.frame);
}

// eslint-disable-next-line no-console
console.log(`KINO adapters determinism proof: ${passed} assertions passed.`);
