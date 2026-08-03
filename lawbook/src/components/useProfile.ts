"use client";

/**
 * User's interest profile (jurisdictions + categories) — stored ONLY in the
 * browser's localStorage, never sent to or stored on our servers except as
 * query params on the /api/recommendations request itself (not persisted
 * there either). Deliberately not tied to an account: this is the
 * lowest-footprint way to personalize the feed — explicit input, used
 * immediately, nothing collected. See PROJECT_LOG for the reasoning.
 */

import { useCallback, useEffect, useState } from "react";

export interface Profile {
  jurisdictions: string[];
  categories: string[];
}

export const JURISDICTIONS = ["Singapore", "Hong Kong", "Australia"] as const;

export const CATEGORIES = [
  "Crypto/Digital Assets",
  "Banking",
  "Payments",
  "AML/KYC",
  "Insurance",
  "Capital Markets",
  "ESG/Green Finance",
  "Fintech",
  "Monetary Policy",
  "Consumer Protection",
  "Enforcement",
  "Currency",
] as const;

const STORAGE_KEY = "regtracker-profile";
const EMPTY: Profile = { jurisdictions: [], categories: [] };

function readStored(): Profile {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      jurisdictions: Array.isArray(parsed.jurisdictions)
        ? parsed.jurisdictions
        : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch {
    return EMPTY;
  }
}

export function useProfile() {
  const [profile, setProfileState] = useState<Profile>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfileState(readStored());
    setLoaded(true);
  }, []);

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable (private browsing, quota) — profile just
      // won't persist across reloads; the feature still works this session.
    }
  }, []);

  const clearProfile = useCallback(() => setProfile(EMPTY), [setProfile]);

  const isSet =
    profile.jurisdictions.length > 0 || profile.categories.length > 0;

  return { profile, setProfile, clearProfile, isSet, loaded };
}
