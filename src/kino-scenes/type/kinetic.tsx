/**
 * KINETIC TYPE KIT — advanced, art-directed kinetic typography primitives.
 *
 * A choreographed (not uniform) per-glyph / per-line animation toolkit, built
 * entirely on the Kino runtime: time comes from `useFrame()` (`src/engine`),
 * color from the threaded `palette()` (`src/design`), motion feel from the active
 * `MotionToken`. Every visual is a PURE function of the current frame — no
 * wall-clock, no `requestAnimationFrame`, no `Date.now`, no unseeded random
 * (per-glyph "organic" variation comes from `hash01(index)` in `./split`). Two
 * renders of the same frame are byte-identical (ENGINE_DESIGN §2, dossier §3).
 *
 * The craft techniques (dossier §3):
 *  - per-glyph spring stagger (Apple/Linear word-by-word entrance)
 *  - clip / mask line reveals (Stripe headline wipe — `overflow:hidden` + travel)
 *  - variable-font WEIGHT animation (`font-variation-settings:'wght'…`; the
 *    variable faces are loaded behind `document.fonts.ready` — `host/entry.tsx`)
 *  - blur-in (GPU `filter:blur` alongside opacity)
 *  - gradient / accent WORD emphasis (the `*marked*` convention)
 *  - baseline drift + tasteful tracking (letter-spacing) animation, hash-seeded
 *
 * Public surface (the reusable trio the prompt asks for, plus the variants):
 *  - <KineticWord>   one word, all glyphs choreographed on one delayed clock
 *  - <KineticLine>   one line, words/glyphs cascaded with a single stride
 *  - <MaskReveal>    a line/element revealed under a clip mask (wipe)
 */
import * as React from "react";

import { useFrame, interpolate, spring } from "../../engine";
import { palette, usePalette, useMotion, motionToken } from "../../design";
import { FONTS } from "../kit";

import {
  splitGlyphs,
  splitWords,
  glyphCount,
  jitter,
  type GlyphWord,
} from "./split";

/* -------------------------------------------------------------------------- */
/*  Shared types                                                               */
/* -------------------------------------------------------------------------- */

/** How a glyph/word arrives. Each is a closed-form transform of progress `s`. */
export type KineticMode =
  | "rise" // translateY up into place (the default Apple/Linear entrance)
  | "blur" // blur-in + fade (React Bits BlurText)
  | "mask" // clip-reveal from below within an overflow-hidden frame
  | "weight" // variable-font wght ramp (thin → bold) + subtle rise
  | "drop" // drop from above with a touch of rotateX
  | "char3d"; // per-glyph rotateX flip (kinetic, 3D-ish), staggered

/** The two emphasis treatments a `*marked*` span can take. */
export type Emphasis = "gradient" | "accent" | "none";

export type WeightRange = readonly [from: number, to: number];

/* -------------------------------------------------------------------------- */
/*  Motion helpers                                                             */
/* -------------------------------------------------------------------------- */

const useTok = () => motionToken(useMotion());

/**
 * Gradient-text CSS from the palette's `gradientText` pair (mirrors kit).
 *
 * Tuned to read at TITLE size (CD: the title-scale gradient emphasis was
 * effectively invisible — a 100deg, 0%→100% ramp over a short, very large word
 * lands as a near-flat single color). The fixes, all on-token and frame-pure:
 *  - a flatter, near-horizontal angle (92deg) so both stops traverse the word's
 *    WIDTH (the long axis) instead of its height — the eye actually sees a→b;
 *  - inset stops (8%→92%) so neither end clips to a single flat color at the
 *    glyph edges — the full pair shows even on a 3-letter word;
 *  - a faint accent drop-shadow glow so the gradient fill separates from the
 *    luminous field behind it at title weight (it was washing into the bg).
 * The drop-shadow lives on the emphasis span (a static filter — no toggle), so
 * it's a pure function of the frame and never promotes/demotes a layer mid-line.
 */
const useGradient = (): React.CSSProperties => {
  const pal = usePalette();
  const [a, b] = pal.gradientText ?? [pal.accent, pal.accent2 ?? pal.accent];
  return {
    backgroundImage: `linear-gradient(92deg, ${a} 8%, ${b} 92%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    // a soft accent halo so the clipped gradient reads against the lit field
    filter: `drop-shadow(0 0 14px ${a}55)`,
  };
};

/**
 * The per-glyph closed-form style for a given entrance progress `s ∈ [0,1]`,
 * its hashed index (for organic drift), and the chosen mode. Pure function.
 */
const glyphStyle = (
  mode: KineticMode,
  s: number,
  index: number,
  weight: WeightRange,
): React.CSSProperties => {
  // Clamp helpers so opacity/blur never overshoot the spring's ringing.
  const o = interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const sClamped = Math.min(Math.max(s, 0), 1);
  // Hash-seeded organic variation — deterministic, never Math.random.
  const drift = jitter(index, 7); // [-1,1] baseline drift seed
  const skew = jitter(index, 19);

  switch (mode) {
    case "blur": {
      const blur = (1 - Math.min(s * 1.4, 1)) * 12;
      return {
        opacity: o,
        filter: `blur(${blur.toFixed(3)}px)`,
        transform: `translateY(${((1 - s) * 14 + drift * 4 * (1 - sClamped)).toFixed(3)}px)`,
      };
    }
    case "weight": {
      const wght = interpolate(sClamped, [0, 1], [weight[0], weight[1]]);
      return {
        opacity: o,
        fontVariationSettings: `'wght' ${Math.round(wght)}`,
        // a hair of rise so the weight bloom reads as motion, not a swap
        transform: `translateY(${((1 - s) * 10).toFixed(3)}px)`,
      };
    }
    case "drop": {
      const rot = (1 - s) * -14;
      return {
        opacity: o,
        transform: `perspective(600px) translateY(${((s - 1) * 34).toFixed(3)}px) rotateX(${rot.toFixed(3)}deg)`,
        transformOrigin: "50% 100%",
      };
    }
    case "char3d": {
      const rot = (1 - sClamped) * 92;
      return {
        opacity: o,
        transform: `perspective(700px) rotateX(${rot.toFixed(3)}deg) translateY(${((1 - s) * 8).toFixed(3)}px)`,
        transformOrigin: "50% 80%",
        backfaceVisibility: "hidden",
      };
    }
    case "mask": {
      // Per-glyph clip reveal (Stripe wipe at the glyph level): the char rides
      // from one full line-height below into place; the parent <Glyph> clips the
      // overflow so it wipes up from the baseline. Opacity stays solid — the
      // clip *is* the reveal — with only a hairline fade to soften the leading
      // edge. A whisper of hashed baseline drift keeps the wipe from reading as a
      // mechanical sweep (choreographed, not uniform).
      const fade = interpolate(s, [0, 0.18], [0, 1], {
        extrapolateRight: "clamp",
      });
      const y = (1 - sClamped) * 112 + drift * 5 * (1 - sClamped);
      return {
        opacity: fade,
        transform: `translateY(${y.toFixed(3)}%)`,
      };
    }
    case "rise":
    default: {
      // Rise + a whisper of baseline drift + sub-pixel tracking ease.
      const y = (1 - s) * 60 + drift * 6 * (1 - sClamped);
      return {
        opacity: o,
        transform: `translateY(${y.toFixed(3)}px) skewX(${(skew * 2 * (1 - sClamped)).toFixed(3)}deg)`,
      };
    }
  }
};

/* -------------------------------------------------------------------------- */
/*  Glyph                                                                       */
/* -------------------------------------------------------------------------- */

type GlyphProps = {
  char: string;
  /** Frame-relative spring start for this glyph. */
  delay: number;
  index: number;
  mode: KineticMode;
  emph: Emphasis;
  weight: WeightRange;
  /** Active base weight when the glyph is NOT weight-animating. */
  baseWeight: number;
};

/**
 * One animated glyph. Inside the spring it tracks its mode's closed-form
 * transform; emphasis glyphs additionally carry the gradient/accent fill. A
 * trailing non-breaking space is preserved as a zero-animation spacer by the
 * parent (words are spaced by flex gap), so this only ever renders one char.
 */
const Glyph: React.FC<GlyphProps> = ({
  char,
  delay,
  index,
  mode,
  emph,
  weight,
  baseWeight,
}) => {
  const { frame, fps } = useFrame();
  const tok = useTok();
  const c = palette();
  const grad = useGradient();

  const s = spring({ frame: frame - delay, fps, config: tok.spring });
  const base = glyphStyle(mode, s, index, weight);

  const emphStyle: React.CSSProperties =
    emph === "gradient"
      ? grad
      : emph === "accent"
        ? { color: c("accent") }
        : {};

  // When weight isn't the animated axis, still pin the base wght so the loaded
  // variable face never falls back to a default instance mid-render.
  const weightStyle: React.CSSProperties =
    mode === "weight"
      ? {}
      : { fontVariationSettings: `'wght' ${baseWeight}` };

  // `mask` is a true per-glyph clip reveal: an `overflow:hidden` frame holds the
  // char as it rides up from below, so it wipes in from the baseline rather than
  // rising into open space. The fill/weight stay on the inner moving span; the
  // outer frame only clips. Every other mode is a single transformed span.
  if (mode === "mask") {
    return (
      <span
        style={{
          display: "inline-block",
          overflow: "hidden",
          verticalAlign: "bottom",
        }}
      >
        <span
          style={{
            display: "inline-block",
            willChange: "transform, opacity",
            ...weightStyle,
            ...emphStyle,
            ...base,
          }}
        >
          {char}
        </span>
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        willChange: "transform, opacity, filter",
        ...weightStyle,
        ...emphStyle,
        ...base,
      }}
    >
      {char}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  KineticWord                                                                 */
/* -------------------------------------------------------------------------- */

export type KineticWordProps = {
  /** The word text. A leading `*` … trailing `*` marks emphasis (or pass `emph`). */
  text: string;
  /** Frame the word's first glyph starts springing. */
  delay?: number;
  /** Per-glyph stagger stride (frames). The choreography knob. */
  stride?: number;
  mode?: KineticMode;
  /** Override emphasis (otherwise inferred from `*marks*`). */
  emphasis?: Emphasis;
  weight?: WeightRange;
  baseWeight?: number;
  style?: React.CSSProperties;
};

/**
 * One word, every glyph choreographed on its own delayed spring clock. Kept in
 * an `inline-block` so it never breaks across a wrap. Emphasis (`*word*` → the
 * gradient pair, or accent) is applied per-glyph so the fill rides the reveal.
 */
export const KineticWord: React.FC<KineticWordProps> = ({
  text,
  delay = 0,
  stride = 2.4,
  mode = "rise",
  emphasis,
  weight = [200, 720],
  baseWeight = 700,
  style,
}) => {
  // Reuse the line splitter for a single word so `*marks*` parse identically.
  const words: GlyphWord[] = splitGlyphs(text);
  const emphInferred = words.some((w) => w.emph);
  const emph: Emphasis =
    emphasis ?? (emphInferred ? "gradient" : "none");

  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", ...style }}>
      {words.flatMap((w) =>
        w.glyphs.map((g) => (
          <Glyph
            key={g.index}
            char={g.char}
            index={g.index}
            delay={delay + g.index * stride}
            mode={mode}
            emph={emph}
            weight={weight}
            baseWeight={baseWeight}
          />
        )),
      )}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  KineticLine                                                                 */
/* -------------------------------------------------------------------------- */

export type KineticLineProps = {
  /** The line copy. `*marked*` spans take the line's emphasis treatment. */
  text: string;
  /** Frame the line starts. */
  delay?: number;
  /** Per-glyph stagger stride (frames). One source-of-truth stride. */
  stride?: number;
  /** Extra frames added per word boundary (cascade by word, then by glyph). */
  wordGap?: number;
  mode?: KineticMode;
  /** Emphasis treatment for `*marked*` spans on this line. */
  emphasis?: Emphasis;
  weight?: WeightRange;
  baseWeight?: number;
  /** Animate tracking (letter-spacing) from this → 0 over the entrance. */
  trackFrom?: number;
  align?: React.CSSProperties["justifyContent"];
  style?: React.CSSProperties;
};

/**
 * A full line of choreographed glyphs. Words are laid out with a flex gap (so
 * spaces never animate and wrapping is clean); within each word every glyph
 * springs on `delay + wordIdx*wordGap + glyphIdx*stride`. A single `stride`
 * constant re-times the whole line — the design's "one source-of-truth stride".
 *
 * `trackFrom` animates letter-spacing closed (tasteful tracking-in) over the
 * line's entrance window, derived from the glyph count so long and short lines
 * settle together.
 */
export const KineticLine: React.FC<KineticLineProps> = ({
  text,
  delay = 0,
  stride = 2,
  wordGap = 5,
  mode = "rise",
  emphasis = "gradient",
  weight = [200, 720],
  baseWeight = 700,
  trackFrom = 0,
  align = "center",
  style,
}) => {
  const { frame, fps } = useFrame();
  const tok = useTok();
  const c = palette();
  const grad = useGradient();
  const words = splitGlyphs(text);

  // Closed-form tracking-in: ride the SAME spring family as the glyphs, started
  // at the line delay, so spacing settles in lockstep with the reveal.
  const n = glyphCount(text);
  const trackS = spring({
    frame: frame - delay,
    fps,
    config: tok.spring,
  });
  const letterSpacing =
    trackFrom !== 0
      ? `${(interpolate(trackS, [0, 1], [trackFrom, 0], { extrapolateRight: "clamp" })).toFixed(3)}em`
      : undefined;

  const emphFill =
    emphasis === "gradient" ? grad : emphasis === "accent" ? { color: c("accent") } : {};
  void emphFill; // emphasis applied per-glyph inside <Glyph>; kept for parity
  void n;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align,
        alignItems: "baseline",
        columnGap: "0.28em",
        letterSpacing,
        ...style,
      }}
    >
      {words.map((w) => {
        const wordDelay = delay + w.wordIndex * wordGap;
        const emph: Emphasis = w.emph ? emphasis : "none";
        return (
          <span
            key={w.wordIndex}
            style={{ display: "inline-block", whiteSpace: "pre" }}
          >
            {w.glyphs.map((g) => (
              <Glyph
                key={g.index}
                char={g.char}
                index={g.index}
                delay={wordDelay + g.glyphInWord * stride}
                mode={mode}
                emph={emph}
                weight={weight}
                baseWeight={baseWeight}
              />
            ))}
          </span>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  MaskReveal                                                                  */
/* -------------------------------------------------------------------------- */

export type MaskRevealProps = React.PropsWithChildren<{
  /** Frame the reveal begins. */
  delay?: number;
  /** Reveal direction. `up` = content rises into a clipped frame (Stripe wipe). */
  direction?: "up" | "down" | "left" | "right";
  /** Travel distance as a fraction of the element (1 = full height/width). */
  distance?: number;
  /** Optional accent edge that sweeps with the reveal (the "wipe bar"). */
  edge?: boolean;
  style?: React.CSSProperties;
}>;

/**
 * Clip-mask line reveal — the Stripe headline wipe. The child is wrapped in an
 * `overflow:hidden` frame and travels from fully-offset into place under the
 * active motion token's spring. An optional accent `edge` bar rides the wipe.
 *
 * Pure transform/overflow — deterministic, GPU-cheap, no clip-path measurement.
 */
export const MaskReveal: React.FC<MaskRevealProps> = ({
  delay = 0,
  direction = "up",
  distance = 1,
  edge = false,
  style,
  children,
}) => {
  const { frame, fps } = useFrame();
  const tok = useTok();
  const c = palette();
  const s = spring({ frame: frame - delay, fps, config: tok.spring });
  const p = Math.min(Math.max(s, 0), 1);

  const pct = (1 - s) * 100 * distance;
  const axis =
    direction === "up"
      ? `translateY(${pct.toFixed(3)}%)`
      : direction === "down"
        ? `translateY(${(-pct).toFixed(3)}%)`
        : direction === "left"
          ? `translateX(${pct.toFixed(3)}%)`
          : `translateX(${(-pct).toFixed(3)}%)`;

  const horizontal = direction === "left" || direction === "right";

  return (
    <div style={{ overflow: "hidden", display: "inline-block", position: "relative", ...style }}>
      <div style={{ transform: axis, willChange: "transform" }}>{children}</div>
      {edge ? (
        <div
          style={{
            position: "absolute",
            ...(horizontal
              ? {
                  top: 0,
                  bottom: 0,
                  left: `${(p * 100).toFixed(3)}%`,
                  width: 3,
                }
              : {
                  left: 0,
                  right: 0,
                  top: `${(p * 100).toFixed(3)}%`,
                  height: 3,
                }),
            background: `linear-gradient(90deg, transparent, ${c("accent")}, transparent)`,
            boxShadow: `0 0 18px ${c("accent", 0.7)}`,
            opacity: interpolate(p, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
          }}
        />
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  ClipLine — a WHOLE-LINE clip/mask reveal + one confident move               */
/*                                                                              */
/*  The CD punch-list replacement for the per-glyph weight-stagger (template    */
/*  cliché). A line is revealed as ONE unit: it rides up from below inside an    */
/*  overflow-hidden frame (the Stripe headline wipe) while a single blur OR      */
/*  weight move settles. No per-glyph cascade — the confidence is in the line    */
/*  arriving whole, with one deliberate move, not thirty little ones.           */
/*                                                                              */
/*  `*marked*` spans still take the gradient/accent emphasis (one affordance     */
/*  copy controls). Pure function of the frame — the clip is a transform, the    */
/*  weight is a variable-font axis, the blur is a GPU filter.                    */
/* -------------------------------------------------------------------------- */

export type ClipLineProps = {
  /** The line copy. `*marked*` spans take the emphasis treatment. */
  text: string;
  /** Frame the reveal begins. */
  delay?: number;
  /** The single confident settle move riding the clip. */
  move?: "blur" | "weight";
  /** Emphasis treatment for `*marked*` spans. */
  emphasis?: Emphasis;
  /** Weight range for the `weight` move (from → to). */
  weight?: WeightRange;
  /** Resting weight for the `blur` move (no weight animation). */
  baseWeight?: number;
  /** Tracking (em) to settle FROM over the entrance (subtle, optional). */
  trackFrom?: number;
  /**
   * Tracking (em) the line SETTLES TO at rest. Defaults to a tight optical title
   * tracking (`-0.03em`, Linear/Stripe display register) — NOT 0. The old default
   * settled emphasis lines to `0em`, silently discarding the headline's tight
   * tracking and leaving title type reading Inter-default. The rest weight/size is
   * still the hierarchy lead; tight tracking is what makes it read display-grade.
   */
  trackTo?: number;
  style?: React.CSSProperties;
};

/**
 * One line, revealed whole under a clip mask with a single blur/weight settle.
 * The replacement for per-glyph stagger: deliberate, confident, on-token.
 */
export const ClipLine: React.FC<ClipLineProps> = ({
  text,
  delay = 0,
  move = "blur",
  emphasis = "gradient",
  weight = [240, 720],
  baseWeight = 700,
  trackFrom = 0,
  trackTo = -0.03,
  style,
}) => {
  const { frame, fps } = useFrame();
  const tok = useTok();
  const grad = useGradient();
  const c = palette();
  const words = splitWords(text);

  const s = spring({ frame: frame - delay, fps, config: tok.spring });
  const p = Math.min(Math.max(s, 0), 1);

  // The single move. weight: thin → bold variable-font ramp. blur: GPU blur-in.
  const wght =
    move === "weight"
      ? Math.round(interpolate(p, [0, 1], [weight[0], weight[1]]))
      : baseWeight;
  const blur = move === "blur" ? (1 - Math.min(s * 1.5, 1)) * 14 : 0;
  // Settle tracking FROM `trackFrom` TO the tight optical `trackTo` (not 0) so the
  // line lands at display-grade tracking, not Inter-default. When no entrance
  // tracking animation is requested we still pin the tight rest value.
  const letterSpacing =
    trackFrom !== 0
      ? `${interpolate(p, [0, 1], [trackFrom, trackTo]).toFixed(4)}em`
      : `${trackTo}em`;

  // DELIBERATE WEIGHT JUMP on the *marked* word (CD type-hierarchy): the emphasis
  // word settles ONE confident step heavier than the rest of the line — not a
  // uniform line weight with only a fill change (which read as no hierarchy at
  // all). It rides the SAME spring `p` so the jump arrives WITH the line, never as
  // a late swap, and clamps at 900 (the variable face's max). Stripe/Linear set
  // the emphasis word both heavier AND a hair tighter — so the marked span also
  // tucks its tracking in a touch. Both are closed-form in `p` → frame-pure.
  const restWght = move === "weight" ? wght : baseWeight;
  const emphTo = Math.min(restWght + 140, 900);
  const emphWght = Math.round(interpolate(p, [0, 1], [weight[0], emphTo]));
  const emphStyle = (base: React.CSSProperties): React.CSSProperties => ({
    ...base,
    fontVariationSettings: `'wght' ${emphWght}`,
    // the marked word tucks a hair TIGHTER than the line (heavier glyphs need less
    // air) — the Stripe/Linear emphasis read: heavier + tighter, not just colored.
    letterSpacing: `${(trackTo - 0.008).toFixed(4)}em`,
    display: "inline-block",
  });

  return (
    <span
      style={{
        display: "inline-block",
        overflow: "hidden",
        // a hair of vertical padding so descenders/ascenders aren't clipped at rest
        padding: "0.08em 0.04em",
        margin: "-0.08em -0.04em",
        verticalAlign: "bottom",
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-block",
          whiteSpace: "pre-wrap",
          // Inherit the parent's text alignment so a line that WRAPS (a long Hook
          // resolution at display size) stays centered on its measure instead of
          // ragging left inside the inline-block box.
          textAlign: "inherit",
          // WIDOW/ORPHAN GUARD (CD R2 P2): balance a wrapped headline across its
          // lines so a single stranded word ("…talent.", "now") can't drop to a
          // line of its own. Pure layout — deterministic, no measurement, no
          // per-frame cost; harmless on single-line headings. The inline (non-
          // flex) text flow here is exactly what `text-wrap: balance` operates on.
          textWrap: "balance",
          willChange: "transform, filter",
          letterSpacing,
          fontVariationSettings: `'wght' ${wght}`,
          // the clip travel — the whole line rides up from one line-height below
          transform: `translateY(${((1 - p) * 100).toFixed(3)}%)`,
          // ALWAYS emit a filter (never `undefined`): a property that toggles on/off
          // promotes/demotes the compositing layer mid-animation, and the toggle
          // frame can rasterise a sub-pixel off its neighbour (det. review F4). A
          // constant `blur(0px)` at rest keeps the layer stable for the line's life.
          filter: `blur(${Math.max(blur, 0).toFixed(3)}px)`,
          opacity: interpolate(s, [0, 0.22], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      >
        {words.map((w, i) => (
          <React.Fragment key={i}>
            {i > 0 ? " " : null}
            <span
              style={
                w.emph
                  ? emphStyle(emphasis === "accent" ? { color: c("accent") } : grad)
                  : undefined
              }
            >
              {w.text}
            </span>
          </React.Fragment>
        ))}
      </span>
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  GradientWord — static (non-staggered) gradient/accent emphasis span         */
/* -------------------------------------------------------------------------- */

export type GradientWordProps = React.PropsWithChildren<{
  emphasis?: Exclude<Emphasis, "none">;
  style?: React.CSSProperties;
}>;

/**
 * A non-animated emphasis span (gradient or accent fill). Used when emphasis is
 * desired without the per-glyph reveal — e.g. a CTA wordmark that arrives as a
 * unit but still carries the brand gradient.
 */
export const GradientWord: React.FC<GradientWordProps> = ({
  emphasis = "gradient",
  style,
  children,
}) => {
  const c = palette();
  const grad = useGradient();
  return (
    <span
      style={{
        ...(emphasis === "gradient" ? grad : { color: c("accent") }),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  Re-exports for convenience                                                  */
/* -------------------------------------------------------------------------- */

export { FONTS };
export { hash01, jitter, splitGlyphs, splitWords, glyphCount } from "./split";
export type { GlyphWord, GlyphToken, WordToken } from "./split";
