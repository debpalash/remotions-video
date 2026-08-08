# AI-Assisted Marketing Video SaaS — Roadmap & Spec

*Built on the `remotions-video` Remotion studio (Yupcha + ResuBird). This is the single source of truth: where conflicts existed between council members, a call is made and stated.*

---

## 1. Thesis & positioning

**The bet:** sell *agency-grade-without-the-agency*. Real product UI, motion-designed pacing, human voiceover — rendered deterministically from code, so the entire category of AI-slop artifacts (morphing objects, flicker, gibberish text, drifting logos, dead-eyed avatars) is **structurally impossible**, not merely discouraged.

**Why this makes money.** The market is saturated at the fast/cheap/sloppy end — avatar tools (Synthesia, HeyGen), template-assembly (Pictory, InVideo), generative clips (Runway). As of 2025 that output is a cultural *liability*: "slop" was Merriam-Webster's Word of the Year, slop mentions grew >200%, 82% negative. Every one of those tools optimizes for volume/speed and structurally *cannot* hold a brand-consistent product UI or real typeset text on screen. The open, defensible position is the middle the volume tools abandoned: **agency quality, sub-agency price, faster-than-agency timeline.**

The alternative's price sets our ceiling: a professional 60–90s explainer runs **$5,000–$15,000** at an agency, 2–3 min demos $3,800–$8,000. We deliver comparable output for hundreds, in days. Every tier reads as a 95%+ discount on the real alternative.

**The refusal is the brand.** No synthetic presenters. No stock B-roll. No stock people. No per-frame generation. We say this loudly. It is the wedge and the anti-positioning in one line:

> *"The launch film your product deserves — without the agency invoice or the AI slop. Your actual product, rendered deterministically. Slop is structurally impossible."*

**Lead ICP — decided.** The council split between SMB founder and agency/team. **Lead with the SMB / seed–Series A SaaS founder.** Highest intent, clearest pain (needs a homepage hero + Product Hunt launch film, can't afford $10k, won't ship slop next to a paid product), willing to pay per-deliverable, and the narrowest input surface (one URL) — which is exactly what de-risks P0. Expansion follows the natural ladder: dev-tools → in-house marketing teams → agencies/white-label → API.

The moat is not Remotion (commodity) or the LLM (anyone calls one). **The moat is a finite, frozen, opinionated design system the LLM can only *assemble* — never *style*.** Taste is encoded in locked tokens; the model's degrees of freedom are reduced to narrative grammar and copy. A competitor with a bigger model cannot copy curation.

---

## 2. Market, ICP & monetization

### What makes a video SELL (the value — render is just delivery)
Every default is a verified conversion lever, productized as the *default*, not a setting:

- **Length is the biggest lever.** Cutting a 4-min demo to 90s moved conversion 2.1% → 8.3%, bounce −40%. Default to 30–90s LP cut; platform-cut for social.
- **Pain-led 3-second hook.** 65% who watch 3s reach 10s. Open on the customer's pain, never a logo.
- **Captions burned in, always.** ~91% finish captioned vs 66% uncaptioned; ~69% watch sound-off. Real typeset text, brand-styled.
- **One social-proof beat** (real marks as SVG) — 52–70% LP lifts in cited cases.
- **One offer, one CTA.** Conversion-stage viewers are the least patient.
- **Multi-format from one spec** — 16:9 / 9:16 / 1:1, safe-zone-aware. This is the recurring-use hook.

### Tiers & pricing
Customers see **videos, never credits.** Per-deliverable pricing so quality is never a budget penalty. Credits exist only internally (Render Units) to protect margin. The **$299 one-off is offered at launch** (council decision: yes — COGS <1%, pure CAC-funding margin, lowest-friction proof of premium).

| Tier | Price | Included | Overage |
|---|---|---|---|
| **Free** | $0 | Unlimited outlines + watermarked 720p preview; no clean export | — |
| **Launch** | $39/mo ($390/yr) | 2 finished videos/mo, 1080p, all aspect ratios, captions, 3 revisions each, 1 brand kit | +$25/video |
| **Studio** | $149/mo ($1,490/yr) | 8 videos/mo, 4K, A/B hook variants, priority render, 3 brand kits, remove watermark | +$15/video |
| **Agency** | $499/mo + $39/seat | 30 videos/mo pooled, white-label, client workspaces, brand-kit ingest, shared review links | +$10/video |
| **One-off** | $299 single video | Non-subscribers; converts to credit toward Launch | — |
| **API** | $2.50–$5.00 / render, $250/mo min | Embedded generation, volume breaks at 1k+/mo | usage |

**Why these numbers.** Launch $39 sits clearly above template tools ($19–$89) but signals premium category; Studio $149 matches the team mental model (HeyGen Business $149); Agency $499+seat mirrors proven agency-tooling shape. Sales copy always anchors **"vs. $5,000–$15,000 agency."**

### Render economics & margins
Per ~60–90s 1080p video, Remotion per-scene fan-out:

| Cost line | Per video |
|---|---|
| Lambda/container render (parallel chunks, pay-while-rendering) | $0.30–$0.80 |
| VO (TTS ~150 words) | $0.05–$0.20 |
| Storage + egress + CDN (R2, zero egress) | ~$0.05 |
| Remotion Cloud Rendering Units (paid license) | $0.10–$0.30 |
| **All-in COGS** | **≈ $0.50–$1.50** (4K ~2–3×) |

Launch $39 / 2 videos = $19.50/video → **~95% gross margin.** One-off $299 → COGS <1%. API floor $2.50 on ~$1 COGS → **~60% margin at the cheapest tier.**

**The margin killer is iteration, not render.** Generative tools bleed because users re-roll the expensive step. We invert this structurally: *our* expensive step (final render) sits behind an approval gate; the cheap steps (outline + still-storyboard) absorb all iteration. Final clean render is RU-debited and happens **once per approved video.** 4K and post-approval re-renders are explicit RU multipliers — quality scales price only when the customer opts in.

---

## 3. Product experience

**The spine:** `Paste → Brand-kit confirm → Outline approve → Storyboard approve → Render → Regen loop`. The two approval gates carry all the weight; render is a foregone conclusion. **Design goal: zero surprises at render time.**

### Adaptive input — one box, never a form
- **Simple (best-effort):** paste a URL. Playwright ingest pulls palette, fonts, logo, hero/UI screenshots, copy → synthesizes a BrandKit + a default `VideoSpec` (preset auto-mapped from palette; conversion-checklist template: 3s pain hook → real UI → feature beats → one proof → one CTA, 60–90s).
- **Detailed (richer):** progressive disclosure *below* the box, all optional — goal/platform chips (sets length + safe-zone + aspect), asset uploads (screen recordings, logo, screenshots), a one-line angle ("lead with the ghosting pain"), length/CTA/preset/palette overrides.

Rule (CLAUDE.md #4): never block on detail. Simple input yields a real video; detail only sharpens it. **Input richness — not a pricing toggle — unlocks higher-grade output**, which naturally pulls customers up the ladder.

### The four trust moments (where wasted renders die — in cost order)

| # | Gate | Catches | Cost to show |
|---|---|---|---|
| 1 | **Brand-kit confirm** | wrong logo, bad font scrape, off-palette | ~free (cards) |
| 2 | **Outline approve** (story) | wrong story, bad copy, unverified stat, wrong length/platform | ~free (text) |
| 3 | **Storyboard approve** (look) | wrong frame, wrong look, illegible UI region | seconds (stills) |
| 4 | **Per-scene regen w/ still** | a fix that didn't land | seconds (1 still) |

Full motion render is reached **only after all four pass.** Renders become confirmation, not discovery.

**Gate 2 — Outline** (approve the STORY before the look). Ordered scene cards, editable with zero render cost: rewrite copy inline (verbatim options from `docs/BRAND_RESEARCH.md`), reorder/add/delete, swap archetype, change feature-beat count, toggle preset/platform. Baked-in trust signals: running duration vs platform sweet-spot (green 60–90s / amber over), ⚠ on any unverified stat, ★ marking the one signature motion, "pain-led hook ✓".

**Gate 3 — Storyboard** (approve the LOOK — the render insurance; the insisted-on gate). One **real still keyframe per scene**, rendered through the *actual Remotion compositions* via the stills path (CLAUDE.md: stills are the trusted surface, `OffthreadVideo` is unreliable). Generated in seconds, not the minutes a full render costs. **What they approve is what renders** — no "the preview lied" moment. Optional animatic: play the loudnorm'd VO scratch track over the stills so the user *hears the pacing* without a motion render.

**Editor.** The storyboard *is* the editor — click a keyframe to open an inspector that re-renders one still in seconds. Controls expose **only on-token choices**: copy (with brand-bank suggestions), archetype/asset swap, preset (locks the whole token bundle), palette (from extracted swatches), motion (`calm/standard/punchy` — never raw spring configs), reorder. Constraint is the feature: *the user cannot author slop.*

**Asset search.** Your library (ingested + uploads, brand-scoped) · Capture more (re-run Playwright on a specific route) · a deliberately **narrow** curated kit (device frames, textures, gradient beds, 8-file SFX kit, lucide icons) — **no stock B-roll, no stock people** · upload. Every asset shows on-brand/off-brand at a glance.

**Regen loop — scoped, never global by default.** Regen one scene without re-rendering the rest (chunked render makes this cheap); each regen shows its still-preview *first* before committing; request 2–3 still variants and only the winner renders; VO regen auto-loudnorms and auto-replaces by measured duration (auto-placer recomputes `from` offsets). Every regen names what changed.

---

## 4. The design system (the moat)

A finite system the LLM **assembles** but cannot **style**. The repo already *has* taste (frozen consts, hand-tuned grain, baked springs) — it just isn't *encoded as a system*. This is an **extraction** of the 11 shipped films into ~7 archetypes × 4 presets, then a parameterization.

### Scene taxonomy (fixed, 7 archetypes — one parameterized component each)

| # | Archetype | Job | Extract from (verified) | LLM-fillable slots |
|---|---|---|---|---|
| S1 | **Hook** | one claim, ≤3s, always shortest | `scenes.tsx:73` + `StaggerLine` `:35` | `lines[]` (≤4) |
| S2 | **Problem** | status-quo pain, muted | `scenes.tsx:98` (strike-stamps) | `stamps[]`, `resolve` |
| S3 | **ProductShot** | hero UI + callouts; carries the signature motion | **collapse `DashboardShot:216` / `AnalysisShot:263` / `ResubirdShot:303`** | `kicker`, `headline`, `screen`, `callouts[]` (≤2), `layout` |
| S4 | **FeatureBeat** | repeatable ×2–4, shared layout | `GlowUp.tsx` 4-wrapper pattern | `label`, `region`, `caption`, `earcon` |
| S5 | **Stat** | one number, count-up | `Counter`/`Stats` `:367/433`, `ScoreRing` (resubird `ui.tsx:174`) | `value`, `suffix`, `decimals`, `label`, `viz` |
| S6 | **Proof** | logo wall / one quote, real SVG | `Testimonial:479` | `quote`+`attribution` \| `logos[]` |
| S7 | **CTA** | wordmark + one action, longest hold | `CTA:548` | `wordmark`, `action`, `url` |

**Collapsing the three ProductShot variants into one is the single highest-leverage refactor** — they are already one un-extracted archetype (Kicker → headline → ScreenFrame → Callouts). Narrative rules baked in: ≤1 Hook (first), ≤1 CTA (last), ≤1 Proof, ≤4 FeatureBeat; FeatureBeats in one video share a layout (consistency *is* the premium tell).

### Style presets (pick ONE per video, never mix)
A preset is a frozen token bundle. The LLM picks a preset id; it **cannot edit a preset.**

| Preset | Type | Palette | Background | Motion | Sound | Register |
|---|---|---|---|---|---|---|
| **minimal-mono** | Inter, opsz-correct | near-mono + 1 accent | flat | punchy springs | tick/click | Linear/Raycast |
| **gradient-glass** | Space Grotesk display | accent gradient | dithered gradient, **grain mandatory** | standard curve | soft whoosh | Stripe/Vercel |
| **editorial** | serif + grotesque, ≤66 CPL | off-white/ink | flat/paper | calm, slow | minimal SFX | Apple story |
| **dark-cinematic** | Space Grotesk, tight tracking | teal/orange-class **@ ≤0.6** | aurora + vignette + grain | calm holds, deep settle | bed + sparse impacts | launch film |

**Brand → preset binding (locked):** Yupcha (dark) → `dark-cinematic` or `minimal-mono`; ResuBird (warm) → `editorial` or `gradient-glass`. This is exactly what the two forked kits (`ui.tsx` / `resubird/ui.tsx`) encode today — the system makes it a *data selection* instead of a *different import*. `Backdrop`/`LightBackdrop` become two `BgTreatment` values of one parameterized backdrop.

**Ship exactly four presets.** Range is the enemy; curation is the asset. Four covers both brands and the wedge while every preset stays hand-curated.

### Motion as tokens (kills the baked-in spring problem)
Today every primitive hard-codes its spring (`Pop` = `{damping:16,mass:0.7}` at `ui.tsx:100`). Replace with one token layer the preset selects:

```ts
MotionToken = {
  calm:     { spring:{damping:26,mass:1.0}, enter:24, exit:14, signature:"riseSettle"  },
  standard: { spring:{damping:18,mass:0.8}, enter:18, exit:11, signature:"slideReveal" },
  punchy:   { spring:{damping:12,mass:0.6}, enter:12, exit:8,  signature:"snapScale"   },
}
```
Three principles enforced *by construction*: **asymmetry** (`exit < enter` always — the token cannot express a slow exit); **overshoot discipline** (entrances under-damped, dismissals clamp `damping≥18`); **one signature motion per video** (fires only at S3 reveal + S7 CTA — novelty-per-scene is impossible).

### Anti-slop guardrails — two classes, two structural defenses
**A. Artifact-slop** (morphing, flicker, gibberish text, drifting logos) — *eliminated by construction.* Everything is deterministic vector/DOM: text is real typeset text, logos are SVG, identity is guaranteed across frames. The repo's "use `Img`/`ScreenFrame`, never `OffthreadVideo`" rule is promoted to a **lint**.

**B. Taste-slop** (infinite variance, over-application) — *eliminated by a lint pass over every emitted `VideoSpec`:*

| Guardrail | Rule |
|---|---|
| No off-token color | reject raw hex; colors must be `PaletteKey` → `palette(key, alpha)` (kills the `${COLORS.blue}55` concat) |
| No off-token type/motion/duration | must resolve to preset tokens |
| Grain-on-gradient | any gradient/aurora bg requires `grain>0` (kills 8-bit banding) |
| Restraint cap | grade/glow/parallax ≤0.7; LUT never 100% |
| One preset / one signature | both singular per video; scenes can't override |
| Caption mandatory | every VO-bearing scene auto-burns captions |
| VO-derived timing | scene duration = measured VO clause; no cue overlap |
| Stats are examples | `Stat` without `verified:true` renders an "e.g." affordance |
| Narrative sanity | ≤1 Hook (first), ≤1 CTA (last) |

The lint is the "not-slop" guarantee made executable — it is what lets us sell it per-finished-video.

### Adapting external patterns — harvest the look, rewrite the clock
The one non-negotiable rule: **all motion from `useCurrentFrame()`/`spring()`/`interpolate()`, never `requestAnimationFrame`/wall-clock** (Remotion renders frames out-of-order in parallel tabs; anything timer-driven flickers).

| Source | Take | Substitution → lands as |
|---|---|---|
| React Bits text (BlurText, scramble) | the visual recipe | per-glyph `spring({frame:frame-i*stagger})` → generalize `StaggerLine` |
| React Bits backgrounds (aurora, dots) | field composition | timer → `frame`-driven offset → `BgTreatment` token |
| Motion / motion.dev | spring *math* only | port by hand; **never import** (rAF → flickers) → feeds MotionToken values |
| `@remotion/transitions` | fade/slide/wipe/iris | native; preset caps to ≤2 transition kinds |
| lucide-react (ISC) | inline tree-shakeable SVG | animate stroke/scale via `interpolate(frame)` → S3 callout icon |

**Lint-banned:** GSAP timelines, Matter.js, CSS transitions/keyframes, `whileHover`/`drag`/scroll-linked, R3F `useFrame()`. (Note: no `@remotion/shader` package and no Remotion "virtual-time shim" exist — both were UNVERIFIED/contradicted by docs. Shaders go through `@remotion/three` with `uTime = frame/fps`.)

---

## 5. Technical architecture

**Strategic read: the contract is the architecture.** `VideoSpec` is the only interface that matters — it decouples a fragile, swappable *brain* (scrape + LLM + VO) from a deterministic, pre-tested *renderer*. Everything upstream of the spec is commodity plumbing that can fail and retry; everything downstream is the moat and must be boringly reliable.

### Pipeline & concurrency
```
URL+assets ─▶ [Ingest] Playwright (official MS image, fonts baked)   ← cached by hash(url)
            ─▶ [BrandKit] normalize → {palette,fonts,logo,screens[],copy[],voice}
            ─▶ [Director LLM] BrandKit+goal+format → VideoSpec  ← SEQUENTIAL bottleneck; cache by hash(input)
            ─▶ [VO] per-scene TTS→loudnorm I=-14→measure  ← FAN OUT (N concurrent)
            ─▶ [Render] per-scene job → concat → MP4+thumb+.vtt  ← FAN OUT (N concurrent)
            ─▶ [Deliver] R2 + signed URL · preview/edit/export
```
Director is *one* call (serial by necessity). VO and Render fan out per scene → N scenes finish in ~1 scene's wall-time + a cheap concat. **This per-scene fan-out is the biggest latency win.** Every stage keys on a content hash of its input, so a copy edit re-runs only the touched scene's VO + render.

### The `VideoSpec` contract (Zod) — author this SOLO, first
Discriminated-union per scene so each scene's `props` validate against *its own* schema. Palette is threaded as *data* (fixes the `import {COLORS}` gap). **Scenes carry no `durationInFrames` — duration is derived from measured VO.**

```ts
// src/spec/schema.ts
import { z } from "zod";
import { zColor } from "@remotion/zod-types";          // already a repo dep (Scene.tsx:6)

export const PaletteSchema = z.object({                 // ≤5 swatches (craft rule)
  bg: zColor(), surface: zColor(), text: zColor(), textDim: zColor(),
  accent: zColor(), accent2: zColor().optional(),
  gradientText: z.tuple([zColor(), zColor()]).optional(),
});
export const MotionSchema  = z.enum(["calm","standard","punchy"]);
export const FormatSchema  = z.enum(["16:9","9:16","1:1"]);
export const PresetSchema  = z.enum(["minimal-mono","gradient-glass","editorial","dark-cinematic"]);
export const VoSchema = z.object({
  text: z.string().min(1),
  profile: z.string().default("fd085cf0"),              // OmniVoice Helpdesk; Luxe for cinematic
  audioUrl: z.string().optional(),                      // filled by VO stage
}).optional();

// per-scene prop schemas (registry source of truth) — enums/anchors, NOT free geometry
export const HookProps = z.object({ lines: z.array(z.string()).min(1).max(4) });
export const ProductShotProps = z.object({
  kicker: z.string(), headline: z.string(),
  screen: z.string(),                                   // asset key → still/Img, NEVER OffthreadVideo
  layout: z.enum(["single","split"]).default("single"),
  tilt: z.number().min(-12).max(12).default(6),
  callouts: z.array(z.object({
    title: z.string(), sub: z.string().optional(),
    icon: z.string(),                                   // lucide enum, not arbitrary svg
    anchor: z.enum(["tl","tr","bl","br"]),              // NOT absolute left/top literals
    accent: z.enum(["accent","accent2","text"]),        // PaletteKey, NOT a hex
  })).max(2),
});
export const StatsProps = z.object({
  items: z.array(z.object({
    to: z.number(), suffix: z.string().default(""),
    decimals: z.number().int().min(0).max(2).default(0),
    label: z.string(), verified: z.boolean().default(false),
  })).min(1).max(4),
});
export const CtaProps = z.object({ headline: z.string(), url: z.string() });

export const SceneSpec = z.discriminatedUnion("component", [
  z.object({ id: z.string(), component: z.literal("Hook"),        props: HookProps,        vo: VoSchema }),
  z.object({ id: z.string(), component: z.literal("ProductShot"), props: ProductShotProps, vo: VoSchema }),
  z.object({ id: z.string(), component: z.literal("Stats"),       props: StatsProps,       vo: VoSchema }),
  z.object({ id: z.string(), component: z.literal("CTA"),         props: CtaProps,         vo: VoSchema }),
  // …Problem, FeatureBeat, Proof
]);

export const VideoSpec = z.object({
  version: z.literal(1),
  format:  FormatSchema,
  preset:  PresetSchema,                                 // one preset per video — never mix
  motion:  MotionSchema.default("standard"),
  palette: PaletteSchema,
  brandKitId: z.string(),
  transitions: z.object({
    kind: z.enum(["fade","slide","wipe"]).default("fade"),
    durationInFrames: z.number().int().min(6).max(30).default(15),
  }).default({ kind:"fade", durationInFrames:15 }),
  scenes: z.array(SceneSpec).min(2).max(12),             // hard duration cap = cost cap
});
export type VideoSpec = z.infer<typeof VideoSpec>;
```

### Scene registry — single source of truth, consumed three ways
(runtime render map · Director prompt · validation)

```ts
// src/spec/registry.ts
import { zodToJsonSchema } from "zod-to-json-schema";
type Entry = { component: React.FC<any>; props: z.ZodTypeAny; minFrames: number };

export const REGISTRY = {
  Hook:        { component: Hook,        props: HookProps,        minFrames: 45 },
  ProductShot: { component: ProductShot, props: ProductShotProps, minFrames: 90 },
  Stats:       { component: Stats,       props: StatsProps,       minFrames: 75 },
  CTA:         { component: CTA,         props: CtaProps,         minFrames: 90 },
} satisfies Record<string, Entry>;

export type SceneName = keyof typeof REGISTRY;
// model can ONLY pick these, with these props:
export const REGISTRY_JSON_SCHEMA = Object.fromEntries(
  Object.entries(REGISTRY).map(([k, v]) => [k, zodToJsonSchema(v.props)]),
);
```
`minFrames` is the floor when a scene has no VO (e.g. a logo beat).

### Dynamic composition — replaces the 16 static `<Composition>`s in `Root.tsx`
ONE composition with `schema` + `defaultProps` + `calculateMetadata`. `calculateMetadata` is where VO durations become frame counts (measure with `@remotion/media-utils`, floor at `minFrames`, sum minus transition overlap — matching the existing `YupchaPromo.tsx:27` math).

```tsx
const FORMATS = { "16:9":[1920,1080], "9:16":[1080,1920], "1:1":[1080,1080] } as const;

export const RemotionRoot = () => (
  <Composition id="Video" component={VideoRoot} schema={VideoSpec}
    defaultProps={SAMPLE_SPEC}                            // hand-written spec proves the loop (P0)
    calculateMetadata={async ({ props }) => {
      const fps = 30, [w,h] = FORMATS[props.format];
      const durations = await Promise.all(props.scenes.map(async (s) => {
        const min = REGISTRY[s.component].minFrames;
        if (!s.vo?.audioUrl) return min;
        const sec = await getAudioDurationInSeconds(s.vo.audioUrl);
        return Math.max(min, Math.ceil(sec*fps) + PAD);
      }));
      const T = props.transitions.durationInFrames;
      const total = sum(durations) - T*(props.scenes.length-1);
      return { fps, width:w, height:h, durationInFrames: total, props: { ...props, _durations: durations } };
    }} />
);
```
`VideoRoot` maps `spec.scenes[]` → `REGISTRY[component]` inside a `TransitionSeries`, auto-placing VO/SFX via a running cursor (`cursor += dur - T`), wrapped in a `PaletteProvider value={palette} motion={motion}` so scenes read tokens from context instead of `import {COLORS}` — this is the injection path that unifies the two forked UI kits.

### LLM layer — provider-agnostic, free-tier, validated + repair
The brain does two small structured jobs (emit `VideoSpec`, refine VO copy) — **no codegen.** The *validator*, not the model, is the quality gate, which is why a free-tier model suffices.

```ts
const PROVIDERS = {
  gemini:     geminiProvider,     // default — native JSON-schema mode, generous free tier
  groq:       groqProvider,       // Llama 3.3 70B — fast, interactive editor re-specs
  openrouter: openRouterProvider, // gateway / A-B swap
  ollama:     ollamaProvider,     // local dev / self-host
};
export const llm = () => PROVIDERS[process.env.LLM_PROVIDER ?? "gemini"]();

export async function direct(brandKit, goal): Promise<VideoSpec> {
  const sys = buildDirectorPrompt(REGISTRY_JSON_SCHEMA);   // registry → allowed scenes+props
  let user = JSON.stringify({ brandKit, goal });
  for (let i = 0; i < 3; i++) {
    const raw = await llm().complete({ system: sys, user, jsonSchema: VIDEOSPEC_JSON_SCHEMA });
    const parsed = VideoSpec.safeParse(JSON.parse(extractJson(raw)));
    if (parsed.success && validateSceneRefs(parsed.data)) return parsed.data;
    user += `\nPrevious output INVALID:\n${formatErr(parsed)}\nReturn corrected JSON only.`;
  }
  throw new SpecValidationError();                          // fail closed — never render unvalidated
}
```

### VO automation
OmniVoice is local today; wrap it behind a `tts.synth(text, profile)` interface so local works in dev and a hosted, queued pool serves prod. Per scene, fan out: `synth → ffmpeg.loudnorm(I=-14) → probeDuration → store.put` → a measured-duration manifest `calculateMetadata` consumes. SFX reuse the same running-cursor offset, pitched off the voice band, ducked under VO. Emit `.vtt` from VO text + measured timings (captions mandatory). The bed avoids vocal NCS tracks under narration (repo rule).

### Render orchestration & stack
Per-scene fan-out over a frame range → ffmpeg concat → mux master audio. **Start on containers (Fargate/Fly/Cloud Run + queue)** for the dev/early phase (cleaner local parity, GPU option, no per-scene cold-start tax at low volume); **graduate to Lambda** at burst volume (cheapest, pay-while-rendering; per-scene jobs sit well under the 15-min timeout). Cost controls: hard `scenes.max(12)` duration cap, pre-render cost estimate shown before commit, **still-frame gate before full render**, cache by `hash(scene.props + palette + motion + audioHash)`, per-tenant concurrency cap.

**Storage:** Cloudflare R2 (assets/VO/output — zero egress, video is egress-heavy) keyed by content hash · Postgres `jsonb` for versioned specs (edit history = the human-in-the-loop training corpus) + jobs/billing/tenants.

**Stack summary:** Remotion 4 (already in repo) · Playwright official image (fonts baked) · Gemini Flash default LLM · OmniVoice→hosted TTS + FFmpeg loudnorm · `@remotion/media-utils` for durations · Zod + `@remotion/zod-types` + `zod-to-json-schema` · R2 + Postgres · SQS/Redis + small Node orchestrator · Next.js web app with `<Player>` preview + Stripe.

**Infra cost (early):** containers + R2 + Postgres + Gemini free tier ≈ low hundreds/mo fixed; marginal COGS $0.50–$1.50/video (§2).

---

## 6. Build roadmap

The discipline: **author the `VideoSpec` contract solo, first.** It is the interface every parallel agent codes against — fan-out is only safe once it's frozen.

| Phase | Deliverables | Parallelism | Gate to exit |
|---|---|---|---|
| **P0 — Prove the thesis (no AI)** | (a) `VideoSpec`/`SceneSpec` Zod schemas + registry (`src/spec/`) — **solo, contract-authoring**. (b) Extract **ProductShot** (collapse `scenes.tsx:216/263/303`); refactor **Hook**/**CTA** to props. (c) `PaletteProvider` + `palette(key,alpha)` helper; lift baked springs → MotionToken. (d) ONE dynamic `<Composition>` + `calculateMetadata`. (e) Render one hand-written `SAMPLE_SPEC` end-to-end. | (a) solo. After it freezes: (b)/(c)/(d) **fan out to parallel agents** (one per archetype + one for palette/motion + one for composition shell). | A hand-written spec renders a real MP4. |
| **P1 — Close the loop** | Director LLM (provider-agnostic, validated+repair) · VO automation (TTS→loudnorm→measured durations→auto-placer) · Playwright ingest→BrandKit · the four presets as frozen bundles + brand binding · the `VideoSpec` lint gate. | Director, VO pipeline, ingest, presets = **4 parallel tracks** against the frozen contract. Lint = solo. | URL in → validated spec → rendered video, no human in the spec path. |
| **P2 — Product surface** | Web app: single-box input + **Brand-kit confirm card** + **Outline gate** + **Storyboard stills gate** + inspector editor + per-scene regen (still-first) · asset library/search · auth/billing/multi-tenant · render orchestration (per-scene fan-out + queue + R2 + Postgres) · unify `ui.tsx`/`resubird/ui.tsx`. | Frontend gates, orchestration/queue, billing = **3 parallel tracks**. | Free preview → paid clean export works end-to-end for one external user. |
| **P3 — Scale & expand** | Scene variants (still alternates, render winner only) · VO animatic · Lambda graduation · Agency white-label + client workspaces · $/render API. | Independent features fan out. | First paying agency + first API customer. |

**The single next action:** in `src/spec/schema.ts`, author the `VideoSpec` + `SceneSpec` Zod contract and the `registry.ts` map (P0a), then collapse `DashboardShot`/`AnalysisShot`/`ResubirdShot` (`src/promo/scenes.tsx:216/263/303`) into one prop-driven `ProductShot`. Nothing fans out until this is frozen.

**Pre-P0 blocker — confirm Remotion headcount/license.** Free for companies ≤3 employees; cloud rendering under a paid license requires Cloud Rendering Units. This gates Lambda scale-out (P3) and the COGS line — resolve before committing the render-cost model.

---

## 7. Risks & moat defense

| Risk | Severity | Defense |
|---|---|---|
| **Remotion license / Cloud Rendering Units** | High (blocker) | Confirm headcount pre-P0; ≤3 employees free, else company license + CRUs. Gates the cost model. |
| **`OffthreadVideo` unreliable here** (CLAUDE.md) | High | `screen` slots resolve to **stills/Img only**; ingest produces screenshots, never clips. Enforced by `ProductShotProps` + lint. |
| **VO hosting** (local OmniVoice) | High | Interface-wrap TTS now; hosted queued pool before multi-tenant; cache by `hash(text+profile)`. |
| **Scrape fragility / legality** | High | Cache by URL hash; respect robots; degrade to user-uploaded logo/colors when blocked; web-font *detection ≠ embed rights* → surface a font-license check. |
| **Iteration erodes margin** | Medium | Free outline + still iteration; **RU-gated final render**; bounded revisions; 4K/re-render as explicit RU multipliers. |
| **LLM emits garbage spec** | Medium | Discriminated-union Zod + registry-ref check + 2× repair + fail-closed. The validator is the guarantee, so a free model suffices. |
| **Forked themes block data theming** | Medium | `PaletteProvider` + palette-as-data; unify the two UI kits (P2). |
| **Photoreal avatars get cheap → encroach upward** | Watch | Hold the moat on *real UI / brand control*, which generative models still cannot keep coherent. |

**Moat defense, summarized.** The defensible asset is *curation*, not code: a finite set of hand-tuned presets + archetypes + an executable anti-slop lint. A bigger model can't copy taste, and generative video can't hold real product UI or typeset text. We win by being the only tool where **slop is structurally impossible** — and by making that guarantee legible at the approval gate, which is simultaneously the demo that closes, the trust-builder, and the margin shield.

---

### Verified anchors
`src/promo/scenes.tsx:73` (Hook), `:98` (Problem), `:216/263/303` (ProductShot collapse target — confirmed), `:433` (Stats), `:479` (Testimonial), `:548` (CTA) · `src/promo/ui.tsx:15` (Backdrop), `:100/170/250` (baked springs), `:240` (ScreenFrame) · `src/promo/resubird/ui.tsx:174` (ScoreRing) · `src/promo/theme.ts` + `resubird/theme.ts` (→ Palette tokens) · `src/Root.tsx` (16 static `<Composition>`s → one dynamic) · `src/Scene.tsx:6` (`zColor` already a dep, unused by promos) · `docs/SAAS_VISION.md:79,124,146` · `docs/BRAND_RESEARCH.md` (verbatim copy bank).

*Unverified / treat as examples: OmniVoice profile IDs and `loudnorm I=-14` (CLAUDE.md, no code confirms); soft conversion stats (testimonial +80%, CTA-in-15s +18%, $2,600/min) — verify before sales copy; preset brand "registers" (Linear/Stripe/Apple) are illustrative; no `@remotion/shader` package or Remotion virtual-time shim exists.*
