"""ORM models — mirrors the unified document schema in /CLAUDE.md."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Regulation(Base):
    __tablename__ = "regulations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. HKMA
    source_url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    jurisdiction: Mapped[str | None] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    raw_text: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    language_original: Mapped[str] = mapped_column(String(10), default="en")
    translated: Mapped[bool] = mapped_column(Boolean, default=False)
    # Press Release | Consultation Paper | Circular | Guidance | News
    doc_type: Mapped[str | None] = mapped_column(String(100))
    categories: Mapped[list | None] = mapped_column(JSON)  # [Crypto, Banking, ...]
    affected_entities: Mapped[list | None] = mapped_column(JSON)  # [Banks, ...]
    published_date: Mapped[date | None] = mapped_column(Date)
    effective_date: Mapped[date | None] = mapped_column(Date)
    comment_deadline: Mapped[date | None] = mapped_column(Date)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    # Restrictive | Neutral | Facilitative
    sentiment_label: Mapped[str | None] = mapped_column(String(20))
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    impact_level: Mapped[str | None] = mapped_column(String(10))  # High|Medium|Low
    embedding_id: Mapped[str | None] = mapped_column(String(255))  # ChromaDB id
