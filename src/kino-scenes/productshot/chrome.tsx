/**
 * BrowserChrome — the floating browser window that frames the product still.
 *
 * A styled, brand-tinted macOS-class browser chrome (traffic lights + a URL
 * pill) wrapping the screenshot, with a gradient hairline border, deep
 * elevation shadow, and a soft contact shadow cast on the "floor" below. This is
 * the Linear/Vercel "product hero" frame, Tier-A 2.5D per the dossier: the UI
 * stays real DOM (an `<Img>`/`<img>` still, NEVER `OffthreadVideo`), depth is
 * faked with CSS, so it composites + captures pixel-identically through the DOM
 * screenshot path.
 *
 * DETERMINISM: this component is static given its props — it owns no clock, no
 * random. The reveal/parallax/push-in transforms are applied by the parent
 * (`ProductShot`) as pure functions of `frame`. The screen content is either a
 * real still (`<img src>`) or the seeded `<MockUI>` fallback — both deterministic.
 */
import * as React from "react";

import { palette } from "../../design";
import { FONTS } from "../kit";
import { MockUI } from "./mock-ui";

export type BrowserChromeProps = {
  /** Resolved still `src`. When absent/failed, the seeded MockUI renders. */
  src?: string;
  /** Brand-kit seed for the fallback mock (and stable element ids). */
  seed: string;
  /** Chrome width in px (the screen area is width minus the inner padding). */
  width: number;
  /** Address shown in the URL pill — the REAL product URL (`deriveUrl`). */
  url?: string;
  /** Ken-Burns scale applied to the screen content only (slow inner drift). */
  contentScale?: number;
};

const TRAFFIC = ["#ff5f57", "#febc2e", "#28c840"] as const;

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  src,
  seed,
  width,
  // The scene always supplies the REAL product URL (`deriveUrl`); this fallback
  // only guards a direct/standalone use, and is still a plausible app host —
  // never the stock `app.product.com` template tell this rebuild removed.
  url = "app.yourproduct.com/dashboard",
  contentScale = 1,
}) => {
  const c = palette();
  const barH = Math.round(width * 0.044);
  const radius = Math.round(width * 0.016);

  return (
    <div
      style={{
        position: "relative",
        width,
        borderRadius: radius,
        // Gradient hairline border via padding-box / border-box layering.
        padding: 1.5,
        background: `linear-gradient(150deg, ${c("text", 0.5)}, ${c("text", 0.08)} 30%, ${c("accent", 0.18)} 70%, ${c("accent2", 0.32)})`,
        boxShadow: [
          `0 2px 4px ${c("bg", 0.6)}`,
          "0 30px 60px rgba(0,0,0,0.45)",
          "0 80px 160px rgba(0,0,0,0.55)",
          `0 0 120px ${c("accent", 0.1)}`,
        ].join(", "),
      }}
    >
      {/* ACCENT RIM-LIGHT (CD punch-list #8): a soft lit edge down the upper-left
          of the card, as if the scene's key light catches the bezel. Sells the
          depth + light interaction the flat-screenshot read was missing. Pure
          static gradient, pointer-events off — composites identically. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: radius + 1,
          pointerEvents: "none",
          background: `linear-gradient(135deg, ${c("text", 0.34)} 0%, transparent 22%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          borderRadius: radius - 1,
          overflow: "hidden",
          background: c("surface"),
        }}
      >
        {/* Title bar */}
        <div
          style={{
            height: barH,
            display: "flex",
            alignItems: "center",
            padding: `0 ${Math.round(barH * 0.5)}px`,
            gap: barH * 0.28,
            background: `linear-gradient(180deg, ${c("surface", 0.98)}, ${c("bg", 0.85)})`,
            borderBottom: `1px solid ${c("text", 0.06)}`,
          }}
        >
          {/* Traffic lights */}
          <div style={{ display: "flex", gap: barH * 0.18 }}>
            {TRAFFIC.map((color, i) => (
              <div
                key={i}
                style={{
                  width: barH * 0.26,
                  height: barH * 0.26,
                  borderRadius: 99,
                  background: color,
                  boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,0.2)`,
                }}
              />
            ))}
          </div>
          {/* URL pill */}
          <div
            style={{
              flex: 1,
              maxWidth: width * 0.5,
              margin: "0 auto",
              height: barH * 0.56,
              borderRadius: 99,
              background: c("bg", 0.55),
              border: `1px solid ${c("text", 0.07)}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: FONTS.mono,
              fontSize: barH * 0.3,
              color: c("textDim"),
              letterSpacing: "0.01em",
            }}
          >
            {/* lock glyph */}
            <svg
              width={barH * 0.3}
              height={barH * 0.3}
              viewBox="0 0 24 24"
              fill="none"
              stroke={c("textDim")}
              strokeWidth={2.4}
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {url}
          </div>
          {/* right spacer to balance the traffic lights */}
          <div style={{ width: barH * 1.2 }} />
        </div>

        {/* Screen content */}
        <div style={{ position: "relative", lineHeight: 0 }}>
          <div
            style={{
              transform: `scale(${contentScale})`,
              transformOrigin: "center top",
            }}
          >
            {src ? (
              <img
                src={src}
                alt=""
                style={{ display: "block", width, height: "auto" }}
              />
            ) : (
              <MockUI seed={seed} width={width} />
            )}
          </div>
          {/* Top sheen — a thin light gradient that reads as glass/screen glare. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(180deg, ${c("text", 0.07)} 0%, transparent 14%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
