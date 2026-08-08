/**
 * SCREEN A — `ats.tsx`. The ResuBird SIGNATURE: an ATS-match gauge + a parse
 * checklist + a keyword-match strip. This is the ProductShot hero AND the first
 * FeatureBeat. PINNED data (seed-independent → byte-identical across every
 * instance, killing the old multi-KPI flicker): score 82, sub-scores 90/78/85.
 *
 * Animations are pure functions of `useFrame().frame`:
 *  - gauge sweeps to 82 via SVG `strokeDashoffset` (cheap, single static svg);
 *  - the center number counts 41→82 (never 0);
 *  - checklist rows fade + their status chips snap pass/flag on stagger;
 *  - keyword chips pop in staggered (matched filled, missing dashed).
 */
import * as React from "react";

import { useFrame, interpolate } from "../../../engine";
import { palette } from "../../../design";
import { FONTS } from "../../kit";
import { Card, Meter, KeywordChip, countUp, stagger } from "./primitives";
import type { HotRect } from "./index";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// PINNED, seed-independent semantic data.
const SCORE = 82;
const CHECKS = [
  { label: "Keyword match", meter: 90, highlight: true },
  { label: "Formatting", meter: 78, highlight: false },
  { label: "Section headers", pass: true },
  { label: "Contact parseable", pass: true },
  { label: "File type", pass: true },
] as const;
const MATCHED = ["React", "TypeScript", "CI/CD"];
const MISSING = ["Kubernetes", "Terraform", "GraphQL"];

export const atsMeta = {
  title: "ATS Match",
  step: "ATS" as const,
  nav: "ATS Checker",
  status: "Score 82 / 100",
};

export const atsHotRects: readonly HotRect[] = [
  { label: "ATS score", rect: { x: 0.2, y: 0.22, w: 0.34, h: 0.48 } }, // gauge [0]=hero
  { label: "ATS checks", rect: { x: 0.57, y: 0.22, w: 0.4, h: 0.3 } }, // checklist
  { label: "keyword match", rect: { x: 0.57, y: 0.55, w: 0.4, h: 0.2 } }, // chips
  { label: "ATS checker", rect: { x: 0.01, y: 0.16, w: 0.15, h: 0.64 } }, // nav row
];

export const AtsScreen: React.FC<{ seed: string; width: number }> = ({ seed, width }) => {
  const c = palette();
  const { frame } = useFrame();
  const H = Math.round(width * 0.62);

  const reveal = interpolate(frame, [6, 42], [0, 1], clamp);
  const score = countUp(frame, 41, SCORE, [6, 42]);
  const matched = countUp(frame, 0, 23, [6, 42]);

  // Gauge geometry — a 270° arc with the gap centered at the bottom.
  const R = Math.round(H * 0.105);
  const sw = Math.round(H * 0.02);
  const box = 2 * (R + sw) + 8;
  const cx = box / 2;
  const circ = 2 * Math.PI * R;
  const arcLen = circ * 0.75;
  const offset = arcLen * (1 - 0.82 * reveal);

  return (
    <div style={{ flex: 1, display: "flex", gap: Math.round(width * 0.022), minHeight: 0 }}>
      {/* GAUGE CARD */}
      <Card
        hero
        style={{
          flex: 1.05,
          padding: Math.round(width * 0.022),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(H * 0.02),
        }}
      >
        <div style={{ position: "relative", width: box, height: box }}>
          <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ display: "block" }}>
            <defs>
              <linearGradient id={`ats-arc-${seed}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={c("accent")} />
                <stop offset="100%" stopColor={c("accent2")} />
              </linearGradient>
            </defs>
            <g transform={`rotate(135 ${cx} ${cx})`}>
              <circle
                cx={cx}
                cy={cx}
                r={R}
                fill="none"
                stroke={c("text", 0.1)}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={`${arcLen} ${circ}`}
              />
              <circle
                cx={cx}
                cy={cx}
                r={R}
                fill="none"
                stroke={`url(#ats-arc-${seed})`}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={`${arcLen} ${circ}`}
                strokeDashoffset={offset}
              />
            </g>
          </svg>
          {/* center readout */}
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
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: Math.round(H * 0.13),
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: c("text"),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {score}
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.round(H * 0.03),
                letterSpacing: "0.18em",
                color: c("textDim"),
                marginTop: 4,
              }}
            >
              ATS MATCH
            </span>
          </div>
        </div>
        {/* delta pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 99,
            background: c("accent", 0.12),
            border: `1px solid ${c("accent", 0.35)}`,
            color: c("accent"),
            fontFamily: FONTS.mono,
            fontSize: Math.round(H * 0.028),
            fontWeight: 700,
            opacity: 0.4 + 0.6 * reveal,
          }}
        >
          +14 this scan
        </div>
      </Card>

      {/* RIGHT COLUMN */}
      <div
        style={{
          flex: 1.25,
          display: "flex",
          flexDirection: "column",
          gap: Math.round(width * 0.018),
          minWidth: 0,
        }}
      >
        {/* CHECKLIST */}
        <Card style={{ flex: 1.3, padding: Math.round(width * 0.02), display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: Math.round(H * 0.018),
            }}
          >
            <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.032), fontWeight: 600, color: c("text") }}>
              Parse checks
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.round(H * 0.028),
                color: c("textDim"),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {matched} / 28 matched
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: Math.round(H * 0.024), flex: 1, justifyContent: "center" }}>
            {CHECKS.map((row, i) => {
              const st = stagger(frame, i);
              const settled = st > 0.6;
              const rowOpacity = interpolate(st, [0, 0.4], [0.62, 1], clamp);
              const checkBox = Math.round(H * 0.04);
              return (
                // FIXED two-column grid (label | value+bar | check) so the label
                // can NEVER wrap into the meter value ("Keyword 90" garble) nor a
                // long label ("Section headers"/"Contact parseable") stack onto the
                // next row. Label column is a clamped, single-line ellipsis cell.
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `minmax(0, 46%) 1fr ${checkBox}px`,
                    alignItems: "center",
                    gap: Math.round(H * 0.02),
                    opacity: rowOpacity,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: Math.round(H * 0.028),
                      color: c("text"),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                    }}
                  >
                    {row.label}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    {"meter" in row ? (
                      <Meter pct={row.meter} frame={frame} delay={8 + i * 4} highlight={row.highlight} u={H} />
                    ) : null}
                  </div>
                  <div
                    style={{
                      width: checkBox,
                      height: checkBox,
                      borderRadius: 6,
                      display: "grid",
                      placeItems: "center",
                      fontSize: Math.round(H * 0.026),
                      fontWeight: 800,
                      lineHeight: 1,
                      color: settled ? c("bg") : c("textDim"),
                      background: settled ? c("accent") : c("text", 0.1),
                    }}
                  >
                    {settled ? "✓" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* KEYWORD STRIP */}
        <Card style={{ flex: 1, padding: Math.round(width * 0.02), display: "flex", flexDirection: "column", gap: Math.round(H * 0.016) }}>
          <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.03), fontWeight: 600, color: c("text") }}>
            Keywords
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: Math.round(H * 0.016) }}>
            {/* Chips pop in over a LONGER, later window so the ATS beat keeps
                visibly progressing across its full ~5s hold (the gauge settles by
                ~f42; the keyword strip carries the motion to ~f76) — t=14 ≠ t=19
                for this beat, not just a frozen gauge. */}
            {MATCHED.map((kw, i) => {
              const r = interpolate(frame, [18 + i * 7, 18 + i * 7 + 16], [0, 1], clamp);
              return <KeywordChip key={kw} label={kw} state="match" u={H} scale={0.85 + 0.15 * r} />;
            })}
            {MISSING.map((kw, i) => {
              const r = interpolate(frame, [40 + i * 8, 40 + i * 8 + 16], [0, 1], clamp);
              return <KeywordChip key={kw} label={kw} state="miss" u={H} scale={0.85 + 0.15 * r} />;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
