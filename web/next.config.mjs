// @ts-check
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

/**
 * The web app lives in `web/` but imports the shared pipeline from `../src` and
 * renders mp4s into `../out`. Next traces files from the package root by default;
 * `outputFileTracingRoot` lifts that to the repo root so the server bundle can
 * reach `src/pipeline`, and `transpilePackages` is unused because we import TS
 * source directly via the tsconfig path below.
 *
 * The pipeline (Playwright, esbuild, ffmpeg) is heavy + node-only; keep it on the
 * server and never bundle it into a client chunk.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: repoRoot,
  serverExternalPackages: ["playwright", "esbuild"],
  // The pipeline reads/writes the filesystem and spawns Chromium/ffmpeg — it must
  // run in the Node.js runtime, never the Edge runtime. Routes declare this too.
  experimental: {
    // Allow importing TS source from outside `web/` (the shared `src/` tree).
    externalDir: true,
  },
};

export default nextConfig;
