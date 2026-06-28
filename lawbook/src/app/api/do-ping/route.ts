import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Temporary diagnostic: proves the custom AskRunDO is exported + callable.
export async function GET(): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const ns = (env as { ASK_RUN_DO?: DurableObjectNamespace }).ASK_RUN_DO;
    if (!ns) return Response.json({ ok: false, error: "no ASK_RUN_DO binding" });
    const stub = ns.get(ns.idFromName("ping"));
    const res = await stub.fetch("https://do/");
    return Response.json({ ok: true, do: await res.json() });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
