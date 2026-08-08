/**
 * `src/kino-scenes/productshot` — the studio-quality ProductShot archetype + kit.
 *
 * The S3 hero, rebuilt to read like a real Linear/Vercel feature shot: the
 * product screenshot framed in floating browser chrome with a perspective tilt
 * (`HeroDevice` / `BrowserChrome`), an out-of-focus shader `Backdrop` behind it,
 * parallax depth layers off one shared camera, a soft contact shadow + floor,
 * glass / gradient-border callout cards with connector lines (`GlassCallout`),
 * and the ONE signature motion — a slow camera push-in on reveal. Degrades to a
 * seeded, brand-tinted `MockUI` when no screenshot resolves (never an empty box).
 *
 * `<ProductShot>` is the archetype the registry binds; the rest are the craft
 * primitives it composes (also reusable by the storyboard/still path).
 *
 * All frame-pure, palette-tokened, screenshot-path (real DOM, never video).
 * Frozen spec: `docs/SAAS_ROADMAP.md §4`, `docs/ENGINE_DESIGN.md`.
 */
export { ProductShot } from "./scene";

export { HeroDevice, type HeroDeviceProps } from "./device";
export { BrowserChrome, type BrowserChromeProps } from "./chrome";
export { MockUI } from "./mock-ui";
export {
  SCREENS,
  screenFor,
  type ResuBirdScreenId,
  type ScreenSpec,
  type HotRect,
} from "./screens";
export {
  GlassCallout,
  type GlassCalloutProps,
  type CalloutAnchor,
} from "./callout";
export { deriveUrl, type DerivedUrl } from "./url";
export {
  Camera,
  ParallaxLayer,
  DofBackdrop,
  ContactShadow,
  Floor,
  useCameraPushIn,
  useDeviceReveal,
  type CameraState,
} from "./stage";
