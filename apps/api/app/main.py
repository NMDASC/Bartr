"""FastAPI entry point. Owner: Vir.

Every route in Plan.md section 7 exists here from hour 0, answering with the
contract examples, so the frontend and the market pair are never blocked on
each other. Owners replace bodies inside their own router file.
"""

import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db as database
from .config import get_settings
from .identity import get_current_user
from .llm import is_configured
from .routers import acquire, agent, companies, discovery, market, portfolio, surveillance
from .schemas import Health, UserOut

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await database.connect()
    yield
    await database.disconnect()


settings = get_settings()

app = FastAPI(
    title="JB API",
    version="0.1.0",
    description="Discovery engine and exchange for small businesses (HackCMU 2026).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (discovery, companies, market, portfolio, acquire, agent, surveillance):
    app.include_router(r.router, prefix=API_PREFIX)

# WebSocket lives outside the versioned REST prefix (section 7: /ws/markets/{id}).
app.include_router(market.ws_router)


@app.get("/health", response_model=Health, tags=["platform"])
async def health() -> Health:
    return Health(
        status="ok",
        env=settings.env,
        database=database.db_or_none() is not None,
        demo_auth=settings.demo_auth,
    )


@app.get("/readiness", tags=["platform"])
async def readiness() -> dict[str, Any]:
    """What is actually wired up. Useful during key collection."""
    s = get_settings()
    return {
        "database": database.db_or_none() is not None,
        "llm_xai": is_configured("xai"),
        "llm_ifm": is_configured("ifm"),
        "querit": bool(s.querit_api_key),
        "google_places": bool(s.google_places_api_key),
        "auth0": False,  # not wired yet, see docs/DECISIONS.md 002
    }


@app.get(f"{API_PREFIX}/me", response_model=UserOut, tags=["platform"])
async def me(user: dict[str, Any] = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=str(user["_id"]),
        name=user.get("name", ""),
        email=user.get("email"),
        cash=user.get("cash", 0.0),
        auth_provider=user.get("auth_provider", "demo"),
    )
