/**
 * PALETTE PROVIDER — palette threaded as DATA, never `import {COLORS}`.
 *
 * Scenes read colors from React context via `usePalette()` / the `palette(key,
 * alpha)` helper, instead of importing a per-brand `COLORS` const. This is the
 * injection path that unifies the two forked UI kits (`ui.tsx` /
 * `resubird/ui.tsx`) into one parameterized tree, and it is what makes the
 * anti-slop lint rule "no raw hex; colors must be `PaletteKey` → `palette(key,
 * alpha)`" enforceable (kills the `${COLORS.blue}55` string-concat).
 *
 * Frozen spec — `docs/SAAS_ROADMAP.md §4` (anti-slop: "No off-token color") and
 * §5 ("`PaletteProvider value={palette} motion={motion}`"). The `Palette` /
 * `PaletteKey` / `Motion` types come from `src/spec` (the contract) and are NOT
 * redefined here.
 *
 * Determinism: pure resolution of a key → color string. No time, no random.
 *
 * NOTE: this file uses JSX, so the integrator should keep its extension as
 * `.tsx` if it ever moves; written here as `palette.ts` per the assigned path —
 * the provider is exposed via `React.createElement` so no JSX syntax is used and
 * a plain `.ts` extension type-checks.
 */
import * as React from "react";

import type { Palette, PaletteKey, Motion, Preset } from "../spec";

/* -------------------------------------------------------------------------- */
/*  Context value                                                              */
/* -------------------------------------------------------------------------- */

/**
 * What the provider threads through the tree: the resolved `Palette` swatches
 * plus the active `Motion` token id. Scenes read both from context rather than
 * importing brand-specific consts — the single injection seam.
 */
export type PaletteContextValue = {
  palette: Palette;
  motion: Motion;
  /**
   * The active style preset. Threaded so the shader `<Backdrop>` can resolve its
   * frozen background treatment (`src/kino-scenes/backgrounds/treatments`) from
   * context instead of taking it as a prop. Optional for back-compat with callers
   * that only provide palette+motion; the shader backdrop falls back to
   * `dark-cinematic` when absent.
   */
  preset?: Preset;
};

/**
 * The context, created LAZILY on first use.
 *
 * Why lazy: this `src/design` barrel is imported by pure-data consumers — the
 * heuristic/LLM directors and the anti-slop lint — that only need the preset
 * bundles, never the React context. In a React Server Component / RSC server
 * bundle (the Next.js web app's API routes), `React.createContext` is stubbed to
 * throw, so calling it at module-eval time would crash the whole import chain
 * (`pipeline/heuristic → design → palette`) even though no rendering happens.
 * Deferring the call means merely *importing* the design system is side-effect
 * free; the context is only materialized when a provider/hook actually runs,
 * which is exclusively in the client/render bundle. `null` default preserved so
 * a missing provider still fails loudly.
 */
let _paletteContext: React.Context<PaletteContextValue | null> | null = null;
function paletteContext(): React.Context<PaletteContextValue | null> {
  if (_paletteContext === null) {
    _paletteContext = React.createContext<PaletteContextValue | null>(null);
    _paletteContext.displayName = "PaletteContext";
  }
  return _paletteContext;
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                   */
/* -------------------------------------------------------------------------- */

export type PaletteProviderProps = {
  palette: Palette;
  motion: Motion;
  /** Active style preset (selects the shader backdrop treatment). */
  preset?: Preset;
  children: React.ReactNode;
};

/**
 * Threads the active `palette` + `motion` down the tree. Wrap the whole video
 * root in this (`<PaletteProvider value={palette} motion={motion}>`); every
 * scene then reads tokens from context.
 *
 * The value object is memoized on `palette`/`motion` so consumers don't
 * re-render on unrelated parent updates — and so the value identity is stable
 * for a given frame, preserving determinism.
 */
export const PaletteProvider: React.FC<PaletteProviderProps> = ({
  palette,
  motion,
  preset,
  children,
}) => {
  const value = React.useMemo<PaletteContextValue>(
    () => ({ palette, motion, preset }),
    [palette, motion, preset],
  );
  return React.createElement(paletteContext().Provider, { value }, children);
};

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                       */
/* -------------------------------------------------------------------------- */

/** Read the full context value. Throws if used outside a `PaletteProvider`. */
export const usePaletteContext = (): PaletteContextValue => {
  const ctx = React.useContext(paletteContext());
  if (ctx === null) {
    throw new Error(
      "usePaletteContext must be used within a <PaletteProvider>. " +
        "Wrap the video root in <PaletteProvider palette={...} motion={...}>.",
    );
  }
  return ctx;
};

/** Read just the active `Palette` swatches. */
export const usePalette = (): Palette => usePaletteContext().palette;

/** Read just the active `Motion` token id. */
export const useMotion = (): Motion => usePaletteContext().motion;

/**
 * Read the active style `Preset` (or `undefined` when a legacy provider only
 * threaded palette+motion). The shader `<Backdrop>` resolves its treatment from
 * this, defaulting to `dark-cinematic` when absent.
 */
export const usePreset = (): Preset | undefined => usePaletteContext().preset;

/* -------------------------------------------------------------------------- */
/*  Color resolution                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Clamp an alpha to `[0, 1]`. Out-of-range values are a caller bug; we clamp
 * rather than throw so a stray `1.2` degrades gracefully to opaque.
 */
const clampAlpha = (alpha: number): number =>
  alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;

/**
 * Convert a base color + alpha into a CSS color string.
 *
 * Supports the two forms the contract's `zColor()` swatches take:
 *  - `#rgb` / `#rrggbb` hex → emitted as `rgba(r,g,b,a)`.
 *  - any other CSS color (named, `rgb(...)`, `hsl(...)`) → wrapped via
 *    `color-mix` against `transparent` so alpha still applies without parsing.
 *
 * At `alpha === 1` the base string is returned unchanged (the common path) so
 * we never reformat a fully-opaque token.
 */
const withAlpha = (base: string, alpha: number): string => {
  if (alpha >= 1) return base;
  const a = clampAlpha(alpha);

  const hex = base.trim();
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
  if (isHex) {
    let r: number;
    let g: number;
    let b: number;
    if (hex.length === 4) {
      // #rgb → expand each nibble
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Non-hex CSS color: apply alpha via color-mix (no manual parsing).
  const pct = Math.round(a * 100);
  return `color-mix(in srgb, ${base} ${pct}%, transparent)`;
};

/**
 * Resolve a `PaletteKey` against a `Palette` to a CSS color string.
 *
 * `accent2` is optional in the `Palette`; when a scene references it but the
 * palette omits it, we fall back to `accent` (the contract's nearest sibling)
 * so a scene never renders a `transparent`/`undefined` color by surprise.
 */
export const resolvePaletteColor = (
  pal: Palette,
  key: PaletteKey,
  alpha = 1,
): string => {
  const base = key === "accent2" ? pal.accent2 ?? pal.accent : pal[key];
  return withAlpha(base, alpha);
};

/**
 * The `palette(key, alpha)` helper, bound to context.
 *
 * Usage inside a scene:
 * ```tsx
 * const c = palette();              // a resolver
 * <div style={{ color: c("text"), background: c("accent", 0.18) }} />
 * ```
 * Returning a bound resolver (rather than reading context per call) keeps the
 * hook-call count stable across frames — a determinism/Rules-of-Hooks nicety.
 */
export const palette = (): ((key: PaletteKey, alpha?: number) => string) => {
  const pal = usePalette();
  return React.useCallback(
    (key: PaletteKey, alpha = 1): string => resolvePaletteColor(pal, key, alpha),
    [pal],
  );
};
