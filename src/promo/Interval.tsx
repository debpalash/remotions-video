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
} from "remotion";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import { FONTS } from "./theme";

export const INTERVAL_DURATION = 2360; // ~78.7s @ 30fps

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const OUT = Easing.bezier(0.4, 0, 1, 1);
const WHITE = "#f5f5f7";
const DIM = "#9a9fa9";
const CYAN = "#34d3ee";
const RED = "#fb5e6e";
const GREEN = "#34e3a0";
const WARM = "#ffb066";
const BARH = 132; // letterbox bar height -> ~2.4:1

const yf = (n: string) => staticFile(`yupcha/${n}`);

// phase windows
const COLD: [number, number] = [0, 230];
const PROBLEM: [number, number] = [230, 470];
const INVERT: [number, number] = [470, 740];
const AGENT: [number, number] = [740, 980];
const PARALLEL: [number, number] = [980, 1290];
const CHEAT: [number, number] = [1290, 1560];
const JUDGE: [number, number] = [1560, 1820];
const DAWN: [number, number] = [1820, 2120];
const END: [number, number] = [2120, 2360];

const ip = (f: number, a: number[], b: number[], e = EASE) =>
  interpolate(f, a, b, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e,
  });

const sceneO = (frame: number, [s, e]: [number, number], fade = 16) =>
  Math.min(ip(frame, [s, s + fade], [0, 1]), ip(frame, [e - fade, e], [1, 0], OUT));

const line = (local: number, inAt: number, holdTo: number) => {
  const o = Math.min(
    ip(local, [inAt, inAt + 22], [0, 1]),
    ip(local, [holdTo, holdTo + 18], [1, 0], OUT),
  );
  const blur = ip(local, [inAt, inAt + 22], [10, 0]);
  return { opacity: o, filter: `blur(${blur}px)` };
};

const hash = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`;

// ——— global overlays: grain, scanlines, vignette, letterbox ———
const Overlays: React.FC = () => {
  const frame = useCurrentFrame();
  const barIn = ip(frame, [0, 22], [BARH + 20, 0]);
  return (
    <>
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN,
          backgroundPosition: `${(frame * 13) % 220}px ${(frame * 7) % 220}px`,
          opacity: 0.06,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 2px, transparent 4px)",
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, rgba(0,0,0,0.65) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: BARH,
          background: "#000",
          transform: `translateY(${-barIn}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: BARH,
          background: "#000",
          transform: `translateY(${barIn}px)`,
        }}
      />
    </>
  );
};

const Chroma: React.FC<{
  children: React.ReactNode;
  amt: number;
  style?: React.CSSProperties;
}> = ({ children, amt, style }) => (
  <div style={{ ...style, textShadow: `${amt}px 0 ${RED}cc, ${-amt}px 0 ${CYAN}cc` }}>
    {children}
  </div>
);

const Plate: React.FC<{
  children: React.ReactNode;
  zoom: [number, number];
  pan?: [number, number];
  local: number;
  dur: number;
}> = ({ children, zoom, pan = [0, 0], local, dur }) => {
  const z = ip(local, [0, dur], zoom);
  const px = ip(local, [0, dur], [pan[0], pan[1]]);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z}) translateX(${px}px)` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", ...style }}>
    {children}
  </AbsoluteFill>
);

const NARR: React.CSSProperties = {
  fontFamily: FONTS.body,
  fontWeight: 250,
  letterSpacing: "-0.02em",
  color: WHITE,
  textAlign: "center",
  lineHeight: 1.22,
};

// ——— 1: cold open ———
const SCold: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - COLD[0];
  const n = Math.round(ip(local, [14, 44], [0, 42]));
  const numO = ip(local, [14, 40], [0, 1]);
  const ca = 1 + Math.abs(Math.sin(local / 7)) * (local < 50 ? 4 : 1.4);
  const z = ip(local, [0, 230], [1.0, 1.12]);
  const sub = line(local, 56, 200);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, COLD) }}>
      <Center>
        <div style={{ transform: `scale(${z})`, textAlign: "center" }}>
          <Chroma
            amt={ca}
            style={{
              fontFamily: FONTS.body,
              fontSize: 320,
              fontWeight: 200,
              color: WHITE,
              letterSpacing: "-0.04em",
              opacity: numO,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {n}
          </Chroma>
          <div
            style={{
              ...sub,
              fontFamily: FONTS.mono,
              fontSize: 30,
              letterSpacing: "0.42em",
              color: DIM,
              marginTop: 34,
            }}
          >
            DAYS TO DECIDE
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ——— 2: problem — a real face, gone in ten ———
const SProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - PROBLEM[0];
  const W = 1100;
  const fill = ip(local, [40, 130], [0, 10 / 42]);
  const markO = ip(local, [120, 150], [0, 1]);
  const l1 = line(local, 150, 230);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, PROBLEM) }}>
      <Plate local={local} dur={240} zoom={[1.05, 1.18]} pan={[-30, 30]}>
        <Img
          src={yf("candidate2.jpeg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(0.4) brightness(0.5)",
          }}
        />
      </Plate>
      <AbsoluteFill style={{ background: "rgba(2,5,14,0.55)" }} />
      <Center style={{ flexDirection: "column", paddingTop: 80 }}>
        <div style={{ ...l1, ...NARR, fontSize: 80, marginBottom: 70 }}>
          Gone in <span style={{ color: RED, fontWeight: 400 }}>ten.</span>
        </div>
        <div style={{ width: W, position: "relative" }}>
          <div
            style={{ height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 99 }}
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
              boxShadow: `0 0 16px ${RED}`,
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
              boxShadow: `0 0 20px ${RED}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 22,
              left: W * fill - 100,
              width: 200,
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
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ——— 3: inversion — 42 -> 1 with a camera turn ———
const SInvert: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - INVERT[0];
  const q = line(local, 14, 96);
  const n = ip(local, [110, 158], [42, 1]);
  const collapseO = ip(local, [108, 124], [0, 1]);
  const turn = ip(local, [108, 170], [14, 0]);
  const isNight = local > 156;
  const label = line(local, 162, 250);
  const ca = local > 150 && local < 175 ? 6 : 1.4;
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, INVERT) }}>
      <Center>
        {local < 104 ? (
          <div style={{ ...q, ...NARR, fontSize: 74 }}>
            What if the wait
            <br />
            wasn&apos;t a month.
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              transform: `rotate(${turn}deg) scale(${ip(local, [108, 170], [1.3, 1])})`,
            }}
          >
            <Chroma
              amt={ca}
              style={{
                fontFamily: FONTS.body,
                fontSize: 330,
                fontWeight: 200,
                color: isNight ? CYAN : WHITE,
                letterSpacing: "-0.04em",
                opacity: collapseO,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                textShadow: isNight ? `0 0 70px ${CYAN}66` : undefined,
              }}
            >
              {Math.round(n)}
            </Chroma>
            <div
              style={{
                ...label,
                fontFamily: FONTS.mono,
                fontSize: 30,
                letterSpacing: "0.42em",
                color: CYAN,
                marginTop: 30,
              }}
            >
              ONE NIGHT
            </div>
          </div>
        )}
      </Center>
    </AbsoluteFill>
  );
};

// ——— 4: the agent — real Yupcha footage ———
const SAgent: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - AGENT[0];
  const lines = ["It doesn't wait.", "It doesn't sleep.", "It doesn't guess."];
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, AGENT) }}>
      <Plate local={local} dur={240} zoom={[1.12, 1.26]} pan={[20, -30]}>
        <Img
          src={yf("dashboard.webp")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.85) saturate(1.1)",
          }}
        />
      </Plate>
      <AbsoluteFill style={{ background: "rgba(2,5,14,0.55)" }} />
      <Center style={{ flexDirection: "column", gap: 26 }}>
        {lines.map((t, i) => {
          const s = line(local, 36 + i * 30, 220);
          return (
            <div
              key={t}
              style={{ ...s, fontFamily: FONTS.body, fontSize: 56, fontWeight: 300, color: WHITE }}
            >
              {t}
            </div>
          );
        })}
      </Center>
    </AbsoluteFill>
  );
};

// ——— 5: parallel — constellation + real product/face cards ———
const CARDS = [
  { src: "interviewer.webp", x: 250, y: 250, w: 360, d: 30, rot: -5 },
  { src: "dashboard.webp", x: 1320, y: 300, w: 380, d: 50, rot: 5 },
  { src: "candidate_happy.webp", x: 360, y: 720, w: 240, d: 70, rot: 4 },
  { src: "resubird.webp", x: 1300, y: 760, w: 360, d: 90, rot: -4 },
];

const SParallel: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - PARALLEL[0];
  const N = 200;
  const pull = ip(local, [0, 310], [1.18, 0.96]);
  const l1 = line(local, 60, 290);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, PARALLEL) }}>
      <AbsoluteFill style={{ transform: `scale(${pull})` }}>
        {Array.from({ length: N }).map((_, i) => {
          const x = hash(i + 1) * 1920;
          const y = hash(i + 100) * 1080;
          const ap = ip(local, [8 + hash(i) * 60, 36 + hash(i) * 60], [0, 1]);
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(local / 18 + i));
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
                opacity: ap * tw * 0.75,
                boxShadow: `0 0 ${sz * 2}px ${CYAN}`,
              }}
            />
          );
        })}
        {CARDS.map((c) => {
          const ap = ip(local, [c.d, c.d + 26], [0, 1]);
          const drift = Math.sin(local / 30 + c.x) * 8;
          return (
            <div
              key={c.src}
              style={{
                position: "absolute",
                left: c.x,
                top: c.y + drift,
                width: c.w,
                opacity: ap * 0.92,
                transform: `rotate(${c.rot}deg) scale(${0.9 + ap * 0.1})`,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
              }}
            >
              <Img src={yf(c.src)} style={{ width: "100%", display: "block" }} />
            </div>
          );
        })}
      </AbsoluteFill>
      <Center>
        <div style={{ ...l1, ...NARR, fontSize: 62, textShadow: "0 2px 50px rgba(0,0,0,0.9)" }}>
          All of them.
          <br />
          <span style={{ color: CYAN }}>At once.</span>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ——— 6: anti-cheat — scanning a real face ———
const FLAGS = [
  { t: "● SECOND SCREEN DETECTED", d: 60 },
  { t: "● ChatGPT — open in background", d: 92 },
  { t: "● TAB LEFT ×3 · 42s", d: 124 },
];

const SCheat: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - CHEAT[0];
  const reticle = ip(local, [12, 54], [0, 1]);
  const jitter = local > 60 ? Math.sin(local * 2.4) * 3 : 0;
  const z = ip(local, [0, 270], [1.1, 1.22]);
  const ca = local > 56 ? 3 + Math.abs(Math.sin(local / 5)) * 3 : 1;
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, CHEAT) }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `scale(${z}) translateX(${jitter}px)` }}>
          <Img
            src={yf("candidate2.jpeg")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(0.5) brightness(0.55) contrast(1.1)",
            }}
          />
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(20,2,6,0.45)" }} />
      <Center>
        <div
          style={{
            width: 360,
            height: 440,
            border: `2px solid ${RED}`,
            borderRadius: 8,
            opacity: reticle * 0.85,
            transform: `translateX(${jitter}px) scale(${0.92 + reticle * 0.08})`,
            boxShadow: `0 0 60px ${RED}44, inset 0 0 50px ${RED}22`,
            position: "absolute",
          }}
        />
        <div
          style={{ position: "absolute", width: 440, height: 1, background: `${RED}66`, opacity: reticle }}
        />
        <div
          style={{ position: "absolute", height: 520, width: 1, background: `${RED}66`, opacity: reticle }}
        />
      </Center>
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: BARH + 40 }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start", marginBottom: 30 }}
        >
          {FLAGS.map((f) => (
            <div
              key={f.t}
              style={{
                opacity: ip(local, [f.d, f.d + 14], [0, 1]),
                fontFamily: FONTS.mono,
                fontSize: 26,
                letterSpacing: "0.06em",
                color: RED,
              }}
            >
              {f.t}
            </div>
          ))}
        </div>
        <Chroma amt={ca} style={{ ...NARR, fontSize: 62 }}>
          It knows when the
          <br />
          machine is <span style={{ color: RED, fontWeight: 400 }}>helping you.</span>
        </Chroma>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 7: judgment — identity dissolves off a real face ———
const IDENT = [
  { k: "Name", x: -360, y: -150 },
  { k: "Photo", x: 360, y: -90 },
  { k: "School", x: -380, y: 120 },
  { k: "Age", x: 360, y: 170 },
];

const SJudge: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - JUDGE[0];
  const faceO = ip(local, [10, 50], [0, 1]);
  const desat = ip(local, [70, 160], [0, 1]);
  const keepO = ip(local, [150, 195], [0, 1]);
  const l1 = line(local, 180, 250);
  const z = ip(local, [0, 260], [1.05, 1.14]);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, JUDGE) }}>
      <Center>
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: 99,
            overflow: "hidden",
            opacity: faceO,
            transform: `scale(${z})`,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 0 80px rgba(0,0,0,0.7)",
          }}
        >
          <Img
            src={yf("candidate_happy.webp")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: `grayscale(${desat}) brightness(0.9)`,
            }}
          />
        </div>
      </Center>
      {IDENT.map((id, i) => {
        const ap = ip(local, [20 + i * 8, 44 + i * 8], [0, 1]);
        const diss = ip(local, [70 + i * 10, 120 + i * 10], [1, 0], OUT);
        const fly = ip(local, [70 + i * 10, 120 + i * 10], [0, id.y < 0 ? -60 : 60]);
        return (
          <Center key={id.k}>
            <div
              style={{
                position: "absolute",
                transform: `translate(${id.x}px, ${id.y + fly}px)`,
                opacity: ap * diss,
                filter: `blur(${(1 - diss) * 6}px)`,
                fontFamily: FONTS.mono,
                fontSize: 30,
                letterSpacing: "0.1em",
                color: DIM,
              }}
            >
              {id.k}: ——————
            </div>
          </Center>
        );
      })}
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: BARH + 60 }}
      >
        <div
          style={{
            opacity: keepO,
            transform: `scale(${0.96 + keepO * 0.04})`,
            fontFamily: FONTS.body,
            fontSize: 72,
            fontWeight: 300,
            color: WHITE,
            letterSpacing: "-0.02em",
          }}
        >
          Only <span style={{ color: GREEN }}>how you think.</span>
        </div>
        <div
          style={{ ...l1, fontFamily: FONTS.body, fontSize: 32, fontWeight: 300, color: DIM, marginTop: 18 }}
        >
          It never hears your name.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ——— 8: daybreak ———
const TOP = ["Candidate 147", "Candidate 032", "Candidate 191"];

const SDawn: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - DAWN[0];
  const warm = ip(local, [40, 150], [0, 1]);
  const z = ip(local, [0, 300], [1.15, 1.02]);
  const l1 = line(local, 16, 150);
  const l2 = line(local, 170, 280);
  return (
    <AbsoluteFill style={{ opacity: sceneO(frame, DAWN) }}>
      <Plate local={local} dur={300} zoom={[1.15, 1.02]}>
        <Img
          src={yf("nature_bg.webp")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.4) saturate(1.1)",
            opacity: 0.5 + warm * 0.4,
          }}
        />
      </Plate>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(2,4,12,0.7), rgba(40,20,5,${0.2 + warm * 0.3}))`,
        }}
      />
      <Center style={{ flexDirection: "column" }}>
        <div
          style={{
            ...l1,
            ...NARR,
            fontSize: 66,
            position: "absolute",
            top: BARH + 60,
            transform: `scale(${z * 0.92 + 0.08})`,
          }}
        >
          By the time the sun
          <br />
          finds you — it&apos;s <span style={{ color: WARM, fontWeight: 400 }}>done.</span>
        </div>
        <div style={{ opacity: warm, display: "flex", flexDirection: "column", gap: 14, width: 700 }}>
          {TOP.map((c, i) => {
            const o = ip(local, [80 + i * 14, 110 + i * 14], [0, 1]);
            return (
              <div
                key={c}
                style={{
                  opacity: o,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "16px 26px",
                  borderRadius: 12,
                  background: i === 0 ? "rgba(255,176,102,0.16)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${i === 0 ? WARM : "rgba(255,255,255,0.14)"}`,
                  backdropFilter: "blur(6px)",
                }}
              >
                <span
                  style={{ fontFamily: FONTS.body, fontSize: 28, fontWeight: 600, color: i === 0 ? WARM : DIM, width: 36 }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontFamily: FONTS.body, fontSize: 27, color: WHITE }}>{c}</span>
                <span
                  style={{ fontFamily: FONTS.body, fontSize: 28, fontWeight: 600, color: i === 0 ? WARM : DIM }}
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
            fontFamily: FONTS.body,
            fontSize: 46,
            fontWeight: 300,
            color: WHITE,
            position: "absolute",
            bottom: BARH + 70,
            letterSpacing: "-0.02em",
          }}
        >
          You wake up to the answer.
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ——— 9: bloom ———
const SEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - END[0];
  const o = ip(local, [0, 30], [0, 1]);
  const gray = ip(local, [30, 96], [1, 0]);
  const scale = ip(local, [0, 110], [0.9, 1]);
  const nameO = ip(local, [70, 104], [0, 1]);
  const tagO = ip(local, [120, 158], [0, 1]);
  const end = ip(local, [200, 235], [1, 0]);
  return (
    <AbsoluteFill
      style={{ opacity: end, justifyContent: "center", alignItems: "center", flexDirection: "column" }}
    >
      <div
        style={{
          width: 190,
          height: 180,
          opacity: o,
          transform: `scale(${scale})`,
          filter: `grayscale(${gray}) brightness(${1 + gray * 0.4})`,
        }}
      >
        <Img src={yf("logo.svg")} style={{ width: "100%" }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 86,
          fontWeight: 500,
          letterSpacing: "-0.025em",
          color: WHITE,
          marginTop: 42,
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
          letterSpacing: "0.28em",
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
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body, background: "#000" }}>
      <Audio
        src={staticFile("audio/ncs-sky-high.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 90, DAWN[0], END[0], INTERVAL_DURATION - 70, INTERVAL_DURATION - 10],
            [0, 0.06, 0.06, 0.17, 0.17, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {/* VO */}
      <Sequence from={40}>
        <Audio src={staticFile("audio/iv1.wav")} volume={1} />
      </Sequence>
      <Sequence from={245}>
        <Audio src={staticFile("audio/iv2.wav")} volume={1} />
      </Sequence>
      <Sequence from={485}>
        <Audio src={staticFile("audio/iv3.wav")} volume={1} />
      </Sequence>
      <Sequence from={755}>
        <Audio src={staticFile("audio/iv4.wav")} volume={1} />
      </Sequence>
      <Sequence from={995}>
        <Audio src={staticFile("audio/iv5.wav")} volume={1} />
      </Sequence>
      <Sequence from={1305}>
        <Audio src={staticFile("audio/iv6.wav")} volume={1} />
      </Sequence>
      <Sequence from={1575}>
        <Audio src={staticFile("audio/iv7.wav")} volume={1} />
      </Sequence>
      <Sequence from={1835}>
        <Audio src={staticFile("audio/iv8.wav")} volume={1} />
      </Sequence>
      <Sequence from={1990}>
        <Audio src={staticFile("audio/iv9.wav")} volume={1} />
      </Sequence>
      <Sequence from={2150}>
        <Audio src={staticFile("audio/iv10.wav")} volume={1} />
      </Sequence>
      {/* SFX */}
      <Sfx src="tick.wav" from={20} volume={0.4} />
      <Sfx src="boom.wav" from={628} volume={0.65} />
      <Sfx src="whoosh.wav" from={740} volume={0.4} />
      <Sfx src="pulse.wav" from={1300} volume={0.45} />
      <Sfx src="boom.wav" from={1820} volume={0.4} />
      <Sfx src="riser.wav" from={2080} volume={0.4} />
      <Sfx src="success.wav" from={2150} volume={0.45} />

      <SCold />
      <SProblem />
      <SInvert />
      <SAgent />
      <SParallel />
      <SCheat />
      <SJudge />
      <SDawn />
      <SEnd />

      <Overlays />
    </AbsoluteFill>
  );
};
