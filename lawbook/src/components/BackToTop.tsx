"use client";

import { useEffect, useState } from "react";

/**
 * Floating "Back to top" control for long document pages (issue #67). Appears
 * once the user has scrolled past the document title, smooth-scrolls back to
 * the top, and is keyboard accessible. Positioned bottom-right to avoid the
 * centered analytics consent banner and the sticky find/section controls.
 */
export function BackToTop({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3.5 py-2 text-sm font-medium text-muted shadow-md backdrop-blur transition-colors hover:border-accent hover:text-foreground"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 13V4" />
        <path d="M4 7l4-4 4 4" />
      </svg>
      Top
    </button>
  );
}
