# Video-as-a-Service — from studio to SaaS

> Turn this Remotion studio into a self-serve product: paste a website link + a few assets → get a studio-grade product/marketing video.

## 1. The strategic thesis

The hard, defensible asset already exists: a curated library of **hand-tuned, studio-grade scene components** and a working VO pipeline. The website scraper and the LLM calls are commodities — anyone can wire those up. The moat is **taste encoded as reusable components**, plus a director model that knows which scenes to pick and how to time them.

**Core architectural bet — assembly, not code-generation.**
The LLM does **not** write Three.js / animation code per request. It acts as a *director*: it emits a structured JSON **video spec** that references a registry of parametric scene components. Humans author premium templates; the model only:

- picks and orders scenes,
- fills copy / data / asset slots,
- chooses palette + motion intensity,
- times everything to the generated voiceover.

Why this and not free-form codegen:

| | Template assembly (recommended) | Free-form codegen |
|---|---|---|
| Quality | Consistently studio-grade | Lottery per render |
| Render reliability | Deterministic, pre-tested | Frequent runtime/render failures |
| Cost / latency | One planning call | Many codegen + repair loops |
| Moat | Grows with each template | None — commodity |

The 15 shipped videos in `out/` are both the proof and the taste corpus the director learns from.

## 2. What exists today (assets)

- **Engine:** Remotion 4 + React Three Fiber (`@remotion/three`, `three`), 1920×1080 and 1080×1920 compositions.
- **Scene archetypes** (`src/promo/scenes.tsx`): Hook, Problem, LogoReveal, DashboardShot, AnalysisShot, Stats, Testimonial, CTA — currently hard-wired to brand content.
- **UI primitive kit** (`src/promo/ui.tsx`): Backdrop, Pop, Kicker, Callout, ScreenFrame.
- **Theme system** (`src/promo/theme.ts`): per-brand COLORS / GRADIENT_TEXT / FONTS.
- **VO pipeline:** OmniVoice → `loudnorm I=-14` → place by measured duration (manual today).
- **SFX kit + music beds** (`public/audio/`).
- **Compositions** registered manually in `src/Root.tsx` with fixed durations.

## 3. The gap (what SaaS requires)

1. **Ingestion** — Playwright crawler: logo, palette, fonts, hero/OG images, product-UI screenshots, headline/value-prop copy. *(No ingest code exists yet.)*
2. **Brand-kit synthesis** — scraped data → a generated `theme.ts` equivalent + asset bundle. (Replaces the hand-written theme step.)
3. **Director model** — brand kit + goal + duration + format → **video spec** (typed JSON: ordered scenes, props, copy, palette, motion intensity). *The product brain.*
4. **Parametric scenes** — refactor archetypes to accept all content via props (a Zod-typed `SceneSpec`), so they render from the spec instead of hard-coded copy.
5. **VO automation** — spec → script → TTS → loudnorm → **measured-duration auto-placement that sets each scene's `durationInFrames` dynamically** (no manual cue math).
6. **Render orchestration** — Remotion Lambda or containerized render workers, job queue, object storage, signed download URLs.
7. **Web app** — URL + asset upload, live preview, lightweight editor (swap copy/scene/palette), export. Auth + billing.

## 4. Target wedge (recommended default)

**Self-serve, single-brand product demos for SMB SaaS / indie founders.** Narrow input (one URL + logo), high willingness to pay, clear "before = $5k agency / after = $X self-serve" framing. Agencies and an internal-tool API are fast-follows, not the wedge. *(Flag: confirm before building — it sets which scenes and formats to prioritize.)*

## 5. Architecture (data flow)

```
URL + assets
   │
   ▼
[Ingest]  Playwright → raw brand facts (logo, colors, fonts, copy, screenshots)
   │
   ▼
[Brand kit]  normalize → BrandKit {palette, fonts, logo, screens[], voice, copy[]}
   │
   ▼
[Director LLM]  BrandKit + goal + duration + format → VideoSpec (typed JSON)
   │                                   ▲
   │                                   └── Scene registry (names + prop schemas)
   ▼
[VO]  script → TTS → loudnorm → measured durations ──► back-patch scene durations
   │
   ▼
[Render]  VideoSpec → Remotion composition (data-driven) → Lambda/worker → MP4
   │
   ▼
[Web app]  preview · edit · export · billing
```

**VideoSpec** is the contract between brain and renderer:

```ts
type VideoSpec = {
  format: "16:9" | "9:16" | "1:1";
  brandKitId: string;
  palette: Palette;
  motion: "calm" | "standard" | "punchy";
  scenes: Array<{
    component: SceneName;        // must exist in the registry
    props: Record<string, unknown>; // validated against the scene's Zod schema
    vo?: { text: string };       // drives duration
  }>;
};
```

A single dynamic Remotion composition reads a `VideoSpec`, maps `scenes[]` to registry components, and computes total duration from VO. This replaces the 15 hand-registered compositions in `Root.tsx`.

### 5.1 LLM layer — thin, swappable, free-tier

The model touches only two small jobs: **(a) emit a `VideoSpec`** from the brand kit + goal, and **(b)** optionally write/refine VO script copy. Both are short, structured calls — no free-form design. So:

- **Free tiers are sufficient.** Don't pay for a frontier model to fill template slots.
- **Provider-agnostic client.** A single `llm(prompt, schema)` wrapper; provider chosen via `.env`. Swapping providers must never touch scene/render code.
- **Schema-enforced output + repair loop.** Validate every response against the `VideoSpec` Zod schema; on failure, feed the validation error back once or twice. The validator — not the model — guarantees quality.

Recommended free options (all have JSON/structured output):

| Provider | Model | Why |
|---|---|---|
| **Google Gemini** (default) | 2.x Flash | Generous free tier, native JSON-schema mode → best fit for the director |
| **Groq** | Llama 3.3 70B | Free, extremely fast → use for the interactive editor / quick re-specs |
| **OpenRouter** | free model variants | One gateway, many models → the swap layer; lets you A/B providers |
| **Ollama** (local) | Llama / Qwen | Truly free/OSS for dev + a self-host option later |

`.env` keys to expect (currently empty — drop them in): `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, optional `LLM_PROVIDER=gemini|groq|openrouter|ollama`.

### 5.2 Parallelism (fan-out) — the latency win

Two distinct places fan-out matters:

**A. Inside the platform (runtime).** Per-video latency is the product's biggest UX risk. Most stages parallelize cleanly:
- **Ingest:** crawl pages, grab screenshots, sample palette, pull fonts — concurrent, independent.
- **VO:** generate all scene voiceovers concurrently, then loudnorm in parallel.
- **Render:** render each scene/still as an independent job, then concat. This is the single biggest win — N scenes render in ~1 scene's wall-time on a worker pool.
- **Sequential by necessity:** Director (one planning call) → spec must exist before VO/render. Don't fan out the brain.

**B. In our build process (now).** Fan-out helps *after* a contract is locked, not before. Authoring the foundational contracts (VideoSpec schema, scene registry, dynamic composition) in parallel would produce incompatible patterns. Correct sequencing:
1. **Author the contract solo** (one coherent pass): VideoSpec Zod schema + registry + dynamic composition + one reference scene end-to-end.
2. **Then fan out:** one agent per remaining scene, each refactoring to the *locked* schema — true parallel, no conflicts (worktree-isolated if editing shared files).

The rule both ways: **parallelize independent work against a fixed contract; serialize the work that defines the contract.**

## 6. Quality strategy (the actual moat)

- **Template library is the product.** Invest here continuously; everything else is plumbing.
- **Constrain the LLM hard:** it only emits validated `VideoSpec`. Reject specs that reference unknown scenes or fail prop-schema validation; repair-loop on failure.
- **Verify cheaply:** render still frames per scene before committing the full render (already the studio's practice).
- **Human-in-the-loop edit step** before export catches the 10% the director gets wrong — and the edits become director training signal.

## 7. Risks

- **OffthreadVideo is unreliable here** (per CLAUDE.md) → ingest must produce stills/Img, not video clips, for product-UI shots.
- **Scraping fragility / legality** — respect robots; cache; degrade gracefully when a site blocks Playwright.
- **VO backend** is a local OmniVoice instance today → must become a hosted, queued TTS service before multi-tenant.
- **Render cost/latency** — long videos on Lambda get expensive; price per render-minute, cap durations.
- **Quality variance at scale** — mitigated entirely by the assembly-not-codegen bet.

## 8. Ranked build order

**P0 — prove the loop (one brand, one format, no UI)**
1. Templatize 3–4 scenes to props + Zod schemas; build the scene registry.
2. Build the dynamic `VideoSpec` composition that renders from JSON.
3. Hand-write one `VideoSpec` and render it end to end. *(Proves the contract before any AI.)*

**P1 — automate the brain**
4. Director LLM: BrandKit + goal → valid `VideoSpec` (schema-validated, repair loop).
5. VO automation: spec → TTS → loudnorm → measured-duration back-patching.
6. Playwright ingest → BrandKit synthesis.

**P2 — make it a service**
7. Render orchestration (Remotion Lambda + queue + storage).
8. Web app: input → preview → edit → export.
9. Auth + billing + multi-tenant VO/render.

**Next action:** P0.1 — pick the 3 highest-leverage scenes (suggest Hook, ProductShot/DashboardShot, CTA) and refactor them to be fully prop-driven. That single step de-risks the entire thesis.
