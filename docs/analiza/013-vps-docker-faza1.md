# Analiza 013 — VPS Docker Faza 1 (kod w repo, Render zostaje)

## Cel
Dostarczyć infrastrukturę Fazy 1 w repozytorium GymBrat, żeby można było postawić staging na Hetznerze równolegle do Render Free, bez wyłączania obecnego hostingu i bez zmiany originu APK.

## Zakres NOW
- Dockerfile, `.dockerignore`, `output: "standalone"`
- `deploy/docker-compose.yml`, `Caddyfile`, `.env.example`
- Workflow GHCR + opcjonalny SSH deploy
- Runbooki: deployment, staging, rollback, szkic DR
- Changelog `planned: true`

## Poza zakresem
- Cutover DNS produkcji, zmiana APK origin, wyłączenie Render
- Faza 2 (R2, Sentry prod, pełny monitoring/DR)
- Provisioning konta Hetzner z sesji agenta

## Bramki
| Bramka | Decyzja | Uzasadnienie |
|--------|---------|--------------|
| prawnik | pomiń | Brak zmiany przetwarzania danych / zgód; ten sam model Turso |
| ux | pomiń | Brak UI |
| architekt | ADR 0013 | Hosting / Compose / SSoT URL |
| tester-bezpieczeństwa | po implementacji jeśli auth/env | Sekrety compose, niepubliczne `.env` |
| tester-wydajności | pomiń | Brak nowych zapytań domenowych |

## Kryteria akceptacji
1. Obraz buduje się z Dockerfile; healthcheck na `/api/version`.
2. Compose w `deploy/` nie zastępuje lokalnego Java compose.
3. Dokumentacja mówi wprost: Render primary do GO-LIVE.
4. Brak zmiany `API_BASE_URL` / `DEFAULT_SITE_ORIGIN`.
5. Changelog planned; `deploy:check` przechodzi.
