"""ASIC (Australian Securities and Investments Commission) scraper.

ASIC has no RSS, but its newsroom frontend loads the entire dataset from a
public JSON file (~6MB, ~6,800 items, discovered 2026-07-16 in the site's
own JS bundle):

    https://download.asic.gov.au/scripts/newsroom/newsroom-all.json

Each item carries name, publishedDate, url, documentNumber, metaType
("media release", "news item", ...), metaDescription, and metaFunction
topic tags — the richest metadata of our three regulators. Full article
text is fetched per page for the newest records.
"""

import time
from datetime import date, datetime

import httpx
from bs4 import BeautifulSoup

NEWSROOM_JSON = "https://download.asic.gov.au/scripts/newsroom/newsroom-all.json"
BASE = "https://asic.gov.au"
SOURCE = "ASIC"
JURISDICTION = "Australia"
CRAWL_DELAY_S = 1

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

_DOC_TYPES = {
    "media release": "Press Release",
    "news item": "News",
    "speech": "News",
    "article": "News",
}


def fetch_media_releases(
    max_records: int = 25, skip_urls: set[str] | None = None
) -> list[dict]:
    """Newest media releases/news with full article text.

    `skip_urls` excludes already-ingested documents so the per-page crawl
    budget goes to new ones.
    """
    skip = skip_urls or set()
    with httpx.Client(headers=_HEADERS, timeout=60, follow_redirects=True) as client:
        resp = client.get(NEWSROOM_JSON)
        resp.raise_for_status()
        items = resp.json()

        items = [
            it
            for it in items
            if it.get("metaType") in _DOC_TYPES and it.get("url")
        ]
        items.sort(key=lambda it: it.get("publishedDate") or "", reverse=True)

        records: list[dict] = []
        for it in items:
            if len(records) >= max_records:
                break
            url = BASE + it["url"] if it["url"].startswith("/") else it["url"]
            if url in skip:
                continue
            records.append(
                {
                    "source": SOURCE,
                    "source_url": url,
                    "jurisdiction": JURISDICTION,
                    "title": (it.get("name") or "").strip(),
                    "doc_type": _DOC_TYPES[it["metaType"]],
                    "published_date": _parse_date(it.get("publishedDate")),
                    "raw_text": _fetch_article_text(client, url),
                    "language_original": "en",
                }
            )
            time.sleep(CRAWL_DELAY_S)
        return records


def _fetch_article_text(client: httpx.Client, url: str) -> str | None:
    try:
        resp = client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None
    soup = BeautifulSoup(resp.text, "html.parser")
    container = (
        soup.find("main")
        or soup.find("article")
        or soup.find("div", id="content")
        or soup.body
    )
    if container is None:
        return None
    for tag in container.find_all(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    text = " ".join(container.get_text(" ").split())
    return text or None


def _parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        return None
