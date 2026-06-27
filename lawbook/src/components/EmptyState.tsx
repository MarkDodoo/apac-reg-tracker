import type { ReactNode } from "react";

/**
 * Shared empty / unavailable state for search, judgment, statute and document
 * readers (issue #77). Keeps copy and styling consistent across the app.
 */
export function EmptyState({
  title,
  hint,
  icon,
  children,
  className = "",
}: {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center ${className}`}
    >
      <span className="text-muted-2">{icon ?? <DefaultIcon />}</span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && (
        <p className="max-w-sm text-sm leading-relaxed text-muted-2">{hint}</p>
      )}
      {children}
    </div>
  );
}

function DefaultIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}
