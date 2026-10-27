# Disaster recovery — szkic (Faza 1)

Pełne ćwiczenie restore + metryki czasu = **Faza 2** (wdrożenie komercyjne).  
Ten plik opisuje minimum, żeby odtworzyć staging/produkcję na nowym Hetznerze bez paniki.

Źródło faz: [`vps-docker-production.md`](vps-docker-production.md). Deploy: [`deployment.md`](deployment.md).

---

## Co trzymać poza VPS (backup config)

| Artefakt | Gdzie | Uwagi |
|----------|--------|--------|
| `deploy/docker-compose.yml`, `Caddyfile` | git (to repo) | zawsze aktualne w GymBrat |
| `.env` (sekrety!) | szyfrowany backup poza VPS | **nigdy** w git |
| Lista DNS Cloudflare | panel CF / notatka | staging vs prod |
| Tag obrazu „last known good” | notatka / Kuma | `sha-…` |
| Turso | Turso Cloud | baza nie jest na dysku VPS |

---

## Odtworzenie na czystym VPS (runbook skrót)

1. Nowy serwer Hetzner (Ubuntu 24.04), klucz SSH, hardening ([`deployment-hetzner.md`](deployment-hetzner.md)).
2. Docker + Compose.
3. Skopiuj `deploy/*` z repo + przywróć `.env` z bezpiecznego backupu.
4. `docker login ghcr.io` → `docker compose pull && up -d`.
5. Cloudflare: wskaż `A` staging (lub prod) na **nowe** IP; SSL Full Strict.
6. Smoke: HTTPS, login, `GET /api/version`, healthcheck.
7. Zaktualizuj sekrety Actions `VPS_HOST` (i ewentualnie IP w firewallu).

Turso nie wymaga migracji plików z dysku VPS — tokeny w `.env` wystarczą.

---

## RTO / RPO (Faza 1 — oczekiwania)

- **RPO (dane aplikacji):** zależy od Turso (cloud); lokalny VPS nie trzyma primary DB.
- **RTO (WWW):** rząd godzin przy ręcznym restore config + DNS (cel Fazy 2: ćwiczenie dry-run i skrócenie).
- **APK:** origin zmieniaj dopiero po stabilnym DNS — inaczej utrudniasz rollback.

---

## Faza 2 (przypomnienie)

- Ćwiczenie dry-run na nowym VPS z pomiarem czasu.
- Centralne logi, Sentry, monitoring zasobów.
- [`docs/security.md`](security.md) / [`docs/monitoring.md`](monitoring.md) — tworzone przy komercji.
