# Bezpieczeństwo: zadanie 003 - przebudowa ekranu Trening (etap 9)

- Data: 2026-10-24, autor: tester-bezpieczenstwa (przegląd kodu, bez ataków na produkcję, bez uruchamiania aplikacji)
- Zakres: `lib/workout-plans-with-last-workout.ts`, `lib/plan-last-session-loads.ts`, `lib/treningi-hub-data.ts`, `lib/plan-day-muscles.ts`, `lib/home-start.ts` (`getNextWorkoutPlan`), `actions/workout-plan.ts` (`getWorkoutPlansWithLastWorkout`), `components/treningi/*`, `workout-plan-page-content.tsx`
- Wejście: ADR 0002, bramka prawna LR-1..LR-8, `docs/zespol/wiedza-o-projekcie.md`

## Model zagrożeń (STRIDE, skrót)
Aktywa: plany treningowe i ciężary z historii sesji użytkownika (dane o aktywności, wrażliwe wg standardu zespołu). Aktorzy: zalogowany użytkownik (atakujący BOLA), anonim. Granice zaufania: przeglądarka - RSC - Turso. Zmiana nie dodaje tras `app/api/**`, server actions z parametrami klienta ani zmian API Android/Java; jedyny punkt wejścia to `userId` z `auth()` w `page.tsx`.

## Wyniki

| # | Obszar | Wynik |
|---|---|---|
| 1 | IDOR/BOLA | OK. Oba zapytania loadera filtrują `workouts.userId` i `workoutPlans.userId`; `getLastSessionLoadsForPlan` ma `userId` AND `workoutPlanId`, a `planId` pochodzi z wyniku serwera (`next.id`), nie od klienta. `getWorkoutPlansWithLastWorkout` bierze id wyłącznie z `auth()`; brak parametrów klienta w nowych modułach. Id ćwiczeń z planu służą tylko do dopasowania w pamięci, nie trafiają do SQL. |
| 2 | `userId` w `getTreningiHubData` / loaderze | OK. Brak eksportu z pliku `"use server"` (loader w `lib/`, `server-only`), więc nie jest wywoływalny jako akcja z klienta. |
| 3 | Granica server-only | OK. `treningi-hub-data`, `plan-last-session-loads`, `workout-plans-with-last-workout` mają `import "server-only"`; w `components/treningi` importowane są z nich wyłącznie `import type`. `muscle-glyph.tsx` importuje z `plan-day-muscles` tylko typy. Wyjątek `workout-plan-page-content.tsx` to RSC. Uwaga informacyjna: katalog ćwiczeń i tak jest w bundlu przez `lib/start-workout-session.ts` -> `resolve-exercise-muscles` (istniejące zachowanie, dane publiczne, dla wydajności). |
| 4 | `React.cache` | OK. Klucz = `userId` (argument), pamięć tylko w obrębie jednego żądania; brak `unstable_cache`/globalnego Map. Akcja zwraca kopię tablicy; `buildTreningiHubDays` i `pickNextWorkoutPlan` nie mutują wejścia. |
| 5 | Dane wrażliwe w logach/Sentry/PostHog (LR-1) | OK. W nowych plikach brak `console.*`, `captureException`, `track`; błędy parsowania JSON (plan, sesja) są połykane bez treści; `withDbRetry` bez `label`. PostHog w repo jest wyłącznie serwerowy (`lib/analytics/posthog.ts`, zdarzenia Community); brak `posthog-js`, autocapture ani nagrywania sesji, więc ekran Trening nie wysyła danych treningowych. Zamyka to pytanie otwarte prawnika. Zastrzeżenie: nie weryfikowano konfiguracji Sentry Replay/breadcrumbs w `instrumentation*`/`sentry.*` w czasie działania. |
| 6 | XSS | OK. Brak `dangerouslySetInnerHTML` w `components/treningi`. Nazwy planów i ćwiczeń trafiają do tekstu JSX, `aria-label` i `sr-only` (React koduje). `MuscleGlyph` rysuje SVG ze stałej geometrii, bez danych użytkownika; `href` kafelków to stałe ścieżki. |
| 7 | Odporność parsowania JSON | OK. `JSON.parse` w try/catch (plan i sesja); `normalizeWorkoutPlan` odrzuca niepoprawny plan; sesje filtrowane do obiektów, wartości przez `toFiniteNumber`, odrzucane ujemne/NaN; brak kluczy ze sparsowanych danych w obiektach pośrednich (wynik indeksowany `planExercise.id` z planu użytkownika w `Record`; niski teoretyczny wektor `__proto__` jako id ćwiczenia - patrz N-1). |
| 8 | Zależności i sekrety | Brak zmian w `package.json`, `package-lock.json`, `java-backend/`, workflow; brak nowych zależności ani zmiennych env. Skan wzorców sekretów w plikach 003: czysto. `npm audit --omit=dev`: 1 high (zod, GHSA-mrhx-c7xc-m3w5, wyczerpanie pamięci przy walidacji dużych kolekcji) - istniejące, niezwiązane z 003 (patrz N-2). |

## Uwagi
- N-1 (niska, CWE-1321): `out[planExercise.id] = load` w `extractExerciseLastLoads` zapisuje do zwykłego obiektu pod kluczem z planu użytkownika. Id ćwiczenia `__proto__` ustawia prototyp tylko lokalnego obiektu wyniku (brak globalnego prototype pollution, wpływ ograniczony do własnych danych autora). Hardening: `Object.create(null)` albo `Map`. Właściciel: backend.
- N-2 (średnia, poza zakresem 003, CWE-1395): podatność zod w produkcyjnych zależnościach - `npm audit fix` w osobnym zadaniu. Właściciel: backend. Nie blokuje 003.
- N-3 (informacyjna): zapytanie `rowid desc` w `getLastSessionLoadsForPlan` jest stałym SQL, bez interpolacji wejścia.

## Podatności krytyczne i wysokie w zakresie 003
Brak.

## Ryzyka resztkowe i zakres nieprzetestowany
- Nie uruchamiano aplikacji ani DAST, nie wykonano testów ról na żywej instancji (test filtra `user_id` opiera się na istniejących testach `workout-plans-with-last-workout.test.ts` i przeglądzie kodu).
- Nie sprawdzano konfiguracji Sentry (Replay, breadcrumbs) ani nagłówków CSP w `next.config.ts` dla tej trasy; nie sprawdzano ścieżki startu treningu grupowego (kod istniejący, bez zmian w 003).
- Wydajność zapytań bez indeksu `user_id` (pełny skan) to temat `tester-wydajnosci`.

## Werdykt: ZATWIERDZONE Z UWAGAMI
Uwagi niskiego ryzyka: N-1 (hardening), N-2 (zależność poza zakresem; do backlogu backend). Brak sygnałów do `prawnika` poza potwierdzeniem, że PostHog nie zbiera danych z tego ekranu.

## Delta etapu 9 (wiersze 6c, 6d: indeksy, N-1, usunięcie szkieletu) - 2026-10-24
Zakres: `db/migrations/0032_workouts_user_indexes.sql`, `db/schema.ts`, `_journal.json`, `db/ensure-schema.ts`, `lib/plan-last-session-loads.ts`, `components/treningi/*`, `lib/treningi-hub-data.ts`. Analiza statyczna kodu, bez DAST.

| # | Obszar | Wynik |
|---|---|---|
| D1 | Migracja i ensure-schema | OK. Dwa `CREATE INDEX IF NOT EXISTS` ze stałym SQL (brak interpolacji), tylko DDL indeksów na istniejącej tabeli `workouts` - brak zmiany danych, brak nowych uprawnień ani tabel. Idempotentne; kolumny (`user_id`, `workout_plan_id`, `date`) zgodne ze schematem. Wyścig równoległych instancji Vercel: `IF NOT EXISTS` + `withDbRetry`, w skrajnym przypadku jedna instancja ponawia i trafia na istniejący indeks; brak ryzyka uszkodzenia. Jednorazowa blokada zapisu przy budowie indeksu na dużej tabeli (dostępność, nie poufność) - temat wydajności. Journal: wpis idx 25 spójny z plikiem SQL; nazwy indeksów identyczne w schema/SQL/ensure (brak dryfu). |
| D2 | N-1 | ZAMKNIĘTE po stronie serwera: `Object.create(null)`, test potwierdza własny klucz `__proto__` (`lib/plan-last-session-loads.test.ts:129-136`), prototyp wyniku nietknięty, brak pollution. |
| D3 | Usunięcie szkieletu / wyciek przed uwierzytelnieniem | OK. `app/(dashboard)/workout-plan/page.tsx`: `auth()` przed renderem, brak sesji -> `redirect("/login")`; `userId` wyłącznie z sesji, przekazywany do `getTreningiHubData`, `getTreningiHubStats`, `listUserTeamsForGroupStart`. Strona zależna od `auth()` (cookies) jest dynamiczna, brak `force-static`/`revalidate`/`use cache` na trasie; fallback Suspense (`DashboardRouteSkeleton`) nie zawiera danych użytkownika. Layout bez sesji renderuje tylko `AuthPageFrame`. Brak ryzyka cache współdzielonego z danych tej trasy (nie weryfikowano nagłówków CDN na żywej instancji). |
| D4 | Dane serializowane do klienta (`hub`, `stats`, `teams`) | OK z uwagą. Do klienta trafiają: wszystkie plany użytkownika z pełną listą ćwiczeń (`days[].row.plan.exercises`, potrzebne do startu treningu i podglądu dnia - `beginWorkoutFromPlanRow`, `PlanDayPreviewSheet`), daty ostatnich treningów, podsumowanie mięśni, statystyki tygodnia oraz ciężary tylko następnego dnia i tylko dla pierwszych `NEXT_CARD_EXERCISE_PREVIEW` ćwiczeń (minimalizacja, tylko dane zalogowanego). Brak cudzych danych, brak `userId` innych osób, brak surowego JSON sesji (`workouts.exercises` nie opuszcza serwera). Nadmiar: pełne plany wszystkich dni wymagane funkcjonalnie (podgląd/start bez kolejnego żądania); zgodnie z ADR akceptowalne - do potwierdzenia przez `prawnika`, że plany nie są daną o zdrowiu (nie zawierają wagi/pomiarów). |
| N-4 | Odczyt po kluczu na kliencie | Niska (CWE-1321), tylko własne dane. Po serializacji RSC `nextLastLoads` na kliencie jest zwykłym obiektem (prototyp wraca). `lastLoads[ex.id]` w `next-workout-card.tsx:108` dla ćwiczenia o id `__proto__`/`constructor`/`toString` bez zapisanego obciążenia zwróci wartość odziedziczoną (truthy) i `formatLastLoadAria` dostanie nie-obiekt `ExerciseLastLoad` (błędna etykieta, brak pollution, brak wycieku). Hardening: `Object.hasOwn(lastLoads, ex.id)` albo przekazywanie `Map`/tablicy par. Właściciel: frontend. Nie blokuje. |

Nowe podatności krytyczne i wysokie: brak. Ryzyka resztkowe: brak DAST, nagłówków cache CDN i działania migracji na kopii produkcyjnej nie sprawdzano.

### Werdykt delty: ZATWIERDZONE Z UWAGAMI (N-4 niska, backlog frontend; N-1 zamknięte serwerowo)
