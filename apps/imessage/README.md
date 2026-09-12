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

Set `JB_API_URL` to the FastAPI host to talk to the real agent. Unset, the bridge
answers from a three-line canned script so the line can be demoed before the agent lands.

## Deploy

`railway.json` and `Dockerfile` are set. `railway up` from this directory, then set the three env vars.

## Limits (Photon Free)

Shared-pool number, max 10 users, DMs only (no group chats). Enough for a judge table.
