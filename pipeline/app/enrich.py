"""LLM enrichment via local Ollama models.

Fills the analysis columns on ingested documents. Both tasks default to
qwen2.5:7b — measured on 2026-07-14: qwen2.5:3b mislabelled 2 of 3 scam
alerts Restrictive/High even with explicit prompt guidance, 7b got 3/3
Neutral/Low; and qwen3:4b leaks its reasoning into summary output (think=False
has no effect on this Ollama version). 3b remains the candidate for the
future real-time first-pass tagging; override with TAG_MODEL/SUMMARY_MODEL
env vars.

Runs as two passes (all tagging, then all summaries) so Ollama never swaps
models between documents — swapping reloads the model and dominates runtime.

Sentiment here is the LLM baseline for the FinBERT-vs-LLM bake-off
(PROJECT_LOG "Open Questions"). Labels: Restrictive | Neutral | Facilitative,
score in [-1, 1] where -1 = most restrictive, +1 = most facilitative.

Usage (from pipeline/):
    python -m app.enrich --limit 5        # try a few first
    python -m app.enrich                  # everything with text, not yet enriched
    python -m app.enrich --redo           # re-enrich even if already done

Commits per document, so an interrupted run keeps its progress.
"""

import argparse
import json
import os
import time

import ollama
from sqlalchemy import select

from app.db import SessionLocal, init_db
from app.models import Regulation

TAG_MODEL = os.environ.get("TAG_MODEL", "qwen2.5:7b")
SUMMARY_MODEL = os.environ.get("SUMMARY_MODEL", "qwen2.5:7b")

# Fixed taxonomy so filters/dashboards get consistent values.
CATEGORIES = [
    "Crypto/Digital Assets", "Banking", "Payments", "AML/KYC", "Insurance",
    "Capital Markets", "ESG/Green Finance", "Fintech", "Monetary Policy",
    "Consumer Protection", "Enforcement", "Currency", "Other",
]
ENTITIES = [
    "Banks", "Digital Asset Firms", "Insurers", "Payment Institutions",
    "Asset Managers", "Capital Market Intermediaries", "All FIs",
    "Consumers", "Government",
]

TAG_SCHEMA = {
    "type": "object",
    "properties": {
        "categories": {
            "type": "array", "items": {"type": "string", "enum": CATEGORIES},
        },
        "affected_entities": {
            "type": "array", "items": {"type": "string", "enum": ENTITIES},
        },
        "sentiment_label": {
            "type": "string", "enum": ["Restrictive", "Neutral", "Facilitative"],
        },
        "sentiment_score": {"type": "number", "minimum": -1, "maximum": 1},
        "impact_level": {"type": "string", "enum": ["High", "Medium", "Low"]},
    },
    "required": [
        "categories", "affected_entities", "sentiment_label",
        "sentiment_score", "impact_level",
    ],
}

TAG_PROMPT = """You are a regulatory analyst for APAC financial institutions.
Classify this document from {source} ({jurisdiction}).

sentiment_label is the document's stance toward regulated businesses:
- Restrictive: new obligations, bans, enforcement actions, penalties, tighter rules
- Facilitative: enabling innovation, grants, relaxed rules, new opportunities
- Neutral: appointments, statistics, speeches, routine announcements, and
  scam/fraud alerts warning the public (these impose nothing on firms)
sentiment_score: -1 (most restrictive) to 1 (most facilitative), 0 = neutral.
impact_level: how much this changes what regulated firms must do. Consumer
warnings and routine news are Low.

TITLE: {title}

TEXT:
{text}"""

SUMMARY_PROMPT = """Summarise this regulatory document in 2-3 plain sentences
for a compliance officer. State what happened and who is affected. No preamble,
no bullet points — just the sentences.

SOURCE: {source} ({jurisdiction})
TITLE: {title}

TEXT:
{text}"""


def tag_document(doc: Regulation) -> dict | None:
    """Classify one document with the small/fast model."""
    resp = ollama.chat(
        model=TAG_MODEL,
        messages=[{
            "role": "user",
            "content": TAG_PROMPT.format(
                source=doc.source,
                jurisdiction=doc.jurisdiction,
                title=doc.title,
                text=(doc.raw_text or "")[:6000],
            ),
        }],
        format=TAG_SCHEMA,
        options={"temperature": 0, "num_ctx": 8192},
    )
    try:
        return json.loads(resp.message.content)
    except (json.JSONDecodeError, TypeError):
        return None


def summarize_document(doc: Regulation) -> str | None:
    """Write the 2-3 sentence summary with the mid-size model."""
    resp = ollama.chat(
        model=SUMMARY_MODEL,
        messages=[{
            "role": "user",
            "content": SUMMARY_PROMPT.format(
                source=doc.source,
                jurisdiction=doc.jurisdiction,
                title=doc.title,
                text=(doc.raw_text or "")[:8000],
            ),
        }],
        options={"temperature": 0.2, "num_ctx": 8192},
    )
    text = (resp.message.content or "").strip()
    return text or None


def enrich(limit: int | None, redo: bool) -> None:
    with SessionLocal() as session:
        stmt = select(Regulation).where(Regulation.raw_text.is_not(None))
        if not redo:
            stmt = stmt.where(
                Regulation.sentiment_label.is_(None)
                | Regulation.summary.is_(None)
            )
        stmt = stmt.order_by(Regulation.published_date.desc())
        if limit:
            stmt = stmt.limit(limit)
        docs = session.scalars(stmt).all()
        started = time.time()

        # Pass 1 — tagging (small model stays loaded for the whole pass).
        todo = [d for d in docs if redo or d.sentiment_label is None]
        print(f"Pass 1/2: tagging {len(todo)} documents with {TAG_MODEL}...")
        failed = 0
        for i, doc in enumerate(todo, 1):
            tags = tag_document(doc)
            if not tags:
                failed += 1
                print(f"  FAILED  {doc.title[:60]}")
                continue
            doc.categories = tags["categories"] or ["Other"]
            doc.affected_entities = tags["affected_entities"]
            doc.sentiment_label = tags["sentiment_label"]
            doc.sentiment_score = round(float(tags["sentiment_score"]), 3)
            doc.impact_level = tags["impact_level"]
            doc.embedding_id = None  # any future embedding must be redone
            session.commit()  # per-document: progress survives interruption
            print(
                f"  [{i}/{len(todo)}] {doc.sentiment_label:12s} "
                f"{doc.impact_level:6s} {doc.title[:55]}"
            )

        # Pass 2 — summaries (larger model, one load).
        todo = [d for d in docs if redo or d.summary is None]
        print(f"Pass 2/2: summarising {len(todo)} documents with {SUMMARY_MODEL}...")
        for i, doc in enumerate(todo, 1):
            summary = summarize_document(doc)
            if not summary:
                failed += 1
                print(f"  FAILED  {doc.title[:60]}")
                continue
            doc.summary = summary
            session.commit()
            print(f"  [{i}/{len(todo)}] {doc.title[:60]}")

        mins = (time.time() - started) / 60
        print(f"Done: {len(docs)} documents, {failed} failures, {mins:.1f} min")


def main() -> None:
    parser = argparse.ArgumentParser(description="LLM-enrich ingested documents")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument(
        "--redo", action="store_true", help="re-enrich already-enriched docs"
    )
    args = parser.parse_args()
    init_db()
    enrich(args.limit, args.redo)


if __name__ == "__main__":
    main()
