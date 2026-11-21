# frontend — tomo-gym

Vite + React + TypeScript SPA, mobile-first and installable as a PWA. Stack is pinned by [constitution.md](../constitution.md) (rules 2, 20, 23). Conventions are copied from denwa-alert's frontend; when in doubt, check how it does things there.

**Status:** Step 7 (scaffold) is done: API client, auth plumbing, EN/JP catalogs, the signed-in tab shell, the PWA manifest and CI. The pages are placeholders until Step 8 (sign-in / sign-up, chat logger with streaming + undo, history, profile). See [../ROADMAP.md](../ROADMAP.md).

## Stack

- **Vite 8**, **React 19**, TypeScript (strict).
- **React Router 7**: routes declared in [src/App.tsx](src/App.tsx).
- **Tailwind CSS v4**: theme tokens in [src/index.css](src/index.css).
- **Orval**: typed fetch client generated from the backend's Swagger JSON into `src/lib/generated/` (gitignored).
- **Vitest** + **React Testing Library**: jsdom; tests colocated as `*.test.ts(x)`.
- **ESLint 10** (flat config) + **Prettier**.
- **Node 24 / npm 11.** The lockfile is written by npm 11; npm 10's `npm ci` rejects it. CI uses Node 24.22.3. npm 11 asks for install scripts to be reviewed: decisions live in `allowScripts` in `package.json`. After adding a dependency, run `npm install-scripts ls` and approve or deny anything new.

No state-management library, no form library and no service worker yet. Add one only when a screen needs it (constitution rule 26).

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
│   ├── components/           # AppLayout (tab shell), PublicLayout, LanguageToggle, RequireAuth, icons
│   ├── i18n/                 # en.ts, ja.ts, i18n.ts (helpers), i18n-context.tsx
│   ├── lib/
│   │   ├── config.ts         # API_BASE_URL
│   │   ├── auth.ts           # token storage + refresh call
│   │   ├── api-client.ts     # customFetch mutator used by every generated call
│   │   ├── auth-context.tsx  # user (from JWT), profile (GET /users/me), updateProfile
│   │   └── generated/        # Orval output — never edit
│   ├── routes/               # one component per route
│   └── test/                 # setup.ts, render.tsx (renderWithProviders, signIn, PROFILE)
└── vite.config.ts            # dev server :5174, /api proxy → :3001, Vitest block
```

## Routes

| Path       | Auth     | Layout       | Purpose                                      |
| ---------- | -------- | ------------ | -------------------------------------------- |
| `/`        | required | AppLayout    | Log (chat logger in Step 8; placeholder now) |
| `/history` | required | AppLayout    | History (Step 8; placeholder now)            |
| `/profile` | required | AppLayout    | Language toggle + log out (more in Step 8)   |
| `/login`   | public   | PublicLayout | Sign in (placeholder until Step 8)           |
| `*`        | —        | PublicLayout | NotFound                                     |

`RequireAuth` redirects signed-out visitors to `/login?from=<path>`. `AppLayout` is the signed-in shell: a slim header, the page, and a fixed bottom tab bar (Log / History / Profile).

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
- Don't hand-roll `fetch` for REST calls; use the generated functions. (Exception for Step 8: `POST /chat` streams SSE, which Orval's fetch client can't consume, so the chat screen needs a small streaming reader that goes through the same token and refresh logic.)
- **Base URL:** `API_BASE_URL` ([src/lib/config.ts](src/lib/config.ts)) is `VITE_API_BASE_URL`, or empty. Empty means same-origin: in dev, Vite proxies `/api` to the backend on `:3001`, so local dev needs no `.env` and no CORS. Production sets `VITE_API_BASE_URL` at build time (Step 9).
- **Sync after backend API changes:** with the backend running, `npm run sync` (download `swagger.json`, then regenerate). Commit the new `swagger.json`. `npm run build` and `npm test` regenerate from the committed spec first.

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
