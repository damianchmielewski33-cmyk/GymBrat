# ADR 0013 — Hosting Faza 1: VPS + Docker + Cloudflare (bez cutoveru Render)

## Status
Accepted (implementacja w repo; cutover osobną decyzją)

## Kontekst
Render Free usypia usługę (~15 min) — zły primary dla WWW/APK. Plan faz w `docs/vps-docker-production.md`: Faza 1 = zawsze online na tanim VPS; Faza 2 = komercja (R2, Sentry, pełny DR).

## Decyzja
1. Obraz Next.js `output: "standalone"` → GHCR; na VPS Compose: Caddy + `gymbrat-web` + Uptime Kuma + cron cleanup.
2. Root `docker-compose.yml` zostaje tylko lokalnym Java BFF; produkcja = `deploy/docker-compose.yml`.
3. Render Free **pozostaje primary** (origin APK bez zmian) do zielonego stagingu + GO-LIVE.
4. Bez Javy, K8s, R2 i obowiązkowego Sentry w Fazie 1.

## Konsekwencje
- Krótki restart przy `compose up -d` (akceptowalne ~300 userów).
- Wymaga domeny (`GYMBRAT_DOMAIN`), sekretów VPS w Actions i osobnej bazy Turso na staging.
- Cutover DNS/APK i wyłączenie Render — poza tym ADR, checklista `docs/staging.md`.
