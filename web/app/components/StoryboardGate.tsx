"use client";

import type { VideoSpec } from "../../lib/types";
import { toSceneCards } from "../../lib/spec-view";

export function StoryboardGate({
  spec,
  stills,
  busy,
  onApprove,
  onBack,
}: {
  spec: VideoSpec;
  stills: string[];
  busy: boolean;
  onApprove: () => void;
  onBack: () => void;
}) {
  const cards = toSceneCards(spec);

  return (
    <div>
      <p className="kicker">Gate 3 · Approve the look</p>
      <h1>Storyboard</h1>
      <p className="sub">
        One real keyframe per scene, rendered through the actual compositions —
        seconds, not the minutes a full render costs.{" "}
        <strong>What you approve is what renders.</strong>
      </p>

      <div className="grid">
        {stills.map((src, i) => (
          <div className="still" key={src}>
            <img src={src} alt={`Scene ${i + 1} — ${cards[i]?.component ?? ""}`} />
            <div className="cap">
              <span>
                {i + 1}. {cards[i]?.component ?? "scene"}
              </span>
              <span>{cards[i] ? `${cards[i].estSeconds.toFixed(1)}s` : ""}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="ghost" onClick={onBack} disabled={busy}>
          ← Back to outline
        </button>
        <button className="primary" onClick={onApprove} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" />
              Rendering video…
            </>
          ) : (
            "Approve → render"
          )}
        </button>
      </div>
    </div>
  );
}
