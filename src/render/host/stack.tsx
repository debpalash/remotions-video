/**
 * Kino composition host — the SCENE STACK builder.
 *
 * Pure, renderer-agnostic mapping from a `VideoSpec` to the React tree that
 * renders one frame. This is the single place that knows how a spec becomes a
 * stack of scenes; the browser `entry.tsx` and any dev harness both consume it,
 * so the placement math lives here once and never drifts.
 *
 * What it does (per the SHARED RENDER INTERFACE):
 *  - binds `KINO_SCENES` (the archetype components) by `component` name;
 *  - derives each scene's `durationInFrames` via `placeScenes` (src/vo) — using
 *    the measured VO duration when `vo.audioUrl` is present, else the registry
 *    `minFrames` floor;
 *  - stacks scenes with `<Series>`/`<Series.Sequence>`, applying the transition
 *    overlap so adjacent scenes cross-fade for `transitions.durationInFrames`;
 *  - wraps the whole tree in `<PaletteProvider palette motion>` so every scene
 *    reads palette/motion tokens from context (never `import {COLORS}`).
 *
 * Determinism: this builder is a pure function of the spec + the per-scene VO
 * durations it is handed. It calls no clock, no RNG, no `requestAnimationFrame`.
 * The audio durations are measured up-front (Node side) and passed in as data so
 * the browser render never does async work mid-frame.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5` (dynamic composition + auto-placer),
 * `docs/ENGINE_DESIGN.md §2` (render = pure function of `t`).
 */
import * as React from "react";

import type { VideoSpec, SceneSpec } from "../../spec";
import { REGISTRY, type SceneName } from "../../spec";
import { FrameProvider, Series } from "../../engine";
import { PaletteProvider } from "../../design";
// Burned-in captions (mandatory conversion lever — SAAS_ROADMAP §2). The band is
// a pure-fn-of-frame DOM layer that composes OVER the scene stack; the cue track
// is derived from each scene's `vo.text` + the SAME placement this host computes,
// so the on-screen captions and the orchestrator's `.vtt` share one timing model.
import {
  CaptionBand,
  buildCaptionTrack,
  captionTextForScene,
  type CaptionSceneInput,
} from "../../kino-scenes/captions";
// Import directly from `../../vo/place` (NOT the `../../vo` barrel): the barrel
// re-exports the node-only VO pipeline (`tts`/`loudnorm`/`measure`, which pull
// in `node:child_process`/`node:fs`), and this module is bundled for the
// browser. `place.ts` is the pure, dependency-free auto-placer.
import {
  placeScenes,
  type PlaceSceneInput,
  type PlacementResult,
} from "../../vo/place";

/**
 * The bound archetype components, keyed by scene name. This is the shape
 * `src/kino-scenes` exports as `KINO_SCENES` (the SHARED RENDER INTERFACE:
 * `Record<SceneName, React.FC<any>>`). Defined locally so the host module does
 * not hard-depend on a type export from a sibling agent's module — the value is
 * imported by `entry.tsx`, but the *shape* is owned here for the contract.
 */
export type KinoScenes = Record<SceneName, React.FC<any>>;

/* -------------------------------------------------------------------------- */
/*  VO duration manifest                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Measured VO durations, keyed by scene `id`, in SECONDS. Produced Node-side by
 * the VO pipeline (TTS → loudnorm → measure) and threaded into the host as data
 * so the browser render stays a pure, synchronous function of the frame.
 *
 * A scene id absent from this map (or mapped to `null`/`undefined`) falls back
 * to its registry `minFrames` floor — exactly the "logo beat with no VO" case.
 */
export type VoDurations = Readonly<Record<string, number | null | undefined>>;

/* -------------------------------------------------------------------------- */
/*  Placement                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resolve every scene's frame layout from the spec + the measured VO manifest.
 *
 * `overlap` is the transition duration (scenes overlap by `T`); `fps`/`pad`
 * carry the repo conventions through `placeScenes`. Returns the `placeScenes`
 * result verbatim so callers (the orchestrator's total-frame count, a dev
 * harness) can reuse the same `from`/`durationInFrames`/`totalFrames` math.
 */
export function placeSpec(
  spec: VideoSpec,
  voDurations: VoDurations = {},
  opts: { fps?: number } = {},
): PlacementResult {
  const fps = opts.fps ?? 30;

  const inputs: PlaceSceneInput[] = spec.scenes.map((scene) => {
    const name = scene.component as SceneName;
    const minFrames = REGISTRY[name].minFrames;
    // Prefer a measured VO duration; fall back to the registry floor. A scene
    // that declares `vo.audioUrl` but is (somehow) missing from the manifest is
    // treated as "no VO" rather than crashing the render — fail soft to floor.
    const measured = voDurations[scene.id];
    const hasAudio = Boolean(scene.vo?.audioUrl);
    const voSeconds =
      hasAudio && typeof measured === "number" ? measured : undefined;
    return { id: scene.id, minFrames, voSeconds };
  });

  return placeScenes(inputs, {
    fps,
    overlap: spec.transitions.durationInFrames,
    // `pad` keeps the repo default inside placeScenes (6); not overridden here.
  });
}

/* -------------------------------------------------------------------------- */
/*  Caption track                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Build the burned-in caption track for a spec, in COMPOSITION-frame
 * coordinates. Pairs each scene's `vo.text` with the frame window `placeSpec`
 * derived from the MEASURED VO duration, then `buildCaptionTrack` chunks every
 * line into short, readable cues and tiles each scene's window across them.
 *
 * This is the single shared source for both the on-screen `CaptionBand` (here)
 * and the orchestrator's `.vtt` sidecar — so the burned captions and the emitted
 * subtitles can never drift. Pure function of the spec + measured durations.
 */
export function captionTrackFor(
  spec: VideoSpec,
  voDurations: VoDurations = {},
  opts: { fps?: number } = {},
) {
  const placement = placeSpec(spec, voDurations, opts);
  const inputs: CaptionSceneInput[] = spec.scenes.map((scene, index) => {
    const placed = placement.scenes[index];
    return {
      id: scene.id,
      // A caption is only emitted for a scene that actually carries a VO line —
      // a silent/logo beat (no `vo.text`) contributes no cues — AND that is not a
      // headline scene whose words are already on screen (the Hook double-read).
      text: captionTextForScene(scene.component, scene.vo?.text),
      from: placed.from,
      durationInFrames: placed.durationInFrames,
    };
  });
  return buildCaptionTrack(inputs);
}

/* -------------------------------------------------------------------------- */
/*  Scene resolution                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Look up the bound component for a scene and render it with the scene's typed
 * props. The `component` discriminant is the registry key by construction (the
 * Zod union guarantees it), so the lookup is total over a validated spec.
 */
function renderScene(scene: SceneSpec, scenes: KinoScenes): React.ReactElement {
  const name = scene.component as SceneName;
  const Comp = scenes[name];
  if (!Comp) {
    throw new Error(
      `KINO_SCENES is missing a component for "${name}". ` +
        `Every registry archetype must be exported from src/kino-scenes.`,
    );
  }
  // Props are the matching schema member for this `component` (discriminated
  // union); the bound component is `React.FC<any>` per the shared interface.
  return <Comp {...(scene.props as object)} />;
}

/* -------------------------------------------------------------------------- */
/*  Stack                                                                      */
/* -------------------------------------------------------------------------- */

export type SceneStackProps = {
  /** The validated video spec to render. */
  spec: VideoSpec;
  /** The bound archetype components (`KINO_SCENES`). */
  scenes: KinoScenes;
  /** Measured VO durations by scene id, in seconds (else minFrames floor). */
  voDurations?: VoDurations;
};

/**
 * The scene stack for one frame.
 *
 * `<Series>` advances a running cursor and subtracts the per-segment `offset`
 * (the transition overlap) so neighbours overlap by `T` frames — the engine's
 * `Series`/`Sequence` then shift each scene's local frame origin. The first
 * scene takes no offset; every later scene overlaps the previous by `T`, which
 * is exactly the `cursor += dur - T` math the roadmap specifies.
 *
 * The whole tree is wrapped in `<PaletteProvider>` so scenes read palette/motion
 * from context. The provider sits *inside* the stack so a single mount covers
 * all scenes for the frame (palette/motion are constant across the video).
 */
export const SceneStack: React.FC<SceneStackProps> = ({
  spec,
  scenes,
  voDurations = {},
}) => {
  const placement = placeSpec(spec, voDurations);
  const overlap = spec.transitions.durationInFrames;
  // The caption track is built ONCE from the same placement, in composition
  // coordinates. The band reads it under the root FrameProvider (global frame),
  // so it must sit OUTSIDE the <Series> (which offsets the frame per scene) but
  // INSIDE the <PaletteProvider> (it draws palette tokens for the brand plate).
  const captionTrack = captionTrackFor(spec, voDurations);

  return (
    <PaletteProvider
      palette={spec.palette}
      motion={spec.motion}
      preset={spec.preset}
    >
      <Series>
        {spec.scenes.map((scene, index) => {
          const placed = placement.scenes[index];
          // First scene: no overlap. Later scenes overlap the previous by T so
          // the cursor advances by (dur - T) — matching placeSpec's layout.
          const offset = index === 0 ? 0 : overlap;
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={placed.durationInFrames}
              offset={offset}
            >
              {renderScene(scene, scenes)}
            </Series.Sequence>
          );
        })}
      </Series>
      {/* Burned-in captions, OVER the scene stack. Composition-frame coordinates
          (a sibling of <Series>, so it is NOT re-based per scene). Renders
          nothing when no cue is active, so silent beats stay clean. */}
      <CaptionBand track={captionTrack} format={spec.format} />
    </PaletteProvider>
  );
};

/* -------------------------------------------------------------------------- */
/*  Format dimensions                                                          */
/* -------------------------------------------------------------------------- */

/** Pixel dimensions per aspect ratio. The stage is rendered at native size. */
export const FORMATS = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
} as const satisfies Record<VideoSpec["format"], readonly [number, number]>;

/* -------------------------------------------------------------------------- */
/*  Stage  (format-sized capture surface, no frame ownership)                  */
/* -------------------------------------------------------------------------- */

export type StageProps = SceneStackProps;

/**
 * The fixed-size stage. Renders the scene stack into a `format`-sized box with
 * the palette `bg` as the backdrop so letterboxing never shows the page color.
 * The box clips overflow (scenes position themselves absolutely within it). It
 * carries `data-kino-stage` so the orchestrator can locate the capture surface.
 *
 * This component assumes a `<FrameProvider>` already sits above it — use
 * `FrameStage` (below) to mount both together for a single frame.
 */
export const Stage: React.FC<StageProps> = (props) => {
  const [width, height] = FORMATS[props.spec.format];
  return (
    <div
      data-kino-stage=""
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        overflow: "hidden",
        background: props.spec.palette.bg,
        // Block layout, no flex — the stage is the capture surface; scenes
        // position themselves absolutely within it.
      }}
    >
      <SceneStack {...props} />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  FrameStage  (the full root for ONE frame)                                  */
/* -------------------------------------------------------------------------- */

export type FrameStageProps = SceneStackProps & {
  /** The frame index to render (in composition coordinates). */
  frame: number;
  /** Composition fps. */
  fps: number;
  /** Total composition length in frames (for the root FrameProvider). */
  totalFrames: number;
};

/**
 * The full render root for one frame: mounts the root `<FrameProvider>` (which
 * owns the global frame and seeds `useFrame()` for the whole tree) above the
 * format-sized `Stage`. The `<Series>`/`<Sequence>` inside read this provider to
 * offset each scene's local frame origin.
 *
 * The browser entry and any dev harness both render exactly this — one place
 * decides the provider/stage/stack nesting, so the render is identical wherever
 * it is driven from.
 */
export const FrameStage: React.FC<FrameStageProps> = ({
  frame,
  fps,
  totalFrames,
  spec,
  scenes,
  voDurations,
}) => {
  return (
    <FrameProvider frame={frame} fps={fps} durationInFrames={totalFrames}>
      <Stage spec={spec} scenes={scenes} voDurations={voDurations} />
    </FrameProvider>
  );
};
