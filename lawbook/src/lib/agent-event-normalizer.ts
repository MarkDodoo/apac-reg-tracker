export function normalizeToolRejected(event: {
  name?: string;
  reason?: string;
  message?: string;
}) {
  const reason: "budget" | "duplicate" =
    event.reason === "duplicate" ? "duplicate" : "budget";
  return {
    type: "tool_rejected" as const,
    name: event.name ?? "tool",
    reason,
    message: event.message ?? `Tool call rejected (${reason})`,
  };
}
