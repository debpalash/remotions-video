// Pacing helpers — make the read breathe instead of running wall-to-wall.
//
// Two independent levers, both off by default-safe values:
//
//  1. SENTENCE BREATHING (text level, pure): normalize a line so multi-sentence
//     copy carries clear terminal punctuation. OmniVoice keys its intra-line
//     pausing off punctuation, so this lengthens the natural pause between
//     sentences WITHOUT changing a single spoken word. Pure string→string.
//
//  2. LEAD-IN / TAIL SILENCE (audio level, ffmpeg): prepend/append a short pad
//     of real silence to a normalized clip so a line never butts hard against
//     the scene cut, and successive lines get an audible inter-line gap. This is
//     the audio counterpart to place.ts's frame `pad` (which only reserves
//     trailing frames in the layout; this puts actual silence in the wav).

import { spawn } from "node:child_process";

/**
 * Add gentle sentence breathing to a VO line. Pure: same input → same output.
 *
 * - Collapses runs of whitespace to single spaces and trims.
 * - Ensures the line ends in terminal punctuation (adds "." if it ends on a
 *   word) so the final clause resolves instead of being clipped flat.
 * - Guarantees a single space after sentence-final punctuation between
 *   sentences (so `…funnel.Let an agent…` → `…funnel. Let an agent…`), giving
 *   the engine a real sentence boundary to pause on.
 *
 * Does NOT add, remove, or reorder words — only whitespace/terminal punctuation,
 * so captions derived from the text stay faithful.
 */
export function breathe(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;
  // Insert a space after sentence-final punctuation immediately followed by a
  // letter/number (a missing inter-sentence space), without touching decimals
  // like "9.0" (handled by requiring a following alphabetic char or capital).
  t = t.replace(/([.!?])([A-Za-z])/g, "$1 $2");
  // Ensure the line resolves with terminal punctuation.
  if (!/[.!?…,:;]$/.test(t)) t += ".";
  return t;
}

export interface PadSilenceOptions {
  /** Seconds of silence prepended before the clip. Default 0.18. */
  leadInSec?: number;
  /** Seconds of silence appended after the clip. Default 0.32. */
  tailSec?: number;
  /** Sample rate of the padding (matches loudnorm output). Default 48000. */
  sampleRate?: number;
  /** ffmpeg binary path. */
  ffmpegPath?: string;
}

export interface PadSilenceResult {
  outPath: string;
  /** Total seconds of silence added (lead-in + tail). */
  addedSeconds: number;
}

/**
 * Write `outPath` = leadIn-silence + `inPath` + tail-silence, preserving the
 * input's loudness (we pad with true silence; we do NOT re-run loudnorm, so the
 * I=-14 integrated loudness of the speech is unchanged — silence is excluded
 * from gated loudness). Rejects with ffmpeg stderr on failure.
 *
 * Uses ffmpeg `adelay` (lead-in) + `apad` (tail) in one pass. Deterministic:
 * silence is exact, so the padded wav is a pure function of the input + pads.
 */
export function padSilence(
  inPath: string,
  outPath: string,
  opts: PadSilenceOptions = {},
): Promise<PadSilenceResult> {
  const leadInSec = opts.leadInSec ?? 0.18;
  const tailSec = opts.tailSec ?? 0.32;
  const sampleRate = opts.sampleRate ?? 48_000;
  const bin = opts.ffmpegPath ?? "ffmpeg";

  if (inPath === outPath) {
    return Promise.reject(
      new Error("padSilence: inPath and outPath must differ"),
    );
  }
  if (leadInSec < 0 || tailSec < 0 || !Number.isFinite(leadInSec) || !Number.isFinite(tailSec)) {
    return Promise.reject(
      new Error(`padSilence: lead-in/tail must be finite >= 0, got ${leadInSec}/${tailSec}`),
    );
  }

  const leadMs = Math.round(leadInSec * 1000);
  // adelay delays ALL channels by leadMs; apad pads the tail with tailSec.
  const filter = `adelay=${leadMs}:all=1,apad=pad_dur=${tailSec}`;

  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    inPath,
    "-af",
    filter,
    "-ar",
    String(sampleRate),
    "-c:a",
    "pcm_s16le",
    outPath,
  ];

  return new Promise<PadSilenceResult>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) =>
      reject(new Error(`padSilence: failed to spawn ${bin}: ${err.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve({ outPath, addedSeconds: leadInSec + tailSec });
      else reject(new Error(`padSilence: ffmpeg exited ${code}\n${stderr.slice(-1000)}`));
    });
  });
}
