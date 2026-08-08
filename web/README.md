# Kino Web — the four trust gates

The product surface for the Kino video studio. Implements the
`SAAS_ROADMAP.md §3` spine as four screens over the shared pipeline
(`src/pipeline/generate.ts`):

1. **Input** — one box: paste a URL (+ optional format / platform / angle chips).
2. **Outline gate** — `planOutline()`'s spec as ordered scene cards (component,
   copy, est. duration), running total vs the 60–90s sweet spot, ⚠ on unverified
   stats (the "e.g." affordance), ★ on the single signature motion. Approve →
3. **Storyboard gate** — `renderStoryboard()` stills, one real keyframe per scene.
   *What you approve is what renders.* Approve →
4. **Render + result** — `generateVideo()` / the approved-spec render, then an
   HTML5 `<video>` player of the mp4 + a download button.

It runs **keyless** (heuristic director) and **VO-less** (silent render)
end-to-end — no LLM key and no OmniVoice backend required to produce a real mp4.

## Architecture

- **API routes** (`app/api/*`, Node runtime) call `src/pipeline` server-side and
  never expose keys. The browser only ever sees the JSON they return.
  - `POST /api/outline`   → `planOutline()`   → `{ spec, brandKit }`
  - `POST /api/storyboard`→ `renderStoryboard()` → `{ stills }` (served URLs)
  - `POST /api/render`    → renders the **approved spec** (VO if OmniVoice is up,
    else silent) → `{ spec, videoUrl, stills, brandKit }`
  - `GET  /api/asset?p=`  → streams stills/mp4 from `../out/` (Range-aware,
    traversal-hardened; confined to the `out/` tree).
- **UI accents** come from the ingested brand palette
  (`themeFromBrandKit` → CSS vars).
- The shared pipeline is imported through `lib/pipeline.server.ts`
  (server-only); client components import **types only** from `lib/types.ts`.

## Run it

Prereqs (from the repo root, once): the pipeline rents headless Chromium + ffmpeg.

```bash
# repo root
bunx playwright install chromium   # browser for the render orchestrator
# ensure ffmpeg/ffprobe are on PATH (brew install ffmpeg)
```

Then:

```bash
cd web
bun install        # installs next + react (web/package.json)
bun run dev        # http://localhost:3000
```

Optional (sharper output, not required):

- **LLM director** — set any of `GEMINI_API_KEY` / `GROQ_API_KEY` /
  `OPENROUTER_API_KEY` (or `OLLAMA_HOST`) in the repo `.env`. Absent → the
  keyless heuristic director writes the outline.
- **Voiceover** — run OmniVoice at `127.0.0.1:3900` (see `CLAUDE.md`). Absent →
  the render is silent at each scene's `minFrames` floor.

### Root convenience script

`bun run web` from the repo root maps to the above. If it is not yet wired in the
root `package.json`, add:

```jsonc
// package.json (root) — "scripts"
"web": "cd web && bun run dev"
```

(The web app does not modify the root `package.json`; the integrator adds this
one line.)
