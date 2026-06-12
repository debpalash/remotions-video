// ResuBird brand palette — pulled from resubird.com
export const RB = {
  bg: "#FDF4E7",
  bgDeep: "#F5EBE1",
  card: "#FFFFFF",
  ink: "#1C1917",
  dim: "#78716C",
  faint: "#A8A29E",
  orange: "#F97316",
  orangeSoft: "#FBAD7B",
  amber: "#DE9D5A",
  green: "#3b8a3b",
  blue: "#2a68c9",
  red: "#dc2626",
} as const;

export const RB_GRADIENT_TEXT = {
  backgroundImage: `linear-gradient(100deg, ${RB.orange} 0%, #fb923c 55%, ${RB.amber} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
} as const;
