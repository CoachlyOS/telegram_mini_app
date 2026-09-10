# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Telegram Mini App (React 18 + Vite 5) that is the frontend for a booking system. It runs inside the Telegram WebApp and talks to a separate Go backend (`booking_api`, not in this repo) over a REST API. Firebase Hosting serves the built SPA.

## Commands

```bash
npm install          # install deps
npm run dev          # Vite dev server on port 8000 (host: true, HMR overlay on)
npm run build        # production build → dist/
npm run preview      # serve the built dist/
npm run deploy        # build + firebase deploy --only hosting (requires firebase login)
```

There is **no test runner, no linter, and no `tsc` typecheck** — none are configured. Don't claim to "run the tests" or "run the linter"; there is nothing to run. `.tsx`/`.ts` files are transpiled by Vite/esbuild with **no type checking** (there is no `tsconfig.json`), so type errors do not fail the build.

### Environment variables (Vite, `VITE_`-prefixed)
- `VITE_API_BASE_URL` — absolute backend URL. If unset, the app uses the relative `/api` path and relies on the Vite dev proxy (see below). Set this for production/Firebase builds.
- `VITE_API_TARGET` — override the dev proxy target (default `http://localhost:8080`).
- `VITE_LOG_LEVEL` — Vite log verbosity: `info` | `warn` | `error` | `silent` (default `info`).
- `VITE_DEBUG_API_URL` — force API-URL debug logging outside dev.

Local dev needs a `.env` (gitignored) — see README for the template.

## Big-picture architecture

### Entry & routing
`index.html` loads the Telegram WebApp SDK (`telegram-web-app.js`) and bootstraps `src/main.jsx` → `src/App.jsx`, which wraps everything in a **`HashRouter`** (required inside Telegram) rendering `src/routes/AppRouter.tsx`.

**⚠️ There are TWO router files — only `AppRouter.tsx` is live.**
- `src/routes/AppRouter.tsx` — **active.** Uses `react-router-dom` `<Routes>`/`<Route>` with real URL paths (`/client/dashboard`, `/professional/timetable/:date`, etc.).
- `src/routes/route.tsx` + `src/constants.ts` (`Routes` enum) — **dead code.** A manual state-machine router (`useState<Route>`) that imports from folders that don't exist (`client_dashboard/`, `select_professional/`, …). It is imported by nothing. When touching routing, work in `AppRouter.tsx`; treat `route.tsx`/`constants.ts` as stale unless you intend to delete them.

### Route folder convention
Routes live in `src/routes/`, one folder per screen, each containing:
- `route.tsx` — the route component imported by `AppRouter.tsx`.
- `components/` — presentational components for that screen.
- `hooks/` — screen-specific data hooks (e.g. `useBooking.ts`).

Folder names mirror route paths with dots as segment separators, and **`_signedin_`** prefixes the authenticated routes (grouping/visual sorting):
- `_signedin_client.dashboard` → `/client/dashboard`
- `_signedin_client.book` → `/client/book`
- `_signedin_professional.timetable.$date` → `/professional/timetable/:date` (`$` = dynamic param, Remix-style)

Unprefixed folders (`role_selection`, `client.registration`, `professional.signin`, `loading`, `error`, `success`) are the pre-auth/entry screens. Path → component mapping is hand-maintained in `AppRouter.tsx`'s `<Routes>` block; the folder names are a convention, not auto-discovered.

### Bootstrap / auth flow (in `AppRouter.tsx`)
1. `useTelegram` (`src/hooks/useTelegram.js`) reads `chat_id` from `window.Telegram.WebApp.initDataUnsafe.user.id` and applies Telegram theme colors as CSS variables (`--bg-color`, etc.).
2. On mount, `AppRouter` calls `apiService.getUserByChatID(chatID, locale)`.
   - User found → store in `UserContext`, call `apiService.setToken(user.token)` for authenticated requests, then `navigate` to the role's dashboard. (`/success` for unknown roles; `/role-selection` on 404.)
   - Network/other error → `/error`.
3. Deep links via Telegram **`tgWebAppStartParam`**: `appointment_<id>` routes a professional to `/professional/appointments` (passing `state.appointmentID`); `invite_<id>` routes a client to `/client/invites`. Parsing lives in `src/utils/urlParams.ts`.
4. The Telegram **BackButton** is shown/hidden per route and wired in `AppRouter.tsx` (hidden on dashboards/entry routes; custom targets for appointments/invites, else `navigate(-1)`).

### Data layer
`src/services/api.js` exports a single **`apiService`** singleton (`ApiService` class). Every backend call goes through it.
- Base URL: `VITE_API_BASE_URL ? `${env}/api` : '/api'`.
- Auth: `setToken`/`clearToken` set a bearer token added to all requests. Token comes from the user fetch and lives only in memory (no persistence).
- Dev proxy: `vite.config.js` proxies `/api` → `http://localhost:8080` (the Go backend). In production, `VITE_API_BASE_URL` points at the deployed backend and `/api` is hit directly.
- `request()` validates `Content-Type: application/json`, throws with `error.status`/`error.data`, and emits a verbose diagnostic for network/CORS failures (it deliberately surfaces proxy/config hints — keep them when editing error paths).
- Endpoints are grouped by domain (clients/professionals/users). When adding an endpoint, follow the existing camelCase method + `URLSearchParams` pagination pattern (`page`, `pageSize`).

### State & hooks
- `UserContext` (`src/contexts/UserContext.tsx`) holds the current user and is the only cross-screen shared state. Booking/selection state is local to each screen's hook, not global.
- Screen hooks (`src/hooks/clients/*`, `src/hooks/professionals/*`, and per-route `hooks/`) encapsulate API calls + loading/error state. Prefer adding a hook over calling `apiService` directly in a component.

### i18n
`src/i18n/config.js` configures `i18next` with **en, ru, uk, pl** (`en` fallback). Detection order: localStorage (`i18nextLng`, set by `LanguageSelector`) → navigator → default `en`. All UI strings go through `t()`; user-facing dates/times use `src/utils/i18n.js` (`formatDate`/`formatTime`/`formatDateTime`) which map the i18n language to a full locale. The user's locale is also sent to the backend (`getUserByChatID`) and updated via `apiService.updateClientLocale`/`updateProfessionalLocale`. When adding a UI string, add it to **all four** locale JSON files in `src/i18n/locales/`.

### Dev-only: terminal logger
`vite-plugin-terminal-logger.js` injects a script in dev that mirrors browser `console.log/warn/error` to the Vite dev-server terminal via a `/__terminal-log` endpoint. Useful since the app runs inside Telegram's webview. This is dev-only (plugin + injected script); it does not affect production builds.

## Dev & deploy workflow

### Local dev with ngrok (for Telegram)
Telegram requires a public HTTPS URL. The configured `allowedHosts` in `vite.config.js` already allow `.ngrok-free.dev`, `.ngrok.app`, `.ngrok.io`, plus a specific ngrok domain. Run `npm run dev` (port 8000), then `ngrok http 8000`, and point BotFather's Web App URL at the ngrok domain. Add any new custom ngrok domain to `allowedHosts` or Vite will reject it.

### Deployment (Firebase Hosting)
- Project: `telegram-mini-app-15131` (`.firebaserc`). `firebase.json` rewrites all routes to `/index.html` (SPA).
- **CI**: `.github/workflows/deploy.yml` deploys on push to the **`dev`** branch (and `workflow_dispatch`). It builds with `VITE_API_BASE_URL` = the `VITE_API_BASE_URL_DEV` GitHub var/secret and deploys via `FIREBASE_TOKEN`. So: push to `dev` to deploy; `main` is the PR-merge target and does not auto-deploy.
- **Manual**: `npm run deploy` (needs `firebase login`); set `VITE_API_BASE_URL` in `.env` first so the built bundle hits the right backend.

## Conventions to follow
- Match the surrounding file: this repo is mixed `.jsx`/`.tsx`. New screens use the folder layout (`route.tsx` + `components/` + `hooks/`) and are imported/registered in `AppRouter.tsx`.
- New API calls go on `apiService`; new screen logic goes in a hook, not inline in the component.
- Telegram WebApp access is typed via `declare global { interface Window { Telegram?... } }` (see `AppRouter.tsx`); use that shape when extending WebApp usage. `window.Telegram` may be undefined outside Telegram — always guard.
- Keep UI strings translated across all four locales.

## Checks run themselves

Two hooks in `.claude/hooks/` enforce i18n hygiene automatically — you do **not** need to run anything preemptively.

- **`post-edit.mjs`** (PostToolUse, on `Edit|Write|MultiEdit|NotebookEdit`): when you touch any `src/i18n/locales/*.json`, it re-parses all four locales and compares their flat key sets. Broken JSON or a key present in some locales but missing in others (beyond the frozen baseline) blocks the edit. Baseline debt lives in `.claude/i18n-baseline.json` — that file is *intentional debt*, not the desired state; do not re-introduce new holes it doesn't list.
- **`stop-gate.mjs`** (Stop): scans code for literal `t('…')` / `i18n.t('…')` / `i18nKey="…"` keys and blocks if a key is used but missing from `en.json` (it renders raw in every locale because `fallbackLng: 'en'`). It also reports **orphaned** keys — entries in `en.json` that no code references — but only in the top-level namespaces you edited this turn, and only as a non-blocking advisory. After 3 blocked rounds it steps aside (counter in `.gocheck/attempts`); a clean pass clears `.gocheck/`.

When the gate blocks, fix what it names: add the missing key to `en.json` (and ideally all four locales), or remove the orphaned call. Don't disable the hooks. The scanner is anchored on `t(`/`i18n.t(`/`i18nKey=` only — it deliberately does **not** scan bare backticks, so template URL strings in `src/services/api.js` (`/users/${chatID}`) never get mistaken for keys.

**No `tsc`, lint, or test runner exists** — `npm run build` (vite) is the only build signal, and type errors don't fail it. In a session where the hooks aren't installed (e.g. raw `git`/`vim`), check locale parity by hand: every key must exist in all four of `en/ru/uk/pl.json`, and every literal `t('…')` key must exist in `en.json`. To re-measure the baseline: `node .claude/scripts/measure-baseline.mjs`.
