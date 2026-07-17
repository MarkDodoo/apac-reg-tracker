# APAC Regulation Tracker

AI-powered monitoring of regulatory developments across Asia-Pacific financial
regulators — built for compliance officers and risk analysts at financial
institutions and digital-asset businesses.

The system scrapes regulator publications daily, enriches every document with
a locally-run LLM (summaries, category tags, Restrictive/Neutral/Facilitative
sentiment, impact level), indexes them for semantic search, and answers
plain-English questions with cited sources — all running on local, free
infrastructure with no cloud LLM APIs.

## What it does

- **Multi-jurisdiction ingestion** — MAS (Singapore), HKMA (Hong Kong), and
  ASIC (Australia) today; each regulator needed a different technique (official
  API, sitemap + HTML scraping past a WAF, and a discovered newsroom JSON feed).
- **Local LLM enrichment** — qwen2.5:7b via Ollama writes compliance-officer
  summaries and classifies every document against a fixed taxonomy using
  JSON-schema-constrained output.
- **Regulatory sentiment** — each document scored Restrictive / Neutral /
  Facilitative with an impact level, so a dashboard can answer "what changed
  this week and how much does it matter?"
- **Semantic search + cited Q&A** — ChromaDB vector index; retrieval-augmented
  answers stream token-by-token into the web UI with numbered, linked citations.
  The model is instructed to answer only from retrieved sources.
- **Automated daily pipeline** — APScheduler chains ingest, text backfill,
  enrichment, and embedding; per-record commits make every stage safely
  resumable.

## Architecture

```
                                 pipeline/  (Python)
  MAS  ─ sitemap + HTML  ─┐
  HKMA ─ official API    ─┼─ ingest ─ SQLite/Postgres ─ enrich (Ollama qwen2.5)
  ASIC ─ newsroom JSON   ─┘              │                    │
                                         │              ChromaDB embeddings
                                         │                    │
                                    FastAPI  ── /v1/regulations · search ·
                                         │      semantic-search · ask · stream
        lawbook/  (Next.js) ─────────────┤
        Ask UI (SSE streaming, cited answers, background runs)
        Streamlit dashboard (sentiment, categories, timeline)
```

## Stack

| Layer | Choice |
|---|---|
| Data pipeline & API | Python, FastAPI, SQLAlchemy, httpx, BeautifulSoup |
| Storage | SQLite (dev) / PostgreSQL-ready, ChromaDB vector store |
| LLM | Ollama (qwen2.5:7b), all local — no cloud APIs |
| Web app | Next.js App Router (TypeScript), Server-Sent Events streaming |
| Dashboard | Streamlit + Altair |
| Auth | Better Auth + Cloudflare D1 |
| Scheduling | APScheduler |

## Quickstart

Backend (Python 3.12+, [Ollama](https://ollama.com) with `qwen2.5:7b` pulled):

```bash
cd pipeline
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m app.scheduler --once      # ingest + enrich + embed
.venv\Scripts\uvicorn app.main:app --port 8000    # API at /docs
.venv\Scripts\streamlit run dashboard.py          # dashboard at :8501
```

Web app (Node 20+):

```bash
cd lawbook
cp .env.example .env    # set BETTER_AUTH_SECRET; keep REG_TRACKER_API_URL
npm install --legacy-peer-deps
npm run d1:migrate:local
npm run dev             # app at :3000 — sign up, then use Ask
```

Details in [pipeline/README.md](pipeline/README.md). Progress, decisions, and
session history in [PROJECT_LOG.md](PROJECT_LOG.md).

## Status

Working now: three regulators ingested (136+ documents), full LLM enrichment,
semantic search, cited streaming Q&A in the web UI, dashboard, daily scheduler.
In progress: FinBERT sentiment comparison, in-app regulatory search, alerts,
recommender. See [PROJECT_LOG.md](PROJECT_LOG.md) for the live roadmap.

## Credits

Built on a fork of [Lawplain](https://github.com/yxlyx/lawplain), an
open-source Singapore legal research tool — its Next.js frontend, auth, and
SSE streaming patterns form the foundation of the web app (original README
preserved at [docs/lawplain-upstream-README.md](docs/lawplain-upstream-README.md)).
The data pipeline, LLM enrichment, vector search, RAG backend, dashboard, and
scheduler are new work.

This project provides regulatory information, not legal advice.

Maintained by Mark Dodoo.
