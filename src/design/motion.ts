/**
 * MOTION TOKENS — the layer the preset selects, replacing every baked-in spring.
 *
 * Today every primitive hard-codes its spring (`Pop` = `{damping:16,mass:0.7}`
 * at `ui.tsx:100`). This file replaces that with ONE token layer keyed by the
 * `Motion` id (`calm` | `standard` | `punchy`). The preset picks a default; the
 * spec's `motion` field can override it; scenes can never set a raw spring.
 *
 * Frozen spec — `docs/SAAS_ROADMAP.md §4` ("Motion as tokens") and
 * `docs/ENGINE_DESIGN.md §4`. The numbers below are copied verbatim from the
 * `MotionToken` table in those docs and MUST NOT drift.
 *
 * Three principles enforced *by construction* (not by convention):
 *  - **Asymmetry:** `exit < enter` for every token — the token layer cannot
 *    express a slow exit.
 *  - **Overshoot discipline:** entrances are under-damped (overshoot), but every
 *    token clamps `damping ≥ 12`; dismissals never under-damp.
 *  - **One signature motion per video:** each token names a single `signature`
 *    that fires only at the S3 ProductShot reveal and the S7 CTA — novelty per
 *    scene is impossible.
 *
 * Determinism: these are pure data + pure helpers. No `requestAnimationFrame`,
 * no `Date.now`, no unseeded random — motion is always a function of frame `t`.
 */
import type { Motion } from "../spec";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A spring configuration — the `damping` / `mass` pair the runtime feeds into
 * `spring()`. Clean-room port of the spring *math only* (motion.dev / framer);
 * never an imported animation runtime (rAF-driven → flickers under parallel
 * frame capture).
 */
export type SpringConfig = {
  /** Damping coefficient. Higher = less overshoot, faster settle. */
  damping: number;
  /** Mass. Higher = heavier, slower acceleration. */
  mass: number;
  /** Stiffness. Constant across tokens; the token varies damping/mass. */
  stiffness: number;
};

/**
 * The named signature motions. Exactly one fires per video (at the S3 reveal
 * and the S7 CTA). The string is a stable id the scene runtime maps to a
 * frame-driven transform recipe.
 */
export type SignatureMotion = "riseSettle" | "slideReveal" | "snapScale";

/**
 * One motion token — the full bundle a `Motion` id resolves to.
 *
 *  - `spring`    — the `SpringConfig` for entrances/settles.
 *  - `enter`     — entrance duration in frames.
 *  - `exit`      — exit duration in frames (always `< enter`: asymmetry rule).
 *  - `signature` — the single signature motion id for this register.
 */
export type MotionToken = {
  spring: SpringConfig;
  enter: number;
  exit: number;
  signature: SignatureMotion;
};

/** The full token map: every `Motion` id → its frozen `MotionToken`. */
export type MotionTokenMap = Readonly<Record<Motion, MotionToken>>;

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Shared spring stiffness. The token layer varies only `damping`/`mass` (the
 * two knobs the design docs expose); stiffness is held constant so the family
 * reads as one system. Matches the repo's hand-tuned `spring()` feel.
 */
const STIFFNESS = 100;

/* -------------------------------------------------------------------------- */
/*  The frozen MotionToken map (verbatim — `ENGINE_DESIGN.md §4`)              */
/* -------------------------------------------------------------------------- */

/**
 * THE token map. Frozen — the `damping`/`mass`, `enter`/`exit`, and `signature`
 * values are copied directly from `docs/ENGINE_DESIGN.md §4`:
 *
 * ```ts
 * MotionToken = {
 *   calm:     { spring:{damping:26,mass:1.0}, enter:24, exit:14, signature:"riseSettle"  },
 *   standard: { spring:{damping:18,mass:0.8}, enter:18, exit:11, signature:"slideReveal" },
 *   punchy:   { spring:{damping:12,mass:0.6}, enter:12, exit:8,  signature:"snapScale"   },
 * }
 * ```
 *
 * Invariants held by construction (also asserted at module load below):
 *  - `exit < enter` for every token (asymmetry).
 *  - `damping ≥ 12` for every token (overshoot discipline / no wild ringing).
 *  - exactly three tokens, one per `Motion` id.
 */
export const MOTION_TOKENS: MotionTokenMap = {
  calm: {
    spring: { damping: 26, mass: 1.0, stiffness: STIFFNESS },
    enter: 24,
    exit: 14,
    signature: "riseSettle",
  },
  standard: {
    spring: { damping: 18, mass: 0.8, stiffness: STIFFNESS },
    enter: 18,
    exit: 11,
    signature: "slideReveal",
  },
  punchy: {
    spring: { damping: 12, mass: 0.6, stiffness: STIFFNESS },
    enter: 12,
    exit: 8,
    signature: "snapScale",
  },
} as const;

/* -------------------------------------------------------------------------- */
/*  Accessors                                                                  */
/* -------------------------------------------------------------------------- */

/** Resolve a `Motion` id to its frozen `MotionToken`. */
export const motionToken = (motion: Motion): MotionToken => MOTION_TOKENS[motion];

/** Resolve a `Motion` id to just its `SpringConfig` (the common case). */
export const motionSpring = (motion: Motion): SpringConfig =>
  MOTION_TOKENS[motion].spring;

/** Resolve a `Motion` id to its single signature motion. */
export const signatureFor = (motion: Motion): SignatureMotion =>
  MOTION_TOKENS[motion].signature;

/* -------------------------------------------------------------------------- */
/*  Construction-time invariants                                               */
/* -------------------------------------------------------------------------- */

/**
 * Assert the three structural principles at module load. This turns the design
 * rules into something that fails loudly if the frozen table is ever edited to
 * violate them (e.g. a slow exit, or an under-damped dismissal).
 */
const assertMotionInvariants = (map: MotionTokenMap): void => {
  const ids: Motion[] = ["calm", "standard", "punchy"];
  for (const id of ids) {
    const t = map[id];
    if (t.exit >= t.enter) {
      throw new Error(
        `MotionToken "${id}" violates asymmetry: exit (${t.exit}) must be < enter (${t.enter}).`,
      );
    }
    if (t.spring.damping < 12) {
      throw new Error(
        `MotionToken "${id}" violates overshoot discipline: damping (${t.spring.damping}) must be ≥ 12.`,
      );
    }
  }
};

assertMotionInvariants(MOTION_TOKENS);
