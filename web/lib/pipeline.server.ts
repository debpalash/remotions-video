/**
 * web/lib/pipeline.server.ts — the documented pipeline interface, served
 * OUT-OF-PROCESS.
 *
 * Server-only. It exposes the SAME three calls the web app codes against —
 *   - planOutline(input)      → { spec, brandKit }            (no render)
 *   - renderStoryboard(spec)  → { stills }                    (cheap gate)
 *   - generateVideo(input)    → { spec, outPath, stills, brandKit }
 * — but each one now spawns `bun src/pipeline/serve-cli.ts` rather than importing
 * `src/pipeline` into the Next server bundle. That keeps Playwright, esbuild,
 * three, and the React render engine entirely OUT of Next's webpack graph (the
 * whole class of "Can't resolve 'playwright'" build breakage goes away), while
 * the response shapes stay byte-for-byte identical.
 *
 * Types are imported `type`-only from `./types` (erased at build time).
 */
import "server-only";

import { runPipeline } from "./pipeline-spawn.server";
import type { VideoSpec, BrandKit, GenerateInput } from "./types";

/* -------------------------------------------------------------------------- */
/*  I/O aliases (mirror src/pipeline/generate.ts exactly)                     */
/* -------------------------------------------------------------------------- */

export type PlanOutlineInput = GenerateInput;
export type GenerateVideoInput = GenerateInput;

export interface PlanOutlineResult {
  spec: VideoSpec;
  brandKit: BrandKit;
}
export interface StoryboardResult {
  stills: string[];
}
export interface GenerateVideoResult {
  spec: VideoSpec;
  outPath: string;
  stills: string[];
  brandKit: BrandKit;
}

/* -------------------------------------------------------------------------- */
/*  Documented calls — each one spawns the out-of-process pipeline CLI.        */
/* -------------------------------------------------------------------------- */

/** Ingest → director → lint-clean VideoSpec. No render. */
export function planOutline(input: PlanOutlineInput): Promise<PlanOutlineResult> {
  return runPipeline<PlanOutlineResult>({ cmd: "planOutline", input });
}

/**
 * One still PNG per scene (the cheap gate). Stills are written under `outDir`
 * (the route passes `out/web/<hash>/`) so `/api/asset` can serve them.
 */
export function renderStoryboard(
  spec: VideoSpec,
  opts: { outDir?: string } = {},
): Promise<StoryboardResult> {
  return runPipeline<StoryboardResult>({
    cmd: "renderStoryboard",
    spec,
    outDir: opts.outDir,
  });
}

/** Full plan → (VO if reachable) → render → mp4 in out/. */
export function generateVideo(
  input: GenerateVideoInput,
): Promise<GenerateVideoResult> {
  return runPipeline<GenerateVideoResult>({ cmd: "generateVideo", input });
}
