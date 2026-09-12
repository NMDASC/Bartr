"""Deterministic intent fallback, including the existing Pittsburgh metro convention."""
import re
from .locations import parse_location, city_matches

STATES = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT",
          "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
          "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI",
          "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH",
          "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
          "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
          "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"}
CATEGORIES = {"laundromat": ["laundromat", "laundry", "coin laundry", "wash house"], "car_wash": ["car wash", "carwash"],
              "machine_shop": ["machine shop", "cnc", "machining"], "hvac": ["hvac", "heating", "cooling", "air conditioning"],
              "restaurant": ["restaurant", "diner", "cafe", "grill"], "auto_repair": ["auto repair", "mechanic", "auto shop"],
              "manufacturing": ["manufactur", "kerosene", "factory", "plant"], "landscaping": ["landscap", "lawn"],
              "daycare": ["daycare", "day care", "childcare"], "liquor_store": ["liquor"], "convenience_store": ["convenience", "gas station"],
              "self_storage": ["storage"], "trucking": ["trucking", "freight"], "retail": ["store", "shop", "boutique"]}

def parse_intent(q: str) -> dict:
    ql = q.lower()
    category = "default"
    for cat, kws in CATEGORIES.items():
        if any(k in ql for k in kws):
            category = cat
            break
    city, state = parse_location(q, STATES)
    def amount(prefix):
        match = re.search(rf"\b(?:{prefix})\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(million|thousand|m|k)?\b", ql)
        if not match:
            return None
        number, unit = match.groups()
        return float(number.replace(",", "")) * ({"m": 1e6, "million": 1e6, "k": 1e3, "thousand": 1e3}.get(unit, 1))
    max_value, min_value = amount("under|below|less than"), amount("over|above|more than")
    must_have = []
    if "absentee" in ql and "prefer" not in ql:
        must_have.append("absentee ownership")
    if re.search(r"\bcnc\b", ql):
        must_have.append("CNC")
    return {"category": category, "naics_guess": None, "state": state, "city": city, "min_value": min_value, "max_value": max_value, "must_have": must_have}


def _matches(c: dict, intent: dict) -> bool:
    if intent["category"] != "default" and c["category"] != intent["category"]:
        return False
    if intent["state"] and (c.get("state") or "").upper() != intent["state"]:
        return False
    if intent["city"]:
        if not city_matches(c.get("city"), intent["city"], intent.get("state")):
            return False
    v0 = (c.get("valuation") or {}).get("v0")
    if intent["max_value"] is not None and (v0 is None or v0 > intent["max_value"]):
        return False
    if intent["min_value"] is not None and (v0 is None or v0 < intent["min_value"]):
        return False
    return True


def merge_intent(query: str, proposed: dict | None) -> dict:
    """Model interpretation may add detail, but cannot drop explicit constraints."""
    fallback = parse_intent(query)
    result = {**fallback, **(proposed or {})}
    for field in ("state", "city", "min_value", "max_value"):
        if fallback[field] is not None:
            result[field] = fallback[field]
    if fallback["category"] != "default":
        result["category"] = fallback["category"]
    result["must_have"] = list(dict.fromkeys([*fallback["must_have"], *(result.get("must_have") or [])]))
    return result
