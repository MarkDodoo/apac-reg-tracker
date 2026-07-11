import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "../src/lib/auth-callback.ts";
import {
  getSocialProviderAvailability,
  getSocialProviderConfiguration,
} from "../src/lib/social-providers.ts";

test("safeNextPath accepts only same-origin internal callback paths", () => {
  const cases = [
    [null, "/"],
    ["", "/"],
    ["/saved?tab=quotes#latest", "/saved?tab=quotes#latest"],
    ["https://evil.example/path", "/"],
    ["//evil.example/path", "/"],
    ["/\\evil.example", "/"],
    ["/%5cevil.example", "/"],
    ["/%5Cevil.example", "/"],
    ["/%2fevil.example", "/"],
    ["/%252fevil.example", "/"],
    ["/safe%0apath", "/"],
    ["/safe\u0000path", "/"],
    ["/%7f", "/"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(safeNextPath(value), expected, String(value));
  }
});

test("Google provider availability follows its complete credential pair", () => {
  assert.deepEqual(
    getSocialProviderAvailability({
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
    }),
    { google: true },
  );
  assert.deepEqual(getSocialProviderAvailability({}), { google: false });
});

test("an incomplete Google pair is omitted and warned without secrets", () => {
  const warnings = [];
  const providers = getSocialProviderConfiguration(
    { GOOGLE_CLIENT_ID: "visible-id" },
    (message) => warnings.push(message),
  );

  assert.deepEqual(providers, {});
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /google/);
  assert.doesNotMatch(warnings[0], /visible-id/);
});
