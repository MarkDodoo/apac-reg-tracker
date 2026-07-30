# Project Log — APAC Regulation Tracker

A living record of everything done on this project: decisions made, work completed, problems hit, and what's next. Update this file whenever the project changes. Newest session entries go at the top of the Session Log.

- **Repo:** https://github.com/MarkDodoo/apac-reg-tracker (forked from [yxlyx/lawplain](https://github.com/yxlyx/lawplain))
- **Project brief:** see [CLAUDE.md](CLAUDE.md) for the full vision, tech stack, and roadmap
- **Developer:** Mark Dodoo · **Mentor:** Xhoni

---

## Current Status

**LIVE:** https://apac-reg-tracker.markirrzo.workers.dev (frontend, Cloudflare Workers) · API at https://apac-reg-tracker.onrender.com (backend, Render). Deployed 2026-07-29. **Self-refreshing daily** — see Decision #8; no local machine or manual steps required to keep it current.

**Phase 1 — Foundation: COMPLETE (2026-07-15, ~2 weeks ahead of the week-4 target)** — except the ASIC scraper and FinBERT bake-off, tracked below.

| Milestone | Status |
|---|---|
| Fork lawplain, clone locally | Done |
| Run the app locally, verify search works | Done (2026-07-13) |
| Python data pipeline skeleton (FastAPI) | Done (2026-07-13) |
| Scrapers: MAS, HKMA, ASIC | Done (2026-07-16) — all three regulators |
| Database storage for regulations | Done — SQLite dev DB (Postgres-ready via SQLAlchemy) |
| Sentiment scoring (FinBERT vs LLM bake-off) | Done (2026-07-17) — LLM wins 30/30 vs 24/30; see pipeline/eval/RESULTS.md |
| LLM summaries + category tagging | Done (2026-07-14) — full corpus enriched |
| Basic dashboard of ingested docs | Done (2026-07-15) — Streamlit, `pipeline/dashboard.py` |

---

## Key Decisions

Decisions that shape the project, with reasoning. Add new ones at the bottom with a date.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-07-13 | **Replace the graff agent with plain RAG, not port it to Ollama.** | The lawplain "Ask" agent works by letting the LLM run `curl` commands in a sandbox (agentic tool-calling loop). Small local models (qwen3:4b) are unreliable at multi-step tool use. A retrieve-then-answer RAG pipeline (ChromaDB → prompt → stream) is simpler, more reliable, and keeps the nice streaming UI. |
| 2 | 2026-07-13 | **Our FastAPI backend replaces backend.lawplain.com entirely.** | The lawplain corpus is NOT in the repo — all search hits the original author's hosted API (`src/lib/sgjudge.ts`). Our backend will serve similar-shaped endpoints (e.g. `/v1/regulations/search`) so the frontend patterns transfer over. |
| 3 | 2026-07-13 | **Deployment: keep Next.js on Cloudflare (free), host FastAPI separately (Render/Hetzner).** **Executed 2026-07-29** — live at the URLs in Current Status. | The repo is built for Cloudflare Workers (D1 auth, Durable Objects). Python can't run on Workers. Splitting the two is the least rework. |
| 4 | 2026-07-13 | **Deployed demo serves precomputed summaries/sentiment; live LLM Q&A demoed locally.** **Refined by Decision #7** — the corpus/summaries/sentiment part held (precomputed snapshot), but live Q&A turned out feasible via a cheap cloud model instead of staying local-only. | A €4 VPS can't run qwen3:4b at usable speed. Overnight local batches → push results to the hosted DB. |
| 5 | 2026-07-13 | **SQLite for dev, via SQLAlchemy with portable column types (JSON, not ARRAY).** | Zero-install local dev; switching to Supabase Postgres later is just setting `DATABASE_URL`. The brief's Postgres schema is preserved field-for-field in `pipeline/app/models.py`. |
| 6 | 2026-07-14 | **Batch enrichment uses qwen2.5:7b for both tagging and summaries**, not the brief's 3b/qwen3:4b split. | Measured: qwen3:4b leaks reasoning text into summaries (think=False ineffective on Ollama 0.30.10); qwen2.5:3b mislabelled 2/3 scam alerts Restrictive/High vs 7b's 3/3 Neutral/Low. 3b stays as the candidate for future *real-time* tagging; models overridable via `TAG_MODEL`/`SUMMARY_MODEL` env vars. |
| 7 | 2026-07-29 | **Deployed Ask/enrichment uses OpenAI (gpt-4o-mini) via an `LLM_PROVIDER` switch**, scoped strictly to the hosted/automated environment — every local setup still defaults to free Ollama. | Free hosts (Render) have no GPU to run Ollama. Narrow, deliberate exception to the brief's "avoid paid APIs" rule. Guardrails: daily `AskUsage` call cap (code-level) + a hard spending cap the user set on the OpenAI account itself (platform-level). Measured cost: ~$0.0007/Ask query — $15 credit covers ~20,000 queries. |
| 8 | 2026-07-29 | **A daily GitHub Action (not a local cron/scheduler) keeps the live deployment's corpus current**, committing a refreshed `pipeline/deploy_data` snapshot that Render auto-redeploys on. | The user wants the live link to stay current without depending on their own machine being on (e.g. when sharing with Xhoni). Reuses the OpenAI provider from Decision #7 — Actions runners have no GPU either. Verified: first run added 61 new documents (HKMA 21, MAS 15, ASIC 25) in under 3 minutes, corpus 312→373, live site updated automatically. |

---

## Open Questions / To Discuss with Xhoni

- **RESOLVED (2026-07-17): FinBERT bake-off.** FinBERT 24/30 vs qwen2.5:7b 30/30 on a 30-doc hand-labelled gold set. FinBERT's errors are systematic: scam alerts -> Restrictive (negative tone but no obligations on firms), enabling deregulation -> Neutral. Financial *tone* and regulatory *stance* are different constructs. Full writeup + caveats: `pipeline/eval/RESULTS.md`. LLM classification stays (Decision #6 confirmed). Would be strengthened by an independently-labelled sample from Mark or Xhoni.
- Confirm the RAG-instead-of-agent decision (Decision #1).
- Keep or strip the lawplain auth/Cloudflare machinery long-term?
- PDPA/deployment posture (see Session 9 notes): demo collects no third-party personal data; alerts demoed via local fake SMTP inbox.

---

## Session Log

### 2026-07-30 — Session 16: Homepage carousel + hover-preview cards

**Trigger:** user feedback — the "Latest developments" feed was "1-dimensional": bare headlines, no way to see what a story was about without leaving the page, no visual hook to grab interest.

**Done:**
- `NewsCarousel.tsx`: featured-stories carousel above the list (top 5 latest). Auto-rotates every 6.5s, pauses on hover, prev/next arrows, clickable dot indicators, explicit pause/play toggle (WCAG 2.2.2 — auto-moving content needs a stop control), and skips auto-rotation entirely when `prefers-reduced-motion` is set.
- `HitCard` redesigned: summary hidden by default (compact, scannable headline + meta row), revealed on **hover** (desktop, via mouseenter/mouseleave state) or **tap** (touch/keyboard — click toggles a "pinned" state independent of hover, since touch has no hover). A separate "Read full story" link inside the revealed panel does the actual navigation, so tapping the headline itself never leaves the page — only the explicit link does.
- New icons added (chevron down/left/right, play/pause) following the existing icon-file convention.
- **Verified visually, not just by typecheck**: no project run-skill existed yet, so used a one-off Playwright script (installed in scratchpad, not the project) to screenshot and interact with the live dev server — confirmed carousel dot-clicking switches stories correctly (including sentiment color), hover reveals the summary, click-to-pin survives mouse-leave, and zero console errors. Screenshots showed the redesign renders cleanly in the existing minimalist design language.
- **Found, not fixed (pre-existing, out of scope):** the inherited `AnalyticsConsentBanner` (lawplain original) visually overlaps list content at a certain scroll position — a fixed-position z-index issue unrelated to this change, worth a future look.

**Next up:** consider fixing the consent-banner overlap; redeploy to make this live.

### 2026-07-29 — Session 15: Automated daily corpus refresh

**Trigger:** user asked whether the "Latest developments" feed on the live site was current — it wasn't (frozen at the 2026-07-17 snapshot baked in during Session 14). Asked how to fix it "even when I send it to Xhoni" — i.e. wanted it to genuinely take care of itself, not a manual chore.

**Done:**
- `app/enrich.py` gained the same `LLM_PROVIDER` switch as `rag.py` (Decision #7 extended to enrichment, not just Ask): `openai` path uses gpt-4o-mini with strict JSON-schema structured output for tagging, plain completion for summaries. Tested locally first (2 real docs, correct categories/entities/summary) before trusting it unattended. Notably ~6s/doc vs Ollama's ~50s/doc — automation runs are fast.
- New `.github/workflows/refresh-corpus.yml` (Decision #8): daily cron (06:00 SGT) + manual `workflow_dispatch`. Runs `python -m app.scheduler --once` (reused as-is — already has the right per-source failure isolation) against `pipeline/deploy_data` directly via `DATABASE_URL`/`CHROMA_DIR` env overrides, then commits and pushes the refreshed snapshot. Render is repo-connected and auto-redeploys on that push — closes the loop with zero involvement from any local machine.
- Two GitHub repo settings needed for this to work (both completed via `gh` CLI, no browser/user action needed since the session already had an authenticated `gh` with `workflow` scope): Actions default workflow permissions read→write (so the job's `git push` succeeds), and the `OPENAI_API_KEY` repo secret (piped directly from the local `.env` file into `gh secret set`, never typed or displayed).
- **Verified with a real run, start to finish:** triggered manually, completed in 2m54s, found 61 new documents (HKMA 21, MAS 15, ASIC 25), enriched and embedded them, committed, pushed. Render auto-redeployed within ~20s of the push. Live corpus: 312 → 373. Newest live document now dated the day before the run (vs. 12 days stale before this session).

**Ongoing cost:** trivially small — enrichment + embedding of a daily trickle of new documents via gpt-4o-mini, well inside the existing $15/Decision #7 budget alongside Ask usage.

### 2026-07-29 — Session 14: Live deployment (Cloudflare + Render)

**The site is live.** Frontend on Cloudflare Workers, backend on Render, both on free tiers, both under the user's own accounts.

**Decision #7 — deployed Ask uses OpenAI (gpt-4o-mini), scoped narrowly:**
Free hosts can't run Ollama (no GPU/persistent process). `pipeline/app/rag.py` gained an `LLM_PROVIDER` switch: `ollama` (default, every local/dev setup, free, unchanged) or `openai` (set only via Render's env vars). This is a deliberate, narrow exception to the brief's "avoid paid APIs" rule — local dev never touches it. Guardrails: a `AskUsage` daily-count table caps paid calls (`ASK_DAILY_LIMIT`, default 80/day) before calling OpenAI; user separately set a hard spending cap in the OpenAI dashboard. Verified cost: ~$0.0007/query on gpt-4o-mini, so $15 credit covers ~20,000 queries even before the daily cap — the cap is a ceiling against misuse, not a real budget constraint.

**Precomputed data for deployment:** `pipeline/data/` stays gitignored (live, growing, local-only) but is a moving target — a GitHub-based Render build has nothing without a snapshot. Added `pipeline/deploy_data/` (5.5MB, regulations.db + chroma), committed, baked into the Docker image. Matches Decision #4 (deployed demo serves precomputed data).

**Bugs found and fixed this session (all real, all from actually testing against the live infra rather than trusting the plan):**
1. **Production Ask gate blocked our own backend.** `api/ask/route.ts` had a hard `production && (!useSandbox || !askRuns || !runId)` gate built for the old graff/CubeSandbox agent. Would have silently 500'd Ask in prod regardless of our RAG backend. Fixed: reg-agent is exempt from the CubeSandbox/DO requirement (it makes a plain server-side HTTP call, nothing to sandbox); in production it also skips the in-memory run-map path (Cloudflare Workers isolates don't reliably persist it across requests — that path stays for local dev, verified working there) in favour of a simple request-scoped stream, an acceptable trade given OpenAI answers in seconds.
2. **Render 500 on every endpoint touching Chroma.** Root cause via Render's live logs: `app/rag.py` imported `ollama` unconditionally at module load; the slim deploy image deliberately excludes that package (`requirements-deploy.txt`). Fixed: lazy-import `ollama` only inside the branch that actually uses it. (A first guess — read-only container filesystem needing /tmp — was wrong but harmless; left in place as defense-in-depth.)
3. **npm dependency conflict blocked the Cloudflare build entirely.** `@noble/ciphers`: better-auth needs v2, `@ecies/ciphers` (pulled in by `@opennextjs/cloudflare`'s dotenvx dependency) peer-needs v1. `--legacy-peer-deps` (used since Session 1 for an unrelated wrangler conflict) disables npm's peer-nesting algorithm entirely, so it silently used the wrong hoisted version instead of correctly nesting both. Fixed by switching to `npm install --force` (suppresses the same blocking errors, keeps modern peer resolution active) — resolved both this and the original conflict correctly.
4. **Stale `bun.lock`** (upstream artifact, never actually used — this project has always run npm) made the Cloudflare build tool try to invoke `bun run build`, which isn't installed. Removed. Also found `package-lock.json` was gitignored (again an upstream-bun assumption) — un-ignored and committed it, since throwing away the just-fixed dependency resolution by not committing the lockfile would have been a real regression risk.
5. **`WORKER_SELF_REFERENCE` service binding** still pointed at the old worker name `lawbook`; fixed to `apac-reg-tracker`.
6. Fresh Cloudflare account needed its `workers.dev` subdomain claimed via the dashboard once (no CLI path) before any deploy would accept — user did this, then deploy succeeded.

**Verified live, end-to-end, on the actual deployed URLs (not local):** homepage loads with correct branding; sign-up creates a real account in the new D1 database; `/api/regulations` search proxy returns real corpus data; a real authenticated POST to `/api/ask` streamed 250 delta events and produced a correctly grounded, cited answer (HKMA's Tokenised Bond Expert Group) with clickable numbered sources rendered exactly as designed.

**Known limitation, by design:** Render's free tier sleeps after 15 min idle; first request after a quiet spell takes 30-60s to wake. Fine for a portfolio demo, worth mentioning before sharing the link.

**Next up:** demo video; share link with Xhoni; optional depth (trends page, doc detail pages, weekly briefing, 4th regulator).

### 2026-07-19 — Session 13: Recommender, homepage feed, corpus deepening

**Context:** user feedback — "the platform feels a little bit empty."

**Done:**
- **Homepage "Latest developments" feed**: the idle homepage now shows the 8 newest documents as cards (shared `HitCard` component with search results) instead of just a search box.
- **Recommender** (`app/recommend.py`, Phase 3 item):
  - `GET /v1/recommendations?jurisdictions=&categories=` — content-based profile scoring: 2.0*category_overlap + 1.5*jurisdiction_match + impact weight + 90-day recency decay. Transparent weights, no user tracking (consistent with PDPA posture). Verified: a Hong Kong + Crypto/Fintech profile ranks the FSTB/HKMA DLT review first (4.28 vs 3.39 next).
  - `GET /v1/regulations/{id}/related` — embedding nearest neighbours. **Works but quality is embedder-limited** (returned ASIC penalties for the DLT doc); same MiniLM small-corpus issue as Session 8, same upgrade path (nomic-embed-text).
- **Corpus deepening backfill completed** (2026-07-20, 195 min unattended, 0 failures): **corpus now 312 documents, all with full text, enrichment, and embeddings** — HKMA 120, ASIC 125, MAS 67. Alert digest fired for 54 new High-impact documents. Future daily scheduler runs keep topping up.
- Operational note: background servers (API/app/dashboard/Mailpit) die with the Claude Code session that started them — data is never lost (SQLite/Chroma on disk), just restart them.

**Ideas backlog from the "feels empty" discussion** (not yet built): in-app trends page (port dashboard charts), internal document detail pages with pinned-context Ask + related docs, LLM-written weekly regulatory briefing page, RBI + FSC Korea scrapers.

### 2026-07-17 — Session 12: Email alerts (Phase 3 begins)

**Done:**
- New models: `AlertSubscription` (email, min impact, jurisdiction/category filters; empty = all) and `AlertLog` (per subscriber+document dedupe).
- `app/alerts.py`: matches enriched documents against each active subscription, sends one plain-text+HTML digest per subscriber per run, logs sends so nothing is ever re-sent. `--seed-demo` creates the demo subscriber (fictional address), `--dry-run` previews.
- **PDPA posture implemented as designed (Session 9):** SMTP defaults to localhost:1025 → Mailpit (installed via winget) catches all mail in a local browser inbox at http://localhost:8025. No real email can be sent without deliberately reconfiguring SMTP_HOST.
- Alerts wired into the daily scheduler as an isolated stage.
- **Verified end-to-end:** demo subscription (High impact, all jurisdictions) matched 42 documents; digest landed in Mailpit; re-run sent nothing (dedupe confirmed).

**Next up:** recommender (Phase 3); subscription management UI (deferred — currently CLI-seeded); legacy legal-page cleanup.

### 2026-07-17 — Session 11: FinBERT bake-off (Phase 1 fully complete)

**Done:**
- Built `pipeline/eval/`: 30-document hand-labelled gold set (stratified 10/10/10) + `finbert_bakeoff.py` runner (torch/transformers are eval-only deps, not in requirements.txt).
- **Result: FinBERT 24/30 (80%), qwen2.5:7b 30/30.** FinBERT's six errors are one systematic mistake — it measures financial tone, not regulatory stance: 4 scam alerts marked Restrictive, 2 facilitative deregulation items marked Neutral. It scored 10/10 on enforcement (where tone and stance coincide).
- Full writeup with methodology caveats in `pipeline/eval/RESULTS.md` — n=30, single non-blind rater, stratified by the LLM's own labels. Suggested follow-up: an independently labelled sample from Mark/Xhoni.
- This closes the last Phase 1 item and resolves the first open question for Xhoni.

**Next up:** email alerts (Mailpit demo, per PDPA decision); legacy legal-page cleanup; Phase 3 recommender.

### 2026-07-17 — Session 10: Homepage search swapped to our backend

**Done:**
- `lawbook/src/app/api/regulations/route.ts`: server-side proxy to the pipeline API (list / keyword / semantic) — keeps the backend URL private and avoids CORS. No auth: the corpus is public data.
- `lawbook/src/components/RegSearch.tsx`: new homepage search — keyword/semantic mode toggle, source filter chips (MAS/HKMA/ASIC), result cards with sentiment dot (same CVD-safe colors as the dashboard), impact, LLM summary, and external link to the regulator's page.
- Homepage (`page.tsx`/`HomeShell.tsx`) rewired: stats line now reads from our `/v1/stats`; the legal-corpus SearchExplorer is no longer used on the homepage.
- Semantic search endpoint now hydrates summaries/doc_type from the DB so both search modes render identical cards.
- **The app's two core surfaces (Search + Ask) now run entirely on our backend.** Lawplain's hosted API is still used only by the legacy legal document pages (/judgment, /statute, /document) — retained but unlinked; can be deleted in a cleanup pass.
- Verified end-to-end through the Next.js proxy: keyword "stablecoin" (1 hit), semantic "rules for crypto companies" (relevant ASIC/MAS hits with summaries), homepage renders our corpus stats.

**Note:** uvicorn `--reload` did not detect file changes on this Windows setup — restart the API manually after backend edits.

**Next up:** FinBERT bake-off; alerts (Mailpit demo); legacy legal-page cleanup.

### 2026-07-17 — Session 9: Rebrand + real README

**Done:**
- **Rebranded the web app** to APAC Regulation Tracker (wordmark "RegTracker." in nav/hero, full name in titles/metadata/footer). 24 files of user-visible copy changed: seo.ts (site name, title, description, keywords), homepage hero + tagline, footer (now credits the Lawplain foundation), auth screens, FAQ, welcome, "Ask RegTracker" throughout.
- **Deliberately NOT renamed:** env var names (`LAWPLAIN_*`), internal headers (`x-lawplain-user-id`), cookie prefixes, `backend.lawplain.com` URLs, and the graff fallback agent — renaming internals breaks running systems for zero user-visible gain. Recorded here so nobody "finishes" the rename by accident.
- **Replaced the root README** — the repo front page now describes this project (features, architecture diagram, stack, quickstart, status), with credit to lawplain; the upstream README is preserved at `docs/lawplain-upstream-README.md`.
- Verified: typecheck + lint clean, homepage and Ask page render with new branding; only remaining "Lawplain" on-page is the intentional footer credit.

**User decisions this session (from 2026-07-16 discussion):**
- Streamlit dashboard is a workbench, not the product face — restyle/fold into Next.js in Phase 4.
- PDPA/deployment: demo must not collect third-party personal data. Email alerts will be demonstrated with owner's address or a local fake SMTP inbox (e.g. Mailpit); public sign-up disabled or wiped for any deployed demo.

**Next up:** point Search UI at our /v1/regulations backend; FinBERT bake-off; alerts.

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
