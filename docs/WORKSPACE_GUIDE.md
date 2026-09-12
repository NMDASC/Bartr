# Bartr workspace

The redesign gives each job a distinct home:

| Area | Route | What works |
| --- | --- | --- |
| Overview | `/` | Personal account value, available cash, active/filled/all orders, cancellation, allocation, recent activity, messaging state |
| Discovery | `/search` | Browse seeded businesses, category filters, city shortcuts, live discovery with partial results and retry |
| Business market | `/company/[id]` | Simple order ticket and chart; Advanced exposes every book level, source filters, depth, trade tape and batches |
| Portfolio | `/portfolio` | Holdings, actual returns, orders, adjustable suggested sizing and expandable valuation details |
| Assistant | `/agent` | Shared web/iMessage conversation, search, order/portfolio status, placement and cancellation |
| Acquisition | `/company/[id]/acquire` | Generate, edit, preview, download and save a personal LOI draft and diligence checklist |
| Security | `/surveillance` | Persistent investigations, affected users/assets, independent opinions, full transcripts, searchable audit archive, evidence exports and case dispositions |

## Run with the API

Use the repository's existing API and frontend start commands. Set
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in `frontend/.env.local`.
Restart the appropriate service when changing environment variables. Follow
`FRONTEND_LANES.md`: one dev server, and do not build into its `.next` directory.
An isolated production build can use `NEXT_BUILD_DIR=.next-review npm run build`.

The default browser-only simulator supports exploration and trading. The assistant,
administrator console and saved acquisition drafts require the API. Simulator orders
and balances are local to that browser runtime and reset on reload.

Use the session selector in the top bar to select a name, email or phone. Personal data
is fetched in the browser under that identity; pages no longer share a server account.
This preserves the hackathon's demo identity model. It is **not verified authentication**.
Anyone who knows a demo identity can choose it. Connect real identity verification before
using this account model beyond the demo.

## Administrator setup

Generate a random token, for example with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`.
Put it in the root `.env` as `ADMIN_API_TOKEN`, restart the API, then enter that token
on the security page. The browser holds it only in page memory. Lock clears the console;
refreshing the page requires it again. Never put the token in a `NEXT_PUBLIC_` variable.

Both the new `/api/v1/security/*` endpoints and the legacy `/api/v1/surveillance/*`
endpoints enforce this token. An absent server token returns 503; an invalid/missing
caller token returns 403.

The rules engine captures cases automatically every 15 seconds. Configured Grok and K2
providers independently review new findings. Set `SECURITY_AUTO_REVIEW=0` for manual-only
model review. The console's provider badges mean configured, not a guarantee that a
provider call succeeds. Errors and timeouts appear in the transcript archive. Manual review handles up to three
findings per request and reports how many still need complete opinions. Missing provider
opinions remain eligible for retry; each reviewer receives the rules evidence without
the other reviewer’s conclusion.

Investigations connect the rule, affected identities, market, batch, trade/order evidence,
independent reviewer explanations and review history. Review notes are required for a
status change. New evidence reopens resolved/dismissed cases. Detection packets are also
archived as audit events, preserving earlier evidence after a case receives an update.

The transcript and audit tabs search all stored content, including nested model inputs
and responses, and load older results without moving the time anchor. The overview export
contains all cases and the latest 500 rows per event feed; a case export contains its
retained evidence packet. Linked case/user previews limit recent trades/orders to 100 and
related audit to 100. Use the archive search for earlier calls and detection packets.

Use `STATE_FILE` for durable MemoryStore snapshots or `MONGODB_URI` for MongoStore. Run
migration 007 when using Mongo. New case records, dispositions, agent transcripts,
conversations and acquisition drafts survive restart when persistence is configured.
Existing records cannot reconstruct model output that occurred before logging was added.

## iMessage setup

Configure the Photon bridge using `apps/imessage/README.md`. The API and bridge must share
`BRIDGE_API_TOKEN`; the API's `IMESSAGE_NUMBER` must be the real assigned line. A heartbeat
under 120 seconds old drives the connection badge. Use the same normalized phone number
in the web session selector to see messages and orders from iMessage.

The implementation tests do not send external messages. Real Photon delivery still needs
a configured line, credentials and a running bridge.

## Checks

From `frontend`: `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/eslint src`.

From `apps/api`:

```sh
SECURITY_AUTO_REVIEW=0 MONGODB_URI='' STATE_FILE='' BOTS=0 XAI_API_KEY='' IFM_API_KEY='' .venv/bin/python -m pytest -q
```

From the repository root:

```sh
node --test frontend/tests/search-state.test.mjs apps/imessage/tests/client.test.mjs
```

The new lifecycle tests cover administrator access, account isolation, reservation release,
phone normalization, bridge authentication, delivery replay, acquisition persistence,
case evidence/dispositions/reopening, archive search/paging and secret-redacted model logs.
