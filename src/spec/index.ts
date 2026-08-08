/**
 * `src/spec` — THE CONTRACT.
 *
 * The `VideoSpec` Zod schema, the scene registry, and a hand-written sample.
 * Everything in the system (director, VO, render, web app) codes against this.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5`, `docs/ENGINE_DESIGN.md`.
 */
export * from "./schema";
export * from "./registry";
export * from "./lint";
export * from "./trust";
export { SAMPLE_SPEC } from "./sample";
