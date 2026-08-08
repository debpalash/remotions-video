/**
 * KINO ARCHETYPES — the 7 prop-driven, frame-driven scene components.
 *
 * Each is `React.FC<Props>` where `Props` is the matching schema from `src/spec`
 * (the contract). They read the current frame from `useFrame()` (`src/engine`),
 * color from `palette()` and motion from the active `MotionToken`
 * (`src/design`), and assemble the `src/kino-scenes/kit` primitives ported from
 * the `src/promo` look — but rendered entirely on the Kino runtime (no Remotion
 * imports, no wall-clock, no RNG).
 *
 *  S1 Hook        — one claim, ≤3s; kinetic per-word stagger; last line gradient.
 *  S2 Problem     — status-quo pain stamps that strike through, then resolve.
 *  S3 ProductShot — hero UI + ≤2 anchored callouts; carries the SIGNATURE motion.
 *  S4 FeatureBeat — repeatable region highlight + caption (shared layout).
 *  S5 Stats       — ≤4 count-up numbers; unverified → "e.g." affordance.
 *  S6 Proof       — one quote w/ attribution OR a real-SVG logo wall.
 *  S7 CTA         — wordmark + one action; longest hold; SIGNATURE motion + CTA.
 *
 * The signature motion fires ONLY at the ProductShot reveal and the CTA (design
 * rule: one signature per video, never novelty-per-scene). Entrances are timed
 * by the motion token; exits are always shorter than entrances (asymmetry).
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md`.
 */
import * as React from "react";

import { useFrame, interpolate } from "../engine";
import { palette } from "../design";
import type {
  HookProps,
  ProblemProps,
  FeatureBeatProps,
  StatsProps,
  ProofProps,
  CtaProps,
  PaletteKey,
} from "../spec";

import {
  Fill,
  FONTS,
  OpticalCenter,
  SafeCenter,
  Signature,
  resolveAsset,
  useEnter,
  useHeadlineStyle,
} from "./kit";
import { Backdrop } from "./backgrounds";
import { ClipLine } from "./type";
import { CounterCard, ProgressRing, StatBar } from "./viz";
import { LogoWall, PullQuote } from "./proof";
import { RegionHighlight } from "./feature";
import { ProblemBoard } from "./problem";

/* -------------------------------------------------------------------------- */
/*  S1 — Hook  (pain-led, art-directed kinetic typography)                     */
/*                                                                             */
/*  One claim, ≤3s, always the shortest scene. The pain-setup lines arrive     */
/*  MUTED and clip-revealed under a mask (Stripe wipe) — the status quo, stated */
/*  flat. The final line is the resolution: it lands as the signature gradient  */
/*  with a per-glyph weight-bloom (thin → bold) + tracking-in, choreographed so */
/*  the eye reads pain → turn. Font auto-scales as the claim packs.            */
/*                                                                             */
/*  Schema is frozen (`lines[]`, ≤4) — the upgrade is purely in the kinetic     */
/*  treatment, not the prop surface.                                           */
/* -------------------------------------------------------------------------- */

export const Hook: React.FC<HookProps> = ({ lines }) => {
  const head = useHeadlineStyle();
  const c = palette();
  const { frame, durationInFrames } = useFrame();

  const lastIdx = lines.length - 1;

  // SUSTAINED "live" drift (CD R7 P2: the cold-open held as a frozen card —
  // t=1≡t=5). After the turn lands (~f22) the claim used to sit dead-still for
  // the rest of the hold; now the whole block keeps a barely-there rise + micro-
  // zoom across the full scene so the open reads as alive, never a slideshow.
  // Pure function of the frame (deterministic); ~10px / 1.2% over the hold.
  const span = Number.isFinite(durationInFrames) ? durationInFrames : 150;
  const live = interpolate(frame, [0, span], [0, 1], { extrapolateRight: "clamp" });
  const liveTransform = `translateY(${(-live * 10).toFixed(3)}px) scale(${(1 + live * 0.012).toFixed(4)})`;

  // DELIBERATE TYPE SCALE — the resolution line is the largest thing in the
  // frame; setup lines sit a clear step smaller and muted. The hierarchy is the
  // composition (CD: "larger title scale, deliberate weight/tracking hierarchy").
  // Sizes are tuned so a typical resolution line fits the centered measure
  // (1600px usable inside the 160px gutter) on at most TWO balanced lines —
  // previously 132/150 ran a long claim off the right edge + into the caption
  // band (CD: "centering issues"). Long claims auto-step down a notch.
  const longResolve = (lines[lastIdx]?.length ?? 0) > 22;
  const resolveSize =
    lines.length >= 3 ? 92 : lines.length === 2 ? (longResolve ? 104 : 118) : longResolve ? 116 : 132;
  const setupSize = Math.round(resolveSize * 0.5);

  // Per-LINE reveal cadence (not per-glyph). Each setup line clips up in turn;
  // the resolution lands on a held beat after the last setup line — a composed
  // pause, not a dead one. Cadence is TIGHT: Hook is the shortest scene (~45f),
  // so the turn must land by ~frame 22 to get a held beat before the cut (no
  // dead tail, no resolution that never arrives).
  const lineStride = 9;
  const resolveDelay = lines.length === 1 ? 3 : lastIdx * lineStride + 9;

  // The single (one-line) hook: the whole line IS the resolution.
  if (lines.length === 1) {
    return (
      <Fill>
        <Backdrop />
        <OpticalCenter>
          <div
            style={{
              ...head,
              fontSize: resolveSize,
              lineHeight: 1.06,
              maxWidth: 1500,
              textAlign: "center",
              overflowWrap: "break-word",
              transform: liveTransform,
            }}
          >
            <ClipLine
              text={lines[0]}
              delay={4}
              move="weight"
              emphasis="gradient"
              weight={[260, 780]}
              trackFrom={0.06}
            />
          </div>
        </OpticalCenter>
      </Fill>
    );
  }

  return (
    <Fill>
      <Backdrop />
      <OpticalCenter>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: 1600,
            transform: liveTransform,
          }}
        >
          {lines.map((line, i) => {
            const isResolve = i === lastIdx;

            if (isResolve) {
              // RESOLUTION — the turn. Largest, gradient, one confident weight
              // bloom riding a whole-line clip reveal. Air above it sets it apart.
              return (
                <div
                  key={i}
                  style={{
                    ...head,
                    fontSize: resolveSize,
                    lineHeight: 1.06,
                    marginTop: 24,
                    maxWidth: 1500,
                    overflowWrap: "break-word",
                  }}
                >
                  <ClipLine
                    text={line}
                    delay={resolveDelay}
                    move="weight"
                    emphasis="gradient"
                    weight={[240, 780]}
                    trackFrom={0.05}
                  />
                </div>
              );
            }

            // SETUP (the status quo, stated flat) — a clear step smaller, muted,
            // mono-eyebrow weight, clip-revealed whole. No per-glyph cascade, no
            // garnish: the line arrives as one confident unit.
            return (
              <div
                key={i}
                style={{
                  fontFamily: FONTS.body,
                  fontWeight: 500,
                  fontSize: setupSize,
                  lineHeight: 1.18,
                  letterSpacing: "-0.01em",
                  color: c("textDim"),
                  maxWidth: 1200,
                }}
              >
                <ClipLine
                  text={line}
                  delay={4 + i * lineStride}
                  move="blur"
                  emphasis="none"
                  baseWeight={500}
                />
              </div>
            );
          })}
        </div>
      </OpticalCenter>
    </Fill>
  );
};

/* -------------------------------------------------------------------------- */
/*  S2 — Problem  (restrained status-quo, OWNED by `./problem`)                 */
/*                                                                             */
/*  The pain is stated flat and muted — a left-aligned list of status-quo lines */
/*  — then an editor's STRIKE RULE draws across each (left→right, as a growing  */
/*  width, the way you cross something out by hand), the text desaturating and  */
/*  dimming as it's crossed, before the single `resolve` line lifts in on the   */
/*  gradient. Restraint is the point: the scene never out-shouts the product.   */
/* -------------------------------------------------------------------------- */

export const Problem: React.FC<ProblemProps> = ({ stamps, resolve }) => (
  <Fill>
    <Backdrop hue="accent2" />
    {/* Center the board as a BLOCK within the caption-clear region. The board's
        content is editorially left-aligned, but the block itself is optically
        centered (a fixed measure), so the list no longer floats to the upper
        left (CD: "content isn't centered"). */}
    <SafeCenter>
      <ProblemBoard stamps={stamps} resolve={resolve} />
    </SafeCenter>
  </Fill>
);

/* -------------------------------------------------------------------------- */
/*  S3 — ProductShot  (carries the SIGNATURE motion)                           */
/*                                                                             */
/*  Rebuilt to studio quality and OWNED by `./productshot` (the floating device */
/*  chrome, DOF backdrop, parallax depth, contact shadow, glass callouts, and   */
/*  the signature camera push-in). Re-exported here so the registry binding     */
/*  (`./index`) and the narrative-order docs above stay in one place.           */
/* -------------------------------------------------------------------------- */

export { ProductShot } from "./productshot";

/* -------------------------------------------------------------------------- */
/*  S4 — FeatureBeat                                                           */
/*  Repeatable ×2–4; FeatureBeats in one video share this layout (consistency  */
/*  IS the premium tell). A region still rises in beside a label + caption.     */
/* -------------------------------------------------------------------------- */

export const FeatureBeat: React.FC<FeatureBeatProps> = ({
  label,
  region,
  caption,
  screen,
}) => {
  // Each FeatureBeat renders a REAL ResuBird screen (ATS gauge / bullet rewrite
  // / cover draft) inside the IDENTICAL `ResuBirdShell` chrome, owned entirely by
  // `RegionHighlight`: it resolves `seed → screenId` (via `screenFor`), renders
  // that screen, AND derives the ring rect from the SAME screen's hot-rects — so
  // the ring is guaranteed to land on a concrete element (no content-less glow,
  // CD #1). The shared top-bar/stepper/left-nav make a screen change read as
  // deliberate navigation through ONE product, not three unrelated mocks (the
  // old anti-flicker pin is superseded: stats are now pinned per-screen
  // constants, and the chrome is constant). `seed` hashes the tour across the
  // three screens beat-to-beat.
  const seed = region || `${label}|${caption}`;

  return (
    <Fill>
      <Backdrop />
      {/* The layout is IDENTICAL across every beat — the still framed center,
          the focus ring sweeping onto a derived region, the connector drawing to
          a glass caption chip, and the earcon ripple. Consistency IS the tell.
          `SafeCenter` keeps the framed still in the caption-clear region so the
          burned-in caption band never sits on the device bottom edge. */}
      <SafeCenter>
        <RegionHighlight
          seed={seed}
          screenId={screen}
          label={label}
          caption={caption}
          delay={6}
          landAt={30}
        />
      </SafeCenter>
    </Fill>
  );
};

/* -------------------------------------------------------------------------- */
/*  S5 — Stats                                                                 */
/*  ≤4 count-up numbers. Unverified items render an "e.g." affordance          */
/*  (stats are examples until verified). Accents cycle accent / accent2.       */
/* -------------------------------------------------------------------------- */

const STAT_ACCENTS: PaletteKey[] = ["accent", "accent2", "accent", "accent2"];

/** A percentage-class stat (≤100 with a `%` suffix) reads best as a ring. */
const isPercentish = (it: StatsProps["items"][number]): boolean =>
  it.suffix.trim() === "%" && it.to <= 100;

export const Stats: React.FC<StatsProps> = ({ items }) => {
  const head = useHeadlineStyle();

  // Choose the data-viz per the shape of the set:
  //  - all-percentage sets → bars (a clean comparative stack, the "designed" tell);
  //  - a percentage in a mixed/single set → ring (the count-up arc);
  //  - everything else → the count-up CounterCard (number + seeded sparkline).
  // Every viz rides the SAME count-up ramp so digits/arcs/bars settle in lockstep.
  const allPct = items.every(isPercentish);

  return (
    <Fill>
      <Backdrop />
      <OpticalCenter>
        {/* header — one confident whole-line reveal, the marked word in the
            gradient. Sits on the same optical grid as the viz block below. */}
        <div style={{ ...head, fontWeight: 700, marginBottom: 64, textAlign: "center" }}>
          <ClipLine
            text="By the *numbers*"
            delay={3}
            move="weight"
            emphasis="gradient"
            weight={[260, 780]}
            trackFrom={0.04}
            style={{ fontSize: 76 }}
          />
        </div>

        {allPct ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 50,
              width: 1000,
            }}
          >
            {items.map((it, i) => (
              <StatBar
                key={i}
                to={it.to}
                suffix={it.suffix}
                decimals={it.decimals}
                label={it.label}
                verified={it.verified}
                delay={14 + i * 9}
                accent={STAT_ACCENTS[i % STAT_ACCENTS.length]}
                full={100}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 56,
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {items.map((it, i) =>
              isPercentish(it) ? (
                <ProgressRing
                  key={i}
                  to={it.to}
                  suffix={it.suffix}
                  decimals={it.decimals}
                  label={it.label}
                  verified={it.verified}
                  delay={14 + i * 10}
                  accent={STAT_ACCENTS[i % STAT_ACCENTS.length]}
                  full={100}
                />
              ) : (
                <CounterCard
                  key={i}
                  to={it.to}
                  suffix={it.suffix}
                  decimals={it.decimals}
                  label={it.label}
                  verified={it.verified}
                  delay={14 + i * 10}
                  accent={STAT_ACCENTS[i % STAT_ACCENTS.length]}
                />
              ),
            )}
          </div>
        )}
      </OpticalCenter>
    </Fill>
  );
};

/* -------------------------------------------------------------------------- */
/*  S6 — Proof                                                                 */
/*  One social-proof beat: either a quote (with attribution) OR a logo wall of */
/*  real SVG marks. The union is discriminated by which key is present.        */
/* -------------------------------------------------------------------------- */

export const Proof: React.FC<ProofProps> = (props) => {
  // Logo wall — gridded glass tiles (gradient-hairline depth, desaturated marks,
  // a settle stagger, a soft center spotlight tying the set into one wall).
  if ("logos" in props) {
    return (
      <Fill>
        <Backdrop hue="accent2" />
        <SafeCenter>
          <LogoWall logos={props.logos.map(resolveAsset)} />
        </SafeCenter>
      </Fill>
    );
  }

  // Single quote — the typeset `PullQuote` with depth: an oversized quotemark
  // parallaxing in behind a kinetic quote line, a star draw-on, an accent rule,
  // and a monogram-avatar attribution.
  const { quote, attribution } = props;
  return (
    <Fill>
      <Backdrop hue="accent2" />
      <SafeCenter>
        <PullQuote quote={quote} attribution={attribution} />
      </SafeCenter>
    </Fill>
  );
};

/* -------------------------------------------------------------------------- */
/*  S7 — CTA  (carries the SIGNATURE motion + the longest hold)                */
/*  Wordmark headline + one action pill. Always last. The action sweep is a    */
/*  frame-driven light pass (no timer). Signature motion on the headline.      */
/* -------------------------------------------------------------------------- */

/**
 * Canonical CTA button label derived from the headline's leading imperative verb
 * (CD R5 P2). The button used to be a hardcoded "Try free" while the headline
 * said "Start building…" and the VO said "sign up" — three different verbs for
 * one action, which read as incoherent across audio/screen. Anchoring the button
 * to the headline's verb makes the on-screen action coherent for EVERY video;
 * the script generator anchors the VO on the same verb so all three agree. Pure
 * string→string (deterministic). Falls back to a safe generic for an unrecognised
 * opener so the button is never empty.
 */
const CTA_VERB_LABEL: Readonly<Record<string, string>> = {
  start: "Start free",
  begin: "Start free",
  build: "Start free",
  building: "Start free",
  create: "Start free",
  make: "Start free",
  try: "Try free",
  get: "Get started",
  sign: "Sign up free",
  join: "Join free",
  claim: "Claim free",
  grow: "Start free",
  land: "Start free",
};

export const ctaButtonLabel = (headline: string): string => {
  const first =
    headline
      .replace(/[^a-zA-Z\s]/g, " ")
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase() ?? "";
  return CTA_VERB_LABEL[first] ?? "Get started";
};

export const CTA: React.FC<CtaProps> = ({ headline, url }) => {
  const { frame } = useFrame();
  const c = palette();
  const head = useHeadlineStyle();
  const urlS = useEnter(34);
  // The button echoes the headline's action verb (see `ctaButtonLabel`).
  const buttonLabel = ctaButtonLabel(headline);

  // Slow ambient pulse + a single light sweep across the pill (frame-driven).
  const pulse = 1 + Math.sin(frame / 9) * 0.02;
  const sweepX = interpolate(frame % 75, [18, 55], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // The premium gradient-glow ring breathes under the pill (deterministic sine).
  const glow = 0.42 + (Math.sin(frame / 13) * 0.5 + 0.5) * 0.22;

  return (
    <Fill>
      <Backdrop />
      <OpticalCenter>
        {/* SIGNATURE motion frames the reveal; the headline arrives as ONE
            confident unit — a whole-line clip reveal with a single weight bloom
            and the marked span in the gradient. No per-glyph cascade. */}
        <Signature delay={8}>
          <div
            style={{
              ...head,
              fontSize: 128,
              textAlign: "center",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              maxWidth: 1500,
            }}
          >
            <ClipLine
              text={headline}
              delay={10}
              move="weight"
              emphasis="gradient"
              weight={[240, 800]}
              trackFrom={0.04}
            />
          </div>
        </Signature>

        {/* Premium gradient-glow pill: breathing glow ring + frame-driven sheen.
            This is the FINAL call-to-action of the whole video — it must hold
            bright + pressable to the last frame (CD #6). It does NOT ride the
            scene exit fade (there is no scene after it; an exit fade here is what
            made the pill read ghosted/disabled on the held end frame). */}
        <div
          style={{
            position: "relative",
            marginTop: 64,
            opacity: interpolate(urlS, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${(1 - urlS) * 40}px) scale(${pulse})`,
          }}
        >
          {/* soft glow halo behind the pill (blurred gradient duplicate) */}
          <div
            style={{
              position: "absolute",
              inset: -26,
              borderRadius: 999,
              background: `linear-gradient(100deg, ${c("accent")}, ${c("accent2")})`,
              filter: "blur(34px)",
              opacity: glow,
            }}
          />
          {/* Solid, high-contrast, pressable pill — ONE clear action. The label is
              the action verb derived from the headline (`ctaButtonLabel`, CD R5 P2)
              with a bright full-strength arrow; the URL is DEMOTED to a smaller line
              below the button so the two never compete at the same weight (CD #6). */}
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 18,
              padding: "28px 74px",
              borderRadius: 999,
              fontFamily: FONTS.display,
              fontSize: 46,
              fontWeight: 700,
              color: c("text"),
              background: `linear-gradient(100deg, ${c("accent")}, ${c("accent2")})`,
              boxShadow: `inset 0 1px 0 ${c("text", 0.3)}, inset 0 -2px 8px ${c("bg", 0.3)}, 0 0 80px ${c("accent", 0.5)}, 0 24px 60px rgba(0,0,0,0.55)`,
              overflow: "hidden",
            }}
          >
            <span style={{ position: "relative", zIndex: 1 }}>{buttonLabel}</span>
            {/* bright, full-strength arrow (no ghosted opacity — the CTA must read
                as pressable, never disabled) */}
            <span
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 50,
                lineHeight: 1,
                color: c("text"),
              }}
            >
              →
            </span>
            {/* frame-driven sheen sweep (no timer) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent ${sweepX - 14}%, ${c("text", 0.3)} ${sweepX}%, transparent ${sweepX + 14}%)`,
              }}
            />
          </div>
          {/* URL — demoted UNDER the button, but kept legible (CD R3 P2: the URL
              read faint/illegible). Brighter `text` token at a calm weight + a
              hair more size, clearly below the pill so it never competes with the
              action label yet is readable on the held end frame. */}
          <div
            style={{
              marginTop: 28,
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: c("text", 0.82),
            }}
          >
            {url}
          </div>
        </div>
      </OpticalCenter>
    </Fill>
  );
};
