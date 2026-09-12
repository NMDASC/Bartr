"""Query-specific ranking. Financial confidence never substitutes for relevance."""
from __future__ import annotations

import math
import os
import re
from collections import Counter
from functools import lru_cache
from urllib.parse import urlsplit

from .intent import _matches
from .models import RankInfo

STOP = {"in", "the", "a", "an", "and", "for", "of", "to", "with", "under", "over", "below", "above", "business", "businesses"}
ALIASES = {"laundry": "laundromat", "laundromats": "laundromat", "laundries": "laundromat", "cnc": "machining", "carwash": "car_wash"}


def tokens(text: str) -> list[str]:
    return [ALIASES.get(t, t) for t in re.findall(r"[a-z_]+", text.lower()) if t not in STOP and len(t) > 1]


def cosine(a: list[str], b: list[str]) -> float:
    x, y = Counter(a), Counter(b)
    denominator = math.sqrt(sum(v*v for v in x.values()) * sum(v*v for v in y.values()))
    return sum(v*y[k] for k, v in x.items()) / denominator if denominator else 0.0


@lru_cache(maxsize=1)
def embedding_model(path: str):
    # Explicitly opt in to an already installed model; never download in a request.
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(path, local_files_only=True)


def semantic_scores(query: str, texts: list[str]) -> tuple[list[float], str]:
    path = os.getenv("DISCOVERY_EMBEDDING_MODEL", "")
    if path:
        try:
            vectors = embedding_model(path).encode([query, *texts], normalize_embeddings=True)
            return [max(0., min(1., float(vectors[0] @ v))) for v in vectors[1:]], "sentence-transformers"
        except (ImportError, OSError, RuntimeError):
            pass
    return [cosine(tokens(query), tokens(t)) for t in texts], "token-cosine"


def text_for(c: dict) -> str:
    return " ".join(str(c.get(k) or "") for k in ("name", "category", "city", "state", "description"))


def rank_companies(query: str, intent: dict, companies: list[dict]) -> list[tuple[dict, dict]]:
    eligible = []
    for c in companies:
        if not _matches(c, intent):
            continue
        # A must-have is satisfied only by reported evidence. Missing is not true.
        facts = c.get("evidence", [])
        if any(not any(f.get("status") == "reported" and f.get("value") not in (False, None)
                       and set(tokens(requirement)).issubset(set(tokens(f.get("field", "") + " " + str(f.get("value", "")) + " " + f.get("quote", ""))))
                       for f in facts) for requirement in intent.get("must_have", [])):
            continue
        eligible.append(c)
    sem, method = semantic_scores(query, [text_for(c) for c in eligible])
    query_tokens = set(tokens(query))
    results = []
    for c, semantic in zip(eligible, sem):
        words = set(tokens(text_for(c)))
        keyword = len(query_tokens & words) / max(1, len(query_tokens))
        attrs = [str(v).lower() for v in (intent.get("category"), intent.get("city"), intent.get("state")) if v and v != "default"]
        preference = sum(v in text_for(c).lower() for v in attrs) / max(1, len(attrs))
        facts = c.get("evidence", [])
        # Multiple pages from the same publisher are not independent corroboration.
        independent = {(urlsplit(f.get("source_url") or "").hostname or "").lower().removeprefix("www.")
                       for f in facts if f.get("status") == "reported"}
        independent.discard("")
        evidence = min(1., len(independent) / 3)
        matched = sorted(query_tokens & words)
        unknown = [k for k in ("revenue", "sde", "asking_price") if (c.get("observables") or {}).get(k) is None]
        score = .55*semantic + .25*preference + .15*keyword + .05*evidence
        info = RankInfo(rank=0, score=round(score, 6), semantic=round(semantic, 6), keyword=round(keyword, 6),
                        preference=round(preference, 6), evidence=evidence, matched=matched, unknown=unknown, semantic_method=method)
        results.append((c, info.model_dump()))
    results.sort(key=lambda item: (-item[1]["score"], item[0]["name"].casefold(), item[0]["id"]))
    for i, (_, rank) in enumerate(results, 1):
        rank["rank"] = i
    return results
