/**
 * scripts/render-yupcha-v2.ts — drive the FULL pipeline for the curated
 * yupcha-v2 spec → out/yupcha-v2.mp4.
 *
 * Mirrors `pipeline/generate.ts:generateVideo` but renders the hand-curated
 * 7-archetype `YUPCHA_V2_SPEC` instead of the heuristic director's output (the
 * site is firewalled from this sandbox, so we use the saved fixture spec/kit but
 * STILL drive the real dropped screenshots via their staged `brand-assets/*`
 * keys). Stages: stage real assets → VO (if OmniVoice up) → orchestrator render.
 */
import { join } from "node:path";

import { YUPCHA_V2_SPEC } from "../src/spec/yupcha-v2";
import { lintSpec } from "../src/spec";
import { stageRealAssetKeys } from "../src/ingest";
import { synthVoForSpec } from "../src/pipeline/voice";
import { omniVoiceReachable, omniVoiceBaseUrl } from "../src/pipeline/env";
import { renderVideo } from "../src/render";
import type { VideoSpec } from "../src/spec";

const REPO_ROOT = join(__dirname, "..");
const PUBLIC = join(REPO_ROOT, "public");
const log = (m: string): void => console.log(m);

function assetKeys(spec: VideoSpec): string[] {
  const keys: string[] = [];
  for (const s of spec.scenes) {
    if (s.component === "ProductShot") keys.push(s.props.screen);
    else if (s.component === "FeatureBeat") keys.push(s.props.region);
  }
  return keys;
}

async function main(): Promise<void> {
  let spec = YUPCHA_V2_SPEC;

  const lint = lintSpec(spec);
  if (!lint.ok) {
    throw new Error(`spec not lint-clean:\n${JSON.stringify(lint.violations, null, 2)}`);
  }
  log(`[v2] lint OK — ${spec.scenes.length} scenes, preset ${spec.preset}`);

  // 1. Stage the real dropped Yupcha screenshots under the served asset root.
  const staged = stageRealAssetKeys(assetKeys(spec), PUBLIC, { log });
  log(`[v2] staged ${staged} real screen(s)`);

  // 2. VO gate — synth + loudnorm + measure when OmniVoice is reachable.
  const wantsVo = spec.scenes.some((s) => (s.vo?.text ?? "").trim().length > 0);
  if (wantsVo && (await omniVoiceReachable())) {
    log(`[v2] OmniVoice up at ${omniVoiceBaseUrl()} — synthesizing VO…`);
    try {
      const r = await synthVoForSpec(spec, { log });
      spec = r.spec;
      log(`[v2] voiced ${r.synthesized} scene(s)`);
    } catch (err) {
      log(`[v2] VO failed (${(err as Error).message}) — rendering SILENT`);
    }
  } else {
    log(`[v2] no VO (unreachable or no text) — rendering SILENT`);
  }

  // 3. Full render → out/yupcha-v2.mp4.
  const outPath = join(REPO_ROOT, "out", "yupcha-v2.mp4");
  const result = await renderVideo(spec, { outPath, fps: 30, draft: false, log });
  log(`[v2] DONE → ${result.outPath} (${result.frames} frames, ${result.durationS.toFixed(2)}s)`);
}

main().catch((err: unknown) => {
  console.error(`[v2] FAILED: ${(err as Error).message}`);
  if ((err as Error).stack) console.error((err as Error).stack);
  process.exit(1);
});
