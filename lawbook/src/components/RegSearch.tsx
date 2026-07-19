"use client";

/**
 * Regulation search — replaces the legal-corpus SearchExplorer on the home
 * page. Talks to our own pipeline backend via /api/regulations.
 *
 * Two modes: keyword (LIKE over title/text) and semantic (ChromaDB embedding
 * search — finds documents by meaning). Results link out to the regulator's
 * original page; summaries and sentiment come from the local LLM enrichment.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface RegHit {
  id: string;
  title: string;
  source: string;
  source_url?: string;
  url?: string;
  jurisdiction?: string | null;
  summary?: string | null;
  doc_type?: string | null;
  published_date: string | null;
  sentiment_label?: string | null;
  impact_level?: string | null;
  relevance?: number;
}

const SOURCES = ["All", "MAS", "HKMA", "ASIC"] as const;

// Diverging polarity colors, shared with the dashboard (CVD-validated).
const SENTIMENT_DOT: Record<string, string> = {
  Facilitative: "bg-[#2a78d6]",
  Neutral: "bg-[#898781]",
  Restrictive: "bg-[#e34948]",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function HitCard({ h }: { h: RegHit }) {
  const href = h.source_url ?? h.url ?? "#";
  return (
    <li className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[15px] font-semibold leading-snug text-foreground hover:underline"
      >
        {h.title}
      </a>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="font-semibold text-muted">{h.source}</span>
        {h.published_date && <span>{formatDate(h.published_date)}</span>}
        {h.doc_type && <span>{h.doc_type}</span>}
        {h.sentiment_label && (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                SENTIMENT_DOT[h.sentiment_label] ?? "bg-border"
              }`}
            />
            {h.sentiment_label}
          </span>
        )}
        {h.impact_level && <span>{h.impact_level} impact</span>}
        {typeof h.relevance === "number" && (
          <span className="tabular-nums">
            {(h.relevance * 100).toFixed(0)}% match
          </span>
        )}
      </div>
      {h.summary && (
        <p className="mt-2 text-sm leading-relaxed text-muted">{h.summary}</p>
      )}
    </li>
  );
}

export function RegSearch({
  initialQuery,
  onActiveChange,
}: {
  initialQuery: string;
  onActiveChange: (active: boolean) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("All");
  const [hits, setHits] = useState<RegHit[] | null>(null);
  const [latest, setLatest] = useState<RegHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (q: string, m: string, src: string) => {
      const seq = ++requestSeq.current;
      const active = q.trim().length > 0;
      onActiveChange(active);
      if (!active) {
        setHits(null);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: q.trim(), mode: m });
        if (src !== "All") params.set("source", src);
        const res = await fetch(`/api/regulations?${params}`);
        const data = (await res.json()) as {
          results?: RegHit[];
          error?: string;
        };
        if (seq !== requestSeq.current) return; // superseded by newer search
        if (!res.ok) {
          setError(data.error ?? "Search failed.");
          setHits([]);
        } else {
          let results = data.results ?? [];
          // Semantic endpoint has no source filter — apply client-side.
          if (src !== "All") results = results.filter((h) => h.source === src);
          setHits(results);
        }
      } catch {
        if (seq === requestSeq.current) {
          setError("Search failed — is the pipeline API running?");
          setHits([]);
        }
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [onActiveChange],
  );

  // Run an initial search when the page is opened with ?q=.
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery, "keyword", "All");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Latest-developments feed for the idle homepage, so the app opens with
  // content rather than an empty search box.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/regulations?limit=8")
      .then((r) =>
        r.ok ? (r.json() as Promise<{ results?: RegHit[] }>) : null,
      )
      .then((d) => {
        if (!cancelled && d?.results) setLatest(d.results);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    runSearch(query, mode, source);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-sm focus-within:border-border-strong">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search APAC regulatory developments…"
            className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-2"
            aria-label="Search regulations"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-85"
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <div className="flex items-center gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSource(s);
                  if (query.trim()) runSearch(query, mode, s);
                }}
                className={`rounded-full border px-2.5 py-1 transition-colors ${
                  source === s
                    ? "border-border-strong bg-surface-2 font-semibold text-foreground"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {(["keyword", "semantic"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  if (query.trim()) runSearch(query, m, source);
                }}
                title={
                  m === "semantic"
                    ? "Finds documents by meaning, even without matching words"
                    : "Matches words in titles and text"
                }
                className={`rounded-full border px-2.5 py-1 capitalize transition-colors ${
                  mode === m
                    ? "border-border-strong bg-surface-2 font-semibold text-foreground"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="mt-4 flex-1 overflow-y-auto pb-8">
        {loading && (
          <p className="px-1 py-6 text-center text-sm text-muted">Searching…</p>
        )}
        {error && !loading && (
          <p className="px-1 py-6 text-center text-sm text-muted">{error}</p>
        )}
        {hits && !loading && !error && hits.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-muted">
            No documents matched. Try semantic mode for meaning-based matching.
          </p>
        )}
        {hits && !loading && hits.length > 0 && (
          <ul className="flex flex-col gap-3">
            {hits.map((h) => (
              <HitCard key={h.id} h={h} />
            ))}
          </ul>
        )}
        {!hits && !loading && !error && latest && latest.length > 0 && (
          <div>
            <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
              Latest developments
            </h2>
            <ul className="flex flex-col gap-3">
              {latest.map((h) => (
                <HitCard key={h.id} h={h} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
