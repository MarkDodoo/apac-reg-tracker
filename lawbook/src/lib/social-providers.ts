export type SocialProvider = "google";
export type SocialProviderAvailability = Record<SocialProvider, boolean>;

type SocialProviderEnv = Partial<
  Record<"GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET", string>
>;

export function getSocialProviderConfiguration(
  env: SocialProviderEnv,
  warn: (message: string) => void = console.warn,
) {
  const providers: Partial<
    Record<SocialProvider, { clientId: string; clientSecret: string }>
  > = {};
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (clientId && clientSecret) {
    providers.google = { clientId, clientSecret };
  } else if (clientId || clientSecret) {
    warn(
      "OAuth provider google is omitted because its credential pair is incomplete.",
    );
  }

  return providers;
}

export function getSocialProviderAvailability(
  env: SocialProviderEnv,
  warn?: (message: string) => void,
): SocialProviderAvailability {
  const providers = getSocialProviderConfiguration(env, warn);
  return { google: Boolean(providers.google) };
}
