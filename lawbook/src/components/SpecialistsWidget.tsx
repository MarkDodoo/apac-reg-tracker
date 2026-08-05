"use client";

/**
 * "Specialists in your areas" — the broad, always-on referral channel
 * (Xhoni's idea #4), shown wherever a visitor has explicitly indicated a
 * topic: the report questionnaire, or the homepage profile. The narrower,
 * higher-intent channel is the invisible low-confidence trigger on Ask
 * (see rag.py's EXPERT_SUGGESTION_THRESHOLD + reg-agent.ts's
 * expertsFooter) — this widget is the complementary always-visible one.
 * Demo data only; see app/experts.py.
 */

import { useEffect, useState } from "react";

interface Expert {
  id: string;
  name: string;
  bio: string;
  contact_url: string;
  featured: boolean;
}

export function SpecialistsWidget({
  jurisdictions,
  categories,
}: {
  jurisdictions: string[];
  categories: string[];
}) {
  const [experts, setExperts] = useState<Expert[] | null>(null);

  useEffect(() => {
    if (jurisdictions.length === 0 && categories.length === 0) {
      setExperts(null);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      jurisdictions: jurisdictions.join(","),
      categories: categories.join(","),
      limit: "2",
    });
    fetch(`/api/experts?${params}`)
      .then((r) =>
        r.ok ? (r.json() as Promise<{ results?: Expert[] }>) : null,
      )
      .then((d) => {
        if (!cancelled) setExperts(d?.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setExperts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [jurisdictions, categories]);

  if (!experts || experts.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
        Specialists in your areas
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {experts.map((e) => (
          <li key={e.id}>
            <a
              href={e.contact_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-accent hover:underline"
            >
              {e.name}
            </a>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{e.bio}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
