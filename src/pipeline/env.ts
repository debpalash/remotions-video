/**
 * src/pipeline/env.ts — environment capability detection.
 *
 * The pipeline must run KEYLESS and VO-LESS and still produce a real mp4. Two
 * external capabilities are *optional* and detected here, never assumed:
 *
 *   1. An LLM key (GEMINI/GROQ/OPENROUTER, or a local OLLAMA). Present → the
 *      real `src/llm` director runs; absent → `heuristicDirect` (this package).
 *   2. OmniVoice reachable at its backend port. Reachable → VO is synthesized;
 *      unreachable → scenes render silent at their `minFrames` floor.
 *
 * Pure detection only — no side effects beyond a single bounded probe fetch for
 * OmniVoice. Construction-time safe: nothing here throws.
 */

/** Env vars that, when any is non-empty, indicate a usable LLM key/config. */
const LLM_ENV_VARS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  // Ollama is keyless/local: its *host* being set signals an available model.
  "OLLAMA",
  "OLLAMA_HOST",
  "OLLAMA_BASE_URL",
] as const;

/** Read an env var, treating blank/whitespace as absent. */
function env(name: string): string | undefined {
  const raw = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env?.[name];
  if (raw == null) return undefined;
  const v = raw.trim();
  return v.length ? v : undefined;
}

/**
 * True iff an LLM key/config is present in the environment. When true the real
 * provider-backed `direct()` is used; when false the pipeline falls back to the
 * keyless heuristic director so it works with an empty `.env`.
 */
export function hasLlmKey(): boolean {
  for (const name of LLM_ENV_VARS) {
    if (env(name)) return true;
  }
  return false;
}

/** Which LLM env var supplied the key (for logging). `undefined` when keyless. */
export function llmKeySource(): string | undefined {
  for (const name of LLM_ENV_VARS) {
    if (env(name)) return name;
  }
  return undefined;
}

/** Base URL of the OmniVoice backend (CLAUDE.md: 127.0.0.1:3900 in dev). */
export function omniVoiceBaseUrl(): string {
  return (env("OMNIVOICE_URL") ?? "http://127.0.0.1:3900").replace(/\/+$/, "");
}

/**
 * Optional global voice-profile override. The live OmniVoice `/profiles` is the
 * source of truth for which profile ids exist — the documented CLAUDE.md ids
 * (Helpdesk `fd085cf0`, Luxe `feat_20_the_luxe`) are NOT stable across backend
 * rebuilds (profiles get recreated under fresh hashes). Setting
 * `OMNIVOICE_PROFILE=<id>` points a render at whatever profile is loaded now,
 * overriding every scene's authored `vo.profile`. `undefined` => use the spec's
 * per-scene profile as-is.
 */
export function voiceProfileOverride(): string | undefined {
  return env("OMNIVOICE_PROFILE");
}

/**
 * Probe whether OmniVoice is reachable, with a short timeout. Never throws — a
 * connection refusal, DNS failure, or timeout all resolve to `false`, so an
 * absent backend simply means "render silent" rather than a hard failure.
 *
 * Tries a couple of cheap endpoints; any 2xx/3xx/4xx response (i.e. *something*
 * is listening and speaking HTTP) counts as reachable. Only transport-level
 * failure (nothing listening) or a timeout counts as unreachable.
 */
export async function omniVoiceReachable(
  baseUrl: string = omniVoiceBaseUrl(),
  timeoutMs = 1500,
): Promise<boolean> {
  const fetchImpl = (globalThis as { fetch?: typeof fetch }).fetch;
  if (!fetchImpl) return false;

  const probe = async (path: string): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        method: "GET",
        signal: controller.signal,
      });
      // Any HTTP status means a server is up and talking — reachable.
      return res.status > 0;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  // Health first, then root — either being answered proves reachability.
  if (await probe("/health")) return true;
  if (await probe("/")) return true;
  return false;
}
