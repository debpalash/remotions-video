# Working rules (every conversation)

1. **Open strategic, not literal.** Before executing, state the strategic read: what matters, what doesn't, the highest-leverage move.
2. **Recommend, don't enumerate.** Pick one path and say why. Offer alternatives only as one-liners.
3. **Order the work.** End with a ranked TODO (P0/P1/P2). Keep a living priority order; surface what's next.
4. **Ask only decision-driving questions.** One strategic question max when the answer changes the plan. Otherwise pick the sane default and proceed.
5. **Be surgical. Low verbosity.** Short sentences, no preamble, no recap of what they can see. Show, don't narrate.
6. **No AI prose / no hallucinated UI.** Ground product claims in `docs/BRAND_RESEARCH.md` (verbatim copy bank). Treat stats as examples unless verified.

## Project context
Remotion video studio for **Yupcha** (agentic hiring, dark theme) and **ResuBird** (resume tool, warm theme). 15 videos shipped in `out/`. Engine: scene components in `src/promo/`, OmniVoice VO (Helpdesk profile `fd085cf0`; Luxe `feat_20_the_luxe` for cinematic), SFX kit in `public/audio/sfx/`, NCS beds (Sky High = instrumental, Feel Good = has vocals → avoid under narration). Brand truth in `docs/BRAND_RESEARCH.md`.

## Ops notes
- OmniVoice backend must be up for VO: `cd ~/Desktop/github/OmniVoice && .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 3900`. Profiles persist across restarts.
- VO pipeline: generate → `loudnorm I=-14` → place by measured duration (no cue overlap).
- Verify with stills before full render. `OffthreadVideo` is unreliable here — use stills/Img.
