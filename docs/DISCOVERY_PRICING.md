# Discovery ranking, pricing and GraphQL

Implemented against the shared DiscoveryJobs and Store interfaces. The search screen stays on REST/SSE, preserving the other active frontend work. GraphQL is an additive facade, not a replacement exchange or separate discovery pipeline.

## Ranking

Search applies category, geography, budget and reported must-have constraints before ordering companies. The query-specific relevance score is 55% semantic similarity, 25% location/category fit, 15% keyword overlap and 5% evidence corroboration by source hostname. This is relevance ranking, not hyperlink-based Google PageRank. Financial confidence never determines relevance. Ties use company name and ID.

Default semantic similarity is deterministic token cosine. `DISCOVERY_EMBEDDING_MODEL` can point to a locally installed sentence-transformers model if that optional Python package is installed. Requests never download a model. Ranking responses expose component scores, matched tokens, missing financials, rank, algorithm version and the actual semantic method used. The weights are a versioned initial policy, not learned relevance judgments.

## Retrieval and evidence

`DISCOVERY_LIVE=1`, `QUERIT_API_KEY`, and `XAI_API_KEY` enable live discovery; `XAI_MODEL` chooses the model through the shared `app/llm.py`. Google Places is optional. Keys are server-side only. Querit performs bounded search and page retrieval with caching, throttling, timeouts and two retries for transient failures. Grok parses intent and extracts structured evidence. Source pages are treated as untrusted data.

Financial facts affect discovery pricing only when a supplied source contains the exact quoted passage, the period and USD amount are supported, and the value passes numeric validation. Monthly values are not silently annualized, unsupported currency conversions are rejected, and inferred values remain distinct from reported inputs. These checks establish traceability, not independent verification of seller claims. Missing financial evidence produces a wider, provisional estimate rather than invented revenue.

Querit's full-page contents endpoint requires separate account access. A denied contents request is cached until API restart; both initial discovery and financial enrichment continue from search excerpts, with a visible partial-results warning. Google Places can provide additional sourced business details. Discovery uses low reasoning effort on Grok 4.5/4.6 to limit latency. Initial extraction has a 90-second deadline; optional financial extraction keeps a 35-second deadline and the entire live job remains limited to 180 seconds.

Successful results remain available if a provider fails, with terminal warnings. Identical active/completed-successful jobs reuse work for five minutes. Failed/partial jobs can be retried. Jobs are bounded in-process state, expire after 15 minutes on subsequent activity, and do not survive restart. One API worker remains required. Company evidence and valuation history use the configured Store and therefore follow memory/Mongo persistence.

Structured US Google Places results are saved before Grok enrichment when address components establish the city/state and the returned place types map to a supported business category. They pass the same strict filters and evidence validation. Ratings and review counts are sourced facts; financials remain absent until supported by evidence. Model timeouts therefore retain usable business results.

## Pricing

Discovery enrichment and valuation previews use `pricing.py`: a precision-weighted log-space ensemble with disagreement inflation. The output includes whole-business USD value, P20/P80 interval, estimator breakdown, per-share opening reference (`v0 / SHARES`), timestamp, pricing version, calibration version and benchmark provenance. The interval is model uncertainty, not an empirically guaranteed coverage claim.

The reviewed laundromat benchmark uses historical 2021-2025 sold transactions from [BizBuySell](https://www.bizbuysell.com/learning-center/valuation-benchmarks/laundromats-coin-laundry/). National comparables do not establish the value of a particular business or its deal scope. Other categories retain explicitly provisional legacy priors. Quality adjustments, revenue proxies and uncertainty are still provisional until evaluated against suitable held-out sales. Existing seeded/manual engine creation retains its legacy pricing path; there is no automatic repricing migration.

Repeated discovery merges company identity by normalized name and location, with address/domain checks for chains. It preserves prior source documents and keeps the last 20 evidence/input-hashed valuation snapshots. Identical pricing inputs do not create duplicate snapshots. A refresh updates the fundamental prior without resetting positions, open orders, treasury inventory or a traded last price. Untraded markets can requote immediately; active markets adopt the updated prior in the existing market-update flow. Identity resolution with missing addresses remains conservative but is not a universal entity-resolution system.

## Calibration

`apps/api/calibrate_pricing.py` accepts explicitly separated training/test businesses, fits log bias and residual sigma on training only, and reports held-out median absolute percentage error, log RMSE and P20/P80 coverage. Asking prices and model opinions are removed from both sets. Duplicate company IDs and mixed categories are rejected. Source preparation must also exclude sale-price leakage from other observables and keep related listings in the same split.

Input is a JSON array. Each row has `company_id`, `split` (`train` or `test`), `sale_price` (actual positive USD sale price), and `observables` (category plus supported inputs such as SDE). Use real, appropriately sourced sale outcomes. At least two training rows and one holdout row are required to run; that minimum is not sufficient evidence for production calibration.

```sh
cd apps/api
uv run python calibrate_pricing.py cases.json --version laundromat-sale-v1 --output profile.json
```

The command refuses to overwrite an existing profile. It does not auto-activate one. Review held-out performance, sample size and source/deal comparability before setting `VALUATION_CALIBRATION_FILE` to an absolute profile path. Only sale-basis profiles are accepted. A profile for another category or benchmark is not applied; the response identifies the provisional fallback. Keep profile versions immutable. No empirical profile or calibration claims are shipped without actual labeled sales.

## GraphQL

Install API dependencies (`cd apps/api && uv sync`) and open `/graphql` on the API server. The SDL is checked in at `packages/contracts/schema.graphql`.

```graphql
mutation {
  startDiscovery(input: {q: "laundromat in Pittsburgh", live: false}) {
    id status revision intent { category city state }
  }
}
```

Then poll with the returned job ID:

```graphql
query Results($id: ID!, $after: String) {
  discoveryJob(id: $id) { status warnings revision }
  searchResults(jobId: $id, first: 20, after: $after) {
    total revision endCursor hasNextPage
    hits {
      company { id name city state v0PerShare }
      relevance { rank score matched unknown version semanticMethod }
    }
  }
}
```

Cursors bind a job, ranking revision and offset, so enrichment cannot reorder an already-started page sequence. Up to 32 revisions are retained. If a cursor or job expires, start from the first page or start a new search. Fetch `company(id:)` for evidence, sources and valuation history. `previewValuation(input:)` performs the same pricing preview as REST without creating a company. Maximum query depth is eight and page size is 1-50.

GraphQL uses camelCase wire fields. It exposes no trading mutations. The app's current demo authentication limitations still apply; this facade is not a production auth, billing or abuse-control boundary. The frontend GraphQL polling adapter is retained but deliberately not connected to the demo UI.

## Verification

```sh
cd apps/api
DISCOVERY_LIVE=0 XAI_API_KEY= QUERIT_API_KEY= IFM_API_KEY= uv run pytest -q
cd ../..
apps/api/.venv/bin/python scripts/gen_graphql.py --check
cd frontend
./node_modules/.bin/tsc --noEmit --incremental false
```

Tests cover evidence rejection, idempotent enrichment, market preservation, calibration leakage, GraphQL preview/detail/pagination, strict ranking and mocked live retrieval. Paid-provider behavior must still be verified with valid credentials. Avoid `next build` while another task owns the shared frontend development server.
