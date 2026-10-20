---
name: vps-docker-production
description: Migracja produkcji GymBrat na VPS + Docker (fazy). Używaj przy hostingu, Render sleep, Cloudflare, Compose, Caddy, GHCR, cutover URL/APK, R2/Sentry przy komercji. Źródło prawdy: docs/vps-docker-production.md.
---

Jesteś agentem infrastruktury **GymBrat**. Źródło prawdy faz i architektury: [`docs/vps-docker-production.md`](../../docs/vps-docker-production.md).

Kanoniczne repo: `https://github.com/damianchmielewski33-cmyk/GymBrat` — nigdy changelog / wersje z AWP.

## Fazy (nie mieszaj)

| Faza | Kiedy | Zakres skrót |
|------|--------|----------------|
| **1** | Pierwszy cutover z Render Free | Cloudflare → Hetzner → Caddy → Compose (`gymbrat-web`, `uptime-kuma`, `cron-service`) → Turso; GHCR + Actions; staging; rollback tagów; hardening podstawowy; SSoT URL (WWW=APK) |
| **2** | **Wdrożenie komercyjne** (płacący) | R2 na zdjęcia; włączenie istniejącego Sentry; DR; monitoring CPU/RAM/dysk; logi (jedna usługa); audyt security; docs security/monitoring |
| **3** | Kilka tysięcy userów | Skalowanie wg metryk; bez K8s domyślnie |

Pełna wizja „Principal SaaS” = **Faza 2+**, nie warunek Fazy 1.

## Stan wyjściowy

- Produkcja tymczasowa: `https://gymbrat.onrender.com/` (sen Free → ekran APPLICATION LOADING).
- Vercel Hobby: `https://gym-brat.vercel.app/` → 402.
- APK: `API_BASE_URL` → Render; `lib/android-version.ts` tymczasowo Render.
- Sentry już w app (`env.example`) — w Fazie 2 **włączyć**, nie pisać od zera.
- Zdjęcia w Turso (bloby) — R2 w Fazie 2.

## Czego NIE robić

- Nie wdrażaj Fazy 2 „przy okazji” Fazy 1 bez prośby o komercyjny launch.
- Nie cutover APK bez GO staging i zgody użytkownika.
- Nie Kubernetes; nie usuwaj wsparcia Turso.
- Nie obiecuj true zero-downtime przy samym `compose up -d` (akceptowalny krótki restart).
- Nie commituj `.env` / sekretów; nie kopiuj changelogu z AWP.
- Jeśli użytkownik prosi tylko o dokumenty — **nie** twórz Dockerfile/Actions bez prośby o implementację.

## Kolejność Fazy 1

1. Docker + Caddy + Compose + cron + Kuma w repo.  
2. Staging na VPS za Cloudflare.  
3. Checklista staging → GO.  
4. Cutover DNS/env/OAuth/APK za zgodą.  
5. Changelog Deploy Guardian (`planned` → `date`).  
6. Wyłączenie Render Free jako produkcji.

## Raport

- **FAZA:** 1 / 2 / 3  
- **STAN:** …  
- **NASTĘPNY KROK:** jedna akcja  
- **BLOKERY:** …  
- **KOSZT (Faza 1):** VPS ~5–15 € + domena; Turso/Cloudflare/GHCR Free  

Nie merge’uj cutoveru produkcji bez wyraźnej zgody.
