/**
 * GLSL source for the studio-grade shader mesh-gradient backdrop.
 *
 * This is the real Stripe/Linear-class recipe (see the craft dossier §1a):
 * 3-octave Simplex FBM warps a color field against itself, colors are combined
 * with SCREEN/OVERLAY blend modes (not flat `mix`) so highlights and shadows
 * emerge, then animated film grain + a fine value-noise dither + a vignette are
 * layered on top — all inside the fragment shader so it composites in one draw.
 *
 * DETERMINISM (non-negotiable, ENGINE_DESIGN §2/§5, dossier master-checklist):
 *   - The ONLY time input is `uTime` (= frame/fps, supplied by the `<Three>`
 *     adapter's `useThreeTime`). The shader never reads a clock; it is a closed-
 *     form function of `(vUv, uTime, uSeed)`. No feedback/accumulator.
 *   - All "random" is hash-of-coordinate (`fract(sin(dot(...)))`), never an
 *     engine RNG. Same pixel + same frame → same value, forever.
 *   - Grain is refreshed per-frame via `floor(uTime * uGrainRate)` so each frame
 *     index gets ONE fixed noise field — animated AND reproducible (dossier §1b).
 *   - The host forces `antialias:false`; no dither/AA that varies by driver.
 *
 * The Ashima 2D simplex noise (`snoise`) is the canonical public-domain
 * implementation (Ashima Arts / Stefan Gustavson, MIT) — a pure function, the
 * standard building block; we transcribe it, we do not invent noise.
 */

/** Vertex shader: pass-through, full-screen. `vUv` spans `[0,1]`. */
export const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Ashima 2D simplex noise (MIT). Pure: same input → same output. */
const SNOISE = /* glsl */ `
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

/** Shared helpers: 3-octave FBM, hash, screen/overlay blends. */
const HELPERS = /* glsl */ `
  // 3-octave fractal Brownian motion (lacunarity ~1.9, gain 0.5). Closed-form.
  float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 3; i++){
      v += a * snoise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  // Hash-of-coordinate (seeded), NEVER an RNG. Same pixel+frame → same value.
  float hash21(vec2 p){
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  vec3 screenBlend(vec3 a, vec3 b){ return 1.0 - (1.0 - a) * (1.0 - b); }
  vec3 overlayBlend(vec3 base, vec3 blend){
    return mix(2.0*base*blend,
               1.0 - 2.0*(1.0-base)*(1.0-blend),
               step(0.5, base));
  }
`;

/**
 * Fragment shader. Uniforms:
 *   uTime       float  seconds = frame/fps  (the ONLY clock)
 *   uSeed       float  per-palette phase offset (pure, stable per video)
 *   uResolution vec2   pixel size of the canvas
 *   uColors[4]  vec3   bg, accent, accent2, highlight (normalized RGB)
 *   uFlow       float  domain-warp speed (preset: aurora vs flowing vs near-flat)
 *   uWarp       float  warp amplitude
 *   uScale      float  noise frequency
 *   uGrain      float  film-grain intensity  [0,1]
 *   uGrainRate  float  grain refresh rate (frames/sec of new fields)
 *   uVignette   float  edge-darken strength  [0,1]
 *   uPaper      float  0 = mesh field, 1 = near-flat paper (editorial)
 */
export const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uSeed;
  uniform vec2  uResolution;
  uniform vec3  uColors[4];
  uniform float uFlow;
  uniform float uWarp;
  uniform float uScale;
  uniform float uGrain;
  uniform float uGrainRate;
  uniform float uVignette;
  uniform float uPaper;
  uniform float uSecond;   // weight of the SECONDARY hue (0 = single-hue discipline)

  ${SNOISE}
  ${HELPERS}

  void main(){
    vec2 uv = vUv;
    // Seed offsets the noise DOMAIN (pure) so different palettes get a distinct
    // field while a given video stays byte-identical across shards.
    vec2 sd = vec2(uSeed * 0.137, uSeed * 0.231);

    // Time-warped domain — sin/cos offsets (closed-form), never an accumulator.
    // A gentle aspect skew + large-scale tilt makes the flow read as ONE slow
    // diagonal sweep (premium, directional) rather than an isotropic lava blob.
    float t = uTime * uFlow;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;
    vec2 q = p + uWarp * vec2(
      sin(t * 1.10 + p.y * 2.2 + sd.x),
      cos(t * 0.93 + p.x * 2.2 + sd.y)
    );

    // GROUND — a DEEP near-black base (the brand bg, NOT lifted toward the accent).
    // The CD punch-list #1: "near-black base + a single deep accent radial glow
    // (one light source), kill all brown/rust." The old ground lifted the whole
    // frame toward the accent, which (with a fighting second hue) read as muddy
    // teal/rust fog. The premium look is a SINGLE disciplined hue blooming OUT of
    // darkness — that contrast IS the depth — so the ground stays the brand bg.
    vec3 ground = uColors[0];

    // ONE LIGHT SOURCE — a single deep accent glow, positioned (not isotropic).
    // A slow-drifting radial centre placed UPPER-OFFSET (the "screen light" spill
    // raking in from one corner — a directional key light, not a centered lamp),
    // shaped by the warped field so its edge is organic, never a hard ellipse.
    // A wider falloff window keeps more of the frame LIT (the v2 field was too
    // dark — the glow collapsed to a tiny core, leaving a near-black flat frame).
    vec2  lightPos = vec2(0.34 + 0.10 * sin(t * 0.5 + sd.x),
                          0.30 + 0.06 * cos(t * 0.6 + sd.y));
    float ld = distance(p, lightPos);
    float glow = smoothstep(1.25, 0.02, ld);                 // 1 at source → 0 at far edge (wide reach)

    // Base field: domain-warped FBM remapped to ~[0,1], with a STRONG directional
    // bias so the field flows as one slow diagonal sweep, modulating the glow's
    // organic edge (a real mesh-gradient, not an isotropic boil).
    float bias = (q.x - q.y) * 0.30;
    float n1 = fbm(q * uScale + sd + t * 0.05) * 0.5 + 0.5 + bias;
    // A LUMINOUS lit core that still falls to genuine deep ground at the edges —
    // the premium Stripe/Linear read is high CONTRAST (a bright glow against real
    // near-black), not a uniform bright fog. The glow peak is strong; the floor is
    // low so the frame keeps large deep regions that make the light feel lit.
    float field = clamp(glow * glow * (0.62 + 0.5 * n1), 0.0, 1.0);

    // DOMINANT hue — the single accent, blooming out of the deep ground in one
    // disciplined light region. Pushed to near-full strength so the accent truly
    // SINGS where the light lands (the v2 read flat because the accent never
    // reached its saturated peak before the vignette pulled it back).
    vec3 col = mix(ground, uColors[1], field);

    // SECONDARY hue — DISABLED by default (uSecond = 0 → single-hue discipline).
    // When a preset opts in (e.g. gradient-glass), it is a faint cool/warm SEAM
    // tint only, riding a counter-flow on the far side so the two hues never sit
    // in a 50/50 fight (the old "teal/rust mud"). Capped low and gated by uSecond.
    if (uSecond > 0.0) {
      float n2 = fbm(q * (uScale * 1.12) - sd - t * 0.04) * 0.5 + 0.5 + (q.y - q.x) * 0.24;
      float a2 = smoothstep(0.62, 0.98, n2) * 0.5 * uSecond;
      col = mix(col, screenBlend(col, uColors[2]), a2);
    }

    // Luminance FLOOR — never crush below the deep ground (no dead black holes,
    // no banding in the valleys). The ground is the brand bg so this reads as deep
    // brand color, not muddy lift.
    col = max(col, ground);

    // A single broad, slow specular bloom riding the SAME light source — one soft
    // lit core, screen-blended so it adds light (the liquid/lit read). This is the
    // only highlight; it sculpts the visible depth out of the dark ground. Tinted
    // toward the ACCENT (not pure white) so the bloom reads as a coloured liquid
    // sheen — a brighter, wider core that gives the gradient its premium lift.
    float hiField = smoothstep(0.30, 1.0, glow * (fbm(q * 1.25 + t * 0.06) * 0.5 + 0.5));
    vec3  hiTint  = mix(uColors[3], uColors[1], 0.45);       // accent-tinted highlight
    col = screenBlend(col, hiTint * hiField * 0.42);

    // Editorial paper mode: collapse toward a near-flat ground with the faintest
    // tonal breathing (uPaper = 1). Mesh mode keeps the full field (uPaper = 0).
    vec3 paper = mix(uColors[0], uColors[1], 0.04 + 0.03 * n1);
    col = mix(col, paper, uPaper);

    // Fine value-noise dither — kills 8-bit banding on the gradient (static,
    // hash-of-coordinate; pure). Coords WRAPPED with mod(...) before hashing so
    // highp stays exact across drivers (the fract(sin(dot)) precision trap, B2).
    vec2 ditherHp = mod(uv * uResolution, 289.0);
    float dither = (hash21(ditherHp + mod(sd, 64.0)) - 0.5) * (1.0/255.0) * 1.5;
    col += dither;

    // Animated film grain: ONE fixed field per frame index via floor(uTime*rate).
    // Coords WRAPPED (mod) so the high-magnitude hash argument can't differ in its
    // last bit across heterogeneous GPU/SwiftShader builds (B2 fix).
    float gf = floor(uTime * uGrainRate);
    vec2 grainHp = mod(uv * uResolution, 289.0);
    float g = hash21(grainHp + mod(vec2(gf * 17.13, gf * 31.71), 64.0) + mod(sd, 64.0));
    col += (g - 0.5) * uGrain;

    // Vignette — radial corner darken, multiply. The shader OWNS the vignette
    // (the DOM layer no longer double-darkens); window starts well outward so the
    // center color field stays bright and only the extreme corners settle.
    float d = distance(uv, vec2(0.5));
    float vig = 1.0 - uVignette * smoothstep(0.45, 0.95, d);
    col *= vig;

    // LOWER-THIRD GROUND SEAL — one more notch of deep-ground in the bottom band
    // only (CD: the brightest text frames, e.g. mid-CTA, read slightly "aquarium"
    // because the luminous field reaches all the way to the lower edge with no
    // floor to sit on). We pull the bottom third back toward the deep brand ground
    // with a SOFT, ASYMMETRIC ramp — invisible across the upper ~62% (the luminous
    // core is untouched), easing in below and deepest at the very bottom edge — so
    // the frame gains a cinematic seal underfoot without losing the lit core. Pure
    // function of vUv; mix toward uColors[0] (the brand bg), grain/dither
    // already applied above so the seal never reintroduces banding. Skip for paper.
    float seal = (1.0 - uPaper) * smoothstep(0.62, 1.0, vUv.y) * 0.55;
    col = mix(col, uColors[0], seal);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;
