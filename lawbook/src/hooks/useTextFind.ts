"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";
import { buildRegex, parseTerms } from "@/lib/sections";

/**
 * In-document find for server-rendered (non-React-controlled) content such as
 * statute provisions (issue #70). Walks the container's text nodes, wraps query
 * matches in <mark data-match data-find>, and tracks the active match with
 * prev/next navigation + scrolling — mirroring the Judgment reader's behavior
 * using the shared `mark[data-match]` styling.
 */
export function useTextFind(
  containerRef: RefObject<HTMLElement | null>,
  query: string,
) {
  const [matchCount, setMatchCount] = useState(0);
  const [active, setActive] = useState(0);

  // (Re)apply highlight marks whenever the query changes.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    clearFindMarks(root);
    setActive(0);
    const regex = buildRegex(parseTerms(query));
    if (!regex) {
      setMatchCount(0);
      return;
    }
    setMatchCount(applyFindMarks(root, regex));
    return () => clearFindMarks(root);
  }, [containerRef, query]);

  const activeIndex = matchCount === 0 ? 0 : Math.min(active, matchCount - 1);

  // Style + scroll the active match.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || matchCount === 0) return;
    const marks = root.querySelectorAll<HTMLElement>("mark[data-match]");
    marks.forEach((m, i) => {
      if (i === activeIndex) m.setAttribute("data-active", "");
      else m.removeAttribute("data-active");
    });
    marks[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [containerRef, activeIndex, matchCount]);

  const goPrev = useCallback(() => {
    setActive((a) =>
      matchCount === 0 ? 0 : (a - 1 + matchCount) % matchCount,
    );
  }, [matchCount]);
  const goNext = useCallback(() => {
    setActive((a) => (matchCount === 0 ? 0 : (a + 1) % matchCount));
  }, [matchCount]);

  return { matchCount, activeIndex, goPrev, goNext };
}

function clearFindMarks(root: HTMLElement) {
  for (const mark of root.querySelectorAll("mark[data-find]")) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

function applyFindMarks(root: HTMLElement, regex: RegExp): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (!parent || parent.closest("mark")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    targets.push(node as Text);
    node = walker.nextNode();
  }

  let count = 0;
  for (const textNode of targets) {
    const text = textNode.nodeValue ?? "";
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let m = regex.exec(text);
    while (m !== null) {
      if (m.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      }
      const mark = document.createElement("mark");
      mark.setAttribute("data-match", "");
      mark.setAttribute("data-find", "");
      mark.textContent = m[0];
      frag.appendChild(mark);
      count += 1;
      last = m.index + m[0].length;
      if (m[0].length === 0) regex.lastIndex += 1;
      m = regex.exec(text);
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
  return count;
}
