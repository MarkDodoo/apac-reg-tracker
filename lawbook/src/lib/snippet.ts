export type SnippetValue = string | string[] | undefined;

export function firstStringValue(value?: SnippetValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function snippetToPlainText(value?: SnippetValue): string {
  const text = firstStringValue(value);
  if (!text) return "";
  return text
    .replace(/<(?!\/?b\b)[^>]*>/gi, "")
    .replace(/<\/?b\b[^>]*>/gi, "")
    .replace(/\*\*/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
