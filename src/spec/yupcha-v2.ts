/**
 * yupcha-v2 — the integration spec: the full Kino archetype set on the
 * `dark-cinematic` preset, driving the REAL dropped Yupcha screenshots
 * (`brand-assets/yupcha/*`) through the staged-asset keys.
 *
 * Site is firewalled from the render sandbox, so this is the saved/fixture
 * brandKit path (SAAS_ROADMAP §3 "degrade to user-uploaded logo/colors when
 * blocked") — but it STILL references the dropped screens by their staged keys
 * (`brand-assets/yupcha/<file>`), exactly what `applyRealAssetOverride` +
 * `stageRealAssetKeys` resolve to a real `<img>` still.
 *
 * Authored as the Zod INPUT shape, parsed at load → a bad spec fails loudly.
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
  brandKitId: "yupcha-v2",
  transitions: { kind: "fade", durationInFrames: 15 },
  scenes: [
    {
      id: "s1-hook",
      component: "Hook",
      props: {
        lines: ["Hiring eats your week.", "Yupcha runs it without you."],
      },
      vo: {
        text: "Hiring eats your week. Yupcha runs it without you.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s2-problem",
      component: "Problem",
      props: {
        stamps: [
          "Hundreds of resumes, no time to read them.",
          "Scheduling interviews for weeks.",
          "Gut-feel screening that misses talent.",
        ],
        resolve: "Let an agent run the whole top of funnel.",
      },
      vo: {
        text:
          "Hundreds of resumes, weeks of scheduling, gut-feel screening. " +
          "Let an agent run the whole top of the funnel.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s3-product",
      component: "ProductShot",
      props: {
        kicker: "The Agentic Hiring Platform",
        headline: "Autonomous interviews for any field.",
        // REAL dropped screen — staged key resolves to brand-assets/yupcha/dashboard.webp
        screen: "brand-assets/yupcha/dashboard.webp",
        layout: "single",
        tilt: 6,
        callouts: [
          {
            title: "Adaptive interviews",
            sub: "The agent drives the conversation in real time.",
            icon: "message-circle",
            anchor: "tr",
            accent: "accent",
          },
          {
            title: "Bulk interviews",
            sub: "Launch one or a thousand at once.",
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
      id: "s4-feature-interview",
      component: "FeatureBeat",
      props: {
        label: "Live interviews",
        region: "brand-assets/yupcha/interview.webp",
        caption: "The agent asks, listens, and adapts — no recruiter on the call.",
      },
      vo: {
        text: "The agent conducts the interview live — asking, listening, and adapting.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s5-feature-ranking",
      component: "FeatureBeat",
      props: {
        label: "Ranked shortlist",
        region: "brand-assets/yupcha/ranking.jpeg",
        caption: "Every candidate scored and ranked against the role.",
      },
      vo: {
        text: "Every candidate is scored and ranked against the role automatically.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s6-stats",
      component: "Stats",
      props: {
        items: [
          { to: 90, suffix: "%", decimals: 0, label: "less time screening", verified: false },
          { to: 24, suffix: "/7", decimals: 0, label: "interviews running", verified: true },
        ],
      },
      vo: {
        text: "Screen ninety percent faster, with interviews running around the clock.",
        profile: "feat_20_the_luxe",
      },
    },
    {
      id: "s7-cta",
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

/** The validated v2 spec — also the default export for the render CLI. */
export const YUPCHA_V2_SPEC: VideoSpec = VideoSpec.parse(RAW);
export const spec = YUPCHA_V2_SPEC;
export default YUPCHA_V2_SPEC;
