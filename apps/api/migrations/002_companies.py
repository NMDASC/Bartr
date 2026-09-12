"""companies: the output of the discovery pipeline, and the thing a market trades.

    companies { _id, name, category, naics_guess, address, city, state, lat, lng,
                website, phone, rating, review_count, founded_year, owners[],
                description, place_id,
                financials: { revenue_est, sde_est, margin_est, employees_est,
                              confidence, method },
                valuation:  { v0, sigma, low, high, multiple_used, comps[], as_of },
                sources[]:  { url, title, snippet, fetched_at },
                embedding: [384 floats], status, created_at }

The `place_id` index is what keeps re-running a discovery query from creating
duplicate companies; upsert on it rather than on name, because two laundromats
in the same city really can share a name.
"""


async def up(db):
    # Classic text index, not an Atlas Search index, so it does not count
    # against the 3-search-index cap on the free tier.
    await db.companies.create_index(
        [("name", "text"), ("description", "text"), ("category", "text")],
        name="company_text",
    )
    await db.companies.create_index("place_id", unique=True, sparse=True)
    await db.companies.create_index([("state", 1), ("category", 1)])
    await db.companies.create_index("status")
