import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { buildMetadata } from "@/lib/seo";
import { getServerSocialProviderAvailability } from "@/lib/social-provider-env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Create Account",
  description: "Create a Lawplain account for saved Singapore legal research.",
  path: "/sign-up",
  noIndex: true,
});

export default async function SignUpPage() {
  const socialProviders = await getServerSocialProviderAvailability();

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 items-center px-5 py-6 sm:px-8">
      <Suspense>
        <AuthForm mode="sign-up" socialProviders={socialProviders} />
      </Suspense>
    </main>
  );
}
