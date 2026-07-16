/**
 * APAC Regulation Tracker agent — replaces the graff/lawplain legal agent
 * with our own local RAG backend (pipeline/ FastAPI + ChromaDB + Ollama).
 *
 * The pipeline's GET /v1/ask/stream already emits AgentEvent-shaped JSON as
 * Server-Sent Events, so this adapter just proxies the stream into the same
 * AsyncGenerator<AgentEvent> contract the rest of the app consumes. Enabled
 * whenever REG_TRACKER_API_URL is set (see regAgentEnabled).
 *
 * Current limitations vs the old agent: pinned-document context and
 * multi-turn history are not yet forwarded to the backend.
 */
import type { AgentEvent, ChatContext, ChatTurn } from "@/lib/agent";

export function regTrackerApiUrl(): string | null {
  const url = process.env.REG_TRACKER_API_URL;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function regAgentEnabled(): boolean {
  return regTrackerApiUrl() !== null;
}

interface RegSource {
  n: number;
  title: string;
  source: string;
  published_date: string;
  url: string;
}

/** Render retrieved sources as a markdown footer so the existing Ask UI
 * (which renders markdown) shows numbered, clickable citations. */
function sourcesFooter(sources: RegSource[]): string {
  if (sources.length === 0) return "";
  const lines = sources.map(
    (s) => `${s.n}. [${s.title}](${s.url}) — ${s.source}, ${s.published_date}`,
  );
  return `\n\n---\n**Sources**\n\n${lines.join("\n")}\n`;
}

export async function* askRegAgent(
  question: string,
  signal?: AbortSignal,
  _context?: ChatContext,
  _history?: ChatTurn[],
): AsyncGenerator<AgentEvent> {
  const base = regTrackerApiUrl();
  if (!base) {
    yield {
      type: "error",
      message: "REG_TRACKER_API_URL is not configured.",
    };
    return;
  }

  let res: Response;
  try {
    const url = new URL("/v1/ask/stream", base);
    url.searchParams.set("q", question);
    res = await fetch(url, { signal });
  } catch (err) {
    yield {
      type: "error",
      message: `Regulation backend unreachable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
    return;
  }
  if (!res.ok || !res.body) {
    yield {
      type: "error",
      message: `Regulation backend error (HTTP ${res.status}).`,
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let footer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) return;
      buf += decoder.decode(value, { stream: true });

      let sep = buf.indexOf("\n\n");
      while (sep >= 0) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        sep = buf.indexOf("\n\n");

        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;

        let ev: AgentEvent & { sources?: RegSource[] };
        try {
          ev = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        if (ev.type === "done") {
          footer = sourcesFooter(ev.sources ?? []);
          if (footer) yield { type: "delta", text: footer };
          yield {
            type: "done",
            text: `${ev.text}${footer}`,
            costUsd: 0,
            contextTokens: 0,
          };
          return;
        }
        yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
