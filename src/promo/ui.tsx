import React from "react";
import {
  Img,
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { icons as LUCIDE_ICONS } from "lucide-react";
import { COLORS, FONTS } from "./theme";

/* -------------------------------------------------------------------------- */
/*  Icon resolution                                                            */
/*  Spec callout `icon` is a lucide-react name (kebab-case enum, NOT arbitrary */
/*  svg). Resolve it to the inline, tree-shakeable lucide component. Legacy     */
/*  emoji strings (e.g. "🤖") fall through and render as text.                  */
/* -------------------------------------------------------------------------- */

/** kebab/snake-case lucide id → PascalCase export key (`message-circle` → `MessageCircle`). */
const toPascal = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/**
 * Render a lucide icon by name. If the name is not a known lucide id (e.g. a
 * legacy emoji string), render it as text so old call sites keep working.
 */
const Glyph: React.FC<{ name: string; size: number; color: string }> = ({
  name,
  size,
  color,
}) => {
  const Cmp = (LUCIDE_ICONS as Record<string, React.ComponentType<any>>)[
    toPascal(name)
  ];
  if (!Cmp) return <>{name}</>;
  return <Cmp size={size} color={color} strokeWidth={2.25} absoluteStrokeWidth />;
};

const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`;

// Cinematic dark backdrop: aurora orbs + drifting grid + film grain + vignette
export const Backdrop: React.FC<{ hue?: "blue" | "green" }> = ({
  hue = "blue",
}) => {
  const frame = useCurrentFrame();
  const drift = frame * 0.3;
  const glow = hue === "blue" ? COLORS.blue : COLORS.green;
  const orbX = Math.sin(frame / 70) * 120;
  const orbY = Math.cos(frame / 90) * 70;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      {/* aurora orbs */}
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 900,
          left: 310 + orbX,
          top: 620 + orbY,
          background: `radial-gradient(ellipse at center, ${glow}30 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 700,
          right: -200 - orbX * 0.6,
          top: -260,
          background: `radial-gradient(ellipse at center, ${COLORS.blue}24 0%, transparent 62%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 600,
          left: -180 + orbX * 0.4,
          top: -200,
          background: `radial-gradient(ellipse at center, #6a3df524 0%, transparent 65%)`,
          filter: "blur(40px)",
        }}
      />
      {/* grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 100%)",
        }}
      />
      {/* film grain */}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_URI,
          backgroundPosition: `${(frame % 6) * 40}px ${(frame % 5) * 53}px`,
          opacity: 0.055,
          mixBlendMode: "overlay",
        }}
      />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 115% 95% at 50% 48%, transparent 52%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// Spring pop-in wrapper with subtle blur-in
export const Pop: React.FC<{
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

// Small mono pill label, e.g. "AI INTERVIEWER"
export const Kicker: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => (
  <Pop delay={delay} from={20}>
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 28px",
        borderRadius: 999,
        border: `1px solid ${COLORS.blue}55`,
        background: `linear-gradient(180deg, ${COLORS.blue}22, ${COLORS.blue}0d)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 30px ${COLORS.blue}1f`,
        color: "#a8c8ff",
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
          background: COLORS.green,
          boxShadow: `0 0 16px ${COLORS.green}`,
        }}
      />
      {children}
    </div>
  </Pop>
);

// Floating glassmorphic feature callout chip
export const Callout: React.FC<{
  delay: number;
  /** lucide-react icon name (kebab-case) OR a legacy emoji string. */
  icon: string;
  title: string;
  sub?: string;
  style?: React.CSSProperties;
  accent?: string;
}> = ({ delay, icon, title, sub, style, accent = COLORS.blue }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  const float = Math.sin((frame - delay) / 22) * 6;
  return (
    <div
      style={{
        position: "absolute",
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - s) * 60 + float}px) scale(${0.9 + s * 0.1})`,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "20px 30px",
        borderRadius: 20,
        background:
          "linear-gradient(160deg, rgba(22,33,66,0.92), rgba(10,17,38,0.88))",
        border: `1px solid ${accent}50`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 24px 60px rgba(0,0,0,0.55), 0 0 44px ${accent}22`,
        backdropFilter: "blur(16px)",
        ...style,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          fontSize: 30,
          background: `${accent}26`,
          border: `1px solid ${accent}44`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15)`,
        }}
      >
        <Glyph name={icon} size={30} color={accent} />
      </div>
      <div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: COLORS.white,
          }}
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 21,
              color: COLORS.dim,
              marginTop: 3,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Product screenshot in a glowing glass frame: Ken Burns drift + light sweep
export const ScreenFrame: React.FC<{
  src: string;
  delay?: number;
  tilt?: number;
  zoomFrom?: number;
  zoomTo?: number;
  style?: React.CSSProperties;
}> = ({ src, delay = 0, tilt = 0, zoomFrom = 1, zoomTo = 1.06, style }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, mass: 0.9 },
  });
  const kenBurns = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo]);
  // light sweep passes once, shortly after entrance
  const sweepX = interpolate(frame - delay, [16, 58], [-45, 145], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `perspective(1600px) rotateX(${tilt}deg) translateY(${(1 - s) * 90}px) scale(${0.96 + s * 0.04})`,
        borderRadius: 24,
        padding: 3,
        background: `linear-gradient(135deg, ${COLORS.blue}99, rgba(255,255,255,0.14) 35%, transparent 55%, ${COLORS.green}77)`,
        boxShadow: `0 60px 140px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.45), 0 0 100px ${COLORS.blue}2e`,
        ...style,
      }}
    >
      <div
        style={{ borderRadius: 21, overflow: "hidden", position: "relative" }}
      >
        <Img
          src={src}
          style={{
            display: "block",
            width: "100%",
            transform: `scale(${kenBurns})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, transparent ${sweepX - 18}%, rgba(255,255,255,0.16) ${sweepX}%, transparent ${sweepX + 18}%)`,
          }}
        />
      </div>
    </div>
  );
};
