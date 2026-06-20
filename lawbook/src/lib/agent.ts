/**
 * Lawplain legal-research agent — drives the `graff` binary (via
 * @codegraff/sdk) to answer natural-language questions about the Singapore
 * legal corpus by searching the read-only sgjudge REST API itself.
 *
 * The agent has a `bash` tool; with `yolo: true` it runs `curl` against
 * https://backend.lawplain.com, parses the JSON, iterates, and writes a
 * cited answer. It runs in an isolated temp cwd so it cannot touch the
 * project source.
 *
 * Requires the `graff` binary on PATH and a model key configured
 * (`graff key set <provider> <key>` or the matching `<PROVIDER>_API_KEY`
 * env var). See README §"Agent setup".
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Event, runAgent } from "@codegraff/sdk";
import {
  createSandbox,
  deleteSandbox,
  GRAFF_BIN_PATH,
  installGraff,
  streamProcess,
} from "@/lib/cubesandbox";
import { BASE } from "@/lib/sgjudge";

export const AGENT_MODEL = process.env.LAWPLAIN_AGENT_MODEL ?? "kimi-k2.7";

/** Override the `graff` binary path (defaults to `graff` on PATH). */
export const AGENT_BINARY = process.env.LAWGRAFF_BINARY ?? "graff";

/**
 * System prompt that turns graff into a focused Singapore-law research
 * assistant. The endpoint list mirrors `src/lib/sgjudge.ts` so the agent
 * knows the exact shapes it can query.
 */
export function legalResearchPrompt(): string {
  return `You are Lawplain Research, an assistant for the Singapore legal
corpus. You answer questions about case law, statutes, subsidiary
legislation, parliamentary Hansard, bills and practice directions by
querying a read-only REST API yourself and synthesizing a cited answer.

# The API
Base URL: ${BASE}  (public, GET-only, CORS *, returns JSON).
All search endpoints take \`?q=\` (required) and \`?limit=\` (default 10, max 50).
Search results are ranked by SQLite FTS5 bm25 — the \`score\` field is NEGATIVE;
more negative = more relevant. Each hit has a \`snippet\` with <b> highlights.

Endpoints (curl them with \`-s\` and pipe through \`jq\` to keep output small):
- GET /v1/judgments/search?q=&court=&year_range=&since=&judge=&limit=
    hits: citation, neutral_cite?, court?, year?, title?, decision_date?
- GET /v1/judgments/{citation}?include_body=true&body_offset=0&body_length=8000
    detail incl. body_text (paginated via body_offset/body_length)
- GET /v1/statutes/search?q=&kind=&limit=
    hits: act_id, kind?, short_title?, year_enacted?
- GET /v1/statutes/{reference}?kind=&include_body=true
    detail incl. sections[] (section_no, heading?, text?)
- GET /v1/statutes/{actId}/sections/{sectionNo}
- GET /v1/subsidiary-legislation/search?q=&parent_act_id=&limit=
- GET /v1/hansard/search?q=&speaker=&since=&limit=
    hits: speaker?, party?, constituency?, topic?, date?
- GET /v1/bills/search?q=&session=&status=&limit=
    hits: session?, status?, title?
- GET /v1/practice-directions/search?q=&court=&limit=
- GET /v1/stats   (corpus counts, for orientation)

Always URL-encode the query (use \`--data-urlencode\` with \`-G\`).
Keep each curl's output small: select only the columns you need with jq, e.g.
  curl -sG "${BASE}/v1/judgments/search" --data-urlencode "q=defamation" | jq '.results[] | {citation,title,court,year,score}'

# How to work — STRICT BUDGET (this is enforced)
You have a HARD LIMIT of 8 tool calls total for the whole turn. Count them.
- NEVER repeat a search you have already run (same q + endpoint). If a query
  returned nothing useful, reformulate ONCE, then move on.
- Do at most 2-4 searches, then at most 2 detail fetches (judgment body or
  statute section) for the most promising hits. That is usually enough.
- Prefer limit=5 on searches to keep context small.
- Once you have any usable results, STOP searching and write the answer.
  Do not "double-check" or re-search the same term. Do not call /v1/stats.
- If the first search already answers the question, you may answer immediately
  with 1-2 tool calls total.

# Answering
- Write in clear prose (markdown). Lead with the direct answer, then support.
- Cite every non-trivial claim: judgments by neutral citation or [citation]
  and year; statutes by short title + section number.
- Link to the app where useful: judgments at /judgment/{citation} and
  statutes at /statute/{act_id}. Use markdown links.
- Be factual and neutral. This is legal information, NOT legal advice — say so
  briefly when a user asks for a recommendation or prediction.
- If the corpus has nothing relevant, say so plainly; do not invent cases,
  citations, or section numbers.
- Keep the answer tight: a few short paragraphs or a short bullet list. Quote
  sparingly (a phrase), never paste whole bodies.
`;
}

export interface AgentTurnEvent {
  /** Streamed assistant text delta. */
  type: "delta";
  text: string;
}
export interface AgentToolEvent {
  /** The agent invoked a tool (e.g. a curl search). Shown as a status chip. */
  type: "tool";
  name: string;
  summary: string;
}
export interface AgentDoneEvent {
  /** Turn finished. */
  type: "done";
  text: string;
  costUsd: number;
  contextTokens: number;
}
export interface AgentErrorEvent {
  type: "error";
  message: string;
}

export type AgentEvent =
  | AgentTurnEvent
  | AgentToolEvent
  | AgentDoneEvent
  | AgentErrorEvent;

/**
 * A document the user is viewing, passed from a detail page to ground the
 * chat. `excerpt` is a trimmed body/sections slice so the agent can answer
 * about THAT document without a re-fetch (it still can via the API).
 */
export interface ChatContext {
  kind: "judgment" | "statute";
  /** Citation (judgment) or act_id/reference (statute). */
  citation: string;
  /** Display title (judgment title or statute short_title). */
  title: string;
  /** In-app path back to the full document. */
  href: string;
  /** Trimmed document text — body excerpt (judgment) or joined sections (statute). */
  excerpt: string;
}

/** Compose the user-turn prompt, optionally grounded in an open document. */
function composePrompt(question: string, ctx?: ChatContext): string {
  if (!ctx) return question;
  const kindLabel = ctx.kind === "judgment" ? "Judgment" : "Statute";
  const fetchHint =
    ctx.kind === "judgment"
      ? `/v1/judgments/${ctx.citation} with a larger body_length`
      : `/v1/statutes/${ctx.citation}`;
  return `# Context — the user has this document open
${kindLabel}: ${ctx.title} (${ctx.citation})
Full document in the app: ${ctx.href}
You can still fetch more of it via the API (e.g. ${fetchHint}) if the excerpt
below is missing what you need — but prefer the excerpt already provided.

# Excerpt
${ctx.excerpt}

# Question
${question}`;
}

/**
 * Minimal env for the `graff` subprocess: only what it needs to find its
 * binary, stored keys, and temp dir — NOT the whole process env, so no
 * host secrets (DB URLs, other API keys) are exposed to the yolo-bash agent.
 */
function agentEnv(): NodeJS.ProcessEnv {
  const allow = new Set([
    "PATH",
    "HOME",
    "USER",
    "TMPDIR",
    "TZ",
    "LANG",
    "LC_ALL",
    "SHELL",
    "TERM",
  ]);
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && allow.has(k)) env[k] = v;
  }
  env.GRAFF_NO_TELEMETRY = "1";
  return env as NodeJS.ProcessEnv;
}

/** Best-effort one-line summary of a tool call for the UI status line. */
function summarizeTool(name: string, input: unknown): string {
  const inp =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  if (name === "bash") {
    const cmd = String(inp.command ?? "").trim();
    // Pull the query out of a curl --data-urlencode "q=..." if present.
    const m = cmd.match(/q=([^&"'\s]+)/);
    const url = cmd.match(/https?:\/\/\S+/)?.[0];
    if (m) return `search: ${decodeURIComponentSafe(m[1])}`;
    if (url) return url.replace(BASE, "").split("?")[0];
    return cmd.slice(0, 80);
  }
  if (name === "webfetch") return `fetch ${String(inp.url ?? "")}`;
  if (name === "read_file") return `read ${String(inp.path ?? "")}`;
  return name;
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Run one agent turn, yielding normalized events. Spawns `graff --json`,
 * streams until the turn ends, then closes. Throws on a fatal error.
 */
export async function* askLegalAgent(
  question: string,
  signal?: AbortSignal,
  context?: ChatContext,
): AsyncGenerator<AgentEvent> {
  // Isolated cwd so yolo bash can't touch the project tree.
  const cwd = mkdtempSync(join(tmpdir(), "lawplain-agent-"));
  try {
    const stream = runAgent({
      prompt: composePrompt(question, context),
      model: AGENT_MODEL,
      yolo: true,
      binary: AGENT_BINARY,
      cwd,
      systemPrompt: legalResearchPrompt(),
      // Minimal env: no host secrets reach the yolo-bash agent.
      env: agentEnv(),
    });

    let finalText = "";
    let costUsd = 0;
    let contextTokens = 0;

    for await (const ev of stream as AsyncGenerator<Event>) {
      if (signal?.aborted) break;
      switch (ev.type) {
        case "text":
          if (ev.text) yield { type: "delta", text: ev.text };
          break;
        case "tool_call":
          yield {
            type: "tool",
            name: ev.name,
            summary: summarizeTool(ev.name, ev.input),
          };
          break;
        case "turn":
          finalText = ev.text;
          costUsd = ev.cost_usd;
          contextTokens = ev.context_tokens;
          break;
        case "error":
          yield { type: "error", message: ev.message };
          return;
        default:
          break;
      }
    }

    if (signal?.aborted) return;
    yield {
      type: "done",
      text: finalText,
      costUsd,
      contextTokens,
    };
  } finally {
    // Clean up the isolated cwd so a long-running server doesn't leak dirs.
    rmSync(cwd, { recursive: true, force: true });
  }
}

// ─── sandboxed execution via CubeSandbox microVMs ───────────────────────

/**
 * Run one agent turn inside a disposable CubeSandbox microVM.
 *
 * Instead of spawning `graff` as a local subprocess (which gives the agent's
 * yolo-bash tool access to the host), this creates a firewalled firecracker
 * VM, downloads the graff binary into it, and runs `graff --json -p` inside.
 * The agent's bash tool can only reach the internet (to curl the sgjudge API)
 * — it cannot touch the host filesystem or other processes.
 *
 * Requires:
 *   CUBESANDBOX_GATEWAY_URL  — gateway base URL
 *   CUBESANDBOX_TENANT_KEY   — tenant API key
 *   KIMI_API_KEY             — model provider key (injected into the VM)
 *
 * Yields the same AgentEvent stream as askLegalAgent, so the UI doesn't need
 * to know which backend is in use.
 */
export async function* askLegalAgentSandboxed(
  question: string,
  signal?: AbortSignal,
  context?: ChatContext,
): AsyncGenerator<AgentEvent> {
  const gw = process.env.CUBESANDBOX_GATEWAY_URL;
  const tenantKey = process.env.CUBESANDBOX_TENANT_KEY;
  const kimiKey = process.env.KIMI_API_KEY;

  if (!gw || !tenantKey) {
    yield {
      type: "error",
      message:
        "CubeSandbox gateway not configured (CUBESANDBOX_GATEWAY_URL / CUBESANDBOX_TENANT_KEY)",
    };
    return;
  }
  if (!kimiKey) {
    yield { type: "error", message: "KIMI_API_KEY not set" };
    return;
  }

  let sid: string | null = null;
  try {
    // 1. Create microVM
    yield { type: "tool", name: "sandbox", summary: "Starting sandbox…" };
    sid = await createSandbox({ cpuCount: 2, memoryMB: 1024 });

    // 2. Download graff into the VM
    yield { type: "tool", name: "sandbox", summary: "Loading agent…" };
    await installGraff(sid);

    // 3. Run graff --json inside the VM, piping the prompt via stdin.
    //    envd doesn't support process stdin, so we use a bash pipe.
    //    All dynamic values are env vars to avoid shell-escaping issues.
    const prompt = composePrompt(question, context);
    const systemPrompt = legalResearchPrompt();
    const promptJson = JSON.stringify({ type: "user", text: prompt });

    const envs: Record<string, string> = {
      PROMPT_JSON: promptJson,
      SYSTEM_PROMPT: systemPrompt,
      GRAFF_BIN: GRAFF_BIN_PATH,
      MODEL: AGENT_MODEL,
      KIMI_API_KEY: kimiKey,
      HOME: "/home/user",
      PATH: "/usr/bin:/bin:/usr/local/bin",
      GRAFF_NO_TELEMETRY: "1",
    };

    let finalText = "";
    let costUsd = 0;
    let contextTokens = 0;
    let lineBuf = "";

    for await (const chunk of streamProcess(sid, {
      cmd: "/bin/bash",
      args: [
        "-c",
        'printf \'%s\' "$PROMPT_JSON" | "$GRAFF_BIN" --json --yolo --no-telemetry --model "$MODEL" --system-prompt "$SYSTEM_PROMPT"',
      ],
      cwd: "/tmp",
      envs,
      timeoutMs: 300_000,
    })) {
      if (signal?.aborted) break;

      if (chunk.type !== "stdout") continue;

      // Buffer stdout and emit complete NDJSON lines
      lineBuf += chunk.data;
      let nl = lineBuf.indexOf("\n");
      while (nl >= 0) {
        const line = lineBuf.slice(0, nl).trim();
        lineBuf = lineBuf.slice(nl + 1);
        if (!line) continue;

        let ev: Event;
        try {
          ev = JSON.parse(line) as Event;
        } catch {
          continue; // skip non-JSON lines (e.g. progress noise)
        }

        switch (ev.type) {
          case "text":
            if (ev.text) yield { type: "delta", text: ev.text };
            break;
          case "tool_call":
            yield {
              type: "tool",
              name: ev.name,
              summary: summarizeTool(ev.name, ev.input),
            };
            break;
          case "turn":
            finalText = ev.text;
            costUsd = ev.cost_usd;
            contextTokens = ev.context_tokens;
            break;
          case "error":
            yield { type: "error", message: ev.message };
            return;
          default:
            break;
        }
        nl = lineBuf.indexOf("\n");
      }
    }

    if (signal?.aborted) return;
    yield { type: "done", text: finalText, costUsd, contextTokens };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // Always clean up the microVM — never leak sandboxes.
    if (sid) await deleteSandbox(sid);
  }
}
