"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Floating selection toolbar for legal documents (issue #66, MVP slice).
 * When a signed-in user selects text inside a [data-selectable] reader, a small
 * icon toolbar appears with "Copy quote" (exact passage + citation + deep link)
 * and, where grounding is supported, "Ask Lawplain about this". Signed-out users
 * are nudged to sign in. Quote persistence + a Quotes tab are a follow-up.
 */
export function SelectionTools({
  title,
  citation,
  path,
  askKind,
}: {
  title: string;
  citation: string;
  path: string;
  /** Pass "judgment" | "statute" to show an Ask shortcut; omit otherwise. */
  askKind?: "judgment" | "statute";
}) {
  const { data: session } = authClient.useSession();
  const isSignedIn = Boolean(session?.user);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [nudge, setNudge] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function update() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setRect(null);
        setNudge(false);
        return;
      }
      const node = sel.anchorNode;
      const host =
        node?.nodeType === 1
          ? (node as Element)
          : (node?.parentElement ?? null);
      if (barRef.current?.contains(host)) return; // ignore selection in the bar
      const selectable = host?.closest("[data-selectable]");
      const selected = sel.toString().trim();
      if (!selectable || selected.length < 2) {
        setRect(null);
        return;
      }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setText(selected);
      setRect({ top: r.top - 10, left: r.left + r.width / 2 });
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  if (!rect) return null;

  const link =
    (typeof window !== "undefined" ? window.location.origin : "") + path;
  const quote = `"${text}"\n\n— ${title}${citation ? `, ${citation}` : ""}\n${link}`;

  async function copyQuote() {
    if (!isSignedIn) {
      setNudge(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(quote);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; fail quietly.
    }
  }

  return (
    <div
      ref={barRef}
      className="motion-fade-up fixed z-40 -translate-x-1/2 -translate-y-full"
      style={{ top: rect.top, left: rect.left }}
    >
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-lg">
        {nudge ? (
          <a
            href="/sign-in"
            className="rounded-full px-3 py-1 text-xs font-medium text-accent hover:underline"
          >
            Sign in to use quote tools
          </a>
        ) : (
          <>
            <button
              type="button"
              onClick={copyQuote}
              aria-label="Copy quote with citation"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="currentColor"
              >
                {copied ? (
                  <path d="M6.5 11.2 3.3 8l-1 1 4.2 4.2 7.2-7.2-1-1z" />
                ) : (
                  <path d="M5 3h6a2 2 0 0 1 2 2v8h-1.5V5a.5.5 0 0 0-.5-.5H5V3zM3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" />
                )}
              </svg>
              {copied ? "Copied" : "Quote"}
            </button>
            {askKind && citation && (
              <a
                href={`/ask?cite=${encodeURIComponent(citation)}&kind=${askKind}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                >
                  <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
                </svg>
                Ask
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
