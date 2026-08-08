/**
 * HeroDevice — the floating product hero: the real screenshot framed in browser
 * chrome, tilted in perspective, lit by an accent glow plate, lifted off a soft
 * contact shadow. This is the focal subject the camera dollies into.
 *
 * Composition (back → front), all pure functions of the Kino frame:
 *  1. Glow plate — a large, soft accent radial behind the device that reads as
 *     the screen's own emitted light spilling onto the scene. Blooms in with the
 *     reveal.
 *  2. Contact shadow — cast on the floor beneath, anchored to the device width
 *     (from `./stage`).
 *  3. The tilted device — `BrowserChrome` (or the seeded `MockUI` fallback) on a
 *     `perspective()` rotateX/rotateY plane, with a specular edge-light hairline.
 *
 * DETERMINISM: the device content is a real `<img>` still or the seeded MockUI;
 * the tilt/rise/glow/shadow are `interpolate`/`spring` at `useFrame().frame`.
 * No video (`OffthreadVideo` banned), no clock, no random. Captures pixel-
 * identically through the DOM-screenshot path.
 */
import * as React from "react";

import { interpolate } from "../../engine";
import { palette } from "../../design";
import { BrowserChrome } from "./chrome";
import { ContactShadow, useDeviceReveal } from "./stage";

export type HeroDeviceProps = {
  /** Resolved still `src`; when absent the seeded MockUI renders. */
  src?: string;
  /** Brand/shot seed for the MockUI fallback + stable element ids. */
  seed: string;
  /** Chrome width in px. */
  width: number;
  /** Address shown in the URL pill. */
  url?: string;
  /** Perspective tilt about X in degrees (from the spec `tilt`, clamped). */
  tiltX?: number;
  /** Perspective tilt about Y in degrees (a touch, for the 3/4 product read). */
  tiltY?: number;
  /** Frame delay before the device reveal begins. */
  delay?: number;
  /** Accent the glow plate uses ("accent" | "accent2"). */
  glow?: "accent" | "accent2";
};

export const HeroDevice: React.FC<HeroDeviceProps> = ({
  src,
  seed,
  width,
  url,
  tiltX = 6,
  tiltY = -7,
  delay = 0,
  glow = "accent",
}) => {
  const c = palette();
  const { opacity, rise, blur, e } = useDeviceReveal(delay);

  // Ken-Burns: a slow inner zoom on the screen content as the shot holds.
  const contentScale = interpolate(e, [0, 1], [1.04, 1.0]);
  // Glow plate blooms in slightly behind the device rise. Capped well under 1:
  // at full bloom the screen-blended plate behind a light-brand card read as a
  // blown-out halo around an empty shell, so the emitted-light effect is kept
  // subtle (a lit room, not a lens flare).
  const glowOpacity = interpolate(e, [0.1, 0.8], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width,
        opacity,
        // The whole device rises + un-blurs into place; the camera then dollies.
        transform: `translateY(${rise}px)`,
        // ALWAYS emit a filter (never `undefined`): toggling the property on/off as
        // `blur` crosses a threshold promotes/demotes the compositing layer, and the
        // frame where the layer is created/destroyed can rasterise a sub-pixel off
        // its neighbour (Chromium layer-boundary snapping — det. review F4). A
        // constant `blur(0px)` at rest pins the layer for the element's lifetime.
        filter: `blur(${Math.max(blur, 0).toFixed(3)}px)`,
        willChange: "transform, opacity, filter",
      }}
    >
      {/* 1 — emitted-light glow plate (behind everything) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          width: width * 1.5,
          height: width * 1.05,
          marginLeft: -(width * 1.5) / 2,
          marginTop: -(width * 1.05) / 2,
          background: `radial-gradient(ellipse at center, ${c(glow, 0.2)} 0%, ${c(glow, 0.06)} 36%, transparent 68%)`,
          filter: "blur(70px)",
          opacity: glowOpacity,
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* 2 — contact shadow on the floor beneath the device */}
      <ContactShadow width={width} s={e} offset={width * 0.05} />

      {/* 3 — the tilted device */}
      <div
        style={{
          position: "relative",
          transform: `perspective(2200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${0.97 + e * 0.03})`,
          transformOrigin: "center",
          transformStyle: "preserve-3d",
        }}
      >
        <BrowserChrome
          src={src}
          seed={seed}
          width={width}
          url={url}
          contentScale={contentScale}
        />
      </div>
    </div>
  );
};
