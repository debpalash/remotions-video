import { Composition } from "remotion";
import { YupchaPromo, PROMO_DURATION } from "./promo/YupchaPromo";
import {
  ResubirdPromo,
  RESUBIRD_DURATION,
} from "./promo/resubird/ResubirdPromo";
import { ResubirdShort, SHORT_DURATION } from "./promo/resubird/ShortAts";
import {
  InterviewerDeepDive,
  DEEPDIVE_DURATION,
} from "./promo/InterviewerDeepDive";
import { Manifesto, MANIFESTO_DURATION } from "./promo/Manifesto";
import { VoiceTeaser, VOICE_TEASER_DURATION } from "./promo/VoiceTeaser";
import {
  GlowUp,
  GlowUpPM,
  GlowUpData,
  GlowUpDesign,
  GLOWUP_DURATION,
} from "./promo/resubird/GlowUp";
import { ResumeRace, RACE_DURATION } from "./promo/resubird/ResumeRace";
import { Ghosted, GHOST_DURATION } from "./promo/resubird/Ghosted";
import { ProveReal, PROVEREAL_DURATION } from "./promo/ProveReal";
import { YupchaScreens, SCREENS_DURATION } from "./promo/YupchaScreens";
import { Interval, INTERVAL_DURATION } from "./promo/Interval";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="YupchaPromo"
        component={YupchaPromo}
        fps={30}
        durationInFrames={PROMO_DURATION}
        width={1920}
        height={1080}
      />
      <Composition
        id="ResubirdPromo"
        component={ResubirdPromo}
        fps={30}
        durationInFrames={RESUBIRD_DURATION}
        width={1920}
        height={1080}
      />
      <Composition
        id="ResubirdShort"
        component={ResubirdShort}
        fps={30}
        durationInFrames={SHORT_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="InterviewerDeepDive"
        component={InterviewerDeepDive}
        fps={30}
        durationInFrames={DEEPDIVE_DURATION}
        width={1920}
        height={1080}
      />
      <Composition
        id="YupchaManifesto"
        component={Manifesto}
        fps={30}
        durationInFrames={MANIFESTO_DURATION}
        width={1920}
        height={1080}
      />
      <Composition
        id="YupchaVoiceTeaser"
        component={VoiceTeaser}
        fps={30}
        durationInFrames={VOICE_TEASER_DURATION}
        width={1920}
        height={1080}
      />
      <Composition
        id="ResubirdGlowUp"
        component={GlowUp}
        fps={30}
        durationInFrames={GLOWUP_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="ResubirdGlowUpPM"
        component={GlowUpPM}
        fps={30}
        durationInFrames={GLOWUP_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="ResubirdGlowUpData"
        component={GlowUpData}
        fps={30}
        durationInFrames={GLOWUP_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="ResubirdGlowUpDesign"
        component={GlowUpDesign}
        fps={30}
        durationInFrames={GLOWUP_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="ResubirdResumeRace"
        component={ResumeRace}
        fps={30}
        durationInFrames={RACE_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="ResubirdGhosted"
        component={Ghosted}
        fps={30}
        durationInFrames={GHOST_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="ProveYoureReal"
        component={ProveReal}
        fps={30}
        durationInFrames={PROVEREAL_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="YupchaScreensAll"
        component={YupchaScreens}
        fps={30}
        durationInFrames={SCREENS_DURATION}
        width={1080}
        height={1920}
      />
      <Composition
        id="Interval"
        component={Interval}
        fps={30}
        durationInFrames={INTERVAL_DURATION}
        width={1920}
        height={1080}
      />
    </>
  );
};
