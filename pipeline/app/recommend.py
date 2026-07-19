"""Content-based recommendations.

Two flavours:

related(doc_id)   — nearest neighbours in embedding space (ChromaDB), i.e.
                    "documents like this one".
recommend(profile) — score every enriched document against a user profile
                    (jurisdictions + categories of interest), blending
                    metadata match, impact, and recency:

    score = 2.0 * category_overlap        (fraction of profile categories hit)
          + 1.5 * jurisdiction_match      (1 if doc is in profile, 0 else)
          + 1.0 * impact_weight           (High 1.0, Medium 0.5, Low 0.1)
          + 1.0 * recency                 (1.0 today -> 0.0 at 90 days)

Weights are transparent and tunable — the point of a content-based scorer
over collaborative filtering here is that we have no user interaction data
(and, per the PDPA posture, collect none).
"""

from datetime import date

from sqlalchemy import select

from app.db import SessionLocal
from app.embed import get_collection
from app.models import Regulation

IMPACT_WEIGHT = {"High": 1.0, "Medium": 0.5, "Low": 0.1}
RECENCY_HORIZON_DAYS = 90


def related(doc_id: str, limit: int = 5) -> list[dict]:
    """Nearest neighbours of a document in embedding space (excludes itself)."""
    col = get_collection()
    got = col.get(ids=[doc_id], include=["embeddings"])
    if not got["ids"]:
        return []
    res = col.query(
        query_embeddings=[got["embeddings"][0]],
        n_results=min(limit + 1, col.count()),
    )
    hits = []
    for id_, dist, meta in zip(
        res["ids"][0], res["distances"][0], res["metadatas"][0]
    ):
        if id_ == doc_id:
            continue
        hits.append({"id": id_, "relevance": round(1 - dist, 4), **meta})
    return hits[:limit]


def recommend(
    jurisdictions: list[str] | None,
    categories: list[str] | None,
    limit: int = 10,
) -> list[dict]:
    """Rank enriched documents for a profile. Empty filters mean 'any'."""
    jset = set(jurisdictions or [])
    cset = set(categories or [])
    today = date.today()

    with SessionLocal() as session:
        docs = session.scalars(
            select(Regulation).where(Regulation.sentiment_label.is_not(None))
        ).all()

        scored = []
        for d in docs:
            cat_overlap = (
                len(cset & set(d.categories or [])) / len(cset) if cset else 0.0
            )
            juris_match = 1.0 if (jset and d.jurisdiction in jset) else 0.0
            impact = IMPACT_WEIGHT.get(d.impact_level or "Low", 0.1)
            if d.published_date:
                age = (today - d.published_date).days
                recency = max(0.0, 1.0 - age / RECENCY_HORIZON_DAYS)
            else:
                recency = 0.0
            score = 2.0 * cat_overlap + 1.5 * juris_match + impact + recency
            scored.append((score, d))

        scored.sort(key=lambda t: t[0], reverse=True)
        return [
            {
                "id": d.id,
                "title": d.title,
                "source": d.source,
                "url": d.source_url,
                "jurisdiction": d.jurisdiction,
                "published_date": str(d.published_date),
                "sentiment_label": d.sentiment_label,
                "impact_level": d.impact_level,
                "categories": d.categories,
                "summary": d.summary,
                "score": round(score, 3),
            }
            for score, d in scored[:limit]
        ]
