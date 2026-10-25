# 005 - Koniec treningu: bramka wyjściowa (prawnik, etap 10)

- **Zadanie**: `docs/zadania/005-koniec-treningu-przeplyw.md`
- **Bramka wejściowa**: `docs/prawo/005-koniec-treningu-przeplyw-wejscie.md` (LR-1..LR-8, ZATWIERDZONE Z UWAGAMI)
- **Data**: 2026-10-25
- **Gałąź**: `feat/koniec-treningu-flow` (stan roboczy, bez commitów)
- **Status**: projekt roboczy asystenta AI. Nie jest poradą prawną. Teksty dla użytkowników (mikrokopia, changelog, zgody) i zmiany dokumentów 00/01 wymagają zatwierdzenia przez prawnika-człowieka przed publikacją.
- **Weryfikacja przepisów**: próba sprawdzenia w oficjalnych źródłach (2026-10-25) dała tylko wtórne komentarze. Stanowiska EDPB, na które powołują się takie komentarze, nie udało się potwierdzić w źródle EDPB. Art. 4 pkt 15 RODO (definicja danych o zdrowiu) i art. 9 ust. 2 lit. a RODO (wyraźna zgoda) oceniam z wiedzy asystenta. **Pełna weryfikacja w ISAP, EUR-Lex, UODO i EROD jest nadal do wykonania przez prawnika-człowieka.**

## 1. Werdykt

**ODRZUCONE (wąsko).** Zadanie nie jest gotowe do merge ani do Promote. Przyczyny są małe, ale każda dotyczy tekstu, który użytkownik czyta przy zapisie treningu (LR-2), albo dokumentu, który twierdzi coś nieprawdziwego (LR-5). Logika zapisu i idempotencji (LR-3, LR-4) jest w zasadzie zrobiona.

Po trzech poprawkach z sekcji 2 (blokady TERAZ) prawnik może wydać ZATWIERDZONE Z UWAGAMI dla PR/Preview. Warunki z sekcji 3 nadal blokują Promote na produkcję.

## 2. Blokady TERAZ (przed merge PR)

| ID | Co | Gdzie | Kto | Wymóg |
|---|---|---|---|---|
| B-1 | Przycisk „Zakończ trening” na ekranie przerwy po ostatniej serii zapisuje bez dialogu i bez słowa o zapisie (LR-2 pkt 1). Ścieżka: `rest-break-screen.tsx:260-261` (`ctaLabel`), `active-workout-view.tsx:697-703` (`continueAfterRest` → `flow.requestFinish()`). Gdy nie ma pominiętych serii, `requestFinish` zapisuje od razu. | `components/active-workout/rest-break-screen.tsx`, `active-workout-view.tsx` | frontend, ux | Albo zmienić etykietę na „Zakończ i zapisz” i wymusić dialog/potwierdzenie na tym wejściu, albo usunąć ten wariant CTA (ADR p. 5 mówi, że przerwa po ostatniej serii nie istnieje; ścieżka jest osiągalna w rzadkich przypadkach, np. zamknięta sesja z drugiego urządzenia przy otwartej przerwie). |
| B-2 | Na ekranie przerwy kafelek „Zapisano X z Y serii” i kicker „Trening zakończony” pojawiają się przed zapisem treningu na serwerze. Słowo „Zapisano” sugeruje zapis w historii, a go jeszcze nie ma (LR-2: tekst prawdziwy co do momentu zapisu). | `rest-break-screen.tsx:183, 189` | ux, frontend | Zmienić na „Wykonano X z Y serii” (kicker: „Wszystkie serie za tobą” albo bez nazwy zdarzenia zapisu). Nazwa „Trening zakończony” jest zarezerwowana dla ekranu po zapisie. |
| B-3 | Ekran „Trening zakończony” w wersji dla treningu na masę ciała pisze „Ciężary są w historii i w Postępach”. Tekst jest nieprawdziwy dla serii bez ciężaru (LR-2, prawdziwość treści). | `workout-finished-screen.tsx:343` | ux | Np. „Trening jest zapisany. Serie są w historii i w Postępach.” |
| B-4 | Wpis w changelogu (planned: true, bullet o zerowym ciężarze) nie mówi, że serie na masę ciała są widoczne dla rywali Ghost, także w dawnych treningach (LR-5, 004 LR-8 d). | `components/changelog/changelog-data.ts` (wpis „Zapowiedź — Koniec treningu”, ok. l. 8-17) | prawnik-człowiek (zatwierdzenie tekstu), frontend (wpis) | Dopisać jedno zdanie, np.: „Serie na masę ciała (np. pompki) są widoczne dla rywali w Ghost Training, jeśli udostępniasz trening, także w treningach zapisanych wcześniej.” Tekst do zatwierdzenia przez człowieka przed Promote. |
| B-5 | ADR 0004 p. 6 i tabela LR-5 twierdzą „bez zmiany filtra Ghost” i „bez zmian kodu” dla `timeline.ts`. To nieprawda: zmienia się zakres wejścia przez `isCompletedWorkoutSet`. | `docs/adr/0004-koniec-treningu-przeplyw.md` (p. 6, tabela w p. 10) | architekt | Skorygować zdanie: filtr Ghost zmienia się przez `isCompletedWorkoutSet`, zakres rozszerzony zgodnie z decyzją właściciela (zadanie 005 p. 8, Q-P1), z odwołaniem do 004 LR-8 (d) (zaktualizowane w tym etapie). |

Uwaga: B-1 i B-2 dotyczą mikrokopii o zapisie. Zgodnie z 004 pkt 5.1 ogólne etykiety zatwierdza `ux`, a komunikaty o zapisie i danych zdrowotnych zatwierdza człowiek (005 wejście, sekcja 5). Zmiany B-1..B-3 wymagają potwierdzenia człowieka przed Promote, nie przed PR.

## 3. Warunki przed Promote (wymagają prawnika-człowieka lub właściciela)

### 3.1 Q-P2: tętno, kalorie, kroki z cardio jako dane zdrowotne (decyzja)

**Decyzja projektu (do zatwierdzenia przez prawnika-człowieka):**
- **Tętno** (`avgHr`, `maxHr`, `heartRateZone`): dane o zdrowiu w rozumieniu art. 4 pkt 15 RODO, czyli szczególna kategoria z art. 9. To pomiar stanu fizjologicznego organizmu, a strefa tętna jest jego pochodną. Klasyfikacja jest wysoce prawdopodobna, ale nie zweryfikowana w źródle.
- **Kroki, kalorie, dystans, tempo, typ i wysiłek cardio**: dane o aktywności. Same w sobie są słabiej związane ze zdrowiem, ale w jednym rekordzie z tętnem i w kontekście celów ujawniają kondycję. Klasyfikuję cały obiekt `cardio` jako Z9-A (ostrożnościowo), żeby nie dzielić pól w UI i w dokumentach.
- **Podstawa**: art. 9 ust. 2 lit. a RODO (wyraźna zgoda) albo inny wyjątek z art. 9 ust. 2. Art. 6 ust. 1 lit. b (wykonanie umowy) sam nie wystarcza dla tej kategorii. Żaden inny wyjątek nie pasuje do dziennika cardio.

**Stan faktyczny:** zgody w aplikacji nie ma. Potwierdza to `docs/prawo/00-inwentaryzacja-danych.md`, Braki 1-2 (brak rejestru zgód i brak wyraźnej zgody art. 9). Luka istniała przed tą zmianą. Ta zmiana zwiększa jej skalę: cardio po treningu staje się główną ścieżką wpisu tętna i kroków, a PATCH dopisuje je także po zapisie.

**Wymóg przed Promote (decyzja właściciela i prawnika-człowieka, jedna z dwóch opcji):**
- (A) Zgoda art. 9 przy pierwszym wpisie tętna lub kroków: osobne pole wyboru, nieprzedwybrane, dobrowolne, wersjonowane, z zapisem serwerowym (kto, kiedy, wersja tekstu) i wycofaniem tak łatwym jak udzielenie. Wycofanie kasuje pola tętna i kroków. To zależy od rejestru zgód (00 Braki 1, R1). Bez rejestru opcja A nie jest zamknięta.
- (B) Do czasu zgody tętno i kroki nie są zapisywane w cardio po treningu (pola ukryte, bez przesyłania). Dystans i minuty zostają.
- Nie wolno wydać Promote z zapisem tętna bez jednej z tych opcji. Samo oznaczenie ryzyka w backlogu nie jest podstawą prawną.

Zmiany w `00` (kategoria 9, wiersz Z9) i `01` (wiersz 9, PO-7) mają być oparte na tej decyzji. Proponowany wpis do 00/01, do zatwierdzenia przez człowieka: „Tętno z cardio (średnie, maksymalne, strefa) to dane o zdrowiu (Z9-A). Kroki, kalorie, dystans, tempo i wysiłek z cardio klasyfikowane są ostrożnościowo jako Z9-A, bo są zapisane w tym samym rekordzie z tętnem. Podstawa: art. 9 ust. 2 lit. a RODO po wdrożeniu zgody (lub wyłączenie zapisu, opcja B).”

### 3.2 N-7h-2: deduplikacja `complete` przy innej treści (integralność i LR-2)

- Stan: `respondWithExistingWorkout` (`app/api/workouts/complete/route.ts`) przy tym samym `operationId` zwraca `ok: true, duplicate: true` i nie porównuje `exercises` ani `cardioMinutes`. Jeśli nowe serie dopisane po wznowieniu sesji są gubione po cichu, UI pokazuje „Trening jest zapisany”.
- Ocena: to nie jest wyciek między użytkownikami (dedup po `userId`, potwierdzone w `docs/bezpieczenstwo/005`, sekcja 3). Jest to naruszenie LR-2 (tekst o zapisie nieprawdziwy) i LR-3 (integralność zapisu, art. 5 ust. 1 lit. d RODO, dokładność danych). Dotkliwość: wysoka dla użytkownika, prawdopodobieństwo niskie.
- Wymóg: przed Promote przy różnicy treści dla tego samego klucza zwrócić konflikt (409) z komunikatem, bez ciszy. Obecne rozwiązanie z ADR p. 12 (tolerancja `startedAt`) tego nie obejmuje.

### 3.3 N-7h-1: retencja `active_workout_sessions` a tombstone (decyzja prawna o okresie)

- Stan: `lib/db-retention.ts` (`purgeBatched`, `activeWorkoutSessionsDays`, domyślnie 7) fizycznie usuwa wiersze z `updatedAt` starszym niż 7 dni. Usuwa też tombstone, na którym opiera się idempotencja (ADR p. 12-17 zakładają, że wiersz nie znika). Sonda E5 (`docs/testy/005-koniec-treningu-przeplyw.md`, sekcja 15) potwierdziła wskrzeszenie zakończonej sesji. Uwaga do karty zadania: N-7h-1 jest w raporcie testera (sekcja 15.4-15.5), a nie w raporcie wydajności.
- **Ocena okresu (prawna):**
  - Siedem dni dla **treści** aktywnej, nieukończonej sesji (ciężary, serie, cardio) jest w granicach minimalizacji i jest zgodne z `01`, wiersz 9 („aktywne sesje 7 dni”). Nie ma podstaw do wydłużenia.
  - Aplikacja sama traktuje sesję jako wygasłą po 24 h (`ACTIVE_WORKOUT_CLOUD_MAX_AGE_MS`). Siedem dni przechowywania treści po wygaśnięciu jest więc dłuższe, niż potrzebuje funkcja. Rekomendacja minimalizacji: po 24-72 h zerować payload (podmiana na `ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD`), a 7 dni zostawić jako maksimum.
  - **Tombstone sam w sobie nie zawiera danych o zdrowiu** (pusty payload, `userId`, rewizja, znaczniki czasu). Może więc trwać do usunięcia konta (kaskada). Usuwanie go przez purge nie jest wymagane przez minimalizację, a łamie integralność synchronizacji. To jest główny argument prawny.
- **Rekomendacja dla architekta:** nie usuwać wiersza przez purge; zerować payload po okresie retencji, a wiersz tombstone zostawić do kaskady przy usunięciu konta. Zmiana polityki w `01` (wiersz 9: „payload 7 dni, tombstone do usunięcia konta”) wymaga zatwierdzenia człowieka. Zmiana w `lib/db-retention.ts` jest poza moją oceną.

### 3.4 LR-7: seed i prompt grafiki „Nowe rekordy”

- Stan (`lib/pr-achievement-image.ts`, l. 57-59): seed to hash z `exerciseName|valueKg|dzień|pr-v2`. Wartość kg nadal trafia do seeda, który jest przesyłany do usługi zewnętrznej (Pollinations, przez proxy). LR-7 zalecał usunięcie `valueKg` z hasha przy tej zmianie. Nie zostało to zrobione.
- Prompt nie zawiera kg (dobrze). Nazwa ćwiczenia może być wpisem ręcznym użytkownika (`exercise.trim()`, l. 28), a to daje dane osobowe w prompcie, których minimalizacja z `01`, 4.3.2 wymaga. Usunąć ręczne nazwy (zamiast nich katalogowa lub ogólna).
- Wymóg przed Promote: seed bez `valueKg` (np. wyłącznie nazwa katalogowa i dzień), prompt bez wpisów ręcznych, test regresji seeda. Każda zmiana promptu wymaga przeglądu prawnika (`01`, LR-10).

### 3.5 Pozostałe warunki przed Promote (z wejścia LR-1..LR-8)

- LR-6: zalecany test lub reguła lint blokująca `console.*` w `components/active-workout/` i w nowych endpointach. Nie ma jej w `eslint.config.mjs`. Zalecenie, nie blokada.
- LR-8: eksport (`lib/user-data-export.ts`, `select()` wszystkich kolumn `workouts`) obejmuje `exercises` z cardio i `operationId`. Nie znalazłem testu eksportu po patchu cardio. Dodać test przed Promote.
- `npm run deploy:check` i E2E (`e2e/active-workout.spec.ts`, D-07, N-7g-1) przed merge. Wynik zapisać w karcie zadania.
- Ghost U-1 (lider bez flagi udostępniania): decyzja właściciela, zapisana w karcie, przed Promote (004 sekcja 9 pkt 2). Ta zmiana rozszerza widoczność w tym kanale (patrz 4.2).

## 4. Ocena punktów z zadania (1-5 z polecenia)

### 4.1 F-1 (logi i Sentry): zamknięte dla ścieżek uruchamianych w repo

Potwierdzone w kodzie:
- `lib/errors/app-error.ts`: `isDrizzleQueryError` rozpoznaje błąd po polach `query`/`params`; `safeDbQueryMessage` zwraca stały tekst plus komunikat sterownika z `err.cause` (bez SQL i wartości, z odcięciem 300 znaków); `toAppError` nie używa `err.message` dla błędów zapytań.
- `lib/errors/server-log.ts`: `sanitizeForLogging` działa na `original` (do `captureException`) i na `original ?? err.cause` (stack w konsoli). Surowy `DrizzleQueryError` nie trafia do konsoli ani do Sentry w ścieżce `withApiErrors` → `logServerError`.
- Testy: `lib/errors/app-error.test.ts`, `lib/errors/server-log.test.ts`. Retest w `docs/bezpieczenstwo/005` (sekcja 9.1): scenariusz S1 bez wycieku (0/4 w konsoli, 0/3 w zdarzeniu Sentry).

**Ocena LR-6: spełnione dla osiągalnej ścieżki. Pozostałe ryzyka są niskie i nie blokują:**
- R-1 (latentne): sanityzacja obejmuje tylko obiekt najwyższego poziomu, nie łańcuch `cause`. Nie jest osiągalne w obecnym kodzie. Poprawić przed każdym wzorcem opakowywania błędów bazy.
- F-1b: `db/with-retry.ts` (l. 44-48) loguje `e.message.slice(0, 120)` przy ponowieniu z błędem przejściowym. Parametry to identyfikatory (`userId`, `planId`, daty), nie wartości treningu. To nie jest dana o zdrowiu, ale SQL trafia do logu. Backlog, przed kolejną zmianą `with-retry`.
- F-1c: `instrumentation.ts` loguje surowy błąd migracji. Parametry to zaszyfrowane wartości. Backlog.

Zalecenie z LR-6 (test regresji dla zapisu z wymuszonym błędem i danymi syntetycznymi) jest spełnione przez `server-log.test.ts` tylko dla S1. Dla S2-S5 test nie istnieje; dodanie go to backlog.

### 4.2 F-2 (Ghost, decyzja: czy wymaga nowej zgody)

**Decyzja prawna:** zmiana nie wymaga nowej zgody. Patrz pełne uzasadnienie w aktualizacji 004 (sekcja 11, dopisek z 2026-10-25).
- Kategoria danych (serie treningowe) jest ta sama. Odbiorcy (znajomi z flagą udostępniania, lider zespołu) są ci sami. Zmienia się tylko, które serie już udostępnianego treningu wchodzą do osi czasu.
- Zgoda na udostępnianie treningów obejmuje ich zawartość. Warunki: wpis w changelogu (B-4), korekta ADR (B-5), decyzja w sprawie U-1 dla lidera bez flagi (3.5).
- **Uwaga do U-1:** dla lidera zespołu nie ma sprawdzenia flagi udostępniania (`targets.ts`, gałąź `leader`). Tam rozszerzenie dotyczy osób, które niczego nie udostępniły. Sama zmiana nie tworzy tego problemu, ale go zwiększa. Decyzja właściciela przed Promote, nie przed PR.
- Retroaktywność (dawne treningi): ta sama ocena. Wymóg to informacja w changelogu. Dopisek w aplikacji nie jest wymagany.

### 4.3 Q-P2 (cardio jako dane zdrowotne): decyzja w sekcji 3.1

### 4.4 N-7h-1 (retencja a tombstone): ocena w sekcji 3.3

Krótko: 7 dni jest w granicach dla treści sesji i zgodne z 01. Tombstone bez danych zdrowotnych może trwać do usunięcia konta. Zmiana w kodzie retencji wymaga zatwierdzenia polityki (01, wiersz 9).

### 4.5 Mikrokopia ekranu „Trening zakończony” (LR-2)

Sprawdziłem teksty w `workout-finished-screen.tsx`, `workout-saving-screen.tsx`, `workout-all-sets-done-dialog.tsx` oraz w `workout-finish-confirm-dialog.tsx` i `rest-break-screen.tsx`:
- Zgodne z LR-2: „Zapisuję trening…”, „Nie udało się zapisać treningu” z przyciskami „Spróbuj ponownie” i „Wróć do treningu”, „Wolne połączenie, nadal zapisujemy…”, „Trening jest zapisany…” (po sukcesie), „Zapisany offline — wyślemy po odzyskaniu połączenia” (kolejka), „Zakończ i zapisz”, „Zakończ ostatnią serię i zapisz”, „Cardio nie zostało zapisane” (błąd cardio, bez wartości), „Nie zaliczono żadnej serii. Trening zapisze się bez tonażu.”, „Trening zostanie zapisany, a potem zobaczysz podsumowanie.”. Brak „Zamknij (nie zapisuje)” w UI. Test `finish-flow-copy.test.ts` pilnuje tej frazy.
- Niezgodne: B-1, B-2, B-3 (sekcja 2).
- Menu sesji i pasek globalny: przycisk „Zakończ” / „Zakończ trening” nie zapisuje od razu. Przez `requestFinishFromSecondaryEntry` bez pominiętych serii otwiera dialog z „Zakończ i zapisz”. To spełnia LR-2 pkt 1.
- Ekran zapisu w stanie błędu nie pokazuje wartości treningu (LR-2 pkt 4).

## 5. Ustalenia z kodu, które potwierdzają LR-1..LR-8

| LR | Stan | Dowód |
|---|---|---|
| LR-1 (brak nowych pól) | SPEŁNIONE | `operationId` jest pochodną `workoutPlanId` i `startedAt` (UUID v5, `lib/workout-operation-id.ts`), nie daną osobową. PATCH przyjmuje tylko pola cardio (`cardio/route.ts`, `cardioPatchSchema`). |
| LR-2 (teksty o zapisie) | CZĘŚCIOWO | Poprawne poza B-1..B-3 (sekcja 4.5). |
| LR-3 (idempotencja, brak duplikatów) | SPEŁNIONE co do duplikatu; OTWARTE co do treści (3.2) | `operationId` deterministyczny; unikalny indeks `(userId, operationId)`; `finishPending` blokuje podwójne tapnięcie; kolejka offline używa tego samego klucza. Dedup zwraca wynik pierwszego zapisu, ale bez porównania treści (N-7h-2). |
| LR-4 (cardio po zapisie) | SPEŁNIONE | Autoryzacja z 404 dla cudzego rekordu (`cardio/route.ts:102`). Wartości absolutne. Jeden `UPDATE` na `cardioMinutes` i `exercises` (`cardio/route.ts:118-121`). 0 min usuwa cały obiekt `cardio` (`patchCardioInCompletedSessionJson`, `lib/workout-plan-compare.ts`). Brak publikacji w feedzie. Brak logowania payloadu. Znany RMW bez CAS (N-7h-3, niskie, backlog, wyłącznie własne dane). |
| LR-5 (Ghost przy zmianie Q1) | SPEŁNIONE po aktualizacji 004 (sekcja 11) i po B-4, B-5 | Decyzja właściciela w karcie (p. 8, Q-P1). Zakres zmieniony, dokumenty uzupełnione. Pozostają warunki z 4.2. |
| LR-6 (logi, Sentry) | SPEŁNIONE dla osiągalnej ścieżki | Sekcja 4.1. Nowe `console.warn` w `use-workout-finish-flow.ts:111` ma stały tekst. |
| LR-7 (grafika PR) | NIE SPEŁNIONE | Sekcja 3.4. |
| LR-8 (retencja, eksport, usuwanie) | CZĘŚCIOWO | Eksport obejmuje pola cardio i `operationId` (`select()`); kaskada po `userId`; kolejka offline usuwana po wysłaniu, limit wieku w backlogu (niski, F-3 z wejścia). Brak testu eksportu po patchu cardio (3.5). Retencja: sekcja 3.3. |

## 6. Ryzyka

| ID | Ryzyko | Prawdopodobieństwo | Skutek | Środek | Status |
|---|---|---|---|---|---|
| R-A | Tekst „zapisane” przy zgubionych seriach (N-7h-2) | niskie | wysoki (dokładność, zaufanie) | 3.2 | Promote |
| R-B | Tętno i kroki w cardio bez zgody art. 9 | pewne (dziś) | wysoki (art. 9) | 3.1 (A lub B) | Promote |
| R-C | Wskrzeszenie zakończonej sesji po purge (N-7h-1) | niskie | średni-wysoki | 3.3 | Promote |
| R-D | Wizerunek lub dane w prompcie/seedzie do Pollinations | niskie-średnie | średni | 3.4 | Promote |
| R-E | Rywale widzą dawne serie na masę ciała bez informacji | średnie | średni | B-4, B-5, 4.2 | TERAZ (tekst) |
| R-F | Przycisk zapisu na przerwie bez słowa „zapisz” | niskie | średni | B-1 | TERAZ |
| R-G | Odebranie tej zmiany jako zamknięcie braku zgód art. 9 (00, Braki 1-2) | średnie | wysoki | opis w changelogu i karcie: zmiana nie zamyka braku zgód | TERAZ (opis) |

## 7. Pytania otwarte dla właściciela i prawnika-człowieka

1. Q-P2: wybór opcji A (zgoda art. 9) albo B (brak zapisu tętna i kroków po treningu) przed Promote.
2. U-1: decyzja o widoczności lidera zespołu bez flagi udostępniania (Ghost).
3. Okres retencji po zmianie: 7 dni na treść, tombstone do usunięcia konta (3.3) - zatwierdzenie zmiany w `01`.
4. Czy po poprawce B-1 zostaje wariant zapisu bez dialogu na ekranie przerwy, czy przerwa po ostatniej serii nie ma już żadnego CTA zapisu?
5. Weryfikacja przepisów (art. 4 pkt 15, art. 9, art. 5, art. 17 RODO) w ISAP, EUR-Lex, UODO i EROD z datą. Nie wykonano w tym etapie.

## 8. Co wymaga zatwierdzenia przez prawnika-człowieka

- Klasyfikacja tętna i pozostałych pól cardio (3.1) i zmiany w `00` (kat. 9) oraz `01` (wiersz 9, PO-7).
- Tekst changelogu (B-4) i mikrokopia zapisu (B-1, B-2, B-3).
- Zmiana okresu i zakresu retencji aktywnej sesji (3.3).
- Zgodność polityki prywatności (`/polityka-prywatnosci`) z tętnem i krokami w cardio. Jeśli polityka mówi tylko o „minutach”, trzeba ją uzupełnić przed Promote.
- Prompt i seed grafiki PR (3.4).
- Zmiana w 004 (sekcja 11), którą wprowadziłem w tym etapie. Projekt, wymaga przeglądu człowieka.

## 9. Zmiany wykonane w tym etapie

- `docs/prawo/004-ekran-aktywnego-treningu-wyjscie.md`: dopisana sekcja 11 (aktualizacja LR-8 d po zadaniu 005). Dotyczy zakresu osi czasu Ghost. Nie zmienia werdyktu 004.
- `docs/prawo/005-koniec-treningu-przeplyw-wyjscie.md`: ten raport.
- `docs/zadania/005-koniec-treningu-przeplyw.md`: wiersz 10 bramki (aktualizacja w tym etapie).
- Kodu nie zmieniałem.

Zastrzeżenie: projekt roboczy asystenta AI, nie porada prawna. Przed publikacją mikrokopii, changelogu, zmian w dokumentach 00/01, polityki prywatności i zmian promptu grafiki wymagane jest zatwierdzenie przez prawnika-człowieka. Przepisy wymienione w raporcie nie zostały zweryfikowane w oficjalnych źródłach w tym etapie.
