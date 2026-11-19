# constitution.md — tomo-gym

> Non-negotiable rules for AI agents working on this project.

## Project overview
A conversational workout logger. Users type workouts in plain, terse, often typo-ridden text ("2x10 @ 47kg lat pulldown", "10 min walk speed 6 incline 2"). A server-side Claude agent parses each message and writes structured rows to Postgres through the backend's own services, then streams back a one-line confirmation. Users can also ask questions about their history ("what did I lift last Tuesday?", "should I increase incline?"), and train alongside friends in invite-only friend groups with a shared activity feed, reactions, comments and leaderboards. Mobile-first web app, open signup.

## Stack
1. Backend: NestJS + TypeScript based on monstar-lab-oss/nestjs-starter-rest-api (same base and conventions as denwa-alert). Do not introduce a different framework.
2. Frontend: React + TypeScript with Vite. Single Page App only, built mobile-first and installable as a PWA. No Next.js, no SSR.
3. Database: PostgreSQL via TypeORM. No NoSQL, no SQLite in production.
4. LLM: Anthropic Claude only, through the official `@anthropic-ai/sdk`, called from the backend only. The API key never reaches the client. No other LLM providers, no OpenAI-compatible shims. The agent loop runs in our NestJS backend on the Messages API with tool use (we host the loop and the tools). Model IDs live in config, never hardcoded in call sites.
5. Auth: JWT using the starter kit's existing implementation. Email + password with email verification. No OAuth for MVP.

## Hosting
6. Backend runs in Docker on the shared octirion-platform EC2 host; its database lives on the shared octirion-platform RDS instance. App-specific AWS resources (ECR repo, S3 bucket, CloudFront distribution, DNS, SSM parameters) live in this repo's `infra/`. Shared VPC / host / RDS are changed only in the octirion-platform repo.
7. Frontend builds to a static bundle deployed to S3 + CloudFront, with error document → index.html so React Router deep links work.

## Agent & data integrity
8. **Dates come from the server, never from the model's memory.** Every LLM request carries the current timestamp and the user's IANA timezone. "Today" means today in the user's local timezone. The model must never infer the date from earlier conversation history.
9. **Derived values are computed server-side, deterministically, never by the LLM.** This covers day numbers (derived from the user's distinct session dates, never typed in by the user), calories (from a MET/energy table and the user's body weight), and unit conversion (lb → kg). The model passes raw facts; the server computes.
10. **Agent tools are thin wrappers over service methods.** Every tool call goes through the same service layer, validation and ACL checks as the REST API. The model never writes SQL, and never chooses `user_id`: the acting user always comes from the JWT. Agent tools read and write only the caller's own data. The agent never sees friends' data and never acts in friend groups.
11. **Every write is idempotent.** Each chat request carries a client-generated idempotency key; a retried request must not double-write or re-run the agent.
12. **Every entry stores the raw input** that produced it, attached by the server from the user's message, not copied by the model.
13. **Every agent turn's writes are reversible.** Writes happen immediately (no "shall I log this?" prompt), and the user can undo a whole turn from the confirmation.

## Code quality
14. Every feature must have at least one unit test. Agent tools also get at least one e2e test through the real path (HTTP → agent loop → service → Postgres), with only the Claude call stubbed.
15. The agent's parsing behaviour is covered by an eval set of real inputs. Any change to the system prompt, tool definitions or model choice re-runs it before merge.
16. **Privacy by default.** Collect only the personal data a feature uses (MVP: body weight, for calories). Body metrics, email address and the chat transcript are never visible to any other user. Workout data is visible only to users who share a friend group with its owner, and only at the level the owner chose: **activity-only** (the default: which days, which exercises / muscle groups, day count, streak; no sets, reps or weights) or **full details**. The check runs in the service layer on every read, and the two levels use separate output DTOs, so hiding details never depends on leaving fields out of a shared DTO.
17. LLM spend is capped. Every Claude call is preceded by a server-side per-user rate limit and token-budget check, and followed by a usage record (user, model, input / output / cache tokens).
18. All secrets via environment variables only. Never hardcoded, never committed.
19. Follow the existing starter kit's code structure.
20. All web pages must be usable on a mobile viewport (≤ 375px wide). No horizontal scrolling on primary flows; tap targets ≥ 44px. Logging a set must be comfortable one-handed between sets.

## MVP scope — do NOT build yet
21. No native mobile app. Mobile-first web / PWA only. No voice input yet.
22. No billing/payment integration in MVP.
23. The whole product ships in English and Japanese: app UI, agent replies and marketing pages (landing, privacy policy, terms of service), with a user-facing language toggle and the choice stored on the user. The agent accepts input in either language, or mixed ("ラットプルダウン 2x10 @ 47kg"), and replies in the user's chosen language. No other languages in MVP.
24. Social features are limited to friend groups: join by invite link, group feed, reactions, comments, leaderboards. No public profiles, no user search, no followers, no direct messages or group chat, no notifications, no trainer/coach sharing, no wearable or third-party integrations, no data import (users start fresh).
25. Progression suggestions, charts and voice input are post-MVP. Answering a question the user asks about their history is MVP.
26. Keep it simple. If a feature is not in the spec, do not build it.
