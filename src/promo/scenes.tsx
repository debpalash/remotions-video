import React from "react";
import {
  Img,
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, GRADIENT_TEXT } from "./theme";
import { Backdrop, Callout, Kicker, Pop, ScreenFrame } from "./ui";
import type { HookProps, ProductShotProps, CtaProps } from "../spec";

/* -------------------------------------------------------------------------- */
/*  Prop-driven scene resolvers                                                */
/*  These map the spec's enum/anchor/asset-key slots (which the LLM assembles  */
/*  but cannot style) onto the existing Remotion primitives. The Kino runtime  */
/*  swap is a later step; for now scenes still render through these imports.   */
/* -------------------------------------------------------------------------- */

/** ProductShot callout shape (one element of `ProductShotProps["callouts"]`). */
type CalloutSpec = ProductShotProps["callouts"][number];

/**
 * Resolve a `screen` asset key → a `staticFile`-able path. Keys may already
 * carry an extension; bare keys default to `.webp` (the product-shot still
 * format in `public/`). NEVER resolves to a video — `ScreenFrame` uses `Img`.
 */
const resolveAsset = (key: string): string =>
  /\.[a-z0-9]+$/i.test(key) ? key : `${key}.webp`;

/** PaletteKey accent enum → a concrete brand color (kills hex in scene props). */
const ACCENT_COLOR: Record<CalloutSpec["accent"], string> = {
  accent: COLORS.blue,
  accent2: COLORS.green,
  text: COLORS.white,
};

/**
 * Anchor corner → absolute placement. Anchors (NOT left/top literals) are what
 * the spec exposes so the model can't author off-grid geometry. `split` layout
 * pins callouts to the screen column (right half); `single` uses the safe
 * margins of the full frame.
 */
const calloutPosition = (
  anchor: CalloutSpec["anchor"],
  layout: ProductShotProps["layout"],
): React.CSSProperties => {
  const inset = layout === "split" ? 40 : 90;
  const vTop = layout === "split" ? 120 : 440;
  const vBottom = layout === "split" ? 40 : 90;
  const x = anchor === "tl" || anchor === "bl" ? { left: inset } : { right: inset };
  const y =
    anchor === "tl" || anchor === "tr" ? { top: vTop } : { bottom: vBottom };
  return { ...x, ...y };
};

/**
 * Render a headline string, lifting a single `*marked*` span into the signature
 * gradient. This is the one emphasis affordance the copy controls — no raw
 * colors leak into props. Used by both ProductShot and CTA.
 */
const renderHeadline = (text: string): React.ReactNode =>
  text.split(/\*(.+?)\*/).map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} style={GRADIENT_TEXT}>
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
    }}
  >
    {children}
  </AbsoluteFill>
);

const headline: React.CSSProperties = {
  fontFamily: FONTS.display,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: COLORS.white,
};

// Word-by-word kinetic line
const StaggerLine: React.FC<{
  words: string[];
  delay: number;
  perWord?: number;
  style?: React.CSSProperties;
}> = ({ words, delay, perWord = 4, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: "0.28em", justifyContent: "center" }}>
      {words.map((w, i) => {
        const s = spring({
          frame: frame - delay - i * perWord,
          fps,
          config: { damping: 13, mass: 0.5 },
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

// ————— Scene 1: Hook (S1) —————
// Prop-driven: one claim, ≤3s, always the shortest scene. `lines[]` drives the
// kinetic stagger; the final line carries the signature gradient. With no
// props it renders the original Yupcha hook verbatim (legacy visual preserved).

/** Original hard-coded hook, kept pixel-for-pixel for the shipped promo. */
const LegacyYupchaHook: React.FC = () => (
  <div style={{ ...headline, fontSize: 112, lineHeight: 1.12 }}>
    <StaggerLine words={["Hiring", "takes"]} delay={2} />
    <StaggerLine
      words={["42", "days."]}
      delay={12}
      style={{ color: COLORS.red }}
    />
    <StaggerLine words={["Your", "best", "candidates"]} delay={40} />
    <StaggerLine
      words={["are", "gone", "in", "10."]}
      delay={52}
      style={GRADIENT_TEXT}
    />
  </div>
);

export const Hook: React.FC<Partial<HookProps>> = ({ lines }) => {
  // Font size shrinks as the claim gets denser, keeping it on one screen.
  const fontSize = !lines ? 112 : lines.length >= 3 ? 84 : 112;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Center>
        {lines ? (
          <div
            style={{
              ...headline,
              fontSize,
              lineHeight: 1.12,
              textAlign: "center",
            }}
          >
            {lines.map((line, i) => (
              <StaggerLine
                key={i}
                words={line.split(" ")}
                delay={2 + i * 14}
                style={i === lines.length - 1 ? GRADIENT_TEXT : undefined}
              />
            ))}
          </div>
        ) : (
          <LegacyYupchaHook />
        )}
      </Center>
    </AbsoluteFill>
  );
};

// ————— Scene 2: Problem montage (rapid-fire stamps) —————
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamps = [
    { text: "200 resumes per role", delay: 0 },
    { text: "40 screening calls", delay: 22 },
    { text: "Calendar tetris for weeks", delay: 44 },
  ];
  const punch = spring({
    frame: frame - 70,
    fps,
    config: { damping: 12, mass: 0.5 },
  });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Center>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 30,
            alignItems: "center",
          }}
        >
          {stamps.map((st, i) => {
            const s = spring({
              frame: frame - st.delay,
              fps,
              config: { damping: 11, mass: 0.4 },
            });
            return (
              <div
                key={i}
                style={{
                  ...headline,
                  fontSize: 72,
                  opacity:
                    interpolate(s, [0, 0.4], [0, 1], {
                      extrapolateRight: "clamp",
                    }) * (frame > 68 ? 0.32 : 1),
                  transform: `scale(${1.6 - s * 0.6})`,
                  textDecoration: frame > 68 ? "line-through" : "none",
                  textDecorationColor: COLORS.red,
                  textDecorationThickness: 6,
                }}
              >
                {st.text}
              </div>
            );
          })}
          <div
            style={{
              ...headline,
              marginTop: 20,
              fontSize: 92,
              opacity: interpolate(punch, [0, 0.5], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `scale(${0.8 + punch * 0.2})`,
              ...GRADIENT_TEXT,
            }}
          >
            So we fixed it.
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ————— Scene 3: Logo reveal —————
export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, mass: 1 } });
  const spin = interpolate(s, [0, 1], [220, 0]);
  const glowPulse = 0.5 + Math.sin(frame / 10) * 0.2;
  return (
    <AbsoluteFill>
      <Backdrop hue="green" />
      <Center>
        <div
          style={{
            width: 230,
            height: 218,
            transform: `rotate(${spin}deg) scale(${s})`,
            filter: `drop-shadow(0 0 ${40 * glowPulse}px ${COLORS.blue}aa)`,
          }}
        >
          <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
        </div>
        <Pop delay={14}>
          <div style={{ ...headline, fontSize: 134, marginTop: 30 }}>
            Meet <span style={GRADIENT_TEXT}>Yupcha</span>
          </div>
        </Pop>
        <Pop delay={26}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 34,
              fontWeight: 500,
              color: COLORS.dim,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginTop: 14,
            }}
          >
            The Agentic Hiring Platform
          </div>
        </Pop>
      </Center>
    </AbsoluteFill>
  );
};

// ————— S3 ProductShot — hero UI + callouts (the signature motion) —————
// The single collapse of DashboardShot / AnalysisShot / ResubirdShot. One
// prop-driven archetype: Kicker → headline → ScreenFrame → Callouts. `layout`
// picks the composition; `screen` is an asset key (still/Img, never video);
// callouts anchor to corners (no left/top literals).
export const ProductShot: React.FC<ProductShotProps> = ({
  kicker,
  headline: headlineText,
  screen,
  layout,
  tilt,
  callouts,
}) => {
  const src = staticFile(resolveAsset(screen));

  if (layout === "split") {
    return (
      <AbsoluteFill>
        <Backdrop />
        <AbsoluteFill
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: "0 130px",
            gap: 80,
          }}
        >
          <div style={{ flex: 1.1 }}>
            <Kicker>{kicker}</Kicker>
            <Pop delay={10}>
              <div
                style={{
                  ...headline,
                  fontSize: 86,
                  lineHeight: 1.08,
                  marginTop: 30,
                }}
              >
                {renderHeadline(headlineText)}
              </div>
            </Pop>
          </div>
          <div style={{ flex: 0.9, position: "relative" }}>
            <ScreenFrame src={src} delay={14} tilt={tilt} style={{ width: 730 }} />
            {callouts.map((c, i) => (
              <Callout
                key={i}
                delay={36 + i * 12}
                icon={c.icon}
                title={c.title}
                sub={c.sub}
                accent={ACCENT_COLOR[c.accent]}
                style={calloutPosition(c.anchor, layout)}
              />
            ))}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // single (full-bleed hero)
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
        <Kicker>{kicker}</Kicker>
        <Pop delay={8}>
          <div
            style={{
              ...headline,
              fontSize: 78,
              marginTop: 26,
              textAlign: "center",
            }}
          >
            {renderHeadline(headlineText)}
          </div>
        </Pop>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ justifyContent: "flex-end", alignItems: "center", bottom: -40 }}
      >
        <ScreenFrame src={src} delay={16} tilt={tilt} style={{ width: 1380 }} />
      </AbsoluteFill>
      {callouts.map((c, i) => (
        <Callout
          key={i}
          delay={36 + i * 12}
          icon={c.icon}
          title={c.title}
          sub={c.sub}
          accent={ACCENT_COLOR[c.accent]}
          style={calloutPosition(c.anchor, layout)}
        />
      ))}
    </AbsoluteFill>
  );
};

/* —— Legacy promo wrappers (preserve the shipped YupchaPromo visuals) ———————
 * These pin the exact props the three original shots used so the existing
 * `YupchaPromo.tsx` (which this run does not own) keeps rendering unchanged.   */

export const DashboardShot: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
      <Kicker>AI Interviewer</Kicker>
      <Pop delay={8}>
        <div
          style={{
            ...headline,
            fontSize: 78,
            marginTop: 26,
            textAlign: "center",
          }}
        >
          Interviews that run <span style={GRADIENT_TEXT}>themselves</span>
        </div>
      </Pop>
    </AbsoluteFill>
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", bottom: -40 }}
    >
      <ScreenFrame
        src={staticFile("yupcha/interviewer.webp")}
        delay={16}
        tilt={7}
        style={{ width: 1380 }}
      />
    </AbsoluteFill>
    <Callout
      delay={36}
      icon="🤖"
      title="24/7, no scheduling"
      sub="First rounds run while you sleep"
      style={{ left: 90, top: 420 }}
      accent={COLORS.green}
    />
    <Callout
      delay={48}
      icon="🎯"
      title="Adapts mid-interview"
      sub="Follow-ups based on each answer"
      style={{ right: 90, top: 540 }}
    />
  </AbsoluteFill>
);

export const AnalysisShot: React.FC = () => (
  <AbsoluteFill>
    <Backdrop hue="green" />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 64 }}>
      <Kicker>Live Analysis</Kicker>
      <Pop delay={8}>
        <div style={{ ...headline, fontSize: 78, marginTop: 26 }}>
          Every answer, <span style={GRADIENT_TEXT}>scored live</span>
        </div>
      </Pop>
    </AbsoluteFill>
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", bottom: -40 }}
    >
      <ScreenFrame
        src={staticFile("yupcha/dashboard.webp")}
        delay={14}
        tilt={7}
        style={{ width: 1100 }}
      />
    </AbsoluteFill>
    <Callout
      delay={34}
      icon="📊"
      title="98% confidence scoring"
      sub="Sentiment + competency metrics"
      style={{ left: 90, top: 470 }}
    />
    <Callout
      delay={46}
      icon="⚖️"
      title="Zero bias"
      sub="No names or photos. Skills only."
      style={{ right: 90, top: 580 }}
      accent={COLORS.yellow}
    />
  </AbsoluteFill>
);

export const ResubirdShot: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: "0 130px",
        gap: 80,
      }}
    >
      <div style={{ flex: 1.1 }}>
        <Kicker>For Candidates · Resubird</Kicker>
        <Pop delay={10}>
          <div
            style={{
              ...headline,
              fontSize: 86,
              lineHeight: 1.08,
              marginTop: 30,
            }}
          >
            Resumes that <span style={GRADIENT_TEXT}>beat the ATS</span>
          </div>
        </Pop>
        <Pop delay={22}>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 36,
              color: COLORS.dim,
              marginTop: 28,
              lineHeight: 1.45,
            }}
          >
            Rewrites your resume until it hits
            <br />
            <span style={{ color: COLORS.green, fontWeight: 800 }}>
              98.4% ATS match
            </span>{" "}
            on the real post.
          </div>
        </Pop>
      </div>
      <div style={{ flex: 0.9, position: "relative" }}>
        <ScreenFrame
          src={staticFile("yupcha/resubird.webp")}
          delay={14}
          style={{ width: 730 }}
        />
        <Callout
          delay={36}
          icon="✅"
          title="92% Optimization Score"
          sub="Shows exactly what to fix"
          style={{ left: -60, bottom: -70 }}
          accent={COLORS.green}
        />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

// ————— Scene 7: Stats counters —————
const Counter: React.FC<{
  to: number;
  suffix?: string;
  decimals?: number;
  label: string;
  delay: number;
  accent: string;
}> = ({ to, suffix = "", decimals = 0, label, delay, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, mass: 0.8 },
  });
  const progress = interpolate(frame - delay, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
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
        background:
          "linear-gradient(160deg, rgba(22,33,66,0.7), rgba(10,17,38,0.6))",
        border: `1px solid ${accent}40`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 60px ${accent}1f`,
        width: 380,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: accent,
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
          color: COLORS.dim,
          marginTop: 10,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const Stats: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <Center>
      <Pop>
        <div style={{ ...headline, fontSize: 74, marginBottom: 70 }}>
          Teams are already <span style={GRADIENT_TEXT}>hiring faster</span>
        </div>
      </Pop>
      <div style={{ display: "flex", gap: 44 }}>
        <Counter
          to={530}
          suffix="+"
          label="candidates screened"
          delay={10}
          accent={COLORS.blue}
        />
        <Counter
          to={98.4}
          suffix="%"
          decimals={1}
          label="ATS match score"
          delay={20}
          accent={COLORS.green}
        />
        <Counter
          to={4.9}
          suffix="★"
          decimals={1}
          label="average review"
          delay={30}
          accent={COLORS.yellow}
        />
        <Counter
          to={6000}
          suffix="+"
          label="community members"
          delay={40}
          accent={COLORS.blue}
        />
      </div>
    </Center>
  </AbsoluteFill>
);

// ————— Scene 8: Testimonial —————
export const Testimonial: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop hue="green" />
      <Center>
        <Pop>
          <div
            style={{
              maxWidth: 1280,
              textAlign: "center",
              padding: "70px 90px",
              borderRadius: 36,
              background:
                "linear-gradient(160deg, rgba(22,33,66,0.8), rgba(10,17,38,0.72))",
              border: `1px solid ${COLORS.blue}40`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 40px 100px rgba(0,0,0,0.55)`,
            }}
          >
            <div style={{ fontSize: 50, marginBottom: 26 }}>
              {"★★★★★".split("").map((star, i) => (
                <span
                  key={i}
                  style={{
                    color: COLORS.yellow,
                    opacity: frame > 8 + i * 4 ? 1 : 0.15,
                    textShadow: `0 0 20px ${COLORS.yellow}88`,
                  }}
                >
                  {star}
                </span>
              ))}
            </div>
            <div
              style={{
                ...headline,
                fontSize: 52,
                fontWeight: 500,
                lineHeight: 1.32,
                letterSpacing: "-0.01em",
              }}
            >
              “Stellar understanding of architecture.
              <br />
              Definitely recommend moving forward.”
            </div>
            <Pop delay={20}>
              <div
                style={{
                  fontFamily: FONTS.body,
                  marginTop: 36,
                  fontSize: 31,
                  color: COLORS.dim,
                }}
              >
                <span style={{ color: COLORS.white, fontWeight: 800 }}>
                  Elena Rodriguez
                </span>
                {"  ·  Lead Architect  ·  4.9 rating"}
              </div>
            </Pop>
          </div>
        </Pop>
      </Center>
    </AbsoluteFill>
  );
};

// ————— S7 CTA — wordmark + one action, longest hold; always last —————
// Prop-driven: `headline` (with optional `*marked*` gradient span) + `url`
// (drives the action pill). With no props it renders the original Yupcha CTA.
export const CTA: React.FC<Partial<CtaProps>> = ({ headline: head, url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, mass: 1 } });
  const pulse = 1 + Math.sin(frame / 9) * 0.02;
  const urlSpring = spring({
    frame: frame - 34,
    fps,
    config: { damping: 13, mass: 0.6 },
  });
  const sweepX = interpolate(frame % 75, [18, 55], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const action = url ? `Try free → ${url}` : "Try free → yupcha.com";
  return (
    <AbsoluteFill>
      <Backdrop />
      <Center>
        <div
          style={{
            width: 150,
            height: 142,
            transform: `scale(${s})`,
            filter: `drop-shadow(0 0 36px ${COLORS.blue}99)`,
            marginBottom: 36,
          }}
        >
          <Img src={staticFile("yupcha/logo.svg")} style={{ width: "100%" }} />
        </div>
        <Pop delay={8}>
          <div
            style={{
              ...headline,
              fontSize: 120,
              textAlign: "center",
              lineHeight: 1.05,
            }}
          >
            {head ? (
              renderHeadline(head)
            ) : (
              <>
                Hire <span style={GRADIENT_TEXT}>10× faster.</span>
              </>
            )}
          </div>
        </Pop>
        <Pop delay={18}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 32,
              color: COLORS.dim,
              marginTop: 26,
              fontWeight: 500,
              letterSpacing: "0.08em",
            }}
          >
            AI interviews · Live scoring · Zero bias
          </div>
        </Pop>
        <div
          style={{
            marginTop: 60,
            opacity: interpolate(urlSpring, [0, 0.5], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${(1 - urlSpring) * 40}px) scale(${pulse})`,
            padding: "26px 70px",
            borderRadius: 999,
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: COLORS.white,
            background: `linear-gradient(100deg, ${COLORS.blue}, #2f6fe0)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 70px ${COLORS.blue}88, 0 24px 60px rgba(0,0,0,0.5)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <span style={{ position: "relative", zIndex: 1 }}>{action}</span>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${sweepX - 14}%, rgba(255,255,255,0.28) ${sweepX}%, transparent ${sweepX + 14}%)`,
            }}
          />
        </div>
      </Center>
    </AbsoluteFill>
  );
};
