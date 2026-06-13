import React from "react";
import {
  Img,
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { FONTS } from "./theme";

export const INTERVAL_DURATION = 2680; // ~89s @ 30fps (retro-teaser pacing)

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const OUT = Easing.bezier(0.4, 0, 1, 1);
const WHITE = "#f5f5f7";
const DIM = "#8a8f99";
const CYAN = "#34d3ee";
const RED = "#fb5e6e";
const GREEN = "#34e3a0";
const WARM = "#ffb066";

// phase windows — stretched holds for trailer pacing
const COLD: [number, number] = [0, 270];
const PROBLEM: [number, number] = [270, 560];
const INVERT: [number, number] = [560, 880];
const AGENT: [number, number] = [880, 1150];
const PARALLEL: [number, number] = [1150, 1470];
const CHEAT: [number, number] = [1470, 1780];
const JUDGE: [number, number] = [1780, 2070];
const DAWN: [number, number] = [2070, 2400];
const END: [number, number] = [2400, 2680];

// scene crossfade (through black) — slower for grandeur
const sceneO = (frame: number, [s, e]: [number, number], fade = 30) =>
  Math.min(
    interpolate(frame, [s, s + fade], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }),
    interpolate(frame, [e - fade, e], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: OUT,
    }),
  );

// statement line: blur + scale settle in, fade out
const line = (local: number, inAt: number, holdTo: number) => {
  const o = Math.min(
    interpolate(local, [inAt, inAt + 40], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }),
    interpolate(local, [holdTo, holdTo + 30], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: OUT,
    }),
  );
  const blur = interpolate(local, [inAt, inAt + 40], [9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return { opacity: o, filter: `blur(${blur}px)` };
};

const hash = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const Void: React.FC<{ warm?: number }> = ({ warm = 0 }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 45%, #0e1016 0%, #000 72%)",
      }}
    />
    {warm > 0 && (
      <AbsoluteFill
        style={{
          opacity: warm,
          background:
            "radial-gradient(ellipse 90% 70% at 50% 120%, rgba(255,150,70,0.4) 0%, transparent 60%)",
        }}
      />
    )}
  </AbsoluteFill>
);

// ——— 1: cold open — the clock ———
const SCold: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - COLD[0];
  const n = Math.round(
    interpolate(local, [16, 50], [0, 42], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    }),
  );
  const numO = interpolate(local, [16, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const sub = line(local, 70, 230);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, COLD) }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 300,
            fontWeight: 200,
            color: WHITE,
            letterSpacing: "-0.04em",
            opacity: numO,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {n}
        </div>
        <div
          style={{
            ...sub,
            fontFamily: FONTS.mono,
            fontSize: 28,
            letterSpacing: "0.4em",
            color: DIM,
            marginTop: 30,
          }}
        >
          DAYS TO DECIDE
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 2: problem — gone in ten ———
const SProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - PROBLEM[0];
  const W = 1100;
  const fill = interpolate(local, [30, 120], [0, 10 / 42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const markO = interpolate(local, [110, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const l1 = line(local, 24, 270);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, PROBLEM) }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            ...l1,
            fontFamily: FONTS.body,
            fontSize: 74,
            fontWeight: 250,
            color: WHITE,
            textAlign: "center",
            letterSpacing: "-0.02em",
            marginBottom: 80,
          }}
        >
          Your best candidate
          <br />
          is gone in <span style={{ color: RED, fontWeight: 400 }}>ten.</span>
        </div>
        <div style={{ width: W, position: "relative" }}>
          <div
            style={{
              height: 3,
              background: "rgba(255,255,255,0.12)",
              borderRadius: 99,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: 3,
              width: W * fill,
              background: RED,
              borderRadius: 99,
              boxShadow: `0 0 14px ${RED}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -7,
              left: W * fill - 8,
              width: 16,
              height: 16,
              borderRadius: 99,
              background: RED,
              opacity: markO,
              boxShadow: `0 0 18px ${RED}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              left: W * fill - 90,
              width: 180,
              textAlign: "center",
              fontFamily: FONTS.mono,
              fontSize: 19,
              letterSpacing: "0.14em",
              color: RED,
              opacity: markO,
            }}
          >
            ACCEPTED ELSEWHERE
          </div>
          <div
            style={{
              position: "absolute",
              top: -42,
              left: 0,
              fontFamily: FONTS.mono,
              fontSize: 18,
              color: DIM,
            }}
          >
            DAY 1
          </div>
          <div
            style={{
              position: "absolute",
              top: -42,
              right: 0,
              fontFamily: FONTS.mono,
              fontSize: 18,
              color: DIM,
            }}
          >
            DAY 42
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 3: inversion — 42 days becomes 1 night ———
const SInvert: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - INVERT[0];
  const q = line(local, 16, 110);
  // number collapses 42 -> 1
  const n = interpolate(local, [120, 175], [42, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const collapseO = interpolate(local, [120, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const isNight = local > 172;
  const label = line(local, 178, 320);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, INVERT) }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {local < 118 ? (
          <div
            style={{
              ...q,
              fontFamily: FONTS.body,
              fontSize: 70,
              fontWeight: 250,
              color: WHITE,
              textAlign: "center",
              letterSpacing: "-0.02em",
            }}
          >
            What if the wait
            <br />
            wasn&apos;t a month.
          </div>
        ) : (
          <>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 300,
                fontWeight: 200,
                color: isNight ? CYAN : WHITE,
                letterSpacing: "-0.04em",
                opacity: collapseO,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                textShadow: isNight ? `0 0 60px ${CYAN}66` : "none",
              }}
            >
              {Math.round(n)}
            </div>
            <div
              style={{
                ...label,
                fontFamily: FONTS.mono,
                fontSize: 28,
                letterSpacing: "0.4em",
                color: CYAN,
                marginTop: 30,
              }}
            >
              SINGLE NIGHT
            </div>
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 4: the agent — one light ———
const SAgent: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - AGENT[0];
  const glow = interpolate(local, [10, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const pulse = 0.85 + Math.sin(local / 16) * 0.15;
  const lines = ["It doesn't wait.", "It doesn't sleep.", "It doesn't guess."];
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, AGENT) }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: 26 * glow,
            height: 26 * glow,
            borderRadius: 99,
            background: WHITE,
            boxShadow: `0 0 ${80 * pulse * glow}px ${20 * glow}px ${CYAN}aa`,
            opacity: glow,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 200 }}
      >
        <div style={{ display: "flex", gap: 50 }}>
          {lines.map((t, i) => {
            const s = line(local, 90 + i * 30, 270);
            return (
              <div
                key={t}
                style={{
                  ...s,
                  fontFamily: FONTS.body,
                  fontSize: 40,
                  fontWeight: 300,
                  color: WHITE,
                  letterSpacing: "-0.01em",
                }}
              >
                {t}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 5: parallel — the constellation ———
const SParallel: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - PARALLEL[0];
  const N = 240;
  const l1 = line(local, 50, 300);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, PARALLEL) }}>
      <AbsoluteFill>
        {Array.from({ length: N }).map((_, i) => {
          const x = hash(i + 1) * 1920;
          const y = hash(i + 100) * 1080;
          const appear = interpolate(local, [10 + hash(i) * 70, 40 + hash(i) * 70], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(local / 20 + i));
          const sz = 2 + hash(i + 7) * 4;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: sz,
                height: sz,
                borderRadius: 99,
                background: CYAN,
                opacity: appear * tw * 0.8,
                boxShadow: `0 0 ${sz * 2}px ${CYAN}`,
              }}
            />
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            ...l1,
            fontFamily: FONTS.body,
            fontSize: 64,
            fontWeight: 250,
            color: WHITE,
            textAlign: "center",
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
            textShadow: "0 2px 40px rgba(0,0,0,0.8)",
          }}
        >
          While you sleep,
          <br />
          it&apos;s listening to
          <br />
          <span style={{ color: CYAN }}>all of them. At once.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 6: anti-cheat — it knows ———
const FLAGS = [
  { t: "● SECOND SCREEN DETECTED", d: 70 },
  { t: "● ChatGPT — open in background", d: 100 },
  { t: "● TAB LEFT ×3 · 42s", d: 130 },
];

const SCheat: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - CHEAT[0];
  const reticle = interpolate(local, [14, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const jitter = local > 66 ? Math.sin(local * 2.2) * 2 : 0;
  const l1 = line(local, 175, 300);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, CHEAT) }}>
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", paddingTop: 60 }}
      >
        {/* reticle */}
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: 99,
            border: `2px solid ${RED}`,
            opacity: reticle * 0.8,
            transform: `translateX(${jitter}px) scale(${0.9 + reticle * 0.1})`,
            boxShadow: `0 0 60px ${RED}33, inset 0 0 60px ${RED}22`,
            position: "absolute",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 460,
            height: 1,
            background: `${RED}55`,
            opacity: reticle,
          }}
        />
        <div
          style={{
            position: "absolute",
            height: 460,
            width: 1,
            background: `${RED}55`,
            opacity: reticle,
          }}
        />
        {/* flag readouts */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, 280px)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          {FLAGS.map((f) => {
            const o = interpolate(local, [f.d, f.d + 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            return (
              <div
                key={f.t}
                style={{
                  opacity: o,
                  fontFamily: FONTS.mono,
                  fontSize: 26,
                  letterSpacing: "0.08em",
                  color: RED,
                }}
              >
                {f.t}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 150 }}
      >
        <div
          style={{
            ...l1,
            fontFamily: FONTS.body,
            fontSize: 60,
            fontWeight: 250,
            color: WHITE,
            textAlign: "center",
            letterSpacing: "-0.02em",
          }}
        >
          It knows when the
          <br />
          machine is <span style={{ color: RED }}>helping you.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 7: judgment — the name dissolves ———
const IDENT = ["Name", "Photo", "School", "Age"];

const SJudge: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - JUDGE[0];
  const keepO = interpolate(local, [120, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const l1 = line(local, 165, 290);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, JUDGE) }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {IDENT.map((id, i) => {
          const appear = interpolate(local, [10 + i * 8, 30 + i * 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE,
          });
          const dissolve = interpolate(
            local,
            [70 + i * 10, 110 + i * 10],
            [1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: OUT },
          );
          const drift = interpolate(local, [70 + i * 10, 110 + i * 10], [0, -40], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: OUT,
          });
          return (
            <div
              key={id}
              style={{
                opacity: appear * dissolve,
                transform: `translateY(${drift}px)`,
                filter: `blur(${(1 - dissolve) * 6}px)`,
                fontFamily: FONTS.mono,
                fontSize: 34,
                letterSpacing: "0.12em",
                color: DIM,
              }}
            >
              {id}: ————————
            </div>
          );
        })}
        <div
          style={{
            opacity: keepO,
            transform: `scale(${0.96 + keepO * 0.04})`,
            fontFamily: FONTS.body,
            fontSize: 76,
            fontWeight: 300,
            color: WHITE,
            letterSpacing: "-0.02em",
            marginTop: 10,
          }}
        >
          Only <span style={{ color: GREEN }}>how you think.</span>
        </div>
        <div
          style={{
            ...l1,
            fontFamily: FONTS.body,
            fontSize: 34,
            fontWeight: 300,
            color: DIM,
          }}
        >
          It never hears your name.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 8: daybreak — the answer ———
const TOP = ["Candidate 147", "Candidate 032", "Candidate 191"];

const SDawn: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - DAWN[0];
  const warm = interpolate(local, [40, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const l1 = line(local, 30, 175);
  const l2 = line(local, 195, 340);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, DAWN) }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            ...l1,
            fontFamily: FONTS.body,
            fontSize: 66,
            fontWeight: 250,
            color: WHITE,
            textAlign: "center",
            letterSpacing: "-0.02em",
            position: "absolute",
            top: 150,
          }}
        >
          By the time the sun
          <br />
          finds you — it&apos;s <span style={{ color: WARM }}>done.</span>
        </div>
        {/* ranked answer */}
        <div
          style={{
            opacity: warm,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: 720,
          }}
        >
          {TOP.map((c, i) => {
            const o = interpolate(local, [80 + i * 14, 110 + i * 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            return (
              <div
                key={c}
                style={{
                  opacity: o,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "18px 28px",
                  borderRadius: 14,
                  background:
                    i === 0 ? "rgba(255,176,102,0.14)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${i === 0 ? WARM : "rgba(255,255,255,0.12)"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 30,
                    fontWeight: 600,
                    color: i === 0 ? WARM : DIM,
                    width: 40,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: FONTS.body,
                    fontSize: 28,
                    fontWeight: 400,
                    color: WHITE,
                  }}
                >
                  {c}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 30,
                    fontWeight: 600,
                    color: i === 0 ? WARM : DIM,
                  }}
                >
                  {(4.9 - i * 0.2).toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            ...l2,
            position: "absolute",
            bottom: 230,
            fontFamily: FONTS.body,
            fontSize: 48,
            fontWeight: 300,
            color: WHITE,
            letterSpacing: "-0.02em",
          }}
        >
          You wake up to the answer.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 9: end — the bloom ———
const SEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - END[0];
  const o = interpolate(local, [0, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const gray = interpolate(local, [44, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const scale = interpolate(local, [0, 120], [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const nameO = interpolate(local, [95, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const tagO = interpolate(local, [155, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const end = interpolate(local, [250, 280], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: end,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: 180,
          height: 170,
          opacity: o,
          transform: `scale(${scale})`,
          filter: `grayscale(${gray}) brightness(${1 + gray * 0.4})`,
        }}
      >
        <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 80,
          fontWeight: 500,
          letterSpacing: "-0.025em",
          color: WHITE,
          marginTop: 40,
          opacity: nameO,
        }}
      >
        Yupcha
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "0.26em",
          color: DIM,
          marginTop: 22,
          opacity: tagO,
          textTransform: "uppercase",
        }}
      >
        The work happens while you sleep
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

export const Interval: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Sky High instrumental from the top — it builds and peaks by daybreak/bloom on its own
  const warm = interpolate(frame, [DAWN[0] + 40, DAWN[0] + 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body, background: "#000" }}>
      <Audio
        src={staticFile("audio/ncs-sky-high.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 110, DAWN[0], END[0], durationInFrames - 70, durationInFrames - 10],
            [0, 0.05, 0.05, 0.16, 0.16, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {/* VO */}
      <Sequence from={60}>
        <Audio src={staticFile("audio/iv1.wav")} volume={1} />
      </Sequence>
      <Sequence from={310}>
        <Audio src={staticFile("audio/iv2.wav")} volume={1} />
      </Sequence>
      <Sequence from={610}>
        <Audio src={staticFile("audio/iv3.wav")} volume={1} />
      </Sequence>
      <Sequence from={930}>
        <Audio src={staticFile("audio/iv4.wav")} volume={1} />
      </Sequence>
      <Sequence from={1210}>
        <Audio src={staticFile("audio/iv5.wav")} volume={1} />
      </Sequence>
      <Sequence from={1540}>
        <Audio src={staticFile("audio/iv6.wav")} volume={1} />
      </Sequence>
      <Sequence from={1850}>
        <Audio src={staticFile("audio/iv7.wav")} volume={1} />
      </Sequence>
      <Sequence from={2130}>
        <Audio src={staticFile("audio/iv8.wav")} volume={1} />
      </Sequence>
      <Sequence from={2270}>
        <Audio src={staticFile("audio/iv9.wav")} volume={1} />
      </Sequence>
      <Sequence from={2460}>
        <Audio src={staticFile("audio/iv10.wav")} volume={1} />
      </Sequence>
      {/* SFX */}
      <Sfx src="tick.wav" from={30} volume={0.4} />
      <Sfx src="boom.wav" from={730} volume={0.6} />
      <Sfx src="whoosh.wav" from={1150} volume={0.4} />
      <Sfx src="pulse.wav" from={1490} volume={0.45} />
      <Sfx src="boom.wav" from={2090} volume={0.4} />
      <Sfx src="riser.wav" from={2360} volume={0.4} />
      <Sfx src="success.wav" from={2460} volume={0.45} />

      <Void warm={warm} />
      <AbsoluteFill style={{ transform: "scale(1.2)" }}>
        <SCold />
        <SProblem />
        <SInvert />
        <SAgent />
        <SParallel />
        <SCheat />
        <SJudge />
        <SDawn />
        <SEnd />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
