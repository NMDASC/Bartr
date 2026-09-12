"""Surveillance routes. Owner: Aditya. STUBS -- replace bodies, keep signatures."""

from datetime import datetime

from fastapi import APIRouter

from ..examples import example
from ..schemas import AuditEntry, Flag

router = APIRouter(prefix="/surveillance", tags=["surveillance"])


@router.get("/flags", response_model=list[Flag])
async def flags(since: datetime | None = None) -> list[dict]:
    # TODO(Aditya): rules pass, then Grok and K2 as independent reviewers.
    return example("flags")


@router.get("/audit", response_model=list[AuditEntry])
async def audit(actor: str | None = None, since: datetime | None = None) -> list[dict]:
    # TODO(Aditya): read the append-only audit_log collection.
    return example("audit")
