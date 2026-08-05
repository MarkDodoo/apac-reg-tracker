"""Retrieval-augmented Q&A over the regulations corpus.

This is the replacement for lawplain's agentic "Ask" (PROJECT_LOG Decision #1):
retrieve top-k documents from ChromaDB, then have the local LLM answer from
that context with numbered citations. No tool-calling loop — deterministic
retrieval suits small local models far better.
"""

import os
from datetime import date

from sqlalchemy import select

from app.db import SessionLocal
from app.embed import get_collection
from app.models import AskUsage, Regulation

# "ollama" (default, free, local — every dev/local setup) or "openai" (only
# set on the deployed backend, which has no GPU to run Ollama on). See
# PROJECT_LOG: this is the one deliberate, scoped exception to "no paid
# APIs" — used only for the hosted demo, never local dev.
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "ollama")

# Override with e.g. ANSWER_MODEL=qwen2.5:3b for faster (weaker) answers on CPU.
ANSWER_MODEL = os.environ.get("ANSWER_MODEL", "qwen2.5:7b")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# Spending guard for the deployed (OpenAI) path only — Ollama calls are free
# and uncounted. A shared visitor budget, not per-user (no accounts needed
# to use Ask). Deliberately conservative for a portfolio demo.
ASK_DAILY_LIMIT = int(os.environ.get("ASK_DAILY_LIMIT", "80"))

# Sources below this cosine similarity are dropped (keeping at least MIN_SOURCES)
# — they add prompt-processing time and noise, and the model ignores them anyway.
MIN_RELEVANCE = 0.30
MIN_SOURCES = 2
BODY_CHARS = 1500  # per-source text budget; CPU prompt processing is the bottleneck

# Below this top-hit relevance, retrieval was a stretch — quietly offer an
# expert referral instead of hedging in the answer itself (Xhoni's idea #4,
# reframed per the "never say the AI is unsure" discussion, PROJECT_LOG
# Session 20). This is never shown as doubt language; see reg-agent.ts for
# how the frontend renders it as a positive-framed suggestion.
EXPERT_SUGGESTION_THRESHOLD = 0.45

ANSWER_PROMPT = """You are a regulatory research assistant for APAC financial
compliance officers. Answer the question using ONLY the numbered sources below.

Rules:
- Cite sources inline as [1], [2] etc. after each claim.
- If the sources don't answer the question, say so plainly — never invent
  regulations, dates, or requirements.
- Be concise: a direct answer first, then supporting detail.
- This is regulatory information, not legal advice.

SOURCES:
{context}

QUESTION: {question}

ANSWER:"""


def semantic_search(query: str, limit: int = 10) -> list[dict]:
    """Top-k semantic matches with metadata and relevance (cosine similarity)."""
    col = get_collection()
    res = col.query(query_texts=[query], n_results=min(limit, max(col.count(), 1)))
    hits = []
    for id_, dist, meta in zip(
        res["ids"][0], res["distances"][0], res["metadatas"][0]
    ):
        hits.append({"id": id_, "relevance": round(1 - dist, 4), **meta})
    return hits


def _retrieve(
    question: str, k: int
) -> tuple[list[str], list[dict], list[dict]]:
    """Top-k retrieval -> (numbered context blocks, source descriptors,
    expert suggestions).

    Weak matches (below MIN_RELEVANCE) are dropped, keeping at least
    MIN_SOURCES so the model always has something to reason over. If even
    the best match is weak (below EXPERT_SUGGESTION_THRESHOLD), also
    returns a short expert-referral list matched on the retrieved docs'
    own jurisdictions/categories — computed here because this is where the
    full Regulation rows (with categories/jurisdiction) are in scope.
    """
    hits = semantic_search(question, limit=k)
    if not hits:
        return [], [], []
    strong = [h for h in hits if h["relevance"] >= MIN_RELEVANCE]
    hits = strong if len(strong) >= MIN_SOURCES else hits[:MIN_SOURCES]

    with SessionLocal() as session:
        docs = {
            d.id: d
            for d in session.scalars(
                select(Regulation).where(
                    Regulation.id.in_([h["id"] for h in hits])
                )
            )
        }

    context_blocks = []
    sources = []
    top_relevance = 0.0
    jurisdictions: set[str] = set()
    categories: set[str] = set()
    for n, hit in enumerate(hits, 1):
        doc = docs.get(hit["id"])
        if not doc:
            continue
        top_relevance = max(top_relevance, hit["relevance"])
        if doc.jurisdiction:
            jurisdictions.add(doc.jurisdiction)
        categories.update(doc.categories or [])
        body = (doc.raw_text or doc.summary or "")[:BODY_CHARS]
        context_blocks.append(
            f"[{n}] {doc.title}\n"
            f"    Source: {doc.source} ({doc.jurisdiction}), "
            f"published {doc.published_date}\n"
            f"    Summary: {doc.summary}\n"
            f"    Text: {body}"
        )
        sources.append(
            {
                "n": n,
                "title": doc.title,
                "source": doc.source,
                "published_date": str(doc.published_date),
                "url": doc.source_url,
                "relevance": hit["relevance"],
            }
        )

    experts: list[dict] = []
    if top_relevance < EXPERT_SUGGESTION_THRESHOLD:
        from app.experts import match_experts

        experts = match_experts(list(jurisdictions), list(categories), limit=2)

    return context_blocks, sources, experts


def _answer_messages(question: str, context_blocks: list[str]) -> list[dict]:
    return [{
        "role": "user",
        "content": ANSWER_PROMPT.format(
            context="\n\n".join(context_blocks), question=question
        ),
    }]


def _consume_budget() -> bool:
    """Atomically check-and-increment today's paid-provider call count.
    Returns False (call refused) once ASK_DAILY_LIMIT is reached."""
    today = date.today()
    with SessionLocal() as session:
        row = session.get(AskUsage, today)
        if row is None:
            row = AskUsage(day=today, count=0)
            session.add(row)
        if row.count >= ASK_DAILY_LIMIT:
            return False
        row.count += 1
        session.commit()
        return True


BUDGET_MESSAGE = (
    "This demo has reached its daily question limit (it runs on a small "
    "shared budget). Please try again tomorrow, or see the demo video for "
    "example answers."
)


def _openai_client():
    from openai import OpenAI  # lazy import: only installed/needed when deployed

    return OpenAI()


def ask(question: str, k: int = 5) -> dict:
    """Retrieve top-k docs and answer with citations. Returns answer + sources
    (+ experts, populated only when retrieval was weak — see
    EXPERT_SUGGESTION_THRESHOLD)."""
    context_blocks, sources, experts = _retrieve(question, k)
    if not context_blocks:
        return {"answer": "The corpus is empty — ingest documents first.",
                "model": ANSWER_MODEL, "sources": [], "experts": []}

    if LLM_PROVIDER == "openai":
        if not _consume_budget():
            return {"answer": BUDGET_MESSAGE, "model": OPENAI_MODEL,
                     "sources": [], "experts": []}
        resp = _openai_client().chat.completions.create(
            model=OPENAI_MODEL,
            messages=_answer_messages(question, context_blocks),
            temperature=0.1,
            max_tokens=700,
        )
        return {
            "answer": (resp.choices[0].message.content or "").strip(),
            "model": OPENAI_MODEL,
            "sources": sources,
            "experts": experts,
        }

    import ollama  # lazy: not installed in the deploy image (LLM_PROVIDER=openai)

    resp = ollama.chat(
        model=ANSWER_MODEL,
        messages=_answer_messages(question, context_blocks),
        options={"temperature": 0.1, "num_ctx": 8192},
    )
    return {
        "answer": (resp.message.content or "").strip(),
        "model": ANSWER_MODEL,
        "sources": sources,
        "experts": experts,
    }


def ask_stream(question: str, k: int = 5):
    """Streaming variant of ask(): yields event dicts shaped like the
    lawbook frontend's AgentEvents, so the Next.js route can proxy them
    straight through to the existing Ask UI.

      {"type": "progress", ...} -> retrieval started
      {"type": "tool", ...}     -> one per retrieved source (shown as chips)
      {"type": "delta", "text"} -> answer tokens as they generate
      {"type": "done", "text", "sources", "experts"} -> full answer, source
        list, and (only when retrieval was weak) expert suggestions
    """
    yield {"type": "progress", "phase": "searching",
           "message": "Searching the regulatory corpus..."}
    context_blocks, sources, experts = _retrieve(question, k)
    if not context_blocks:
        yield {"type": "error",
               "message": "The corpus is empty — ingest documents first."}
        return

    for s in sources:
        yield {"type": "tool", "name": "retrieve",
               "key": f"retrieve:{s['url']}",
               "summary": f"[{s['n']}] {s['source']}: {s['title'][:70]}",
               "kind": "search"}

    model_name = OPENAI_MODEL if LLM_PROVIDER == "openai" else ANSWER_MODEL
    yield {"type": "progress", "phase": "answering",
           "message": f"Writing answer with {model_name}..."}

    if LLM_PROVIDER == "openai" and not _consume_budget():
        yield {"type": "delta", "text": BUDGET_MESSAGE}
        yield {"type": "done", "text": BUDGET_MESSAGE, "model": model_name,
               "sources": [], "experts": [], "costUsd": 0, "contextTokens": 0}
        return

    parts: list[str] = []
    if LLM_PROVIDER == "openai":
        oa_stream = _openai_client().chat.completions.create(
            model=OPENAI_MODEL,
            messages=_answer_messages(question, context_blocks),
            temperature=0.1,
            max_tokens=700,
            stream=True,
        )
        for chunk in oa_stream:
            text = chunk.choices[0].delta.content or ""
            if text:
                parts.append(text)
                yield {"type": "delta", "text": text}
    else:
        import ollama  # lazy: not installed in the deploy image (LLM_PROVIDER=openai)

        stream = ollama.chat(
            model=ANSWER_MODEL,
            messages=_answer_messages(question, context_blocks),
            options={"temperature": 0.1, "num_ctx": 8192},
            stream=True,
        )
        for chunk in stream:
            text = chunk.message.content or ""
            if text:
                parts.append(text)
                yield {"type": "delta", "text": text}

    yield {"type": "done", "text": "".join(parts).strip(),
           "model": model_name, "sources": sources, "experts": experts,
           "costUsd": 0, "contextTokens": 0}
