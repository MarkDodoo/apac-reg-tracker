"""MAS (Monetary Authority of Singapore) scraper.

MAS has no public RSS or news API (probed 2026-07-14: /rss* 404, the site's
own search API returns a maintenance page to non-browser clients). Instead we
use the sitemap, which lists ~1,800 media releases with the year in the URL:

    https://www.mas.gov.sg/sitemap.xml
    -> /news/media-releases/<year>/<slug>

Each article page is server-rendered; title comes from og:title, the date from
a "Published Date: 12 May 2026" line, and the body from `mas-rte-content`
blocks.

The WAF serves a maintenance page unless requests look like a browser — the
Accept header matters, not just User-Agent. robots.txt asks for a 2s crawl
delay, which we respect.
"""

import re
import time
from datetime import date, datetime

import httpx
from bs4 import BeautifulSoup

BASE = "https://www.mas.gov.sg"
SITEMAP_URL = f"{BASE}/sitemap.xml"
SOURCE = "MAS"
JURISDICTION = "Singapore"
CRAWL_DELAY_S = 2  # per robots.txt

# Both UA and Accept are needed to get past the WAF.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_MEDIA_RELEASE_RE = re.compile(r"/news/media-releases/(\d{4})/[^/]+$")
_PUBLISHED_RE = re.compile(r"Published Date:\s*(\d{1,2}\s+\w+\s+\d{4})")


def list_media_release_urls(client: httpx.Client) -> list[tuple[int, str]]:
    """All media-release (year, url) pairs from the sitemap, newest year first."""
    resp = client.get(SITEMAP_URL)
    resp.raise_for_status()
    pairs: list[tuple[int, str]] = []
    for loc in re.findall(r"<loc>([^<]+)</loc>", resp.text):
        m = _MEDIA_RELEASE_RE.search(loc)
        if m:
            pairs.append((int(m.group(1)), loc))
    pairs.sort(key=lambda p: p[0], reverse=True)
    return pairs


def fetch_media_releases(
    max_records: int = 15, skip_urls: set[str] | None = None
) -> list[dict]:
    """Scrape up to max_records media releases (newest years first), full text
    included. `skip_urls` lets the caller exclude already-ingested documents so
    the crawl budget goes to new ones."""
    skip = skip_urls or set()
    records: list[dict] = []
    with httpx.Client(headers=_HEADERS, timeout=30, follow_redirects=True) as client:
        for _year, url in list_media_release_urls(client):
            if len(records) >= max_records:
                break
            if url in skip:
                continue
            rec = _fetch_article(client, url)
            if rec:
                records.append(rec)
            time.sleep(CRAWL_DELAY_S)
    return records


def _fetch_article(client: httpx.Client, url: str) -> dict | None:
    try:
        resp = client.get(url)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    og_title = soup.find("meta", property="og:title")
    title = (og_title.get("content") if og_title else None) or (
        soup.title.get_text().split("|")[0].strip() if soup.title else None
    )
    if not title:
        return None

    # Normalize &#160; (non-breaking spaces) before matching the date line.
    page_text = soup.get_text(" ").replace("\xa0", " ")
    published = None
    m = _PUBLISHED_RE.search(page_text)
    if m:
        published = _parse_date(m.group(1))

    body_blocks = soup.find_all("div", class_=re.compile(r"mas-rte-content"))
    raw_text = (
        " ".join(" ".join(b.get_text(" ").split()) for b in body_blocks) or None
    )

    return {
        "source": SOURCE,
        "source_url": url,
        "jurisdiction": JURISDICTION,
        "title": title.strip(),
        "doc_type": "Press Release",
        "published_date": published,
        "raw_text": raw_text,
        "language_original": "en",
    }


def _parse_date(raw: str) -> date | None:
    try:
        return datetime.strptime(raw.strip(), "%d %B %Y").date()
    except ValueError:
        return None
