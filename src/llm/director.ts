/**
 * director.ts — the DIRECTOR LLM.
 *
 * `direct(brandKit, goal)` → a validated `VideoSpec`. The model assembles the
 * frozen design system; it never styles it. The VALIDATOR is the quality gate
 * (CLAUDE.md / SAAS_ROADMAP §5: "the validator, not the model, is the quality
 * gate, which is why a free-tier model suffices"):
 *
 *   1. Build the system prompt from `REGISTRY_JSON_SCHEMA` (the only scenes +
 *      props the model is allowed to emit) and the contract rules.
 *   2. Ask the provider for schema-constrained JSON.
 *   3. `VideoSpec.safeParse` + a registry/narrative-ref check.
 *   4. On failure, feed the zod/ref error back and repair — up to 3 attempts.
 *   5. Fail CLOSED (throw `SpecValidationError`) — never return an unvalidated
 *      spec. A garbage spec must never reach the deterministic renderer.
 *
 * Imports the contract from `src/spec` only; does not modify it. Provider access
 * is via `src/llm/providers` (`llm()`), chosen by `process.env.LLM_PROVIDER`.
 */
import { z } from "zod";

import {
  VideoSpec,
  REGISTRY,
  REGISTRY_JSON_SCHEMA,
  SCENE_NAMES,
  lintSpec,
  gateStatTrust,
  findTrustViolations,
} from "../spec";

import {
  llm,
  type LlmProvider,
  type JsonSchema,
} from "./providers";

// House-brand style gate (CD R2 P2): clamps preset into the brand's locked
// allow-list + pins the curated on-brand palette (warms ResuBird off periwinkle).
import { gateBrandStyle } from "../design";

/* -------------------------------------------------------------------------- */
/*  Director input (structural — no coupling to the ingest module)            */
/* -------------------------------------------------------------------------- */

/**
 * The director's view of a BrandKit. Structurally a subset of the ingest
 * `BrandKit` (src/ingest/brandkit.ts) — we depend on the *shape*, not the
 * module, so the director compiles and tests standalone. Anything assignable to
 * the real BrandKit is accepted.
 */
export interface DirectorBrandKit {
  /** Stable id → becomes `VideoSpec.brandKitId`. */
  id: string;
  url?: string;
  name: string;
  /** Already shaped to the frozen `PaletteSchema`. */
  palette: {
    bg: string;
    surface: string;
    text: string;
    textDim: string;
    accent: string;
    accent2?: string;
    gradientText?: [string, string];
  };
  fonts?: string[];
  /** Asset keys the director may reference in `screen` / `region` / `logos`. */
  screens?: { key: string; role?: string }[];
  /** Ranked copy candidates harvested from the page. */
  copy?: { text: string; kind?: string }[];
  voice?: string;
}

/**
 * The creative brief. All fields optional except none — the director picks sane
 * defaults from the brand kit when unset (CLAUDE.md #4: never block on detail).
 */
export interface DirectorGoal {
  /** Output aspect ratio. Defaults to "16:9" (LP hero cut). */
  format?: "16:9" | "9:16" | "1:1";
  /** Target platform chip — informs length + safe-zone (advisory to the model). */
  platform?: string;
  /** One-line narrative angle, e.g. "lead with the ghosting pain". */
  angle?: string;
  /** Target length in seconds (the model still keeps 2..12 scenes). */
  lengthSeconds?: number;
  /** Force a preset; otherwise the model picks within the brand binding. */
  preset?: z.infer<typeof VideoSpec>["preset"];
  /** Free-form extra direction. */
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/*  Errors                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when, after the repair budget is exhausted, no schema-valid +
 * ref-valid `VideoSpec` was produced. Carries the attempt diagnostics so the
 * caller can log *why* the brain failed (the renderer is never reached).
 */
export class SpecValidationError extends Error {
  constructor(
    message: string,
    /** Per-attempt failure reasons, oldest first. */
    readonly attempts: string[],
    /** The last raw model output (truncated), for debugging. */
    readonly lastRaw?: string,
  ) {
    super(message);
    this.name = "SpecValidationError";
  }
}

/* -------------------------------------------------------------------------- */
/*  VideoSpec JSON Schema (for structured-output mode)                         */
/* -------------------------------------------------------------------------- */

/**
 * The whole-`VideoSpec` JSON Schema handed to the provider's structured-output
 * mode. Built with zod v4's native `z.toJSONSchema` (matching the registry's
 * choice — `zod-to-json-schema` is v3-only and emits empties on v4). Computed
 * once at module load.
 *
 * `draft-7` for broadest LLM-provider compatibility. `unrepresentable: "any"`
 * keeps generation from throwing on a node the target can't express; the
 * authoritative gate is `VideoSpec.safeParse`, not this on-wire schema.
 */
export const VIDEOSPEC_JSON_SCHEMA: JsonSchema = z.toJSONSchema(VideoSpec, {
  target: "draft-7",
  unrepresentable: "any",
}) as JsonSchema;

/* -------------------------------------------------------------------------- */
/*  System prompt                                                              */
/* -------------------------------------------------------------------------- */

/** Brand → preset binding (locked; SAAS_ROADMAP §4). Advisory in the prompt. */
const PRESET_GUIDANCE =
  'Pick exactly ONE preset for the whole video and never mix. Brand binding ' +
  '(locked): dark/agentic brands → "dark-cinematic" or "minimal-mono"; ' +
  'warm/editorial brands → "editorial" or "gradient-glass".';

/**
 * Build the director system prompt from `REGISTRY_JSON_SCHEMA` — the allowed
 * scenes and their props are injected as data, so the prompt is always in sync
 * with the contract. The narrative + anti-slop rules below are exactly the ones
 * the post-parse ref check enforces, stated up-front to cut wasted repairs.
 */
export function buildDirectorPrompt(
  registrySchema: typeof REGISTRY_JSON_SCHEMA = REGISTRY_JSON_SCHEMA,
): string {
  const sceneCatalog = SCENE_NAMES.map((name) => {
    const min = REGISTRY[name].minFrames;
    const props = JSON.stringify(registrySchema[name]);
    return `### ${name} (minFrames ${min})\nprops JSON Schema: ${props}`;
  }).join("\n\n");

  return [
    "You are the DIRECTOR for a deterministic marketing-video studio.",
    "You ASSEMBLE a frozen design system from data — you NEVER invent styles,",
    "colors, geometry, durations, or components. Output is ONE JSON object that",
    "validates against the VideoSpec contract. Output JSON ONLY — no prose, no",
    "markdown fences.",
    "",
    "## The job",
    "Given a brand kit and a goal, emit a VideoSpec: a PUNCHY launch cut — a",
    "conversion film, NOT a feature tour. The template that sells, kept tight:",
    "  3-second PAIN hook (open on the customer's pain, never a logo)",
    "  → real product UI → exactly TWO feature beats → ONE CTA.",
    "Keep it to about 5 scenes total; never march through 3–4 feature beats and",
    "drop the proof scene unless you have a REAL, sourced fact to show.",
    "Target 28–34s of narration overall (about 80–110 words, HARD CAP 120). A",
    "punchy launch cut, not a feature tour — every line earns its place.",
    "",
    "## No fabrication — the hardest rule (the validator rejects violations)",
    "NEVER invent social proof or metrics. Forbidden anywhere (vo.text, headlines,",
    "captions, callouts, Stats, Proof): user/customer COUNTS (\"50K+ job seekers\"),",
    "STAR ratings (\"4.9★\", \"rated 5 stars\"), PERCENTAGES (\"92% land a job\"),",
    "and NAMED or \"verified\" TESTIMONIALS (\"Jane D., Marketing Manager — Verified",
    "customer\"). You have NO verified-facts channel, so any such number/name is a",
    "hallucination that disqualifies the film. ALLOWED: capability claims the",
    "product genuinely does — \"see your ATS score in seconds\", \"rewrite any bullet",
    "in one click\". When in doubt, describe the capability, never a statistic.",
    "",
    "## Copywriting — this makes or breaks the film. Write like a top studio.",
    "You NEVER invent design (styles, colors, geometry, components) — but the COPY",
    "is yours to CRAFT, and it must be genuinely good:",
    "- The hook NAMES a visceral, specific pain in the customer's own life — the",
    "  feeling, the wasted hours, the dropped opportunity. Never a feature, never",
    "  the brand name, never a greeting.",
    "- Headlines are benefit-led and concrete. The CTA is ONE clear action.",
    "- vo.text reads like a confident human SPEAKING: short sentences, natural",
    "  rhythm, one idea per line. If it sounds robotic read aloud, rewrite it.",
    "- Use the brand's provided copy as RAW MATERIAL, then REWRITE into complete,",
    "  polished lines. NEVER emit a truncated or dangling fragment such as \"Your",
    "  Resume Gets\" or a bare brand name — every headline and every vo.text is a",
    "  FINISHED thought that could ship on a billboard.",
    "- Specific beats generic: prefer the brand's real nouns and numbers over",
    "  filler adjectives.",
    "- Good hook: \"Your résumé vanishes into the ATS black hole.\"  Bad: \"Welcome",
    "  to ResuBird.\" / \"Your Resume Gets\" / \"The all-in-one platform.\"",
    "",
    "## Allowed scenes (you may ONLY use these, with EXACTLY these props)",
    sceneCatalog,
    "",
    "## Hard rules (the validator rejects violations — follow them)",
    "- version = 1.",
    "- Exactly ONE palette, ONE preset, ONE motion for the whole video.",
    "- " + PRESET_GUIDANCE,
    "- Colors are NEVER raw hex in scene props. Callout `accent` is a palette",
    "  KEY: one of \"accent\" | \"accent2\" | \"text\". The top-level `palette` is",
    "  provided to you; copy it through unchanged.",
    "- `screen` / `region` / `logos[]` are ASSET KEYS from the brand kit's",
    "  screens — never URLs, never video. Use the keys given; if none fit, reuse",
    "  the most relevant provided key.",
    "- `icon` is a lucide-react icon name (kebab-case, e.g. \"message-circle\").",
    "- Narrative sanity: at most ONE Hook and it MUST be the FIRST scene; at most",
    "  ONE CTA and it MUST be the LAST scene; at most ONE Proof; at most FOUR",
    "  FeatureBeat scenes. Scene `id`s are unique, short, kebab-case.",
    "- Every scene SHOULD carry `vo.text` (1–2 spoken sentences). Keep copy tight",
    "  and on-brand; prefer the brand's own words from the provided copy bank.",
    "- Do NOT set `vo.audioUrl` — the VO stage fills it. Do NOT set any frame",
    "  counts — duration is derived from the measured voiceover.",
    "- Mark a Stats item `verified: true` ONLY if the number is a real, sourced",
    "  brand metric; otherwise leave it false (it renders as an example).",
    "",
    "## Output",
    "Return the VideoSpec JSON object and nothing else.",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  Response extraction + validation                                          */
/* -------------------------------------------------------------------------- */

/**
 * Pull a JSON object out of a model response. Structured-output modes return raw
 * JSON, but a stray ```json fence or leading prose can sneak in — we slice from
 * the first `{` to its matching `}` (brace-balanced, string/escape aware) so a
 * tail comment doesn't break `JSON.parse`. Returns the parsed value or throws.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  // Fast path: the whole thing is JSON.
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to brace-slicing */
  }

  const start = text.indexOf("{");
  if (start === -1) throw new Error("no JSON object found in model output");

  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }
  throw new Error("unterminated JSON object in model output");
}

/**
 * Registry + narrative ref check. The discriminated union already guarantees
 * each scene's props match its component, so this enforces the invariants the
 * Zod schema cannot express:
 *   - every `component` is a real REGISTRY key (defense-in-depth);
 *   - scene ids are unique;
 *   - ≤1 Hook and it is first; ≤1 CTA and it is last; ≤1 Proof; ≤4 FeatureBeat;
 *   - `brandKitId` is present (it is, by schema, but we surface a clear message).
 *
 * Returns `[]` when valid, else a list of human-readable violations (fed back to
 * the model as the repair message).
 */
export function validateSceneRefs(spec: z.infer<typeof VideoSpec>): string[] {
  const errs: string[] = [];
  const valid = new Set<string>(SCENE_NAMES);

  const ids = new Set<string>();
  let hooks = 0;
  let ctas = 0;
  let proofs = 0;
  let features = 0;

  spec.scenes.forEach((scene, i) => {
    if (!valid.has(scene.component)) {
      errs.push(
        `scenes[${i}].component "${scene.component}" is not a registered scene ` +
          `(allowed: ${SCENE_NAMES.join(", ")})`,
      );
    }
    if (ids.has(scene.id)) errs.push(`scenes[${i}].id "${scene.id}" is duplicated`);
    ids.add(scene.id);

    if (scene.component === "Hook") {
      hooks++;
      if (i !== 0) errs.push(`Hook must be the FIRST scene (found at index ${i})`);
    }
    if (scene.component === "CTA") {
      ctas++;
      if (i !== spec.scenes.length - 1) {
        errs.push(`CTA must be the LAST scene (found at index ${i})`);
      }
    }
    if (scene.component === "Proof") proofs++;
    if (scene.component === "FeatureBeat") features++;
  });

  if (hooks > 1) errs.push(`at most ONE Hook scene is allowed (found ${hooks})`);
  if (ctas > 1) errs.push(`at most ONE CTA scene is allowed (found ${ctas})`);
  if (proofs > 1) errs.push(`at most ONE Proof scene is allowed (found ${proofs})`);
  if (features > 4) {
    errs.push(`at most FOUR FeatureBeat scenes are allowed (found ${features})`);
  }

  // WORD BUDGET — a FLOOR *and* a ceiling (CD R4 P0 — MANDATED). Duration is
  // derived from the MEASURED VO, so total narration is the one lever that pins
  // the cut's length. Two failure modes, both shipped to the judges:
  //   • OVER  — the 58s feature-march "dragged" (R3): a ceiling caps it.
  //   • UNDER — v4 came in at 34 words / 14.9s, "over before it lands" (R4): the
  //             model under-wrote and nothing rejected it. A FLOOR catches that.
  // The prompt asks for ~70–110 words / ~24–32s; we bracket that with hard
  // reject bounds (<60 too thin to land a launch story; >120 drags) so the model
  // can't ship a cut that is either too short or too long even when it ignores
  // the soft target. ~120 words ≈ 34s, ~60 words ≈ 18s at a deliberate read.
  const WORD_FLOOR = 60;
  const WORD_BUDGET = 120;
  let words = 0;
  for (const scene of spec.scenes) {
    const text = scene.vo?.text;
    if (typeof text === "string") {
      words += text.trim().split(/\s+/).filter(Boolean).length;
    }
  }
  if (words < WORD_FLOOR) {
    errs.push(
      `total narration is only ${words} words — a launch cut needs ~70–110 words ` +
        `(~24–32s); under ${WORD_FLOOR} it is over before it lands. Add a FeatureBeat ` +
        `or expand the vo.text lines into fuller sentences.`,
    );
  }
  if (words > WORD_BUDGET) {
    errs.push(
      `total narration is ${words} words — a punchy launch cut must stay under ` +
        `${WORD_BUDGET} words (~28–34s). Cut a scene or tighten the vo.text lines.`,
    );
  }

  return errs;
}

/** Format a zod error into a compact, model-readable issue list. */
function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((iss) => {
      const path = iss.path.length
        ? iss.path.map((p) => String(p)).join(".")
        : "(root)";
      return `- ${path}: ${iss.message}`;
    })
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/*  The director                                                              */
/* -------------------------------------------------------------------------- */

/** Tunables for `direct` (mostly for tests / provider injection). */
export interface DirectOptions {
  /** Provider to use. Defaults to `llm()` (env-selected). */
  provider?: LlmProvider;
  /** Max validation+repair attempts (total calls). Defaults to 3. */
  maxRepairs?: number;
  /** Decode temperature. Low by default for stable, re-validatable output. */
  temperature?: number;
  /** Abort signal threaded into every provider call. */
  signal?: AbortSignal;
}

/**
 * Build the initial user message: the brand kit + goal, plus the brandKitId and
 * palette the model must thread through unchanged.
 */
function buildUserMessage(brandKit: DirectorBrandKit, goal: DirectorGoal): string {
  const assetKeys = (brandKit.screens ?? []).map((s) => s.key);
  return JSON.stringify(
    {
      instruction:
        "Produce ONE VideoSpec JSON object for this brand and goal. Use " +
        "brandKitId and palette EXACTLY as given. Reference only the listed " +
        "assetKeys for screen/region/logos.",
      brandKitId: brandKit.id,
      palette: brandKit.palette,
      brand: {
        name: brandKit.name,
        url: brandKit.url,
        fonts: brandKit.fonts ?? [],
        voice: brandKit.voice,
        assetKeys,
        copyBank: (brandKit.copy ?? []).map((c) => c.text).slice(0, 24),
      },
      goal: {
        format: goal.format ?? "16:9",
        platform: goal.platform,
        angle: goal.angle,
        lengthSeconds: goal.lengthSeconds,
        preset: goal.preset,
        notes: goal.notes,
      },
    },
    null,
    0,
  );
}

/**
 * Direct a video: brand kit + goal → validated `VideoSpec`.
 *
 * Calls the provider, parses + validates, and on failure repairs by appending
 * the exact error to the user message and re-asking, up to `maxRepairs` total
 * attempts. Throws `SpecValidationError` (fail-closed) if all attempts fail —
 * the deterministic renderer is never handed an unvalidated spec.
 */
export async function direct(
  brandKit: DirectorBrandKit,
  goal: DirectorGoal = {},
  opts: DirectOptions = {},
): Promise<z.infer<typeof VideoSpec>> {
  const provider = opts.provider ?? llm();
  const maxRepairs = Math.max(1, opts.maxRepairs ?? 3);
  const system = buildDirectorPrompt();

  let user = buildUserMessage(brandKit, goal);
  const attempts: string[] = [];
  let lastRaw: string | undefined;

  for (let i = 0; i < maxRepairs; i++) {
    const raw = await provider.complete({
      system,
      user,
      jsonSchema: VIDEOSPEC_JSON_SCHEMA,
      temperature: opts.temperature,
      signal: opts.signal,
    });
    lastRaw = raw.slice(0, 4000);

    // 1) Extract + parse JSON.
    let parsedJson: unknown;
    try {
      parsedJson = extractJson(raw);
    } catch (err) {
      const reason = `attempt ${i + 1}: not parseable JSON — ${(err as Error).message}`;
      attempts.push(reason);
      user = repairMessage(user, `Your previous output was not valid JSON: ${(err as Error).message}`);
      continue;
    }

    // 2) Validate against the frozen contract.
    const result = VideoSpec.safeParse(parsedJson);
    if (!result.success) {
      const zodMsg = formatZodError(result.error);
      attempts.push(`attempt ${i + 1}: schema invalid\n${zodMsg}`);
      user = repairMessage(
        user,
        `Your previous output FAILED VideoSpec validation:\n${zodMsg}`,
      );
      continue;
    }

    // 3) Registry / narrative ref check.
    const refErrs = validateSceneRefs(result.data);
    if (refErrs.length) {
      const refMsg = refErrs.map((e) => `- ${e}`).join("\n");
      attempts.push(`attempt ${i + 1}: ref/narrative invalid\n${refMsg}`);
      user = repairMessage(
        user,
        `Your previous output broke narrative/asset rules:\n${refMsg}`,
      );
      continue;
    }

    // 4) Anti-slop lint (SAAS_ROADMAP §4). CRITICAL: lint the RAW object, not
    //    `result.data` — `VideoSpec.parse` silently STRIPS off-contract fields
    //    (`grain:0`, a per-scene `preset`/`motion` override, an OffthreadVideo
    //    `screen`, a >0.7 restraint dial), which is exactly the slop the lint
    //    exists to catch. Linting the stripped spec would pass everything.
    const lint = lintSpec(parsedJson as z.infer<typeof VideoSpec>);
    if (!lint.ok) {
      const lintMsg = lint.violations
        .map((v) => `- [${v.rule}] ${v.path}: ${v.message}`)
        .join("\n");
      attempts.push(`attempt ${i + 1}: anti-slop lint failed\n${lintMsg}`);
      user = repairMessage(
        user,
        `Your previous output FAILED the anti-slop guardrails:\n${lintMsg}`,
      );
      continue;
    }

    // 5) Stat-trust REGENERATION gate. The silent post-processor `gateStatTrust`
    //    can scrub a callout or demote a Stat, but it CANNOT edit a spoken
    //    `vo.text` mid-sentence or rescue an invented testimonial — those must be
    //    REGENERATED clean (CD R3 P0: the 0/3 disqualifier — fabricated social
    //    proof "50K+ / 4.9★ / 92% / Jane D., Verified customer" reached the
    //    screen AND the VO because captions/narration were an unguarded channel).
    const trustErrs = findTrustViolations(result.data);
    if (trustErrs.length) {
      const trustMsg = trustErrs.map((e) => `- ${e}`).join("\n");
      attempts.push(`attempt ${i + 1}: stat-trust violations\n${trustMsg}`);
      user = repairMessage(
        user,
        `Your previous output FABRICATED unverifiable social proof:\n${trustMsg}`,
      );
      continue;
    }

    // Valid + brandKit-consistent → gate stat-trust → gate brand-style → done.
    // `gateStatTrust` forces every Stats item to render as an unverified "e.g."
    // example, drops any callout that reads as a numeric claim, and drops an
    // unverifiable logo-wall proof — so a model-fabricated number/empty proof can
    // NEVER reach the screen as a hard, contradictable claim (CD: the
    // disqualifier — self-contradicting social proof). `gateBrandStyle` then
    // clamps a house brand back onto its locked preset + on-brand palette
    // (warms ResuBird off the scraped periwinkle).
    const brandHint = `${brandKit.name ?? ""} ${brandKit.url ?? ""} ${brandKit.id ?? ""}`;
    return gateBrandStyle(
      gateStatTrust(ensureBrandKitId(result.data, brandKit.id)),
      brandHint,
    );
  }

  throw new SpecValidationError(
    `director failed to produce a valid VideoSpec after ${maxRepairs} attempts`,
    attempts,
    lastRaw,
  );
}

/**
 * Append a repair instruction to the running user message. Keeps the original
 * brief at the top (so context isn't lost) and feeds the error back, asking for
 * corrected JSON only.
 */
function repairMessage(prevUser: string, errorBlock: string): string {
  return (
    prevUser +
    `\n\n--- REPAIR ---\n${errorBlock}\n` +
    "Return a corrected VideoSpec JSON object ONLY (no prose, no fences). " +
    "Fix exactly the issues above; keep everything else."
  );
}

/**
 * Guarantee the emitted spec's `brandKitId` matches the kit we directed for —
 * the model is instructed to thread it through, but we enforce it rather than
 * trust it (cheap, deterministic, prevents a mis-keyed render).
 */
function ensureBrandKitId(
  spec: z.infer<typeof VideoSpec>,
  brandKitId: string,
): z.infer<typeof VideoSpec> {
  if (spec.brandKitId === brandKitId) return spec;
  return { ...spec, brandKitId };
}
