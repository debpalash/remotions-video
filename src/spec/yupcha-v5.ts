/**
 * yupcha-v5 — the v5 integration spec.
 *
 * Same curated dark-cinematic story as v2/v4, driving the REAL dropped Yupcha
 * screenshots (`brand-assets/yupcha/*`) — but addressing the three pieces of
 * USER FEEDBACK on v4:
 *
 *   1. CENTERING — fixed in the scene components (Problem board now centers its
 *      block on the frame, ProductShot/FeatureBeat sit on the optical center).
 *      The spec stays the contract; layout is owned by the archetypes.
 *   2. MECHANICAL VOICE — the stale `feat_20_the_luxe` profile is replaced with
 *      the LIVE auditioned default `fa99b1a5` ("The Companion": warm, widest
 *      prosodic range, LRA 20 LU). The pipeline applies the deliberate
 *      `LAUNCH_VOICE_STYLE` (speed 0.94, seed 42) so the read breathes instead
 *      of rattling. (CLAUDE.md's fd085cf0 / feat_20_the_luxe are STALE — the
 *      live `/profiles` is the source of truth; The Companion is loaded now.)
 *   3. AMBIENT MUSIC — the orchestrator mixes the ducked `ncs-sky-high`
 *      INSTRUMENTAL bed under the VO automatically (music on; never the vocal
 *      `ncs-feel-good` track under narration, per CLAUDE.md).
 *
 * yupcha.com is firewalled from the render sandbox (HTTP 000), so this is the
 * saved/fixture brandKit path (SAAS_ROADMAP §3 "degrade to user-uploaded
 * logo/colors when blocked") — but it STILL references the dropped screens by
 * their staged keys (`brand-assets/yupcha/<file>`), which `stageRealAssetKeys`
 * resolves to real `<img>` stills.
 *
 * Authored as the Zod INPUT shape, parsed at load → a bad spec fails loudly.
 */
import { z } from "zod";
import { VideoSpec, type Palette } from "./schema";
import { LAUNCH_VOICE_PROFILE } from "../vo/voice";

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

/** The live, warm launch voice (The Companion). NOT the stale feat_20_the_luxe. */
const VOICE = LAUNCH_VOICE_PROFILE;

const RAW: z.input<typeof VideoSpec> = {
  version: 1,
  format: "16:9",
  preset: "dark-cinematic",
  motion: "calm",
  palette: YUPCHA_DARK,
  brandKitId: "yupcha-v5",
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
        profile: VOICE,
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
        profile: VOICE,
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
        profile: VOICE,
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
        profile: VOICE,
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
        profile: VOICE,
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
        profile: VOICE,
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
        profile: VOICE,
      },
    },
  ],
};

/** The validated v5 spec — also the default export for the render CLI. */
export const YUPCHA_V5_SPEC: VideoSpec = VideoSpec.parse(RAW);
export const spec = YUPCHA_V5_SPEC;
export default YUPCHA_V5_SPEC;
