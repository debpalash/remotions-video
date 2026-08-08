// Probe audio duration in seconds via ffprobe.
//
// This is the measurement the auto-placer (place.ts) and Remotion's
// calculateMetadata (SAAS_ROADMAP.md §5) consume to derive scene frame counts
// from real VO length.

import { spawn } from "node:child_process";

export interface MeasureOptions {
  /** Path to the ffprobe binary. */
  ffprobePath?: string;
}

/**
 * Returns the duration of `path` in seconds (float).
 * Rejects if ffprobe fails or reports a non-finite duration.
 */
export function measureDuration(
  path: string,
  opts: MeasureOptions = {},
): Promise<number> {
  const bin = opts.ffprobePath ?? "ffprobe";
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ];

  return new Promise<number>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) =>
      reject(new Error(`measureDuration: failed to spawn ${bin}: ${err.message}`)),
    );
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`measureDuration: ffprobe exited ${code}\n${stderr.slice(-500)}`),
        );
        return;
      }
      const seconds = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(seconds) || seconds < 0) {
        reject(
          new Error(
            `measureDuration: could not parse duration from "${stdout.trim()}"`,
          ),
        );
        return;
      }
      resolve(seconds);
    });
  });
}
