import Link from "next/link";
import { SparkleIcon } from "@/components/icons";
import { SearchExplorer } from "@/components/SearchExplorer";
import { type StatsResponse, sgjudge } from "@/lib/sgjudge";

const CORPUS_LABELS: Record<string, string> = {
  judgments: "Judgments",
  statutes: "Statutes",
  statute_sections: "Statute Sections",
  subsidiary_legislation: "Subsidiary Leg.",
  hansard_speeches: "Hansard Speeches",
  bills: "Bills",
  practice_directions: "Practice Directions",
  commentary: "Commentary",
};

async function getStats(): Promise<StatsResponse | null> {
  try {
    // Fresh each request; the corpus is small and updated out-of-band.
    return await sgjudge.stats({ cache: "no-store" });
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const [{ tab, q }, stats] = await Promise.all([searchParams, getStats()]);

  const courts = (stats?.judgments_by_court ?? [])
    .slice()
    .sort((a, b) => b.n - a.n)
    .map((c) => c.court);

  const counts = stats?.counts ?? {};
  const countEntries = Object.entries(counts).filter(([, n]) => n > 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      {/* Brand — Google-style minimal landing */}
      <section className="pt-20 pb-10 sm:pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-5xl font-medium tracking-tight text-foreground sm:text-7xl">
            Lawplain<span className="text-accent">.</span>
          </h1>
          <p className="mt-3 text-sm font-semibold tracking-tight text-muted sm:text-base">
            Search Singapore judgments, statutes, Hansard &amp; more
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="mx-auto max-w-2xl pb-6">
        <SearchExplorer
          courts={courts}
          initialTab={tab ?? "judgments"}
          initialQuery={q ?? ""}
        />
      </section>

      {/* Agent — compact CTA to the dedicated /ask page */}
      <section className="mx-auto max-w-2xl pb-6">
        <Link
          href="/ask"
          className="group flex items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-primary-fg">
            <SparkleIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              Ask Lawplain
            </span>
            <span className="block text-xs text-muted-2">
              Natural-language research — an agent searches the corpus for you.
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-accent">
            Ask →
          </span>
        </Link>
      </section>

      {/* One quiet stats line, Google-footer style */}
      {countEntries.length > 0 && (
        <p className="mx-auto max-w-3xl pb-12 pt-10 text-center text-xs leading-relaxed text-muted-2">
          {countEntries.map(([key, n], i) => (
            <span key={key}>
              {i > 0 && <span className="mx-1.5 text-border-strong">·</span>}
              <span className="font-medium tabular-nums text-muted">
                {n.toLocaleString()}
              </span>{" "}
              {CORPUS_LABELS[key] ?? key}
            </span>
          ))}
        </p>
      )}
    </main>
  );
}
