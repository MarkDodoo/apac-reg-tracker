import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getThread } from "@/lib/ask-threads";
import { getSession } from "@/lib/auth";
import { stopMemoryAskRun } from "@/server/ask-run-memory";
import { safeAgentError, userRunName } from "@/server/ask-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown, max = 100): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession(req.headers);
  if (!session?.user?.id) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    runId?: unknown;
    threadId?: unknown;
  } | null;
  const runId = clean(body?.runId);
  const threadId = clean(body?.threadId);
  if (!runId || !threadId) {
    return Response.json(
      { error: "Missing runId or threadId" },
      { status: 400 },
    );
  }

  const thread = await getThread(session.user.id, threadId);
  if (!thread || thread.runId !== runId) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const ns = (env as { ASK_RUN_DO?: DurableObjectNamespace }).ASK_RUN_DO;
    if (!ns) {
      const stopped = stopMemoryAskRun(session.user.id, runId);
      return Response.json({
        ok: true,
        status: stopped ? "stopped" : "not-hosted",
      });
    }

    const stub = ns.get(ns.idFromName(userRunName(session.user.id, runId)));
    const res = await stub.fetch("https://ask-run-do/stop", {
      method: "POST",
      headers: { "x-lawplain-user-id": session.user.id },
    });
    const data = await res.json().catch(() => ({ ok: res.ok }));
    return Response.json(data, { status: res.ok ? 200 : res.status });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      const stopped = stopMemoryAskRun(session.user.id, runId);
      return Response.json({
        ok: true,
        status: stopped ? "stopped" : "not-hosted",
      });
    }
    console.error("Ask stop failed", err);
    return Response.json({ error: safeAgentError() }, { status: 500 });
  }
}
