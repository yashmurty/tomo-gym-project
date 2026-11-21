# Roadmap — tomo-gym

High-level milestones for the MVP. Living document — update as scope and sequencing shift.

Rules of the road live in [constitution.md](constitution.md). If the roadmap ever conflicts with the constitution, the constitution wins.

## Milestones

| # | Step | Status |
|---|---|---|
| 1 | Backend scaffold (NestJS starter → `tomo-gym-backend`, ACL-based auth, CI) | Done |
| 2 | Accounts — User (IANA timezone, locale, body weight + display unit, age confirmation), email + password signup (email verification deferred to Step 6) | Done |
| 3 | Workout domain — exercises + aliases (seeded EN/JP catalog), sessions, entries + entry_sets, computed day numbers, deterministic calorie calc, REST CRUD | Done |
| 4 | Agent vertical slice over MCP — tomo MCP server (`/mcp`) + `POST /chat` agent loop as its MCP client → Claude → `log_entry` over HTTP → row in Postgres → streamed confirmation; personal access tokens for external MCP clients; tables for chat messages, agent action log (undo), idempotency, LLM usage | Done with a stubbed model; the real Anthropic client is pending an API key |
| 5a | Full agent toolset (stub-testable) — corrections, bulk date moves, "same as last time", history Q&A, alias learning, profile, `undo_last`; undo for every agent write; parsing eval cases + runner | Done |
| 5b | Real model — Anthropic client, first real eval run, system prompt / tool description tuning, model routing | Not started (needs an Anthropic API key) |
| 6a | Signup gate, part 1 — rate limits (chat, MCP, login, signup), per-user USD budgets, global daily cap, admin usage report, `SIGNUP_MODE` switch | Done |
| 6b | Signup gate, part 2 — email verification (SES); unverified users can't use the agent. Production signup stays closed until this ships | Not started (blocked on buying the domain) |
| 7 | Frontend scaffold — Vite + React + TypeScript SPA, mobile-first, PWA manifest | Done |
| 8a | Frontend screens, part 1 — sign-in / sign-up, chat logger with streaming + undo (and the backend it needed) | Done |
| 8b | Frontend screens, part 2 — history list/edit, profile (timezone, body weight, units, MCP access tokens) | Done |
| 9 | Deploy (blocked on buying the domain) — backend onto octirion-platform (shared EC2 + RDS), own ECR / S3 + CloudFront / DNS in `infra/` | Not started |
| 10 | Tests + evals per feature (constitution rules 14–15) | Ongoing discipline, applied inside each step |
| 11 | Pre-launch — landing page, privacy policy, ToS, SES sandbox exit | Not started |
| 12 | Friend groups — invite-link groups, per-user visibility (activity-only / full), group feed, reactions, comments, leaderboards (backend + screens; ships before launch) | Not started |

Explicitly out of MVP scope per constitution rules 21–26: native app, voice input, billing, languages other than EN/JP, social features beyond friend groups (public profiles, search, followers, DMs, notifications), integrations, data import, progression suggestions, charts.

## Step 1 — detail

Mirror denwa-alert Step 1: scaffold `backend/` from monstar-lab-oss/nestjs-starter-rest-api, realign auth to JWT-at-controller / ACL-in-service (no `@Roles`), keep the `article` module as a frozen reference, CI workflows at repo root with a `backend/**` path filter, local dev with Nest on the host and Postgres in Docker. Copy conventions from denwa's `backend/CLAUDE.md` rather than re-deriving them.

### Done (2026-11-19)

- `backend/` copied from denwa-alert's backend (tracked files only, no git history) rather than re-scaffolded from the bare starter, so the auth realignment, ACL pattern, logging, Docker and lint setup come over intact. Package renamed `tomo-gym-backend`; Swagger titled "tomo-gym API".
- **Removed:** denwa's `organization` / `team` / `on-call` / `alerting` modules and their e2e tests; email verification (token entity / repo / service, mailer, `@aws-sdk/client-ses`, the `verify-email` / `resend-verification` endpoints), which returns in Step 6; `User.phone` and the self-output DTO that only existed for it; the deploy workflow (Step 9).
- **Migrations squashed** to a fresh base: `CreateUsers` (no `username`, `emailVerifiedAt` or `phone`) + `CreateArticles`. The drift check (`migration:generate --check`) reports no changes.
- **Privacy alignment (constitution rule 16):** `USER` can now read only themself (denwa allowed reading any user, and user records carry email). New e2e tests cover it: a regular user can read their own profile, gets 401 on another user's and on `GET /users`.
- **Upstream ACL bug fixed:** `BaseAclService` threw "Resource is required for ruleCallback" on resource-less checks (e.g. `Action.List`) whenever an *unrelated* callback rule existed, so a regular user's `GET /users` returned 500 instead of 401. Rules that don't cover the requested action are now skipped before their callback runs, with regression unit tests. denwa-alert still has this bug.
- **Local dev ports** 3001 (API) / 5433 (Postgres) / 8081 (adminer), offset from denwa's so both run at once. The compose file sets `name: tomo-gym`, since both repos keep it in a `backend/` directory, which would otherwise share container and volume names (and Postgres data). `TEST_DB_PORT` is configurable (default 5433).
- **CI:** `backend-build` and `backend-tests` at repo root. The tests workflow generates a throwaway JWT keypair per run instead of reading repo secrets, so the repo needs no secrets.
- Verified: build and lint clean; 103/103 unit tests; 33/33 e2e tests, also run CI-style (no `.env`, env vars only); smoke test on the built app: `POST /api/v1/auth/register` → `POST /api/v1/auth/login` → `GET /api/v1/users/me` 200, and `GET /api/v1/users` as a regular user returns 401.

## Step 2 — detail

- `User` gains:
  - `timezone`: IANA name, required, prefilled from the browser at signup. Validated with `Intl` and **stored exactly as sent**. Node's ICU "canonicalises" in inconsistent, version-dependent directions (e.g. `Asia/Kolkata` → legacy `Asia/Calcutta`), and any valid name gives the same results.
  - `locale`: `en` | `ja`, required, prefilled from the browser.
  - `weightKg`: nullable. Always stored in kg. Input is `weight` in `weightUnit`; the server converts lb → kg (constitution rule 9). Optional at signup; the app asks the first time a calorie estimate needs it.
  - `weightUnit`: `kg` | `lb`, display preference, default `kg`.
  - `ageConfirmedAt`: set when the user ticks "I'm at least 16" at signup.
- **Not collected** *(decided 2026-11-19)*: height, birth date and sex. No MVP feature uses them, and collecting unused health data is a privacy liability (constitution rule 16). The minimum age (16) is a signup checkbox plus a ToS clause instead of a birth date.
- No email verification yet: it needs SES, and SES needs a verified domain, which isn't bought yet. It moves to Step 6.
- Open signup is allowed in code from this step, but production signup stays closed until Step 6 ships.

### Done (2026-11-19)

- Migration `AddProfileToUsers` adds `timezone`, `locale`, `weightKg` (`numeric(5,2)`), `weightUnit` (default `kg`) and `ageConfirmedAt` (`timestamptz`). Existing rows are backfilled via temporary defaults (`UTC` / `en`) that are then dropped. Verified on a DB with an existing user; reverts cleanly; drift check clean.
- `POST /auth/register` requires `timezone`, `locale` and `ageConfirmed: true`; `weight` + `weightUnit` are optional. **Signup now builds the new user field by field** instead of spreading the request body, so smuggled fields (e.g. `roles: ["ADMIN"]`) are ignored. `UserService.updateUser` was changed the same way: the starter's `{ ...user, ...input }` let a caller that bypasses HTTP validation (agent tools, CLI, tests) set `roles`. Not reachable over real HTTP, where `main.ts` whitelists fields. The auth and user e2e tests now use the production `VALIDATION_PIPE_OPTIONS`.
- `PATCH /users/:id` (self only) updates `timezone`, `locale`, `weightUnit` and `weight`. `weight` is read in the unit sent alongside it, else the saved unit, and `null` clears it.
- Shared helpers: `isValidTimezone` / `@IsIanaTimezone` (`shared/time`); `toKg` / `toBodyWeightKg` with the exact lb factor and a 20–400 kg range checked *after* conversion (`shared/units`); `numericTransformer` so `numeric` columns read back as numbers (`shared/typeorm`); `LOCALE` enum.
- Verified: build and lint clean; 128/128 unit tests; 49/49 e2e tests (added: invalid / offset / missing timezone, unticked age box, bad locale, implausible weight, smuggled role, lb signup, profile updates, alias stored as sent, editing another user denied); smoke test on the built app.

## Step 3 — detail

### Critique of the starting data model (from the brief)

Changes vs. the brief's model, each to be confirmed when implementation starts:

1. **Day number is not stored.** If it's computed at read time (`row_number() over (partition by user_id order by date)` across sessions that have ≥ 1 live entry), reassigning or deleting entries can't make it drift. Storing it would need renumbering on every edit.
2. **Sessions are implicit.** `log_entry` finds or creates the session for the target date (unique `(user_id, date)`). This drops `start_session` as a tool and removes the "forgot to start a new session, stale session carried over" failure mode, which is a cousin of the date bug.
3. **Aliases get their own table** instead of `aliases[]`: `exercise_aliases(user_id, normalized_alias, exercise_id)`, unique on `(user_id, normalized_alias)`. That keeps lookups indexed and stops one alias mapping to two exercises.
4. **A shared exercise catalog plus user-owned exercises.** Open signup means every new user would otherwise start from zero. Seed a global catalog (`user_id IS NULL`) carrying `modality`, `muscle_group`, a default MET value, display names in EN and JP, and global aliases in both languages (ラットプルダウン, レッグカール, …); users can add their own.
5. **Sets live in a child table** *(decided 2026-11-19)*. Uniform `sets × reps @ weight` columns can't represent pyramids ("10/8/6 @ 40/45/50"), drop sets or a short last set, which open-signup users will log. Strength entries get `entry_sets(entry_id, set_index, reps, weight_kg)`, unique on `(entry_id, set_index)`. The common "2x10 @ 47kg" is just two identical rows. `entries` drops the `sets` / `reps` / `weight_kg` columns, and an entry plus its sets are always written in one transaction. Cardio entries have no set rows. Reads summarise the sets: "2×10 @ 47kg" when they're identical, "10/8/6 @ 40/45/50" when not. "Top set" (heaviest weight, then most reps) is the default figure for "last weight" and progression.
6. **One `entries` table for strength and cardio is fine**, with a CHECK constraint per modality (strength needs sets; cardio needs a duration). Add `distance_km` for runs and rides. Bodyweight work uses `weight_kg` as *added* load (null = none).
7. **Calories are computed at write time and recomputed on edit**, storing `est_kcal` plus the `met_value` used. For walking and running, use the ACSM equations (speed + incline → VO₂ → METs) rather than a flat MET table, so incline actually counts. Strength estimates are flagged as rough in the UI.
8. **Body weight changes over time.** Calories use the weight at write time (snapshotted via the computed `est_kcal`). A weight history table is out of scope for MVP.
9. **Units are converted by the server, not the model.** Tools take `weight` + `unit` (`kg` | `lb`) and the server converts. "19lg" is resolved by the model to `kg` as a unit choice, not arithmetic.
10. **Idempotency lives on the chat request, not the entry.** One message can create several rows, and the agent isn't deterministic, so re-running it on a retry is wrong even if each row were deduplicated. Store `(user_id, idempotency_key)` on the user `message` row; a repeat key replays the stored result.
11. **Agent action log for undo.** `agent_actions(message_id, tool, entry_id, before jsonb, after jsonb)` records every write. Undoing a turn replays it in reverse, which covers updates and moves too, not just creates. Entries get `deleted_at` (soft delete), so undoing a delete restores the row.
12. **Entries link to the message that created them** (`source_message_id`) in addition to `raw_input`. This powers per-turn undo and "show me what I typed".
13. **`messages` stores structured content** (jsonb content blocks including tool_use / tool_result), not just text, so history can be replayed to the API faithfully. Only a recent window is sent per request.
14. **New table `llm_usage`**: user, message, model, input / output / cache-read / cache-write tokens, timestamp. Feeds the budget check in Step 6.

### Dates vs timestamps *(decided 2026-11-19)*

- The day a workout belongs to is a Postgres `DATE` (`sessions.date`, user-local calendar day), never derived from a timestamp. A timestamp's day depends on which timezone converts it, so travel or a timezone change would move past workouts and shift day numbers and streaks. Backdated entries ("I did legs yesterday") also have no time of day to store.
- "Today" is resolved once per request from the current instant + the user's timezone (constitution rule 8), then stored as a date.
- `created_at` columns stay `timestamptz` (ordering, audit, undo).
- `DATE` values travel as `'YYYY-MM-DD'` strings end to end, never JS `Date` objects (`new Date('2026-11-19')` is UTC midnight and can render as the 18th). A test pins this.

### Deliverables

- One TypeORM migration for the schema above, plus a seed for the exercise catalog and MET values.
- `CalorieService` (pure, table-driven, unit-tested against hand-computed values).
- Day-number query and REST CRUD for sessions and entries (these also power the edit UI in Step 8), all with ACL in services.
- Two output DTOs for a training day from the start: `DaySummaryOutput` (date, exercises, muscle groups, day number; no sets, reps or weights) and `DayDetailOutput`. Step 12 serves activity-only friends from the summary DTO (constitution rule 16), so it must never gain detail fields.

### Done (2026-11-20)

- **Scope change:** the chat transcript (`messages`), `agent_actions` undo log, idempotency keys and `llm_usage` moved to **Step 4**. Nothing writes to them until the agent exists (constitution rule 26). Services already take an `EntryOrigin` (`source`, `rawInput`, `sourceMessageId`, `sourceClient`) so Step 4 only has to pass it.
- **Migrations:** `CreateWorkoutTables` (exercises, exercise_aliases, sessions, entries, entry_sets) and `SeedExerciseCatalog` (32 shared exercises, 138 EN/JP aliases, Compendium MET values; it fails if two exercises claim one alias). Drift check clean; both revert and re-run cleanly.
- **Exercises** (`src/exercise/`): a shared catalog (`userId` NULL) plus custom exercises per user. Partial unique indexes keep names and aliases unique per scope. Aliases are matched on `normalizeExerciseName` (NFKC, lowercase, separators dropped), so "Lat Pull-Down", "lat pulldown", "ラット・プルダウン" and half-width "ﾗｯﾄﾌﾟﾙﾀﾞｳﾝ" all hit one key. A user's alias beats a shared one. Unknown names fail with 422 and "Did you mean …?" suggestions. `GET /exercises?search=`, `POST /exercises` (a duplicate of any visible alias → 409).
- **Workout** (`src/workout/`): `POST /entries` (log; sessions are created implicitly), `PATCH /entries/:id` (sets replace, `date` moves, null clears cardio fields, calories recomputed), `DELETE /entries/:id` (soft delete), `POST /entries/move` (atomic bulk move), `GET /days`, `GET /days/:date`, `PUT /days/:date/note`. Owner-only ACL via `WorkoutAclService`.
- **Modality rules:** strength needs sets; cardio needs a duration; bodyweight takes either. Errors say what to send instead, so the agent can self-correct.
- **Calories** (`workout/services/calorie.ts`, pure): MET × kg × hours. Walking / running with a speed use the ACSM equations (incline counts; decline treated as flat; 8 km/h switches walk → run). Strength assumes **2 min per set** and is flagged `kcalIsRough`. No body weight → `estKcal` null. Verified against hand-computed values; the brief's 10-min walk is 58.6 kcal.
- **Dates:** `shared/time/calendar-date.ts` resolves `today` / `yesterday` / `YYYY-MM-DD` in the user's timezone and rejects future and impossible dates. **Found during the build:** node-postgres parses `DATE` into a JS `Date` at local midnight on raw queries (the day-number window query is raw SQL), so on a server east of UTC it reads as the previous day. `shared/typeorm/pg-date-parser.ts` makes `DATE` a plain string everywhere. An e2e test runs with `TZ=Asia/Tokyo` and fails without the fix.
- **Day numbers** are computed per query (`ROW_NUMBER()` over the user's days with live entries). Moves and deletes renumber correctly, and e2e tests cover both.
- **E2E setup now runs the real migrations** instead of `synchronize`, so every e2e run exercises the migrations and the seeded catalog.
- Verified: build and lint clean; 168/168 unit tests (incl. modality rules, exercise resolution and both ACLs); 83/83 e2e tests (33 new: alias resolution EN/JP/half-width, lb sets, smuggled server-only fields ignored, ACSM walk, modality errors, dates, day numbering through moves and deletes, the TZ test, edits, notes, cross-user denial, custom exercises); smoke test on the built app.

## Step 4 — detail

The vertical slice: `POST /chat` (SSE stream) → agent loop → `tools/call log_entry` over HTTP to tomo's MCP server → row in Postgres → streamed confirmation. The same `log_entry` works from an external MCP client (e.g. Claude Code with a personal access token). No UI.

### Architecture *(decided 2026-11-20)*

```
POST /chat ─▶ agent loop (Messages API) ─┐
                                          ├─ HTTP ─▶ /mcp (MCP server) ─▶ tool layer ─▶ services ─▶ Postgres
external MCP client (PAT) ───────────────┘
```

- **One tool surface.** Tools are defined once (input DTO + handler over services) and served by the MCP server (`@modelcontextprotocol/sdk`, Streamable HTTP, stateless). Our agent is an MCP client of it, like any external client: it lists the tools, converts them to Messages API tool definitions, and sends each `tool_use` as a `tools/call` over HTTP. No in-process shortcut.
- **Validation at the MCP boundary**, for every client: the shared `ValidationPipe` settings plus `forbidNonWhitelisted`, so an unexpected field (model confusion or prompt injection) becomes an error result, which is logged, and never a write. Tool definitions sent to Claude also use `strict: true` + `additionalProperties: false`.
- **Auth on `/mcp`: every call resolves to exactly one user.**
  - Our agent sends a **turn token**: a JWT minted per chat turn, signed by the server, ~5 min expiry, carrying `sub` (user), `mid` (chat message id) and a scope restricted to MCP.
  - External clients send a **personal access token** (stored hashed; create / list / revoke via REST).
  - Login access tokens are *not* accepted on `/mcp`.
- **Server-only context never crosses the wire.** `/mcp` loads the chat message by the turn token's `mid` (checking it belongs to `sub`) and attaches `raw_input` + `source_message_id` itself. "Today" comes from the server clock + the user's timezone. PAT calls get `source = mcp` + client name, and no `raw_input`.
- **Tool handlers have no database access.** They receive read-only context (user, action group, today) and call services. Services own one short transaction per call (entry + sets + `agent_actions` row). An ESLint `no-restricted-imports` rule on the tool layer blocks `typeorm` / `DataSource` / `EntityManager` / repositories.
- **No transaction spans a turn.** A turn waits seconds on Claude between tool calls, and holding a DB connection that long would exhaust the pool. Turn-level undo uses the `agent_actions` log grouped by action group (chat message or MCP request), not a transaction.
- **Dates:** `date` arguments accept `today` / `yesterday` / `YYYY-MM-DD`, resolved server-side in the user's timezone; results echo the resolved date and day number (constitution rule 8).
- **Local loopback:** the agent reaches `/mcp` via `MCP_INTERNAL_URL` (localhost in dev and in the prod container). External use needs public HTTPS, so it's blocked on the domain (Step 9). Until then it's tested locally with MCP Inspector / Claude Code.
- **OAuth 2.1** for one-click claude.ai connectors is post-MVP (see Steps 13+).

### Request flow (one chat message)

Example: "2x10 @ 47kg lat pulldown".

1. App → `POST /chat` with the login token + idempotency key.
2. `/chat`: identify the user → rate limit / budget check (rule 17) → idempotency replay check (rule 11) → save the message → resolve today in the user's timezone (rule 8) → mint a turn token `{user, message}`.
3. Call Claude: cached system prompt + tools, then a per-request block (now, timezone, profile), recent chat, the message.
4. Claude returns `tool_use: log_entry {exercise, sets, unit, date: "today"}`.
5. Agent → `POST /mcp tools/call` with the turn token. `/mcp` verifies the token, validates input, resolves "today" itself, loads `raw_input` from the message, and calls `EntryService.logEntry()`. One short transaction writes the session (find or create), entry, set rows, calories and the `agent_actions` undo record.
6. Tool result (`entry_id`, date, day number) → Claude → one-line confirmation.
7. Stream the text and an "entry created" event (SSE) to the app; save the reply and token usage.
8. Undo is plain REST, no Claude: `POST /messages/:id/undo` reverses that message's `agent_actions`.

Corrections ("actually 3 sets") and questions ("what did I lift Tuesday?") follow the same path with other tools (`update_entry`, `query_history`). Expected latency is ~1–2 s, almost all of it the two Claude calls.

### Locked design decisions

- **Messages API + manual tool loop in NestJS**, not Managed Agents: the tools are our own services against our own Postgres, and the brief puts the loop server-side. Tools are reached over MCP (above).
- **Prompt caching vs. date injection.** A timestamp in the system prompt would invalidate the cache on every request. So the system prompt and tool definitions stay byte-stable and cached. Current timestamp, user timezone and profile go into a `<context>` block that is the **first text block of the current user message**: after the cache breakpoint, valid on every model, and never stored, so history never carries a stale date (constitution rule 8). *(Changed 2026-11-20 from a mid-conversation system message.)*
- **Tool results return entry IDs and the resolved date**, so later corrections in the same conversation can reference rows exactly.
- **`raw_input` and `source_message_id` are attached server-side** by `/mcp` from the turn token's message id, not taken from tool arguments.

### Out of scope for 4

Model routing, corrections, the history Q&A tool and rate limits all land in Steps 5–6. This step proves the pipe end to end, through MCP, from both our agent and one external client.

### Done (2026-11-20, stubbed model)

- **Migration `CreateAgentTables`:** `chat_messages` (transcript; unique `(userId, idempotencyKey)`; turn status), `agent_actions` (undo log), `llm_usage`, `personal_access_tokens` (SHA-256 hashes only), and `entries.sourceMessageId` → `chat_messages` FK (`ON DELETE SET NULL`). Drift check clean; reverts cleanly.
- **`/mcp`** (`src/mcp/`): official `@modelcontextprotocol/sdk` (pinned 1.32.2), low-level `Server` + `StreamableHTTPServerTransport`, stateless (fresh server per POST; GET/DELETE → 405). `McpAuthService` accepts only turn tokens and personal access tokens; login tokens get 401, and a turn token for another user's message is rejected. Turn tokens: RS256 JWT `{sub, mid, scope: 'mcp:turn'}`, 5 min. `/mcp` attaches `raw_input`, `source_message_id` and the undo group itself. PAT calls get `source = mcp`, `sourceClient` = the token's name, and an undo group per call.
- **Tool layer** (`src/mcp/tools/`): `McpTool` = DTO class + advertised JSON schema + `run()`. `ToolRegistry` validates with the production pipe settings plus `forbidNonWhitelisted`; bad input is a logged tool error, never a write. A unit test keeps each schema's fields identical to its DTO. ESLint `no-restricted-imports` blocks `typeorm` and repositories in the folder (verified by a probe). `log_entry` echoes date and day number.
- **`unit` is required for weighted sets in tools** *(found in the smoke test)*: REST falls back to the user's display unit, but for a model that's a silent guess (47 → 47 lb = 21.3 kg for a lb user).
- **Agent** (`src/agent/`): `POST /chat` streams SSE events (`turn`, `text`, `tool`, `done` / `error`). The loop is an MCP client of `/mcp` over HTTP with the turn token (`MCP_INTERNAL_URL`); at most 6 model ↔ tool steps; tools are sent with `strict: true`. Every model call records usage; transcript rows store Messages API blocks verbatim; consecutive same-role history rows are merged. A retried idempotency key replays the stored events without calling the model; concurrent duplicates are caught by the unique index. `POST /chat/messages/:id/undo` reverses a turn's `agent_actions` once.
- **Model seam:** `LlmClient` (requests use `@anthropic-ai/sdk` param types, pinned 1.6.0; responses use a narrow internal type). `StubLlmClient` is a deterministic stand-in that parses the brief's simple formats into `log_entry` calls and confirms results. It is not the product parser. `LLM_PROVIDER=stub` is the only provider for now and is refused in production. **Remaining for Step 4:** an `AnthropicLlmClient` once an API key is available.
- **Personal access tokens:** `POST/GET/DELETE /personal-access-tokens`; max 10 active; plaintext shown once; owner-only revoke via `AccessTokenAclService`.
- Verified: build and lint clean; 191/191 unit tests; 102/102 e2e tests. The 19 new e2e tests run against a real listening port: the chat → MCP → DB path, context only in the current message, idempotent replay without model calls, usage rows, undo (once, owner only), injected tool fields → tool error with no write, domain errors back to the model, `/mcp` auth (missing / login / forged / expired / revoked tokens), PAT rejected on REST, the external client path and the unit requirement. Smoke test on the built app: chat over SSE, a PAT JSON-RPC call, and a login token rejected on `/mcp`.

## Step 5 — detail

### Tool list (revised from the brief)

| Tool | Notes |
|---|---|
| `log_entry(exercise, date?, sets?: [{reps, weight?}], unit?, duration_min?, distance_km?, speed_kmh?, incline_pct?)` | `date` defaults to today in the user's local timezone. The exercise name is resolved server-side through aliases. On no match, candidates are returned and the model picks or creates. The model expands "2x10 @ 47" into two set objects; the server validates and writes them. Several exercises in one message use parallel tool calls. |
| `create_exercise(name, modality, muscle_group)` | For genuinely new exercises. |
| `add_exercise_alias(exercise_id, alias)` | The brief wants alias learning but listed no tool for it. |
| `get_last_entry(exercise)` | For "same as last time". |
| `get_day(date)` | Lists that day's entries with IDs, for "only these two today". |
| `update_entry(entry_id, fields, sets?)` / `delete_entry(entry_id)` | First-class. A `sets` list replaces the entry's sets wholesale (simpler than per-set edits, and still recorded in `agent_actions` for undo). |
| `move_entries(entry_ids[], date)` | Bulk date reassignment in one atomic call ("these three were actually Tuesday"). |
| `set_day_note(date, note)` | Replaces `start_session`'s `note` argument. |
| `query_history(exercise?, date_range?, muscle_group?)` | Compact rows, capped result size. |
| `update_profile(fields)` | "I weigh 72kg now". |

`get_user_profile` is dropped for our agent: the profile is small and is injected into the per-request context block (Step 4) instead, saving a round trip. *Revisit for external MCP clients*, whose prompts we don't control. They may need a `get_profile` tool (timezone, unit preference) to phrase results well.

Add `undo_last` (reverts the caller's most recent action group). External MCP clients have no in-app undo button.

### Model routing

The starting point is `claude-haiku-5-5` for routine parses and `claude-opus-5-5` for coaching questions and multi-entry corrections. Before building the router, measure the simpler alternative (one model at low effort) against the eval set, because prompt caches are per model and a router splits them. Decide from cost per completed turn, not per request.

### Eval set

Seed it from the brief's real inputs (varied separators, name after numbers, "lg" typo, "same as last time", corrections), plus Japanese and mixed EN/JP equivalents (katakana exercise names, full-width digits and ×, "前回と同じ"). Grade on the structured rows written, not the confirmation text.

### Split into 5a / 5b *(decided 2026-11-20)*

Everything that can be built and tested without a real model is 5a. Running the eval, tuning prompts and tool descriptions, and choosing models by measurement need the real model, so they're 5b, which waits for an Anthropic API key.

### 5a Done (2026-11-20)

- **12 new tools** on `/mcp` (13 in total): `get_day`, `get_last_entry`, `query_history`, `update_entry`, `delete_entry`, `move_entries`, `set_day_note`, `create_exercise`, `add_exercise_alias`, `get_profile` (for external clients, which have no context block), `update_profile` (weight, unit, timezone, locale; never name or password), `undo_last`. Every tool's advertised schema is unit-tested against its DTO; weighted sets need `unit` in `log_entry` and `update_entry`.
- **Undo for every agent write** (new `src/action-log/` module): entry create / update / delete / move, day notes, custom exercises, aliases and profile changes are all recorded with before/after snapshots in the writing service's own transaction. `UndoService` reverses a group newest-first in one transaction, and **only if the row still matches its recorded `after` snapshot**. Rows edited since (e.g. in the app) are skipped and reported, never overwritten. A created exercise that entries still use is kept and reported. Snapshot comparison ignores key order, because Postgres `jsonb` reorders keys (a bug the e2e tests caught).
- **`undo_last` scope:** from chat, the user's previous turn (never the current one); from an external client, only that token's own earlier calls (`mcp:<tokenId>:<uuid>` group keys).
- **`Clock`** (`src/shared/time/clock.ts`): services take "now" from an injectable clock, so tests and the eval pin the date.
- **Parsing eval** (`backend/evals/parsing/`): 19 cases from the brief plus Japanese, full-width, pyramid, lb, multi-exercise, correction, duplicate and "writes nothing" cases. Graded as a multiset of rows per day (weights to 0.01 kg). `npm run eval:parsing [-- --only=id,…]` boots the real app against `tomo_gym_eval` with the clock pinned to Thursday 2026-11-19 12:00 Tokyo, runs every turn through `POST /chat` → `/mcp`, prints pass/fail with diffs plus token use and list-price cost, and writes a JSON report (gitignored). Not run in CI (it costs money with a real model).
- **Stub baseline: 7/19.** It passes the simple formats, lb and the two "writes nothing" cases; everything needing language understanding fails, as expected. 5b's real model must beat it.
- Verified: build and lint clean; 216/216 unit tests; 118/118 e2e tests (16 new tool tests over a real port: each correction undone, a later app edit protected from undo, cross-client undo isolation, history filters, notes, exercise and alias undo, profile undo with the password untouched, chat `undo_last` scope).

## Step 6 — detail

Required before production signup opens (constitution rules 5 and 17). **Email verification**: the same SES flow as denwa-alert (copy it from there), with unverified users unable to call the agent. **Spend limits**: a per-user request rate limit, a daily and monthly token budget checked before every Claude call, a friendly "limit reached" response, and a simple admin view of per-user spend from `llm_usage`.

### Split into 6a / 6b *(decided 2026-11-21)*

Email verification needs SES, and SES needs the domain, so it's 6b. Everything else is 6a. Budgets are in **USD, not tokens**, so they stay right when Step 5b routes between models with different prices. Chat is limited to **15 messages a minute** (raised from the proposed 10) and signup to **10 per hour per IP** (raised from 5); login stays at 10 per minute.

### 6a Done (2026-11-21)

- **New `src/usage/` module.** It owns `llm_usage` (moved from the chat module; same table) plus a new `rate_limit_counters` table (migration `CreateRateLimitCounters`): fixed UTC windows, atomic `INSERT … ON CONFLICT … count + 1`, pruned opportunistically. They live in Postgres, so deploys and restarts don't reset them and no Redis is needed.
- **Limits** (defaults; all env vars, see `backend/.env.template`):

  | What | Limit | Keyed by |
  |---|---|---|
  | Chat messages | 15 / minute, 200 / day | user |
  | `/mcp` calls | 60 / minute, 2,000 / day | access token |
  | Login | 10 / minute | IP |
  | Signup | 10 / hour | IP |

  Our own agent's `/mcp` calls (turn tokens) aren't counted again. A retried idempotency key is a free replay: never counted, never blocked. The login limit runs before the password check. `req.ip` trusts exactly one proxy hop in production (Caddy).
- **Budgets:** $0.05 per user per local day and $1 per local month, plus a **global $5 per UTC day** across all users. They're checked before streaming starts and again **before every model call**, so a turn that runs out halfway stops cleanly: the work saved so far stays and is undoable. Cost = tokens × `src/usage/pricing.ts`, where unknown models are priced like the most expensive one so a missing entry can't switch budgets off, and the stub is free.
- **429s:** `QuotaExceededException` → `AllExceptionsFilter` sets `Retry-After`; the body's `error.details.code` is `rate_limited` / `daily_budget` / `monthly_budget` / `service_paused`. A limit that stops a turn mid-stream arrives as an SSE `error` event with the same `code`.
- **Admin:** `GET /admin/usage?from=&to=` (UTC dates): per user, turns, calls, tokens and estimated cost, most expensive first. Admin only, via `UsageAclService` and `UsageReportService`.
- **`SIGNUP_MODE=open|closed`:** `closed` → 403 "Signup is closed". It defaults to closed when `APP_ENV=production`, until 6b.
- The e2e suites default the limits high (all their requests come from 127.0.0.1); `test/usage/limits.e2e-spec.ts` sets low limits and pins the clock. The parsing eval lifts the per-IP and per-user limits but keeps the global cap as a ceiling on eval spend, and now uses the shared price table.
- Verified: build and lint clean; 229/229 unit tests; 128/128 e2e tests (10 new: chat limit + `Retry-After`, free replay, daily budget, budget stopping a turn midway, per-token MCP limit, admin report and its denial, login limit before the password check, signup limit, global pause, closed signup); full eval still runs (stub 7/19).

## Step 7 — detail

The frontend foundation, copied from denwa-alert's and stripped of its screens: the plumbing Step 8's screens stand on, with placeholder pages.

### Decisions *(2026-11-21)*

- **Name:** the app installs as **"Tomo Gym"**.
- **EN/JP catalogs are homegrown**, not an i18n library: two typed objects (`en.ts`, `ja.ts`) and a ~20-line `t()` with `{name}` placeholders. Two languages and no plurals don't justify react-i18next's runtime and setup; the type system and a test catch the mistakes a library would.
- **PWA is manifest-only:** installable, with no service worker and no offline mode. Logging needs the network (the agent runs on the server), and a service worker's cache invalidation is a classic source of "users stuck on an old build" bugs.
- **Local dev is same-origin:** Vite on `:5174` proxies `/api` to the backend on `:3001`, so dev needs no `.env` and no CORS. Production sets `VITE_API_BASE_URL` (Step 9).
- **Node 24 LTS for the frontend.** Node 20 reached end-of-life in April 2026. npm 10 also crashes resolving a fresh tree for this dependency set, while npm 11 resolves cleanly (it cut `npm audit` findings from 18 inherited from denwa's lockfile to 2, both inside Orval's own dependencies). The npm 11 lockfile needs npm 11 for `npm ci`, so frontend CI runs Node 24.22.3. (The backend followed the same day; see the changelog.)

### Done (2026-11-21)

- **Scaffold** (`frontend/`): Vite 8, React 19, TypeScript, React Router 7, Tailwind v4, Vitest + Testing Library, ESLint 10 + Prettier, and an Orval client generated from tomo's committed `swagger.json`. `customFetch` keeps denwa's refresh-once-on-401 logic. `AuthProvider` reads tomo's `UserOutput` and gains `updateProfile()` (PATCH `/users/:id`).
- **EN/JP from the first screen** (constitution rule 23). Every string comes from `src/i18n/{en,ja}.ts`. A missing Japanese key fails `tsc`; a test checks that the key sets match, nothing is empty, placeholders agree and no Japanese entry is a copy of the English one. Language: signed in → `User.locale`; signed out → the last language used on the device, else the browser's. The toggle switches at once, saves `User.locale` when signed in, and reverts with a message if the save fails. `<html lang>` follows it.
- **Mobile shell** (constitution rule 20): a slim header and a fixed bottom tab bar (Log / History / Profile) with 56px targets, safe-area insets (`viewport-fit=cover`) and `min-h-dvh`. Log and History are placeholders. Profile has the language toggle and log out. `/login` is a placeholder until Step 8.
- **PWA:** `manifest.webmanifest` ("Tomo Gym", standalone, portrait) with placeholder icons: 192, 512, maskable 512 and an Apple touch icon, all rendered from SVG sources in `public/icons/`.
- **CI:** `frontend-build` and `frontend-tests` workflows (lint, Prettier check, unit tests), triggered by `frontend/**`. No deploy until Step 9.
- `frontend/CLAUDE.md` covers the conventions: no hardcoded copy, the catalog rules, mobile-first rules, the API client, and testing with `renderWithProviders`.
- **Verified:**
  - lint, format check and build are clean, and 51/51 unit tests pass;
  - two deliberate bugs in the locale logic were each caught by a test;
  - in Chromium at iPhone SE size against the real backend through the dev proxy, there was no horizontal scroll, the signed-out redirect worked, and the toggle saved `locale: ja` on the server and survived a reload, with no console errors.
- **Found for Step 8:**
  - ~~An expired access token at page load counts as signed out without trying the refresh token.~~ Resolved the same day: see the changelog entry on session length.
  - ~~`POST /chat` is SSE, which Orval's fetch client can't read.~~ Done in 8a: `streamChat` reads it through `authorizedFetch`.

## Step 8 — detail

The chat logger is the primary screen. Each confirmation shows the saved row(s) and an **Undo** button that reverts the whole turn via `agent_actions`. Undo stays available after a page reload. All UI strings go through the EN/JP catalogs; the language toggle updates `User.locale`.

### Split into 8a / 8b *(decided 2026-11-21)*

8a is sign-in, sign-up and the chat logger: the core loop, plus the backend pieces it turned out to need. 8b is history (day list, edit/delete) and the full profile.

### 8a Done (2026-11-21)

- **Backend, found while building:**
  - **Weights in the user's unit.** Entry results only had kg. A pound user's card would have said "61.23 kg", and the model would have had to convert back to lb itself to reply, which constitution rule 9 forbids. `ToolContext.weightUnit` now makes every entry result carry `weight` + `weightUnit` next to `weightKg` (`fromKg`, lb to 0.1, so 135 lb → 61.23 kg → 135 lb). The system prompt says to quote them.
  - **Change counts.** `done` and `error` events carry `changes`, the undoable changes the turn saved, so Undo shows only when there's something to undo, including after a limit stopped a turn midway.
  - **`GET /chat/messages`**: the user's turns, paged back with `before`, with the same events as the stream (`turnEvents()`, shared with replay) plus `changes` / `undone`. That's what makes the chat and Undo survive a reload. Self-only (constitution rule 16).
  - **Sign-up and login fixes.** A duplicate email returns **409** instead of a 500. Emails are trimmed and lower-cased at sign-up and login, because phone keyboards capitalise and add spaces.
- **Frontend:**
  - **Sign-in and sign-up** (react-hook-form + zod, translated validation). Sign-up sends the device's IANA time zone, the current UI language, the age confirmation and an optional body weight in kg or lb.
  - **Errors** come through `ApiError` (status, code, Retry-After) and are mapped to catalog keys, never shown as the backend's English.
  - **Chat** (`src/chat/`):
    - an SSE reader over `authorizedFetch`, a fresh idempotency key per message;
    - entry cards from tool results, Undo (with "kept N edited since"), Retry with the same key after a dropped connection or a refused request;
    - limits explained per code, "Show earlier messages";
    - a composer that never sends on Enter while a Japanese IME is composing.
- **Verified:**
  - backend: 235/235 unit and 139/139 e2e tests. New e2e tests cover lb round-trip in results and reply, `changes` on done and replay, history order / undo state / paging / isolation / bad params, 409 duplicate, case-insensitive login, and refusing disabled accounts at refresh.
  - frontend: 112/112 tests; three deliberate bugs (IME, mid-turn changes, undone history) each caught.
  - in Chromium at 320 px (iPhone SE) against the real backend: sign-up with a messy email and lb, log, Undo, reload (Undo state kept), Japanese, wrong password, sign back in. No horizontal scroll, and the composer stays one line in both languages.
- **Rule 15:** the system prompt changed (quote `weight` / `weightUnit`), so the eval was re-run. It's the stub, so unchanged at 7/19; the first real run in 5b covers it.

### 8b Done (2026-11-21)

- **Backend:**
  - **Weights in the user's unit moved into the service.** REST entries and days now carry each set's `weight` in the user's unit (plus `weightUnit`), and the profile carries `weight` for body weight, all worked out by the server.
  - **Tools pass them through.** Tool results and `get_profile` reuse those values, replacing 8a's separate `ToolContext.weightUnit`. One conversion path, so the History screen, the chat cards and the model always agree.
- **History:**
  - training days newest first (Day N, date, exercise names in the user's language, ≈ kcal), paging back;
  - a day page with its note (add, edit, clear) and entries showing what was typed;
  - an inline editor for sets (reps and weight in the user's unit, add or remove) and cardio numbers (cleared → `null`), validated against the server's limits;
  - delete with confirmation, and the day reloads so totals stay the server's.
- **Profile:**
  - weight unit (saves at once), body weight (in the user's unit; blank clears);
  - time zone (every IANA zone the browser knows, keeping an aliased saved zone such as `Asia/Kolkata`, plus "use this device's");
  - language and log out;
  - **Connect other apps:** the MCP server URL, and personal access tokens created (shown once, with a `claude mcp add` example), listed (prefix, last used) and revoked.
- **Verified:**
  - backend: 238/238 unit and 140/140 e2e tests (new: lb loads on `/days` and the list, display weight on profile updates); stub eval 7/19.
  - frontend: 135/135 tests; three deliberate bugs (edit without the unit, a repeated day when paging, a dropped aliased zone) each caught.
  - in Chromium at 320 px against the real backend: sign up, log two entries, open the day, edit sets (kcal recomputed), add a note, delete an entry; switch to lb (60 kg → 132.3 lb, from the server); change the time zone and back; create a token, copy it, use it on `/mcp` (200, lists the tools), revoke it (401). No horizontal scroll in English or Japanese, and no page errors.
- **Two accessibility bugs found and fixed:** an input's name swallowing its hint, unit and Save button.

## Steps 9–11 — detail

Each gets its own sub-plan when we reach it. Notes so far:

- **9**: follow denwa-alert's post-2026-11-09 pattern: a new database on the shared RDS, a container on the shared EC2 host behind its reverse proxy, own ECR + S3 + CloudFront + DNS in `infra/`. Read octirion-platform's `infra/CLAUDE.md` first. **Blocked on buying the domain** (TLS, CloudFront and SES identity all need it).
- **11**: landing page, privacy policy and ToS ship in EN and JP. The privacy policy must disclose body weight as personal data and Anthropic as a processor of chat content.

## Step 12 — detail

Friend groups, added 2026-11-19. Built after the core logging loop (Steps 3–5) and the core screens (Step 8), and shipped before launch. Backend and screens land together in this step.

### Entities (sketch; settle when starting)

- `Group`: name, `ownerUserId`, hashed invite token, `inviteEnabled`.
- `GroupMembership`: `(groupId, userId)` unique, role `owner` | `member`, `joinedAt`.
- `Reaction`: `(groupId, sessionId, userId, emoji)` unique, with emoji limited to a fixed set.
- `Comment`: `groupId`, `sessionId`, `authorUserId`, body (≤ 280 chars), `deletedAt`.
- `User.workoutVisibility`: `activity` (default) | `full`, one setting per user across all their groups.

### Locked design decisions

- **Reactions and comments are scoped to a group**, not to the session alone. If Ken is in two of your groups, a comment in group A is invisible to group B, so nobody learns about other groups through a shared thread.
- **Joining is by invite link only.** Groups aren't searchable. The owner can rotate the link (old links stop working), disable it, and remove members.
- **Moderation, the minimum needed with open signup:** an author can delete their own comment, the group owner can delete any comment in the group and remove members, and anyone can leave. Comment posting is rate-limited per user. Reporting to an admin is out of scope.
- **The owner leaving** must first transfer ownership or delete the group.
- **Group members see a display name** (`User.name`), never the email address.
- **Leaderboards use activity metrics only** (days trained, streaks), so they reveal nothing beyond activity-only visibility. There are no weight or volume leaderboards: they would leak details for activity-only users and unfairly favour heavier lifters.
- **Time boundaries are per member.** "Trained today" and week boundaries use each member's own timezone (constitution rule 8).
- **Caps:** ≤ 50 members per group, ≤ 10 groups per user.
- **Reuse denwa-alert's tenancy code.** Its `Organization` + `Membership` + `OrgScopedGuard` / `OrgAdminGuard` + ACL patterns map onto `Group` + `GroupMembership`, minus denwa's Team layer, email invitations and join requests. Copy them from the denwa repo at this step; Step 1 still strips them.

### Out of scope for 12

Per-group visibility settings, notifications (so a reaction is only seen when the user opens the app), DMs and group chat, challenges with custom goals, admin reporting, and the agent reading friends' data or posting reactions or comments for the user.

### Streak definition (decided 2026-11-19)

- Current streak counts **weeks**: consecutive weeks with at least one training day, with week boundaries in the member's own timezone. Leaderboards also show days trained this week and this month. Daily streaks were rejected because they punish rest days, which is bad advice for strength training.

## Steps 13+ — post-MVP notes

- **OAuth 2.1 for the MCP server**, so claude.ai's "Connect" flow works without pasting a token. This needs an authorization server (authorize + token endpoints, PKCE, client registration) or an identity provider.

## Sequencing notes

- **1 → 2 → 3 → 4 → 5** is the backend critical path; each step needs the previous schema.
- **6b (email verification) must ship before production signup opens** (6a is done); `SIGNUP_MODE` keeps production closed until then. It can be built in parallel with 5. Its email-verification half needs the domain (SES identity); the spend-limit half doesn't.
- **7 can start any time after 4** (the SSE contract is the thing to stabilise); 8 needs 5 for undo/edit.
- **12 comes after 5 and 8 and before launch (11 goes live).** It needs the day DTOs from 3 and the core screens from 8.
- **9 pulls forward opportunistically once the domain is bought.** Deploying the Step 4 slice behind closed signup is a good early smoke test. Until then, all work runs locally.

## Open questions — recommendations (confirm or override)

- **Confirm-before-write vs. undo → undo.** Write immediately and show what was written with a one-tap undo for the whole turn (constitution rule 13). Ask a clarifying question only when the exercise match is genuinely ambiguous, not as a routine confirmation.
- **Deterministic parser vs. LLM → LLM only for MVP.** A Haiku-class parse costs roughly a tenth of a cent per message with caching, and the hard cases (aliases, typos like "lg", "same as last time", corrections) need the LLM anyway. A regex fast path would be a second code path with its own bugs. Revisit only if latency or cost measurements say so, using the Step 5 eval set to prove a parser matches the LLM on the common case.

## How to update this file

Edit the status column on the milestones table when a step flips state. Add a dated note under `## Changelog` when a scope or sequencing decision changes, so future-you (and future-Claude) can see *why* the plan shifted rather than just *that* it shifted. Newest entries first.

## Changelog

- **2026-11-21** — **8b done; Step 8 complete.** History (days, day page, edit sets and cardio, delete, notes) and the full profile (unit, body weight, time zone, MCP access tokens). Weights in the user's unit are now computed in one place, the workout service's output mappers, and reused by REST, tool results and the profile. Remaining MVP steps:
  - 5b (API key)
  - 6b, 9 and 11 (domain)
  - 12 (friend groups)

- **2026-11-21** — **Step 8 split; 8a done.** Sign-in, sign-up and the chat logger (streamed replies, entry cards, undo that survives reload, retry, translated errors and limits). Backend additions it needed:
  - entry results carry weights in the user's unit, so neither model nor app converts (the prompt now says to quote them; eval re-run);
  - `changes` on `done` / `error`;
  - `GET /chat/messages`;
  - 409 for duplicate emails;
  - emails normalised.

  8b (history, profile) is next.

- **2026-11-21** — **Session length; everything on Node 24.**
  - **Sessions:** access token 1 hour, refresh token **90 days**, renewed on every refresh, so users stay signed in as long as they open the app at least once every 90 days. A 1-month access token was considered and rejected: the backend trusts access tokens without a database check and logout is client-side, so a leaked token or a disabled account would keep working for a month; with a short access token users see the same thing.
  - **Backend:** refresh now refuses disabled accounts.
  - **Frontend:** at load it stays signed in on an expired access token while the refresh token is valid. A refresh that fails for a transient reason (offline, 5xx) keeps the tokens instead of signing out. It no longer tries a refresh on a 401 from a request without a token. That bug was inherited from denwa: a wrong password at login redirected to "session expired".
  - **Node 24:** the backend moved too (CI, Dockerfiles, `.tool-versions`, `@types/node` 24). npm 11 warns about unreviewed install scripts, so `backend/package.json` records them in `allowScripts`: `bcrypt` (native build) allowed; three funding/telemetry postinstalls denied.
  - **Verified on Node 24.22.3:** backend build, lint, 230/230 unit and 129/129 e2e tests, and the stub eval at 7/19; frontend 60/60 tests.
  - **For Step 9:** production must set the same JWT lifetimes in its SSM parameters.

- **2026-11-21** — **Step 7 done.** Frontend scaffold with the "Tomo Gym" name, homegrown typed EN/JP catalogs (no i18n library), a manifest-only PWA (no service worker), the bottom-tab mobile shell, same-origin local dev through a Vite proxy, and frontend CI on Node 24 LTS (Node 20 is end-of-life; the npm 11 lockfile needs it). Two Step 8 follow-ups recorded under Step 7 — Done: session length vs. the expired-token-at-load rule, and an SSE reader for `/chat`.
- **2026-11-21** — **Step 6 split; 6a done.** Rate limits (after review: chat 15/min, signup 10/hour per IP; MCP per token; login 10/min per IP), USD budgets per user plus a global daily cap checked before every model call, 429s with codes and `Retry-After`, an admin usage report, and `SIGNUP_MODE` (closed by default in production). Email verification is 6b, waiting on the domain. Constitution rule 17 reworded to match.
- **2026-11-20** — **Step 5 split; 5a done.** 5a: the remaining 12 tools, undo for every kind of agent write (conflict-checked: undo never overwrites a later edit), an injectable clock, and the parsing eval (19 cases, runner, grader; stub baseline 7/19). 5b, which needs an API key, covers the Anthropic client, real eval runs, prompt tuning and model routing.
- **2026-11-20** — **Step 4 done with a stubbed model.** MCP server, turn tokens and personal access tokens, validated tool layer, SSE chat loop as an MCP client, idempotent replay, undo. The real Anthropic client waits for an API key. Two changes found while building: the context block moved from a mid-conversation system message to the first block of the current user message, and tools must state `unit` for weighted sets rather than inheriting the user's display unit.
- **2026-11-20** — **Step 3 done.** Exercise catalog (EN/JP aliases), sessions, entries + sets, calorie maths, computed day numbers and REST CRUD. Chat transcript, undo log, idempotency and LLM usage moved to Step 4, where they're first used. Found and fixed a node-postgres `DATE` → local-midnight `Date` conversion on raw queries that would have shifted days on servers east of UTC. Details under Step 3 — Done.
- **2026-11-20** — **MCP from the beginning.** The agent's tools are served by tomo's own MCP server (`/mcp`) and our agent calls them over HTTP as an MCP client, the same surface external Claude apps use. External clients authenticate with personal access tokens in the MVP; OAuth 2.1 is post-MVP. Constitution rules 4, 5, 8, 10, 12, 13, 17 and 24 updated. Also settled in the design discussion: tool handlers get no DB access (services own short per-call transactions, enforced by a lint rule), and no transaction spans a turn. Undo uses the action log, because a turn waits seconds on Claude. Details under Step 4 — Architecture.
- **2026-11-19** — **Step 2 done.** Accounts carry timezone, locale, weight (kg) + display unit, and age confirmation. Signup maps fields explicitly rather than trusting the request body. Details under Step 2 — Done.
- **2026-11-19** — **Step 2 data minimised; dates vs timestamps settled.** Height, birth date and sex dropped from the user profile: no MVP feature uses them. Minimum age 16 via a signup checkbox (`ageConfirmedAt`) instead of a birth date. Constitution rule 16 now says to collect only data a feature uses. Timezones are validated but stored as sent (ICU alias canonicalisation is inconsistent across Node versions). Step 3: a workout's day is a `DATE`, not a timestamp, carried as a string.
- **2026-11-19** — **Step 1 done; streak definition locked.** The backend was copied from denwa-alert's rather than the bare starter (details under Step 1 — Done). Two deliberate departures from denwa: users can no longer read other users (constitution rule 16), and `BaseAclService` no longer turns resource-less denials into 500s. CI generates throwaway JWT keys, so the repo needs no secrets. Step 12's streaks count weeks, not days.
- **2026-11-19** — **Friend groups added to MVP (new Step 12).** Constitution rules 16 (privacy) and 24 (social scope) rewritten; rule 10 now says the agent only touches the caller's own data. Choices: built after the core logging loop and screens but before launch; each user chooses activity-only (default) or full-detail visibility; invite link only; reactions, comments and activity-based leaderboards. Body metrics, email and chat transcript are never shared. Step 3 gains separate summary and detail DTOs so activity-only views can't leak details. Step 1 is unchanged: denwa's tenancy code gets copied back at Step 12 rather than carried in unused.
- **2026-11-19** — **Email verification deferred from Step 2 to Step 6.** No domain has been bought yet, and SES needs a verified domain identity. Verification only has to exist before production signup opens, so it joins the spend limits in Step 6 (now "Signup gate"). Step 9 (deploy) is also marked blocked on the domain. Steps 1–5 and 7–8 run locally in the meantime.
- **2026-11-19** — **Per-set storage chosen (`entry_sets` child table).** Open signup means users will log pyramids, drop sets and short last sets, which uniform sets/reps/weight columns can't represent. Migrating every user's history later would cost far more than roughly a day of extra work in Steps 3 and 5 now. `log_entry` / `update_entry` take a list of sets; "top set" is the default figure for progression.
- **2026-11-19** — **EN/JP across the whole product.** Constitution rule 23 changed from English-only to EN + JP for the app UI, agent replies and marketing pages, unlike denwa-alert, where only the marketing pages are bilingual. Knock-on effects: `User.locale` (Step 2), bilingual catalog names and aliases (Step 3), Japanese inputs in the eval set (Step 5), message catalogs from the first screen (Step 8), bilingual legal pages (Step 11).
- **2026-11-18** — **Project bootstrapped from the conversational-logger brief.** Constitution and roadmap created, modelled on denwa-alert's. Decisions: stack and conventions reused from denwa-alert; MVP is mobile-first web / PWA (native app and voice deferred); open signup from day one, so per-user LLM rate limits and budgets became MVP scope (Step 6, constitution rule 17); no import of the ~45 Notion-logged sessions, users start fresh; hosting on octirion-platform. The brief's data model and tool list were revised (Step 3 critique, Step 5 tool table): implicit sessions, computed day numbers, an alias table, an agent action log for undo, and request-level idempotency.
