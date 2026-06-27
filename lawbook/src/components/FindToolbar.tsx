"use client";

/**
 * Shared sticky in-document find toolbar (issue #70). Used by the Judgment,
 * Document, and Statute readers. Purely presentational — match state lives in
 * the parent (React highlight) or in the useTextFind hook (DOM highlight).
 */
export function FindToolbar({
  query,
  subject,
  matchCount,
  activeIndex,
  searching,
  onPrev,
  onNext,
}: {
  query: string;
  /** e.g. "judgment", "document", "statute" */
  subject: string;
  matchCount: number;
  /** zero-based index of the active match */
  activeIndex: number;
  searching: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="motion-fade-up sticky top-16 z-10 mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/95 px-4 py-2.5 text-sm shadow-sm backdrop-blur">
      <span className="min-w-0 truncate text-muted">
        {matchCount > 0 ? (
          <>
            <span className="font-medium text-foreground">{matchCount}</span>{" "}
            match{matchCount === 1 ? "" : "es"} for{" "}
            <span className="font-medium text-foreground">
              &ldquo;{query}&rdquo;
            </span>
          </>
        ) : searching ? (
          `Searching the ${subject}…`
        ) : (
          <>
            No matches for &ldquo;{query}&rdquo; in this {subject}.
          </>
        )}
      </span>
      {matchCount > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 tabular-nums text-muted-2">
            {activeIndex + 1}/{matchCount}
          </span>
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous match"
            className="rounded-md border border-border px-2 py-1 leading-none text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next match"
            className="rounded-md border border-border px-2 py-1 leading-none text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            ↓
          </button>
        </div>
      )}
    </div>
  );
}
