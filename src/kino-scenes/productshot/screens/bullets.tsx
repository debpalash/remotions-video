/**
 * SCREEN B — `bullets.tsx`. The AI bullet REWRITE: a weak bullet struck out and
 * a strong, metric-laden rewrite typed in beneath it, with the ATS match jumping
 * 58 → 94. PINNED: the exact before/after copy + the score pair.
 *
 * Animations (pure functions of `useFrame()`):
 *  - before row strikes through (accent2) and dims to `textDim`;
 *  - a vertical connector draws + a spark springs in at the seam;
 *  - the after row TYPES the strong bullet char-by-char behind a tracking accent
 *    wash, with a blinking caret, a lock-in underline sweep, and a metric chip;
 *  - the ATS pill counts 58 → 94; the Apply pill fades in.
 */
import * as React from "react";

import { useFrame, interpolate, spring } from "../../../engine";
import { palette } from "../../../design";
import { FONTS } from "../../kit";
import { Card, countUp } from "./primitives";
import type { HotRect } from "./index";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// PINNED copy + scores.
const WEAK = "Responsible for managing a team and handling projects.";
const STRONG = "Led a 6-person team to ship 3 launches, lifting throughput 18%.";
const QUEUE = ["Reduced API latency across services", "Owned the billing migration", "Mentored two junior engineers"];

export const bulletsMeta = {
  title: "Resume Builder",
  step: "Build" as const,
  nav: "Resume Builder",
  status: "Rewriting · 58 -> 94",
};

export const bulletsHotRects: readonly HotRect[] = [
  { label: "AI rewrite", rect: { x: 0.4, y: 0.4, w: 0.56, h: 0.2 } }, // after row [0]=hero
  { label: "before", rect: { x: 0.4, y: 0.18, w: 0.56, h: 0.16 } }, // before row
  { label: "bullets", rect: { x: 0.18, y: 0.18, w: 0.19, h: 0.6 } }, // queue
  { label: "apply", rect: { x: 0.78, y: 0.62, w: 0.17, h: 0.09 } }, // apply pill
];

export const BulletsScreen: React.FC<{ seed: string; width: number }> = ({ width }) => {
  const c = palette();
  const { frame, fps } = useFrame();
  const H = Math.round(width * 0.62);

  const strike = interpolate(frame, [10, 24], [0, 1], clamp);
  const connector = interpolate(frame, [18, 26], [0, 1], clamp);
  const sparkS = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 160, mass: 0.6 } });
  const vis = Math.floor(interpolate(frame, [24, 46], [0, STRONG.length], clamp));
  const typed = STRONG.slice(0, vis);
  const typing = vis < STRONG.length;
  const caretOn = Math.floor(frame / (fps * 0.5)) % 2 === 0 ? 1 : 0.25;
  const lockSweep = interpolate(frame, [56, 64], [0, 1], clamp);
  const metricS = spring({ frame: frame - 44, fps, config: { damping: 13, stiffness: 150, mass: 0.6 } });
  const atsScore = countUp(frame, 58, 94, [44, 58]);
  const applyOpacity = interpolate(frame, [58, 66], [0, 1], clamp);

  const fs = Math.round(H * 0.05);

  return (
    <div style={{ flex: 1, display: "flex", gap: Math.round(width * 0.022), minHeight: 0 }}>
      {/* QUEUE */}
      <Card style={{ flex: 0.62, padding: Math.round(width * 0.018), display: "flex", flexDirection: "column", gap: Math.round(H * 0.018) }}>
        <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.03), fontWeight: 600, color: c("text") }}>
          Bullets
        </span>
        {/* active row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: `${Math.round(H * 0.014)}px ${Math.round(H * 0.018)}px`,
            borderRadius: 8,
            background: c("accent", 0.1),
            border: `1px solid ${c("accent", 0.35)}`,
          }}
        >
          <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.026), color: c("text"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Team & projects bullet
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: Math.round(H * 0.027), color: c("accent"), flexShrink: 0 }}>
            rewriting
          </span>
        </div>
        {QUEUE.map((q) => (
          <div
            key={q}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: `${Math.round(H * 0.014)}px ${Math.round(H * 0.018)}px`,
              borderRadius: 8,
              border: `1px solid ${c("text", 0.1)}`,
            }}
          >
            <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.026), color: c("textDim"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {q}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: Math.round(H * 0.027), color: c("textDim"), flexShrink: 0 }}>
              rewrite
            </span>
          </div>
        ))}
      </Card>

      {/* DIFF */}
      <Card hero style={{ flex: 1.4, padding: Math.round(width * 0.024), display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(H * 0.03), position: "relative" }}>
        {/* BEFORE */}
        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(H * 0.014) }}>
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(H * 0.016) }}>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.round(H * 0.028),
                color: c("accent2"),
                background: c("accent2", 0.12),
                border: `1px solid ${c("accent2", 0.4)}`,
                borderRadius: 6,
                padding: "3px 8px",
              }}
            >
              WEAK ↓ 58
            </span>
          </div>
          <div style={{ position: "relative", display: "inline-block" }}>
            <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.042), color: c("textDim") }}>{WEAK}</span>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                height: 2,
                width: `${strike * 100}%`,
                background: c("accent2", 0.6),
              }}
            />
          </div>
        </div>

        {/* CONNECTOR + SPARK */}
        <div style={{ position: "relative", height: Math.round(H * 0.05) }}>
          <div
            style={{
              position: "absolute",
              left: Math.round(H * 0.02),
              top: 0,
              width: 2,
              height: `${connector * 100}%`,
              background: `linear-gradient(${c("accent")}, ${c("accent2")})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: Math.round(H * 0.02),
              top: "50%",
              transform: `translate(-50%,-50%) scale(${Math.min(sparkS, 1.2)})`,
              fontFamily: FONTS.body,
              fontSize: Math.round(H * 0.04),
              color: c("accent"),
              opacity: Math.min(sparkS, 1),
            }}
          >
            ✦
          </div>
        </div>

        {/* AFTER (hero) */}
        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(H * 0.014) }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline" }}>
            {/* tracking wash behind the typed text */}
            <span style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: "-2px -4px", background: c("accent", 0.16), borderRadius: 6 }} />
              <span style={{ position: "relative", fontFamily: FONTS.body, fontWeight: 700, fontSize: fs, color: c("text") }}>
                {typed}
              </span>
            </span>
            {typing ? (
              <span style={{ display: "inline-block", width: Math.round(fs * 0.08), height: fs, marginLeft: 3, background: c("accent"), opacity: caretOn }} />
            ) : null}
          </div>
          {/* lock-in underline sweep */}
          <div style={{ height: 3, width: `${lockSweep * 100}%`, borderRadius: 99, background: `linear-gradient(90deg, ${c("accent")}, ${c("accent2")})` }} />
          {/* inserted metric chip */}
          <div style={{ display: "flex", alignItems: "center", gap: Math.round(H * 0.016) }}>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.round(H * 0.026),
                color: c("bg"),
                background: c("accent"),
                borderRadius: 99,
                padding: "4px 12px",
                transform: `scale(${Math.min(metricS, 1)})`,
                transformOrigin: "left center",
                opacity: Math.min(metricS, 1),
              }}
            >
              +18% throughput
            </span>
          </div>
        </div>

        {/* ATS pill + Apply pill */}
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(H * 0.02), marginTop: Math.round(H * 0.01) }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: FONTS.display, fontSize: Math.round(H * 0.06), fontWeight: 700, color: c("text"), fontVariantNumeric: "tabular-nums" }}>
              {atsScore}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: Math.round(H * 0.028), color: c("textDim") }}>ATS match</span>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 99,
              background: c("accent"),
              color: c("bg"),
              fontFamily: FONTS.body,
              fontWeight: 700,
              fontSize: Math.round(H * 0.03),
              opacity: applyOpacity,
            }}
          >
            ✓ Apply
          </div>
        </div>
      </Card>
    </div>
  );
};
