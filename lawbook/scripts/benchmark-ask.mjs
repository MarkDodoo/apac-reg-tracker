#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const fixtureUrl = new URL(
  "../benchmarks/fixtures/defamation-elements.json",
  import.meta.url,
);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
const endpoint = process.env.LAWPLAIN_BENCHMARK_URL;
if (!endpoint || process.env.LAWPLAIN_BENCHMARK_RUN !== "yes") {
  console.error(
    "Set LAWPLAIN_BENCHMARK_URL and LAWPLAIN_BENCHMARK_RUN=yes to run (may incur model charges).",
  );
  process.exit(2);
}

const started = performance.now();
let firstDeltaMs = null;
let answer = "";
const doneEvents = [];
const errors = [];
let rejectedToolCalls = 0;
const tools = new Map();
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question: fixture.question }),
});
if (!response.ok || !response.body)
  throw new Error(`Ask returned ${response.status}`);
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let boundary = buffer.indexOf("\n\n");
  while (boundary >= 0) {
    const frame = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    const line = frame.split("\n").find((value) => value.startsWith("data: "));
    if (!line) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === "delta") {
      firstDeltaMs ??= Math.round(performance.now() - started);
      answer += event.text;
    } else if (event.type === "tool") {
      tools.set(event.key, (tools.get(event.key) ?? 0) + 1);
    } else if (event.type === "tool_rejected") rejectedToolCalls += 1;
    else if (event.type === "error") errors.push(event.message);
    else if (event.type === "done") doneEvents.push(event);
    boundary = buffer.indexOf("\n\n");
  }
}
if (errors.length) throw new Error("Ask emitted an SSE error");
if (doneEvents.length !== 1) {
  throw new Error(`Ask emitted ${doneEvents.length} done events; expected one`);
}
const done = doneEvents[0];
const finalAnswer = done.text || answer;
if (!finalAnswer.trim()) throw new Error("Ask returned an empty answer");
const counts = [...tools.values()];
const normalized = finalAnswer.toLowerCase();
const expectedTerms = fixture.expectations.answerTerms;
const matchedTerms = expectedTerms.filter((term) =>
  normalized.includes(term.toLowerCase()),
);
const citationPattern = new RegExp(fixture.expectations.citationPattern, "g");
const citations = finalAnswer.match(citationPattern) ?? [];
console.log(
  JSON.stringify({
    fixture: fixture.id,
    model: process.env.LAWPLAIN_AGENT_MODEL ?? "glm-5.2",
    firstDeltaMs,
    totalMs: Math.round(performance.now() - started),
    toolCalls: counts.reduce((sum, count) => sum + count, 0),
    duplicateToolCalls: counts.reduce(
      (sum, count) => sum + Math.max(0, count - 1),
      0,
    ),
    rejectedToolCalls,
    costUsd: done.costUsd ?? null,
    contextTokens: done.contextTokens ?? null,
    expectationScore: matchedTerms.length / expectedTerms.length,
    matchedExpectations: matchedTerms,
    citationCount: citations.length,
    citationPattern: fixture.expectations.citationPattern,
    answerSnippet: finalAnswer.slice(0, 240),
  }),
);
