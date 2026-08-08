/**
 * scripts/render-yupcha-v5.ts — render the curated YUPCHA_V5_SPEC end-to-end →
 * out/yupcha-v5.mp4, addressing the three pieces of v4 user feedback:
 *
 *   1. CENTERING — fixed in the scene components (Problem board centers its
 *      block; FeatureBeat balances the still against its caption-chip overhang).
 *   2. MECHANICAL VOICE — voiced LIVE through OmniVoice with the auditioned
 *      "The Companion" (fa99b1a5: warm, widest prosodic range) at the deliberate
 *      `LAUNCH_VOICE_STYLE` (speed 0.94, seed 42) so the read breathes. The
 *      stale `feat_20_the_luxe` id is gone from the spec.
 *   3. AMBIENT MUSIC — the orchestrator mixes the ducked `ncs-sky-high`
 *      INSTRUMENTAL bed under the VO (music: true; sidechain-ducked; never the
 *      vocal `ncs-feel-good` under narration).
 *
 * yupcha.com is firewalled from the render sandbox (HTTP 000), so the spec is
 * the saved/fixture brandKit (SAAS_ROADMAP §3 degrade path) but STILL drives the
 * REAL dropped screenshots via their staged `brand-assets/yupcha/*` keys.
 *
 * VO path: live OmniVoice at 127.0.0.1:3900 (verified reachable + synthesizing
 * "The Companion" in this environment). If unreachable, fail loudly — v5 must
 * ship with sound. A `--vo-dir <dir>` of pre-synthesized `<sceneId>.raw.wav`
 * files is accepted as an offline fallback (same FixtureTts as v4).
 */
import { copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { YUPCHA_V5_SPEC } from "../src/spec/yupcha-v5";
import { lintSpec } from "../src/spec";
import { stageRealAssetKeys } from "../src/ingest";
import { synthVoForSpec } from "../src/pipeline/voice";
import { omniVoiceReachable, omniVoiceBaseUrl, voiceProfileOverride } from "../src/pipeline/env";
import { renderVideo } from "../src/render";
import { omniVoice, LAUNCH_VOICE_PROFILE, type Tts, type SynthRequest, type SynthResult } from "../src/vo";
import type { VideoSpec } from "../src/spec";

const REPO_ROOT = join(__dirname, "..");
const PUBLIC = join(REPO_ROOT, "public");
const log = (m: string): void => console.log(m);

/** Offline fallback `Tts` backed by pre-synthesized wavs keyed by scene id. */
class FixtureTts implements Tts {
  constructor(private readonly dir: string, private readonly byId: Map<string, string>) {}
  async synth(req: SynthRequest): Promise<SynthResult> {
    const m = (req.outPath ?? "").match(/([^/\\]+)\.raw\.wav$/);
    const id = m?.[1];
    const src = id ? this.byId.get(id) : undefined;
    if (!src || !existsSync(src)) {
      throw new Error(`FixtureTts: no pre-synthesized wav for scene "${id ?? "?"}" in ${this.dir}`);
    }
    if (!req.outPath) throw new Error("FixtureTts: outPath required");
    await copyFile(src, req.outPath);
    return { wavPath: req.outPath, profile: req.profile ?? LAUNCH_VOICE_PROFILE };
  }
}

function fixtureTts(dir: string, spec: VideoSpec): Tts {
  const byId = new Map<string, string>();
  for (const s of spec.scenes) byId.set(s.id, join(dir, `${s.id}.raw.wav`));
  return new FixtureTts(dir, byId);
}

function assetKeys(spec: VideoSpec): string[] {
  const keys: string[] = [];
  for (const s of spec.scenes) {
    if (s.component === "ProductShot") keys.push(s.props.screen);
    else if (s.component === "FeatureBeat") keys.push(s.props.region);
  }
  return keys;
}

async function main(): Promise<void> {
  let spec = YUPCHA_V5_SPEC;

  const argv = process.argv.slice(2);
  const voDir = ((): string | undefined => {
    const i = argv.indexOf("--vo-dir");
    return i >= 0 ? argv[i + 1] : undefined;
  })();
  const outPath = ((): string => {
    const i = argv.indexOf("--out");
    return i >= 0 ? argv[i + 1] : join(REPO_ROOT, "out", "yupcha-v5.mp4");
  })();
  const voOut = ((): string | undefined => {
    const i = argv.indexOf("--vo-out");
    return i >= 0 ? argv[i + 1] : undefined;
  })();

  const lint = lintSpec(spec);
  if (!lint.ok) {
    throw new Error(`spec not lint-clean:\n${JSON.stringify(lint.violations, null, 2)}`);
  }
  log(`[v5] lint OK — ${spec.scenes.length} scenes, preset ${spec.preset}, motion ${spec.motion}`);

  const staged = stageRealAssetKeys(assetKeys(spec), PUBLIC, { log });
  log(`[v5] staged ${staged} real screen(s)`);

  const wantsVo = spec.scenes.some((s) => (s.vo?.text ?? "").trim().length > 0);
  if (!wantsVo) throw new Error("[v5] spec carries no VO text — refusing (v5 must have sound).");

  // VO source: live OmniVoice (default) or a pre-synthesized fixture dir.
  let tts: Tts;
  if (voDir) {
    log(`[v5] VO source: pre-synthesized OmniVoice wavs in ${voDir} (offline).`);
    tts = fixtureTts(voDir, spec);
  } else {
    if (!(await omniVoiceReachable())) {
      throw new Error(`[v5] OmniVoice not reachable at ${omniVoiceBaseUrl()} — cannot voice v5.`);
    }
    log(
      `[v5] OmniVoice up at ${omniVoiceBaseUrl()} — synthesizing VO with The Companion (${LAUNCH_VOICE_PROFILE}) ` +
        `@ deliberate read (speed 0.94, seed 42); override=${voiceProfileOverride() ?? "(none)"}…`,
    );
    tts = omniVoice({ baseUrl: omniVoiceBaseUrl() });
  }

  const r = await synthVoForSpec(spec, { log, tts, outDir: voOut });
  spec = r.spec;
  log(`[v5] voiced ${r.synthesized}/${spec.scenes.length} scene(s)`);
  if (r.synthesized === 0) {
    throw new Error("[v5] VO synthesized ZERO scenes — v5 must ship with audio. Failing.");
  }

  // Render: VO mux + ducked ambient music bed (ncs-sky-high, instrumental).
  const result = await renderVideo(spec, {
    outPath,
    fps: 30,
    draft: false,
    music: true, // ambient bed ON (user feedback #3); sidechain-ducked under VO
    log,
  });
  log(`[v5] DONE → ${result.outPath} (${result.frames} frames, ${result.durationS.toFixed(2)}s)`);
  if (result.vttPath) log(`[v5] captions sidecar → ${result.vttPath}`);
}

main().catch((err: unknown) => {
  console.error(`[v5] FAILED: ${(err as Error).message}`);
  if ((err as Error).stack) console.error((err as Error).stack);
  process.exit(1);
});
