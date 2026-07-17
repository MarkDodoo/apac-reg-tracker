import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  BookIcon,
  HistoryIcon,
  SearchIcon,
  SparkleIcon,
} from "@/components/icons";
import { getSession } from "@/lib/auth";
import { safeContinuationPath } from "@/lib/auth-callback";
import {
  getOnboardingState,
  needsOnboarding,
  OnboardingUserNotFoundError,
} from "@/lib/onboarding";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Welcome",
  description:
    "Get started with your APAC Regulation Tracker legal research workspace.",
  path: "/welcome",
  noIndex: true,
});

type WelcomePageProps = { searchParams: Promise<{ next?: string | string[] }> };

const features = [
  {
    title: "Search legal materials",
    description:
      "Find Singapore judgments, legislation, and other legal materials.",
    icon: SearchIcon,
  },
  {
    title: "Ask RegTracker",
    description:
      "Ask a legal research question and get an answer with citations.",
    icon: SparkleIcon,
  },
  {
    title: "Keep your research",
    description:
      "Save documents, answers, searches, and passages in one workspace.",
    icon: BookIcon,
  },
  {
    title: "Pick up where you left off",
    description: "Recents happen automatically as you view legal materials.",
    icon: HistoryIcon,
  },
];

function ActionForm({
  action,
  next,
  children,
  secondary = false,
}: {
  action: "search" | "ask" | "saved";
  next: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <form action="/api/onboarding" method="post">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className={
          secondary
            ? "w-full rounded-xl border border-border-strong bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
            : "w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90"
        }
      >
        {children}
      </button>
    </form>
  );
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? null : (params.next ?? null);
  const next = safeContinuationPath(nextValue);
  const session = await getSession(await headers());

  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const state = await getOnboardingState(session).catch((error) => {
    if (error instanceof OnboardingUserNotFoundError) notFound();
    throw error;
  });
  if (!needsOnboarding(state)) redirect(next);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          Your research workspace
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Welcome to APAC Regulation Tracker
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted">
          Search Singapore law, ask cited research questions, and keep the
          useful parts together.
        </p>
      </header>

      <ul
        className="mt-10 grid gap-4 sm:grid-cols-2"
        aria-label="What you can do"
      >
        {features.map(({ title, description, icon: Icon }) => (
          <li
            key={title}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <Icon className="h-6 w-6 text-accent" />
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="welcome-actions"
        className="mx-auto mt-10 max-w-2xl"
      >
        <h2
          id="welcome-actions"
          className="text-center text-sm font-semibold text-foreground"
        >
          Where would you like to begin?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ActionForm action="search" next={next}>
            Search Singapore law
          </ActionForm>
          <ActionForm action="ask" next={next} secondary>
            Ask a question
          </ActionForm>
          <ActionForm action="saved" next={next} secondary>
            Saved workspace
          </ActionForm>
        </div>
        <form
          action="/api/onboarding"
          method="post"
          className="mt-5 text-center"
        >
          <input type="hidden" name="action" value="skip" />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="text-sm font-medium text-muted underline decoration-border-strong underline-offset-4 hover:text-foreground"
          >
            Skip for now
          </button>
        </form>
      </section>
    </main>
  );
}
