# Project Log — APAC Regulation Tracker

A living record of everything done on this project: decisions made, work completed, problems hit, and what's next. Update this file whenever the project changes. Newest session entries go at the top of the Session Log.

- **Repo:** https://github.com/MarkDodoo/apac-reg-tracker (forked from [yxlyx/lawplain](https://github.com/yxlyx/lawplain))
- **Project brief:** see [CLAUDE.md](CLAUDE.md) for the full vision, tech stack, and roadmap
- **Developer:** Mark Dodoo · **Mentor:** Xhoni

---

## Current Status

**Phase 1 — Foundation (in progress)**

| Milestone | Status |
|---|---|
| Fork lawplain, clone locally | ✅ Done |
| Run the app locally, verify search works | ✅ Done (2026-07-13) |
| Python data pipeline skeleton (FastAPI) | ✅ Done (2026-07-13) |
| Scrapers: MAS, HKMA, ASIC | 🔄 HKMA + MAS done; ASIC next |
| Database storage for regulations | ✅ SQLite dev DB (Postgres-ready via SQLAlchemy) |
| Sentiment scoring (FinBERT vs LLM bake-off) | ⬜ Not started |
| Basic dashboard of ingested docs | ⬜ Not started |

---

## Key Decisions

Decisions that shape the project, with reasoning. Add new ones at the bottom with a date.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-07-13 | **Replace the graff agent with plain RAG, not port it to Ollama.** | The lawplain "Ask" agent works by letting the LLM run `curl` commands in a sandbox (agentic tool-calling loop). Small local models (qwen3:4b) are unreliable at multi-step tool use. A retrieve-then-answer RAG pipeline (ChromaDB → prompt → stream) is simpler, more reliable, and keeps the nice streaming UI. |
| 2 | 2026-07-13 | **Our FastAPI backend replaces backend.lawplain.com entirely.** | The lawplain corpus is NOT in the repo — all search hits the original author's hosted API (`src/lib/sgjudge.ts`). Our backend will serve similar-shaped endpoints (e.g. `/v1/regulations/search`) so the frontend patterns transfer over. |
| 3 | 2026-07-13 | **Deployment: keep Next.js on Cloudflare (free), host FastAPI separately (Render/Hetzner).** Tentative — revisit at Phase 4. | The repo is built for Cloudflare Workers (D1 auth, Durable Objects). Python can't run on Workers. Splitting the two is the least rework. |
| 4 | 2026-07-13 | **Deployed demo serves precomputed summaries/sentiment; live LLM Q&A demoed locally.** | A €4 VPS can't run qwen3:4b at usable speed. Overnight local batches → push results to the hosted DB. |
| 5 | 2026-07-13 | **SQLite for dev, via SQLAlchemy with portable column types (JSON, not ARRAY).** | Zero-install local dev; switching to Supabase Postgres later is just setting `DATABASE_URL`. The brief's Postgres schema is preserved field-for-field in `pipeline/app/models.py`. |

---

## Open Questions / To Discuss with Xhoni

- FinBERT classifies financial sentiment (positive/negative/neutral), **not** regulatory stance (Restrictive/Neutral/Facilitative). Plan: small bake-off in Phase 1 — vanilla FinBERT vs `qwen2.5:3b` with a classification prompt — before committing.
- Confirm the RAG-instead-of-agent decision (Decision #1).
- Keep or strip the lawplain auth/Cloudflare machinery long-term?

---

## Session Log

### 2026-07-14 — Session 3: MAS scraper

**Done:**
- Built the MAS scraper (`app/scrapers/mas.py`). MAS has **no RSS and no usable news API** (probed: `/rss*` all 404; the site's own search API returns a maintenance page to non-browser clients). Approach that works:
  - `sitemap.xml` lists ~1,816 media releases (plus ~1,472 regulation docs — future source) with the year in each URL.
  - Article pages are server-rendered: title from `og:title`, date from the "Published Date:" line, body from `mas-rte-content` blocks.
  - **Gotcha for future scrapers:** the MAS WAF blocks requests unless they look like a real browser — the `Accept` header matters, not just User-Agent.
  - Respects the 2s crawl delay from robots.txt; skips already-ingested URLs so the crawl budget goes to new documents.
- Refactored `app/ingest.py` for multiple sources: `--source all|hkma|mas`.
- **Verified end-to-end:** 12 MAS releases ingested with full text (~64k chars), dates parsed; corpus now 72 docs across 2 jurisdictions; cross-source search working (e.g. "monetary policy" → 4 MAS hits).

**Next up:**
- Ollama enrichment pass: qwen2.5:3b category tagging + sentiment, qwen3:4b summaries → fill the `null` columns.
- ASIC scraper after that.

### 2026-07-13 — Session 2: Python pipeline + first scraper (HKMA)

**Done:**
- Built the `pipeline/` backend from scratch (see [pipeline/README.md](pipeline/README.md) for usage):
  - SQLAlchemy model mirroring the unified schema from the brief (`app/models.py`), SQLite dev DB in `pipeline/data/` (gitignored) → Decision #5.
  - HKMA scraper (`app/scrapers/hkma.py`) using the official Open API for press releases, plus BeautifulSoup full-text extraction from article pages.
  - Ingestion runner (`app/ingest.py`) — upserts by `source_url`, commits per record so partial progress survives errors, polite 1s delay on page fetches.
  - FastAPI app (`app/main.py`) with `/v1/regulations` (list/filter), `/v1/regulations/search` (keyword), `/v1/stats` — endpoint shapes mirror the lawplain backend style so the frontend transfers easily.
- **Verified end-to-end:** ingested 60 real HKMA press releases (5 with full text); search for "fraud" returns 3 correct hits via the API.

**Notes / limitations:**
- HKMA Open API only exposes press releases — circulars/guidelines will need an HTML scraper (probed `circulars`, `guidelines`, `consultations`, `speeches`: all 404).
- Search is keyword LIKE for now; ChromaDB semantic search is Phase 2.
- API docs UI at http://localhost:8000/docs when running.

**Next up:**
- MAS scraper (RSS), then ASIC.
- First Ollama pass: qwen2.5:3b category tagging + qwen3:4b summaries on ingested docs.

### 2026-07-13 — Session 1: Repo assessment + local setup

**Done:**
- Reviewed the full lawplain codebase against the project brief. Three findings that changed the plan:
  1. The search corpus lives behind `https://backend.lawplain.com`, not in the repo → Decision #2.
  2. The Ask agent is a sandboxed agentic curl-loop (~790 lines in `lawbook/src/lib/agent.ts` + Durable Objects), far more complex than "swap an API call" → Decision #1.
  3. The repo targets Cloudflare Workers; the brief assumed Render/Hetzner + Postgres → Decision #3.
- Confirmed local environment: Node v25.8, npm 11.16, Python 3.14.2, all 4 Ollama models present (qwen2.5:3b/7b, qwen3:4b, gpt-oss:20b).
- Created this PROJECT_LOG.md.
- **Local app setup completed and verified:** created `lawbook/.env` (gitignored) with a generated `BETTER_AUTH_SECRET`, installed dependencies, applied all 18 local D1 migrations, started `npm run dev` — homepage serves HTTP 200 and the backend search API (backend.lawplain.com) returns real results.

**Environment notes:**
- The upstream repo uses Bun, but npm works — use `npm install --legacy-peer-deps` (plain `npm install` fails on a `@cloudflare/workers-types` v4-vs-v5 peer conflict).
- npm blocked `esbuild`/`workerd`/`sharp` postinstall scripts on first install; fixed with `npm approve-scripts esbuild workerd sharp unrs-resolver` then `npm rebuild`.
- `lawbook/AGENTS.md` warns: Next.js 16 has breaking changes vs. what LLMs know — read `node_modules/next/dist/docs/` before writing frontend code.
- Local run requires: `.env` in `lawbook/` (Better Auth secret at minimum) + `npm run d1:migrate:local` for the auth DB.

**Next up:**
- Scaffold the Python pipeline (`pipeline/` folder at repo root): FastAPI app + first MAS scraper.
- Choose Postgres flavour for dev (local Postgres vs Supabase free tier).

---

## How to Run (Dev)

```bash
cd lawbook
npm install --legacy-peer-deps
npm run d1:migrate:local   # one-time: create local auth DB
npm run dev                # app at http://localhost:3000
```

Environment: copy `lawbook/.env.example` → `lawbook/.env` and fill in `BETTER_AUTH_SECRET` (generate with `openssl rand -base64 32`). Google OAuth keys are optional for local dev. **Never commit `.env`.**
