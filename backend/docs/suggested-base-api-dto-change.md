# Suggested upstream change — `SwaggerBaseApiResponse` naming

Proposal for the [monstar-lab-oss/nestjs-starter-rest-api](https://github.com/monstar-lab-oss/nestjs-starter-rest-api) starter kit. Discovered while wiring an OpenAPI-based frontend client generator against a downstream project built on the v11 branch.

## Motivation

The `SwaggerBaseApiResponse` helper in [src/shared/dtos/base-api-response.dto.ts](../src/shared/dtos/base-api-response.dto.ts) produces the extended wrapper class for API responses and then overwrites its `.name` so Swagger emits a distinct schema per inner DTO. On the v11 branch, the override uses a template literal that interpolates the class itself:

```ts
const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
Object.defineProperty(ExtendedBaseApiResponse, 'name', {
  value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
});
```

`${type}` invokes `Function.prototype.toString()` on the class, which returns **the entire class source** (including newlines, braces, property names, and whitespace). That source ends up inside the schema name.

## Observable effect

With the current code, `swagger-json` contains keys like:

```
SwaggerBaseApiResponseFor class UserOutput {
    id;
    name;
    username;
    roles;
    email;
    isAccountDisabled;
    createdAt;
    updatedAt;
}
```

Swagger UI tolerates these — it happily renders the spec. But downstream tooling that normalizes schema keys into valid JS identifiers (e.g. Orval, openapi-typescript-codegen, oazapfts) collapses two superficially-different dumps (differing only by whitespace or method positioning) to the same identifier, producing duplicate-schema errors:

```
🛑 Error: Duplicate schema names detected:
  2x SwaggerBaseApiResponseForClassUserOutputIdNameUsernameRolesEmailIsAccountDisabledCreatedAtUpdatedAtMeta
  2x SwaggerBaseApiResponseForClassUserOutputIdNameUsernameRolesEmailIsAccountDisabledCreatedAtUpdatedAt
  2x SwaggerBaseApiResponseForClassArticleOutputIdTitlePostCreatedAtUpdatedAtAuthorMeta
  2x SwaggerBaseApiResponseForClassArticleOutputIdTitlePostCreatedAtUpdatedAtAuthor
```

## Proposed change

Derive the name from `type.name` (or `type[0].name` for the array form) instead of stringifying the class:

### File: `src/shared/dtos/base-api-response.dto.ts`

```diff
-  // NOTE : Overwrite the returned class name, otherwise whichever type calls this function in the last,
-  // will overwrite all previous definitions. i.e., Swagger will have all response types as the same one.
-  const isAnArray = Array.isArray(type) ? ' [ ] ' : '';
-  Object.defineProperty(ExtendedBaseApiResponse, 'name', {
-    value: `SwaggerBaseApiResponseFor ${type} ${isAnArray}`,
-  });
+  // Overwrite the returned class name so Swagger emits a unique, stable schema
+  // name per inner type. Must be derived from the type's `.name` — interpolating
+  // `${type}` stringifies the class body (including whitespace), producing
+  // unreadable names and collisions in consumers that normalize identifiers
+  // (e.g. Orval).
+  const isAnArray = Array.isArray(type);
+  const typeName = isAnArray ? type[0].name : type.name;
+  const arraySuffix = isAnArray ? 'Array' : '';
+  Object.defineProperty(ExtendedBaseApiResponse, 'name', {
+    value: `SwaggerBaseApiResponseFor${typeName}${arraySuffix}`,
+  });
```

### Output after the change

The same two endpoints now emit distinct, readable schema names:

```
SwaggerBaseApiResponseForUserOutput
SwaggerBaseApiResponseForUserOutputArray
SwaggerBaseApiResponseForArticleOutput
SwaggerBaseApiResponseForArticleOutputArray
```

## Why the fallback branches in the older (v10) form are unnecessary in v11

An earlier version of this helper (shipped with v10) used:

```ts
const typeName = isAnArray
  ? (type[0] as any)?.name || String(type[0])
  : (type as any)?.name || String(type);
```

The `as any` casts and `String(type)` fallbacks were defensive against the wider v10 `ApiPropertyType` union, which included `string | Record<string, any> | undefined`. In v11, `@nestjs/swagger`'s `@ApiProperty({ type })` tightened its accepted union, and the starter correctly narrows `ApiPropertyType` accordingly:

```ts
type ApiPropertyType = Type<unknown> | [new (...args: any[]) => any];
```

Under this narrow union, `.name` is always defined on both branches — so the defensive fallbacks are dead code and the cleaner form above is safe.

## Compatibility

- No public API change — the helper's signature stays identical; only the `.name` of the returned class changes.
- Schema names in the OpenAPI spec change, which means any frontend already consuming the spec with the current names must regenerate. In practice, nobody is consuming names like `"SwaggerBaseApiResponseFor class UserOutput {..."` — that's why the bug went unnoticed. Any consumer that hit the duplicate-schema error is *currently* broken; this change fixes them.
- Swagger UI continues to render correctly.

## Scope

This proposal touches only [src/shared/dtos/base-api-response.dto.ts](../src/shared/dtos/base-api-response.dto.ts). No controller or service changes required. No migration needed.
