"""US city aliases and state-aware matching; unknown cities remain valid search targets."""
from __future__ import annotations

import re

# Shortcuts are conveniences, not a restriction on where discovery can search.
CITY_ROWS = [
    ("Pittsburgh", "PA", ("pittsburgh", "pgh")),
    ("New York", "NY", ("new york city", "nyc", "new york")),
    ("Miami", "FL", ("miami",)),
    ("Chicago", "IL", ("chicago",)),
    ("San Francisco", "CA", ("san francisco", "san fransisco", "sf")),
    ("Los Angeles", "CA", ("los angeles", "la")),
    ("Boston", "MA", ("boston",)), ("Seattle", "WA", ("seattle",)),
    ("Austin", "TX", ("austin",)), ("Dallas", "TX", ("dallas",)),
    ("Houston", "TX", ("houston",)), ("San Antonio", "TX", ("san antonio",)),
    ("Denver", "CO", ("denver",)), ("Atlanta", "GA", ("atlanta",)),
    ("Philadelphia", "PA", ("philadelphia", "philly")),
    ("Phoenix", "AZ", ("phoenix",)), ("San Diego", "CA", ("san diego",)),
    ("San Jose", "CA", ("san jose",)), ("Oakland", "CA", ("oakland",)),
    ("Sacramento", "CA", ("sacramento",)), ("Las Vegas", "NV", ("las vegas",)),
    ("Portland", "OR", ("portland",)), ("Portland", "ME", ("portland",)),
    ("Washington", "DC", ("washington dc", "washington d.c.", "dc")),
    ("Baltimore", "MD", ("baltimore",)), ("Detroit", "MI", ("detroit",)),
    ("Minneapolis", "MN", ("minneapolis",)), ("Milwaukee", "WI", ("milwaukee",)),
    ("Cleveland", "OH", ("cleveland",)), ("Columbus", "OH", ("columbus",)),
    ("Cincinnati", "OH", ("cincinnati",)), ("Nashville", "TN", ("nashville",)),
    ("Charlotte", "NC", ("charlotte",)), ("Raleigh", "NC", ("raleigh",)),
    ("Orlando", "FL", ("orlando",)), ("Tampa", "FL", ("tampa",)),
    ("Jacksonville", "FL", ("jacksonville",)), ("New Orleans", "LA", ("new orleans",)),
    ("St. Louis", "MO", ("st louis", "st. louis", "saint louis")),
    ("Kansas City", "MO", ("kansas city",)), ("Indianapolis", "IN", ("indianapolis",)),
    ("Tulsa", "OK", ("tulsa",)), ("Waco", "TX", ("waco",)),
    ("Homestead", "PA", ("homestead",)), ("Homestead", "FL", ("homestead",)),
    ("McKees Rocks", "PA", ("mckees rocks",)),
]
PITTSBURGH_METRO = {"pittsburgh", "homestead", "mckees rocks"}
PITTSBURGH_NEIGHBORHOODS = {"squirrel hill", "bloomfield", "lawrenceville", "south side", "strip district", "shadyside", "mcknight road", "mcknight rd", "oakland"}
NYC_BOROUGHS = {"brooklyn", "queens", "manhattan", "bronx", "the bronx", "staten island"}


def _contains(text: str, phrase: str) -> bool:
    return bool(re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text, re.I))


def parse_location(query: str, states: dict[str, str]) -> tuple[str | None, str | None]:
    lower = query.casefold()
    # Prefer an explicit state suffix; lowercase codes are accepted after a comma.
    codes = set(states.values()) | {"DC"}
    explicit = None
    for match in re.finditer(r",\s*([a-zA-Z]{2})(?!\w)|\b([A-Z]{2})\b", query):
        code = (match.group(1) or match.group(2)).upper()
        if code in codes and code not in {"LA"}:  # LA alone normally means Los Angeles.
            explicit = code
    if re.search(r",\s*la\b", lower):
        explicit = "LA"
    if not explicit:
        for name in sorted(states, key=len, reverse=True):
            if _contains(lower, name):
                explicit = states[name]
                break
    if _contains(lower, "washington dc") or _contains(lower, "washington d.c."):
        explicit = "DC"

    # Prefer the location clause to words in the business name/category.
    clause = re.search(r"\b(?:in|near|around)\s+(.+?)(?=\s+(?:under|over|with|below|above|that|for|within|and|or|then|please|show|give|tell|which|who|what|where|by)\b|[!?.,;]|$)", lower)
    target = clause.group(1).strip() if clause else lower
    city_text = target.split(",", 1)[0].strip()
    if clause:
        for suffix in [*sorted(states, key=len, reverse=True), *codes]:
            city_text = re.sub(rf"\s+{re.escape(suffix)}$", "", city_text, flags=re.I).strip()
        city_text = re.sub(r"^downtown\s+", "", city_text)
    if re.search(r"new york\s+state|state of new york", target):
        return None, "NY"
    for city, state, aliases in sorted(CITY_ROWS, key=lambda r: -max(map(len, r[2]))):
        if explicit and explicit != state:
            continue
        if any(city_text == alias if clause else _contains(target, alias) for alias in aliases):
            return city, state
    for borough in NYC_BOROUGHS:
        if (city_text == borough if clause else _contains(target, borough)) and explicit in (None, "NY"):
            return borough.removeprefix("the ").title(), "NY"
    if explicit in (None, "PA"):
        for neighborhood in PITTSBURGH_NEIGHBORHOODS - {"oakland"}:
            if _contains(target, neighborhood):
                return "Pittsburgh", "PA"
        if explicit == "PA" and _contains(target, "oakland"):
            return "Pittsburgh", "PA"
    if clause:
        name = target.split(",", 1)[0].strip()
        if name in states or name.upper() in codes or re.fullmatch(r"(?:the )?(?:us|usa|united states|country|nation)|nationwide", name):
            return None, explicit
        # Strip a trailing state, including multi-word names, from an arbitrary city.
        for suffix in [*sorted(states, key=len, reverse=True), *codes]:
            name = re.sub(rf"\s+{re.escape(suffix)}$", "", name, flags=re.I).strip()
        if name and re.fullmatch(r"[a-z .'-]+", name):
            return name.title(), explicit
    return None, explicit


def canonical_city(city: str | None, state: str | None) -> str:
    name = (city or "").casefold().strip()
    for canonical, code, aliases in CITY_ROWS:
        if (not state or code == state.upper()) and name in aliases:
            return canonical.casefold()
    return name


def city_matches(actual: str | None, wanted: str | None, state: str | None) -> bool:
    actual_name, wanted_name = canonical_city(actual, state), canonical_city(wanted, state)
    if state == "PA" and wanted_name in PITTSBURGH_METRO:
        return actual_name in PITTSBURGH_METRO
    if state == "NY" and wanted_name == "new york":
        return actual_name == "new york" or actual_name in NYC_BOROUGHS
    return actual_name == wanted_name


def retrieval_query(query: str, intent: dict) -> str:
    """Anchor provider queries to the resolved geography while preserving user preferences."""
    location = ", ".join(x for x in (intent.get("city"), intent.get("state"), "USA") if x)
    return f"{query} ({location})"
