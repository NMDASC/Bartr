FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /srv

# Dependencies first so code edits do not invalidate the layer.
COPY apps/api/pyproject.toml apps/api/uv.lock* ./apps/api/
WORKDIR /srv/apps/api
RUN uv sync --no-dev --no-install-project

COPY apps/api ./
COPY packages/contracts /srv/packages/contracts

ENV PATH="/srv/apps/api/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    CONTRACTS_EXAMPLES_DIR=/srv/packages/contracts/examples

EXPOSE 8000

# ONE WORKER ONLY. The WebSocket subscriber registry and the batch scheduler are
# in-process singletons; a second worker splits them and half the clients stop
# receiving batch events. See app/ws.py.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
