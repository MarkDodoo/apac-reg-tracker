import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { getServerSocialProviderAvailability } from "@/lib/social-provider-env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Sign In",
  description: "Sign in to your Lawplain research workspace.",
  path: "/sign-in",
  noIndex: true,
});

export default async function SignInPage() {
  const socialProviders = await getServerSocialProviderAvailability();

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center px-5 py-6 sm:px-8">
      <Suspense>
        <AuthForm mode="sign-in" socialProviders={socialProviders} />
      </Suspense>
    </main>
  );
}
