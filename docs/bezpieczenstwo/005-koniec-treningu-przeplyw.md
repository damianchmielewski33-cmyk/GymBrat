# 005 - Koniec treningu: przegląd bezpieczeństwa (etap 9, tester-bezpieczenstwa)

- **Zadanie**: `docs/zadania/005-koniec-treningu-przeplyw.md`, etap 9 (część bezpieczeństwo). Pierwszy przebieg w tym zadaniu.
- **Gałąź**: `feat/koniec-treningu-flow` (stan roboczy na dysku, bez commitów).
- **Data**: 2026-10-25
- **Zakres kodu**: `app/api/workouts/[workoutId]/cardio/route.ts` (PATCH, nowy), `app/api/workouts/complete/route.ts` (POST, dedup `operationId`), `app/api/active-workout-session/route.ts` (GET/PUT/DELETE, CAS, rewizja DELETE), `lib/active-workout-cloud.ts`, `lib/active-workout-cloud-client.ts`, `lib/workout-plan-compare.ts`, `lib/workout-skipped-sets.ts`, `lib/workout-operation-id.ts`, `lib/ghost-training/timeline.ts` (wpływ reguły bodyweight), `components/active-workout/use-workout-finish-flow.ts` i `active-workout-cloud-sync.tsx` (logowanie), `lib/errors/api.ts`, `lib/errors/server-log.ts`, `lib/errors/app-error.ts` (ścieżka logowania błędów).
- **Metoda**: przegląd kodu (czytanie, nie zakładanie), macierz ról (anonim / zalogowany właściciel / zalogowany inny użytkownik), weryfikacja mechanizmu w kodzie bibliotek (`node_modules/drizzle-orm` 0.45.2), dowód na lokalnej bazie in-memory libSQL z danymi syntetycznymi, `npx vitest run app/api/workouts app/api/active-workout-session` (34/34 OK), `npm audit --omit=dev` (0 podatności), skan sekretów w zmienionych plikach (brak trafień).

## 1. Werdykt

**Przebieg 2 (retest po poprawce F-1, 2026-10-25): ZATWIERDZONE Z UWAGAMI.** Szczegóły i warunki w sekcji 9. Krótko: F-1 (WYSOKA) zamknięte dla każdej ścieżki, którą kod repozytorium faktycznie uruchamia (prawdziwy `DrizzleQueryError` nie trafia do konsoli ani do zdarzenia Sentry). Pozostają: R-1 (NISKA, obrona w głąb, nieosiągalna w obecnym kodzie), F-1b/F-1c (NISKA, ten sam wzorzec w `withDbRetry` i w starcie aplikacji), F-2 (informacyjne), F-3 (ŚREDNIA, integralność, otwarte: patrz sekcja 9.4 — decyzja koordynatora, czy to dopuszcza `ZATWIERDZONE Z UWAGAMI`).

---

**Przebieg 1 (poprzedni werdykt, zachowany dla historii): ODRZUCONE.**

Powód: **F-1 (WYSOKA)** - dane treningowe i zdrowotne (ciężary, powtórzenia, tętno, kalorie, kroki z cardio) trafiają do logów serwera i do Sentry, gdy zapis do bazy kończy się błędem. Narusza to wprost LR-6 (`docs/prawo/005-koniec-treningu-przeplyw-wejscie.md`) i standard "dane o ciele nie w logach/Sentry". Problem jest systemowy (istniał przed tym zadaniem), ale dotyczy trzech ścieżek, które to zadanie zmienia lub dodaje: `POST /api/workouts/complete`, `PATCH /api/workouts/[workoutId]/cardio`, `PUT /api/active-workout-session`.

Pozostałe ustalenia: jedno średnie dotyczące dokumentacji reguły Ghost (F-2, wymaga korekty ADR i 004 LR-8(d)), jedno średnie integralnościowe (F-3, dedup gubi treść przy tym samym `operationId`, już w backlogu testera N-7h-2), reszta niska.

Poprawki wykonuje `backend` (nie ja). Po poprawce wykonam retest F-1 i kontrolę F-2/F-3.

Ustalenia kontrolne, które przeszły (nie są podatnościami): autoryzacja cardio PATCH (404 dla cudzego i nieistniejącego rekordu, test w `app/api/workouts/[workoutId]/cardio/route.test.ts`), izolacja `userId` w dedup `POST /complete`, brak IDOR w `/api/active-workout-session` (klucz wiersza to wyłącznie `session.user.id`), CSRF na PATCH/PUT/DELETE, Zod na wszystkich trzech wejściach, brak mass assignment, brak `dangerouslySetInnerHTML` w kodzie, `npm audit` (prod) bez podatności.

## 2. Model zagrożeń (skrót, STRIDE)

| Aktywo | Aktorzy | Granica zaufania | Główne wektory |
|---|---|---|---|
| Rekordy `workouts` (ciężar, powtórzenia, cardio, tętno) | właściciel, inny zalogowany użytkownik, anonim | body żądania → Zod → Drizzle | IDOR przez `workoutId`/`operationId`/`workoutPlanId`; wyciek przez logi/Sentry |
| Wiersz `active_workout_sessions` (sesja w toku) | właściciel na wielu urządzeniach | body PUT/DELETE, odpowiedź 409 | cudzy wiersz (brak: klucz to sesja); manipulacja rewizją (self-DoS); nadmiarowy payload |
| Logi serwera i Sentry | operator, dostawca Sentry | `withApiErrors` → `logServerError` → `captureException` | wyciek parametrów zapytań SQL |
| Ghost Training (oś czasu) | rywale | `timeline.ts` → widok rywala | rozszerzenie widoczności serii masy ciała |

Aktorzy: anonim (bez sesji), zalogowany właściciel, zalogowany obcy użytkownik, osoba z dostępem do logów/Sentry.

## 3. Macierz ról i uprawnień (wynik testu ręcznego przez czytanie kodu)

| Endpoint | Anonim | Właściciel | Obcy użytkownik | Wynik |
|---|---|---|---|---|
| `PATCH /api/workouts/[id]/cardio` | 401 (po CSRF i RL) | 200, zmiana własnego wiersza | 404 (ten sam komunikat co dla nieistniejącego) | OK, LR-4 spełnione |
| `POST /api/workouts/complete`, `operationId` istnieje u innego użytkownika | 401 | dedup tylko w obrębie własnych wierszy | ten sam `operationId` tworzy WŁASNY wiersz (indeks `(userId, operationId)`), brak odczytu cudzego | OK, brak cross-tenant |
| `POST /complete`, `workoutPlanId` innego użytkownika | 401 | 200 | 400 `workoutPlanMismatch` (sprawdzenie własności PRZED dedup) | OK |
| `GET/PUT/DELETE /api/active-workout-session` | 401 | własny wiersz | nie istnieje wiersz obcy: zapytanie po `session.user.id` | OK, brak IDOR |

## 4. Ustalenia

### F-1 (WYSOKA) Dane treningowe i zdrowotne w logach serwera i w Sentry przez komunikat błędu bazy

- **Opis**: `drizzle-orm` 0.45.2 owija każdy błąd zapytania SQLite/libSQL w `DrizzleQueryError`, którego komunikat ma postać `Failed query: <SQL>\nparams: <wartości>` (`node_modules/drizzle-orm/errors.js:10-16`; `sqlite-core/session.js:43-100`; `libsql/session.js` dziedziczy po `SQLiteSession`). Parametry to pełne wartości wstawiane do bazy, w tym JSON `exercises` z ciężarami, powtórzeniami i obiektem `cardio` (tętno, kalorie, kroki) oraz całe `payloadJson` sesji aktywnej.
- Ścieżka: `withApiErrors` (`lib/errors/api.ts:171-183`) → `toAppError` (`lib/errors/app-error.ts:101-135`: dla błędu ogólnego `message: err.message`, dla `UNAVAILABLE_HINT` także `message: err.message`) → `logServerError` (`lib/errors/server-log.ts:75-115`): `console.error(line)` z pełnym `message`, `console.error` ze `stack` (stack zawiera ten sam komunikat), oraz `captureToSentry` → `Sentry.captureException(original)` (`server-log.ts:53-72`, `sendDefaultPii: false` w `lib/sentry-init.ts:26` NIE usuwa treści wyjątku).
- Dodatkowo: w `PATCH cardio` `JSON.parse(exercisesJson)` (`lib/workout-plan-compare.ts:254`) przy uszkodzonym JSON zwraca `SyntaxError` z fragmentem danych w komunikacie; `toAppError` mapuje go na `INVALID_JSON` z `message: err.message` i loguje to `console.warn` (4xx). Skutek mniejszy (własne dane, tylko log), ale ta sama klasa.
- **Dowód (wykonany)**: skrypt `C:/Users/damia/AppData/Local/Temp/claude/D--Projekty-GymBrat/be781d14-c0e8-4e8b-bd93-e21f569cc279/scratchpad/proof/drizzle-params-leak.mjs` na bazie `:memory:` libSQL z DANYMI SYNTETYCZNYMI (wymuszony błąd NOT NULL na `user_id`). Wynik:
  ```
  Failed query: insert into "workouts" ("id", "user_id", "exercises") values (?, ?, ?)
  params: t-1,,{"kind":"completed_session","exercises":[{"name":"SYNTH-EX","sets":[{"reps":7,"weight":33}]}],"cardio":{"avgHr":151}}
  leaks SYNTH-EX: true | leaks avgHr 151: true
  ```
  Odpowiada to komunikatowi, który `logServerError` wypisałby do konsoli i przekazał do Sentry.
- **Wpływ**: przy każdym błędzie zapisu (przerwa Turso, `SQLITE_BUSY`, naruszenie innego ograniczenia niż `operationId`) do logów Vercel/Render i do Sentry (podmiot przetwarzający poza repozytorium) trafiają wartości serii, tętno, kalorie, kroki i pełny stan sesji konkretnego użytkownika. To dane z art. 9 RODO (ostrożnościowo, wg 005 `prawnik`) i naruszenie LR-6 oraz standardu z `docs/zespol/przeplyw.md`. Atakujący nie wywoła tego sam (potrzebny błąd bazy), więc prawdopodobieństwo jest średnie, skutek wysoki.
- **Dotkliwość**: WYSOKA (wpływ na dane zdrowotne w logach i u podmiotu trzeciego; systemowe; dotyczy zmienianych endpointów).
- **Miejsca**: `lib/errors/app-error.ts:101-135` (`toAppError`, gałąź `INTERNAL` i `UNAVAILABLE_HINT` z `err.message`), `lib/errors/server-log.ts:53-115` (`logServerError`, `captureToSentry`), `lib/workout-plan-compare.ts:254`. Wywołujące: `app/api/workouts/complete/route.ts:488-496`, `app/api/workouts/[workoutId]/cardio/route.ts:118-121`, `app/api/active-workout-session/route.ts:56-69` (`clearRow`), `:306-312` (INSERT), `:272-282` (UPDATE).
- **Rekomendowana poprawka (backend)**: (a) w `toAppError`/`logServerError` nie używać `err.message` z błędów `DrizzleQueryError` (lub z dowolnego błędu niosącego `query`/`params`); dla nich zapisywać tylko kod i zamiast komunikatu `err.cause` z jego własnym komunikatem, bez sekcji `params:`; (b) ustawić to samo w `captureToSentry` (`beforeSend` w `lib/sentry-init.ts`, usunięcie `exception.values[].value` zawierającego `params:`); (c) dla `SyntaxError` z `JSON.parse` na danych z bazy zwracać stały komunikat, nie `err.message`; (d) test regresji: wymuszony błąd INSERT/UPDATE z danymi syntetycznymi (np. tętno 151, ciężar 33) → żaden `console.*` ani wywołanie `captureException` nie zawiera tej wartości (mock Sentry).
- **Odniesienie**: CWE-532 (informacja w logach), CWE-209 (ujawnienie w komunikatach), OWASP ASVS V7.1.1/V7.1.2, OWASP API Top 10 API3 (nadmierna ekspozycja danych), LR-6.

### F-2 (ŚREDNIA) Rozszerzona widoczność serii masy ciała dla rywali Ghost, dokumentacja twierdzi co innego

- **Opis**: `lib/ghost-training/timeline.ts:63-72` buduje checkpointy (nazwa ćwiczenia, numer serii, ciężar, powtórzenia, skumulowany tonaż) z filtra `isCompletedWorkoutSet`. Ten filtr zależy od `isSkippedWorkoutSet` (`lib/workout-skipped-sets.ts:24-43`), które po decyzji właściciela (005 p.7) nie traktuje już serii 0 kg z powtórzeniami jako pominiętej. Efekt: serie masy ciała (np. pompki, 0 kg x 12) są teraz widoczne dla rywali Ghost. Wcześniej nie były.
- Decyzja właściciela istnieje (005 p.8, Q-P1: "bez osobnej reguły dla Ghost"). LR-5 w bramce prawnej wymagał jednak albo zachowania dotychczasowego filtra, albo pisemnej zgody właściciela i aktualizacji oceny 004 LR-8(d). Pisemna decyzja jest w karcie zadania, ale **ADR 0004 twierdzi, że filtra nie zmieniono** (`docs/adr/0004-koniec-treningu-przeplyw.md`, tabela LR-5: "bez zmiany filtra Ghost") i p.6 mówi "bez zmian kodu", co jest sprzeczne z faktem. Nie zaktualizowano też 004 LR-8(d).
- **Wpływ**: dane wcześniej niewidoczne dla rywali są teraz widoczne, a dokumentacja tego nie odzwierciedla. Ryzyko prawne i zaufania, nie techniczne przejęcie.
- **Dotkliwość**: ŚREDNIA (zmiana widoczności danych bez zaktualizowanej dokumentacji).
- **Rekomendacja**: (a) architekt koryguje ADR 0004 (tabela LR-5, p.6): filtr Ghost zmienia się przez `isCompletedWorkoutSet`, widoczność rozszerzona zgodnie z Q-P1; (b) prawnik i właściciel potwierdzają to w 004 LR-8(d); (c) dodatkowo, jeśli właściciel woli zachować poprzednią widoczność, wystarczy osobna funkcja w `timeline.ts` (wariant pierwszy LR-5). Test regresji: serie 0 kg z reps > 0 pojawiają się w osi Ghost tylko przy zatwierdzonym wariancie.
- **Odniesienie**: LR-5 (`docs/prawo/005-...-wejscie.md`), ASVS V8 (minimalizacja danych), przede wszystkim ryzyko prawne (`prawnik`).

### F-3 (ŚREDNIA, integralność) Dedup `POST /complete` zwraca sukces bez porównania treści przy tym samym `operationId`

- **Opis**: `app/api/workouts/complete/route.ts:324-350` (`respondWithExistingWorkout`) sprawdza tylko `startedAt` (tolerancja 2000 ms). Gdy `operationId` już istnieje dla tego użytkownika, zwraca `ok: true, duplicate: true`, nie porównując `exercises` ani `cardioMinutes`. Jeśli pierwsze żądanie zapisało wersję bez późniejszych serii (odpowiedź zgubiona, potem dopisanie serii i ponowne zakończenie z tym samym `operationId`), nowe serie giną bez komunikatu. Zgłoszone przez testera jako N-7h-2 (raport `docs/testy/005-...` sekcja 15).
- **Wpływ**: nie jest to przejęcie danych innego użytkownika (zapytanie jest po `userId`, patrz sekcja 3). Jest to utrata danych własnego użytkownika bez sygnału, czyli naruszenie integralności zapisu (LR-3).
- **Dotkliwość**: ŚREDNIA (integralność, nie poufność).
- **Rekomendacja (backend + architekt)**: przy duplikacie porównać skrót treści (np. hash `exercises` i `cardioMinutes` po normalizacji) i przy różnicy zwrócić 409 `conflict`, jak już zrobiono dla `startedAt`. Test: ten sam `operationId`, inne serie → 409, bez drugiego wiersza.
- **Odniesienie**: CWE-840 / LR-3, OWASP API Top 10 API6 (przepływy biznesowe).

### F-4 (NISKA) Brak limitu rozmiaru i walidacji zawartości w `PUT /api/active-workout-session` i w `POST /complete`

- **Opis**: `isActiveWorkoutCloudPayload` (`lib/active-workout-cloud.ts:30-48`) sprawdza tylko pola najwyższego poziomu. `exercises` przechodzi jako `Array.isArray` bez walidacji elementów, a `payload` w `putSchema` to `z.unknown()`. Nie ma limitu bajtów body (Next.js route handler go nie ustawia; `req.json()` czyta całość). `POST /complete` ma limity liczby (200 ćwiczeń, 200 serii, 4000 znaków notatki), ale suma może sięgać kilku MB. PUT zapisuje to 1:1 do `payloadJson` i odsyła w GET, a klient wczytuje do store.
- **Wpływ**: tylko własne konto (klucz to `session.user.id`): rozrost wiersza i pamięci, a przy nieprawidłowych elementach `exercises` błąd UI wyłącznie we własnej sesji. Brak wpływu na innych użytkowników. Ograniczenie hostingu (np. limit body funkcji) częściowo łagodzi.
- **Dotkliwość**: NISKA.
- **Rekomendacja (backend)**: walidacja Zod elementów `exercises` w PUT (ten sam kształt co `exerciseSchema` z POST) albo odrzucenie payloadu większego niż ustalony limit (np. 256 KB); w `POST /complete` limit bajtów body.
- **Odniesienie**: OWASP API Top 10 API4 (brak ograniczeń zasobów), CWE-770.

### F-5 (NISKA) `GET /api/active-workout-session` wykonuje mutację (wygaszenie przeterminowanej sesji)

- **Opis**: `handleGET` → `evaluateActiveRow` → `clearRow` (`route.ts:113-127`) zmienia wiersz i podbija rewizję. Ścieżka wymaga sesji (cookie), więc nie jest to przejęcie. Odczyt z efektem ubocznym łamie zasadę bezpiecznych metod HTTP. Ryzyko CSRF-GET jest ograniczone przez SameSite cookie NextAuth (Lax domyślnie), bo podrzędny `fetch`/`img` nie wysyła ciasteczka z innej witryny. Wynik: nie ma wektora w tym zakresie, zostaje uwaga projektowa.
- **Dotkliwość**: NISKA.
- **Rekomendacja (architekt, backlog)**: przenieść wygaszanie do PUT/DELETE albo do osobnego, jawnego kroku klienta; do tego czasu udokumentować, że GET może mutować.
- **Odniesienie**: RFC 9110 §9.2.1 (metody bezpieczne), OWASP ASVS V4.

### F-6 (NISKA, do weryfikacji na hostingu) Limit żądań: klucz po nagłówku `x-forwarded-for` i brak współdzielonego magazynu bez Upstash

- **Opis**: `clientIpFromHeaders` (`lib/rate-limit.ts:70-76`) bierze PIERWSZY wpis `x-forwarded-for`, który klient może sam ustawić, jeśli warstwa przed aplikacją go nie nadpisuje. Bez `UPSTASH_REDIS_REST_URL/TOKEN` limit działa w pamięci jednej instancji (`lib/admin-config-status.ts:191-199`, wpis "rate-limit" z poziomem `recommended`). Dotyczy wszystkich tras, w tym PATCH cardio (`RATE.workoutCardioPatch` 30/min) i PUT/DELETE sesji (90/min).
- **Potwierdzone w kodzie**: `checkRateLimitAsync` jest wywoływany przed `auth()` w PATCH i w POST `complete`, więc limit obowiązuje także anonimów. Limit jest faktycznie egzekwowany, nie tylko zadeklarowany.
- **Dotkliwość**: NISKA (obejście limitu zwiększa tylko skalę nadużyć; nie daje dostępu do danych).
- **Rekomendacja (backend / operator)**: na hostingu sprawdzić, czy `x-forwarded-for` jest nadpisywany przez platformę (Vercel/Render), albo brać IP z zaufanego nagłówka platformy; potwierdzić ustawienie Upstash w produkcji przed Promote.
- **Odniesienie**: CWE-307 / CWE-348, OWASP API Top 10 API4.

### F-7 (NISKA) Brak górnej granicy `revision` w PUT i DELETE

- **Opis**: `putSchema` i `deleteSchema` mają `z.number().int().min(0)` bez maksimum. Klient może ustawić rewizję bardzo dużą (`Math.max(serverRevision, clientRevision) + 1`), co na przekroczeniu bezpiecznego zakresu liczb JS psuje późniejsze porównania CAS we własnym wierszu.
- **Wpływ**: wyłącznie własny wiersz (self-DoS sync), brak wpływu na innych.
- **Dotkliwość**: NISKA.
- **Rekomendacja (backend)**: `.max(Number.MAX_SAFE_INTEGER - 1)` albo `.max(10^9)`; odrzucenie 400.

### F-8 (NISKA, poza zakresem przeglądu) Ścieżka Javy dla `POST /complete`

- Gdy ustawiono `JAVA_API_BASE_URL`, `POST /complete` przekazuje żądanie do Javy PRZED dedupem TS i sprawdzeniem własności `workoutPlanId` (`route.ts:395-413`). Zod działa wcześniej, więc body jest zweryfikowany. Java deduplikuje w pamięci procesu po `userId` (`java-backend/.../WorkoutService.java:24-63`), bez trwałości i bez limitu rozmiaru mapy (`byUser` rośnie). Nie znaleziono wycieku między użytkownikami. Treningi zapisane w Javie nie istnieją w bazie, więc `PATCH cardio` dla nich da 404 (wpływ funkcjonalny, poza bezpieczeństwem).
- **Rekomendacja (backend, architekt)**: potwierdzić, czy produkcja używa Javy dla tej trasy; jeśli nie, udokumentować. Pełny przegląd Javy poza zakresem tego etapu.

### F-9 (NISKA, pokrycie testami) Brak testu izolacji użytkowników w dedupie `POST /complete`

- `app/api/workouts/complete/route.test.ts` ma jednego użytkownika (`userId = "u1"`). Nie ma przypadku: użytkownik B wysyła `operationId` użytkownika A i dostaje własny wiersz, nie cudzy. Izolację potwierdza kod (sekcja 3), ale bez testu regresja może ją zepsuć. Dodać test.

## 5. Ustalenia potwierdzone jako poprawne (negatywne kontrole)

| Obszar | Co sprawdzono | Wynik |
|---|---|---|
| Cardio PATCH, autoryzacja | `userId` z sesji; SELECT po `id`; porównanie `row.userId !== session.user.id` → 404; UPDATE dodatkowo `AND user_id = ?` | OK, test 404 istnieje |
| Cardio PATCH, walidacja | Zod: `cardioMinutes` finite, 0..1440; HR 0..250; `heartRateZone` int 1..5; `steps` 0..500000; `distanceKm` 0..500; `cardioType` enum; brak `strict()`, więc nieznane pola są usuwane | OK |
| Cardio PATCH, mass assignment | `patchCardioInCompletedSessionJson` buduje nowy obiekt z pól wyliczonych; 0 min usuwa `cardio` i `cardioMinutes` (`workout-plan-compare.ts:255-258`); brak `cardio` → usunięty stary obiekt (`:294-296`) | OK (LR-4) |
| Cardio PATCH, CSRF/RL/auth | `assertCsrf` pierwszy; `checkRateLimitAsync` z `RATE.workoutCardioPatch`; 401 przy braku sesji | OK (z F-6) |
| Cardio PATCH, ODPOWIEDŹ | zwraca tylko `{ ok, cardioMinutes }` | OK |
| Complete, dedup izolacja | SELECT dedup `and(userId, operationId)` (`route.ts:456`); SELECT w gałęzi wyścigu (`:509`) filtruje `userId`; `recent` i `planRow` po `userId` | OK |
| Complete, plan | `workoutPlanId` innego użytkownika → 400 przed dedupem (`:433-444`) | OK |
| Complete, indeks | `uq_workouts_user_operation (user_id, operation_id)` (migracja `0033`, `db/schema.ts:285`) | OK |
| Complete, feed | `publishTeamFeedAfterWorkout` tylko przy INSERT, nie przy duplikacie (`:518-529`); feed zawiera `cardioMinutes`, nie tętno (`lib/community/team-feed-auto.ts`) | OK, zgodne z Q-P3 |
| Complete, mass assignment | Zod `bodySchema`/`exerciseSchema`/`setSchema` nie `strict`, ale do bazy idzie `completedSessionJsonForCompare` z jawnych pól | OK |
| Active session, IDOR | wszystkie zapytania po `session.user.id`; brak identyfikatora użytkownika w body | OK |
| Active session, CSRF | PUT i DELETE: `assertCsrf` pierwszy; GET bez CSRF (zob. F-5) | OK |
| Active session, CAS | `UPDATE ... WHERE user_id = ? AND revision = ?` z `RETURNING` w `clearRow` i PUT | OK (ADR p.17) |
| Active session, DELETE rewizja | `revision` int >= 0; `< serverRevision` → 409 bez mutacji; brak wiersza → `revision: 0` | OK (F-7 dotyczy górnej granicy) |
| Logi (nowe) | `console.warn` w `use-workout-finish-flow.ts:111`: stały tekst, bez danych treningowych; `server-log.ts` nie loguje body, nagłówków ani query | OK, poza F-1 |
| Reguła bodyweight | serwer nadal waliduje `weight` 0..2000 i `reps` 0..500 (`route.ts:53-71`); zmiana jest czysto kliencka i funkcyjna | Brak nowego wektora |
| XSS | `dangerouslySetInnerHTML` nie występuje w kodzie (3 trafienia wyłącznie w `docs/`); nazwy ćwiczeń renderowane przez React | OK |
| Sekrety | skan zmienionych plików (wzorce kluczy AWS/OpenAI-podobnych, `PRIVATE KEY`, `secret/token/password = "..."`) | Brak trafień |
| Zależności (prod) | `npm audit --omit=dev --json` | 0 podatności (info/low/moderate/high/critical = 0) |
| Testy | `npx vitest run app/api/workouts app/api/active-workout-session` | 34/34 OK (3 pliki) |

## 6. Zakres nieprzetestowany (ryzyka resztkowe)

- Brak testów dynamicznych (DAST) na uruchomionej instancji z Turso i Upstash: nie uruchomiono Playwright ani `npm run dev` z bazą (brak `E2E_EMAIL`/`E2E_PASSWORD`). Autoryzację i CSRF oceniono przez kod i istniejące testy jednostkowe, nie przez żądania HTTP do serwera.
- F-1: mechanizm potwierdzony na lokalnym libSQL z danymi syntetycznymi i kodem `captureToSentry`. Nie zaobserwowano realnego wysłania do Sentry (brak DSN w sesji i zakaz kontaktu z usługami zewnętrznymi).
- F-6: zachowanie nagłówka `x-forwarded-for` na hostingu nie zweryfikowane (wymaga dostępu do konfiguracji platformy).
- Ścieżka Javy (F-8) poza zakresem; brak przeglądu `java-backend` poza dedupem `WorkoutService`.
- Wydajność, rate limit pod obciążeniem i SLO: poza zakresem tego raportu (etap 9, `tester-wydajnosci`).
- Nie oceniano zgodności prawnej (to `prawnik`); F-2 i klasyfikacja danych z F-1 są sygnałem dla prawnika.

## 7. Plan poprawek i retestu

| ID | Dotkliwość | Kierowanie | Retest po poprawce |
|---|---|---|---|
| F-1 | WYSOKA | backend (`lib/errors/*`, `lib/sentry-init.ts`, `lib/workout-plan-compare.ts`) | test regresji z sekcji 4 F-1 + ręczny dowód skryptem z tego raportu |
| F-2 | ŚREDNIA | architekt (ADR 0004 p.6, LR-5), prawnik (004 LR-8(d)), właściciel | przegląd dokumentów; test osi Ghost |
| F-3 | ŚREDNIA | backend (+architekt) | test: ten sam `operationId`, inne serie → 409 |
| F-4 | NISKA | backend | test: zbyt duży payload i zły element `exercises` → 400 |
| F-5 | NISKA | architekt (backlog) | — |
| F-6 | NISKA | backend, operator (hosting) | potwierdzenie konfiguracji |
| F-7 | NISKA | backend | test: `revision` powyżej limitu → 400 |
| F-8 | NISKA | backend, architekt | potwierdzenie użycia Javy |
| F-9 | NISKA | backend | test izolacji dedupu |

Po poprawce F-1, F-2 i F-3 (wysokie i średnie wpływające na dane) wykonuję retest. Bramka wraca do przeglądu po naprawie F-1.

## 9. Retest po poprawkach (przebieg 2, 2026-10-25)

Zakres: F-1 (retest pełny), F-2 (kontrola dokumentacji), nowe ryzyka z poprawek frontendu P1/P2 (`lib/active-workout-sync-backoff.ts`, `lib/active-workout-cloud-client.ts`) oraz zmian z pivotu ADR p.13 (`lib/workout-operation-id.ts`). Pozostałe ustalenia z przebiegu 1 sprawdzone pobieżnie (stan kodu, nie pełny retest).

### 9.1 F-1: status ZAMKNIĘTE dla osiągalnych ścieżek

**Co zmieniono (przeczytane w kodzie):**
- `lib/errors/app-error.ts`: `isDrizzleQueryError` (duck typing po `query` + `params`, bo `DrizzleQueryError` nie ma unikalnego `name`), `safeDbQueryMessage` (komunikat sterownika z `err.cause`, bez SQL; fallback do stałego tekstu, gdy komunikat zawiera `params:`/`failed query`), `sanitizeDrizzleQueryError` (nowy `Error` z własnym stackiem). `toAppError` nie używa już `err.message` dla `DrizzleQueryError` i klasyfikuje 503/500 po `err.cause`. `SyntaxError` z `JSON` → stały tekst `INVALID_JSON`.
- `lib/errors/server-log.ts`: `sanitizeForLogging` stosowane do `original ?? err.cause` przy `console.error` (stack/cause) i do `original` przy `Sentry.captureException`.

**Dowód (wykonany w tej sesji, ponownie):** skrypt `C:/Users/damia/AppData/Local/Temp/claude/D--Projekty-GymBrat/be781d14-c0e8-4e8b-bd93-e21f569cc279/scratchpad/verify-f1-retest.mts` (uruchomiony `npx tsx` z cwd repo). Dane syntetyczne: `exercises` z nazwą `SYNTH-EX-MARK`, `weight` 3317, `cardio.avgHr` 1517. Baza: libsql `:memory:`, błąd NOT NULL na `user_id` → **prawdziwy `DrizzleQueryError`**. Sentry: init z `beforeSend` zwracającym `null` na zamkniętym porcie `127.0.0.1:9` (zdarzenie nigdy nie wychodzi z procesu). Kopia `server-log.ts` w scratchpadzie różni się od repozytorium WYŁĄCZNIE ścieżką importu `@sentry/nextjs` (bare import w `tsx` ładował inną instancję Sentry; w Next runtime nie ma tego problemu) i jednym `console.log` w `catch` — logika identyczna.

| Scenariusz | Ścieżka w repo | Konsola: marker danych | Sentry (zdarzenie): marker danych | Wynik |
|---|---|---|---|---|
| S1 | `withApiErrors` → `toAppError(thrown)` → `logServerError(appErr, ctx, thrown)` (`lib/errors/api.ts:181`) | brak (0/4) | brak (0/3) | **PASS** |
| S2 | `logServerError` bez `original` (żadne wywołanie w repo tak nie robi) | brak | **WYCIEK** (3/3) | latentne, R-1 |
| S3 | `throw new AppError("INTERNAL", { cause: drizzleErr })`, potem `logServerError(…, thrown)` | brak | **WYCIEK** (3/3) | latentne, R-1 |
| S4 | `throw new Error(msg, { cause: drizzleErr })`, potem `logServerError(…, thrown)` | brak | **WYCIEK** (3/3) | latentne, R-1 |
| S5 | `withDbRetry` z przejściowym błędem (`db/with-retry.ts:44-48`) | **WYCIEK** `console.warn`: pierwsze 120 znaków `Failed query … params: t-1,,{"kind":"completed_ses…` | — | F-1b |

Potwierdzenie ścieżek w repo (S1 jest jedyną uruchamianą):
- `app/api/workouts/complete/route.ts:497-515` i `app/api/active-workout-session/route.ts:313-330` rzucają oryginalny błąd bez opakowania (`throw err`), więc trafiają do `withApiErrors` jako `DrizzleQueryError` i idą ścieżką S1.
- Wszystkie wywołania `logServerError` w repo (`lib/errors/api.ts:121,181`, `instrumentation.ts:85`, `proxy.ts:188`, `lib/security-events.ts:78`, `app/api/payments/hotpay/notify/route.ts:100`) albo podają `original`, albo nie mają `cause` z błędem bazy (AppError tworzony z katalogu).
- `grep` `throw new` / `cause:` w `app/api/workouts`, `app/api/active-workout-session`, `lib/workout-plan-compare.ts`, `lib/active-workout-cloud.ts`: brak opakowań z `cause`. Jedyne `cause:` w repo to `lib/excel/read-xlsx.ts` (poza zakresem).

**Stan testów regresji:** `lib/errors/app-error.test.ts` i `lib/errors/server-log.test.ts` (nowe, zielone) sprawdzają ścieżkę S1 z SYNTETYCZNYM obiektem imitującym `DrizzleQueryError` (nie prawdziwym błędem drizzle) i tylko `captureException` z `original` przekazanym. Nie pokrywają S2–S5. Wynik zakresu `npx vitest run lib/errors lib/active-workout-sync-backoff lib/active-workout-cloud lib/workout-operation-id app/api/workouts app/api/active-workout-session`: 11 plików, 120 testów, wszystkie OK.

### 9.2 Nowe ustalenia (R-1, F-1b, F-1c, niskie)

**R-1 (NISKA, obrona w głąb; latentne) — `captureToSentry` sanityzuje tylko obiekt najwyższego poziomu, nie łańcuch `cause`.** Sentry (`linkedErrorsIntegration`, domyślna w `@sentry/nextjs` 10.76.2) dołącza `cause` do zdarzenia. Gdy przekazany obiekt ma `cause` wskazujący na surowy `DrizzleQueryError` (S3, S4), albo gdy `original` nie jest podany (S2), surowy błąd z SQL i parametrami trafia do Sentry. Konsola jest w tych przypadkach czysta (stack sanityzowany przez `original ?? err.cause`). Dlaczego NISKA: w repo nie ma dziś ścieżki, która to wywołuje (9.1). Podniosę do ŚREDNIEJ/WYSOKIEJ, jeśli ktoś doda `throw new AppError(…, { cause: e })` albo opakowanie błędu bazy w ścieżce logowanej.
- Rekomendacja (backend): w `captureToSentry` przekazywać zawsze sanityzowany błąd bez `cause` (np. `sanitizeDeep`, który przechodzi `cause` i zastępuje każdy `DrizzleQueryError`), albo `beforeSend` w `lib/sentry-init.ts` usuwający `exception.values[*]` z `Failed query`/`params:` i spłaszczający `cause`. Plus test regresji S2–S4 (mock Sentry ODBIERA cały argument, z `cause`, nie tylko `message`/`stack` na wierzchu).
- Odniesienie: CWE-532, CWE-209, OWASP ASVS V7.1.1.

**F-1b (NISKA) — `db/with-retry.ts:44-48` loguje `e.message.slice(0, 120)` przy każdej ponownej próbie.** Przy przejściowym błędzie (`SQLITE_BUSY`, `ECONNRESET` itd.) w `console.warn` trafia początek SQL i pierwsze parametry (S5). Miejsca użycia `withDbRetry` z `label`: `lib/workout-plans-with-last-workout.ts:69` (odczyt planów z parametrem `userId`), `lib/home-start.ts`, `lib/progress-hub.ts`, `lib/plan-last-session-loads.ts`, `app/(dashboard)/progress/exercises/[key]/page.tsx`, `db/ensure-schema.ts`, start aplikacji. Parametry to głównie identyfikatory, więc wpływ jest mały, ale to ten sam wzorzec co F-1. Rekomendacja (backend): użyć `safeDbQueryMessage` (lub stałego tekstu z nazwą etykiety) zamiast `e.message`.

**F-1c (NISKA) — `instrumentation.ts`, blok wokół `migrateSensitiveFieldsAtStartup`: `console.error("[instrumentation] migrate-sensitive-encryption:", err)` loguje surowy błąd.** Jeśli nieprzechwycone (poza `try/catch` w pętli `workouts`) zapytanie się nie powiedzie, stack zawiera SQL i parametry. Parametry tej migracji to głównie zaszyfrowane wartości (`encryptSensitiveField`: zdjęcia, `startPhotoDataUrl`) i identyfikatory, więc ekspozycja to szyfrogram. Aktualizacja `workouts.exercises` w tej migracji jest w `try/catch` z cichym pominięciem (`lib/migrate-sensitive-encryption.ts`), więc nie loguje się. Rekomendacja (backend): logować `toAppError(err).code` lub `safeDbQueryMessage` zamiast surowego `err`.

### 9.3 F-2 (informacyjne, niebloking): nadal OTWARTE

- `docs/adr/0004-koniec-treningu-przeplyw.md:401`: tabela LR-5 nadal mówi „bez zmiany filtra Ghost”; linia 41 i 321 nadal „bez zmian kodu” dla `timeline.ts`. Kod: `lib/ghost-training/timeline.ts:64` używa `isCompletedWorkoutSet`, który po zmianie bodyweight zwraca `true` dla serii 0 kg × powtórzenia > 0, więc takie serie są widoczne dla rywali Ghost. Zmiana zachowania jest zgodna z decyzją właściciela (005 p.8, Q-P1), ale dokumentacja jej nie odzwierciedla.
- `docs/prawo/004-ekran-aktywnego-treningu-wejscie.md:28` (LR-8(d)): nadal „zakres identyczny jak dziś”. Do aktualizacji przez `prawnik` (zob. 9.5).
- Rekomendacja: architekt koryguje ADR 0004 (p.6, tabela LR-5); prawnik i właściciel potwierdzają w 004 LR-8(d). Brak wpływu na poufność (to świadoma zmiana widoczności, nie wyciek).

### 9.4 F-3 (ŚREDNIA, integralność): nadal OTWARTE, decyzja koordynatora

- `app/api/workouts/complete/route.ts:312-349` (`respondWithExistingWorkout`): od poprawki B-1b konflikt daje 409 wyłącznie przy różnicy `startedAt` > 2000 ms. Treść (`exercises`, `cardioMinutes`) nie jest porównywana. Ten sam `operationId` z innym zestawem serii nadal zwraca `duplicate: true` i gubi nowe serie bez komunikatu. Plan z przebiegu 1 (test „ten sam `operationId`, inne serie → 409”) nie jest spełniony.
- Pivot ADR p.13 zwiększa znaczenie tego ustalenia: `operationId` jest teraz deterministyczny z `(workoutPlanId, startedAtMs)`, więc każde ponowne zakończenie tej samej sesji (np. po zgubionej odpowiedzi) trafia w tę gałąź.
- Zgodnie z `docs/zespol/przeplyw.md` ZATWIERDZONE Z UWAGAMI dopuszcza tylko uwagi niskiego ryzyka. F-3 jest ŚREDNIE. Nie jest na liście „Blokują wydanie” (dotyczy podatności wysokich/krytycznych, SLO, podstawy prawnej, testów), więc wg tej reguły nie blokuje samodzielnie. Decyzja należy do koordynatora: (a) domknąć przed merge (backend: porównanie skrótu treści, 409 przy różnicy, test), albo (b) jawna akceptacja ryzyka przez właściciela z wpisem do backlogu. Rekomenduję (a).

### 9.5 Nowe ryzyka z poprawek frontendu i pivotu (przegląd, bez nowych wektorów wysokich)

| Obszar | Ustalenie | Dotkliwość |
|---|---|---|
| `lib/active-workout-sync-backoff.ts` (P1) | 401/403 nie są ponawiane automatycznie (`isAuthErrorStatus`), więc brak pętli żądań dla gościa/wygasłej sesji. Brak wycieku danych. | OK |
| `lib/active-workout-sync-backoff.ts` / `active-workout-cloud-client.ts` (P2) | `computeSyncRetryDelayMs` respektuje `Retry-After` bez górnego limitu (`max(8 s, retryAfterSec × 1000)`). Wartość pochodzi od własnego serwera, więc to tylko dłuższa przerwa we własnej synchronizacji (self-DoS, brak wpływu na innych). Rekomendacja: górny limit np. 15 min. | NISKA |
| `DELETE /api/active-workout-session` (zmiana kontraktu) | Klient wysyła `Content-Type: application/json` z `{ revision }` i nagłówkiem XSRF. Serwer: `assertCsrf` jako pierwszy (`route.ts:340`), `deleteSchema` (`z.number().int().min(0)`, `route.ts:337`), błędny JSON → 400. Kontrakt bez zmian w uprawnieniach. | OK |
| `deleteCloud`/`putCloud` — odpowiedzi | `CloudWriteResult` niesie `status`, `retryAfterSec`, `conflict`. Brak logowania payloadu w kliencie (`grep console`: w `active-workout-cloud-client.ts` i sync brak). `localStorage` tylko dla istniejących kluczy rewizji i `deviceId`. | OK |
| `lib/workout-operation-id.ts` (pivot p.13) | `operationId` = UUIDv5 z `(workoutPlanId, startedAtMs)`; nie jest sekretem, nie służy autoryzacji. Dedup i indeks są ograniczone do `userId` (`complete/route.ts:456,509`), więc znajomość cudzego `operationId` nic nie daje (inny użytkownik dostaje własny wiersz). Efekt uboczny: F-3 (9.4). | OK |
| Frontend: `dangerouslySetInnerHTML`, nowe `console.*` | Brak nowych wstrzyknięć HTML. Jedyny nowy log: `console.warn("[workout-finish] nieoczekiwany duplicate=true…")` — stały tekst, bez danych. | OK |
| Zależności | `package.json`/`package-lock.json` niezmienione w tym przebiegu (brak diffu). Poprzedni `npm audit --omit=dev`: 0 podatności. | OK |

### 9.6 Ustalenia z przebiegu 1 — stan (nie retestowane w tym przebiegu, poza kontrolą kodu)

| ID | Stan | Uwagi |
|---|---|---|
| F-1 | ZAMKNIĘTE dla osiągalnych ścieżek (9.1) | R-1, F-1b, F-1c — nowe, NISKIE |
| F-2 | OTWARTE, informacyjne | 9.3 |
| F-3 | OTWARTE, ŚREDNIE | 9.4, decyzja koordynatora |
| F-4 | OTWARTE, NISKA | `putSchema` `payload: z.unknown()` (`route.ts:210`), brak limitu bajtów body; `exercises` bez walidacji elementów |
| F-5 | OTWARTE, NISKA (backlog) | `GET` wygasza sesję (`clearRow` z `handleGET`) |
| F-6 | OTWARTE, NISKA (operator) | potwierdzenie `x-forwarded-for` i Upstash na hostingu — nie wykonano |
| F-7 | OTWARTE, NISKA | `revision` bez `.max(...)` (`route.ts:211`, `:337`) |
| F-8 | OTWARTE, NISKA (poza zakresem) | ścieżka Javy dla `POST /complete` |
| F-9 | OTWARTE, NISKA | test izolacji dedupu między użytkownikami nadal do dodania w `complete/route.test.ts` |

### 9.7 Zakres nieprzetestowany w przebiegu 2

- Brak DAST na działającej instancji i brak wysłania czegokolwiek do Sentry (zakaz kontaktu z usługami zewnętrznymi; DSN lokalny, `beforeSend` zwraca `null`).
- Brak uruchomienia Playwright (E2E wymagają `E2E_EMAIL`/`E2E_PASSWORD`).
- Scenariusze S2–S5 odtworzono na kopii `server-log.ts` (jedna różnica: import `@sentry/nextjs`); repozytorium nie zostało zmienione.

### 9.8 Warunki zatwierdzenia z uwagami

1. Koordynator rozstrzyga F-3 (9.4): domknięcie przed merge (rekomendacja) albo jawna akceptacja właściciela.
2. Backend: R-1 (sanityzacja łańcucha `cause`, test S2–S4) i F-1b/F-1c w backlogu z właścicielem `backend`; R-1 przed jakąkolwiek zmianą wzorców opakowywania błędów w ścieżkach logowanych.
3. F-2 do korekty w ADR 0004 i w 004 LR-8(d) przed Promote (dokumentacja, nie kod).

## 10. Odniesienia

- CWE-532, CWE-209, CWE-840, CWE-770, CWE-307, CWE-348
- OWASP ASVS 4.0: V4 (kontrola dostępu), V5 (walidacja), V7 (logowanie), V8 (ochrona danych)
- OWASP API Security Top 10 2023: API1 (BOLA), API3, API4, API6
- `docs/prawo/005-koniec-treningu-przeplyw-wejscie.md` (LR-3, LR-4, LR-5, LR-6)
- `docs/zespol/przeplyw.md` (standardy wspólne: dane o ciele)
