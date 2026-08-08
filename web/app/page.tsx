"use client";

import { useMemo, useReducer } from "react";

import { INITIAL, type FlowState } from "./state";
import type {
  DirectorGoal,
  OutlineResponse,
  StoryboardResponse,
  RenderResponse,
  ErrorResponse,
} from "../lib/types";
import { themeFromBrandKit, themeVars } from "../lib/brand";

import { Stepper } from "./components/Stepper";
import { InputScreen } from "./components/InputScreen";
import { OutlineGate } from "./components/OutlineGate";
import { StoryboardGate } from "./components/StoryboardGate";
import { ResultScreen } from "./components/ResultScreen";

/* --------------------------------------------------------------------------
 * Reducer — a tiny, explicit state machine over the four gates.
 * ------------------------------------------------------------------------ */
type Action =
  | { type: "patch"; patch: Partial<FlowState> }
  | { type: "reset" };

function reducer(state: FlowState, action: Action): FlowState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "reset":
      return { ...INITIAL };
    default:
      return state;
  }
}

/* --------------------------------------------------------------------------
 * Fetch helper — POST JSON, surface a typed error envelope.
 * ------------------------------------------------------------------------ */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & ErrorResponse;
  if (!res.ok) {
    const err = new Error(data?.error || `${path} failed (${res.status})`);
    (err as Error & { detail?: string }).detail = data?.detail;
    throw err;
  }
  return data as T;
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const theme = useMemo(
    () => themeFromBrandKit(state.brandKit),
    [state.brandKit],
  );

  const patch = (p: Partial<FlowState>) => dispatch({ type: "patch", patch: p });

  const fail = (err: unknown) => {
    const e = err as Error & { detail?: string };
    patch({
      busy: false,
      busyMsg: "",
      error: e?.message ?? "Something went wrong",
      errorDetail: e?.detail ?? null,
    });
  };

  /* --- Gate 1 → 2: plan the outline. ----------------------------------- */
  const planOutline = async (url: string, goal: DirectorGoal) => {
    patch({ url, goal, busy: true, busyMsg: "Planning outline…", error: null, errorDetail: null });
    try {
      const out = await postJson<OutlineResponse>("/api/outline", { url, goal });
      patch({
        spec: out.spec,
        brandKit: out.brandKit,
        stage: "outline",
        busy: false,
        busyMsg: "",
      });
    } catch (err) {
      fail(err);
    }
  };

  /* --- Gate 2 → 3: render the storyboard stills. ----------------------- */
  const approveOutline = async () => {
    if (!state.spec) return;
    patch({ busy: true, busyMsg: "Rendering stills…", error: null, errorDetail: null });
    try {
      const sb = await postJson<StoryboardResponse>("/api/storyboard", {
        spec: state.spec,
      });
      patch({ stills: sb.stills, stage: "storyboard", busy: false, busyMsg: "" });
    } catch (err) {
      fail(err);
    }
  };

  /* --- Gate 3 → 4: render the approved spec. --------------------------- */
  const approveStoryboard = async () => {
    if (!state.spec) return;
    patch({ busy: true, busyMsg: "Rendering video…", error: null, errorDetail: null });
    try {
      const r = await postJson<RenderResponse>("/api/render", {
        spec: state.spec,
        brandKit: state.brandKit ?? undefined,
      });
      patch({
        videoUrl: r.videoUrl,
        stills: r.stills.length ? r.stills : state.stills,
        spec: r.spec,
        stage: "result",
        busy: false,
        busyMsg: "",
      });
    } catch (err) {
      fail(err);
    }
  };

  return (
    <main className="wrap" style={themeVars(theme) as React.CSSProperties}>
      <Stepper stage={state.stage} />

      {state.stage === "input" && (
        <InputScreen
          url={state.url}
          goal={state.goal}
          busy={state.busy}
          onSubmit={planOutline}
        />
      )}

      {state.stage === "outline" && state.spec && (
        <OutlineGate
          spec={state.spec}
          busy={state.busy}
          onApprove={approveOutline}
          onBack={() => dispatch({ type: "reset" })}
        />
      )}

      {state.stage === "storyboard" && state.spec && (
        <StoryboardGate
          spec={state.spec}
          stills={state.stills}
          busy={state.busy}
          onApprove={approveStoryboard}
          onBack={() => patch({ stage: "outline" })}
        />
      )}

      {state.stage === "result" && state.spec && state.videoUrl && (
        <ResultScreen
          spec={state.spec}
          videoUrl={state.videoUrl}
          onRestart={() => dispatch({ type: "reset" })}
        />
      )}

      {state.error && (
        <div className="err">
          <strong>{state.error}</strong>
          {state.errorDetail ? `\n\n${state.errorDetail}` : ""}
        </div>
      )}
    </main>
  );
}
