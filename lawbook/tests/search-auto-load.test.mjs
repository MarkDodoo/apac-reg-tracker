import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalFilterFields,
  canonicalSearchSignature,
  canonicalSearchState,
} from "../src/lib/search-state.js";

const source = readFileSync(
  new URL("../src/components/SearchExplorer.tsx", import.meta.url),
  "utf8",
);

function inboundAction(local, url) {
  const inbound = canonicalSearchState(new URLSearchParams(url));
  return canonicalSearchSignature(
    inbound.tab,
    inbound.query,
    inbound.filters,
  ) === canonicalSearchSignature(local.tab, local.query, local.filters)
    ? "preserve"
    : "apply";
}

test("canonical inbound comparison preserves self-router and non-search updates", () => {
  const local = {
    tab: "judgments",
    query: "  duty of care ",
    filters: { court: " SGCA " },
  };
  assert.equal(
    inboundAction(
      local,
      "focus=search&tab=judgments&q=duty+of+care&court=SGCA",
    ),
    "preserve",
  );
  assert.equal(
    inboundAction(local, "tab=judgments&q=duty+of+care&court=SGCA&unknown=1"),
    "preserve",
  );
  assert.equal(
    inboundAction(local, "tab=statutes&q=duty+of+care&kind=act_current"),
    "apply",
  );
});

test("canonical filter fields preserve collapsed filters without visible duplicates", () => {
  const filters = {
    court: " SGCA ",
    year_range: "2020-2024",
    judge: "Tay",
    since: "",
  };
  assert.deepEqual(canonicalFilterFields(filters), [
    { name: "court", value: "SGCA" },
    { name: "year_range", value: "2020-2024" },
    { name: "judge", value: "Tay" },
  ]);
  assert.deepEqual(canonicalFilterFields(filters, ["court", "judge"]), [
    { name: "year_range", value: "2020-2024" },
  ]);
});

test("search retains debounce, latest-response, IME, native form, and focus support", () => {
  assert.match(source, /const id = \+\+seq\.current/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /id === seq\.current && !controller\.signal\.aborted/);
  assert.match(source, /<form action="\/" method="get"/);
  assert.match(
    source,
    /href=\{`\/\?\$\{buildSearchParams\(t\.id, q, filters\)/,
  );
  assert.match(source, /event\.metaKey \|\|/);
  assert.match(source, /if \(composing\) return/);
  assert.match(source, /onCompositionStart/);
  assert.match(source, /onCompositionEnd/);
  assert.match(source, /params\.get\("focus"\) !== "search"/);
  assert.match(source, /focusedUrl\.current = ""/);
  assert.match(source, /searchInput\.current\?\.focus\(\)/);
});
