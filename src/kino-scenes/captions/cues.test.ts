/**
 * Caption-cue unit checks. Pure logic, no browser/ffmpeg:
 *   node --import tsx --test src/kino-scenes/captions/cues.test.ts
 *
 * Asserts the properties the burned-in band + the `.vtt` sidecar both rely on:
 *  - chunking respects the word/char caps and prefers clause boundaries;
 *  - a scene's cues TILE its window with no gaps and no overlap (determinism);
 *  - cues are pure (same input → byte-identical output);
 *  - the active-cue lookup is correct at boundaries;
 *  - WebVTT serialisation is well-formed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chunkLine,
  buildSceneCues,
  buildCaptionTrack,
  activeCue,
  frameToVttTime,
  trackToVtt,
  type CaptionSceneInput,
} from "./cues";

test("chunkLine respects the word cap", () => {
  const cues = chunkLine("one two three four five six seven eight nine ten", 7, 200);
  for (const c of cues) {
    assert.ok(c.split(" ").length <= 7, `cue over word cap: "${c}"`);
  }
  assert.equal(cues.join(" "), "one two three four five six seven eight nine ten");
});

test("chunkLine respects the char cap", () => {
  const cues = chunkLine(
    "supercalifragilistic expialidocious antidisestablishmentarianism floccinaucinihilipilification",
    7,
    42,
  );
  for (const c of cues) {
    // A single word longer than the cap is allowed to stand alone, but no cue
    // may PACK past the cap.
    if (c.split(" ").length > 1) {
      assert.ok(c.length <= 42, `multi-word cue over char cap: "${c}"`);
    }
  }
});

test("chunkLine breaks on clause boundaries", () => {
  const cues = chunkLine("Hiring eats your week, every single week here.", 7, 80);
  // The comma should close the first cue (it's past the half-word soft threshold).
  assert.ok(cues[0].endsWith(","), `expected a clause break, got ${JSON.stringify(cues)}`);
});

test("a scene's cues tile its window with no gaps or overlap", () => {
  const scene: CaptionSceneInput = {
    id: "s1",
    text: "Hiring eats your week. We run the whole funnel for you, end to end.",
    from: 100,
    durationInFrames: 200, // window [100, 300)
  };
  const cues = buildSceneCues(scene, { tailPad: 4 });
  assert.ok(cues.length >= 2, "expected multiple cues");
  // Contiguous: each cue starts where the previous ended.
  for (let i = 1; i < cues.length; i++) {
    assert.equal(
      cues[i].fromFrame,
      cues[i - 1].toFrame,
      `gap/overlap between cue ${i - 1} and ${i}`,
    );
    assert.ok(cues[i].toFrame > cues[i].fromFrame, "cue window must be positive");
  }
  // First cue starts at the scene `from`; last ends at window end minus tailPad.
  assert.equal(cues[0].fromFrame, 100);
  assert.equal(cues[cues.length - 1].toFrame, 300 - 4);
});

test("a silent scene (no text) yields no cues", () => {
  assert.deepEqual(buildSceneCues({ id: "x", text: null, from: 0, durationInFrames: 90 }), []);
  assert.deepEqual(buildSceneCues({ id: "x", text: "   ", from: 0, durationInFrames: 90 }), []);
});

test("a one-chunk scene spans its whole (tail-trimmed) window", () => {
  const cues = buildSceneCues(
    { id: "s", text: "Hire faster.", from: 50, durationInFrames: 60 },
    { tailPad: 4 },
  );
  assert.equal(cues.length, 1);
  assert.equal(cues[0].fromFrame, 50);
  assert.equal(cues[0].toFrame, 50 + 60 - 4);
});

test("cue derivation is deterministic", () => {
  const scene: CaptionSceneInput = {
    id: "s1",
    text: "Adaptive interviews that run themselves, scored live, every single time.",
    from: 0,
    durationInFrames: 150,
  };
  const a = JSON.stringify(buildSceneCues(scene));
  const b = JSON.stringify(buildSceneCues(scene));
  assert.equal(a, b);
});

test("activeCue picks the right cue at boundaries", () => {
  const track = buildCaptionTrack([
    { id: "s1", text: "one two three four five six.", from: 0, durationInFrames: 60 },
  ]);
  assert.equal(activeCue(track, -1), null);
  assert.notEqual(activeCue(track, 0), null);
  // At the exclusive end of the (tail-trimmed) last cue, nothing is active.
  const lastEnd = track[track.length - 1].toFrame;
  assert.equal(activeCue(track, lastEnd), null);
  assert.notEqual(activeCue(track, lastEnd - 1), null);
});

test("frameToVttTime formats HH:MM:SS.mmm", () => {
  assert.equal(frameToVttTime(0, 30), "00:00:00.000");
  assert.equal(frameToVttTime(30, 30), "00:00:01.000");
  assert.equal(frameToVttTime(45, 30), "00:00:01.500");
  assert.equal(frameToVttTime(30 * 60 + 15, 30), "00:01:00.500");
});

test("trackToVtt emits a well-formed WebVTT document", () => {
  const track = buildCaptionTrack([
    { id: "s1", text: "Hire faster, ship sooner.", from: 0, durationInFrames: 90 },
  ]);
  const vtt = trackToVtt(track, 30);
  assert.ok(vtt.startsWith("WEBVTT\n"), "must start with the WEBVTT header");
  assert.ok(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/.test(vtt), "must have a cue timing line");
  assert.ok(vtt.includes("Hire faster"), "must include the caption text");
});
