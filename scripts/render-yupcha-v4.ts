/**
 * scripts/render-yupcha-v4.ts — drive the FULL pipeline for the curated
 * YUPCHA_V2_SPEC (dark-cinematic) → out/yupcha-v4.mp4, WITH VO ENABLED and
 * burned captions.
 *
 * v4 closes the v3 gap (v3 was silent because the OmniVoice model wasn't
 * loaded). It is identical plumbing to v3 plus:
 *   - a HARD VO requirement: if VO synthesis voices zero scenes, fail loudly
 *     (no silent fallback) — v4 must ship sound.
 *   - the live-backend profile is resolved via `OMNIVOICE_PROFILE` (the
 *     CLAUDE.md "feat_20_the_luxe" id is NOT present on this backend; the live
 *     `/profiles` is the source of truth).
 *
 * The yupcha.com site is firewalled from the sandbox (HTTP 000), so this uses
 * the saved fixture spec/kit (SAAS_ROADMAP §3 degrade path) but STILL drives the
 * real dropped screenshots via their staged `brand-assets/yupcha/*` keys.
 */
import { copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { YUPCHA_V2_SPEC } from "../src/spec/yupcha-v2";
import { lintSpec } from "../src/spec";
import { stageRealAssetKeys } from "../src/ingest";
import { synthVoForSpec } from "../src/pipeline/voice";
import { omniVoiceReachable, omniVoiceBaseUrl, voiceProfileOverride } from "../src/pipeline/env";
import { renderVideo } from "../src/render";
import { omniVoice, type Tts, type SynthRequest, type SynthResult } from "../src/vo";
import type { VideoSpec } from "../src/spec";

const REPO_ROOT = join(__dirname, "..");
const PUBLIC = join(REPO_ROOT, "public");
const log = (m: string): void => console.log(m);

/**
 * A `Tts` backed by pre-synthesized OmniVoice wavs on disk, keyed by scene id.
 *
 * Why: OmniVoice's HTTP model-load stalls behind this sandbox's firewall (its
 * loader does a network probe even with a complete local cache), so the live
 * `/v1/audio/speech` never returns here. The weights ARE cached and load in
 * ~8s with `HF_HUB_OFFLINE=1` — so the VO is produced offline by the SAME
 * model + profile (The Companion / fa99b1a5) into `<dir>/<sceneId>.raw.wav`,
 * and this adapter feeds those real clips into the unchanged VO pipeline
 * (loudnorm I=-14 → measure → place → mux). In a connected environment the
 * default `omniVoice()` HTTP client is used instead (no fixture dir).
 */
class FixtureTts implements Tts {
  constructor(
    private readonly dir: string,
    private readonly byId: Map<string, string>,
  ) {}
  async synth(req: SynthRequest): Promise<SynthResult> {
    // The pipeline names each raw wav `<sceneId>.raw.wav`; recover the id.
    const m = (req.outPath ?? "").match(/([^/\\]+)\.raw\.wav$/);
    const id = m?.[1];
    const src = id ? this.byId.get(id) : undefined;
    if (!src || !existsSync(src)) {
      throw new Error(`FixtureTts: no pre-synthesized wav for scene "${id ?? "?"}" in ${this.dir}`);
    }
    if (!req.outPath) throw new Error("FixtureTts: outPath required");
    await copyFile(src, req.outPath);
    return { wavPath: req.outPath, profile: req.profile ?? "fa99b1a5" };
  }
}

/** Build the fixture Tts from a dir of `<sceneId>.raw.wav` files, one per scene. */
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
  let spec = YUPCHA_V2_SPEC;

  // --vo-dir <dir>  → feed pre-synthesized OmniVoice wavs through the pipeline
  //                   (firewall workaround; see FixtureTts). --out <path> opt.
  const argv = process.argv.slice(2);
  const voDir = ((): string | undefined => {
    const i = argv.indexOf("--vo-dir");
    return i >= 0 ? argv[i + 1] : undefined;
  })();
  const outPath = ((): string => {
    const i = argv.indexOf("--out");
    return i >= 0 ? argv[i + 1] : join(REPO_ROOT, "out", "yupcha-v4.mp4");
  })();
  // Fixed dir for the loudnorm'd wavs. Stable across runs → identical spec
  // (same `vo.audioUrl` paths) → the per-frame cache makes a determinism rerun
  // fast AND byte-identical. Default: a per-Date tmp dir (unique per run).
  const voOut = ((): string | undefined => {
    const i = argv.indexOf("--vo-out");
    return i >= 0 ? argv[i + 1] : undefined;
  })();

  const lint = lintSpec(spec);
  if (!lint.ok) {
    throw new Error(`spec not lint-clean:\n${JSON.stringify(lint.violations, null, 2)}`);
  }
  log(`[v4] lint OK — ${spec.scenes.length} scenes, preset ${spec.preset}`);

  const staged = stageRealAssetKeys(assetKeys(spec), PUBLIC, { log });
  log(`[v4] staged ${staged} real screen(s)`);

  const wantsVo = spec.scenes.some((s) => (s.vo?.text ?? "").trim().length > 0);
  if (!wantsVo) throw new Error("[v4] spec carries no VO text — refusing (v4 must have sound).");

  // VO source: pre-synthesized fixture dir (offline OmniVoice) when given,
  // else the live HTTP OmniVoice client (which requires the backend reachable).
  let tts: Tts;
  if (voDir) {
    log(`[v4] VO source: pre-synthesized OmniVoice wavs in ${voDir} (offline; The Companion / fa99b1a5).`);
    tts = fixtureTts(voDir, spec);
  } else {
    if (!(await omniVoiceReachable())) {
      throw new Error(`[v4] OmniVoice not reachable at ${omniVoiceBaseUrl()} — cannot voice v4.`);
    }
    log(
      `[v4] OmniVoice up at ${omniVoiceBaseUrl()} — synthesizing VO ` +
        `(profile override=${voiceProfileOverride() ?? "(none — using spec per-scene)"})…`,
    );
    tts = omniVoice({ baseUrl: omniVoiceBaseUrl() });
  }
  const r = await synthVoForSpec(spec, { log, tts, outDir: voOut });
  spec = r.spec;
  log(`[v4] voiced ${r.synthesized}/${spec.scenes.length} scene(s)`);
  if (r.synthesized === 0) {
    throw new Error("[v4] VO synthesized ZERO scenes — v4 must ship with audio. Failing.");
  }

  const result = await renderVideo(spec, { outPath, fps: 30, draft: false, log });
  log(`[v4] DONE → ${result.outPath} (${result.frames} frames, ${result.durationS.toFixed(2)}s)`);
  if (result.vttPath) log(`[v4] captions sidecar → ${result.vttPath}`);
}

main().catch((err: unknown) => {
  console.error(`[v4] FAILED: ${(err as Error).message}`);
  if ((err as Error).stack) console.error((err as Error).stack);
  process.exit(1);
});
