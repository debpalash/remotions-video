/**
 * Unit tests for the KEYLESS HEURISTIC DIRECTOR (`heuristic.ts`).
 *
 * The contract the heuristic must always satisfy, for ANY reasonable brand kit:
 *   1. `VideoSpec.parse()` succeeds (schema-valid).
 *   2. `lintSpec().ok` is `true` (anti-slop-clean — §4 guardrails).
 *   3. `validateSceneRefs()` returns `[]` (narrative grammar holds).
 *   4. It is pure + deterministic (same input → byte-identical output).
 *
 * Run with vitest (`vitest run src/llm/heuristic.test.ts`). No network, no LLM,
 * no clock, no mocks — the director is a pure function.
 */
import { describe, it, expect } from "vitest";

import { VideoSpec, lintSpec } from "../spec";
import { validateSceneRefs } from "./director";
import { heuristicDirect, type DirectorBrandKit } from "./heuristic";

/* -------------------------------------------------------------------------- */
/*  Synthetic brand kits — three distinct shapes                               */
/* -------------------------------------------------------------------------- */

/** A house brand (dark) — should bind to `dark-cinematic` via the locked map. */
const YUPCHA: DirectorBrandKit = {
  id: "yupcha",
  url: "https://yupcha.com",
  name: "Yupcha",
  palette: {
    bg: "#07090d",
    surface: "#11151c",
    text: "#f2f5f8",
    textDim: "#8a94a3",
    accent: "#3fe0c5",
    accent2: "#ff8a5b",
    gradientText: ["#3fe0c5", "#7aa2ff"],
  },
  fonts: ["Space Grotesk"],
  screens: [
    { key: "yupcha/agent-home", role: "hero" },
    { key: "yupcha/dashboard", role: "screenshot" },
    { key: "yupcha/scoring", role: "screenshot" },
  ],
  copy: [
    { text: "The Agentic Hiring Platform", kind: "headline" },
    { text: "Run end-to-end hiring workflows with AI agents.", kind: "value-prop" },
    { text: "Adaptive interviews", kind: "subhead" },
    { text: "Complete Anti-Cheating", kind: "subhead" },
    { text: "Fair Candidate Scoring", kind: "subhead" },
    { text: "Autonomous Interviews for any field.", kind: "value-prop" },
    { text: "The Future of AI Hiring is Agentic.", kind: "value-prop" },
  ],
  voice: "technical-confident",
};

/** An arbitrary LIGHT brand — no house binding → palette heuristic → editorial. */
const WARM_ARBITRARY: DirectorBrandKit = {
  id: "acmehash",
  url: "acme.io",
  name: "Acme Notes",
  palette: {
    bg: "#fbfaf7",
    surface: "#f1efe9",
    text: "#1a1714",
    textDim: "#6b655c",
    accent: "#c8553d",
    // no accent2 — exercises the optional-accent2 fallback in callouts.
  },
  fonts: ["Newsreader"],
  screens: [{ key: "acme/editor", role: "hero" }],
  copy: [
    { text: "Notes that write themselves.", kind: "headline" },
    { text: "Capture ideas before they vanish.", kind: "value-prop" },
  ],
};

/**
 * A DEGRADED, minimal kit — empty copy, a video-like screen key, no accent2, an
 * unparseable bg. The heuristic must still produce a valid, lint-clean spec
 * (filtering the clip key, synthesizing copy, defaulting to a dark register).
 */
const DEGRADED: DirectorBrandKit = {
  id: "x1",
  name: "Glitch",
  palette: {
    bg: "not-a-color",
    surface: "#222222",
    text: "#eeeeee",
    textDim: "#999999",
    accent: "#7c5cff",
  },
  // The only "screen" is a video clip — must be filtered so screen-is-still holds.
  screens: [{ key: "glitch/demo.mp4", role: "hero" }],
  copy: [],
};

const KITS: ReadonlyArray<[string, DirectorBrandKit]> = [
  ["yupcha (dark house brand)", YUPCHA],
  ["warm arbitrary (light, no accent2)", WARM_ARBITRARY],
  ["degraded (empty copy, clip screen, bad bg)", DEGRADED],
];

/* -------------------------------------------------------------------------- */
/*  Contract: every kit yields a schema-valid, lint-clean, narrative-sane spec */
/* -------------------------------------------------------------------------- */

describe("heuristicDirect — contract per brand kit", () => {
  for (const [name, kit] of KITS) {
    describe(name, () => {
      const spec = heuristicDirect(kit);

      it("is schema-valid (VideoSpec.parse)", () => {
        expect(() => VideoSpec.parse(spec)).not.toThrow();
        expect(VideoSpec.safeParse(spec).success).toBe(true);
      });

      it("is anti-slop-clean (lintSpec.ok)", () => {
        const r = lintSpec(spec);
        expect(r.violations).toEqual([]);
        expect(r.ok).toBe(true);
      });

      it("obeys narrative grammar (validateSceneRefs)", () => {
        expect(validateSceneRefs(spec)).toEqual([]);
      });

      it("threads the kit's brandKitId + valid palette swatches unchanged", () => {
        expect(spec.brandKitId).toBe(kit.id);
        // Valid swatches pass through byte-for-byte (no styling). All three kits
        // carry a valid `accent`; only the degraded kit has an unparseable `bg`,
        // which is correctly substituted with the safe default.
        expect(spec.palette.accent).toBe(kit.palette.accent);
      });

      it("assembles the conversion template (Hook first, CTA last)", () => {
        expect(spec.scenes[0].component).toBe("Hook");
        expect(spec.scenes[spec.scenes.length - 1].component).toBe("CTA");
        const productCount = spec.scenes.filter(
          (s) => s.component === "ProductShot",
        ).length;
        expect(productCount).toBeGreaterThanOrEqual(1);
      });

      it("caps feature beats at ≤4 and proof at ≤1", () => {
        const features = spec.scenes.filter(
          (s) => s.component === "FeatureBeat",
        ).length;
        const proofs = spec.scenes.filter((s) => s.component === "Proof").length;
        expect(features).toBeLessThanOrEqual(4);
        expect(proofs).toBeLessThanOrEqual(1);
      });

      it("gives every VO-bearing scene caption-able text", () => {
        for (const s of spec.scenes) {
          if (s.vo) expect(s.vo.text.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  Preset selection                                                           */
/* -------------------------------------------------------------------------- */

describe("heuristicDirect — preset selection", () => {
  it("binds the dark house brand to dark-cinematic", () => {
    expect(heuristicDirect(YUPCHA).preset).toBe("dark-cinematic");
  });

  it("falls to editorial for a light arbitrary brand", () => {
    expect(heuristicDirect(WARM_ARBITRARY).preset).toBe("editorial");
  });

  it("defaults a bad-bg kit to the dark register", () => {
    expect(heuristicDirect(DEGRADED).preset).toBe("dark-cinematic");
  });

  it("honours a valid goal.preset override", () => {
    expect(heuristicDirect(YUPCHA, { preset: "minimal-mono" }).preset).toBe(
      "minimal-mono",
    );
  });

  it("threads a valid bg swatch through unchanged", () => {
    expect(heuristicDirect(YUPCHA).palette.bg).toBe(YUPCHA.palette.bg);
    expect(heuristicDirect(WARM_ARBITRARY).palette.bg).toBe(
      WARM_ARBITRARY.palette.bg,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Purity / determinism                                                       */
/* -------------------------------------------------------------------------- */

describe("heuristicDirect — pure + deterministic", () => {
  it("same input → byte-identical output", () => {
    const a = heuristicDirect(YUPCHA, { format: "9:16" });
    const b = heuristicDirect(YUPCHA, { format: "9:16" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not mutate its inputs", () => {
    const kitBefore = JSON.stringify(WARM_ARBITRARY);
    const goal = { angle: "lead with the capture pain" };
    const goalBefore = JSON.stringify(goal);
    heuristicDirect(WARM_ARBITRARY, goal);
    expect(JSON.stringify(WARM_ARBITRARY)).toBe(kitBefore);
    expect(JSON.stringify(goal)).toBe(goalBefore);
  });

  it("threads goal.format through", () => {
    expect(heuristicDirect(YUPCHA, { format: "1:1" }).format).toBe("1:1");
  });
});
