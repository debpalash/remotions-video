/**
 * Scene registry — the single source of truth, consumed three ways:
 *   1. runtime render map   (name → React component)
 *   2. Director LLM prompt   (allowed scenes + their JSON-schema'd props)
 *   3. validation            (props schema + the `minFrames` floor)
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §5` ("Scene registry").
 *
 * NOTE ON `component`: the scene React components are extracted by parallel P0
 * agents (collapse `DashboardShot/AnalysisShot/ResubirdShot` → `ProductShot`,
 * etc.). They do not exist at contract-authoring time and MUST NOT be imported
 * here, or this file (which everything codes against) would fail to load before
 * those agents land. So the registry ships the contract-relevant data —
 * `props` schema + `minFrames` — and exposes a typed `bindComponents()` seam
 * the composition shell calls once to attach the rendered components.
 */
import type * as React from "react";
import { z, type ZodType } from "zod";

import {
  HookProps,
  ProblemProps,
  ProductShotProps,
  FeatureBeatProps,
  StatsProps,
  ProofProps,
  CtaProps,
} from "./schema";

/* -------------------------------------------------------------------------- */
/*  Registry shape                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A registry entry. `props` is the per-scene Zod schema and the validation
 * source of truth; `minFrames` is the duration floor used when a scene has no
 * VO (e.g. a logo beat) — `calculateMetadata` floors measured VO at this value.
 */
export type RegistryEntry = {
  /** Per-scene props schema — must match the matching `SceneSpec` member. */
  props: ZodType;
  /** Floor (in frames) when a scene has no measured VO duration. */
  minFrames: number;
};

/**
 * The frozen registry. Keys are the only scene components the director may
 * emit; each pairs a props schema with a `minFrames` floor.
 */
export const REGISTRY = {
  Hook: { props: HookProps, minFrames: 45 },
  Problem: { props: ProblemProps, minFrames: 60 },
  ProductShot: { props: ProductShotProps, minFrames: 90 },
  FeatureBeat: { props: FeatureBeatProps, minFrames: 60 },
  Stats: { props: StatsProps, minFrames: 75 },
  Proof: { props: ProofProps, minFrames: 60 },
  CTA: { props: CtaProps, minFrames: 90 },
} satisfies Record<string, RegistryEntry>;

/** The set of legal scene component names. The model can ONLY pick these. */
export type SceneName = keyof typeof REGISTRY;

/** All scene names as a runtime array (stable order = narrative reading order). */
export const SCENE_NAMES = [
  "Hook",
  "Problem",
  "ProductShot",
  "FeatureBeat",
  "Stats",
  "Proof",
  "CTA",
] as const satisfies readonly SceneName[];

/* -------------------------------------------------------------------------- */
/*  JSON Schema export (for the Director prompt / structured-output mode)      */
/* -------------------------------------------------------------------------- */

/**
 * A JSON Schema document (draft-7), as produced by `z.toJSONSchema(schema, …)`.
 *
 * `z.toJSONSchema` is overloaded (schema vs. registry). A bare
 * `ReturnType<typeof z.toJSONSchema>` resolves to the *registry* overload's
 * `{ schemas: … }` shape, which is NOT what the per-schema call returns — so we
 * pin the generic to the schema overload (`z.ZodType`) to get the document type
 * the calls below actually produce.
 */
export type JsonSchema = ReturnType<typeof z.toJSONSchema<z.ZodType>>;

/**
 * Per-scene JSON Schema of the allowed props, keyed by scene name. This is what
 * the Director prompt embeds so the model can ONLY pick these scenes with these
 * props (and what a structured-output / JSON-mode model is constrained by).
 *
 * Uses zod v4's native `z.toJSONSchema` (the repo is on zod 4.3.6). NOTE: the
 * `zod-to-json-schema` package named in the roadmap is a zod-v3-only library —
 * at runtime it inspects `def.typeName`, which v4 schemas do not have, so it
 * silently emits empty schemas. The native API is the correct, equivalent tool.
 *
 * `draft-7` is requested for the broadest LLM-provider compatibility. Built with
 * an explicit loop (no `Object.fromEntries`) to stay within `lib: ["es2015"]`.
 */
export const REGISTRY_JSON_SCHEMA: Record<SceneName, JsonSchema> = (() => {
  const out = {} as Record<SceneName, JsonSchema>;
  for (let i = 0; i < SCENE_NAMES.length; i++) {
    const name = SCENE_NAMES[i];
    out[name] = z.toJSONSchema(REGISTRY[name].props, { target: "draft-7" });
  }
  return out;
})();

/* -------------------------------------------------------------------------- */
/*  Component-binding seam                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The map the composition shell builds at runtime: scene name → React
 * component. Kept separate from `REGISTRY` so the contract module never imports
 * the (later-authored) scene components.
 */
export type ComponentMap = Record<SceneName, React.FC<any>>;

/**
 * Type-safe constructor for the runtime component map. The composition shell
 * calls this once with the extracted scene components; the `satisfies`-style
 * `ComponentMap` parameter guarantees every registry key is provided and no
 * stray key sneaks in.
 */
export const bindComponents = (map: ComponentMap): ComponentMap => map;

/** Frame floor lookup — convenience for `calculateMetadata`. */
export const minFramesFor = (name: SceneName): number => REGISTRY[name].minFrames;
