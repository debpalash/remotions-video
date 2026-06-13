import React from "react";
import {
  Img,
  AbsoluteFill,
  Audio,
  interpolate,
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

export const RACE_DURATION = 530; // ~17.7s @ 30fps

const SLATE = "#6B7280";
const STAGES = ["Applied", "ATS Screen", "Recruiter", "Interview", "Offer"];
const Y_ROWS = [690, 880, 1070, 1260, 1450];
const LX = 320; // left lane center
const RX = 760; // right lane center

// Timeline
const START = 96; // tokens leave Applied
const ATS = 132; // both reach ATS Screen
const REJECT = 138; // left stamped
const R2 = 188; // right → Recruiter
const R3 = 238; // right → Interview
const R4 = 288; // right → Offer (lands)
const PAYOFF = 330;
const CTA_AT = 372;

const lerpRows = (frame: number, kf: number[], rows: number[]) =>
  interpolate(frame, kf, rows, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Lane: React.FC<{
  x: number;
  color: string;
  topRow: number; // index the token has reached
  tokenY: number;
  letter: string;
  dim: number;
}> = ({ x, color, topRow, tokenY, letter, dim }) => {
  return (
    <div style={{ opacity: dim }}>
      {/* base rail */}
      <div
        style={{
          position: "absolute",
          left: x - 3,
          top: Y_ROWS[0],
          width: 6,
          height: Y_ROWS[4] - Y_ROWS[0],
          background: `${RB.ink}14`,
          borderRadius: 99,
        }}
      />
      {/* filled rail */}
      <div
        style={{
          position: "absolute",
          left: x - 3,
          top: Y_ROWS[0],
          width: 6,
          height: Math.max(0, tokenY - Y_ROWS[0]),
          background: color,
          borderRadius: 99,
          boxShadow: `0 0 16px ${color}66`,
        }}
      />
      {/* nodes */}
      {Y_ROWS.map((y, i) => {
        const passed = i <= topRow;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 13,
              top: y - 13,
              width: 26,
              height: 26,
              borderRadius: 99,
              background: passed ? color : RB.card,
              border: `3px solid ${passed ? color : `${RB.ink}22`}`,
              boxShadow: passed ? `0 0 14px ${color}88` : "none",
            }}
          />
        );
      })}
      {/* token */}
      <div
        style={{
          position: "absolute",
          left: x - 38,
          top: tokenY - 38,
          width: 76,
          height: 76,
          borderRadius: 99,
          background: RB.card,
          border: `4px solid ${color}`,
          boxShadow: `0 10px 30px ${RB.ink}22, 0 0 28px ${color}66`,
          display: "grid",
          placeItems: "center",
          fontFamily: FONTS.display,
          fontSize: 38,
          fontWeight: 700,
          color,
        }}
      >
        {letter}
      </div>
    </div>
  );
};

const Stamp: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - at,
    fps,
    config: { damping: 9, mass: 0.5, stiffness: 220 },
  });
  if (frame < at) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 150,
        top: y - 52,
        width: 300,
        textAlign: "center",
        transform: `rotate(-11deg) scale(${0.6 + s * 0.4})`,
        opacity: interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        padding: "12px 0",
        borderRadius: 14,
        border: `5px solid ${RB.red}`,
        color: RB.red,
        fontFamily: FONTS.display,
        fontSize: 46,
        fontWeight: 700,
        letterSpacing: "0.06em",
        background: "rgba(255,255,255,0.55)",
        boxShadow: `0 8px 24px ${RB.red}33`,
      }}
    >
      REJECTED
    </div>
  );
};

const Confetti: React.FC<{ cx: number; cy: number; at: number }> = ({
  cx,
  cy,
  at,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const colors = [RB.orange, RB.green, RB.amber, RB.blue];
  return (
    <>
      {Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2 + (i % 5) * 0.4;
        const speed = 9 + (i % 4) * 3.5;
        const x = cx + Math.cos(angle) * speed * t;
        const y = cy + Math.sin(angle) * speed * t + 0.34 * t * t;
        const op = interpolate(t, [0, 30, 46], [1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const sz = 12 + (i % 3) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: sz,
              height: sz * 0.6,
              background: colors[i % 4],
              opacity: op,
              borderRadius: 3,
              transform: `rotate(${i * 37 + t * 9}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

const CandidateCard: React.FC<{
  letter: string;
  bullet: string;
  color: string;
  delay: number;
}> = ({ letter, bullet, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, mass: 0.7 },
  });
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateX(${(1 - s) * (letter === "A" ? -60 : 60)}px)`,
        display: "flex",
        alignItems: "center",
        gap: 22,
        width: 900,
        padding: "22px 30px",
        background: RB.card,
        borderRadius: 20,
        border: `1px solid ${RB.ink}14`,
        borderLeft: `6px solid ${color}`,
        boxShadow: `0 18px 44px ${RB.ink}14`,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          flexShrink: 0,
          borderRadius: 99,
          background: `${color}1c`,
          border: `2px solid ${color}66`,
          display: "grid",
          placeItems: "center",
          fontFamily: FONTS.display,
          fontSize: 30,
          fontWeight: 700,
          color,
        }}
      >
        {letter}
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 34,
          fontWeight: 600,
          color: RB.ink,
        }}
      >
        {bullet}
      </div>
    </div>
  );
};

export const ResumeRace: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const colorA = frame >= REJECT ? RB.red : SLATE;
  const colorB = frame >= ATS ? RB.green : SLATE;

  const leftY = lerpRows(frame, [START, ATS], [Y_ROWS[0], Y_ROWS[1]]);
  const rightY = lerpRows(
    frame,
    [START, ATS, R2, R3, R4],
    [Y_ROWS[0], Y_ROWS[1], Y_ROWS[2], Y_ROWS[3], Y_ROWS[4]],
  );
  const leftTopRow = frame >= ATS ? 1 : frame >= START ? 0 : -1;
  const rightTopRow =
    frame >= R4 ? 4 : frame >= R3 ? 3 : frame >= R2 ? 2 : frame >= ATS ? 1 : 0;
  const leftDim = interpolate(frame, [REJECT + 6, REJECT + 30], [1, 0.34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // screen shake on reject
  const shake =
    frame >= REJECT && frame < REJECT + 16
      ? Math.sin((frame - REJECT) * 2.6) *
        (1 - (frame - REJECT) / 16) *
        16
      : 0;

  const mainOut = interpolate(frame, [CTA_AT - 16, CTA_AT + 2], [1, 0], {
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

  // offer badge pop
  const offerPop = spring({
    frame: frame - R4,
    fps,
    config: { damping: 11, mass: 0.5 },
  });
  const payoff = spring({
    frame: frame - PAYOFF,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <Audio
        src={staticFile("audio/ncs-feel-good.mp3")}
        trimBefore={Math.round(20 * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, R4 - 10, R4 + 14, durationInFrames - 50, durationInFrames - 8],
            [0, 0.1, 0.1, 0.17, 0.17, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <Sequence from={8}>
        <Audio src={staticFile("audio/race1.wav")} volume={1} />
      </Sequence>
      <Sequence from={ATS + 4}>
        <Audio src={staticFile("audio/race2.wav")} volume={1} />
      </Sequence>
      <Sequence from={214}>
        <Audio src={staticFile("audio/race3.wav")} volume={1} />
      </Sequence>
      <Sequence from={CTA_AT + 8}>
        <Audio src={staticFile("audio/race4.wav")} volume={1} />
      </Sequence>

      <LightBackdrop />

      {/* main race */}
      <AbsoluteFill
        style={{
          opacity: mainOut,
          transform: `translateX(${shake}px)`,
        }}
      >
        {/* title */}
        <AbsoluteFill style={{ alignItems: "center", top: 110 }}>
          <RPop>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 66,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: RB.ink,
                textAlign: "center",
              }}
            >
              Same experience.
              <br />
              <span style={RB_GRADIENT_TEXT}>Different words.</span>
            </div>
          </RPop>
        </AbsoluteFill>

        {/* candidate cards */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            top: 330,
            flexDirection: "column",
            gap: 18,
          }}
        >
          <CandidateCard
            letter="A"
            bullet="Worked on backend services."
            color={colorA}
            delay={20}
          />
          <CandidateCard
            letter="B"
            bullet="Shipped 4 services, cut latency 40%."
            color={colorB}
            delay={30}
          />
        </AbsoluteFill>

        {/* stage labels (center spine) */}
        {STAGES.map((label, i) => {
          const reached = rightTopRow >= i || leftTopRow >= i;
          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: 540 - 130,
                top: Y_ROWS[i] - 26,
                width: 260,
                textAlign: "center",
                padding: "10px 0",
                borderRadius: 999,
                background: reached ? `${RB.ink}0a` : "transparent",
                fontFamily: FONTS.mono,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: i === 4 && frame >= R4 ? RB.green : RB.dim,
              }}
            >
              {label}
            </div>
          );
        })}

        {/* lanes */}
        <Lane
          x={LX}
          color={colorA}
          topRow={leftTopRow}
          tokenY={leftY}
          letter="A"
          dim={leftDim}
        />
        <Lane
          x={RX}
          color={colorB}
          topRow={rightTopRow}
          tokenY={rightY}
          letter="B"
          dim={1}
        />

        <Stamp x={LX} y={Y_ROWS[1]} at={REJECT} />

        {/* offer badge + confetti on right */}
        {frame >= R4 && (
          <div
            style={{
              position: "absolute",
              left: RX - 95,
              top: Y_ROWS[4] + 54,
              width: 190,
              textAlign: "center",
              padding: "12px 0",
              borderRadius: 14,
              background: RB.green,
              color: "#fff",
              fontFamily: FONTS.display,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "0.04em",
              transform: `scale(${0.5 + offerPop * 0.5})`,
              boxShadow: `0 12px 30px ${RB.green}66`,
            }}
          >
            OFFER
          </div>
        )}
        <Confetti cx={RX} cy={Y_ROWS[4]} at={R4} />

        {/* payoff line */}
        <AbsoluteFill
          style={{ justifyContent: "flex-end", alignItems: "center", bottom: 90 }}
        >
          <div
            style={{
              opacity: interpolate(payoff, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - payoff) * 36}px)`,
              fontFamily: FONTS.display,
              fontSize: 50,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: RB.ink,
              textAlign: "center",
            }}
          >
            One of them got the <span style={{ color: RB.green }}>offer.</span>
          </div>
        </AbsoluteFill>
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
                fontSize: 96,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: RB.ink,
                marginTop: 36,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              Be candidate
              <br />
              <span style={RB_GRADIENT_TEXT}>B.</span>
            </div>
          </RPop>
          <div
            style={{
              marginTop: 64,
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
