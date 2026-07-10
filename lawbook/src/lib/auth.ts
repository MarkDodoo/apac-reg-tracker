import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins/username";
import { getAuthDb } from "@/lib/d1";

interface AuthVars extends CloudflareEnv {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

function getTrustedOrigins(authUrl?: string, trustedOrigins?: string) {
  return Array.from(
    new Set(
      [
        authUrl,
        ...(trustedOrigins ?? "")
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
        ...(process.env.NODE_ENV === "development"
          ? [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:3002",
              "http://127.0.0.1:3000",
              "http://127.0.0.1:3001",
              "http://127.0.0.1:3002",
            ]
          : []),
      ].filter((origin): origin is string => Boolean(origin)),
    ),
  );
}

export async function getAuth() {
  const authDb = await getAuthDb();
  const { env } = await getCloudflareContext({ async: true });
  const authVars = env as AuthVars;
  const authSecret =
    authVars.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  const authUrl = authVars.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL;
  const trustedOrigins =
    authVars.BETTER_AUTH_TRUSTED_ORIGINS ??
    process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  const googleClientId =
    authVars.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret =
    authVars.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: "Lawplain",
    secret: authSecret,
    baseURL: authUrl,
    trustedOrigins: () => getTrustedOrigins(authUrl, trustedOrigins),
    database: authDb,
    advanced: {
      disableCSRFCheck: authUrl?.includes("localhost") === true,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : undefined,
    plugins: [username()],
  });
}

export async function getSession(headers: Headers) {
  const auth = await getAuth();
  return auth.api.getSession({ headers });
}
