/**
 * Unit tests for the anti-slop lint (`lint.ts`).
 *
 * Two anchor cases per the task:
 *   1. a PASSING spec (the frozen `SAMPLE_SPEC`) → `{ ok: true, violations: [] }`
 *   2. a SLOP spec that trips every §4 guardrail → `ok:false` with the expected
 *      rule ids present.
 *
 * Run with vitest (`vitest run src/spec/lint.test.ts`). The lint is a pure
 * function, so these tests need no setup/teardown, no mocks, no clock.
 */
import { describe, it, expect } from "vitest";

import { lintSpec, type Violation } from "./lint";
import { SAMPLE_SPEC } from "./sample";
import type { VideoSpec } from "./schema";

const rules = (vs: Violation[]) => vs.map((v) => v.rule);

describe("lintSpec — passing spec", () => {
  it("the frozen SAMPLE_SPEC is clean", () => {
    const r = lintSpec(SAMPLE_SPEC);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("is pure — does not mutate the input", () => {
    const before = JSON.stringify(SAMPLE_SPEC);
    lintSpec(SAMPLE_SPEC);
    expect(JSON.stringify(SAMPLE_SPEC)).toBe(before);
  });

  it("is deterministic — same spec yields identical violations", () => {
    const a = lintSpec(SAMPLE_SPEC);
    const b = lintSpec(SAMPLE_SPEC);
    expect(a).toEqual(b);
  });
});

/**
 * A maximally-sloppy spec. It is intentionally constructed past the static type
 * (off-contract fields like per-scene `preset`, a `grain` dial, a video screen
 * key) — exactly the shape an unconstrained LLM emits and that `parse()` would
 * silently strip. We cast through `unknown` to feed it to the lint, which is the
 * gate that must catch what the parser would have hidden.
 */
const SLOP_SPEC = {
  version: 1,
  format: "16:9",
  preset: "gradient-glass", // gradient bg…
  grain: 0, // …with mandated grain explicitly turned OFF → grain-on-gradient violation
  motion: "punchy",
  palette: {
    bg: "#000000",
    surface: "#111111",
    text: "#ffffff",
    textDim: "#888888",
    accent: "#3fe0c5",
  },
  brandKitId: "slop",
  // Restraint dial over the cap, and a LUT at 100%.
  grade: 0.95,
  lut: 1,
  transitions: { kind: "fade", durationInFrames: 15 },
  scenes: [
    // CTA first (must be last) + a per-scene preset override.
    {
      id: "s0-cta-misplaced",
      component: "CTA",
      preset: "editorial", // scene cannot override the preset
      props: { headline: "Buy now", url: "x.com" },
      vo: { text: "Buy now." },
    },
    // A second Hook, not first → two narrative breaches.
    {
      id: "s1-hook",
      component: "Hook",
      props: { lines: ["Hook A"] },
      vo: { text: "Hook A." },
    },
    {
      id: "s2-hook-dup",
      component: "Hook",
      signature: "snapScale", // scene cannot declare a signature
      props: { lines: ["Hook B"] },
      vo: { text: "Hook B." },
    },
    // Raw hex inside scene props (the `${COLORS.blue}55` anti-pattern), a video
    // screen key, and a VO with no caption-able text.
    {
      id: "s3-product",
      component: "ProductShot",
      props: {
        kicker: "Tinted #ff0055 callout",
        headline: "Hero",
        screen: "yupcha/demo-recording.mp4", // video, not a still
        layout: "single",
        tilt: 6,
        callouts: [],
      },
      vo: { audioUrl: "vo/s3.mp3" }, // audio but no `text` → uncaptionable
    },
    // FeatureBeat pointing at a clip region.
    {
      id: "s4-feature",
      component: "FeatureBeat",
      props: {
        label: "Speed",
        region: "clips/scroll.webm",
        caption: "Fast.",
      },
      vo: { text: "It's fast." },
    },
    // A trailing CTA so the misplaced first CTA also trips the "two CTAs" check.
    {
      id: "s5-cta",
      component: "CTA",
      props: { headline: "Final", url: "x.com" },
      vo: { text: "Start now." },
    },
  ],
} as unknown as VideoSpec;

describe("lintSpec — slop spec", () => {
  const r = lintSpec(SLOP_SPEC);

  it("is not ok", () => {
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it("flags the raw hex in scene props (not the palette)", () => {
    const hex = r.violations.filter((v) => v.rule === "no-off-token-color");
    expect(hex.length).toBe(1);
    expect(hex[0].path).toBe("scenes[3].props.kicker");
    // The palette's hex swatches are exempt (they are the token source).
    expect(hex.some((v) => v.path.startsWith("palette"))).toBe(false);
  });

  it("flags grain-on-gradient (gradient preset, no grain)", () => {
    expect(rules(r.violations)).toContain("grain-on-gradient");
  });

  it("flags restraint dials over 0.7 (grade=0.95 and lut=1)", () => {
    const caps = r.violations.filter((v) => v.rule === "restraint-cap");
    const paths = caps.map((v) => v.path).sort();
    expect(paths).toEqual(["grade", "lut"]);
  });

  it("flags per-scene preset/signature overrides", () => {
    expect(rules(r.violations)).toContain("one-preset"); // scenes[0].preset
    expect(rules(r.violations)).toContain("one-signature"); // scenes[2].signature
  });

  it("flags the narrative breaches (two Hooks, Hook not first, two CTAs, CTA not last)", () => {
    expect(rules(r.violations)).toContain("narrative-hook");
    expect(rules(r.violations)).toContain("narrative-cta");
    // First scene is a CTA → CTA-not-last; last scene is a CTA → fine, but the
    // first CTA makes the count 2 and the misplacement fires.
    const cta = r.violations.filter((v) => v.rule === "narrative-cta");
    expect(cta.length).toBeGreaterThanOrEqual(1);
  });

  it("flags the uncaptionable VO scene", () => {
    const caps = r.violations.filter((v) => v.rule === "caption-mandatory");
    expect(caps.length).toBe(1);
    expect(caps[0].path).toBe("scenes[3].vo.text");
  });

  it("flags video screen + region slots", () => {
    const still = r.violations.filter((v) => v.rule === "screen-is-still");
    const paths = still.map((v) => v.path).sort();
    expect(paths).toEqual(["scenes[3].props.screen", "scenes[4].props.region"]);
  });

  it("covers every guardrail rule id at least once", () => {
    const seen = new Set(rules(r.violations));
    for (const rule of [
      "no-off-token-color",
      "grain-on-gradient",
      "restraint-cap",
      "one-preset",
      "one-signature",
      "caption-mandatory",
      "narrative-hook",
      "narrative-cta",
      "screen-is-still",
    ]) {
      expect(seen.has(rule as Violation["rule"])).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(lintSpec(SLOP_SPEC)).toEqual(r);
  });
});
