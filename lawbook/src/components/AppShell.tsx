"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthMenu } from "@/components/AuthMenu";
import { useChrome } from "@/components/chrome/ChromeContext";
import { BookIcon, SearchIcon, SparkleIcon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";

const NAV = [
  {
    href: "/",
    label: "Search",
    icon: SearchIcon,
    match: (p: string) => p === "/",
  },
  {
    href: "/ask",
    label: "Ask Lawplain",
    icon: SparkleIcon,
    match: (p: string) => p.startsWith("/ask"),
  },
  {
    href: "/saved",
    label: "Saved",
    icon: BookIcon,
    match: (p: string) => p.startsWith("/saved"),
  },
];

const EASE = "duration-500 ease-[var(--ease-emphasized)]";

/**
 * App chrome. Idle: a top header bar. As search becomes active the header
 * gracefully collapses and the same navigation slides in as a left sidebar
 * (shadcn-style), and the content shifts to make room. A slim icon rail on
 * mobile keeps the behaviour consistent on small screens.
 */
export function AppShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const { searchActive } = useChrome();
  const pathname = usePathname();

  return (
    <>
      <header
        className={`sticky top-0 z-40 overflow-hidden bg-background/80 backdrop-blur-md transition-all ${EASE} ${
          searchActive
            ? "max-h-0 border-b border-transparent opacity-0"
            : "max-h-24 border-b border-border opacity-100"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="font-serif text-lg font-medium tracking-tight text-foreground">
              Lawplain<span className="text-accent">.</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((tab) => {
              const active = tab.match(pathname);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-muted-2 hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
            <AuthMenu />
          </nav>
        </div>
      </header>

      <aside
        aria-hidden={!searchActive}
        className={`fixed inset-y-0 left-0 z-50 flex w-16 flex-col border-r border-border bg-background transition-transform ${EASE} lg:w-60 ${
          searchActive ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center px-3 lg:px-4">
          <Link
            href="/"
            className="font-serif text-xl font-medium tracking-tight text-foreground"
          >
            <span className="lg:hidden">L</span>
            <span className="hidden lg:inline">Lawplain</span>
            <span className="text-accent">.</span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2 lg:px-3">
          {NAV.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.label}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-2 hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden truncate lg:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-2 lg:p-3">
          <SidebarAuth />
        </div>
      </aside>

      <div
        className={`flex min-h-0 flex-1 flex-col transition-[padding] ${EASE} ${
          searchActive ? "pl-16 lg:pl-60" : ""
        }`}
      >
        <div className="flex min-h-0 flex-1">{children}</div>
        {footer}
      </div>
    </>
  );
}

function SidebarAuth() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const next = encodeURIComponent(pathname || "/");

  if (isPending) {
    return <div className="px-2.5 py-2 text-sm text-muted-2">…</div>;
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col gap-1">
        <Link
          href={`/sign-in?next=${next}`}
          title="Sign in"
          className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-2 transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <UserIcon className="h-5 w-5 shrink-0" />
          <span className="hidden lg:inline">Sign in</span>
        </Link>
        <Link
          href={`/sign-up?next=${next}`}
          className="hidden rounded-lg bg-foreground px-2.5 py-2 text-center text-sm font-medium text-primary-fg transition-opacity hover:opacity-90 lg:block"
        >
          Create account
        </Link>
      </div>
    );
  }

  const username =
    (session.user as { username?: string; name?: string }).username ??
    session.user.name;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="hidden min-w-0 truncate text-sm font-medium text-muted lg:inline">
        {username}
      </span>
      <button
        type="button"
        onClick={() => void authClient.signOut()}
        title="Sign out"
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-2 transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <LogoutIcon className="h-5 w-5 shrink-0" />
        <span className="hidden lg:inline">Sign out</span>
      </button>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
