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

export const MANIFESTO_DURATION = 1180; // 39.3s @ 30fps

// Apple's signature ease: fast start, long quiet landing
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

// Barely-there spotlight on black
const Void: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 80% 55% at 50% 42%, #101114 0%, #000 75%)",
    }}
  />
);

// A statement that breathes in, holds, and dissolves — no bounce, ever.
const Statement: React.FC<{
  from: number;
  duration: number;
  children: React.ReactNode;
  size?: number;
  weight?: number;
  color?: string;
  enter?: number;
  exit?: number;
  tracking?: string;
}> = ({
  from,
  duration,
  children,
  size = 96,
  weight = 300,
  color = "#f5f5f7",
  enter = 32,
  exit = 26,
  tracking = "-0.022em",
}) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0 || local > duration) return null;
  const inO = interpolate(local, [0, enter], [0, 1], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const outO = interpolate(local, [duration - exit, duration], [1, 0], {
    extrapolateLeft: "clamp",
    easing: Easing.bezier(0.4, 0, 1, 1),
  });
  const scale = interpolate(local, [0, enter * 2.2], [1.035, 1], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const blur = interpolate(local, [0, enter], [7, 0], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: size,
          fontWeight: weight,
          color,
          letterSpacing: tracking,
          textAlign: "center",
          lineHeight: 1.22,
          opacity: Math.min(inO, outO),
          filter: `blur(${blur}px)`,
          transform: `scale(${scale})`,
          padding: "0 140px",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

// Product floating in the void with a mirror-floor reflection
const FloatingProduct: React.FC<{ from: number; duration: number }> = ({
  from,
  duration,
}) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0 || local > duration) return null;
  const o = Math.min(
    interpolate(local, [0, 45], [0, 1], {
      extrapolateRight: "clamp",
      easing: EASE,
    }),
    interpolate(local, [duration - 30, duration], [1, 0], {
      extrapolateLeft: "clamp",
    }),
  );
  const rise = interpolate(local, [0, 70], [70, 0], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const blur = interpolate(local, [0, 55], [16, 0], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const drift = interpolate(local, [0, duration], [1.0, 1.045]);
  const tilt = interpolate(local, [0, duration], [9, 5]);
  const capO = interpolate(local, [70, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const W = 950;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          opacity: o,
          filter: `blur(${blur}px)`,
          transform: `translateY(${rise - 36}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            transform: `perspective(2200px) rotateX(${tilt}deg) scale(${drift})`,
            borderRadius: 16,
            overflow: "hidden",
            width: W,
            boxShadow:
              "0 80px 160px rgba(0,0,0,0.85), 0 0 120px rgba(120,150,255,0.07)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <Img
            src={staticFile("yupcha/interviewer.webp")}
            style={{ display: "block", width: "100%" }}
          />
        </div>
        {/* reflection: mirrored, fading away from the product */}
        <div
          style={{
            width: W,
            height: 150,
            overflow: "hidden",
            marginTop: 10,
            opacity: 0.14,
            maskImage:
              "linear-gradient(to bottom, black 0%, transparent 85%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, transparent 85%)",
          }}
        >
          <Img
            src={staticFile("yupcha/interviewer.webp")}
            style={{
              display: "block",
              width: "100%",
              transform: `scaleY(-1) scale(${drift})`,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 26,
            textAlign: "center",
            fontFamily: FONTS.mono,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "rgba(245,245,247,0.45)",
            opacity: capO,
          }}
        >
          The AI Interviewer
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Monochrome logo blooming into full color — the only color in the film
const Bloom: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0) return null;
  const o = interpolate(local, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const gray = interpolate(local, [38, 92], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const scale = interpolate(local, [0, 90], [0.86, 1], {
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const glow = interpolate(local, [40, 110], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const nameO = interpolate(local, [70, 105], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const urlO = interpolate(local, [110, 145], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const endFade = interpolate(local, [185, 215], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        opacity: endFade,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(66,134,245,0.16) 0%, transparent 60%)",
          opacity: glow,
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          width: 190,
          height: 180,
          opacity: o,
          transform: `scale(${scale})`,
          filter: `grayscale(${gray}) brightness(${1 + gray * 0.35})`,
        }}
      >
        <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 86,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: "#f5f5f7",
          marginTop: 44,
          opacity: nameO,
        }}
      >
        Yupcha
      </div>
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 23,
          fontWeight: 500,
          letterSpacing: "0.3em",
          color: "rgba(245,245,247,0.4)",
          marginTop: 22,
          opacity: urlO,
        }}
      >
        yupcha.com
      </div>
    </AbsoluteFill>
  );
};

export const Manifesto: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // music: align the track's drop (53.0s) with the color bloom (frame 945 = 31.5s)
  const TRIM_S = 53.0 - 945 / 30;
  const musicVol = (f: number) =>
    interpolate(
      f,
      [0, 60, 740, 930, durationInFrames - 60, durationInFrames - 6],
      [0, 0.07, 0.085, 0.2, 0.2, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  // global film fade-in/out
  const filmO = Math.min(
    interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(
      frame,
      [durationInFrames - 14, durationInFrames],
      [1, 0],
      { extrapolateLeft: "clamp" },
    ),
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio
        src={staticFile("audio/ncs-sky-high.mp3")}
        trimBefore={Math.round(TRIM_S * 30)}
        volume={musicVol}
      />
      <AbsoluteFill style={{ opacity: filmO }}>
        <Void />
        <Statement from={20} duration={160} size={92} weight={300}>
          Hiring hasn&apos;t changed
          <br />
          in fifty years.
        </Statement>
        <Statement from={195} duration={78} size={84} weight={250} color="#9b9ba1">
          The resume.
        </Statement>
        <Statement from={278} duration={78} size={84} weight={250} color="#9b9ba1">
          The phone screen.
        </Statement>
        <Statement from={361} duration={84} size={84} weight={250} color="#9b9ba1">
          The gut feel.
        </Statement>
        <Statement from={462} duration={110} size={120} weight={600}>
          Until now.
        </Statement>
        <Sequence from={585}>
          <FloatingProduct from={0} duration={260} />
        </Sequence>
        <Statement from={852} duration={86} size={84} weight={300}>
          Every answer, understood.
        </Statement>
        <Bloom from={945} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
