/**
 * S3 ProductShot — the studio-quality hero. Collapses DashboardShot /
 * AnalysisShot / ResubirdShot into ONE prop-driven archetype and carries the
 * video's SIGNATURE motion (the camera push-in).
 *
 * What makes it read like a real Linear/Vercel feature shot (dossier §2/§5):
 *  - the real screenshot framed in floating browser chrome with a perspective
 *    tilt (`HeroDevice`);
 *  - a depth-of-field, out-of-focus shader `Backdrop` behind it (`DofBackdrop`);
 *  - parallax depth layers — bg, device, and callouts each move at their own
 *    depth off one shared camera (`ParallaxLayer`);
 *  - a soft contact shadow + faint floor so the device reads as standing in a
 *    room, not floating in void (`ContactShadow` / `Floor`);
 *  - glass / gradient-border CALLOUT cards that animate in with connector lines
 *    to the UI region (`GlassCallout`);
 *  - the ONE signature motion: a slow camera push-in on reveal (`useCameraPushIn`
 *    + `Camera`) — the whole frame dollies as a single lens.
 *
 * Degrades gracefully: with no screenshot the chrome frames a seeded, brand-
 * tinted `MockUI` dashboard (a tasteful abstract mock, never an empty box).
 *
 * Reads `ProductShotProps` (frozen contract, `src/spec`). `screen` is an asset
 * KEY → a still/`<Img>` src (NEVER `OffthreadVideo`). DETERMINISM (ENGINE_DESIGN
 * §2): every visual is `interpolate`/`spring` at `useFrame().frame`; the only
 * entropy is the seeded MockUI. Two renders of frame N are byte-identical.
 *
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md`.
 */
import * as React from "react";

import { palette } from "../../design";
import type { ProductShotProps } from "../../spec";
import {
  Fill,
  Kicker,
  Headline,
  Pop,
  resolveAsset,
  useHeadlineStyle,
} from "../kit";
import { GlassCallout, type CalloutAnchor } from "./callout";
import { HeroDevice } from "./device";
import {
  Camera,
  DofBackdrop,
  Floor,
  ParallaxLayer,
  useCameraPushIn,
} from "./stage";
import { deriveUrl } from "./url";
import { isLiveScreenKey } from "./screens";

/* -------------------------------------------------------------------------- */
/*  Callout placement — anchor corner → inset (NOT free left/top literals)      */
/*                                                                              */
/*  The LLM supplies a corner anchor, never coordinates; the layout + corner    */
/*  resolve to a deterministic inset so cards never overlap the device center   */
/*  and connectors always reach inward toward the UI.                           */
/* -------------------------------------------------------------------------- */

type CalloutSpec = ProductShotProps["callouts"][number];

const calloutPosition = (
  anchor: CalloutSpec["anchor"],
  layout: ProductShotProps["layout"],
): React.CSSProperties => {
  // SINGLE layout: the hero device is ~880px wide, centered (left edge ~520,
  // right edge ~1400) and runs y~258→928. Anchor the callouts just OUTSIDE the
  // device corners (not the frame edge) so the connector reaches inward to the
  // UI and the card never crowds the frame edge (CD: top-right callout ran off
  // the right edge). Bottom cards sit above the caption-safe zone.
  const inset = layout === "split" ? 24 : 300;
  const vTop = layout === "split" ? 96 : 300;
  const vBottom = layout === "split" ? 28 : 252;
  const x =
    anchor === "tl" || anchor === "bl" ? { left: inset } : { right: inset };
  const y =
    anchor === "tl" || anchor === "tr" ? { top: vTop } : { bottom: vBottom };
  return { ...x, ...y };
};

/** A callout's depth for parallax: top cards sit a touch nearer than bottom. */
const calloutDepth = (anchor: CalloutSpec["anchor"]): number =>
  anchor === "tl" || anchor === "tr" ? 0.82 : 0.74;

/* -------------------------------------------------------------------------- */
/*  ProductShot                                                                 */
/* -------------------------------------------------------------------------- */

export const ProductShot: React.FC<ProductShotProps> = ({
  kicker,
  headline,
  screen,
  layout,
  tilt,
  callouts,
}) => {
  const head = useHeadlineStyle();
  const c = palette();

  // `screen` is an asset key → still URL. The bespoke ResuBird views have no
  // external still on disk; they render LIVE via `MockUI` (resolving one to an
  // `<img src>` would 404 → a zero-height image that collapses the hero to an
  // empty browser bar). For those keys we pass NO src so the chrome renders the
  // live UI; any other key resolves to its still, degrading to MockUI if absent.
  const src = screen && !isLiveScreenKey(screen) ? resolveAsset(screen) : undefined;
  // Stable per-shot seed for the MockUI fallback + element ids (no brandKitId in
  // scene props — the screen key is a stable, per-video constant).
  const seed = screen || `${kicker}|${headline}`;

  // The REAL product URL for the address pill — recovered from the screen asset
  // key (brand path → host + route), never the stock `app.product.com`. This is
  // the single detail that reads the chrome as a genuine product, not a template.
  const url = deriveUrl(screen, headline).display;

  // THE signature motion: the camera dollies into the subject on reveal. One
  // shared driver every depth layer reads, so the frame moves as a single lens.
  const cam = useCameraPushIn(18, 70);

  const renderCallouts = (depthBoost = 0) =>
    callouts.map((cta, i) => (
      <ParallaxLayer
        key={i}
        cam={cam}
        depth={calloutDepth(cta.anchor) + depthBoost}
        float={4}
        phase={i * 1.7}
      >
        <GlassCallout
          delay={42 + i * 14}
          icon={cta.icon}
          title={cta.title}
          sub={cta.sub}
          accent={cta.accent}
          anchor={cta.anchor as CalloutAnchor}
          placement={calloutPosition(cta.anchor, layout)}
        />
      </ParallaxLayer>
    ));

  /* ----------------------------- SPLIT layout ----------------------------- */
  if (layout === "split") {
    return (
      <Fill style={{ backgroundColor: c("bg"), overflow: "hidden" }}>
        {/* Out-of-focus depth field behind everything. */}
        <DofBackdrop cam={cam} />
        <Floor s={cam.s} />

        <Camera cam={cam}>
          {/* Copy column — the slowest-moving foreground text plane. */}
          <ParallaxLayer cam={cam} depth={0.6}>
            <Fill
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                padding: "0 130px",
                gap: 80,
              }}
            >
              <div style={{ flex: 1.05 }}>
                <Kicker>{kicker}</Kicker>
                <Pop delay={12}>
                  <div
                    style={{
                      ...head,
                      fontSize: 84,
                      lineHeight: 1.08,
                      marginTop: 28,
                    }}
                  >
                    <Headline text={headline} />
                  </div>
                </Pop>
              </div>
              <div style={{ flex: 0.95 }} />
            </Fill>
          </ParallaxLayer>

          {/* Device plane — the focal subject, on the right. */}
          <ParallaxLayer cam={cam} depth={0.9} float={3}>
            <Fill
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 130px",
              }}
            >
              <div style={{ position: "relative" }}>
                <HeroDevice
                  src={src}
                  seed={seed}
                  url={url}
                  width={760}
                  tiltX={tilt}
                  tiltY={-8}
                  delay={16}
                />
              </div>
            </Fill>
          </ParallaxLayer>

          {/* Callout plane — nearest the lens. */}
          <Fill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "0 130px",
            }}
          >
            <div style={{ position: "relative", width: 760, height: 480 }}>
              {renderCallouts()}
            </div>
          </Fill>
        </Camera>
      </Fill>
    );
  }

  /* --------------------------- SINGLE (full-bleed) ------------------------ */
  return (
    <Fill style={{ backgroundColor: c("bg"), overflow: "hidden" }}>
      <DofBackdrop cam={cam} />
      <Floor s={cam.s} />

      <Camera cam={cam}>
        {/* Headline plane — sits above the hero, slow foreground. Centered as a
            contained block (kicker pill + headline on one tight measure) so it
            reads as a deliberate centered title, not edge-to-edge text. */}
        <ParallaxLayer cam={cam} depth={0.55}>
          <Fill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 36,
            }}
          >
            <Kicker>{kicker}</Kicker>
            {/* RESERVED HEADLINE BOUNDS (CD #2: headline collided with the device
                URL pill at t=8). The device plane is top-anchored at y232 and the
                caption band starts at y870, so the device cannot move down. We
                instead bound the headline block: a smaller display size + tighter
                top rhythm so even a TWO-LINE headline settles clear above y232,
                never overlapping the floating chrome below. */}
            <Pop delay={10}>
              <div
                style={{
                  ...head,
                  fontSize: 50,
                  marginTop: 12,
                  textAlign: "center",
                  maxWidth: 1280,
                  lineHeight: 1.04,
                  overflowWrap: "break-word",
                }}
              >
                <Headline text={headline} />
              </div>
            </Pop>
          </Fill>
        </ParallaxLayer>

        {/* Hero device plane — the focal subject. Sized + positioned to FLOAT
            FULLY in frame AND clear the burned-in caption band: the real
            screenshot is ~1.42:1, so at width 880 the whole card (bar + screen
            ≈ 670px tall) sits from ~y260 to ~y930 — between the headline and the
            caption-safe zone — with its full elevation shadow visible. Previously
            a 980px card at top:300 ran its bottom edge (~y1045) into the caption
            band (CD: caption collided with the dashboard bottom). */}
        <ParallaxLayer cam={cam} depth={0.9} float={3}>
          <Fill
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              top: 168,
            }}
          >
            {/* SHAREABILITY SCALE (CD R7 P1): the hero floated small upper-center
                in ~60% dead cream — illegible at thumbnail/autoplay scale. Now the
                shell is rendered at ~1040px (≈54% frame width, the gauge/diff ~30%
                larger) and raised to y168, so the card fills the canvas between the
                tightened headline and the caption-safe edge (bar+shell ≈ 691px tall
                → bottom ~y859, clear of the y870 caption band). `delay={6}`: rise
                EARLY so the dashboard carries into the cut from the hook instead of
                leaving a near-empty cream beat (CD R5 P0a). */}
            <HeroDevice
              src={src}
              seed={seed}
              url={url}
              width={1040}
              tiltX={tilt}
              tiltY={0}
              delay={6}
            />
          </Fill>
        </ParallaxLayer>

        {/* Callout plane — nearest the lens, over the UI. */}
        {renderCallouts()}
      </Camera>
    </Fill>
  );
};
