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
import { COLORS, FONTS, GRADIENT_TEXT } from "./theme";
import { Backdrop, Callout, Kicker, Pop, ScreenFrame } from "./ui";

const T = 12;
export const DD_SCENES = [110, 170, 210, 200, 160, 160];
export const DEEPDIVE_DURATION =
  DD_SCENES.reduce((a, b) => a + b, 0) - T * (DD_SCENES.length - 1);

const headline: React.CSSProperties = {
  fontFamily: FONTS.display,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: COLORS.white,
};

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
    }}
  >
    {children}
  </AbsoluteFill>
);

const Glass: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, children, style }) => {
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
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - s) * 70}px) scale(${0.94 + s * 0.06})`,
        background:
          "linear-gradient(160deg, rgba(22,33,66,0.9), rgba(10,17,38,0.85))",
        border: `1px solid ${COLORS.blue}40`,
        borderRadius: 28,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 30px 80px rgba(0,0,0,0.55)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Scene 1: intro
const DIntro: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Center>
      <Kicker>Feature Deep-Dive</Kicker>
      <Pop delay={10}>
        <div style={{ ...headline, fontSize: 128, marginTop: 34 }}>
          The <span style={GRADIENT_TEXT}>AI Interviewer</span>
        </div>
      </Pop>
      <Pop delay={22}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 32,
            color: COLORS.dim,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 18,
          }}
        >
          How it actually works
        </div>
      </Pop>
    </Center>
  </AbsoluteFill>
);

// Scene 2: setup
const SKILLS = ["Python", "System Design", "SQL", "APIs"];

const DSetup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker>Step 1 · Setup</Kicker>
        <Pop delay={8}>
          <div style={{ ...headline, fontSize: 80, marginTop: 26 }}>
            Pick a role. <span style={GRADIENT_TEXT}>Set the bar.</span>
          </div>
        </Pop>
      </AbsoluteFill>
      <Center>
        <Glass delay={20} style={{ padding: "54px 70px", marginTop: 120 }}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 22,
              color: COLORS.faint,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Role
          </div>
          <div style={{ ...headline, fontSize: 52, marginTop: 10 }}>
            Senior Backend Engineer
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 36 }}>
            {SKILLS.map((sk, i) => {
              const s = spring({
                frame: frame - 38 - i * 7,
                fps,
                config: { damping: 12, mass: 0.5 },
              });
              return (
                <div
                  key={sk}
                  style={{
                    padding: "12px 28px",
                    borderRadius: 999,
                    border: `1px solid ${COLORS.blue}55`,
                    background: `${COLORS.blue}1f`,
                    fontFamily: FONTS.body,
                    fontSize: 27,
                    fontWeight: 600,
                    color: "#a8c8ff",
                    opacity: interpolate(s, [0, 0.5], [0, 1], {
                      extrapolateRight: "clamp",
                    }),
                    transform: `scale(${0.7 + s * 0.3})`,
                  }}
                >
                  {sk}
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginTop: 38,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 22,
                color: COLORS.faint,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Bar
            </span>
            {["Junior", "Mid", "Senior"].map((b) => (
              <span
                key={b}
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  fontFamily: FONTS.body,
                  fontSize: 25,
                  fontWeight: 700,
                  color: b === "Senior" ? COLORS.white : COLORS.faint,
                  background: b === "Senior" ? `${COLORS.green}33` : "transparent",
                  border:
                    b === "Senior"
                      ? `1px solid ${COLORS.green}88`
                      : `1px solid rgba(255,255,255,0.12)`,
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </Glass>
      </Center>
      <Callout
        delay={64}
        icon="⏱️"
        title="2-minute setup"
        sub="Then it runs on its own"
        style={{ right: 120, bottom: 110 }}
        accent={COLORS.green}
      />
    </AbsoluteFill>
  );
};

// Scene 3: the interview
const DInterview: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
      <Kicker>Step 2 · The Interview</Kicker>
      <Pop delay={8}>
        <div style={{ ...headline, fontSize: 76, marginTop: 24 }}>
          Runs whenever <span style={GRADIENT_TEXT}>they're ready</span>
        </div>
      </Pop>
    </AbsoluteFill>
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", bottom: -40 }}
    >
      <ScreenFrame
        src={staticFile("yupcha/interviewer.webp")}
        delay={16}
        tilt={7}
        style={{ width: 1380 }}
      />
    </AbsoluteFill>
    <Callout
      delay={40}
      icon="💬"
      title="Role-specific questions"
      sub="Built from your skills list"
      style={{ left: 90, top: 430 }}
    />
    <Callout
      delay={54}
      icon="🔍"
      title="Digs deeper on weak answers"
      sub="Follow-ups, not a fixed script"
      style={{ right: 90, top: 560 }}
      accent={COLORS.green}
    />
  </AbsoluteFill>
);

// Scene 4: scorecard with competency bars
const COMPETENCIES = [
  { name: "Communication", score: 4.8, delay: 30 },
  { name: "Problem solving", score: 4.6, delay: 42 },
  { name: "Role knowledge", score: 4.4, delay: 54 },
  { name: "Code quality", score: 4.7, delay: 66 },
];

const DScorecard: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop hue="green" />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
        <Kicker>Step 3 · The Scorecard</Kicker>
        <Pop delay={8}>
          <div style={{ ...headline, fontSize: 76, marginTop: 24 }}>
            Scored against <span style={GRADIENT_TEXT}>your bar</span>
          </div>
        </Pop>
      </AbsoluteFill>
      <Center>
        <Glass delay={18} style={{ padding: "50px 70px", marginTop: 110, width: 1080 }}>
          {COMPETENCIES.map((c) => {
            const w = interpolate(frame - c.delay, [0, 40], [0, c.score / 5], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={c.name} style={{ marginBottom: 30 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 29,
                      fontWeight: 600,
                      color: COLORS.white,
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 29,
                      fontWeight: 700,
                      color: COLORS.green,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {(w * 5).toFixed(1)}
                  </span>
                </div>
                <div
                  style={{
                    height: 16,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${w * 100}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.green})`,
                      boxShadow: `0 0 18px ${COLORS.green}66`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </Glass>
      </Center>
      <Callout
        delay={84}
        icon="✅"
        title="Clears the senior bar"
        sub="4.6 average across competencies"
        style={{ right: 120, bottom: 90 }}
        accent={COLORS.green}
      />
    </AbsoluteFill>
  );
};

// Scene 5: team review
const COMMENTS = [
  {
    who: "ER",
    name: "Elena",
    text: "Stellar understanding of architecture. Moving forward.",
    delay: 24,
  },
  {
    who: "DT",
    name: "David",
    text: "Solved the edge cases smoothly. Strong yes.",
    delay: 44,
  },
];

const DTeam: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
      <Kicker>Step 4 · Team Review</Kicker>
      <Pop delay={8}>
        <div style={{ ...headline, fontSize: 80, marginTop: 26 }}>
          Decide <span style={GRADIENT_TEXT}>together</span>
        </div>
      </Pop>
    </AbsoluteFill>
    <Center>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          marginTop: 140,
        }}
      >
        {COMMENTS.map((c) => (
          <Glass
            key={c.who}
            delay={c.delay}
            style={{
              padding: "30px 44px",
              display: "flex",
              alignItems: "center",
              gap: 26,
              width: 980,
            }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 99,
                background: `${COLORS.blue}33`,
                border: `1px solid ${COLORS.blue}66`,
                display: "grid",
                placeItems: "center",
                fontFamily: FONTS.display,
                fontSize: 27,
                fontWeight: 700,
                color: "#a8c8ff",
                flexShrink: 0,
              }}
            >
              {c.who}
            </div>
            <div>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 27,
                  fontWeight: 700,
                  color: COLORS.white,
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 28,
                  color: COLORS.dim,
                  marginTop: 6,
                }}
              >
                {c.text}
              </div>
            </div>
          </Glass>
        ))}
      </div>
    </Center>
  </AbsoluteFill>
);

// Scene 6: CTA
const DCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, mass: 1 } });
  const urlSpring = spring({
    frame: frame - 28,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  const sweepX = interpolate(frame % 75, [18, 55], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Center>
        <div
          style={{
            width: 140,
            height: 133,
            transform: `scale(${s})`,
            filter: `drop-shadow(0 0 36px ${COLORS.blue}99)`,
            marginBottom: 34,
          }}
        >
          <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
        </div>
        <Pop delay={8}>
          <div style={{ ...headline, fontSize: 108, textAlign: "center" }}>
            Your first round, <span style={GRADIENT_TEXT}>handled.</span>
          </div>
        </Pop>
        <div
          style={{
            marginTop: 60,
            opacity: interpolate(urlSpring, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${(1 - urlSpring) * 40}px)`,
            padding: "26px 70px",
            borderRadius: 999,
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: COLORS.white,
            background: `linear-gradient(100deg, ${COLORS.blue}, #2f6fe0)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 70px ${COLORS.blue}88`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span style={{ position: "relative", zIndex: 1 }}>
            Try it free → yupcha.com
          </span>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${sweepX - 14}%, rgba(255,255,255,0.28) ${sweepX}%, transparent ${sweepX + 14}%)`,
            }}
          />
        </div>
      </Center>
    </AbsoluteFill>
  );
};

const VO_CUES = [
  { src: "audio/dvo1.wav", from: 12 },
  { src: "audio/dvo2.wav", from: 116 },
  { src: "audio/dvo3.wav", from: 268 },
  { src: "audio/dvo4.wav", from: 478 },
  { src: "audio/dvo5.wav", from: 660 },
  { src: "audio/dvo6.wav", from: 806 },
];

export const InterviewerDeepDive: React.FC = () => {
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
            [0, 25, durationInFrames - 60, durationInFrames - 10],
            [0, 0.1, 0.1, 0],
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
        <TransitionSeries.Sequence durationInFrames={DD_SCENES[0]}>
          <DIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={DD_SCENES[1]}>
          <DSetup />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={DD_SCENES[2]}>
          <DInterview />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={DD_SCENES[3]}>
          <DScorecard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={DD_SCENES[4]}>
          <DTeam />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={DD_SCENES[5]}>
          <DCTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
