// End-to-end per-scene VO pipeline: synth -> loudnorm(I=-14) -> measure.
//
// Fans out across scenes (SAAS_ROADMAP.md §5: "VO ... FAN OUT (N concurrent)")
// then hands the measured durations to the pure placer. The synth provider is
// injected, so prod can pass a hosted-pool `Tts` and dev passes `omniVoice()`.

import { loudnorm, type LoudnormOptions } from "./loudnorm";
import { measureDuration, type MeasureOptions } from "./measure";
import { breathe, padSilence, type PadSilenceOptions } from "./pacing";
import {
  placeScenes,
  type PlaceOptions,
  type PlacementResult,
} from "./place";
import { DEFAULT_PROFILE, type Tts, type VoiceProfile, type VoiceStyle } from "./tts";

export interface VoSceneInput {
  id: string;
  /** Floor when there is no VO line. */
  minFrames: number;
  /** VO line to speak; omit/empty for a silent scene (uses minFrames). */
  text?: string;
  /** Voice profile id. */
  profile?: VoiceProfile;
  /** Per-scene prosody override (merged onto the run-level default style). */
  style?: VoiceStyle;
}

export interface VoSceneOutput {
  id: string;
  /** Normalized wav path, or null for a silent scene. */
  audioPath: string | null;
  /** Measured duration in seconds, or null for a silent scene. */
  voSeconds: number | null;
  /**
   * Set when this scene was MEANT to be voiced but synth/loudnorm/measure
   * failed and it fell back to silence (minFrames). `undefined` => either
   * voiced OK, or intentionally silent (no text).
   */
  error?: string;
}

export interface RunVoOptions {
  /** Directory for intermediate + normalized wavs. */
  outDir: string;
  loudnorm?: LoudnormOptions;
  measure?: MeasureOptions;
  place?: PlaceOptions;
  /**
   * Run-level default prosody style (speed/seed/instruct). Merged UNDER each
   * scene's own `style`. This is where the deliberate, warm default read is
   * injected (see voice.ts `LAUNCH_VOICE_STYLE`).
   */
  style?: VoiceStyle;
  /**
   * Lead-in / tail silence padding applied to each normalized clip so lines
   * don't butt the cut and successive lines get an audible gap. Set to `false`
   * to disable (raw normalized clip). Defaults to gentle padding.
   */
  pad?: PadSilenceOptions | false;
  /**
   * Add sentence breathing to each line before synth (whitespace/terminal
   * punctuation only — no word changes). Default true.
   */
  breathe?: boolean;
  /** Optional per-line progress/error logger. */
  log?: (msg: string) => void;
}

export interface RunVoResult {
  scenes: VoSceneOutput[];
  placement: PlacementResult;
}

/**
 * Synthesize, normalize and measure VO for every scene with text (concurrently),
 * then compute the frame layout. Silent scenes skip audio and fall to minFrames.
 */
export async function runVoPipeline(
  tts: Tts,
  scenes: readonly VoSceneInput[],
  opts: RunVoOptions,
): Promise<RunVoResult> {
  const dir = opts.outDir.replace(/\/+$/, "");
  const log = opts.log ?? (() => {});

  // FAN OUT, but isolate failures: each scene's synth→loudnorm→measure runs in
  // its own try/catch. A line that fails (backend down, model not loaded, bad
  // voice, ffmpeg error) resolves to a SILENT output (null/null) rather than
  // rejecting — so `placeScenes` sizes that one scene to its `minFrames` and the
  // render proceeds. One bad line NEVER aborts the whole batch / the render.
  const doBreathe = opts.breathe ?? true;
  const padOpts = opts.pad === false ? null : (opts.pad ?? {});

  const outputs = await Promise.all(
    scenes.map(async (s): Promise<VoSceneOutput> => {
      const raw = s.text?.trim();
      if (!raw) return { id: s.id, audioPath: null, voSeconds: null };
      // Sentence breathing (pure, word-preserving) before synth.
      const text = doBreathe ? breathe(raw) : raw;

      const profile = s.profile ?? DEFAULT_PROFILE;
      // Run default style under per-scene override.
      const style: VoiceStyle = { ...opts.style, ...s.style };
      const rawPath = `${dir}/${s.id}.raw.wav`;
      const normPath = `${dir}/${s.id}.norm.wav`;
      const padPath = `${dir}/${s.id}.pad.wav`;

      try {
        await tts.synth({ text, profile, style, outPath: rawPath });
        await loudnorm(rawPath, normPath, opts.loudnorm);
        // Lead-in/tail silence so the line doesn't butt the cut. The measured
        // duration below is of the PADDED clip, so the placer sizes the scene
        // to include the breathing room (no separate frame math needed).
        let audioPath = normPath;
        if (padOpts) {
          const { addedSeconds } = await padSilence(normPath, padPath, padOpts);
          audioPath = padPath;
          log(`[vo] ${s.id}: +${addedSeconds.toFixed(2)}s lead-in/tail`);
        }
        const voSeconds = await measureDuration(audioPath, opts.measure);
        log(`[vo] ${s.id}: ${voSeconds.toFixed(2)}s`);
        return { id: s.id, audioPath, voSeconds };
      } catch (err) {
        const msg = (err as Error).message;
        log(`[vo] ${s.id}: FAILED, falling back to silent/minFrames — ${msg}`);
        return { id: s.id, audioPath: null, voSeconds: null, error: msg };
      }
    }),
  );

  const placement = placeScenes(
    scenes.map((s, i) => ({
      id: s.id,
      minFrames: s.minFrames,
      voSeconds: outputs[i].voSeconds,
    })),
    opts.place,
  );

  return { scenes: outputs, placement };
}
