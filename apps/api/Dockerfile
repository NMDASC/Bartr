FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /srv/apps/api

# Dependencies first so code edits do not invalidate the layer.
COPY apps/api/pyproject.toml apps/api/uv.lock* ./
RUN uv sync --no-dev --no-install-project

COPY apps/api ./

ENV PATH="/srv/apps/api/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/srv/apps/api

EXPOSE 8000

# ONE WORKER ONLY. The websocket hub, the engine and the batch scheduler are
# in-process singletons; a second worker would clear batches twice and half the
# clients would never receive the events. See app/deps.py and app/ws hub.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
