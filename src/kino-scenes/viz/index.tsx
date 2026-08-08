/**
 * `src/kino-scenes/viz` — the STAT data-viz craft kit.
 *
 * The studio upgrade over a flat number on a card: animated progress rings, fill
 * bars, and count-up cards with real graphic polish (dossier §6) —
 *  - <CounterCard>  count-up number on a glass card, a decorative seeded
 *                   sparkline rising behind it, a unit chip, and a "lock" pop as
 *                   the digits land;
 *  - <ProgressRing> SVG arc that draws on a gradient stroke, with a tick scale,
 *                   a blurred-duplicate bloom underlay, a leading-edge cap dot,
 *                   and the value counting up in the hub in lockstep;
 *  - <StatBar>      horizontal fill bar with a quartile tick grid, a gradient
 *                   fill, a leading-edge bloom, and a value that counts in sync.
 *
 * Every viz rides the SAME `countUpProgress` ramp (`./ramp`) so the digits, the
 * arc, and the bar settle together — that lockstep is the "designed" tell. Each
 * exposes the "e.g." affordance for unverified stats (stats are examples until
 * verified — `SAAS_ROADMAP.md §4`).
 *
 * DETERMINISM (ENGINE_DESIGN §2): every value is a pure function of the Kino
 * frame; decorative "randomness" (sparkline shape, glow phase) is brand-seeded
 * via the engine's `seededRandom` / hashed indices — never `Math.random`, never a
 * wall-clock. `antialias`-free SVG; two renders of a frame are byte-identical.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2`.
 */
import * as React from "react";

import { useFrame, interpolate } from "../../engine";
import { palette } from "../../design";
import type { PaletteKey } from "../../spec";
import { FONTS, useEnter, useSeeded } from "../kit";
import {
  countUpProgress,
  fillDenominator,
  formatValue,
  lockPop,
} from "./ramp";

export { countUpProgress, fillDenominator, formatValue, lockPop } from "./ramp";

/* -------------------------------------------------------------------------- */
/*  Shared affordances                                                         */
/* -------------------------------------------------------------------------- */

/** The companion accent key (the gradient's other stop) for a given accent. */
const otherAccent = (accent: PaletteKey): PaletteKey =>
  accent === "accent2" ? "accent" : "accent2";

/** The small "e.g." affordance shared by unverified Stats vizzes. */
export const EgTag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const c = palette();
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: c("textDim"),
        opacity: 0.85,
        ...style,
      }}
    >
      e.g.
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Seeded sparkline path (decorative, behind a counter)                       */
/* -------------------------------------------------------------------------- */

/** A smooth seeded "metrics-going-up" sparkline, normalized into a `w × h` box. */
const sparklinePath = (
  rand: () => number,
  w: number,
  h: number,
  points: number,
): string => {
  const pad = h * 0.12;
  const usable = h - pad * 2;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points; i++) {
    xs.push((w / (points - 1)) * i);
    const drift = (i / (points - 1)) * usable * 0.6; // upward trend
    const y = pad + usable * 0.7 - drift + (rand() - 0.5) * usable * 0.22;
    ys.push(Math.max(pad, Math.min(h - pad, y)));
  }
  // Catmull-Rom → cubic Bézier for a designed curve (not a polyline zigzag).
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < points - 1; i++) {
    const x0 = xs[Math.max(0, i - 1)];
    const y0 = ys[Math.max(0, i - 1)];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const x3 = xs[Math.min(points - 1, i + 2)];
    const y3 = ys[Math.min(points - 1, i + 2)];
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
};

/* -------------------------------------------------------------------------- */
/*  Shared stat props                                                          */
/* -------------------------------------------------------------------------- */

export type VizProps = {
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
  delay: number;
  accent: PaletteKey;
  /** Unverified stats render an "e.g." affordance (stats are examples). */
  verified?: boolean;
  /** Full-scale value the fill maps `to` against (e.g. 100 for a percentage). */
  full?: number;
};

/* -------------------------------------------------------------------------- */
/*  CounterCard — count-up number on glass, with a seeded sparkline + lock pop  */
/* -------------------------------------------------------------------------- */

export const CounterCard: React.FC<VizProps> = ({
  to,
  suffix = "",
  decimals = 0,
  label,
  delay,
  accent,
  verified,
}) => {
  const { frame } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const seed = useSeeded(`counter:${label}`);
  const uid = React.useId().replace(/:/g, "");
  const other = otherAccent(accent);

  const p = countUpProgress(frame, delay, 52);
  const value = formatValue(to * p, decimals);
  const pop = lockPop(frame, delay, 52);

  // The sparkline draws in as the number counts (shared ramp).
  const sparkW = 320;
  const sparkH = 92;
  const spark = React.useMemo(
    () => sparklinePath(seed, sparkW, sparkH, 9),
    [seed],
  );
  const draw = interpolate(p, [0, 0.85], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 56}px) scale(${0.93 + s * 0.07})`,
        position: "relative",
        width: 380,
        padding: "48px 36px 40px",
        borderRadius: 28,
        overflow: "hidden",
        // glass card with a gradient hairline (padding/border-box trick)
        border: "1px solid transparent",
        background: [
          `linear-gradient(165deg, ${c("surface", 0.78)}, ${c("bg", 0.66)}) padding-box`,
          `linear-gradient(150deg, ${c(accent, 0.42)}, ${c("text", 0.06)} 48%, ${c(other, 0.3)}) border-box`,
        ].join(", "),
        boxShadow: `inset 0 1px 0 ${c("text", 0.1)}, 0 30px 70px rgba(0,0,0,0.5), 0 0 60px ${c(accent, 0.1)}`,
        textAlign: "center",
      }}
    >
      {/* seeded sparkline, low in the card, rising behind the number */}
      <svg
        width={sparkW}
        height={sparkH}
        viewBox={`0 0 ${sparkW} ${sparkH}`}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", opacity: 0.5 }}
      >
        <defs>
          <linearGradient id={`sp-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c(accent, 0.26)} />
            <stop offset="100%" stopColor={c(accent, 0)} />
          </linearGradient>
          <linearGradient id={`sp-line-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c(accent)} />
            <stop offset="100%" stopColor={c(other)} />
          </linearGradient>
        </defs>
        <path d={`${spark} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`} fill={`url(#sp-fill-${uid})`} opacity={draw} />
        <path
          d={spark}
          fill="none"
          stroke={`url(#sp-line-${uid})`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>

      {!verified ? (
        <EgTag style={{ position: "absolute", top: 18, right: 22 }} />
      ) : null}

      <div
        style={{
          position: "relative",
          fontFamily: FONTS.display,
          fontSize: 100,
          fontWeight: 700,
          letterSpacing: "-0.035em",
          color: c("text"),
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          transform: `scale(${1 + pop * 0.05})`,
        }}
      >
        {value}
        <span style={{ color: c(accent), fontSize: 60 }}>{suffix}</span>
      </div>
      <div
        style={{
          position: "relative",
          fontFamily: FONTS.body,
          fontSize: 27,
          color: c("textDim"),
          marginTop: 14,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  ProgressRing — gradient arc + tick scale + bloom underlay + cap dot         */
/* -------------------------------------------------------------------------- */

export const ProgressRing: React.FC<VizProps> = ({
  to,
  suffix = "",
  decimals = 0,
  label,
  delay,
  accent,
  verified,
  full,
}) => {
  const { frame } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const seed = useSeeded(`ring:${label}`);
  const uid = React.useId().replace(/:/g, "");
  const other = otherAccent(accent);

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = 124;
  const C = 2 * Math.PI * r;

  const denom = fillDenominator(to, full);
  const target = Math.min(to / denom, 1);
  const p = countUpProgress(frame, delay, 58);
  const reached = target * p;
  const value = formatValue(to * p, decimals);

  // Ambient glow breathe — deterministic, brand-seeded phase.
  const phase = seed() * Math.PI * 2;
  const glow = 0.5 + 0.5 * Math.sin(frame / 26 + phase);

  // Leading-edge cap position on the arc (12 o'clock origin, clockwise).
  const ang = -Math.PI / 2 + reached * 2 * Math.PI;
  const capX = cx + Math.cos(ang) * r;
  const capY = cy + Math.sin(ang) * r;
  const capOn = reached > 0.005 && reached < 0.999;

  // 60 minor ticks around the dial; the swept arc brightens the ones it passes.
  const TICKS = 60;

  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 50}px) scale(${0.92 + s * 0.08})`,
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`rg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c(accent)} />
            <stop offset="100%" stopColor={c(other)} />
          </linearGradient>
        </defs>

        {/* tick scale — minor marks around the dial, swept ones lit */}
        {Array.from({ length: TICKS }, (_, i) => {
          const a = -Math.PI / 2 + (i / TICKS) * 2 * Math.PI;
          const lit = i / TICKS <= reached;
          const r0 = r + 16;
          const r1 = r + (i % 5 === 0 ? 27 : 22);
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * r0}
              y1={cy + Math.sin(a) * r0}
              x2={cx + Math.cos(a) * r1}
              y2={cy + Math.sin(a) * r1}
              stroke={lit ? c(accent, 0.9) : c("text", 0.1)}
              strokeWidth={i % 5 === 0 ? 2.4 : 1.4}
              strokeLinecap="round"
            />
          );
        })}

        {/* track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c("text", 0.08)} strokeWidth={16} />

        {/* glow underlay (blurred duplicate = fake bloom, no GL) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#rg-${uid})`}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - reached)}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: "blur(11px)", opacity: 0.45 + glow * 0.4 }}
        />

        {/* crisp arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#rg-${uid})`}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - reached)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />

        {/* leading-edge cap dot — the bright "head" of the sweep */}
        {capOn ? (
          <>
            <circle cx={capX} cy={capY} r={13} fill={c(accent, 0.18)} style={{ filter: "blur(6px)" }} />
            <circle cx={capX} cy={capY} r={7} fill={c("text")} />
            <circle cx={capX} cy={capY} r={4} fill={c(accent)} />
          </>
        ) : null}
      </svg>

      <div style={{ textAlign: "center", position: "relative" }}>
        {!verified ? <EgTag style={{ position: "absolute", top: -38, left: "50%", transform: "translateX(-50%)" }} /> : null}
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: c("text"),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {value}
          <span style={{ color: c(accent), fontSize: 46 }}>{suffix}</span>
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 23,
            color: c("textDim"),
            marginTop: 14,
            fontWeight: 600,
            maxWidth: 210,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  StatBar — gradient fill + quartile tick grid + leading-edge bloom          */
/* -------------------------------------------------------------------------- */

export const StatBar: React.FC<VizProps & { index?: number }> = ({
  to,
  suffix = "",
  decimals = 0,
  label,
  delay,
  accent,
  verified,
  full,
}) => {
  const { frame } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const other = otherAccent(accent);

  const denom = fillDenominator(to, full);
  const p = countUpProgress(frame, delay, 54);
  const fill = Math.min(to / denom, 1) * p;
  const value = formatValue(to * p, decimals);

  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateX(${(1 - s) * -44}px)`,
        width: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <span style={{ fontFamily: FONTS.body, fontSize: 27, fontWeight: 600, color: c("text") }}>
          {label}
          {!verified ? (
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 15,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: c("textDim"),
                marginLeft: 14,
                opacity: 0.85,
              }}
            >
              e.g.
            </span>
          ) : null}
        </span>
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: c(accent),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
          {suffix}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: 20,
          borderRadius: 99,
          background: c("text", 0.06),
          overflow: "hidden",
          boxShadow: `inset 0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 1px ${c("text", 0.05)}`,
        }}
      >
        {/* quartile tick grid — the "designed", not "flat", tell */}
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${t * 100}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: c("text", 0.13),
            }}
          />
        ))}
        {/* gradient fill */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${fill * 100}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${c(accent, 0.9)}, ${c(other)})`,
            boxShadow: `0 0 26px ${c(accent, 0.5)}`,
          }}
        />
        {/* leading-edge bloom highlight */}
        <div
          style={{
            position: "absolute",
            left: `calc(${fill * 100}% - 4px)`,
            top: 0,
            bottom: 0,
            width: 4,
            background: c("text", 0.7),
            opacity: fill > 0.02 ? 1 : 0,
            filter: "blur(1.5px)",
            boxShadow: `0 0 16px ${c("text", 0.6)}`,
          }}
        />
      </div>
    </div>
  );
};
