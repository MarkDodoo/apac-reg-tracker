"use client";

/**
 * Featured-stories carousel for the idle homepage — gives the page a "front
 * page" moment instead of opening cold on a bare search box. Auto-rotates,
 * but respects prefers-reduced-motion and ships a pause control (WCAG 2.2.2:
 * auto-moving content needs a way to stop it).
 */

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/icons";

export interface CarouselHit {
  id: string;
  title: string;
  source: string;
  url: string;
  published_date: string | null;
  summary?: string | null;
  sentiment_label?: string | null;
  impact_level?: string | null;
}

const SENTIMENT_DOT: Record<string, string> = {
  Facilitative: "bg-[#2a78d6]",
  Neutral: "bg-[#898781]",
  Restrictive: "bg-[#e34948]",
};

const ROTATE_MS = 6500;

function formatDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function NewsCarousel({ items }: { items: CarouselHit[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    setPlaying(!mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const advance = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + items.length) % items.length);
    },
    [items.length],
  );

  useEffect(() => {
    if (!playing || hovered || items.length <= 1) return;
    const timer = setInterval(() => advance(1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [playing, hovered, items.length, advance]);

  if (items.length === 0) return null;
  const active = items[index];

  return (
    <section
      aria-label="Featured regulatory developments"
      className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={active.url}
        target="_blank"
        rel="noreferrer"
        className="block px-5 py-5 sm:px-7 sm:py-6"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">
            {active.source}
          </span>
          {active.published_date && (
            <span>{formatDate(active.published_date)}</span>
          )}
          {active.sentiment_label && (
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${
                  SENTIMENT_DOT[active.sentiment_label] ?? "bg-border"
                }`}
              />
              {active.sentiment_label}
            </span>
          )}
          {active.impact_level && <span>{active.impact_level} impact</span>}
        </div>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground sm:text-xl">
          {active.title}
        </h2>
        {active.summary && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {active.summary}
          </p>
        )}
      </a>

      {items.length > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => advance(-1)}
              aria-label="Previous story"
              className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => advance(1)}
              aria-label="Next story"
              className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <div
            className="flex items-center gap-1.5"
            role="tablist"
            aria-label="Stories"
          >
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Story ${i + 1} of ${items.length}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-accent"
                    : "w-1.5 bg-border-strong hover:bg-muted-2"
                }`}
              />
            ))}
          </div>

          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={
                playing ? "Pause auto-rotation" : "Resume auto-rotation"
              }
              className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {playing ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
