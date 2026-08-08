/**
 * `src/render/host` — the Kino COMPOSITION HOST.
 *
 * Maps `window.__KINO_SPEC__` (a `VideoSpec`) to the scene stack and renders one
 * frame, with the determinism-review ready-gate (real-rAF captured pre-sandbox,
 * double-rAF paint gate, `__KINO_READY__`, no `antialias:true`). Renderer-
 * agnostic of capture: the orchestrator consumes the bundle this produces.
 *
 *  - `stack.tsx` — pure spec → scene-stack builder (placement, `<Series>`
 *    overlap, `<PaletteProvider>`). Shared by the entry and the dev harness.
 *  - `entry.tsx` — the browser entry (auto-boots, publishes the per-frame seam).
 *  - `build.ts`  — `buildHost()` (esbuild → one bundle) + `renderHostHtml()`.
 *  - `dev.ts`    — standalone "open one frame in a browser" command.
 *  - `index.html`— the canonical host page template.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5`, `docs/ENGINE_DESIGN.md`.
 */

// The pure scene-stack builder (no DOM, no capture) — safe to import anywhere.
export {
  SceneStack,
  Stage,
  FrameStage,
  placeSpec,
  FORMATS,
  type KinoScenes,
  type VoDurations,
  type SceneStackProps,
  type StageProps,
  type FrameStageProps,
} from "./stack";

// Node-only build/serve helpers (esbuild, fs). Do NOT import from the browser.
export {
  buildHost,
  renderHostHtml,
  renderHostPage,
  ENTRY_PATH,
  type BuildHostOptions,
  type BuiltHost,
  type HostHtmlOptions,
  type RenderHostPageOptions,
} from "./build";

// NOTE: `./entry` is intentionally NOT re-exported here. It auto-boots on import
// (reads `window`, mounts React), so importing it from Node would throw. The
// orchestrator points esbuild at `ENTRY_PATH` directly.
