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
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { FONTS } from "../theme";
import { RB, RB_GRADIENT_TEXT } from "./theme";
import { LightBackdrop, RCard, RKicker, RPop, ScoreRing } from "./ui";

const T = 10;
export const SHORT_SCENES = [115, 95, 180, 175];
export const SHORT_DURATION =
  SHORT_SCENES.reduce((a, b) => a + b, 0) - T * (SHORT_SCENES.length - 1);

const headline: React.CSSProperties = {
  fontFamily: FONTS.display,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: RB.ink,
  textAlign: "center",
};

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      padding: "0 70px",
    }}
  >
    {children}
  </AbsoluteFill>
);

// Scene 1: hook
const SHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = [
    { text: "Your resume gets", delay: 2, style: {} },
    { text: "7 seconds.", delay: 12, style: { color: RB.orange } },
    { text: "If the ATS doesn't", delay: 42, style: {} },
    { text: "reject it first.", delay: 52, style: RB_GRADIENT_TEXT },
  ];
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <Center>
        {lines.map((l, i) => {
          const s = spring({
            frame: frame - l.delay,
            fps,
            config: { damping: 13, mass: 0.5 },
          });
          return (
            <div
              key={i}
              style={{
                ...headline,
                fontSize: 104,
                lineHeight: 1.16,
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                filter: `blur(${(1 - Math.min(s * 1.5, 1)) * 10}px)`,
                transform: `translateY(${(1 - s) * 60}px)`,
                ...l.style,
              }}
            >
              {l.text}
            </div>
          );
        })}
      </Center>
    </AbsoluteFill>
  );
};

// Scene 2: brand beat
const SBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.9 } });
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <Center>
        <div
          style={{
            width: 240,
            height: 240,
            transform: `scale(${s})`,
            filter: `drop-shadow(0 18px 36px ${RB.orange}55)`,
          }}
        >
          <Img
            src={staticFile("resubird/favicon.png")}
            style={{ width: "100%" }}
          />
        </div>
        <RPop delay={10}>
          <div style={{ ...headline, fontSize: 120, marginTop: 26 }}>
            <span style={RB_GRADIENT_TEXT}>ResuBird</span>
          </div>
        </RPop>
        <RPop delay={20}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 34,
              color: RB.dim,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginTop: 16,
            }}
          >
            knows why
          </div>
        </RPop>
      </Center>
    </AbsoluteFill>
  );
};

// Scene 3: score + fixes (vertical stack)
const Insight: React.FC<{
  delay: number;
  icon: string;
  text: string;
  color: string;
}> = ({ delay, icon, text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, mass: 0.5 },
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "22px 30px",
        borderRadius: 18,
        background: RB.card,
        border: `1px solid ${color}33`,
        boxShadow: `0 14px 34px ${RB.ink}14`,
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - s) * 50}px)`,
        width: 760,
      }}
    >
      <span style={{ fontSize: 34 }}>{icon}</span>
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: 33,
          fontWeight: 600,
          color: RB.ink,
        }}
      >
        {text}
      </span>
    </div>
  );
};

const SScore: React.FC = () => (
  <AbsoluteFill>
    <LightBackdrop />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 130 }}>
      <RKicker>Resume Analyzer</RKicker>
      <RPop delay={8}>
        <div style={{ ...headline, fontSize: 84, marginTop: 30 }}>
          Your score, <span style={RB_GRADIENT_TEXT}>your fixes</span>
        </div>
      </RPop>
    </AbsoluteFill>
    <Center>
      <RCard delay={16} style={{ padding: 56, marginTop: 60 }}>
        <ScoreRing score={92} delay={26} size={400} />
      </RCard>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          marginTop: 56,
        }}
      >
        <Insight
          delay={56}
          icon="⚠️"
          text="Impact bullets missing numbers"
          color={RB.amber}
        />
        <Insight
          delay={66}
          icon="🔑"
          text="Add keywords: React, AWS"
          color={RB.blue}
        />
        <Insight
          delay={76}
          icon="✅"
          text="Formatting passes every major ATS"
          color={RB.green}
        />
      </div>
    </Center>
  </AbsoluteFill>
);

// Scene 4: CTA
const SCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, mass: 0.9 } });
  const pulse = 1 + Math.sin(frame / 9) * 0.02;
  const urlSpring = spring({
    frame: frame - 26,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  const sweepX = interpolate(frame % 70, [16, 50], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <LightBackdrop />
      <Center>
        <div
          style={{
            width: 170,
            height: 170,
            transform: `scale(${s})`,
            filter: `drop-shadow(0 16px 32px ${RB.orange}55)`,
            marginBottom: 40,
          }}
        >
          <Img
            src={staticFile("resubird/favicon.png")}
            style={{ width: "100%" }}
          />
        </div>
        <RPop delay={6}>
          <div style={{ ...headline, fontSize: 110, lineHeight: 1.1 }}>
            Get past <span style={RB_GRADIENT_TEXT}>the bots.</span>
          </div>
        </RPop>
        <div
          style={{
            marginTop: 70,
            opacity: interpolate(urlSpring, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${(1 - urlSpring) * 40}px) scale(${pulse})`,
            padding: "30px 64px",
            borderRadius: 999,
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: "#fff",
            background: `linear-gradient(100deg, ${RB.orange}, #ea580c)`,
            boxShadow: `0 22px 50px ${RB.orange}66`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span style={{ position: "relative", zIndex: 1 }}>
            Analyze free → resubird.com
          </span>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${sweepX - 14}%, rgba(255,255,255,0.35) ${sweepX}%, transparent ${sweepX + 14}%)`,
            }}
          />
        </div>
      </Center>
    </AbsoluteFill>
  );
};

const VO_CUES = [
  { src: "audio/svo1.wav", from: 10 },
  { src: "audio/svo2.wav", from: 215 },
  { src: "audio/svo3.wav", from: 420 },
];

export const ResubirdShort: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const timing = linearTiming({ durationInFrames: T });
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <Audio
        src={staticFile("audio/ncs-sky-high.mp3")}
        trimBefore={Math.round(52.5 * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, durationInFrames - 55, durationInFrames - 8],
            [0, 0.12, 0.12, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {VO_CUES.map((cue) => (
        <Sequence key={cue.src} from={cue.from}>
          <Audio src={staticFile(cue.src)} volume={1} />
        </Sequence>
      ))}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SHORT_SCENES[0]}>
          <SHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SHORT_SCENES[1]}>
          <SBrand />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={SHORT_SCENES[2]}>
          <SScore />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SHORT_SCENES[3]}>
          <SCTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
