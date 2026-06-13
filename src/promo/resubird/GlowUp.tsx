import React from "react";
import {
  Img,
  AbsoluteFill,
  Audio,
  interpolate,
  interpolateColors,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { FONTS } from "../theme";
import { RB, RB_GRADIENT_TEXT } from "./theme";
import { LightBackdrop, RPop } from "./ui";

export const GLOWUP_DURATION = 480; // 16s @ 30fps

export type GlowConfig = {
  roleTag?: string; // optional mono chip, e.g. "PRODUCT MANAGER"
  weak: string;
  strong: string;
  start: number;
  end: number;
  headA: string;
  headB: string;
  vo: { weak: string; transform: string; cta: string };
};

// Phase boundaries (frames)
const REWRITE_AT = 140; // weak bullet dies
const TYPE_FROM = 175; // strong bullet types on
const TYPE_TO = 265;
const CLIMB_FROM = 185; // ring starts climbing
const CLIMB_TO = 285;
const CTA_AT = 340;

const RingClimb: React.FC<{ start: number; end: number }> = ({
  start,
  end,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [CLIMB_FROM, CLIMB_TO], [start, end], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mid = (start + end) / 2;
  const color = interpolateColors(
    progress,
    [start, mid, end],
    [RB.amber, RB.orange, RB.green],
  );
  const label =
    progress < 75 ? "NEEDS WORK" : progress < 90 ? "GETTING THERE" : "GOOD FIT";
  // celebration pulse when the score lands
  const pulse = interpolate(frame, [CLIMB_TO, CLIMB_TO + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const size = 380;
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* celebration ring */}
      <div
        style={{
          position: "absolute",
          inset: -10,
          borderRadius: "50%",
          border: `3px solid ${RB.green}`,
          opacity: pulse > 0 ? (1 - pulse) * 0.8 : 0,
          transform: `scale(${1 + pulse * 0.45})`,
        }}
      />
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`${RB.ink}12`}
          strokeWidth={size * 0.062}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.062}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: size * 0.27,
            fontWeight: 700,
            color: RB.ink,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {Math.round(progress)}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: size * 0.055,
            color,
            fontWeight: 600,
            letterSpacing: "0.14em",
            marginTop: 8,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

const Bullet: React.FC<{ weak: string; strong: string }> = ({
  weak,
  strong,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, mass: 0.7 },
  });
  const weakDie = interpolate(frame, [REWRITE_AT, REWRITE_AT + 28], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typed = strong.slice(
    0,
    Math.round(
      interpolate(frame, [TYPE_FROM, TYPE_TO], [0, strong.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  return (
    <div
      style={{
        opacity: interpolate(cardIn, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - cardIn) * 70}px)`,
        width: 880,
        background: RB.card,
        borderRadius: 28,
        border: `1px solid ${RB.ink}14`,
        boxShadow: `0 30px 70px ${RB.ink}1e`,
        padding: "44px 52px",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 22,
          color: RB.faint,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          marginBottom: 22,
        }}
      >
        Experience
      </div>
      {frame < TYPE_FROM ? (
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 42,
            fontWeight: 600,
            color: RB.ink,
            opacity: 0.35 + weakDie * 0.65,
            textDecoration: frame > REWRITE_AT ? "line-through" : "none",
            textDecorationColor: RB.red,
            textDecorationThickness: 4,
            minHeight: 120,
          }}
        >
          • {weak}
        </div>
      ) : (
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 42,
            fontWeight: 600,
            color: RB.ink,
            minHeight: 120,
          }}
        >
          • {typed}
          <span
            style={{
              opacity: frame % 16 < 8 && frame < TYPE_TO + 10 ? 1 : 0,
              color: RB.orange,
            }}
          >
            ▌
          </span>
        </div>
      )}
    </div>
  );
};

const RoleChip: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [4, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity: o,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 28px",
        borderRadius: 999,
        border: `1px solid ${RB.orange}55`,
        background: `${RB.orange}14`,
        fontFamily: FONTS.mono,
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        color: "#c2570c",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          background: RB.orange,
          boxShadow: `0 0 12px ${RB.orange}`,
        }}
      />
      {label}
    </div>
  );
};

export const GlowUp: React.FC<{ config?: GlowConfig }> = ({ config }) => {
  const c: GlowConfig = config ?? {
    weak: "Worked on backend services.",
    strong: "Cut API p95 latency 40% across 12 services.",
    start: 58,
    end: 92,
    headA: "Same experience.",
    headB: "Better words.",
    vo: { weak: "gvo1", transform: "gvo2", cta: "gvo3" },
  };
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const headA = Math.min(
    interpolate(frame, [12, 36], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(frame, [REWRITE_AT - 10, REWRITE_AT + 14], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const headB = interpolate(frame, [REWRITE_AT + 18, REWRITE_AT + 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mainOut = interpolate(frame, [CTA_AT - 18, CTA_AT + 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaLogo = spring({
    frame: frame - CTA_AT - 6,
    fps,
    config: { damping: 12, mass: 0.9 },
  });
  const ctaBtn = spring({
    frame: frame - CTA_AT - 26,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  const sweepX = interpolate((frame - CTA_AT) % 70, [16, 50], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <Audio
        src={staticFile("audio/ncs-feel-good.mp3")}
        trimBefore={Math.round(28 * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, durationInFrames - 50, durationInFrames - 8],
            [0, 0.11, 0.11, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <Sequence from={20}>
        <Audio src={staticFile(`audio/${c.vo.weak}.wav`)} volume={1} />
      </Sequence>
      <Sequence from={150}>
        <Audio src={staticFile(`audio/${c.vo.transform}.wav`)} volume={1} />
      </Sequence>
      <Sequence from={CTA_AT + 14}>
        <Audio src={staticFile(`audio/${c.vo.cta}.wav`)} volume={1} />
      </Sequence>
      <LightBackdrop />
      {/* main continuous shot */}
      <AbsoluteFill
        style={{
          opacity: mainOut,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 56,
          padding: "0 70px",
        }}
      >
        {c.roleTag ? <RoleChip label={c.roleTag} /> : null}
        <div style={{ position: "relative", height: 130 }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontFamily: FONTS.display,
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: RB.ink,
              opacity: headA,
            }}
          >
            {c.headA}
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontFamily: FONTS.display,
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              opacity: headB,
              ...RB_GRADIENT_TEXT,
            }}
          >
            {c.headB}
          </div>
        </div>
        <RingClimb start={c.start} end={c.end} />
        <Bullet weak={c.weak} strong={c.strong} />
      </AbsoluteFill>
      {/* CTA */}
      {frame >= CTA_AT && (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              width: 170,
              height: 170,
              transform: `scale(${ctaLogo})`,
              filter: `drop-shadow(0 16px 32px ${RB.orange}55)`,
            }}
          >
            <Img
              src={staticFile("resubird/favicon.png")}
              style={{ width: "100%" }}
            />
          </div>
          <RPop delay={CTA_AT + 10}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 100,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: RB.ink,
                marginTop: 36,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              Your resume,
              <br />
              <span style={RB_GRADIENT_TEXT}>rewritten.</span>
            </div>
          </RPop>
          <div
            style={{
              marginTop: 70,
              opacity: interpolate(ctaBtn, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - ctaBtn) * 40}px)`,
              padding: "28px 60px",
              borderRadius: 999,
              fontFamily: FONTS.display,
              fontSize: 44,
              fontWeight: 700,
              color: "#fff",
              background: `linear-gradient(100deg, ${RB.orange}, #ea580c)`,
              boxShadow: `0 22px 50px ${RB.orange}66`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span style={{ position: "relative", zIndex: 1 }}>
              Fix yours free → resubird.com
            </span>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent ${sweepX - 14}%, rgba(255,255,255,0.35) ${sweepX}%, transparent ${sweepX + 14}%)`,
              }}
            />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ————— Series variants —————
const PM: GlowConfig = {
  roleTag: "Product Manager",
  weak: "Responsible for the product roadmap.",
  strong: "Cut 3 features, shipped 2, grew activation 23%.",
  start: 57,
  end: 91,
  headA: "Same role.",
  headB: "Real impact.",
  vo: { weak: "pm_w", transform: "pm_t", cta: "cta_glow" },
};

const DATA: GlowConfig = {
  roleTag: "Data Analyst",
  weak: "Built dashboards in Tableau.",
  strong: "Replaced 40 dashboards. Saved 15 hours a week.",
  start: 52,
  end: 94,
  headA: "Same job.",
  headB: "Real numbers.",
  vo: { weak: "da_w", transform: "da_t", cta: "cta_glow" },
};

const DESIGN: GlowConfig = {
  roleTag: "Product Designer",
  weak: "Redesigned the checkout flow.",
  strong: "Cut checkout drop-off from 60% to 12%.",
  start: 60,
  end: 93,
  headA: "Same work.",
  headB: "Real outcome.",
  vo: { weak: "de_w", transform: "de_t", cta: "cta_glow" },
};

export const GlowUpPM: React.FC = () => <GlowUp config={PM} />;
export const GlowUpData: React.FC = () => <GlowUp config={DATA} />;
export const GlowUpDesign: React.FC = () => <GlowUp config={DESIGN} />;
