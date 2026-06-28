/**
 * /ask/[id] — a fixed, resumable Lawplain research thread.
 *
 * Same chat surface as /ask, but bound to a saved thread id so the
 * conversation can be linked to and returned to. The client restores the
 * thread (or reconnects to an in-flight run) from the id on mount.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AskAgent } from "@/components/AskAgent";
import { ArrowLeftIcon } from "@/components/icons";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Ask Lawplain",
    description:
      "A saved Lawplain research thread across Singapore judgments, statutes, Hansard, bills and practice directions.",
    path: "/ask",
    noIndex: true,
    noIndexFollow: true,
  });
}

export const dynamic = "force-dynamic";

export default async function AskThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-6 sm:px-8">
      <div className="pt-6 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-2 transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to search
        </Link>
      </div>

      <AskAgent initialThreadId={id} />
    </main>
  );
}
