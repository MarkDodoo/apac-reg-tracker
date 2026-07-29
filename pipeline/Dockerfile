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

# Render sets $PORT; default to 8000 for local `docker run` testing.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
