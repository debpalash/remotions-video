# Own Render Engine — Design (codename **Kino**)

*Our own deterministic, component-first video engine. Removes the Remotion license + dependency. Clean-room from the public technique — we study Remotion (cloned to `~/Desktop/research/remotion`, outside this git tree) but copy **no** source.*

---

## 1. Why own it

- **No license / no dependency.** Remotion is free only ≤3 employees; cloud needs a Company License + Cloud Rendering Units. Owning the engine deletes that tax and removes someone else's roadmap from our critical path.
- **Tailored to our goal:** agentic generation of crafty, art-studio marketing/demo/promo video from basic inputs, using Three.js / R3F / p5 / anime.js / framer-motion-class motion — a *component framework*, not a general editor.
- **Performance on our terms:** a high-concurrency render pool tuned for consumer CPUs/GPUs, scaling to many machines.

**What we do NOT rebuild** (this is where renderer projects die): Lambda orchestration, codec exotica, a studio GUI, seeking UI. We **rent** the two commodity pieces — headless Chromium (capture) + ffmpeg (encode) — and **own** the two that are the moat: the *frame contract* and the *component framework*.

---

## 2. Core principle — render is a pure function of `t`

```
frame(t) = f(spec, t)      // deterministic; same t → same pixels, always
```
One source of time: `useFrame()`. **No `requestAnimationFrame`, no wall-clock, no unseeded random.** This is the entire correctness model — break it and parallel frame-capture flickers. The runtime *enforces* it by sandboxing time/RNG (see §5).

This is the same discipline the design system already demands (`SAAS_ROADMAP.md §4`); owning the engine lets us enforce it in the runtime instead of by convention.

---

## 3. Architecture — three layers

```
┌─ RUNTIME (browser, OUR code) ───────────────────────────────┐
│  FrameProvider → useFrame()  · Sequence/Series · interpolate │
│  spring · component framework (scenes/presets/motion tokens) │
│  library adapters: <Three> <P5> <Anime> — all seek to t      │
└──────────────────────────────────────────────────────────────┘
              ▲ renders one frame on demand (?frame=N&comp=…)
┌─ RENDERER (node, OUR code) ──────────────────────────────────┐
│  orchestrator: spawn Chromium contexts · shard frame-ranges  │
│  across worker pool · capture (screenshot | canvas readback) │
│  · per-frame cache · pipe → ffmpeg · mux audio · emit .vtt    │
└──────────────────────────────────────────────────────────────┘
              ▲ rents                          ▲ rents
        headless Chromium (Playwright)   ffmpeg (encode/mux)
```

The `VideoSpec` Zod contract from `SAAS_ROADMAP.md §5` sits **above** this unchanged. Kino is just what consumes the spec instead of Remotion. The brain (ingest → director → spec) and the component taxonomy are renderer-agnostic.

---

## 4. Concurrency — the high-performance core

**Frame-range sharding.** A 90-frame scene on 8 cores → 6 worker contexts each own a contiguous range; determinism makes order irrelevant, so there's zero coordination cost. Wall-time ≈ `frames / workers × per-frame-cost`.

| Knob | Default (8-core consumer Mac) | Rule |
|---|---|---|
| Worker contexts | `cores − 2` (≈6) | capped by RAM (~300–500MB/context) and GPU |
| Capture format | JPEG q90 for drafts, PNG for finals | JPEG ~3× faster to encode |
| Capture path | **DOM → screenshot** \| **canvas → `readPixels`** | pure 3D/generative scenes skip the screenshot tax |
| GPU | Chromium WebGL (Three/p5 shaders) | one shared GPU; don't oversubscribe contexts |

**Two capture paths (the perf lever):**
- **DOM scenes** (typography, UI, layout) → headless screenshot.
- **Pure-canvas scenes** (Three/R3F/p5 generative) → render to offscreen canvas, `gl.readPixels`/`canvas.toBuffer` — **no browser screenshot round-trip**, the single biggest throughput win for the "art-studio 3D" content.

**Scale-out** is the *same shards* dispatched to more machines/containers later — no new model, because frames are independent. Consumer machine today, fleet tomorrow, identical code.

**Incremental re-render (margin + speed):** per-frame cache keyed by `hash(sceneProps + palette + motion + t)`. A copy edit re-renders only the frames of the touched scene. This is what makes the editor's per-scene regen (`SAAS_ROADMAP.md §3`) nearly free.

---

## 5. Determinism sandbox (correctness by construction)

The runtime, before any scene mounts, replaces non-deterministic globals:

| Global | Replacement |
|---|---|
| `requestAnimationFrame` | no-op / driven by `t` |
| `performance.now()` / `Date.now()` | `t / fps × 1000` |
| `Math.random` | seeded PRNG (seed from spec + scene id) |
| p5 | manual draw at `frameCount = t`; `noLoop()` |
| anime.js | instance `.seek(t / fps × 1000)` |
| Three/R3F | render at fixed clock; `frameloop="never"`, step to `t` |

A **lint** over the bundle bans `setInterval`, raw `rAF`, CSS transitions/keyframes, `useFrame()` (R3F's wall-clock hook) — the same ban-list as `SAAS_ROADMAP.md §4`, now enforced at the engine layer.

---

## 6. Build sequencing — de-risk before committing

Nothing of the product is built yet, so we go **engine-native from the start** *if* the spike clears. The contract protects us either way.

| Stage | Deliverable | Go/no-go |
|---|---|---|
| **E0 — SPIKE (½–1 day)** | One component rendered at frames 0…N via Playwright screenshot → ffmpeg → mp4. Measure frames/sec and parallel throughput **on this 8-core machine.** | **THE decision.** If throughput is acceptable, the entire "own engine" thesis is proven. If not, fall back to Remotion-as-scaffold behind the same contract. |
| **E1 — Runtime** | `FrameProvider`/`useFrame`, `Sequence`/`Series`, `interpolate`, `spring` (clean-room), determinism sandbox. Enough to render `SAAS_ROADMAP.md`'s scene archetypes. | A hand-written `VideoSpec` renders through Kino. |
| **E2 — Orchestrator** | Worker pool, frame-range sharding, dual capture paths, ffmpeg pipe, audio mux, per-frame cache. | A multi-scene spec renders concurrently, faster than serial. |
| **E3 — Library adapters** | `<Three>`/R3F, `<P5>`, `<Anime>` deterministic adapters + canvas-readback capture. | A 3D/generative scene renders flicker-free. |
| **E4 — Component framework** | Port the §4 design system (archetypes × presets × motion tokens) onto Kino. | Becomes the prebuilt library the director assembles. |

**Immediate next action: E0 spike.** It is cheap and it is the go/no-go for the whole no-dependency bet. I can build it now: a `kino-spike/` with one animated component, a Playwright frame-capture loop, ffmpeg encode, and a throughput report (fps on your machine, single vs 6-worker).

---

## 7. Risks

| Risk | Defense |
|---|---|
| **Determinism leaks → flicker** | runtime sandbox (§5) + bundle lint; spike explicitly tests a random/time-using scene |
| **Screenshot throughput bottleneck** | canvas `readPixels` path for 3D/generative; JPEG drafts; cache |
| **Font/asset load races** | preload + explicit "frame ready" gate before capture |
| **Memory blow-up (many contexts)** | cap workers by RAM; recycle contexts every K frames |
| **We now own the maintenance** | keep surface minimal — rent Chromium + ffmpeg; don't build studio GUI or Lambda |
| **Legal** | clean-room: study the research clone, write our own; never import/copy Remotion source |

---

## 8. How this fits the roadmap

`SAAS_ROADMAP.md` is unchanged above the renderer line. Kino replaces "Remotion" in §5's pipeline diagram and the cost table (no Cloud Rendering Units line → COGS drops further). The `VideoSpec` contract, registry, director, presets, and anti-slop lint all carry over verbatim — **that's the payoff of having designed renderer-agnostic from the start.**

**Decision for you:** commit to engine-native from E0 (recommended — nothing's built yet, so there's no migration cost and the no-dependency goal is met immediately), or build product on Remotion through P1 and swap Kino in after E2. I recommend the former, gated on the E0 spike result.
