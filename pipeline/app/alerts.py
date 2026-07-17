"""Email alerts for high-impact regulatory developments.

For each active subscription, finds enriched documents matching its filters
(impact threshold, jurisdictions, categories) that it hasn't been alerted
about yet, and sends one digest email per subscriber per run.

Privacy posture (PROJECT_LOG, Session 9): the demo never sends real email.
SMTP defaults to localhost:1025 — run Mailpit (`mailpit`) and every message
lands in a local browser inbox at http://localhost:8025 instead of the
internet. Real delivery would only ever be configured with consent, post-PDPA
review.

Usage (from pipeline/):
    python -m app.alerts --seed-demo   # create a demo subscription
    python -m app.alerts               # send pending alerts
    python -m app.alerts --dry-run     # show what would be sent
"""

import argparse
import os
import smtplib
from email.message import EmailMessage

from sqlalchemy import select

from app.db import SessionLocal, init_db
from app.models import AlertLog, AlertSubscription, Regulation

SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "1025"))
FROM_ADDR = os.environ.get("ALERT_FROM", "alerts@apac-reg-tracker.local")

IMPACT_RANK = {"Low": 0, "Medium": 1, "High": 2}


def _matches(sub: AlertSubscription, doc: Regulation) -> bool:
    if IMPACT_RANK.get(doc.impact_level or "Low", 0) < IMPACT_RANK.get(
        sub.min_impact, 2
    ):
        return False
    if sub.jurisdictions and doc.jurisdiction not in sub.jurisdictions:
        return False
    if sub.categories and not set(sub.categories) & set(doc.categories or []):
        return False
    return True


def pending_alerts(session) -> dict[AlertSubscription, list[Regulation]]:
    """Documents each active subscriber should be alerted about, oldest first."""
    subs = session.scalars(
        select(AlertSubscription).where(AlertSubscription.active.is_(True))
    ).all()
    docs = session.scalars(
        select(Regulation)
        .where(Regulation.sentiment_label.is_not(None))
        .order_by(Regulation.published_date.asc())
    ).all()
    already = {
        (log.subscription_id, log.regulation_id)
        for log in session.scalars(select(AlertLog))
    }
    out: dict[AlertSubscription, list[Regulation]] = {}
    for sub in subs:
        matched = [
            d
            for d in docs
            if (sub.id, d.id) not in already and _matches(sub, d)
        ]
        if matched:
            out[sub] = matched
    return out


def build_digest(sub: AlertSubscription, docs: list[Regulation]) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = FROM_ADDR
    msg["To"] = sub.email
    msg["Subject"] = (
        f"[APAC Reg Tracker] {len(docs)} regulatory "
        f"development{'s' if len(docs) != 1 else ''} matching your profile"
    )

    lines = [f"Hello {sub.name or 'there'},", "",
             "New regulatory developments matching your alert profile:", ""]
    html_items = []
    for d in docs:
        lines += [
            f"- [{d.source}] {d.title}",
            f"  {d.published_date} | {d.impact_level} impact | "
            f"{d.sentiment_label}",
            f"  {(d.summary or '')[:300]}",
            f"  {d.source_url}",
            "",
        ]
        html_items.append(
            f'<li style="margin-bottom:14px">'
            f'<a href="{d.source_url}"><strong>[{d.source}] {d.title}</strong></a>'
            f'<br><span style="color:#666">{d.published_date} &middot; '
            f"{d.impact_level} impact &middot; {d.sentiment_label}</span>"
            f'<br>{(d.summary or "")[:300]}</li>'
        )
    lines += ["--", "APAC Regulation Tracker — automated alert. "
              "Regulatory information, not legal advice."]
    msg.set_content("\n".join(lines))
    msg.add_alternative(
        f"<html><body><p>Hello {sub.name or 'there'},</p>"
        f"<p>New regulatory developments matching your alert profile:</p>"
        f"<ul>{''.join(html_items)}</ul>"
        f'<p style="color:#888;font-size:12px">APAC Regulation Tracker — '
        f"automated alert. Regulatory information, not legal advice.</p>"
        f"</body></html>",
        subtype="html",
    )
    return msg


def send_alerts(dry_run: bool = False) -> int:
    """Send pending digests. Returns number of emails sent."""
    sent = 0
    with SessionLocal() as session:
        queue = pending_alerts(session)
        if not queue:
            print("No pending alerts.")
            return 0
        for sub, docs in queue.items():
            print(f"{sub.email}: {len(docs)} matching documents")
            if dry_run:
                for d in docs[:10]:
                    print(f"  - [{d.source}] {d.impact_level:6s} {d.title[:60]}")
                continue
            msg = build_digest(sub, docs)
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
                smtp.send_message(msg)
            for d in docs:
                session.add(
                    AlertLog(subscription_id=sub.id, regulation_id=d.id)
                )
            session.commit()  # per-subscriber: a later failure won't resend
            sent += 1
    return sent


def seed_demo() -> None:
    """Create the demo subscription (idempotent). Address is fictional —
    mail only ever lands in the local Mailpit inbox."""
    with SessionLocal() as session:
        existing = session.scalar(
            select(AlertSubscription).where(
                AlertSubscription.email == "compliance.demo@example.com"
            )
        )
        if existing:
            print("Demo subscription already exists.")
            return
        session.add(
            AlertSubscription(
                email="compliance.demo@example.com",
                name="Demo Compliance Officer",
                min_impact="High",
                jurisdictions=[],
                categories=[],
            )
        )
        session.commit()
        print("Demo subscription created: compliance.demo@example.com "
              "(all jurisdictions, High impact only)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Send regulatory email alerts")
    parser.add_argument("--seed-demo", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    init_db()
    if args.seed_demo:
        seed_demo()
        return
    sent = send_alerts(dry_run=args.dry_run)
    if not args.dry_run:
        print(f"Sent {sent} digest email(s) via {SMTP_HOST}:{SMTP_PORT}")


if __name__ == "__main__":
    main()
