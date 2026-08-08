/**
 * web/lib/pipeline-spawn.server.ts — the ONLY bridge from the Next.js server to
 * the shared pipeline, and it is OUT-OF-PROCESS by design.
 *
 * The pipeline (`src/pipeline/*`) reaches Playwright, esbuild, three, and the
 * React render engine — heavy, Node-only modules that must never enter Next's
 * webpack graph. So instead of `import`-ing the pipeline (static OR dynamic), we
 * spawn a short-lived `bun src/pipeline/serve-cli.ts` child, hand it one JSON
 * command on stdin, and read one JSON result line on stdout. webpack only ever
 * sees `node:child_process` here — the heavy deps stay entirely outside the bundle.
 *
 * This keeps the route response shapes IDENTICAL to the old in-process bridge.
 */
import "server-only";

import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { REPO_ROOT } from "./assets.server";

/** Must match `RESULT_SENTINEL` in src/pipeline/serve-cli.ts. */
const RESULT_SENTINEL = "@@KINO_RESULT@@";

/** Absolute path to the out-of-process pipeline CLI. */
const CLI_ENTRY = resolve(REPO_ROOT, "src/pipeline/serve-cli.ts");

/** Result envelope emitted by the CLI on stdout. */
interface CliEnvelope<T> {
  ok: boolean;
  result?: T;
  error?: string;
  detail?: string;
  stack?: string;
}

/** Error carrying the optional `detail` the routes surface to the client. */
export class PipelineError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "PipelineError";
    this.detail = detail;
  }
}

/**
 * Spawn the pipeline CLI, send `command` as JSON on stdin, resolve with the
 * parsed `result`. Rejects with a `PipelineError` on a non-zero exit or a
 * malformed/failed result. Pipeline logs (child stderr) are forwarded so they
 * still show up in the Next dev server console.
 */
export function runPipeline<T>(command: unknown): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const child = spawn("bun", [CLI_ENTRY], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString("utf8");
      stderr += s;
      // Forward pipeline progress to the server console.
      process.stderr.write(s);
    });

    child.on("error", (err) => {
      reject(new PipelineError(`failed to spawn pipeline: ${err.message}`));
    });

    child.on("close", (code) => {
      const envelope = parseEnvelope<T>(stdout);
      if (!envelope) {
        reject(
          new PipelineError(
            `pipeline produced no result (exit ${code})`,
            stderr.trim().slice(-4000) || undefined,
          ),
        );
        return;
      }
      if (!envelope.ok) {
        reject(
          new PipelineError(
            envelope.error ?? `pipeline failed (exit ${code})`,
            envelope.detail ?? envelope.stack,
          ),
        );
        return;
      }
      resolvePromise(envelope.result as T);
    });

    // Send the command, then EOF so the child runs single-shot.
    child.stdin.write(JSON.stringify(command));
    child.stdin.end();
  });
}

/** Extract the sentinel-bracketed JSON envelope from mixed stdout. */
function parseEnvelope<T>(stdout: string): CliEnvelope<T> | null {
  const first = stdout.indexOf(RESULT_SENTINEL);
  if (first === -1) return null;
  const start = first + RESULT_SENTINEL.length;
  const end = stdout.indexOf(RESULT_SENTINEL, start);
  if (end === -1) return null;
  const json = stdout.slice(start, end);
  try {
    return JSON.parse(json) as CliEnvelope<T>;
  } catch {
    return null;
  }
}
