"""Additive discovery contracts. Existing company and market shapes stay compatible."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, ConfigDict
from app.schemas import SearchIntent


class Evidence(BaseModel):
    field: str
    value: float | str | bool | None
    source_url: str
    quote: str
    status: Literal["reported", "inferred"] = "reported"
    currency: str | None = None
    period: str | None = None
    fetched_at: str | None = None


class ExtractedCompany(BaseModel):
    name: str
    category: str
    city: str | None
    state: str | None
    address: str | None
    website: str | None
    phone: str | None
    description: str | None
    evidence: list[Evidence]


class ExtractedCompanies(BaseModel):
    companies: list[ExtractedCompany] = Field(default_factory=list, max_length=20)


class ParsedIntent(SearchIntent):
    """Grok schema reuses the team's existing search contract."""


class RankInfo(BaseModel):
    rank: int
    score: float
    semantic: float
    keyword: float
    preference: float
    evidence: float
    matched: list[str]
    unknown: list[str]
    version: str = "relevance-v1"
    semantic_method: str = "token-cosine"


class DiscoveryRequest(BaseModel):
    q: str = Field(min_length=1, max_length=500)
    live: bool | None = None
    limit: int = Field(default=20, ge=1, le=50)


class CalibrationEntry(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    bias: float = 0
    sigma: float = Field(gt=0, le=3)
    count: int = Field(ge=2)


class CalibrationProfile(BaseModel):
    version: str = Field(min_length=1)
    target: Literal["asking", "sale"]
    category: str | None = None
    benchmark_version: str = "legacy-priors-2026-09-11"
    estimators: dict[str, CalibrationEntry]
