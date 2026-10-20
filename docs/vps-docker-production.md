# GymBrat — produkcja na VPS + Docker

Plan hostingu strony i originu APK. **Implementacja później** — ten dokument jest źródłem prawdy co do faz i architektury.

Powiązany agent Cursor: [`.cursor/agents/vps-docker-production.md`](../.cursor/agents/vps-docker-production.md).  
Reguły wdrożeń / changelog: [AGENTS.md](../AGENTS.md), Deploy Guardian.

---

## 0. Model fazowy (decyzja)

Nie budujemy od razu pełnego „Principal SaaS”. Robimy **fazy**:

| Faza | Kiedy | Cel |
|------|--------|-----|
| **Faza 1** | Przed / przy pierwszym stabilnym cutoverze z Rendera | Zawsze online, niski koszt, staging, CI/CD, rollback, hardening podstawowy |
| **Faza 2** | **Wdrożenie komercyjne** (płacący użytkownicy) | R2 na zdjęcia, Sentry włączone, DR, monitoring zasobów, logi, mocniejszy VPS |
| **Faza 3** | Wzrost do kilku tysięcy userów | Skalowanie wg metryk — bez Kubernetes na siłę |

**Werdykt:** pełna architektura komercyjna (Cloudflare R2, centralne logi, audyt 1–10, VPS 8 GB „na zapas”) jest **warta przy wdrożeniu komercyjnym (Faza 2)**, nie jako warunek pierwszego ucięcia snu Rendera.

---

## 1. Status obecny (stan wyjściowy)

| Element | Stan |
|--------|------|
| Kanoniczne repo | `https://github.com/damianchmielewski33-cmyk/GymBrat` |
| Host tymczasowy | `https://gymbrat.onrender.com/` (Render Free) |
| Host Vercel | `https://gym-brat.vercel.app/` — Hobby w pauzie (HTTP **402**) |
| APK / WebView | `android/gradle.properties` → `API_BASE_URL=https://gymbrat.onrender.com/` |
| Domyślny origin w kodzie | `lib/android-version.ts` — tymczasowo Render |
| Baza | Turso / libSQL; zdjęcia często jako bloby / data URL w DB (`body_report_photos` itd.) |
| Aplikacja | Next.js App Router; Java opcjonalnie później |
| Sentry | już w kodzie (`SENTRY_*` / `NEXT_PUBLIC_SENTRY_DSN` w `env.example`) — do **włączenia** w Fazie 2, nie do pisania od zera |

**Objaw:** Render Free usypia ~po 15 min bez ruchu → ekran *APPLICATION LOADING / SERVICE WAKING UP* zamiast GymBrat.

---

## 2. Cele

### Faza 1 (pierwszy stabilny hosting)
1. Własna domena HTTPS, brak snu, brak ekranu wake-up Render.
2. Jeden origin: WWW = APK (Single Source of Truth URL).
3. Staging → checklista → cutover za zgodą; changelog `planned` → potem `date`.
4. ~300 aktywnych użytkowników; koszt ~**5–15 €/mies.** (VPS) + Turso Free + Cloudflare Free.
5. Deploy bez ręcznego „pamiętaj SSH”: GHCR + GitHub Actions.
6. Rollback obrazu Docker &lt; ~2 minuty.
7. Bez Kubernetes; bez obowiązkowych płatnych usług poza VPS i domeną (Free tiers OK).

### Faza 2 (wdrożenie komercyjne)
1. Niezawodność i bezpieczeństwo pod płatności.
2. Zdjęcia / duże pliki poza Turso (**Cloudflare R2**).
3. Sentry (frontend, API, wskazówki pod WebView).
4. Pełny DR: odtworzenie produkcji na nowym VPS w możliwie krótkim czasie.
5. Monitoring uptime + CPU/RAM/dysk + alerty.
6. Przygotowanie pod wzrost (metryki, zapas RAM — często 8 GB).

### Faza 3 (skala)
- Więcej CPU/RAM, ewentualnie osobny worker, cache; decyzje wg realnego ruchu — nie K8s „na zapas”.

---

## 3. Architektura

### Faza 1 — docelowa na pierwszy cutover

```
Internet
   │
   ▼
Cloudflare (DNS proxy, SSL Full Strict, podstawowy WAF / bot — plan Free)
   │
   ▼
Hetzner VPS (≥4 GB RAM; 8 GB opcjonalnie jeśli budżet pozwala)
   │
   ▼
Caddy (HTTPS origin / Origin Cert, security headers, compress, reverse proxy)
   │
   ▼
Docker Compose
├── gymbrat-web      (Next.js, non-root, health → GET /api/version)
├── uptime-kuma      (homepage, /api/version, SSL; alerty Telegram/Discord/Email)
└── cron-service     (wołanie /api/cron/cleanup + CRON_SECRET)
        │
        ▼
Turso Cloud (Free na start; bez usuwania wsparcia Turso)
```

Uwagi Fazy 1:
- `docker compose pull && up -d` = krótki restart (sekundy), nie true zero-downtime — akceptowalne przy ~300 userach.
- Uptime Kuma na tym samym VPS **nie** wykryje śmierci całego VPS — warto jeden zewnętrzny ping (darmowy) jako uzupełnienie.
- Image: multi-stage, minimalny, non-root, tagi `gymbrat:vX.Y.Z` + `latest` w GHCR.

### Faza 2 — rozszerzenie przy komercji

```
… jak Faza 1 …
Docker Compose (+ opcjonalne narzędzia pomocnicze)
        │
        ├── Turso (dane relacyjne / małe rekordy)
        └── Cloudflare R2 (zdjęcia i duże pliki)
```

Dodatkowo w Fazie 2:
- Włączone Sentry (DSN produkcja + staging).
- Centralne logi: wybór jednej ścieżki (Better Stack / Logtail **albo** self-hosted) — nie trzy naraz.
- Runbooki: `docs/deployment.md`, `staging.md`, `security.md`, `monitoring.md`, `rollback.md`, `disaster-recovery.md` (tworzone przy implementacji Fazy 1–2; na razie plan w tym pliku).
- Hardening VPS dopięty checklistą (SSH keys only, Fail2Ban, UFW 22/80/443, unattended-upgrades).
- Backup **poza VPS**: `docker-compose.yml`, `Caddyfile`, `.env` (sekrety!), konfiguracja VPS; procedura restore na czystym Hetznerze.
- Audyt bezpieczeństwa repo (sekrety, env, endpointy) + raport ocen 1–10.

### Poza fazami (opcjonalnie kiedyś)
- Kontener `java-backend` + `JAVA_API_BASE_URL`
- Vercel Pro tylko Preview / awaria — nie primary produkcji

---

## 4. Porównanie opcji hostingu

| Opcja | ~koszt / mies. | Sen | Uwagi |
|-------|----------------|-----|--------|
| Render Free | 0 | tak | **odrzut** na produkcję / APK |
| Render paid | ~7–25 USD | nie | drożej niż VPS Fazy 1 |
| Vercel Hobby | 0 | n/d | 402; nie pod komercję |
| Vercel Pro | ~20–50 USD | nie | Preview OK; primary = VPS |
| **VPS + Docker + Cloudflare** | **~5–15 €** (+ domena) | **nie** | **wybór** |

---

## 5. Baza i storage

### Turso (zawsze wspierane)
Limity Free (weryfikować na [turso.tech/pricing](https://turso.tech/pricing)):
- 5 GB storage, 500M rows read / mies., 10M rows written / mies., PITR 1 dzień

Przy ~300 userach dane tekstowe zwykle OK. Wąskie gardło: **zdjęcia w DB**. Soft/hard: `TURSO_STORAGE_*` w `env.example`.

### Cloudflare R2 — Faza 2 (komercja)
- Schema już przewiduje ewolucję (`body_report_photos`: data URL → docelowo URL storage).
- Przy komercji: nowe uploady → R2; migracja istniejących blobów; Turso zostaje dla metadanych i reszty domeny.
- **Nie blokuje** Fazy 1: na Fazie 1 zostają limity storage + cleanup cron.

---

## 6. Zakres prac wg faz

### Faza 1 (implementacja „później”, przed cutoverem)

| # | Element |
|---|---------|
| 1 | Dockerfile multi-stage, non-root, healthcheck, `.dockerignore`, GHCR |
| 2 | `docker-compose.yml`: `gymbrat-web`, `caddy`, `uptime-kuma`, `cron-service`; `restart: unless-stopped`; sieci; `env_file` |
| 3 | Caddyfile: HTTPS, redirect, security headers, compress, proxy → web |
| 4 | Checklista Cloudflare Free: DNS proxy, Full Strict, HSTS, podstawowy WAF/bot, cache static, ukrycie IP |
| 5 | GitHub Actions: push → build → GHCR → deploy VPS → `compose pull && up -d` |
| 6 | Rollback: tagi semver; instrukcja cofnięcia o jedną wersję |
| 7 | Staging `staging.<domena>` odseparowany env/DB od produkcji |
| 8 | Cron: kontener lub systemd → `GET/POST /api/cron/cleanup` + `CRON_SECRET` |
| 9 | Hardening VPS (checklista); backup config poza VPS (minimum) |
| 10 | Single Source of Truth URL: `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `API_BASE_URL`, OAuth redirects |
| 11 | Dokumentacja runbooków (minimum: deployment, staging, rollback, disaster-recovery) |

### Faza 2 (przy wdrożeniu komercyjnym)

| # | Element |
|---|---------|
| 1 | Cloudflare R2 + migracja zdjęć z Turso |
| 2 | Włączenie Sentry (prod + staging); release / environment |
| 3 | Monitoring CPU/RAM/dysk (progi 80%) + alerty; uzupełnienie Kuma o zewnętrzny ping |
| 4 | Centralne logowanie (jedna wybrana usługa) |
| 5 | Pełny DR + ćwiczenie odtworzenia na nowym VPS |
| 6 | `docs/security.md`, `docs/monitoring.md` + audyt końcowy (oceny 1–10, słabe punkty) |
| 7 | VPS 8 GB jeśli metryki / budżet; Rate Limiting Cloudflare wg limitu planu Free/Pro |

### Faza 3
- Skalowanie horyzontalne / większy VPS / cache — wg ruchu; bez K8s domyślnie.

---

## 7. Kolejność Fazy 1 (obowiązkowa — nie skracać)

1. Akceptacja tego dokumentu (fazy + architektura).  
2. *(później)* Pliki Docker/Caddy/Actions w repo.  
3. VPS + Cloudflare DNS (staging).  
4. Staging → checklista §8 → **GO staging**.  
5. Zgoda na cutover → produkcja DNS + env + OAuth.  
6. APK: ten sam origin; rebuild.  
7. Changelog: `planned: true` → po go-live `date`.  
8. Deploy Guardian / `npm run deploy:check`.  
9. Wyłączenie Render Free jako produkcji.

**Zakaz:** cutover APK bez GO staging i bez wyraźnej zgody.

---

## 8. Checklisty

### Staging (Faza 1)
- [ ] Brak ekranu Render wake-up  
- [ ] HTTPS + redirect  
- [ ] Login + sesja  
- [ ] `GET /api/version` (provenance GymBrat)  
- [ ] Healthcheck kontenera (unhealthy przy padnięciu `/api/version`)  
- [ ] Cron cleanup na staging (suchy test)  
- [ ] `compose up -d` po restarcie wraca samo  
- [ ] Backup config opisany  

### GO-LIVE produkcja (Faza 1)
- [ ] DNS / Cloudflare proxy  
- [ ] SSL Full Strict  
- [ ] OAuth redirect URI  
- [ ] Turso connectivity  
- [ ] SMTP (jeśli rejestracja mailowa)  
- [ ] Login + sesje  
- [ ] API + `/api/version`  
- [ ] APK = ten sam origin  
- [ ] Cron produkcyjny  
- [ ] Rollback przetestowany raz na stagingu  
- [ ] Render Free wyłączony jako produkcja  

### GO-LIVE komercyjny (Faza 2) — dodatkowe
- [ ] R2 + ścieżka uploadu zdjęć poza Turso (lub migracja w toku z jasnym planem)  
- [ ] Sentry zbiera błędy prod  
- [ ] Alerty uptime + zasoby  
- [ ] DR: dokument + przynajmniej jeden dry-run restore config  
- [ ] Audyt security (sekrety, env, niebezpieczne endpointy)  

---

## 9. Env — Single Source of Truth URL

Wzorzec: [`env.example`](../env.example).

**Wymagane (prod):** `TURSO_*`, `AUTH_SECRET`, `NEXTAUTH_URL` (= publiczny HTTPS origin).  
**Zalecane:** `NEXT_PUBLIC_APP_URL` (ten sam origin), `ADMIN_*`, `APP_ENCRYPTION_KEY`, OAuth, SMTP, `CRON_SECRET`.  
**Faza 2:** `SENTRY_*` / `NEXT_PUBLIC_SENTRY_*`, credentials R2.  
**Android:** `API_BASE_URL` + secret CI `ANDROID_API_BASE_URL` — **ten sam origin** co WWW.

---

## 10. Cutover i rollback (skrót)

**Cutover Fazy 1:** staging zielony → DNS/Cloudflare → OAuth → smoke → APK → changelog → monitor 24–48 h → wyłącz Render.

**Rollback aplikacji:** poprzedni tag GHCR → zmiana tagu w compose / env deploy → `pull && up -d` (&lt; ~2 min).  
**Rollback DNS:** tylko jeśli stary host żyje i APK nie został wymuszony u wszystkich — dlatego cutover po stagingu.

---

## 11. Ryzyka

| Ryzyko | Faza | Mitigacja |
|--------|------|-----------|
| Sen Render | teraz | Cutover Fazy 1 |
| Zły origin APK | 1 | SSoT URL; cutover po staging |
| Zdjęcia wypełniają Turso | 1→2 | Limity + cleanup; R2 w Fazie 2 |
| Kuma na tym samym VPS | 1 | Zewnętrzny ping |
| Obietnica zero-downtime | 1 | Akceptacja krótkiego restartu |
| Scope creep „pełny Principal naraz” | — | Trzymać się faz; komercja = Faza 2 |
| Wyciek `.env` | 1–2 | Nigdy w git; backup szyfrowany poza VPS |

---

## 12. Decyzje właściciela

| # | Decyzja | Propozycja | Status |
|---|---------|------------|--------|
| D1 | Primary hosting | VPS + Docker + Cloudflare | ☐ |
| D2 | Fazy | Faza 1 najpierw; Faza 2 przy komercji | ☐ **ustalone w rozmowie — potwierdź** |
| D3 | VPS | Hetzner ≥4 GB (8 GB przy komercji / zapasie) | ☐ |
| D4 | Baza Faza 1 | Turso Free | ☐ |
| D5 | Storage zdjęć | Turso + limity → **R2 w Fazie 2** | ☐ |
| D6 | Proxy | Caddy | ☐ |
| D7 | Java na start | Nie | ☐ |
| D8 | Domena prod | `https://________/` | ☐ |
| D9 | Staging | `staging.<domena>` osobny env | ☐ |
| D10 | CI/CD | GHCR + Actions (Faza 1) | ☐ |

---

## 13. Poza zakresem

- Kubernetes / multi-region na start  
- Postgres zamiast Turso (chyba że osobna decyzja)  
- Vercel Hobby jako produkcja  
- Kopiowanie changelogu / wersji z AWP  
- Implementacja w tym PR — **tylko dokumentacja; wdrożenie później**

---

## 14. Dokumentacja do wygenerowania przy implementacji

| Plik | Faza | Treść |
|------|------|--------|
| `docs/deployment.md` | 1 | Deploy Compose / Actions / Cloudflare |
| `docs/staging.md` | 1 | Staging + checklista |
| `docs/rollback.md` | 1 | Tagi image, cofnięcie &lt;2 min |
| `docs/disaster-recovery.md` | 1 (szkic) / 2 (pełny) | Restore na nowym VPS |
| `docs/security.md` | 2 | Hardening, Cloudflare, sekrety |
| `docs/monitoring.md` | 2 | Kuma, zasoby, Sentry, logi |

Ten plik (`vps-docker-production.md`) pozostaje **mapą faz i decyzji**.

---

## 15. Kryteria akceptacji dokumentu

1. Model fazowy (§0) zaakceptowany — komercyjny „Principal” = Faza 2, nie warunek Fazy 1.  
2. Architektura Fazy 1 (§3) zaakceptowana.  
3. Domena (D8) uzupełniona przed startem implementacji.  
4. Wdrożenie techniczne **nie** jest wymagane do akceptacji dokumentu — robimy je później.

---

## 16. Historia

| Data | Opis |
|------|------|
| 2026-10-20 | Pierwsza wersja — plan migracji Render → VPS |
| 2026-10-20 | Fazy 1/2/3; Cloudflare + Compose + Kuma + cron; R2/Sentry/DR przy komercji; wdrożenie odłożone |
