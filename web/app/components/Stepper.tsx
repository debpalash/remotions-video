"use client";

import type { Stage } from "../state";

const STEPS: { key: Stage; label: string }[] = [
  { key: "input", label: "1 · Input" },
  { key: "outline", label: "2 · Outline" },
  { key: "storyboard", label: "3 · Storyboard" },
  { key: "result", label: "4 · Render" },
];

const ORDER: Stage[] = ["input", "outline", "storyboard", "result"];

export function Stepper({ stage }: { stage: Stage }) {
  const current = ORDER.indexOf(stage);
  return (
    <div className="steps" role="list">
      {STEPS.map((s, i) => {
        const cls =
          i === current ? "step active" : i < current ? "step done" : "step";
        return (
          <span key={s.key} className={cls} role="listitem">
            {s.label}
          </span>
        );
      })}
    </div>
  );
}
