/**
 * Kino host — STANDALONE DEV command (eyeball one frame in a real browser).
 *
 * Builds the host bundle, injects a spec, writes a single self-contained HTML
 * file, and opens it in the OS default browser. This is the "open one frame in a
 * normal browser for eyeballing" path required by the host spec — it bypasses
 * Playwright/ffmpeg entirely so you can iterate on a scene's look fast.
 *
 * Usage (via tsx / ts-node, or after esbuild):
 *   node --import tsx src/render/host/dev.ts                 # SAMPLE_SPEC, frame 0
 *   node --import tsx src/render/host/dev.ts --frame 45      # a specific frame
 *   node --import tsx src/render/host/dev.ts --spec ./my.json
 *   node --import tsx src/render/host/dev.ts --no-open       # just write the file
 *
 * Determinism: the page is the same document the orchestrator serves, so what
 * you eyeball is exactly what renders. The dev build keeps a sourcemap + skips
 * minification for readable stack traces.
 *
 * Node-only. Not imported by the browser entry or the orchestrator.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";

import {
  SAMPLE_SPEC,
  VideoSpec as VideoSpecSchema,
  type VideoSpec,
} from "../../spec";
import { renderHostPage } from "./build";
import type { VoDurations } from "./stack";

/* -------------------------------------------------------------------------- */
/*  Args                                                                       */
/* -------------------------------------------------------------------------- */

type DevArgs = {
  frame: number;
  specPath: string | null;
  voPath: string | null;
  fps: number;
  out: string;
  open: boolean;
};

function parseArgs(argv: readonly string[]): DevArgs {
  const args: DevArgs = {
    frame: 0,
    specPath: null,
    voPath: null,
    fps: 30,
    out: path.join(os.tmpdir(), "kino-host-preview.html"),
    open: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      i++;
      return v;
    };
    switch (a) {
      case "--frame":
        args.frame = Math.max(0, Number.parseInt(next(), 10) || 0);
        break;
      case "--spec":
        args.specPath = next();
        break;
      case "--vo":
        args.voPath = next();
        break;
      case "--fps":
        args.fps = Number.parseInt(next(), 10) || 30;
        break;
      case "--out":
        args.out = path.resolve(next());
        break;
      case "--no-open":
        args.open = false;
        break;
      default:
        // Ignore unknown flags so `node --import tsx … extra` doesn't choke.
        break;
    }
  }
  return args;
}

/* -------------------------------------------------------------------------- */
/*  Open in default browser (cross-platform)                                   */
/* -------------------------------------------------------------------------- */

function openInBrowser(fileUrl: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const cmdArgs =
    platform === "win32" ? ["/c", "start", "", fileUrl] : [fileUrl];
  const child = spawn(cmd, cmdArgs, { stdio: "ignore", detached: true });
  child.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn(`[kino-dev] could not auto-open browser: ${err.message}`);
  });
  child.unref();
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                       */
/* -------------------------------------------------------------------------- */

async function loadSpec(specPath: string | null): Promise<VideoSpec> {
  if (!specPath) return SAMPLE_SPEC;
  const raw = await fs.readFile(path.resolve(specPath), "utf8");
  return VideoSpecSchema.parse(JSON.parse(raw));
}

async function loadVo(voPath: string | null): Promise<VoDurations> {
  if (!voPath) return {};
  const raw = await fs.readFile(path.resolve(voPath), "utf8");
  return JSON.parse(raw) as VoDurations;
}

export async function main(argv: readonly string[]): Promise<void> {
  const args = parseArgs(argv);
  const spec = await loadSpec(args.specPath);
  const voDurations = await loadVo(args.voPath);

  // Dev build: unminified + inline sourcemap so the eyeball page is debuggable.
  const { html } = await renderHostPage({
    spec,
    voDurations,
    fps: args.fps,
    frame: args.frame,
    minify: false,
    sourcemap: true,
  });

  await fs.writeFile(args.out, html, "utf8");
  // The bundle reads `?frame=N` for its initial paint; the file URL carries it.
  const fileUrl = `file://${args.out}?frame=${args.frame}`;

  // eslint-disable-next-line no-console
  console.log(`[kino-dev] wrote ${args.out}`);
  // eslint-disable-next-line no-console
  console.log(`[kino-dev] open: ${fileUrl}`);

  if (args.open) openInBrowser(fileUrl);
}

// Run when invoked directly (not when imported).
if (require.main === module) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("[kino-dev] failed:", err);
    process.exitCode = 1;
  });
}
