/**
 * Kino render CLI.
 *
 *   bun src/render/cli.ts <specModule> [out.mp4] [workers]
 *
 * `<specModule>` is a path to a module that exports a `VideoSpec` — either a
 * default export, a named `spec`, or a named `SAMPLE_SPEC` (so the repo's
 * `src/spec/sample.ts` works out of the box). The spec is re-validated against
 * the contract before rendering (fail closed).
 *
 * Examples:
 *   bun src/render/cli.ts src/spec/sample.ts
 *   bun src/render/cli.ts src/spec/sample.ts out/sample.mp4 6
 *   KINO_DRAFT=1 bun src/render/cli.ts src/spec/sample.ts out/draft.mp4
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { VideoSpec } from "../spec/schema";
import { renderVideo } from "./orchestrator";

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`[kino-cli] ${msg}`);
  process.exit(1);
}

/** Pull a `VideoSpec`-shaped value out of an imported module. */
function pickSpec(mod: Record<string, unknown>): unknown {
  if (mod.default !== undefined) return mod.default;
  if (mod.spec !== undefined) return mod.spec;
  if (mod.SAMPLE_SPEC !== undefined) return mod.SAMPLE_SPEC;
  fail(
    "spec module must export a `VideoSpec` as `default`, `spec`, or `SAMPLE_SPEC`.",
  );
}

async function main(): Promise<void> {
  const [specArg, outArg, workersArg] = process.argv.slice(2);

  if (!specArg) {
    fail("usage: bun src/render/cli.ts <specModule> [out.mp4] [workers]");
  }

  const specPath = resolve(specArg);
  const outPath = resolve(outArg ?? "out/kino.mp4");
  const workers = workersArg ? Number.parseInt(workersArg, 10) : undefined;
  if (workers !== undefined && (!Number.isFinite(workers) || workers < 1)) {
    fail(`workers must be a positive integer, got "${workersArg}"`);
  }

  const draft = process.env.KINO_DRAFT === "1" || process.env.KINO_DRAFT === "true";
  const fps = process.env.KINO_FPS ? Number.parseInt(process.env.KINO_FPS, 10) : undefined;

  // eslint-disable-next-line no-console
  console.log(`[kino-cli] loading spec from ${specPath}`);
  const mod = (await import(pathToFileURL(specPath).href)) as Record<string, unknown>;
  const parsed = VideoSpec.safeParse(pickSpec(mod));
  if (!parsed.success) {
    fail(
      `spec failed validation:\n${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }

  const result = await renderVideo(parsed.data, {
    outPath,
    workers,
    fps,
    draft,
  });

  // eslint-disable-next-line no-console
  console.log(
    `[kino-cli] rendered ${result.frames} frames (${result.durationS.toFixed(2)}s) → ${result.outPath}`,
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[kino-cli] render failed:", err);
  process.exit(1);
});
