/**
 * POST /api/report — server-side proxy to the pipeline's stateless report
 * generator (app/report.py). The request body IS the questionnaire answer;
 * nothing is stored server-side on either side of this proxy — see
 * PROJECT_LOG Session 18/19 for why this is deliberate, not a stopgap.
 */
import { regTrackerApiUrl } from "@/lib/reg-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ReportRequestBody {
  jurisdictions?: unknown;
  categories?: unknown;
  institution_type?: unknown;
  goals?: unknown;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

export async function POST(req: Request): Promise<Response> {
  const base = regTrackerApiUrl();
  if (!base) {
    return Response.json(
      { error: "Regulation backend is not configured." },
      { status: 503 },
    );
  }

  let body: ReportRequestBody;
  try {
    body = (await req.json()) as ReportRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = {
    jurisdictions: asStringArray(body.jurisdictions),
    categories: asStringArray(body.categories),
    institution_type:
      typeof body.institution_type === "string"
        ? body.institution_type.slice(0, 200)
        : "",
    goals: typeof body.goals === "string" ? body.goals.slice(0, 1000) : "",
  };

  try {
    const res = await fetch(new URL("/v1/report", base), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // Local Ollama can take several minutes for a single long completion;
      // the deployed (OpenAI) path is fast. Generous ceiling either way.
      signal: AbortSignal.timeout(280_000),
    });
    if (!res.ok) {
      return Response.json(
        { error: `Backend error (HTTP ${res.status}).` },
        { status: 502 },
      );
    }
    return Response.json(await res.json());
  } catch {
    return Response.json(
      { error: "Report generation timed out or the backend is unreachable." },
      { status: 502 },
    );
  }
}
