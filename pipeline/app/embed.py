"""Vector index over the regulations corpus (ChromaDB, local).

Embeds title + LLM summary per document — the summary is dense and short,
which suits the default all-MiniLM-L6-v2 embedder (~256-token window) far
better than raw article text. Chunked raw-text embedding can come later if
retrieval quality needs it.

Usage (from pipeline/):
    python -m app.embed            # index everything not yet indexed
    python -m app.embed --reindex  # rebuild the whole collection
"""

import argparse
from pathlib import Path

import chromadb
from sqlalchemy import select

from app.db import DATA_DIR, SessionLocal, init_db
from app.models import Regulation

CHROMA_DIR = str(Path(DATA_DIR) / "chroma")
COLLECTION = "regulations"


def get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    return client.get_or_create_collection(
        COLLECTION, metadata={"hnsw:space": "cosine"}
    )


def _doc_text(doc: Regulation) -> str:
    # Title + summary only. Adding category tags was tried (2026-07-16) and
    # measurably hurt ranking — topical tags correlate across unrelated docs
    # in a small corpus. The real upgrade path is a stronger embedder
    # (e.g. nomic-embed-text via Ollama) once retrieval quality matters more.
    parts = [doc.title]
    if doc.summary:
        parts.append(doc.summary)
    return "\n".join(parts)


def _metadata(doc: Regulation) -> dict:
    # Chroma metadata must be scalar; lists become comma-joined strings.
    return {
        "source": doc.source,
        "jurisdiction": doc.jurisdiction or "",
        "doc_type": doc.doc_type or "",
        "title": doc.title,
        "url": doc.source_url,
        "published_date": doc.published_date.isoformat()
        if doc.published_date
        else "",
        "sentiment_label": doc.sentiment_label or "",
        "impact_level": doc.impact_level or "",
        "categories": ",".join(doc.categories or []),
    }


def index(reindex: bool = False) -> None:
    init_db()
    if reindex:
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        try:
            client.delete_collection(COLLECTION)
        except Exception:
            pass
    col = get_collection()

    with SessionLocal() as session:
        stmt = select(Regulation)
        if not reindex:
            stmt = stmt.where(Regulation.embedding_id.is_(None))
        docs = session.scalars(stmt).all()
        print(f"Indexing {len(docs)} documents into ChromaDB...")

        batch = 32
        for i in range(0, len(docs), batch):
            chunk = docs[i : i + batch]
            col.upsert(
                ids=[d.id for d in chunk],
                documents=[_doc_text(d) for d in chunk],
                metadatas=[_metadata(d) for d in chunk],
            )
            for d in chunk:
                d.embedding_id = d.id
            session.commit()  # per-batch: progress survives interruption
            print(f"  {min(i + batch, len(docs))}/{len(docs)}")

    print(f"Collection size: {col.count()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Index corpus into ChromaDB")
    parser.add_argument("--reindex", action="store_true")
    args = parser.parse_args()
    index(reindex=args.reindex)


if __name__ == "__main__":
    main()
