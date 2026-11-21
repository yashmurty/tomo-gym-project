# frontend — tomo-gym

Vite + React + TypeScript SPA, mobile-first and installable as a PWA. Stack is pinned by [constitution.md](../constitution.md) (rules 2, 20, 23). Conventions are copied from denwa-alert's frontend; when in doubt, check how it does things there.

**Status:** Steps 7 (scaffold), 8a (sign-in, sign-up, the chat logger), 8b (history with edit/delete, the full profile) and 12a (groups and invites) are done. Next on the frontend: managing members (Step 12b). See [../ROADMAP.md](../ROADMAP.md).

## Stack

- **Vite 8**, **React 19**, TypeScript (strict).
- **React Router 7**: routes declared in [src/App.tsx](src/App.tsx).
- **Tailwind CSS v4**: theme tokens in [src/index.css](src/index.css).
- **Orval**: typed fetch client generated from the backend's Swagger JSON into `src/lib/generated/` (gitignored).
- **Vitest** + **React Testing Library**: jsdom; tests colocated as `*.test.ts(x)`.
- **ESLint 10** (flat config) + **Prettier**.
- **Node 24 / npm 11.** The lockfile is written by npm 11; npm 10's `npm ci` rejects it. CI uses Node 24.22.3. npm 11 asks for install scripts to be reviewed: decisions live in `allowScripts` in `package.json`. After adding a dependency, run `npm install-scripts ls` and approve or deny anything new.

Forms use **react-hook-form + zod** (as in denwa-alert), with schemas built inside the component from `t()` so validation messages are translated. No state-management library and no service worker. Add one only when a screen needs it (constitution rule 26).

## Layout

```
frontend/
├── index.html                # viewport-fit=cover, manifest + icon links
├── public/
│   ├── manifest.webmanifest  # PWA manifest ("Tomo Gym")
│   └── icons/                # placeholder icons; *.svg are the sources
├── swagger.json              # committed; `npm run download:swagger` refreshes it
├── orval.config.ts
├── src/
│   ├── App.tsx               # route table
│   ├── main.tsx              # BrowserRouter → AuthProvider → I18nProvider → App
│   ├── index.css             # Tailwind + theme tokens
│   ├── chat/                 # the chat logger: chat-api (SSE stream), useChat, TurnView, Composer
│   ├── entries/              # shared by chat and history: EntryCard, entry-result (shapes + REST adapter), format
│   ├── history/              # DayNote, EntryItem (view / edit / delete), EntryEditor
│   ├── profile/              # WeightSettings, TimezoneSetting, AccessTokens
│   ├── groups/               # GroupName, InviteCard, MemberList, OwnerBadge, group-api (409 codes, member counts)
│   ├── components/           # AppLayout (tab shell), PublicLayout, LanguageToggle, RequireAuth, form, icons
│   ├── i18n/                 # en.ts, ja.ts, i18n.ts (helpers), i18n-context.tsx
│   ├── lib/
│   │   ├── config.ts         # API_BASE_URL
│   │   ├── auth.ts           # token storage + refresh call
│   │   ├── api-client.ts     # authorizedFetch (token + refresh) and the customFetch mutator
│   │   ├── api-error.ts      # ApiError (status, code, Retry-After) + toApiError
│   │   ├── describe-error.ts # ApiError / network failure → catalog key
│   │   ├── auth-context.tsx  # user (from JWT), profile (GET /users/me), updateProfile
│   │   └── generated/        # Orval output — never edit
│   ├── routes/               # one component per route
│   └── test/                 # setup.ts, render.tsx (renderWithProviders, signIn, PROFILE)
└── vite.config.ts            # dev server :5174, /api proxy → :3001, Vitest block
```

## Routes

| Path             | Auth     | Layout       | Purpose                                                                    |
| ---------------- | -------- | ------------ | -------------------------------------------------------------------------- |
| `/`              | required | AppLayout    | Log: the chat logger                                                       |
| `/history`       | required | AppLayout    | Training days, newest first ("Show older days" pages back)                 |
| `/history/:date` | required | AppLayout    | One day: note, entries; edit sets / cardio, delete                         |
| `/groups`        | required | AppLayout    | Your friend groups; create one                                             |
| `/groups/:id`    | required | AppLayout    | A group: name (owner renames), invite link, members; owner deletes         |
| `/join/:token`   | required | AppLayout    | Where an invite link lands: preview, Join                                  |
| `/profile`       | required | AppLayout    | Language, unit, body weight, time zone, MCP access tokens, log out         |
| `/login`         | public   | PublicLayout | Sign in (`?from=` path to return to; `?session=expired`)                   |
| `/register`      | public   | PublicLayout | Sign up; signs in afterwards (`?from=` too, so an invite survives sign-up) |
| `*`              | —        | PublicLayout | NotFound                                                                   |

`RequireAuth` redirects signed-out visitors to `/login?from=<path>`. Login and Register pass `from` to each other (`withFrom()` in `lib/safe-redirect.ts`). `AppLayout` is the signed-in shell: a slim header, the page, and a fixed bottom tab bar (Log / History / Groups / Profile).

## EN/JP: no hardcoded copy

The whole UI ships in English and Japanese (constitution rule 23). **Every user-facing string comes from the catalogs** in [src/i18n/](src/i18n/), including `aria-label`s, `title`s, placeholders and error messages.

```tsx
const { t, locale, setLocale } = useI18n();
<h1>{t('profile.title')}</h1>
<p>{t('profile.signedInAs', { name: profile.name })}</p>
```

- **Adding a string:** add the key to [en.ts](src/i18n/en.ts) (the source of key names) and to [ja.ts](src/i18n/ja.ts). `ja` is typed `Record<MessageKey, string>`, so a missing key fails `tsc`. [i18n.test.ts](src/i18n/i18n.test.ts) also checks that placeholders match and that no Japanese entry is a copy of the English one (allow-list deliberate exceptions in `SAME_IN_BOTH`).
- **Keys** are `area.thing` (`nav.history`, `profile.logout`). Write `{name}` placeholders, never string concatenation, since word order differs between the languages.
- **The one exception:** language names in the toggle (`LOCALE_NAMES`) are written in their own language and never translated.
- **Which language shows:** signed in → `User.locale`; signed out → the last language used on this device (`localStorage['tomo.locale']`), else the browser's. `setLocale` switches at once and, when signed in, PATCHes `User.locale` (reverting if the save fails). `<html lang>` follows the locale.
- **Text from the API** (exercise names, agent replies) is already localised by the backend for the user's locale. Don't translate it again on the client.
- Inter has no Japanese glyphs; the font stack falls through to the system's Japanese UI font.

## Mobile-first

Constitution rule 20: every page works at ≤ 375px, with no horizontal scroll on primary flows and tap targets ≥ 44px. Logging a set must be comfortable one-handed.

- **Mobile-first utilities.** Unprefixed classes are the phone layout; layer `sm:`/`md:` on top for wider screens. Content sits in `max-w-[640px]` columns.
- **Tap targets:** `min-h-11` (44px) on buttons and links that aren't inline in text; the tab bar uses `min-h-14`.
- **Safe areas:** `index.html` sets `viewport-fit=cover`, so pad fixed and edge bars with `env(safe-area-inset-*)`, e.g. `pb-[env(safe-area-inset-bottom)]`. Content inside `AppLayout` already clears the tab bar.
- **Use `min-h-dvh`, not `min-h-screen`.** `vh` ignores mobile browser chrome.
- No fixed pixel widths; prefer `flex-wrap`, `min-w-0` and `truncate` over overflow. Wide data becomes cards on phones, not a scrolling table.
- **Check at 375×667** (DevTools → iPhone SE) before pushing, both languages: Japanese labels are often wider.

## PWA

Manifest-only: installable (name, icons, standalone display), **no service worker** and no offline mode. The chat needs the network anyway, and a service worker brings cache-invalidation bugs. Revisit only with a concrete need. The icons are placeholders: a dumbbell on the accent colour, rendered from `public/icons/*.svg`. The maskable icon keeps its glyph inside the 40%-radius safe zone. [src/pwa.test.ts](src/pwa.test.ts) checks that the manifest's and `index.html`'s icon paths exist.

## API client

Import generated functions from `src/lib/generated/<tag>/<tag>.ts` (tags are the controllers' `@ApiTags`).

```ts
import { userControllerUpdateUser } from '../lib/generated/users/users';

const res = await userControllerUpdateUser(user.id, { locale: 'ja' });
const updated = res.data.data; // outer .data = backend envelope { data, meta }
```

- `customFetch` ([src/lib/api-client.ts](src/lib/api-client.ts)) attaches the Bearer token and throws an `Error` whose message comes from the backend's error body. `204` gives `data: undefined`.
  - A 401 on a request that **carried a token** means the access token expired. `customFetch` renews both tokens and retries once; parallel 401s share one refresh.
  - A 401 **without a token** (e.g. a wrong password at login) is a real answer and goes straight to the caller.
  - If the refresh token is rejected (401), it clears the tokens and sends the user to `/login?session=expired`.
  - If the refresh fails for a transient reason (offline, a 5xx during a deploy), the error propagates and **the tokens stay**, so a flaky gym connection never signs anyone out.
- Don't hand-roll `fetch` for REST calls; use the generated functions. The one exception is `POST /chat`, which streams SSE that Orval's client can't read: `streamChat` (`src/chat/chat-api.ts`) reads it through `authorizedFetch`, so it gets the same token and refresh handling.
- **Errors:** `customFetch` and `streamChat` throw `ApiError` (`status`, `code` from `error.details.code`, `retryAfterSec`). A network failure is the plain fetch error. **Never show `error.message` to users**: it's the backend's English. Map to a catalog key instead: screen-specific statuses first (a 401 at login, a 409 at sign-up), then `describeError()` for the rest (429 codes, 5xx, network).
- **Base URL:** `API_BASE_URL` ([src/lib/config.ts](src/lib/config.ts)) is `VITE_API_BASE_URL`, or empty. Empty means same-origin: in dev, Vite proxies `/api` to the backend on `:3001`, so local dev needs no `.env` and no CORS. Production sets `VITE_API_BASE_URL` at build time (Step 9).
- **Sync after backend API changes:** with the backend running, `npm run sync` (download `swagger.json`, then regenerate). Commit the new `swagger.json`. `npm run build` and `npm test` regenerate from the committed spec first.

## Chat logger (`src/chat/`)

- **Sending:** `useChat().send(text)` adds the turn at once, makes a fresh idempotency key (`newIdempotencyKey()`; `getRandomValues`, since `randomUUID` needs a secure context and fails on a phone over the LAN), and streams `turn → text/tool… → done | error` into it.
- **The events** mirror `ChatEvent` in the backend's `agent/dtos/chat.dto.ts`. `done` and `error` carry `changes`, the number of saved changes that can still be undone; the Undo button shows only when that's above 0. A limit that stops a turn midway sends `error` with a `code` and keeps what was saved, still undoable.
- **Retry** reuses the same key, so the server either runs the turn or replays it, never twice (constitution rule 11). It's offered when the stream was cut off, or when the server refused before storing anything (429, 5xx). A replay starts with `turn` (`replayed: true`), and the turn's events are reset then.
- **History:** `GET /chat/messages` (newest page first; "Show earlier messages" pages back with `before`). It returns each turn with the same events plus `changes` and `undone`, so cards and Undo survive a reload.
- **Cards:** `TurnView` renders write tools (log_entry / update_entry as `EntryCard`; move, note and delete as a line) and hides reads and tool errors (the reply covers them). Every number on a card comes from the tool result: weights in the user's unit (`weight` + `weightUnit`), kcal and day number. The app formats them (`entries/format.ts`) but never computes them (constitution rule 9). In Japanese the card shows `exerciseJa`.
- **Composer:** Enter sends and Shift+Enter adds a new line. Enter never sends while an IME is composing (Japanese input: `isComposing`, or keyCode 229 on Safari). It's pinned above the tab bar; the page scrolls to the very bottom on new content.

## History and Profile

- **Weights are the server's, in the user's unit.** `EntryOutput` sets carry `weight` in the entry's `weightUnit`, next to `weightKg`. `UserOutput.weight` is the body weight in `weightUnit`. Show and edit those. Edits send the same unit back (`unit: entry.weightUnit`; the profile's `weight` is in its `weightUnit`), and the server converts and range-checks (constitution rule 9). Never multiply by 2.2046 in the app.
- **History** (`routes/History.tsx`) lists `GET /days` (30 at a time; `to` is inclusive, so the next page asks for one extra and drops the overlap). **A day** (`routes/Day.tsx`) shows its note (`PUT /days/:date/note`; empty clears it) and entries.
  - `EntryEditor` edits sets (reps, weight; add or remove; at least one) and cardio numbers; a cleared cardio field is sent as `null`.
  - It checks the server's limits so it can point at the field, but the server decides.
  - After an edit or delete, the day reloads (totals and kcal come from the server).
  - REST edits aren't in the agent action log, so a later chat Undo skips rows edited here (it reports "kept N edited since").
- **Profile**: the unit toggle saves at once; body weight saves on Save, and blank clears it.
  - **Time zone** is a `<select>` of `Intl.supportedValuesOf('timeZone')`, plus the saved value when the browser lists it under another name (the server stores zones exactly as sent: `Asia/Kolkata`, which ICU lists as `Asia/Calcutta`). It also offers "use this device's" when the two differ.
  - **Access tokens** (`profile/AccessTokens.tsx`) list, create and revoke personal access tokens for external MCP clients. The token is shown once, with the server URL (`mcpServerUrl()` in `lib/config.ts`) and a `claude mcp add` example; the list only has the prefix.
  - `CopyField` falls back to selecting the text where the clipboard API isn't available.
- **Loading pattern:** fetch inside the effect and set state in `.then` (with a `current` flag for unmounts). Reload by bumping a counter in the effect's dependencies; React's lint rejects calling a state-setting loader straight from an effect.

## Friend groups (Step 12)

- **Groups** (`routes/Groups.tsx`) lists `GET /groups` and creates groups (opening the new one). **A group** (`routes/Group.tsx`) shows:
  - `GroupName`, which the owner can rename;
  - `InviteCard`: any member copies `inviteUrl(token)` (`lib/config.ts`, the app's own origin); the owner resets the link after confirming, or turns it off and on;
  - `MemberList`: names only, owner first, "(You)";
  - the owner's Delete, after confirming.
- **Status codes:**
  - **404** means "not in this group or no such group"; the page says exactly that.
  - Owner-only controls are hidden from members. The server answers **403** if one is tried anyway.
  - **409** codes `group_full` / `group_limit` map to catalog keys in `groupError()` (`groups/group-api.ts`). The limits stay on the server, so the copy doesn't repeat the numbers.
- **Join** (`routes/Join.tsx`) loads `GET /invites/:token`:
  - **preview** → Join → the group;
  - **already a member** → "Open group";
  - **404** → "isn't active", which names nothing.

  Step 12c adds the "what joining shares" panel and its link to the Profile setting.

- **Member counts** use `memberCountText()`: "1 member" has its own key, since an English plural can't be a placeholder.

## Auth

- Access + refresh tokens live in `localStorage` (`accessToken`, `refreshToken`), behind `auth.ts`'s helpers only, so moving to httpOnly cookies later is a one-file change.
- `useAuth()` gives `user` (decoded from the JWT: id, email, roles), `profile` (the user's own `UserOutput` from `GET /users/me`), `login`, `register` (auto-logs in afterwards), `logout`, `refreshProfile` and `updateProfile(input)` (PATCH `/users/:id`; replaces `profile` with the response).
- **Session length:** access token 1 hour, refresh token 90 days, both renewed on every refresh. Anyone who opens the app at least once every 90 days stays signed in. At page load, an expired access token still counts as signed in while the refresh token is valid; the first API call (`GET /users/me`) gets a 401 and `customFetch` renews both tokens. Keep the access token short: the backend doesn't check it against the database, and logout only deletes the tokens on the device.

## Testing

```sh
npm test            # vitest run (regenerates the API client first)
npm run test:watch
```

- Render components with `renderWithProviders(ui, { route })` from [src/test/render.tsx](src/test/render.tsx): MemoryRouter + AuthProvider + I18nProvider. `signIn()` stores a valid token, and `PROFILE` / `apiResponse()` build the generated client's resolved values.
- Mock the generated module the component uses (e.g. `vi.mock('../lib/generated/users/users', …)` with `vi.hoisted` mocks); never mock `customFetch`.
- Query by role and accessible name (`getByRole('button', { name: 'Log out' })`). Tests run in English unless they set `localStorage['tomo.locale']`. Add a Japanese assertion where layout or wording matters.
- Every feature gets at least one test (constitution rule 14).

## Commands

```sh
npm install           # Node 24 / npm 11
npm run dev           # http://localhost:5174 (backend expected on :3001)
npm run build         # generate:api → tsc -b → vite build
npm run preview       # serve dist/ on :5174
npm test
npm run lint          # eslint .
npm run format        # prettier --write .
npm run format:check  # used in CI
npm run sync          # download swagger.json + regenerate the client
```

`BACKEND_URL` overrides the backend for both the dev proxy and `download:swagger` (default `http://localhost:3001`).

## What NOT to do

- **Don't hardcode user-facing text.** It goes in both catalogs.
- **Don't edit `src/lib/generated/`.** It's regenerated from `swagger.json`.
- **Don't put secrets in `VITE_*` variables.** Everything with that prefix ends up in the public bundle. The Anthropic key and anything else secret stay on the backend (constitution rule 18).
- **Don't show other users' private data.** Body metrics, email and the chat transcript are self-only (constitution rule 16). Friend views (Step 12) render the backend's per-visibility DTOs as given.
- **Don't compute derived values on the client** (day numbers, calories, unit conversion: constitution rule 9). Display what the backend returns.
- **Don't add a service worker, state library, form library or UI kit "for later."**
