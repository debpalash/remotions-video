import React from "react";
import {
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";

// Voiceover cue points (frames @ 30fps), aligned to scene beats
export const VO_CUES: { src: string; from: number }[] = [
  { src: "audio/vo1.wav", from: 14 }, // Hook: "The average hire takes..." (4.21s)
  { src: "audio/vo2.wav", from: 172 }, // Problem punch: "So we fixed it." (1.35s)
  { src: "audio/vo3.wav", from: 234 }, // Logo: "Meet Yupcha..." (2.51s)
  { src: "audio/vo4.wav", from: 312 }, // Dashboard (5.97s)
  { src: "audio/vo5.wav", from: 500 }, // Live analysis (4.95s)
  { src: "audio/vo6.wav", from: 672 }, // Resubird (3.68s)
  { src: "audio/vo7.wav", from: 800 }, // Stats (1.92s)
  { src: "audio/vo8.wav", from: 1032 }, // CTA (3.4s)
];

const MUSIC_BASE = 0.1;

export const Soundtrack: React.FC = () => {
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
