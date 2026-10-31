---
name: gymbrat-ship
description: Use when finishing a GymBrat change - verification, changelog entry, branch/PR and deploy check. Keeps the release flow cheap and consistent with AGENTS.md.
---

# Ship checklist

1. Verify (cheapest first): `npx vitest run <changed paths>` -> `npx tsc --noEmit` -> `npm run lint` (fix only errors in changed files; baseline has old errors) -> full `npm test` once.
2. Changelog: `components/changelog/changelog-data.ts` entry with `planned: true` for a PR (date and no `planned` only after Promote). `sourceRepo` = this repo only; do not copy text from other projects.
3. Env-dependent feature: `lib/admin-config-status.ts` + `env.example`.
4. `npm run deploy:check` before merge.
5. Work on a branch via PR; never push to production branch or commit unless the user asked. Production = only after Preview approval + Promote.
6. Final report to the user: max 5 lines (what, files, test result, risks).
