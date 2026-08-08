/**
 * src/pipeline/cli.ts — the tiny end-to-end CLI.
 *
 *   bun src/pipeline/cli.ts <url> [out.mp4]
 *
 * Runs the full shared pipeline on a real URL and writes an mp4 to `out/`
 * (or the given path). Works keyless + VO-less: a missing LLM key falls back to
 * the heuristic director; an unreachable OmniVoice renders silent. Logs every
 * stage; exits non-zero with a clear message on failure (fail-closed).
 *
 * Flags (all optional, after the positional args):
 *   --draft            jpeg/fast render
 *   --silent           skip VO even if OmniVoice is up
 *   --no-storyboard    skip the per-scene stills
 *   --goal-angle <s>   one-line narrative angle
 *   --format <f>       16:9 | 9:16 | 1:1
 *   --workers <n>      worker page count
 */
import { generateVideo, type DirectorGoal } from "./generate";

interface ParsedArgs {
  url?: string;
  outPath?: string;
  draft: boolean;
  silent: boolean;
  storyboard: boolean;
  workers?: number;
  goal: DirectorGoal;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const out: ParsedArgs = {
    draft: false,
    silent: false,
    storyboard: true,
    goal: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--draft":
        out.draft = true;
        break;
      case "--silent":
        out.silent = true;
        break;
      case "--no-storyboard":
        out.storyboard = false;
        break;
      case "--goal-angle":
        out.goal.angle = argv[++i];
        break;
      case "--format": {
        const f = argv[++i];
        if (f === "16:9" || f === "9:16" || f === "1:1") out.goal.format = f;
        break;
      }
      case "--workers": {
        const n = Number.parseInt(argv[++i] ?? "", 10);
        if (Number.isFinite(n) && n > 0) out.workers = n;
        break;
      }
      default:
        if (!a.startsWith("--")) positionals.push(a);
        break;
    }
  }
  out.url = positionals[0];
  out.outPath = positionals[1];
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    console.error(
      "usage: bun src/pipeline/cli.ts <url> [out.mp4] " +
        "[--draft] [--silent] [--no-storyboard] [--goal-angle <s>] [--format 16:9|9:16|1:1] [--workers <n>]",
    );
    process.exit(2);
  }

  const t0 = Date.now();
  console.log(`[cli] generating video for ${args.url}`);

  const result = await generateVideo(
    { url: args.url, goal: args.goal },
    {
      outPath: args.outPath,
      draft: args.draft,
      silent: args.silent,
      storyboard: args.storyboard,
      workers: args.workers,
    },
  );

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[cli] DONE in ${secs}s`);
  console.log(`[cli]   mp4    → ${result.outPath}`);
  console.log(`[cli]   spec   → ${result.spec.scenes.length} scenes, preset ${result.spec.preset}`);
  console.log(`[cli]   brand  → ${result.brandKit.name} (${result.brandKit.id})`);
  if (result.stills.length) {
    console.log(`[cli]   stills → ${result.stills.length} (${result.stills[0]} …)`);
  }
}

main().catch((err: unknown) => {
  console.error(`[cli] FAILED: ${(err as Error).message}`);
  if ((err as Error).stack) console.error((err as Error).stack);
  process.exit(1);
});
