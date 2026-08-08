/**
 * `src/kino-scenes/captions` — the burned-in caption layer (the conversion lever
 * from `SAAS_ROADMAP.md §2`: "Captions burned in, always").
 *
 * Two halves of one feature, sharing a single cue model so the on-screen band and
 * the emitted `.vtt` can never drift:
 *  - `./cues`        — pure derivation of timed `CaptionCue[]` from each scene's
 *                      `vo.text` + its measured frame window, plus WebVTT
 *                      serialisation (consumed by the render orchestrator).
 *  - `./CaptionBand` — the frame-driven, safe-zone-aware, on-brand DOM band that
 *                      shows the active cue (composes over the scene stack).
 *
 * Everything is a pure function of `useFrame()` / its inputs — determinism
 * preserved (`ENGINE_DESIGN.md §2`).
 */
export {
  type CaptionCue,
  type CaptionSceneInput,
  type BuildCuesOptions,
  chunkLine,
  buildSceneCues,
  buildCaptionTrack,
  captionTextForScene,
  activeCue,
  frameToVttTime,
  trackToVtt,
} from "./cues";

export { CaptionBand, type CaptionBandProps } from "./CaptionBand";
