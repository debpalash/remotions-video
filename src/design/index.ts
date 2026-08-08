/**
 * `src/design` — the FROZEN design system (the moat).
 *
 * Four presets × motion tokens × palette injection. Scenes assemble from these;
 * they cannot style. Imports its types from the `src/spec` contract; never
 * modifies `src/spec` or `src/promo`.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §4`.
 */
export * from "./motion";
export * from "./palette";
export * from "./presets";
