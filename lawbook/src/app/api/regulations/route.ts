/**
 * GET /api/regulations — server-side proxy to the pipeline FastAPI backend.
 *
 * Query params:
 *   q       search text; empty -> newest documents (list mode)
 *   mode    "keyword" (default) | "semantic"
 *   source  optional regulator filter (MAS | HKMA | ASIC), list mode only
 *   limit   1-50 (default 20)
 *
 * Proxying keeps the backend URL server-side and avoids CORS. The corpus is
 * public regulatory data, so no auth is required here.
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
  const q = (params.get("q") ?? "").trim();
  const mode = params.get("mode") === "semantic" ? "semantic" : "keyword";
  const source = (params.get("source") ?? "").trim();
  const limitRaw = Number.parseInt(params.get("limit") ?? "20", 10);
  const limit = Number.isNaN(limitRaw)
    ? 20
    : Math.min(Math.max(limitRaw, 1), 50);

  let url: URL;
  if (!q) {
    url = new URL("/v1/regulations", base);
    if (source) url.searchParams.set("source", source);
  } else if (mode === "semantic") {
    url = new URL("/v1/regulations/semantic-search", base);
    url.searchParams.set("q", q);
  } else {
    url = new URL("/v1/regulations/search", base);
    url.searchParams.set("q", q);
  }
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
