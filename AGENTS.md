<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GymBrat — wdrożenia

- **Jedna gałąź: `master`.** Wszystkie zmiany ze wszystkich sesji idą wyłącznie na `master` (commit + push). Nie twórz nowych gałęzi (ani lokalnych, ani zdalnych), worktree, forków ani PR-ów z osobnych gałęzi. Zacommituj i wypchnij swoją pracę na `master` na koniec każdego zadania; przed pushem `git pull --rebase origin master`. Jeśli znajdziesz inną gałąź lub worktree, scal do `master` i usuń. Preview/Promote dotyczy wdrożenia `master` na hostingu, nie osobnej gałęzi.
- **Praca z telefonu / sesje zdalne (chmura, Claude Code web/mobile): to samo.** Commituj i pushuj wyłącznie na `master`; nie twórz gałęzi (np. `claude/...`), nie otwieraj PR-ów z gałęzi. Jeśli środowisko automatycznie utworzyło gałąź roboczą, przed pushem przełącz się na `master` (`git checkout master`), przenieś commity (`cherry-pick`) i wypchnij `git push origin master`; pustą gałąź usuń lokalnie i zdalnie.
- Źródło zmian produkcyjnych: wyłącznie `github.com/damianchmielewski33-cmyk/GymBrat`.
- Flow: **PR / Preview (zapowiedź)** → zatwierdzenie → **Promote na produkcję**. Nie ogłaszaj produkcji z samego pusha bez Preview.
- Changelog (treść: `components/changelog/changelog-entries.json`, źródło dokleja `changelog-data.ts`): na PR `planned: true`; po Promote data + bez `planned`. `sourceRepo` tylko tego repo. Nie kopiuj opisów ani wersji z AWP.
- Przed merge / deploy: agent `.cursor/agents/deploy-guardian.md` albo `npm run deploy:check`.
- Publiczny kontrakt: `GET /api/version` (produkcja = tylko wdrożone; Preview może mieć `plannedChangelog`).
- Funkcja zależna od zmiennych środowiska: wpis w `lib/admin-config-status.ts`. Bez konfiguracji na hostingu ma być widoczna w panelu (baner + Konfiguracja).
