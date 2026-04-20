## GymBrat

GymBrat is a premium “fitness OS” built with the Next.js App Router: log training, track weekly cardio, pull daily macros via a Fitatu-compatible integration, and generate AI-assisted coaching outputs (training plan, photo analysis, progress comparisons) with safe fallbacks when AI is not configured.

### Technologies used

- **Next.js (App Router + RSC)**: server components, route handlers, caching/revalidation
- **React 19**
- **Tailwind CSS v4**
- **Drizzle ORM + Drizzle Kit**: schema-first SQLite/libSQL migrations
- **Turso (libSQL) + `@libsql/client`**: edge-friendly SQLite over the network
- **NextAuth (Credentials provider)**: JWT sessions
- **PWA**: Web App Manifest + statyczne pliki service workera w `public/` (bez Webpacka; build na Turbopack)
- **AI (scaffolded)**: provider wiring placeholder + structured prompts + schema validation (Zod)

> Note: the repository currently pins `next@16.2.2` in `package.json`. The architecture and docs below apply to Next.js App Router / RSC regardless of minor version.

### Fitatu integration (how it works)

Fitatu does not ship a public REST API for third-party apps. GymBrat therefore supports a **Fitatu-compatible proxy/partner endpoint** and/or a **per-user bearer token** stored in the database.

- **Where it lives**
  - **Server integration**: `services/fitatu.ts`
  - **Types (normalized)**: `types/fitatu.ts`
  - **Revalidation hook**: `actions/fitatu.ts`
  - **Token storage**: `db/schema.ts` (`users.fitatuAccessToken`)

- **Expected contract (example)**
  - **GET** `/v1/diary/{YYYY-MM-DD}`
  - **Auth**: `Authorization: Bearer <token>`
  - **Returns JSON**:

```json
{
  "calories": 1840,
  "proteinG": 142,
  "fatG": 58,
  "carbsG": 198,
  "meals": [
    {
      "id": "1",
      "name": "Oats & berries",
      "calories": 420,
      "proteinG": 18,
      "fatG": 12,
      "carbsG": 58,
      "loggedAt": "2026-04-07T08:15:00.000Z"
    }
  ]
}
```

- **Behavior**
  - If `FITATU_API_BASE_URL` and a token (per-user or `FITATU_API_KEY`) are set, GymBrat fetches live data.
  - Otherwise, it returns **mock data** for development so the UI stays usable.
  - Responses are cached via `unstable_cache()` with a tag (`fitatuTag(userId)`) and can be refreshed via `refreshFitatuMacros()`.

### Installation guide

#### Prerequisites

- **Node.js**: 20+ recommended
- **Package manager**: npm (or your preferred equivalent)
- **Turso CLI** (recommended for provisioning): see Turso docs

#### Install dependencies

```bash
npm install
```

#### Configure environment variables

Copy `env.example` to `.env.local` and fill values:

```bash
copy env.example .env.local
```

### Turso database setup (libSQL)

GymBrat uses Turso/libSQL via `TURSO_DATABASE_URL` (and optional `TURSO_AUTH_TOKEN`).

- **Local dev (SQLite file)**
  - Set:
    - `TURSO_DATABASE_URL=file:./local.db`
    - `TURSO_AUTH_TOKEN=` (empty)

- **Turso (cloud)**
  - Create a database in Turso and set:
    - `TURSO_DATABASE_URL=libsql://<db-name>-<org>.turso.io`
    - `TURSO_AUTH_TOKEN=<token>`

### Drizzle migrations

Drizzle config: `drizzle.config.ts` (schema: `db/schema.ts`, output: `db/migrations`, dialect: `sqlite`).

- **Generate migrations**

```bash
npm run db:generate
```

- **Apply migrations (push)**

```bash
npm run db:push
```

- **Open Drizzle Studio**

```bash
npm run db:studio
```

### Development environment setup

- **Run the app**

```bash
npm run dev
```

- **Lint**

```bash
npm run lint
```

### Folder structure (high level)

```
app/                         Next.js App Router (RSC)
  (auth)/                    Auth pages/layouts
  (dashboard)/               Protected app shell + pages
  api/                       Route handlers (NextAuth + workout completion)
actions/                     Server Actions (login, profile, workouts, Fitatu refresh, AI)
ai/                          AI coach orchestration + prompts + provider client scaffold
db/                          Drizzle schema + DB client + migrations output
components/                  UI components (home, profile, layout, etc.)
services/                    External integrations (Fitatu)
lib/                         Shared logic (cardio calc, reports, validation, stores, utils)
public/                      Static assets (manifest, icons, PWA output)
```

### Authentication flow

GymBrat uses **NextAuth v5 (beta)** with a **Credentials provider** and **JWT sessions**.

- **Login**
  - UI submits credentials → `signIn("credentials", { redirect: false })` (see `actions/backend.ts`)
  - Provider validates email/password against `users` in SQLite/libSQL (see `auth.ts`)
  - Password verification uses `bcryptjs` (`users.passwordHash`)

- **Registration**
  - `registerUser()` (see `actions/auth.ts`) validates input (Zod) and stores:
    - user row in `users`
    - default settings row in `user_settings` (weekly cardio goal default: 150 min)

- **Route protection**
  - `proxy.ts` (Next.js „proxy”, dawniej `middleware`) blokuje trasy spoza listy publicznej, dopóki nie ma ważnego tokenu.
  - Public paths: `/login`, `/register`
  - Auth routes under `/api/auth/*` are excluded from protection.

### AI Coach documentation

AI features are designed to be safe-by-default: if no provider key is present, GymBrat returns **heuristic** outputs (or a friendly “AI not configured” response) instead of failing.

- **Where it lives**
  - Orchestrator: `ai/coach.ts`
  - Provider scaffold: `ai/client.ts`
  - Prompts: `ai/prompts/*`

- **Capabilities**
  - **Training plan generation**: `generateTrainingPlan(input)`
    - Uses Fitatu snapshot (if available) to tailor nutrition hints
    - Validates model output with a strict Zod schema; falls back to a heuristic plan on parse failure
  - **Body photo analysis**: `analyzeBodyPhoto({ images })`
    - Requires `AI_API_KEY` and a real `completeVision()` implementation
  - **Progress photo comparison**: `compareProgressPhotos({ earlier, later })`
  - **Chat coach**: `chatCoach({ messages, context })`

- **Config**
  - `AI_API_KEY`: enable provider calls (currently scaffolded)
  - `AI_MODEL`: optional provider-specific model identifier

### Weekly cardio tracking logic

GymBrat tracks weekly cardio as a **rolling 7-day sum**:

- **Source of truth**
  - Current table: `workouts` (stores `date` as local `YYYY-MM-DD` + `cardioMinutes`)
  - Legacy compatibility: also includes `training_sessions.cardioMinutes` in the same window

- **Computation**
  - Implemented in `lib/cardio.ts` as `getWeeklyCardioProgress(userId)`
  - Returns:
    - `weeklyGoal` (from `user_settings.weeklyCardioGoalMinutes`, default 150)
    - `minutesCompleted` (workouts + legacy sessions)
    - `percent` (capped at 100)

- **Logging cardio**
  - Server action: `actions/workout.ts` (`logTrainingSession()` / `logCardioFormAction()`)
  - API route (completed workout payload): `app/api/workouts/complete/route.ts`

### Deployment guide (Vercel + Edge-friendly setup)

GymBrat is designed to run well on Vercel with Turso/libSQL.

- **Environment variables (Vercel Project Settings → Environment Variables)**
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
  - `AUTH_SECRET`
  - `NEXTAUTH_URL` (set to your production URL)
  - Email verification (registration code):
    - `RESEND_API_KEY`
    - `EMAIL_FROM`
    - `EMAIL_REPLY_TO` (optional)
    - `EMAIL_CODE_SECRET` (recommended; can reuse `AUTH_SECRET` but better separate)
  - Optional:
    - `FITATU_API_BASE_URL`
    - `FITATU_API_KEY` (or store per-user token in DB)
    - `AI_API_KEY`
    - `AI_MODEL`

- **Build & runtime notes**
  - Proxy (edge) i dostęp sieciowy do libSQL są zgodne z wdrożeniami w stylu edge.
  - Ensure your Turso database is reachable from Vercel regions you deploy to.

### PWA configuration

GymBrat uses a **Web App Manifest** (`public/manifest.webmanifest`) and **committed static** service worker assets (`public/sw.js`, Workbox chunk) so the stack stays **Turbopack-only** (no `@ducanh2912/next-pwa` / Webpack plugin).

- **Dev vs prod**
  - Service worker files in `public/` are not regenerated on each build; update them manually if you change caching strategy, or add a Turbopack-compatible tooling step separately.
