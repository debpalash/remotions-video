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
import { COLORS, FONTS, GRADIENT_TEXT } from "./theme";
import { RB, RB_GRADIENT_TEXT } from "./resubird/theme";
import { Backdrop } from "./ui";
import { LightBackdrop } from "./resubird/ui";

export const PROVEREAL_DURATION = 706; // ~23.5s

// phases [start, end]
const HOOK: [number, number] = [0, 150];
const TURN: [number, number] = [150, 300];
const BRIDGE: [number, number] = [300, 416];
const REVEAL: [number, number] = [416, 588];
const CTA: [number, number] = [588, 706];

const vis = (frame: number, [s, e]: [number, number], fade = 14) =>
  Math.min(
    interpolate(frame, [s, s + fade], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(frame, [e - fade, e], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

const breathe = (l: number) => 1 + Math.sin(l / 32) * 0.007;

const MiniResume: React.FC<{ score?: number; w?: number }> = ({
  score = 98,
  w = 240,
}) => (
  <div
    style={{
      width: w,
      background: RB.card,
      borderRadius: 12,
      border: `1px solid ${RB.ink}14`,
      boxShadow: `0 14px 34px ${RB.ink}12`,
      padding: "20px 20px 22px",
      position: "relative",
    }}
  >
    <div
      style={{
        width: "55%",
        height: 14,
        borderRadius: 4,
        background: "#1f2937",
        marginBottom: 8,
      }}
    />
    <div
      style={{
        width: "35%",
        height: 8,
        borderRadius: 3,
        background: "#9ca3af",
        marginBottom: 16,
      }}
    />
    {[0.9, 0.6, 0.75, 0.5, 0.7].map((x, i) => (
      <div
        key={i}
        style={{
          width: `${x * 100}%`,
          height: 7,
          borderRadius: 3,
          background: "#d6dbe2",
          marginBottom: 9,
        }}
      />
    ))}
    <div
      style={{
        position: "absolute",
        right: 14,
        top: 14,
        fontFamily: FONTS.display,
        fontSize: 30,
        fontWeight: 700,
        color: RB.green,
      }}
    >
      {score}
    </div>
  </div>
);

// ——— Scene 1: Hook (resume auto-generates) ———
const SHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - HOOK[0];
  const score = Math.round(
    interpolate(local, [70, 100], [0, 98], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const scorePop = spring({
    frame: local - 70,
    fps,
    config: { damping: 11, mass: 0.5 },
  });
  const lines = [0.92, 0.6, 0.78, 0.5, 0.84, 0.55, 0.7];
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, HOOK),
        alignItems: "center",
        transform: `scale(${breathe(local)})`,
      }}
    >
      <div style={{ marginTop: 150, width: 920, textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 26,
            letterSpacing: "0.26em",
            color: RB.orange,
            textTransform: "uppercase",
          }}
        >
          ✦ AI · generating resume
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: RB.ink,
            marginTop: 22,
            lineHeight: 1.12,
          }}
        >
          Anyone can write a
          <br />
          <span style={RB_GRADIENT_TEXT}>flawless resume now.</span>
        </div>
      </div>
      <div
        style={{
          marginTop: 70,
          width: 600,
          background: RB.card,
          borderRadius: 16,
          border: `1px solid ${RB.ink}14`,
          boxShadow: `0 30px 70px ${RB.ink}1e`,
          padding: "40px 44px 50px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "55%",
            height: 24,
            borderRadius: 6,
            background: "#1f2937",
            marginBottom: 10,
          }}
        />
        <div
          style={{
            width: "34%",
            height: 12,
            borderRadius: 4,
            background: "#9ca3af",
            marginBottom: 26,
          }}
        />
        {lines.map((x, i) => {
          const grown = interpolate(local, [10 + i * 6, 22 + i * 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                width: `${x * 100 * grown}%`,
                height: 12,
                borderRadius: 4,
                background: "#cbd5e1",
                marginBottom: 16,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            right: 30,
            top: 30,
            opacity: interpolate(scorePop, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${0.6 + scorePop * 0.4})`,
            fontFamily: FONTS.display,
            fontSize: 64,
            fontWeight: 700,
            color: RB.green,
          }}
        >
          {score}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 2: Turn (everyone's perfect) ———
const STurn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TURN[0];
  const cells = Array.from({ length: 9 });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, TURN),
        alignItems: "center",
        transform: `scale(${breathe(local)})`,
      }}
    >
      <div
        style={{
          marginTop: 130,
          width: 920,
          textAlign: "center",
          fontFamily: FONTS.display,
          fontSize: 68,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: RB.ink,
          lineHeight: 1.1,
        }}
      >
        So it proves
        <br />
        <span style={RB_GRADIENT_TEXT}>nothing.</span>
      </div>
      <div
        style={{
          marginTop: 60,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 22,
          width: 820,
        }}
      >
        {cells.map((_, i) => {
          const s = spring({
            frame: local - 14 - i * 5,
            fps,
            config: { damping: 13, mass: 0.5 },
          });
          return (
            <div
              key={i}
              style={{
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `scale(${0.7 + s * 0.3})`,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <MiniResume w={250} />
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: FONTS.body,
          fontSize: 36,
          fontWeight: 600,
          color: RB.dim,
        }}
      >
        Everyone scores 98 now.
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 3: Bridge (gets you in the door) ———
const SBridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - BRIDGE[0];
  const slide = spring({
    frame: local - 20,
    fps,
    config: { damping: 15, mass: 0.8 },
  });
  const stamp = spring({
    frame: local - 54,
    fps,
    config: { damping: 11, mass: 0.5 },
  });
  const but = interpolate(local, [78, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, BRIDGE),
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: RB.ink,
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        It just gets you
        <br />
        <span style={RB_GRADIENT_TEXT}>in the door.</span>
      </div>
      <div style={{ position: "relative", marginTop: 80 }}>
        <div
          style={{
            transform: `translateX(${interpolate(slide, [0, 1], [-260, 0])}px)`,
            opacity: slide,
          }}
        >
          <MiniResume w={300} />
        </div>
        <div
          style={{
            position: "absolute",
            right: -70,
            top: 70,
            opacity: interpolate(stamp, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${0.6 + stamp * 0.4}) rotate(-8deg)`,
            padding: "10px 28px",
            borderRadius: 12,
            border: `3px solid ${RB.green}`,
            color: RB.green,
            fontFamily: FONTS.display,
            fontSize: 34,
            fontWeight: 700,
            background: "rgba(255,255,255,0.6)",
          }}
        >
          APPLIED ✓
        </div>
      </div>
      <div
        style={{
          marginTop: 80,
          opacity: but,
          fontFamily: FONTS.display,
          fontSize: 50,
          fontWeight: 700,
          color: RB.ink,
        }}
      >
        It&apos;s not the <span style={{ color: RB.orange }}>test.</span>
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 4: Reveal (dark Yupcha interview) ———
const SReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - REVEAL[0];
  const qIn = spring({ frame: local - 20, fps, config: { damping: 13, mass: 0.6 } });
  const aIn = spring({ frame: local - 60, fps, config: { damping: 13, mass: 0.6 } });
  const answer = "Honestly, I shipped it too early and it broke. What I'd do now—";
  const typed = answer.slice(
    0,
    Math.round(
      interpolate(local, [70, 150], [0, answer.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  const bars = [
    { k: "Reasoning", v: 4.6, d: 96 },
    { k: "Honesty", v: 4.8, d: 110 },
    { k: "Depth", v: 4.4, d: 124 },
  ];
  const rec = frame % 30 < 18;
  return (
    <AbsoluteFill style={{ opacity: vis(frame, REVEAL) }}>
      {/* live tag */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONTS.mono,
          fontSize: 24,
          letterSpacing: "0.24em",
          color: rec ? COLORS.green : `${COLORS.green}55`,
        }}
      >
        ● LIVE INTERVIEW
      </div>
      <AbsoluteFill style={{ alignItems: "center", top: 150 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          The test is <span style={GRADIENT_TEXT}>live.</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 340 }}
      >
        <div style={{ width: 880 }}>
          <div
            style={{
              opacity: interpolate(qIn, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - qIn) * 30}px)`,
              padding: "24px 34px",
              borderRadius: "22px 22px 22px 6px",
              background: `${COLORS.blue}22`,
              border: `1px solid ${COLORS.blue}55`,
              fontFamily: FONTS.body,
              fontSize: 32,
              color: "#fff",
              maxWidth: 720,
            }}
          >
            Tell me about a time you shipped something wrong.
          </div>
          <div
            style={{
              opacity: interpolate(aIn, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${(1 - aIn) * 30}px)`,
              marginTop: 22,
              marginLeft: "auto",
              padding: "24px 34px",
              borderRadius: "22px 22px 6px 22px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontFamily: FONTS.body,
              fontSize: 32,
              color: "#fff",
              maxWidth: 720,
              minHeight: 90,
            }}
          >
            {typed}
            <span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: COLORS.green }}>
              ▌
            </span>
          </div>
          {/* competency bars */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 18 }}>
            {bars.map((b) => {
              const w = interpolate(local - b.d, [0, 30], [0, b.v / 5], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div key={b.k}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 26,
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      {b.k}
                    </span>
                    <span
                      style={{
                        fontFamily: FONTS.display,
                        fontSize: 26,
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
                      height: 12,
                      borderRadius: 99,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${w * 100}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.green})`,
                        boxShadow: `0 0 16px ${COLORS.green}66`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 36,
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontSize: 28,
              letterSpacing: "0.06em",
              color: COLORS.dim,
              opacity: interpolate(local, [140, 165], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            No AI to hide behind.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— Scene 5: CTA (both brands) ———
const SCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - CTA[0];
  const a = spring({ frame: local, fps, config: { damping: 13, mass: 0.7 } });
  const b = spring({ frame: local - 26, fps, config: { damping: 13, mass: 0.7 } });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, CTA, 12),
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <div
        style={{
          opacity: interpolate(a, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${(1 - a) * 40}px)`,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <div style={{ width: 92, height: 92 }}>
          <Img src={staticFile("resubird/favicon.png")} style={{ width: "100%" }} />
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          <span style={{ color: RB.orange }}>ResuBird</span> gets you in.
        </div>
      </div>
      <div
        style={{
          opacity: interpolate(b, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${(1 - b) * 40}px)`,
          display: "flex",
          alignItems: "center",
          gap: 22,
        }}
      >
        <div style={{ width: 92, height: 88 }}>
          <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          <span style={GRADIENT_TEXT}>Yupcha</span> proves it&apos;s you.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ src: string; from: number; volume?: number }> = ({
  src,
  from,
  volume = 0.5,
}) => (
  <Sequence from={from}>
    <Audio src={staticFile(`audio/sfx/${src}`)} volume={volume} />
  </Sequence>
);

export const ProveReal: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const warmOut = interpolate(frame, [REVEAL[0] - 8, REVEAL[0] + 20], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      {/* instrumental bed (Sky High) — steady + low so it never competes with the voice */}
      <Audio
        src={staticFile("audio/ncs-sky-high.mp3")}
        trimBefore={Math.round(30 * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 24, durationInFrames - 50, durationInFrames - 8],
            [0, 0.07, 0.07, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <Sequence from={6}>
        <Audio src={staticFile("audio/pr1.wav")} volume={1} />
      </Sequence>
      <Sequence from={158}>
        <Audio src={staticFile("audio/pr2.wav")} volume={1} />
      </Sequence>
      <Sequence from={308}>
        <Audio src={staticFile("audio/pr3.wav")} volume={1} />
      </Sequence>
      <Sequence from={424}>
        <Audio src={staticFile("audio/pr4.wav")} volume={1} />
      </Sequence>
      <Sequence from={596}>
        <Audio src={staticFile("audio/pr5.wav")} volume={1} />
      </Sequence>
      {/* SFX */}
      <Sfx src="blip.wav" from={92} volume={0.4} />
      <Sfx src="riser.wav" from={416} volume={0.45} />
      <Sfx src="blip.wav" from={512} volume={0.4} />
      <Sfx src="blip.wav" from={526} volume={0.4} />
      <Sfx src="success.wav" from={596} volume={0.5} />

      {/* backgrounds: warm -> dark */}
      <Backdrop />
      <AbsoluteFill style={{ opacity: warmOut }}>
        <LightBackdrop />
      </AbsoluteFill>

      <SHook />
      <STurn />
      <SBridge />
      <SReveal />
      <SCTA />
    </AbsoluteFill>
  );
};
