// FFmpeg loudnorm normalization to the VO pipeline target (I=-14 LUFS).
//
// Single-pass loudnorm filter (CLAUDE.md: `loudnorm I=-14`). A single pass is
// the right tradeoff here: VO clauses are short, and the placer derives timing
// from the *normalized* file's measured duration, so we never need the two-pass
// measured-input correction. The output is a clean PCM wav ready for measure.ts.

import { spawn } from "node:child_process";

export interface LoudnormOptions {
  /** Integrated loudness target in LUFS. Pipeline default: -14. */
  I?: number;
  /** True peak ceiling in dBTP. */
  TP?: number;
  /** Loudness range target in LU. */
  LRA?: number;
  /** Path to the ffmpeg binary. */
  ffmpegPath?: string;
  /** Output sample rate (Hz). loudnorm internally resamples to 192k; we pin output. */
  sampleRate?: number;
}

export interface LoudnormResult {
  /** Absolute path to the normalized wav. */
  outPath: string;
}

/**
 * Normalize `inPath` to I LUFS and write `outPath` (16-bit PCM wav).
 * Resolves with the output path; rejects with ffmpeg's stderr on failure.
 */
export function loudnorm(
  inPath: string,
  outPath: string,
  opts: LoudnormOptions = {},
): Promise<LoudnormResult> {
  const I = opts.I ?? -14;
  const TP = opts.TP ?? -1.5;
  const LRA = opts.LRA ?? 11;
  const sampleRate = opts.sampleRate ?? 48_000;
  const bin = opts.ffmpegPath ?? "ffmpeg";

  if (inPath === outPath) {
    return Promise.reject(
      new Error("loudnorm: inPath and outPath must differ (ffmpeg cannot in-place)"),
    );
  }

  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    inPath,
    "-af",
    `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`,
    "-ar",
    String(sampleRate),
    "-c:a",
    "pcm_s16le",
    outPath,
  ];

  return new Promise<LoudnormResult>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) =>
      reject(new Error(`loudnorm: failed to spawn ${bin}: ${err.message}`)),
    );
    child.on("close", (code) => {
      if (code === 0) resolve({ outPath });
      else
        reject(
          new Error(
            `loudnorm: ffmpeg exited ${code}\n${stderr.slice(-1000)}`,
          ),
        );
    });
  });
}
