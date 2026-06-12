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
import { Backdrop, Callout, Kicker, Pop } from "./ui";

const T = 12;
export const VT_SCENES = [130, 210, 180, 160, 170];
export const VOICE_TEASER_DURATION =
  VT_SCENES.reduce((a, b) => a + b, 0) - T * (VT_SCENES.length - 1);

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

// Animated voice waveform
const Waveform: React.FC<{
  bars?: number;
  width?: number;
  height?: number;
  delay?: number;
}> = ({ bars = 48, width = 900, height = 170, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, mass: 0.8 },
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: width / bars / 2.2,
        width,
        height,
        justifyContent: "center",
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `scaleY(${s})`,
      }}
    >
      {Array.from({ length: bars }, (_, i) => {
        const env = Math.sin((i / bars) * Math.PI); // taper at edges
        const h =
          height *
          env *
          (0.25 +
            0.75 *
              Math.abs(
                Math.sin(frame / 6 + i * 0.55) * Math.sin(frame / 17 + i * 0.21),
              ));
        return (
          <div
            key={i}
            style={{
              width: width / bars / 1.9,
              height: Math.max(8, h),
              borderRadius: 99,
              background: `linear-gradient(180deg, ${COLORS.blue}, ${COLORS.green})`,
              boxShadow: `0 0 14px ${COLORS.blue}55`,
            }}
          />
        );
      })}
    </div>
  );
};

// ————— Scene 1: Hook —————
const VHook: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Center>
      <Kicker>Yupcha Voice</Kicker>
      <div style={{ marginTop: 60 }}>
        <Waveform delay={8} />
      </div>
      <Pop delay={20}>
        <div style={{ ...headline, fontSize: 84, marginTop: 60 }}>
          Say hello to your <span style={GRADIENT_TEXT}>next interviewer</span>
        </div>
      </Pop>
    </Center>
  </AbsoluteFill>
);

// ————— Scene 2: Languages —————
const GREETINGS = [
  "नमस्ते",
  "Hello",
  "வணக்கம்",
  "Hola",
  "你好",
  "مرحبا",
  "Olá",
  "Bonjour",
  "こんにちは",
  "안녕하세요",
  "Здравствуйте",
  "নমস্কার",
];

const VLanguages: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bigIn = spring({
    frame: frame - 150,
    fps,
    config: { damping: 14, mass: 0.7 },
  });
  return (
    <AbsoluteFill>
      <Backdrop hue="green" />
      {/* floating greetings */}
      {GREETINGS.map((g, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const s = spring({
          frame: frame - i * 6,
          fps,
          config: { damping: 13, mass: 0.6 },
        });
        const drift = Math.sin(frame / 28 + i) * 8;
        const dimAfter = frame > 150 ? 0.22 : 0.85;
        return (
          <div
            key={g}
            style={{
              position: "absolute",
              left: 180 + col * 420,
              top: 170 + row * 280 + drift,
              fontFamily: FONTS.display,
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.white,
              opacity:
                interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }) * dimAfter,
              transform: `scale(${0.8 + s * 0.2})`,
              textShadow: `0 0 30px ${COLORS.blue}44`,
            }}
          >
            {g}
          </div>
        );
      })}
      {/* subtitle cards while she speaks Hindi / Spanish */}
      <Sequence from={14}>
        <SubtitleCard
          label="हिंदी · Hindi"
          text="मैं आपका इंटरव्यू हिंदी में ले सकती हूँ।"
          out={96}
        />
      </Sequence>
      <Sequence from={108}>
        <SubtitleCard label="Español" text="O en español, si lo prefieres." out={70} />
      </Sequence>
      {/* the claim lands */}
      <Center>
        <div
          style={{
            ...headline,
            fontSize: 150,
            opacity: interpolate(bigIn, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${0.85 + bigIn * 0.15})`,
            ...GRADIENT_TEXT,
            textShadow: "none",
          }}
        >
          646 languages.
        </div>
      </Center>
    </AbsoluteFill>
  );
};

const SubtitleCard: React.FC<{ label: string; text: string; out: number }> = ({
  label,
  text,
  out,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const o = Math.min(
    interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [out - 14, out], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 110 }}
    >
      <div
        style={{
          opacity: o,
          transform: `translateY(${(1 - s) * 40}px)`,
          padding: "24px 44px",
          borderRadius: 20,
          background: "linear-gradient(160deg, rgba(22,33,66,0.92), rgba(10,17,38,0.88))",
          border: `1px solid ${COLORS.green}50`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.55)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 20,
            color: COLORS.green,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          ● {label}
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 34,
            fontWeight: 600,
            color: COLORS.white,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ————— Scene 3: Real-time —————
const VRealtime: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const aIn = spring({ frame: frame - 24, fps, config: { damping: 13, mass: 0.6 } });
  const bIn = spring({ frame: frame - 70, fps, config: { damping: 13, mass: 0.6 } });
  // candidate answer types on
  const answer = "I'd shard by tenant, then cache the hot path…";
  const typed = answer.slice(
    0,
    Math.round(
      interpolate(frame, [80, 150], [0, answer.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
        <Kicker>Real-Time</Kicker>
        <Pop delay={8}>
          <div style={{ ...headline, fontSize: 76, marginTop: 24 }}>
            A real conversation, <span style={GRADIENT_TEXT}>not a form</span>
          </div>
        </Pop>
      </AbsoluteFill>
      <Center>
        <div style={{ width: 1150, marginTop: 130 }}>
          <div
            style={{
              opacity: interpolate(aIn, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - aIn) * 40}px)`,
              padding: "26px 38px",
              borderRadius: "24px 24px 24px 6px",
              background: `${COLORS.blue}22`,
              border: `1px solid ${COLORS.blue}55`,
              fontFamily: FONTS.body,
              fontSize: 33,
              color: COLORS.white,
              maxWidth: 780,
            }}
          >
            How would you scale this to ten million users?
          </div>
          <div
            style={{
              opacity: interpolate(bIn, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - bIn) * 40}px)`,
              marginTop: 30,
              marginLeft: "auto",
              padding: "26px 38px",
              borderRadius: "24px 24px 6px 24px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontFamily: FONTS.body,
              fontSize: 33,
              color: COLORS.white,
              maxWidth: 780,
              minHeight: 100,
            }}
          >
            {typed}
            <span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>▌</span>
          </div>
        </div>
      </Center>
      <Callout
        delay={56}
        icon="⚡"
        title="Follow-ups in under 2s"
        sub="Listens, thinks, asks — live"
        style={{ left: 110, bottom: 110 }}
        accent={COLORS.green}
      />
      <Callout
        delay={96}
        icon="📊"
        title="Scored as you speak"
        sub="Competency signal per answer"
        style={{ right: 110, bottom: 110 }}
      />
    </AbsoluteFill>
  );
};

// ————— Scene 4: Integrity —————
const CHECKS = [
  { label: "Voice match", value: "99.2%", delay: 30 },
  { label: "Synthetic audio", value: "None detected", delay: 44 },
  { label: "Speaker changes", value: "0", delay: 58 },
];

const VIntegrity: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop hue="green" />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker>Voice Integrity</Kicker>
        <Pop delay={8}>
          <div style={{ ...headline, fontSize: 78, marginTop: 26 }}>
            It knows who's <span style={GRADIENT_TEXT}>really talking</span>
          </div>
        </Pop>
      </AbsoluteFill>
      <Center>
        <div
          style={{
            marginTop: 140,
            width: 880,
            padding: "20px 56px",
            borderRadius: 28,
            background:
              "linear-gradient(160deg, rgba(22,33,66,0.9), rgba(10,17,38,0.85))",
            border: `1px solid ${COLORS.green}40`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 30px 80px rgba(0,0,0,0.55)`,
          }}
        >
          {CHECKS.map((c) => {
            const s = spring({
              frame: frame - c.delay,
              fps,
              config: { damping: 13, mass: 0.5 },
            });
            return (
              <div
                key={c.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "26px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  opacity: interpolate(s, [0, 0.5], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateX(${(1 - s) * 50}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 33,
                    fontWeight: 600,
                    color: COLORS.white,
                  }}
                >
                  {c.label}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 33,
                    fontWeight: 700,
                    color: COLORS.green,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  {c.value}
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 99,
                      background: `${COLORS.green}26`,
                      border: `1px solid ${COLORS.green}66`,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20,
                    }}
                  >
                    ✓
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ————— Scene 5: CTA —————
const VCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, mass: 1 } });
  const subIn = spring({
    frame: frame - 30,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Center>
        <div
          style={{
            width: 130,
            height: 123,
            transform: `scale(${s})`,
            filter: `drop-shadow(0 0 36px ${COLORS.blue}99)`,
            marginBottom: 30,
          }}
        >
          <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
        </div>
        <Pop delay={6}>
          <div style={{ ...headline, fontSize: 130 }}>
            Yupcha <span style={GRADIENT_TEXT}>Voice</span>
          </div>
        </Pop>
        <div style={{ marginTop: 50 }}>
          <Waveform delay={18} width={620} height={90} bars={36} />
        </div>
        <div
          style={{
            marginTop: 50,
            opacity: interpolate(subIn, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${(1 - subIn) * 30}px)`,
            fontFamily: FONTS.mono,
            fontSize: 34,
            color: COLORS.dim,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
          }}
        >
          Coming soon · yupcha.com
        </div>
      </Center>
    </AbsoluteFill>
  );
};

const VO_CUES = [
  { src: "audio/tvo1.wav", from: 14 }, // "Say hello to your next interviewer." (2.01s)
  { src: "audio/tvo2hi.wav", from: 132 }, // Hindi line (2.84s)
  { src: "audio/tvo3es.wav", from: 226 }, // Spanish line (1.89s)
  { src: "audio/tvo4.wav", from: 330 }, // "646 languages. Real time. Live scoring." (3.55s)
  { src: "audio/tvo5.wav", from: 496 }, // "And it always knows who's really talking." (2.21s)
  { src: "audio/tvo6.wav", from: 650 }, // "Yupcha Voice. Coming soon." (1.87s)
];

export const VoiceTeaser: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const timing = linearTiming({ durationInFrames: T });
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      {/* Syn Cole – Feel Good (NCS) — trimmed so the drop (50s) hits the CTA reveal (frame 632) */}
      <Audio
        src={staticFile("audio/ncs-feel-good.mp3")}
        trimBefore={Math.round((50 - 632 / 30) * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 25, 600, 640, durationInFrames - 50, durationInFrames - 8],
            [0, 0.11, 0.11, 0.18, 0.18, 0],
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
        <TransitionSeries.Sequence durationInFrames={VT_SCENES[0]}>
          <VHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={VT_SCENES[1]}>
          <VLanguages />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={VT_SCENES[2]}>
          <VRealtime />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={VT_SCENES[3]}>
          <VIntegrity />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={VT_SCENES[4]}>
          <VCTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
