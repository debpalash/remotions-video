/**
 * POST /api/render  — Gate 4 (Render): the foregone conclusion.
 *
 * Two modes:
 *  - { spec, brandKit? }  → render the GATE-APPROVED spec verbatim (preferred —
 *    "what they approve is what renders"). Reuses `renderApprovedSpec`.
 *  - { url|assets|goal }   → full `generateVideo(input)` (plan→VO→render) for a
 *    one-shot path with no prior gates.
 *
 * Returns: { spec, videoUrl, stills, brandKit }. Keyless + VO-less still yields a
 * real (silent) mp4. The mp4 + stills are served via `/api/asset`.
 */
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { generateVideo, renderStoryboard } from "../../../lib/pipeline.server";
import { renderApprovedSpec } from "../../../lib/render.server";
import { WEB_STILLS_DIR, assetUrl } from "../../../lib/assets.server";
import type {
  VideoSpec,
  BrandKit,
  GenerateInput,
  RenderResponse,
} from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(req: Request): Promise<Response> {
  let body: GenerateInput & { spec?: VideoSpec; brandKit?: BrandKit };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    // --- Mode A: render the approved spec verbatim. ----------------------
    if (body.spec) {
      const spec = body.spec;
      const { outPath } = await renderApprovedSpec(spec);
      const videoUrl = assetUrl(outPath);
      if (!videoUrl) throw new Error("rendered mp4 escaped the out/ tree");

      // Stills for the result view (cheap; reuses the stills gate path).
      const stills = await serveStills(spec);

      const res: RenderResponse = {
        spec,
        videoUrl,
        stills,
        brandKit: body.brandKit as BrandKit,
      };
      return Response.json(res, { status: 200 });
    }

    // --- Mode B: one-shot generate from input. ---------------------------
    if (!body.url && !(body.assets && body.assets.length)) {
      return Response.json(
        { error: "provide an approved spec, or a url/assets to generate from" },
        { status: 400 },
      );
    }
    const result = await generateVideo({
      url: body.url,
      assets: body.assets,
      goal: body.goal,
      brandKit: body.brandKit,
    });
    const videoUrl = assetUrl(result.outPath);
    if (!videoUrl) throw new Error("rendered mp4 escaped the out/ tree");
    const stills = await serveStills(result.spec);

    const res: RenderResponse = {
      spec: result.spec,
      videoUrl,
      stills,
      brandKit: result.brandKit,
    };
    return Response.json(res, { status: 200 });
  } catch (err) {
    const e = err as { message?: string; detail?: string };
    return Response.json(
      { error: e?.message ?? "render failed", detail: e?.detail },
      { status: 500 },
    );
  }
}

/**
 * Render the per-scene stills straight into `out/web/<hash>/` (so the asset route
 * can serve them) and return their browser URLs. Cheap (N screenshots, no encode)
 * and idempotent per spec hash.
 */
async function serveStills(spec: VideoSpec): Promise<string[]> {
  const hash = createHash("sha1")
    .update(JSON.stringify(spec))
    .digest("hex")
    .slice(0, 12);
  const dir = join(WEB_STILLS_DIR, hash);
  await mkdir(dir, { recursive: true });
  const { stills } = await renderStoryboard(spec, { outDir: dir });
  return stills
    .map((p) => assetUrl(p))
    .filter((u): u is string => u !== null);
}
