import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("quote paths only accept real internal judgment and statute routes", async () => {
  const { normalizeInternalPath } = await import("../src/lib/internal-path.ts");
  assert.equal(
    normalizeInternalPath("/judgment/SGCA-1#orders"),
    "/judgment/SGCA-1#orders",
  );
  assert.equal(
    normalizeInternalPath("/statute/Cap-1?view=all#s-2"),
    "/statute/Cap-1?view=all#s-2",
  );
  for (const path of [
    "//evil.example/judgment/x",
    "https://evil.example/judgment/x",
    "/judgment\\evil.example/x",
    "/judgment/%5cevil",
    "/judgment/x%0aevil",
    "/judgment/x\nLocation: evil",
    "/saved",
  ]) {
    assert.equal(normalizeInternalPath(path), null, path);
  }
});

test("soft-deleted quotes are hidden and restorable only inside the deadline", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE user (id TEXT PRIMARY KEY)");
  db.exec(read("migrations/0017_saved_quotes.sql"));
  db.prepare("INSERT INTO user (id) VALUES (?)").run("owner");
  db.prepare(`INSERT INTO saved_quotes VALUES
    (?, ?, 'judgment', 'doc', 'text', 'title', 'cite', '/judgment/doc',
     'p-1', 0, 4, '', '', 1, NULL)`).run("quote", "owner");

  const deletedAt = 20_000;
  const deleted = db
    .prepare(
      "UPDATE saved_quotes SET deletedAt = ? WHERE userId = ? AND id = ? AND deletedAt IS NULL RETURNING id",
    )
    .get(deletedAt, "owner", "quote");
  assert.equal(deleted.id, "quote");
  assert.equal(
    db
      .prepare(
        "SELECT id FROM saved_quotes WHERE userId = ? AND deletedAt IS NULL",
      )
      .get("owner"),
    undefined,
  );
  assert.equal(
    db
      .prepare(
        "UPDATE saved_quotes SET deletedAt = NULL WHERE userId = ? AND id = ? AND deletedAt >= ? RETURNING id",
      )
      .get("other", "quote", 10_000),
    undefined,
  );
  assert.equal(
    db
      .prepare(
        "UPDATE saved_quotes SET deletedAt = NULL WHERE userId = ? AND id = ? AND deletedAt >= ? RETURNING id",
      )
      .get("owner", "quote", 10_000).id,
    "quote",
  );
  db.prepare("UPDATE saved_quotes SET deletedAt = ? WHERE id = ?").run(
    deletedAt,
    "quote",
  );
  assert.equal(
    db
      .prepare(
        "UPDATE saved_quotes SET deletedAt = NULL WHERE userId = ? AND id = ? AND deletedAt >= ? RETURNING id",
      )
      .get("owner", "quote", 20_001),
    undefined,
  );

  db.prepare(`INSERT INTO saved_quotes VALUES
    (?, ?, 'judgment', 'doc', 'text', 'title', 'cite', '/judgment/doc',
     'p-1', 0, 4, '', '', 2, NULL)`).run("replacement", "owner");
  const conflictSafeRestore = db
    .prepare(`UPDATE saved_quotes SET deletedAt = NULL
      WHERE userId = ? AND id = ? AND deletedAt >= ?
        AND NOT EXISTS (
          SELECT 1 FROM saved_quotes AS active
          WHERE active.userId = saved_quotes.userId
            AND active.docType = saved_quotes.docType
            AND active.docId = saved_quotes.docId
            AND active.anchor = saved_quotes.anchor
            AND active.startOffset = saved_quotes.startOffset
            AND active.endOffset = saved_quotes.endOffset
            AND active.exactText = saved_quotes.exactText
            AND active.deletedAt IS NULL
        )
      RETURNING id`)
    .get("owner", "quote", 10_000);
  assert.equal(conflictSafeRestore, undefined);
  assert.equal(
    db
      .prepare(
        "SELECT id FROM saved_quotes WHERE userId = ? AND deletedAt IS NULL",
      )
      .get("owner").id,
    "replacement",
  );
});

test("quotes are owner scoped, bounded, soft-deleted, and payload-free on restore", () => {
  const route = read("src/app/api/quotes/route.ts");
  const itemRoute = read("src/app/api/quotes/[id]/route.ts");
  const model = read("src/lib/saved-quotes.ts");
  assert.match(route, /getSession\(req\.headers\)/);
  assert.doesNotMatch(route, /body\.userId/);
  assert.match(itemRoute, /restoreSavedQuote\(session\.user\.id, id\)/);
  assert.doesNotMatch(itemRoute, /req\.json/);
  assert.match(model, /MAX_QUOTE_LENGTH = 5_000/);
  assert.match(model, /deletedAt IS NULL/);
  assert.match(model, /deletedAt >= \?/);
  assert.match(model, /RETURNING id/);
});

test("selection tools use one anchored block and keep guest Copy available", () => {
  const source = read("src/components/SelectionTools.tsx");
  assert.match(source, /startBlock !== endBlock/);
  assert.match(source, /selectNodeContents\(startBlock\)/);
  assert.match(source, /contextBefore/);
  assert.match(source, /saving/);
  assert.match(source, /Create account/);
  assert.match(source, /Copy quote with citation and link/);
  assert.match(source, /\.slice\([\s\S]*0,[\s\S]*5_500/);
});

test("saved workspace includes quote and search management without discarded result sets", () => {
  const page = read("src/app/saved/page.tsx");
  const searches = read("src/components/SavedSearchHistory.tsx");
  const quotes = read("src/components/SavedQuotes.tsx");
  assert.match(page, /SavedQuotes/);
  assert.match(page, /SavedSearchHistory/);
  assert.match(searches, /replayPath/);
  assert.match(searches, /Clear all/);
  assert.doesNotMatch(searches, /result set/i);
  assert.match(quotes, /aria-live="polite"/);
  assert.match(quotes, /method: "POST"/);
  assert.doesNotMatch(quotes, /JSON\.stringify\(quote\)/);
});
