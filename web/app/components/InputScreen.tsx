"use client";

import { useState } from "react";
import type { DirectorGoal, Format } from "../../lib/types";

const FORMATS: { id: Format; label: string }[] = [
  { id: "16:9", label: "16:9 · landing" },
  { id: "9:16", label: "9:16 · reel" },
  { id: "1:1", label: "1:1 · square" },
];

const PLATFORMS = ["Product Hunt", "LinkedIn", "TikTok", "YouTube", "X"];

export function InputScreen({
  url,
  goal,
  busy,
  onSubmit,
}: {
  url: string;
  goal: DirectorGoal;
  busy: boolean;
  onSubmit: (url: string, goal: DirectorGoal) => void;
}) {
  const [value, setValue] = useState(url);
  const [format, setFormat] = useState<Format>(goal.format ?? "16:9");
  const [platform, setPlatform] = useState<string | undefined>(goal.platform);
  const [angle, setAngle] = useState(goal.angle ?? "");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed, {
      format,
      platform,
      angle: angle.trim() || undefined,
    });
  };

  return (
    <div>
      <p className="kicker">Paste a URL</p>
      <h1>The launch film your product deserves.</h1>
      <p className="sub">
        Your actual product, rendered deterministically — no agency invoice, no AI
        slop. One box: paste a URL and approve two cheap gates before anything
        renders.
      </p>

      <div className="panel">
        <div className="inputrow">
          <input
            type="url"
            placeholder="https://yourproduct.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            aria-label="Product URL"
            autoFocus
          />
          <button className="primary" onClick={submit} disabled={busy || !value.trim()}>
            {busy ? "Planning…" : "Plan outline"}
          </button>
        </div>

        <div className="chiprow">
          <div className="chiplabel">Format (optional)</div>
          <div className="chips">
            {FORMATS.map((f) => (
              <span
                key={f.id}
                className={`chip ${format === f.id ? "on" : ""}`}
                onClick={() => setFormat(f.id)}
                role="button"
                tabIndex={0}
              >
                {f.label}
              </span>
            ))}
          </div>
        </div>

        <div className="chiprow">
          <div className="chiplabel">Platform (optional)</div>
          <div className="chips">
            {PLATFORMS.map((p) => (
              <span
                key={p}
                className={`chip ${platform === p ? "on" : ""}`}
                onClick={() => setPlatform(platform === p ? undefined : p)}
                role="button"
                tabIndex={0}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <div className="chiprow">
          <div className="chiplabel">Angle (optional)</div>
          <input
            type="text"
            placeholder='e.g. "lead with the ghosting pain"'
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            aria-label="Narrative angle"
          />
        </div>
      </div>

      <p className="note">
        Runs keyless: with no LLM key the heuristic director writes the outline; with
        no voice backend the render is silent. Either way you get a real mp4.
      </p>
    </div>
  );
}
