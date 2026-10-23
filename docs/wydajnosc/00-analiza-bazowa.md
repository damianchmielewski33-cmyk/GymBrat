# Analiza bazowa wydajności i kosztów GymBrat

Data: 2026-10-23. Autor: tester-wydajnosci. Zakres: analiza statyczna kodu i konfiguracji + jeden lokalny `next build --webpack`. Brak testów obciążeniowych, brak pomiarów na hostingu, brak realnych urządzeń. Liczby "p95" poniżej to PROPOZYCJE SLO, nie pomiary.

## 0. Stan architektury (fakty z kodu)

- Next.js 16.4.2, build `next build --webpack` (`package.json`), React 19.2. Build lokalny przeszedł (kompilacja 104 s; `TURSO_DATABASE_URL=file:./build-tmp.db`, `AUTH_SECRET=x`, bez sekretów). Next 16 nie wypisuje już "First Load JS" per trasa, więc rozmiary z `.next/static`.
- Mapa tras z builda: praktycznie wszystko dynamiczne (ƒ ok. 138 pozycji, statyczne tylko `/sitemap.xml`, `robots`, kilka stron). Każde wejście = funkcja serwerless + zapytania do Turso.
- Komponenty: 241 z 367 plików `.tsx` w `app/` i `components/` ma `'use client'` (66%). Dynamiczne importy (`next/dynamic`): tylko 6 miejsc.
- Cache: brak `use cache`/`unstable_cache` w tras użytkownika; `revalidate`/`force-dynamic` głównie w `app/api/*`. Jedyny cache danych to in-process Map `lib/community/perf-cache.ts` (per instancja, nie działa między instancjami Vercel).
- Baza: `db/index.ts` (libSQL przez HTTPS, singleton na `globalThis`, retry w `db/resilient-client.ts`: do 3 prób, odczyty zawsze, zapisy tylko gdy brak połączenia). Schemat 2103 linie, 78 tabel, 115 indeksów.
- Cold start: `instrumentation.ts` przy każdym starcie procesu odpala `runMigrations()` (z retry 3x) + `ensureCriticalSchema` na Turso, plus init Sentry. `next.config.ts` pakuje `db/migrations/**` do każdej funkcji (`outputFileTracingIncludes: "/*"`).
- Hosting: `vercel.json` ma tylko cron `0 3 * * *` -> `/api/cron/cleanup`. `docker-compose.yml` uruchamia wyłącznie `java-backend` (Maven `spring-boot:run` w kontenerze, kompilacja przy każdym starcie, bez health-checku i limitów zasobów) - to dev, nie produkcja. `docs/vps-docker-production.md` to plan (Faza 1 VPS 4 GB, Faza 2 R2 na zdjęcia), "implementacja później". Z dokumentu: Vercel Hobby wstrzymany (HTTP 402), tymczasowy host Render Free (usypianie po ~15 min).
- PWA: `public/sw.js` to tylko push (bez `fetch`, kasuje wszystkie cache przy `activate`). Skutek: brak cache offline i brak precache - każda nawigacja idzie w sieć. `manifest.webmanifest` + `push-sw.js`.
- AI: `ai/coach.ts` to heurystyki lokalne bez LLM. Jedyna zewnętrzna usługa generatywna: Pollinations (`lib/pollinations-image.ts`, grafiki przepisów, `cache: "no-store"`, timeout). Zewnętrzne HTTP: Open Food Facts (`lib/food-products.ts`), USDA (`lib/food-products-usda.ts`), Turso Platform API i Render metrics (tylko admin).

## 1. Profil obciążenia i ścieżki krytyczne

Założenia modelu (do uzgodnienia z architektem): 300 aktywnych użytkowników (cel Fazy 1 z `docs/vps-docker-production.md`), szczyt 18:00-21:00, ok. 30% użytkowników trenuje w tej samej godzinie (90 treningów/h), każdy ~20 serii, 3 posiłki/dzień, 5-10 otwarć ekranów głównych/dzień. Klient: telefon klasy średniej, 4G/słabe Wi-Fi siłowni, WebView Androida.

| ID | Ścieżka | Pliki | Charakterystyka |
|----|---------|-------|-----------------|
| K1 | Start i prowadzenie treningu (ekran aktywnego treningu, zapis serii) | `app/(dashboard)/active-workout/page.tsx`, `app/api/active-workout-session/route.ts`, `lib/active-workout-persist.ts`, `lib/active-workout-cloud.ts` | Stan lokalny + synchronizacja do chmury (`activeWorkoutSessions`). Wymaga natychmiastowej reakcji UI niezależnie od sieci |
| K2 | Zakończenie treningu | `app/api/workouts/complete/route.ts`, `lib/workout-complete-submit.ts` | Rate limit (Upstash), auth, walidacja Zod, insert JSON `exercises`, porównanie z planem, 6x `revalidatePath` (`/`, `/reports`, `/active-workout`, `/workout-history`, `/workout-plan`, `/progress`) |
| K3 | Ekran główny po zalogowaniu | `app/(dashboard)/page.tsx`, `components/home/home-today-page-content.tsx`, `home-today-header.tsx` | `auth()` + 2 komponenty z Suspense; wykresy Recharts na ekranie głównym |
| K4 | Dziennik posiłków: wyszukiwarka + skaner | `lib/food-products.ts`, `lib/food-products-remote.ts`, `components/meal-suggestions/barcode-camera-scanner.tsx`, `actions/meal-log.ts` | Zapytania zewnętrzne (OFF/USDA), indeks `idx_meal_logs_user_date` jest |
| K5 | Postępy i analiza | `lib/progress-hub.ts`, `lib/exercise-progress.ts`, `lib/cardio-hub.ts`, `app/(dashboard)/progress*`, `components/progress/*` | Agregacje w JS po wczytaniu do 300-400 wierszy `workouts` z pełnym JSON `exercises` |
| K6 | Zdjęcia ciała | `app/api/media/body-report-photo/[id]/route.ts`, `db/schema.ts` (`body_report_photos.data_url`) | Obrazy jako data URL w Turso |
| K7 | Community (poll/SSE) | `lib/community/realtime-config.ts`, `app/api/community/*/stream/route.ts` | Domyślnie polling 5-30 s; SSE tylko za flagą |
| K8 | Zimny start / logowanie | `instrumentation.ts`, `proxy.ts`, `auth.ts` | Migracje + ensureSchema na starcie; bcryptjs (CPU) przy logowaniu hasłem |

## 2. Proponowane SLO (do uzgodnienia z architektem, pomiar po wdrożeniu narzędzi)

| Ścieżka | Metryka | Cel |
|---------|---------|-----|
| K1 zapis serii (lokalnie) | czas reakcji UI | < 100 ms, niezależnie od sieci (optimistic + kolejka offline) |
| K1 sync sesji do chmury | API p95 | < 400 ms, p99 < 1 s; błąd < 0,5%; nie blokuje UI |
| K1 otwarcie ekranu treningu | TTI na telefonie klasy średniej, 4G | < 2,5 s (zimny), < 1,2 s (ciepły); INP < 200 ms |
| K2 `POST /api/workouts/complete` | p95 / p99 | < 800 ms / < 2 s przy 90 treningach/h; błędy < 0,5% |
| K3 ekran główny | LCP / CLS / INP (4G, Moto G-class) | < 2,5 s / < 0,1 / < 200 ms; TTFB p95 < 800 ms (ciepły), < 3 s (zimny start) |
| K4 wyszukiwarka produktów | p95 odpowiedzi | < 600 ms z lokalnej bazy, < 2,5 s z OFF/USDA; timeout zewnętrzny <= 3 s, brak blokowania UI |
| K4 zapis posiłku | p95 | < 500 ms |
| K5 ekran Postępy | TTFB p95 / LCP | < 1,5 s / < 3 s; maks. 5 zapytań DB na wejście |
| K6 zdjęcie | rozmiar przesyłany / TTFB obrazu | <= 300 KB po kompresji; p95 < 700 ms; nagłówki cache dla zdjęć |
| Bundle | JS pierwszego ładowania (gzip) | <= 200 KB dla `/` (stan obecny: do zmierzenia, patrz 3.3) |
| Koszt DB | odczyty wierszy / aktywny user / dzień | budżet do ustalenia po pomiarze (patrz 4) |

## 3. Znalezione problemy

Dotkliwość: W = wysoka, S = średnia, N = niska. Ścieżka = adresat (backend / frontend / architekt).

### 3.1 Baza i zapytania

| # | Problem | Dowód | Dotk. | Ścieżka |
|---|---------|-------|-------|---------|
| D1 | Brak indeksu na `workouts(user_id, date)`. Tabela `workouts` (`db/schema.ts:260`) nie ma żadnego indeksu poza PK; grep po `db/migrations/*.sql` i `db/ensure-schema.ts` nie znajduje indeksu na `workouts`. Zapytania `WHERE user_id = ? ORDER BY date DESC` są wykonywane w ok. 49 miejscach (`lib/exercise-progress.ts:126`, `lib/cardio-hub.ts:91`, `lib/progress-hub.ts`, `lib/community/hof.ts`, `fcs-compute.ts`, `team-feed-auto.ts`). Pełne skany tabeli = liczone jako odczytane wiersze w Turso. Weryfikacja: `EXPLAIN QUERY PLAN` na lokalnej kopii | W | backend + architekt (migracja Drizzle) |
| D2 | Treningi jako JSON w kolumnie tekstowej `workouts.exercises`; agregacje (postępy, cardio, rekordy, HoF) wczytują do 300-400 pełnych wierszy i parsują JSON w Node (`lib/cardio-hub.ts:98` limit 400, `lib/exercise-progress.ts:131` limit 350, `lib/progress-hub.ts:369`). Wzrost proporcjonalny do historii, brak pre-agregacji. `docs/performance-intelligence-engine-v2.md` planuje tabele faktów `pie_*` (idempotentny recompute) - to właściwy kierunek, ale dodaje zapisy po każdym treningu | W | architekt (ADR), backend |
| D3 | Zdjęcia jako data URL w Turso (`body_report_photos.data_url`, `meal_catalog_images`, `bug_report_photos`, `user_settings.start_photo_data_url`, branding). Każdy odczyt zdjęcia to duży transfer z DB + dekodowanie base64; zjada budżet storage (soft 700 MB / hard 850 MB, `lib/db-storage-budget.ts`) i odczytów. Dokument VPS sam planuje R2 w Fazie 2. Należy zweryfikować, że listy NIE pobierają `data_url` (`select()` bez projekcji) | W | architekt (ADR: R2/Blob), backend |
| D4 | N+1 / liczba zapytań na wejście: ekran główny i Postępy składają wiele funkcji z `lib/*` (m.in. `Promise.all` w 15 `page.tsx`), każda z osobnym zapytaniem HTTPS do Turso (RTT region Vercel <-> Turso rośnie liniowo przy sekwencyjnych await). Brak narzędzia licznika zapytań na request | S | backend: dodać licznik zapytań w dev/test, zmierzyć |
| D5 | Zimny start: `instrumentation.ts` wykonuje migracje + `ensureCriticalSchema` (wiele `CREATE ... IF NOT EXISTS`) przy każdym nowym procesie = dodatkowe zapytania do Turso i opóźnienie pierwszego requestu na każdej instancji | S | architekt: przenieść migracje do kroku deploy (`db:migrate` w CI), na starcie zostawić flagę |
| D6 | `pageViews` / `siteActivityLog`: zapis na każde wejście na ekran (`app/api/analytics/page-view/route.ts`), osobne `idx_page_views_*` x3 = amplifikacja zapisu. Retencja istnieje (`lib/db-retention.ts`), ale dziennie jeden cron | S | backend: batch/sampling |
| D7 | Retry wszystkich odczytów 3x z backoffem 150 ms (`db/resilient-client.ts`) maskuje awarie i może wydłużyć ogon p99 oraz mnożyć odczyty Turso w awarii | N | architekt |

### 3.2 Renderowanie, cache, runtime

| # | Problem | Dowód | Dotk. | Ścieżka |
|---|---------|-------|-------|---------|
| R1 | Brak cache danych: prawie każda strona dashboardu jest dynamiczna i bez `use cache`/tagów (`lib/cache-tags.ts` istnieje, ale brak użycia w trasach użytkownika; cache tylko w `lib/food-products*.ts`, `lib/user-photo-response.ts`). Dane referencyjne (katalog ćwiczeń, produkty, plany, branding, `app_settings`) są przeliczane per request | S | architekt (strategia cache pod Next 16: przeczytać `node_modules/next/dist/docs/` o `use cache`) |
| R2 | `POST /api/workouts/complete` wykonuje 6x `revalidatePath` synchronicznie (route.ts ok. linii 165-170). Przy trasach w pełni dynamicznych jest to w większości zbędne i dodaje koszt na ścieżce K2 | S | backend (zweryfikować, czy potrzebne) |
| R3 | 66% komponentów `'use client'` (241/367): większy hydrate i JS na telefonach. Ekran główny ładuje 4 wykresy Recharts (`components/home/*chart.tsx`), `framer-motion` w 22 plikach | S | frontend |
| R4 | Uwaga: `public/sw.js` bez fetch/cache - brak offline i brak cache statyków przez SW (zamierzone po incydencie ze starym UI). Statyki hashed idą z CDN/HTTP cache Next, ale na słabej sieci siłowni brak zapisu offline serii poza `active-workout-persist` | S | architekt + frontend: kolejka zapisu serii offline (K1) |
| R5 | Polling Community: 13 plików komponentów używa `setInterval`; domyślne interwały: powiadomienia 20 s, feed 15 s, chat 8 s, presence grupowa 5 s, "kto trenuje" 30 s (`lib/community/realtime-config.ts`). Każdy tick = invocation funkcji + zapytania. 300 użytkowników z otwartą apką x kilka pollingów = ok. 10-30 invocations/min/użytkownika. Pauza na ukrytej karcie jest zadeklarowana - zweryfikować | S | frontend, backend |
| R6 | SSE (`app/api/community/*/stream`) trzyma funkcję 25-30 s; domyślnie wyłączone (`NEXT_PUBLIC_COMMUNITY_REALTIME=poll`). Ryzyko kosztowe tylko po włączeniu | N | - |
| R7 | In-memory cache i `checkRateLimit` fallback (`lib/rate-limit.ts`) są per instancja: bez Upstash limity nie działają rozproszenie, a cache community nie dzieli się między instancjami | N | architekt |

### 3.3 Bundle (pomiar z lokalnego builda)

- `.next/static`: 5,7 MB łącznie; 90 plików chunków JS, suma `chunks/*.js` = 3,5 MB (surowo, nieskompresowane).
- Największe chunki (surowo): 466 KB (`6418...`, zawiera Sentry), 438 KB (`5965-...`, nierozpoznany), 345 KB (`9076-...`, Recharts), 243 KB (`3794-...`), 204 KB (`4bd1b696`, część frameworka), `framework` 190 KB, `main` 142 KB, `polyfills` 113 KB.
- Wniosek B1 (S): Sentry klienta ~460 KB surowo (gzip ok. 150 KB) ładowany globalnie - rozważyć lazy-load/`tunnel`, zredukować integracje (replay wyłączony?). Wniosek B2 (S): Recharts 345 KB w osobnym chunku, ale importowany z ekranu głównego - zastosować `next/dynamic` (`ssr:false` / odroczone poniżej foldu) dla wykresów `components/home/*`. Wniosek B3 (N): `@zxing/*` tylko w `barcode-camera-scanner.tsx` - sprawdzić, że ładowany leniwie. Wniosek B4 (S): `mammoth`, `word-extractor`, `unpdf`, `saxes`, `fflate`, `nodemailer`, `web-push` - upewnić się, że są wyłącznie po stronie serwera (nie ma ich w chunkach klienta wg grep; weryfikować `npx @next/bundle-analyzer`).
- Nie zmierzono: first-load JS per trasa (Next 16 go nie wypisuje) - do zrobienia przez `next experimental-analyze` lub `@next/bundle-analyzer` oraz Lighthouse.
- `public/gymbrat.apk` i `gymbrat-0.1.11.apk`: po 5,36 MB w `public/` (duplikat; build pobiera APK w `scripts/fetch-android-apk.mjs`). Zwiększa artefakt wdrożenia i transfer (Vercel Fast Data Transfer przy pobraniach APK). Priorytet S, ścieżka: architekt (hosting APK poza repo/Vercel).

### 3.4 Zewnętrzne wywołania i koszty

- Pollinations (grafiki przepisów): `cache: "no-store"`, generowanie przy imporcie JSON i w panelu admina (`maxDuration = 60` w `app/api/admin/catalog/*`). Wynik trafia do Turso jako data URL (`meal_catalog_images`) - koszt storage, nie tokeny. Zalecane: limit liczby generacji na import, kolejka, rozmiar docelowy obrazu.
- Open Food Facts i USDA: brak własnego rate limitu poza wspólnym; OFF ma politykę uczciwego użycia (wymagany User-Agent). Cache w `lib/food-products.ts` istnieje - zweryfikować TTL i klucz dla zapytań wyszukiwania (częste frazy).
- Brak płatnego LLM w projekcie (`ai/coach.ts` to heurystyki) - brak ryzyka kosztów tokenów dziś. Każda zmiana wprowadzająca LLM wymaga budżetu tokenów, cache wyników i limitów per user.

## 4. Limity i koszty darmowych planów (stan wiedzy ogólnej - zweryfikować aktualne cenniki przed decyzjami; nie sprawdzano online w tym zadaniu)

| Usługa | Limity free (orientacyjnie) | Gdzie GymBrat może przekroczyć |
|--------|-----------------------------|--------------------------------|
| Vercel Hobby | użycie niekomercyjne; limity Fluid Active CPU / invocations / Fast Data Transfer; cron max 1x/dzień na Hobby; maxDuration ograniczony. W projekcie Hobby jest już wstrzymany (HTTP 402 wg `docs/vps-docker-production.md`) | polling Community (R5), pełna dynamika bez cache (R1), APK 2x5,4 MB (3.3), SSE jeśli włączone, `maxDuration=60` na adminie. Aplikacja z płatnymi użytkownikami narusza warunki Hobby |
| Turso Free (starter) | storage ok. 5 GB (w kodzie soft/hard 700/850 MB - wartości konserwatywne, ustawiane env), limity odczytanych/zapisanych wierszy miesięcznie (rzędu miliardów odczytów; dokładnie sprawdzić w panelu) | brak indeksu `workouts` (D1) = skan tabeli liczony jako odczyt wierszy; JSON-agregacje (D2); zdjęcia jako blob (D3); polling community, page views (D6). `TURSO_API_TOKEN` + `TURSO_ORG_SLUG` pozwalają panelowi admina pokazać zużycie - warto ustawić alert |
| Upstash Redis Free | limit komend dziennie (rzędu 10k/dzień) | rate limit używa Redis na każde żądanie z limitem (sliding window = kilka komend/żądanie); polling i zapisy serii mogą szybko zużyć dzienny limit; fallback to pamięć procesu |
| Sentry Developer (free) | ok. 5k błędów, ograniczone transakcje/replay/miesiąc | błąd w pętli klienta (np. nieudany poll co 5-15 s x użytkownicy) wyczerpie limit; sampling traces/replay do sprawdzenia w `lib/sentry-init.ts`. Dane zdrowotne nie mogą trafiać do Sentry (standard repo) |
| Dostawca AI (Pollinations) | klucz `sk_` z enter.pollinations.ai; legacy `image.pollinations.ai` zwraca 402 | masowy import katalogu z generowaniem grafik; brak kolejki |
| Render Free (host tymczasowy) | usypianie po ~15 min, 512 MB RAM | zimne starty 30-60 s, migracje na starcie (D5) pogarszają |
| VPS Hetzner (plan Fazy 1) | stały koszt 5-15 EUR/mies. | RAM 4 GB: Next + Java (jeśli włączona) razem; kompilacja Mavena w kontenerze (`docker-compose.yml`) to dev, nie produkcja |

## 5. Checklista wydajności dla przyszłych zadań

Przed implementacją (architekt/analityk):
- Czy zmiana dotyka K1-K8? Jeśli tak, czy są SLO i model obciążenia?
- Czy dodaje tabelę/kolumnę czytaną po `user_id` lub dacie? Jest indeks (Drizzle `index()` + migracja + wpis w `db/ensure-schema.ts`)? Sprawdzone `EXPLAIN QUERY PLAN`?
- Czy trzyma dane w JSON/blob? Czy lista wybiera tylko potrzebne kolumny (bez `data_url`, bez pełnego `exercises`)?
- Czy nowa ścieżka cache zgodna z tą wersją Next (`node_modules/next/dist/docs/`), z tagami z `lib/cache-tags.ts`?

Implementacja (backend/frontend):
- Maks. zapytań DB na request ustalone i sprawdzone; niezależne w `Promise.all`; brak zapytań w pętli.
- Zapis krytyczny (seria, posiłek) nie blokuje UI: optimistic update, retry, kolejka offline.
- Brak `revalidatePath` na gorącej ścieżce bez potrzeby; brak nowych pollingów bez pauzy na ukrytej karcie i bez backoffu.
- Nowe zależności: rozmiar (bundlephobia), tylko serwer lub `next/dynamic`; nie dodawać do globalnego layoutu.
- Wykresy i skaner ładowane leniwie; obrazy przez `next/image` lub kompresowane po stronie klienta (cel <= 300 KB).
- Zewnętrzne HTTP: timeout, cache, rate limit, brak danych użytkownika w zapytaniu.
- Funkcja zależna od env: wpis w `lib/admin-config-status.ts` i `env.example`.

Weryfikacja (tester-wydajnosci):
- `npm run build` i porównanie rozmiarów chunków z sekcją 3.3 (regresja > 10% = uwaga).
- Lighthouse mobile (throttling 4x CPU, Slow 4G) dla `/`, `/active-workout`, `/progress`, `/nutrition/today`.
- k6/autocannon na lokalnym `next start` z lokalną bazą `file:` zasianą danymi (np. 300 użytkowników x 6 miesięcy historii) dla K2, K4, K5; osobno ścieżka Java, gdy `JAVA_API_BASE_URL` ustawione.
- Test długotrwały (pamięć procesu Node: mapy `perf-cache`, `buckets` rate-limit).
- Raport w `docs/wydajnosc/` ze skryptami i konfiguracją, porównanie z poprzednim pomiarem.

## 6. Czego nie zmierzono (ryzyka resztkowe)

- Brak realnych pomiarów latencji (RTT Vercel/Render <-> Turso), TTFB, LCP/INP na urządzeniach; wszystkie SLO są propozycjami.
- Nie wykonano `EXPLAIN` zapytań (brak zasianej bazy); D1 wynika z braku indeksu w definicjach, nie z pomiaru czasu.
- Nie sprawdzono aktualnych cenników/limitów dostawców online; sekcja 4 to wiedza ogólna do weryfikacji.
- Nie zmierzono first-load JS per trasa; nie zmierzono ścieżki Java (`java-backend/`).
- Build użył tymczasowej bazy lokalnej (usunięto `build-tmp.db`); `.next/` jest artefaktem builda.
