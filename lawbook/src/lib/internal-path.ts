const INTERNAL_ORIGIN = "https://lawplain.invalid";
const ALLOWED_ROUTE_PREFIXES = ["/judgment/", "/statute/"];

export function normalizeInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (
    !path ||
    path.length > 1_000 ||
    hasUnsafeCharacters(path) ||
    path.startsWith("//")
  )
    return null;
  let parsed: URL;
  try {
    parsed = new URL(path, INTERNAL_ORIGIN);
    if (hasUnsafeCharacters(decodeURIComponent(path))) return null;
  } catch {
    return null;
  }
  if (
    parsed.origin !== INTERNAL_ORIGIN ||
    !ALLOWED_ROUTE_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
  )
    return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function hasUnsafeCharacters(value: string) {
  if (value.includes("\\")) return true;
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
