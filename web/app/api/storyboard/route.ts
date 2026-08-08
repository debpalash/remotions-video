/**
 * POST /api/storyboard  — Gate 3 (Storyboard): approve the LOOK.
 *
 * Body: { spec }  (the outline-approved VideoSpec)
 * Returns: { stills }  (browser URLs, one real keyframe per scene)
 *
 * Calls `renderStoryboard(spec, { outDir })` — the cheap, seconds-not-minutes
 * stills gate (CLAUDE.md: stills are the trusted surface; OffthreadVideo is
 * unreliable). Stills are written straight into `out/web/<hash>/` and served via
 * `/api/asset`. "What they approve is what renders."
 */
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { renderStoryboard } from "../../../lib/pipeline.server";
import { WEB_STILLS_DIR, assetUrl } from "../../../lib/assets.server";
import type { VideoSpec, StoryboardResponse } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  let body: { spec?: VideoSpec };
  try {
    body = (await req.json()) as { spec?: VideoSpec };
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.spec) {
    return Response.json({ error: "missing spec" }, { status: 400 });
  }
  const spec = body.spec;

  try {
    const hash = createHash("sha1")
      .update(JSON.stringify(spec))
      .digest("hex")
      .slice(0, 12);
    const dir = join(WEB_STILLS_DIR, hash);
    await mkdir(dir, { recursive: true });

    // Stills land directly under out/web/<hash>/ so the asset route can serve them.
    const { stills } = await renderStoryboard(spec, { outDir: dir });

    const urls = stills
      .map((p) => assetUrl(p))
      .filter((u): u is string => u !== null);

    const res: StoryboardResponse = { stills: urls };
    return Response.json(res, { status: 200 });
  } catch (err) {
    const e = err as { message?: string; detail?: string };
    return Response.json(
      { error: e?.message ?? "storyboard failed", detail: e?.detail },
      { status: 500 },
    );
  }
}
