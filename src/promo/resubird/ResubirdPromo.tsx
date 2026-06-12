import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { FONTS } from "../theme";
import { RSoundtrack } from "./Soundtrack";
import {
  RAnalyzer,
  RBuilder,
  RCTA,
  RHook,
  RJobs,
  RLogoReveal,
  RProblem,
  RSuite,
} from "./scenes";

const T = 12;

export const R_SCENES = [110, 100, 130, 200, 170, 170, 130, 170];
export const RESUBIRD_DURATION =
  R_SCENES.reduce((a, b) => a + b, 0) - T * (R_SCENES.length - 1);

const timing = linearTiming({ durationInFrames: T });

export const ResubirdPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <RSoundtrack />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={R_SCENES[0]}>
          <RHook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[1]}>
          <RProblem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[2]}>
          <RLogoReveal />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[3]}>
          <RAnalyzer />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[4]}>
          <RBuilder />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[5]}>
          <RJobs />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[6]}>
          <RSuite />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={R_SCENES[7]}>
          <RCTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
