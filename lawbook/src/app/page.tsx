import type { Metadata } from "next";
import { HomeShell } from "@/components/HomeShell";
import { buildMetadata, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/seo";
import { type StatsResponse, sgjudge } from "@/lib/sgjudge";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}): Promise<Metadata> {
  const { tab, q } = await searchParams;
  const hasQueryVariant = Boolean(tab || q?.trim());

  return buildMetadata({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
    noIndex: hasQueryVariant,
    noIndexFollow: hasQueryVariant,
  });
}

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
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-5 sm:px-8">
      <HomeShell
        courts={courts}
        initialTab={tab ?? "judgments"}
        initialQuery={q ?? ""}
        stats={
          countEntries.length > 0 ? (
            <p className="mx-auto max-w-3xl pb-4 text-center text-xs leading-relaxed text-muted-2">
              {countEntries.map(([key, n], i) => (
                <span key={key}>
                  {i > 0 && (
                    <span className="mx-1.5 text-border-strong">·</span>
                  )}
                  <span className="font-medium tabular-nums text-muted">
                    {n.toLocaleString()}
                  </span>{" "}
                  {CORPUS_LABELS[key] ?? key}
                </span>
              ))}
            </p>
          ) : null
        }
      />
    </main>
  );
}
