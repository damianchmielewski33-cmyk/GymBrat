# 005 - Koniec treningu: pomiar wydajności (etap 9)

- Data: 2026-10-25
- Autor: tester-wydajnosci
- Karta: `docs/zadania/005-koniec-treningu-przeplyw.md` (wiersz 9, część wydajność)
- Gałąź: `feat/koniec-treningu-flow` (stan roboczy, bez commitów)
- Środowisko: Windows 10 Pro, Node v24.14.1, `tsx` z `node_modules`, `@upstash/ratelimit` v2.0.8, Next 16.4.2 (wg `00-analiza-bazowa.md`)
- Skrypty (uruchamiane z korzenia repo przez `npx tsx`):
  - `docs/wydajnosc/005-koniec-treningu-pomiar.ts` (koszt reguły bodyweight, rozmiar i czas payloadu PUT)
  - `docs/wydajnosc/005-koniec-treningu-sim-push.ts` (symulacja sterowania `push()` z atrapą `fetch`)

## 0. Metoda i ograniczenia

- Trace kodu z numerami linii (ścieżki zapytań do bazy, kolejność sprawdzeń, warunki pętli).
- Mikrobenchmark funkcji czystych i serializacji payloadu na danych syntetycznych.
- Symulacja przepływu `push()` z `components/active-workout/active-workout-cloud-sync.tsx` (linie 156-232): replika 1:1 gałęzi i flag, z prawdziwymi `deleteCloud`/`putCloud`/`readRevision` z `lib/active-workout-cloud-client.ts`, bez React/DOM (brak jsdom i `@testing-library/react` w repo), z podmienionym `fetch`.
- Limity planów z cenników (pobrane 2026-10-25): Turso (`https://turso.tech/pricing.md`), Upstash (`https://upstash.com/pricing/redis`), Vercel (`https://vercel.com/docs/limits`).

Czego NIE zmierzono:
- Przeglądarki i Core Web Vitals (brak zainstalowanych przeglądarek Playwright, brak `.env` i bazy Turso w tej sesji, brak Lighthouse). Sekcja 3.6 jest oceną strukturalną.
- RTT między Vercel a Turso oraz telefonem na siłowni (wartości w sekcji 4 podane jako założenia z podanym wzorem).
- Testów obciążeniowych na `next start` z libSQL (k6/autocannon). Model w sekcji 2 jest arytmetyczny.
- Ścieżki Java (`JAVA_API_BASE_URL`).

Korekta bazy wiedzy: `docs/wydajnosc/00-analiza-bazowa.md` §4 podaje Upstash Free jako "10k komend/dzień". Aktualny cennik podaje 500K komend miesięcznie (250 MB danych, 10 GB transferu) i nie opisuje zachowania po przekroczeniu planu darmowego. Turso Free: 500M odczytów, 10M zapisów miesięcznie, 5 GB; przy przekroczeniu dowolnej metryki bazy są blokowane (brak nadwyżki na planie darmowym). Dokumentu 00 nie zmieniano (zasada: istniejące dokumenty bez zmian), do uzgodnienia z architektem.

## 1. Wymagania niefunkcjonalne (odniesienie)

Z `docs/wydajnosc/00-analiza-bazowa.md` §2 (propozycje, nieuzgodnione formalnie):

| Ścieżka | Cel |
|---|---|
| K1 sync sesji do chmury (`/api/active-workout-session`) | API p95 < 400 ms, p99 < 1 s, błąd < 0,5%, nie blokuje UI |
| K2 `POST /api/workouts/complete` | p95 < 800 ms, p99 < 2 s, błąd < 0,5% przy 90 treningach/h |
| K1 zapis serii lokalnie | reakcja UI < 100 ms niezależnie od sieci |

## 2. Model obciążenia

Założenia z `00-analiza-bazowa.md` §1 (szczyt 18:00-21:00, 300 aktywnych użytkowników, 90 treningów/h w godzinie szczytu) oraz założenia tej analizy:
- Trening trwa 60 min, aktywna karta treningu w każdym z tych minut.
- Telefon klasy średniej, 4G lub Wi-Fi siłowni (jeden publiczny IP dla wielu użytkowników).
- Payload typowej sesji: 6 ćwiczeń x 4 serie (plus pola podpowiedzi, patrz 3.3).

Koszt jednostkowy jednego treningu (60 min):
- PUT: 450 (co 8 s, `PUSH_INTERVAL_MS = 8000`, `active-workout-cloud-sync.tsx:26`).
- Zapytania Turso: 900 (SELECT + UPDATE na każdym PUT), zapisane wiersze: 450, odczytane wiersze: ok. 900 (wyszukiwanie po kluczu głównym).
- Wysłane bajty: 450 x 9,4 KiB = ok. 4,1 MiB.
- Komendy Upstash (rate limit): 450.
- Invocations funkcji Vercel: 450.

## 3. Wyniki per punkt zakresu

### 3.1 `POST /api/workouts/complete` (punkt 1 zakresu)

Ścieżka zapisu w zwykłym przypadku (z planem), po zmianie:
1. `auth()` - callback `jwt` wywołuje `getAccountAuthState` z cache w procesie (TTL 60 s, `lib/account-auth-state.ts`). Na ciepłej instancji 0 zapytań, na zimnej 1.
2. Sprawdzenie właściciela planu (SELECT po PK, pre-existing).
3. Dedup `operationId` (NOWE): `SELECT ... WHERE user_id = ? AND operation_id = ? LIMIT 1` (`route.ts:448-457`).
4. `planRow` (SELECT po PK planu, pre-existing).
5. `recent` (SELECT do 13 wierszy z pełnym JSON `exercises`, pre-existing, `route.ts:266-271`).
6. `INSERT` (pre-existing, teraz z trzema indeksami wtórnymi zamiast dwóch).
7. Publikacja feedu `void` (poza ścieżką odpowiedzi, liczba zapytań nieznana).
8. Pięć `revalidatePath` (pre-existing).

Ocena dedup SELECT:
- Indeks: `uq_workouts_user_operation` (user_id, operation_id) w `db/schema.ts:285` i w migracji `db/migrations/0033_workout_operation_id.sql`. Zapytanie trafia w indeks (seek), koszt O(log n), nie skan tabeli.
- Dodatkowe zapytanie na ścieżce głównej: +1 statement (z 4 do 5 w tym przypadku z planem), a przy braku parallelizacji +1 szeregowy RTT do Turso.
- Propozycja: uruchomić dedup SELECT równolegle z `planRow` i `recent` (`Promise.all`), bo nie zależą od siebie. Koszt czasu odpowiedzi wraca do zera w zwykłym przypadku. Alternatywa: `INSERT ... ON CONFLICT DO NOTHING RETURNING` z odczytem tylko przy konflikcie (1 zapytanie zamiast 2 w normalnym przypadku).
- CAS i pętla retry: NIE dotyczy tego endpointu (brak CAS, brak pętli). Potwierdzone.

Ryzyko dostępności (nie pomiar): kolumna `operation_id` i indeks `uq_workouts_user_operation` powstają WYŁĄCZNIE z migracji 0033 (`runMigrations` przy starcie procesu). `db/ensure-schema.ts` zawiera tylko indeksy 0032 (`idx_workouts_user_plan_date`, `idx_workouts_user_date`, linie 1484-1487). Jeśli migracja nie przejdzie, dedup SELECT rzuci błąd braku kolumny i każdy zapis treningu zakończy się 500. Rekomendacja: dopisać `operation_id` do `ensure-schema.ts` na wzór pozostałych kolumn krytycznych (backend, architekt).

Wpływ na SLO K2: nie zmierzono p95. Szacunek: dodatkowy szeregowy RTT (ok. 1 RTT do Turso) bez parallelizacji. Przy RTT 50-150 ms to 50-150 ms na p95, w granicach celu 800 ms, ale zjada zapas przy słabym łączu.

### 3.2 `PATCH /api/workouts/[workoutId]/cardio` (punkt 2 zakresu)

- Zapytania: 2 (SELECT po PK, UPDATE po PK), zgodnie z ADR p.2 (bez `db.transaction`). Potwierdzone w `app/api/workouts/[workoutId]/cardio/route.ts:95-121`.
- Rate limit: 1 komenda Upstash. Auth: cache (0-1). `revalidatePath` x2 (`/reports`, `/workout-history`).
- Koszt zapisu: pełny JSON `exercises` jest czytany i zapisywany (ok. 5-10 KB na sesję, szacunek). Jednorazowo na zapis cardio, bez pętli.
- Ocena: BRAK niepotrzebnych zapytań. ZATWIERDZONE.
- Uwaga poza wydajnością (architekt): odczyt-modyfikacja-zapis `exercises` bez warunku (RMW). Równoległa edycja historii może nadpisać JSON. Zgłoszone jako niskie.

### 3.3 `/api/active-workout-session` (punkt 3 zakresu)

Interwał: `PUSH_INTERVAL_MS = 8000` (potwierdzone, `components/active-workout/active-workout-cloud-sync.tsx:26`, użycie w linii 251). Co 8 s wywoływane jest `push()`, które dla aktywnej sesji wysyła PUT z PEŁNYM payloadem, bez sprawdzenia, czy stan się zmienił (linie 156-199). Nie jest to GET: GET wykonywany jest tylko przy hydracji (montaż, linia 105). Odpowiedź na pytanie koordynatora: cykliczne zapytanie co 8 s to PUT (zapis), nie GET.

Liczba zapytań do bazy na żądanie (najgorszy przypadek = 3, bez pętli po stronie serwera):

| Handler | Przypadek | Zapytania Turso | Mutacja |
|---|---|---|---|
| GET | aktywna, świeża | 1 SELECT | nie |
| GET | tombstone (już wygaszony) | 1 SELECT | nie (naprawa B-1d działa: `route.ts:105-111`) |
| GET | ghost (aktywna, >24 h) | 2 (SELECT + CAS UPDATE) | tak |
| GET | ghost, przegrana CAS | 3 (+ SELECT świeży, `allowClear: false`) | nie (brak drugiej próby) |
| GET | brak wiersza | 1 | nie |
| PUT | UPDATE, zwykły przypadek | 2 (SELECT + CAS UPDATE) | tak |
| PUT | UPDATE, przegrana CAS | 3 (+ SELECT świeży) → 409 | nie |
| PUT | INSERT (pierwszy zapis) | 2 (SELECT + INSERT) | tak |
| PUT | INSERT, przegrany wyścig | 3 (SELECT + INSERT błędny + SELECT) → 409 | nie |
| PUT | rewizja klienta < serwera | 1 (SELECT) → 409 | nie |
| DELETE | zwykły przypadek | 2 (SELECT + CAS UPDATE) | tak |
| DELETE | brak wiersza | 1 | nie |
| DELETE | przegrana CAS | 3 (+ SELECT świeży) → 409 | nie |
| DELETE | rewizja klienta < serwera | 1 (SELECT) → 409 | nie |

Ocena naprawy CAS (ADR p.17):
- Zwykły przypadek nie wzrósł: PUT i DELETE to nadal 2 zapytania (SELECT + UPDATE), tak jak w projekcie z p.1. Oczekiwanie koordynatora "1 zapytanie w normalnym przypadku" nie jest osiągalne przy obecnym projekcie (SELECT jest potrzebny do wyliczenia rewizji i ewentualnego 409). Jedno zapytanie byłoby możliwe przez warunkowy `UPDATE ... RETURNING` bez wcześniejszego SELECT, z SELECT tylko przy 409. To jest decyzja architekta (rekomendacja, sekcja 4, P4).
- Przegrana CAS to rzadkie 3 zapytania, bez pętli. Pętla retry po stronie serwera NIE istnieje (potwierdzone w `route.ts:145-175`, `evaluateActiveRow` z `allowClear: false`, głębokość 1).
- `ensureCriticalSchema()` wywoływane przy każdym żądaniu, ale memoizowane w procesie (`db/ensure-schema.ts:16-18`), więc 0 zapytań po pierwszym sukcesie. Nieudana inicjalizacja jest ponawiana przy każdym żądaniu (oczekiwane, ale nieodporne na awarię bazy).

Rate limit (Upstash, jeśli skonfigurowany):
- 1 komenda na żądanie (`evalsha` w `@upstash/ratelimit` v2.0.8). Liczona przed odpowiedzią, także dla odrzuconych.
- Kolejność sprawdzeń: PUT i DELETE to csrf → auth → rate limit. Żądania bez sesji (401) nie zużywają komend Upstash, ale zużywają invocation funkcji.
- Limit 90/min na IP i etykietę (`RATE.activeWorkoutSession`). Przy 7,5 PUT/min na sesję jeden publiczny adres IP (sieć siłowni) wyczerpuje limit przy 12 równoczesnych sesjach (90 / 7,5 = 12). Liczba prawdziwych IP jest nieznana (zależna od NAT operatora).

Koszt przy modelu z sekcji 2:
- Szczyt (90 równoległych sesji): 40 500 PUT/h (11,25 żądań/s), 81 000 zapytań Turso/h (22,5/s), 40 500 zapisów wierszy/h, ok. 372 MiB uploadu/h (ok. 0,10 MiB/s).
- Wariant bazowy: 300 treningów/dzień x 450 PUT = 135 000 PUT/dzień = ok. 4,05 mln/miesiąc.
  - Turso zapisy: 4,05 mln = 40% z 10 mln darmowego limitu zapisów (wiersze zapisane w sync, bez reszty aplikacji). Przekroczenie blokuje bazę.
  - Turso odczyty: ok. 8,1 mln = 1,6% z 500 mln.
  - Upstash (gdy aktywny): 4,05 mln komend = 8,1x ponad 500 K/mies.
  - Invocations: ok. 4 mln/mies. z samego sync. Hobby ma miesięczny przydział bez liczby na stronie limitów (fair use), nie podaję liczby.
- Progi:
  - Upstash 500 K / 450 = ok. 1 111 treningów/mies. (ok. 37/dzień) - przy aktywnym Upstash na planie darmowym.
  - Turso 10 M / 450 = ok. 22 200 treningów/mies. (ok. 741/dzień) - przed blokadą bazy (bez innych zapisów).

Najważniejszy koszt w tym punkcie to nie sam interwał 8 s, tylko PUT bez sprawdzenia zmiany oraz pętle ponowień po stronie klienta (sekcja 4, P1-P3).

Pole `updatedAt` i świeżość: `ACTIVE_WORKOUT_CLOUD_MAX_AGE_MS = 24 h` (`lib/active-workout-cloud.ts:51`). Próg 24 h daje duży zapas, więc sync bez zmian (heartbeat co kilka minut) nie wygasi aktywnej sesji. To warunek redukcji ruchu (P3).

### 3.4 Reguła bodyweight (punkt 4 zakresu)

Pomiar (`docs/wydajnosc/005-koniec-treningu-pomiar.ts`, część A, 200 przejść po 12 800 seriach w 400 treningach):
- Nowa reguła (`isSkippedWorkoutSet` bez warunku ciężaru + `isCompletedWorkoutSet`): 0,25-0,32 ms na przejście pełnej historii.
- Reguła sprzed zmiany (z warunkiem `hasExternalWeight`): 0,31 ms.
- Różnica poniżej szumu pomiaru. Funkcje nie wykonują zapytań, nie alokują tablic. Wszystkie wywołania (`countSkippedWorkoutSets`, `last-workout-hints.ts`, `timeline.ts`, `live-coach/*`) są liniowe po liczbie serii w historii.
- Ocena: BRAK NOWEGO KOSZTU. Zmiana usuwa jeden warunek, więc nie zwiększa kosztu. Potwierdza ADR p.6.
- Uwaga (nie wydajność): `lib/last-workout-hints.ts` ma dodatkowy filtr `weight > 0` przy wyborze PR, więc podpowiedzi nie zmieniają się dla masy ciała. Poprawne.

### 3.5 Frontend: `use-workout-finish-flow.ts` (punkt 5 zakresu)

- `fetchLastWorkoutHintsForPlan` (`components/active-workout/use-workout-finish-flow.ts:69`, `actions/workout-plan.ts:223`) wykonuje JEDNO zapytanie (`getLastWorkoutHintsForPlan`, LIMIT 4, indeks `idx_workouts_user_plan_date`, `lib/last-workout-hints.ts:305-310`). Nie jest N+1. Wejście: jedna server action, auth z cache, jedno zapytanie zwracające do 4 pełnych JSON (szacunek 20-40 KB).
- Wejście wszystkich trzech ścieżek idzie przez `doSave()`. Hint jest pobierany za każdym razem, poza ponowieniem (`reuse && lastAttempt`).
- PROBLEM: wywołanie jest SZEREGOWE przed `submitCompletedWorkout` (linie 64-74 przed linią 79). Hint jest potrzebny dopiero do `detectSessionWeightRecords`/`detectSessionNewMaxes` (linie 76-77), czyli po wyniku zapisu. Koszt: +1 server action RTT + zapytanie na drodze do zapisu. UI pokazuje już ekran "Zapisuję trening…" (stan ustawiany przed pobraniem), więc użytkownik to odczuwa jako dłuższe oczekiwanie.
- Ocena: akceptowalne jako pojedyncze zapytanie, ale do poprawy: uruchomić oba żądania równolegle (`Promise.all`) lub pobrać hint w tle przed zakończeniem. Oczekiwany zysk: -1 RTT na ścieżce zapisu (szacunek, nie zmierzony).

### 3.6 Core Web Vitals i ekrany końcowe (punkt 6 zakresu) - ocena strukturalna

Nie zmierzono (brak przeglądarki). Ocena z kodu:
- `components/active-workout/workout-saving-screen.tsx`: 135 LOC, lekki, bez wykresów. Pierwszy render kosztowny tylko przez zależność od hooka (import `isSessionExpiredFinishError` z `use-workout-finish-flow.ts`, który ciągnie server action i `workout-complete-submit`). Ten moduł i tak jest już w bundlu widoku treningu, więc koszt bundla nie rośnie. Sprzężenie do poprawy, bez wpływu na wydajność.
- `components/active-workout/workout-finished-screen.tsx`: 805 LOC, importowany statycznie (`PrAchievementGraphic`, `createPortal`, kalkulacje). Renderowany tylko w fazie `done`. Kandydat do `next/dynamic` (ładowanie po zapisie), żeby zmniejszyć JS parsowany przy otwieraniu ekranu treningu (K1, TTI na starszym telefonie). Rozmiar w KB nie zmierzony: do sprawdzenia przez `@next/bundle-analyzer`.
- Liczba re-renderów: hook czyta store selektorem (`useActiveWorkoutStore((s) => s.finishFlow)`, linia 182), więc zmiana innych pól nie re-renderuje ekranu zapisu. Dobrze.
- Pre-existing (nie wprowadzone tą zmianą, `HEAD` ma to samo): `active-workout-view.tsx:93` i `active-workout-global-bar.tsx:48` czytają CAŁY store (`useActiveWorkoutStore()` bez selektora). Pasek globalny jest montowany w `app/layout.tsx`, więc działa na każdej stronie. Każda zmiana store (np. seria) przerenderowuje pasek. Dotkliwość niska-średnia, do sprawdzenia profilerem React.
- Brak nowych pollingów ani timerów w ekranach końcowych.

## 4. Problemy wydajnościowe

Dotkliwość: K = krytyczna, W = wysoka, S = średnia, N = niska. Adresat: backend, frontend, architekt. Wszystkie wartości "per godzina" to model z sekcji 2 lub wynik symulacji. Symulacja nie uwzględnia RTT, więc tempo w przeglądarce jest niższe (patrz opis P1).

### P1 (K, blokujące) - nieskończona pętla DELETE dla gościa i wygasłej sesji

- Scenariusz: `ActiveWorkoutCloudSync` jest w `app/layout.tsx` (przez `components/providers/app-providers.tsx:31`) i działa na każdej stronie, także bez logowania. Po hydracji (GET dostaje 401, `fetchCloud` zwraca `null`) pierwszy tick `push()` wysyła DELETE (`clearedPushedRef` startuje od `false`, linia 79). DELETE zwraca 401 (csrf → auth → rate limit, `route.ts:339-357`), `deleteCloud` zwraca `{ ok: false }` bez `conflict` (`lib/active-workout-cloud-client.ts:160`), więc gałąź ustawia `pendingPushRef = true` (linia 175), a `finally` wywołuje `void push()` natychmiast (linia 189). Pętla nie ma opóźnienia, backoffu ani warunku zatrzymania.
- Dowód: symulacja (scenariusz A): 1 000 żądań DELETE w 95 ms (10 500 żąd./s, bez RTT, czysto klient). Tempo w prawdziwej przeglądarce = 1 / RTT na otwartą kartę. Przykład: RTT 150 ms = ok. 6,7 żąd./s = ok. 24 000 invocations/h na jedną otwartą kartę. Wzór: liczba = 3600 / RTT_s.
- Próg: 0 żądań bez sesji (SLO błędów sync < 0,5%; ścieżka 401 ma 100% błędów). Przekroczone o rzędy wielkości.
- Skala: każdy gość lub użytkownik z wygasłą sesją, który ma otwartą kartę dowolnej strony. Koszt: invocations Vercel, CPU serwera, bateria telefonu.
- Przyczyna: pętla rekurencyjna `void push()` w `finally` przy każdym `!result.ok` bez rozróżnienia błędu trwałego (401) i przejściowego; brak sprawdzenia sesji przed synchronizacją.
- Rekomendacja (frontend, główny właściciel): (1) nie uruchamiać `ActiveWorkoutCloudSync` bez zalogowanej sesji (status z `useSession`) albo przerwać pętlę przy 401/403; (2) usunąć rekurencję `void push()` z `finally`, planować ponowienie przez `setTimeout` z backoffem (np. 8 s, 16 s, 32 s, max 60 s); (3) `clearedPushedRef` startować od `true`, skoro po przejściu aktywna→pusta DELETE jest zbędny, gdy nigdy nie było sesji (N-P13-2 z karty, teraz wymagane). Backend: ponowny pomiar scenariusza A po poprawce (oczekiwane 0 żądań DELETE przy braku sesji i zalogowania).

### P2 (W, blokujące) - natychmiastowe ponawianie PUT przy 429, 5xx i braku sieci

- Scenariusz: aktywna sesja, serwer odrzuca PUT (429 z limitu 90/min na IP, 5xx) albo sieć nie działa (basen, piwnica siłowni). `putCloud` zwraca `{ ok: false }` (`lib/active-workout-cloud-client.ts:122`) lub rzuca (`fetch` odrzucony). Gałęzie `else if (!result.ok)` (linia 219) i `catch` (linia 223) ustawiają `pendingPushRef`, a `finally` wywołuje `void push()` bez opóźnienia (linia 229). Ta sama pętla co P1, ale na ścieżce aktywnej sesji.
- Dowód: symulacja B (429): 1 000 żądań w 43 ms. Symulacja C (sieć odrzucona): 1 000 wywołań `fetch` w 27 ms. Na telefonie każde nieudane wywołanie to pracy CPU i wejścia/wyjścia, bez limitu. Wartość ta pochodzi z pętli bez sieci, więc jest górną granicą.
- Amplifikacja NAT (sieć siłowni): przy 12 równoległych sesjach na jednym IP limit 90/min jest wyczerpany (sekcja 3.3). Pozostałe sesje dostają 429 i wpadają w tę samą pętlę, co dodatkowo zwiększa liczbę żądań. Ryzyko: wszystkie sesje z jednego IP mogą mieć opóźniony sync na czas okna 60 s, a każde żądanie zużywa komendę Upstash.
- Próg: błędy sync < 0,5% (SLO K1), przy pętli błędy są ciągłe przez cały czas awarii.
- Ta sama kategoria co N-P13-3 z karty (zarejestrowany jako średni, pre-existing). Podnoszę dotkliwość do wysokiej, bo symulacja pokazuje brak ograniczenia, a NAT gwarantuje wyzwolenie przy wyższej liczbie użytkowników.
- Rekomendacja (frontend): ponawiać przez `setTimeout` z backoffem, respektować nagłówek `Retry-After` z 429 (serwer go ustawia, `route.ts:231`), przy braku sieci czekać na zdarzenie `online` zamiast pętli; nie wywoływać `push()` z `finally`. Backend: opcjonalnie niższy koszt odrzucenia (429 bez zapytań do bazy już jest, bo rate limit jest przed bazą).

### P3 (W, wymaga decyzji architekta przed Promote) - PUT co 8 s bez wykrywania zmian i z pełnym payloadem

- Scenariusz: każda aktywna sesja wysyła PUT co 8 s niezależnie od tego, czy stan się zmienił (`push()` linie 156-199, `setInterval` linia 251). Payload to cały `exercises`, w tym pola wyliczane przez klienta (`lastSessionSets`, `suggestedWeights`, `coachContext`).
- Dowód (`005-koniec-treningu-pomiar.ts`, część B): typowa sesja 9 654 bajty (9,4 KiB), z czego 52% to pola wyliczane (bez nich 4 590 bajtów). Serializacja na serwerze (`JSON.parse` + `JSON.stringify`) 0,14 ms. Koszt CPU serwera jest nieistotny, problemem są bajty, zapisy i liczba żądań.
- Próg: budżet zapisów Turso (10 M/mies., przekroczenie blokuje bazę). Wariant bazowy: 4,05 mln zapisów/mies. (40%). Upstash: 8,1x limitu darmowego (jeśli aktywny).
- Redukcja (szacunek, do zmierzenia po zmianie): (a) wysyłać PUT tylko przy zmianie snapshotu (porównanie z ostatnim wysłanym) plus heartbeat co 5 min (próg świeżości 24 h pozwala); (b) nie wysyłać pól wyliczanych (`lastSessionSets`, `suggestedWeights`, `coachContext`) i odtwarzać je po wznowieniu sesji (-52% bajtów); (c) przy zmianach co ok. 90 s szacunek: ok. 50 PUT zamiast 450 na trening (-85-90%).
- Rekomendacja (architekt decyduje, frontend wdraża): wykrywanie zmian i heartbeat (a) oraz odchudzenie payloadu (b). Ryzyko: zmiana kontraktu payloadu wpływa na synchronizację między urządzeniami (ADR 0004 p.12-17), więc wymaga przeglądu architekta. Nie jest to regresja tego zadania (sync istniał przed nim), ale zadanie zwiększa zapisy przez nowe pola.

### P4 (S) - PUT wykonuje 2 zapytania zamiast 1 (CAS nie podniósł kosztu)

- Potwierdzenie: zwykły PUT i DELETE to 2 zapytania (sekcja 3.3). CAS nie dodał zapytań w zwykłym przypadku. Oczekiwane 1 zapytanie (koordynator) wymaga warunkowego `UPDATE ... RETURNING` bez wcześniejszego SELECT, z odczytem tylko przy 409.
- Dowód: `route.ts:255-287`. Zysk: połowa zapytań i połowa RTT dla każdego PUT (przy 3.3: -450 zapytań na trening).
- Rekomendacja (architekt, backend): rozważyć po P3, bo P3 zmniejsza liczbę PUT, a P4 zmniejsza koszt każdego z nich. Nie blokuje Promote.

### P5 (S) - DELETE przy pierwszym ticku każdego ładowania strony bez sesji

- Scenariusz: zalogowany użytkownik bez aktywnej sesji. `clearedPushedRef` startuje od `false` (linia 79), więc pierwszy tick po hydracji wysyła DELETE, który zapisuje wygaszony wiersz (2 zapytania, 1 zapis wiersza, 1 invocation, 1 komenda Upstash).
- Dowód: symulacja F (1 żądanie na pierwszy tick). Liczba: 1 DELETE na każde pełne załadowanie aplikacji bez sesji.
- Skala: przy 300 użytkownikach i kilku wejściach dziennie to rzędu tysięcy zapisów miesięcznie. Nieistotne dla budżetu, ale to niepotrzebny zapis tombstone przy każdym wejściu.
- Rekomendacja (frontend): sprawdzić, czy wiersz w ogóle istnieje, zanim wysłać DELETE; ustawienie `clearedPushedRef` od `true` (jak w P1) załatwia też ten przypadek, o ile zmiana nie psuje przejścia aktywna→pusta (scenariusz E: 1 DELETE na 10 ticków, po zmianie zachować).

### P6 (S) - dedup SELECT na ścieżce zapisu treningu, szeregowo

- Dowód: sekcja 3.1. Dodatkowe zapytanie, indeksowane, ale szeregowe względem `planRow`/`recent`.
- Rekomendacja (backend): `Promise.all` albo `ON CONFLICT DO NOTHING RETURNING`. Ryzyko dostępności (kolumna i indeks tylko z migracji) - dopisać do `db/ensure-schema.ts`.

### P7 (S) - pobieranie podpowiedzi przed zapisem treningu

- Dowód: sekcja 3.5. Jedno zapytanie (nie N+1), ale szeregowe przed `submitCompletedWorkout`.
- Rekomendacja (frontend): `Promise.all` z zapisem (hint potrzebny po wyniku), zysk -1 RTT na zapisie.

### P8 (N, pre-existing) - `recent` czyta do 13 pełnych JSON na każdy zapis

- Dowód: `route.ts:266-271`, `LIMIT 13` z kolumną `exercises`. Szacunek: 13 x 5-10 KB = 65-130 KB odczytu na każdy zapis treningu. Potrzebne tylko: pierwszy wcześniejszy trening z tym samym `startedAt` mniejszym niż bieżący, więc część wierszy jest zbędna.
- Rekomendacja (backend, niski priorytet): ograniczyć liczbę wierszy lub kolumny przy wyborze poprzedniego treningu. Nie zmieniać przed P6.

### P9 (N, pre-existing) - `revalidatePath` synchronicznie na ścieżkach zapisu

- Dowód: `route.ts:531-535` (5 wywołań na zapis), `cardio/route.ts:123-124` (2 na patch). Zgodne z `00-analiza-bazowa.md` R2. Koszt nie zmierzony.
- Rekomendacja (backend): do oceny razem z R1/R2 z analizy bazowej.

## 5. Ocena zmian, które nie są problemem

- Reguła bodyweight (sekcja 3.4): BRAK NOWEGO KOSZTU, zmierzone.
- Cardio PATCH (sekcja 3.2): 2 zapytania, zgodne z ADR p.2, brak pętli, brak transakcji.
- Naprawa CAS (sekcja 3.3): brak wzrostu zapytań w zwykłym przypadku, brak pętli retry po stronie serwera, najgorszy przypadek = 3 zapytania.
- Naprawa B-1c/B-1d po stronie klienta: wartownik działa (scenariusz E: 1 DELETE na 10 ticków, F: 1 DELETE na pierwszy tick). Problem zostaje tylko w ścieżce błędów (P1, P2).

## 6. Werdykt

**ODRZUCONE** (cofnięcie do etapu 5, frontend; backend bez zmian poza P6 i ryzykiem migracji).

Blokujące wydanie:
1. P1 (krytyczne): nieskończona pętla DELETE na każdej stronie dla gościa i wygasłej sesji. Dowód: symulacja scenariusza A, trace kodu linie 156-232, 339-357, `lib/active-workout-cloud-client.ts:160`.
2. P2 (wysokie): natychmiastowe ponawianie PUT przy 429, 5xx i braku sieci. Dowód: symulacja B i C, trace linii 219-229. Amplifikowane przez limit 90/min na IP (12 sesji na NAT siłowni).

Wymagane przed Promote, decyzja architekta (nie blokują etapu 5 same w sobie, ale wpływają na budżet):
3. P3 (wysokie): PUT co 8 s bez wykrywania zmian i z pełnym payloadem (4,05 mln zapisów/mies. w wariancie bazowym, 40% darmowego limitu zapisów Turso z blokadą po przekroczeniu).

Zatwierdzone z uwagami (niskie i średnie, do backlogu z właścicielem): P4-P9, ryzyko dostępności dedup (migracja vs `ensure-schema`).

Zgodnie z bramką: przekroczone SLO sync (błąd < 0,5%) w scenariuszu szczytowym (NAT, 429) i ścieżka bez sesji generująca nieograniczone żądania blokują wydanie.

Poza zakresem tego raportu: ustalenia bezpieczeństwa z wiersza 9 karty (F-1 wysoka, logi i Sentry) są oceniane przez `tester-bezpieczenstwa`.

## 7. Ryzyka resztkowe i następne kroki

- Po poprawce P1 i P2: powtórzyć symulację `005-koniec-treningu-sim-push.ts` (oczekiwane: scenariusze A, B, C z ograniczonym tempem, np. ≤ 1 żądanie na 8 s w pętli błędów) i sondę w przeglądarce (Playwright, bez zalogowania, 10 s na `/login`, licznik żądań do `/api/active-workout-session`). Wymaga `npx playwright install chromium` i przeglądarki w tej sesji.
- Po P3: zmierzyć liczbę PUT na trening (aktywna sesja, 60 min, realistyczna frekwencja serii) i rozmiar payloadu po odchudzeniu.
- Pomiar CWV (LCP/INP/CLS) i profil React na telefonie klasy średniej przez 4G/CPU x4: wymagany przed Promote (sekcja 3.6 jest strukturalna).
- Rozmiar bundla ekranu zakończenia (`workout-finished-screen.tsx`, `next/dynamic`): `npm run build` z analizatorem.
- Realne RTT Vercel-Turso (region) i liczba IP na siłowni: do zmierzenia w środowisku testowym, nie na produkcji.
- Aktualizacja `00-analiza-bazowa.md` §4: limit Upstash (500 K/mies., nie 10 K/dzień) i zachowanie Turso (blokada po przekroczeniu) - do decyzji architekta.

## 8. Odpowiedzi na punkty zakresu (skrót)

1. `complete`: +1 zapytanie (dedup), indeks obecny (migracja 0033), brak CAS i pętli. Ryzyko braku kolumny w `ensure-schema`. Zob. 3.1, P6.
2. Cardio PATCH: 2 zapytania, zgodnie z ADR. Zob. 3.2.
3. `active-workout-session`: cykl 8 s to PUT (nie GET), najgorszy przypadek 3 zapytania, brak pętli serwera, CAS bez wzrostu w zwykłym przypadku. Koszt sync i pętle klienta: P1-P5.
4. Reguła bodyweight: 0,25-0,32 ms na 12 800 serii, bez różnicy. Zob. 3.4.
5. Hook zakończenia: 1 zapytanie (nie N+1), szeregowe. Zob. 3.5, P7.
6. CWV: nie zmierzone (brak przeglądarki). Ocena strukturalna: zob. 3.6.

## 9. Powtórka po poprawkach P1/P2/P3 (etap 9, 2026-10-25)

Zakres: P1 i P2 (frontend: `components/active-workout/active-workout-cloud-sync.tsx` z gate `authenticated`, `scheduleRetry`, `waitForOnline`; `lib/active-workout-sync-backoff.ts`), P3 w części backendowej (`db/ensure-schema.ts`, kolumna i indeks `operation_id`). Pozostałe P3 (PUT co 8 s z pełnym payloadem) to decyzja architekta i nie były przedmiotem poprawki.

Skrypt: `docs/wydajnosc/005-koniec-treningu-sim-push.ts`, zaktualizowany pod nowy kod. Replika efektu (gate, `push()`, `scheduleRetry`, `waitForOnline`, `setInterval` 8 s, `setTimeout` ponowienia) na zegarze wirtualnym, okno 10 min symulowanego czasu. Prawdziwe: `deleteCloud`/`putCloud`/`readRevision`/`writeRevision` (`lib/active-workout-cloud-client.ts`), `computeSyncRetryDelayMs`/`isAuthErrorStatus`/`isLikelyOfflineError` (`lib/active-workout-sync-backoff.ts`). Uruchomienie: `npx tsx docs/wydajnosc/005-koniec-treningu-sim-push.ts`. Brak przeglądarki, więc nie zmierzono tego samego w Chromium (patrz sekcja 9.6).

### 9.1 Wyniki (żądania HTTP w 10 min symulowanego czasu)

| Scenariusz | Przed poprawką (sekcja 4) | Po poprawce | Oczekiwane | Ocena |
|---|---|---|---|---|
| A. Gość (`unauthenticated`) | ok. 24 000/h na kartę (pętla, 1000 żąd. w 95 ms) | 0 | 0 | P1 ZAMKNIĘTE dla gościa |
| A2. Zalogowany po stronie klienta, sesja wygasła, DELETE -> 401 | pętla bez opóźnienia | 75 (7,5/min, bez końca) | brak pętli | P1 częściowo (R-1) |
| A3. Aktywna sesja, PUT -> 401 | pętla bez opóźnienia | 75 (7,5/min, bez końca) | brak pętli | P1 częściowo (R-1) |
| B. Aktywna, PUT -> 429, `Retry-After: 60` | 43 ms / 1000 żąd. | 75 | ok. 10 | P2 NIE ZAMKNIĘTE (R-2) |
| C. Aktywna, PUT -> 500 bez `Retry-After` | pętla bez opóźnienia | 75 | ok. 11 (8/16/32/60 s) | P2 NIE ZAMKNIĘTE (R-2) |
| D. Aktywna, brak sieci 10 min, potem `online` | 27 ms / 1000 `fetch` | 75 żądań; 75 nasłuchiwaczy `online` (rosną bez końca) | bez narastania | P2 NIE ZAMKNIĘTE (R-3) |
| E. Kontrola: aktywna, PUT -> 200 | 1 PUT na tick | 75 PUT | 75 | zgodne z P3 (nieodchudzone) |
| F. Zalogowany bez sesji, pierwszy tick | 1 DELETE | 1 DELETE | 1 | OK |
| G. Sesja zakończona offline, DELETE rzuca wyjątek | nie mierzono | 1 próba, 1 nieobsłużone odrzucenie, brak ponowienia | DELETE ponowiony po powrocie sieci | NOWY R-4 (poprawność) |

### 9.2 P1 (krytyczne) - stan: zamknięte dla gościa, pozostaje cykliczne 401

- Gość: efekt `ActiveWorkoutCloudSync` wychodzi przy `!authenticated` (linie 101, 172-178) przed hydracją i przed `setInterval`. Zero żądań (sim A). Potwierdzone czytaniem kodu i symulacją.
- Zalogowany z 401 po stronie serwera (sesja wygasła, a `useSession` jeszcze pokazuje `authenticated`): `scheduleRetry` nie planuje ponowienia dla 401/403 (`lib/active-workout-sync-backoff.ts`), ale `setInterval` (linia 329) i tak wysyła żądanie co 8 s. Sim A2/A3: 75 żądań w 10 min, bez końca, aż do zmiany statusu sesji (np. przeładowanie lub `refetchOnWindowFocus`). Tempo nie jest już nieograniczone, ale tab pozostawiony otwarty generuje ok. 10 800 invocations na dobę. Ryzyko: średnie. Naprawa to ta sama bramka co P2 (patrz 9.3, pkt 3).

### 9.3 P2 (wysokie) - stan: NIE ZAMKNIĘTE

Przyczyna (dowód: kod linia 329 i sim B/C/D): `window.setInterval(() => void push(), PUSH_INTERVAL_MS)` działa niezależnie od `retryTimeoutRef` (linie 207-210) i od `waitForOnline`. Backoff jest więc tylko dokładany do ticka 8 s, a nie zastępuje go. Efekt:
- Sim B (429 z `Retry-After: 60`): 75 żądań w 10 min zamiast ok. 10. `Retry-After` jest odczytywany (`parseRetryAfterSec`, `active-workout-cloud-client.ts:105-110`) i wpada do `computeSyncRetryDelayMs`, ale nie ogranicza ticka.
- Sim C (500): backoff 8/16/32/60 s nigdy nie wpływa na tempo, bo tick 8 s to jedyny realny rytm.
- Sim D (offline): każdy tick dokłada nasłuchiwacz `online` (`waitForOnline`, linia 214-223, bez deduplikacji i bez usuwania). Po 10 min offline 75 nasłuchiwaczy; po `online` 75 wywołań `push()` (kolejka `pushingRef` je zwija, ale pamięć rośnie liniowo z czasem offline).
- Amplifikacja NAT (sekcja 3.3): 12 sesji x 7,5/min = 90/min, czyli dokładnie limit `RATE.activeWorkoutSession`. Sesje z jednego IP nie wychodzą z błędu, a każde odrzucone żądanie zużywa komendę Upstash (rate limit przed bazą, licznik liczony także dla 429).
- Koszt Upstash w stanie błędu (free 500 K komend/mies., cennik 2026-10-25): jedna sesja w pętli błędów to 7,5 x 60 x 24 x 30 = ok. 324 K komend/mies., czyli 65% darmowego limitu na jedną sesję. Z działającym backoffem z limitem 60 s: ok. 43 K/mies.

Próg SLO (sync błędy < 0,5%) nie jest przy 429/5xx spełniany, bo wszystkie żądania w tym czasie są błędne. Wymóg z sekcji 4 P2 (nie ponawiać natychmiast, respektować `Retry-After`, przy braku sieci czekać na `online`) jest spełniony tylko częściowo: nie ma natychmiastowej pętli, ale ponowienia nie są sterowane backoffem ani `Retry-After`.

Poprawka minimalna (frontend, 3 linie + flagi), oczekiwany wynik po niej: sim B ok. 10, sim C ok. 11, sim D 1 nasłuchiwacz, sim A2/A3 ok. 1 żądanie na zmianę statusu:
1. Tick `setInterval` pomija `push()`, gdy `retryTimeoutRef.current != null` lub gdy oczekuje na `online` (nowy `waitingOnlineRef`).
2. `waitForOnline` rejestruje jeden nasłuchiwacz (flaga `waitingOnlineRef`) i zdejmuje go w cleanup efektu.
3. 401/403 w `scheduleRetry` ustawia flagę `pausedAuthRef`, którą tick i `push()` respektują do zmiany `authenticated` (wtedy cleanup/ponowny start efektu).

### 9.4 R-4 (nowy, poprawność na ścieżce DELETE) - sim G

Gałąź DELETE w `push()` (linie 236-263) ma `try/finally`, ale nie ma `catch`. Gdy `deleteCloud` rzuca wyjątek (fetch odrzucony, brak sieci), `clearedPushedRef.current` zostaje `true` (ustawione na linii 237, reset tylko przy `!result.ok` na linii 242, którego nie dochodzimy), a wyjątek ucieka jako nieobsłużone odrzucenie z `void push()`. Sim G: 1 próba DELETE, 1 nieobsłużone odrzucenie, 0 ponowień w 10 min, mimo powrotu sieci. Skutek: wygaszenie sesji nigdy nie trafia do chmury, aktywny wiersz S1 zostaje na serwerze, a inne urządzenie może ją wznowić (klasa N-P13, ADR 0004). To nie jest problem wydajności, tylko poprawności, więc przekazuję do `tester` i `architekt`. Poprawka techniczna: `catch` w gałęzi DELETE traktujący wyjątek jak błąd sieci (reset `clearedPushedRef`, `waitForOnline`).

### 9.5 P3 w części DB (`db/ensure-schema.ts`) - stan: ZAMKNIĘTE

- `db/ensure-schema.ts:1489-1492`: `tryAddColumn(ALTER TABLE "workouts" ADD COLUMN "operation_id" text)` (idempotentne, duplicate column łapane) oraz `CREATE UNIQUE INDEX IF NOT EXISTS "uq_workouts_user_operation" ON "workouts" ("user_id","operation_id")`. Zgodne z `db/schema.ts:280-285` i migracją 0033.
- Test `db/workouts-indexes.test.ts` (5/5 OK) obejmuje dopisanie kolumny i indeksu w tabeli bez nich.
- Ścieżka uruchomienia: `instrumentation.ts` wywołuje `ensureCriticalSchema()` na starcie procesu (po `runMigrations`, także gdy migracje pliku są pominięte). Ryzyko resztkowe (niskie): sam `POST /api/workouts/complete` nie wywołuje `ensureCriticalSchema()`, więc poprawność zależy od startu procesu (instrumentation) lub wcześniejszego wywołania w tym samym procesie. Rekomendacja (backend, opcjonalna): wywołać `ensureCriticalSchema()` w handlerze `complete` albo polegać na instrumentation.

### 9.6 Ocena wartości backoffu (8 s / 16 s / 32 s / 60 s) wobec limitów

- Pierwszy odstęp 8 s to ten sam rytm co tick, więc dla błędów przejściowych jest rozsądny. Przy 429 serwer podaje `Retry-After` (sekundy okna `RATE.activeWorkoutSession`, 60 s), a `computeSyncRetryDelayMs` bierze `max(8 s, Retry-After)`, co jest poprawne.
- Limit 60 s przy długotrwałym 5xx to 1 żądanie/min/sesję, ok. 43 K komend Upstash/mies. na sesję (free 500 K) i zero problemu dla Turso (500 M odczytów/mies., błędy 5xx zwykle bez zapisu). Dla pracy na siłowni (lokalny zapis, sync tylko między urządzeniami) 60 s jest do przyjęcia. Opcjonalnie: górny limit 300 s dla 5xx (ok. 8,6 K/mies. na sesję).
- Wartości są rozsądne, ale działają tylko po zamknięciu P2 (pkt 9.3). Dziś nie mają wpływu na tempo.
- Upstash: 1 komenda na każde żądanie, także odrzucone (rate limit przed bazą, licznik przed odpowiedzią). Turso: błędy 401/429 nie dotykają bazy; 5xx może wykonać SELECT, co przy 1/min/sesję jest pomijalne.

### 9.7 Czego nie zmierzono

- Przeglądarka (Chromium/Playwright z throttlingiem sieci i CPU): sonda 10 s na `/login` nadal niewykonana, brak przeglądarek w sesji.
- Realne `Retry-After` z limitera (sim używa stałej 60 s) i realne RTT Vercel-Turso.
- Zachowanie `navigator.onLine`/`online` na prawdziwym telefonie (sim wstrzykuje zdarzenia).
- P3 (liczba PUT, rozmiar payloadu po odchudzeniu): nie zmieniane, wymaga decyzji architekta.

### 9.8 Werdykt powtórki

**ODRZUCONE** (cofnięcie do etapu 5, frontend; backend bez zmian poza opcjonalnym pkt 9.5).

Powody:
1. P2 NIE ZAMKNIĘTE (krytyczne dla bramki): tick 8 s omija backoff i `Retry-After` (sim B/C/D: 75 żądań w 10 min zamiast ok. 10; nasłuchiwacze `online` rosną liniowo). Poprawka minimalna w pkt 9.3.
2. R-4 (poprawność, wysokie, przekazane do tester/architekt): brak obsługi wyjątku w gałęzi DELETE, wygaszenie sesji nie dociera do chmury (sim G).
3. R-1 (średnie, ta sama bramka co P2): 401 bez końca co 8 s w zalogowanym tabie z wygasłą sesją.
4. P3 (decyzja architekta przed Promote, bez zmian): PUT co 8 s, 75/10 min, pełny payload. Wymóg z sekcji 6 pkt 3 pozostaje.

Zamknięte: P1 dla gościa (0 żądań, sim A); P3 w części DB (kolumna i indeks w `ensure-schema.ts`); wartości backoffu (rozsądne, po zamknięciu P2).

Nie zmierzono: patrz 9.7. Bez przeglądarki werdykt jest oparty na symulacji repliki i czytaniu kodu.

## 10. Ostatnia weryfikacja etapu 9 (poprawki 9e/8c, 2026-10-25)

Zakres: sprawdzenie w kodzie punktów z sekcji 9.3 (P2) i 9.4 (R-4) oraz ponowna symulacja `docs/wydajnosc/005-koniec-treningu-sim-push.ts` zaktualizowana do kodu po poprawce (tick gate, `waitingOnlineRef`, `catch` w DELETE). Uruchomienie: `npx tsx docs/wydajnosc/005-koniec-treningu-sim-push.ts`.

### 10.1 Weryfikacja w kodzie (`components/active-workout/active-workout-cloud-sync.tsx`)

| Punkt | Stan | Dowód |
|---|---|---|
| 9.3 pkt 1: tick pomija `push()` przy zaplanowanym ponowieniu lub oczekiwaniu na `online` | ZAMKNIĘTE | linie 359-362: `if (retryTimeoutRef.current != null \|\| waitingOnlineRef.current) return;` |
| 9.3 pkt 2: jeden nasłuchiwacz `online` (dedupe) | ZAMKNIĘTE (z uwagą niską) | linie 224-236: `waitingOnlineRef` blokuje drugi listener, flaga zdejmowana w callbacku. Listener nie jest zdejmowany w cleanup efektu (patrz 10.4) |
| 9.3 pkt 3: `pausedAuthRef` dla 401/403 | NIE ZAIMPLEMENTOWANE | brak w kodzie; tick nadal wysyła co 8 s przy 401 (`scheduleRetry` tylko nie planuje ponowienia) |
| 9.4 R-4: `catch` w gałęzi DELETE | ZAMKNIĘTE | linie 269-279: reset `clearedPushedRef`, `waitForOnline()` albo `scheduleRetry()` |
| 9.5 (DB, `operation_id`) | bez zmian w tej weryfikacji | zob. sekcja 9.5 |

### 10.2 Wyniki symulacji (żądania HTTP w 10 min symulowanego czasu)

| Scenariusz | Po poprawce 9e/8c | Oczekiwane (sekcja 9.1) | Ocena |
|---|---|---|---|
| A. Gość | 0 | 0 | ZAMKNIĘTE |
| A2. Zalogowany, sesja wygasła, DELETE -> 401 | 75 (7,5/min, bez końca) | ok. 1 na zmianę statusu | NIE ZAMKNIĘTE (R-1, brak `pausedAuthRef`) |
| A3. Aktywna sesja, PUT -> 401 | 75 | jak A2 | NIE ZAMKNIĘTE (R-1) |
| B. PUT -> 429, `Retry-After: 60` | 10 (1/min) | ok. 10 | ZAMKNIĘTE (R-2) |
| C. PUT -> 500 | 12 (8/16/32/60 s) | ok. 11 | ZAMKNIĘTE (R-2) |
| D. Brak sieci 10 min, potem `online` | 1 próba offline; po `online`: 1 PUT + 2 ticki w oknie 16 s; nasłuchiwaczy `online`: 1 (było 75) | 1 nasłuchiwacz, brak narastania | ZAMKNIĘTE (R-3) |
| E. Kontrola: PUT -> 200 | 75 | 75 (P3, nieodchudzone) | bez zmian, P3 otwarte |
| F. Zalogowany bez sesji, pierwszy tick | 1 DELETE | 1 | ZAMKNIĘTE |
| G. DELETE rzuca (online=true), potem sieć wraca | 2 DELETE (1 wyjątek, ponowienie po 8 s, sukces) | DELETE ponowiony | ZAMKNIĘTE (R-4) |
| G2. DELETE rzuca przy `navigator.onLine=false`, potem `online` | 1 próba offline, po `online` 1 DELETE | 1 próba, ponowienie po `online` | ZAMKNIĘTE (R-4) |

Przed poprawką (sekcja 9.1): B 75, C 75, D 75 + narastające nasłuchiwacze. Po poprawce: B 10, C 12, D 1 próba offline. Redukcja 7-75x, zgodna z oczekiwaniem z sekcji 9.6.

### 10.3 Wnioski

- P2 (429/5xx/offline) i R-4 są zamknięte w kodzie i potwierdzone symulacją: realna częstotliwość żądań spada z 75 do 10-12 w 10 min, a DELETE po błędzie sieci jest ponawiane.
- P1 NIE jest w pełni zamknięty: dla gościa 0 żądań (zamknięte), ale dla zalogowanego użytkownika z wygasłą sesją (A2/A3) tick co 8 s wysyła 401 bez końca, aż do zmiany statusu sesji (7,5 żąd./min na kartę, ok. 10 800 wywołań funkcji na dobę na otwartą kartę). Bez `pausedAuthRef` (sekcja 9.3 pkt 3) ta klasa pozostaje otwarta. Dotkliwość: średnia (nie scenariusz szczytowy, zero zapytań do Upstash, bo rate limit jest po auth; wynik 401 nie dotyka bazy).
- Pozostaje P3 (PUT co 8 s z pełnym payloadem, 4,05 mln zapisów/mies. w wariancie bazowym): decyzja architekta, nadal wymagana przed Promote (sekcja 6 pkt 3).

### 10.4 Ryzyka resztkowe (niskie, do backlogu, właściciel: frontend)

- `schedulePush` (zmiany w store, debounce 700 ms) i `pendingChangeRef` w `finally` wywołują `push()` z pominięciem bramki backoff. To nie tworzy pętli (zależy od zdarzeń użytkownika), ale przy 429 każda zmiana wysyła jedno żądanie. Do rozważenia: bramka także dla `push()` wywoływanego z debounce.
- Listener `online` nie jest zdejmowany w cleanup efektu. Po zmianie `authenticated` stary listener może pozostawić `waitingOnlineRef = true` do kolejnego zdarzenia `online`, a ticki stoją w tym czasie. Samonaprawia się przy `online`, brak narastania pamięci.
- Symulacja nie modeluje wejść użytkownika ani realnego `Retry-After` z limitera (stała 60 s), ani RTT.

### 10.5 Czego nie zmierzono

- Przeglądarka (Chromium/Playwright, throttling sieci i CPU): nadal brak, sonda 10 s na `/login` niewykonana.
- Zachowanie `navigator.onLine` i zdarzeń `online` na prawdziwym telefonie (symulowane).
- P3: liczba PUT po odchudzeniu payloadu nie była przedmiotem tej weryfikacji.

### 10.6 Werdykt

**ODRZUCONE** (etap 5, frontend; wąska poprawka). Powód: P1 nie jest w pełni zamknięty (A2/A3: nieskończona pętla 401 co 8 s dla zalogowanego z wygasłą sesją, brak `pausedAuthRef`). Zamknięte: P2 (B/C/D), R-3, R-4 (G/G2), P1 dla gościa. Poprawka: w `active-workout-cloud-sync.tsx` flaga `pausedAuthRef` ustawiana w `scheduleRetry` przy 401/403 i respektowana przez tick i `push()` do zmiany `authenticated` (ok. 5 linii). Po niej oczekiwane: A2/A3 ok. 1 żądanie. Po ponownym przebiegu symulacji (`npx tsx docs/wydajnosc/005-koniec-treningu-sim-push.ts`) i zamknięciu P1 werdykt byłby ZATWIERDZONE Z UWAGAMI, z P3 jako warunkiem decyzji architekta przed Promote i ryzykami z 10.4 w backlogu.

### 10.7 Implementacja poprawki (frontend, karta wiersz 5i, 2026-10-25)

- `pausedAuthRef` dodany na poziomie komponentu `ActiveWorkoutCloudSync` (`components/active-workout/active-workout-cloud-sync.tsx`). Ustawiany na `true` w `scheduleRetry` przy `isAuthErrorStatus(resultStatus)`. Respektowany przez: tick `setInterval` (razem z `retryTimeoutRef`/`waitingOnlineRef`), wejście do `push()`, wejście do `hydrate()` (GET przy montażu/zmianie `authenticated`).
- Reset: na początku ciała drugiego `useEffect` (ten z `push`/tick), gdy `authenticated === true` — czyli przy każdym (re)montażu efektu po przejściu `false`→`true`. Bez dodatkowego mechanizmu wykrywania „sesja faktycznie wróciła” (uznane za nadmiarowe dla rzadkiego przypadku, zgodnie z poleceniem).
- Test: pozostaje tylko jako replika w symulacji (`docs/wydajnosc/005-koniec-treningu-sim-push.ts`, pole `refs.pausedAuth`) — nie wydzielono do `lib/active-workout-sync-backoff.ts`, bo to stan mutowalny współdzielony między trzema miejscami komponentu, nie czysta funkcja (ten sam status jak `waitingOnlineRef`/`retryTimeoutRef`, które też nie mają dedykowanych testów jednostkowych).
- Wynik symulacji po poprawce: A2 i A3 — **1 żądanie w 10 min** (było 75), zgodnie z oczekiwaniem sekcji 9.1/10.6. Pozostałe scenariusze (A, B, C, D, E, F, G, G2) bez zmian względem 10.2.
- `npx tsc --noEmit` czysty, `npm run lint` 142/104/38 (= baseline), `npm test` 1151 testów — 1149 OK, 2 awarie pre-istniejące (`lib/android-version.test.ts`, dryf wersji APK, niepowiązane).
- Pozostaje otwarte przed Promote: P3 (PUT co 8 s z pełnym payloadem) — decyzja architekta, poza zakresem tej poprawki.

## 11. Niezależna weryfikacja `pausedAuthRef` (P1/R-1), tester-wydajnosci, 2026-10-25

Zakres: sekcja 10.7 i karta wiersz 5i. Weryfikacja w kodzie i ponowny przebieg `docs/wydajnosc/005-koniec-treningu-sim-push.ts` (`npx tsx`, stan roboczy gałęzi `feat/koniec-treningu-flow`; `active-workout-cloud-sync.tsx` bez zmian względem HEAD, `git diff` pusty dla tego pliku).

### 11.1 Kod (`components/active-workout/active-workout-cloud-sync.tsx`)

| Punkt | Linia | Stan |
|---|---|---|
| Deklaracja `pausedAuthRef` | 106 | obecna |
| Ustawienie `true` w `scheduleRetry` przy 401/403 (bez ponowienia) | 216-224 | obecne, zgodne z `isAuthErrorStatus` (401, 403) |
| Guard w `hydrate()` | 132 | obecny |
| Guard w `push()` | 257 | obecny |
| Guard w ticku `setInterval` | 379 | obecny |
| Reset `false` przy `authenticated === true` | 199 | obecny, ale w drugim efekcie (patrz 11.3) |

### 11.2 Wyniki symulacji (10 min symulowanego czasu)

| Scenariusz | Wynik 2026-10-25 | Wynik po 10.2 | Ocena |
|---|---|---|---|
| A. Gość | 0 | 0 | bez zmian, ZAMKNIĘTE |
| A2. Zalogowany, DELETE -> 401 | 1 (DELETE 1) | 1 | ZAMKNIĘTE (R-1) |
| A3. Aktywna, PUT -> 401 | 1 (PUT 1) | 1 | ZAMKNIĘTE (R-1) |
| B. PUT -> 429, `Retry-After: 60` | 10 | 10 | bez zmian, ZAMKNIĘTE (R-2) |
| C. PUT -> 500 | 12 | 12 | bez zmian, ZAMKNIĘTE (R-2) |
| D. Offline 10 min, potem `online` | 1 próba offline, 1 nasłuchiwacz; po `online` 3 PUT (1 + 2 ticki) | jak 10.2 | bez zmian, ZAMKNIĘTE (R-3) |
| E. Kontrola PUT -> 200 | 75 | 75 | bez zmian, P3 otwarte |
| F. Zalogowany bez sesji | 1 DELETE | 1 | bez zmian, ZAMKNIĘTE |
| G. DELETE rzuca, potem sieć wraca | 2 DELETE (1 wyjątek, ponowienie, sukces), 0 nieobsłużonych | 2 | bez zmian, ZAMKNIĘTE (R-4) |
| G2. DELETE rzuca przy `online=false`, potem `online` | 2 (1 offline, 1 po `online`) | 2 | bez zmian, ZAMKNIĘTE (R-4) |

Brak regresji w A-G2. Symulacja nie zmienia wyniku dla A2/A3 w zależności od kolejności efektów (patrz 11.3): replika `start()` zeruje flagę przed "hydracją", a replika nie ma `hydrate()`.

### 11.3 Ustalenie (kod, niska dotkliwość): reset flagi jest po `hydrate()`, więc pauza może pominąć hydrację po ponownym zalogowaniu

- React uruchamia efekty komponentu w kolejności deklaracji. Pierwszy efekt (`hydrate`, linie 112-186) czyta `pausedAuthRef` w linii 132. Drugi efekt (linia 188+) zeruje flagę w linii 199. Przy przejściu `false`→`true` pierwszy efekt widzi jeszcze flagę ustawioną w poprzedniej sesji i kończy się wcześnie.
- Warunek: 401/403 ustawił pauzę, a potem użytkownik wylogował się i zalogował ponownie w tej samej karcie bez przeładowania strony (przeładowanie tworzy nowy komponent i zeruje refy).
- Skutek: brak GET i brak `decideCloudHydrateAction`, czyli nie zostaje podjęte wznowienie sesji z innego urządzenia. Blok `finally` mimo to ustawia `hydratedRef = true` i `markActiveWorkoutCloudHydrated()`, więc sync startuje bez stanu z chmury. Utraty danych nie ma: push niesie rewizję, a niezgodność daje 409, które obsługuje `shouldApplyConflictPayload`.
- Twierdzenie z 10.7 i wiersza 5i, że `hydrate()` respektuje reset przy zmianie `authenticated`, jest błędne dla tej kolejności efektów.
- Dotkliwość: NISKA (wąska ścieżka, bez wpływu na SLO i bez utraty danych).
- Rekomendacja (frontend, jedna linia): zerować `pausedAuthRef.current = false` w gałęzi `if (!authenticated)` obu efektów (wtedy flaga jest czyszczona przy wyjściu z sesji, zanim nastąpi kolejne zalogowanie), albo na początku pierwszego efektu po `if (!authenticated) return;`.
- Weryfikacja po poprawce: ręczny lub E2E scenariusz logout→login bez przeładowania po 401 (symulacja tego nie pokrywa).

### 11.4 Ustalenie (kod, niska dotkliwość): 403 z CSRF/origin jest traktowany jak 401

- `lib/csrf.ts` zwraca 403 przy braku lub niezgodności tokenu CSRF oraz przy niedozwolonym `Origin`. `isAuthErrorStatus` obejmuje 403, więc przejściowy błąd CSRF (np. cookie z innej karty) wstrzymuje sync do zmiany `authenticated`, bez ponowienia. Przed zmianą 5i ten przypadek był ponawiany backoffem.
- Ryzyko niskie: `putCloud`/`deleteCloud` wywołują `ensureCsrfCookie()` przed żądaniem, więc ścieżka jest rzadka.
- Rekomendacja (frontend, backlog): pauzować tylko przy 401, a 403 traktować jak błąd ponawialny (albo rozdzielić 403 CSRF od 403 sesji w odpowiedzi).

### 11.5 Ryzyka resztkowe (backlog, właściciel: frontend)

- Z 10.4 bez zmian: `schedulePush` i `pendingChangeRef` wywołują `push()` z pominięciem bramki backoff (przy 429 każda zmiana to jedno żądanie); listener `online` nie jest zdejmowany w cleanup.
- Efekt drugi ma `t` w zależnościach. Jeśli `t` zmienia referencję w trakcie sesji, efekt restartuje się i zeruje pauzę, czyli wraca jedno żądanie 401. Ocena z kodu, nie zmierzona.

### 11.6 Czego nie zmierzono

- Przeglądarka (Chromium/Playwright): brak, sonda na żywo niewykonana.
- Realne odpowiedzi 401 z NextAuth i przejście logout→login w jednej karcie (11.3).
- Realne `Retry-After` z limitera.

### 11.7 Werdykt

- P1 (R-1, wydajność): **ZAMKNIĘTE**. Gość 0 żądań, zalogowany z wygasłą sesją 1 żądanie w 10 min (było 75), bez regresji w A-G2.
- Bramka wydajności zadania 005 (wiersz 9g): **ZATWIERDZONE Z UWAGAMI**. Uwagi niskiego ryzyka do backlogu z właścicielem frontend: 11.3 (zalecana jednoliniowa poprawka przed Promote), 11.4, 11.5. P3 (PUT co 8 s z pełnym payloadem) pozostaje decyzją architekta przed Promote i nie wchodzi w tę bramkę.
