/**
 * scripts/render-yupcha-v3.ts — drive the FULL pipeline for the curated
 * yupcha-v2 spec → out/yupcha-v3.mp4 (the v3 background/scrim refinement render).
 *
 * Identical pipeline to render-yupcha-v2.ts; only the output path differs. The
 * curated 7-archetype YUPCHA_V2_SPEC is the frozen integration spec (the site is
 * firewalled from this sandbox, so we use the saved fixture spec/kit but STILL
 * drive the real dropped screenshots via their staged `brand-assets/*` keys).
 * Stages: stage real assets → VO (if OmniVoice up) → orchestrator render.
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
  log(`[v3] lint OK — ${spec.scenes.length} scenes, preset ${spec.preset}`);

  const staged = stageRealAssetKeys(assetKeys(spec), PUBLIC, { log });
  log(`[v3] staged ${staged} real screen(s)`);

  const wantsVo = spec.scenes.some((s) => (s.vo?.text ?? "").trim().length > 0);
  if (wantsVo && (await omniVoiceReachable())) {
    log(`[v3] OmniVoice up at ${omniVoiceBaseUrl()} — synthesizing VO…`);
    try {
      const r = await synthVoForSpec(spec, { log });
      spec = r.spec;
      log(`[v3] voiced ${r.synthesized} scene(s)`);
    } catch (err) {
      log(`[v3] VO failed (${(err as Error).message}) — rendering SILENT`);
    }
  } else {
    log(`[v3] no VO (unreachable or no text) — rendering SILENT`);
  }

  const outPath = join(REPO_ROOT, "out", "yupcha-v3.mp4");
  const result = await renderVideo(spec, { outPath, fps: 30, draft: false, log });
  log(`[v3] DONE → ${result.outPath} (${result.frames} frames, ${result.durationS.toFixed(2)}s)`);
}

main().catch((err: unknown) => {
  console.error(`[v3] FAILED: ${(err as Error).message}`);
  if ((err as Error).stack) console.error((err as Error).stack);
  process.exit(1);
});
