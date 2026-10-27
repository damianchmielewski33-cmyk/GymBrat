# Rollback obrazu Docker (Faza 1)

Cel: cofnięcie aplikacji na VPS do poprzedniego tagu GHCR w **&lt; ~2 minuty**.  
Nie dotyczy cutoveru DNS / APK — te cofasz tylko gdy stary host (Render) nadal żyje.

---

## Tagi

Po każdym udanym buildzie Actions publikuje m.in.:

- `ghcr.io/damianchmielewski33-cmyk/gymbrat:sha-<7>`
- `ghcr.io/damianchmielewski33-cmyk/gymbrat:latest`
- przy tagu gita `vX.Y.Z` → `:vX.Y.Z`

Zapisz ostatni znany dobry `sha-…` przed ryzykownym deployem (Uptime Kuma / notatka).

---

## Procedura (SSH na VPS)

```bash
cd /opt/gymbrat   # lub VPS_DEPLOY_PATH

# 1. Ustaw poprzedni obraz
export PREV="ghcr.io/damianchmielewski33-cmyk/gymbrat:sha-ABCD123"
sed -i "s|^GYMBRAT_IMAGE=.*|GYMBRAT_IMAGE=${PREV}|" .env

# 2. Pull + restart (krótka przerwa — nie true zero-downtime)
docker compose pull gymbrat-web
docker compose up -d gymbrat-web

# 3. Smoke
curl -fsS "https://staging.<domena>/api/version"
docker compose ps
```

Czas: zwykle poniżej 2 minut przy ciepłym cache warstw.

---

## Gdy Compose nie wstaje

```bash
docker compose logs --tail=100 gymbrat-web caddy
docker compose up -d
```

Sprawdź `.env` (`NEXTAUTH_URL`, Turso, `AUTH_SECRET`).

---

## Rollback DNS / APK

- **DNS:** tylko jeśli Render (lub inny stary origin) nadal działa.
- **APK:** nie wymuszaj nowego originu u wszystkich przed GO staging — dlatego cutover APK jest na końcu ([`vps-docker-production.md`](vps-docker-production.md) §10).
