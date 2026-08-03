/**
 * GET /api/recommendations — server-side proxy to the pipeline's content-
 * based recommender (app/recommend.py). Ranks documents by category
 * overlap + jurisdiction match + impact + recency against a profile the
 * caller supplies explicitly — no server-side profile storage, no user
 * tracking. The profile itself lives in the browser (localStorage), not
 * an account or database; see components/useProfile.ts.
 *
 * Query params: jurisdictions, categories — comma-separated. limit 1-50.
 */
import { regTrackerApiUrl } from "@/lib/reg-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const base = regTrackerApiUrl();
  if (!base) {
    return Response.json(
      { error: "Regulation backend is not configured." },
      { status: 503 },
    );
  }

  const params = new URL(req.url).searchParams;
  const jurisdictions = (params.get("jurisdictions") ?? "").trim();
  const categories = (params.get("categories") ?? "").trim();
  const limitRaw = Number.parseInt(params.get("limit") ?? "10", 10);
  const limit = Number.isNaN(limitRaw)
    ? 10
    : Math.min(Math.max(limitRaw, 1), 50);

  const url = new URL("/v1/recommendations", base);
  if (jurisdictions) url.searchParams.set("jurisdictions", jurisdictions);
  if (categories) url.searchParams.set("categories", categories);
  url.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      return Response.json(
        { error: `Backend error (HTTP ${res.status}).` },
        { status: 502 },
      );
    }
    return Response.json(await res.json());
  } catch {
    return Response.json(
      { error: "Regulation backend unreachable." },
      { status: 502 },
    );
  }
}
