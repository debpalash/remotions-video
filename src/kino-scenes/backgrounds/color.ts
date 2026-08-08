/**
 * Palette → shader-uniform color resolution.
 *
 * The shader mesh-gradient needs its colors as `vec3` (normalized 0..1 RGB)
 * uniforms, but the threaded `Palette` carries CSS color strings (the contract's
 * `zColor()` swatches). This module converts a `PaletteKey` → `[r,g,b]` in 0..1,
 * staying PALETTE-TOKENED (no hex literals leak into a scene) and PURE (a color
 * string in, a fixed triplet out — no time, no random).
 *
 * Supported swatch forms (what `zColor()` emits / brand-extraction produces):
 *   - `#rgb` / `#rrggbb` hex
 *   - `rgb(r,g,b)` / `rgba(r,g,b,a)` (alpha ignored — uniforms are opaque)
 * Anything else falls back to a mid-grey so a malformed swatch degrades to a
 * neutral field rather than throwing inside a render.
 *
 * Determinism: same string → same triplet, always. No `Math.random`, no clock.
 */
import type { Palette, PaletteKey } from "../../spec";

/** A normalized RGB triplet, each channel in `[0,1]`. The shader `vec3` form. */
export type Rgb = readonly [number, number, number];

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Parse one hex/rgb CSS color into a normalized `[r,g,b]`. Pure. */
export function cssToRgb(input: string): Rgb {
  const s = input.trim();

  // #rgb / #rrggbb
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16) / 255,
        parseInt(h[1] + h[1], 16) / 255,
        parseInt(h[2] + h[2], 16) / 255,
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  // rgb()/rgba()
  const rgb = /^rgba?\(([^)]+)\)$/.exec(s);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [
        clamp01(parts[0] / 255),
        clamp01(parts[1] / 255),
        clamp01(parts[2] / 255),
      ];
    }
  }

  // Unknown form — neutral grey (never throw inside a render).
  return [0.5, 0.5, 0.5];
}

/** Resolve a `PaletteKey` to a normalized RGB triplet. `accent2` falls back to `accent`. */
export function paletteRgb(pal: Palette, key: PaletteKey): Rgb {
  const base =
    key === "accent2" ? pal.accent2 ?? pal.accent : (pal[key] as string);
  return cssToRgb(base);
}

/**
 * A stable per-video seed for the shader, derived PURELY from the palette
 * swatches (the `brandKitId` isn't threaded into the render context — only
 * palette+motion are). Two videos with different brand colors get different
 * noise phase offsets; the SAME video is byte-identical across shards because
 * the palette is constant for the page lifetime.
 *
 * Returns a float in `[0,1000)` suitable as a `uSeed` uniform that offsets the
 * noise domain (`fract(sin(...))`-class hashing inside the shader stays pure).
 */
export function paletteSeed(pal: Palette): number {
  const src = [
    pal.bg,
    pal.surface,
    pal.text,
    pal.textDim,
    pal.accent,
    pal.accent2 ?? "",
  ].join("|");
  // Deterministic 32-bit string hash (djb2-class), mapped to [0,1000).
  let h = 2166136261 >>> 0;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000000) / 1000;
}
