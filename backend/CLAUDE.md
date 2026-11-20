# backend — tomo-gym

NestJS REST API, plus (from roadmap Step 4) the server-side Claude agent loop. Based on [monstar-lab-oss/nestjs-starter-rest-api](https://github.com/monstar-lab-oss/nestjs-starter-rest-api) by way of denwa-alert's backend, whose conventions it keeps. Stack is pinned by [constitution.md](../constitution.md): NestJS + TypeScript, PostgreSQL via TypeORM, JWT auth, Anthropic Claude via `@anthropic-ai/sdk`.

## Deep-dive references (consult as needed)

Don't read these upfront — this file is self-sufficient for most tasks. Open one when the task touches its topic:

- [docs/project-structure.md](docs/project-structure.md) — starter's module layout (controllers / services / repositories / entities / dtos / specs per module)
- [docs/acl.md](docs/acl.md) — how `BaseAclService`, `Action`, `Actor`, and `ruleCallback` work
- [docs/suggested-upstream-changes.md](docs/suggested-upstream-changes.md) — authorization pattern we chose and why

## The `article` module is a reference, not production code

The starter ships [src/article/](src/article/) as a fully worked example (controller, service, repository, entity, DTOs, specs, e2e test, migration). We kept it intact even though tomo-gym has no articles. **Don't modify it, don't import from it, don't extend its entity.** When scaffolding a new module (e.g. `exercise`, `entry`, `agent`), mirror its structure verbatim.

Treat `article/` as a frozen example. If a tomo module needs a pattern article doesn't demonstrate, add a new reference rather than editing article.

## Authorization: JWT at controller, ACL in service. No `@Roles`.

This is the project convention. 

**Controller layer** — gate every endpoint with `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`. That's it. No `@Roles(...)`, no `RolesGuard`.

```ts
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
async getThing(@ReqContext() ctx: RequestContext, @Param('id') id: number) {
  return this.thingService.getById(ctx, id);
}
```

**Service layer** — role/permission logic lives here, through a module-specific `*AclService` extending `BaseAclService<Resource>`. Inject it, read the actor from `ctx.user!`, check permission before the work, throw `UnauthorizedException` on denial.

```ts
const actor: Actor = ctx.user!;

const isAllowed = this.aclService
  .forActor(actor)
  .canDoAction(Action.Update, thing);   // pass the resource when rules need it
if (!isAllowed) {
  throw new UnauthorizedException();
}
```

**Why at the service and not the controller:**
- Single source of truth for "who can do what" per resource.
- Rules like "only the author can edit" need access to the loaded entity, which the service has and the controller doesn't.
- Services are called from more than just HTTP. The agent's tools call the same service methods (constitution rule 10), as do CLI and background jobs, so a check in the service runs on every path.

**`BaseAclService` semantics:** a rule only matters for the actions it lists. A rule with a `ruleCallback` needs the resource passed to `canDoAction`, but only when it covers the requested action. Resource-less checks such as `Action.List` skip it. Unlike upstream (and denwa-alert), where an unrelated callback rule turned a 401 into a 500.

**Current ACL rules** (defined in `*-acl.service.ts` constructors):
- [src/user/services/user-acl.service.ts](src/user/services/user-acl.service.ts) — `ADMIN: Manage`, `USER: Read/Update` (self only, via the `isUserItself` rule). There are no cross-user reads, because user records carry email (constitution rule 16). USER has no `List`, so `GET /users` is admin-only.
- [src/article/services/article-acl.service.ts](src/article/services/article-acl.service.ts) — `ADMIN: Manage`, `USER: Create/List/Read`, `USER: Update/Delete` (author only).
- [src/exercise/services/exercise-acl.service.ts](src/exercise/services/exercise-acl.service.ts) — `ADMIN: Manage`, `USER: List/Create`, `USER: Read` (shared catalog or own custom exercise).
- [src/workout/services/workout-acl.service.ts](src/workout/services/workout-acl.service.ts) — `ADMIN: Manage`, `USER: Create/List` (own days), `USER: Read/Update/Delete` (owner only, on entries and sessions). Friends' access (Step 12) gets its own rule plus the summary DTO.

## Testing patterns

Every feature needs at least one unit test (constitution rule 14). Agent tools also need an e2e test through the real path, with only the Claude call stubbed. Jest is configured in [package.json](package.json); specs are colocated next to the files they test (`*.spec.ts`). The e2e test for the reference article module lives in [test/article/](test/article/).

**Gotcha: ACL service mocks must use plain functions, not `jest.fn().mockReturnValue(...)`.**

The existing user specs call `jest.resetAllMocks()` in multiple `afterEach` hooks. A `jest.fn()` with a `mockReturnValue` will be wiped between tests and the next `forActor(...)` call returns `undefined`, producing:

> `TypeError: Cannot read properties of undefined (reading 'canDoAction')`

Use plain functions — they're not jest mocks and survive `resetAllMocks`:

```ts
const mockedAclService = {
  forActor: () => ({ canDoAction: () => true }),
};

// in providers:
{ provide: SomeAclService, useValue: mockedAclService },
```

This is the pattern used in [src/user/services/user.service.spec.ts](src/user/services/user.service.spec.ts).

## Commands

```sh
npm install                     # install deps
npm run dev                     # watch mode
npm run build                   # tsc via nest build, output to dist/
npm test                        # unit tests (jest)
npm run test:e2e                # e2e tests
npm run test:cov                # coverage
npm run lint                    # eslint
npm run lint:fix                # eslint --fix

# TypeORM migrations (driven by ormconfig.ts)
npm run migration:generate --name=DescribeChange
npm run migration:run
npm run migration:revert
```

Local dev runs Nest on the host and Postgres in docker:

```sh
docker compose up -d pgsqldb    # Postgres on localhost:5433 (adminer: docker compose up -d adminer → :8081)
npm run migration:run
npm run dev                     # API on :3001, routes under /api/v1, Swagger at /swagger
```

Ports are offset from denwa-alert's (3000 / 5432 / 8080) so both can run at once. The compose file sets `name: tomo-gym` for the same reason: both repos keep it in a directory called `backend`.

## Environment

Copy `.env.template` to `.env`. Required vars that need generating, not just filling in:

- `JWT_PUBLIC_KEY_BASE64` / `JWT_PRIVATE_KEY_BASE64` — RS256 keypair, base64-encoded. The app will not boot without these.

`.env` is gitignored; never commit it.

## Persistence

- PostgreSQL only (constitution rule 3). No NoSQL, no SQLite in production.
- Migrations were squashed when the project started: `CreateUsers` + `CreateArticles` are the base, with none of denwa-alert's history. Check for drift with `npx typeorm-ts-node-commonjs migration:generate -d ormconfig.ts --check migrations/DriftCheck`.
- TypeORM with a filesystem-glob-based config in [ormconfig.ts](ormconfig.ts) — it picks up any `src/**/entities/*.entity.ts` and any file in `migrations/`. When you add an entity, no manual registration is needed for migrations to see it.
- Entities are registered with DI via `TypeOrmModule.forFeature([Entity])` inside each module's `*.module.ts`.
- `synchronize: false` is set intentionally. Schema changes go through migrations.
- **E2E tests build the schema by running the real migrations** (`test/test-utils.ts`), so they cover migrations and seed data. A schema change without a migration fails e2e.
- Output DTOs in new modules are built by **explicit mapper functions** (`toExerciseOutput`, `toEntryOutput`, `toDayDetail`, `toDaySummary`), not by serialising entities, so a new column can't leak.

## Shared helpers (use these, don't re-implement)

- `src/shared/time/timezone.ts`: `isValidTimezone()` and the `@IsIanaTimezone()` validator. Timezones are validated, never canonicalised (ICU's canonical form varies by Node version, e.g. `Asia/Kolkata` → `Asia/Calcutta`). Fixed offsets like `+09:00` are rejected because they ignore DST.
- `src/shared/units/weight.ts`: `WEIGHT_UNIT`, `toKg()` (exact lb factor, 2 decimals) and `toBodyWeightKg()` (also range-checks 20–400 kg *after* conversion, throwing `BadRequestException`). Unit conversion is server code, never the LLM's (constitution rule 9).
- `src/shared/typeorm/numeric.transformer.ts`: put `transformer: numericTransformer` on every `numeric` column, or the pg driver hands back strings.
- `src/shared/constants/locale.constant.ts`: `LOCALE` (`en` | `ja`).
- `src/shared/time/calendar-date.ts`: `CalendarDate` ('YYYY-MM-DD' string), `todayIn(tz)`, `addDays()` (DST-proof), `resolveWorkoutDate()` (`today` / `yesterday` / date, rejecting future and impossible dates). Workout days are calendar dates, never timestamps.
- `src/shared/typeorm/pg-date-parser.ts`: makes node-postgres return `DATE` as the raw string. Without it, raw queries get a JS `Date` at local midnight, which is the previous day in UTC on servers east of UTC. It's imported for its side effect by `shared.module.ts`, `ormconfig.ts` and `test/test-utils.ts`; anything else that opens a connection must import it too.
- `src/exercise/utils/normalize-exercise-name.ts`: the alias key. The seed migration has a frozen copy, so changing it needs a re-normalising migration.

## Module wiring checklist

When adding a new module (e.g. `exercise`, `entry`), touch these files in this order:

1. `src/<module>/entities/<module>.entity.ts` — TypeORM entity
2. `src/<module>/repositories/<module>.repository.ts` — extend `Repository<Entity>`, add `getById` etc.
3. `src/<module>/dtos/` — input + output DTOs with `class-validator` + `class-transformer` decorators
4. `src/<module>/services/<module>-acl.service.ts` — extend `BaseAclService<Entity>`, define rules in constructor
5. `src/<module>/services/<module>.service.ts` — inject repository + acl service + logger; every public method starts with `this.aclService.forActor(ctx.user!).canDoAction(...)`
6. `src/<module>/controllers/<module>.controller.ts` — `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` on every method, thin handlers that delegate to the service
7. `src/<module>/<module>.module.ts` — register entity with `TypeOrmModule.forFeature`, providers, controllers, exports
8. Add the module to `src/app.module.ts` imports
9. Generate a migration: `npm run migration:generate --name=Create<Module>`
10. Write specs next to each file (`*.spec.ts`) — mock repository and acl service

The [src/article/](src/article/) module is the canonical example for all of the above.

## What NOT to reach for

- **Don't add `@Roles(...)` or `RolesGuard`.** We deliberately moved away from these — see [docs/suggested-upstream-changes.md](docs/suggested-upstream-changes.md). Role logic belongs in the ACL service.
- **Don't return private fields to other users** (constitution rule 16). Body metrics, email and the chat transcript are self-only. Workout data shown to friends uses its own DTO per visibility level (summary vs. detail). Never hide details by leaving fields out of a shared DTO.
- **Don't spread inputs into entities in services.** Copy allowed fields one by one (see `AuthService.register`, `UserService.updateUser`). Over HTTP, `main.ts`'s `ValidationPipe` (`whitelist: true`) strips unknown keys. But services are also called without that pipe, by agent tools (constitution rule 10), the CLI and tests, and a spread there lets a caller set `roles`, `email` or `isAccountDisabled`.
- **Don't let the agent choose `user_id` or touch another user's data** (constitution rule 10). Tool handlers take the actor from the request context and call the same service methods as REST.
- **Don't introduce a different framework / ORM / database / LLM provider.** Constitution rules 1–4 are non-negotiable.
- **Don't hardcode secrets.** Env vars only (constitution rule 18). That includes the Anthropic API key, which never reaches the client.
