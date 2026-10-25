# 005 - Koniec treningu: bramka wejściowa (prawnik, etap 2)

- **Zadanie**: `docs/zadania/005-koniec-treningu-przeplyw.md` (punkt 7: decyzja właściciela o masie ciała, seria 0 kg z powtórzeniami = zaliczona)
- **Podstawa**: `docs/analiza/005-koniec-treningu-przeplyw.md` (analityk, ZATWIERDZONE Z UWAGAMI), `docs/prawo/00-inwentaryzacja-danych.md`, `docs/prawo/01-podstawy-prawne-i-retencja.md`, bramka 004 (`docs/prawo/004-ekran-aktywnego-treningu-wyjscie.md`, LR-8 d i LR-10)
- **Data**: 2026-10-25
- **Status**: projekt roboczy asystenta AI. Nie jest poradą prawną. Przed użyciem tekstów dla użytkowników (mikrokopia, changelog, opisy zapisu) i przed zmianą dokumentów 00/01 musi je zatwierdzić prawnik-człowiek.
- **Zakres weryfikacji prawnej**: przepisy (RODO art. 4 pkt 15, art. 5, art. 6, art. 9, art. 17, art. 25, art. 32) przywołane z wiedzy asystenta. **Nie weryfikowano w tym etapie w ISAP, EUR-Lex, UODO ani EROD** (data weryfikacji: brak, do wykonania przed bramką wyjściową). Ocena opiera się na kodzie odczytanym na gałęzi `feat/koniec-treningu-flow`.

## 1. Werdykt

**ZATWIERDZONE Z UWAGAMI.**

Zmiana jest przebudową UI i momentu zapisu danych, które aplikacja już dziś zapisuje tym samym endpointem. Nie dodaje nowej kategorii danych, celu, odbiorcy ani zgody. Podstawa prawna, retencja i zakres eksportu/usuwania się nie zmieniają.

Warunki, bez których nie można wdrożyć (LR-1..LR-8, sekcja 4):
1. Idempotencja zapisu i brak duplikatów (LR-3) - wymagane przed merge, bo nowy przycisk „Spróbuj ponownie” i kolejka offline zwiększają ryzyko podwójnego wpisu, który trafia też do feedu zespołu.
2. Cardio po zapisie jako aktualizacja wartości absolutnych, z usunięciem danych tętna i kroków przy 0 minut (LR-4) - wymagane przed merge P6.
3. Decyzja Q1 nie może po cichu rozszerzyć widoczności serii dla rywali Ghost (LR-5) - wymagane przed merge reguły 0 kg.
4. Teksty przycisków i ekranów muszą być prawdziwe co do momentu zapisu (LR-2) - wymagane przed merge (mikrokopia do zatwierdzenia przez człowieka).
5. Klasyfikacja danych cardio o tętnie, kaloriach i krokach w dokumentach 00 i 01 (LR-6) - aktualizacja dokumentów przed Promote.

## 2. Odpowiedzi na pytania właściciela

### 2.1 Przeniesienie zapisu (`submitCompletedWorkout`) na moment potwierdzenia

**Wpływ prawny: brak zmiany podstawy, celu, retencji i zgód.** Ta sama operacja, ten sam endpoint (`POST /api/workouts/complete`, `app/api/workouts/complete/route.ts`), ten sam rekord w tabeli `workouts` (kolumny `cardioMinutes`, `exercises`), te same dane. Zmienia się tylko moment w tej samej sesji.

Trzy punkty wymagają uwagi:
- **Oczekiwanie użytkownika.** Dziś zapis dzieje się pod „Gotowe”, a ekran „Trening zrobiony” pokazuje się przed zapisem. Po zmianie zapis następuje przed podsumowaniem. Przycisk „Zamknij” na ekranie końcowym nie zapisuje już nic, bo zapis był wcześniej. Opis „Zamknij (nie zapisuje)” z karty zadania nie może trafić do UI, bo może wprowadzić w błąd, że trening trzeba zapisać osobno, albo odwrotnie (LR-2).
- **Ścieżka bez dialogu.** Gdy nie ma pominiętych ani niewykonanych serii (BR-7), przycisk „Zakończ trening” zapisuje od razu. Taki przycisk musi mówić, że zapisuje (np. „Zakończ i zapisz”), a nie tylko „Zakończ”.
- **Ścieżka 2 i 3 z analizy F-2.** Pasek globalny i dolne menu zapisują dziś innym kodem. Każda ścieżka, która zapisuje, musi stosować te same reguły tekstów i błędów (LR-2, LR-3).

### 2.2 Scalenie `WorkoutFinishedScreen` i `WorkoutCompletePopup`

**Wpływ prawny: brak zmiany zakresu danych pokazywanych użytkownikowi, z dwoma wyjątkami do odnotowania.**

Dziś użytkownik widzi tonaż, czas, porównanie z poprzednim planem, rekordy (popup) i listę ćwiczeń. Nowy ekran pokazuje to samo w jednym miejscu, plus:
- **Pełna lista serii** (druga linia pod każdym ćwiczeniem, AC-4.6). To dane z własnego rekordu użytkownika, już zapisane w `workouts.exercises` i już pokazywane w historii treningu. Nie ma tu nowego przetwarzania. Wyświetlenie na ekranie nie wysyła nic dalej.
- **Grafika „Nowe rekordy”** (AC-4.7). Ta sama grafika co dziś w popupie, generowana przez `lib/pr-achievement-image.ts`, czyli przez proxy do Pollinations. Patrz LR-7 i ryzyko R-6.

Żadna z tych zmian nie pokazuje danych innym osobom. Ekran końcowy nie dodaje udostępniania do feedu ani do Ghost.

### 2.3 Lekki zapis cardio po głównym zapisie

**Wymaga dodatkowych warunków (LR-3, LR-4).** Obecny kod ma trzy istotne fakty, które ograniczają projekt:

1. **Odpowiedź zapisu nie zwraca identyfikatora treningu.** `route.ts` generuje `workoutId = crypto.randomUUID()` i zwraca tylko `{ ok, strengthDeltaPercent, planCompare }`. Patch cardio nie może trafić do właściwego rekordu bez identyfikatora (bez identyfikatora nie ma też bezpiecznego ponowienia).
2. **Brak idempotencji.** Każde udane żądanie `POST` tworzy nowy rekord. Dwa mechanizmy powodują ponowne wysłanie tego samego treningu:
   - `lib/workout-complete-submit.ts` (linia 71): przy błędzie sieciowym, który może nastąpić już po zapisie na serwerze (odpowiedź zgubiona), trening trafia do kolejki `outboxEnqueue` i jest wysyłany ponownie po odzyskaniu łączności. Serwer nie rozpoznaje duplikatu.
   - Nowy przycisk „Spróbuj ponownie” (AC-3.5) ponawia zapis z tymi samymi danymi. Bez klucza operacji to samo ryzyko.
   Skutki duplikatu: podwójny wpis w historii, podwójny tonaż i liczba serii w osi czasu Ghost, a także **podwójny wpis w automatycznym feedzie zespołu** (`publishTeamFeedAfterWorkout` jest wywoływany przy każdym udanym `POST`). Ostatni skutek dotyczy innych członków zespołu, więc to nie jest tylko błąd danych.
3. **Dane cardio są zapisane w dwóch miejscach.** Kolumna `cardioMinutes` oraz obiekt `cardio` wewnątrz JSON `exercises` (`lib/workout-plan-compare.ts`, funkcja `completedSessionJsonForCompare`). Obiekt zawiera: dystans, tętno średnie i maksymalne, kalorie, kroki, tempo, typ cardio, wysiłek i strefę tętna. Patch musi zaktualizować oba miejsca razem.

Przy spełnieniu LR-3 i LR-4 patch cardio **nie zwiększa** zakresu danych ponad to, co zapisuje dziś pełny formularz cardio. Jest to ta sama kategoria danych (patrz 00, kat. 9). Różnica polega na tym, że tętno i kroki można dopisać po zapisie treningu.

### 2.4 Dokumenty 00 i 01 - kategoria trening i cardio

**Ustalenie: kategoria jest ujęta, ale klasyfikacja danych zdrowotnych w cardio jest niedokładna. To luka do poprawy przed Promote, nie nowe ryzyko tej zmiany.**

- `docs/prawo/00-inwentaryzacja-danych.md`, kategoria 9 („Treningi i cardio”): oznaczenie Z9 = „pośrednio (kondycja, tętno, kontuzje w planach)”. Pola tętna, kalorii i kroków nie są wprost oznaczone jako dane o zdrowiu.
- `docs/prawo/01-podstawy-prawne-i-retencja.md`, wiersz 9: Z9-A tylko dla pól o kontuzjach/ograniczeniach (`injuriesOrLimitations`) i zdjęć urządzeń. Tętno (`avgHr`, `maxHr`, `heartRateZone`), kalorie i kroki nie są wymienione. GPS wskazano jako zgodę A, ale w payloadzie `completedSessionJsonForCompare` nie ma współrzędnych GPS (zweryfikowane: pola dystansu, tętna, kalorii, kroków, tempa, typu, wysiłku i strefy). Pytanie PO-7 w dokumencie 01 można zamknąć dla tego zapisu, ale nie dla przyszłych zmian.
- Ostrożnościowo: dane o tętnie i innych parametrach fizjologicznych uzyskane z cardio (w tym z urządzenia) traktujemy jako dane dotyczące zdrowia w rozumieniu art. 4 pkt 15 RODO, czyli jako szczególną kategorię z art. 9. Ostateczną klasyfikację podejmuje prawnik-człowiek.
- Brak rejestru zgód po stronie serwera (00, Braki 1-2; 01, R2) pozostaje otwarty. Ta zmiana go nie zamyka i nie może być opisana jako jego spełnienie.

Obecny zakres retencji i eksportu jest zgodny z 01 dla tej kategorii: `workouts` nie jest czyszczone przez `lib/db-retention.ts` (zamierzone), a `lib/user-data-export.ts` eksportuje tabelę `workouts` wraz z JSON `exercises`, więc pola cardio są w eksporcie. Usunięcie konta działa kaskadowo po `userId`.

## 3. Ustalenia z kodu (weryfikacja tej bramki)

| # | Ustalenie | Miejsce | Znaczenie prawne |
|---|---|---|---|
| F-1 | Odpowiedź `POST /api/workouts/complete` nie zawiera identyfikatora treningu; klucz operacji nie istnieje | `app/api/workouts/complete/route.ts` (l. 369, 398) | Brak bezpiecznego ponowienia i patcha; ryzyko duplikatu (LR-3) |
| F-2 | Błąd sieci po stronie klienta trafia do kolejki offline, bez sprawdzenia, czy serwer już zapisał | `lib/workout-complete-submit.ts` (l. 70-79) | Duplikat przy utracie odpowiedzi (LR-3) |
| F-3 | Kolejka offline nie ma limitu wieku ani liczby prób; usuwa wpis dopiero po wysłaniu | `lib/workout-outbox-db.ts` (l. 72) | Dane zdrowotne mogą zostać na urządzeniu długo; ryzyko niskie (backlog) |
| F-4 | Każdy udany zapis publikuje wpis w feedzie zespołu | `route.ts` (l. 379-390) | Duplikat jest widoczny dla innych członków zespołu |
| F-5 | Obiekt `cardio` (tętno, kcal, kroki, dystans, strefa) jest zapisany w JSON `exercises` | `lib/workout-plan-compare.ts` (l. 194-213) | Dane zdrowotne; patch musi zmienić oba miejsca (LR-4) |
| F-6 | `isSkippedWorkoutSet` jest obliczane przy odczycie z `done`, `reps`, `weight`, nie jest zapisywane | `lib/workout-skipped-sets.ts` (l. 23-42) | Zmiana reguły 0 kg zmienia interpretację wszystkich starych danych przy odczycie |
| F-7 | Oś czasu Ghost wybiera serie przez `isCompletedWorkoutSet`, które używa `isSkippedWorkoutSet` | `lib/ghost-training/timeline.ts` (l. 63-72) | Zmiana Q1 bez zmiany filtra rozszerza dane widoczne rywalom Ghost (LR-5) |
| F-8 | Grafika PR: prompt zawiera nazwę ćwiczenia (może być wpisana przez użytkownika); seed zależy od wartości kg i dnia | `lib/pr-achievement-image.ts` (l. 27-68) | Dane osobowe w promptach poza EOG; minimalizacja z 01, pkt 4.3 (LR-7) |
| F-9 | Brak rejestru zgód po stronie serwera | `db/schema.ts` (brak tabeli zgód) | Stan znany z 00/01; poza zakresem tej zmiany |

## 4. Reguły LR dla `architekt` i `ux` (numeracja lokalna zadania 005)

- **LR-1 (podstawa i zakres).** Zmiana nie dodaje pól, celów, odbiorców ani zgód. Żadne nowe pole nie trafia do payloadu zapisu, którego dziś nie ma. Patch cardio przesyła tylko pola cardio (`cardioMinutes` i obiekt `cardio`), bez listy ćwiczeń i serii. Podstawa: art. 6 ust. 1 lit. b (świadczenie dziennika) oraz, ostrożnościowo, art. 9 ust. 2 lit. a dla pól zdrowotnych (wyraźna zgoda) - zgodnie z 01, sekcja 1, pkt 1.

- **LR-2 (prawdziwość tekstów o zapisie).** Każdy tekst o zapisie musi być prawdziwy w chwili wyświetlenia:
  - przycisk kończący trening, który zapisuje bez dialogu, zawiera słowo zapisu (np. „Zakończ i zapisz”);
  - nie używać „Zamknij (nie zapisuje)” ani podobnych zdań w UI; jeśli potrzebna jest informacja, brzmi: „Trening jest zapisany”;
  - stan kolejki offline nie jest opisywany jako „zapisany” bez zastrzeżenia; formułka z AC-3.4 („Zapisany offline — wyślemy po odzyskaniu połączenia”) jest poprawna;
  - komunikat błędu nie zawiera wartości treningu (ciężar, powtórzenia, tętno).

- **LR-3 (idempotencja, brak duplikatów).** Każde zgłoszenie zapisu niesie klucz operacji generowany raz na sesję (przed pierwszym wysłaniem, zapisany w store i w kolejce offline). Serwer: ponowne żądanie z tym samym kluczem zwraca wynik pierwszego zapisu, bez nowego rekordu i bez nowego wpisu w feedzie. Odpowiedź zawiera identyfikator treningu (potrzebny do patcha cardio). Klucz w kolejce offline jest taki sam jak przy pierwszej próbie. Przycisk „Spróbuj ponownie” ponawia z tym samym kluczem. Blokada podwójnego tapnięcia. Dotyczy wszystkich trzech ścieżek zakończenia (F-2 z analizy).

- **LR-4 (cardio po zapisie).**
  - Autoryzacja: tylko właściciel rekordu (`userId`), z weryfikacją przed zapisem.
  - Wartości absolutne, nie przyrosty; powtórne wysłanie daje ten sam stan (idempotencja z natury).
  - Jedna transakcja: `cardioMinutes` i obiekt `cardio` w `exercises` zmieniane razem.
  - 0 minut = usunięcie cardio: usunięty jest też obiekt `cardio` z tętnem, kaloriami, krokami i dystansem (nie tylko minuty). Użytkownik, który usuwa cardio, nie może zostawić danych zdrowotnych w tle.
  - Nie publikować ponownie w feedzie zespołu przy patchu (AC-6.8). Jeśli architekt uzna, że wpis feedu ma aktualizować cardio, wpis nie może pokazać więcej danych niż dziś i wymaga zatwierdzenia prawnika (R-5).
  - Żądanie cardio nie loguje payloadu (LR-6).

- **LR-5 (Ghost i zakres widoczności przy zmianie Q1).** Decyzja „0 kg z powtórzeniami = zaliczona” zmienia `isSkippedWorkoutSet` i przez to `isCompletedWorkoutSet`, a więc także oś czasu Ghost (F-7). Zanim reguła wejdzie:
  - albo filtr Ghost zostaje na dotychczasowej regule (np. osobna funkcja „zaliczona z obciążeniem” użyta tylko w `lib/ghost-training/timeline.ts`),
  - albo właściciel zatwierdza na piśmie, że rywale Ghost (znajomi, lider) mogą widzieć serie z masą ciała, i ocena 004 LR-8 (d) jest aktualizowana.
  Zmiana interpretacji starych danych przy odczycie (F-6) jest dopuszczalna bez migracji, pod warunkiem wpisu w ADR, że historia zostaje bez zmiany danych źródłowych.

- **LR-6 (dane zdrowotne w logach, Sentry, analityce).** Bez zmian względem 01, LR-5. Nowe pliki (patch cardio, klucz operacji, kolejka) nie logują wartości serii, tętna, kalorii, kroków, dystansu ani payloadu. Zalecany test lub reguła lint zakazująca `console.` w `components/active-workout/` i nowym endpoincie (z 004).

- **LR-7 (podsumowanie i grafika PR).** Ekran pokazuje wyłącznie dane zapisane w rekordzie tego samego użytkownika. Prompt grafiki „Nowe rekordy” nie zawiera danych osobowych ani wartości kg; nazwę ćwiczenia z katalogu można zostawić, ale wpis ręczny użytkownika trzeba zminimalizować (zgodnie z 01, 4.3.2). Seed grafiki nie zależy od wartości kg (usunąć `valueKg` z hasha; ostatecznie zalecane do tej zmiany, bo ekran jest przebudowywany). Każda zmiana promptu wymaga przeglądu prawnika (LR-10 z 01).

- **LR-8 (retencja, eksport, usuwanie).** Brak zmian w retencji `workouts` (kasowanie wyłącznie przez konto/kaskadę). Eksport (`lib/user-data-export.ts`) musi nadal obejmować pola cardio wewnątrz `exercises`; test eksportu po patchu cardio. Dane z kolejki offline (`lib/workout-outbox-db.ts`) są usuwane po wysłaniu; dodanie limitu wieku wpisu w kolejce to pozycja backlogu (niski).

## 5. Dokumenty, zgody i teksty wymagające przeglądu

| Element | Decyzja | Wymóg przed Promote |
|---|---|---|
| Nowa zgoda | Brak. Zmiana nie wprowadza nowej zgody ani nowej podstawy. | Brak |
| Dokumenty 00 i 01 (wiersz 9 / kategoria 9) | Dopisać jawnie, że tętno, kalorie, kroki, dystans i strefy tętna z cardio to dane zdrowotne (ostrożnościowo Z9-A). | Zmiana po zatwierdzeniu przez prawnika-człowieka; wersja i data w nagłówku dokumentu |
| Polityka prywatności (`/polityka-prywatnosci`) | Bez zmiany celu. Jeśli polityka opisuje cardio tylko jako „minuty”, trzeba uzupełnić o tętno i kroki. | Przegląd przed Promote |
| Changelog (wpis z `planned: true`) | Opis zmiany momentu zapisu i nazwy ekranu musi być prawdziwy (LR-2). Nie wspominać o „wpisie do dziennika po zakończeniu” bez zastrzeżenia. | Zatwierdzenie tekstu przez człowieka przed Promote |
| Mikrokopia ekranu (AC-3.x, AC-4.x, AC-6.x) | Ogólne etykiety zatwierdza `ux` (zgodnie z zasadą z 004 pkt 5.1). Komunikaty dotyczące zapisu i danych zdrowotnych zatwierdza człowiek. | Przegląd przed Promote |
| Grafika PR (`lib/pr-achievement-image.ts`) | Zmiana seeda i prompta zgodnie z LR-7. | Przegląd prawnika po zmianie |

## 6. Ryzyka

| ID | Ryzyko | Prawdopodobieństwo | Skutek | Środek (właściciel) |
|---|---|---|---|---|
| R-1 | Duplikat treningu (retry, kolejka, zgubiona odpowiedź) z podwójnym wpisem w feedzie zespołu | Średnie (nowy przycisk, kolejka) | Wysoki (dane innych osób, dokładność) | LR-3 (architekt, backend) |
| R-2 | Przycisk zapisuje bez dialogu, a tekst nie mówi, że zapisuje | Średnie | Średni (zapis niezamierzony, skarga) | LR-2 (ux, prawnik) |
| R-3 | Zmiana Q1 rozszerza serie z masą ciała w osi czasu Ghost bez decyzji | Wysokie bez decyzji | Średni (widoczność dla rywali) | LR-5 (architekt, właściciel) |
| R-4 | Usunięcie cardio zostawia tętno i kroki w JSON `exercises` | Średnie | Średni (dane zdrowotne po usunięciu) | LR-4 (backend) |
| R-5 | Wpis feedu zespołu nie zgadza się z zapisem po patchu cardio, albo patch go powtarza | Średnie | Niski-średni | LR-4 (architekt) |
| R-6 | Prompt i seed grafiki PR zawierają dane osobowe lub pochodne wartości kg wysyłane do Pollinations | Niskie-średnie | Średni | LR-7 (backend), backlog niski dla reszty |
| R-7 | Klasyfikacja tętna i cardio pozostaje niedookreślona w 00 i 01 | Pewne | Średni (ocena DPIA, zgody) | LR-6 (prawnik) |
| R-8 | Ta zmiana zostanie odebrana jako spełnienie braku zgód art. 9 (00, Braki 1-2) | Średnie | Wysoki | Opis w changelogu i karcie: zmiana nie zamyka braku zgód; zamknięcie pozostaje w backlogu prawnym |

## 7. Pytania otwarte do właściciela produktu

1. **Q-P1 (Ghost, Q1).** Czy rywale Ghost (znajomi, lider) mogą widzieć serie z masą ciała po zmianie reguły 0 kg? Preferowany wariant: filtr Ghost bez zmiany (LR-5, pierwsza opcja).
2. **Q-P2 (cardio jako dane zdrowotne).** Czy właściciel przyjmuje ostrożnościową klasyfikację tętna, kalorii i kroków jako danych zdrowotnych (Z9-A)? Konsekwencją jest zgoda przy wpisywaniu cardio, której dziś nie ma.
3. **Q-P3 (wpis w feedzie po cardio).** Czy wpis zespołu ma pokazywać cardio dopisane po zapisie, czy zostaje wersja z momentu publikacji (R-5)?
4. **Q-P4 (zapis bez dialogu).** Czy zapis po „Zakończ i zapisz” bez dialogu (brak pominiętych serii) jest zamierzony? Prawnie dopuszczalne, pod warunkiem czytelnego CTA (LR-2).

## 8. Co wymaga zatwierdzenia przez prawnika-człowieka

- Klasyfikacja tętna, kalorii, kroków i dystansu z cardio jako danych zdrowotnych (art. 9) i ich podstawa.
- Zmiany w dokumentach 00 i 01 (wiersz 9 i kategoria 9).
- Tekst changelogu i mikrokopia dotycząca zapisu i danych zdrowotnych.
- Zgodność polityki prywatności z momentem zapisu i zakresem cardio.
- Zmiana promptu i seeda grafiki PR (LR-7).
- Weryfikacja przepisów w ISAP, EUR-Lex, UODO i EROD, z datą weryfikacji (nie wykonano w tym etapie).

## 9. Zastrzeżenie

Projekt roboczy asystenta AI. Nie jest poradą prawną i nie zastępuje decyzji prawnika-człowieka ani właściciela produktu. Ocena dotyczy kodu na gałęzi `feat/koniec-treningu-flow` z dnia 2026-10-25.
