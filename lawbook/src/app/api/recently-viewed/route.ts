import { getSession } from "@/lib/auth";
import {
  cleanRecentText,
  clearRecentlyViewedDocuments,
  deleteRecentlyViewedDocument,
  isRecentDocumentType,
  listRecentlyViewedDocuments,
  recordRecentlyViewedDocument,
} from "@/lib/recently-viewed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(req.url);
  return Response.json({
    documents: await listRecentlyViewedDocuments(
      session.user.id,
      parseLimit(url.searchParams.get("limit")),
    ),
  });
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !isRecentDocumentType(body.docType)) {
    return Response.json({ error: "Invalid document type" }, { status: 400 });
  }

  const docId = cleanRecentText(body.docId, 300);
  const title = cleanRecentText(body.title, 500);
  const path = cleanRecentText(body.path, 800);
  if (!docId || !title || !path.startsWith("/")) {
    return Response.json({ error: "Missing details" }, { status: 400 });
  }

  return Response.json(
    {
      document: await recordRecentlyViewedDocument({
        userId: session.user.id,
        docType: body.docType,
        docId,
        title,
        path,
      }),
    },
    { status: 201 },
  );
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(req.url);
  const docType = url.searchParams.get("docType");
  const docId = cleanRecentText(url.searchParams.get("docId"), 300);
  if (!docType && !docId) {
    await clearRecentlyViewedDocuments(session.user.id);
    return Response.json({ ok: true });
  }
  if (!isRecentDocumentType(docType) || !docId) {
    return Response.json(
      { error: "Invalid recently viewed document" },
      { status: 400 },
    );
  }

  await deleteRecentlyViewedDocument({
    userId: session.user.id,
    docType,
    docId,
  });
  return Response.json({ ok: true });
}
