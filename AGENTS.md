<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# GymBrat — wdrożenia

- Źródło zmian produkcyjnych: wyłącznie `github.com/damianchmielewski33-cmyk/GymBrat`.
- Changelog (`components/changelog/changelog-data.ts`) musi jasno opisywać zmianę i mieć `sourceRepo` tego repo. Nie kopiuj opisów ani wersji z AWP.
- Przed merge / deploy: agent `.cursor/agents/deploy-guardian.md` albo `npm run deploy:check`.
- Publiczny kontrakt: `GET /api/version`.
