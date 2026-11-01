---
name: gymbrat-ui
description: Use when creating or changing any GymBrat screen or component (app/, components/). Enforces the dark "black iron & gold" design system, reuse of components/ui, Polish copy, mobile-first PWA layout, states and accessibility. Pairs with the frontend-design skill for new screens.
---

# GymBrat UI

1. Reuse first: `Grep` `components/ui/*` (button, card, input, sheet, tabs, inline-banner, app-empty-state, confirm-dialog, section-label, animated-metric) and sibling feature folders before creating anything. One component = one place.
2. Tokens only: colors, fonts (`font-heading`, `font-display`, `font-metric`) and radii come from `app/globals.css` variables / Tailwind classes. No hardcoded hex (known debt - do not add more). Dark theme only.
3. Server Component by default; `"use client"` only for state/effects/browser APIs, as low in the tree as possible. Forms: react-hook-form + zod resolver, submit via server action.
4. Every data view has loading, empty (`app-empty-state`), and error (`inline-banner`) states.
5. Mobile-first (PWA/WebView): 44px touch targets, safe-area padding, no hover-only actions, no layout shift.
6. A11y: labelled inputs, visible focus, `aria-live` for async results, contrast >= 4.5:1, icon-only buttons need `aria-label`.
7. Copy in Polish, consistent with neighbouring screens (imperative short verbs on buttons, no English leftovers).
8. Motion: framer-motion sparingly, respect `prefers-reduced-motion`.
9. Check only the changed screen (webapp-testing skill if a browser check is really needed).
