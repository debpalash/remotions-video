/**
 * SAMPLE_SPEC — a hand-written, valid `VideoSpec` that proves the loop (P0).
 *
 * This is the `defaultProps` for the single dynamic `<Composition>`: rendering
 * it end-to-end is the P0 exit gate ("a hand-written spec renders a real MP4").
 * Copy is verbatim Yupcha brand language (`docs/BRAND_RESEARCH.md`); the look is
 * the `dark-cinematic` preset bound to Yupcha (dark theme).
 *
 * Authored as the Zod INPUT shape, then parsed at module load so the export is
 * the resolved OUTPUT type (defaults applied) AND is guaranteed to parse — if
 * this object ever drifts out of spec, importing the module throws immediately.
 */
import { z } from "zod";
import { VideoSpec, type Palette } from "./schema";

/** Yupcha dark palette — teal accent @ low intensity per `dark-cinematic`. */
const YUPCHA_DARK: Palette = {
  bg: "#07090d",
  surface: "#11151c",
  text: "#f2f5f8",
  textDim: "#8a94a3",
  accent: "#3fe0c5",
  accent2: "#ff8a5b",
  gradientText: ["#3fe0c5", "#7aa2ff"],
};

const RAW: z.input<typeof VideoSpec> = {
  version: 1,
  format: "16:9",
  preset: "dark-cinematic",
  motion: "calm",
  palette: YUPCHA_DARK,
  brandKitId: "yupcha",
  transitions: { kind: "fade", durationInFrames: 15 },
  scenes: [
    {
      id: "s1-hook",
      component: "Hook",
      props: {
        // Open on the pain, never a logo (pain-led 3s hook).
        lines: ["Hiring eats your week.", "Yupcha runs it without you."],
      },
      vo: {
        text: "Hiring eats your week. Yupcha runs it without you.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s2-product",
      component: "ProductShot",
      props: {
        kicker: "The Agentic Hiring Platform",
        headline: "Autonomous interviews for any field.",
        screen: "yupcha/agent-home",
        layout: "single",
        tilt: 6,
        callouts: [
          {
            title: "Adaptive interviews",
            sub: "AI takes over the conversation in real-time.",
            icon: "message-circle",
            anchor: "tr",
            accent: "accent",
          },
          {
            title: "Bulk interviews",
            sub: "Create interviews in single or bulk.",
            icon: "layers",
            anchor: "bl",
            accent: "accent2",
          },
        ],
      },
      vo: {
        text:
          "Run end-to-end hiring workflows with AI agents — conduct interviews, " +
          "automate candidate screening, and accelerate recruitment.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s3-stats",
      component: "Stats",
      props: {
        items: [
          {
            to: 90,
            suffix: "%",
            decimals: 0,
            label: "less time screening",
            verified: false,
          },
          {
            to: 24,
            suffix: "/7",
            decimals: 0,
            label: "interviews running",
            verified: true,
          },
        ],
      },
      vo: {
        text: "Screen ninety percent faster, with interviews running around the clock.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s4-cta",
      component: "CTA",
      props: {
        headline: "The future of AI hiring is agentic.",
        url: "yupcha.com",
      },
      vo: {
        text: "The future of AI hiring is agentic. Start free at yupcha dot com.",
        profile: "feat_20_the_luxe",
      },
    },
  ],
};

/**
 * The validated sample. Parsing here means a bad sample fails loudly at import
 * time rather than silently at render time.
 */
export const SAMPLE_SPEC: VideoSpec = VideoSpec.parse(RAW);
