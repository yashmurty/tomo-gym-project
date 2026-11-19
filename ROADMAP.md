# Roadmap — tomo-gym

High-level milestones for the MVP. Living document — update as scope and sequencing shift.

Rules of the road live in [constitution.md](constitution.md). If the roadmap ever conflicts with the constitution, the constitution wins.

## Milestones

| # | Step | Status |
|---|---|---|
| 1 | Backend scaffold (NestJS starter → `tomo-gym-backend`, ACL-based auth, CI) | Not started |
| 2 | Accounts — User (email verification, IANA timezone, body profile), open signup | Not started |
| 3 | Workout domain — schema migration (exercises + aliases, sessions, entries, chat transcript, agent action log, idempotency, LLM usage), computed day numbers, deterministic calorie calc, REST CRUD | Not started |
| 4 | Agent vertical slice — `POST /chat` → Claude with tools → `log_entry` → row in Postgres → streamed confirmation | Not started |
| 5 | Full agent toolset — corrections, bulk date moves, "same as last time", alias learning, history Q&A, model routing, parsing eval set | Not started |
| 6 | Cost & abuse guards — per-user rate limit, token budget, usage reporting (must ship before open signup goes live) | Not started |
| 7 | Frontend scaffold — Vite + React + TypeScript SPA, mobile-first, PWA manifest | Not started |
| 8 | Frontend screens — auth, chat logger with streaming + undo, history list/edit, profile | Not started |
| 9 | Deploy — backend onto octirion-platform (shared EC2 + RDS), own ECR / S3 + CloudFront / DNS in `infra/` | Not started |
| 10 | Tests + evals per feature (constitution rules 14–15) | Ongoing discipline, applied inside each step |
| 11 | Pre-launch — landing page, privacy policy, ToS, SES sandbox exit | Not started |

Explicitly out of MVP scope per constitution rules 21–26: native app, voice input, billing, languages other than EN/JP, social features, integrations, data import, progression suggestions, charts.

## Step 1 — detail

Mirror denwa-alert Step 1: scaffold `backend/` from monstar-lab-oss/nestjs-starter-rest-api, realign auth to JWT-at-controller / ACL-in-service (no `@Roles`), keep the `article` module as a frozen reference, CI workflows at repo root with a `backend/**` path filter, local dev with Nest on the host and Postgres in Docker. Copy conventions from denwa's `backend/CLAUDE.md` rather than re-deriving them.

## Step 2 — detail

- `User` gains: `timezone` (IANA string, required, prefilled from the browser at signup), `weightKg`, `heightCm`, `birthDate`, `sex`, `weightUnit` display preference (`kg` | `lb`), `locale` (`en` | `ja`, prefilled from the browser). Storage is always kg.
- Email verification (SES), same flow as denwa-alert.
- Open signup is allowed in code from this step, but production signup stays closed until Step 6 ships.

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

### Deliverables

- One TypeORM migration for the schema above, plus a seed for the exercise catalog and MET values.
- `CalorieService` (pure, table-driven, unit-tested against hand-computed values).
- Day-number query and REST CRUD for sessions and entries (these also power the edit UI in Step 8), all with ACL in services.

## Step 4 — detail

The vertical slice: `POST /chat` (SSE stream) → agent loop → `log_entry` → row in Postgres → streamed confirmation. No UI.

### Locked design decisions

- **Messages API + manual tool loop in NestJS**, not Managed Agents: the tools are our own services against our own Postgres, and the brief puts the loop server-side.
- **Prompt caching vs. date injection.** A timestamp in the system prompt would invalidate the cache on every request. So the system prompt and tool definitions stay byte-stable and cached. Current timestamp, user timezone and profile go into a per-request block *after* the cache breakpoint (a mid-conversation system message), which satisfies constitution rule 8 without losing the cache.
- **Tool results return entry IDs and the resolved date**, so later corrections in the same conversation can reference rows exactly.
- **`raw_input` and `source_message_id` are attached server-side** from the request, not taken from tool arguments.

### Out of scope for 4

Model routing, corrections, the history Q&A tool and rate limits all land in Steps 5–6. This step proves the pipe end to end.

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

`get_user_profile` is dropped as a tool: the profile is small and is injected into the per-request context block (Step 4) instead, saving a round trip.

### Model routing

The starting point is `claude-haiku-5-5` for routine parses and `claude-opus-5-5` for coaching questions and multi-entry corrections. Before building the router, measure the simpler alternative (one model at low effort) against the eval set, because prompt caches are per model and a router splits them. Decide from cost per completed turn, not per request.

### Eval set

Seed it from the brief's real inputs (varied separators, name after numbers, "lg" typo, "same as last time", corrections), plus Japanese and mixed EN/JP equivalents (katakana exercise names, full-width digits and ×, "前回と同じ"). Grade on the structured rows written, not the confirmation text.

## Step 6 — detail

Required before production signup opens (constitution rule 17): a per-user request rate limit, a daily and monthly token budget checked before every Claude call, a friendly "limit reached" response, and a simple admin view of per-user spend from `llm_usage`.

## Steps 7–11 — detail

Each gets its own sub-plan when we reach it. Notes so far:

- **8**: the chat logger is the primary screen. Each confirmation shows the parsed row(s) and an **Undo** button that reverts the whole turn via `agent_actions`. Undo stays available after a page reload. All UI strings go through EN/JP message catalogs from the first screen (no hardcoded copy); the language toggle updates `User.locale`.
- **9**: follow denwa-alert's post-2026-11-09 pattern: a new database on the shared RDS, a container on the shared EC2 host behind its reverse proxy, own ECR + S3 + CloudFront + DNS in `infra/`. Read octirion-platform's `infra/CLAUDE.md` first.
- **11**: landing page, privacy policy and ToS ship in EN and JP. The privacy policy must disclose body metrics as personal data and Anthropic as a processor of chat content.

## Sequencing notes

- **1 → 2 → 3 → 4 → 5** is the backend critical path; each step needs the previous schema.
- **6 must ship before production signup opens.** It can be built in parallel with 5.
- **7 can start any time after 4** (the SSE contract is the thing to stabilise); 8 needs 5 for undo/edit.
- **9 pulls forward opportunistically.** Deploying the Step 4 slice behind closed signup is a good early smoke test.

## Open questions — recommendations (confirm or override)

- **Confirm-before-write vs. undo → undo.** Write immediately and show what was written with a one-tap undo for the whole turn (constitution rule 13). Ask a clarifying question only when the exercise match is genuinely ambiguous, not as a routine confirmation.
- **Deterministic parser vs. LLM → LLM only for MVP.** A Haiku-class parse costs roughly a tenth of a cent per message with caching, and the hard cases (aliases, typos like "lg", "same as last time", corrections) need the LLM anyway. A regex fast path would be a second code path with its own bugs. Revisit only if latency or cost measurements say so, using the Step 5 eval set to prove a parser matches the LLM on the common case.

## How to update this file

Edit the status column on the milestones table when a step flips state. Add a dated note under `## Changelog` when a scope or sequencing decision changes, so future-you (and future-Claude) can see *why* the plan shifted rather than just *that* it shifted. Newest entries first.

## Changelog

- **2026-11-19** — **Per-set storage chosen (`entry_sets` child table).** Open signup means users will log pyramids, drop sets and short last sets, which uniform sets/reps/weight columns can't represent. Migrating every user's history later would cost far more than roughly a day of extra work in Steps 3 and 5 now. `log_entry` / `update_entry` take a list of sets; "top set" is the default figure for progression.
- **2026-11-19** — **EN/JP across the whole product.** Constitution rule 23 changed from English-only to EN + JP for the app UI, agent replies and marketing pages, unlike denwa-alert, where only the marketing pages are bilingual. Knock-on effects: `User.locale` (Step 2), bilingual catalog names and aliases (Step 3), Japanese inputs in the eval set (Step 5), message catalogs from the first screen (Step 8), bilingual legal pages (Step 11).
- **2026-11-18** — **Project bootstrapped from the conversational-logger brief.** Constitution and roadmap created, modelled on denwa-alert's. Decisions: stack and conventions reused from denwa-alert; MVP is mobile-first web / PWA (native app and voice deferred); open signup from day one, so per-user LLM rate limits and budgets became MVP scope (Step 6, constitution rule 17); no import of the ~45 Notion-logged sessions, users start fresh; hosting on octirion-platform. The brief's data model and tool list were revised (Step 3 critique, Step 5 tool table): implicit sessions, computed day numbers, an alias table, an agent action log for undo, and request-level idempotency.
