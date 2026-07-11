import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildWelcomePath,
  safeContinuationPath,
} from "../src/lib/auth-callback.ts";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("migration backfills existing users while new users retain onboarding defaults", () => {
  const directory = mkdtempSync(join(tmpdir(), "lawplain-onboarding-"));
  const database = join(directory, "test.sqlite");
  try {
    execFileSync("sqlite3", [database], {
      input: `${read("migrations/0001_better_auth.sql")}\nINSERT INTO user (id,name,email,createdAt,updatedAt) VALUES ('old','Old','old@example.com',1,1);\n${read("migrations/0018_user_onboarding.sql")}\nINSERT INTO user (id,name,email,createdAt,updatedAt) VALUES ('new','New','new@example.com',2,2);`,
    });
    const rows = execFileSync(
      "sqlite3",
      [
        "-separator",
        "|",
        database,
        "SELECT id,onboardingVersion,coalesce(onboardingStatus,'NULL') FROM user ORDER BY id",
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    assert.deepEqual(rows, ["new|0|NULL", "old|1|skipped"]);
    assert.throws(() =>
      execFileSync("sqlite3", [
        database,
        "UPDATE user SET onboardingStatus='later' WHERE id='new'",
      ]),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("continuations reject hostile URLs and onboarding/auth loops", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/welcome",
    "/welcome?next=/saved",
    "/sign-in",
    "/sign-up/path",
    "/api/auth/callback/google",
  ]) {
    assert.equal(safeContinuationPath(value), "/", value);
  }
  assert.equal(safeContinuationPath("/saved?tab=quotes"), "/saved?tab=quotes");
  assert.equal(
    buildWelcomePath("/saved?tab=quotes"),
    "/welcome?next=%2Fsaved%3Ftab%3Dquotes",
  );
});

test("welcome page and endpoint are authenticated, owner-scoped, and terminal", () => {
  const page = read("src/app/welcome/page.tsx");
  const route = read("src/app/api/onboarding/route.ts");
  const onboarding = read("src/lib/onboarding.ts");

  assert.match(page, /getSession\(await headers\(\)\)/);
  assert.match(page, /getOnboardingState\(session\)/);
  assert.match(page, /Search legal materials/);
  assert.match(page, /cited research questions/);
  assert.match(page, /documents, answers, searches, and passages/);
  assert.match(page, /Recents happen automatically/);
  assert.match(route, /getSession\(request\.headers\)/);
  assert.match(route, /await finishOnboarding\(session, result\.status\)/);
  assert.doesNotMatch(route, /form\.get\(["']userId/);
  assert.match(onboarding, /WHERE id = \?/);
  assert.match(onboarding, /session\.user\.id/);
  assert.match(onboarding, /onboardingStatus IS NULL/);
  assert.match(onboarding, /onboardingVersion < \?/);
});

test("exact same-origin is the onboarding CSRF control", async () => {
  const { hasSameOrigin } = await import("../src/lib/onboarding-request.ts");
  assert.equal(
    hasSameOrigin("https://lawplain.sg/api/onboarding", "https://lawplain.sg"),
    true,
  );
  for (const origin of [
    null,
    "not a url",
    "https://evil.example",
    "https://lawplain.sg/",
    "https://lawplain.sg/path",
  ])
    assert.equal(
      hasSameOrigin("https://lawplain.sg/api/onboarding", origin),
      false,
    );
});

test("onboarding actions derive status and allowlisted destinations", async () => {
  const { onboardingResult } = await import("../src/lib/onboarding-request.ts");
  assert.deepEqual(onboardingResult("search", "/saved"), {
    status: "completed",
    destination: "/?focus=search",
  });
  assert.deepEqual(onboardingResult("saved", "/ask/thread"), {
    status: "completed",
    destination: "/saved",
  });
  assert.deepEqual(onboardingResult("ask", "/ask/thread?draft=1"), {
    status: "completed",
    destination: "/ask/thread?draft=1",
  });
  assert.deepEqual(onboardingResult("ask", "/asking"), {
    status: "completed",
    destination: "/ask",
  });
  assert.deepEqual(onboardingResult("skip", "/saved?tab=quotes"), {
    status: "skipped",
    destination: "/saved?tab=quotes",
  });
  assert.deepEqual(
    onboardingResult("skip", safeContinuationPath("/welcome?next=/saved")),
    { status: "skipped", destination: "/" },
  );
});

test("SQLite conditional updates model changed, terminal, missing, and conflict outcomes", () => {
  const directory = mkdtempSync(join(tmpdir(), "lawplain-onboarding-update-"));
  const database = join(directory, "test.sqlite");
  try {
    execFileSync("sqlite3", [database], {
      input: `CREATE TABLE user (id TEXT PRIMARY KEY, onboardingVersion INTEGER NOT NULL, onboardingStatus TEXT); INSERT INTO user VALUES ('fresh',0,NULL),('terminal',1,'completed'),('conflict',0,NULL); CREATE TRIGGER stale_tab BEFORE UPDATE ON user WHEN OLD.id='conflict' BEGIN SELECT RAISE(IGNORE); END;`,
    });
    const update = (id) =>
      execFileSync(
        "sqlite3",
        [
          database,
          `UPDATE user SET onboardingVersion=1,onboardingStatus='skipped' WHERE id='${id}' AND onboardingStatus IS NULL AND onboardingVersion<1; SELECT changes();`,
        ],
        { encoding: "utf8" },
      ).trim();
    assert.equal(update("fresh"), "1");
    assert.equal(update("terminal"), "0");
    assert.equal(update("missing"), "0");
    assert.equal(update("conflict"), "0");
    const states = execFileSync(
      "sqlite3",
      [
        "-separator",
        "|",
        database,
        "SELECT id,onboardingVersion,coalesce(onboardingStatus,'NULL') FROM user ORDER BY id",
      ],
      { encoding: "utf8" },
    );
    assert.match(states, /fresh\|1\|skipped/);
    assert.match(states, /terminal\|1\|completed/);
    assert.match(states, /conflict\|0\|NULL/);
    assert.equal(
      execFileSync(
        "sqlite3",
        [database, "SELECT count(*) FROM user WHERE id='missing'"],
        { encoding: "utf8" },
      ).trim(),
      "0",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
