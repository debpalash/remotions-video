/**
 * SCREEN C — `cover.tsx`. A tailored cover letter STREAMING in on a paper canvas
 * beside a job-match meter. PINNED: match 78%; the greeting + opening lines. Only
 * the trailing skeleton-line WIDTHS are seeded (cosmetic) via `seededRandom`.
 *
 * Animations (pure functions of `useFrame()`):
 *  - the letter types its greeting + two opening lines char-by-char with a
 *    blinking caret; the remaining lines fill in as skeleton bars (live-gen feel);
 *  - the match meter fills to 78% and the big number counts 0 → 78;
 *  - the tone chips fade in staggered (Professional active).
 */
import * as React from "react";

import { useFrame, interpolate, seededRandom } from "../../../engine";
import { palette } from "../../../design";
import { FONTS } from "../../kit";
import { Card, Meter, countUp, stagger } from "./primitives";
import type { HotRect } from "./index";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// PINNED draft copy + match.
const LETTER =
  "Dear Hiring Manager,\n\nYour work on distributed billing systems maps\ndirectly to what I shipped at scale last year.";
const MATCH = 78;
const TONES = ["Professional", "Warm", "Concise"];

export const coverMeta = {
  title: "Cover Letter",
  step: "Build" as const,
  nav: "Cover Letter",
  status: "Draft · 78% match",
};

export const coverHotRects: readonly HotRect[] = [
  { label: "tailored draft", rect: { x: 0.18, y: 0.16, w: 0.46, h: 0.66 } }, // letter [0]=hero
  { label: "78% match", rect: { x: 0.67, y: 0.22, w: 0.3, h: 0.16 } }, // meter
  { label: "tone", rect: { x: 0.67, y: 0.44, w: 0.3, h: 0.22 } }, // tone chips
];

export const CoverScreen: React.FC<{ seed: string; width: number }> = ({ seed, width }) => {
  const c = palette();
  const { frame, fps } = useFrame();
  const H = Math.round(width * 0.62);

  const vis = Math.floor(interpolate(frame, [12, 52], [0, LETTER.length], clamp));
  const typed = LETTER.slice(0, vis);
  const typing = vis < LETTER.length;
  const caretOn = Math.floor(frame / (fps * 0.5)) % 2 === 0 ? 1 : 0.25;
  const matchNum = countUp(frame, 0, MATCH, [20, 46]);

  // Cosmetic-only seeded skeleton widths (the only entropy on this screen).
  const skelRand = React.useMemo(() => seededRandom(`${seed}:cover`), [seed]);
  const skel = React.useMemo(() => Array.from({ length: 5 }, () => 0.55 + skelRand() * 0.4), [skelRand]);

  return (
    <div style={{ flex: 1, display: "flex", gap: Math.round(width * 0.022), minHeight: 0 }}>
      {/* LETTER CANVAS */}
      <Card style={{ flex: 1.5, padding: Math.round(width * 0.026), display: "flex", flexDirection: "column", gap: Math.round(H * 0.022) }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: Math.round(H * 0.034),
            lineHeight: 1.5,
            color: c("text"),
            whiteSpace: "pre-wrap",
          }}
        >
          {typed}
          {typing ? (
            <span style={{ display: "inline-block", width: Math.round(H * 0.004), height: Math.round(H * 0.032), marginLeft: 2, background: c("accent"), opacity: caretOn, verticalAlign: "text-bottom" }} />
          ) : null}
        </div>
        {/* skeleton continuation lines (live-generation feel) */}
        <div style={{ display: "flex", flexDirection: "column", gap: Math.round(H * 0.022), marginTop: Math.round(H * 0.01) }}>
          {skel.map((w, i) => (
            <div
              key={i}
              style={{
                width: `${w * 100}%`,
                height: Math.round(H * 0.018),
                borderRadius: 99,
                background: c("text", 0.1),
                opacity: interpolate(stagger(frame, i, 30, 5, 16), [0, 1], [0.2, 1], clamp),
              }}
            />
          ))}
        </div>
      </Card>

      {/* SIDE COLUMN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: Math.round(width * 0.018), minWidth: 0 }}>
        {/* MATCH METER — `overflow:hidden` + a clamped single-line meta row so the
            "Tailored to:" line can never wrap onto / overlap the meter or bleed
            into the Tone card below it (its own row, with a top margin gap). */}
        <Card hero style={{ flex: 1, padding: Math.round(width * 0.02), display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(H * 0.018), overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: FONTS.display, fontSize: Math.round(H * 0.078), fontWeight: 700, color: c("text"), lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {matchNum}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: Math.round(H * 0.034), color: c("textDim") }}>% match</span>
          </div>
          <Meter pct={MATCH} frame={frame} delay={20} highlight u={H} showValue={false} />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: Math.round(H * 0.024),
              color: c("textDim"),
              letterSpacing: "0.02em",
              marginTop: Math.round(H * 0.008),
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            Tailored to: Senior Backend Engineer · Acme
          </span>
        </Card>

        {/* TONE CHIPS */}
        <Card style={{ flex: 0.9, padding: Math.round(width * 0.02), display: "flex", flexDirection: "column", gap: Math.round(H * 0.018) }}>
          <span style={{ fontFamily: FONTS.body, fontSize: Math.round(H * 0.03), fontWeight: 600, color: c("text") }}>Tone</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: Math.round(H * 0.016) }}>
            {TONES.map((t, i) => {
              const on = i === 0;
              const op = interpolate(stagger(frame, i, 24, 4, 14), [0, 1], [0, 1], clamp);
              return (
                <span
                  key={t}
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: Math.round(H * 0.028),
                    padding: "8px 14px",
                    borderRadius: 99,
                    opacity: op,
                    background: on ? c("accent") : c("surface"),
                    color: on ? c("bg") : c("textDim"),
                    border: on ? "1px solid transparent" : `1px solid ${c("text", 0.12)}`,
                  }}
                >
                  {t}
                </span>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
