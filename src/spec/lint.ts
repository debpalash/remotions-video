/**
 * THE ANTI-SLOP LINT.
 *
 * A pure pass over an emitted `VideoSpec` that makes the "not-slop" guarantee
 * *executable*. The Zod contract (`schema.ts`) guarantees the spec is well-
 * *shaped*; this lint guarantees it is well-*tasted* — it rejects the taste-slop
 * the type system cannot (off-token color, banding, over-application, broken
 * narrative grammar, video in a screen slot, uncaptioned VO).
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4` — "Anti-slop guardrails" table:
 *
 *   | No off-token color | reject raw hex; colors must be a `PaletteKey`        |
 *   | Grain-on-gradient  | any gradient/aurora bg requires `grain>0`            |
 *   | Restraint cap      | grade/glow/parallax ≤0.7; LUT never 100%            |
 *   | One preset / one signature | both singular per video; scenes can't override |
 *   | Caption mandatory  | every VO-bearing scene auto-burns captions          |
 *   | Narrative sanity   | ≤1 Hook (first), ≤1 CTA (last)                      |
 *   | Screen = still     | `screen` slots resolve to stills/Img, never video   |
 *
 * Design rules (CLAUDE.md / ENGINE_DESIGN §2):
 *  - PURE FUNCTION. No `Date.now`, no `Math.random`, no I/O. Same spec in →
 *    same violations out, in a stable, deterministic order.
 *  - Does NOT mutate its input.
 *  - Reads beyond the typed `VideoSpec` surface *defensively*: an upstream LLM
 *    emits a *raw object* which may carry off-contract fields (`grain`, a per-
 *    scene `preset`/`motion`/`signature` override, an `OffthreadVideo` screen
 *    slot, a restraint dial). `VideoSpec.parse()` would silently STRIP those —
 *    so the slop would render. The lint therefore inspects the value structurally
 *    and flags anything off-token, whether or not the static type admits it.
 *
 * This file ONLY reads the contract. It never imports the scene components and
 * never edits `schema.ts` / `registry.ts`.
 */
import type { VideoSpec } from "./schema";
import { SCENE_NAMES, type SceneName } from "./registry";

/* -------------------------------------------------------------------------- */
/*  Result shape                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One guardrail breach. `rule` is the §4 table row; `path` is a JSON-pointer-ish
 * locator into the spec (e.g. `scenes[2].props.callouts[0].accent`); `value` is
 * the offending value when one exists (for surfacing at the Outline gate).
 */
export type Violation = {
  /** Stable machine id for the broken guardrail (one per §4 table row). */
  rule:
    | "no-off-token-color"
    | "grain-on-gradient"
    | "restraint-cap"
    | "one-preset"
    | "one-signature"
    | "caption-mandatory"
    | "narrative-hook"
    | "narrative-cta"
    | "screen-is-still";
  /** Human-readable explanation (shown at the Outline / Storyboard gate). */
  message: string;
  /** Locator into the spec where the breach lives. */
  path: string;
  /** The offending value, when the breach has one. */
  value?: unknown;
};

/** The lint result: `ok` iff there are zero violations. */
export type LintResult = {
  ok: boolean;
  violations: Violation[];
};

/* -------------------------------------------------------------------------- */
/*  §4 constants                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Presets whose background is a gradient or aurora field (`§4` preset table:
 * `gradient-glass` = dithered gradient, `dark-cinematic` = aurora + vignette).
 * These REQUIRE `grain>0` to kill 8-bit banding. The flat presets
 * (`minimal-mono`, `editorial`) do not.
 */
const GRADIENT_BG_PRESETS: ReadonlySet<string> = new Set([
  "gradient-glass",
  "dark-cinematic",
]);

/** Restraint dials capped at this value (§4: "grade/glow/parallax ≤0.7"). */
const RESTRAINT_CAP = 0.7;

/** Restraint-dial field names the lint enforces a ≤0.7 cap on. */
const RESTRAINT_DIALS = ["grade", "glow", "parallax", "lut", "vignette", "bloom"] as const;

/**
 * The fields a scene may NOT carry: a preset / motion / signature is singular
 * *per video* and lives on the top-level spec; a scene that re-declares one is
 * attempting an off-token override.
 */
const SCENE_OVERRIDE_FIELDS = ["preset", "motion", "signature"] as const;

/**
 * Raw-hex detector. Matches `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` anywhere in
 * a string (catches both a bare hex AND the `${COLORS.blue}55` concat the §4
 * table calls out by name). Constructed fresh per call so the lint never leans
 * on a shared, stateful `lastIndex` (global regexes are stateful) — keeping the
 * pass deterministic and reentrant.
 */
const hexPattern = (): RegExp => /#(?:[0-9a-fA-F]{3,4}){1,2}\b/;

/* -------------------------------------------------------------------------- */
/*  Small structural helpers (no deps, deterministic)                          */
/* -------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isSceneName = (v: unknown): v is SceneName =>
  typeof v === "string" && (SCENE_NAMES as readonly string[]).includes(v);

/**
 * Asset keys that name a video clip rather than a still. A `screen` (and any
 * `region`) slot MUST resolve to a still/`Img` — `OffthreadVideo` is banned
 * (CLAUDE.md, §7 risk row). We flag a key that is an explicit video reference:
 * a video file extension, or a key that calls out a clip/video/mp4/recording.
 */
const VIDEO_KEY = /(?:\.(?:mp4|mov|webm|m4v|avi|mkv|gif))(?:$|[?#])|(?:^|[/_\-.])(?:video|clip|recording|offthreadvideo|reel)(?:$|[/_\-.])/i;

const looksLikeVideoAsset = (key: unknown): boolean =>
  typeof key === "string" && VIDEO_KEY.test(key);

/* -------------------------------------------------------------------------- */
/*  Color scan — walk a value, flag any raw hex                                */
/* -------------------------------------------------------------------------- */

/**
 * Keys that are *legitimately* allowed to hold hex on the spec: the `palette`
 * object IS the token source — its swatches are raw hex BY DESIGN (that is the
 * one place data lives), so the scan never descends into it. Everything else
 * (scene props, callout accents, copy) must reference a `PaletteKey`, never a
 * literal color.
 */
const COLOR_EXEMPT_KEY = "palette";

/**
 * Recursively scan a value for raw-hex color strings, pushing a violation for
 * each. `path` accumulates a locator. The `palette` subtree is skipped (it is
 * the token source of truth). Deterministic: visits object keys and array
 * indices in their natural order.
 */
function scanForHex(value: unknown, path: string, out: Violation[]): void {
  if (typeof value === "string") {
    if (hexPattern().test(value)) {
      out.push({
        rule: "no-off-token-color",
        message:
          `Raw hex color in \`${path}\` — colors must reference a PaletteKey ` +
          `(accent/accent2/text/…) resolved via palette(key, alpha), never a literal hex.`,
        path,
        value,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanForHex(value[i], `${path}[${i}]`, out);
    }
    return;
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (path === "" && k === COLOR_EXEMPT_KEY) continue; // palette is the token source
      scanForHex(value[k], path === "" ? k : `${path}.${k}`, out);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Restraint scan — walk a value, flag any dial > 0.7                         */
/* -------------------------------------------------------------------------- */

/**
 * Recursively scan for restraint dials (`grade`/`glow`/`parallax`/`lut`/…) whose
 * numeric value exceeds the cap. A dial in `[0,1]` over `0.7` is over-applied
 * slop; `lut` (a 0–1 mix) at `1` is the "LUT never 100%" rule. Non-numeric or
 * in-range values pass untouched.
 */
function scanForRestraint(value: unknown, path: string, out: Violation[]): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      scanForRestraint(value[i], `${path}[${i}]`, out);
    }
    return;
  }
  if (!isObject(value)) return;
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const child = value[k];
    const childPath = path === "" ? k : `${path}.${k}`;
    if (
      (RESTRAINT_DIALS as readonly string[]).includes(k) &&
      typeof child === "number"
    ) {
      if (child > RESTRAINT_CAP) {
        out.push({
          rule: "restraint-cap",
          message:
            `Restraint dial \`${childPath}\` = ${child} exceeds the cap of ` +
            `${RESTRAINT_CAP}. Grade/glow/parallax stay ≤${RESTRAINT_CAP}; a LUT is never 100%.`,
          path: childPath,
          value: child,
        });
      }
    } else {
      scanForRestraint(child, childPath, out);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  The lint                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Run the anti-slop lint over an emitted `VideoSpec`.
 *
 * PURE: no side effects, no clock, no RNG, no I/O; never mutates `spec`. Returns
 * `{ ok, violations }` with violations in a stable order (top-level rules first,
 * then per-scene rules in scene order). `ok` is `true` iff `violations` is empty.
 *
 * Accepts the typed `VideoSpec`, but inspects the value structurally so it also
 * catches off-contract slop that an upstream LLM emitted and that `parse()`
 * would have silently stripped (e.g. a per-scene `preset` override, a `grain`
 * dial, an `OffthreadVideo` screen key).
 */
export function lintSpec(spec: VideoSpec): LintResult {
  const violations: Violation[] = [];
  // Read defensively: the runtime value may carry off-contract fields the
  // static `VideoSpec` type does not admit. We never mutate it.
  const raw = spec as unknown as Record<string, unknown>;

  /* --- No off-token color: deep-scan everything except `palette`. -------- */
  scanForHex(raw, "", violations);

  /* --- Restraint cap: deep-scan for any dial > 0.7. --------------------- */
  scanForRestraint(raw, "", violations);

  /* --- Grain-on-gradient: gradient/aurora preset ⇒ grain>0. -------------
   * Grain is BAKED INTO the gradient/aurora presets (§4 preset table:
   * `gradient-glass` = "grain mandatory", `dark-cinematic` = "aurora + … +
   * grain"). So an *absent* `grain` field is fine — the preset supplies it; the
   * frozen `SAMPLE_SPEC` (dark-cinematic, no grain field) is therefore clean.
   * The breach the lint exists to catch is an EXPLICIT override that turns the
   * mandated grain OFF (`grain: 0` / a negative value) on a gradient bg — which
   * re-introduces the 8-bit banding the preset's grain is there to kill. */
  if (GRADIENT_BG_PRESETS.has(String(raw.preset)) && "grain" in raw) {
    const grain = raw.grain;
    const grainOff = typeof grain !== "number" || grain <= 0;
    if (grainOff) {
      violations.push({
        rule: "grain-on-gradient",
        message:
          `Preset \`${String(raw.preset)}\` has a gradient/aurora background; its ` +
          `mandatory grain cannot be turned off. \`grain\` must be > 0, got ${String(grain)}.`,
        path: "grain",
        value: grain,
      });
    }
  }

  /* --- One preset / one signature: both singular; scenes can't override. - */
  // The contract makes `preset`/`motion` singular at the top level by shape, so
  // the breach we can catch is a SCENE re-declaring one (an override attempt).
  const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!isObject(scene)) continue;
    for (let j = 0; j < SCENE_OVERRIDE_FIELDS.length; j++) {
      const field = SCENE_OVERRIDE_FIELDS[j];
      if (field in scene) {
        violations.push({
          rule: field === "signature" ? "one-signature" : "one-preset",
          message:
            `Scene \`${String(scene.id ?? i)}\` declares \`${field}\` — preset, ` +
            `motion and the one signature are singular per video and live on the ` +
            `top-level spec. Scenes cannot override them.`,
          path: `scenes[${i}].${field}`,
          value: scene[field],
        });
      }
    }
  }

  /* --- Narrative sanity: ≤1 Hook (first), ≤1 CTA (last). ---------------- */
  const componentAt = (idx: number): string | undefined => {
    const s = scenes[idx];
    return isObject(s) && typeof s.component === "string" ? s.component : undefined;
  };
  const hookIdxs: number[] = [];
  const ctaIdxs: number[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const c = componentAt(i);
    if (c === "Hook") hookIdxs.push(i);
    if (c === "CTA") ctaIdxs.push(i);
  }

  // ≤1 Hook, and if present it must be the FIRST scene.
  if (hookIdxs.length > 1) {
    violations.push({
      rule: "narrative-hook",
      message: `A video has at most ONE Hook. Found ${hookIdxs.length} (scenes ${hookIdxs.join(", ")}).`,
      path: "scenes",
      value: hookIdxs,
    });
  }
  if (hookIdxs.length >= 1 && hookIdxs[0] !== 0) {
    violations.push({
      rule: "narrative-hook",
      message: `The Hook must be the FIRST scene (pain-led 3s open), found at index ${hookIdxs[0]}.`,
      path: `scenes[${hookIdxs[0]}]`,
      value: hookIdxs[0],
    });
  }

  // ≤1 CTA, and if present it must be the LAST scene.
  if (ctaIdxs.length > 1) {
    violations.push({
      rule: "narrative-cta",
      message: `A video has at most ONE CTA. Found ${ctaIdxs.length} (scenes ${ctaIdxs.join(", ")}).`,
      path: "scenes",
      value: ctaIdxs,
    });
  }
  if (ctaIdxs.length >= 1 && ctaIdxs[ctaIdxs.length - 1] !== scenes.length - 1) {
    const last = ctaIdxs[ctaIdxs.length - 1];
    violations.push({
      rule: "narrative-cta",
      message: `The CTA must be the LAST scene (one offer, longest hold), found at index ${last} of ${scenes.length}.`,
      path: `scenes[${last}]`,
      value: last,
    });
  }

  /* --- Per-scene structural rules: caption-mandatory + screen-is-still. -- */
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!isObject(scene)) continue;
    const component = typeof scene.component === "string" ? scene.component : "?";
    if (!isSceneName(component)) {
      // Unknown component would already fail Zod; nothing taste-level to add.
      continue;
    }

    // Caption mandatory: a scene that BEARS voiceover must carry caption text.
    // The VO `text` is the caption source (captions auto-burn from VO text +
    // measured timings, §5). A VO present but with no usable `text` cannot be
    // captioned → slop. (`audioUrl` without `text` is the dangerous case.)
    const vo = scene.vo;
    if (vo !== undefined && vo !== null) {
      const hasText =
        isObject(vo) && typeof vo.text === "string" && vo.text.trim().length > 0;
      if (!hasText) {
        violations.push({
          rule: "caption-mandatory",
          message:
            `Scene \`${String(scene.id ?? i)}\` (${component}) bears VO but has no ` +
            `caption-able \`vo.text\`. Every VO scene auto-burns captions from its text.`,
          path: `scenes[${i}].vo.text`,
          value: isObject(vo) ? vo.text : vo,
        });
      }
    }

    // Screen slot must be a still/Img, never a video clip. ProductShot.screen
    // and FeatureBeat.region are the asset slots that flow into a ScreenFrame.
    const props = isObject(scene.props) ? scene.props : undefined;
    if (props) {
      if (component === "ProductShot" && looksLikeVideoAsset(props.screen)) {
        violations.push({
          rule: "screen-is-still",
          message:
            `ProductShot \`${String(scene.id ?? i)}\` screen \`${String(props.screen)}\` ` +
            `looks like a video clip. Screen slots resolve to stills/Img — OffthreadVideo is banned.`,
          path: `scenes[${i}].props.screen`,
          value: props.screen,
        });
      }
      if (component === "FeatureBeat" && looksLikeVideoAsset(props.region)) {
        violations.push({
          rule: "screen-is-still",
          message:
            `FeatureBeat \`${String(scene.id ?? i)}\` region \`${String(props.region)}\` ` +
            `looks like a video clip. Screen/region slots resolve to stills/Img — OffthreadVideo is banned.`,
          path: `scenes[${i}].props.region`,
          value: props.region,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
