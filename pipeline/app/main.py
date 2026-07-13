"""FastAPI app — serves the regulations corpus to the frontend.

Endpoint shapes intentionally mirror the lawplain backend style
(/v1/<collection>/search?q=&limit=) so the existing frontend patterns
transfer with minimal changes.

Run (from pipeline/):  uvicorn app.main:app --reload --port 8000
"""

from datetime import date, datetime

from fastapi import FastAPI, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select

from app.db import SessionLocal, init_db
from app.models import Regulation

app = FastAPI(
    title="APAC Regulation Tracker API",
    description="Regulatory documents from APAC financial regulators",
    version="0.1.0",
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


class RegulationOut(BaseModel):
    id: str
    source: str
    source_url: str
    jurisdiction: str | None
    title: str
    summary: str | None
    doc_type: str | None
    categories: list | None
    published_date: date | None
    sentiment_label: str | None
    sentiment_score: float | None
    impact_level: str | None
    ingested_at: datetime

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    query: str
    count: int
    results: list[RegulationOut]


class ListResponse(BaseModel):
    count: int
    results: list[RegulationOut]


@app.get("/v1/regulations", response_model=ListResponse)
def list_regulations(
    source: str | None = None,
    jurisdiction: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ListResponse:
    """Newest documents first, optionally filtered by source/jurisdiction."""
    with SessionLocal() as session:
        stmt = select(Regulation).order_by(
            Regulation.published_date.desc(), Regulation.ingested_at.desc()
        )
        if source:
            stmt = stmt.where(Regulation.source == source.upper())
        if jurisdiction:
            stmt = stmt.where(Regulation.jurisdiction.ilike(jurisdiction))
        rows = session.scalars(stmt.offset(offset).limit(limit)).all()
        return ListResponse(
            count=len(rows),
            results=[RegulationOut.model_validate(r) for r in rows],
        )


@app.get("/v1/regulations/search", response_model=SearchResponse)
def search_regulations(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
) -> SearchResponse:
    """Keyword search over title and body text.

    Simple LIKE matching for the MVP; semantic search via ChromaDB embeddings
    lands in Phase 2.
    """
    pattern = f"%{q}%"
    with SessionLocal() as session:
        stmt = (
            select(Regulation)
            .where(
                or_(
                    Regulation.title.ilike(pattern),
                    Regulation.raw_text.ilike(pattern),
                    Regulation.summary.ilike(pattern),
                )
            )
            .order_by(Regulation.published_date.desc())
            .limit(limit)
        )
        rows = session.scalars(stmt).all()
        return SearchResponse(
            query=q,
            count=len(rows),
            results=[RegulationOut.model_validate(r) for r in rows],
        )


@app.get("/v1/stats")
def stats() -> dict:
    """Corpus counts for orientation, grouped by source."""
    with SessionLocal() as session:
        total = session.scalar(select(func.count(Regulation.id))) or 0
        by_source = session.execute(
            select(Regulation.source, func.count(Regulation.id)).group_by(
                Regulation.source
            )
        ).all()
        with_text = (
            session.scalar(
                select(func.count(Regulation.id)).where(
                    Regulation.raw_text.is_not(None)
                )
            )
            or 0
        )
        return {
            "total": total,
            "with_full_text": with_text,
            "by_source": {source: count for source, count in by_source},
        }
