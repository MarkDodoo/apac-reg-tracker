"""Expert referral matching (Xhoni's idea #4, PROJECT_LOG Session 20).

Two entry points into this: a topic/search-based "specialists in this area"
module (broad, always-on), and an invisible confidence trigger on Ask (see
app/rag.py) that surfaces a suggestion only when retrieval was weak -- never
shown as "the AI isn't sure", always framed as a positive next step.

Demo data only: `--seed-demo` creates clearly fictional firms. Real named
professionals need their own consent before being listed here, especially
once a "featured" paid-placement tier is real -- see ExpertListing's
docstring in models.py.
"""

import argparse

from sqlalchemy import select

from app.db import SessionLocal, init_db
from app.models import ExpertListing

DEMO_LISTINGS = [
    {
        "name": "Demo Compliance Partners (sample listing)",
        "bio": "Fictional example firm for demo purposes -- advises financial "
        "institutions on AML/KYC and banking regulation across Singapore "
        "and Hong Kong.",
        "jurisdictions": ["Singapore", "Hong Kong"],
        "categories": ["AML/KYC", "Banking", "Enforcement"],
        "contact_url": "https://example.com/demo-compliance-partners",
        "featured": True,
    },
    {
        "name": "Sample Digital Assets Advisory (demo)",
        "bio": "Fictional example firm for demo purposes -- specialises in "
        "crypto/digital asset licensing and fintech regulatory strategy.",
        "jurisdictions": ["Hong Kong", "Singapore"],
        "categories": ["Crypto/Digital Assets", "Fintech", "Payments"],
        "contact_url": "https://example.com/sample-digital-assets-advisory",
        "featured": False,
    },
    {
        "name": "Placeholder Capital Markets Counsel (demo)",
        "bio": "Fictional example firm for demo purposes -- capital markets "
        "and cross-border listing advisory for the Australian market.",
        "jurisdictions": ["Australia"],
        "categories": ["Capital Markets", "Enforcement", "Consumer Protection"],
        "contact_url": "https://example.com/placeholder-capital-markets-counsel",
        "featured": False,
    },
    {
        "name": "Example ESG & Green Finance Group (demo)",
        "bio": "Fictional example firm for demo purposes -- sustainability "
        "disclosure and green finance regulatory advisory across APAC.",
        "jurisdictions": ["Singapore", "Hong Kong", "Australia"],
        "categories": ["ESG/Green Finance", "Insurance", "Monetary Policy"],
        "contact_url": "https://example.com/example-esg-green-finance-group",
        "featured": True,
    },
]


def seed_demo() -> None:
    with SessionLocal() as session:
        existing = {
            row.name for row in session.scalars(select(ExpertListing))
        }
        added = 0
        for entry in DEMO_LISTINGS:
            if entry["name"] in existing:
                continue
            session.add(ExpertListing(**entry))
            added += 1
        session.commit()
        print(f"Seeded {added} demo expert listing(s) ({len(existing)} already present).")


def match_experts(
    jurisdictions: list[str] | None, categories: list[str] | None, limit: int = 3
) -> list[dict]:
    """Overlap-scored match, featured listings breaking ties. Empty filters
    match everything (broad fallback rather than an empty result)."""
    jset = set(jurisdictions or [])
    cset = set(categories or [])

    with SessionLocal() as session:
        listings = session.scalars(
            select(ExpertListing).where(ExpertListing.active.is_(True))
        ).all()

        scored = []
        for e in listings:
            juris_overlap = len(jset & set(e.jurisdictions)) if jset else 0
            cat_overlap = len(cset & set(e.categories)) if cset else 0
            score = 2.0 * cat_overlap + 1.0 * juris_overlap + (1.0 if e.featured else 0.0)
            scored.append((score, e))

        scored.sort(key=lambda t: t[0], reverse=True)
        return [
            {
                "id": e.id,
                "name": e.name,
                "bio": e.bio,
                "jurisdictions": e.jurisdictions,
                "categories": e.categories,
                "contact_url": e.contact_url,
                "featured": e.featured,
            }
            for _, e in scored[:limit]
        ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage expert referral listings")
    parser.add_argument("--seed-demo", action="store_true")
    args = parser.parse_args()
    init_db()
    if args.seed_demo:
        seed_demo()


if __name__ == "__main__":
    main()
