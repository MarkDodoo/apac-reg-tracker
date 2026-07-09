"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentFindToolbar } from "@/components/DocumentFindToolbar";
import {
  countMatches,
  highlightMatches,
  updateActiveMatch,
} from "@/lib/document-find";
import { buildRegex, parseTerms } from "@/lib/sections";

export function GenericDocumentReader({
  label,
  query,
  text,
  fullBodyAvailable = false,
}: {
  label: string;
  query: string;
  text: string;
  fullBodyAvailable?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const terms = useMemo(() => parseTerms(query), [query]);
  const regex = useMemo(() => buildRegex(terms), [terms]);
  const matchCount = useMemo(() => countMatches(text, regex), [text, regex]);
  const activeIndex = matchCount === 0 ? 0 : Math.min(active, matchCount - 1);

  useEffect(() => {
    if (matchCount === 0) return;
    updateActiveMatch(containerRef.current, activeIndex);
  }, [activeIndex, matchCount]);

  const goMatch = (dir: number) => {
    if (matchCount === 0) return;
    setActive((current) => {
      const cur = Math.min(current, matchCount - 1);
      return (cur + dir + matchCount) % matchCount;
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-[68ch] gap-6">
      <div className="min-w-0">
        {terms.length > 0 && (
          <DocumentFindToolbar
            query={query}
            matchCount={matchCount}
            activeIndex={activeIndex}
            documentLabel={label.toLowerCase()}
            onPrevious={() => goMatch(-1)}
            onNext={() => goMatch(1)}
          />
        )}

        {!fullBodyAvailable && (
          <p className="mb-4 rounded-lg border border-accent/25 bg-accent-soft/40 px-4 py-3 text-sm text-muted">
            Full-text detail endpoints are not exposed for this corpus yet, so
            Lawplain is showing all text currently returned for this result. The
            reader controls, highlighting, save, copy, and Ask actions still
            follow the Judgment page style.
          </p>
        )}

        <article
          ref={containerRef}
          className="flex max-w-[68ch] flex-col gap-4 font-serif text-[17px] leading-7 text-foreground/90"
        >
          {text ? (
            <p className="scroll-mt-24 pl-10">
              {highlightMatches(text, regex, "generic-document")}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center font-sans text-sm text-muted">
              No document text was returned for this result.
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
