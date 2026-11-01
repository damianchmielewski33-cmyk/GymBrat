---
name: gymbrat-sensitive-data
description: Use when a GymBrat change touches body/health data (weight, measurements, body photos, meals, macros, cardio vitals), consents, analytics/Sentry events, account deletion/export, or legal text. Short RODO-oriented guardrails.
---

# Sensitive data guardrails

- Health/body data = special category (RODO art. 9): collect the minimum, only with explicit consent (`actions/consents.ts`, `components/consent`), never in URLs, logs, Sentry, PostHog or error messages.
- Server-only decryption/handling for encrypted fields (`lib/app-field-crypto.ts`); never send raw sensitive fields to third parties.
- New field/processing => must be covered by account export and purge (`lib/account-purge.ts`); add to the purge test.
- Third-party scripts/events (analytics, ads) must respect consent state.
- Legal text, new consent scope, retention periods: do NOT decide alone - draft in 3 lines, flag as "wymaga zatwierdzenia prawnika" and ask the user. Legal documents are drafts until a human lawyer approves.
- If unsure whether data is sensitive, treat it as sensitive.
