"""FinBERT vs LLM sentiment bake-off.

Compares two approaches to Restrictive/Neutral/Facilitative classification
against a hand-labelled gold set (eval/gold_sentiment.json):

  1. FinBERT (ProsusAI/finbert) — financial *tone* classifier
     (positive/negative/neutral), mapped: negative -> Restrictive,
     positive -> Facilitative, neutral -> Neutral.
  2. qwen2.5:7b labels already produced by app/enrich.py (stored in the DB).

Methodology notes (be honest about these when citing results):
  - n=30, stratified 10/10/10 BY THE LLM'S OWN LABELS, so LLM recall on
    classes it systematically misses is not measured.
  - Gold labels were assigned by one rater (AI assistant) reading each
    document's title + summary; not blind to the LLM label.

Run (from pipeline/):  .venv\\Scripts\\python -m eval.finbert_bakeoff
Requires: pip install torch transformers (not in requirements.txt — eval only).
"""

import json
from collections import Counter
from pathlib import Path

from sqlalchemy import select
from transformers import pipeline as hf_pipeline

from app.db import SessionLocal
from app.models import Regulation

GOLD_PATH = Path(__file__).parent / "gold_sentiment.json"
FINBERT_TO_STANCE = {
    "negative": "Restrictive",
    "positive": "Facilitative",
    "neutral": "Neutral",
}
LABELS = ["Restrictive", "Neutral", "Facilitative"]


def main() -> None:
    gold = json.loads(GOLD_PATH.read_text(encoding="utf-8"))
    with SessionLocal() as session:
        docs = {
            d.id: d
            for d in session.scalars(
                select(Regulation).where(
                    Regulation.id.in_([g["id"] for g in gold])
                )
            )
        }

    print("Loading FinBERT (ProsusAI/finbert)...")
    finbert = hf_pipeline(
        "text-classification", model="ProsusAI/finbert", truncation=True
    )

    rows = []
    for g in gold:
        doc = docs[g["id"]]
        text = f"{doc.title}. {doc.summary or ''}"[:1500]
        fb_raw = finbert(text)[0]["label"]
        rows.append(
            {
                "title": doc.title[:60],
                "gold": g["gold"],
                "finbert": FINBERT_TO_STANCE[fb_raw],
                "llm": doc.sentiment_label,
            }
        )

    def report(name: str, key: str) -> None:
        correct = sum(1 for r in rows if r[key] == r["gold"])
        print(f"\n{name}: {correct}/{len(rows)} correct "
              f"({correct / len(rows):.0%})")
        confusion = Counter((r["gold"], r[key]) for r in rows)
        print(f"{'gold \\ pred':14s}" + "".join(f"{l:14s}" for l in LABELS))
        for gl in LABELS:
            cells = "".join(f"{confusion.get((gl, pl), 0):<14d}" for pl in LABELS)
            print(f"{gl:14s}{cells}")
        misses = [r for r in rows if r[key] != r["gold"]]
        if misses:
            print("Misclassified:")
            for r in misses:
                print(f"  gold={r['gold']:12s} pred={r[key]:12s} {r['title']}")

    report("FinBERT (mapped)", "finbert")
    report("qwen2.5:7b (enrich.py)", "llm")


if __name__ == "__main__":
    main()
