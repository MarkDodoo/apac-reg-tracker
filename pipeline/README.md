# Data Pipeline — APAC Regulation Tracker

Python backend: scrapes APAC regulators, stores documents in a unified schema,
and serves them over a FastAPI REST API. This replaces the hosted
backend.lawplain.com the frontend originally depended on.

## Setup (one-time)

```bash
cd pipeline
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

## Ingest documents

```bash
.venv\Scripts\python -m app.ingest --max 50 --full-text 10
```

Data lands in `pipeline/data/regulations.db` (SQLite, gitignored).
Set `DATABASE_URL` to a Postgres URL to use Supabase instead.

## Run the API

```bash
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Then browse http://localhost:8000/docs (interactive Swagger UI).

| Endpoint | Purpose |
|---|---|
| `GET /v1/regulations?source=HKMA&limit=20` | Newest documents, filterable |
| `GET /v1/regulations/search?q=stablecoin` | Keyword search (semantic search in Phase 2) |
| `GET /v1/stats` | Corpus counts by source |

## Sources implemented

| Source | Method | Status |
|---|---|---|
| HKMA press releases | Official Open API | ✅ |
| HKMA circulars/guidelines | HTML scraper (API doesn't expose them) | planned |
| MAS | RSS + scraper | planned |
| ASIC | RSS + data.gov.au | planned |
