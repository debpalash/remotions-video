/**
 * AUDIT spec — one of EVERY archetype, for centering/caption stills.
 * Not shipped; used by scripts/audit-stills.ts to prove optical centering.
 * Asset keys match the shipped yupcha-v2 (real dropped screenshots).
 */
import { z } from "zod";
import { VideoSpec, type Palette } from "./schema";

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
  brandKitId: "yupcha-audit",
  transitions: { kind: "fade", durationInFrames: 15 },
  scenes: [
    {
      id: "s-hook",
      component: "Hook",
      props: { lines: ["Hiring eats your week.", "Yupcha runs it without you."] },
      vo: { text: "Hiring eats your week. Yupcha runs it without you." },
    },
    {
      id: "s-problem",
      component: "Problem",
      props: {
        stamps: [
          "Hundreds of resumes, no time to read them.",
          "Scheduling interviews for weeks.",
          "Gut-feel screening that misses talent.",
        ],
        resolve: "Let an agent run the whole top of funnel.",
      },
      vo: { text: "Hundreds of resumes, weeks of scheduling. Let an agent run it." },
    },
    {
      id: "s-product",
      component: "ProductShot",
      props: {
        kicker: "The Agentic Hiring Platform",
        headline: "Autonomous interviews for any field.",
        screen: "brand-assets/yupcha/dashboard.webp",
        layout: "single",
        tilt: 6,
        callouts: [
          { title: "Adaptive interviews", sub: "The agent drives the conversation in real time.", icon: "message-circle", anchor: "tr", accent: "accent" },
          { title: "Bulk interviews", sub: "Launch one or a thousand at once.", icon: "layers", anchor: "bl", accent: "accent2" },
        ],
      },
      vo: { text: "Run end-to-end hiring workflows with AI agents." },
    },
    {
      id: "s-feature",
      component: "FeatureBeat",
      props: {
        label: "Ranked shortlist",
        region: "brand-assets/yupcha/ranking.jpeg",
        caption: "Every candidate scored and ranked against the role.",
      },
      vo: { text: "Every candidate is scored and ranked against the role." },
    },
    {
      id: "s-stats",
      component: "Stats",
      props: {
        items: [
          { to: 90, suffix: "%", decimals: 0, label: "less time screening", verified: false },
          { to: 24, suffix: "/7", decimals: 0, label: "interviews running", verified: true },
        ],
      },
      vo: { text: "Screen ninety percent faster." },
    },
    {
      id: "s-proof",
      component: "Proof",
      props: {
        quote: "We cut time-to-hire in half within the first month.",
        attribution: "Head of Talent, Series B SaaS",
      },
      vo: { text: "We cut time to hire in half." },
    },
    {
      id: "s-cta",
      component: "CTA",
      props: { headline: "The future of AI hiring is agentic.", url: "yupcha.com" },
      vo: { text: "Start free at yupcha dot com." },
    },
  ],
};

export const SAMPLE_SPEC: VideoSpec = VideoSpec.parse(RAW);
export const spec = SAMPLE_SPEC;
export default SAMPLE_SPEC;
