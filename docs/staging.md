# Staging GymBrat (Faza 1)

Cel: środowisko `https://staging.<domena>` na VPS, **oddzielone** env/DB od produkcji Render.  
Render i APK **nie** przełączamy, dopóki ta checklista nie jest zielona i nie dasz GO-LIVE.

Powiązane: [`deployment.md`](deployment.md), [`rollback.md`](rollback.md), [`vps-docker-production.md`](vps-docker-production.md) §8.

---

## Przygotowanie

1. VPS + Docker + Cloudflare DNS tylko dla `staging.<domena>` ([`deployment-hetzner.md`](deployment-hetzner.md)).
2. Osobna baza Turso (nie ta sama co produkcja Render, jeśli testujesz destrukcyjne rzeczy).
3. `deploy/.env` z `GYMBRAT_DOMAIN=staging.…`, `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` = ten sam HTTPS origin.
4. Obraz z GHCR: `docker compose pull && up -d`.
5. OAuth: dodaj redirect URI staging w Google/Meta **obok** istniejących (Render) — nie usuwaj starych.

---

## Checklista Staging (GO staging)

- [ ] Brak ekranu Render wake-up na `https://staging.<domena>`
- [ ] HTTPS + redirect HTTP→HTTPS
- [ ] Login + sesja działają
- [ ] `GET /api/version` — provenance GymBrat (`app: gymbrat`, repo zaufane)
- [ ] Healthcheck kontenera `gymbrat-web` = healthy; przy zatrzymaniu procesu → unhealthy
- [ ] Cron cleanup: suchy test (logi `cron-service` pokazują HTTP 200/2xx z Bearer)
- [ ] Restart VPS / `docker compose up -d` — stack wraca (`restart: unless-stopped`)
- [ ] Backup config opisany (kopia `docker-compose.yml`, `Caddyfile`, zaszyfrowany `.env` poza VPS)
- [ ] Rollback raz przetestowany ([`rollback.md`](rollback.md))

Po zaznaczeniu wszystkich: **GO staging**. Cutover produkcji = osobna zgoda (nie automatyczna).

---

## Czego nie robić na stagingu

- Nie ustawiaj `API_BASE_URL` APK na staging dla wszystkich użytkowników.
- Nie wyłączaj Render.
- Nie kasuj OAuth redirect URI produkcji.
