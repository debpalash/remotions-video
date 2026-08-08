/**
 * web/lib/types.ts — wire types shared by server routes and client components.
 *
 * TYPE-ONLY imports from the contract (`src/spec`) and ingest (`src/ingest`) and
 * director (`src/llm`). `import type` erases at build time, so pulling these into
 * a client bundle costs nothing and leaks no server code. These mirror the
 * documented `src/pipeline/generate.ts` I/O exactly (SAAS_ROADMAP §3/§5).
 */
import type { VideoSpec, SceneSpec, Format } from "../../src/spec";
import type { BrandKit } from "../../src/ingest";
import type { DirectorGoal } from "../../src/llm";

export type { VideoSpec, SceneSpec, Format, BrandKit, DirectorGoal };

/** Input to `planOutline` / `generateVideo` (the documented shape). */
export interface GenerateInput {
  url?: string;
  assets?: string[];
  goal?: DirectorGoal;
  /** A pre-built brand kit (lets a caller skip ingest). */
  brandKit?: BrandKit;
}

/** JSON returned by `POST /api/outline`. */
export interface OutlineResponse {
  spec: VideoSpec;
  brandKit: BrandKit;
}

/** JSON returned by `POST /api/storyboard` — one web-served still URL per scene. */
export interface StoryboardResponse {
  /** Browser-fetchable URLs (served by `/api/asset`), one per scene in order. */
  stills: string[];
}

/** JSON returned by `POST /api/render`. */
export interface RenderResponse {
  spec: VideoSpec;
  /** Browser-fetchable mp4 URL (served by `/api/asset`). */
  videoUrl: string;
  /** Browser-fetchable still URLs, one per scene. */
  stills: string[];
  brandKit: BrandKit;
}

/** A normalized error envelope every route returns on failure. */
export interface ErrorResponse {
  error: string;
  /** Optional longer detail (validation/lint diagnostics). */
  detail?: string;
}

/* --------------------------------------------------------------------------
 * Scene-card view-model (derived purely from the spec on the client — no extra
 * server round-trip). Powers the Outline gate cards.
 * ------------------------------------------------------------------------ */

export interface SceneCardVM {
  index: number;
  id: string;
  component: SceneSpec["component"];
  /** The primary on-screen copy line for this scene. */
  copy: string;
  /** Spoken VO text, if any. */
  vo?: string;
  /** Estimated frames (minFrames floor or VO-derived estimate). */
  estFrames: number;
  /** Estimated seconds for this scene. */
  estSeconds: number;
  /** Stats with `verified:false` get the ⚠ unverified affordance. */
  unverifiedStat: boolean;
  /** The single signature-motion scene gets a ★ (ProductShot reveal / CTA). */
  signature: boolean;
}
