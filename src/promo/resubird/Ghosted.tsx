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

// gentle breathing push for life
const breathe = (local: number) => 1 + Math.sin(local / 32) * 0.007;

const MachineBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: MBG, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${CYAN}16 1px, transparent 1px), linear-gradient(90deg, ${CYAN}16 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          backgroundPosition: `0 ${(frame * 0.5) % 60}px`,
          maskImage:
            "radial-gradient(ellipse 95% 80% at 50% 45%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 95% 80% at 50% 45%, black 35%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 800,
          left: "50%",
          top: 760,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at center, ${CYAN}22 0%, transparent 62%)`,
          filter: "blur(50px)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, ${CYAN}0c 0px, ${CYAN}0c 1px, transparent 2px, transparent 4px)`,
          opacity: 0.6,
        }}
      />
    </AbsoluteFill>
  );
};

// full-bleed HUD: corner brackets + top/bottom status bars
const Bracket: React.FC<{ pos: string }> = ({ pos }) => {
  const base: React.CSSProperties = {
    position: "absolute",
    width: 64,
    height: 64,
    borderColor: CYAN,
    opacity: 0.7,
  };
  const map: Record<string, React.CSSProperties> = {
    tl: { left: 32, top: 96, borderLeft: "3px solid", borderTop: "3px solid" },
    tr: { right: 32, top: 96, borderRight: "3px solid", borderTop: "3px solid" },
    bl: {
      left: 32,
      bottom: 110,
      borderLeft: "3px solid",
      borderBottom: "3px solid",
    },
    br: {
      right: 32,
      bottom: 110,
      borderRight: "3px solid",
      borderBottom: "3px solid",
    },
  };
  return <div style={{ ...base, ...map[pos] }} />;
};

const Hud: React.FC<{ status: string }> = ({ status }) => {
  const frame = useCurrentFrame();
  const machineOut = interpolate(frame, [FIX[0] - 8, FIX[0] + 10], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inO = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  const progress = interpolate(frame, [40, FIX[0] - 20], [4, 99], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rec = frame % 30 < 18;
  return (
    <AbsoluteFill style={{ opacity: machineOut * inO, pointerEvents: "none" }}>
      {/* top bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 72,
          background: "rgba(5,9,16,0.85)",
          borderBottom: `1px solid ${CYAN}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          fontFamily: FONTS.mono,
          fontSize: 22,
          letterSpacing: "0.18em",
          color: CYAN,
        }}
      >
        <span>◉ ATS TERMINAL</span>
        <span style={{ color: MDIM }}>SCAN {Math.round(progress)}%</span>
      </div>
      <Bracket pos="tl" />
      <Bracket pos="tr" />
      <Bracket pos="bl" />
      <Bracket pos="br" />
      {/* bottom bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 76,
          background: "rgba(5,9,16,0.85)",
          borderTop: `1px solid ${CYAN}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          fontFamily: FONTS.mono,
          fontSize: 22,
          letterSpacing: "0.16em",
          color: MDIM,
        }}
      >
        <span style={{ color: CYAN }}>&gt; {status}</span>
        <span style={{ color: rec ? MRED : `${MRED}44` }}>● REC</span>
      </div>
      {/* bottom progress hairline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 4,
          width: `${progress}%`,
          background: CYAN,
          boxShadow: `0 0 12px ${CYAN}`,
        }}
      />
    </AbsoluteFill>
  );
};

// grayscale resume document
const ResumeDoc: React.FC<{ scanY?: number; width?: number }> = ({
  scanY,
  width = 560,
}) => {
  const lines = [0.9, 0.55, 0.7, 0.4, 0.8, 0.5, 0.65, 0.45, 0.75, 0.5, 0.7];
  return (
    <div
      style={{
        width,
        background: "#f4f6f8",
        borderRadius: 14,
        padding: "40px 40px 50px",
        boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${CYAN}1a`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "60%",
          height: 30,
          borderRadius: 6,
          background: "#1f2937",
          marginBottom: 12,
        }}
      />
      <div
        style={{
          width: "38%",
          height: 14,
          borderRadius: 4,
          background: "#9ca3af",
          marginBottom: 30,
        }}
      />
      {lines.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w * 100}%`,
            height: 13,
            borderRadius: 4,
            background: "#cbd5e1",
            marginBottom: 17,
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
              height: 4,
              background: CYAN,
              boxShadow: `0 0 26px 5px ${CYAN}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: scanY,
              background: `linear-gradient(${CYAN}24, transparent)`,
            }}
          />
        </>
      )}
    </div>
  );
};

// chromatic-glitch text
const Glitch: React.FC<{
  children: React.ReactNode;
  on: boolean;
  size: number;
  color: string;
  weight?: number;
}> = ({ children, on, size, color, weight = 700 }) => {
  const frame = useCurrentFrame();
  const j = on ? Math.sin(frame * 3.1) * 3 : 0;
  const jx = on ? (frame % 3) - 1 : 0;
  return (
    <div
      style={{
        fontFamily: FONTS.display,
        fontSize: size,
        fontWeight: weight,
        color,
        transform: `translateX(${jx}px)`,
        textShadow: on
          ? `${2 + j}px 0 ${MRED}aa, ${-2 - j}px 0 ${CYAN}aa`
          : "none",
      }}
    >
      {children}
    </div>
  );
};

// ——— Scene 1: Hook ———
const SHook: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - HOOK[0];
  const scanY = interpolate(local, [24, 210], [0, 520], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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
        transform: `scale(${breathe(local)})`,
      }}
    >
      <div style={{ marginTop: 168, width: 980, textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            letterSpacing: "0.3em",
            color: CYAN,
            textTransform: "uppercase",
          }}
        >
          ● Analyzing applicant
        </div>
        <div style={{ position: "relative", height: 190, marginTop: 26 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              fontFamily: FONTS.display,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#fff",
              lineHeight: 1.14,
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
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#fff",
              lineHeight: 1.14,
              opacity: h2,
            }}
          >
            A robot reads it first.
            <br />
            <span style={{ color: CYAN }}>Before any human.</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 70 }}>
        <ResumeDoc scanY={scanY} width={620} />
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
    <AbsoluteFill
      style={{
        opacity: vis(frame, PARSE),
        transform: `scale(${breathe(local)})`,
      }}
    >
      <AbsoluteFill style={{ alignItems: "center", top: 150 }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 64,
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
          gap: 44,
          top: 110,
        }}
      >
        <ResumeDoc width={420} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
                  width: 470,
                  padding: "18px 26px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${c}66`,
                  boxShadow: f.bad ? `0 0 24px ${MRED}33` : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 20,
                    letterSpacing: "0.16em",
                    color: MDIM,
                  }}
                >
                  {f.k}
                </div>
                {f.bad ? (
                  <Glitch on size={34} color={MRED}>
                    ✗ {f.v}
                  </Glitch>
                ) : (
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 34,
                      fontWeight: 600,
                      color: "#fff",
                      marginTop: 4,
                    }}
                  >
                    {f.v}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", bottom: 180 }}
      >
        <div
          style={{
            opacity: interpolate(lostPop, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `scale(${0.7 + lostPop * 0.3})`,
            padding: "20px 50px",
            borderRadius: 16,
            background: `${MRED}1f`,
            border: `2px solid ${MRED}`,
            fontFamily: FONTS.display,
            fontSize: 46,
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

// shared meter
const Meter: React.FC<{
  pct: number;
  col: string;
  dimCol: string;
  trackBg: string;
}> = ({ pct, col, dimCol, trackBg }) => {
  const frame = useCurrentFrame();
  const W = 900;
  const passX = W * 0.75;
  const shine = (frame % 40) / 40;
  return (
    <div style={{ width: W }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            letterSpacing: "0.16em",
            color: dimCol,
          }}
        >
          KEYWORD MATCH
        </span>
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 72,
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
          height: 32,
          borderRadius: 99,
          background: trackBg,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 99,
            background: col,
            boxShadow: `0 0 22px ${col}88`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${shine * 100 - 18}%, rgba(255,255,255,0.4) ${shine * 100}%, transparent ${shine * 100 + 18}%)`,
            }}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: passX,
          top: -8,
          height: 76,
          width: 0,
          borderLeft: `2px dashed ${dimCol}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: passX - 64,
          top: 76,
          fontFamily: FONTS.mono,
          fontSize: 19,
          color: dimCol,
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
  const shake =
    local >= 104 && local < 120
      ? Math.sin((local - 104) * 2.6) * (1 - (local - 104) / 16) * 14
      : 0;
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, KEYS),
        alignItems: "center",
        transform: `scale(${breathe(local)}) translateX(${shake}px)`,
      }}
    >
      <div
        style={{
          marginTop: 150,
          fontFamily: FONTS.display,
          fontSize: 64,
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
      <div style={{ marginTop: 60, display: "flex", flexDirection: "column", gap: 18 }}>
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
                transform: `translateY(${(1 - s) * 30}px) scale(${0.96 + s * 0.04})`,
                width: 760,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 36px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${c}66`,
                boxShadow: k.ok ? "none" : `0 0 20px ${MRED}22`,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 38,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {k.w}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 28,
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
      <div style={{ marginTop: 70, position: "relative" }}>
        <Meter
          pct={pct}
          col={MRED}
          dimCol={MDIM}
          trackBg="rgba(255,255,255,0.08)"
        />
      </div>
      <div
        style={{
          marginTop: 96,
          opacity: interpolate(stampPop, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${0.7 + stampPop * 0.3}) rotate(-4deg)`,
        }}
      >
        <div
          style={{
            padding: "16px 52px",
            borderRadius: 16,
            background: `${MRED}1f`,
            border: `3px solid ${MRED}`,
          }}
        >
          <Glitch on={stampPop > 0.3} size={50} color={MRED}>
            FILTERED OUT
          </Glitch>
        </div>
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
  const passPop = spring({
    frame: local - 86,
    fps,
    config: { damping: 11, mass: 0.5 },
  });
  const fixers = ["Kubernetes", "GraphQL", "CI/CD"];
  return (
    <AbsoluteFill
      style={{
        opacity: vis(frame, FIX),
        alignItems: "center",
        transform: `scale(${breathe(local)})`,
      }}
    >
      <div
        style={{
          marginTop: 168,
          fontFamily: FONTS.display,
          fontSize: 68,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: RB.ink,
          textAlign: "center",
        }}
      >
        ResuBird shows you
        <br />
        <span style={RB_GRADIENT_TEXT}>what&apos;s missing.</span>
      </div>
      <div style={{ marginTop: 70, display: "flex", gap: 20 }}>
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
                transform: `scale(${0.6 + s * 0.4})`,
                padding: "16px 32px",
                borderRadius: 999,
                background: `${RB.green}18`,
                border: `1px solid ${RB.green}66`,
                fontFamily: FONTS.body,
                fontSize: 34,
                fontWeight: 700,
                color: RB.green,
              }}
            >
              + {w}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 96, position: "relative" }}>
        <Meter
          pct={pct}
          col={passed ? RB.green : RB.amber}
          dimCol={RB.dim}
          trackBg={`${RB.ink}12`}
        />
      </div>
      <div
        style={{
          marginTop: 130,
          opacity: interpolate(passPop, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${0.7 + passPop * 0.3})`,
          fontFamily: FONTS.display,
          fontSize: 52,
          fontWeight: 700,
          color: RB.green,
        }}
      >
        ✓ Passes the screen
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
          width: 190,
          height: 190,
          transform: `scale(${logo})`,
          filter: `drop-shadow(0 16px 32px ${RB.orange}55)`,
        }}
      >
        <Img src={staticFile("resubird/favicon.png")} style={{ width: "100%" }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 100,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: RB.ink,
          marginTop: 40,
          textAlign: "center",
          lineHeight: 1.06,
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
          marginTop: 64,
          opacity: interpolate(btn, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${(1 - btn) * 40}px)`,
          padding: "30px 62px",
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

// status line per phase for the HUD
const StatusBar: React.FC = () => {
  const frame = useCurrentFrame();
  const status =
    frame < PARSE[0]
      ? "READING FILE"
      : frame < KEYS[0]
        ? "PARSING FIELDS"
        : "MATCHING KEYWORDS";
  return <Hud status={status} />;
};

const Sfx: React.FC<{ src: string; from: number; volume?: number }> = ({
  src,
  from,
  volume = 0.6,
}) => (
  <Sequence from={from}>
    <Audio src={staticFile(`audio/sfx/${src}`)} volume={volume} />
  </Sequence>
);

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
            [0, 0.08, 0.08, 0.16, 0.16, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {/* VO */}
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
      {/* SFX */}
      <Sfx src="whoosh.wav" from={22} volume={0.5} />
      <Sfx src="blip.wav" from={268} />
      <Sfx src="blip.wav" from={284} />
      <Sfx src="blip.wav" from={300} />
      <Sfx src="error.wav" from={344} volume={0.55} />
      <Sfx src="blip.wav" from={424} />
      <Sfx src="blip.wav" from={434} />
      <Sfx src="blip.wav" from={444} />
      <Sfx src="blip.wav" from={454} />
      <Sfx src="blip.wav" from={464} />
      <Sfx src="error.wav" from={512} volume={0.6} />
      <Sfx src="riser.wav" from={612} volume={0.5} />
      <Sfx src="success.wav" from={660} volume={0.6} />

      <LightBackdrop />
      <AbsoluteFill style={{ opacity: machineOut }}>
        <MachineBackdrop />
      </AbsoluteFill>

      <SHook />
      <SParse />
      <SKeys />
      <SFix />
      <SCTA />
      <StatusBar />
    </AbsoluteFill>
  );
};
