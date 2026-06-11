"use client";

import { useState } from "react";
import { ApiError, sgjudge } from "@/lib/sgjudge";

const PAGE = 60000;

/**
 * Renders judgment body text with a "load more" control. Bodies can be large,
 * so the API paginates via `body_offset`/`body_length`; we append each chunk.
 */
export function JudgmentBody({
  citation,
  initialText,
  initialLoaded,
  total,
}: {
  citation: string;
  initialText: string;
  initialLoaded: number; // chars already loaded (offset + initial length)
  total: number;
}) {
  const [text, setText] = useState(initialText);
  const [loaded, setLoaded] = useState(initialLoaded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = loaded < total;
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 100;

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const res = await sgjudge.getJudgment(citation, {
        include_body: true,
        body_offset: loaded,
        body_length: PAGE,
      });
      const chunk = (res.body_text as string) ?? "";
      setText((t) => t + chunk);
      setLoaded((l) => l + chunk.length);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.status} — ${err.message}`
          : "Could not load more text.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <article className="flex max-w-[68ch] flex-col gap-4 font-serif text-[15px] leading-7 text-foreground/90">
        {renderJudgment(text)}
      </article>

      {error && <p className="mt-4 text-sm text-accent">{error}</p>}

      {hasMore ? (
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-border pt-6">
          <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-2">
            Showing {loaded.toLocaleString()} of {total.toLocaleString()}{" "}
            characters
          </p>
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : (
        <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-2">
          End of judgment · {total.toLocaleString()} characters
        </p>
      )}
    </div>
  );
}

interface Block {
  key: string;
  kind: "heading" | "numbered" | "para";
  num?: string;
  body: string;
}

/**
 * The raw body_text wraps lines with stray single newlines and separates
 * paragraphs with blank lines. We split on blank lines, rejoin wrapped lines,
 * then classify each block so numbered paragraphs and section headings render
 * legibly instead of as one pre-wrapped slab.
 */
function parseBlocks(text: string): Block[] {
  const seen = new Map<string, number>();
  return text
    .split(/\n[^\S\n]*\n+/)
    .map((raw) => raw.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((body) => {
      const prefix = body.slice(0, 40);
      const occ = seen.get(prefix) ?? 0;
      seen.set(prefix, occ + 1);
      const key = `${prefix}#${occ}`;

      const numbered = body.match(/^(\d+)[.)]?\s+([\s\S]+)$/);
      if (numbered) {
        return {
          key,
          kind: "numbered" as const,
          num: numbered[1],
          body: numbered[2],
        };
      }
      // Headings: short, capitalised, no leading digit, no trailing sentence punctuation.
      if (
        body.length <= 60 &&
        /^[A-Z(]/.test(body) &&
        !/^\d/.test(body) &&
        !/[.;:,?]$/.test(body)
      ) {
        return { key, kind: "heading" as const, body };
      }
      return { key, kind: "para" as const, body };
    });
}

function renderJudgment(text: string) {
  return parseBlocks(text).map((b) => {
    if (b.kind === "heading") {
      return (
        <h3
          key={b.key}
          className="pt-3 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-accent"
        >
          {b.body}
        </h3>
      );
    }
    if (b.kind === "numbered") {
      return (
        <p key={b.key} className="flex gap-3">
          <span className="w-7 shrink-0 select-none text-right font-sans text-sm font-medium tabular-nums text-muted-2">
            {b.num}
          </span>
          <span className="flex-1">{b.body}</span>
        </p>
      );
    }
    return (
      <p key={b.key} className="pl-10">
        {b.body}
      </p>
    );
  });
}
