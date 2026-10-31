---
name: gymbrat-server-action
description: Use when adding or editing server actions (actions/*.ts), route handlers (app/api/**) or domain logic touching user data in GymBrat. Gives the mandatory guard/auth/validation/ownership/test checklist.
---

# GymBrat server action / route

Copy the pattern from a neighbouring file in `actions/` (e.g. `cardio.ts`) - do not invent a new one.

Checklist, in order:
1. `"use server"`; first line of every action: `await guardAction("plik.nazwa")` (`lib/action-guard.ts`, rate limits; stricter limit for AI/password/email/user search).
2. `auth()` -> reject without session; derive `userId` from session, never from input.
3. Validate input with zod at the boundary; reject unknown shapes.
4. Every query filters by `userId` (ownership). Admin paths: check role server-side.
5. Errors: throw `AppError(code)` (`lib/errors/app-error.ts`); log via `lib/errors/server-log.ts`; no body/health data in logs or Sentry.
6. DB: Drizzle only; avoid N+1 (batch/join); new filter/sort column -> index (see gymbrat-db-migration). Wrap multi-write in a transaction.
7. `revalidatePath/Tag` only for affected views.
8. New env var -> entry in `lib/admin-config-status.ts` + `env.example`.
9. Do not change `/api/android/*` or `java-backend/` contracts without user approval.
10. Test (Vitest, colocated `*.test.ts`, in-memory DB helper `db/test-memory-db.ts`): happy path, unauthorized, foreign-user data, invalid input. Bug fix = regression test first.
