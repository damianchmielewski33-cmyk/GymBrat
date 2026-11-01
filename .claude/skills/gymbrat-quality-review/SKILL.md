---
name: gymbrat-quality-review
description: Use to audit and improve code quality and UX of a GymBrat screen or module after implementation, or when asked to "popraw jakość / UX / przejrzyj". Reviews only the changed files or the named screen, fixes findings directly, reports briefly.
---

# Quality + UX review (changed scope only)

Scope: `git diff --name-only` or the named screen/module. Never audit the whole repo.

## Code
- Duplicates: Grep for an existing helper/component before keeping a new one; merge into the existing place.
- Dead/empty code, unused exports, stale TODOs, `any`, swallowed errors, commented-out blocks -> remove or type properly.
- Functions >50 lines or components >200 lines -> split only if it removes real complexity.
- Server/client boundary: no needless `"use client"`, no secrets or server-only imports in client files.
- Data: no N+1 or fetch waterfalls (parallelize with `Promise.all`), no unbounded lists (paginate/limit), memoize only measured hot spots.
- Naming and comments match the surrounding files (Polish UI text, existing code conventions).

## UX
- Primary action obvious in 1 glance; one primary button per view; destructive actions confirmed (`confirm-dialog`).
- Feedback for every async action (pending state, success, readable Polish error with a next step); no silent failures.
- Empty states say what to do next; forms keep input on error, validate inline, correct `inputMode`/`autoComplete`.
- Thumb-reachable controls, 44px targets, no horizontal scroll at 360px, safe-area insets.
- Keyboard/focus order, labels, contrast, `prefers-reduced-motion`.
- Consistency: same spacing, radius, type scale and wording as sibling screens (tokens in `app/globals.css`).

## Output
Fix findings directly (smallest change), then run `npx tsc --noEmit` and tests for touched files. Report max 5 lines: fixed, left-as-is with reason, risks. Out-of-scope issues: one row each in `docs/bledy-do-naprawy/bledy.md`, do not fix.
