import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../src/components/AppShell.tsx", import.meta.url),
  "utf8",
);

test("navigation exposes active state and mutually exclusive chrome", () => {
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(source, /inert=\{!searchActive \|\| undefined\}/);
  assert.match(source, /inert=\{searchActive \|\| undefined\}/);
  assert.match(source, /aria-label="Primary"/);
});

test("desktop collapse is persistent and accessible", () => {
  assert.match(
    source,
    /useLayoutEffect\(\(\) => \{[\s\S]*localStorage\.getItem\(COLLAPSE_KEY\)/,
  );
  assert.match(source, /localStorage\.setItem\(COLLAPSE_KEY/);
  assert.match(source, /aria-expanded=\{!collapsed\}/);
  assert.match(source, /aria-controls="desktop-sidebar"/);
});

test("mobile drawer has complete modal keyboard behavior", () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key === "Tab"/);
  assert.match(source, /visibleFocusables = \(\) =>/);
  assert.match(source, /addEventListener\("focusin", containFocus\)/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /drawerTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /mainContentRef\.current\?\.focus\(\)/);
  assert.match(source, /onClick=\{closeDrawerToTrigger\}/);
  assert.match(source, /matchMedia\("\(min-width: 1024px\)"\)/);
  assert.match(source, /motion-reduce:transition-none/);
});

test("mobile navigation stays compact and matches route boundaries", () => {
  assert.match(
    source,
    /path === href \|\| \(href !== "\/" && path\.startsWith\(`\$\{href\}\/`\)\)/,
  );
  assert.match(source, /className="inline-flex[^"\n]*lg:hidden"/);
  assert.match(source, /className=\{`hidden items-center gap-1/);
});
