/**
 * `screens/shell.tsx` — `ResuBirdShell`, the FIXED app chrome wrapping any one
 * screen body. The top bar (brand + stepper + file chip) and the left nav are
 * BYTE-IDENTICAL across all three screens; only the active step/nav, the header
 * title, the status pill, and the body differ. That constancy is the
 * distinctiveness lever: a screen change reads as deliberate navigation inside
 * ONE product, never as a glitch between three unrelated mocks.
 *
 * DETERMINISM/PERF: pure layout (no per-frame work of its own), OPAQUE fills,
 * no backdrop-filter/blur, palette tokens only.
 */
import * as React from "react";

import { palette } from "../../../design";
import { FONTS } from "../../kit";
import { Stepper, NavRail, StatusPill } from "./primitives";
import type { ScreenSpec } from "./index";

/**
 * The shell's fixed layout fractions. `top`/`header` are fractions of the shell
 * HEIGHT (H); `nav`/`pad`/`gap` are fractions of the shell WIDTH (W). The header
 * band is a FIXED height (not content-sized) so the body sub-rect is a closed-
 * form constant — `shellBodyBox()` below maps a screen's body-relative hot-rect
 * into still coordinates so the FeatureBeat focus ring lands on the right element
 * even though the shell chrome now offsets the body.
 */
export const SHELL_LAYOUT = {
  top: 0.12,
  nav: 0.16,
  pad: 0.03,
  gap: 0.021, // 0.7 * pad
  header: 0.09,
} as const;

/** Shell aspect ratio (H / W). The body box mixes W- and H-relative insets. */
const SHELL_RATIO = 0.62;

/**
 * The body sub-rectangle (where a screen renders) as fractions of the STILL box:
 * `x`/`w` are fractions of width, `y`/`h` of height. Used to remap a screen's
 * body-relative hot-rects into still space when the body sits inside the shell.
 */
export const shellBodyBox = (): { x: number; y: number; w: number; h: number } => {
  const padH = SHELL_LAYOUT.pad / SHELL_RATIO; // W-pad expressed in H units
  const gapH = SHELL_LAYOUT.gap / SHELL_RATIO;
  const y = SHELL_LAYOUT.top + padH + SHELL_LAYOUT.header + gapH;
  return {
    x: SHELL_LAYOUT.nav + SHELL_LAYOUT.pad,
    w: 1 - SHELL_LAYOUT.nav - 2 * SHELL_LAYOUT.pad,
    y,
    h: 1 - y - padH,
  };
};

export const ResuBirdShell: React.FC<{
  width: number;
  screen: ScreenSpec;
  seed: string;
}> = ({ width, screen, seed }) => {
  const c = palette();
  const W = width;
  const H = Math.round(W * SHELL_RATIO);
  const topH = Math.round(H * SHELL_LAYOUT.top);
  const navW = Math.round(W * SHELL_LAYOUT.nav);
  const pad = Math.round(W * SHELL_LAYOUT.pad);
  const headerH = Math.round(H * SHELL_LAYOUT.header);

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        // OPAQUE warm surface — the device screen-blend bloom can never wash it.
        background: `linear-gradient(160deg, ${c("surface")}, ${c("bg")})`,
        fontFamily: FONTS.body,
      }}
    >
      {/* ---------------------------------------------------------------- TOP BAR */}
      <div
        style={{
          height: topH,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${pad}px`,
          background: c("surface"),
          borderBottom: `1px solid ${c("text", 0.08)}`,
        }}
      >
        {/* brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(H * 0.018) }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              background: `linear-gradient(135deg, ${c("accent")}, ${c("accent2")})`,
            }}
          />
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: Math.round(H * 0.04),
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: c("text"),
            }}
          >
            ResuBird
          </span>
        </div>

        {/* stepper */}
        <Stepper active={screen.step} u={H} />

        {/* file chip + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(H * 0.016) }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: Math.round(H * 0.012),
              padding: `${Math.round(H * 0.012)}px ${Math.round(H * 0.018)}px`,
              borderRadius: 8,
              background: c("bg"),
              border: `1px solid ${c("text", 0.1)}`,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.round(H * 0.026),
                color: c("textDim"),
                whiteSpace: "nowrap",
              }}
            >
              resume.pdf
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.round(H * 0.022),
                fontWeight: 700,
                color: c("bg"),
                background: c("accent"),
                borderRadius: 4,
                padding: "2px 5px",
              }}
            >
              PDF
            </span>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              background: `linear-gradient(135deg, ${c("accent2")}, ${c("accent")})`,
            }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- LOWER ROW */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* left nav */}
        <div
          style={{
            width: navW,
            flexShrink: 0,
            background: c("bg"),
            borderRight: `1px solid ${c("text", 0.1)}`,
            padding: Math.round(pad * 0.6),
            boxSizing: "border-box",
          }}
        >
          <NavRail active={screen.nav} u={H} />
        </div>

        {/* content */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: pad,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: Math.round(pad * 0.7),
          }}
        >
          {/* header band — FIXED height so the body sub-rect (shellBodyBox) is
              a closed-form constant the FeatureBeat ring remap can rely on. */}
          <div
            style={{
              height: headerH,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: FONTS.display,
                fontSize: Math.round(H * 0.045),
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: c("text"),
              }}
            >
              {screen.title}
            </span>
            <StatusPill text={screen.status} u={H} />
          </div>

          {/* body */}
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            {screen.render({ seed, width: W })}
          </div>
        </div>
      </div>
    </div>
  );
};
