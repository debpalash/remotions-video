/**
 * src/pipeline/serve-cli.ts — the OUT-OF-PROCESS pipeline bridge.
 *
 * The web app must NOT statically (or dynamically) import this pipeline into the
 * Next.js server bundle: it reaches Playwright, esbuild, three, and the React
 * render engine — heavy, Node-only deps that webpack should never touch. Instead
 * the API routes spawn `bun src/pipeline/serve-cli.ts` and talk to it over
 * stdin/stdout with one JSON command in, one JSON result out. That keeps all of
 * the heavy machinery entirely outside Next's webpack graph.
 *
 * Protocol (single-shot):
 *   - The parent writes ONE JSON command object to this process's stdin, then
 *     closes stdin (EOF).
 *   - This process runs the command and prints exactly ONE line to stdout:
 *         {"ok":true,"result":<json>}      on success
 *         {"ok":false,"error":"…","detail":"…","stack":"…"}   on failure
 *     prefixed by a stable sentinel so the parent can ignore any incidental
 *     pipeline logging (which all goes to stderr here).
 *   - Exit code is 0 on success, 1 on failure.
 *
 * Commands (the documented `src/pipeline/generate.ts` interface, 1:1):
 *   { "cmd": "planOutline",     "input": PlanOutlineInput }
 *       → { spec, brandKit }
 *   { "cmd": "renderStoryboard","spec":  VideoSpec, "outDir"?: string }
 *       → { stills }
 *   { "cmd": "renderApproved",  "spec":  VideoSpec, "outDir"?: string }
 *       → { outPath, spec, voiced }
 *   { "cmd": "generateVideo",   "input": GenerateVideoInput }
 *       → { spec, outPath, stills, brandKit }
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

import {
  planOutline,
  renderStoryboard,
  generateVideo,
  type PipelineInput,
} from "./generate";
import { renderVideo } from "../render";
import { synthVoForSpec } from "./voice";
import { omniVoiceReachable } from "./env";
import type { VideoSpec } from "../spec";

/** Sentinel that brackets the single JSON result line on stdout. */
export const RESULT_SENTINEL = "@@KINO_RESULT@@";

type Command =
  | { cmd: "planOutline"; input: PipelineInput }
  | { cmd: "renderStoryboard"; spec: VideoSpec; outDir?: string }
  | { cmd: "renderApproved"; spec: VideoSpec; outDir?: string }
  | { cmd: "generateVideo"; input: PipelineInput };

/** All pipeline logging goes to stderr so stdout carries ONLY the result line. */
const log = (m: string) => process.stderr.write(`${m}\n`);

/** Read all of stdin to a string (the single JSON command). */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Stable 12-char hash of a spec — the per-spec output directory name. */
function specHash(spec: VideoSpec): string {
  return createHash("sha1").update(JSON.stringify(spec)).digest("hex").slice(0, 12);
}

/** Render the GATE-APPROVED spec (VO if reachable, else silent) → mp4 path. */
async function renderApproved(
  spec: VideoSpec,
  outDir: string,
): Promise<{ outPath: string; spec: VideoSpec; voiced: number }> {
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "video.mp4");

  let toRender = spec;
  let voiced = 0;
  const hasVoice = spec.scenes.some((s) => (s.vo?.text ?? "").trim().length > 0);
  if (hasVoice && (await omniVoiceReachable())) {
    log("[render] OmniVoice reachable — synthesizing VO…");
    const vo = await synthVoForSpec(spec, { log });
    toRender = vo.spec;
    voiced = vo.synthesized;
  } else {
    log("[render] no VO (keyless/silent) — rendering at minFrames floors.");
  }

  log("[render] rendering mp4…");
  await renderVideo(toRender, {
    outPath,
    log,
    music: true,
    musicBed: "audio/ncs-sky-high.mp3",
  });
  return { outPath, spec: toRender, voiced };
}

async function run(command: Command): Promise<unknown> {
  switch (command.cmd) {
    case "planOutline":
      return planOutline(command.input, { log });

    case "renderStoryboard": {
      const dir =
        command.outDir ??
        join(process.cwd(), "out", "web", specHash(command.spec));
      await mkdir(dir, { recursive: true });
      return renderStoryboard(command.spec, { log, outDir: dir });
    }

    case "renderApproved": {
      const dir =
        command.outDir ??
        join(process.cwd(), "out", "web", specHash(command.spec));
      return renderApproved(command.spec, dir);
    }

    case "generateVideo":
      return generateVideo(command.input, { log });

    default: {
      const _exhaustive: never = command;
      throw new Error(`unknown command: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

async function main(): Promise<void> {
  const raw = await readStdin();
  let command: Command;
  try {
    command = JSON.parse(raw) as Command;
  } catch (err) {
    emit({ ok: false, error: `invalid JSON command: ${(err as Error).message}` });
    process.exit(1);
  }

  try {
    const result = await run(command);
    emit({ ok: true, result });
    process.exit(0);
  } catch (err) {
    const e = err as { message?: string; detail?: string; stack?: string; attempts?: string[] };
    const detail =
      e?.detail ?? (Array.isArray(e?.attempts) ? e.attempts.join("\n") : undefined);
    emit({ ok: false, error: e?.message ?? "pipeline command failed", detail, stack: e?.stack });
    process.exit(1);
  }
}

/** Print the single, sentinel-bracketed result line to stdout. */
function emit(payload: unknown): void {
  process.stdout.write(`${RESULT_SENTINEL}${JSON.stringify(payload)}${RESULT_SENTINEL}\n`);
}

void main();
