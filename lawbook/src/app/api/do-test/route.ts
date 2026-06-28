import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AGENT_MODEL, composePrompt, legalResearchPrompt } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Temporary diagnostic: drive AskRunDO end-to-end without auth, so we can verify
// a sandbox run executes *inside* the DO and streams (and resumes via ?from=).
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId") ?? crypto.randomUUID();
  const from = Number.parseInt(url.searchParams.get("from") ?? "0", 10) || 0;
  const { env } = await getCloudflareContext({ async: true });
  const ns = (env as { ASK_RUN_DO?: DurableObjectNamespace }).ASK_RUN_DO;
  if (!ns) return new Response("no ASK_RUN_DO binding", { status: 500 });

  const stub = ns.get(ns.idFromName(runId));
  const prompt = composePrompt(
    "In one sentence, what is the limitation period for a simple contract claim in Singapore?",
    undefined,
    undefined,
  );
  await stub.fetch("https://ask-run-do/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemPrompt: legalResearchPrompt(),
      model: AGENT_MODEL,
    }),
  });
  const res = await stub.fetch(`https://ask-run-do/stream?from=${from}`);
  const headers = new Headers(res.headers);
  headers.set("x-run-id", runId);
  return new Response(res.body, { headers });
}
