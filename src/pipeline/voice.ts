/**
 * src/pipeline/voice.ts — wire the VO automation into a spec.
 *
 * Composes `src/vo` (no reimplementation): per scene with `vo.text`, fan out
 * synth → loudnorm(I=-14) → measured duration, then stamp the normalized wav's
 * absolute path back onto `scene.vo.audioUrl`. The render orchestrator then
 * probes those files (ffprobe) and places scenes by measured duration.
 *
 * VO is OPTIONAL: this only runs when OmniVoice is reachable AND a voice is
 * configured. When it doesn't run, scenes keep `vo.audioUrl` unset and the
 * orchestrator falls back to each scene's `minFrames` floor (silent video).
 */
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { VideoSpec } from "../spec";
import {
  runVoPipeline,
  omniVoice,
  LAUNCH_VOICE_PROFILE,
  LAUNCH_VOICE_STYLE,
  type Tts,
  type VoiceStyle,
} from "../vo";
import { REGISTRY, type SceneName } from "../spec";
import { omniVoiceBaseUrl, voiceProfileOverride } from "./env";

export interface SynthVoOptions {
  /** TTS client. Default: OmniVoice at the configured base URL. */
  tts?: Tts;
  /** Directory normalized wavs are written to. Default: a temp dir per spec. */
  outDir?: string;
  /**
   * Override the voice profile for EVERY scene. Takes precedence over the env
   * `OMNIVOICE_PROFILE`. When neither is set NOR a scene authors `vo.profile`,
   * the audition-chosen `LAUNCH_VOICE_PROFILE` (fa99b1a5, "The Companion") is
   * used. The live backend's `/profiles` is the source of truth for valid ids.
   */
  profile?: string;
  /**
   * Default prosody style (speed/seed/instruct) for the whole spec. Defaults to
   * `LAUNCH_VOICE_STYLE` — a slightly slower, warm, breathing read. Per-scene
   * `vo.style` (if any) overrides this field-by-field inside the pipeline.
   */
  style?: VoiceStyle;
  /** Optional progress logger. */
  log?: (msg: string) => void;
}

export interface SynthVoResult {
  /** The spec with `vo.audioUrl` stamped on every successfully-synthesized scene. */
  spec: VideoSpec;
  /** How many scenes got audio. */
  synthesized: number;
  /** Directory the wavs were written to. */
  outDir: string;
}

/**
 * Synthesize + normalize + measure VO for every scene with `vo.text`, returning
 * a NEW spec whose scenes carry `vo.audioUrl` (absolute wav paths). Never
 * mutates the input spec. Fan-out is handled inside `runVoPipeline`.
 *
 * On a per-pipeline transport failure this throws (the caller decides whether to
 * fall back to silent) — but the typical "no backend" case is gated upstream by
 * `omniVoiceReachable`, so this is only called when VO is expected to work.
 */
export async function synthVoForSpec(
  spec: VideoSpec,
  opts: SynthVoOptions = {},
): Promise<SynthVoResult> {
  const log = opts.log ?? (() => {});
  // The deliberate, warm default read lives in the pipeline `style` (passed to
  // runVoPipeline below); a caller-supplied `tts` is used verbatim.
  const runStyle = opts.style ?? LAUNCH_VOICE_STYLE;
  const tts = opts.tts ?? omniVoice({ baseUrl: omniVoiceBaseUrl() });
  const outDir =
    opts.outDir ?? join(tmpdir(), "kino-vo", spec.brandKitId, String(Date.now()));
  await mkdir(outDir, { recursive: true });

  // Profile resolution — the LIVE OmniVoice backend is the source of truth for
  // which profile ids exist (CLAUDE.md ids drift / get recreated with new
  // hashes). When `OMNIVOICE_PROFILE` is set it overrides every scene's
  // `vo.profile`, so a deploy points at whatever profile is loaded right now
  // without re-directing. Unset → the spec's per-scene profile is used as-is.
  const override = opts.profile ?? voiceProfileOverride();
  if (override) log(`[vo] profile override → "${override}" (all scenes).`);

  // Profile resolution order: explicit override > scene's authored profile >
  // the audition-chosen launch default. (The schema default is already the
  // launch profile, so `s.vo?.profile` normally carries it; the ?? guards a
  // hand-built scene that omits it.)
  const voScenes = spec.scenes.map((s) => ({
    id: s.id,
    minFrames: REGISTRY[s.component as SceneName].minFrames,
    text: s.vo?.text,
    profile: override ?? s.vo?.profile ?? LAUNCH_VOICE_PROFILE,
    style: s.vo?.style,
  }));

  const withText = voScenes.filter((s) => (s.text ?? "").trim().length > 0).length;
  log(`[vo] synthesizing ${withText} VO line(s) → loudnorm I=-14 → pad → measure…`);

  const result = await runVoPipeline(tts, voScenes, {
    outDir,
    loudnorm: { I: -14 },
    style: runStyle, // deliberate, warm default; per-scene vo.style overrides it
  });

  // Stamp measured audio paths back onto the spec (immutably).
  const audioById = new Map<string, string>();
  for (const out of result.scenes) {
    if (out.audioPath) audioById.set(out.id, out.audioPath);
  }

  const scenes = spec.scenes.map((scene) => {
    const audio = audioById.get(scene.id);
    if (!audio || !scene.vo) return scene;
    // Record the profile actually used (override wins) so the returned spec is
    // a faithful record of what was synthesized.
    return {
      ...scene,
      vo: { ...scene.vo, audioUrl: audio, profile: override ?? scene.vo.profile },
    };
  }) as VideoSpec["scenes"];

  const synthesized = audioById.size;
  log(`[vo] ${synthesized} scene(s) voiced.`);

  return { spec: { ...spec, scenes }, synthesized, outDir };
}
