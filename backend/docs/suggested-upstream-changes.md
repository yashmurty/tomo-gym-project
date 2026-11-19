# Suggested upstream changes — nestjs-starter-rest-api

Proposals for the [monstar-lab-oss/nestjs-starter-rest-api](https://github.com/monstar-lab-oss/nestjs-starter-rest-api) starter kit, discovered while building a downstream project on top of it.

## Motivation

The starter ships two example modules that demonstrate authorization slightly differently:

- **`article` module** — uses service-layer ACL (`ArticleAclService` extending `BaseAclService`), with the controller only applying `@UseGuards(JwtAuthGuard)`. Business-role logic lives inside the service.
- **`user` module** — has a `UserAclService` defined, *but it is not wired into `UserService`*. Authorization instead is sprinkled across the controller using `@Roles(...)` + `RolesGuard` on one endpoint, and two endpoints are left entirely unguarded with `TODO: ADD RoleGuard` comments ([user.controller.ts:102](../src/user/controllers/user.controller.ts#L102), [user.controller.ts:127](../src/user/controllers/user.controller.ts#L127)).

The inconsistency makes it unclear which pattern downstream projects should follow, and the two unguarded endpoints (`GET /users/:id`, `PATCH /users/:id`) are a security foot-gun for anyone who copies the starter verbatim.

This doc proposes aligning the `user` module with the `article` module's pattern: JWT guard at the controller gate, ACL checks in the service, no `@Roles` decorators.

## Summary of changes

| File | Change |
|---|---|
| `src/user/services/user.service.ts` | Inject `UserAclService`; add `canDoAction` checks to `getUsers`, `getUserById`, `updateUser` |
| `src/user/controllers/user.controller.ts` | Drop `RolesGuard` + `@Roles(...)` from `getUsers`; add `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` to `getUser` and `updateUser`; remove TODO comments; remove unused imports (`ROLE`, `Roles`, `RolesGuard`) |
| `src/user/services/user.service.spec.ts` | Register a `UserAclService` mock in the testing module providers |

No changes to `UserAclService` itself — its existing rules (`ADMIN: Manage`, `USER: Read`, `USER: Update self-only`) are kept as-is.

## 1. Wire `UserAclService` into `UserService`

### File: `src/user/services/user.service.ts`

Imports — add `Action`, `Actor`, `UserAclService`:

```ts
import { Action } from '../../shared/acl/action.constant';
import { Actor } from '../../shared/acl/actor.constant';
import { UserAclService } from './user-acl.service';
```

Constructor — inject the ACL service:

```ts
constructor(
  private repository: UserRepository,
  private aclService: UserAclService,
  private readonly logger: AppLogger,
) {
  this.logger.setContext(UserService.name);
}
```

### Add ACL checks to three methods

**`getUsers`** — check `Action.List`:

```ts
async getUsers(ctx: RequestContext, limit: number, offset: number) {
  this.logger.log(ctx, `${this.getUsers.name} was called`);

  const actor: Actor = ctx.user!;

  const isAllowed = this.aclService.forActor(actor).canDoAction(Action.List);
  if (!isAllowed) {
    throw new UnauthorizedException();
  }

  // ...existing findAndCount logic
}
```

**`getUserById`** — check `Action.Read` with the target user as the resource:

```ts
async getUserById(ctx: RequestContext, id: number) {
  this.logger.log(ctx, `${this.getUserById.name} was called`);

  const actor: Actor = ctx.user!;

  const user = await this.repository.getById(id);

  const isAllowed = this.aclService
    .forActor(actor)
    .canDoAction(Action.Read, user);
  if (!isAllowed) {
    throw new UnauthorizedException();
  }

  return plainToClass(UserOutput, user, { excludeExtraneousValues: true });
}
```

**`updateUser`** — check `Action.Update` with the target user as the resource (triggers `isUserItself` rule so regular users can only update themselves):

```ts
async updateUser(ctx: RequestContext, userId: number, input: UpdateUserInput) {
  this.logger.log(ctx, `${this.updateUser.name} was called`);

  const user = await this.repository.getById(userId);

  const actor: Actor = ctx.user!;

  const isAllowed = this.aclService
    .forActor(actor)
    .canDoAction(Action.Update, user);
  if (!isAllowed) {
    throw new UnauthorizedException();
  }

  // ...existing hash + save logic
}
```

### Notes on scope

- `getMyProfile` / `findById`, `findByUsername`, `validateUsernamePassword`, `createUser` are **not** gated at the service layer. `findById` is only reached via `/users/me` which is inherently self-scoped; the rest are called by the auth flow and signup, where authorization is either implicit (you're logging yourself in) or handled elsewhere.
- `Actor` is imported only as a type annotation for readability — `ctx.user!` would work on its own, but the explicit type matches the `article.service.ts` convention.

## 2. Tighten controller guards and drop `@Roles`

### File: `src/user/controllers/user.controller.ts`

Remove these imports — they're no longer used:

```ts
// Remove:
import { ROLE } from '../../auth/constants/role.constant';
import { Roles } from '../../auth/decorators/role.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
```

**`getUsers`** — drop `RolesGuard` and `@Roles(...)`:

```diff
-  @UseGuards(JwtAuthGuard, RolesGuard)
-  @Roles(ROLE.ADMIN, ROLE.USER)
+  @UseGuards(JwtAuthGuard)
   @ApiBearerAuth()
   async getUsers(
```

**`getUser`** (`GET /users/:id`) — was previously unguarded with a `TODO: ADD RoleGuard` comment:

```diff
-  // TODO: ADD RoleGuard
-  // NOTE : This can be made a admin only endpoint. For normal users they can use GET /me
   @UseInterceptors(ClassSerializerInterceptor)
   @Get(':id')
   @ApiOperation({ summary: 'Get user by id API' })
   @ApiResponse({ status: HttpStatus.OK, type: SwaggerBaseApiResponse(UserOutput) })
   @ApiResponse({ status: HttpStatus.NOT_FOUND, type: BaseApiErrorResponse })
+  @UseGuards(JwtAuthGuard)
+  @ApiBearerAuth()
   async getUser(
```

**`updateUser`** (`PATCH /users/:id`) — same treatment:

```diff
-  // TODO: ADD RoleGuard
-  // NOTE : This can be made a admin only endpoint. For normal users they can use PATCH /me
   @Patch(':id')
   @ApiOperation({ summary: 'Update user API' })
   @ApiResponse({ status: HttpStatus.OK, type: SwaggerBaseApiResponse(UserOutput) })
   @ApiResponse({ status: HttpStatus.NOT_FOUND, type: BaseApiErrorResponse })
   @UseInterceptors(ClassSerializerInterceptor)
+  @UseGuards(JwtAuthGuard)
+  @ApiBearerAuth()
   async updateUser(
```

## 3. Test fixture update

### File: `src/user/services/user.service.spec.ts`

Because `UserService` now depends on `UserAclService`, the testing module must provide it. The existing specs all share a single mocked-services block and call `jest.resetAllMocks()` in multiple `afterEach` hooks. A `jest.fn().mockReturnValue(...)` for `forActor` gets wiped by those resets — the next test sees `forActor(...)` return `undefined` and throws `Cannot read properties of undefined (reading 'canDoAction')`.

The cleanest fix is to use plain functions so the mock survives `resetAllMocks`:

```ts
import { UserAclService } from './user-acl.service';

// alongside mockedRepository
const mockedAclService = {
  forActor: () => ({ canDoAction: () => true }),
};

// in Test.createTestingModule providers
{ provide: UserAclService, useValue: mockedAclService },
```

## Behavior changes

For a user of the starter kit, the visible API behavior changes on three endpoints:

| Endpoint | Before | After |
|---|---|---|
| `GET /users` | `@Roles(ADMIN, USER)` — both admins and regular users could list | ACL `Action.List` — **ADMIN only**, because `UserAclService` grants `List` only through `Action.Manage` (admin) |
| `GET /users/:id` | **Unguarded** — any unauthenticated request could read any user | JWT required; any authenticated user can read any user (matches `UserAclService.canDo(USER, [Read])`) |
| `PATCH /users/:id` | **Unguarded** — any unauthenticated request could update any user | JWT required; regular users can update only themselves (`isUserItself` rule); admins can update anyone |

The `GET /users` change is the only intentionally-tighter one compared to prior behavior; the other two close genuine unauthenticated-write/read holes.

If the maintainers want to preserve "USER can list users" behavior, adding `Action.List` to the `ROLE.USER` rule in `UserAclService` is the minimal change:

```ts
this.canDo(ROLE.USER, [Action.Read, Action.List]);
```

## Verification

On the downstream project where these changes were implemented:

- `npm run build` — compiles clean
- `npm test` — all 16 suites / 98 tests pass (including the unchanged `user-acl.service.spec.ts`, `acl.service.spec.ts`, and the 17 `UserService` tests with the new mock)

## Why this is worth upstreaming

1. **Consistency** — one authorization pattern across both example modules (`article` and `user`). Downstream users don't have to choose which pattern to copy.
2. **Security** — closes the two `TODO: ADD RoleGuard` gaps that are live in the starter today.
3. **Pedagogy** — the `user` module becomes a better reference because the controller stays thin and the ACL rules are the single source of truth for "who can do what".
4. **Smaller surface area** — `@Roles` + `RolesGuard` + `ROLE` decorator imports disappear from the user controller. If all downstream usage moves to ACL, those utilities could eventually be considered for removal too (out of scope for this proposal).
