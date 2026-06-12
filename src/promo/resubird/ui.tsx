import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONTS } from "../theme";
import { RB } from "./theme";

const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`;

// Warm light backdrop: cream wash + orange aurora + dot grid + grain
export const LightBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const orbX = Math.sin(frame / 70) * 110;
  const orbY = Math.cos(frame / 90) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: RB.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: 1400,
          height: 950,
          left: 260 + orbX,
          top: 540 + orbY,
          background: `radial-gradient(ellipse at center, ${RB.orange}1f 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 720,
          right: -220 - orbX * 0.6,
          top: -280,
          background: `radial-gradient(ellipse at center, ${RB.amber}2b 0%, transparent 62%)`,
          filter: "blur(40px)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${RB.ink}14 1.6px, transparent 1.6px)`,
          backgroundSize: "44px 44px",
          backgroundPosition: `${frame * 0.25}px ${frame * 0.15}px`,
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_URI,
          backgroundPosition: `${(frame % 6) * 40}px ${(frame % 5) * 53}px`,
          opacity: 0.04,
          mixBlendMode: "multiply",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 115% 95% at 50% 48%, transparent 58%, ${RB.bgDeep}cc 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Spring pop-in with blur (light theme shares mechanics with the dark Pop)
export const RPop: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  from?: number;
}> = ({ delay = 0, children, style, from = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, mass: 0.7 },
  });
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.6], [0, 1], {
          extrapolateRight: "clamp",
        }),
        filter: `blur(${(1 - Math.min(s * 1.4, 1)) * 8}px)`,
        transform: `translateY(${(1 - s) * from}px) scale(${0.94 + s * 0.06})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Mono pill label
export const RKicker: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => (
  <RPop delay={delay} from={20}>
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 28px",
        borderRadius: 999,
        border: `1px solid ${RB.orange}55`,
        background: `linear-gradient(180deg, ${RB.orange}1a, ${RB.orange}0a)`,
        boxShadow: `0 4px 18px ${RB.orange}1f`,
        color: "#c2570c",
        fontFamily: FONTS.mono,
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          background: RB.orange,
          boxShadow: `0 0 14px ${RB.orange}`,
        }}
      />
      {children}
    </div>
  </RPop>
);

// White card with warm shadow
export const RCard: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  float?: boolean;
}> = ({ delay = 0, children, style, float = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, mass: 0.7 },
  });
  const drift = float ? Math.sin((frame - delay) / 24) * 6 : 0;
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - s) * 70 + drift}px) scale(${0.92 + s * 0.08})`,
        background: RB.card,
        borderRadius: 24,
        border: `1px solid ${RB.ink}14`,
        boxShadow: `0 30px 70px ${RB.ink}1e, 0 8px 24px ${RB.ink}10`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Animated score ring (SVG), counts to `score`
export const ScoreRing: React.FC<{
  score: number;
  delay?: number;
  size?: number;
  label?: string;
}> = ({ score, delay = 0, size = 280, label = "Good Fit" }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 55], [0, score / 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`${RB.ink}12`}
          strokeWidth={size * 0.062}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RB.orange}
          strokeWidth={size * 0.062}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: size * 0.27,
            fontWeight: 700,
            color: RB.ink,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {Math.round(progress * 100)}
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: size * 0.062,
            color: RB.green,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};
