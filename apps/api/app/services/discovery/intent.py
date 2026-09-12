"""Deterministic intent fallback, including the existing Pittsburgh metro convention."""
import re

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

CITIES = {"pittsburgh": ("Pittsburgh", "PA"), "squirrel hill": ("Pittsburgh", "PA"), "oakland": ("Pittsburgh", "PA"), "bloomfield": ("Pittsburgh", "PA"),
          "lawrenceville": ("Pittsburgh", "PA"), "south side": ("Pittsburgh", "PA"), "strip district": ("Pittsburgh", "PA"), "shadyside": ("Pittsburgh", "PA"),
          "homestead": ("Homestead", "PA"), "mckees rocks": ("McKees Rocks", "PA"), "tulsa": ("Tulsa", "OK"), "waco": ("Waco", "TX"),
          "philadelphia": ("Philadelphia", "PA"), "cleveland": ("Cleveland", "OH"), "columbus": ("Columbus", "OH")}
PITTSBURGH_METRO = {"Pittsburgh", "Homestead", "McKees Rocks"}

def parse_intent(q: str) -> dict:
    ql = q.lower()
    category = "default"
    for cat, kws in CATEGORIES.items():
        if any(k in ql for k in kws):
            category = cat
            break
    state, city = None, None
    for name, (cty, ab) in CITIES.items():
        if re.search(rf"\b{name}\b", ql):
            city, state = cty, ab
            break
    for name, ab in STATES.items():
        if re.search(rf"\b{name}\b", ql):
            state = ab
            break
    if not state:
        m = re.search(r"\b([A-Z]{2})\b", q)
        if m and m.group(1) in STATES.values():
            state = m.group(1)
    if not city:
        place = re.search(r"\bin\s+([a-z][a-z .'-]*?)(?=\s+(?:under|over|with|below|above|that|for)|[,!?]|$)", ql)
        if place:
            name = place.group(1).strip()
            if name not in STATES and name.upper() not in STATES.values():
                city = name.title()
    def amount(prefix):
        match = re.search(rf"\b(?:{prefix})\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(million|thousand|m|k)?\b", ql)
        if not match:
            return None
        number, unit = match.groups()
        return float(number.replace(",", "")) * ({"m": 1e6, "million": 1e6, "k": 1e3, "thousand": 1e3}.get(unit, 1))
    max_value, min_value = amount("under|below|less than"), amount("over|above|more than")
    must_have = ["absentee ownership"] if "absentee" in ql and "prefer" not in ql else []
    return {"category": category, "naics_guess": None, "state": state, "city": city, "min_value": min_value, "max_value": max_value, "must_have": must_have}


def _matches(c: dict, intent: dict) -> bool:
    if intent["category"] != "default" and c["category"] != intent["category"]:
        return False
    if intent["state"] and (c.get("state") or "").upper() != intent["state"]:
        return False
    if intent["city"]:
        metro = {city.casefold() for city in PITTSBURGH_METRO}
        want = metro if intent["city"].casefold() in metro else {intent["city"].casefold()}
        if (c.get("city") or "").casefold() not in want:
            return False
    v0 = (c.get("valuation") or {}).get("v0")
    if intent["max_value"] is not None and (v0 is None or v0 > intent["max_value"]):
        return False
    if intent["min_value"] is not None and (v0 is None or v0 < intent["min_value"]):
        return False
    return True
