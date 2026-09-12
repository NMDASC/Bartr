# JB over iMessage

Text the JB line and talk to the same agent the web app uses. One endpoint
(`POST /api/v1/agent/chat`), two transports.

Built on [Photon Spectrum](https://photon.codes). Managed iMessage line, so nothing runs on a Mac.

## Run

```
bun install
cp .env.example .env    # fill SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET
bun run dev             # local terminal chat UI, no phone needed
bun start               # real line
```

Set `JB_API_URL` to the FastAPI host to talk to the real agent. Set the same `BRIDGE_API_TOKEN` in this service and the API. With no API URL, the
line reports that it is offline and never claims an order was placed.

## Deploy

`railway.json` and `Dockerfile` are set. `railway up` from this directory, then set the Spectrum credentials, `JB_API_URL`, and `BRIDGE_API_TOKEN`.

## Limits (Photon Free)

Shared-pool number, max 10 users, DMs only (no group chats). Enough for a judge table.

## Shared account and live status

The assigned line is **+1 (628) 289-4567** (Photon shared pool). Set
`IMESSAGE_NUMBER=+16282894567` in the API's root `.env`, or `/agent/channel` reports
`configured: false` and the web assistant shows the line as offline.
The bridge sends an authenticated heartbeat every 30 seconds. The web overview and
assistant show the bridge as connected only after a recent heartbeat (under 120 seconds).
Terminal mode does not claim an iMessage connection.

Use the same phone number in the web session selector as the incoming sender. The API
normalizes phone formatting and stores both transports in one conversation. Session
identity is the existing hackathon demo identity, not verified phone authentication.

Supported examples: `my orders`, `my portfolio`, `buy 10 of Squirrel Hill Wash and Fold at 56`,
`sell 2 of Squirrel Hill Wash and Fold at 58`, and `cancel order <order-id>`.
Incoming delivery IDs are forwarded as `request_id` so replayed deliveries do not place
duplicate orders within the retained conversation window. After an interrupted response,
check order status before sending a new trade instruction.

Verify the transport without sending real messages:
`node --test apps/imessage/tests/client.test.mjs` from the repository root (Node 22.18+).
The full Spectrum service requires `bun install` and the configured project credentials.
