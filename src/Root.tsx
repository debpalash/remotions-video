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
    </>
  );
};
