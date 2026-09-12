# Decisions (append only)

Format: `## NNN  Day HH:MM  author: X  affects: A,B,C,D` then what changed, why, and migration notes. Newest at the bottom. Post the number in the team chat after pushing.

## 001  Fri 21:00  author: Aditya  affects: all
Plan.md committed. Track: Optimization (backup Multiplayer). Stack: Next.js 15 + FastAPI + MongoDB Atlas + Auth0 + Vultr + Vercel. LLM via one `llm.py` with xai / ifm switch.

## 002  Fri 21:30  author: Aditya  affects: C, A
Black Scholes acquisition options are out of scope. Acquire = LOI + diligence checklist only.

## 003  Fri 22:00  author: Aditya  affects: C, A, D
No automated market maker. Liquidity comes from the owner (Treasury account): ask ladder for the float plus a buyback floor bid, both derived from the valuation posterior quantiles. The platform never trades. Avellaneda Stoikov moved to Backlog.md. `markets.mm` removed from the data model; `markets.treasury` gained `floor_price`, `floor_qty`, `ask_ladder`.

## 004  Fri 22:00  author: Aditya  affects: B, C
Initial pricing is now a Bayesian ensemble in log space (`valuation.py`): income (multiple x SDE), base rate (category median asking price, haircut to sold), proxy (revenue from observables), and LLM opinion, each with its own sigma, precision weighted, with disagreement inflation. Posterior (mu, sigma) feeds the Treasury quotes and Kelly. Benchmarks in `benchmarks.py` from BizBuySell 2026 tables.

## 005  Fri 21:30  author: A (Zhiyuan)  affects: B, C, D
Drafted `packages/contracts/types.ts` and nine fixtures in `packages/contracts/examples/` from Plan.md sections 6 and 7 so the frontend builds against real shapes before the freeze. PROPOSAL until 23:30. Additions the plan did not spell out: `DiscoveryEvent` union for the SSE job stream (`intent | company_stub | company_ready | company_failed | done`); `MarketEvent` union for `WS /ws/markets/{id}` (`book | batch | trade | flag | halt`); `CompanyCard` row shape with nullable prices while `status == "stub"`; `Book.levels[].origin` so the UI can tell owner liquidity from real orders; `Flag.reviews[]` plus `disputed` so Grok/K2 disagreement renders; `AgentChatRequest.session_id` is the Auth0 sub on web and an E.164 phone over iMessage. Updated after 003/004: `origin` is `user | treasury | bot | agent`, `markets.treasury` and `belief` replace `mm`, `valuation.estimates[]` replaces `comps[]`.

## 006  Fri 22:05  author: A  affects: D
iMessage is IN scope and lives in `apps/imessage`, not `scripts/imessage_bridge.py`. Photon Spectrum managed line (no Mac, no Full Disk Access, deploys to Railway) instead of polling `chat.db`; Plan.md 9.5 route 1 is superseded. The bridge calls `POST /api/v1/agent/chat` with `session_id = <sender phone>` and `X-Demo-User: <sender phone>`, accepts JSON `{content, tool_calls?}` or plain text. Replies must be short lines, no markdown. Photon Free tier: max 10 users, DMs only. D: keep `/agent/chat` non-streaming or JSON-terminal.

## 007  Fri 22:15  author: A  affects: all
Frontend lives at `frontend/` (repo root), not `apps/web`. Stack drift from Plan.md section 4: Next.js 16.3, Tailwind v4, no shadcn/ui (its defaults fight the square-corner, no-shadow design system; primitives are hand written in `frontend/src/components/ui`). `lightweight-charts` v5 step line for price. Mock mode (`NEXT_PUBLIC_API_URL` unset) runs fixtures plus an in-browser reference implementation of the 8.3 auction and the 8.1 Treasury ladder/floor in `frontend/src/lib/mock.ts`; it is not the engine. Design system: Lemma kinship (light only, zero radius, no shadows, hairline rules, IBM Plex Mono labels, one indigo accent on state). Ownership line in CLAUDE.md should read `A: frontend, apps/imessage`.
## 008  Fri 23:30  author: Aditya  affects: A, B, D
Backend API is live in `apps/api` (see its README). Routes under `/api/v1`: companies, markets (book, orders, batches, trades, ws), portfolio (+ Kelly suggest), surveillance. Demo auth via `X-Demo-User`. Storage goes through `app/store.py::Store`; the simulated DB should implement that protocol and be constructed in `app/deps.py`. Book and cards carry `indicative_price` (what the round would clear at right now) because bids can sit above asks between rounds. Opening trades tiebreak toward the model reference price, not the midpoint.
Limit up/down: if the band clamps the clearing price and nothing can trade at the band edge, the reference price steps to the edge with zero volume (`batch.ref_moved = true`) so the band walks toward resting interest next round instead of deadlocking. Belief update runs only on real volume.

## 009  Sat 00:30  author: Aditya  affects: A, B, D
API output now matches `packages/contracts/types.ts` exactly (A's 005 draft): `_id`, ISO `Z` timestamps, `Book.levels[].origin`, `Book.band{pct,low,high}`, `Portfolio.pnl{realized,unrealized,total}`, `Suggestion.company{...}`, `Batch.imbalance`, `Flag.reviews[]/disputed`. Extras the API adds beyond the draft (harmless to TS): `Book.indicative_price`, `CompanyCard.indicative_price`, `Batch.band_hit/ref_moved`, `Belief.model_value/market_value`, `Company.observables`, `Portfolio.user_id/reserved_cash/equity`. WebSocket is `WS /ws/markets/{id}` at the app root, not under `/api/v1`. `packages/contracts/openapi.json` is exported from the app; types.ts stays hand maintained by A (regenerating would change its import shape).
Local stand-ins so the frontend runs against the real API today, each replaced by its owner without changing routes or shapes: `POST /discovery/search` + SSE `GET /discovery/jobs/{id}` (keyword intent parser over seeded companies; B swaps in Grok + Places + Querit), `POST /acquire/{id}/start` (templated LOI + state/category checklist, no citations; D swaps in Grok web_search), `GET /surveillance/flags` (rules layer only: wash pair, pump, concentration, band; D adds Grok and K2 reviews). Verified: `frontend` builds with `NEXT_PUBLIC_API_URL` set, every route renders backend data, WS pushes `book` and `batch` frames.

## 010  Fri 22:20  author: A  affects: D
No disclaimer line in the generated LOI or anywhere in the UI. Plan.md 9.6 says "A disclaimer line: play money, not legal advice"; that line is removed from the LOI fixture and from every screen, footer, and the iMessage help text. Nothing user-facing says play money, demo, mock, or not-advice. Also: the ensemble numbers, auction rules, and Kelly formula stay out of the UI (no captions or helper sentences explaining mechanism); see the UI-copy line in CLAUDE.md.

## 010  Sat 00:50  author: Aditya  affects: A, B, D
Demo is Pittsburgh. Seeds are now 10 Pittsburgh area businesses (Squirrel Hill, Bloomfield, Lawrenceville, McKnight Rd, McKees Rocks, Greenfield, South Side, Homestead, Strip District, Oakland) plus two out of state controls (Tulsa, Waco). Company ids changed: `co_squirrel_hill_wash` is the hero. Discovery intent parser is city aware ("laundromat in Pittsburgh" -> city Pittsburgh, state PA; Homestead and McKees Rocks count as metro). Acquire checklist adds City of Pittsburgh registration and Allegheny County Health Department items. Plan.md section 13 and docs/PROMPT_presentation.md updated. A: the fixtures in packages/contracts/examples still reference Oklahoma; swap when convenient.

## 011  Sat 01:05  author: Vir  affects: all
(Numbering note: 008 and 010 were each claimed twice by parallel work. This takes 011. Claim a number by pushing the entry before the code, not after.)

Mongo is in, behind the storage boundary 005 asked for. `app/store_mongo.py::MongoStore` implements `app/store.py::Store` and `app/deps.py` selects it when `MONGODB_URI` is set, falling back to `MemoryStore` otherwise. The engine, the routers and the existing tests are untouched by this. Verified with the real engine running on mongo: 8 markets seeded, batches clearing, trades, positions and the audit log all persisted, and data surviving a restart.

MongoStore is synchronous and uses pymongo, not motor, because `Store` and `engine.tick()` are synchronous and an async driver would mean turning the engine inside out for no gain at this scale. Documents are stored exactly as the engine hands them over, with `_id` taken from the dict's own `id`, so a natural key is the primary key and every `put_*` is an idempotent replace. `save()` is a no-op because writes are already durable.

One additive method on the protocol: `find_user_by_email`, implemented by both stores. It is what lets a demo session be claimed later.

Identity now goes through `app/identity.py`, and `deps.current_user` uses it. `X-Demo-User` accepts a name, an email, or a phone, and normalizes all three, because the same person was otherwise becoming two accounts by typing `Vir@Example.com` once and `vir@example.com` later, and because the iMessage gateway sends a sender as `+14124754173`, `14124754173` or `(412) 475-4173` depending on the contact (decision 006). The normalized string is the engine's user id, so nothing downstream changes. `identity.record` annotates the user document with `email`, `display_name` and `identity_kind`; it never creates users, because `Engine.user` owns granting the starting cash and there should be one place that does.

The claim: an identity carrying an email resolves to whichever user already owns that address, so a later real login inherits the cash, positions and orders built under the demo session instead of resetting. This is ready rather than active, since the bearer path cannot see an email yet. Wiring Auth0 means passing the verified email into `Identity` and changing nothing else. Two consequences worth knowing: the bearer path still mints whatever id the caller chooses, so it is not auth and must not be mistaken for it; and a judge who types a bare name or arrives by phone cannot be claimed later, by design.

Migrations were reworked onto the shapes the store actually reads and writes rather than the original section 6 sketch. `001_users` seeds by `id` (there is no `name` field and no index on one) and `003_market` drops the `positions` collection, because positions live inside the user document. Migration `006_identity` adds the sparse unique index on `email`. Two bugs fixed along the way: `005_vector_index` awaited `list_search_indexes`, which returns a cursor, so it raised `TypeError` before the non-Atlas guard could catch anything; and `003_market` documented the `markets.mm` subdocument that decision 003 removed.

New routes, all stubs with `TODO(Zhiyuan)` bodies and the shapes from `types.ts`: `POST /discovery/search`, `GET /discovery/jobs/{id}` (SSE, emitting the real `DiscoveryEvent` frames off the seeds), `POST /acquire/{cid}/start`, and `POST /agent/chat`. The agent route returns a single JSON `AgentMessage` rather than a stream, per 006. `GET /readiness` reports which store is live and which keys are set, which is useful while keys are still being collected.

Also landed: `app/llm.py` (the `xai | ifm` switch, the only module that imports `openai`), `Dockerfile` and `docker-compose.yml` (api plus a local mongo, single worker), and `scripts/gen_contract.sh`, which exports `openapi.yaml` only and deliberately does not generate `types.ts` since that file is hand authored and expresses unions FastAPI cannot.

Withdrawn from decisions 005 and 006 of my earlier local branch, which never reached anyone: the parallel `main.py`, `schemas.py`, websocket hub, four duplicate routers and contract examples I had written before this landed, plus the `users.auth_subs` array and the motor based `db.py`. The version on main wins; `db.py` survives only as the async handle for the migration runner.

Migration: `cd apps/api && uv sync`. Nothing to do if you are happy in memory. To use mongo, set `MONGODB_URI`, run `uv run python migrate.py up`, and check `GET /readiness` shows `"store": "mongo"`.

## 012  Sat 01:10  author: Aditya  affects: A
Checked `a/web` against `main`: merges clean. Aligned the API with A's last two commits: no "play money" wording anywhere the API emits (LOI template now follows the fixture's section structure), and `GET /markets/{id}/batches` plus the WS `batch` frame only carry rounds with a price (trades, or limit up/down reference steps at the stepped price) because `price-chart.tsx` feeds `clearing_price` straight into lightweight-charts. Quiet rounds still push a `book` frame so the countdown stays live; `?all=true` returns every round.

## 013  Sat  author: Nico (with Codex)  affects: A, B, C, D
Implementing query-specific relevance ranking, Querit/Grok discovery, evidence-backed valuation snapshots and `/graphql`. User-authorized scope spans the discovery lane, shared API adapter/contracts, and the existing Python valuation seam. Preserve Pittsburgh metro handling, Store/MongoStore, the shared `llm.complete`, REST endpoints, SSE and market WebSockets. Types remain hand maintained; export OpenAPI and GraphQL SDL after verification. Search relevance is separate from valuation confidence. Strict constraints must never silently relax. Repeated discovery updates a company without recreating its existing market. New evidence/history fields are additive company subdocuments, written through Store; no startup index creation. Search jobs are bounded, replayable in-process state (single worker) and expire; company evidence and valuation snapshots follow the selected Store's persistence.

## 013  Sat 01:30  author: Aditya  affects: Vir
Pulled 011 (Mongo store, identity, llm.py, agent stub, migrations). Verified: 37 tests pass, engine's read-mutate-put pattern is honored by MongoStore, live boot with seeds and bots is clean, `/agent/chat` answers. Added `list_users()` to the Store protocol, MemoryStore, and MongoStore (two lines) because the concentration detector in `/surveillance/flags` was reading `MemoryStore.users` directly and would have been silently empty under Mongo. Note for everyone: `apps/api/.venv` needs `openai` and `pymongo` now (`pip install -e .` or `uv sync`); `/readiness` 500s without `openai`.

## 014  Sat 01:45  author: Aditya  affects: A
Demo deck exists at `apps/deck/index.html` (single file HTML, arrow keys, `P` clock, `F` full screen, `R` replays the live auction on slide 7). Fallbacks `apps/deck/JB.pdf` and `apps/deck/JB.pptx`, regenerated by `apps/deck/export.sh`. Screenshot placeholders take PNGs dropped into `apps/deck/assets/` (names in `apps/deck/README.md`); A: please capture the four routes at 1440x900 by 1 PM Saturday. Talk track in the README. Branch `a/deck`.

## 015  Sat 02:00  author: session  affects: A, B, D
Demo copy and contract fixtures now match decision 010: Squirrel Hill Wash and Fold is the hero. Search, header, mock stream, iMessage help, and `packages/contracts/examples/*` use Pittsburgh ids (`co_squirrel_hill_wash`). Discovery ranks seeded companies by query relevance (`ranking.py`) instead of a raw filter; Places + Querit + Grok extract only run when `DISCOVERY_LIVE=1` and those keys are set, and they upsert through Store without recreating an existing market. Acquire checklists attach official PA / City of Pittsburgh / Allegheny citations. `/agent/chat` searches, places, and sizes without a model; Grok tool-calls when `XAI_API_KEY` is set. `/surveillance/flags` still returns the rules layer with no keys; Grok and K2 attach independent reviews when configured. GraphQL from the 013 draft is not on the demo path; search stays REST/SSE. `BOTS` defaults to 1 in `.env.example`. Additive on `types.ts`: optional `CompanyCard.relevance`, and DiscoveryEvent `ranking` / `error` frames.

## 016  Sat 02:30  author: Aditya  affects: all
Grok was called nowhere in the code (llm.py existed, nothing imported it). Twelve uses now live in `apps/api/app/services/agents/`, every one through `llm.py` and every one with a deterministic fallback so the demo never depends on a key: appraiser (web_search research + structured value, K2 second opinion, feeds the ensemble), intent parser, owner persona (`POST /companies/{id}/ask`), market narrator (`GET /markets/{id}/narrative`), profile parser (`POST /portfolio/profile/parse`) and Grok written `why` on suggestions, compliance reviewers (Grok + K2 on every rules flag, `disputed` on disagreement), red team (`POST /surveillance/redteam`: Grok plans a wash/spoof/pump and executes it through bot accounts, the rules must catch it; new `spoofing` rule), health memo (`GET /surveillance/report`), LOI + cited checklist in acquire, Chat agent and compliance reviewers: the versions from a4d1eae (`chat_agent.reply`, `compliance.review_flags`) are the ones kept; my duplicates were dropped in the merge. 45 tests pass with a fake model; `scripts/grok_smoke.py` runs every real call once when `XAI_API_KEY` lands. `/readiness` shows `grok_features` and recent calls. Deck: slide 10 and the stack slide can now claim all of this truthfully.

## 017  Sat  author: Nico (with Codex)  affects: frontend, discovery, platform
Live discovery in the UI, Pittsburgh first and then cities nationwide. REST/SSE stays the demo search path and now runs through DiscoveryJobs: one execution, replayable SSE, ranked snapshots, city aliases, and DISCOVERY_LIVE for Places + Querit + Grok. Evidence is additive on Company. No new collection or market reset.

## 018  Sat  author: Nico (with Codex)  affects: platform, discovery
`/graphql` is on the app: Strawberry router at `/graphql`, same DiscoveryJobs and pricing snapshots as REST. Search UI stays on REST/SSE. `strawberry-graphql` is an API dependency.

Pricing/ranking verification follow-up: exact-quote and field-associated USD checks gate financial evidence; repeated inputs deduplicate snapshots while source documents merge; source hostnames, not repeated URLs, contribute corroboration. `calibrate_pricing.py` fits category-scoped sale-basis profiles on explicit training rows and reports held-out error/coverage without auto-activation. Mismatched category/benchmark profiles fall back with a warning. Export GraphQL SDL with `scripts/gen_graphql.py`; usage and limitations are in `docs/DISCOVERY_PRICING.md`. Legacy seeded/manual company creation is not repriced automatically. Runtime verified `/graphql` pricing preview; full live discovery still requires a configured xAI key.

## 021  Sat 03:40  author: Aditya  affects: all
Keys arrived and every Grok feature was run for real (`scripts/grok_smoke.py`). Findings and fixes:
- grok-4.6 takes 18 to 45s per structured call because it reasons; `grok-4.20-0309-non-reasoning` answers the same call in under 2s. `llm.fast_model()` added; every interactive path (intent, persona, narrator, profile, why, compliance, chat, red team plan, LOI) uses it. grok-4.6 with web_search stays for appraisal and checklist research. Zhiyuan / Vir: `chat_agent` and `compliance` now pass `model=fast_model(...)`.
- Slow research is cached ahead of the demo: `seeds/appraisals.json` and `seeds/checklists.json` (scripts above), merged at boot. Acquire returns instantly and upgrades the checklist in the background (`checklist_source`).
- Deterministic city parser was greedy: "laundromat in pittsburgh and show me the book" made the city "Pittsburgh And Show Me The Book", so chat found nothing. Clause now stops at conjunctions and verbs (`locations.py`).
- Grok appraisals of the fictional seeds come back with confidence 0.12 to 0.25 and reasoning like "no confirmation this laundromat exists". Correct behavior, ugly on a slide. Atlas already holds 52 real businesses from the live pipeline (Laundry Factory, Shadyside Laundromat, ...); run `appraise_seeds.py --store` against Atlas and demo on real businesses.
- Test venv needs `strawberry-graphql[fastapi]` and `pytest-asyncio` now. 103 tests pass offline; `.env` keys make the suite hit the network, so run tests with `XAI_API_KEY= QUERIT_API_KEY= GOOGLE_PLACES_API_KEY=` prefixed or add them to conftest.

## 019  Fri 23:15  author: Aditya  affects: A
Deck rebuilt as Bartr, 14 slides: use case slide up front (Discover. Exchange. Acquire.), real frontend screenshots in `apps/deck/assets/` (captured from `next start` on the Bartr rename), reduced math with the Squirrel Hill worked example, an owner liquidity ladder diagram (no market maker, per 003), a marketplace animation with named traders quoting into the book, an anti arbitrage flowchart, a "built for you to make money" slide with the Kelly multiplier, an agentic security panel flowchart, and an architecture diagram with sponsor logos. Fallbacks `Bartr.pdf` and `Bartr.pptx`. A: the QR (`assets/qr.png`) still needs the live URL.

## 020  Sat 00:10  author: Aditya  affects: A, D
Deck reviewed by five agents (slop editor, fact checker, presentation, impact and technical judges) and corrected: no claims the code does not back. Removed: "runs after every batch", cancel/freeze actions, a K2 confidence score, spoof detection, Auth0 as wired, Vector Search as used, 50 bots (it is 20), Next.js 15 (it is 16), "calibrated on real listings" (calibrate() exists, never run), "the first stock market", "the platform never trades", "always an exit", track line. Slide 8 now runs three rounds with the owner requoting from the updated belief and a crowd seller in round 3. New Grok slide (13) lists the twelve call sites from 016 (appraiser, persona, narrator, profile parser, compliance, red team, health memo, acquire, chat) and the evidence gate in pricing.verified_company; security slide names the red team and the spoofing rule. 15 slides. D: if surveillance gets wired into run_batch, or Auth0 lands, tell me and I will put the claims back.

## 022  Sat 04:30  author: Aditya  affects: all
Product change from Aditya: discovered businesses are on the site without the owner signing up. `Company.listed` / `CompanyCard.listed` / `MarketSummary.listed` (contract). Discovered companies (`pricing.save_company`) are `listed=False`: no owner quotes, no orders (422 "make the owner an offer instead"), no rounds; the card shows "What we think it is worth" and the company page shows the estimate plus an offer panel. `POST /companies/{id}/offer` writes a fixed, hand written letter to the owner (`services/offers.py`: plain, short, opt out line, buyer's own paragraph optional; no model writes it), delivers by SMTP or Resend when configured, else stores it queued and returns the letter. `POST /offers/{id}/accept` (demo) lists the business and opens quotes. `scripts/mark_unlisted.py` flipped the 53 pipeline companies in Atlas.
Search: `DISCOVERY_LIVE` now defaults on when keys exist (the "one result" report was stored matches only, because live was off). The pipeline emits `status` events (stored, intent, sourcing, appraising, reading, extracting, ranking, financials, finished) and the results page shows the last four as an activity feed.
Grok cost: `llm.record_usage` tallies tokens per model; `/readiness.usage` shows calls, tokens and estimated USD for this process. Seeds ship with Grok appraisals (`seeds/appraisals.json`, 12) and cited checklists (`seeds/checklists.json`).

## 021  Sat 05:30  author: Aditya (with Claude)  affects: A
Deck rewritten in plain English after a fresh editor pass: every formula now has a question before it and a Squirrel Hill reading after it; no slogans. New title (real Pittsburgh prices counting up), portfolio slide is an animated stake card (gap, Kelly stake, risk slider, gain and loss move together), fairness flow has hand drawn glyphs and one sentence per box, architecture diagram has three lanes with logos and every module, Grok slide leads with the two tier appraisal (company enters, Grok researches and appraises, K2 second number, clamp, blend). Live slide runs two slower rounds with no QR. Claims still to make true or cut before 4 PM: appraisal at listing time for every company (today: cached appraisals at boot plus POST /appraise), and owner self-listing (slide 3 says "an owner can also ask to list", no route yet).

## 023  Sat 04:00  author: A  affects: frontend, demo
The public landing page now gates the application behind demo authentication. `Login` and `Start trading` open accessible login and signup dialogs. A signed HttpOnly cookie carries `{name, email, role}` for eight hours; this is demo state, not production identity. Normal demo credentials establish a user session. The server-only `admin@gmail.com` / `admin1234` pair establishes an admin session.

Authenticated users land on `/overview` and see `Overview`, `Discover`, `Portfolio`, and `Agent`. `/admin` is role-gated and owns the surveillance UI; the old `/surveillance` URL redirects there. Protected application URLs redirect signed-out visitors to the landing page and reopen login. No FastAPI route, shared contract, or MongoDB collection changes.

## 024  Sat  author: Nico  affects: API, bridge
Additive APIs: `/portfolio/overview`, `/agent/messages`, `/agent/channel`, `/agent/heartbeat`, and `/security/*`. Security and legacy surveillance routes require `X-Admin-Token` matching server-only `ADMIN_API_TOKEN`; unset configuration fails closed. Bridge telemetry requires server-only `BRIDGE_API_TOKEN`. Agent call inputs/outputs and case transitions are logged through Store with secret redaction. Security cases persist with snapshots, evidence, reviewer opinions and human dispositions; MemoryStore snapshots now include audit and cases. New migration 007 contains security-case indexes. Existing discovery edits are preserved. Types remain hand-authored; OpenAPI is exported after verification. Deployment and sending real external messages are outside this local implementation run.

Acquisition drafts are saved as per-user acquisition documents; GET/PUT
`/acquire/{company_id}/draft` and the existing acquisition-id lookup are scoped to the
current identity. Starting an existing draft preserves edits. The bridge forwards an
optional chat `request_id`; replayed requests return the stored response, and conflicting
reuse is rejected. Chat can read portfolio/order status and cancel an owned order.

`/security/events` searches and pages the full stored event history with a fixed time
anchor. The overview export explicitly contains its latest 500 events per feed. Model
calls include the named feature and full redacted output; trade, cancellation, detection,
and disposition records connect to the affected market and identities. Each detection
archives its evidence packet in the audit trail before a later detection can supersede it.
Memory snapshots retain audit history and serialize concurrent saves; use Mongo for a
long-running exchange.

The recurring security scan runs in a worker thread and reads cancelled orders in bulk,
so Mongo surveillance does not block the API event loop or query every user per market.
Case writes and MemoryStore snapshots serialize concurrent updates. An unchanged
concentration condition does not reopen a reviewed case just because another quiet
batch elapsed.

The integration incorporates the fast Grok tier and background checklist research from
main. Draft storage is separate from balance documents, with compatibility reads for
older user-embedded drafts. Duplicate starts serialize per buyer/business; researched
checklists preserve buyer edits. Acquisition adds checklist source and research status
fields. All active orders remain available beyond the recent-history limit, and market
responses include quiet rounds, spread and clearing band. Each chat mutation must match
a complete, explicit instruction in the latest user message.

Agent audit adds optional redacted raw provider responses alongside normalized output.
Case/user linked audit filtering happens before recent-preview limits, and user trade
totals cover stored history. Evidence previews state their retained limits. No provider
output is reconstructed for calls made before this logging existed.
## 023  Sat 05:20  author: Aditya  affects: all
Evaluation on Atlas found N+1 query paths that were invisible on the in-memory store: every card called `engine.book()` (3 queries each, 65 companies), the flags scan ran `user_orders(user, market)` for every user times every market, and the treasury summary fetched each company. Measured: `/surveillance` 56s, `/` 5.8s, `/portfolio` 8.3s, `GET /surveillance/flags` 70s. Fixed with bulk store methods (`open_orders_all`, `market_orders`, `trades_recent`, implemented on MemoryStore and MongoStore), `engine.cards()` (two queries for any number of companies; used by `/companies` and `jobs.rank`), a flags scan that loads the recent tape once and only inspects markets that traded, and a markets map in `suggest`. After: `/surveillance` 0.5s, `/` 0.2s, `/portfolio` 0.3s, flags 0.5s. Rule for everyone: no store call inside a loop over companies or markets; add a bulk method instead. Also fixed the four React Compiler lint errors in the landing components (lint is clean) and `suggest` now skips discovered (unlisted) businesses.

## 024  Sat 05:45  author: Aditya  affects: all
The xAI team is out of credits (every call returns 403 "used all available credits or reached its monthly spending limit"). The Atlas appraisal batch stopped at 11 of 66. Everything still answers through the fallbacks (verified on Atlas: search, chat, acquire, persona, flags). `grok.py` now remembers a credits/spend-limit/429 reply and marks the provider blocked for 5 minutes (`GROK_BLOCK_S`), and `llm.is_configured` honors that, so no request waits on a dead key; `/readiness.grok.blocked_s` shows it. Whoever owns the xAI console: add credits or raise the monthly limit, then rerun `scripts/appraise_seeds.py --store` for the remaining 55.
## 025  Sat  author: Zhiyuan (A)  affects: all lanes using mock mode
`packages/contracts/examples/company-cards.json` now carries all twelve companies from
`apps/api/seeds/companies.json` rather than four. Additive only: the four Pittsburgh demo cards keep
their ids, values and file order, so the demo path and every existing fixture reference are
unchanged. The eight appended are the rest of the seeds, which means mock mode and the live API now
return the same set instead of diverging after the first four.

Market numbers for the appended cards are derived, not invented: `v0_per_share` is the seed's
`llm_estimate` over 10,000 shares, `confidence` is the seed's `llm_confidence`, and the bid/ask
spread is 25% of (1 - confidence), which is the ratio the two existing priced fixtures already
implied (Squirrel Hill 6.9% at conf 0.71, Bloomfield 16% at conf 0.38). Seeds with no
`llm_estimate` become `status: "stub"` with null prices, matching how Steel City Express was
already represented.

Consequence for other lanes: `listCompanies()` in mock mode returns 12, not 4, and a bare category
search returns more rows than before. City-filtered searches are unaffected. The landing page picks
its five trending markets by explicit id, all of which exist in both the fixtures and the seeds.

## 024  Sat 06:30  author: Aditya (with Claude)  affects: A
Deck: new slide 3 "We connect buyers and sellers" (owner, businesses not for sale, acquirer, investor, and the five Bartr steps between them, including the offer letter flow from 022) and slide 4 "Six things, each one built and running". Security slide redrawn as three layers (rules, two models separately, Grok red team). 16 slides. Not claimed anywhere: kicking a company off the exchange (no delist route exists; halts are the only enforcement).

## 025  Sat 07:30  author: Aditya  affects: A, C
Bidding page rebuilt around the round, in the deck's language but the app's design system. The page changes only at a round boundary (detected from `next_batch_at` moving on any book frame, so quiet rounds advance the clock too); between boundaries only the clock and a "new orders in" count move. Round clock (round number, big seconds, draining bar; one countdown source, no layout shift). Anonymous participants strip (stable word-and-number aliases from `views.alias`, "You" via `book.you`; shows who is in, then who traded for 4s after a clear; a quiet round says so in one line). Clearing price by round (SVG, placed by round number, dot size = volume, model value dashed, pin a round or follow live). "How round N cleared" drawn from that round's own snapshot with demand/supply at p*, volume, and a correct pro rata sentence. Resting book plate says "no cross · bid / ask" when nothing crosses. Both figures clip the y axis so the owner floor cannot flatten the cross (noted "off scale"). Ticket: side specific quick fills (ask / bid, or indicative when crossed), "Submit buy for round N", honest one-line rule. Engine: rounds fixed at `BATCH_INTERVAL_S` (10) unless `BATCH_ADAPTIVE=1`; a round must trade at least 1 share to move last price and the belief; `batch` frames carry `round`, `demand`, `supply`, `fills`, `book_snapshot`. Bots: calmer opinions (0.3 sigma), limits within 4% of last, whole shares, plus flow traders so the tape stays alive without a sawtooth. Two usability reviews (judge persona, trader persona) drove 20+ fixes, including: LOI buyer name from the session (was "Buyer: server"), search live-off shown as a note not an error, landing and results tables show "Next clear" instead of a crossed bid/ask, hero tape labeled an illustration, portfolio columns in words, placeholder sources removed from seeds. Deck: new slide 6 "How search works" (Places, Querit search and contents, Grok twice, evidence ranking, five-way valuation, live status), 17 slides, PDF/PPTX re-exported, new company screenshot. Rule: never `next build` while `next start` is serving; rebuild then restart.

## 026  Sat 00:50  author: A  affects: frontend
Company navigation now separates research from transaction controls. `/company/{id}` is the pre-bid overview with ownership, financial coverage, appraisal confidence, visible risk gaps, and expandable evidence. The additive `/company/{id}/bid` route contains the existing market, order, and owner-offer experience. Discovery links stay unchanged and the overview's `Bid for acquisition` action opens the bid route. No API, shared type, or database shape changed.

## 027  Sat 12:36  author: Codex  affects: A, B, D
Live discovery no longer requires Querit and Grok together. `DISCOVERY_LIVE=1` starts when any of Google Places, Querit or xAI is configured. Grok now uses the xAI Responses API server-side web search through the existing audited model wrapper; inline-cited business paragraphs are normalized into discovery pages and pass the existing evidence gate. Places results stream and persist before slower Grok research completes. Provider failures remain warnings and do not discard results from another source. The nationwide smoke script accepts sourced partial results as a successful search while still failing on zero results or terminal failure. No route, shared type or collection shape changed.

## 026  Sat 13:25  author: Zhiyuan (A)  affects: A, deploy
The iMessage bridge runs. It was written Friday and had never been installed or started: no
`node_modules`, no credentials, no line. `bun install` is now locked (120 packages, spectrum-ts
12.8.0, pinned off `latest` so a deploy is reproducible), the Photon Spectrum line is assigned
and connected, and the bridge boots `mode=live` with an authenticated heartbeat reaching
`POST /agent/heartbeat`.

Assigned line: **+1 (628) 289-4567**, Photon shared pool, DMs only, 10 users, free tier.
Spectrum credentials and `BRIDGE_API_TOKEN` are in `apps/imessage/.env` and the repo-root `.env`,
both gitignored. The two tokens must be equal or `/agent/chat` and `/agent/heartbeat` answer 403.
Set `IMESSAGE_NUMBER=+16282894567` in the root `.env`, or `/agent/channel` reports
`configured: false` and every screen shows the line as offline.

Decision 024 said the web assistant shows the bridge as connected. No frontend file read
`/agent/channel`, so that was not true. It is now. `components/agent/channel-status.tsx` polls
`/agent/channel` every 15s, shorter than the API's 120s liveness window, and renders the line
number, the heartbeat age and a Live/Offline chip on `/agent`. `connected` is the API's reading
and never the component's guess, so an unreachable API renders offline instead of optimistic.
The number is click to copy.

Verified against a contract-accurate stand-in for the bridge surface, because `apps/api` cannot
boot in this environment: `pydantic_core` is a native module and the sandbox refuses to load it.
Checked: 403 on a wrong bridge token, 200 and an `AgentMessage` on a correct one, a replayed
`request_id` returning the stored reply instead of placing a second order, 409 on the same
`request_id` with a different body, and `configured -> heartbeat -> connected` on
`/agent/channel`. `node --test apps/imessage/tests/client.test.mjs` passes 3 of 3. The bridge
typechecks clean and both frontend files are clean under `tsc` and `eslint`.

Two things are still open. `railway up` has never run, so the line answers only while the bridge
runs on someone's machine. And nothing links to `/agent`: the header carries Overview, Discover
and Admin only, and `components/site/*` is frozen, so a judge cannot reach the assistant without
typing the URL. D: that second one is a one-line nav entry if you want it.
