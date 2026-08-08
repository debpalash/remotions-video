/**
 * KINO scene smoke check — every archetype mounts at frame 0 and frame 30
 * without throwing.
 *
 * Run with the repo's node test runner:
 *   node --import tsx --test src/kino-scenes/smoke.test.tsx
 * (no browser, no ffmpeg). This is the cheap render-to-string guard the build
 * step relies on: it proves each component renders as a pure function of the
 * frame under the same context the host mounts (FrameProvider + PaletteProvider)
 * — catching a bad hook order, a missing context read, or a thrown render before
 * a full Playwright capture is ever spawned.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FrameProvider } from "../engine";
import { PaletteProvider } from "../design";
import type { Motion, Palette, SceneName } from "../spec";
import { KINO_SCENES } from "./index";

const FPS = 30;
const DURATION = 120;

/** A complete palette (all swatches + the gradient pair) so no fallback path. */
const PALETTE: Palette = {
  bg: "#07090d",
  surface: "#11151c",
  text: "#f2f5f8",
  textDim: "#8a94a3",
  accent: "#3fe0c5",
  accent2: "#ff8a5b",
  gradientText: ["#3fe0c5", "#7aa2ff"],
};

/**
 * Minimal valid props for each archetype — one shape per `SceneName`, matching
 * the `src/spec` schemas (defaults applied as the host would after Zod parse).
 * `Proof` is exercised in BOTH union shapes below.
 */
const PROPS: Record<SceneName, unknown> = {
  Hook: { lines: ["Hiring eats your week.", "We run it without you."] },
  Problem: {
    stamps: ["200 resumes per role", "40 screening calls"],
    resolve: "So we fixed it.",
  },
  ProductShot: {
    kicker: "The Agentic Hiring Platform",
    headline: "Interviews that run *themselves*.",
    screen: "yupcha/agent-home",
    layout: "single",
    tilt: 6,
    callouts: [
      {
        title: "Adaptive interviews",
        sub: "AI takes over in real time.",
        icon: "message-circle",
        anchor: "tr",
        accent: "accent",
      },
      {
        title: "Bulk interviews",
        icon: "layers",
        anchor: "bl",
        accent: "accent2",
      },
    ],
  },
  FeatureBeat: {
    label: "Live Analysis",
    region: "yupcha/dashboard",
    caption: "Every answer, *scored live*.",
  },
  Stats: {
    items: [
      { to: 90, suffix: "%", decimals: 0, label: "less time", verified: false },
      { to: 24, suffix: "/7", decimals: 0, label: "running", verified: true },
    ],
  },
  Proof: { quote: "Stellar understanding of architecture.", attribution: "Lead Architect" },
  CTA: { headline: "Hire *10× faster*.", url: "yupcha.com" },
};

/** Wrap a scene in the exact contexts the host mounts, at a given frame. */
const renderAt = (
  Comp: React.FC<any>,
  props: unknown,
  frame: number,
  motion: Motion,
): string =>
  renderToStaticMarkup(
    React.createElement(PaletteProvider, {
      palette: PALETTE,
      motion,
      children: React.createElement(FrameProvider, {
        frame,
        fps: FPS,
        durationInFrames: DURATION,
        children: React.createElement(Comp, props as object),
      }),
    }),
  );

const SCENE_NAMES = Object.keys(KINO_SCENES) as SceneName[];
const MOTIONS: Motion[] = ["calm", "standard", "punchy"];

for (const name of SCENE_NAMES) {
  test(`${name} mounts at frame 0 and 30 without throwing`, () => {
    const Comp = KINO_SCENES[name];
    for (const motion of MOTIONS) {
      for (const frame of [0, 30]) {
        const html = renderAt(Comp, PROPS[name], frame, motion);
        assert.equal(typeof html, "string");
        assert.ok(html.length > 0, `${name}@${frame}/${motion} produced no markup`);
      }
    }
  });
}

test("Proof renders the logo-wall union shape too", () => {
  const Comp = KINO_SCENES.Proof;
  const logoProps = { logos: ["brand/a", "brand/b", "brand/c"] };
  for (const frame of [0, 30]) {
    const html = renderAt(Comp, logoProps, frame, "standard");
    assert.ok(html.length > 0, `Proof(logos)@${frame} produced no markup`);
  }
});

test("the map exposes exactly the 7 registry scene names", () => {
  assert.deepEqual(
    [...SCENE_NAMES].sort(),
    ["CTA", "FeatureBeat", "Hook", "Problem", "ProductShot", "Proof", "Stats"],
  );
});
