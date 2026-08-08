/**
 * CPU mirror of the background shader's PURE pipeline — `backgrounds/glsl.ts`.
 *
 * The engine audit's headline gap: the adapter proof tests only the time-bridge
 * MATH (`uTime = frame/fps`), never that the shader itself produces byte-identical
 * pixels for the same frame. We can't run a GPU in a unit harness, but the
 * fragment shader is a CLOSED-FORM pure function of `(vUv, uTime, uSeed, colors,
 * treatment-uniforms)` — exactly the property the determinism contract rests on.
 * So we transcribe that function to TypeScript here, 1:1 with the GLSL, and the
 * proof (`backdrop.proof.ts`) evaluates it twice per pixel and asserts identical
 * quantized 8-bit RGBA — the real "two renders byte-identical" claim.
 *
 * This is a MIRROR, not the renderer: it exists to make the determinism property
 * machine-checkable without a GPU. The GLSL in `glsl.ts` remains the source of
 * truth that actually ships; this file is kept structurally identical to it so a
 * reviewer can diff the two by eye. Every op below maps to a line in `FRAG`.
 *
 * Determinism note: no `Math.random`, no clock — every function here is pure.
 */

import type { Rgb } from "../color";
import type { Treatment } from "../treatments";

/* ---- vec2/vec3 helpers (GLSL semantics) --------------------------------- */

export type V2 = readonly [number, number];
export type V3 = readonly [number, number, number];

const fract = (x: number): number => x - Math.floor(x);
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix1 = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [
  mix1(a[0], b[0], t),
  mix1(a[1], b[1], t),
  mix1(a[2], b[2], t),
];
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* ---- Ashima 2D simplex noise (mirror of SNOISE) ------------------------- */

const mod289_1 = (x: number): number => x - Math.floor(x * (1 / 289)) * 289;
const mod289v3 = (x: V3): V3 => [mod289_1(x[0]), mod289_1(x[1]), mod289_1(x[2])];
const mod289v2 = (x: V2): V2 => [mod289_1(x[0]), mod289_1(x[1])];
const permute3 = (x: V3): V3 =>
  mod289v3([
    (x[0] * 34 + 1) * x[0],
    (x[1] * 34 + 1) * x[1],
    (x[2] * 34 + 1) * x[2],
  ]);

export function snoise(v: V2): number {
  const Cx = 0.211324865405187;
  const Cy = 0.366025403784439;
  const Cz = -0.577350269189626;
  const Cw = 0.024390243902439;

  const ix = Math.floor(v[0] + (v[0] + v[1]) * Cy);
  const iy = Math.floor(v[1] + (v[0] + v[1]) * Cy);
  const i0: V2 = [ix, iy];

  const x0x = v[0] - ix + (ix + iy) * Cx;
  const x0y = v[1] - iy + (ix + iy) * Cx;

  const i1: V2 = x0x > x0y ? [1, 0] : [0, 1];

  // x12 = x0.xyxy + C.xxzz; then x12.xy -= i1
  const x12x = x0x + Cx - i1[0];
  const x12y = x0y + Cx - i1[1];
  const x12z = x0x + Cz;
  const x12w = x0y + Cz;

  const im = mod289v2(i0);
  const p = permute3(
    permute3([im[1] + 0, im[1] + i1[1], im[1] + 1]).map(
      (pv, k) => pv + im[0] + [0, i1[0], 1][k],
    ) as unknown as V3,
  );

  const m: V3 = [
    Math.max(0.5 - (x0x * x0x + x0y * x0y), 0),
    Math.max(0.5 - (x12x * x12x + x12y * x12y), 0),
    Math.max(0.5 - (x12z * x12z + x12w * x12w), 0),
  ];
  let m0 = m[0] * m[0];
  let m1 = m[1] * m[1];
  let m2 = m[2] * m[2];
  m0 = m0 * m0;
  m1 = m1 * m1;
  m2 = m2 * m2;

  const xx: V3 = [
    2 * fract(p[0] * Cw) - 1,
    2 * fract(p[1] * Cw) - 1,
    2 * fract(p[2] * Cw) - 1,
  ];
  const h: V3 = [Math.abs(xx[0]) - 0.5, Math.abs(xx[1]) - 0.5, Math.abs(xx[2]) - 0.5];
  const ox: V3 = [Math.floor(xx[0] + 0.5), Math.floor(xx[1] + 0.5), Math.floor(xx[2] + 0.5)];
  const a0: V3 = [xx[0] - ox[0], xx[1] - ox[1], xx[2] - ox[2]];

  m0 *= 1.79284291400159 - 0.85373472095314 * (a0[0] * a0[0] + h[0] * h[0]);
  m1 *= 1.79284291400159 - 0.85373472095314 * (a0[1] * a0[1] + h[1] * h[1]);
  m2 *= 1.79284291400159 - 0.85373472095314 * (a0[2] * a0[2] + h[2] * h[2]);

  const gx = a0[0] * x0x + h[0] * x0y;
  const gy = a0[1] * x12x + h[1] * x12y;
  const gz = a0[2] * x12z + h[2] * x12w;

  return 130 * (m0 * gx + m1 * gy + m2 * gz);
}

/* ---- helpers (mirror of HELPERS) ---------------------------------------- */

export function fbm(p: V2): number {
  let v = 0;
  let a = 0.5;
  // mat2(1.6,1.2,-1.2,1.6) applied as p = m*p (column-major like GLSL)
  let px = p[0];
  let py = p[1];
  for (let i = 0; i < 3; i++) {
    v += a * snoise([px, py]);
    const nx = 1.6 * px + -1.2 * py;
    const ny = 1.2 * px + 1.6 * py;
    px = nx;
    py = ny;
    a *= 0.5;
  }
  return v;
}

export function hash21(p: V2): number {
  let x = fract(p[0] * 123.34);
  let y = fract(p[1] * 345.45);
  const d = x * (x + 34.345) + y * (y + 34.345);
  x += d;
  y += d;
  return fract(x * y);
}

const screenBlend = (a: V3, b: V3): V3 => [
  1 - (1 - a[0]) * (1 - b[0]),
  1 - (1 - a[1]) * (1 - b[1]),
  1 - (1 - a[2]) * (1 - b[2]),
];

/* ---- the fragment shader main() (mirror of FRAG) ------------------------ */

export type FragUniforms = {
  uTime: number;
  uSeed: number;
  uResolution: V2;
  uColors: readonly [Rgb, Rgb, Rgb, Rgb];
  treatment: Treatment;
};

/** Evaluate the fragment shader for one pixel `vUv`. Returns clamped RGB `[0,1]`. */
export function fragColor(vUv: V2, u: FragUniforms): V3 {
  const { uTime, uSeed, uResolution, uColors, treatment: tr } = u;
  const c0 = uColors[0] as V3;
  const c1 = uColors[1] as V3;
  const c2 = uColors[2] as V3;
  const c3 = uColors[3] as V3;

  const sd: V2 = [uSeed * 0.137, uSeed * 0.231];
  const t = uTime * tr.flow;

  // Aspect-corrected coords (mirror of FRAG: p = (uv-0.5)*vec2(aspect,1)+0.5).
  const aspect = uResolution[0] / uResolution[1];
  const p: V2 = [(vUv[0] - 0.5) * aspect + 0.5, vUv[1]];

  // Domain warp.
  const q: V2 = [
    p[0] + tr.warp * Math.sin(t * 1.0 + p[1] * 2.4 + sd[0]),
    p[1] + tr.warp * Math.cos(t * 0.85 + p[0] * 2.4 + sd[1]),
  ];

  // LIFTED GROUND — mesh sits on a ground lifted toward accent + bright key.
  let ground = mix3(c0, c1, 0.27);
  ground = mix3(ground, c3, 0.05);

  // Base field with directional bias.
  const bias = (q[0] - q[1]) * 0.2;
  const n1 = fbm([q[0] * tr.scale + sd[0] + t * 0.05, q[1] * tr.scale + sd[1] + t * 0.05]) * 0.5 + 0.5 + bias;

  // Accent A — dominant color field.
  let col: V3 = ground;
  const aMix = smoothstep(0.2, 0.88, n1) * 0.58;
  col = mix3(col, c1, aMix);

  // Accent B — second field (direct mix + screen-blended overlap).
  const n2 =
    fbm([
      q[0] * (tr.scale * 1.55) - sd[0] - t * 0.04,
      q[1] * (tr.scale * 1.55) - sd[1] - t * 0.04,
    ]) *
      0.5 +
    0.5;
  const a2Mix = smoothstep(0.46, 0.92, n2) * 0.4;
  col = mix3(col, c2, a2Mix * 0.55);
  col = mix3(col, screenBlend(col, c2), a2Mix * 0.6);

  // Luminance floor (BEFORE the highlight).
  col = [
    Math.max(col[0], ground[0] * 0.97),
    Math.max(col[1], ground[1] * 0.97),
    Math.max(col[2], ground[2] * 0.97),
  ];

  // Broad slow highlight bloom (screen).
  const hiField = smoothstep(
    0.42,
    1.0,
    fbm([q[0] * 1.25 + t * 0.06, q[1] * 1.25 + t * 0.06]) * 0.5 + 0.5,
  );
  col = screenBlend(col, [c3[0] * hiField * 0.28, c3[1] * hiField * 0.28, c3[2] * hiField * 0.28]);

  // Editorial paper collapse.
  const paper = mix3(c0, c1, 0.04 + 0.03 * n1);
  col = mix3(col, paper, tr.paper);

  const dither =
    (hash21([vUv[0] * uResolution[0] + sd[0], vUv[1] * uResolution[1] + sd[1]]) - 0.5) *
    (1 / 255) *
    1.5;
  col = [col[0] + dither, col[1] + dither, col[2] + dither];

  const gf = Math.floor(uTime * tr.grainRate);
  const g = hash21([
    vUv[0] * uResolution[0] + gf * 17.13 + sd[0],
    vUv[1] * uResolution[1] + gf * 31.71 + sd[1],
  ]);
  col = [
    col[0] + (g - 0.5) * tr.grain,
    col[1] + (g - 0.5) * tr.grain,
    col[2] + (g - 0.5) * tr.grain,
  ];

  const dx = vUv[0] - 0.5;
  const dy = vUv[1] - 0.5;
  const d = Math.sqrt(dx * dx + dy * dy);
  const vig = 1 - tr.vignette * smoothstep(0.45, 0.95, d);
  col = [col[0] * vig, col[1] * vig, col[2] * vig];

  // LOWER-THIRD GROUND SEAL (mirror of FRAG) — deepen only the bottom band toward
  // the brand ground so the brightest text frames stop reading "aquarium". Soft
  // asymmetric ramp: untouched across the upper ~62%, deepest at the bottom edge.
  const seal = (1 - tr.paper) * smoothstep(0.62, 1.0, vUv[1]) * 0.55;
  col = mix3(col as V3, c0, seal);

  return [clamp01(col[0]), clamp01(col[1]), clamp01(col[2])];
}

/** Quantize an RGB `[0,1]` triplet to an 8-bit RGBA byte tuple (a=255). */
export const toRgba8 = (c: V3): readonly [number, number, number, number] => [
  Math.round(clamp01(c[0]) * 255),
  Math.round(clamp01(c[1]) * 255),
  Math.round(clamp01(c[2]) * 255),
  255,
];
