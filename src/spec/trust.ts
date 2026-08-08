/**
 * src/spec/trust.ts — the STAT-TRUST hard gate.
 *
 * The disqualifier all three judges flagged: self-contradicting social proof.
 * The keyless heuristic MINES numbers out of the copy bank and the LLM director
 * FABRICATES them ("85% ATS success" + "4.9★" early, a contradictory "3.3★" +
 * "71% callback" + "15387 resumes" later). Confident-but-invented, mutually
 * contradictory numbers actively REPEL a buyer — worse than no number at all.
 *
 * This module makes a hallucinated/unsourced number IMPOSSIBLE to render as a
 * HARD CLAIM. It is a pure, deterministic post-processor applied to a parsed
 * `VideoSpec` on EVERY director path (LLM + heuristic) before the spec leaves the
 * brain:
 *
 *   1. STATS — every Stats item is forced `verified: false`. There is no trusted
 *      sourced-metric channel today (the LLM marks its own fabrications
 *      `verified: true`; the heuristic mines from copy) — so NO producer is
 *      trusted, and every number renders behind the Stats scene's "e.g."
 *      affordance (an example, never a bare confident metric). A future verified-
 *      inputs API would tag items upstream of this gate; until then, all numbers
 *      are examples.
 *
 *   2. CALLOUTS — a ProductShot callout is a feature/value-prop chip, NOT a
 *      metric, and it has no "e.g." affordance. So any callout whose title/sub
 *      reads as a numeric CLAIM (a number next to %, ×, +, ★, "out of", a rating,
 *      a magnitude) is DROPPED — a fabricated "85% ATS success" / "4.9★ rating"
 *      can never reach the screen as a hard claim. Callouts are optional
 *      (`.max(2).default([])`), so dropping is always schema-safe.
 *
 * Determinism: pure function of the spec; no clock, no RNG, no IO. Never mutates
 * the input. Re-running on an already-gated spec is a no-op (idempotent).
 */
import type { z } from "zod";

import type { VideoSpec } from "./schema";

type Spec = z.infer<typeof VideoSpec>;

/**
 * A bare numeric CLAIM: a number directly adjacent to a stat marker — a percent,
 * a multiplier (`3×` / `10x`), a `+`, a star/rating (`4.9★`, `4.9 / 5`, `4.9
 * stars`), an "out of", or a magnitude (`15k`, `2m`). Matches the shapes the
 * heuristic mines and the LLM fabricates. Word boundaries keep it from firing on
 * ordinary prose containing a digit ("3 steps", "2024").
 */
const NUMERIC_CLAIM =
  /\d[\d,.]*\s*(?:%|×|x\b|\+|★|\bstars?\b|\bout of\b|\/\s*\d|[kmb]\b)/i;

/** True when a string carries a bare numeric claim (see `NUMERIC_CLAIM`). */
const hasNumericClaim = (s?: string): boolean =>
  typeof s === "string" && NUMERIC_CLAIM.test(s);

/**
 * A fabricated-testimonial tell in a quote/attribution: a verification badge
 * ("verified"), a rating/review/star claim, or a bare numeric claim (rating /
 * percentage). Mirrors the logo-wall stance — there is NO verified social-proof
 * channel today, so a quote that asserts a star rating, a "verified" badge, or a
 * review count is an UNSOURCED claim that must not render.
 */
const TESTIMONIAL_FABRICATION =
  /\bverified\b|\brating\b|\breviews?\b|\bstars?\b|★/i;

/**
 * True when a Proof quote's attribution reads as an INVENTED named testimonial:
 * it carries a fabrication tell, a bare numeric claim, OR a comma (a "Name,
 * Role" identity assertion — e.g. "Jane D., Marketing Manager"). A brand
 * attributing its own value line ("ResuBird") has none of these and is kept.
 */
const looksLikeNamedTestimonial = (attribution?: string): boolean =>
  typeof attribution === "string" &&
  (TESTIMONIAL_FABRICATION.test(attribution) ||
    hasNumericClaim(attribution) ||
    /,/.test(attribution));

/**
 * True when a quote `Proof`'s copy asserts unsourced social proof — either the
 * attribution is an invented named/verified testimonial, or the quote text
 * itself carries a star rating / numeric claim ("4.9★ from thousands", "92% land
 * a job"). Such a Proof has no verified-facts channel behind it, so it renders a
 * self-contradicting trust beat — the exact disqualifier.
 */
const isFabricatedQuoteProof = (props: unknown): boolean => {
  if (typeof props !== "object" || props === null) return false;
  const p = props as { quote?: unknown; attribution?: unknown };
  if (!("quote" in p)) return false; // not a quote-shaped Proof
  const quote = typeof p.quote === "string" ? p.quote : undefined;
  const attribution =
    typeof p.attribution === "string" ? p.attribution : undefined;
  return (
    looksLikeNamedTestimonial(attribution) ||
    TESTIMONIAL_FABRICATION.test(quote ?? "") ||
    hasNumericClaim(quote)
  );
};

/**
 * Gate the stat-trust invariants on a parsed spec, returning a NEW spec. Idempotent
 * and pure. Apply on every director path before the spec reaches the renderer.
 */
export function gateStatTrust(spec: Spec): Spec {
  const scenes = spec.scenes.map((scene): Spec["scenes"][number] => {
    if (scene.component === "Stats") {
      // Force every stat to render as an UNVERIFIED example ("e.g.") — never a
      // bare confident number. (No trusted sourced channel exists today.)
      const items = scene.props.items.map((it) => ({ ...it, verified: false }));
      return { ...scene, props: { ...scene.props, items } };
    }
    if (scene.component === "ProductShot") {
      // Drop callouts that read as numeric claims (no "e.g." affordance exists
      // for a callout chip, so a fabricated metric there is a HARD claim). The
      // widened `NUMERIC_CLAIM` now also catches magnitude shapes the v1 regex
      // missed — "50K+", "3.3k", "10M" — so an invented "Join 50K+ job seekers"
      // chip can no longer reach the screen to contradict the narration.
      const kept = scene.props.callouts.filter(
        (cta) => !hasNumericClaim(cta.title) && !hasNumericClaim(cta.sub),
      );
      if (kept.length === scene.props.callouts.length) return scene;
      return { ...scene, props: { ...scene.props, callouts: kept } };
    }
    return scene;
  });

  // PROOF — drop an unverifiable social-proof beat. There is no trusted sourced
  // channel today (mirroring the stats stance: NO producer is trusted), so BOTH
  // shapes can self-contradict:
  //   - a `logos` wall of placeholder asset keys renders EMPTY glass tiles under
  //     a fabricated eyebrow (CD R2 P1: "make LogoWall earn its claim or not
  //     render");
  //   - a `quote` proof that asserts an INVENTED named/verified testimonial
  //     ("Jane D., Marketing Manager — Verified customer") or a star/numeric
  //     rating in its copy ("4.9★ from thousands") is the R3 regression vector —
  //     the trust beat all three judges flagged. A brand attributing its own
  //     value line (attribution = the brand, no comma/rating/"verified") is kept.
  // Guarded so the drop can never take the spec below the 2-scene contract floor.
  const filtered = scenes.filter(
    (s) =>
      !(
        s.component === "Proof" &&
        ("logos" in s.props || isFabricatedQuoteProof(s.props))
      ),
  );
  const kept = filtered.length >= 2 ? filtered : scenes;

  return { ...spec, scenes: kept };
}

/* -------------------------------------------------------------------------- */
/*  findTrustViolations — the regenerate-don't-drop channel (VO + copy)        */
/* -------------------------------------------------------------------------- */

/**
 * Copy fields the gate cannot silently scrub. A callout chip can be DROPPED and
 * a Stats item demoted to "e.g.", but a spoken `vo.text` (and the headline/label
 * copy the caption echoes) carries the claim mid-sentence — dropping a word
 * would garble the read. So a bare numeric claim here must instead REJECT the
 * spec back to the director for a clean regeneration. Returns the human-readable
 * field/value pairs to scan; pure, no IO.
 */
function trustScannableFields(
  scene: Spec["scenes"][number],
): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const push = (path: string, v: unknown): void => {
    if (typeof v === "string" && v.trim()) out.push({ path, text: v });
  };
  // Every scene's spoken line + its caption source.
  if (scene.vo) push(`${scene.id}.vo.text`, scene.vo.text);
  const p = scene.props as Record<string, unknown>;
  switch (scene.component) {
    case "Hook":
      (p.lines as string[] | undefined)?.forEach((l, i) =>
        push(`${scene.id}.props.lines[${i}]`, l),
      );
      break;
    case "Problem":
      (p.stamps as string[] | undefined)?.forEach((s, i) =>
        push(`${scene.id}.props.stamps[${i}]`, s),
      );
      push(`${scene.id}.props.resolve`, p.resolve);
      break;
    case "ProductShot":
      push(`${scene.id}.props.kicker`, p.kicker);
      push(`${scene.id}.props.headline`, p.headline);
      break;
    case "FeatureBeat":
      push(`${scene.id}.props.label`, p.label);
      push(`${scene.id}.props.caption`, p.caption);
      break;
    case "CTA":
      push(`${scene.id}.props.headline`, p.headline);
      break;
    // Stats items render behind the forced "e.g." affordance, so their example
    // numbers are not bare claims — skip. Proof copy is handled below.
    default:
      break;
  }
  return out;
}

/**
 * Find STAT-TRUST violations that must be fixed by REGENERATION, not by the
 * silent post-processor `gateStatTrust`. Returns human-readable messages (empty
 * when clean) that the director feeds back as a repair constraint:
 *   1. any spoken `vo.text` / headline / caption that carries a bare numeric
 *      claim (an invented user count, percentage, star rating, or magnitude) —
 *      these reach the screen as burned captions AND the ear as narration, an
 *      unguarded channel the callout/Stats scrubbers never touched;
 *   2. a quote Proof that asserts an invented named/verified testimonial or a
 *      star/numeric rating.
 * Pure: a function of the spec only (no clock, no RNG, no IO).
 */
export function findTrustViolations(spec: Spec): string[] {
  const errs: string[] = [];
  for (const scene of spec.scenes) {
    for (const { path, text } of trustScannableFields(scene)) {
      if (hasNumericClaim(text)) {
        errs.push(
          `${path} asserts an unverifiable numeric claim ("${text.trim()}"). ` +
            `NEVER invent user counts, percentages, star ratings, or magnitudes ` +
            `(no "50K+", "92%", "4.9★"). Rewrite as a capability the product ` +
            `actually does (e.g. "see your ATS score in seconds").`,
        );
      }
    }
    if (scene.component === "Proof" && isFabricatedQuoteProof(scene.props)) {
      errs.push(
        `${scene.id} is a fabricated testimonial (invented name/role, a ` +
          `"Verified customer" badge, or a star/numeric rating). There is no ` +
          `verified social-proof channel — drop the Proof scene or replace it ` +
          `with a capability claim, never an invented person or rating.`,
      );
    }
  }
  return errs;
}
