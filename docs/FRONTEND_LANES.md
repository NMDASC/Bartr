# Frontend lanes

For running several agent sessions on `frontend/` at once. Owner: A.

## Setup: one checkout, one dev server

Do NOT use git worktrees for this. One working tree, one `next dev` on port 3000, every session
edits files in it. Hot reload means every session's change is live on the same URL immediately,
there is no merge step between lanes, and there is no second `pnpm i`.

```bash
cd ~/github/JB/frontend && pnpm dev     # ONE of these, port 3000, leave it running
```

Rules that make it safe:

1. **Nobody runs `next build` or `next start`.** Both fight the dev server over `.next`, and a dev
   server holds `.next/dev/lock` so a second one cannot start. Verification is "load localhost:3000".
   Run `next build` once before pushing, from one session, after the others are idle.
2. **Never `git add -A` or `git add .`.** Stage only your lane's paths. One session's `-A` sweeps up
   another's half-finished file and commits it broken.
3. **Stay inside your lane's files.** If you need a change in a frozen file, say so in chat and let
   one session make it, then everyone continues.
4. **Pull before you start and after anyone pushes.** `git pull --rebase`.

## Frozen: the shared foundation

These are done. Changing one affects every screen, so they are not in any lane. A change here is a
stop-the-world edit made by one session while the others hold.

```
src/components/ui/*        button chip input label plate skeleton
src/lib/api.ts             the only data layer; every screen imports from here
src/lib/format.ts          usd px qty pct signed
src/lib/cn.ts
src/hooks/use-market.ts
src/styles/lemma-tokens.css
src/app/globals.css
src/app/layout.tsx
src/components/site/*      header footer back-link
packages/contracts/types.ts   contract: needs a DECISIONS entry (see CLAUDE.md)
```

## Lanes (no shared files between them)

| Lane | Owns | Notes |
|---|---|---|
| **1 Company** | `src/app/company/[id]/page.tsx`, `src/components/company/*` | the demo centerpiece, 0:50 to 1:50 of the three minutes. Highest value, give it the strongest session |
| **2 Portfolio + surveillance** | `src/app/portfolio/*`, `src/components/portfolio/*`, `src/app/surveillance/*` | |
| **3 Discover** | `src/app/page.tsx`, `src/app/search/*`, `src/components/search/*` | landing + results, 0:20 to 0:50 |
| **4 Agent + acquire** | `src/app/agent/*`, `src/components/agent/*`, `src/app/company/[id]/acquire/*`, `src/components/acquire/*`, `apps/imessage/*` | |

`src/lib/mock.ts` is shared but only matters while `NEXT_PUBLIC_API_URL` is unset. Once the frontend
points at the real API it is dead weight; do not edit it in a lane.

## Starting a session warm

Paste this, filling in the lane:

> You are working on lane N of the JB frontend, `~/github/JB/frontend`. Read `CLAUDE.md`,
> `frontend/README.md`, and `docs/FRONTEND_LANES.md` first, and use the `lemma-design` skill for
> anything visual. You own exactly the files listed for lane N and nothing else. A dev server is
> already running on port 3000, do not start another and do not run `next build`. Stage only your
> lane's paths, never `git add -A`. Task: <task>

## Why not worktrees

They cost a `pnpm i` each (577M of `node_modules` per tree), a port each, and a rebase per lane at
merge time. That is the right trade for week-long feature branches. For leaf screens on a 17-hour
clock it is pure overhead, because the expensive shared work (design system, primitives, contract,
data layer) is already built, so the lanes genuinely do not touch each other.
