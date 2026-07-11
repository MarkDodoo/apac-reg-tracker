"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { SearchHistoryEntry } from "@/lib/search-history";

function replayPath(item: SearchHistoryEntry) {
  const params = new URLSearchParams({ tab: item.tab, q: item.query });
  for (const [key, value] of Object.entries(item.filters)) {
    if (value) params.set(key, value);
  }
  return `/?${params.toString()}`;
}

export function SavedSearchHistory() {
  const { data: session } = authClient.useSession();
  const [searches, setSearches] = useState<SearchHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setSearches([]);
      return;
    }
    let ignore = false;
    void fetch("/api/search-history?limit=50", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load search history.");
        const data = (await res.json()) as { searches?: SearchHistoryEntry[] };
        if (!ignore) setSearches(data.searches ?? []);
      })
      .catch((err: Error) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, [session?.user]);

  if (!session?.user) return null;

  async function remove(id: string) {
    const previous = searches;
    setSearches((items) => items.filter((item) => item.id !== id));
    const res = await fetch(`/api/search-history/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setSearches(previous);
      setError("Could not delete search.");
    }
  }

  async function clear() {
    const previous = searches;
    setSearches([]);
    const res = await fetch("/api/search-history", { method: "DELETE" });
    if (!res.ok) {
      setSearches(previous);
      setError("Could not clear search history.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-medium text-foreground">
          Search history
        </h2>
        {searches.length > 0 && (
          <button
            type="button"
            onClick={() => void clear()}
            className="text-xs font-medium text-muted hover:text-accent"
          >
            Clear all
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-accent">
          {error}
        </p>
      )}
      {searches.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-5 text-sm text-muted">
          Your searches will appear here while you are signed in.
        </p>
      ) : (
        <ul className="space-y-2">
          {searches.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
            >
              <Link href={replayPath(item)} className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">
                  {item.query}
                </span>
                <span className="mt-1 block text-xs capitalize text-muted-2">
                  {item.tab} · {item.resultCount} results
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void remove(item.id)}
                aria-label={`Delete search ${item.query}`}
                className="text-xs font-medium text-muted hover:text-accent"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
