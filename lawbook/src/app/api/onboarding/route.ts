import { getSession } from "@/lib/auth";
import { safeContinuationPath } from "@/lib/auth-callback";
import {
  finishOnboarding,
  OnboardingConflictError,
  OnboardingUserNotFoundError,
} from "@/lib/onboarding";
import {
  hasSameOrigin,
  isOnboardingAction,
  onboardingResult,
} from "@/lib/onboarding-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // This exact Origin comparison is the CSRF control for this form endpoint.
  if (!hasSameOrigin(request.url, request.headers.get("Origin"))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getSession(request.headers);
  if (!session)
    return Response.json({ error: "Authentication required" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const action = form?.get("action") ?? null;
  if (!form || !isOnboardingAction(action)) {
    return Response.json(
      { error: "Invalid onboarding action" },
      { status: 400 },
    );
  }

  const next = form.get("next");
  const result = onboardingResult(
    action,
    safeContinuationPath(typeof next === "string" ? next : null),
  );
  try {
    await finishOnboarding(session, result.status);
  } catch (error) {
    if (error instanceof OnboardingUserNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof OnboardingConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  return new Response(null, {
    status: 303,
    headers: { Location: result.destination },
  });
}
