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
import { Backdrop } from "./ui";

export const SCREENS_DURATION = 780; // ~26s

// phases [start, end]
const HOOK: [number, number] = [0, 150];
const PROBLEM: [number, number] = [150, 312];
const REVEAL: [number, number] = [312, 486];
const RANK: [number, number] = [486, 648];
const CTA: [number, number] = [648, 780];

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

// recruiter console HUD — spans the machine phases, status per phase
const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const status =
    frame < PROBLEM[0]
      ? "INTAKE · 200 APPLICANTS"
      : frame < REVEAL[0]
        ? "MANUAL REVIEW · TOO SLOW"
        : frame < RANK[0]
          ? "INTERVIEWING 200 CANDIDATES"
          : "RANKING RESULTS";
  const o = Math.min(
    interpolate(frame, [4, 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(frame, [CTA[0] - 10, CTA[0] + 8], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const progress = interpolate(frame, [REVEAL[0], RANK[0]], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rec = frame % 30 < 18;
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 72,
          background: "rgba(4,8,22,0.85)",
          borderBottom: `1px solid ${COLORS.blue}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          fontFamily: FONTS.mono,
          fontSize: 22,
          letterSpacing: "0.16em",
          color: COLORS.blue,
        }}
      >
        <span>◉ RECRUITER CONSOLE</span>
        <span style={{ color: COLORS.dim }}>● OVERNIGHT RUN</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 76,
          background: "rgba(4,8,22,0.85)",
          borderTop: `1px solid ${COLORS.blue}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          fontFamily: FONTS.mono,
          fontSize: 22,
          letterSpacing: "0.14em",
          color: COLORS.dim,
        }}
      >
        <span style={{ color: COLORS.green }}>&gt; {status}</span>
        <span style={{ color: rec ? COLORS.green : `${COLORS.green}44` }}>
          ● LIVE
        </span>
      </div>
      {/* bottom progress hairline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 4,
          width: `${progress}%`,
          background: COLORS.green,
          boxShadow: `0 0 12px ${COLORS.green}`,
        }}
      />
    </AbsoluteFill>
  );
};

// grid of N candidate dots; `lit` fraction lit green, plus optional highlightIdx
const DotGrid: React.FC<{
  cols: number;
  rows: number;
  litFrac: number;
  highlight?: number;
  size?: number;
  gap?: number;
}> = ({ cols, rows, litFrac, highlight, size = 26, gap = 10 }) => {
  const n = cols * rows;
  const litCount = Math.round(litFrac * n);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${size}px)`,
        gap,
      }}
    >
      {Array.from({ length: n }).map((_, i) => {
        const lit = i < litCount;
        const isHi = highlight === i;
        return (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: 6,
              background: isHi
                ? COLORS.yellow
                : lit
                  ? COLORS.green
                  : "rgba(255,255,255,0.09)",
              boxShadow: isHi
                ? `0 0 16px ${COLORS.yellow}`
                : lit
                  ? `0 0 10px ${COLORS.green}66`
                  : "none",
              border: lit || isHi ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
          />
        );
      })}
    </div>
  );
};

// ——— Scene 1: Hook ———
const SHook: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - HOOK[0];
  const big = interpolate(local, [10, 40], [0, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flood = interpolate(local, [16, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const youIn = interpolate(local, [86, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, HOOK),
        alignItems: "center",
        transform: `scale(${breathe(local)})`,
      }}
    >
      <div
        style={{
          marginTop: 210,
          fontFamily: FONTS.display,
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "#fff",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(big)}
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 40,
          fontWeight: 600,
          color: COLORS.dim,
          marginTop: 6,
        }}
      >
        applied for one role.
      </div>
      <div style={{ marginTop: 56, opacity: flood }}>
        <DotGrid cols={20} rows={10} litFrac={0} size={26} gap={10} />
      </div>
      <div
        style={{
          marginTop: 50,
          opacity: youIn,
          fontFamily: FONTS.display,
          fontSize: 56,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        You can interview <span style={{ color: COLORS.red }}>ten.</span>
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 2: Problem ———
const SProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - PROBLEM[0];
  const rows = [
    "Reviewed",
    "Reviewed",
    "Reviewed",
    "— skipped —",
    "— skipped —",
    "★ best fit — never opened",
    "— skipped —",
    "— skipped —",
  ];
  const reveal = spring({
    frame: local - 70,
    fps,
    config: { damping: 12, mass: 0.6 },
  });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, PROBLEM),
        alignItems: "center",
        transform: `scale(${breathe(local)})`,
      }}
    >
      <div
        style={{
          marginTop: 140,
          width: 920,
          textAlign: "center",
          fontFamily: FONTS.display,
          fontSize: 60,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#fff",
          lineHeight: 1.12,
        }}
      >
        So you skim,
        <br />
        and <span style={GRADIENT_TEXT}>guess.</span>
      </div>
      <div
        style={{
          marginTop: 56,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: 820,
        }}
      >
        {rows.map((r, i) => {
          const s = spring({
            frame: local - 14 - i * 5,
            fps,
            config: { damping: 13, mass: 0.5 },
          });
          const isBest = r.startsWith("★");
          const isSkip = r.startsWith("—");
          return (
            <div
              key={i}
              style={{
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateX(${(1 - s) * 40}px)`,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "16px 26px",
                borderRadius: 14,
                background: isBest
                  ? `${COLORS.yellow}1a`
                  : "rgba(255,255,255,0.04)",
                border: isBest
                  ? `1px solid ${COLORS.yellow}77`
                  : "1px solid rgba(255,255,255,0.08)",
                boxShadow:
                  isBest && reveal > 0.2 ? `0 0 30px ${COLORS.yellow}44` : "none",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 99,
                  background: isBest
                    ? `${COLORS.yellow}33`
                    : "rgba(255,255,255,0.08)",
                  border: `1px solid ${isBest ? COLORS.yellow : "rgba(255,255,255,0.16)"}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 28,
                  fontWeight: 600,
                  color: isBest
                    ? COLORS.yellow
                    : isSkip
                      ? COLORS.faint
                      : "#fff",
                }}
              >
                {r}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 3: Reveal ———
const SReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - REVEAL[0];
  const litFrac = interpolate(local, [40, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const count = Math.round(litFrac * 200);
  return (
    <AbsoluteFill style={{ opacity: vis(frame, REVEAL), alignItems: "center" }}>
      <div
        style={{
          marginTop: 130,
          width: 940,
          textAlign: "center",
          fontFamily: FONTS.display,
          fontSize: 60,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#fff",
          lineHeight: 1.12,
        }}
      >
        Yupcha interviews
        <br />
        <span style={GRADIENT_TEXT}>all 200.</span> Tonight.
      </div>
      <div style={{ marginTop: 70 }}>
        <DotGrid cols={20} rows={10} litFrac={litFrac} size={28} gap={11} />
      </div>
      <div
        style={{
          marginTop: 50,
          fontFamily: FONTS.mono,
          fontSize: 40,
          fontWeight: 600,
          color: COLORS.green,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count} / 200 interviewed
      </div>
      <div
        style={{
          marginTop: 14,
          fontFamily: FONTS.body,
          fontSize: 32,
          color: COLORS.dim,
        }}
      >
        🌙 while you sleep
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 4: Rank ———
const RANKED = [
  { n: "Candidate 147", s: 4.8, d: 20 },
  { n: "Candidate 032", s: 4.7, d: 32 },
  { n: "Candidate 191", s: 4.6, d: 44 },
  { n: "Candidate 088", s: 4.5, d: 56 },
  { n: "Candidate 015", s: 4.4, d: 68 },
];

const SRank: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - RANK[0];
  return (
    <AbsoluteFill style={{ opacity: vis(frame, RANK), alignItems: "center" }}>
      <div
        style={{
          marginTop: 140,
          fontFamily: FONTS.display,
          fontSize: 62,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#fff",
          textAlign: "center",
        }}
      >
        Ranked by <span style={GRADIENT_TEXT}>morning.</span>
      </div>
      <div
        style={{
          marginTop: 60,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: 840,
        }}
      >
        {RANKED.map((c, i) => {
          const s = spring({
            frame: local - c.d,
            fps,
            config: { damping: 13, mass: 0.5 },
          });
          const top = i === 0;
          return (
            <div
              key={c.n}
              style={{
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateX(${(1 - s) * 50}px)`,
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "20px 30px",
                borderRadius: 16,
                background: top ? `${COLORS.green}18` : "rgba(255,255,255,0.05)",
                border: `1px solid ${top ? COLORS.green : "rgba(255,255,255,0.1)"}`,
                boxShadow: top ? `0 0 30px ${COLORS.green}33` : "none",
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 38,
                  fontWeight: 700,
                  color: top ? COLORS.green : COLORS.dim,
                  width: 50,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  fontFamily: FONTS.body,
                  fontSize: 32,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {c.n}
              </span>
              <span
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 36,
                  fontWeight: 700,
                  color: top ? COLORS.green : COLORS.blue,
                }}
              >
                {c.s.toFixed(1)}★
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 5: CTA ———
const SCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - CTA[0];
  const logo = spring({ frame: local, fps, config: { damping: 12, mass: 0.9 } });
  const btn = spring({ frame: local - 24, fps, config: { damping: 13, mass: 0.6 } });
  const sweepX = interpolate(local % 70, [16, 50], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, CTA, 12),
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: 150,
          height: 142,
          transform: `scale(${logo})`,
          filter: `drop-shadow(0 0 36px ${COLORS.blue}99)`,
        }}
      >
        <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 90,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#fff",
          marginTop: 38,
          textAlign: "center",
          lineHeight: 1.08,
          opacity: interpolate(logo, [0.4, 1], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        Wake up to your
        <br />
        <span style={GRADIENT_TEXT}>top 5.</span>
      </div>
      <div
        style={{
          marginTop: 60,
          opacity: interpolate(btn, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          transform: `translateY(${(1 - btn) * 40}px)`,
          padding: "28px 64px",
          borderRadius: 999,
          fontFamily: FONTS.display,
          fontSize: 46,
          fontWeight: 700,
          color: "#fff",
          background: `linear-gradient(100deg, ${COLORS.blue}, #2f6fe0)`,
          boxShadow: `0 0 60px ${COLORS.blue}88, 0 22px 50px rgba(0,0,0,0.5)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span style={{ position: "relative", zIndex: 1 }}>
          Stop guessing → yupcha.com
        </span>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, transparent ${sweepX - 14}%, rgba(255,255,255,0.3) ${sweepX}%, transparent ${sweepX + 14}%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ src: string; from: number; volume?: number }> = ({
  src,
  from,
  volume = 0.45,
}) => (
  <Sequence from={from}>
    <Audio src={staticFile(`audio/sfx/${src}`)} volume={volume} />
  </Sequence>
);

export const YupchaScreens: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
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
        <Audio src={staticFile("audio/yp1.wav")} volume={1} />
      </Sequence>
      <Sequence from={158}>
        <Audio src={staticFile("audio/yp2.wav")} volume={1} />
      </Sequence>
      <Sequence from={320}>
        <Audio src={staticFile("audio/yp3.wav")} volume={1} />
      </Sequence>
      <Sequence from={494}>
        <Audio src={staticFile("audio/yp4.wav")} volume={1} />
      </Sequence>
      <Sequence from={656}>
        <Audio src={staticFile("audio/yp5.wav")} volume={1} />
      </Sequence>
      {/* SFX */}
      <Sfx src="whoosh.wav" from={150} volume={0.4} />
      <Sfx src="riser.wav" from={350} volume={0.4} />
      <Sfx src="success.wav" from={486} volume={0.5} />
      <Sfx src="blip.wav" from={506} />
      <Sfx src="blip.wav" from={518} />
      <Sfx src="blip.wav" from={530} />

      <Backdrop />
      <SHook />
      <SProblem />
      <SReveal />
      <SRank />
      <SCTA />
      <Hud />
    </AbsoluteFill>
  );
};
