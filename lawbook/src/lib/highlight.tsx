import { Fragment, type ReactNode } from "react";

/**
 * Wrap regex matches in <mark data-match> for query highlighting. Shared by the
 * Judgment and Document readers (issue #70 — shared find primitive). Server- or
 * client-rendered text that is not React-controlled is highlighted via the
 * DOM-based useTextFind hook instead.
 */
export function highlightText(
  text: string,
  regex: RegExp | null,
  keyBase: string,
): ReactNode {
  if (!regex) return text;
  const out: ReactNode[] = [];
  let last = 0;
  regex.lastIndex = 0;
  let m = regex.exec(text);
  while (m !== null) {
    const start = m.index;
    if (start > last) {
      out.push(
        <Fragment key={`${keyBase}:t${last}`}>
          {text.slice(last, start)}
        </Fragment>,
      );
    }
    out.push(
      <mark key={`${keyBase}:m${start}`} data-match>
        {m[0]}
      </mark>,
    );
    last = start + m[0].length;
    if (m[0].length === 0) regex.lastIndex += 1;
    m = regex.exec(text);
  }
  if (out.length === 0) return text;
  if (last < text.length) {
    out.push(<Fragment key={`${keyBase}:tEnd`}>{text.slice(last)}</Fragment>);
  }
  return out;
}
