import { getSession } from "@/lib/auth";
import {
  cleanText,
  deleteAskAnswer,
  listAskAnswers,
  saveAskAnswer,
} from "@/lib/saved-ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({ answers: await listAskAnswers(session.user.id) });
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return Response.json({ error: "Invalid body" }, { status: 400 });

  const question = cleanText(body.question, 8000);
  const answer = cleanText(body.answer, 100000);
  if (!question || !answer)
    return Response.json(
      { error: "Question and answer are required" },
      { status: 400 },
    );

  const cite = cleanText(body.cite, 300) || undefined;
  const kind = cleanText(body.kind, 40) || undefined;
  const rawHref = cleanText(body.sourceHref, 800);
  const sourceHref = rawHref.startsWith("/") ? rawHref : undefined;
  const tools = Array.isArray(body.tools)
    ? body.tools.filter((t): t is string => typeof t === "string")
    : undefined;

  // Ownership is always the session user — never a client-supplied id.
  return Response.json(
    {
      saved: await saveAskAnswer({
        userId: session.user.id,
        question,
        answer,
        cite,
        kind,
        sourceHref,
        tools,
      }),
    },
    { status: 201 },
  );
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  await deleteAskAnswer({ userId: session.user.id, id });
  return Response.json({ ok: true });
}
