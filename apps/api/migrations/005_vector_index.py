"""Atlas Vector Search index on companies.embedding, for portfolio matching.

384 dimensions to match sentence-transformers all-MiniLM-L6-v2. `state` and
`category` are declared as filter fields so `$vectorSearch` can pre-filter
before the ANN search instead of throwing away results afterwards.

Two things to know. Atlas builds this asynchronously, so the migration returns
before the index is queryable; give it a minute. And the free tier allows only
three search indexes per cluster, so this is the one we spend on companies.

If MONGODB_URI points at a plain MongoDB rather than Atlas, the command does not
exist. That is not fatal: the fallback in the plan is a cosine similarity in
numpy over the ~60 seeded embeddings, which is fine at this scale.
"""

from pymongo.errors import OperationFailure
from pymongo.operations import SearchIndexModel

INDEX_NAME = "company_vec"

MODEL = SearchIndexModel(
    name=INDEX_NAME,
    type="vectorSearch",
    definition={
        "fields": [
            {
                "type": "vector",
                "path": "embedding",
                "numDimensions": 384,
                "similarity": "cosine",
            },
            {"type": "filter", "path": "state"},
            {"type": "filter", "path": "category"},
        ]
    },
)


async def up(db):
    try:
        # list_search_indexes returns a cursor, it is not awaitable. On a plain
        # mongod the failure surfaces on first iteration, which is why the
        # comprehension has to be inside the try.
        existing = [idx["name"] async for idx in db.companies.list_search_indexes()]
        if INDEX_NAME in existing:
            print(f"  {INDEX_NAME} already exists, skipping")
            return
        await db.companies.create_search_index(MODEL)
        print(f"  {INDEX_NAME} requested; Atlas builds it in the background (~1 min)")
    except OperationFailure as exc:
        print(f"  skipped {INDEX_NAME}: {exc!s}")
        print("  not an Atlas cluster? fall back to numpy cosine over the seeds.")
