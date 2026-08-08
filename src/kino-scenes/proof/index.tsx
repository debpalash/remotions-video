/**
 * `src/kino-scenes/proof` — the PROOF craft kit (S6 social-proof beat).
 *
 * Two studio-grade surfaces, picked by the discriminated `ProofProps` union:
 *  - <LogoWall>   an elegant gridded logo wall — glass tiles with a hairline
 *                 gradient border (depth), a brand-neutral desaturated mark, a
 *                 per-tile settle stagger (rise + un-blur), and a soft center
 *                 spotlight so the set reads as one wall, not scattered chips;
 *  - <PullQuote>  a typeset pull-quote WITH DEPTH — an oversized quotemark that
 *                 parallaxes in behind the text, a five-star draw-on, a kinetic
 *                 quote line, an accent rule, and a monogram avatar + attribution.
 *
 * DETERMINISM (ENGINE_DESIGN §2): every value is a pure function of the Kino
 * frame; per-tile stagger and the glow phase are closed-form (`useEnter(delay)`,
 * `Math.sin(frame/k)`), never a wall-clock or `Math.random`.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md §2`.
 */
import * as React from "react";

import { useFrame, interpolate } from "../../engine";
import { palette } from "../../design";
import { FONTS, useEnter, useHeadlineStyle } from "../kit";
import { KineticLine } from "../type";

/* -------------------------------------------------------------------------- */
/*  LogoTile — one glass cell in the wall                                       */
/* -------------------------------------------------------------------------- */

const LogoTile: React.FC<{ src: string; delay: number }> = ({ src, delay }) => {
  const c = palette();
  const s = useEnter(delay);
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 34}px) scale(${0.93 + s * 0.07})`,
        filter: `blur(${(1 - Math.min(s * 1.4, 1)) * 7}px)`,
        height: 132,
        width: 280,
        display: "grid",
        placeItems: "center",
        padding: "0 44px",
        borderRadius: 22,
        boxSizing: "border-box",
        // gradient-hairline depth (padding-box fill + border-box gradient)
        border: "1px solid transparent",
        background: [
          `linear-gradient(${c("surface", 0.55)}, ${c("surface", 0.5)}) padding-box`,
          `linear-gradient(140deg, ${c("text", 0.24)}, ${c("text", 0.03)} 45%, transparent 65%, ${c("accent", 0.24)}) border-box`,
        ].join(", "),
        boxShadow: `inset 0 1px 0 ${c("text", 0.08)}, 0 20px 46px rgba(0,0,0,0.42)`,
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          maxHeight: 62,
          maxWidth: 200,
          display: "block",
          // unify the marks as one set: desaturate, brand-neutral
          filter: "grayscale(1) brightness(1.7) contrast(0.9)",
          opacity: 0.85,
        }}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  LogoWall                                                                    */
/* -------------------------------------------------------------------------- */

export const LogoWall: React.FC<{ logos: string[]; eyebrow?: string }> = ({
  logos,
  eyebrow,
}) => {
  const { frame } = useFrame();
  const c = palette();
  const eb = useEnter(0);

  // EARN THE CLAIM OR DON'T RENDER (CD R2 P1). With no real logo marks there is
  // nothing to prove — rendering empty glass tiles under a hardcoded eyebrow was
  // self-contradicting social proof at the worst moment. The director's trust
  // gate now drops unverifiable logo-wall proofs upstream, but this guard keeps
  // the component honest for any direct caller: no logos → no wall. The eyebrow
  // no longer defaults to a hardcoded dev-tool slogan (wrong product) — it
  // renders ONLY when a caller passes verified copy.
  if (logos.length === 0) return null;

  // soft center spotlight breathe — ties the grid into one wall
  const glow = 0.5 + 0.5 * Math.sin(frame / 32);

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* center spotlight behind the wall */}
      <div
        style={{
          position: "absolute",
          width: 1500,
          height: 760,
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          background: `radial-gradient(ellipse at center, ${c("accent", 0.1 + glow * 0.04)} 0%, transparent 62%)`,
          filter: "blur(50px)",
          pointerEvents: "none",
        }}
      />

      {eyebrow ? (
        <div
          style={{
            position: "relative",
            opacity: interpolate(eb, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${(1 - eb) * 20}px)`,
            fontFamily: FONTS.mono,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: c("textDim"),
            marginBottom: 56,
            textAlign: "center",
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 40,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 1520,
        }}
      >
        {logos.map((logo, i) => (
          <LogoTile key={i} src={logo} delay={8 + i * 6} />
        ))}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Monogram — an initial-disc avatar derived from the attribution             */
/* -------------------------------------------------------------------------- */

/** First letters of the first ≤2 attribution words → a monogram. */
const initialsOf = (attribution: string): string =>
  attribution
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const Monogram: React.FC<{ attribution: string }> = ({ attribution }) => {
  const c = palette();
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 99,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        fontFamily: FONTS.display,
        fontSize: 26,
        fontWeight: 700,
        color: c("text"),
        letterSpacing: "0.02em",
        background: `linear-gradient(140deg, ${c("accent", 0.85)}, ${c("accent2", 0.85)})`,
        boxShadow: `inset 0 1px 0 ${c("text", 0.3)}, 0 10px 28px rgba(0,0,0,0.4), 0 0 28px ${c("accent", 0.25)}`,
      }}
    >
      {initialsOf(attribution)}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  PullQuote — typeset pull-quote with depth                                  */
/* -------------------------------------------------------------------------- */

export const PullQuote: React.FC<{ quote: string; attribution: string }> = ({
  quote,
  attribution,
}) => {
  const c = palette();
  const head = useHeadlineStyle();

  const card = useEnter(0);
  const markS = useEnter(2);

  return (
    <div
      style={{
        position: "relative",
        opacity: interpolate(card, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - card) * 50}px) scale(${0.96 + card * 0.04})`,
        maxWidth: 1360,
        textAlign: "center",
        padding: "96px 110px 80px",
        borderRadius: 40,
        // glass card with gradient hairline
        border: "1px solid transparent",
        background: [
          `linear-gradient(160deg, ${c("surface", 0.84)}, ${c("bg", 0.7)}) padding-box`,
          `linear-gradient(150deg, ${c("accent", 0.4)}, ${c("text", 0.05)} 50%, ${c("accent2", 0.3)}) border-box`,
        ].join(", "),
        boxShadow: `inset 0 1px 0 ${c("text", 0.1)}, 0 50px 120px rgba(0,0,0,0.55), 0 0 90px ${c("accent", 0.1)}`,
      }}
    >
      {/* oversized quotemark, behind the text, parallax in — the depth layer */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: interpolate(markS, [0, 1], [10, -30], { extrapolateRight: "clamp" }),
          left: 56,
          fontFamily: FONTS.display,
          fontSize: 280,
          lineHeight: 1,
          fontWeight: 700,
          color: c("accent", 0.13),
          opacity: interpolate(markS, [0, 1], [0, 1], { extrapolateRight: "clamp" }),
          userSelect: "none",
        }}
      >
        &ldquo;
      </div>

      {/* the quote — kinetic per-word reveal, the marked span in the gradient.
          Constrained to a fixed measure and CENTER-aligned so a long quote wraps
          to balanced centered lines INSIDE the card instead of overrunning its
          right padding (CD: quote was clipping off the card edge). */}
      <div style={{ ...head, position: "relative", fontWeight: 500, maxWidth: 1080, margin: "0 auto" }}>
        <KineticLine
          text={quote}
          delay={10}
          stride={1.1}
          wordGap={4}
          mode="blur"
          emphasis="gradient"
          baseWeight={500}
          align="center"
          style={{ fontSize: 52, lineHeight: 1.32, letterSpacing: "-0.012em" }}
        />
      </div>

      {/* accent rule */}
      <Rule delay={20} />

      {/* attribution row — monogram + name */}
      <Attribution attribution={attribution} delay={26} />
    </div>
  );
};

const Rule: React.FC<{ delay: number }> = ({ delay }) => {
  const c = palette();
  const s = useEnter(delay);
  return (
    <div
      style={{
        width: interpolate(s, [0, 1], [0, 96], { extrapolateRight: "clamp" }),
        height: 4,
        borderRadius: 99,
        margin: "44px auto 30px",
        background: `linear-gradient(90deg, ${c("accent")}, ${c("accent2")})`,
        boxShadow: `0 0 20px ${c("accent", 0.55)}`,
        opacity: interpolate(s, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
      }}
    />
  );
};

const Attribution: React.FC<{ attribution: string; delay: number }> = ({
  attribution,
  delay,
}) => {
  const c = palette();
  const s = useEnter(delay);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        opacity: interpolate(s, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${(1 - s) * 18}px)`,
      }}
    >
      <Monogram attribution={attribution} />
      <div
        style={{
          textAlign: "left",
          fontFamily: FONTS.body,
          fontSize: 28,
          color: c("textDim"),
        }}
      >
        <span style={{ color: c("text"), fontWeight: 800, display: "block", fontSize: 30 }}>
          {attribution}
        </span>
      </div>
    </div>
  );
};
