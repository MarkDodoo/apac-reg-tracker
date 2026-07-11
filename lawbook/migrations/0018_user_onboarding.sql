ALTER TABLE user ADD COLUMN onboardingVersion INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user ADD COLUMN onboardingStatus TEXT CHECK (onboardingStatus IN ('completed', 'skipped'));
ALTER TABLE user ADD COLUMN onboardingUpdatedAt INTEGER;

-- Existing accounts should not see first-login onboarding after deployment.
UPDATE user
SET onboardingVersion = 1,
    onboardingStatus = 'skipped',
    onboardingUpdatedAt = CAST(unixepoch('subsec') * 1000 AS INTEGER);
