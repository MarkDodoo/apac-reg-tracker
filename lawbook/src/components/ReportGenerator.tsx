"use client";

/**
 * Questionnaire -> on-demand regulatory briefing. Stateless by design: the
 * form answers are sent to /api/report, used once to generate the report,
 * and not persisted anywhere — see PROJECT_LOG Session 19 for why.
 */

import { useState } from "react";
import { AnswerMarkdown } from "@/components/AnswerMarkdown";
import { SpecialistsWidget } from "@/components/SpecialistsWidget";
import { CATEGORIES, JURISDICTIONS } from "@/components/useProfile";

const INSTITUTION_TYPES = [
  "Bank",
  "Digital Asset Firm",
  "Insurer",
  "Payment Institution",
  "Asset Manager",
  "Capital Markets Intermediary",
  "Other",
];

interface ReportSource {
  n: number;
  title: string;
  source: string;
  published_date: string;
  url: string;
}

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

export function ReportGenerator() {
  const [institutionType, setInstitutionType] = useState(INSTITUTION_TYPES[0]);
  const [jurisdictions, setJurisdictions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [sources, setSources] = useState<ReportSource[]>([]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );

  const generate = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jurisdictions,
          categories,
          institution_type: institutionType,
          goals,
        }),
      });
      const data = (await res.json()) as {
        report?: string;
        sources?: ReportSource[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Report generation failed.");
      } else {
        setReport(data.report ?? "");
        setSources(data.sources ?? []);
      }
    } catch {
      setError("Report generation failed — is the pipeline API running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-8">
      <div>
        <h1 className="font-serif text-2xl font-medium text-foreground">
          Your regulatory briefing
        </h1>
        <p className="mt-1 text-sm text-muted">
          Answer a few questions and get a written briefing generated on the
          spot from the current corpus. Nothing you enter here is saved — each
          report is generated fresh and not stored.
        </p>
      </div>

      {!report && !loading && (
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              What kind of business are you?
            </p>
            <select
              value={institutionType}
              onChange={(e) => setInstitutionType(e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Jurisdictions
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {JURISDICTIONS.map((j) => (
                <Chip
                  key={j}
                  label={j}
                  active={jurisdictions.includes(j)}
                  onClick={() => toggle(jurisdictions, setJurisdictions, j)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Topics
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={categories.includes(c)}
                  onClick={() => toggle(categories, setCategories, c)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              What are you trying to figure out? (optional)
            </p>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="e.g. Whether we need to change our AML process before Q4"
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-2"
            />
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={jurisdictions.length === 0 && categories.length === 0}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            Generate Report
          </button>
          {jurisdictions.length === 0 && categories.length === 0 && (
            <p className="-mt-3 text-xs text-muted-2">
              Pick at least one jurisdiction or topic to generate a report.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            Writing your briefing — this can take a minute or two.
          </p>
        </div>
      )}

      {error && !loading && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          {error}
        </p>
      )}

      {report && !loading && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <AnswerMarkdown text={report} />
          </div>

          {sources.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
                Sources
              </p>
              <ol className="mt-2 flex flex-col gap-1.5 text-sm">
                {sources.map((s) => (
                  <li key={s.n} className="text-muted">
                    <span className="tabular-nums text-muted-2">[{s.n}]</span>{" "}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {s.title}
                    </a>{" "}
                    — {s.source}, {s.published_date}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <SpecialistsWidget
            jurisdictions={jurisdictions}
            categories={categories}
          />

          <button
            type="button"
            onClick={() => {
              setReport(null);
              setSources([]);
            }}
            className="self-start text-sm font-semibold text-accent hover:underline"
          >
            Start a new report
          </button>
        </div>
      )}
    </div>
  );
}
