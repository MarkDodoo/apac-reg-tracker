"use client";

/**
 * Lets a visitor state their interests (jurisdictions + categories) to
 * personalize the homepage feed. No account needed — see useProfile.ts for
 * why this is stored client-side only.
 */

import { useState } from "react";
import {
  CATEGORIES,
  JURISDICTIONS,
  type Profile,
} from "@/components/useProfile";

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-accent bg-accent-soft font-semibold text-accent"
          : "border-border text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function ProfilePanel({
  profile,
  onSave,
  onClear,
  onClose,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Profile>(profile);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
        Jurisdictions
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {JURISDICTIONS.map((j) => (
          <Chip
            key={j}
            label={j}
            active={draft.jurisdictions.includes(j)}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                jurisdictions: toggle(d.jurisdictions, j),
              }))
            }
          />
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-2">
        Topics
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={c}
            active={draft.categories.includes(c)}
            onClick={() =>
              setDraft((d) => ({ ...d, categories: toggle(d.categories, c) }))
            }
          />
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-2">
        Saved only in your browser — not sent anywhere except to fetch your
        results.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-85"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            onClear();
            onClose();
          }}
          className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-sm text-muted-2 hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
