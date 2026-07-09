import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("ask history button toggles the thread sidebar", () => {
  const source = read("src/components/AskAgent.tsx");

  assert.match(
    source,
    /const \[sidebarOpen, setSidebarOpen\] = useState\(false\)/,
  );
  assert.match(
    source,
    /onClick=\{\(\) => setSidebarOpen\(\(open\) => !open\)\}/,
  );
  assert.match(source, /aria-expanded=\{sidebarOpen\}/);
  assert.match(source, /open=\{sidebarOpen\}/);
  assert.match(source, /onClose=\{\(\) => setSidebarOpen\(false\)\}/);
});

test("new chat appears optimistically in history and is renamed on first prompt", () => {
  const source = read("src/components/AskAgent.tsx");

  assert.match(source, /const \[optimisticThread, setOptimisticThread\]/);
  assert.match(source, /title: "New Chat"/);
  assert.match(source, /resetChatState\(\{ createPlaceholder: true \}\)/);
  assert.match(source, /setSidebarOpen\(true\)/);
  assert.match(source, /title: shortTitle\(q\)/);
  assert.match(source, /loading && allItems\.length === 0/);
});
