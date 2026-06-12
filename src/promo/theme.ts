// Yupcha brand palette — pulled from logo.svg on yupcha.com
export const COLORS = {
  bg: "#040816",
  bgLight: "#0a1228",
  blue: "#4286f5",
  green: "#0f9d58",
  yellow: "#f4b400",
  red: "#db4437",
  white: "#ffffff",
  dim: "rgba(255,255,255,0.55)",
  faint: "rgba(255,255,255,0.28)",
} as const;

export const GRADIENT_TEXT = {
  backgroundImage: `linear-gradient(100deg, ${COLORS.blue} 0%, #7db4ff 50%, ${COLORS.green} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
} as const;

// Fontsource variable font stacks (imported in YupchaPromo.tsx)
export const FONTS = {
  display: "'Space Grotesk Variable', sans-serif",
  body: "'Inter Variable', sans-serif",
  mono: "'JetBrains Mono Variable', monospace",
} as const;
