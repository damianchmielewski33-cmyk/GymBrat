<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GymBrat — wdrożenia

- Źródło zmian produkcyjnych: wyłącznie `github.com/damianchmielewski33-cmyk/GymBrat`.
- Flow: **PR / Preview (zapowiedź)** → zatwierdzenie → **Promote na produkcję**. Nie ogłaszaj produkcji z samego pusha bez Preview.
- Changelog (`components/changelog/changelog-data.ts`): na PR `planned: true`; po Promote data + bez `planned`. `sourceRepo` tylko tego repo. Nie kopiuj opisów ani wersji z AWP.
- Przed merge / deploy: agent `.cursor/agents/deploy-guardian.md` albo `npm run deploy:check`.
- Publiczny kontrakt: `GET /api/version` (produkcja = tylko wdrożone; Preview może mieć `plannedChangelog`).
