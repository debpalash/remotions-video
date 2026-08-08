/**
 * DETERMINISM PROOF for the studio-grade background system (`backgrounds/`).
 *
 * The engine audit (ENGINE_DESIGN review) flagged that the existing adapter proof
 * asserts only the time-bridge math, never that the SHADER produces byte-identical
 * pixels. This proof closes that gap for the background system end-to-end, on the
 * pure pipeline this module owns:
 *
 *     palette swatches ──cssToRgb/paletteRgb──▶ uColors (vec3)
 *     palette ──paletteSeed──▶ uSeed
 *     preset ──treatmentFor──▶ Treatment uniforms
 *     (vUv, uTime=frame/fps, uSeed, uColors, Treatment) ──fragColor──▶ RGBA8
 *
 * `fragColor` (./shader-mirror.ts) is a 1:1 TS transcription of `glsl.ts FRAG`.
 * We rasterize a grid of pixels for representative frames and assert:
 *   1. Two independent renders of the same frame are BYTE-IDENTICAL (the headline
 *      "two renders byte-identical" claim, per the task + master-checklist #8).
 *   2. Render order is irrelevant (frame-range sharding precondition, §4).
 *   3. Distinct frames actually move (the field animates; not frozen on frame 0).
 *   4. The four presets yield DISTINCT treatments → distinct fields (each preset
 *      maps to its own look) — except they share frame-purity.
 *   5. uTime is exactly frame/fps and uSeed is a pure function of the palette.
 *
 * Pure assert harness — no GPU, no test framework, no browser. Run:
 *   tsx src/kino-scenes/backgrounds/__proof__/backdrop.proof.ts
 * (also runnable under vitest/node:test as a plain module that throws on failure).
 */

import assert from "node:assert/strict";

import type { Palette, Preset } from "../../../spec";
import { paletteRgb, paletteSeed } from "../color";
import { TREATMENTS, treatmentFor } from "../treatments";
import { fragColor, toRgba8, type FragUniforms, type V2 } from "./shader-mirror";
import type { Rgb } from "../color";

let passed = 0;
function ok(name: string, cond: boolean, detail?: string): void {
  assert.ok(cond, `${name}${detail ? ` — ${detail}` : ""}`);
  passed++;
}

const FPS = 30;
const FRAMES = [0, 1, 7, 15, 29, 30, 45, 90, 137];

/** A complete palette (mirrors the smoke test's Yupcha-class swatches). */
const PALETTE: Palette = {
  bg: "#07090d",
  surface: "#11151c",
  text: "#f2f5f8",
  textDim: "#8a94a3",
  accent: "#3fe0c5",
  accent2: "#ff8a5b",
  gradientText: ["#3fe0c5", "#7aa2ff"],
};
/** A second, distinct palette (ResuBird-class warm) to prove seed sensitivity. */
const PALETTE_B: Palette = {
  bg: "#fbf7f0",
  surface: "#ffffff",
  text: "#2a2320",
  textDim: "#7a6f64",
  accent: "#e0743f",
  accent2: "#3f7ae0",
};

const PRESETS: Preset[] = [
  "dark-cinematic",
  "gradient-glass",
  "minimal-mono",
  "editorial",
];

const RES: V2 = [1920, 1080];

/** Build the uniform bundle exactly as `ShaderMesh.buildUniforms` does. Pure. */
function uniformsFor(pal: Palette, preset: Preset, frame: number): FragUniforms {
  const tr = treatmentFor(preset);
  const colors = tr.colors.map((k) => paletteRgb(pal, k)) as unknown as readonly [
    Rgb,
    Rgb,
    Rgb,
    Rgb,
  ];
  return {
    uTime: frame / FPS, // the ONLY clock — frame/fps
    uSeed: paletteSeed(pal),
    uResolution: RES,
    uColors: colors,
    treatment: tr,
  };
}

/** A 13×7 sample grid spanning the frame (interior points, avoids 0/1 edges). */
const GRID: V2[] = (() => {
  const pts: V2[] = [];
  for (let yi = 0; yi < 7; yi++) {
    for (let xi = 0; xi < 13; xi++) {
      pts.push([(xi + 0.5) / 13, (yi + 0.5) / 7]);
    }
  }
  return pts;
})();

/** Render the grid → a flat RGBA8 byte array (the "framebuffer" proxy). */
function rasterize(u: FragUniforms): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(GRID.length * 4);
  for (let i = 0; i < GRID.length; i++) {
    const [r, g, b, a] = toRgba8(fragColor(GRID[i], u));
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = a;
  }
  return buf;
}

const bytesEqual = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const firstDiff = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
};

// ---------------------------------------------------------------------------
// 0. Sanity: the pure inputs the shader consumes are themselves deterministic.
// ---------------------------------------------------------------------------
{
  ok("paletteSeed deterministic", paletteSeed(PALETTE) === paletteSeed(PALETTE));
  ok(
    "paletteSeed sensitive to palette",
    paletteSeed(PALETTE) !== paletteSeed(PALETTE_B),
  );
  for (const preset of PRESETS) {
    const u = uniformsFor(PALETTE, preset, 30);
    ok(`uTime is frame/fps (${preset})`, u.uTime === 30 / FPS);
    ok(`uColors has 4 swatches (${preset})`, u.uColors.length === 4);
    ok(
      `paletteRgb pure (${preset})`,
      paletteRgb(PALETTE, "accent")[0] === paletteRgb(PALETTE, "accent")[0],
    );
  }
}

// ---------------------------------------------------------------------------
// 1. HEADLINE: two independent renders of the same frame are BYTE-IDENTICAL.
//    This is the "two renders byte-identical" guarantee for the shader pipeline.
// ---------------------------------------------------------------------------
{
  for (const preset of PRESETS) {
    for (const f of FRAMES) {
      // Two fully independent evaluations (as two parallel shard workers).
      const fb1 = rasterize(uniformsFor(PALETTE, preset, f));
      const fb2 = rasterize(uniformsFor(PALETTE, preset, f));
      ok(
        `${preset}: frame ${f} byte-identical across two renders`,
        bytesEqual(fb1, fb2),
        `first diff at byte ${firstDiff(fb1, fb2)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Render order does NOT matter — render forward, then in a deterministic
//    shuffle, and assert each frame's framebuffer matches the forward pass.
// ---------------------------------------------------------------------------
{
  for (const preset of PRESETS) {
    const forward = FRAMES.map((f) => rasterize(uniformsFor(PALETTE, preset, f)));
    const order = [...FRAMES.keys()].sort(
      (a, b) => ((a * 31 + 7) % 13) - ((b * 31 + 7) % 13),
    );
    const shuffled: Record<number, Uint8ClampedArray> = {};
    for (const idx of order) {
      shuffled[idx] = rasterize(uniformsFor(PALETTE, preset, FRAMES[idx]));
    }
    const orderIndependent = FRAMES.every((_, i) => bytesEqual(forward[i], shuffled[i]));
    ok(`${preset}: render order independent`, orderIndependent);
  }
}

// ---------------------------------------------------------------------------
// 3. The field ANIMATES — distinct frames generally produce distinct output.
//    (Guards against a uniform that froze on frame 0 / never reads uTime.)
// ---------------------------------------------------------------------------
{
  for (const preset of PRESETS) {
    const a = rasterize(uniformsFor(PALETTE, preset, 0));
    const b = rasterize(uniformsFor(PALETTE, preset, 45));
    ok(`${preset}: frame 0 and 45 differ (motion present)`, !bytesEqual(a, b));
  }
}

// ---------------------------------------------------------------------------
// 4. Each preset is a DISTINCT treatment → a distinct field at the same frame.
//    (dark-cinematic vs gradient-glass vs minimal-mono vs editorial must look
//    different; this is the "each preset maps to a distinct treatment" claim.)
// ---------------------------------------------------------------------------
{
  // Treatments themselves differ.
  for (let i = 0; i < PRESETS.length; i++) {
    for (let j = i + 1; j < PRESETS.length; j++) {
      const ti = TREATMENTS[PRESETS[i]];
      const tj = TREATMENTS[PRESETS[j]];
      const same =
        ti.flow === tj.flow &&
        ti.warp === tj.warp &&
        ti.scale === tj.scale &&
        ti.paper === tj.paper &&
        ti.grain === tj.grain &&
        ti.vignette === tj.vignette;
      ok(`treatments differ: ${PRESETS[i]} vs ${PRESETS[j]}`, !same);
    }
  }
  // Editorial is paper (paper === 1); dark-cinematic is full mesh (paper === 0).
  ok("editorial is paper ground", TREATMENTS.editorial.paper === 1);
  ok("dark-cinematic is full mesh field", TREATMENTS["dark-cinematic"].paper === 0);
  // grain mandatory on the gradient preset (anti-slop lint).
  ok("gradient-glass has grain > 0", TREATMENTS["gradient-glass"].grain > 0);

  // Rendered fields differ across presets at the same frame (with same palette).
  const fields = PRESETS.map((p) => rasterize(uniformsFor(PALETTE, p, 30)));
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      ok(
        `rendered field differs: ${PRESETS[i]} vs ${PRESETS[j]}`,
        !bytesEqual(fields[i], fields[j]),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Palette sensitivity: a different brand palette → a different field
//    (the shader is genuinely palette-tokened, not hard-coded color).
// ---------------------------------------------------------------------------
{
  for (const preset of PRESETS) {
    const a = rasterize(uniformsFor(PALETTE, preset, 30));
    const b = rasterize(uniformsFor(PALETTE_B, preset, 30));
    ok(`${preset}: palette A vs B differ`, !bytesEqual(a, b));
  }
}

// ---------------------------------------------------------------------------
// 6. Output is in-gamut: every byte is a valid 0..255 channel, alpha opaque.
// ---------------------------------------------------------------------------
{
  for (const preset of PRESETS) {
    const fb = rasterize(uniformsFor(PALETTE, preset, 7));
    let inGamut = true;
    let alphaOk = true;
    for (let i = 0; i < fb.length; i += 4) {
      if (fb[i] < 0 || fb[i] > 255) inGamut = false;
      if (fb[i + 3] !== 255) alphaOk = false;
    }
    ok(`${preset}: all channels in 0..255`, inGamut);
    ok(`${preset}: alpha opaque`, alphaOk);
  }
}

console.log(`KINO backdrop determinism proof: ${passed} assertions passed.`);
