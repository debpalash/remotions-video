"use client";

import type { VideoSpec } from "../../lib/types";

export function ResultScreen({
  spec,
  videoUrl,
  onRestart,
}: {
  spec: VideoSpec;
  videoUrl: string;
  onRestart: () => void;
}) {
  return (
    <div>
      <p className="kicker">Gate 4 · Render</p>
      <h1>Your video is ready.</h1>
      <p className="sub">
        Rendered deterministically from the approved spec — {spec.scenes.length}{" "}
        scenes, <code>{spec.preset}</code>, <code>{spec.format}</code>.
      </p>

      <video src={videoUrl} controls playsInline preload="metadata" />

      <div className="actions">
        <a href={videoUrl} download="kino-video.mp4">
          <button className="primary">Download mp4</button>
        </a>
        <button className="ghost" onClick={onRestart}>
          Make another
        </button>
      </div>
    </div>
  );
}
