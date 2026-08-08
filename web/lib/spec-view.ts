/**
 * web/lib/spec-view.ts — pure, client-safe derivations over a `VideoSpec`.
 *
 * The Outline gate (SAAS_ROADMAP §3, gate 2) is "approve the STORY before the
 * look" at ZERO render cost — so everything it shows is computed here from the
 * spec alone: ordered scene cards, per-scene copy + estimated duration, the
 * running total vs the 60–90s sweet spot, the ⚠ unverified-stat affordance, and
 * the ★ single signature-motion marker.
 *
 * No imports of runtime spec/registry code (keeps the client bundle lean); the
 * `MIN_FRAMES` map below mirrors `src/spec/registry.ts` and is asserted against
 * it by the API layer's type usage.
 */
import type { VideoSpec, SceneSpec, SceneCardVM } from "./types";

const FPS = 30;

/** Floors mirrored from `src/spec/registry.ts` (minFrames per archetype). */
const MIN_FRAMES: Record<SceneSpec["component"], number> = {
  Hook: 45,
  Problem: 60,
  ProductShot: 90,
  FeatureBeat: 60,
  Stats: 75,
  Proof: 60,
  CTA: 90,
};

/** Padding frames added to a VO-derived estimate (matches the placer's tail). */
const VO_PAD = 18;

/** Average narration rate — used only for the pre-render duration ESTIMATE. */
const WORDS_PER_SECOND = 2.6;

/** Estimate a scene's frames: max(minFrames floor, VO-derived) — pre-render. */
function estimateFrames(scene: SceneSpec): number {
  const floor = MIN_FRAMES[scene.component];
  const text = scene.vo?.text?.trim();
  if (!text) return floor;
  const words = text.split(/\s+/).filter(Boolean).length;
  const voFrames = Math.ceil((words / WORDS_PER_SECOND) * FPS) + VO_PAD;
  return Math.max(floor, voFrames);
}

/** The primary on-screen copy line for a scene (for the outline card). */
function primaryCopy(scene: SceneSpec): string {
  switch (scene.component) {
    case "Hook":
      return scene.props.lines.join("  /  ");
    case "Problem":
      return scene.props.resolve;
    case "ProductShot":
      return scene.props.headline;
    case "FeatureBeat":
      return scene.props.caption;
    case "Stats":
      return scene.props.items
        .map((it) => `${it.to}${it.suffix} ${it.label}`)
        .join("  ·  ");
    case "Proof":
      return "quote" in scene.props
        ? `“${scene.props.quote}” — ${scene.props.attribution}`
        : `${scene.props.logos.length} logos`;
    case "CTA":
      return `${scene.props.headline}  →  ${scene.props.url}`;
    default:
      return "";
  }
}

/** Does this scene carry at least one unverified stat (the ⚠ affordance)? */
function hasUnverifiedStat(scene: SceneSpec): boolean {
  return scene.component === "Stats" && scene.props.items.some((i) => !i.verified);
}

/**
 * Build ordered scene-card view-models. The single signature motion fires only
 * at the FIRST ProductShot reveal and the CTA (SAAS_ROADMAP §4: "one signature
 * motion per video … fires only at S3 reveal + S7 CTA") — we mark those.
 */
export function toSceneCards(spec: VideoSpec): SceneCardVM[] {
  let signedProductShot = false;
  return spec.scenes.map((scene, index) => {
    const estFrames = estimateFrames(scene);
    let signature = false;
    if (scene.component === "ProductShot" && !signedProductShot) {
      signature = true;
      signedProductShot = true;
    } else if (scene.component === "CTA") {
      signature = true;
    }
    return {
      index,
      id: scene.id,
      component: scene.component,
      copy: primaryCopy(scene),
      vo: scene.vo?.text,
      estFrames,
      estSeconds: estFrames / FPS,
      unverifiedStat: hasUnverifiedStat(scene),
      signature,
    };
  });
}

export interface DurationSummary {
  frames: number;
  seconds: number;
  /** "green" 60–90s sweet spot · "amber" outside it (SAAS_ROADMAP §3 gate 2). */
  band: "green" | "amber";
  label: string;
}

/**
 * Running total across all scenes, minus transition overlap (matching the
 * orchestrator's `total = sum(durations) - T*(n-1)`), with the §3 sweet-spot
 * banding: green inside 60–90s, amber outside.
 */
export function durationSummary(spec: VideoSpec): DurationSummary {
  const cards = toSceneCards(spec);
  const sum = cards.reduce((a, c) => a + c.estFrames, 0);
  const overlap = spec.transitions.durationInFrames * Math.max(0, cards.length - 1);
  const frames = Math.max(0, sum - overlap);
  const seconds = frames / FPS;
  const band: DurationSummary["band"] =
    seconds >= 60 && seconds <= 90 ? "green" : "amber";
  return {
    frames,
    seconds,
    band,
    label: `${seconds.toFixed(1)}s`,
  };
}
