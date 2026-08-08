/**
 * `src/pipeline` — the SHARED PIPELINE.
 *
 * The single composition layer over ingest → director → vo → render → lint that
 * the web app and integrator code call. Three entrypoints:
 *
 *   planOutline(input)     → { spec, brandKit }                  (no render)
 *   renderStoryboard(spec) → { stills }                          (cheap gate)
 *   generateVideo(input)   → { spec, outPath, stills, brandKit } (full mp4)
 *
 * Works KEYLESS (heuristic director) and VO-LESS (silent render) — a real URL
 * always yields a real mp4. See `docs/SAAS_ROADMAP.md §3/§5`.
 */
export {
  planOutline,
  renderStoryboard,
  generateVideo,
  type PipelineInput,
  type PlanOptions,
  type StoryboardRenderOptions,
  type GenerateOptions,
  type Logger,
  type DirectorGoal,
  type BrandKit,
  // Documented I/O aliases the web bridge codes against.
  type PlanOutlineInput,
  type GenerateVideoInput,
  type PlanOutlineResult,
  type StoryboardResult,
  type GenerateVideoResult,
} from "./generate";

// The keyless director — exported so the web app / tests can pre-plan without
// any LLM (it is what `planOutline` falls back to).
export { heuristicDirect } from "./heuristic";

// Environment capability probes (LLM key present? OmniVoice reachable?).
export {
  hasLlmKey,
  llmKeySource,
  omniVoiceReachable,
  omniVoiceBaseUrl,
} from "./env";

// VO + storyboard internals, exposed for the web app's gate surfaces.
export { synthVoForSpec, type SynthVoResult, type SynthVoOptions } from "./voice";
export {
  renderStoryboardStills,
  type StoryboardResult as StoryboardStillsResult,
  type StoryboardOptions,
} from "./storyboard";
