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
├── backend/          # NestJS REST API + agent loop — see backend/CLAUDE.md (Steps 1–2 done)
├── frontend/         # Vite + React + TS SPA (Step 7, not started)
└── infra/            # Terraform for tomo-gym's own AWS resources (Step 9)
                      #   (shared VPC / EC2 host / RDS live in the octirion-platform repo)
```

Backend and frontend are separate directories at the root, not a monorepo. No root `package.json`. Conventions are copied from denwa-alert (same stack); when in doubt, check how denwa-alert does it.

## Cross-cutting rules worth repeating here

These are in [constitution.md](constitution.md) but are the ones most likely to be violated:

- **Dates come from the server.** Inject the current timestamp + the user's IANA timezone on every LLM request. Never let the model infer the date from history (rule 8).
- **The LLM never computes derived values.** Day numbers, calories and unit conversion are deterministic server code (rule 9).
- **Agent tools wrap services and are served only through tomo's MCP server** (`/mcp`), which our own agent calls over HTTP like any client. Validation happens at the MCP boundary; `user_id` comes from the token (turn token or personal access token), never from tool arguments; tool handlers have no DB access (rules 4, 10).
- **Privacy by default.** Body metrics, email and chat transcript are never shown to anyone else. Friends see workouts only at the owner's chosen level (activity-only by default), enforced in services with separate DTOs per level (rule 16).
- **Secrets via environment variables only**, especially the Anthropic API key, which never reaches the client.
- **Every feature gets at least one unit test**; prompt / tool / model changes re-run the parsing eval set (rules 14–15).
- **If a feature isn't in the spec, don't build it** (rule 26).
