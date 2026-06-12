import type { Metadata } from "next";
import { Geist_Mono, Google_Sans_Flex, Lora } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans_Flex({
  variable: "--font-google-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lawbook — Singapore Legal Research",
  description:
    "Search Singapore judgments, statutes, subsidiary legislation, Hansard, bills and practice directions across the Lawbook legal corpus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${googleSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface-2/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2.5">
          <BrandMark className="h-6 w-6" />
          <span>
            <span className="font-semibold text-foreground">Lawbook</span> — a
            read-only projection of the Singapore legal corpus.
          </span>
        </p>
        <p className="text-xs text-muted-2">
          Not legal advice. Data via{" "}
          <span className="font-mono">backend.lawplain.com</span>
        </p>
      </div>
    </footer>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <rect x="10" y="10" width="76" height="76" rx="18" fill="#18181B" />
      <path
        d="M26 39C35 39 42 41.5 48 46V68C42.2 63.8 35 61.5 26 61.5V39Z"
        fill="#FAFAFA"
      />
      <path
        d="M70 39C61 39 54 41.5 48 46V68C53.8 63.8 61 61.5 70 61.5V39Z"
        fill="#FAFAFA"
      />
      <path
        d="M48 45.5V69"
        stroke="#0088FF"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        d="M33 31H63"
        stroke="#0088FF"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M48 26V36"
        stroke="#0088FF"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx="33" cy="31" r="2.8" fill="#0088FF" />
      <circle cx="63" cy="31" r="2.8" fill="#0088FF" />
      <path
        d="M32 49H40"
        stroke="#18181B"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M56 49H64"
        stroke="#18181B"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
