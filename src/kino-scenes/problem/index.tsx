/**
 * `src/kino-scenes/problem` — the PROBLEM craft kit (S2 status-quo pain).
 *
 * The studio upgrade over CSS `line-through`: a RESTRAINED status-quo treatment.
 * The pain is stated flat and muted — a left-aligned list of status-quo lines,
 * each with a muted marker — then an editor's STRIKE RULE draws across each line
 * (left→right, as a growing width, the way you cross something out by hand), the
 * text desaturating and dimming as it's crossed. No hard jump-cut to struck; the
 * strike GROWS. Then the single resolution lifts in on the gradient.
 *
 * The restraint is the point (ROADMAP §4: "status-quo pain, muted"): the stamps
 * are textDim, the markers are small, the strike is a single accent rule — the
 * scene never out-shouts the product scenes that follow.
 *
 * DETERMINISM (ENGINE_DESIGN §2): every value is a pure function of the Kino
 * frame; the strike timing is a closed-form `interpolate(frame, …)` per line. No
 * wall-clock, no random.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2`.
 */
import * as React from "react";

import { useFrame, interpolate, spring } from "../../engine";
import { palette } from "../../design";
import { FONTS, useHeadlineStyle, useMotionToken } from "../kit";
import { KineticLine } from "../type";

/* -------------------------------------------------------------------------- */
/*  StrikeStamp — one restrained status-quo line with a draw-on strike          */
/* -------------------------------------------------------------------------- */

export const StrikeStamp: React.FC<{
  text: string;
  delay: number;
  /** Frame the strike rule begins drawing across this line. */
  strikeAt: number;
}> = ({ text, delay, strikeAt }) => {
  const { frame, fps } = useFrame();
  const c = palette();
  const head = useHeadlineStyle();
  const tok = useMotionToken();

  const s = spring({ frame: frame - delay, fps, config: tok.spring });
  // strike draws across over ~16 frames; text dims + desaturates as it's crossed
  const strike = interpolate(frame, [strikeAt, strikeAt + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        opacity:
          interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }) *
          (1 - strike * 0.55),
        transform: `translateX(${(1 - s) * -34}px)`,
        display: "flex",
        alignItems: "center",
        gap: 26,
        alignSelf: "flex-start",
      }}
    >
      {/* leading muted marker — a small diamond, dims as the line is struck */}
      <span
        style={{
          width: 13,
          height: 13,
          borderRadius: 3,
          flexShrink: 0,
          background: c("textDim", 0.5 * (1 - strike * 0.6)),
          transform: "rotate(45deg)",
        }}
      />
      <span
        style={{
          ...head,
          fontSize: 50,
          fontWeight: 600,
          color: c("textDim"),
          position: "relative",
          whiteSpace: "nowrap",
          filter: `saturate(${1 - strike * 0.5})`,
        }}
      >
        {text}
        {/* the strike rule, drawn as a growing width (left → right) */}
        <span
          style={{
            position: "absolute",
            left: -8,
            right: -8,
            top: "52%",
            height: 5,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${c("accent2")}, ${c("accent")})`,
            boxShadow: `0 0 14px ${c("accent2", 0.6)}`,
            transform: `scaleX(${strike})`,
            transformOrigin: "left",
          }}
        />
        {/* the pen-tip: a bright dot riding the leading edge of the strike */}
        <span
          style={{
            position: "absolute",
            left: `calc(${strike * 100}% - 8px)`,
            top: "52%",
            width: 10,
            height: 10,
            marginTop: -5,
            borderRadius: 99,
            background: c("text"),
            boxShadow: `0 0 16px ${c("accent")}`,
            opacity: strike > 0.02 && strike < 0.99 ? 1 : 0,
          }}
        />
      </span>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  ProblemBoard — the full restrained list + resolve                          */
/* -------------------------------------------------------------------------- */

export const ProblemBoard: React.FC<{ stamps: string[]; resolve: string }> = ({
  stamps,
  resolve,
}) => {
  const { frame, fps } = useFrame();
  const c = palette();
  const tok = useMotionToken();

  // Each stamp enters staggered; the strike crosses each in the same staggered
  // order AFTER the last one has landed, so the eye reads the whole list first.
  const perStamp = 16;
  const lastIn = (stamps.length - 1) * perStamp;
  const strikeBase = lastIn + 22;
  const strikeStagger = 9;
  const resolveDelay = strikeBase + stamps.length * strikeStagger + 14;

  const resolveS = spring({ frame: frame - resolveDelay, fps, config: tok.spring });

  return (
    // CENTERED column (user feedback: v4's Problem list floated to the upper
    // left). The block shrinks to its content and is centered by the parent
    // `SafeCenter`; every row — eyebrow, stamps, the resolve rule + line — is
    // center-aligned so the scene reads composed on the frame center, not
    // ragged to one corner. The struck lines stay a tidy centered stack (the
    // editorial strike treatment is unchanged; only the alignment moved).
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, maxWidth: 1480 }}>
      {/* the muted status-quo eyebrow */}
      <Eyebrow />

      {/* the struck status-quo lines — a LEFT-ALIGNED group (tidy aligned left
          edges, an editorial list) that is itself CENTERED in the column, so the
          list reads composed on the frame center instead of ragged or
          floating to a corner (user feedback). */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 34 }}>
        {stamps.map((text, i) => (
          <StrikeStamp
            key={i}
            text={text}
            delay={i * perStamp}
            strikeAt={strikeBase + i * strikeStagger}
          />
        ))}
      </div>

      {/* resolution — lifts in centered on the gradient, after the crossing-out */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 22,
          maxWidth: 1480,
          opacity: interpolate(resolveS, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${(1 - resolveS) * 40}px)`,
        }}
      >
        {/* a thin accent rule introduces the turn (centered) */}
        <div
          style={{
            width: interpolate(resolveS, [0, 1], [0, 120], { extrapolateRight: "clamp" }),
            height: 4,
            borderRadius: 99,
            marginBottom: 28,
            background: `linear-gradient(90deg, ${c("accent")}, ${c("accent2")})`,
            boxShadow: `0 0 18px ${c("accent", 0.5)}`,
          }}
        />
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center" }}>
          <KineticLine
            text={resolve}
            delay={resolveDelay + 2}
            stride={1.4}
            wordGap={5}
            mode="weight"
            emphasis="gradient"
            weight={[200, 760]}
            trackFrom={0.06}
            align="center"
            style={{ fontSize: 84, lineHeight: 1.06 }}
          />
        </div>
      </div>
    </div>
  );
};

const Eyebrow: React.FC = () => {
  const { frame, fps } = useFrame();
  const c = palette();
  const s = spring({ frame, fps, config: { damping: 18, mass: 0.8, stiffness: 100 } });
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 16}px)`,
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        fontFamily: FONTS.mono,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        color: c("textDim"),
        marginBottom: 8,
      }}
    >
      <span style={{ width: 30, height: 1, background: c("textDim", 0.5) }} />
      The old way
    </div>
  );
};
