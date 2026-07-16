# Project Log — APAC Regulation Tracker

A living record of everything done on this project: decisions made, work completed, problems hit, and what's next. Update this file whenever the project changes. Newest session entries go at the top of the Session Log.

- **Repo:** https://github.com/MarkDodoo/apac-reg-tracker (forked from [yxlyx/lawplain](https://github.com/yxlyx/lawplain))
- **Project brief:** see [CLAUDE.md](CLAUDE.md) for the full vision, tech stack, and roadmap
- **Developer:** Mark Dodoo · **Mentor:** Xhoni

---

## Current Status

**Phase 1 — Foundation: COMPLETE (2026-07-15, ~2 weeks ahead of the week-4 target)** — except the ASIC scraper and FinBERT bake-off, tracked below.

| Milestone | Status |
|---|---|
| Fork lawplain, clone locally | Done |
| Run the app locally, verify search works | Done (2026-07-13) |
| Python data pipeline skeleton (FastAPI) | Done (2026-07-13) |
| Scrapers: MAS, HKMA, ASIC | Done (2026-07-16) — all three regulators |
| Database storage for regulations | Done — SQLite dev DB (Postgres-ready via SQLAlchemy) |
| Sentiment scoring (FinBERT vs LLM bake-off) | In progress — LLM side done (qwen2.5:7b); FinBERT comparison pending |
| LLM summaries + category tagging | Done (2026-07-14) — full corpus enriched |
| Basic dashboard of ingested docs | Done (2026-07-15) — Streamlit, `pipeline/dashboard.py` |

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
| 6 | 2026-07-14 | **Batch enrichment uses qwen2.5:7b for both tagging and summaries**, not the brief's 3b/qwen3:4b split. | Measured: qwen3:4b leaks reasoning text into summaries (think=False ineffective on Ollama 0.30.10); qwen2.5:3b mislabelled 2/3 scam alerts Restrictive/High vs 7b's 3/3 Neutral/Low. 3b stays as the candidate for future *real-time* tagging; models overridable via `TAG_MODEL`/`SUMMARY_MODEL` env vars. |

---

## Open Questions / To Discuss with Xhoni

- FinBERT classifies financial sentiment (positive/negative/neutral), **not** regulatory stance (Restrictive/Neutral/Facilitative). Plan: small bake-off in Phase 1 — vanilla FinBERT vs `qwen2.5:3b` with a classification prompt — before committing.
- Confirm the RAG-instead-of-agent decision (Decision #1).
- Keep or strip the lawplain auth/Cloudflare machinery long-term?

---

## Session Log

### 2026-07-16 — Session 8: ASIC scraper, scheduler, RAG tuning

**Done:**
- **RAG speed/quality tuning** (user feedback: answers slow on CPU-only hardware — no GPU, so a 7b model takes 60-90s):
  - Relevance threshold (>= 0.30, keep min 2), per-source text budget 2500 -> 1500 chars, num_ctx 16384 -> 8192, `ANSWER_MODEL` env override (`qwen2.5:3b` for speed when demoing).
  - Tried embedding category tags into vectors; **measured it made ranking worse** (topically-tagged but irrelevant docs rose) — reverted. Documented in `embed.py`: the real upgrade path is a stronger embedder (e.g. nomic-embed-text).
  - Known issue remains: in a small corpus, same-regulator docs all look similar to MiniLM (professor appointments score ~0.45 for a green-finance query). Will improve as the corpus grows.
- **ASIC scraper** (`app/scrapers/asic.py`): no RSS, but the newsroom frontend loads everything from a public JSON file (~6,800 items with dates, types, topic tags) found in ASIC's own JS bundle — the richest source of our three regulators. Full text fetched per article. 20 items ingested on first run.
- **APScheduler runner** (`app/scheduler.py`): `--once` for a full manual run; default mode schedules daily 07:00 ingest -> backfill HKMA text -> enrich -> embed. Stage failures are isolated so one bad source doesn't stop the rest.
- **Verified with a full automated run** (71 min, CPU): picked up 44 new documents across all three sources, enriched 60, indexed everything. The run exposed a gap — HKMA docs entered enrichment without body text — fixed by adding the backfill stage to the scheduler.

**Corpus: 136 documents, 136 enriched, across 3 jurisdictions (HKMA 64, ASIC 45, MAS 27).**

**Next up:** FinBERT bake-off; rebrand UI to APAC Regulation Tracker; point Search UI at our backend; proper root README.

### 2026-07-16 — Session 7: Ask UI wired to local RAG (graff replaced)

**Done:**
- `pipeline`: added `GET /v1/ask/stream` — Server-Sent Events emitting AgentEvent-shaped JSON (progress, per-source "tool" chips, answer deltas from Ollama streaming, done-with-sources).
- `lawbook/src/lib/reg-agent.ts`: adapter exposing the same `AsyncGenerator<AgentEvent>` contract as the old graff agents, proxying the pipeline's SSE stream. On completion it appends a markdown "Sources" footer (numbered, clickable links) so citations render in the existing UI unchanged.
- Agent selection swapped in `ask-run-memory.ts` and `api/ask/route.ts`: when `REG_TRACKER_API_URL` is set (now in `.env`/`.env.example`), Ask uses our backend; graff paths remain as fallback.
- **Verified end-to-end through the real authenticated route:** signed up a test user (test@example.com), POST `/api/ask` streamed 171 answer deltas + cited answer for "What is MAS doing to support green finance?" — correct answer citing the Transition Planning guidelines and the US$250m ETAF first close. Run reconnection (`runId` + `from`) also works.
- Typecheck and Biome clean.

**Known limitations (future work):**
- Pinned-document context and multi-turn history are not yet forwarded to the RAG backend (single-turn Q&A only).
- Low-relevance sources (~0.3) still make it into the source list — consider a relevance threshold.
- The Search UI still hits backend.lawplain.com; swapping it to our `/v1/regulations` endpoints is a separate task.

**Next up:** ASIC scraper; APScheduler daily ingestion; FinBERT bake-off.

### 2026-07-15 — Session 6: ChromaDB + RAG Q&A (Phase 2 begins)

**Done:**
- `app/embed.py`: vector index over the corpus (ChromaDB persistent client, `pipeline/data/chroma/`, cosine space). Embeds **title + LLM summary** per document — dense and short, which suits the default all-MiniLM-L6-v2 embedder's ~256-token window better than raw article text. All 72 docs indexed; `embedding_id` tracked in the DB so only new docs get embedded on re-runs.
- `app/rag.py`: the lawplain "Ask" replacement (Decision #1 executed) — retrieve top-k from ChromaDB, answer with qwen2.5:7b from numbered sources only, citations inline, explicit "don't invent regulations" guardrails.
- Two new API endpoints: `GET /v1/regulations/semantic-search` and `GET /v1/ask`.
- **Verified end-to-end:** semantic search finds DLT/digital-bond docs for "rules for digital asset companies" (zero keyword overlap); `/v1/ask` on "what are regulators doing about DLT and digital assets?" produced a grounded, correctly-cited answer from 5 HKMA sources.
- Pipeline order documented: ingest → enrich → embed (embedding uses the summary, so enrich must run first).

**Next up:**
- Wire `/v1/ask` into the Next.js frontend (replace the graff agent call, keep the SSE streaming UI).
- ASIC scraper; APScheduler for automated daily ingestion; FinBERT bake-off.

### 2026-07-15 — Session 5: Streamlit dashboard — Phase 1 complete

**Done:**
- Built `pipeline/dashboard.py` (Streamlit + Altair): stat tiles, filter row (source / sentiment / impact / category / text search), three charts (documents over time, sentiment distribution, top categories), and a full document table with summaries and source links.
- Sentiment uses a **diverging color encoding** — Facilitative blue / Neutral gray / Restrictive red — with the pole colors CVD-validated for both light and dark mode (deliberately avoided the red/green colorblind trap).
- Run with: `cd pipeline && .venv\Scripts\streamlit run dashboard.py` → http://localhost:8501
- **Phase 1 of the roadmap is complete** (bar ASIC + FinBERT bake-off, deliberately deferred): fork verified, pipeline built, 2 regulators ingested (72 docs), LLM sentiment scoring, dashboard.

**Next up (Phase 2 — Intelligence layer):**
- ChromaDB vector store + RAG-powered Q&A (the lawplain "Ask" replacement).
- ASIC scraper; FinBERT bake-off; APScheduler for automated daily ingestion.

### 2026-07-14 — Session 4: LLM enrichment layer (Ollama)

**Done:**
- Backfilled full text for all remaining HKMA docs — corpus is now 72/72 with body text.
- Built `app/enrich.py`: category tagging, affected entities, Restrictive/Neutral/Facilitative sentiment (with score), impact level (qwen2.5:7b + JSON-schema structured output), and 2–3 sentence summaries. Two-pass design so Ollama never swaps models mid-run; per-document commits; `--limit`/`--redo` flags.
- **Enriched the full corpus: 72/72 documents, 0 failures, 61 min** on local hardware.
- Model findings → Decision #6 (7b over 3b/qwen3:4b for batch, with measurements).
- Prompt design notes: scam/consumer alerts must be explicitly called out as Neutral/Low or small models mark them Restrictive; fixed category/entity taxonomies enforced via JSON schema enums.
- `/v1/stats` now reports an `enriched` count.

**Resulting corpus profile:** 62 Neutral / 8 Facilitative / 2 Restrictive; top categories Banking (65), Consumer Protection (27), Monetary Policy (22). High-impact items are genuinely significant (e.g. HKMA fixed-income measures with PBoC, MAS dual-listing framework amendments).

**Next up:**
- Dashboard (Streamlit or simple Next.js page) showing the enriched corpus — completes Phase 1.
- FinBERT side of the sentiment bake-off (needs torch/transformers install).
- ASIC scraper.

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
