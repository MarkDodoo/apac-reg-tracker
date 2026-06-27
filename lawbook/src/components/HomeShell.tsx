"use client";

import { type ReactNode, useState } from "react";
import { SearchExplorer } from "@/components/SearchExplorer";

/**
 * Google-style home: the brand + search sit vertically centered when idle, and
 * smoothly rise/shrink to the top once a search is active, giving results room.
 * Layout is driven by the live query (via SearchExplorer's onActiveChange) so
 * the transition animates as the user types. Uses the shared emphasized easing
 * token (transitions.dev-adjacent). Mobile-safe: viewport-relative spacer and
 * responsive type sizes.
 */
export function HomeShell({
  courts,
  initialTab,
  initialQuery,
  stats,
}: {
  courts: string[];
  initialTab: string;
  initialQuery: string;
  stats?: ReactNode;
}) {
  const [active, setActive] = useState(initialQuery.trim().length > 0);
  const ease = "duration-500 ease-[var(--ease-emphasized)]";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      {/* Spacer collapses on search, lifting the hero upward. */}
      <div
        aria-hidden="true"
        className={`shrink-0 transition-[height] ${ease} ${
          active ? "h-4" : "h-[12vh] sm:h-[20vh]"
        }`}
      />

      {/* Hero brand. On search it collapses away entirely — the global header
          already shows "Lawplain." on the left, so we avoid a duplicate. */}
      <div
        aria-hidden={active}
        className={`overflow-hidden text-center transition-all ${ease} ${
          active ? "mb-0 max-h-0 opacity-0" : "mb-6 max-h-44 opacity-100"
        }`}
      >
        <h1 className="font-serif text-5xl font-medium tracking-tight text-foreground sm:text-7xl">
          Lawplain<span className="text-accent">.</span>
        </h1>
        <p className="mt-3 text-sm font-semibold tracking-tight text-muted sm:text-base">
          Search Singapore judgments, statutes, Hansard &amp; more
        </p>
      </div>
      <SearchExplorer
        courts={courts}
        initialTab={initialTab}
        initialQuery={initialQuery}
        onActiveChange={setActive}
      />

      {stats && (
        <div
          className={`transition-all ${ease} ${
            active ? "max-h-0 overflow-hidden opacity-0" : "mt-4 opacity-100"
          }`}
        >
          {stats}
        </div>
      )}
    </div>
  );
}
