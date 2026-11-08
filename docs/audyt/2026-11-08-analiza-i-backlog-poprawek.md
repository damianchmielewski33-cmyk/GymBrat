# Analiza techniczna, UX, architektoniczna i biznesowa + backlog poprawek — 2026-11-08

Uzupełnia audyt z 2026-11-01 ([audyt](2026-11-01-audyt-przedkomercyjny.md)) i backlog [US1–US21](backlog-us.md). **Nie powtarza** znalezisk, które już mają swoje US; skupia się na rzeczach nowych, na luce między „kod gotowy" a „działa na produkcji" oraz na spójności produktu.

## 0. Metoda i granice

Zrobione: przegląd struktury repo (449 plików TSX, 616 plików `lib`, 51 `actions`, 89 tabel, 46 migracji, 217 plików testowych), skan wzorców (guardy akcji i tras API, `fetch`, daty, crony, bramki Premium, pliki śledzone w git), lektura wybranych plików (`proxy.ts`, `vercel.json`, `deploy/docker-compose.yml`, `lib/achievements.ts`, `lib/premium-report-access.ts`, `app/(dashboard)/labs`).

**Nie zrobione** (traktować wnioski jako hipotezy do weryfikacji, jeśli tak oznaczone): nie uruchamiałem testów, `tsc`, lintu, E2E ani aplikacji; nie oglądałem ekranów; brak dostępu do produkcji, Turso, Sentry, PostHog. Wskaźnik pewności przy każdym znalezisku: **[P]** potwierdzone w kodzie, **[H]** hipoteza z analizy wzorca.

## 1. Werdykt

Produkt jest szeroki i technicznie dojrzały (strict TS, tylko 1 `any`, 0 `@ts-ignore`, spójne guardy). Największe ryzyka nie są w „brakujących funkcjach", tylko w trzech miejscach:

1. **Dług weryfikacji.** Prawie wszystkie US1–US20 mają status „KOD GOTOWY, TESTY NIEURUCHOMIONE". Nikt nie wie, czy zielona baza z 1.11 (1237 testów, tsc czysty) nadal jest zielona. Do tego ~38 zmodyfikowanych plików w drzewie roboczym (suplementy) bez commita.
2. **Luka dev→produkcja.** Część mechanizmów istnieje tylko dla Vercela, który nie jest produkcją (D1): crony `package-expiry`, kontener cron na VPS woła tylko `cleanup`.
3. **Model biznesowy.** Pakiet Premium odblokowuje jeden raport. Reszta (analiza, coach, plany, społeczność) jest darmowa, więc nie ma powodu, by płacić.

## 2. Znaleziska

### 2.1 Operacje i niezawodność

| ID | Waga | Pewn. | Znalezisko |
|---|---|---|---|
| OPS-1 | **Wysoka** | P | **Cron `package-expiry` nie działa na produkcji.** Jest tylko w `vercel.json`. Kontener `cron-service` w `deploy/docker-compose.yml` woła jedynie `CRON_TARGET_URL=…/api/cron/cleanup` raz na 86400 s. Skutek: wygasanie pakietów/powiadomienia o wygaśnięciu nie ruszą na Render/VPS. |
| OPS-2 | Wysoka | P | **Przypomnienia (`/api/cron/reminders`) zależą od GitHub Actions** (`.github/workflows/reminders-cron.yml`), nie od infrastruktury produkcyjnej. Jeden zewnętrzny scheduler, bez monitoringu; harmonogram GH Actions bywa opóźniany lub wyłączany po 60 dniach braku aktywności repo. Brak jednego, udokumentowanego miejsca „jakie crony muszą chodzić na produkcji". |
| OPS-3 | Średnia | P | **19 z 22 wywołań `fetch` po stronie serwera bez timeoutu** (`AbortSignal.timeout` tylko w `android-version`, `pollinations-image`, `body-reports/import`). Dotyczy m.in. PostHog, USDA, Open Food Facts, S3 (`object-storage-core`), Turso/Render metrics, YouTube. Wolny dostawca zawiesza request do limitu platformy. |
| OPS-4 | Średnia | P | `ensureCriticalSchema()` wołane w 81 plikach (trasy, strony). Przy `SCHEMA_MODE=ensure` (domyślne) każdy zimny start/instancja wykonuje DDL w ścieżce żądania; dwa źródła schematu (`db/schema.ts` 2453 l., `db/ensure-schema.ts` 1776 l.) + 46 migracji. Ryzyko dryfu między nimi. |
| OPS-5 | Niska | P | Cron `reminders` wymaga POST + Bearer; `package-expiry` i `cleanup` mają różne kontrakty metod (GET/POST) — brak jednolitego helpera `verifyCron` i wspólnego testu. |
| OPS-6 | Niska | P | **Artefakty w git:** katalog `tmp/` (≈50 zrzutów ekranu + `axe.json`, kilka MB) jest śledzony mimo wpisu `/tmp/` w `.gitignore`; repo jest chwilowo publiczne (D6) — zrzuty mogą zawierać dane mock/UI niewydanego produktu. |

### 2.2 Dane, spójność logiki

| ID | Waga | Pewn. | Znalezisko |
|---|---|---|---|
| DATA-1 | Średnia | P | **Data „dzisiaj" w UTC zamiast czasu lokalnego:** `lib/achievements.ts:27` `todayIso()` = `new Date().toISOString().slice(0,10)`. Między 00:00 a 01:00/02:00 w Polsce (CET/CEST) odblokowania osiągnięć dostają wczorajszą datę. Ten sam wzorzec w `lib/exercise-progress.ts`, `lib/body-reports.ts:335`, `lib/order-admin.ts:22`, `lib/community/hof.ts` (okresy). Istnieją już `lib/local-date.ts` (`localDateKey`) i `warsawDayKey` w `lib/finance.ts` — 20 miejsc używa wzorca ad hoc. |
| DATA-2 | Średnia | H | Wyścigi „SELECT potem UPDATE" bez CAS w społeczności (XP, wojny, misje) — z audytu ARCH-5, nie ma dla niego US w backlogu; `grep` znajduje tylko ~12 inkrementów SQL na całą aplikację. Do przejrzenia plik po pliku. |
| DATA-3 | Średnia | P | 81+ wywołań `ensureCriticalSchema` i 89 tabel, ale **jeden** `users` jako węzeł: usuwanie konta/eksport/retencja (`account-purge`, `retention-extra`, `user-data-export-extra`) muszą znać każdą tabelę ręcznie. Brak testu „każda tabela z `user_id` jest objęta usunięciem i eksportem" (nowa tabela, np. `supplement_intakes` z migracji 0046, może wypaść). |
| DATA-4 | Niska | P | Pętle `for … await db.insert/select` w `lib/community/progression.ts`, `team-quests.ts`, `retention-extra.ts` (N zapytań zamiast batcha) — mały wolumen dziś, koszt w Turso (limit zapisów) później. |

### 2.3 Architektura i jakość kodu

| ID | Waga | Pewn. | Znalezisko |
|---|---|---|---|
| ARCH-A | Średnia | P | **Duże pliki:** `register-form.tsx` 1094 l., `active-workout-view.tsx` 950 l., `workout-finished-screen.tsx` 887 l., `barcode-camera-scanner.tsx` 916 l., `lib/live-set-coach.ts` 1125 l., `lib/community/challenges.ts` 1183, `team-feed.ts` 1104, `chat.ts` 1102, `workout-exercise-catalog.ts` 1256. US20/Z80 domknął tylko część. |
| ARCH-B | Średnia | P | **Martwe/niedokończone trasy w produkcyjnym drzewie:** `labs`, `promo-codes` (zaślepki za flagą `NEXT_PUBLIC_SHOW_UNFINISHED_PAGES`), `progress-analysis`, `profile/workout-plan`, `start-workout` jako tylko-redirecty. Decyzje D10/D11 nadal „do ustalenia". |
| ARCH-C | Średnia | P | **Cztery kanały** (web/PWA, Android WebView, iOS WKWebView, Java) — Java wg D5/D18 do usunięcia; kod `Z31/Z73` w toku. Każdy dodatkowy kanał mnoży testy i ryzyko (np. `iframe-session-breakout`, `app-webview`). |
| ARCH-D | Niska | P | 18 `eslint-disable`, 40 `console.*` poza testami (powinno iść przez `logServerError`/Sentry), 238 literałów `#rrggbb` w TSX mimo tokenów marki (`brand-color-literals.test.ts` istnieje — sprawdzić, czy pokrywa wszystko). |
| ARCH-E | Niska | P | `next-auth@5.0.0-beta.32` (beta w produkcji) z override `nodemailer`; `vitest ^2.1.9` vs. aktualne major; polityka aktualizacji zależności niezdefiniowana. |
| ARCH-F | Niska | P | 279 z 449 komponentów to `"use client"` (62%); tylko 2 użycia `unstable_cache`/`use cache`. Duży udział klienta zwiększa JS; potencjał cache dla danych katalogowych (ćwiczenia, produkty). |

### 2.4 UX / UI

| ID | Waga | Pewn. | Znalezisko |
|---|---|---|---|
| UX-A | Średnia | P | **Zbyt szeroka nawigacja względem wartości:** 80+ tras w aplikacji (trening, dieta, suplementy, cardio, technika, raporty, plany, atlas, import, społeczność z 15 podstronami, wojny, drużyny). Brak potwierdzenia, że nowy użytkownik dochodzi do „aha" (pierwszy trening) bez przeskakiwania między ekranami; metryki aktywacji z Z53 jeszcze bez danych. |
| UX-B | Średnia | H | **Spójność liczb po US12** — wymaga ponownej weryfikacji na uruchomionej aplikacji (pulpit vs Trening vs Postępy: cardio, kcal, serie). Status US12 „testy nieuruchomione". |
| UX-C | Średnia | P | Nazewnictwo i wejścia: „Analiza"/„Postępy"/„Przegląd planu"/„Przegląd" (4 nazwy dla okolic `/progress`), „Trening"/„Plany"/„Plan treningowy"/„Atlas". Wejścia dublują się (redirecty). |
| UX-D | Niska | H | Nowy ekran suplementów (migracja 0046, `supplements-manage-client`, chip na pulpicie, push przypomnień) dodany bez wpisu w zakresie pakietu/zgód: czy dane suplementów są „zdrowotne" w rozumieniu zgody `health` i objęte eksportem/usunięciem (patrz DATA-3)? |
| UX-E | Niska | P | Dostępność: 328 `<button>` vs 335 `aria-label` (pokrycie nieweryfikowalne grepem); axe na prawdziwych stronach nie uruchomiony (US17/Z69/Z74 „tylko procedura"). |

### 2.5 Biznes

| ID | Waga | Pewn. | Znalezisko |
|---|---|---|---|
| BIZ-A | **Wysoka** | P | **Premium = jeden raport** (`getPremiumReport`, `/progress/report`, `/api/premium/report`; jedyne wywołania `requirePremium`). Cennik (7/30/90/365 dni, jednorazowo) nie ma spójnej obietnicy: za co płacę, czego nie mam za darmo. Najcenniejsze funkcje (coach, analiza, plany, raporty ciała) są darmowe. |
| BIZ-B | Wysoka | P | **Brak odnowienia i okresu próbnego**; pakiety dniowe bez auto-przedłużenia + (OPS-1) wygasanie może nie działać → przychód jednorazowy, zero MRR, ryzyko „wiecznego" Premium. |
| BIZ-C | Średnia | P | **Koszty zmienne bez kontroli:** Pollinations (obrazy/AI), S3, Turso — bez limitów per użytkownik dla darmowego planu ani dashboardu kosztu na użytkownika (`lib/monitoring/*` mierzy zużycie, nie koszt jednostkowy). Dane do Pollinations trafiają poza EOG (D25). |
| BIZ-D | Średnia | P | **Rozproszenie kanałów dystrybucji i brak decyzji:** D10/D11 nadal otwarte; Google Play (Z51/Z52) na końcu kolejki, a płatności za cyfrowy pakiet w aplikacji Android mogą wymagać Google Play Billing (decyzja Z19 „bez zakupów w aplikacji" — zweryfikować polityką Play, czy sam link do płatności web jest dozwolony). |
| BIZ-E | Niska | H | Funkcje społecznościowe (czat, drużyny, wojny — ponad 5 tys. linii w `lib/community`) niosą koszt moderacji i RODO (zgłaszanie, blokowanie, retencja czatu); brak w backlogu moderacji/raportowania nadużyć. |

## 3. Backlog poprawek

Numeracja kontynuuje US (US22+), żeby polecenie „zrealizuj us22" działało zgodnie z `CLAUDE.md`. Prio: P0 blokuje start sprzedaży · P1 przed startem · P2 krótko po · P3 porządki. Rozmiar: S ≤ 1 d · M 3–5 d · L 1–2 tyg.

| US | Tytuł | Prio | Rozm. | Pokrywa | Status |
|---|---|---|---|---|---|
| US22 | Domknięcie weryfikacji i higiena repo | P0 | M | dług weryfikacji, OPS-6 | CZĘŚCIOWO 2026-11-08: Z91, Z92, Z94, Z95 zrobione; Z93: deploy:check OK, E2E 8 ok/4 fail/34 skip (timeouty page.goto na /login i /register w dev — do zbadania, patrz niżej) |
| US23 | Crony i operacje na produkcji | P0 | M | OPS-1, OPS-2, OPS-5 | TODO |
| US24 | Wartość Premium i model cennika | P0 | L | BIZ-A, BIZ-B, UX-A | TODO — wymaga decyzji właściciela |
| US25 | Odporność integracji zewnętrznych | P1 | S | OPS-3, DATA-4 | TODO |
| US26 | Daty lokalne i spójność liczb | P1 | M | DATA-1, UX-B | TODO |
| US27 | Kompletność RODO dla nowych tabel | P1 | M | DATA-3, UX-D | TODO |
| US28 | Redukcja powierzchni produktu | P2 | L | ARCH-B, ARCH-C, UX-C | TODO — wymaga decyzji właściciela |
| US29 | Kontrola kosztów i moderacja | P2 | M | BIZ-C, BIZ-E | TODO |
| US30 | Schemat DB i wyścigi | P2 | L | OPS-4, DATA-2 | TODO |
| US31 | Porządki w kodzie i zależnościach | P3 | M | ARCH-A, ARCH-D, ARCH-E, ARCH-F, UX-E | TODO |

Zależności: US22 przed wszystkim (potrzebna zielona baza). US24 i US28 wymagają decyzji właściciela (zapytać przez AskUserQuestion, zapisać w `docs/zespol/decyzje-wlasciciela.md`; kod konfigurowalny flagą). US23 przed US24 (wygasanie pakietów musi działać, zanim zmienimy model).

### US22 — Domknięcie weryfikacji i higiena repo (P0, M)

Cel: zielona, udokumentowana baza po US1–US20 i po zmianach w drzewie roboczym.
- **Z91** Zacommitować (na `master`) pracę nad suplementami (migracja 0046, `lib/supplement-*`, cron, push) po przeglądzie: guard, własność, test, wpis `changelog` z `planned: true`.
- **Z92** Uruchomić `npx tsc --noEmit`, `npx vitest run`, `npm run lint`; zapisać wynik bazowy (testy, tsc, liczba błędów lint) w nagłówku `backlog-us.md` w miejsce wartości z 2026-11-01. AC: raport z liczbami; wszystkie czerwone testy naprawione albo opisane.
- **Z93** Uruchomić `npm run deploy:check` oraz E2E (`e2e/`, baza `e2e.db`); naprawić lub wyłączyć z uzasadnieniem. Cel: z 9/41 do >90%.
- **Z94** Usunąć `tmp/` z indeksu git (`git rm -r --cached tmp`), zostawić wpis w `.gitignore`; sprawdzić, że nic poza `.example` nie trafia z `android/` (klucz `gymbrat-release.jks` jest tylko lokalnie — potwierdzone). AC: `git ls-files | grep -E '^tmp/'` puste.
- **Z95** Zaktualizować statusy w indeksie `backlog-us.md` na podstawie wyniku Z92–Z93 (zamiast „TESTY NIEURUCHOMIONE").

### US23 — Crony i operacje na produkcji (P0, M)

- **Z96** Jedna tabela „crony produkcyjne" w `docs/deployment*.md`: `cleanup` (dziennie), `package-expiry` (dziennie), `reminders` (co 5–15 min) z metodą, nagłówkiem, harmonogramem i właścicielem harmonogramu.
- **Z97** Rozszerzyć `cron-service` w `deploy/docker-compose.yml` o wiele celów (lista `CRON_TARGETS` + osobne interwały) albo dodać drugi kontener; `package-expiry` i `reminders` wywoływane z VPS, GH Actions jako zapas. AC: po `docker compose up` w logach widać trzy wywołania z kodem 200.
- **Z98** Wspólny helper `verifyCronRequest(req)` (stały czas, GET i POST, Bearer) używany przez wszystkie trasy `/api/cron/*` + test „brak/zły sekret → 401".
- **Z99** Monitoring: zapis ostatniego udanego uruchomienia każdego crona (tabela `app_settings` lub istniejący log) i wpis w `lib/admin-config-status.ts` / panelu admina: „cron X nie uruchomiony od >N h". `[NA KONIEC]` konfiguracja alertu w Sentry/uptime.

### US24 — Wartość Premium i model cennika (P0, L, wymaga decyzji)

Decyzje do zapytania (AskUserQuestion; rekomendacja pierwsza): (a) co jest w Premium, (b) cena/okresy, (c) odnowienie vs jednorazowy, (d) okres próbny.
- **Z100** Decyzja: zakres Premium. Propozycja: analiza postępów rozszerzona + raport PDF/Premium + zaawansowany coach serii + nieograniczone zdjęcia/raporty ciała + eksport danych treningowych; darmowe: logowanie treningu, dieta podstawowa, społeczność.
- **Z101** Bramki `requirePremium` / `isPremiumActive` w wybranych funkcjach (server action + trasa + UI z „zablokowane — odblokuj" i jednym spójnym komunikatem). AC: test każdej bramki (402 bez pakietu, 200 z pakietem).
- **Z102** Strona `/package`: obietnica (co dostaję) zamiast listy dni; porównanie Free vs Premium; stan pakietu i data wygaśnięcia.
- **Z103** Okres próbny (np. 7 dni raz na konto) za flagą `PREMIUM_TRIAL_DAYS`; test idempotencji (jedno użycie na konto).
- **Z104** Przypomnienia o wygaśnięciu (e-mail/push, zgodnie ze zgodami) i ekran „pakiet wygasł" z jednym kliknięciem do zakupu.

### US25 — Odporność integracji zewnętrznych (P1, S)

- **Z105** Helper `fetchWithTimeout(url, init, ms)` w `lib/` i podmiana w 19 wywołaniach (`posthog`, `food-products*`, `object-storage-core`, `monitoring/*`, `youtube-search`, `trigger-android-apk-build`); domyślny timeout 8 s, S3 15 s. AC: test jednostkowy timeoutu; żaden `await fetch(` bez helpera (reguła lint `no-restricted-syntax` lub test grep).
- **Z106** Batchowanie pętli z DATA-4 (`db.batch`) w `progression.ts`, `team-quests.ts`, `retention-extra.ts`.

### US26 — Daty lokalne i spójność liczb (P1, M)

- **Z107** Zastąpić `new Date().toISOString().slice(0,10)` w `lib/achievements.ts`, `exercise-progress.ts`, `body-reports.ts`, `order-admin.ts`, `components/admin/*` wspólnym helperem (`localDateKey`/`warsawDayKey` z jednej, nazwanej funkcji `todayKey(tz)`). AC: test z zegarem ustawionym na 23:30 UTC w lecie (po północy w Polsce).
- **Z108** `lib/community/hof.ts`: okresy z `startsAt/endsAt` porównywane z `workouts.date` (lokalna data) — ujednolicić strefę i dodać test na granicy doby.
- **Z109** Test spójności „jedno źródło liczby": minuty cardio, kcal, liczba serii, streak liczone przez jedną funkcję dla Pulpitu, Treningu i Postępów (rozszerzenie testów z US12); ręczny przegląd na uruchomionej aplikacji z danymi mock.

### US27 — Kompletność RODO dla nowych tabel (P1, M)

- **Z110** Test architektoniczny: dla każdej tabeli z kolumną `user_id` w `db/schema.ts` wymagany wpis w rejestrze usuwania (`account-purge`) i eksportu (`user-data-export-extra`) albo jawny wyjątek z uzasadnieniem. AC: dodanie tabeli bez wpisu = czerwony test.
- **Z111** Objąć `supplement_intakes` (migracja 0046) i definicje suplementów usuwaniem, eksportem i retencją; ocenić z `gymbrat-sensitive-data`, czy to dane o zdrowiu (zgoda `health`, brak zdarzeń Sentry/PostHog z treścią).

### US28 — Redukcja powierzchni produktu (P2, L, wymaga decyzji)

Decyzje: (a) `labs`, `promo-codes` — usunąć czy zdefiniować (D11), (b) usunięcie backendu Java i kanału iOS WKWebView vs zostawić, (c) docelowa mapa nawigacji.
- **Z112** Usunąć zaślepki i martwe redirecty (`labs`, `promo-codes`, `progress-analysis`, `profile/workout-plan`, `start-workout`) wraz z linkami i testami; zostawić przekierowania tylko dla adresów znanych z zewnątrz (maile, push).
- **Z113** Ujednolicić nazwy sekcji (jedna nazwa na „Postępy", jedna na „Plany"); przegląd copy przez skill `gymbrat-ui`.
- **Z114** Mapa nawigacji (maks. 5 pozycji głównych) i metryka aktywacji z Z53: czas do pierwszego treningu. Makiety przez `gymbrat-design`.

### US29 — Kontrola kosztów i moderacja (P2, M)

- **Z115** Limity per użytkownik dla funkcji kosztownych (Pollinations, import AI, zdjęcia): dzienny limit darmowy / wyższy w Premium; zapis zużycia i komunikat po przekroczeniu.
- **Z116** Panel admina: koszt jednostkowy (Turso zapisy, S3, AI) na aktywnego użytkownika, alert przy przekroczeniu progu.
- **Z117** Moderacja społeczności: zgłaszanie wiadomości/profilu, blokowanie użytkownika, widok zgłoszeń w adminie, retencja czatu w polityce.

### US30 — Schemat DB i wyścigi (P2, L)

- **Z118** Przegląd 7 plików społeczności z SELECT-then-UPDATE (XP, wojny, misje): zamiana na warunkowy `UPDATE … WHERE` / inkrement SQL w `db.batch`; testy współbieżności (dwa równoległe wywołania).
- **Z119** Ścieżka do `SCHEMA_MODE=migrations` jako domyślnej: test zgodności `schema.ts` ↔ migracje ↔ `ensure-schema` w CI (diff), uruchamianie migracji przy deployu, usunięcie `ensureCriticalSchema` z tras po przełączeniu. `[NA KONIEC]` przełączenie na produkcji.

### US31 — Porządki w kodzie i zależnościach (P3, M)

- **Z120** Rozbić największe pliki (`register-form`, `active-workout-view`, `workout-finished-screen`, `barcode-camera-scanner`, `live-set-coach`, `community/challenges|team-feed|chat`) na moduły < 500 l. bez zmiany zachowania; testy przed/po.
- **Z121** Zastąpić 40 `console.*` loggerem serwerowym; przejrzeć 18 `eslint-disable`; sprawdzić 238 literałów kolorów względem tokenów.
- **Z122** Polityka zależności: miesięczny przegląd (`npm outdated`), plan przejścia z `next-auth` beta na stabilną wersję, aktualizacja `vitest`.
- **Z123** Cache katalogów (ćwiczenia, produkty, dostawcy treści) przez `use cache`/`unstable_cache` z tagami; audyt, które komponenty `"use client"` mogą być serwerowe.
- **Z124** Dostępność: uruchomić axe na 15 kluczowych trasach (procedura z Z69/Z74), naprawić błędy poziomu serious/critical.

## 4. Czego nie ruszać (pozytywy do zachowania)

Spójne guardy akcji (tylko `actions/reminders-prefs.ts` bez jawnego guarda — i tak czyta wyłącznie dane sesji), brak `@ts-ignore`, jedna funkcja `lib/rate-limit` z zaufanym nagłówkiem IP, publiczne trasy z limitami (`waitlist`, `client-errors`, `csp-report`), rozdzielenie `docs/zespol/decyzje-wlasciciela.md` od kodu, testy architektoniczne (np. `brand-color-literals`, `admin-routes-access`).

## 5. Postęp US22 (2026-11-08)

- **Z91** zrobione: suplementy przejrzane (guard, sesja, zod, własność, FK cascade); dodano kontrolę Origin w `app/api/supplements/taken/route.ts`.
- **Z92** zrobione: `tsc` czysty, `eslint` 0 błędów, `vitest` 1552/1552 (po poprawce kontrastu `text-white/*` w `components/meal-suggestions/`).
- **Z93** niedokończone: `deploy:check` OK. E2E (dev, Turbopack): 8 zielonych, 4 czerwone, 34 pominięte. Czerwone to `page.goto` timeout/ERR_ABORTED na `/login` i `/register` (consent-no-tracking x3, registration). Hipoteza (niezweryfikowana): zimna kompilacja dev na wolnym dysku. Do zrobienia: rozgrzanie tras w `e2e/global-setup.ts` lub E2E na buildzie produkcyjnym; potem ponowny przebieg, żeby odblokować 34 pominięte.
- **Z94** zrobione: `tmp/` usunięty z indeksu git.
- **Z95** zrobione: statusy zaktualizowane.
