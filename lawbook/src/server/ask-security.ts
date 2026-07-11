const SECRET_NAME = /(api[_-]?key|token|secret|authorization|cookie)/i;
const SECRET_VALUE =
  /(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|(?:api[_-]?key|token|secret)\s*[=:]\s*[^\s,;]+)/gi;

export const MAX_ASK_TEXT_BYTES = 1_000_000;
export const MAX_ASK_EVENT_BYTES = 64_000;

export function askAgentEnabled(env: Record<string, unknown>): boolean {
  const enabled = env.LAWPLAIN_ASK_AGENT_ENABLED === "true";
  const host =
    typeof env.LAWPLAIN_PUBLIC_HOST === "string"
      ? env.LAWPLAIN_PUBLIC_HOST
      : "";
  const production = env.NODE_ENV === "production";
  return enabled && (!production || (host.length > 0 && host !== "localhost"));
}

export function providerCredential(
  env: Record<string, unknown>,
): Record<string, string> | null {
  const name =
    typeof env.LAWPLAIN_AGENT_CREDENTIAL === "string"
      ? env.LAWPLAIN_AGENT_CREDENTIAL
      : "CODEGRAFF_API_KEY";
  if (!/^[A-Z][A-Z0-9_]*$/.test(name) || SECRET_NAME.test(name) === false)
    return null;
  const value = env[name];
  return typeof value === "string" && value ? { [name]: value } : null;
}

export function redactSecrets(
  value: unknown,
  secrets: readonly string[] = [],
): string {
  let text = value instanceof Error ? value.message : String(value);
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text.replace(SECRET_VALUE, "[REDACTED]");
}

export function safeAgentError(_error?: unknown): string {
  return "Research could not be completed. Please try again.";
}

export function boundedText(
  value: string,
  maxBytes: number,
): {
  text: string;
  truncated: boolean;
} {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length <= maxBytes) return { text: value, truncated: false };
  return {
    text: new TextDecoder().decode(bytes.slice(0, Math.max(0, maxBytes)), {
      stream: true,
    }),
    truncated: true,
  };
}

export function userRunName(userId: string, runId: string): string {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(runId)}`;
}
