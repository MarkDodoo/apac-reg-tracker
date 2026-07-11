export type OnboardingAction = "search" | "ask" | "saved" | "skip";

export function hasSameOrigin(
  requestUrl: string,
  origin: string | null,
): boolean {
  if (!origin) return false;
  try {
    const parsedOrigin = new URL(origin);
    return (
      origin === parsedOrigin.origin &&
      parsedOrigin.origin === new URL(requestUrl).origin
    );
  } catch {
    return false;
  }
}

export function isOnboardingAction(
  value: FormDataEntryValue | null,
): value is OnboardingAction {
  return (
    value === "search" ||
    value === "ask" ||
    value === "saved" ||
    value === "skip"
  );
}

export function onboardingResult(
  action: OnboardingAction,
  continuation: string,
): {
  status: "completed" | "skipped";
  destination: string;
} {
  if (action === "search")
    return { status: "completed", destination: "/?focus=search" };
  if (action === "saved") return { status: "completed", destination: "/saved" };
  if (action === "skip")
    return { status: "skipped", destination: continuation };

  const pathname = new URL(continuation, "https://lawplain.invalid").pathname;
  return {
    status: "completed",
    destination:
      pathname === "/ask" || pathname.startsWith("/ask/")
        ? continuation
        : "/ask",
  };
}
