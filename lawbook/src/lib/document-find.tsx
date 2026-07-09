import { Fragment, type ReactNode } from "react";

export function highlightMatches(
  text: string,
  regex: RegExp | null,
  keyBase: string,
): ReactNode {
  if (!regex) return text;
  const out: ReactNode[] = [];
  let last = 0;
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match !== null) {
    const start = match.index;
    if (start > last) {
      out.push(
        <Fragment key={`${keyBase}:t${last}`}>
          {text.slice(last, start)}
        </Fragment>,
      );
    }
    out.push(
      <mark key={`${keyBase}:m${start}`} data-match>
        {match[0]}
      </mark>,
    );
    last = start + match[0].length;
    if (match[0].length === 0) regex.lastIndex += 1;
    match = regex.exec(text);
  }
  if (out.length === 0) return text;
  if (last < text.length) {
    out.push(<Fragment key={`${keyBase}:tEnd`}>{text.slice(last)}</Fragment>);
  }
  return out;
}

export function countMatches(text: string, regex: RegExp | null): number {
  if (!regex) return 0;
  regex.lastIndex = 0;
  let count = 0;
  let match = regex.exec(text);
  while (match !== null) {
    count += 1;
    if (match[0].length === 0) regex.lastIndex += 1;
    match = regex.exec(text);
  }
  return count;
}

export function updateActiveMatch(
  container: Element | null,
  activeIndex: number,
): void {
  if (!container) return;
  const marks = container.querySelectorAll<HTMLElement>("mark[data-match]");
  marks.forEach((mark, index) => {
    if (index === activeIndex) mark.setAttribute("data-active", "");
    else mark.removeAttribute("data-active");
  });
  marks[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
}
