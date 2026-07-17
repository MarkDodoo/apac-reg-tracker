"""Automated pipeline runner (APScheduler).

Runs the full chain — ingest all sources -> LLM enrich -> embed — once per
day, so the corpus stays current without manual steps.

Usage (from pipeline/):
    python -m app.scheduler --once   # run the full pipeline now, then exit
    python -m app.scheduler          # run daily at 07:00 (leave it running)

Each stage is independent: a failure in one source's ingestion doesn't stop
the others (per-record commits), and enrich/embed only touch documents that
still need work, so re-runs are cheap and safe.
"""

import argparse
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler

from app.alerts import send_alerts
from app.db import init_db
from app.embed import index
from app.enrich import enrich
from app.ingest import backfill_full_text, ingest_asic, ingest_hkma, ingest_mas

RUN_AT_HOUR = 7  # local time; regulators publish during their business day


def run_pipeline() -> None:
    started = datetime.now()
    print(f"=== Pipeline run {started:%Y-%m-%d %H:%M} ===")
    init_db()

    for name, job, max_records in (
        ("HKMA", ingest_hkma, 50),
        ("MAS", ingest_mas, 15),
        ("ASIC", ingest_asic, 25),
    ):
        try:
            new, _ = job(max_records)
            print(f"{name}: {new} new documents")
        except Exception as err:  # one source failing must not stop the rest
            print(f"{name}: FAILED — {err}")

    try:
        # HKMA's API returns metadata only; fetch article text for new docs
        # before enrichment (MAS/ASIC scrape text at ingest time).
        fetched = backfill_full_text(60)
        print(f"HKMA full text backfilled: {fetched}")
    except Exception as err:
        print(f"Full-text backfill FAILED — {err}")

    try:
        enrich(limit=None, redo=False)
    except Exception as err:
        print(f"Enrichment FAILED — {err}")

    try:
        index(reindex=False)
    except Exception as err:
        print(f"Embedding FAILED — {err}")

    try:
        # Local Mailpit inbox by default (SMTP_HOST/SMTP_PORT); skipping is
        # normal when no SMTP is running.
        send_alerts()
    except Exception as err:
        print(f"Alerts FAILED — {err}")

    print(f"=== Done in {(datetime.now() - started).seconds // 60} min ===")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scheduled pipeline runner")
    parser.add_argument(
        "--once", action="store_true", help="run immediately and exit"
    )
    args = parser.parse_args()

    if args.once:
        run_pipeline()
        return

    scheduler = BlockingScheduler()
    scheduler.add_job(
        run_pipeline, "cron", hour=RUN_AT_HOUR, minute=0, id="daily-pipeline"
    )
    print(f"Scheduler started — daily run at {RUN_AT_HOUR:02d}:00. Ctrl+C to stop.")
    scheduler.start()


if __name__ == "__main__":
    main()
