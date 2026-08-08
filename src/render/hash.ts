/**
 * Content-hash helpers for the per-frame render cache.
 *
 * The cache key is `hash(sceneProps + palette + motion + frame)` per
 * `ENGINE_DESIGN §4` ("Incremental re-render"). A copy edit to one scene
 * changes only that scene's frames' hashes, so every untouched frame is a cache
 * hit — the mechanism that makes the editor's per-scene regen nearly free.
 *
 * Pure / node-only. Uses `crypto` (stdlib) — no external dep.
 */
import { createHash } from "node:crypto";

import type { VideoSpec } from "../spec/schema";

/** Stable JSON: sort object keys so key-order can't perturb the hash. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return v;
  });
}

/**
 * Per-frame cache key. Binds the touched scene's props + the video-wide palette
 * + motion + the frame index. The whole-spec scenes array is NOT folded in —
 * only the scene visible at this frame matters — but palette/motion are
 * video-global, so they participate.
 *
 * Because scenes overlap during transitions, a frame can show two scenes; we
 * therefore key on the *spec scenes array slice that is active* rather than a
 * single scene. The orchestrator passes the active scene ids; an empty list
 * (shouldn't happen) degrades to the full scenes array.
 */
export function frameHash(
  spec: VideoSpec,
  frame: number,
  activeSceneIds: readonly string[],
  capture: "png" | "jpeg",
  /**
   * A hash of the rendering CODE (the host bundle). Folded into the key so that
   * a change to ANY scene component, the shader, or the host gate invalidates
   * every cached frame — otherwise the cache (keyed only on spec data) would
   * silently serve pixels rendered by stale code after an engine change. The
   * orchestrator passes the bundle's content hash; omitting it keeps the legacy
   * (data-only) key for callers that don't render through the bundle.
   */
  codeVersion = "",
): string {
  const active =
    activeSceneIds.length > 0
      ? spec.scenes.filter((s) => activeSceneIds.includes(s.id))
      : spec.scenes;
  const material = {
    // Namespace the key by the WHOLE-spec hash so frames CANNOT collide across
    // different videos that share one `cacheDir` (the orchestrator allows an
    // explicit `opts.cacheDir`, and multi-tenant render pools will). The
    // active-scene slice alone is not a sufficient discriminator: a scene's
    // pixels depend on its position in the timeline (its `from` offset, hence
    // its in-scene `useFrame` value), which is a function of EVERY scene's
    // measured-VO/minFrames placement — not just the visible slice. Two specs
    // can therefore share an identical active slice at frame N yet must render
    // different pixels. `specHash` (16 hex of the full spec) closes that gap.
    spec: specHash(spec),
    v: spec.version,
    format: spec.format,
    preset: spec.preset,
    motion: spec.motion,
    palette: spec.palette,
    transitions: spec.transitions,
    scenes: active.map((s) => ({ id: s.id, component: s.component, props: s.props, vo: s.vo })),
    frame,
    capture,
    code: codeVersion,
  };
  return createHash("sha1").update(stableStringify(material)).digest("hex");
}

/** Hash the whole spec — used to namespace the on-disk cache per video. */
export function specHash(spec: VideoSpec): string {
  return createHash("sha1").update(stableStringify(spec)).digest("hex").slice(0, 16);
}
