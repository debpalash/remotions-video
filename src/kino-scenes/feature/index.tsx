/**
 * `src/kino-scenes/feature` — the FEATUREBEAT craft kit (S4).
 *
 * The studio upgrade over "a still beside a caption": a CONSISTENT-LAYOUT
 * UI-region highlight (dossier §2 + ROADMAP §4 "FeatureBeats share a layout —
 * consistency IS the premium tell"):
 *   - the product still sits in a brand-tinted browser-class frame;
 *   - a focus RING sweeps onto a named region inside it, dimming the rest
 *     (spotlight) so the eye lands exactly where the caption points;
 *   - an elbow CONNECTOR draws from the region to a floating glass caption chip;
 *   - an EARCON ripple pulses out of the region center the moment the highlight
 *     "lands" (the earcon feel — a visual transient that reads as a soft tick).
 *
 * The layout is IDENTICAL across every beat in a video; only the region rect,
 * the label, the caption, and the side change. The region rect is DERIVED
 * deterministically from the beat's content (no free coordinates in the
 * contract — `FeatureBeatProps` is `label`/`region`/`caption` only), so two
 * beats look composed-as-a-set, not hand-placed.
 *
 * DETERMINISM (ENGINE_DESIGN §2): every value is a pure function of the Kino
 * frame; the region rect + side come from a brand+content seed via the engine's
 * `seededRandom`, never `Math.random`, never a wall-clock.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2`.
 */
import * as React from "react";

import { useFrame, interpolate, spring, seededRandom } from "../../engine";
import { palette } from "../../design";
import { FONTS, useEnter, useHeadlineStyle, useMotionToken } from "../kit";
import { KineticLine } from "../type";
import { SCREENS, screenFor, type ResuBirdScreenId } from "../productshot/screens";
import { ResuBirdShell, shellBodyBox } from "../productshot/screens/shell";

/* -------------------------------------------------------------------------- */
/*  Region geometry (derived, not authored)                                    */
/* -------------------------------------------------------------------------- */

/** A region rect inside the still, as fractions of the still box [0..1]. */
export type RegionRect = { x: number; y: number; w: number; h: number };

/** The frame the still is drawn in — kept constant across beats (consistency). */
const STILL_W = 980;
const STILL_H = 612;

/** Caption-chip geometry (shared by the balance offset + the connector). */
const CHIP_W = 360;
/** Gap between the still edge and the caption chip. */
const CHIP_GAP = 64;

/** 16:9 frame width + the hard safe margin every element is clamped inside. */
const FRAME_W = 1920;
const SAFE_MARGIN = 80;

/**
 * Derive the focus region from a stable seed by RESOLVING the seed to a real
 * ResuBird screen (`screenFor`), then picking one of THAT screen's own hot-rects
 * (`SCREENS[id].hotRects` — each authored to enclose a concrete, content-full
 * element: the ATS gauge, a checklist, the rewritten bullet, the match meter…).
 * Because the rect comes from the SAME screen that `RegionHighlight` renders, the
 * ring + spotlight are GUARANTEED to land on a real element — never a content-
 * less glow (CD #1). Deterministic per seed; different beats hash to different
 * screens + rects so the tour moves.
 */
const deriveRegion = (
  seed: string,
  explicitScreen?: ResuBirdScreenId,
): {
  screenId: ResuBirdScreenId;
  rect: RegionRect;
  label: string;
  side: "left" | "right";
} => {
  // EXPLICIT screen (set per beat index by the pipeline) wins; `screenFor` is
  // only the deterministic fallback for a beat that named no screen. This is
  // what makes the three beats render three DISTINCT screens — the old path
  // keyword-matched the seed and collapsed every beat onto the ATS gauge.
  const screenId = explicitScreen ?? screenFor(seed);
  const hot = SCREENS[screenId].hotRects;
  const idx = Math.floor(seededRandom(`${seed}:region`)() * hot.length);
  const pick = hot[Math.min(hot.length - 1, idx)];
  // The hot-rects are authored relative to the screen BODY. The beat now renders
  // that body inside the shared `ResuBirdShell` chrome, so the body occupies the
  // shell's body sub-rect — remap each hot-rect through `shellBodyBox()` so the
  // ring still lands on the real element (the shell offset never desyncs it).
  const b = shellBodyBox();
  const r = pick.rect;
  const rect: RegionRect = {
    x: b.x + r.x * b.w,
    y: b.y + r.y * b.h,
    w: r.w * b.w,
    h: r.h * b.h,
  };
  // caption sits on the side with more room (opposite the region's center).
  const side: "left" | "right" = rect.x + rect.w / 2 > 0.5 ? "left" : "right";
  return { screenId, rect, label: pick.label, side };
};

/* -------------------------------------------------------------------------- */
/*  RegionHighlight — the consistent UI-region spotlight                       */
/* -------------------------------------------------------------------------- */

export const RegionHighlight: React.FC<{
  src?: string;
  /** Stable seed for the derived region + mock fallback. */
  seed: string;
  label: string;
  caption: string;
  delay?: number;
  /** Frame the highlight "lands" — drives the earcon ripple + connector draw. */
  landAt?: number;
  /**
   * Which bespoke ResuBird screen this beat renders, set explicitly per beat by
   * the pipeline. When omitted, `deriveRegion` falls back to the seeded pick.
   */
  screenId?: ResuBirdScreenId;
  /** When the still has no real asset, this mock node fills the frame. */
  fallback?: React.ReactNode;
}> = ({ src, seed, label, caption, delay = 0, landAt = 28, screenId: screenIdProp, fallback }) => {
  const { frame, fps } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const head = useHeadlineStyle();
  const tok = useMotionToken();

  const { screenId, rect, side } = React.useMemo(
    () => deriveRegion(seed, screenIdProp),
    [seed, screenIdProp],
  );

  // Ring sweep-in onto the region.
  const ring = spring({ frame: frame - delay - 6, fps, config: tok.spring });
  // Earcon ripple — a single expanding ring when the highlight lands.
  const ripple = interpolate(frame, [landAt, landAt + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const connector = interpolate(frame, [landAt + 4, landAt + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rx = rect.x * STILL_W;
  const ry = rect.y * STILL_H;
  const rw = rect.w * STILL_W;
  const rh = rect.h * STILL_H;

  // CENTERING + HARD SAFE-MARGIN CLAMP (CD #2: callout chips clipped off-edge,
  // "Get an in…"). `SafeCenter` centers the bare `STILL_W` box, but the caption
  // chip lives OUTSIDE that box (`CHIP_GAP + CHIP_W` past the still edge), so the
  // combined still+chip bounding box is lopsided. To re-center the COMBINED bbox
  // we shift the composition AWAY from the chip by half the overhang — the v4
  // code shifted TOWARD the chip (sign inverted), which drove a right-side chip
  // clean off the right frame edge. Then we CLAMP so neither the still nor the
  // chip ever crosses the 80px safe margin, regardless of caption length.
  const boxLeft = (FRAME_W - STILL_W) / 2; // SafeCenter's centered box left edge
  const chipOverhang = CHIP_GAP + CHIP_W;
  let balanceX = (side === "right" ? -1 : 1) * (chipOverhang / 2);
  // Absolute extents of the chip + still at this balance, then clamp to safe area.
  const chipL =
    side === "right" ? boxLeft + STILL_W + CHIP_GAP : boxLeft - CHIP_GAP - CHIP_W;
  const leftMost = Math.min(boxLeft, chipL) + balanceX;
  const rightMost = Math.max(boxLeft + STILL_W, chipL + CHIP_W) + balanceX;
  if (leftMost < SAFE_MARGIN) balanceX += SAFE_MARGIN - leftMost;
  else if (rightMost > FRAME_W - SAFE_MARGIN)
    balanceX -= rightMost - (FRAME_W - SAFE_MARGIN);

  return (
    <div
      style={{
        // The PRODUCT STILL stays OPAQUE from frame 0 (only a short translate
        // rise for life) — the scene-level cross-dissolve handles the fade. The
        // old self-fade-from-0 (with a delay) left the incoming screen near-
        // transparent for the whole 15f dissolve AFTER the outgoing screen had
        // gone → the empty cream "dead frame" at the ATS→Cover cut. Holding the
        // still opaque keeps a real screen on canvas across every transition.
        opacity: 1,
        transform: `translate(${balanceX}px, ${(1 - s) * 28}px)`,
        position: "relative",
        width: STILL_W,
        height: STILL_H,
      }}
    >
      {/* the product still in a glass frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          padding: 3,
          background: `linear-gradient(135deg, ${c("accent", 0.5)}, ${c("text", 0.12)} 38%, transparent 60%, ${c("accent2", 0.4)})`,
          boxShadow: `0 50px 120px rgba(0,0,0,0.6), 0 0 80px ${c("accent", 0.14)}`,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 19, overflow: "hidden", background: c("surface") }}>
          {src ? (
            <img
              src={src}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0 }}>
              {/* The RENDERED screen and the ring RECT are guaranteed the same
                  screen: both resolve from `deriveRegion(seed)` → `screenId`, and
                  the rect is remapped through `shellBodyBox()` so it tracks the
                  body inside the shell. Rendering the FULL `ResuBirdShell` (brand
                  lockup + Upload→Parse→ATS→Build stepper + left nav) makes every
                  beat read as the SAME product — the "one connected product" tell.
                  The `fallback` prop survives only as an optional explicit override. */}
              {fallback ?? (
                <ResuBirdShell width={STILL_W} screen={SCREENS[screenId]} seed={seed} />
              )}
            </div>
          )}
          {/* spotlight: dim the SURROUNDINGS, leave the focal region at its
              true brightness. Two prior bugs on this LIGHT (cream) surface made
              the highlight read WORSE: (1) the scrim was a raw cold rgba crush
              that turned the warm cards muddy grey; (2) the soft, oversized mask
              ramp left a big featureless halo that read as a blown-out white blob
              over the focal content. Fix: a WARM ink scrim (`text` token, not raw
              rgba) at a gentler opacity so dimmed cards stay warm not grey, and a
              TIGHTER mask (clear hole, short ramp) so the focal element sits at
              normal brightness with a crisp boundary — no white bloom. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: c("text"),
              opacity: Math.min(ring, 1) * 0.36,
              maskImage: `radial-gradient(ellipse ${rw * 0.78}px ${rh * 0.86}px at ${rx + rw / 2}px ${ry + rh / 2}px, transparent 0%, transparent 72%, black 97%)`,
              WebkitMaskImage: `radial-gradient(ellipse ${rw * 0.78}px ${rh * 0.86}px at ${rx + rw / 2}px ${ry + rh / 2}px, transparent 0%, transparent 72%, black 97%)`,
            }}
          />
        </div>
      </div>

      {/* focus ring on the region */}
      <div
        style={{
          position: "absolute",
          left: rx + (1 - Math.min(ring, 1)) * (side === "left" ? 60 : -60),
          top: ry,
          width: rw,
          height: rh,
          borderRadius: 14,
          border: `2.5px solid ${c("accent")}`,
          // CRISP ring, no additive bloom. The old `0 0 14px accent` glow drew a
          // bright radial OVER the focal content on the light surface (washing it
          // out); replaced with a thin dark contrast halo so the ring reads as a
          // clean boundary against cream without lifting the content toward white.
          boxShadow: `0 0 0 1.5px ${c("text", 0.14)}, 0 2px 8px ${c("text", 0.18)}`,
          opacity: interpolate(ring, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />
      {/* corner brackets on the ring — a "scanning" frame, the focus tell */}
      {Math.min(ring, 1) > 0.5 ? <Brackets rx={rx} ry={ry} rw={rw} rh={rh} color={c("accent")} /> : null}

      {/* earcon ripple from the region center */}
      <div
        style={{
          position: "absolute",
          left: rx + rw / 2,
          top: ry + rh / 2,
          width: 0,
          height: 0,
          borderRadius: 999,
          border: `2px solid ${c("accent2")}`,
          transform: `translate(-50%,-50%) scale(${ripple * 30})`,
          opacity: (1 - ripple) * 0.7,
        }}
      />

      {/* connector + caption chip on the chosen side */}
      <RegionConnector
        side={side}
        rect={{ rx, ry, rw, rh }}
        stillW={STILL_W}
        draw={connector}
        label={label}
        caption={caption}
        head={head}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Brackets — four corner brackets framing the focus region                   */
/* -------------------------------------------------------------------------- */

const Brackets: React.FC<{ rx: number; ry: number; rw: number; rh: number; color: string }> = ({
  rx,
  ry,
  rw,
  rh,
  color,
}) => {
  const len = 26;
  const t = 3;
  const corner = (x: number, y: number, sx: number, sy: number): React.CSSProperties => ({
    position: "absolute",
    left: x,
    top: y,
    width: len,
    height: len,
    borderTop: sy > 0 ? `${t}px solid ${color}` : undefined,
    borderBottom: sy < 0 ? `${t}px solid ${color}` : undefined,
    borderLeft: sx > 0 ? `${t}px solid ${color}` : undefined,
    borderRight: sx < 0 ? `${t}px solid ${color}` : undefined,
    borderTopLeftRadius: sx > 0 && sy > 0 ? 8 : 0,
    borderTopRightRadius: sx < 0 && sy > 0 ? 8 : 0,
    borderBottomLeftRadius: sx > 0 && sy < 0 ? 8 : 0,
    borderBottomRightRadius: sx < 0 && sy < 0 ? 8 : 0,
  });
  return (
    <>
      <div style={corner(rx - 4, ry - 4, 1, 1)} />
      <div style={corner(rx + rw - len + 4, ry - 4, -1, 1)} />
      <div style={corner(rx - 4, ry + rh - len + 4, 1, -1)} />
      <div style={corner(rx + rw - len + 4, ry + rh - len + 4, -1, -1)} />
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  RegionConnector — elbow line + glass caption chip                          */
/* -------------------------------------------------------------------------- */

const RegionConnector: React.FC<{
  side: "left" | "right";
  rect: { rx: number; ry: number; rw: number; rh: number };
  stillW: number;
  draw: number;
  label: string;
  caption: string;
  head: React.CSSProperties;
}> = ({ side, rect, stillW, draw, label, caption, head }) => {
  const c = palette();
  const { rx, ry, rw, rh } = rect;
  const anchorX = side === "right" ? rx + rw : rx;
  const anchorY = ry + rh / 2;
  const chipX = side === "right" ? stillW + CHIP_GAP : -CHIP_GAP - CHIP_W;
  const chipMidY = anchorY - 30;
  const run = side === "right" ? chipX - anchorX : anchorX - chipX - CHIP_W;

  return (
    <>
      {/* elbow connector: horizontal run that draws out to the chip */}
      <div
        style={{
          position: "absolute",
          left: side === "right" ? anchorX : anchorX - run,
          top: anchorY,
          height: 2,
          width: run * draw,
          background: `linear-gradient(${side === "right" ? "90deg" : "270deg"}, ${c("accent")}, ${c("accent2")})`,
          boxShadow: `0 0 12px ${c("accent", 0.6)}`,
          transformOrigin: side === "right" ? "left" : "right",
        }}
      />
      {/* node dot at the region edge */}
      <div
        style={{
          position: "absolute",
          left: anchorX,
          top: anchorY,
          width: 12,
          height: 12,
          borderRadius: 99,
          background: c("accent"),
          transform: "translate(-50%,-50%)",
          boxShadow: `0 0 16px ${c("accent")}`,
          opacity: draw > 0.05 ? 1 : 0,
        }}
      />
      {/* caption chip */}
      <div
        style={{
          position: "absolute",
          left: chipX,
          top: chipMidY - 16,
          width: CHIP_W,
          opacity: interpolate(draw, [0.5, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateX(${(1 - draw) * (side === "right" ? -20 : 20)}px)`,
          padding: "24px 30px",
          borderRadius: 20,
          textAlign: side === "right" ? "left" : "right",
          border: "1px solid transparent",
          // OPAQUE pre-baked glass plate — NOT a live `backdrop-filter` blur.
          // Under headless SwiftShader a backdrop blur re-rasterises the whole
          // region behind the chip EVERY frame (the dominant FeatureBeat render
          // cost, ~0.6s/frame measured) AND its kernel is not bit-identical
          // frame-to-frame (a flicker/determinism vector). A near-solid
          // surface→bg gradient carries the glass read with no live backdrop to
          // sample — the same proven plate `productshot/callout` uses.
          background: [
            `linear-gradient(160deg, ${c("surface", 0.97)}, ${c("bg", 0.95)}) padding-box`,
            `linear-gradient(135deg, ${c("accent", 0.5)}, ${c("text", 0.06)} 55%, ${c("accent2", 0.28)}) border-box`,
          ].join(", "),
          boxShadow: `inset 0 1px 0 ${c("text", 0.12)}, 0 24px 60px rgba(0,0,0,0.5), 0 0 40px ${c("accent", 0.12)}`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: c("accent"),
            marginBottom: 10,
          }}
        >
          {label}
        </div>
        <div style={{ ...head, fontSize: 32, fontWeight: 600, lineHeight: 1.2 }}>
          <KineticLine
            text={caption}
            delay={0}
            stride={0.9}
            wordGap={3}
            mode="blur"
            emphasis="gradient"
            baseWeight={600}
            align={side === "right" ? "flex-start" : "flex-end"}
            style={{ fontSize: 32, lineHeight: 1.2 }}
          />
        </div>
      </div>
    </>
  );
};
