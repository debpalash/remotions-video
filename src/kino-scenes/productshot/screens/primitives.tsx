/**
 * `screens/primitives.tsx` — the ONE shared design-language for the ResuBird
 * product-UI screens. Every screen (ATS gauge / bullet diff / cover draft) is
 * assembled from these atoms, so the three views read as one product, not three
 * unrelated mocks.
 *
 * DETERMINISM: every animated value is a closed-form `interpolate`/`spring` on
 * the Kino frame passed in (`countUp`/`stagger`/`Meter`). NO `Math.random`, NO
 * `Date.now`, NO rAF. Colors come exclusively from `palette()` tokens (no raw
 * hex — lint-enforced). All fills are OPAQUE `surface` so the HeroDevice
 * screen-blend bloom can never wash a translucent panel to white.
 */
import * as React from "react";

import { interpolate } from "../../../engine";
import { palette } from "../../../design";
import { FONTS } from "../../kit";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/* -------------------------------------------------------------------------- */
/*  Pure timing helpers (no palette, no hooks)                                  */
/* -------------------------------------------------------------------------- */

/** Round a frame-driven ramp from `from`→`to` over `[a,b]`. Clamped both ends. */
export function countUp(
  frame: number,
  from: number,
  to: number,
  range: readonly [number, number],
): number {
  return Math.round(interpolate(frame, range, [from, to], clamp));
}

/** Per-item staggered reveal in `[0,1]` for item `i`. */
export function stagger(
  frame: number,
  i: number,
  base = 10,
  step = 4,
  dur = 18,
): number {
  return interpolate(frame, [base + i * step, base + i * step + dur], [0, 1], clamp);
}

/* -------------------------------------------------------------------------- */
/*  Card — the shared surface container                                         */
/* -------------------------------------------------------------------------- */

export const Card: React.FC<{
  hero?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ hero, style, children }) => {
  const c = palette();
  return (
    <div
      style={{
        borderRadius: 14,
        boxSizing: "border-box",
        // OPAQUE always — never let the device bloom bleed through.
        background: hero
          ? `linear-gradient(150deg, ${c("accent", 0.12)}, ${c("surface")})`
          : c("surface"),
        border: `1px solid ${hero ? c("accent", 0.35) : c("text", 0.12)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  StatusPill — pinned status text, mono/tabular                               */
/* -------------------------------------------------------------------------- */

export const StatusPill: React.FC<{ text: string; u: number }> = ({ text, u }) => {
  const c = palette();
  return (
    <div
      style={{
        fontFamily: FONTS.mono,
        fontSize: Math.round(u * 0.03),
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.04em",
        color: c("textDim"),
        background: c("surface"),
        border: `1px solid ${c("text", 0.12)}`,
        borderRadius: 99,
        padding: `${Math.round(u * 0.012)}px ${Math.round(u * 0.026)}px`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  KeywordChip — matched (filled) vs missing (dashed)                          */
/* -------------------------------------------------------------------------- */

export const KeywordChip: React.FC<{
  label: string;
  state: "match" | "miss";
  u: number;
  scale?: number;
}> = ({ label, state, u, scale = 1 }) => {
  const c = palette();
  const match = state === "match";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(u * 0.01),
        fontFamily: FONTS.mono,
        // +18% font + 600 weight so the matched/missing keyword chips
        // (React/TypeScript vs Kubernetes/Terraform) stay legible at phone size.
        fontSize: Math.round(u * 0.033),
        fontWeight: 600,
        lineHeight: 1,
        padding: "8px 14px",
        borderRadius: 99,
        transform: `scale(${scale})`,
        transformOrigin: "left center",
        // "missing" chips read MUTED-but-LEGIBLE: a filled warm tint + a near-
        // full-strength dashed border + ink text (was accent-on-surface, which
        // washed to near-invisible on cream). A leading ± mark cues the state.
        background: match ? c("accent") : c("accent2", 0.1),
        color: match ? c("bg") : c("text"),
        border: match
          ? "1px solid transparent"
          : `1px dashed ${c("accent2", 0.8)}`,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ opacity: 0.85 }}>{match ? "+" : "−"}</span>
      {/* clamp the keyword text so a long token can't overflow the pill edge */}
      <span
        style={{
          maxWidth: Math.round(u * 0.42),
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  Meter — a track + animated fill + tabular value                             */
/* -------------------------------------------------------------------------- */

export const Meter: React.FC<{
  pct: number;
  frame: number;
  delay?: number;
  highlight?: boolean;
  u: number;
  showValue?: boolean;
}> = ({ pct, frame, delay = 0, highlight, u, showValue = true }) => {
  const c = palette();
  const st = interpolate(frame, [delay, delay + 18], [0, 1], clamp);
  // Non-zero floor (0.45) so the bar never collapses to an empty track.
  const fillFrac = (pct / 100) * (0.45 + 0.55 * st);
  const val = countUp(frame, 0, pct, [delay, delay + 18]);
  const h = Math.max(6, Math.round(u * 0.018));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(u * 0.02) }}>
      <div
        style={{
          flex: 1,
          height: h,
          borderRadius: 99,
          background: c("text", 0.1),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${fillFrac * 100}%`,
            height: "100%",
            borderRadius: 99,
            background: highlight
              ? `linear-gradient(90deg, ${c("accent")}, ${c("accent2")})`
              : c("accent", 0.55),
          }}
        />
      </div>
      {showValue ? (
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: Math.round(u * 0.03),
            fontVariantNumeric: "tabular-nums",
            color: c("text"),
            minWidth: Math.round(u * 0.06),
            textAlign: "right",
          }}
        >
          {val}
        </span>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Stepper — Upload → Parse → ATS → Build (shared chrome)                       */
/* -------------------------------------------------------------------------- */

const STEPS = ["Upload", "Parse", "ATS", "Build"] as const;

export const Stepper: React.FC<{ active: string; u: number }> = ({ active, u }) => {
  const c = palette();
  const dot = Math.round(u * 0.05);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(u * 0.018) }}>
      {STEPS.map((s, i) => {
        const on = s === active;
        return (
          <React.Fragment key={s}>
            {i > 0 ? (
              <div
                style={{
                  width: Math.round(u * 0.05),
                  height: 2,
                  background: c("text", 0.12),
                }}
              />
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: Math.round(u * 0.012) }}>
              <div
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: 99,
                  background: on ? c("accent") : c("text", 0.13),
                }}
              />
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: Math.round(u * 0.028),
                  letterSpacing: "0.06em",
                  color: on ? c("text") : c("textDim"),
                }}
              >
                {s}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  NavRail — the shared left navigation                                         */
/* -------------------------------------------------------------------------- */

const NAV_ROWS = ["Analyze", "Resume Builder", "Cover Letter", "ATS Checker", "Batch"] as const;

export const NavRail: React.FC<{ active: string; u: number }> = ({ active, u }) => {
  const c = palette();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: Math.round(u * 0.012) }}>
      {NAV_ROWS.map((row) => {
        const on = row === active;
        return (
          <div
            key={row}
            style={{
              display: "flex",
              alignItems: "center",
              gap: Math.round(u * 0.018),
              padding: `${Math.round(u * 0.014)}px ${Math.round(u * 0.018)}px`,
              borderRadius: 8,
              background: on ? c("accent", 0.1) : "transparent",
            }}
          >
            <div
              style={{
                width: Math.round(u * 0.018),
                height: Math.round(u * 0.018),
                borderRadius: 99,
                background: on ? c("accent", 0.85) : c("text", 0.13),
              }}
            />
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: Math.round(u * 0.03),
                fontWeight: on ? 600 : 500,
                color: on ? c("accent") : c("text"),
                whiteSpace: "nowrap",
              }}
            >
              {row}
            </span>
          </div>
        );
      })}
    </div>
  );
};
