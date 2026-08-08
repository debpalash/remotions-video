/**
 * GlassCallout — a floating glass/gradient-border feature card with a connector
 * line that draws from the card to the UI region it annotates.
 *
 * The card uses the `backdrop-filter` glass + gradient-border trick (dossier
 * §2 Tier A) and animates in token-timed: first the connector LINE draws toward
 * its target (SVG `strokeDashoffset`, a pure function of frame), then a target
 * dot pulses on, then the card itself rises + un-blurs. Everything is anchored
 * to a corner of the device, never free-positioned — and the connector geometry
 * is derived from the anchor so the LLM never supplies raw coordinates.
 *
 * DETERMINISM: every animated value is `interpolate(spring|frame)` from the Kino
 * frame. The connector "draw" is `strokeDashoffset` interpolated over a fixed
 * frame window. No time, no random, no CSS transition/keyframe.
 */
import * as React from "react";

import { useFrame, interpolate } from "../../engine";
import { palette } from "../../design";
import { FONTS, Glyph, useEnter } from "../kit";
import type { PaletteKey } from "../../spec";

/* The accent key a callout may reference (PaletteKey subset). */
type CalloutAccent = "accent" | "accent2" | "text";
const ACCENT_KEY: Record<CalloutAccent, PaletteKey> = {
  accent: "accent",
  accent2: "accent2",
  text: "text",
};

export type CalloutAnchor = "tl" | "tr" | "bl" | "br";

/**
 * The connector goes from the card toward the device. For a card pinned to a
 * given corner, the line emerges from its *inner* edge (toward screen center)
 * and ends on a target dot over the UI. `dir` encodes which way the line and the
 * card's internal layout point.
 */
const CONNECTOR: Record<
  CalloutAnchor,
  { hSign: number; vSign: number }
> = {
  tl: { hSign: 1, vSign: 1 },
  tr: { hSign: -1, vSign: 1 },
  bl: { hSign: 1, vSign: -1 },
  br: { hSign: -1, vSign: -1 },
};

export type GlassCalloutProps = {
  delay: number;
  icon: string;
  title: string;
  sub?: string;
  accent: CalloutAccent;
  anchor: CalloutAnchor;
  /** Absolute placement inset (computed by the parent from the anchor). */
  placement: React.CSSProperties;
  /** Connector length toward the device, in px. */
  reach?: number;
};

export const GlassCallout: React.FC<GlassCalloutProps> = ({
  delay,
  icon,
  title,
  sub,
  accent,
  anchor,
  placement,
  reach = 150,
}) => {
  const { frame } = useFrame();
  const c = palette();
  const accKey = ACCENT_KEY[accent];
  const s = useEnter(delay + 8); // card enters AFTER the connector starts drawing
  const local = frame - delay;

  // Connector draw: 0 → 1 over a fixed window after the scene-relative delay.
  const draw = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Target dot pulse, eased in once the line lands.
  const dot = interpolate(local, [14, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dir = CONNECTOR[anchor];
  // Gentle, deterministic float once settled (sine of scene-relative frame).
  const float = Math.sin(local / 24) * 5 * Math.min(s, 1);

  const cardOpacity = interpolate(s, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // SVG connector box sits adjacent to the card on its inner side.
  const svgW = reach;
  const svgH = reach * 0.7;
  const startX = dir.hSign > 0 ? 0 : svgW;
  const endX = dir.hSign > 0 ? svgW : 0;
  const startY = dir.vSign > 0 ? 0 : svgH;
  const endY = dir.vSign > 0 ? svgH : 0;
  // A soft elbow: out horizontally, then diagonal to the target.
  const midX = startX + (endX - startX) * 0.5;
  const linePath = `M ${startX} ${startY} L ${midX} ${startY} L ${endX} ${endY}`;
  const lineLen = Math.hypot(midX - startX, 0) + Math.hypot(endX - midX, endY - startY);

  return (
    <div
      style={{
        position: "absolute",
        ...placement,
        opacity: cardOpacity,
        transform: `translateY(${(1 - s) * 30 + float}px)`,
        // Container holds the card; the connector is an overflow-visible sibling.
        pointerEvents: "none",
      }}
    >
      {/* Connector + target dot, drawn toward the device from the inner edge. */}
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{
          position: "absolute",
          [dir.hSign > 0 ? "left" : "right"]: "100%",
          [dir.vSign > 0 ? "top" : "bottom"]: "20%",
          overflow: "visible",
          opacity: draw > 0 ? 1 : 0,
        }}
      >
        <path
          d={linePath}
          fill="none"
          stroke={c(accKey, 0.6)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={lineLen}
          strokeDashoffset={lineLen * (1 - draw)}
        />
        {/* Target dot over the UI region. */}
        <circle
          cx={endX}
          cy={endY}
          r={5 + dot * 2}
          fill={c(accKey)}
          opacity={dot}
        />
        <circle
          cx={endX}
          cy={endY}
          r={5 + dot * 10}
          fill="none"
          stroke={c(accKey, 0.4 * (1 - dot))}
          strokeWidth={2}
          opacity={dot}
        />
      </svg>

      {/* The glass card. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 22px",
          borderRadius: 18,
          minWidth: 240,
          // gradient-border trick: padding-box fill + border-box gradient.
          // NOTE: no `backdrop-filter`. A live backdrop blur samples the ANIMATED
          // shader field behind the card at composite time, and headless
          // SwiftShader's blur kernel is not guaranteed bit-identical frame-to-
          // frame — the single biggest residual ProductShot flicker vector (det.
          // review F1). The fill is an OPAQUE pre-baked plate instead: a near-solid
          // surface→bg gradient carries the glass read deterministically, no live
          // backdrop to sample.
          border: "1px solid transparent",
          background: [
            `linear-gradient(160deg, ${c("surface", 0.97)}, ${c("bg", 0.95)}) padding-box`,
            `linear-gradient(135deg, ${c(accKey, 0.55)}, ${c("text", 0.06)} 55%, ${c(accKey, 0.22)}) border-box`,
          ].join(", "),
          boxShadow: `inset 0 1px 0 ${c("text", 0.14)}, 0 24px 50px rgba(0,0,0,0.5), 0 0 40px ${c(accKey, 0.12)}`,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: c(accKey, 0.16),
            border: `1px solid ${c(accKey, 0.28)}`,
            boxShadow: `inset 0 1px 0 ${c("text", 0.16)}`,
          }}
        >
          <Glyph name={icon} size={25} color={c(accKey)} />
        </div>
        <div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: c("text"),
              lineHeight: 1.1,
            }}
          >
            {title}
          </div>
          {sub ? (
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 18,
                color: c("textDim"),
                marginTop: 4,
                lineHeight: 1.2,
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
