# Demo runbook: Bartr over iMessage

The line is **+1 (628) 289-4567** (Photon shared pool, DMs only, free tier).

## Boot order

Three processes, in this order. Each one needs the one above it.

```bash
# 1. API, from the repo root so it reads the root .env
cd apps/api && uv run uvicorn app.main:app --port 8000

# 2. Bridge
cd apps/imessage && bun install && bun start

# 3. Frontend
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm dev
```

## Env that has to line up

Both `.env` files are gitignored, so anything running off this machine needs these set again.

| Variable | Where | Why |
|---|---|---|
| `BRIDGE_API_TOKEN` | repo root `.env` **and** `apps/imessage/.env` | Must be equal. Mismatched or unset and `/agent/chat` and `/agent/heartbeat` answer 403. |
| `IMESSAGE_NUMBER` | repo root `.env` | `+16282894567`. Unset and `/agent/channel` reports `configured: false`, so the web shows the line offline. |
| `JB_API_URL` | `apps/imessage/.env` | Where the bridge sends messages. Unset and the line says it is offline instead of claiming an order was placed. |
| `SPECTRUM_PROJECT_ID` / `_SECRET` | `apps/imessage/.env` | Photon project. Missing and the bridge exits on boot. |
| `NEXT_PUBLIC_API_URL` | frontend env | Unset means fixtures, and the channel bar reads offline. |

## Checks before you present

```bash
# API sees the bridge config
curl localhost:8000/api/v1/agent/channel -H 'x-demo-user: you@example.com'
#   want: "configured": true

# bridge is alive (run after the bridge has been up ~30s)
curl localhost:8000/api/v1/agent/channel -H 'x-demo-user: you@example.com'
#   want: "connected": true, "last_seen" within 120s
```

`/agent` shows the same thing: the line number, a heartbeat age, and a **Live** chip.

## Pairing, which is what makes it one account

The bridge can only report a sender's number, so the number is the account. On `/agent`, under
**your number**, enter the phone you will text from and press **Pair**. Signup and login also take
the number directly.

Unpaired, a texted order opens a second account with its own starting cash and nothing shows on
the web.

## Say these exactly

The order parser requires the whole message to be one complete instruction. This is deliberate:
a question, a conditional, or a reference to an earlier message confers no trading authority, so
a business description cannot talk the agent into a trade.

| Works | Does not |
|---|---|
| `buy 20 of Squirrel Hill Wash and Fold at 56` | `hey can you buy 20 of squirrel hill at 56` |
| `can you buy 20 of Squirrel Hill Wash and Fold at 56 please` | `buy squirrel hill, 20 shares, 56` |
| `cancel order ord_7f2a` | `yes do it` |

Also fine, and not order-shaped: `laundromat in pittsburgh`, `my orders`, `my portfolio`,
`what should i hold`, `/help`.

The business name has to match exactly one company, and quantity and price take at most two
decimals.

## The beat

1. `/agent` open on screen. Line reads **Live**, your number shows as paired.
2. Text `buy 20 of Squirrel Hill Wash and Fold at 56` from your phone.
3. Within ~4s the transcript gains two turns tagged `· imessage`, with the `place_order` card, and
   the account table adds the row. No reload.
4. Open `/overview`. Same cash, same holdings.

## If it goes wrong

| Symptom | Cause |
|---|---|
| Chip reads **Offline** | Bridge not running, or `IMESSAGE_NUMBER` / `BRIDGE_API_TOKEN` unset on the API. |
| Line replies but the web shows nothing | Number not paired, or paired in a different browser. The pairing is a cookie, not server state. |
| "No action taken" | The message was not one complete instruction. See the table above. |
| Agent answers but will not sell you a business | It was discovered, not listed. Orders on it are rejected; make the owner an offer on the web. |
| Bridge exits immediately | Spectrum credentials missing. |

## Known gaps, so nobody claims otherwise on stage

- Acquire and the owner offer letter are web only. There is no tool for them over text.
- The pairing has no possession check on the number, the same demo posture as decision 023.
- Photon free is a shared-pool number, DMs only. Do not invite the whole table to text it at once.
