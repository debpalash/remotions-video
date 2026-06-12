import React from "react";
import {
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";

// Voiceover cue points (frames @ 30fps), aligned to scene beats
const VO_CUES: { src: string; from: number }[] = [
  { src: "audio/rvo1.wav", from: 14 }, // Hook: "Recruiters spend seven seconds..." (3.70s)
  { src: "audio/rvo2.wav", from: 170 }, // Punch: "ResuBird shows you why." (1.75s)
  { src: "audio/rvo3.wav", from: 234 }, // Logo: "ResuBird. The free AI resume analyzer." (2.36s)
  { src: "audio/rvo4.wav", from: 318 }, // Analyzer (4.30s)
  { src: "audio/rvo5.wav", from: 500 }, // Builder (4.35s)
  { src: "audio/rvo6.wav", from: 658 }, // Jobs (3.87s)
  { src: "audio/rvo7.wav", from: 816 }, // Suite (3.54s)
  { src: "audio/rvo8.wav", from: 940 }, // CTA (~3.9s)
];

const MUSIC_BASE = 0.1;

export const RSoundtrack: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      <Audio
        src={staticFile("audio/ncs-sky-high.mp3")}
        trimBefore={Math.round(52.5 * 30)}
        volume={(f) =>
          interpolate(
            f,
            [0, 25, durationInFrames - 70, durationInFrames - 10],
            [0, MUSIC_BASE, MUSIC_BASE, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      {VO_CUES.map((cue) => (
        <Sequence key={cue.src} from={cue.from}>
          <Audio src={staticFile(cue.src)} volume={1} />
        </Sequence>
      ))}
    </>
  );
};
