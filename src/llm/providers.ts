/**
 * providers.ts — provider-agnostic LLM access for the DIRECTOR.
 *
 * The brain does two small *structured* jobs (emit `VideoSpec`, refine VO copy)
 * — NO codegen. The *validator* (`src/spec` + the director's repair loop), not
 * the model, is the quality gate, which is why a free-tier model suffices.
 *
 * One interface — `LlmProvider.complete({ system, user, jsonSchema })` — hides
 * four provider transports behind it:
 *
 *   - gemini      (default) — Gemini native generateContent with
 *                             `responseMimeType: application/json` +
 *                             `responseSchema` (JSON-schema mode).
 *   - groq        — OpenAI-compatible chat/completions, `response_format`
 *                   json_schema (Llama 3.3 70B — fast, for interactive re-specs).
 *   - openrouter  — OpenAI-compatible gateway (A/B model swap).
 *   - ollama      — local `/api/chat`, `format` = the JSON schema.
 *
 * Provider is chosen by `process.env.LLM_PROVIDER`; keys come from env. All
 * transports use `fetch` (no heavy SDK). Construction never touches the network;
 * a request only fires when `complete()` is awaited.
 *
 * Determinism note (CLAUDE.md / ENGINE_DESIGN §2): nothing here feeds render
 * motion — this is the *brain*, upstream of the `VideoSpec` contract. It may do
 * I/O. The deterministic-`t` rule applies downstream, to the renderer.
 */

/* -------------------------------------------------------------------------- */
/*  Public interface                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A JSON Schema document (draft-7-ish) — the same shape `z.toJSONSchema`
 * produces in `src/spec/registry.ts`. Kept structural so we never import the
 * runtime zod object here; the director passes the schema in.
 */
export type JsonSchema = Record<string, unknown>;

/** A single structured-output request. */
export interface CompleteRequest {
  /** System / instruction prompt (allowed scenes, rules, the contract). */
  system: string;
  /** User content (brand kit + goal, or a repair message). */
  user: string;
  /**
   * The JSON schema the model MUST conform to. Providers that support native
   * schema-constrained decoding (gemini, groq, openrouter, ollama) are handed
   * this directly; it is also the contract the director re-validates against.
   */
  jsonSchema: JsonSchema;
  /**
   * Optional decode controls. Defaults bias toward determinism (low temp) since
   * we want stable, re-validatable structured output, not creative variance.
   */
  temperature?: number;
  maxOutputTokens?: number;
  /** Optional abort signal (caller timeout / cancellation). */
  signal?: AbortSignal;
}

/** The provider-agnostic completion interface. */
export interface LlmProvider {
  /** Stable provider id (for logs / error messages). */
  readonly id: LlmProviderId;
  /**
   * Run one structured completion. Returns the raw text the model emitted
   * (expected to be a JSON document); the director parses + validates it. Throws
   * `LlmError` on transport / HTTP / empty-response failure.
   */
  complete(req: CompleteRequest): Promise<string>;
}

export type LlmProviderId =
  | "gemini"
  | "groq"
  | "openrouter"
  | "ollama"
  | "cerebras";

/** The set of provider ids `LLM_PROVIDER` may select. */
export const PROVIDER_IDS: readonly LlmProviderId[] = [
  "gemini",
  "groq",
  "openrouter",
  "ollama",
  "cerebras",
] as const;

/** Raised on any provider transport failure (network, HTTP, empty body). */
export class LlmError extends Error {
  constructor(
    message: string,
    /** Which provider failed. */
    readonly provider: LlmProviderId,
    /** HTTP status when the failure was an HTTP error. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** Raised at selection time when env config is missing/invalid. */
export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Env helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Minimal env reader. Trims; treats blank/whitespace as absent. */
function env(name: string): string | undefined {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name];
  if (raw == null) return undefined;
  const v = raw.trim();
  return v.length ? v : undefined;
}

/** First non-empty env var among `names`. */
function envAny(...names: string[]): string | undefined {
  for (const n of names) {
    const v = env(n);
    if (v) return v;
  }
  return undefined;
}

/** Resolve the global `fetch`, or throw a clear config error. */
function resolveFetch(injected?: typeof fetch): typeof fetch {
  const f = injected ?? (globalThis as { fetch?: typeof fetch }).fetch;
  if (!f) {
    throw new LlmConfigError(
      "no global fetch available; pass opts.fetchImpl or run on Node >=18",
    );
  }
  return f;
}

/**
 * Shared options every concrete provider accepts. `fetchImpl` is injectable so
 * the director's tests can drive providers without a live network (the task's
 * ".env is empty, do NOT call the API live" constraint is satisfied by simply
 * never invoking `complete()` against a real endpoint).
 */
export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  /** Per-request timeout (ms). Layered under any caller-supplied signal. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Combine a caller `AbortSignal` with a timeout into one signal + cleanup.
 * Avoids `AbortSignal.any`/`timeout` (not in `lib: ["es2015"]`); hand-rolled and
 * deterministic in shape.
 */
function withTimeout(
  timeoutMs: number,
  caller?: AbortSignal,
): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener("abort", onAbort);
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      if (caller) caller.removeEventListener("abort", onAbort);
    },
  };
}

/** Shared POST-JSON helper with timeout + uniform error wrapping. */
async function postJson(
  id: LlmProviderId,
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
): Promise<unknown> {
  const { signal, done } = withTimeout(timeoutMs, callerSignal);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const aborted = (err as { name?: string }).name === "AbortError";
    throw new LlmError(
      aborted
        ? `${id}: request aborted (timeout ${timeoutMs}ms or caller cancel)`
        : `${id}: network error — ${(err as Error).message}`,
      id,
    );
  } finally {
    done();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new LlmError(
      `${id}: HTTP ${res.status} ${res.statusText}${
        detail ? ` — ${detail.slice(0, 400)}` : ""
      }`,
      id,
      res.status,
    );
  }

  try {
    return await res.json();
  } catch (err) {
    throw new LlmError(`${id}: response was not JSON — ${(err as Error).message}`, id);
  }
}

/** Pull a string at a dotted/indexed path; undefined if any hop is missing. */
function dig(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/* -------------------------------------------------------------------------- */
/*  Gemini (default) — native JSON-schema mode                                */
/* -------------------------------------------------------------------------- */

/**
 * Gemini via the public Generative Language REST API. Uses
 * `generationConfig.responseMimeType = "application/json"` and `responseSchema`
 * so the model is constrained to emit schema-valid JSON (JSON-schema mode).
 *
 * Keys (first match wins): `GEMINI_API_KEY` (task convention) → `GOOGLE_AI_API_KEY`
 * → `GOOGLE_API_KEY` (the repo `.env` uses `GOOGLE_AI_API_KEY`).
 */
export class GeminiProvider implements LlmProvider {
  readonly id = "gemini" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: ProviderOptions = {}) {
    this.apiKey =
      opts.apiKey ??
      envAny("GEMINI_API_KEY", "GOOGLE_AI_API_KEY", "GOOGLE_API_KEY") ??
      "";
    this.baseUrl = (
      opts.baseUrl ??
      env("GEMINI_BASE_URL") ??
      "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/+$/, "");
    this.model = opts.model ?? env("GEMINI_MODEL") ?? "gemini-2.5-flash";
    this.fetchImpl = resolveFetch(opts.fetchImpl);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async complete(req: CompleteRequest): Promise<string> {
    if (!this.apiKey) {
      throw new LlmConfigError("gemini: missing GEMINI_API_KEY (or GOOGLE_AI_API_KEY)");
    }
    const url =
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent` +
      `?key=${encodeURIComponent(this.apiKey)}`;

    const body = {
      systemInstruction: { role: "system", parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(req.jsonSchema),
        temperature: req.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: req.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      },
    };

    const json = await postJson(
      this.id,
      this.fetchImpl,
      url,
      {},
      body,
      this.timeoutMs,
      req.signal,
    );

    // Concatenate every text part of the first candidate.
    const parts = dig(json, ["candidates", 0, "content", "parts"]);
    let text = "";
    if (Array.isArray(parts)) {
      for (const p of parts) {
        const t = (p as { text?: unknown }).text;
        if (typeof t === "string") text += t;
      }
    }
    if (!text) {
      const block = dig(json, ["promptFeedback", "blockReason"]);
      throw new LlmError(
        `gemini: empty completion${block ? ` (blockReason: ${String(block)})` : ""}`,
        this.id,
      );
    }
    return text;
  }
}

/**
 * Gemini's `responseSchema` accepts a JSON-Schema-like subset but rejects some
 * keywords (`$schema`, `additionalProperties`, `$ref` definitions, `default`).
 * Deterministically strip the unsupported keys and inline nothing else — the
 * director already owns the authoritative validation, so the on-wire schema only
 * needs to *steer* decoding.
 */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const STRIP = new Set([
    "$schema",
    "$id",
    "$ref",
    "definitions",
    "$defs",
    "additionalProperties",
    "default",
    "const",
    "patternProperties",
  ]);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const src = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(src)) {
        if (STRIP.has(k)) continue;
        out[k] = walk(src[k]);
      }
      return out;
    }
    return node;
  };
  return walk(schema) as JsonSchema;
}

/* -------------------------------------------------------------------------- */
/*  OpenAI-compatible providers (groq, openrouter)                            */
/* -------------------------------------------------------------------------- */

/**
 * Shared transport for the OpenAI-compatible `chat/completions` shape. Both Groq
 * and OpenRouter speak it; they differ only in default base URL, env var names,
 * default model, and a couple of headers.
 */
abstract class OpenAICompatProvider implements LlmProvider {
  abstract readonly id: LlmProviderId;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly model: string;
  protected readonly fetchImpl: typeof fetch;
  protected readonly timeoutMs: number;

  protected constructor(apiKey: string, baseUrl: string, model: string, opts: ProviderOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.model = model;
    this.fetchImpl = resolveFetch(opts.fetchImpl);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Extra headers (e.g. OpenRouter ranking headers). */
  protected extraHeaders(): Record<string, string> {
    return {};
  }

  async complete(req: CompleteRequest): Promise<string> {
    if (!this.apiKey) {
      throw new LlmConfigError(`${this.id}: missing API key`);
    }
    const body = {
      model: this.model,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxOutputTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      // OpenAI structured-output: a named json_schema. `strict` is left OFF —
      // the VideoSpec uses unions / defaults / min-max that the providers' strict
      // subset rejects, and the DIRECTOR re-validates the result anyway (the
      // validator, not the decoder, is the quality gate).
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "VideoSpec",
          strict: false,
          schema: req.jsonSchema,
        },
      },
    };

    const json = await postJson(
      this.id,
      this.fetchImpl,
      `${this.baseUrl}/chat/completions`,
      { authorization: `Bearer ${this.apiKey}`, ...this.extraHeaders() },
      body,
      this.timeoutMs,
      req.signal,
    );

    const content = dig(json, ["choices", 0, "message", "content"]);
    if (typeof content !== "string" || !content) {
      const finish = dig(json, ["choices", 0, "finish_reason"]);
      throw new LlmError(
        `${this.id}: empty completion${finish ? ` (finish_reason: ${String(finish)})` : ""}`,
        this.id,
      );
    }
    return content;
  }
}

/** Groq — OpenAI-compatible; Llama 3.3 70B by default (fast, interactive). */
export class GroqProvider extends OpenAICompatProvider {
  readonly id = "groq" as const;
  constructor(opts: ProviderOptions = {}) {
    super(
      opts.apiKey ?? env("GROQ_API_KEY") ?? "",
      opts.baseUrl ?? env("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1",
      opts.model ?? env("GROQ_MODEL") ?? "llama-3.3-70b-versatile",
      opts,
    );
  }
}

/** OpenRouter — OpenAI-compatible gateway (A/B model swap). */
export class OpenRouterProvider extends OpenAICompatProvider {
  readonly id = "openrouter" as const;
  constructor(opts: ProviderOptions = {}) {
    super(
      opts.apiKey ?? env("OPENROUTER_API_KEY") ?? "",
      opts.baseUrl ?? env("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
      opts.model ?? env("OPENROUTER_MODEL") ?? "meta-llama/llama-3.3-70b-instruct",
      opts,
    );
  }

  protected override extraHeaders(): Record<string, string> {
    // Optional attribution headers OpenRouter uses for ranking; harmless if unset.
    const h: Record<string, string> = {};
    const referer = env("OPENROUTER_REFERER") ?? env("OPENROUTER_SITE_URL");
    const title = env("OPENROUTER_TITLE");
    if (referer) h["HTTP-Referer"] = referer;
    if (title) h["X-Title"] = title;
    return h;
  }
}

/**
 * Cerebras — OpenAI-compatible `chat/completions` with native `json_schema`
 * structured output. Default model `gpt-oss-120b`: a strong reasoning model on a
 * generous, fast free tier (verified to honor the exact base-class body shape —
 * `max_tokens` + `json_schema` strict:false — and return schema-valid content).
 */
export class CerebrasProvider extends OpenAICompatProvider {
  readonly id = "cerebras" as const;
  constructor(opts: ProviderOptions = {}) {
    super(
      opts.apiKey ?? env("CEREBRAS_API_KEY") ?? "",
      opts.baseUrl ?? env("CEREBRAS_BASE_URL") ?? "https://api.cerebras.ai/v1",
      opts.model ?? env("CEREBRAS_MODEL") ?? "gpt-oss-120b",
      opts,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Ollama (local) — /api/chat with `format` = JSON schema                     */
/* -------------------------------------------------------------------------- */

/**
 * Ollama local server. Recent Ollama accepts a JSON schema in `format` for
 * structured output; we pass the schema through and disable streaming so one
 * response object comes back. No API key needed.
 */
export class OllamaProvider implements LlmProvider {
  readonly id = "ollama" as const;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: ProviderOptions = {}) {
    this.baseUrl = (
      opts.baseUrl ??
      env("OLLAMA_BASE_URL") ??
      "http://127.0.0.1:11434"
    ).replace(/\/+$/, "");
    this.model = opts.model ?? env("OLLAMA_MODEL") ?? "llama3.3";
    this.fetchImpl = resolveFetch(opts.fetchImpl);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async complete(req: CompleteRequest): Promise<string> {
    const body = {
      model: this.model,
      stream: false,
      format: req.jsonSchema,
      options: { temperature: req.temperature ?? DEFAULT_TEMPERATURE },
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    };

    const json = await postJson(
      this.id,
      this.fetchImpl,
      `${this.baseUrl}/api/chat`,
      {},
      body,
      this.timeoutMs,
      req.signal,
    );

    const content = dig(json, ["message", "content"]);
    if (typeof content !== "string" || !content) {
      throw new LlmError("ollama: empty completion", this.id);
    }
    return content;
  }
}

/* -------------------------------------------------------------------------- */
/*  Factory                                                                    */
/* -------------------------------------------------------------------------- */

const FACTORIES: Record<LlmProviderId, (o: ProviderOptions) => LlmProvider> = {
  gemini: (o) => new GeminiProvider(o),
  groq: (o) => new GroqProvider(o),
  openrouter: (o) => new OpenRouterProvider(o),
  ollama: (o) => new OllamaProvider(o),
  cerebras: (o) => new CerebrasProvider(o),
};

/** Normalize an arbitrary env string to a known provider id, or `undefined`. */
function parseProviderId(raw: string | undefined): LlmProviderId | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  // Accept a few aliases (the repo `.env` historically used `google_ai`).
  if (v === "gemini" || v === "google" || v === "googleai") return "gemini";
  if (v === "groq") return "groq";
  if (v === "openrouter") return "openrouter";
  if (v === "ollama") return "ollama";
  if (v === "cerebras") return "cerebras";
  return undefined;
}

/**
 * Build a provider, choosing by `process.env.LLM_PROVIDER` (default `gemini`).
 * Construction never hits the network; pass `opts.fetchImpl` to inject a fetch
 * for tests so nothing calls a real API.
 *
 * Falls back to `LLM_DEFAULT_PROVIDER` (the name the repo `.env` actually sets)
 * before defaulting to gemini, so the wiring works with the existing env file.
 */
export function llm(opts: ProviderOptions = {}): LlmProvider {
  const raw = env("LLM_PROVIDER") ?? env("LLM_DEFAULT_PROVIDER");
  const id = parseProviderId(raw) ?? "gemini";
  // An explicit, unrecognized LLM_PROVIDER is a config error (fail loud), but a
  // missing one is fine (default applies).
  if (env("LLM_PROVIDER") && !parseProviderId(env("LLM_PROVIDER"))) {
    throw new LlmConfigError(
      `LLM_PROVIDER="${raw}" is not one of ${PROVIDER_IDS.join(", ")}`,
    );
  }
  return FACTORIES[id](opts);
}
