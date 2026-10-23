# Stan testów i jakości GymBrat (baza wiedzy)

Data: 2026-10-23, gałąź `feat/error-handling-system`. Dokument informacyjny, bez zmian w kodzie.

## 1. Narzędzia i konfiguracja

| Obszar | Narzędzie | Konfiguracja |
|---|---|---|
| Unit/integracja | Vitest 2.1.9 | `vitest.config.ts`: środowisko `node`, `include: ["**/*.test.ts"]`, `globals: false` (importuj `describe/it/expect` z `vitest`), alias `@` -> korzeń repo. Brak setupu, brak jsdom, brak pokrycia (coverage), brak testów `.tsx`. |
| E2E | Playwright 1.59 | `playwright.config.ts`: `testDir ./e2e`, `baseURL` = `PLAYWRIGHT_BASE_URL` lub `http://127.0.0.1:3000`, retries 2 na CI, trace on-first-retry. Brak `webServer` (serwer trzeba uruchomić ręcznie), brak projektów mobilnych/przeglądarek, brak testów wizualnych. |
| Lint | ESLint 9 + `eslint-config-next` (reguły React Compiler/react-hooks) | `eslint.config.*` |
| Typy | `tsc --noEmit` | `tsconfig.json` |
| Java | JUnit/Spring | `java-backend/src/test/java/pl/gymbrat/backend/ApiIntegrationTest.java` (jedyny test) |
| Deploy | `scripts/check-gymbrat-deploy.mjs` | `npm run deploy:check` |

Uruchamianie:
- Unit: `npm test` (`vitest run`); pojedynczy plik: `npx vitest run lib/local-date.test.ts`.
- E2E: `npm run build && npm start` (lub `npm run dev`) na porcie 3000, potem `npm run test:e2e`. Inny host: `PLAYWRIGHT_BASE_URL=https://preview... npm run test:e2e`. Wymaga bazy (libSQL/Turso) i zmiennych środowiska aplikacji. `e2e/diet-admin-session.spec.ts` jest pomijany (skip) bez `E2E_EMAIL` i `E2E_PASSWORD`.
- Przed merge: `npm run deploy:check`.
- Brak CI w `package.json` poza zachowaniem `process.env.CI`; skrypty pomocnicze w `scripts/` (codemody, db-reset, APK) nie mają testów.

## 2. Inwentarz testów

Razem 103 pliki Vitest (592 testy), 2 pliki Playwright (smoke: 3 testy, diet-admin-session: 1 test warunkowy), 1 test Javy.

| Obszar | Pliki testów | Uwagi |
|---|---|---|
| Cardio | `lib/cardio-metrics`, `cardio-validation`, `cardio-week-stats`, `cardio-device-photo`, `extra-cardio-from-macros`, `workout-cardio-attribution` `.test.ts` | okno 7 dni pokryte w `cardio-week-stats`; `lib/cardio.ts` (DB) bez testów |
| Żywienie | `lib/nutrition-day-balance`, `nutrition-week-stats`, `food-macro-source`, `food-products`, `food-products-remote`, `meal-catalog`, `meal-catalog-import`, `meal-templates`, `diet-*` (recipe-match, slot-map, training-weeks), `actions/meal-log-parse.test.ts` | brak testów: `nutrition-goals.ts`, `kcal-from-macros.ts`, `food-nutrition.ts`, `nutrition-dashboard.ts`, `actions/meal-log.ts`, `food-lookup.ts` |
| Trening | `lib/workout-*` (session-calculations, plan-compare, plan-queue, plan-upload, finish-format, skipped-sets, exercise-rename, history-overview), `set-*`, `live-set-coach`, `last-workout-hints`, `start-workout-session`, `active-workout-persist`, `stores/active-workout-add-set`, `exercise-*`, `week-training-compare`, `weight-step`, `intensity-analysis`, `ghost-training/deltas` | akcje `actions/workout.ts`, `workout-plan.ts` bez testów |
| Import planów | `lib/pdf/*`, `lib/docx/*`, `lib/excel/*` | dobrze pokryte |
| Postępy/analityka | `lib/analytics/*` (4), `progress-delta-unit`, `briefing-heuristic`, `live-coach/*` | |
| Społeczność | `lib/community/*` (fcs, hof-*, reputation, team-war-score, progression-curve, notifications-group, friend-types), `achievements` | tylko czyste funkcje; akcje `actions/teams|friendships|challenges|community-*` bez testów |
| Auth/bezpieczeństwo | `lib/auth-public-paths`, `auth-session-cookie`, `csrf`, `action-guard`, `rate-limit`, `google-auth`, `app-field-crypto`, `consent-preferences` | `proxy.ts`, `auth.ts`, `actions/auth.ts` bez testów |
| Daty | `lib/local-date.test.ts` | jedyny test stref/dat; brak testów granic DST/północy |
| Konfiguracja/deploy | `lib/admin-config-status`, `deploy-changelog`, `gymbrat-source`, `java-api`, `android-version`, `trigger-android-apk-build`, `pwa-update`, `app-branding` | |
| Błędy/DB | `lib/errors/{api,catalog}`, `db/resilient-client`, `db/with-retry` | |
| Inne | i18n, haptics, youtube-url, itp. | |
| E2E | `e2e/smoke.spec.ts` (login, `/api/android/version`, `/api/version`), `e2e/diet-admin-session.spec.ts` | brak E2E: zapis treningu, posiłek, postępy, rejestracja |

Nie ma testów: `app/api/**` (handlery), `actions/**` poza `meal-log-parse`, `components/**`, `hooks/**`, `proxy.ts`, `db/schema`/migracje, `scripts/**`, ścieżki Java vs TS.

## 3. Linia bazowa (2026-10-23)

| Polecenie | Wynik |
|---|---|
| `npx tsc --noEmit` | ZALICZA, 0 błędów |
| `npm run lint` | NIE ZALICZA: 154 problemy (114 błędów, 40 ostrzeżeń). Dominują błędy React Compiler/react-hooks: ok. 106 "Calling setState synchronously within an effect" / "Cannot access refs during render" (komponenty), 4x `react/jsx-key`, 2x `prefer-const` (m.in. `lib/meal-catalog-images.ts:304`). Ostrzeżenia: nieużywane importy/zmienne (np. `lib/community/activity-feed.ts`, `team-wars.ts`, `public/client-hardening.js`). |
| `npm test` | NIE ZALICZA: 4 pliki nieudane z 103; 3 testy nieudane, 589 przeszło z 592; ok. 33 s |

Nieudane testy Vitest:
1. `lib/android-version.test.ts` (2 testy): oczekiwany versionCode 11 / versionName `0.1.10`, faktycznie 12 / `0.1.11` - test twardo zakodowanej wersji, nieaktualny po podbiciu wersji Androida (defekt testu, kruchy).
2. `lib/app-field-crypto.test.ts`: `Failed to load url server-only` - brak aliasu/mocka `server-only` w Vitest.
3. Pliki, które nie ładują się z tej samej przyczyny (`import "server-only"`): `lib/cardio-device-photo.test.ts`, `lib/home-start.test.ts` (przez zależność). Czyli 0 testów z tych plików faktycznie się nie wykonuje.

Defekty do zgłoszenia `backend`/`frontend`: brak aliasu `server-only` w `vitest.config.ts` (21 plików w `lib` importuje `server-only`, więc każdy kolejny test takiego modułu padnie), nieaktualne asercje wersji Androida, 114 błędów lint (blokują, jeśli lint jest bramką).

## 4. Obszary najwyższego ryzyka bez testów

1. Autoryzacja i izolacja danych: `proxy.ts`, `app/api/**`, `actions/**` (brak testów, że użytkownik widzi tylko swoje dane, brak testów roli admin + PIN).
2. Zapis treningu i idempotencja (`actions/workout.ts`, `app/api/active-workout-session`, `app/api/workouts`): ponowione żądania, dwa urządzenia, sync offline.
3. Cele kaloryczne/makra dzień treningowy vs odpoczynku: `lib/nutrition-goals.ts`, `kcal-from-macros.ts`, `actions/meal-log.ts`.
4. Dwie ścieżki backendu (Java vs TS): `lib/java-api.ts` ma test jednostkowy, ale brak testów kontraktowych obu ścieżek; Java ma jeden test integracyjny.
5. Usuwanie konta, eksport danych, wycieki w logach (`app/api/user`, `app/api/security`).
6. Rejestracja/logowanie kodem e-mail, OAuth, wygasły kod (`actions/auth.ts`, `auth.ts`).
7. Daty/strefy: tylko `local-date.test.ts`; brak granic północy, DST i okna 7 dni przy zmianie strefy.
8. Komponenty UI i dostępność: brak jakichkolwiek testów komponentów, brak regresji wizualnej, brak E2E mobilnego.
9. Schemat i migracje (`db/schema.ts`, `db/migrations`).

## 5. Rekomendowane konwencje

- Lokalizacja: test obok kodu, `<moduł>.test.ts` (tak jest w całym repo); jedna wartość: `*.test.ts` (Vitest nie zbiera `.tsx`, `include` trzeba rozszerzyć, jeśli powstaną testy komponentów).
- Nazewnictwo: `describe("<nazwaFunkcji>")`, `it("<opis po polsku>")`, import jawny z `vitest` (globals wyłączone). Polskie nazwy przypadków jak w istniejących testach.
- Logikę liczącą trzymaj w czystych funkcjach w `lib/` (bez DB) i testuj ręcznie policzonymi przykładami oraz wartościami brzegowymi (0, ujemne, duże, polskie znaki, brak danych).
- Mocki bazy: wzorzec w `db/resilient-client.test.ts` i `db/with-retry.test.ts` (podmiana klienta/`vi.mock("@/db")`); nie łącz się z prawdziwym Turso w unit testach.
- Moduły z `import "server-only"`: dodać alias w `vitest.config.ts` na pusty stub albo `vi.mock("server-only", () => ({}))` (do zrobienia przez `backend`; obecnie blokuje 3 pliki).
- Czas: `vi.useFakeTimers()`/`vi.setSystemTime`, jawne daty `YYYY-MM-DD`, bez zależności od strefy maszyny (testy DST/północy z ustawionym `TZ`).
- Unikaj twardego kodowania wersji/danych zmiennych (por. `android-version.test.ts`).
- E2E: pliki `e2e/<przepływ>.spec.ts`, role/etykiety zamiast selektorów CSS, dane logowania z `E2E_EMAIL`/`E2E_PASSWORD` z `test.skip`, bez sleepów; krytyczne ścieżki do dodania: logowanie, zapis treningu, dodanie posiłku, postępy; rozważyć `webServer` w `playwright.config.ts` oraz projekty mobilne i zrzuty wizualne.
- Bramka przed PR: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run deploy:check`.
