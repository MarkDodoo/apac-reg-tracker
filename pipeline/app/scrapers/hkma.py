"""HKMA (Hong Kong Monetary Authority) scraper.

Uses the official public Open API — https://apidocs.hkma.gov.hk/apidata/
Currently ingests press releases; circulars/guidelines aren't exposed by the
API and will need an HTML scraper later.

API response shape (verified 2026-07-13):
{
  "header": {"success": true, ...},
  "result": {"datasize": N, "records": [{"title", "link", "date"}, ...]}
}
"""

from datetime import date, datetime

import httpx
from bs4 import BeautifulSoup

API_BASE = "https://api.hkma.gov.hk/public"
SOURCE = "HKMA"
JURISDICTION = "Hong Kong"

_HEADERS = {"User-Agent": "apac-reg-tracker/0.1 (personal research project)"}


def fetch_press_releases(max_records: int = 100) -> list[dict]:
    """Fetch press-release metadata, newest first.

    Returns normalized dicts ready for the `regulations` table.
    """
    records: list[dict] = []
    offset = 0
    pagesize = min(max_records, 100)

    with httpx.Client(headers=_HEADERS, timeout=30) as client:
        while len(records) < max_records:
            resp = client.get(
                f"{API_BASE}/press-releases",
                params={"lang": "en", "offset": offset, "pagesize": pagesize},
            )
            resp.raise_for_status()
            payload = resp.json()
            if not payload.get("header", {}).get("success"):
                raise RuntimeError(f"HKMA API error: {payload.get('header')}")

            page = payload.get("result", {}).get("records", [])
            if not page:
                break
            for rec in page:
                records.append(_normalize(rec))
            offset += len(page)

    return records[:max_records]


def _normalize(rec: dict) -> dict:
    return {
        "source": SOURCE,
        "source_url": rec["link"],
        "jurisdiction": JURISDICTION,
        "title": rec["title"].strip(),
        "doc_type": "Press Release",
        "published_date": _parse_date(rec.get("date")),
        "language_original": "en",
    }


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None


def fetch_full_text(url: str, client: httpx.Client | None = None) -> str | None:
    """Fetch and extract the main text of an HKMA press-release page."""
    own_client = client is None
    client = client or httpx.Client(headers=_HEADERS, timeout=30)
    try:
        resp = client.get(url, follow_redirects=True)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # HKMA article pages keep the body in <div id="content"> / main content
        # blocks; fall back to full-page text if the layout changes.
        container = (
            soup.find("div", id="content")
            or soup.find("main")
            or soup.find("article")
            or soup.body
        )
        if container is None:
            return None
        for tag in container.find_all(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        text = " ".join(container.get_text(separator=" ").split())
        return text or None
    except httpx.HTTPError:
        return None
    finally:
        if own_client:
            client.close()
