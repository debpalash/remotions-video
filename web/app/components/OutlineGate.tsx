"use client";

import type { VideoSpec } from "../../lib/types";
import { toSceneCards, durationSummary } from "../../lib/spec-view";

export function OutlineGate({
  spec,
  busy,
  onApprove,
  onBack,
}: {
  spec: VideoSpec;
  busy: boolean;
  onApprove: () => void;
  onBack: () => void;
}) {
  const cards = toSceneCards(spec);
  const dur = durationSummary(spec);

  return (
    <div>
      <p className="kicker">Gate 2 · Approve the story</p>
      <h1>Outline</h1>
      <p className="sub">
        Approve the <strong>story</strong> before the look — at zero render cost.
        Preset <code>{spec.preset}</code>, motion <code>{spec.motion}</code>,{" "}
        <code>{spec.format}</code>.
      </p>

      <div className="meter">
        <span>
          {cards.length} scenes · pain-led hook{" "}
          {cards[0]?.component === "Hook" ? "✓" : "—"}
        </span>
        <span className={`val ${dur.band === "green" ? "green" : "amber"}`}>
          {dur.label} {dur.band === "green" ? "· in the 60–90s sweet spot" : "· outside 60–90s"}
        </span>
      </div>

      <div className="panel">
        {cards.map((c) => (
          <div className="scenecard" key={c.id}>
            <span className="idx">{c.index + 1}</span>
            <div>
              <span className="comp">{c.component}</span>
              {c.signature && (
                <span className="badge star" title="The one signature motion">
                  ★ signature
                </span>
              )}
              {c.unverifiedStat && (
                <span className="badge warn" title="Unverified stat — renders as an example">
                  ⚠ e.g.
                </span>
              )}
              <p className="copy">{c.copy}</p>
              {c.vo && <p className="vo">VO: {c.vo}</p>}
            </div>
            <span className="dur">{c.estSeconds.toFixed(1)}s</span>
          </div>
        ))}
      </div>

      <p className="note">
        ⚠ marks an unverified stat — it renders with an <strong>“e.g.”</strong>{" "}
        affordance, never as a hard claim. ★ marks the single signature motion.
      </p>

      <div className="actions">
        <button className="ghost" onClick={onBack} disabled={busy}>
          ← Start over
        </button>
        <button className="primary" onClick={onApprove} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" />
              Rendering stills…
            </>
          ) : (
            "Approve → storyboard"
          )}
        </button>
      </div>
    </div>
  );
}
