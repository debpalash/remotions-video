// Unit tests for the pure `breathe` text normalizer. Run with:
//   node --import tsx --test src/vo/pacing.test.ts
// (no network / no ffmpeg — `padSilence` is exercised by the live pipeline proof).

import assert from "node:assert/strict";
import { test } from "node:test";
import { breathe } from "./pacing";

test("collapses whitespace and trims", () => {
  assert.equal(breathe("  hire   smarter  "), "hire smarter.");
});

test("adds a space after a missing inter-sentence boundary", () => {
  assert.equal(
    breathe("the top of the funnel.Let an agent run it."),
    "the top of the funnel. Let an agent run it.",
  );
});

test("appends terminal punctuation when the line ends on a word", () => {
  assert.equal(breathe("Yupcha runs it without you"), "Yupcha runs it without you.");
});

test("does not double-punctuate an already-terminated line", () => {
  assert.equal(breathe("Available today!"), "Available today!");
  assert.equal(breathe("Start free at yupcha dot com."), "Start free at yupcha dot com.");
});

test("preserves words and em-dashes; only touches whitespace/terminal punct", () => {
  const src = "The agent conducts the interview live — asking, listening, and adapting.";
  assert.equal(breathe(src), src);
});

test("is pure: same input -> identical output", () => {
  const s = "Hiring eats your week.Yupcha runs it without you";
  assert.equal(breathe(s), breathe(s));
  assert.equal(breathe(s), "Hiring eats your week. Yupcha runs it without you.");
});

test("empty / whitespace-only stays empty", () => {
  assert.equal(breathe(""), "");
  assert.equal(breathe("   "), "");
});
