/**
 * The ProductShot STAGE — the cinematic depth rig the hero sits inside.
 *
 * This is the craft layer the dossier (§2 Tier-A, §5) calls for, expressed as
 * pure functions of the Kino frame:
 *
 *  - `useCameraPushIn` — the ONE signature motion: a slow camera dolly toward
 *    the subject on reveal (scale 1 → ~1.06 + a small upward settle), eased on a
 *    single bezier so it reads as "designed", not linear. Every depth layer reads
 *    this same driver, so the whole frame moves as one camera, not as parts.
 *  - `ParallaxLayer` — a depth-tagged layer. Its `depth` (0 = infinitely far,
 *    1 = on the lens) scales how much the push-in and the resting drift move it,
 *    so the background lags the foreground → real parallax separation.
 *  - `DofBackdrop` — the scene `Backdrop` pushed out of focus: a heavy blur +
 *    darken + desaturate + a slow parallax drift, so the shader field reads as
 *    out-of-focus depth behind a racked-in subject (the "DOF blur on bg").
 *  - `ContactShadow` — a soft, blurred elliptical shadow cast on the floor under
 *    the device, anchored to the device, that grows/softens as the camera settles.
 *
 * DETERMINISM (ENGINE_DESIGN §2): every value here is `interpolate`/`spring`
 * evaluated at `useFrame().frame`. No wall-clock, no rAF, no random — the resting
 * "float" is a closed-form `Math.sin(frame/k)`, not an integrator. Two renders of
 * frame N are byte-identical.
 */
import * as React from "react";

import { useFrame, interpolate, spring } from "../../engine";
import { palette } from "../../design";
import { useMotionToken } from "../kit";
import { Backdrop } from "../backgrounds";

/* -------------------------------------------------------------------------- */
/*  Camera push-in — the signature dolly                                       */
/* -------------------------------------------------------------------------- */

/**
 * The camera state for a frame: a `scale` (the dolly), a `lift` (px the camera
 * rises as it settles), and the normalized settle progress `s` in `[0,1]` that
 * every depth layer reads to compute its own parallax.
 */
export type CameraState = {
  /** Dolly scale applied to the whole stage (the push-in). */
  scale: number;
  /** Upward camera settle in px (subtle, reads as the lens finding its mark). */
  lift: number;
  /** Settle progress 0 → 1 (the shared driver for every parallax layer). */
  s: number;
};

/** A slow, designed dolly curve — long ease-out, no linear ramp. */
const PUSH_EASE = (t: number): number => 1 - Math.pow(1 - t, 3); // easeOutCubic

/**
 * The signature camera push-in. Starts at `delay`, eases over `dur` frames from
 * a slightly wide framing into the subject. `from`/`to` bound the dolly scale;
 * the defaults (1.0 → 1.06) are the restrained Apple/Linear slow-dolly amount
 * (restraint cap — the move is felt, never showy).
 */
export const useCameraPushIn = (
  delay = 0,
  dur = 64,
  from = 1.0,
  to = 1.06,
): CameraState => {
  const { frame } = useFrame();
  const s = interpolate(frame - delay, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: PUSH_EASE,
  });
  return {
    scale: from + (to - from) * s,
    lift: (1 - s) * 26, // starts 26px low, rises into frame
    s,
  };
};

/**
 * Wrap the whole stage in the camera. Applies the dolly `scale` + `lift` once,
 * around a fixed origin, so the entire composited frame (bg + device + callouts)
 * dollies as a single camera. The push-in is the video's signature motion; this
 * is the only place it fires inside a ProductShot.
 */
export const Camera: React.FC<
  React.PropsWithChildren<{ cam: CameraState; style?: React.CSSProperties }>
> = ({ cam, style, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      transform: `scale(${cam.scale}) translateY(${-cam.lift}px)`,
      transformOrigin: "50% 46%",
      willChange: "transform",
      ...style,
    }}
  >
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  Parallax depth layers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A depth-tagged layer. `depth` ∈ [0,1]: 0 reads as infinitely far (barely moves
 * with the camera), 1 reads as right on the lens (moves the most). Off the shared
 * camera settle `cam.s` we add a tiny extra push so nearer layers separate from
 * the field as the dolly lands; a closed-form sine adds a resting float once
 * settled (deterministic — `Math.sin(frame/k)`, never an accumulator).
 */
export const ParallaxLayer: React.FC<
  React.PropsWithChildren<{
    cam: CameraState;
    /** 0 = far background, 1 = foreground. */
    depth: number;
    /** Resting float amplitude in px (settles in with the camera). */
    float?: number;
    /** Phase offset so sibling layers don't bob in lockstep. */
    phase?: number;
    style?: React.CSSProperties;
  }>
> = ({ cam, depth, float = 0, phase = 0, style, children }) => {
  const { frame } = useFrame();
  // Nearer layers get an extra forward push as the dolly settles (separation).
  const sep = (depth - 0.5) * 22 * cam.s;
  // Resting bob, gated by the settle so it doesn't fight the entrance.
  const bob = Math.sin(frame / 64 + phase) * float * cam.s;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translateY(${sep + bob}px)`,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Depth-of-field backdrop                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The scene `Backdrop`, racked OUT of focus. A heavy blur + darken + slight
 * desaturate plus an over-scale (so the blur doesn't reveal frame edges) makes
 * the shader field read as out-of-focus depth behind the in-focus device. The
 * focus "racks in" slightly with the camera — the bg blur deepens a touch as the
 * subject lands, the cinematic focus-pull pairing (dossier §5).
 */
export const DofBackdrop: React.FC<{
  cam: CameraState;
  hue?: "accent" | "accent2";
}> = ({ cam, hue = "accent" }) => {
  const { frame } = useFrame();
  const c = palette();
  // Focus pull: blur deepens 14 → 22px as the camera settles.
  const blur = interpolate(cam.s, [0, 1], [14, 22]);
  // The far field barely moves with the camera → counter-scale a hair under the
  // camera's dolly so the background appears to sit much deeper than the subject.
  const bgScale = interpolate(cam.s, [0, 1], [1.12, 1.16]);
  const other: "accent" | "accent2" = hue === "accent" ? "accent2" : "accent";

  // Liquid-gradient drift — two large color blobs ease across the field on a
  // closed-form sine (deterministic), so the bed reads as a slow premium liquid
  // gradient (Stripe/Vercel) instead of a flat dark plate. Pure fn of `frame`.
  const lx = 30 + Math.sin(frame / 120) * 14;
  const ly = 28 + Math.cos(frame / 150) * 12;
  const rx = 72 + Math.cos(frame / 135) * 12;
  const ry = 70 + Math.sin(frame / 165) * 10;

  return (
    <div
      style={{
        position: "absolute",
        inset: -80, // bleed so the blur never exposes a hard edge
        transform: `scale(${bgScale})`,
        transformOrigin: "50% 46%",
        // Softened from the old brightness(0.74) crush: the field stays as DEPTH
        // (blurred + slightly desaturated + a gentle darken) without going flat
        // black — the premium-gradient wash below carries the richness.
        filter: `blur(${blur}px) saturate(0.9) brightness(0.86)`,
        willChange: "filter, transform",
      }}
    >
      {/* No readability scrim: the DOF blur/darken + the wash below already give
          the device its contrast; a scrim would muddy the depth. */}
      <Backdrop hue={hue} scrim={false} />
      {/* Premium liquid-gradient wash — drifting accent blobs over a deep base.
          Composited INSIDE the blur/scale layer so it racks out of focus with the
          field and reads as one continuous bed, not a flat overlay. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "screen",
          background: [
            `radial-gradient(60% 70% at ${lx}% ${ly}%, ${c(hue, 0.34)} 0%, transparent 60%)`,
            `radial-gradient(58% 66% at ${rx}% ${ry}%, ${c(other, 0.26)} 0%, transparent 62%)`,
            `radial-gradient(120% 90% at 50% 8%, ${c("surface", 0.4)} 0%, transparent 55%)`,
          ].join(", "),
        }}
      />
      {/* A low, deep base so the bottom of frame settles into the room without
          banding (paired with the field grain already inside `Backdrop`). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(130% 100% at 50% 120%, ${c("bg", 0.0)} 30%, ${c("bg", 0.55)} 100%)`,
        }}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Contact shadow                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A soft, blurred elliptical contact shadow cast on the floor beneath the
 * device. It grows and softens as the camera settles (the device "lands"), which
 * sells the floating-above-a-surface read without any 3D. Pure CSS radial
 * gradient + blur — captures pixel-identically through the DOM path.
 */
export const ContactShadow: React.FC<{
  /** Width of the casting object (the device chrome) in px. */
  width: number;
  /** Entrance/settle progress 0 → 1 (drives grow + soften). */
  s: number;
  /** Vertical offset of the shadow below the object's bottom, in px. */
  offset?: number;
  style?: React.CSSProperties;
}> = ({ width, s, offset = 36, style }) => {
  const w = width * (0.78 + s * 0.14);
  const h = width * 0.14 * (0.7 + s * 0.3);
  const opacity = interpolate(s, [0, 1], [0, 0.5], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: -offset,
        width: w,
        height: h,
        marginLeft: -w / 2,
        background:
          "radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 38%, transparent 72%)",
        filter: `blur(${28 + s * 12}px)`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
};

/* -------------------------------------------------------------------------- */
/*  Reveal — token-timed entrance for the device (rise + un-blur + settle)      */
/* -------------------------------------------------------------------------- */

/**
 * The device entrance, driven by the active motion token's spring so the rise
 * matches the video's register (calm/standard/punchy). Returns the values the
 * hero plate composes: opacity, a rise in px, an entrance blur, and the spring
 * progress `e`. Separate from the camera push-in: the device RISES into place,
 * then the camera DOLLIES — two readable beats, not one.
 */
export const useDeviceReveal = (
  delay = 0,
): { opacity: number; rise: number; blur: number; e: number } => {
  const { frame, fps } = useFrame();
  const tok = useMotionToken();
  const e = spring({ frame: frame - delay, fps, config: tok.spring, from: 0, to: 1 });
  return {
    opacity: interpolate(e, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
    rise: (1 - e) * 96,
    blur: (1 - Math.min(e * 1.5, 1)) * 10,
    e,
  };
};

/* -------------------------------------------------------------------------- */
/*  Floor — a faint horizon/reflection plane the device sits on                */
/* -------------------------------------------------------------------------- */

/**
 * A barely-there floor plane: a soft horizontal light band + a faint accent
 * wash low in frame, giving the contact shadow a surface to land on so the
 * device reads as standing in a room, not floating in void.
 */
export const Floor: React.FC<{ s: number }> = ({ s }) => {
  const c = palette();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "42%",
        opacity: 0.5 + s * 0.3,
        background: `linear-gradient(180deg, transparent 0%, ${c("bg", 0.0)} 30%, ${c("accent", 0.05)} 100%)`,
        maskImage:
          "radial-gradient(ellipse 70% 100% at 50% 120%, black 0%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 100% at 50% 120%, black 0%, transparent 75%)",
        pointerEvents: "none",
      }}
    />
  );
};
