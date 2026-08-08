/**
 * KINO SCENE KIT — shared, frame-driven primitives for the 7 archetypes.
 *
 * Ported from the `src/promo` look (Backdrop / Pop / Kicker / Callout /
 * ScreenFrame / Counter) but rendered entirely on the **Kino runtime**:
 *  - time comes from `useFrame()` (`src/engine`) — never Remotion, never a
 *    wall-clock, never `requestAnimationFrame`/`Date.now`/`Math.random`;
 *  - color comes from the threaded `Palette` via `palette()` (`src/design`) —
 *    never an `import {COLORS}` const, never a raw hex in a scene;
 *  - motion comes from the `MotionToken` the active `Motion` id resolves to
 *    (`src/design`) — entrances are token-timed, exits are always shorter than
 *    entrances (asymmetry), and exactly one signature motion fires per video
 *    (S3 ProductShot reveal + S7 CTA).
 *
 * Everything here is a PURE function of the current frame. Sine-based ambient
 * drift (aurora orbs, float, light sweep) is `Math.sin(frame/k)` — deterministic
 * and identical across parallel frame-capture workers.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2/§4/§5`.
 */
import * as React from "react";
import { icons as LUCIDE_ICONS } from "lucide-react";

import { useFrame, interpolate, spring, seededRandom } from "../engine";
import {
  palette,
  useMotion,
  usePalette,
  motionToken,
  signatureFor,
  type SignatureMotion,
} from "../design";
import type { PaletteKey } from "../spec";

/* -------------------------------------------------------------------------- */
/*  Type tokens (font stacks)                                                  */
/*                                                                             */
/*  The preset's full TypeTokens aren't threaded through the render context    */
/*  (the host wraps the tree in `PaletteProvider palette+motion` only), so the */
/*  kit pins the shared display/body/mono stacks the four presets draw from    */
/*  (`src/design/presets.ts`, mirrored from `promo/theme.ts:FONTS`). These are */
/*  the same variable faces the repo already loads; no new font dependency.    */
/* -------------------------------------------------------------------------- */

export const FONTS = {
  display: "'Space Grotesk Variable', sans-serif",
  body: "'Inter Variable', sans-serif",
  mono: "'JetBrains Mono Variable', monospace",
} as const;

/* -------------------------------------------------------------------------- */
/*  Layout helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Full-frame absolute layer (Kino has no Remotion `<AbsoluteFill>`). */
export const Fill: React.FC<
  React.PropsWithChildren<{ style?: React.CSSProperties }>
> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Centered column. */
export const Center: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Fill
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
    }}
  >
    {children}
  </Fill>
);

/* -------------------------------------------------------------------------- */
/*  Safe-zone — the SINGLE source of truth for where the caption band lives     */
/*  and the clear region scene content must center within (so headlines/viz/    */
/*  devices never collide with the burned-in captions). `CaptionBand` and every */
/*  archetype read these so the band never sits ON a callout/device, and the    */
/*  optical center is computed against the CLEAR area, not the raw frame.        */
/* -------------------------------------------------------------------------- */

/**
 * The height (px, at native 1080p stage) reserved at the BOTTOM of a 16:9 frame
 * for the caption band + its breathing room. Scene content must stay above
 * `1080 - CAPTION_RESERVE_16x9`. Derived from the band geometry in
 * `captions/CaptionBand` (bottom inset + plate height + a clear gap): the band
 * baseline sits at ~bottom:88 with an ~84px plate → ~172px occupied; we reserve
 * a touch more so content never crowds the plate's top hairline.
 */
export const CAPTION_RESERVE_16x9 = 210;

/**
 * OPTICALLY-centered column — the grid the CD punch-list demands.
 *
 * Geometric centering reads as slightly LOW to the eye (the visual weight of a
 * headline block sits below its bbox center). We nudge the content up so it sits
 * on the optical center, and pin a generous symmetric horizontal gutter so type
 * is centered on a real measure, never floating off to one side.
 *
 * CRITICAL (caption-safe): the centering box is the frame MINUS the caption
 * reserve at the bottom, so a tall block centers in the CLEAR region above the
 * band and never collides with the burned-in captions. We do this with a bottom
 * padding equal to the reserve (the flex `center` then balances within the
 * remaining height) rather than a blunt `translateY`, so content of any height
 * stays optically centered AND clear of the band.
 *
 * `lift` is an extra upward nudge for fine-tuning (kept small now that the
 * caption reserve does the heavy lifting); `gutter` is the symmetric side inset.
 */
export const OpticalCenter: React.FC<
  React.PropsWithChildren<{
    lift?: number;
    gutter?: number;
    /** Bottom reserve for the caption band; defaults to the 16:9 band zone. */
    reserveBottom?: number;
  }>
> = ({ children, lift = 0, gutter = 160, reserveBottom = CAPTION_RESERVE_16x9 }) => (
  <Fill
    style={{
      // border-box is LOAD-BEARING: the layer is `height:100%` (1080) and the
      // bottom reserve is padding — without border-box the padding ADDS to the
      // 100% height (total 1290), the flex content box stays 1080, and the
      // content centers in the FULL frame (ignoring the reserve → collides with
      // captions). border-box subtracts the padding from the 100% height so the
      // content centers in the CLEAR region above the band.
      boxSizing: "border-box",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      padding: `0 ${gutter}px`,
      paddingBottom: reserveBottom,
      transform: lift ? `translateY(${-lift}px)` : undefined,
    }}
  >
    {children}
  </Fill>
);

/**
 * Like `OpticalCenter` but centers ANY content (not just a kit column) within
 * the caption-clear region — used by scenes that build their own block (Problem,
 * Proof, FeatureBeat, ProductShot device) and just need the vertical clear-zone
 * centering without the column flex defaults.
 */
export const SafeCenter: React.FC<
  React.PropsWithChildren<{ reserveBottom?: number; padX?: number }>
> = ({ children, reserveBottom = CAPTION_RESERVE_16x9, padX = 0 }) => (
  <Fill
    style={{
      // border-box: see `OpticalCenter` — the bottom reserve must subtract from
      // the 100%-height layer, not add to it, or the content centers in the full
      // frame and collides with the caption band.
      boxSizing: "border-box",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      paddingBottom: reserveBottom,
      paddingLeft: padX,
      paddingRight: padX,
    }}
  >
    {children}
  </Fill>
);

/* -------------------------------------------------------------------------- */
/*  Motion-token helpers (entrances are token-timed; exits < entrances)        */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the active `MotionToken` once. Centralizes the `useMotion()` read so
 * every primitive's entrance shares the same spring/enter/exit register.
 */
export const useMotionToken = () => motionToken(useMotion());

/**
 * A brand-stable, frame-independent seed. Derived from the palette accent (a
 * per-brand constant threaded as data), so decorative "randomness" — bar
 * baselines, sparkline shapes, logo-wall settle — is identical across every
 * frame and every parallel capture worker, yet varies per brand. Never touches
 * `Math.random`; uses the engine's `seededRandom` (Mulberry32). The returned
 * sampler is memoised so repeated draws within one render are stable.
 */
export const useSeeded = (salt = ""): (() => number) => {
  const pal = usePalette();
  return React.useMemo(
    () => seededRandom(`${pal.accent}|${pal.accent2 ?? ""}|${salt}`),
    [pal.accent, pal.accent2, salt],
  );
};

/**
 * Entrance progress in `[0,1]`, settled by the active motion token's spring.
 * `delay` shifts the start; `frame` is read from the Kino frame context.
 */
export const useEnter = (delay = 0): number => {
  const { frame, fps } = useFrame();
  const tok = useMotionToken();
  return spring({
    frame: frame - delay,
    fps,
    config: tok.spring,
    from: 0,
    to: 1,
  });
};

/**
 * Exit progress in `[0,1]` over the token's (shorter-than-enter) `exit` window,
 * starting `exit` frames before the sequence ends. Returns 0 until the tail.
 * The asymmetry is structural: `tok.exit < tok.enter` always (motion tokens).
 */
export const useExit = (): number => {
  const { frame, durationInFrames } = useFrame();
  const tok = useMotionToken();
  if (!Number.isFinite(durationInFrames)) return 0;
  const start = durationInFrames - tok.exit;
  return interpolate(frame, [start, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

/* -------------------------------------------------------------------------- */
/*  Background — the BgTreatment (aurora/grain/vignette), frame-driven         */
/*                                                                             */
/*  Ported from `promo/ui.tsx:Backdrop`. Colors are palette tokens (no hex).   */
/*  Aurora orbs drift via `Math.sin(frame/k)` — deterministic. Grain is a      */
/*  static SVG noise tile offset by frame (kills 8-bit banding on the field).  */
/* -------------------------------------------------------------------------- */

const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E")`;

/**
 * Cinematic field: aurora orbs (accent + accent2) + drifting grid + film grain
 * + vignette. `hue` swaps the dominant orb between the two accents so adjacent
 * scenes can alternate without introducing an off-token color.
 */
export const Backdrop: React.FC<{ hue?: "accent" | "accent2" }> = ({
  hue = "accent",
}) => {
  const { frame } = useFrame();
  const c = palette();
  const drift = frame * 0.3;
  const orbX = Math.sin(frame / 70) * 120;
  const orbY = Math.cos(frame / 90) * 70;
  const glow: PaletteKey = hue;
  const other: PaletteKey = hue === "accent" ? "accent2" : "accent";
  return (
    <Fill style={{ backgroundColor: c("bg"), overflow: "hidden" }}>
      {/* aurora orbs */}
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 900,
          left: 310 + orbX,
          top: 620 + orbY,
          background: `radial-gradient(ellipse at center, ${c(glow, 0.19)} 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1000,
          height: 700,
          right: -200 - orbX * 0.6,
          top: -260,
          background: `radial-gradient(ellipse at center, ${c(other, 0.14)} 0%, transparent 62%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 600,
          left: -180 + orbX * 0.4,
          top: -200,
          background: `radial-gradient(ellipse at center, ${c("surface", 0.5)} 0%, transparent 65%)`,
          filter: "blur(40px)",
        }}
      />
      {/* grid (drift via frame, masked to center) */}
      <Fill
        style={{
          backgroundImage: `linear-gradient(${c("text", 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${c("text", 0.045)} 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          maskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 65% at 50% 45%, black 25%, transparent 100%)",
        }}
      />
      {/* film grain (mandatory on the aurora field — anti-banding) */}
      <Fill
        style={{
          backgroundImage: GRAIN_URI,
          backgroundPosition: `${(frame % 6) * 40}px ${(frame % 5) * 53}px`,
          opacity: 0.055,
          mixBlendMode: "overlay",
        }}
      />
      {/* vignette */}
      <Fill
        style={{
          background:
            "radial-gradient(ellipse 115% 95% at 50% 48%, transparent 52%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </Fill>
  );
};

/* -------------------------------------------------------------------------- */
/*  Pop — token-timed entrance wrapper (blur-in + rise + settle)               */
/* -------------------------------------------------------------------------- */

/**
 * Generic entrance wrapper. The spring + feel come from the active motion
 * token, so `calm`/`standard`/`punchy` re-time every entrance in the video at
 * once. `from` is the rise distance in px. An optional `exit` fade lets a
 * trailing element dismiss faster than it arrived (asymmetry).
 */
export const Pop: React.FC<
  React.PropsWithChildren<{
    delay?: number;
    from?: number;
    style?: React.CSSProperties;
    withExit?: boolean;
  }>
> = ({ delay = 0, from = 40, style, withExit = false, children }) => {
  const s = useEnter(delay);
  const exit = useExit();
  const enterOpacity = interpolate(s, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });
  const opacity = withExit ? enterOpacity * (1 - exit) : enterOpacity;
  return (
    <div
      style={{
        opacity,
        filter: `blur(${(1 - Math.min(s * 1.4, 1)) * 8}px)`,
        transform: `translateY(${(1 - s) * from - exit * 24}px) scale(${0.94 + s * 0.06})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Headline emphasis — `*marked*` span lifts into the gradient pair           */
/* -------------------------------------------------------------------------- */

/** The two-stop gradient-text style, from the palette's `gradientText` pair. */
export const useGradientText = (): React.CSSProperties => {
  const pal = usePalette();
  const [a, b] = pal.gradientText ?? [pal.accent, pal.accent2 ?? pal.accent];
  return {
    backgroundImage: `linear-gradient(100deg, ${a} 0%, ${b} 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };
};

/**
 * Render a headline string, lifting a single `*marked*` span into the signature
 * gradient. The one emphasis affordance copy controls — no raw color leaks in.
 */
export const Headline: React.FC<{ text: string }> = ({ text }) => {
  const grad = useGradientText();
  return (
    <>
      {text.split(/\*(.+?)\*/).map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={grad}>
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  StaggerLine — per-word kinetic entrance (Hook)                             */
/* -------------------------------------------------------------------------- */

/**
 * Word-by-word kinetic line. Each word springs in on its own delayed clock
 * (`frame - delay - i*perWord`), all from the active motion token's spring, so
 * the stagger feel matches the video's register. Pure function of the frame.
 */
export const StaggerLine: React.FC<{
  words: string[];
  delay: number;
  perWord?: number;
  style?: React.CSSProperties;
}> = ({ words, delay, perWord = 4, style }) => {
  const { frame, fps } = useFrame();
  const tok = useMotionToken();
  return (
    <div style={{ display: "flex", gap: "0.28em", justifyContent: "center" }}>
      {words.map((w, i) => {
        const s = spring({
          frame: frame - delay - i * perWord,
          fps,
          config: tok.spring,
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(s, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              filter: `blur(${(1 - Math.min(s * 1.5, 1)) * 10}px)`,
              transform: `translateY(${(1 - s) * 60}px)`,
              ...style,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Kicker — small mono pill label                                            */
/* -------------------------------------------------------------------------- */

export const Kicker: React.FC<
  React.PropsWithChildren<{ delay?: number }>
> = ({ children, delay = 0 }) => {
  const c = palette();
  return (
    <Pop delay={delay} from={20}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 28px",
          borderRadius: 999,
          border: `1px solid ${c("accent", 0.4)}`,
          background: `linear-gradient(180deg, ${c("accent", 0.14)}, ${c("accent", 0.06)})`,
          boxShadow: `inset 0 1px 0 ${c("text", 0.14)}, 0 0 28px ${c("accent", 0.14)}`,
          // CD #10: a CRISPER eyebrow — brighter (near-accent, not dim), SMALLER,
          // with slightly looser-but-controlled tracking. Reads like Linear/Apple.
          color: c("accent", 0.95),
          fontFamily: FONTS.mono,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: c("accent2"),
            boxShadow: `0 0 14px ${c("accent2")}`,
          }}
        />
        {children}
      </div>
    </Pop>
  );
};

/* -------------------------------------------------------------------------- */
/*  Icon glyph (lucide, inline tree-shakeable SVG)                            */
/* -------------------------------------------------------------------------- */

const toPascal = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");

/**
 * Aliases for lucide icons RENAMED across versions. lucide-react moved its
 * `*Circle` / `*Triangle` / `*Square` suffix families to `Circle*` / `Triangle*`
 * / `Square*` PREFIX names, so a director (or older copy bank) asking for the old
 * name silently missed `LUCIDE_ICONS` and the card printed the RAW kebab string
 * (the "check-circle" text artifact on the v6 callouts). Mapped here PascalCase →
 * current PascalCase. Resolution order: exact → alias → safe default.
 */
const ICON_ALIASES: Record<string, string> = {
  CheckCircle: "CircleCheck",
  CheckCircle2: "CircleCheck",
  XCircle: "CircleX",
  AlertCircle: "CircleAlert",
  AlertTriangle: "TriangleAlert",
  HelpCircle: "CircleHelp",
  PauseCircle: "CirclePause",
  PlayCircle: "CirclePlay",
  StopCircle: "CircleStop",
  PlusCircle: "CirclePlus",
  MinusCircle: "CircleMinus",
  ArrowRightCircle: "CircleArrowRight",
  Edit: "Pencil",
  Edit2: "Pencil",
  Edit3: "PenLine",
};

/** The never-fails fallback glyph — a neutral mark, NEVER raw text. */
const FALLBACK_ICON = "Sparkles";

/**
 * Render a lucide icon by kebab/snake name. FAIL-SAFE: an unknown or renamed
 * name resolves through `ICON_ALIASES`, then degrades to a neutral default
 * glyph — it NEVER renders the raw name string into the UI.
 */
export const Glyph: React.FC<{ name: string; size: number; color: string }> = ({
  name,
  size,
  color,
}) => {
  const icons = LUCIDE_ICONS as Record<string, React.ComponentType<any>>;
  const pascal = toPascal(name);
  const Cmp = icons[pascal] ?? icons[ICON_ALIASES[pascal] ?? ""] ?? icons[FALLBACK_ICON];
  return (
    <Cmp size={size} color={color} strokeWidth={2.25} absoluteStrokeWidth />
  );
};

/* -------------------------------------------------------------------------- */
/*  Callout — floating glass feature chip (anchored, not free-positioned)     */
/* -------------------------------------------------------------------------- */

/** Map a spec accent key → palette resolver key. */
const ACCENT_KEY: Record<"accent" | "accent2" | "text", PaletteKey> = {
  accent: "accent",
  accent2: "accent2",
  text: "text",
};

export const Callout: React.FC<{
  delay: number;
  icon: string;
  title: string;
  sub?: string;
  accent: "accent" | "accent2" | "text";
  style?: React.CSSProperties;
}> = ({ delay, icon, title, sub, accent, style }) => {
  const { frame } = useFrame();
  const s = useEnter(delay);
  const c = palette();
  const accKey = ACCENT_KEY[accent];
  const float = Math.sin((frame - delay) / 22) * 6;
  return (
    <div
      style={{
        position: "absolute",
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - s) * 60 + float}px) scale(${0.9 + s * 0.1})`,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "20px 30px",
        borderRadius: 20,
        background: `linear-gradient(160deg, ${c("surface", 0.92)}, ${c("bg", 0.88)})`,
        border: `1px solid ${c(accKey, 0.31)}`,
        boxShadow: `inset 0 1px 0 ${c("text", 0.14)}, 0 24px 60px rgba(0,0,0,0.55), 0 0 44px ${c(accKey, 0.13)}`,
        backdropFilter: "blur(16px)",
        ...style,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: c(accKey, 0.15),
          border: `1px solid ${c(accKey, 0.27)}`,
          boxShadow: `inset 0 1px 0 ${c("text", 0.15)}`,
        }}
      >
        <Glyph name={icon} size={30} color={c(accKey)} />
      </div>
      <div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: c("text"),
          }}
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 21,
              color: c("textDim"),
              marginTop: 3,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  ScreenFrame — product still in a glowing glass frame (Ken Burns + sweep)   */
/*                                                                             */
/*  `screen` is an asset KEY → resolves to a still/Img `src`, NEVER a video    */
/*  (`OffthreadVideo` is banned). Renders a plain <img>; on the host the asset */
/*  resolver maps the key to a real URL before render.                         */
/* -------------------------------------------------------------------------- */

/** Resolve a `screen` asset key → an image `src`. Bare keys default to `.webp`. */
export const resolveAsset = (key: string): string =>
  /\.[a-z0-9]+$/i.test(key) ? key : `${key}.webp`;

export const ScreenFrame: React.FC<{
  src: string;
  delay?: number;
  tilt?: number;
  zoomFrom?: number;
  zoomTo?: number;
  style?: React.CSSProperties;
}> = ({ src, delay = 0, tilt = 0, zoomFrom = 1, zoomTo = 1.06, style }) => {
  const { frame, durationInFrames } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const span = Number.isFinite(durationInFrames) ? durationInFrames : 120;
  const kenBurns = interpolate(frame, [0, span], [zoomFrom, zoomTo]);
  const sweepX = interpolate(frame - delay, [16, 58], [-45, 145], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `perspective(1600px) rotateX(${tilt}deg) translateY(${(1 - s) * 90}px) scale(${0.96 + s * 0.04})`,
        borderRadius: 24,
        padding: 3,
        background: `linear-gradient(135deg, ${c("accent", 0.6)}, ${c("text", 0.14)} 35%, transparent 55%, ${c("accent2", 0.47)})`,
        boxShadow: `0 60px 140px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.45), 0 0 100px ${c("accent", 0.18)}`,
        ...style,
      }}
    >
      <div
        style={{ borderRadius: 21, overflow: "hidden", position: "relative" }}
      >
        <img
          src={src}
          alt=""
          style={{
            display: "block",
            width: "100%",
            transform: `scale(${kenBurns})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(105deg, transparent ${sweepX - 18}%, ${c("text", 0.16)} ${sweepX}%, transparent ${sweepX + 18}%)`,
          }}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Signature motion — fires ONLY at S3 ProductShot reveal + S7 CTA           */
/*                                                                             */
/*  The active motion token names exactly one `SignatureMotion`. These return  */
/*  a transform string keyed by the entrance progress `s`; novelty-per-scene   */
/*  is impossible because the recipe is the same single id for the whole video.*/
/* -------------------------------------------------------------------------- */

/** Build the signature reveal transform for a given entrance progress `s`. */
export const signatureTransform = (
  sig: SignatureMotion,
  s: number,
): string => {
  switch (sig) {
    case "riseSettle":
      // calm: deep rise that settles — long travel, gentle scale.
      return `translateY(${(1 - s) * 120}px) scale(${0.92 + s * 0.08})`;
    case "slideReveal":
      // standard: slide in from the side with a clip-like horizontal travel.
      return `translateX(${(1 - s) * -90}px) scale(${0.96 + s * 0.04})`;
    case "snapScale":
      // punchy: snap up from a small scale (under-damped overshoot in the spring).
      return `scale(${0.7 + s * 0.3})`;
  }
};

/**
 * Wrapper that applies the video's single signature motion to its entrance.
 * Use ONLY at the ProductShot reveal and the CTA wordmark — the two places the
 * design system permits the signature to fire.
 */
export const Signature: React.FC<
  React.PropsWithChildren<{ delay?: number; style?: React.CSSProperties }>
> = ({ delay = 0, style, children }) => {
  const motion = useMotion();
  const sig = signatureFor(motion);
  const s = useEnter(delay);
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: signatureTransform(sig, s),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Counter — count-up number (Stats)                                          */
/* -------------------------------------------------------------------------- */

export const Counter: React.FC<{
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
  delay: number;
  accent: PaletteKey;
  /** Unverified stats render an "e.g." affordance (stats are examples). */
  verified?: boolean;
}> = ({ to, suffix = "", decimals = 0, label, delay, accent, verified }) => {
  const { frame } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  // Count-up rides a clamped, eased ramp (not the spring) so the number lands
  // monotonically without overshooting past `to`.
  const progress = interpolate(frame - delay, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
  });
  const value = (to * progress).toFixed(decimals);
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], {
          extrapolateRight: "clamp",
        }),
        transform: `translateY(${(1 - s) * 60}px)`,
        textAlign: "center",
        padding: "50px 30px",
        borderRadius: 28,
        background: `linear-gradient(160deg, ${c("surface", 0.7)}, ${c("bg", 0.6)})`,
        border: `1px solid ${c(accent, 0.25)}`,
        boxShadow: `inset 0 1px 0 ${c("text", 0.12)}, 0 0 60px ${c(accent, 0.12)}`,
        width: 380,
        position: "relative",
      }}
    >
      {!verified ? (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            fontFamily: FONTS.mono,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: c("textDim"),
            opacity: 0.8,
          }}
        >
          e.g.
        </div>
      ) : null}
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: c(accent),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        {suffix}
      </div>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 29,
          color: c("textDim"),
          marginTop: 10,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  countUp — shared frame-driven count-up ramp (eased, monotonic)             */
/* -------------------------------------------------------------------------- */

/**
 * The eased 0→1 ramp every count-up (number, ring sweep, bar fill) rides. Kept
 * as a free helper so the digits, the arc, and the bar all land in lockstep.
 * `easeOutCubic` so it decelerates into the target without overshooting past it.
 */
export const countUpProgress = (
  frame: number,
  delay: number,
  dur = 50,
): number =>
  interpolate(frame - delay, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

/* -------------------------------------------------------------------------- */
/*  ProgressRing — SVG arc count-up with gradient stroke + glow (Stats viz)    */
/*                                                                             */
/*  C = 2πr; the arc draws by animating strokeDashoffset = C·(1-progress).     */
/*  A blurred duplicate ring under the crisp one fakes the bloom (no GL). The  */
/*  number in the hub counts in lockstep on the same `countUpProgress` ramp.   */
/* -------------------------------------------------------------------------- */

export const ProgressRing: React.FC<{
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
  delay: number;
  accent: PaletteKey;
  verified?: boolean;
  /** Full-circle value the arc maps `to` against (e.g. 100 for a percentage). */
  full?: number;
}> = ({
  to,
  suffix = "",
  decimals = 0,
  label,
  delay,
  accent,
  verified,
  full,
}) => {
  const { frame } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const seed = useSeeded(`ring:${label}`);
  const uid = React.useId();

  const size = 300;
  const r = 118;
  const C = 2 * Math.PI * r;
  const denom = full ?? (to <= 1 ? 1 : Math.pow(10, Math.ceil(Math.log10(to + 1))));
  const target = Math.min(to / denom, 1);
  const p = countUpProgress(frame, delay, 56);
  const reached = target * p;
  const value = (to * p).toFixed(decimals);

  // A faint ambient breathe on the glow — deterministic, brand-seeded phase.
  const phase = seed() * Math.PI * 2;
  const glow = 0.5 + 0.5 * Math.sin(frame / 26 + phase);

  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 50}px) scale(${0.92 + s * 0.08})`,
        position: "relative",
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
      }}
    >
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`rg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c(accent)} />
            <stop
              offset="100%"
              stopColor={c(accent === "accent2" ? "accent" : "accent2")}
            />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c("text", 0.08)}
          strokeWidth={14}
        />
        {/* glow underlay (blurred duplicate = fake bloom) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#rg-${uid})`}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - reached)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: "blur(9px)", opacity: 0.5 + glow * 0.4 }}
        />
        {/* crisp arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#rg-${uid})`}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - reached)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ textAlign: "center", position: "relative" }}>
        {!verified ? <EgTag /> : null}
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: c("text"),
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {value}
          <span style={{ color: c(accent), fontSize: 44 }}>{suffix}</span>
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            color: c("textDim"),
            marginTop: 12,
            fontWeight: 600,
            maxWidth: 200,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  StatBar — horizontal bar that fills + counts, with a faint baseline grid   */
/* -------------------------------------------------------------------------- */

/** The small "e.g." affordance shared by unverified Stats vizzes. */
const EgTag: React.FC = () => {
  const c = palette();
  return (
    <div
      style={{
        position: "absolute",
        top: -34,
        right: 0,
        fontFamily: FONTS.mono,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: c("textDim"),
        opacity: 0.8,
      }}
    >
      e.g.
    </div>
  );
};

export const StatBar: React.FC<{
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
  delay: number;
  accent: PaletteKey;
  verified?: boolean;
  /** Value the bar fills to 100% width against. Defaults to a sensible round. */
  full?: number;
}> = ({ to, suffix = "", decimals = 0, label, delay, accent, verified, full }) => {
  const { frame } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const uid = React.useId();
  const denom = full ?? (to <= 1 ? 1 : Math.pow(10, Math.ceil(Math.log10(to + 1))));
  const p = countUpProgress(frame, delay, 52);
  const fill = Math.min(to / denom, 1) * p;
  const value = (to * p).toFixed(decimals);

  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateX(${(1 - s) * -40}px)`,
        width: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 26,
            fontWeight: 600,
            color: c("text"),
          }}
        >
          {label}
          {!verified ? (
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 15,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: c("textDim"),
                marginLeft: 12,
                opacity: 0.8,
              }}
            >
              e.g.
            </span>
          ) : null}
        </span>
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: c(accent),
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
          {suffix}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 18,
          borderRadius: 99,
          background: c("text", 0.07),
          overflow: "hidden",
          boxShadow: `inset 0 1px 2px rgba(0,0,0,0.4)`,
        }}
      >
        {/* baseline tick grid (every 25%) — the "designed", not "flat", tell */}
        {[0.25, 0.5, 0.75].map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${t * 100}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: c("text", 0.12),
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${fill * 100}%`,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${c(accent, 0.85)}, ${c(
              accent === "accent2" ? "accent" : "accent2",
            )})`,
            boxShadow: `0 0 24px ${c(accent, 0.5)}`,
          }}
        />
        {/* leading edge highlight */}
        <div
          style={{
            position: "absolute",
            left: `calc(${fill * 100}% - 3px)`,
            top: 0,
            bottom: 0,
            width: 3,
            background: c("text", 0.6),
            opacity: fill > 0.02 ? 1 : 0,
            filter: "blur(1px)",
          }}
        />
        <span style={{ display: "none" }}>{uid}</span>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  LogoTile / wall helpers — elegant gridded marks with a settle stagger      */
/* -------------------------------------------------------------------------- */

/**
 * One logo cell in the wall: a glass tile that rises + un-blurs on its own
 * delayed clock, with a hairline gradient border (the "depth" affordance).
 */
export const LogoTile: React.FC<{ src: string; delay: number }> = ({
  src,
  delay,
}) => {
  const c = palette();
  const s = useEnter(delay);
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 30}px) scale(${0.94 + s * 0.06})`,
        filter: `blur(${(1 - Math.min(s * 1.4, 1)) * 6}px)`,
        height: 120,
        width: 268,
        display: "grid",
        placeItems: "center",
        padding: "0 40px",
        borderRadius: 22,
        border: "1px solid transparent",
        background: `linear-gradient(${c("surface", 0.55)}, ${c(
          "surface",
          0.55,
        )}) padding-box, linear-gradient(140deg, ${c("text", 0.22)}, ${c(
          "text",
          0.03,
        )} 45%, transparent 65%, ${c("accent", 0.22)}) border-box`,
        boxShadow: `inset 0 1px 0 ${c("text", 0.08)}, 0 18px 44px rgba(0,0,0,0.4)`,
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          maxHeight: 60,
          maxWidth: 200,
          display: "block",
          // keep the marks reading as one set: desaturate, brand-neutral
          filter: "grayscale(1) brightness(1.7) contrast(0.9)",
          opacity: 0.85,
        }}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  PullQuote — typeset pull-quote with depth (big quotemark, rule, stars)     */
/* -------------------------------------------------------------------------- */

export const PullQuote: React.FC<{
  quote: string;
  attribution: string;
}> = ({ quote, attribution }) => {
  const { frame } = useFrame();
  const c = palette();
  const head = useHeadlineStyle();

  // The big decorative quotemark drops in behind the text (parallax depth).
  const markS = useEnter(0);
  return (
    <Pop>
      <div
        style={{
          position: "relative",
          maxWidth: 1320,
          textAlign: "center",
          padding: "92px 110px 78px",
          borderRadius: 40,
          background: `linear-gradient(160deg, ${c("surface", 0.82)}, ${c(
            "bg",
            0.7,
          )})`,
          border: `1px solid ${c("accent", 0.22)}`,
          boxShadow: `inset 0 1px 0 ${c("text", 0.1)}, 0 50px 120px rgba(0,0,0,0.55), 0 0 90px ${c(
            "accent",
            0.1,
          )}`,
        }}
      >
        {/* oversized quotemark, behind the text, low opacity — the depth layer */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: interpolate(markS, [0, 1], [4, -26]),
            left: 54,
            fontFamily: FONTS.display,
            fontSize: 260,
            lineHeight: 1,
            fontWeight: 700,
            color: c("accent", 0.14),
            opacity: interpolate(markS, [0, 1], [0, 1], {
              extrapolateRight: "clamp",
            }),
            userSelect: "none",
          }}
        >
          &ldquo;
        </div>
        {/* stars */}
        <div style={{ fontSize: 44, marginBottom: 28, position: "relative" }}>
          {"★★★★★".split("").map((star, i) => (
            <span
              key={i}
              style={{
                color: c("accent2"),
                opacity: frame > 8 + i * 4 ? 1 : 0.15,
                textShadow: `0 0 22px ${c("accent2", 0.5)}`,
                margin: "0 2px",
              }}
            >
              {star}
            </span>
          ))}
        </div>
        <div
          style={{
            ...head,
            position: "relative",
            fontSize: 54,
            fontWeight: 500,
            lineHeight: 1.34,
            letterSpacing: "-0.012em",
          }}
        >
          {quote}
        </div>
        {/* short accent rule between quote and attribution */}
        <Pop delay={18} from={14}>
          <div
            style={{
              width: 88,
              height: 4,
              borderRadius: 99,
              margin: "40px auto 26px",
              background: `linear-gradient(90deg, ${c("accent")}, ${c("accent2")})`,
              boxShadow: `0 0 18px ${c("accent", 0.5)}`,
            }}
          />
        </Pop>
        <Pop delay={22}>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 30,
              color: c("textDim"),
            }}
          >
            <span style={{ color: c("text"), fontWeight: 800 }}>
              {attribution}
            </span>
          </div>
        </Pop>
      </div>
    </Pop>
  );
};

/* -------------------------------------------------------------------------- */
/*  RegionHighlight — the consistent FeatureBeat UI-region highlight           */
/*                                                                             */
/*  A product still sits in a frame; a focus ring sweeps to a named region     */
/*  inside it, a connector line runs from the ring to a floating caption chip,  */
/*  and an "earcon" pulse ripples out when the highlight lands. The layout is   */
/*  IDENTICAL across beats (consistency is the premium tell) — only the region  */
/*  rect, label, caption and side change.                                       */
/* -------------------------------------------------------------------------- */

/** A region rect inside the still, as fractions of the still box [0..1]. */
export type RegionRect = { x: number; y: number; w: number; h: number };

export const RegionHighlight: React.FC<{
  src: string;
  /** Fractional rect of the region to spotlight. */
  rect: RegionRect;
  label: string;
  caption: string;
  /** Which side the caption chip + connector live on. */
  side: "left" | "right";
  delay?: number;
  /** Frame the highlight "lands" — drives the earcon ripple + connector draw. */
  landAt?: number;
}> = ({ src, rect, label, caption, side, delay = 0, landAt = 26 }) => {
  const { frame, fps } = useFrame();
  const c = palette();
  const s = useEnter(delay);
  const head = useHeadlineStyle();
  const tok = useMotionToken();

  // Ring sweep-in: scales down onto the region and brightens as it lands.
  const ring = spring({
    frame: frame - delay - 6,
    fps,
    config: tok.spring,
  });
  // Earcon ripple — a single expanding ring when the highlight lands.
  const ripple = interpolate(frame, [landAt, landAt + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const connector = interpolate(frame, [landAt + 4, landAt + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const STILL_W = 1000;
  const STILL_H = 620;
  const rx = rect.x * STILL_W;
  const ry = rect.y * STILL_H;
  const rw = rect.w * STILL_W;
  const rh = rect.h * STILL_H;

  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 60}px)`,
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
          background: `linear-gradient(135deg, ${c("accent", 0.5)}, ${c(
            "text",
            0.12,
          )} 38%, transparent 60%, ${c("accent2", 0.4)})`,
          boxShadow: `0 50px 120px rgba(0,0,0,0.6), 0 0 80px ${c("accent", 0.14)}`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 19,
            overflow: "hidden",
          }}
        >
          <img
            src={src}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {/* dim everything except the region (spotlight) once the ring lands */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(4,6,10,0.62)",
              opacity: Math.min(ring, 1) * 0.9,
              maskImage: `radial-gradient(ellipse ${rw * 0.85}px ${rh * 0.9}px at ${
                rx + rw / 2
              }px ${ry + rh / 2}px, transparent 60%, black 100%)`,
              WebkitMaskImage: `radial-gradient(ellipse ${rw * 0.85}px ${
                rh * 0.9
              }px at ${rx + rw / 2}px ${ry + rh / 2}px, transparent 60%, black 100%)`,
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
          boxShadow: `0 0 0 1px ${c("bg", 0.6)}, 0 0 30px ${c("accent", 0.55)}, inset 0 0 24px ${c(
            "accent",
            0.18,
          )}`,
          opacity: interpolate(ring, [0, 0.4], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      />
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
          transform: `translate(-50%,-50%) scale(${ripple * 26})`,
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

/** The connector line + caption chip; split out to keep `RegionHighlight` legible. */
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
  const chipX = side === "right" ? stillW + 70 : -70 - 360;
  const chipMidY = anchorY - 30;
  const run = side === "right" ? chipX - anchorX : anchorX - chipX - 360;

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
          background: `linear-gradient(${
            side === "right" ? "90deg" : "270deg"
          }, ${c("accent")}, ${c("accent2")})`,
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
          width: 360,
          opacity: interpolate(draw, [0.5, 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateX(${(1 - draw) * (side === "right" ? -20 : 20)}px)`,
          padding: "22px 28px",
          borderRadius: 20,
          textAlign: side === "right" ? "left" : "right",
          background: `linear-gradient(160deg, ${c("surface", 0.94)}, ${c(
            "bg",
            0.88,
          )})`,
          border: `1px solid ${c("accent", 0.3)}`,
          boxShadow: `inset 0 1px 0 ${c("text", 0.12)}, 0 24px 60px rgba(0,0,0,0.5), 0 0 40px ${c(
            "accent",
            0.12,
          )}`,
          backdropFilter: "blur(14px)",
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
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        <div
          style={{
            ...head,
            fontSize: 30,
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          <Headline text={caption} />
        </div>
      </div>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/*  StrikeStamp — restrained status-quo line with a draw-on strike treatment   */
/*                                                                             */
/*  The status quo is shown muted; a strike rule DRAWS across (left→right),    */
/*  the text desaturates and dims as it's crossed out. No hard jump — the      */
/*  strike grows as a width, the way an editor crosses a line out.             */
/* -------------------------------------------------------------------------- */

export const StrikeStamp: React.FC<{
  text: string;
  delay: number;
  strikeAt: number;
}> = ({ text, delay, strikeAt }) => {
  const { frame } = useFrame();
  const c = palette();
  const head = useHeadlineStyle();
  const s = useEnter(delay);

  // strike draws across over ~14 frames; text dims as it's crossed
  const strike = interpolate(frame, [strikeAt, strikeAt + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        opacity:
          interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }) *
          (1 - strike * 0.62),
        transform: `translateX(${(1 - s) * -30}px)`,
        display: "inline-flex",
        alignItems: "center",
        gap: 24,
        alignSelf: "flex-start",
      }}
    >
      {/* leading muted bullet */}
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          flexShrink: 0,
          background: c("textDim", 0.5),
          transform: "rotate(45deg)",
        }}
      />
      <span
        style={{
          ...head,
          fontSize: 58,
          fontWeight: 600,
          color: c("textDim"),
          position: "relative",
          whiteSpace: "nowrap",
        }}
      >
        {text}
        {/* the strike rule, drawn as a growing width */}
        <span
          style={{
            position: "absolute",
            left: -6,
            right: -6,
            top: "52%",
            height: 5,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${c("accent2")}, ${c("accent")})`,
            boxShadow: `0 0 14px ${c("accent2", 0.6)}`,
            transform: `scaleX(${strike})`,
            transformOrigin: "left",
          }}
        />
      </span>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Shared headline style                                                      */
/* -------------------------------------------------------------------------- */

export const useHeadlineStyle = (): React.CSSProperties => {
  const c = palette();
  return {
    fontFamily: FONTS.display,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: c("text"),
  };
};
