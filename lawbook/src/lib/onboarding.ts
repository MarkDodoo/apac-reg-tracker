import { getAuthDb } from "@/lib/d1";

export const CURRENT_ONBOARDING_VERSION = 1;

export type OnboardingStatus = "completed" | "skipped";

export class OnboardingUserNotFoundError extends Error {
  constructor() {
    super("Authenticated user was not found");
    this.name = "OnboardingUserNotFoundError";
  }
}

export class OnboardingConflictError extends Error {
  constructor() {
    super("Onboarding state changed; reload and try again");
    this.name = "OnboardingConflictError";
  }
}

type SessionOwner = { user: { id: string } };

export type OnboardingState = {
  version: number;
  status: OnboardingStatus | null;
  updatedAt: number | null;
};

type OnboardingRow = {
  onboardingVersion: number;
  onboardingStatus: OnboardingStatus | null;
  onboardingUpdatedAt: number | null;
};

export function needsOnboarding(state: OnboardingState): boolean {
  return state.version < CURRENT_ONBOARDING_VERSION && state.status === null;
}

export async function getOnboardingState(
  session: SessionOwner,
): Promise<OnboardingState> {
  const db = await getAuthDb();
  const row = await db
    .prepare(
      `SELECT onboardingVersion, onboardingStatus, onboardingUpdatedAt
       FROM user WHERE id = ?`,
    )
    .bind(session.user.id)
    .first<OnboardingRow>();

  if (!row) throw new OnboardingUserNotFoundError();
  return {
    version: row.onboardingVersion,
    status: row.onboardingStatus,
    updatedAt: row.onboardingUpdatedAt,
  };
}

export async function finishOnboarding(
  session: SessionOwner,
  status: OnboardingStatus,
): Promise<void> {
  const db = await getAuthDb();
  const result = await db
    .prepare(
      `UPDATE user
       SET onboardingVersion = ?, onboardingStatus = ?, onboardingUpdatedAt = ?
       WHERE id = ?
         AND onboardingStatus IS NULL
         AND onboardingVersion < ?`,
    )
    .bind(
      CURRENT_ONBOARDING_VERSION,
      status,
      Date.now(),
      session.user.id,
      CURRENT_ONBOARDING_VERSION,
    )
    .run();

  if (result.meta.changes > 0) return;

  const owner = await db
    .prepare(
      `SELECT onboardingVersion, onboardingStatus, onboardingUpdatedAt
       FROM user WHERE id = ?`,
    )
    .bind(session.user.id)
    .first<OnboardingRow>();

  if (!owner) throw new OnboardingUserNotFoundError();
  if (
    owner.onboardingVersion >= CURRENT_ONBOARDING_VERSION ||
    owner.onboardingStatus !== null
  )
    return;
  throw new OnboardingConflictError();
}
