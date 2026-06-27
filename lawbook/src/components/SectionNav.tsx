"use client";

import { type MouseEvent, useEffect, useState } from "react";

export interface SectionNavItem {
  id: string;
  label: string;
  count?: number;
  badge?: string;
}

export function SectionNav({
  items,
  title = "Sections",
}: {
  items: SectionNavItem[];
  title?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = items.map((item) => item.id).join("|");

  // Scroll-spy: highlight the section currently nearest the top of the viewport
  // (issue #9). Anchors live in the document body (judgment spans / statute
  // articles); observe them and pick the highest one inside the top band.
  useEffect(() => {
    const els = ids
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const tops = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            tops.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            tops.delete(entry.target.id);
          }
        }
        let best: string | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const [id, top] of tops) {
          if (top < bestTop) {
            bestTop = top;
            best = id;
          }
        }
        if (best) setActiveId(best);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [ids]);

  if (items.length < 2) return null;

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  return (
    <nav
      aria-label={title}
      className="rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-20 lg:p-3"
    >
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
        {title}
      </h2>
      <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:max-h-[70vh] lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                aria-current={active ? "true" : undefined}
                className={`flex max-w-[12rem] flex-col items-start rounded-md px-2.5 py-1.5 text-xs transition-colors lg:max-w-[14rem] ${
                  active
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <span className="block max-w-full truncate leading-4">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="-ml-1.5 mt-0.5 block max-w-[calc(100%+0.75rem)] truncate rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium leading-3 text-accent">
                    {item.badge}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
