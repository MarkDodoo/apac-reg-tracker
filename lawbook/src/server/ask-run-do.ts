import { DurableObject } from "cloudflare:workers";

/**
 * AskRunDO — hosts a single Ask Lawplain agent run so it survives the client
 * navigating away. Stage 1: a no-op stub to validate the OpenNext custom-DO
 * plumbing (worker re-export + wrangler binding/migration) in isolation.
 */
export class AskRunDO extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    return new Response(JSON.stringify({ ok: true, do: "AskRunDO" }), {
      headers: { "content-type": "application/json" },
    });
  }
}
