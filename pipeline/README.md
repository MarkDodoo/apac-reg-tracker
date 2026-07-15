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

## Run the dashboard

```bash
.venv\Scripts\streamlit run dashboard.py
```

Opens at http://localhost:8501 — stat tiles, sentiment/category/timeline
charts, and a filterable document table over the enriched corpus.

| Endpoint | Purpose |
|---|---|
| `GET /v1/regulations?source=HKMA&limit=20` | Newest documents, filterable |
| `GET /v1/regulations/search?q=stablecoin` | Keyword search |
| `GET /v1/regulations/semantic-search?q=...` | Meaning-based search (ChromaDB embeddings) |
| `GET /v1/ask?q=...` | RAG Q&A with numbered citations (local LLM, 30-90s) |
| `GET /v1/stats` | Corpus counts by source |

## Pipeline order

After ingesting new documents: `python -m app.enrich` (tags + summaries),
then `python -m app.embed` (adds them to the vector index — it embeds
title + summary, so enrich first).

## Sources implemented

| Source | Method | Status |
|---|---|---|
| HKMA press releases | Official Open API | Done |
| HKMA circulars/guidelines | HTML scraper (API doesn't expose them) | planned |
| MAS media releases | Sitemap + HTML scraper (no RSS/API exists) | Done |
| ASIC | RSS + data.gov.au | planned |
