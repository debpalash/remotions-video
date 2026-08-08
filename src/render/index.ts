/**
 * `src/render` — the Kino ORCHESTRATOR (node).
 *
 * Consumes a `VideoSpec` and produces an MP4: persistent-page Playwright
 * capture, contiguous frame-range sharding across a worker pool, DOM-screenshot
 * + canvas-readback capture paths, ffmpeg h264 encode, audio mux, per-frame
 * content-hash cache. The browser-side host (`./host/entry.tsx` + `./host/stack`)
 * is bundled by the orchestrator and never imported into node.
 *
 * Frozen spec: `docs/ENGINE_DESIGN.md §3/§4`, `docs/SAAS_ROADMAP.md §5`.
 */
export { renderVideo, bufferHash } from "./orchestrator";
export type { RenderOptions, RenderResult } from "./orchestrator";
export { frameHash, specHash } from "./hash";
export { mixMusicBed, DEFAULT_MUSIC_BED } from "./musicbed";
export type { MusicBedOptions, FfRun } from "./musicbed";
