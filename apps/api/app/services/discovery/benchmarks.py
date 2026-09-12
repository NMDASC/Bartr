"""Category benchmarks for small business valuation.

Source: BizBuySell 2026 valuation benchmark tables (asking multiples, median asking
price, median SDE) as summarized at
https://learn.regaliscapital.com/guides/what-is-my-business-worth-sde-ebitda-multiples/
and https://www.bizbuysell.com/learning-center/industry-valuation-multiples/ .
Overall market: median cash flow multiple 2.7x, revenue multiple 0.7x, median sale
price $349,250 (BizBuySell Q2 2026 Insight Report).

`multiple` is an ASKING multiple. Sold prices run below asking; ASK_TO_SOLD applies
the haircut. `sde_margin` and `rev_per_employee` are rough industry rules used only
when nothing better is known; they carry a large sigma in valuation.py.
"""

ASK_TO_SOLD = 0.88  # sold / asking, typical BizBuySell gap

BENCHMARKS = {
    # category: (asking SDE multiple, median asking price, median SDE, sde margin, revenue per employee)
    "car_wash":          (5.8, 1_400_000, 202_170, 0.30, 110_000),
    "self_storage":      (4.6,   900_000, 190_000, 0.45, 150_000),
    "funeral_home":      (4.7,   895_999, 222_000, 0.25, 120_000),
    "laundromat":        (4.0,   500_000, 140_431, 0.38,  90_000),
    "trucking":          (4.0, 1_200_000, 315_052, 0.15, 180_000),
    "assisted_living":   (3.7, 1_500_000, 338_924, 0.20,  60_000),
    "machine_shop":      (3.7,   995_000, 286_757, 0.22, 140_000),
    "daycare":           (3.5,   739_000, 198_154, 0.20,  45_000),
    "liquor_store":      (3.3,   512_500, 157_789, 0.12, 250_000),
    "auto_repair":       (3.0,   635_000, 200_000, 0.22, 120_000),
    "hvac":              (2.9,   794_500, 261_553, 0.18, 150_000),
    "property_mgmt":     (2.9,   567_500, 195_500, 0.25, 110_000),
    "landscaping":       (2.7,   500_000, 182_712, 0.20,  75_000),
    "restaurant":        (2.0,   350_000, 120_000, 0.12,  55_000),
    "convenience_store": (2.5,   400_000, 130_000, 0.10, 300_000),
    "manufacturing":     (3.0,   900_000, 250_000, 0.18, 160_000),
    "retail":            (2.4,   300_000, 100_000, 0.12,  90_000),
    "default":           (2.7,   349_250, 120_000, 0.18, 100_000),
}

# Relative price level by state, used to nudge the base rate estimator. 1.0 = national.
# Rough cost of living / business price index; refine with scraped comps.
STATE_INDEX = {
    "CA": 1.25, "NY": 1.20, "MA": 1.15, "WA": 1.12, "CO": 1.08, "TX": 1.02, "FL": 1.03,
    "PA": 0.97, "OH": 0.92, "OK": 0.88, "KS": 0.88, "MO": 0.90, "AL": 0.87, "MS": 0.85,
}


def get(category: str):
    return BENCHMARKS.get(category, BENCHMARKS["default"])


def state_index(state: str | None) -> float:
    return STATE_INDEX.get((state or "").upper(), 1.0)
