/**
 * `src/llm` — the DIRECTOR brain.
 *
 * Provider-agnostic LLM access (`providers.ts`) + the director that turns a
 * BrandKit + goal into a validated `VideoSpec` (`director.ts`). The validator
 * (`src/spec` + the repair loop), not the model, is the quality gate — so a
 * free-tier model suffices and a garbage spec never reaches the renderer.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5` (LLM layer), `CLAUDE.md`.
 */
export {
  llm,
  GeminiProvider,
  GroqProvider,
  OpenRouterProvider,
  OllamaProvider,
  toGeminiSchema,
  LlmError,
  LlmConfigError,
  PROVIDER_IDS,
  type LlmProvider,
  type LlmProviderId,
  type CompleteRequest,
  type ProviderOptions,
  type JsonSchema,
} from "./providers";

export {
  direct,
  buildDirectorPrompt,
  validateSceneRefs,
  extractJson,
  SpecValidationError,
  VIDEOSPEC_JSON_SCHEMA,
  type DirectorBrandKit,
  type DirectorGoal,
  type DirectOptions,
} from "./director";
