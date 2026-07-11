import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Google OAuth preserves a safe post-auth destination", () => {
  const form = read("src/components/AuthForm.tsx");

  assert.match(form, /authClient\.signIn\.social/);
  assert.match(form, /onSocialSignIn\("google"\)/);
  assert.match(
    form,
    /callbackURL: new URL\([\s\S]*buildWelcomePath\(next\)[\s\S]*window\.location\.origin/,
  );
  assert.match(form, /Continue with Google/);
  assert.match(form, /socialLoading === "google"/);
  assert.doesNotMatch(form, /GitHub|"github"/);
  assert.match(form, /`\$\{providerName\} sign-in failed/);
});

test("Google OAuth is enabled only by a complete credential pair", () => {
  const auth = read("src/lib/auth.ts");

  assert.match(auth, /GOOGLE_CLIENT_ID/);
  assert.match(auth, /GOOGLE_CLIENT_SECRET/);
  assert.match(auth, /getSocialProviderConfiguration/);
  assert.match(auth, /GOOGLE_CLIENT_ID: googleClientId/);
  assert.doesNotMatch(auth, /GITHUB_/);
  assert.match(
    auth,
    /Object\.keys\(socialProviders\)\.length > 0 \? socialProviders : undefined/,
  );
});

test("OAuth pages resolve provider availability at request time", () => {
  const signIn = read("src/app/sign-in/page.tsx");
  const signUp = read("src/app/sign-up/page.tsx");

  for (const page of [signIn, signUp]) {
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.match(page, /getServerSocialProviderAvailability/);
  }
});

test("OAuth identity handling does not opt into unsafe account merging", () => {
  const auth = read("src/lib/auth.ts");

  assert.doesNotMatch(auth, /allowDifferentEmails/);
  assert.doesNotMatch(auth, /trustedProviders/);
  assert.doesNotMatch(auth, /accountLinking/);
});

test("sign-in checks username registration before password auth", () => {
  const form = read("src/components/AuthForm.tsx");
  const route = read("src/app/api/account-exists/route.ts");

  assert.match(form, /async function accountExists/);
  assert.match(form, /\/api\/account-exists\?username=/);
  assert.match(form, /authClient\.signIn\.username/);
  assert.match(route, /lower\(username\) = lower\(\?\) OR email = \?/);
  assert.match(route, /getAuthDb/);
});

test("unregistered sign-in shows a create account link", () => {
  const form = read("src/components/AuthForm.tsx");

  assert.match(form, /kind: "unregistered"/);
  assert.match(form, /No account found for/);
  assert.match(form, /\/sign-up\?next=/);
  assert.match(form, /Create an account/);
});

test("username sign-in never exposes Internal Server Error to users", () => {
  const form = read("src/components/AuthForm.tsx");
  const route = read("src/app/api/auth/[...all]/route.ts");

  assert.match(form, /isInternalServerError/);
  assert.match(form, /Invalid username or password/);
  assert.match(route, /isUsernameSignIn/);
  assert.match(route, /invalidCredentialsResponse/);
  assert.match(route, /response\.status >= 500/);
});

test("sign-up checks username availability and links existing users to sign in", () => {
  const form = read("src/components/AuthForm.tsx");

  assert.match(form, /const exists = await accountExists\(cleanUsername\)/);
  assert.match(form, /kind: "registered"/);
  assert.match(form, /Username .* is already in use/);
  assert.match(form, /\/sign-in\?next=/);
  assert.match(form, /Sign in instead/);
});

test("sign-up explains username and password requirements instead of generic credentials errors", () => {
  const form = read("src/components/AuthForm.tsx");

  assert.match(form, /const USERNAME_MIN_LENGTH = 3/);
  assert.match(form, /const USERNAME_MAX_LENGTH = 30/);
  assert.match(form, /const PASSWORD_MIN_LENGTH = 8/);
  assert.match(form, /const PASSWORD_MAX_LENGTH = 128/);
  assert.match(form, /function usernameRequirementError/);
  assert.match(form, /function passwordRequirementError/);
  assert.match(form, /Username must be between/);
  assert.match(form, /letters, numbers, underscores, and periods/);
  assert.match(form, /Password must be at least/);
  assert.match(form, /Password must be .* characters or fewer/);
});

test("sign-up account-check failures are explicit and actionable", () => {
  const form = read("src/components/AuthForm.tsx");
  const route = read("src/app/api/account-exists/route.ts");

  assert.match(form, /usernameCheckFailed = exists === null/);
  assert.match(form, /kind: "check-failed"/);
  assert.match(form, /couldn't check whether/);
  assert.match(form, /signing in/);
  assert.match(route, /ACCOUNT_CHECK_FAILED/);
  assert.match(route, /status: 503/);
});

test("successful username auth uses the shared onboarding continuation", () => {
  const form = read("src/components/AuthForm.tsx");

  assert.match(form, /buildWelcomePath\(next\)/);
  assert.match(form, /router\.replace\(buildWelcomePath\(next\)\)/);
  assert.match(form, /router\.refresh\(\)/);
  assert.doesNotMatch(
    form,
    /authenticatedUsername|authentication-success-title/,
  );
});
