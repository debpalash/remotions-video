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
import { LightBackdrop } from "./ui";

export const GHOST_DURATION = 836; // ~27.9s @ 30fps

// machine palette
const MBG = "#0a0e16";
const CYAN = "#34d3ee";
const MRED = "#fb5e6e";
const MGREEN = "#34e3a0";
const MDIM = "rgba(220,235,245,0.55)";

// phase windows [start, end]
const HOOK: [number, number] = [0, 250];
const PARSE: [number, number] = [250, 408];
const KEYS: [number, number] = [408, 574];
const FIX: [number, number] = [574, 706];
const CTA: [number, number] = [706, 836];

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

const MachineBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: MBG, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${CYAN}14 1px, transparent 1px), linear-gradient(90deg, ${CYAN}14 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          backgroundPosition: `0 ${(frame * 0.4) % 60}px`,
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 700,
          left: 90,
          top: 1100,
          background: `radial-gradient(ellipse at center, ${CYAN}1f 0%, transparent 65%)`,
          filter: "blur(40px)",
        }}
      />
      {/* moving scanlines */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, ${CYAN}0a 0px, ${CYAN}0a 1px, transparent 2px, transparent 4px)`,
          opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
};

// grayscale resume document
const ResumeDoc: React.FC<{ scanY?: number; width?: number }> = ({
  scanY,
  width = 460,
}) => {
  const lines = [0.9, 0.55, 0.7, 0.4, 0.8, 0.5, 0.65, 0.45, 0.75];
  return (
    <div
      style={{
        width,
        background: "#f4f6f8",
        borderRadius: 12,
        padding: "34px 34px 44px",
        boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "60%",
          height: 26,
          borderRadius: 6,
          background: "#1f2937",
          marginBottom: 10,
        }}
      />
      <div
        style={{
          width: "38%",
          height: 12,
          borderRadius: 4,
          background: "#9ca3af",
          marginBottom: 26,
        }}
      />
      {lines.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w * 100}%`,
            height: 11,
            borderRadius: 4,
            background: "#cbd5e1",
            marginBottom: 14,
          }}
        />
      ))}
      {scanY !== undefined && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: scanY,
              height: 3,
              background: CYAN,
              boxShadow: `0 0 18px 3px ${CYAN}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: scanY,
              background: `linear-gradient(${CYAN}1c, transparent)`,
            }}
          />
        </>
      )}
    </div>
  );
};

// ——— Scene 1: Hook (two headline beats) ———
const SHook: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - HOOK[0];
  const scanY = interpolate(local, [24, 210], [0, 360], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // beat 1: "It's not your experience." -> beat 2: "A robot reads it first."
  const h1 = Math.min(
    interpolate(local, [8, 28], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    interpolate(local, [118, 138], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const h2 = interpolate(local, [140, 162], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, HOOK),
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          marginTop: 150,
          width: 960,
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 26,
            letterSpacing: "0.3em",
            color: CYAN,
            textTransform: "uppercase",
          }}
        >
          ● Analyzing applicant
        </div>
        <div style={{ position: "relative", height: 170, marginTop: 22 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              fontFamily: FONTS.display,
              fontSize: 62,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#fff",
              lineHeight: 1.16,
              opacity: h1,
            }}
          >
            Not hearing back?
            <br />
            It&apos;s not your <span style={{ color: CYAN }}>experience.</span>
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              fontFamily: FONTS.display,
              fontSize: 62,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#fff",
              lineHeight: 1.16,
              opacity: h2,
            }}
          >
            A robot reads it first.
            <br />
            <span style={{ color: CYAN }}>Before any human.</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 80 }}>
        <ResumeDoc scanY={scanY} />
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 2: Parse ———
const FIELDS = [
  { k: "NAME", v: "Alex Morgan", bad: false, d: 18 },
  { k: "EMAIL", v: "alex.morgan@…", bad: false, d: 34 },
  { k: "SKILLS", v: "React · AWS · Node", bad: false, d: 50 },
  { k: "EXPERIENCE", v: "â–’â–’ unreadable â–’â–’", bad: true, d: 70 },
];

const SParse: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - PARSE[0];
  const lostPop = spring({
    frame: local - 96,
    fps,
    config: { damping: 11, mass: 0.5 },
  });
  return (
    <AbsoluteFill style={{ opacity: vis(frame, PARSE) }}>
      <AbsoluteFill style={{ alignItems: "center", top: 120 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#fff",
            textAlign: "center",
          }}
        >
          It shreds your file
          <br />
          into <span style={{ color: CYAN }}>fields.</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 50,
          top: 130,
        }}
      >
        <div style={{ transform: "scale(0.82)" }}>
          <ResumeDoc width={380} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {FIELDS.map((f) => {
            const s = spring({
              frame: local - f.d,
              fps,
              config: { damping: 13, mass: 0.5 },
            });
            const c = f.bad ? MRED : MGREEN;
            return (
              <div
                key={f.k}
                style={{
                  opacity: interpolate(s, [0, 0.5], [0, 1], {
                    extrapolateRight: "clamp",
                  }),
                  transform: `translateX(${(1 - s) * 50}px)`,
                  width: 420,
                  padding: "16px 22px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${c}55`,
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 19,
                    letterSpacing: "0.16em",
                    color: MDIM,
                  }}
                >
                  {f.k}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 30,
                    fontWeight: 600,
                    color: f.bad ? MRED : "#fff",
                    marginTop: 4,
                  }}
                >
                  {f.bad ? "✗ " : ""}
                  {f.v}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", bottom: 150 }}
      >
        <div
          style={{
            opacity: interpolate(lostPop, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${0.7 + lostPop * 0.3})`,
            padding: "16px 40px",
            borderRadius: 14,
            background: `${MRED}1f`,
            border: `2px solid ${MRED}`,
            fontFamily: FONTS.display,
            fontSize: 40,
            fontWeight: 700,
            color: MRED,
          }}
        >
          31% of your resume: lost
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— Shared match meter ———
const MatchMeter: React.FC<{ pct: number; passed: boolean }> = ({
  pct,
  passed,
}) => {
  const W = 760;
  const passX = W * 0.75;
  const col = passed ? MGREEN : MRED;
  return (
    <div style={{ width: W }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 22,
            letterSpacing: "0.16em",
            color: MDIM,
          }}
        >
          KEYWORD MATCH
        </span>
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 58,
            fontWeight: 700,
            color: col,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {Math.round(pct)}%
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 26,
          borderRadius: 99,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 99,
            background: col,
            boxShadow: `0 0 20px ${col}88`,
          }}
        />
      </div>
      {/* pass line */}
      <div
        style={{
          position: "absolute",
          left: passX,
          top: -6,
          height: 64,
          width: 0,
          borderLeft: `2px dashed ${MDIM}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: passX - 60,
          top: 64,
          fontFamily: FONTS.mono,
          fontSize: 17,
          color: MDIM,
          letterSpacing: "0.1em",
        }}
      >
        PASS · 75%
      </div>
    </div>
  );
};

// ——— Scene 3: Keywords ———
const KW = [
  { w: "React", ok: true, d: 16 },
  { w: "AWS", ok: true, d: 26 },
  { w: "Kubernetes", ok: false, d: 36 },
  { w: "GraphQL", ok: false, d: 46 },
  { w: "CI/CD", ok: false, d: 56 },
];

const SKeys: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - KEYS[0];
  const pct = interpolate(local, [62, 96], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stampPop = spring({
    frame: local - 104,
    fps,
    config: { damping: 10, mass: 0.5 },
  });
  return (
    <AbsoluteFill style={{ opacity: vis(frame, KEYS), alignItems: "center" }}>
      <div
        style={{
          marginTop: 116,
          fontFamily: FONTS.display,
          fontSize: 62,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#fff",
          textAlign: "center",
        }}
      >
        Then it scores your
        <br />
        words vs the <span style={{ color: CYAN }}>job post.</span>
      </div>
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 16 }}>
        {KW.map((k) => {
          const s = spring({
            frame: local - k.d,
            fps,
            config: { damping: 13, mass: 0.5 },
          });
          const c = k.ok ? MGREEN : MRED;
          return (
            <div
              key={k.w}
              style={{
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${(1 - s) * 30}px)`,
                width: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 30px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${c}55`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 34,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {k.w}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 26,
                  fontWeight: 700,
                  color: c,
                }}
              >
                {k.ok ? "✓ matched" : "✗ missing"}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 60, position: "relative" }}>
        <MatchMeter pct={pct} passed={false} />
      </div>
      <div
        style={{
          marginTop: 80,
          opacity: interpolate(stampPop, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${0.7 + stampPop * 0.3}) rotate(-4deg)`,
          padding: "14px 44px",
          borderRadius: 14,
          background: `${MRED}1f`,
          border: `3px solid ${MRED}`,
          fontFamily: FONTS.display,
          fontSize: 44,
          fontWeight: 700,
          color: MRED,
          letterSpacing: "0.04em",
        }}
      >
        FILTERED OUT
      </div>
    </AbsoluteFill>
  );
};

// ——— Scene 4: Fix (warm) ———
const SFix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - FIX[0];
  const pct = interpolate(local, [40, 100], [40, 92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const passed = pct >= 75;
  const fixers = ["Kubernetes", "GraphQL", "CI/CD"];
  return (
    <AbsoluteFill style={{ opacity: vis(frame, FIX), alignItems: "center" }}>
      <div
        style={{
          marginTop: 130,
          fontFamily: FONTS.display,
          fontSize: 66,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: RB.ink,
          textAlign: "center",
        }}
      >
        ResuBird shows you
        <br />
        <span style={RB_GRADIENT_TEXT}>what's missing.</span>
      </div>
      <div style={{ marginTop: 60, display: "flex", gap: 18 }}>
        {fixers.map((w, i) => {
          const s = spring({
            frame: local - 24 - i * 12,
            fps,
            config: { damping: 12, mass: 0.5 },
          });
          return (
            <div
              key={w}
              style={{
                opacity: interpolate(s, [0, 0.5], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `scale(${0.7 + s * 0.3})`,
                padding: "14px 28px",
                borderRadius: 999,
                background: `${RB.green}18`,
                border: `1px solid ${RB.green}66`,
                fontFamily: FONTS.body,
                fontSize: 30,
                fontWeight: 700,
                color: RB.green,
              }}
            >
              + {w}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 80, color: RB.ink }}>
        <FixMeter pct={pct} passed={passed} />
      </div>
    </AbsoluteFill>
  );
};

// warm variant of the meter
const FixMeter: React.FC<{ pct: number; passed: boolean }> = ({
  pct,
  passed,
}) => {
  const W = 760;
  const passX = W * 0.75;
  const col = passed ? RB.green : RB.amber;
  return (
    <div style={{ width: W }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 22,
            letterSpacing: "0.16em",
            color: RB.dim,
          }}
        >
          KEYWORD MATCH
        </span>
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 58,
            fontWeight: 700,
            color: col,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {Math.round(pct)}%
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 26,
          borderRadius: 99,
          background: `${RB.ink}12`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 99,
            background: col,
            boxShadow: `0 0 20px ${col}88`,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: passX,
          top: -6,
          height: 64,
          width: 0,
          borderLeft: `2px dashed ${RB.dim}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: passX - 60,
          top: 64,
          fontFamily: FONTS.mono,
          fontSize: 17,
          color: RB.dim,
          letterSpacing: "0.1em",
        }}
      >
        PASS · 75%
      </div>
      {passed && (
        <div
          style={{
            marginTop: 96,
            textAlign: "center",
            fontFamily: FONTS.display,
            fontSize: 40,
            fontWeight: 700,
            color: RB.green,
          }}
        >
          ✓ Passes the screen
        </div>
      )}
    </div>
  );
};

// ——— Scene 5: CTA ———
const SCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - CTA[0];
  const logo = spring({ frame: local, fps, config: { damping: 12, mass: 0.9 } });
  const btn = spring({
    frame: local - 24,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
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
          width: 170,
          height: 170,
          transform: `scale(${logo})`,
          filter: `drop-shadow(0 16px 32px ${RB.orange}55)`,
        }}
      >
        <Img src={staticFile("resubird/favicon.png")} style={{ width: "100%" }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 88,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: RB.ink,
          marginTop: 36,
          textAlign: "center",
          lineHeight: 1.08,
          opacity: interpolate(logo, [0.4, 1], [0, 1], {
            extrapolateLeft: "clamp",
          }),
        }}
      >
        See what the
        <br />
        <span style={RB_GRADIENT_TEXT}>robot sees.</span>
      </div>
      <div
        style={{
          marginTop: 60,
          opacity: interpolate(btn, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${(1 - btn) * 40}px)`,
          padding: "28px 58px",
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
          Check yours free → resubird.com
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
  );
};

export const Ghosted: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const machineOut = interpolate(frame, [FIX[0] - 8, FIX[0] + 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <Audio
        src={staticFile("audio/ncs-feel-good.mp3")}
        trimBefore={Math.round(18 * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 24, FIX[0], FIX[0] + 30, durationInFrames - 50, durationInFrames - 8],
            [0, 0.07, 0.07, 0.14, 0.14, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <Sequence from={6}>
        <Audio src={staticFile("audio/gh1.wav")} volume={1} />
      </Sequence>
      <Sequence from={142}>
        <Audio src={staticFile("audio/gh2.wav")} volume={1} />
      </Sequence>
      <Sequence from={258}>
        <Audio src={staticFile("audio/gh3.wav")} volume={1} />
      </Sequence>
      <Sequence from={416}>
        <Audio src={staticFile("audio/gh4.wav")} volume={1} />
      </Sequence>
      <Sequence from={582}>
        <Audio src={staticFile("audio/gh5.wav")} volume={1} />
      </Sequence>
      <Sequence from={714}>
        <Audio src={staticFile("audio/gh6.wav")} volume={1} />
      </Sequence>

      <LightBackdrop />
      <AbsoluteFill style={{ opacity: machineOut }}>
        <MachineBackdrop />
      </AbsoluteFill>

      <SHook />
      <SParse />
      <SKeys />
      <SFix />
      <SCTA />
    </AbsoluteFill>
  );
};
