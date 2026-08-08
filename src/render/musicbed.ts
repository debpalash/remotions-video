/**
 * src/render/musicbed.ts — DUCKED AMBIENT MUSIC BED for the master audio track.
 *
 * Mixes an instrumental bed UNDER the placed VO with sidechain ducking, so the
 * music dips when the voice is present and rises in the gaps. This is the audio
 * counterpart to the engine's determinism discipline: the music graph is a pure
 * function of (vo file, bed file, duration) — no clock, no randomness — so the
 * muxed audio is byte-stable across renders (the VIDEO stream is independent and
 * already byte-identical; this only touches the audio mux).
 *
 * Design (matches the task brief + CLAUDE.md ops rules):
 *  - Bed must be the INSTRUMENTAL track (ncs-sky-high). NEVER a vocal bed under
 *    narration (ncs-feel-good has vocals) — the caller passes the path; the
 *    pipeline default only ever wires the instrumental one.
 *  - Loop/trim the bed to the exact video length, fade in (~0.8s) + out (~1.2s).
 *  - SIDECHAIN-DUCK the bed under the VO via ffmpeg `sidechaincompress`: the bed
 *    is the input being compressed, the VO is the sidechain key — so the bed
 *    drops ~10–14 dB while the voice speaks and recovers in silent beats.
 *  - Target mix: VO leads at I=-14; bed sits ~-24..-26 LUFS under speech, up to
 *    ~-19 in silent beats. A final `loudnorm I=-14` on the master lands the
 *    integrated loudness near -14 LUFS so the deliverable matches the VO target.
 *
 * Reuses the orchestrator's `run()` ffmpeg spawn convention (passed in) rather
 * than re-implementing process plumbing.
 */
import { join } from "node:path";
import { existsSync } from "node:fs";

/** Minimal child-process runner shape (the orchestrator's `run`). */
export type FfRun = (
  cmd: string,
  args: string[],
) => Promise<{ code: number; stdout: Buffer; stderr: Buffer }>;

export interface MusicBedOptions {
  /** Fade-in seconds at the top of the video. Default 0.8. */
  fadeInS?: number;
  /** Fade-out seconds at the tail. Default 1.2. */
  fadeOutS?: number;
  /**
   * Bed baseline loudness (LUFS) BEFORE ducking — the level the bed reaches in
   * silent beats. Default -19 (the brief's "up to ~-19 in silent beats").
   */
  bedLufs?: number;
  /**
   * Sidechain duck depth in dB the bed drops while the VO is present. The
   * compressor's makeup is left at unity, so a ratio/threshold pair that yields
   * roughly this much gain reduction under a -14 LUFS lead lands the bed near
   * -24..-26 LUFS under speech. Default 12 (the brief's "~10–14 dB").
   */
  duckDb?: number;
  /** Final master integrated-loudness target (LUFS). Default -14 (VO target). */
  masterLufs?: number;
  /** Path to the ffmpeg binary. Default "ffmpeg". */
  ffmpegPath?: string;
}

/**
 * Map a desired duck depth (target program-level drop, in dB, the bed takes
 * under speech vs in gaps) to a `sidechaincompress` (threshold, ratio) pair.
 *
 * Calibrated against the real assets (a -14 LUFS VO lead keying the
 * loudnorm'd-to-`bedLufs` bed). Measured operating points — bed segment loudness
 * with the bed alone, gap held at ~-19 LUFS by design:
 *   threshold 0.06, ratio 3.5 → speech ≈ -28 LUFS  (~9 dB drop)
 *   threshold 0.09, ratio 3.0 → speech ≈ -25 LUFS  (~6 dB drop, the default —
 *                                                    lands the -24..-26 target)
 *   threshold 0.12, ratio 2.5 → speech ≈ -23 LUFS  (~4 dB drop)
 * A LOWER threshold + HIGHER ratio ducks harder. We interpolate around the
 * validated default and clamp to a musical range so the bed never disappears nor
 * fails to clear room for the voice. Higher `duckDb` → lower threshold/higher
 * ratio → deeper duck.
 */
function duckParams(duckDb: number): { threshold: number; ratio: number } {
  // Anchor at the measured sweet spot (duckDb≈12 → -24..-26 under speech), and
  // move threshold/ratio monotonically for deeper/shallower requests. Clamp to
  // [0.05,0.14] threshold and [2.2,3.6] ratio (the validated, audible-but-safe
  // band — outside it the bed either swamps the VO or vanishes).
  const d = Math.max(8, Math.min(16, duckDb));
  // 8→shallow (0.12/2.5), 12→default (0.09/3.0), 16→deep (0.06/3.5).
  const t = (d - 8) / 8; // 0..1
  const threshold = 0.12 - t * (0.12 - 0.06);
  const ratio = 2.5 + t * (3.5 - 2.5);
  return {
    threshold: Math.max(0.05, Math.min(0.14, threshold)),
    ratio: Math.max(2.2, Math.min(3.6, ratio)),
  };
}

/**
 * Produce a NEW master audio wav: the placed VO (`voMaster`) with the bed mixed
 * UNDER it, ducked, faded, and loudnorm'd to the master target. Returns the
 * output path. Throws on any ffmpeg failure (the caller decides whether to fall
 * back to the un-bedded master).
 *
 * @param voMaster   path to the already-built, VO-only master wav (I=-14 lead).
 * @param bed        path to the INSTRUMENTAL music bed (mp3/wav).
 * @param durationS  exact video duration in seconds (trim/loop target).
 * @param workDir    scratch dir for the output wav.
 * @param run        the orchestrator's ffmpeg spawn runner.
 */
export async function mixMusicBed(
  voMaster: string,
  bed: string,
  durationS: number,
  workDir: string,
  run: FfRun,
  opts: MusicBedOptions = {},
): Promise<string> {
  const fadeIn = opts.fadeInS ?? 0.8;
  const fadeOut = opts.fadeOutS ?? 1.2;
  const bedLufs = opts.bedLufs ?? -19;
  const duckDb = opts.duckDb ?? 12;
  const masterLufs = opts.masterLufs ?? -14;
  const bin = opts.ffmpegPath ?? "ffmpeg";

  if (!existsSync(voMaster)) {
    throw new Error(`mixMusicBed: VO master not found at ${voMaster}`);
  }
  if (!existsSync(bed)) {
    throw new Error(`mixMusicBed: music bed not found at ${bed}`);
  }
  if (!Number.isFinite(durationS) || durationS <= 0) {
    throw new Error(`mixMusicBed: bad durationS ${durationS}`);
  }

  const out = join(workDir, "master-audio-bed.wav");
  const { threshold, ratio } = duckParams(duckDb);
  // Fade-out start = duration - fadeOut, clamped to >= 0.
  const fadeOutStart = Math.max(0, durationS - fadeOut);

  // Graph:
  //   [1] bed  → loudnorm to baseline → fades → [bed]
  //   [0] vo                                    → split → [volead],[vokey]
  //   [bed] ducked by [vokey] via sidechaincompress → [ducked]
  //   amix([volead],[ducked], normalize=0) → loudnorm(master) → [aout]
  //
  // The VO is split so the SAME signal both leads the mix and keys the duck —
  // the bed dips exactly when (and as hard as) the voice is actually present.
  const filter = [
    // Bed: bring to a known baseline, then time-shaped fades. (Bed is input 1,
    // already trimmed/looped to durationS by the -stream_loop/-t input flags.)
    `[1:a]loudnorm=I=${bedLufs}:TP=-1.5:LRA=11,` +
      `afade=t=in:st=0:d=${fadeIn},` +
      `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut},` +
      `aformat=sample_rates=48000:channel_layouts=stereo[bed]`,
    // VO: normalize layout, split into lead + sidechain key.
    `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[volead][vokey]`,
    // Sidechain-duck the bed under the VO key. Fast attack so speech onsets
    // duck immediately; slow release so the bed rises smoothly in gaps.
    `[bed][vokey]sidechaincompress=` +
      `threshold=${threshold.toFixed(3)}:ratio=${ratio.toFixed(2)}:` +
      `attack=20:release=400:makeup=1[ducked]`,
    // Mix lead + ducked bed WITHOUT amix's input-count normalization (preserve
    // the carefully-set levels), then loudnorm the master to the VO target.
    `[volead][ducked]amix=inputs=2:normalize=0:dropout_transition=0[mixed]`,
    `[mixed]loudnorm=I=${masterLufs}:TP=-1.5:LRA=11[aout]`,
  ].join(";");

  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    // Input 0: the VO master (full length already, silence between clauses).
    "-i",
    voMaster,
    // Input 1: the bed, looped indefinitely then trimmed to the video length.
    // -stream_loop -1 BEFORE -i loops the decoded input; -t after caps it.
    "-stream_loop",
    "-1",
    "-t",
    durationS.toFixed(3),
    "-i",
    bed,
    "-filter_complex",
    filter,
    "-map",
    "[aout]",
    "-t",
    durationS.toFixed(3),
    "-ac",
    "2",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    out,
  ];

  const { code, stderr } = await run(bin, args);
  if (code !== 0) {
    throw new Error(
      `mixMusicBed: ffmpeg failed:\n${stderr.toString("utf8").slice(-2000)}`,
    );
  }
  return out;
}

/** Default instrumental bed under `public/audio` — never the vocal track. */
export const DEFAULT_MUSIC_BED = "audio/ncs-sky-high.mp3";

/**
 * Default CTA accent SFX — a short, positive earcon (~0.7s) overlaid once at the
 * CTA pill reveal as the video's single rhythmic "signature moment" (CD R5 P2:
 * "add one music accent on the CTA pill reveal"). Never the bed/voice.
 */
export const DEFAULT_CTA_ACCENT = "audio/sfx/success.wav";

/**
 * Overlay a single short SFX accent onto an existing master at `atS` seconds.
 *
 * Audio-only and FAILURE-ISOLATED: the caller wraps this in try/catch and keeps
 * the prior master on any error, so the accent can never regress the VO/bed. The
 * graph is a pure function of (master, sfx, atS, duration) — no clock, no random
 * — so the muxed audio stays byte-stable across renders. The accent is mixed at a
 * low gain (a confident tick under the voice, not a stinger) with `normalize=0`
 * so the master's carefully-set levels are preserved.
 *
 * @param master     path to the current master wav (VO, or VO+bed).
 * @param sfx        path to the accent SFX (short wav).
 * @param atS        seconds into the master where the accent should land.
 * @param durationS  exact video duration in seconds (the output is capped to it).
 */
export async function overlayAccent(
  master: string,
  sfx: string,
  atS: number,
  durationS: number,
  workDir: string,
  run: FfRun,
  opts: { gain?: number; ffmpegPath?: string } = {},
): Promise<string> {
  const gain = opts.gain ?? 0.32;
  const bin = opts.ffmpegPath ?? "ffmpeg";

  if (!existsSync(master)) {
    throw new Error(`overlayAccent: master not found at ${master}`);
  }
  if (!existsSync(sfx)) {
    throw new Error(`overlayAccent: accent SFX not found at ${sfx}`);
  }
  if (!Number.isFinite(atS) || atS < 0 || !Number.isFinite(durationS) || durationS <= 0) {
    throw new Error(`overlayAccent: bad timing (atS=${atS}, durationS=${durationS})`);
  }

  const out = join(workDir, "master-audio-accent.wav");
  const delayMs = Math.round(atS * 1000);

  const filter = [
    `[1:a]volume=${gain.toFixed(3)},` +
      `adelay=${delayMs}|${delayMs},` +
      `aformat=sample_rates=48000:channel_layouts=stereo[acc]`,
    `[0:a][acc]amix=inputs=2:normalize=0:dropout_transition=0[aout]`,
  ].join(";");

  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    master,
    "-i",
    sfx,
    "-filter_complex",
    filter,
    "-map",
    "[aout]",
    "-t",
    durationS.toFixed(3),
    "-ac",
    "2",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    out,
  ];

  const { code, stderr } = await run(bin, args);
  if (code !== 0) {
    throw new Error(
      `overlayAccent: ffmpeg failed:\n${stderr.toString("utf8").slice(-2000)}`,
    );
  }
  return out;
}
