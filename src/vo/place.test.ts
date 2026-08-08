// Unit tests for the pure auto-placer. Run with:
//   node --import tsx --test src/vo/place.test.ts
// (or any TS-aware node test runner). No network / no ffmpeg needed.

import assert from "node:assert/strict";
import { test } from "node:test";
import { placeScenes } from "./place";

test("derives durations from VO, floors at minFrames, applies pad", () => {
  const { scenes } = placeScenes(
    [
      { id: "a", minFrames: 45, voSeconds: 2.0 }, // ceil(60)+6 = 66 > 45
      { id: "b", minFrames: 90, voSeconds: 1.0 }, // ceil(30)+6 = 36 -> floor 90
    ],
    { fps: 30, overlap: 15, pad: 6 },
  );
  assert.equal(scenes[0].durationInFrames, 66);
  assert.equal(scenes[1].durationInFrames, 90);
});

test("no-VO scene uses minFrames exactly", () => {
  const { scenes } = placeScenes([{ id: "logo", minFrames: 90 }], {});
  assert.equal(scenes[0].durationInFrames, 90);
});

test("cursor advances by dur - overlap; first scene starts at 0", () => {
  const { scenes } = placeScenes(
    [
      { id: "a", minFrames: 100 },
      { id: "b", minFrames: 100 },
      { id: "c", minFrames: 100 },
    ],
    { overlap: 15 },
  );
  assert.deepEqual(
    scenes.map((s) => s.from),
    [0, 85, 170],
  );
});

test("totalFrames == sum(durations) - overlap*(n-1)", () => {
  const inputs = [
    { id: "a", minFrames: 100 },
    { id: "b", minFrames: 120 },
    { id: "c", minFrames: 80 },
  ];
  const overlap = 15;
  const { totalFrames } = placeScenes(inputs, { overlap });
  const sum = 100 + 120 + 80;
  assert.equal(totalFrames, sum - overlap * (inputs.length - 1));
});

test("zero overlap => contiguous, no overlap", () => {
  const { scenes, totalFrames } = placeScenes(
    [
      { id: "a", minFrames: 50 },
      { id: "b", minFrames: 60 },
    ],
    { overlap: 0 },
  );
  assert.deepEqual(scenes.map((s) => s.from), [0, 50]);
  assert.equal(totalFrames, 110);
});

test("empty input => zero scenes, zero frames", () => {
  const r = placeScenes([], {});
  assert.deepEqual(r.scenes, []);
  assert.equal(r.totalFrames, 0);
});

test("ceil applied to fractional VO frames", () => {
  // 2.01s * 30 = 60.3 -> ceil 61, +pad 6 = 67
  const { scenes } = placeScenes([{ id: "a", minFrames: 10, voSeconds: 2.01 }], {
    fps: 30,
    pad: 6,
  });
  assert.equal(scenes[0].durationInFrames, 67);
});

test("rejects overlap >= scene duration", () => {
  assert.throws(
    () => placeScenes([{ id: "a", minFrames: 10 }], { overlap: 15 }),
    /must exceed overlap/,
  );
});

test("rejects bad minFrames / voSeconds / fps", () => {
  assert.throws(() => placeScenes([{ id: "a", minFrames: 0 }], {}), /minFrames/);
  assert.throws(
    () => placeScenes([{ id: "a", minFrames: 50, voSeconds: -1 }], {}),
    /voSeconds/,
  );
  assert.throws(() => placeScenes([{ id: "a", minFrames: 50 }], { fps: 0 }), /fps/);
});

test("is pure: same input -> identical output", () => {
  const inputs = [
    { id: "a", minFrames: 45, voSeconds: 1.7 },
    { id: "b", minFrames: 90, voSeconds: 3.2 },
  ];
  const r1 = placeScenes(inputs, { fps: 30, overlap: 12, pad: 4 });
  const r2 = placeScenes(inputs, { fps: 30, overlap: 12, pad: 4 });
  assert.deepEqual(r1, r2);
});
