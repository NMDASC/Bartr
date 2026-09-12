"""Source-versioned sold benchmarks. Unsupported categories keep labeled legacy priors."""
CATALOG = {
    "laundromat": {
        "version": "bizbuysell-laundromat-2021-2025-reviewed-2026-09-12",
        "source_url": "https://www.bizbuysell.com/learning-center/valuation-benchmarks/laundromats-coin-laundry/",
        "period": "2021-2025", "basis": "reported-sale-price", "sample_size": 855,
        "sold_sde_multiple": 3.50, "median_sold_price": 250_000,
        "note": "National historical medians, not a local comparable sale; real estate/debt/cash inclusion must be checked individually.",
    }
}
