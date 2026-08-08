/**
 * src/pipeline/generate.ts — the SHARED PIPELINE.
 *
 * The single interface the web app and any integrator code against. It composes
 * the existing modules — ingest, llm director (+ the keyless heuristic), vo,
 * the render orchestrator, and the spec lint — into three calls:
 *
 *   planOutline(input)        → { spec, brandKit }            (no render)
 *   renderStoryboard(spec)    → { stills }                    (cheap gate)
 *   generateVideo(input)      → { spec, outPath, stills, brandKit }
 *
 * Strategic invariants (CLAUDE.md / SAAS_ROADMAP §5):
 *  - The contract is the architecture. Everything upstream of `VideoSpec` is
 *    swappable plumbing; the spec handed to the renderer is ALWAYS lint-clean.
 *  - Keyless + VO-less must still produce a real mp4: no LLM key → heuristic
 *    director; OmniVoice unreachable → silent render at `minFrames`.
 *  - Fail-closed with clear errors; log every stage.
 */
import { join } from "node:path";

import {
  VideoSpec,
  lintSpec,
  gateStatTrust,
  type Violation,
} from "../spec";
import {
  ingest,
  hashUrl,
  applyRealAssetOverride,
  stageRealAssets,
  stageRealAssetKeys,
  DEFAULT_PALETTE,
  type BrandKit,
} from "../ingest";
import {
  direct,
  SpecValidationError,
  type DirectorBrandKit,
  type DirectorGoal,
} from "../llm";
import { renderVideo } from "../render";

import { heuristicDirect, assignFeatureScreens } from "./heuristic";
import { hasLlmKey, llmKeySource, omniVoiceReachable, omniVoiceBaseUrl } from "./env";
import { synthVoForSpec } from "./voice";
import { renderStoryboardStills } from "./storyboard";

/* -------------------------------------------------------------------------- */
/*  Shared types                                                              */
/* -------------------------------------------------------------------------- */

export type { DirectorGoal } from "../llm";
export type { BrandKit } from "../ingest";

const REPO_ROOT = join(__dirname, "..", "..");
const OUT_DIR = join(REPO_ROOT, "out");
/** The render/storyboard default asset root (mirrors the orchestrator). Real
 *  dropped screens are staged here so their `brand-assets/<slug>/…` keys serve. */
const DEFAULT_ASSET_ROOT = join(REPO_ROOT, "public");

/** Logger sink — defaults to `console.log`. */
export type Logger = (msg: string) => void;
const defaultLog: Logger = (m) => console.log(m);

/** Input accepted by `planOutline` / `generateVideo`. */
export interface PipelineInput {
  /** A URL to ingest (brand kit + screens). Optional but recommended. */
  url?: string;
  /** Pre-supplied asset keys/paths (uploads). Advisory; threaded to the kit. */
  assets?: string[];
  /** Creative brief. */
  goal?: DirectorGoal;
  /** A pre-built BrandKit (skips ingest entirely when provided). */
  brandKit?: BrandKit;
}

/* -------------------------------------------------------------------------- */
/*  Documented I/O aliases (the names the web bridge codes against)           */
/* -------------------------------------------------------------------------- */

/** Input to `planOutline`. */
export type PlanOutlineInput = PipelineInput;
/** Input to `generateVideo`. */
export type GenerateVideoInput = PipelineInput;
/** Result of `planOutline` — `{ spec, brandKit }`. */
export interface PlanOutlineResult {
  spec: VideoSpec;
  brandKit: BrandKit;
}
/** Result of `renderStoryboard` — `{ stills }` (one PNG path per scene). */
export interface StoryboardResult {
  stills: string[];
}
/** Result of `generateVideo` — `{ spec, outPath, stills, brandKit }`. */
export interface GenerateVideoResult {
  spec: VideoSpec;
  outPath: string;
  stills: string[];
  brandKit: BrandKit;
}

/* -------------------------------------------------------------------------- */
/*  BrandKit → DirectorBrandKit adapter                                       */
/* -------------------------------------------------------------------------- */

/**
 * Shape a normalized ingest `BrandKit` into the director's structural view.
 * `DirectorBrandKit` is intentionally a subset, so this is a narrowing map.
 */
function toDirectorBrandKit(kit: BrandKit): DirectorBrandKit {
  return {
    id: kit.id,
    url: kit.url,
    name: kit.name,
    palette: kit.palette,
    fonts: kit.fonts,
    screens: kit.screens.map((s) => ({ key: s.key, role: s.role })),
    copy: kit.copy.map((c) => ({ text: c.text, kind: c.kind })),
    voice: kit.voice,
  };
}

/**
 * Build a minimal, valid BrandKit when there is no URL and no supplied kit —
 * so the keyless, URL-less path still has a brand to direct against. Uses the
 * safe dark default palette (matches the `dark-cinematic` register).
 */
function fallbackBrandKit(input: PipelineInput): BrandKit {
  const seed = input.goal?.notes ?? input.goal?.angle ?? "brand";
  const id = hashUrl(`local:${seed}`);
  return {
    id,
    url: input.url ?? "",
    name: "Your Product",
    palette: DEFAULT_PALETTE,
    fonts: [],
    screens: (input.assets ?? []).map((a) => ({
      key: a,
      src: a,
      role: "image" as const,
    })),
    copy: [],
    voice: "clear-neutral",
    meta: { capturedAt: new Date(0).toISOString(), blocked: false, notes: ["synthetic fallback kit"] },
  };
}

/* -------------------------------------------------------------------------- */
/*  Lint-clean guarantee                                                      */
/* -------------------------------------------------------------------------- */

function formatViolations(violations: Violation[]): string {
  return violations.map((v) => `  - [${v.rule}] ${v.path}: ${v.message}`).join("\n");
}

/**
 * Guarantee a lint-clean spec reaches the renderer. The director already lints,
 * but `planOutline` may receive a spec from any director path — so we re-assert
 * here and, if a violation slips through (only possible from the LLM path), fall
 * back to the deterministic heuristic spec (which is lint-clean by construction).
 * Fail-closed: if even the fallback is dirty, throw.
 */
function ensureClean(
  spec: VideoSpec,
  directorBk: DirectorBrandKit,
  goal: DirectorGoal,
  log: Logger,
): VideoSpec {
  const lint = lintSpec(spec);
  if (lint.ok) return spec;

  log(
    `[plan] emitted spec failed the anti-slop lint; repairing via heuristic fallback:\n${formatViolations(
      lint.violations,
    )}`,
  );
  const repaired = heuristicDirect(directorBk, goal);
  const recheck = lintSpec(repaired);
  if (!recheck.ok) {
    throw new Error(
      `pipeline: could not produce a lint-clean VideoSpec.\n${formatViolations(recheck.violations)}`,
    );
  }
  return repaired;
}

/* -------------------------------------------------------------------------- */
/*  planOutline                                                               */
/* -------------------------------------------------------------------------- */

export interface PlanOptions {
  log?: Logger;
}

/**
 * Ingest (if a URL is given) → BrandKit → director → a lint-clean `VideoSpec`.
 * NO render. Uses the real LLM director when a key is present; otherwise the
 * keyless heuristic director — so this always works, even with an empty `.env`.
 */
export async function planOutline(
  input: PipelineInput,
  opts: PlanOptions = {},
): Promise<PlanOutlineResult> {
  const log = opts.log ?? defaultLog;
  const goal = input.goal ?? {};

  // 1. BrandKit: supplied → use it; URL → ingest; neither → synthetic fallback.
  let brandKit: BrandKit;
  if (input.brandKit) {
    log(`[plan] using supplied brand kit "${input.brandKit.name}".`);
    brandKit = input.brandKit;
  } else if (input.url) {
    log(`[plan] ingesting ${input.url} …`);
    brandKit = await ingest(input.url);
    log(
      `[plan] brand kit: "${brandKit.name}" — ${brandKit.screens.length} screen(s), ` +
        `${brandKit.copy.length} copy candidate(s)${brandKit.meta.blocked ? " (degraded crawl)" : ""}.`,
    );
  } else {
    log(`[plan] no URL or brand kit given — using a synthetic fallback kit.`);
    brandKit = fallbackBrandKit(input);
  }

  // REAL-ASSET OVERRIDE: dropped screenshots in `brand-assets/<slug>/` REPLACE
  // scraped/empty screens, taking precedence (SAAS_ROADMAP §3). Applies to every
  // branch above (supplied kit / URL ingest / fallback) so a real screen always
  // wins when one was dropped — even on a degraded crawl or a keyless run.
  const beforeScreens = brandKit.screens.length;
  brandKit = applyRealAssetOverride(brandKit, { log });
  if (brandKit.screens.length !== beforeScreens) {
    log(
      `[plan] using ${brandKit.screens.length} REAL dropped screen(s) ` +
        `(role split: ${brandKit.screens.map((s) => s.role).join(", ")}).`,
    );
  }

  const directorBk = toDirectorBrandKit(brandKit);

  // 2. Direct: LLM when keyed, else heuristic. Always end lint-clean.
  let spec: VideoSpec;
  if (hasLlmKey()) {
    log(`[plan] LLM key present (${llmKeySource()}) — directing via the model…`);
    try {
      spec = await direct(directorBk, goal);
      log(`[plan] model emitted a valid spec (${spec.scenes.length} scenes, preset ${spec.preset}).`);
    } catch (err) {
      const why =
        err instanceof SpecValidationError
          ? `${err.message} (last attempts: ${err.attempts.length})`
          : (err as Error).message;
      log(`[plan] LLM director failed (${why}); falling back to the keyless heuristic.`);
      spec = heuristicDirect(directorBk, goal);
    }
  } else {
    log(`[plan] no LLM key — directing via the keyless heuristic.`);
    spec = heuristicDirect(directorBk, goal);
    log(`[plan] heuristic spec: ${spec.scenes.length} scenes, preset ${spec.preset}.`);
  }

  // 3. Lint-clean guarantee before the spec leaves the brain.
  spec = ensureClean(spec, directorBk, goal, log);

  // 4. Stat-trust hard gate (both director paths). Forces every Stats item to an
  //    unverified "e.g." example and drops numeric-claim callouts, so no mined /
  //    LLM-fabricated number reaches the screen as a hard, contradictable metric.
  spec = gateStatTrust(spec);

  // 5. FeatureBeat screen assignment (both director paths). Fills any beat that
  //    didn't name a screen, round-robin by index, so the feature tour always
  //    shows three DISTINCT bespoke screens (ATS gauge → bullet diff → cover
  //    draft) instead of keyword-collapsing every beat onto the gauge.
  spec = assignFeatureScreens(spec);

  return { spec, brandKit };
}

/* -------------------------------------------------------------------------- */
/*  renderStoryboard                                                          */
/* -------------------------------------------------------------------------- */

/** Collect every asset key a spec references (ProductShot.screen, FeatureBeat.region). */
function specAssetKeys(spec: VideoSpec): string[] {
  const keys: string[] = [];
  for (const scene of spec.scenes) {
    if (scene.component === "ProductShot") keys.push(scene.props.screen);
    else if (scene.component === "FeatureBeat") keys.push(scene.props.region);
  }
  return keys;
}

export interface StoryboardRenderOptions {
  log?: Logger;
  /** Output dir for the stills. Default a temp dir per spec. */
  outDir?: string;
  /** Asset root for `screen` keys. Default `<repo>/public`. */
  assetRoot?: string;
  /** fps for VO-derived placement. Default 30. */
  fps?: number;
}

/**
 * One still PNG per scene (mid-scene keyframe) via the orchestrator's host
 * still path — the cheap gate before a full render. Seconds, not minutes.
 */
export async function renderStoryboard(
  spec: VideoSpec,
  opts: StoryboardRenderOptions = {},
): Promise<StoryboardResult> {
  const log = opts.log ?? defaultLog;
  // Defensive: never storyboard an off-token spec.
  const lint = lintSpec(spec);
  if (!lint.ok) {
    throw new Error(
      `renderStoryboard: spec is not lint-clean — refusing to render.\n${formatViolations(lint.violations)}`,
    );
  }
  // Stage any REAL dropped screens this spec references so the storyboard gate
  // shows real <img> stills (not the MockUI fallback) — the brandKit-free path.
  stageRealAssetKeys(specAssetKeys(spec), opts.assetRoot ?? DEFAULT_ASSET_ROOT, {
    log,
  });

  const { stills } = await renderStoryboardStills(spec, {
    log,
    outDir: opts.outDir,
    assetRoot: opts.assetRoot,
    fps: opts.fps,
  });
  log(`[storyboard] ${stills.length} still(s) rendered.`);
  return { stills };
}

/* -------------------------------------------------------------------------- */
/*  generateVideo                                                             */
/* -------------------------------------------------------------------------- */

export interface GenerateOptions {
  log?: Logger;
  /** Output mp4 path. Default `<repo>/out/<brandKitId>-<ts>.mp4`. */
  outPath?: string;
  /** Also render the per-scene storyboard stills. Default `true`. */
  storyboard?: boolean;
  /** Draft (jpeg/fast) render. Default `false` (final png). */
  draft?: boolean;
  /** Worker page count. Default the orchestrator's `min(6, cores-2)`. */
  workers?: number;
  /** fps. Default 30. */
  fps?: number;
  /** Asset root for `screen`/VO keys. Default `<repo>/public`. */
  assetRoot?: string;
  /**
   * Force-skip VO even if OmniVoice is reachable (silent render). Default
   * `false` — VO runs when reachable AND a voice line is present.
   */
  silent?: boolean;
  /**
   * Ambient music-bed path (instrumental). Mixed UNDER the VO, ducked + faded.
   * Default: the orchestrator's instrumental bed (`audio/ncs-sky-high.mp3`).
   */
  musicBed?: string;
  /**
   * Enable the ducked music bed. Default: the orchestrator's default (ON when a
   * bed resolves AND there is VO). Set `false` to force a VO-only master.
   */
  music?: boolean;
}

/**
 * planOutline → (VO if available) → orchestrator.renderVideo → mp4 in `out/`.
 *
 * VO gate: if OmniVoice is reachable AND at least one scene carries `vo.text`,
 * synthesize + loudnorm + measure and stamp `audioUrl` onto the spec; otherwise
 * render silent at each scene's `minFrames`. Either way a real mp4 is produced.
 */
export async function generateVideo(
  input: PipelineInput,
  opts: GenerateOptions = {},
): Promise<GenerateVideoResult> {
  const log = opts.log ?? defaultLog;
  const fps = opts.fps ?? 30;
  const assetRoot = opts.assetRoot;

  // 1. Plan (ingest → director → lint-clean spec).
  const { spec: planned, brandKit } = await planOutline(input, { log });
  let spec = planned;

  // 1b. Stage any REAL dropped screens into the served asset root so their
  // `brand-assets/<slug>/…` keys resolve to real <img> stills in both the
  // storyboard and the full render (SAAS_ROADMAP §3: dropped uploads beat scrape).
  stageRealAssets(brandKit, assetRoot ?? DEFAULT_ASSET_ROOT, { log });

  // 2. VO gate.
  const wantsVo =
    !opts.silent && spec.scenes.some((s) => (s.vo?.text ?? "").trim().length > 0);
  if (wantsVo) {
    log(`[vo] checking OmniVoice reachability at ${omniVoiceBaseUrl()} …`);
    const reachable = await omniVoiceReachable();
    if (reachable) {
      try {
        const voResult = await synthVoForSpec(spec, { log });
        spec = voResult.spec;
        log(`[vo] voiced ${voResult.synthesized} scene(s).`);
      } catch (err) {
        log(`[vo] synthesis failed (${(err as Error).message}); rendering SILENT.`);
      }
    } else {
      log(`[vo] OmniVoice not reachable — rendering SILENT (minFrames placement).`);
    }
  } else {
    log(`[vo] ${opts.silent ? "silent mode forced" : "no VO text"} — rendering SILENT.`);
  }

  // 3. Optional storyboard stills (cheap gate / preview surface).
  let stills: string[] = [];
  if (opts.storyboard ?? true) {
    try {
      const sb = await renderStoryboard(spec, { log, assetRoot, fps });
      stills = sb.stills;
    } catch (err) {
      // Stills are a convenience surface — a failure here must not block the mp4.
      log(`[storyboard] still render failed (${(err as Error).message}); continuing to full render.`);
    }
  }

  // 4. Full render → mp4 in out/.
  const outPath =
    opts.outPath ?? join(OUT_DIR, `${brandKit.id}-${Date.now()}.mp4`);
  log(`[render] rendering full video → ${outPath}`);
  const result = await renderVideo(spec, {
    outPath,
    fps,
    draft: opts.draft ?? false,
    workers: opts.workers,
    assetRoot,
    musicBed: opts.musicBed,
    music: opts.music,
    log,
  });
  log(`[render] done → ${result.outPath} (${result.frames} frames, ${result.durationS.toFixed(2)}s).`);

  return { spec, outPath: result.outPath, stills, brandKit };
}
