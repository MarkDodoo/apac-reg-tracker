const INTERNAL_ORIGIN = "https://lawplain.invalid";
const ENCODED_SEPARATOR_OR_CONTROL = /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i;

function hasUnsafeCharacters(value: string): boolean {
  if (value.includes("\\") || ENCODED_SEPARATOR_OR_CONTROL.test(value)) {
    return true;
  }
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  let candidate = value;
  try {
    for (let index = 0; index < 3; index += 1) {
      if (hasUnsafeCharacters(candidate)) return "/";
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    }

    const parsed = new URL(value, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function safeContinuationPath(value: string | null): string {
  const path = safeNextPath(value);
  const pathname = new URL(path, INTERNAL_ORIGIN).pathname;
  if (
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/") ||
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname.startsWith("/api/auth/")
  ) {
    return "/";
  }
  return path;
}

export function buildWelcomePath(next: string | null): string {
  const continuation = safeContinuationPath(next);
  return `/welcome?next=${encodeURIComponent(continuation)}`;
}
