# Deploy GymBrat na VPS (Docker + Caddy + GHCR)

Źródło prawdy faz: [`vps-docker-production.md`](vps-docker-production.md).  
Hardening Hetznera (poza repo): [`deployment-hetzner.md`](deployment-hetzner.md).  
Staging: [`staging.md`](staging.md). Rollback: [`rollback.md`](rollback.md).

**Render Free (`gymbrat.onrender.com`) zostaje primary** do czasu zielonego stagingu i osobnej zgody GO-LIVE. Ten dokument nie wyłącza Rendera.

---

## 1. Co jest w repo

| Ścieżka | Rola |
|---------|------|
| `Dockerfile` | Multi-stage Next.js `standalone`, non-root, health → `/api/version` |
| `deploy/docker-compose.yml` | `caddy`, `gymbrat-web`, `uptime-kuma`, `cron-service` |
| `deploy/Caddyfile` | HTTPS, headers, proxy → `gymbrat-web:3000` |
| `deploy/.env.example` | Szablon env na VPS (kopiuj do `.env`, nigdy do gita) |
| `.github/workflows/deploy-vps.yml` | Build → GHCR; opcjonalny SSH deploy |
| Root `docker-compose.yml` | **Tylko lokalny Java BFF** — nie na VPS Fazy 1 |

Obraz: `ghcr.io/damianchmielewski33-cmyk/gymbrat:latest` oraz `:sha-<7>` (tagi `v*` też).

---

## 2. Cloudflare (Free)

1. DNS `A staging.<domena>` → IP VPS, **Proxy on**.
2. SSL/TLS → **Full (strict)**.
3. Always Use HTTPS; HSTS dopiero gdy HTTPS stabilne.
4. Bot Fight Mode / domyślny WAF — włączone.
5. Rekord `@` / produkcja — **dopiero przy cutoverze**, nie teraz.

---

## 3. Przygotowanie VPS

1. Wykonaj hardening z [`deployment-hetzner.md`](deployment-hetzner.md) (§2–4).
2. Zainstaluj Docker Engine + Compose plugin.
3. Katalog deploy (przykład):

```bash
sudo mkdir -p /opt/gymbrat
sudo chown "$USER":"$USER" /opt/gymbrat
cd /opt/gymbrat
# skopiuj z repo: deploy/docker-compose.yml, deploy/Caddyfile
# albo: git clone … && ln -s repo/deploy/* .
```

4. Skopiuj `deploy/.env.example` → `.env`, uzupełnij (osobna baza Turso na **staging**).
5. Ustaw:

```env
GYMBRAT_DOMAIN=staging.twoja-domena.pl
NEXTAUTH_URL=https://staging.twoja-domena.pl
NEXT_PUBLIC_APP_URL=https://staging.twoja-domena.pl
GYMBRAT_IMAGE=ghcr.io/damianchmielewski33-cmyk/gymbrat:latest
```

6. Login do GHCR (raz, albo sekret `GHCR_READ_TOKEN` w Actions):

```bash
echo "<PAT_read:packages>" | docker login ghcr.io -u <github-user> --password-stdin
```

7. Start:

```bash
docker compose -f docker-compose.yml pull
docker compose up -d
docker compose ps
curl -fsS "https://staging.twoja-domena.pl/api/version"
```

---

## 4. GitHub Actions — sekrety

| Sekret | Wymagany do | Opis |
|--------|-------------|------|
| `GITHUB_TOKEN` | build/push | Domyślny; `packages: write` w workflow |
| `VPS_HOST` | deploy SSH | IP lub hostname VPS |
| `VPS_USER` | deploy SSH | np. `deploy` |
| `VPS_SSH_KEY` | deploy SSH | klucz prywatny |
| `VPS_DEPLOY_PATH` | deploy SSH | np. `/opt/gymbrat` |
| `GHCR_READ_TOKEN` | pull na VPS | PAT `read:packages` (opcjonalnie, jeśli brak lokalnego login) |

Bez `VPS_*` workflow **tylko buduje i pcha obraz** — bezpieczne przed pierwszym stagingiem.

Ręcznie: Actions → **Deploy VPS (Docker)** → Run workflow.

---

## 5. Single Source of Truth URL

Na VPS (staging/prod) te same wartości:

- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- OAuth redirect: `https://<domena>/api/auth/callback/google` (i Facebook)

**APK / `android/gradle.properties` / `lib/android-version.ts`:** nadal Render, aż GO-LIVE.

---

## 6. Cron

- Kontener `cron-service` woła `POST http://gymbrat-web:3000/api/cron/cleanup` z `Authorization: Bearer $CRON_SECRET` (domyślnie raz na dobę).
- Przypomnienia push: nadal [`.github/workflows/reminders-cron.yml`](../.github/workflows/reminders-cron.yml) — ustaw `REMINDERS_APP_URL` na staging **tylko jeśli** chcesz testować reminders tam; produkcja Render zostaje bez zmian, dopóki nie zmienisz sekretu świadomie.

---

## 7. Uptime Kuma

- UI: `http://<IP_VPS>:3001` (zalecane: tunel SSH albo osobny host za Cloudflare, nie wystawiaj 3001 publicznie na stałe bez auth).
- Monitory: homepage staging, `GET /api/version`, certyfikat SSL.
- Kuma na tym samym VPS **nie** wykryje padu całego serwera — dodaj zewnętrzny ping (Faza 1 uzupełnienie / Faza 2).

---

## 8. Changelog / Deploy Guardian

PR z tą infrastrukturą: wpis `planned: true` w `components/changelog/changelog-data.ts`.  
Po GO-LIVE produkcji: usuń `planned`, dodaj `date`.  
Przed merge: `npm run deploy:check`.

---

## 9. Czego nie robić w tym kroku

- Nie przełączaj DNS produkcji na VPS.
- Nie zmieniaj `API_BASE_URL` APK.
- Nie wyłączaj Render Free.
- Nie wdrażaj Fazy 2 (R2, Sentry prod, pełny DR) „przy okazji”.
