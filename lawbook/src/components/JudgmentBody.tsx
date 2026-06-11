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
      <article className="whitespace-pre-wrap font-serif text-[15px] leading-7 text-foreground/90">
        {text}
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
