"""Retrieval-augmented Q&A over the regulations corpus.

This is the replacement for lawplain's agentic "Ask" (PROJECT_LOG Decision #1):
retrieve top-k documents from ChromaDB, then have the local LLM answer from
that context with numbered citations. No tool-calling loop — deterministic
retrieval suits small local models far better.
"""

import ollama
from sqlalchemy import select

from app.db import SessionLocal
from app.embed import get_collection
from app.models import Regulation

ANSWER_MODEL = "qwen2.5:7b"

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


def _retrieve(question: str, k: int) -> tuple[list[str], list[dict]]:
    """Top-k retrieval -> (numbered context blocks, source descriptors)."""
    hits = semantic_search(question, limit=k)
    if not hits:
        return [], []

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
    for n, hit in enumerate(hits, 1):
        doc = docs.get(hit["id"])
        if not doc:
            continue
        body = (doc.raw_text or doc.summary or "")[:2500]
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
    return context_blocks, sources


def _answer_messages(question: str, context_blocks: list[str]) -> list[dict]:
    return [{
        "role": "user",
        "content": ANSWER_PROMPT.format(
            context="\n\n".join(context_blocks), question=question
        ),
    }]


def ask(question: str, k: int = 5) -> dict:
    """Retrieve top-k docs and answer with citations. Returns answer + sources."""
    context_blocks, sources = _retrieve(question, k)
    if not context_blocks:
        return {"answer": "The corpus is empty — ingest documents first.",
                "model": ANSWER_MODEL, "sources": []}

    resp = ollama.chat(
        model=ANSWER_MODEL,
        messages=_answer_messages(question, context_blocks),
        options={"temperature": 0.1, "num_ctx": 16384},
    )
    return {
        "answer": (resp.message.content or "").strip(),
        "model": ANSWER_MODEL,
        "sources": sources,
    }


def ask_stream(question: str, k: int = 5):
    """Streaming variant of ask(): yields event dicts shaped like the
    lawbook frontend's AgentEvents, so the Next.js route can proxy them
    straight through to the existing Ask UI.

      {"type": "progress", ...} -> retrieval started
      {"type": "tool", ...}     -> one per retrieved source (shown as chips)
      {"type": "delta", "text"} -> answer tokens as they generate
      {"type": "done", "text", "sources"} -> full answer + source list
    """
    yield {"type": "progress", "phase": "searching",
           "message": "Searching the regulatory corpus..."}
    context_blocks, sources = _retrieve(question, k)
    if not context_blocks:
        yield {"type": "error",
               "message": "The corpus is empty — ingest documents first."}
        return

    for s in sources:
        yield {"type": "tool", "name": "retrieve",
               "key": f"retrieve:{s['url']}",
               "summary": f"[{s['n']}] {s['source']}: {s['title'][:70]}",
               "kind": "search"}

    yield {"type": "progress", "phase": "answering",
           "message": f"Writing answer with {ANSWER_MODEL}..."}

    parts: list[str] = []
    stream = ollama.chat(
        model=ANSWER_MODEL,
        messages=_answer_messages(question, context_blocks),
        options={"temperature": 0.1, "num_ctx": 16384},
        stream=True,
    )
    for chunk in stream:
        text = chunk.message.content or ""
        if text:
            parts.append(text)
            yield {"type": "delta", "text": text}

    yield {"type": "done", "text": "".join(parts).strip(),
           "model": ANSWER_MODEL, "sources": sources,
           "costUsd": 0, "contextTokens": 0}
