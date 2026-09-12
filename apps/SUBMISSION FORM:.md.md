# HackCMU 2026 Submission Form — Bartr

This is a copy-ready draft based on the repository. Replace every `TODO` before submitting.

## Page 1

### Team

**Team Name:** JB

**Team Member 1 Name:** Nico Dascombe

**Team Member 1 AndrewID:** ndascomb

**Team Member 2 Name:** Vir Toolsidass

**Team Member 2 AndrewID:** vtoolsid

**Team Member 3 Name:** Aditya Dewan

**Team Member 3 AndrewID:** adidewan2

**Team Member 4 Name:** Zhiyuan Guo

**Team Member 4 AndrewID:** zguoliau

### Project

**Project Name:** Bartr

**Project Summary:**

Bartr is the first platform that connects small businesses to investors, potential acquirers, and people who just wanna support local mom and pop shops. Our proprietary search algorithms and quantitative strategies allow you to seamlessly discover, trade and acquire small businesses. 

**Will you be available for a live pitch?**

TODO — confirm whether at least one team member is available continuously from 4:15 PM to 7:00 PM.

**Pitch video link if not presenting live:**

TODO — add a public link, or enter `N/A` if presenting live.

### Project details

**Source Code Link:**

https://github.com/NMDASC/JB

**Project Link:**

TODO — no public deployment URL is recorded in the repository.

**Video Link:**

TODO — no public video URL is recorded in the repository.

**Track:** Optimization Track

**Track Justification:**

Bartr creates a market where none has existed, confronting thin liquidity, uncertain valuations, and fragile price discovery at three layers: a uniform-price batch auction concentrates liquidity; a Bayesian ensemble reconciles sparse evidence; and a half-Kelly portfolio engine sizes positions within each buyer’s budget, risk tolerance, and concentration limits

**Do you want to be in the IFM Sponsor Track as well?**

No. The repository contains an IFM-compatible provider and K2 review path, but the submitted configuration does not show completed IFM model use, so we should not claim this track.

**How did you use AI to build your project?**

We built Bartr with Cursor, OpenAI Codex, Claude Code, and AI review agents. They helped us work across frontend and API lanes, implement and test features, reconcile shared contracts, review the product and pitch, and fact-check claims. We kept a shared decision log and treated the code, contracts, tests, and manual demo checks as the source of truth for accepting generated work.

**How did you integrate AI into your project?**

At runtime, xAI Grok performs web research and structured business appraisal, parses discovery intent, answers questions through a grounded owner persona, narrates market activity, parses investor risk profiles, explains portfolio suggestions, reviews surveillance flags, generates adversarial red-team scenarios, writes market-health reports, drafts acquisition materials, and powers an agent with search, portfolio, and order tools. Every call goes through one audited provider layer with structured outputs, secret redaction, usage accounting, timeouts, caching, and deterministic fallbacks. Local sentence-transformer embeddings and a Bayesian valuation ensemble also support discovery and pricing.

## Page 2

### Make it Legendary with SpaceXAI Prize

**Apply:** Yes

**How did you use Grok products and Cursor?**

Grok is a working layer of the product rather than a single chat box. Grok 4.6 performs slower, source-backed business research and appraisal, while a fast Grok model handles interactive intent parsing, owner-persona answers, market narration, risk-profile parsing, portfolio explanations, compliance review, red-team attack planning, health reports, acquisition drafting, and the tool-calling assistant. Model inputs, outputs, errors, latency, and token usage are recorded through a secret-redacting audit boundary, and critical paths have deterministic fallbacks. We used Cursor throughout development with repository steering rules and shared contracts to coordinate the Next.js frontend, FastAPI exchange, discovery pipeline, and security console.

**Why is your project legendary?**

Bartr turns a search for an ordinary local business into an end-to-end acquisition path: find a real company, inspect sourced evidence, estimate its value with honest uncertainty, make the owner an offer, list only after owner acceptance, buy a fractional stake, and eventually pursue the whole business. Underneath that simple flow is a real market mechanism: volume-maximizing uniform-price batch auctions, Bayesian valuation updates, owner liquidity, half-Kelly position sizing, live WebSockets, and an adversarial surveillance system. It brings public-market-quality discovery, pricing, and controls to the businesses most technology platforms overlook.

### Sandia National Laboratories Prize

**Apply:** Yes

**How is your project cybersecurity related?**

Bartr treats both trading activity and AI agents as security-sensitive systems. Its exchange prevents self-trades, constrains prices with volatility bands, and can halt after repeated band hits. A rules engine detects wash trading, spoofing, concentrated ownership, pump behavior, and volatility-halt candidates. Grok can plan controlled wash, spoof, or pump attacks against demo accounts so the defenses can be tested, and independent model review can assess rule-generated flags. The administrator console preserves evidence snapshots, links cases to complete trade and agent history, supports human dispositions, and protects security routes with a server-only admin token. Agent inputs, outputs, failures, and raw provider responses are logged with secret redaction in an append-only audit trail.

### Best Use of Gemini API

**Apply:** No

**How did you use the Gemini API?**

N/A

### Best Use of ElevenLabs

**Apply:** No

**How did you use ElevenLabs?**

N/A

### Best Use of Vultr

**Apply:** No. The API has a production-ready Docker image, but the repository does not evidence a completed Vultr deployment.

**How did you use Vultr?**

N/A

### Best Use of Auth0

**Apply:** No. Auth0 variables are scaffolded, but the implemented application uses a clearly labeled demo cookie session rather than Auth0.

**How did you use Auth0?**

N/A

### Best Use of MongoDB Atlas

**Apply:** Yes

**How did you use MongoDB Atlas?**

MongoDB Atlas is Bartr's durable primary store when `MONGODB_URI` is configured. It persists discovered companies and their evidence, valuation snapshots, markets, orders, auction rounds, trades, user portfolios, acquisition drafts, owner offers, agent conversations, append-only audit events, and security cases. The store uses natural IDs and idempotent upserts so discovery can enrich an existing company without recreating its market. Forward-only migrations create operational, identity, audit, security-case, and acquisition indexes, plus an Atlas Vector Search index for 384-dimensional company embeddings. The team exercised the real exchange against Atlas and verified that seeded markets, trades, positions, and audit records survived application restarts.

