"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { XIcon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";

interface SavedAnswer {
  id: string;
  question: string;
  answer: string;
  cite: string | null;
  kind: string | null;
  sourceHref: string | null;
  tools: string[];
  createdAt: number;
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

/**
 * Saved Ask Lawplain answers (issue #22). Self-contained list with copy /
 * export / delete + reopen-source, fetched from the session-scoped
 * /api/saved-answers route. Renders nothing for signed-out users (the page's
 * SavedWorkspace already shows the sign-in prompt).
 */
export function SavedAnswers() {
  const { data: session } = authClient.useSession();
  const [answers, setAnswers] = useState<SavedAnswer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/saved-answers", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { answers?: SavedAnswer[] };
        if (!ignore) setAnswers(data.answers ?? []);
      } catch {
        // best-effort
      } finally {
        if (!ignore) setLoaded(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [session?.user]);

  if (!session?.user || (!loaded && answers.length === 0)) return null;

  async function remove(id: string) {
    const prev = answers;
    setAnswers((a) => a.filter((x) => x.id !== id));
    try {
      const res = await fetch(
        `/api/saved-answers?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error();
    } catch {
      setAnswers(prev);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text).catch(() => {});
  }

  function exportMd(a: SavedAnswer) {
    const blob = new Blob([`# ${a.question}\n\n${a.answer}`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lawplain-answer-${a.id.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const act =
    "rounded-md px-2 py-1 text-xs font-medium text-muted-2 transition-colors hover:bg-surface-2 hover:text-foreground";

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-medium text-foreground">
          Saved answers
        </h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-2">
          {answers.length}
        </span>
      </div>

      {answers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No saved answers yet.</p>
          <p className="mt-1">
            Ask Lawplain a question, then use <strong>Save</strong> on an
            answer.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {answers.map((a) => (
            <li
              key={a.id}
              className="relative rounded-xl border border-border bg-background p-4 pr-10"
            >
              <p className="font-serif text-base font-medium leading-snug text-foreground">
                {a.question}
              </p>
              <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">
                {a.answer.replace(/[#*_`>[\]]/g, "").slice(0, 320)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1 text-xs text-muted-2">
                <span>Saved {formatDate(a.createdAt)}</span>
                <span className="mx-1 text-border-strong">·</span>
                <button
                  type="button"
                  className={act}
                  onClick={() => copy(a.answer)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className={act}
                  onClick={() => exportMd(a)}
                >
                  Export .md
                </button>
                {a.sourceHref && (
                  <Link href={a.sourceHref} className={act}>
                    Open source
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => void remove(a.id)}
                aria-label="Delete saved answer"
                title="Delete"
                className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-2 transition-colors hover:bg-border hover:text-foreground"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
