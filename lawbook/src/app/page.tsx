import type { Metadata } from "next";
import { HomeShell } from "@/components/HomeShell";
import { regTrackerApiUrl } from "@/lib/reg-agent";
import { buildMetadata, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/seo";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const hasQueryVariant = Boolean(q?.trim());

  return buildMetadata({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
    noIndex: hasQueryVariant,
    noIndexFollow: hasQueryVariant,
  });
}

interface RegStats {
  total: number;
  enriched: number;
  by_source: Record<string, number>;
}

async function getStats(): Promise<RegStats | null> {
  const base = regTrackerApiUrl();
  if (!base) return null;
  try {
    const res = await fetch(new URL("/v1/stats", base), {
      signal: AbortSignal.timeout(2_500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as RegStats;
  } catch {
    return null;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, stats] = await Promise.all([searchParams, getStats()]);

  const sourceEntries = Object.entries(stats?.by_source ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-5 sm:px-8">
      <HomeShell
        initialQuery={q ?? ""}
        stats={
          stats && stats.total > 0 ? (
            <p className="mx-auto max-w-3xl pb-4 text-center text-xs leading-relaxed text-muted-2">
              <span className="font-medium tabular-nums text-muted">
                {stats.total.toLocaleString()}
              </span>{" "}
              documents
              {sourceEntries.map(([source, n]) => (
                <span key={source}>
                  <span className="mx-1.5 text-border-strong">·</span>
                  <span className="font-medium tabular-nums text-muted">
                    {n.toLocaleString()}
                  </span>{" "}
                  {source}
                </span>
              ))}
            </p>
          ) : null
        }
      />
    </main>
  );
}
