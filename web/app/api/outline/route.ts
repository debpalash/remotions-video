/**
 * POST /api/outline  — Gate 2 (Outline): plan the STORY, no render.
 *
 * Body: { url?, assets?, goal?, brandKit? }  (the documented planOutline input)
 * Returns: { spec, brandKit }
 *
 * Runs server-side so any LLM key stays on the server. Keyless-safe: with no key
 * the pipeline uses the heuristic director; the response is identical in shape.
 */
import { planOutline } from "../../../lib/pipeline.server";
import type { GenerateInput, OutlineResponse } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  let body: GenerateInput;
  try {
    body = (await req.json()) as GenerateInput;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.url && !body.brandKit && !(body.assets && body.assets.length)) {
    return Response.json(
      { error: "provide a url, assets, or a brandKit" },
      { status: 400 },
    );
  }

  try {
    const { spec, brandKit } = await planOutline({
      url: body.url,
      assets: body.assets,
      goal: body.goal,
      brandKit: body.brandKit,
    });
    const res: OutlineResponse = { spec, brandKit };
    return Response.json(res, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown): Response {
  const e = err as { message?: string; detail?: string; attempts?: string[] };
  const detail =
    e?.detail ?? (Array.isArray(e?.attempts) ? e.attempts.join("\n") : undefined);
  return Response.json(
    { error: e?.message ?? "outline failed", detail },
    { status: 500 },
  );
}
