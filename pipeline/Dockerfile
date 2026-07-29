# Deployed API image (Render). Serves the precomputed corpus committed at
# deploy_data/ — the hosted demo doesn't scrape or run Ollama (see
# PROJECT_LOG: deployed Ask uses OpenAI via LLM_PROVIDER=openai, set as an
# env var on the Render service, never baked into the image).
FROM python:3.12-slim

WORKDIR /app

COPY requirements-deploy.txt .
RUN pip install --no-cache-dir -r requirements-deploy.txt

# Pre-warm the ChromaDB embedding model so the first real request isn't the
# one paying for the ~80MB download.
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction; DefaultEmbeddingFunction()(['warm up'])"

COPY app/ ./app/
COPY deploy_data/ ./data/

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Render (and many PaaS hosts) run the container filesystem read-only outside
# /tmp. SQLite needs write access to its own directory even for read-only
# queries (WAL/lock files) — both regulations.db and Chroma's internal
# sqlite hit this. Copy the baked snapshot to /tmp (always writable) at
# startup and point both DBs there via env vars, rather than baking to /tmp
# at build time (keeps the image itself portable to other hosts).
CMD ["sh", "-c", "mkdir -p /tmp/data && cp -r /app/data/* /tmp/data/ && DATABASE_URL=sqlite:////tmp/data/regulations.db CHROMA_DIR=/tmp/data/chroma uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
