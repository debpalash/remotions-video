/**
 * web/lib/brand.ts — map a brand kit's extracted palette onto the UI's accent
 * CSS variables (SAAS_ROADMAP: "Use the brand palette for the UI accents").
 *
 * Pure + client-safe. Until a brand kit is ingested, a neutral dark studio
 * theme is used; once `planOutline` returns a kit, its palette tints the chrome.
 */
import type { BrandKit } from "./types";

export interface UiTheme {
  bg: string;
  surface: string;
  text: string;
  textDim: string;
  accent: string;
  accent2: string;
}

/** The default studio theme (dark) before any brand is ingested. */
export const DEFAULT_THEME: UiTheme = {
  bg: "#0a0c10",
  surface: "#141821",
  text: "#eef2f6",
  textDim: "#8a94a3",
  accent: "#5b8cff",
  accent2: "#3fe0c5",
};

/** Derive the UI theme from a brand kit palette (falls back per-field). */
export function themeFromBrandKit(kit?: BrandKit | null): UiTheme {
  const p = kit?.palette;
  if (!p) return DEFAULT_THEME;
  return {
    bg: p.bg || DEFAULT_THEME.bg,
    surface: p.surface || DEFAULT_THEME.surface,
    text: p.text || DEFAULT_THEME.text,
    textDim: p.textDim || DEFAULT_THEME.textDim,
    accent: p.accent || DEFAULT_THEME.accent,
    accent2: p.accent2 || p.accent || DEFAULT_THEME.accent2,
  };
}

/** Theme → inline CSS custom properties for a wrapper element. */
export function themeVars(theme: UiTheme): Record<string, string> {
  return {
    "--bg": theme.bg,
    "--surface": theme.surface,
    "--text": theme.text,
    "--text-dim": theme.textDim,
    "--accent": theme.accent,
    "--accent-2": theme.accent2,
  };
}
