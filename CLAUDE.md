# tomo-gym

Conversational workout logger. Users type workouts in plain text → a server-side Claude agent parses them and writes structured rows to Postgres through the backend's services → a one-line confirmation streams back. Users can also ask questions about their history, and join invite-only friend groups (feed, reactions, comments, leaderboards). Mobile-first web, open signup.

## Source of truth for rules

[constitution.md](constitution.md) holds the non-negotiable rules (stack, hosting, agent & data integrity, code quality, MVP scope). It's short — read it in full for any non-trivial task, and it overrides anything said here.

## Current roadmap

[ROADMAP.md](ROADMAP.md) tracks the MVP steps, per-step detail, open decisions and a dated changelog of scope decisions. Consult it to see what's in flight and what's next.

## Repo layout

```
/
├── constitution.md   # project rules — authoritative
├── ROADMAP.md        # MVP plan, status, changelog
├── CLAUDE.md         # this file
├── backend/          # NestJS REST API + agent loop — see backend/CLAUDE.md (Steps 1–5a and 6a done, with a stubbed model; 5b needs an API key, 6b the domain)
├── frontend/         # Vite + React + TS SPA, mobile-first PWA, EN/JP — see frontend/CLAUDE.md (Steps 7 and 8 done: sign-in/up, chat logger, history, profile; friend groups are Step 12)
└── infra/            # Terraform for tomo-gym's own AWS resources (Step 9)
                      #   (shared VPC / EC2 host / RDS live in the octirion-platform repo)
```

Backend and frontend are separate directories at the root, not a monorepo. No root `package.json`. Conventions are copied from denwa-alert (same stack); when in doubt, check how denwa-alert does it.

## Resuming work

Notes for a new session (or another account) picking this up. The repo is the only record; earlier chat history doesn't carry over.

- **Where things stand:** read [ROADMAP.md](ROADMAP.md): the milestones table, then the changelog (newest first).
  - As of 2026-11-21, Steps 1–8 are done (4 and 5a with a stubbed model).
  - **Next buildable step: 12a** (friend groups: groups, invite links, members, visibility setting, feed), planned in detail under "Step 12 — detail".
  - **Blocked on the owner:** 5b needs an Anthropic API key; 6b, 9 and 11 need the domain.
- **The owner's working preferences:**
  - **Pushing straight to `main` is fine for this repo** (a private project; the owner said so on 2026-11-19). Push the working branch too.
  - Talk through a step's plan before building when asked. Decisions that are the owner's go to them, and the answers are recorded in the roadmap changelog.
  - Keep text diagrams narrow and vertical: wide ones render broken on the owner's screen.
- **Open work in other repos (on GitHub, not in this repo):**
  - denwa-alert PRs, each on its own branch:
    - yashmurty/denwa-alert-project#1: ACL 500 → 401;
    - yashmurty/denwa-alert-project#3: `updateUser` copies allowed fields;
    - yashmurty/denwa-alert-project#4: Node 24; merging changes production's runtime, so watch the first deploy;
    - yashmurty/denwa-alert-project#5: a wrong password no longer shows "session expired".

    denwa changes always go through PRs, never straight to its `main`.
  - Offered, not started: a friendlier login error message from denwa's backend.
  - Issues yashmurty/denwa-alert-project#2 and yashmurty/tomo-gym-project#1: the `for...of` refactor, deferred.
- **Local setup:** Node 24. Create `backend/.env` from `.env.template` with fresh keys from `backend/scripts/generate-jwt-keys` (never committed). Postgres runs on 5433, the API on 3001 and the app on 5174 (Vite proxies `/api`). Details are in [backend/CLAUDE.md](backend/CLAUDE.md) and [frontend/CLAUDE.md](frontend/CLAUDE.md).

## Cross-cutting rules worth repeating here

These are in [constitution.md](constitution.md) but are the ones most likely to be violated:

- **Dates come from the server.** Inject the current timestamp + the user's IANA timezone on every LLM request. Never let the model infer the date from history (rule 8).
- **The LLM never computes derived values.** Day numbers, calories and unit conversion are deterministic server code (rule 9).
- **Agent tools wrap services and are served only through tomo's MCP server** (`/mcp`), which our own agent calls over HTTP like any client. Validation happens at the MCP boundary; `user_id` comes from the token (turn token or personal access token), never from tool arguments; tool handlers have no DB access (rules 4, 10).
- **Privacy by default.** Body metrics, email and chat transcript are never shown to anyone else. Friends see workouts only at the owner's chosen level (activity-only by default), enforced in services with separate DTOs per level (rule 16).
- **Secrets via environment variables only**, especially the Anthropic API key, which never reaches the client.
- **Every feature gets at least one unit test**; prompt / tool / model changes re-run the parsing eval set (rules 14–15).
- **If a feature isn't in the spec, don't build it** (rule 26).
