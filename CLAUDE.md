# APAC Regulation Tracker — Project Brief for Claude

This file gives you full context on the project so you don't need to re-explain anything from previous sessions.

---

## What We're Building

An AI-powered platform that monitors, aggregates, and analyses regulatory developments across the Asia-Pacific region in real time. The target users are compliance officers and risk analysts at Financial Institutions and Crypto/Digital Asset businesses.

Core features:
- Live ingestion of regulatory updates from APAC regulators (MAS, HKMA, ASIC, RBI, FSA Japan, FSC Korea)
- LLM-powered summarisation and entity extraction
- FinBERT-based sentiment analysis (Restrictive / Neutral / Facilitative)
- Personalised recommender — matches regulations to user profile (jurisdiction, institution type, asset class)
- Searchable dashboard with heatmap, sentiment trends, and alert system

---

## Developer

**Mark Dodoo** — BCom Economics, Honours Economics, studying Masters in Business Analytics. Comfortable with Python and data analysis. Still building backend/MLOps skills. Working with mentor **Xhoni**.

---

## Repo Foundation — Forked from Lawplain

We are building on top of: https://github.com/yxlyx/lawplain

Lawplain is a Singapore legal corpus search tool (NUS student project). We are forking it because:
- The NLP search UI and agent pipeline are already working
- The auth system (Better Auth, username/password + Google OAuth) is done
- The streaming cited-answer agent pattern is exactly what we need for regulatory Q&A

**What we keep from lawplain:**
- Next.js App Router frontend (TypeScript)
- `graff` agent framework for the Ask/search flow
- Better Auth + Cloudflare D1 for user accounts
- Server-Sent Events streaming pattern

**What we replace/add:**
- Data source: swap Singapore legal corpus → APAC regulatory feeds (MAS, HKMA, ASIC, RBI etc.)
- Replace `graff` cloud API calls with Ollama local model integration
- Add: sentiment analysis layer (FinBERT), recommender system, dashboard, real-time monitoring pipeline, alert/notification system

---

## Local Machine — Ollama Models Available

Mark has the following models installed and tested:

| Model | Size | Best Use |
|---|---|---|
| `qwen2.5:3b` | 1.9 GB | Quick tagging, classification, routing |
| `qwen3:4b` | 2.5 GB | Default for live summarisation and Q&A |
| `qwen2.5:7b` | 4.7 GB | Batch metadata extraction, structured field parsing |
| `gpt-oss:20b` | 13 GB | Deep legal/regulatory analysis, overnight batch only |

**Recommended pipeline:**
- First pass (real-time): `qwen2.5:3b` — category tag + quick sentiment
- Summarisation (real-time): `qwen3:4b` — 2–3 sentence summary + entity extraction
- Metadata (batch): `qwen2.5:7b` — structured fields (date, entities, type)
- Deep analysis (overnight): `gpt-oss:20b` — complex cross-jurisdictional analysis

Use the `ollama` Python package: `pip install ollama`

---

## Data Sources

| Source | Jurisdiction | Access | Cost |
|---|---|---|---|
| MAS | Singapore | RSS + Scraper | Free |
| HKMA | Hong Kong | RSS + Public API (apidocs.hkma.gov.hk) | Free |
| ASIC | Australia | RSS + data.gov.au | Free |
| RBI | India | Scraper | Free |
| FSA | Japan | Scraper + LLM translate | Free |
| BIS / FSB | International | RSS | Free |
| GDELT | Global news | REST API | Free |
| NewsAPI | News | REST API | Free (100 req/day limit) |

**Key resources:**
- HKMA API docs: https://apidocs.hkma.gov.hk/apidata/
- MAS API Playbook PDF: https://www.mas.gov.sg/-/media/MAS/Smart-Financial-Centre/API/ABSMASAPIPlaybook.pdf
- MAS datasets: https://data.gov.sg/datasets?agencies=Monetary+Authority+of+Singapore+%28MAS%29

---

## Unified Document Schema (PostgreSQL)

```sql
CREATE TABLE IF NOT EXISTS regulations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source            VARCHAR(50)   NOT NULL,
    source_url        TEXT          UNIQUE NOT NULL,
    jurisdiction      VARCHAR(100),
    title             TEXT          NOT NULL,
    raw_text          TEXT,
    summary           TEXT,
    language_original VARCHAR(10)   DEFAULT 'en',
    translated        BOOLEAN       DEFAULT FALSE,
    doc_type          VARCHAR(100),      -- Press Release | Consultation Paper | Circular | Guidance | News
    categories        TEXT[],            -- [Crypto, Banking, AML/KYC, ESG, ...]
    affected_entities TEXT[],            -- [Banks, DCEs, Insurers, All FIs, ...]
    published_date    DATE,
    effective_date    DATE,
    comment_deadline  DATE,
    ingested_at       TIMESTAMP     DEFAULT NOW(),
    sentiment_label   VARCHAR(20),       -- Restrictive | Neutral | Facilitative
    sentiment_score   FLOAT,
    impact_level      VARCHAR(10),       -- High | Medium | Low
    embedding_id      VARCHAR(255)       -- ChromaDB vector store ID
);
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js App Router (from lawplain) | TypeScript |
| Backend API | FastAPI (Python) | New — for data pipeline |
| Database | PostgreSQL / Supabase free tier | Structured regulatory data |
| Vector DB | ChromaDB (local, free) | Embeddings for semantic search |
| LLM | Ollama (local) | qwen3:4b default, see models above |
| Sentiment | FinBERT (Hugging Face, local) | Free, run locally |
| Scheduler | APScheduler | Cron jobs for ingestion |
| Auth | Better Auth (from lawplain) | Already implemented |
| Hosting | Render / Railway free tier or Hetzner ~€4/mo | Dev on localhost |

**Avoid:** Paid APIs during MVP. Twitter/X API ($100/mo), OpenAI API — use Ollama instead.

---

## Phased Roadmap

### Phase 1 — Foundation (Weeks 1–4)
- Fork lawplain, clone locally, verify search and Ask work
- Set up Python data pipeline alongside the Next.js frontend
- Build scrapers for MAS, HKMA, ASIC (3 regulators to start)
- Store raw documents in PostgreSQL
- Run FinBERT locally for sentiment scoring
- Basic Streamlit or integrated dashboard showing ingested docs with sentiment

### Phase 2 — Intelligence Layer (Weeks 5–8)
- Wire Ollama (qwen3:4b) into the Ask agent — replace graff cloud calls
- Add ChromaDB vector store and build RAG-powered search
- LLM translation for Japanese / Mandarin sources
- Entity extraction: jurisdiction, regulation type, effective date

### Phase 3 — Recommender & Alerts (Weeks 9–12)
- User profile system (institution type, jurisdiction interests)
- Content-based recommender using scikit-learn
- Email alert system for high-impact regulatory events
- Expand to RBI, FSA Japan, FSC Korea

### Phase 4 — Polish & Portfolio (Weeks 13–16)
- Improve dashboard: heatmaps, sentiment trends, jurisdiction filter
- Deploy on Render or Hetzner for live demo
- Write technical documentation
- Record demo video for portfolio / LinkedIn

---

## Immediate Next Step (Where We Are Now)

1. Fork https://github.com/yxlyx/lawplain on GitHub → rename `apac-reg-tracker`
2. Clone locally and run (`cd lawbook && npm install && npm run dev`)
3. Install graff and get free key (`graff login`) to test the Ask agent
4. Verify: does search work? Does Ask stream a cited answer?
5. Report findings to mentor Xhoni

**Known issue to flag to Xhoni:** `graff` requires a cloud API key — it does not support Ollama natively. Our plan when forking: replace the graff agent call in `src/app/api/ask/route.ts` and `src/lib/agent.ts` with a direct Ollama HTTP call. This keeps everything free and local.

---

## SWOT Summary

**Strengths:** Economics + Business Analytics background; unique finance-meets-AI angle; high market demand in RegTech.
**Weaknesses:** Solo project; needs backend/MLOps upskilling; APAC multi-lingual complexity.
**Opportunities:** RegTech VC sector growing; crypto regulation intensifying; strong portfolio piece.
**Threats:** Competitors (Compliance.ai, Axiom); LLM hallucination risk in legal context; scraper fragility.

---

## Key Files in lawplain to Know

| File | Purpose |
|---|---|
| `lawbook/src/lib/agent.ts` | graff agent system prompt + runAgent wrapper — **we will modify this to use Ollama** |
| `lawbook/src/app/api/ask/route.ts` | SSE route that spawns the agent — **we will modify this** |
| `lawbook/src/components/AskAgent.tsx` | Client-side streaming UI |
| `lawbook/.env.example` | Environment variables template |
| `lawbook/wrangler.jsonc` | Cloudflare Workers config + D1 database binding |

---

*Last updated: July 2026 | Maintained by Mark Dodoo*
