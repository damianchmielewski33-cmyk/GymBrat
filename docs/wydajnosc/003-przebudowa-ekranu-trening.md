# Wydajność: zadanie 003, przebudowa ekranu Trening

Data: 2026-10-24. Autor: tester-wydajnosci. Etap 9. Kod niezacommitowany (stan drzewa roboczego na gałęzi `feat/error-handling-system`).

Zakres i metoda: analiza statyczna kodu (`lib/treningi-hub-data.ts`, `lib/workout-plans-with-last-workout.ts`, `lib/plan-last-session-loads.ts`, `lib/treningi-hub-stats.ts`, `components/treningi/*`), pomiar lokalny zapytań w libSQL (plik, nie Turso), analiza grafu importów esbuildem (bez `next build`, bo brak `.env`/kosztowny; wynik jest szacunkiem dla webpacka). Nie uruchamiano przeglądarki, nie mierzono na urządzeniach, nie mierzono na Turso ani na Vercel/Render.

## SLO użyte do oceny

Istniejące SLO (`00-analiza-bazowa.md`, sekcja 2) nie obejmuje ekranu Trening. Przyjmuję (do potwierdzenia z architektem): `/workout-plan` TTFB p95 < 1,5 s (jak K5: ekran z agregacją), LCP < 2,5 s, CLS < 0,1, INP < 200 ms; maks. 7 zapytań DB na wejście; koszt odczytów mieści się w budżecie Turso Free (500 mln wierszy/mies., zob. źródło na końcu).

Model: 300 aktywnych użytkowników, 3 treningi/tydz., historia 2 lata = ok. 94 tys. wierszy `workouts` w tabeli (wszyscy użytkownicy), ok. 1 wejście na `/workout-plan` na użytkownika dziennie.

## 1. Zapytania do Turso

Liczba zapytań na `/workout-plan` (auth z JWT, bez DB): plany 2 (równolegle) + ostatnia sesja 1 (sekwencyjnie po planach, tylko gdy następny dzień był już robiony) + stats 2 (ustawienia, potem okno 12 tyg.) + zespoły 1 (+ `ensureCriticalSchema`). Razem 6 (7 z schematem), mieści się w limicie. Ścieżka krytyczna: 2 RTT (plany -> obciążenia lub ustawienia -> okno), bez zmiany względem stanu sprzed 003 (plany były sekwencyjne, ale równolegle ze stats).

Home: potwierdzone w kodzie, `getNextWorkoutPlan` korzysta z `loadWorkoutPlansWithLastWorkout` opakowanego w `React.cache`, zapytania o plany spadają z 4 do 2 w żądaniu. Zysk: -1 pełny skan `workouts` (max(date) GROUP BY) na każde wejście na Home. Uwaga: `React.cache` działa tylko w jednym żądaniu RSC; `router.refresh()` i nowa nawigacja liczą od nowa.

Brak indeksu na `workouts` (tylko PK). `EXPLAIN QUERY PLAN` (lokalny libSQL, 300 użytkowników, JSON ok. 3 KB/wiersz; skrypt `docs/wydajnosc/skrypty/003-bench-workouts-scan.mjs`):

| Zapytanie | Plan bez indeksu | 62 tys. wierszy (p50) | 156 tys. wierszy (p50) | Z indeksem `(user_id, workout_plan_id, date)` |
|---|---|---|---|---|
| max(date) GROUP BY plan (loader) | SCAN workouts + TEMP B-TREE | 160 ms | 346 ms | SEARCH COVERING INDEX, 0,2-0,4 ms |
| ostatnia sesja planu, ORDER BY date DESC, rowid DESC LIMIT 1 (003) | SCAN workouts + TEMP B-TREE | 133 ms | 298 ms | SEARCH USING INDEX, 0,08 ms |

Wniosek: zapytanie `LIMIT 1` z 003 **nie jest tanie bez indeksu**. `LIMIT 1` nie ratuje przy `ORDER BY`, bo SQLite musi przejrzeć wszystkie wiersze (skan całej tabeli wszystkich użytkowników, nie tylko danego). Skan rośnie liniowo z liczbą użytkowników razy historia, a nie z historią jednego użytkownika. 2-5 lat jednego użytkownika (ok. 300-800 wierszy) to nie jest główny czynnik; liczy się cała tabela. Z indeksem koszt zależy tylko od historii użytkownika (rzędu setek wpisów indeksu dla max(date), kilkudziesięciu dla `LIMIT 1`).

Odczyty wierszy (Turso liczy przeskanowane wiersze): na wejście na `/workout-plan` 3 skany tabeli (max(date), okno stats, ostatnia sesja) = 3 x 94 tys. = ok. 281 tys. wierszy; 003 dodaje 1 skan (+50% względem 2 skanów sprzed zmiany). Przy 300 wejściach dziennie: ok. 84 mln/dzień, ok. 2,5 mld/mies. = ok. 5x limit Free (500 mln). Z samego 003: +28 mln/dzień (+0,84 mld/mies.). Z indeksem `(user_id, workout_plan_id, date)`: ok. 0,7 tys. wierszy na wejście (okno stats nadal skanuje wpisy indeksu użytkownika), czyli ok. 0,2 mln/dzień. Uwaga: to model; rzeczywisty rozmiar tabeli produkcyjnej nieznany (do sprawdzenia w panelu Turso/`TURSO_API_TOKEN`).

Rekomendacja (do `architekt` + `backend`, osobne zadanie ze zmianą schematu, zgodnie z ADR 0002 sekcja 10): indeks `workouts(user_id, workout_plan_id, date)`; rozważyć dodatkowo `workouts(user_id, date)` dla okna stats i ok. 49 innych zapytań (D1 w analizie bazowej). Dotkliwość: wysoka dla kosztu odczytów (skala), średnia dla opóźnienia (+130-300 ms p50 na ścieżce krytycznej `/workout-plan` przy 62-156 tys. wierszy, razem z loaderem planów ok. +130-350 ms względem wariantu z indeksem).

Pozostałe zapytania 003: loader planów i obciążenia mają filtr `user_id` z sesji, `withDbRetry` (3 próby, 250 ms bazowe) wewnątrz `React.cache`; przy awarii Turso mnoży odczyty do 3x (znane, D7). Parsowanie JSON w Node: tylko 1 wiersz sesji (pierwsze 3 ćwiczenia), pomijalny CPU.

## 2. Bundle klienta

Pomiar esbuild (minify, graf importów `treningi-hub-client`, zewnętrzne: react, next, zustand, lucide, UI):

- `lib/treningi-hub-format.ts`: 4,5 KB min / 1,85 KB gzip razem z `local-date`, `progress-format`. `formatKgPl` z `set-progression-suggestion` po tree-shakingu to ok. 0,4 KB (145 B kodu progresji + 142 B `movement-profiles` + 64 B `weight-step`); sam import `formatKgPl` = 376 B min. Zastrzeżenie: esbuild tree-shake jest agresywny, webpack/Terser może zostawić kilka stałych z modułów; wpływ rzędu < 2 KB. Ryzyko z ADR (sekcja 8) praktycznie nie występuje, przeniesienie `formatKgPl` jest niepotrzebne pod kątem rozmiaru.
- **Katalog ćwiczeń JEST w bundlu klienta ekranu Trening** (wbrew założeniu w ADR sekcja 1): `lib/workout-exercise-catalog.ts` = 23,7 KB min / 6,1 KB gzip, plus `infer-muscle-category` 1,7 KB. Łańcuch: `treningi-hub-client` -> `lib/start-workout-session.ts` (`beginWorkoutFromPlanRow`) -> `lib/resolve-exercise-muscles.ts` -> `infer-muscle-category` -> katalog; drugi: `plan-days-panel` -> `lib/pdf/workout-plan-export.ts` -> `start-workout-session`. To stan **sprzed 003** (import `start-workout-session` w `treningi-hub-client` istnieje od commitu c7fc49d), 003 go nie wprowadza i nie powiększa (`summarizePlanDayMuscles` działa na serwerze i nie dokłada nic do klienta). Cały graf komponentów ekranu: ok. 61 KB min / 19 KB gzip bez bibliotek zewnętrznych. `MuscleGlyph` 2,7 KB min.
- Dodatkowa uwaga: `printWorkoutPlans` (PDF) jest importowany statycznie w `plan-days-panel.tsx`; jeśli ciągnie bibliotekę PDF, powinien być `import()` przy kliknięciu (nie zmierzone, bo moduł jest zewnętrzny w moim pomiarze). Do sprawdzenia przez `frontend` (`next build` + analiza chunków).

Rekomendacja (frontend, niski priorytet, poza zakresem 003): dynamiczny import PDF i ewentualne oddzielenie `resolveSessionCategoryId` od katalogu w ścieżce startu sesji (6 KB gzip na kliencie, w WebView na 4G ok. 50-100 ms parsowania/pobrania). Dotkliwość: niska.

## 3. Render, odświeżanie, CLS

- `MuscleGlyph`: czysty SVG (3 elementy bazowe + ścieżki), bez animacji, bez efektów, brak zależności. Liczba instancji: N dni + 1 (typowo 4-6). Koszt renderu pomijalny; re-render całego huba przy zmianie `startingPlanId`/dialogu ponownie renderuje wszystkie glify (bez `memo`), nadal rzędu mikrosekund. Brak uwag.
- Odświeżanie: `useVisibilityInterval` (tylko gdy karta widoczna, 0 żądań w tle) co 60 s wykonuje `calendarDateKey()` (jedno `Intl.DateTimeFormat`, < 0,1 ms) i woła `router.refresh()` **tylko gdy `calendarDateKey()` != `hub.week.todayKey`** oraz najwyżej raz na wartość `todayKey` (ref). Czyli normalnie 0 odświeżeń; 1 odświeżenie o północy, jeśli ekran jest otwarty. Dodatkowo hook wywołuje tick przy każdym powrocie na kartę (tanie). Ryzyko: rozjazd stref (`CALENDAR_TIMEZONE` bez `NEXT_PUBLIC_CALENDAR_TIMEZONE`, albo zły zegar telefonu) = dokładnie 1 zbędne `router.refresh()` na montaż ekranu (ok. 6 zapytań DB, ok. 0,3-1 s), bez pętli. Akceptowalne; `getCalendarTimezone()` czyta oba env, więc na produkcji z ustawionymi oboma problem znika.
- Hydratacja: `useMounted` (`useSyncExternalStore`) powoduje, że **po stronie serwera i w pierwszym renderze klienta główna karta to zawsze szkielet** (min-h 296 px), a prawdziwa karta pojawia się po hydratacji. Skutki: (a) główny element ekranu (karta Następny) nie jest w HTML z serwera, więc LCP/FCP kandydat pojawia się dopiero po pobraniu i wykonaniu JS (ok. 19 KB gzip grafu + framework), na słabym 4G/starym telefonie realnie +0,3-1,0 s do LCP (szacunek, niezmierzony); (b) CLS: przy podmianie szkielet 296 px -> karta o wysokości zależnej od wariantu (tytuł 1-2 linie, do 3 ćwiczeń po 32 px, "+ N kolejne", glif, CTA 48 px; szacunek 290-350 px). Przesunięcie poniżej karty (panel dni, narzędzia) rzędu 0-60 px; szacowany wkład CLS 0,00-0,07, czyli blisko progu 0,1 przy dłuższych tytułach i niskich ekranach. Wymaga pomiaru (Playwright/Lighthouse z throttlingiem). Szkielet z wysokością 296 px istniał przed 003; 003 zmienia zawartość karty, więc dopasowanie wysokości trzeba zweryfikować.
- Dotkliwość: średnia (LCP/CLS niezmierzone). Rekomendacja (frontend): renderować główną kartę z danych serwera (dane `nextDay` są znane w RSC), a `mounted` stosować tylko do wariantu niedokończonego treningu (store lokalny), albo ustawić szkielet o wysokości zgodnej z wariantem (np. liczba ćwiczeń z `hub`).

## 4. Limity darmowych planów

- Turso Free: 500 mln wierszy odczytanych/mies., 10 mln zapisanych, 5 GB. Sekcja 1: bez indeksu na `workouts` ekran Trening sam zużywa w modelu ok. 2,5 mld/mies., czyli ponad 5x limit; 003 dodaje ok. 1/3 tego. Wskazane zmierzyć realną liczbę wierszy w tabeli (panel admina, `TURSO_API_TOKEN`) i ustawić alert.
- 003 nie dodaje zapisów, tabel, zmiennych środowiskowych ani wywołań zewnętrznych (Upstash, Sentry, PostHog z danymi treningowymi nie dotyczą tego raportu). Vercel: bez nowych funkcji i tras; dodatkowy czas funkcji ok. +130-300 ms/wejście z powodu skanu (jedyny istotny koszt).

## Odchylenia od progów

| Obszar | Próg | Stan | Status |
|---|---|---|---|
| Zapytań DB na wejście | <= 7 | 6-7 | OK |
| Home, zapytań o plany | 4 -> 2 (ADR) | 2 potwierdzone w kodzie | OK |
| Skan `workouts` na `/workout-plan` | indeks, brak skanu | 3 skany (+1 z 003), +130-300 ms p50 przy 62-156 tys. wierszy | odchylenie, przyczyna wcześniejsza (D1) |
| Odczyty Turso/mies. | <= 500 mln | model ok. 2,5 mld (bez indeksu) | ryzyko przekroczenia, niezmierzone na produkcji |
| Bundle 003 (`formatKgPl`) | brak regresji | +ok. 0,4 KB | OK |
| Katalog w kliencie | nie ma być | jest (6,1 KB gzip), sprzed 003 | uwaga, bez regresji |
| LCP/CLS | 2,5 s / 0,1 | niezmierzone; szkielet -> karta, ryzyko CLS ok. 0-0,07 | do pomiaru |

## Werdykt

ZATWIERDZONE Z UWAGAMI. Nie stwierdzono regresji bundla ani nadmiernego odświeżania; Home zyskuje (-2 zapytania, -1 skan). Zmiana 003 dodaje jeden skan tabeli `workouts` na `/workout-plan`; w modelu szczytu nie przekracza TTFB p95 < 1,5 s (szacunek: +130-300 ms), więc nie blokuję, ale **warunek**: indeks `workouts(user_id, workout_plan_id, date)` (oraz rozważyć `(user_id, date)`) musi trafić do backlogu z terminem przed wzrostem liczby użytkowników powyżej ok. 100-300 i przed publikacją na planie Free z realnym ruchem; właściciel: architekt + backend. Brak tego indeksu = główne ryzyko kosztowe (odczyty Turso).

Uwagi do backlogu: (1) indeks `workouts` (wysoki koszt, średnie opóźnienie), architekt/backend; (2) szkielet głównej karty / LCP, frontend, średni; (3) dynamiczny import PDF i katalog w ścieżce startu sesji, frontend, niski; (4) skorygować zdanie w ADR 0002 sekcja 1 ("katalog nie trafia do bundla"), architekt, niski.

## Czego nie zmierzono

Turso (RTT, rzeczywiste odczyty, rozmiar tabeli produkcyjnej), `next build` i dokładny First Load JS (webpack może inaczej tree-shake'ować), LCP/CLS/INP w przeglądarce i na realnym urządzeniu, zachowanie WebView Androida, obciążenie k6/autocannon, wycieki pamięci. Liczby skanu pochodzą z lokalnego pliku libSQL na dysku SSD; na Turso będą inne co do wartości, ale taki sam plan zapytania (SCAN).

## Ponowny pomiar

Po dodaniu indeksu: `node docs/wydajnosc/skrypty/003-bench-workouts-scan.mjs <plik.db> 208` (oczekiwane SEARCH, < 1 ms) oraz `EXPLAIN QUERY PLAN` na kopii bazy produkcyjnej.

Źródło limitów Turso: https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan (500 mln wierszy odczytanych/mies., 10 mln zapisanych, 5 GB; do potwierdzenia w panelu).

## Delta (2026-10-24): weryfikacja indeksu `workouts` i usunięcia szkieletu

Skrypt: `docs/wydajnosc/skrypty/003-bench-workouts-indexes-delta.mjs <plik.db> 500` (300 użytkowników x 500 sesji = 150 tys. wierszy, 702 MB, JSON ok. 3 KB/wiersz, dane do 2026-10; lokalny libSQL na pliku, nie Turso; 15 powtórzeń, p50). Schemat tabeli odtworzony ręcznie, DDL indeksów identyczny jak `0032_workouts_user_indexes.sql`; nie testowano samego pliku migracji ani `ensure-schema.ts`.

### (1) Użycie indeksu, 150 tys. wierszy (p50 bez indeksu -> z oboma indeksami)

| Zapytanie (źródło) | Plan z indeksami | Czas |
|---|---|---|
| max(date) GROUP BY plan (`workout-plans-with-last-workout`) | COVERING `user_plan_date` | 269 ms -> 0,36 ms |
| ostatnia sesja planu LIMIT 1 (`plan-last-session-loads`) | `user_plan_date` (user_id, workout_plan_id), bez TEMP B-TREE | 329 -> 0,08 ms |
| okno 12 tyg. (`treningi-hub-stats`) | `user_date` (zakres daty) | 244 -> 0,67 ms |
| Home: seria 52 tyg. (`home-stats`/`streaks`), count distinct (`weekly-sessions`), cardio (`home-start`) | COVERING `user_date` | 175-272 -> 0,08-0,42 ms |
| Home: ostatnie 40 (`home-start`), ghost 5/3 (`ghost-training/targets`) | `user_date` / `user_plan_date` | 193-280 -> 0,10-1,35 ms |

Wszystkie 9 zapytań przeszły z SCAN na SEARCH. Zapytanie z `plan-last-session-loads` (WHERE user_id AND workout_plan_id ORDER BY date DESC, rowid DESC LIMIT 1) używa `idx_workouts_user_plan_date`; w planie nie ma już TEMP B-TREE (rowid jest ostatnim, niejawnym kluczem indeksu). Ścieżka krytyczna `/workout-plan` lokalnie: ok. 1,2 ms zamiast ok. 800 ms (3 skany).

### (2) Koszt zapisu
Tabela ma 3 indeksy B-tree zamiast 1 (autoindeks PK `id` + 2 nowe). INSERT (300 prób na tabelach 20 tys. wierszy, p50): 7,29 ms (1 idx), 7,39 ms (2), 7,56 ms (3), czyli +0,27 ms (+3,7%); wynik zdominowany przez commit/fsync, p95 szumi (27-128 ms, nieistotne). Rozmiar indeksów ok. 30-40 B/wiersz (szacunek), czyli ok. 5-6 MB każdy przy 150 tys. wierszy wobec 702 MB tabeli (<2% na indeks). Turso zlicza zapisy indeksów jako wiersze zapisane: 1 trening = ok. 3 wiersze zamiast 1; przy 300 użytkownikach x 3 treningi/tydz. to ok. 4 tys. treningów/mies. = ok. 12 tys. zapisanych wierszy wobec limitu 10 mln (0,1%). Zapis serii w trakcie sesji idzie przez store lokalny, nie przez INSERT na każdą serię. Narzut pomijalny.

### (3) Model odczytów Turso po zmianie
Wejście na `/workout-plan`: max(date) ok. 312 wpisów indeksu (3 treningi/tydz. x 104 tyg.), ostatnia sesja <= ok. 62 + 1 wiersz tabeli, okno stats ok. 36 indeks + 36 tabela, plany ok. 10 = ok. 500 wierszy (było ok. 281 tys.; spadek ok. 560x). 300 wejść/dzień x 30 = 9 tys. wejść -> ok. 4,5 mln wierszy/mies. (ok. 0,9% limitu 500 mln; było ok. 2,5 mld). Home: ok. 1 tys. wierszy/wejście -> ok. 9 mln/mies. (ok. 2%). Razem ekran Trening + Home ok. 14 mln/mies. (ok. 3%) przy tym modelu; reszta tabeli `workouts` (raporty, postępy, historia: ok. 49 zapytań po `user_id`) także przestaje skanować całą tabelę. Zastrzeżenie: sposób zliczania indeksów przez Turso i rozmiar tabeli produkcyjnej niezmierzone; model zakłada 300 użytkowników.

### (4) Szkielet i CLS
`treningi-hub.tsx` renderuje teraz `NextWorkoutCard`/`NoPlanCard` z danych RSC od razu (w kodzie brak szkieletu); `useMounted` zostaje tylko dla `unfinished`. Kandydat LCP (tytuł/karta) jest w HTML serwera, więc oszacowany wzrost LCP +0,3-1,0 s znika. Pozostały CLS: podmiana Następny -> Niedokończony tylko u użytkowników z aktywną sesją w store. Szacunek wysokości (z klas Tailwind, niezmierzony w przeglądarce): Następny z 3 ćwiczeniami i tytułem 1 linia ok. 305-310 px, z tytułem 2-liniowym ok. 335 px, z 1-2 ćwiczeniami ok. 255-280 px; Niedokończony: treść ok. 245-265 px, wymuszone min-h 296 px. Różnica -15 do +40 px względem poprzedniej karty, przesuwa sekcje poniżej; szac. CLS 0,00-0,04 (poniżej 0,1) i tylko dla mniejszości; typowy użytkownik bez niedokończonej sesji ma CLS 0. Wariant `compact:` ma min-h-0 i inne wysokości (niezmierzony). Rekomendacja drobna (frontend, niska): dopasować min-h do wariantu (np. 310 px) po pomiarze Playwrightem.

### (5) Indeks `(user_id, date)`
Ma realne użycie: planer wybiera go dla 6 z 9 zapytań (okno stats, seria 52 tyg., count distinct, cardio Home, ostatnie 40, ghost 5), często jako covering. Bez niego te zapytania szłyby przez `user_plan_date` (prefiks `user_id`) i dla każdego wiersza użytkownika sięgały do tabeli z JSON 3 KB (np. okno stats: ok. 312 odczytów tabeli zamiast ok. 36; Home ostatnie 40: 4,9 ms vs 1,35 ms; ten sam wzorzec z `TEMP B-TREE`). Nie jest redundantny (`user_plan_date` ma `workout_plan_id` jako 2. kolumnę, więc nie obsługuje zakresu po dacie). Zalecenie: zostawić, nie usuwać. Nie zmierzono wariantu tylko `(user_id, date)` (pozostawienie samego `user_plan_date` nie daje `LIMIT 1` bez sortowania, więc nie jest dobrą alternatywą).

### Odchylenia po delcie

| Obszar | Próg | Stan | Status |
|---|---|---|---|
| Skan `workouts` na `/workout-plan` | brak skanu | 0 skanów, 9/9 zapytań SEARCH | OK |
| TTFB `/workout-plan` | p95 < 1,5 s | zapytania DB < 2 ms lokalnie; reszta to RTT Turso (niezmierzone) | OK (bez pomiaru na Turso) |
| Odczyty Turso/mies. | <= 500 mln | model ok. 14 mln (ekran + Home) | OK |
| Narzut zapisu | brak regresji | +0,27 ms/INSERT, +2 wiersze zapisane | OK |
| LCP | < 2,5 s | karta główna w HTML serwera | OK z kodu, niezmierzone |
| CLS | < 0,1 | 0 (typowy), szac. <= 0,04 przy niedokończonym treningu | OK z kodu, niezmierzone |

Werdykt delty: warunek z raportu spełniony; SLO ekranu Trening dotrzymane w modelu. ZATWIERDZONE (z uwagami resztkowymi: brak pomiaru na Turso/realnym urządzeniu, brak LCP/CLS w przeglądarce, rozmiar tabeli produkcyjnej nieznany; migracja `CREATE INDEX` na dużej tabeli produkcyjnej blokuje zapis na czas budowy, ok. kilka sekund przy 150 tys. wierszy, uruchomić poza szczytem).
