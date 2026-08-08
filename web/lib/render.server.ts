/**
 * web/lib/render.server.ts — render the GATE-APPROVED spec, OUT-OF-PROCESS.
 *
 * "What they approve is what renders." This renders the exact approved spec — it
 * does NOT re-run the director. The actual VO synth + render happen inside the
 * spawned `bun src/pipeline/serve-cli.ts` child (`renderApproved` command), so
 * the heavy render engine (esbuild/three/Playwright/React) never enters Next's
 * webpack graph. Keyless + VO-less still yields a real (silent) mp4.
 */
import "server-only";

import { join } from "node:path";
import { createHash } from "node:crypto";

import { runPipeline } from "./pipeline-spawn.server";
import { OUT_ROOT } from "./assets.server";
import type { VideoSpec } from "./types";

export interface RenderApprovedResult {
  /** Absolute path to the rendered mp4 (under out/). */
  outPath: string;
  /** The spec actually rendered (with vo.audioUrl stamped when VO ran). */
  spec: VideoSpec;
  /** How many scenes were voiced (0 when silent). */
  voiced: number;
}

/**
 * Render the approved spec to `out/web/<hash>/video.mp4` via the out-of-process
 * pipeline CLI. The child synthesizes VO when reachable + configured; otherwise
 * it renders silent at each scene's minFrames floor.
 */
export function renderApprovedSpec(
  spec: VideoSpec,
): Promise<RenderApprovedResult> {
  const hash = createHash("sha1")
    .update(JSON.stringify(spec))
    .digest("hex")
    .slice(0, 12);
  const outDir = join(OUT_ROOT, "web", hash);
  return runPipeline<RenderApprovedResult>({
    cmd: "renderApproved",
    spec,
    outDir,
  });
}
