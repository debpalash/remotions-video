/** Client-side gate state for the four-screen flow (SAAS_ROADMAP §3). */
import type { VideoSpec, BrandKit, DirectorGoal } from "../lib/types";

export type Stage = "input" | "outline" | "storyboard" | "result";

export interface FlowState {
  stage: Stage;
  url: string;
  goal: DirectorGoal;
  spec: VideoSpec | null;
  brandKit: BrandKit | null;
  stills: string[];
  videoUrl: string | null;
  busy: boolean;
  busyMsg: string;
  error: string | null;
  errorDetail: string | null;
}

export const INITIAL: FlowState = {
  stage: "input",
  url: "",
  goal: {},
  spec: null,
  brandKit: null,
  stills: [],
  videoUrl: null,
  busy: false,
  busyMsg: "",
  error: null,
  errorDetail: null,
};
