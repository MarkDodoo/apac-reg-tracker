import { getSession } from "@/lib/auth";
import {
  createSavedQuote,
  listSavedQuotes,
  normalizeQuote,
} from "@/lib/saved-quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({ quotes: await listSavedQuotes(session.user.id) });
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const quote = normalizeQuote(await req.json().catch(() => null));
  if (!quote) return Response.json({ error: "Invalid quote" }, { status: 400 });
  return Response.json(
    { quote: await createSavedQuote(session.user.id, quote) },
    { status: 201 },
  );
}
