// Provider-agnostic TTS synthesis.
//
// `Tts` is the only contract callers depend on. The OmniVoice HTTP impl is the
// default for local dev (CLAUDE.md: backend on 127.0.0.1:3900). Swapping to a
// hosted, queued pool is a matter of providing a different `Tts` to the caller —
// nothing here requires the server to be reachable at import time.

import { writeFile } from "node:fs/promises";

/** A voice profile id understood by the backend (e.g. OmniVoice "fd085cf0"). */
export type VoiceProfile = string;

/**
 * Prosody/voice-design knobs the backend's `/v1/audio/speech` accepts (verified
 * against the live openapi.json `SpeechRequest` schema). These are what make a
 * read sound *deliberate and human* instead of staccato-mechanical:
 *
 *  - `speed` (0.25–4.0): a value slightly below 1 slows the read so clauses land
 *    instead of rattling past — the single biggest anti-"mechanical" lever.
 *  - `seed`: deterministic sampling seed. The model is NOT bit-exact across runs
 *    even with a fixed seed, but a stable seed keeps the *character* of the read
 *    consistent; the on-disk wav is the real determinism boundary (cached by
 *    `cacheKey`, reused across video renders so the muxed stream is stable).
 *  - `instruct`: free-text style direction (e.g. "warm, unhurried, conversational").
 */
export interface VoiceStyle {
  /** 0.25–4.0. <1 = slower/more deliberate. */
  speed?: number;
  /** Deterministic sampling seed. */
  seed?: number;
  /** Style instruction passed to the engine (warmth/pace/tone). */
  instruct?: string;
}

export interface SynthRequest {
  /** The line(s) to speak. */
  text: string;
  /** Voice profile id. Defaults to the warm "Companion" profile (see voice.ts). */
  profile?: VoiceProfile;
  /** Prosody knobs (speed/seed/instruct). Merged onto the impl defaults. */
  style?: VoiceStyle;
  /**
   * Absolute path the raw wav should be written to. If omitted the impl picks a
   * deterministic temp path derived from `hash(text + profile + style)` so
   * identical requests collide on the same file (caching-friendly).
   */
  outPath?: string;
}

export interface SynthResult {
  /** Absolute path to the synthesized wav on disk. */
  wavPath: string;
  /** Profile actually used. */
  profile: VoiceProfile;
}

/** The provider-agnostic synthesis interface. Implementations MUST write a wav. */
export interface Tts {
  synth(req: SynthRequest): Promise<SynthResult>;
}

export const DEFAULT_PROFILE: VoiceProfile = "fa99b1a5";

/**
 * Stable, collision-free temp path for a (text, profile, style) tuple. Pure
 * function of its inputs so repeated synth requests for the same line+style
 * reuse one file. Extends the roadmap's `hash(text+profile)` key (§5) to cover
 * the prosody knobs (speed/seed/instruct) so changing the read yields a fresh
 * file while an unchanged read reuses the cached wav. This on-disk reuse is the
 * determinism boundary: the TTS model is NOT bit-exact across runs, so reusing
 * the cached wav (not a re-synth) is what keeps the muxed video stream stable.
 */
export function cacheKey(
  text: string,
  profile: VoiceProfile,
  style?: VoiceStyle,
): string {
  // FNV-1a 32-bit — deterministic, no crypto import, good enough for a filename.
  let h = 0x811c9dc5;
  const s = `${profile}|${style?.speed ?? ""}|${style?.seed ?? ""}|${style?.instruct ?? ""}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface OmniVoiceOptions {
  /** Base URL of the OmniVoice backend. */
  baseUrl?: string;
  /** Directory raw wavs are written to when `outPath` is not given. */
  tmpDir?: string;
  /** Injectable fetch (for tests / non-global-fetch runtimes). */
  fetchImpl?: typeof fetch;
  /** Per-request (per-attempt) timeout in ms. */
  timeoutMs?: number;
  /**
   * Extra attempts after the first on a transport/5xx/timeout failure. Total
   * tries = retries + 1. A 4xx (bad request — e.g. unknown voice) is NOT
   * retried, since retrying a deterministic rejection only wastes wall-time.
   * Default 1 (so a flaky synth gets one second chance).
   */
  retries?: number;
  /**
   * Backoff in ms between attempts. Default 400. Kept short: the placer derives
   * timing from whatever does succeed, and a hard-down backend is better surfaced
   * fast to the per-line silent fallback than masked by long retries.
   */
  retryBackoffMs?: number;
  /** TTS engine/model id. Default "omnivoice" (the backend's active engine). */
  model?: string;
  /** Output audio format. Default "wav" so loudnorm/measure read a lossless container. */
  responseFormat?: "wav" | "pcm" | "flac" | "mp3" | "opus" | "aac";
  /**
   * Default prosody style applied to every synth (overridable per-request via
   * `SynthRequest.style`). This is where the "less mechanical" default lives:
   * a slightly slower `speed` + a stable `seed` + a warm `instruct`.
   */
  defaultStyle?: VoiceStyle;
}

/**
 * OmniVoice HTTP implementation of `Tts`.
 *
 * Construction does NOT touch the network — the server only needs to be up when
 * `synth` is actually called.
 */
export class OmniVoiceTts implements Tts {
  private readonly baseUrl: string;
  private readonly tmpDir: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryBackoffMs: number;
  private readonly model: string;
  private readonly responseFormat: string;
  private readonly defaultStyle: VoiceStyle;

  constructor(opts: OmniVoiceOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "http://127.0.0.1:3900").replace(/\/+$/, "");
    this.tmpDir = opts.tmpDir ?? "/tmp";
    const f = opts.fetchImpl ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) {
      throw new Error(
        "OmniVoiceTts: no fetch available; pass opts.fetchImpl or run on Node >=18",
      );
    }
    this.fetchImpl = f;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.retries = Math.max(0, opts.retries ?? 1);
    this.retryBackoffMs = Math.max(0, opts.retryBackoffMs ?? 400);
    this.model = opts.model ?? "omnivoice";
    this.responseFormat = opts.responseFormat ?? "wav";
    this.defaultStyle = opts.defaultStyle ?? {};
  }

  async synth(req: SynthRequest): Promise<SynthResult> {
    const text = req.text.trim();
    if (!text) throw new Error("OmniVoiceTts.synth: empty text");
    const profile = req.profile ?? DEFAULT_PROFILE;
    // Per-request style overrides the client default field-by-field.
    const style: VoiceStyle = { ...this.defaultStyle, ...req.style };
    const wavPath =
      req.outPath ?? `${this.tmpDir}/vo_${cacheKey(text, profile, style)}.wav`;

    // Retry transport/timeout/5xx; a 4xx (e.g. unknown voice) is deterministic —
    // fail it immediately so the per-line fallback kicks in without wasting time.
    let lastErr: Error = new Error("OmniVoiceTts.synth: no attempt made");
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const buf = await this.attempt(text, profile, style);
        await writeFile(wavPath, buf);
        return { wavPath, profile };
      } catch (err) {
        lastErr = err as Error;
        if ((err as { fatal?: boolean }).fatal) break; // 4xx — don't retry
        if (attempt < this.retries && this.retryBackoffMs > 0) {
          await new Promise((r) => setTimeout(r, this.retryBackoffMs));
        }
      }
    }
    throw lastErr;
  }

  /** One synth attempt. Throws; marks `.fatal=true` on a non-retryable 4xx. */
  private async attempt(
    text: string,
    profile: VoiceProfile,
    style: VoiceStyle,
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    // OmniVoice exposes an OpenAI-compatible speech endpoint
    // (`POST /v1/audio/speech`) — there is no `/tts` route (it 405s). The body
    // uses `input` for the text and `voice` for the profile id; we request a
    // `wav` so the downstream loudnorm/measure ffmpeg steps read a lossless
    // container. (Verified live against the running backend's openapi.json +
    // 422/405 probes.)
    const endpoint = `${this.baseUrl}/v1/audio/speech`;
    let res: Response;
    try {
      res = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: profile,
          response_format: this.responseFormat,
          // Prosody knobs (omitted when undefined so the backend keeps its
          // defaults). `speed` < 1 is the primary anti-mechanical lever.
          ...(style.speed != null ? { speed: style.speed } : {}),
          ...(style.seed != null ? { seed: style.seed } : {}),
          ...(style.instruct != null ? { instruct: style.instruct } : {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      // Transport error or timeout (abort) — retryable.
      throw new Error(
        `OmniVoiceTts.synth: request to ${endpoint} failed: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const e = new Error(
        `OmniVoiceTts.synth: backend ${res.status} ${res.statusText}${
          detail ? ` — ${detail.slice(0, 300)}` : ""
        }`,
      ) as Error & { fatal?: boolean };
      // 4xx (except 429) is a deterministic client error — not worth retrying.
      e.fatal = res.status >= 400 && res.status < 500 && res.status !== 429;
      throw e;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) {
      throw new Error("OmniVoiceTts.synth: backend returned empty audio");
    }
    return buf;
  }
}

/** Convenience: the default local OmniVoice client. */
export function omniVoice(opts?: OmniVoiceOptions): Tts {
  return new OmniVoiceTts(opts);
}
