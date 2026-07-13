"""Ingestion runner: scrape sources and upsert into the regulations table.

Usage (from pipeline/):
    python -m app.ingest                # metadata for latest 50 HKMA releases
    python -m app.ingest --max 200      # more history
    python -m app.ingest --full-text 20 # also fetch article text for 20 newest

Commits after every record so a mid-run failure keeps everything scraped so far.
"""

import argparse
import time

import httpx
from sqlalchemy import select

from app.db import SessionLocal, init_db
from app.models import Regulation
from app.scrapers import hkma


def ingest_hkma(max_records: int) -> tuple[int, int]:
    """Upsert HKMA press releases. Returns (new, seen_before)."""
    records = hkma.fetch_press_releases(max_records=max_records)
    new = existing = 0
    with SessionLocal() as session:
        for rec in records:
            found = session.scalar(
                select(Regulation).where(Regulation.source_url == rec["source_url"])
            )
            if found:
                existing += 1
                continue
            session.add(Regulation(**rec))
            session.commit()  # per-record: partial progress survives errors
            new += 1
    return new, existing


def backfill_full_text(limit: int) -> int:
    """Fetch article text for the newest records that don't have it yet."""
    fetched = 0
    with SessionLocal() as session, httpx.Client(
        headers=hkma._HEADERS, timeout=30
    ) as client:
        rows = session.scalars(
            select(Regulation)
            .where(Regulation.raw_text.is_(None), Regulation.source == hkma.SOURCE)
            .order_by(Regulation.published_date.desc())
            .limit(limit)
        ).all()
        for row in rows:
            text = hkma.fetch_full_text(row.source_url, client=client)
            if text:
                row.raw_text = text
                session.commit()
                fetched += 1
            time.sleep(1)  # be polite to hkma.gov.hk
    return fetched


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest regulatory documents")
    parser.add_argument("--max", type=int, default=50, help="max records per source")
    parser.add_argument(
        "--full-text",
        type=int,
        default=0,
        metavar="N",
        help="also fetch article text for N newest records missing it",
    )
    args = parser.parse_args()

    init_db()
    new, existing = ingest_hkma(args.max)
    print(f"HKMA press releases: {new} new, {existing} already ingested")

    if args.full_text:
        fetched = backfill_full_text(args.full_text)
        print(f"Full text fetched for {fetched} records")


if __name__ == "__main__":
    main()
