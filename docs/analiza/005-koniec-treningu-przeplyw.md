# 005 - Koniec treningu: spójny przepływ zakończenia - wymagania

- **Zadanie**: `docs/zadania/005-koniec-treningu-przeplyw.md`
- **Autor**: analityk (etap 1, powtórka)
- **Data**: 2026-10-25
- **Gałąź**: `feat/koniec-treningu-flow` (zweryfikowana: odczyt `.git/HEAD` → `ref: refs/heads/feat/koniec-treningu-flow`; cała analiza kodu w tym dokumencie wykonana na tej gałęzi)
- **Status dokumentu**: wymagania do decyzji właściciela (patrz sekcja 6) przed etapem 3 (architekt)

---

## 0. Uwaga do pierwszego przebiegu

Pierwszy przebieg tego etapu analizował kod na gałęzi `master`, która ma inną (starszą) wersję `components/active-workout/*` niż ta gałąź. Ten dokument nadpisuje go w całości na podstawie ponownego, samodzielnego odczytu kodu na `feat/koniec-treningu-flow`. Jedna faktyczna korekta względem poprzedniego przebiegu: **`lib/active-workout-copy.ts` i `primarySetActionLabel` istnieją i są używane** w `components/active-workout/guided-session-layout.tsx` (linia 644) — poprzedni przebieg błędnie twierdził, że nie istnieją. Rzeczywista etykieta głównego przycisku to „Zapisz serię N” / „Popraw serię N” (nie „Zalicz serię”, jak błędnie podano wcześniej — patrz sekcja 2.1). Pozostałe fakty o kodzie (martwy dialog pominiętych serii, druga ścieżka zapisu w pasku globalnym, reguła 0 kg, martwy komponent `WorkoutSummary.tsx`) zostały zweryfikowane ponownie, samodzielnie, na tej gałęzi i są potwierdzone — patrz sekcja 2.2.

## 1. Kontekst i cel

Zakończenie treningu dziś składa się z trzech niespójnych ekranów tego samego zdarzenia:

1. Przerwa wymuszona po ostatniej serii z napisem „Koniec treningu” (`components/active-workout/rest-break-screen.tsx`, wywołanie `startRest` w `components/active-workout/active-workout-view.tsx`, gałąź `workoutComplete` w `patchSet`, linie 681–700).
2. Pełny ekran „Trening zrobiony” (`components/active-workout/workout-finished-screen.tsx`). Renderuje się PRZED zapisem; zapis (`submitCompletedWorkout`, `completeWorkout` w `active-workout-view.tsx`, linie 747–859) odpala się dopiero pod przyciskiem „Gotowe” (`onDone`, linia 1051–1053).
3. Modal „Trening zapisany” (`components/reports/workout-complete-popup.tsx`) pokazywany po nawigacji przez round-trip `sessionStorage` i `usePathname` (montowany w `components/layout/app-shell.tsx`).

Celem jest jeden przepływ: potwierdzenie zakończenia → zapis → jeden ekran „Trening zakończony” z możliwością dopisania cardio jako osobnej, lekkiej zmiany po zapisie.

Dokument rozpisuje 10 ustalonych kierunków (P1-P10) na user stories, kryteria akceptacji Given/When/Then oraz przypadki brzegowe. Kierunek produktowy nie jest kwestionowany. Analiza kodu wykazała jednak fakty, które trzeba uwzględnić w wymaganiach (sekcja 2.2).

## 2. Stan obecny - ustalenia z kodu (zweryfikowane na `feat/koniec-treningu-flow`)

### 2.1 Korekty względem karty zadania i poprzedniego przebiegu

| Co karta zadania / poprzedni przebieg zakładał | Stan w kodzie (zweryfikowany teraz) | Konsekwencja |
|---|---|---|
| Etykieta „Zapisz serię N” z `primarySetActionLabel` w `lib/active-workout-copy.ts` nie istnieje (błąd poprzedniego przebiegu) | Plik i symbol **istnieją**: `lib/active-workout-copy.ts` linia 89, `export function primarySetActionLabel(setOrdinal, setCompleted)`. Zwraca `"Popraw serię N"` gdy seria zaliczona, `"Zapisz serię N"` gdy nie. Używane w `components/active-workout/guided-session-layout.tsx` linia 644 jako jedyny tekst głównego przycisku. Pominięcie to **osobny, zawsze widoczny link „Pomiń”** (linie 667–676, `aria-label="Pomiń serię N"`, wyłączony tylko gdy seria już zaliczona) — główny przycisk NIGDY nie pokazuje „Pomiń serię”. | P1 zmienia etykietę głównego przycisku na ostatniej serii z „Zapisz serię N” na „Zakończ ostatnią serię i zapisz”. Wymagania poniżej używają faktycznych etykiet „Zapisz serię N” / „Popraw serię N” / linku „Pomiń”. |
| Przycisk „Gotowe” wykonuje zapis | Zgodne: `onDone` w `active-workout-view.tsx` (linia 1051–1053) wywołuje `completeWorkout()`. | Bez zmian w diagnozie. |
| Czerwony CTA `#FF1A4B` w `components/workout/WorkoutSummary.tsx` | Zgodne z poprzednim przebiegiem: komponent **nie jest importowany** nigdzie w repozytorium (martwy kod, potwierdzone `Grep` po `WorkoutSummary` — tylko dokumenty i plik samego komponentu). Czerwony CTA `#FF1A4B` żyje realnie w `components/active-workout/active-workout-global-bar.tsx` (przycisk linia 204, potwierdzenie w dialogu linia 279). | P9 dotyczy paska globalnego, nie `WorkoutSummary`. `WorkoutSummary.tsx` do usunięcia jako martwy kod (backlog). |
| `docs/zespol/wiedza-o-projekcie.md` nie istnieje (błąd poprzedniego przebiegu) | Plik **istnieje** i zawiera indeks dokumentów dziedzinowych oraz skrót znanych problemów linii bazowej. Przeczytany przy tym przebiegu. | Brak wpływu na wymagania tego zadania; odnotowane dla porządku. |

### 2.2 Ustalenia wymagające uwagi (fakty z kodu, zweryfikowane ponownie)

**F-1. Dialog pominiętych serii nigdy się nie pokazuje.** `WorkoutAllSetsDoneDialog` (`components/active-workout/workout-all-sets-done-dialog.tsx`) renderuje się warunkowo przez `skippedTarget` (linia 948 w `active-workout-view.tsx`), a `skippedTarget = allSetsDoneSkipped.target` (linia 609). Stan jest inicjalizowany jako `{ target: null, count: 0 }`. `Grep` po `setAllSetsDoneOpen` w całym pliku zwraca cztery wystąpienia: `setAllSetsDoneOpen(false)` (linie 450, 485, 695) i `setAllSetsDoneOpen(open)` wewnątrz `onOpenChange` dialogu samego (linia 952, który tylko przekazuje wartość z zamknięcia). **Nie ma w pliku ani jednego wywołania `setAllSetsDoneOpen(true)`.** Potwierdzone: dialog jest w obecnym kodzie martwy/nieosiągalny — użytkownik nigdy nie dostaje ostrzeżenia o pominiętych seriach przed zapisem. Dodatkowo treść dialogu jest sprzeczna sama w sobie: tytuł „Wszystkie serie wykonane” (linia 50 w `workout-all-sets-done-dialog.tsx`) z opisem „część serii została pominięta” (linia 53) — nawet gdyby dialog się pokazywał, tytuł przeczyłby treści. Dialog dziś obsługuje WYŁĄCZNIE pominięte serie (`skippedCount`/`findFirstSkippedWorkoutTarget` najpierw szuka pominiętych, potem niewykonanych) — nie rozróżnia „pominięte” od „niewykonane” w żadnym komunikacie. P2 to więc **podłączenie** dialogu (wywołanie `setAllSetsDoneOpen(true)` / `setAllSetsDoneSkipped(...)` z faktycznym celem), poprawa tytułu i rozdzielenie liczników — nie tylko zmiana tytułu. Podłączenie uruchomi dialog przy każdym treningu z pominięciem, co trzeba zakomunikować w changelogu.

**F-2. Trzy ścieżki, którymi dziś można zapisać/zakończyć trening, nie jedna.**
1. `completeWorkout()` w `active-workout-view.tsx` (wołany z `onDone` przycisku „Gotowe” na `WorkoutFinishedScreen`, linia 1051) — zapisuje przez `submitCompletedWorkout`, zapisuje `sessionStorage` (`workout:completedSummary`, `gymbrat:newMaxToast`, `gymbrat:workoutQueued`) i przekierowuje na `/workout-plan` albo (przy NOWY MAX) `/progress/exercises/...`.
2. `completeWorkoutFromBar()` w `components/active-workout/active-workout-global-bar.tsx` (linie 103–153), wołany z przycisku „Zakończ trening” paska globalnego po potwierdzeniu w `AlertDialog` własnym (linie 256–297, tekst „Zakończ i zapisz”). Zapisuje przez ten sam `submitCompletedWorkout`, ustawia te same klucze `sessionStorage`, ale NIE pokazuje żadnego ekranu podsumowania — przenosi wprost do `/reports` lub `/reports?queued=1`. Błąd zapisu obsłużony przez `window.alert` (linia 149), nie przez komunikat w UI.
3. Dolny przycisk „Zakończ” w menu sesji (`SessionMenuSheet`, wołany z `guided-session-layout.tsx` linie 723–733 `onFinish`) wywołuje `onFinishSession` → w `active-workout-view.tsx` (linie 881–883) to od razu `setFinishOpen(true)` — pokazuje `WorkoutFinishedScreen` („Trening zrobiony”) z niewykonanymi seriami (np. 3/8), **bez żadnego ostrzeżenia i bez przechodzenia przez dialog pominiętych** (zgodnie z F-1, ten dialog i tak nigdzie się nie wywołuje).

Te trzy ścieżki mają różne nazwy przycisków („Gotowe” / „Zakończ i zapisz” w pasku / „Zakończ”), różne miejsca lądowania (`/workout-plan` vs `/progress/...` vs `/reports`) i różną obsługę błędu (ekran vs `window.alert`). P5 i P7 muszą objąć wszystkie trzy.

**F-3. Seria bez ciężaru (masa ciała) jest dziś zawsze traktowana jako pominięta, niezależnie od powtórzeń.** `isSkippedWorkoutSet` (`lib/workout-skipped-sets.ts` linie 23–32) uznaje serię z `done=true` za pominiętą, gdy `skipped=true` ALBO brak powtórzeń (`!hasPerformedReps`) ALBO `weight<=0` (`!hasExternalWeight`). Komentarz w kodzie (linia 21) mówi wprost: „Przy pustym / zerowym ciężarze w sesji jest „Pomiń serię”, nie zielone zaliczenie.” `canCompleteWorkoutSet` (linia 64) wymaga `weight > 0` i `reps > 0` — identyczna reguła przez `resolveSetSaveIssue`. Efekt zweryfikowany w `patchSet` (`active-workout-view.tsx` linie 654–665, 677–679): seria 0 kg z powtórzeniami dostaje `skipped: true` automatycznie. Jednocześnie w kodzie istnieje osobna, równoległa obsługa bodyweight do innych celów: `kind: "bodyweight"` w `lib/workout-session-calculations.ts` (linie 109–163, test w `workout-session-calculations.best-sets.test.ts`) i w `lib/progress-hub.ts` (linie 86, 918–931) — tam seria 0 kg z powtórzeniami liczy się jako osiągnięcie (maks. powtórzeń), nie jako coś pominiętego. Te dwie reguły są w kodzie dziś sprzeczne: to samo zdarzenie (0 kg + powtórzenia) jest jednocześnie „pominięte” dla zapisu/dialogu i „zaliczone osiągnięcie” dla rankingu bodyweight. Po podłączeniu dialogu (P2, F-1) ta sprzeczność staje się widoczna użytkownikowi: trening złożony wyłącznie z ćwiczeń bodyweight pokazywałby dialog ostrzegawczy o pominięciach przy każdej sesji. Patrz pytanie Q1 i ryzyko R-1.

Dodatkowo: `workoutComplete` w `patchSet` (linia 685: `const workoutComplete = total > 0 && done >= total;`) liczy `done >= total`, czyli pominięte serie też domykają trening i uruchamiają przerwę „Koniec treningu” (komentarz w kodzie, linia 688: „Zawsze pauza z „Koniec treningu” (także przy pominięciach / masie ciała)”). Ostatnia seria pominięta (np. brak ciężaru) uruchamia dziś to samo przejście co zaliczona.

### 2.3 Aktualny przepływ (dla odniesienia, ścieżka główna — ścieżka 1 z F-2)

1. Zaliczenie ostatniej serii → `startRest` → `RestBreakScreen` z „Koniec treningu” (wymuszona przerwa), niezależnie od tego, czy ostatnia seria była zaliczona czy pominięta (F-3).
2. „Dalej” (lub koniec odliczania) → `shouldOpenFinishAfterRest` → `WorkoutFinishedScreen` („Trening zrobiony”). Dialog pominiętych serii nie pojawia się nigdy (F-1).
3. Cardio (opcjonalnie) → „Gotowe” → `completeWorkout` → zapis → `sessionStorage` (`workout:completedSummary`, `gymbrat:newMaxToast`) → `router.push("/workout-plan")` albo, gdy wykryto NOWY MAX, `router.push("/progress/exercises/...")`.
4. Po nawigacji `WorkoutCompletePopup` odczytuje `sessionStorage` i pokazuje „Trening zapisany” z tonażem, czasem, porównaniem „vs poprzedni plan”, „Zobacz postęp” (`PlanCompareDialog`).

Ścieżki 2 i 3 z F-2 (pasek globalny, dolne „Zakończ”) omijają część tego przepływu — patrz F-2.

## 3. Interesariusze i ich cele

| Interesariusz | Cel w tym przepływie |
|---|---|
| Osoba ćwicząca (początkująca) | Jasno wiedzieć, że trening jest zapisany, i co z nim zrobić dalej. Nie zgadywać, czy seria zapisała się czy nie. |
| Osoba ćwicząca (zaawansowana) | Szybko zamknąć ostatnią serię jednym tapnięciem; zobaczyć rekordy i porównanie z ostatnią sesją; nie tracić danych. |
| Osoba ćwicząca ćwiczeniami z masą ciała | Nie dostawać fałszywego ostrzeżenia o „pominięciu” za serię bez obciążenia zewnętrznego, którą wykonała z powtórzeniami. |
| Osoba w trakcie treningu na telefonie (słaby zasięg na siłowni) | Wiedzieć, czy zapis przeszedł, albo że trafił do kolejki; móc ponowić zapis bez utraty serii. |
| Osoba prowadząca dietę/cele | Pominięcie cardio po treningu nie może blokować zapisu siłowego. |
| Administrator / właściciel produktu | Spójna nazwa zdarzenia i CTA, jedna ścieżka zapisu; brak rozjazdu z changelogiem i dokumentacją. |
| Zespół (frontend, backend, architekt) | Jeden punkt zapisu, idempotentny; brak `sessionStorage` round-trip; kontrakt `/api/workouts/complete` kontrolowany. |
| Użytkownik społeczności | Automatyczne wpisy w feedzie zespołu nie mogą się dublować ani rozjeżdżać z historią po dopisaniu cardio (patrz R-5). |

## 4. Założenia

- **A-1.** „Trening zakończony” jest jednym pełnoekranowym widokiem (overlay jak dziś `WorkoutFinishedScreen`), a nie nową trasą Next.js.
- **A-2.** Po „Zamknij” użytkownik trafia na `/workout-plan` (jak dziś po „Gotowe” w ścieżce 1 z F-2), chyba że Q4 zmieni zachowanie przy NOWY MAX.
- **A-3.** Ekran „Zapisuję trening…” to pełnoekranowy stan z loaderem, bez przycisków wyjścia (poza przerwaniem przez przeglądarkę).
- **A-4.** Próg „wolne połączenie” dla komunikatu w trakcie zapisu: 10 s (do potwierdzenia przez architekta i testera-wydajnosci).
- **A-5.** Delta tonażu w „vs ostatnio” pokazywana w jednostce zgodnej z ustawieniem `progressDeltaUnit` (procent lub kg), jak w `workout-complete-popup.tsx` dziś.
- **A-6.** Zmiany etykiet dotyczą wyłącznie UI. Klucze JSON kontraktu (`planCompare`, `status: "skipped"` w `lib/workout-plan-compare.ts`) bez zmian; architekt potwierdza, czy Android/Java używa tych kluczy.
- **A-7.** Złoty CTA to jeden token motywu (`--gym-gold`). Dziś w kodzie występują różne odcienie złota (m.in. `var(--gym-gold)` w dialogu pominiętych, `#FF1A4B` czerwień w pasku globalnym — patrz F-2, A-9 niżej); ujednolicenie do tokenu ustala `ux`.
- **A-8.** Cardio dopisane po zapisie nie zmienia tonażu, rekordów ani porównania „vs ostatnio” (porównanie jest oparte na tonażu serii siłowych).
- **A-9.** „Popraw serię N” na już zaliczonej serii nie uruchamia potwierdzenia ani zapisu. Zapis następuje raz na sesję.
- **A-10.** Zakończenie przez pasek globalny (ścieżka 2 z F-2, Q3) i przez dolne „Zakończ” (ścieżka 3 z F-2) używają tego samego ekranu „Trening zakończony” i tego samego dialogu pominiętych/niewykonanych, jeśli właściciel tak zdecyduje; do tego czasu opis obejmuje wszystkie trzy wejścia.

## 5. Terminologia (słownik zdarzeń i etykiet)

| Pojęcie | Dzisiejsza etykieta w kodzie | Nowa, używana nazwa | Zakazane / usuwane |
|---|---|---|---|
| Zdarzenie i ekran końcowy | „Trening zrobiony” / „Trening zapisany” / „Koniec treningu” (stan przerwy) | **Trening zakończony** | wszystkie trzy powyższe |
| Główny przycisk na serii (nie ostatniej) | „Zapisz serię N” / „Popraw serię N” (`primarySetActionLabel`) | bez zmian | - |
| Główny przycisk na ostatniej otwartej serii | „Zapisz serię N” | **Zakończ ostatnią serię i zapisz** | - |
| Link pominięcia serii | „Pomiń” (zawsze widoczny, wyłączony po zaliczeniu) | bez zmian | „Pomiń serię” jako tekst głównego przycisku (nigdy nie istniał, ale zapisujemy zakaz na przyszłość) |
| Akcja w pasku aktywnego treningu / pasku globalnym | „Zakończ trening” | bez zmian | - |
| CTA w dialogu potwierdzenia paska globalnego | „Zakończ i zapisz” | bez zmian (rozszerzyć na inne wejścia) | „Zakończ trening” jako tekst przycisku w dialogu (zarezerwowane dla paska) |
| Dolne „Zakończ” w menu sesji | „Zakończ” | **Zakończ trening** (ujednolicenie z paskiem) | - |
| Zamknięcie ekranu końcowego | „Gotowe” (ścieżka 1), brak ekranu (ścieżki 2 i 3) | **Zamknij** (nie zapisuje) | „Gotowe”, „OK” |
| Stan zapisu | brak dedykowanego ekranu (zapis dzieje się po ekranie podsumowania w ścieżce 1) | **Zapisuję trening…** | - |
| Seria z pominięciem (definicja z `isSkippedWorkoutSet`) | „pominięta” (tylko w dialogu, dziś martwym) | **pominięta seria** / **pominięte serie** | - |
| Seria nieukończona w sesji (`done=false`) | nierozróżniona od pominiętej w dialogu (F-1) | **niewykonana seria** | używanie „pominięta” dla niewykonanych |
| Ćwiczenie bez porównania (`compare` status `skipped`) | „pominięte” (`PlanCompareDialog`, `workout-complete-popup.tsx`) | **bez porównania** | „pominięte” (jako etykieta ćwiczenia) |
| Delta względem poprzedniej sesji tego samego planu | „vs poprzedni plan” | **vs ostatnio** | „vs poprzedni plan” |

Zasada: „pominięte” dotyczy wyłącznie serii; „bez porównania” dotyczy wyłącznie ćwiczeń w porównaniu.

## 6. Pytania otwarte do właściciela produktu (maks. 5)

- **Q1. Masa ciała (0 kg z powtórzeniami): zaliczona czy pominięta?** Obecny kod (F-3) traktuje ją jako pominiętą dla zapisu i dialogu, ale jako osiągnięcie dla rankingu bodyweight (`lib/progress-hub.ts`) — dwie sprzeczne reguły w kodzie dziś. Przy treningu samymi ćwiczeniami z masą ciała, po podłączeniu dialogu (P2), dialog pojawiałby się po każdym takim treningu, a tonaż byłby zerowy. Rekomendacja analityka: seria z powtórzeniami i bez obciążenia zewnętrznego jest zaliczona (`kind: "bodyweight"`), pominięta tylko przy braku powtórzeń lub fladze `skipped`. Zmiana dotyka `isSkippedWorkoutSet`/`canCompleteWorkoutSet`, więc wymaga decyzji przed etapem 3. **Blokuje P2 i P4.**
- **Q2. Dolny przycisk „Zakończ” przy niewykonanych seriach (np. 3/8), ścieżka 3 z F-2.** Założenie analityka: pokazać ten sam dialog potwierdzenia z liczbami osobno dla „pominiętych” i „niewykonanych”, zanim nastąpi zapis. Alternatywa: zapis wprost (ryzyko przypadkowego zapisu niepełnego treningu).
- **Q3. Pasek globalny „Zakończ trening” (ścieżka 2 z F-2).** Czy również przechodzi przez ekran „Trening zakończony” (założenie: tak, jako overlay, zamiast przekierowania do `/reports` i `window.alert` na błąd), czy zostaje z dzisiejszym zachowaniem?
- **Q4. NOWY MAX.** Dziś po zapisie z rekordem aplikacja przekierowuje do `/progress/exercises/...` (tylko w ścieżce 1 z F-2; ścieżka 2 nie ma tej logiki wcale), a informacja o rekordzie pojawia się dopiero w modalu. Założenie analityka: wyróżnienie rekordu (grafika PR i sekcja „Nowe rekordy”) jest na ekranie „Trening zakończony”, a przekierowanie znika. Potwierdzić.
- **Q5. Zapis treningu bez żadnej zaliczonej serii** (wszystkie pominięte lub niewykonane). Założenie: zapis dozwolony po potwierdzeniu w dialogu z komunikatem „Nie zaliczono żadnej serii”; alternatywa: blokada zapisu z opcją „Odrzuć trening”.

## 7. User stories i kryteria akceptacji

Numeracja P1-P10 odpowiada ustalonym kierunkom. Każde kryterium jest testowalne (zapytanie UI, liczba żądań sieciowych, zawartość komunikatu).

### P1. Ostatnia seria: „Zakończ ostatnią serię i zapisz” bez wymuszonej przerwy

**US-1.** Jako osoba ćwicząca chcę zakończyć trening jednym tapnięciem na ostatniej serii, aby nie czekać na wymuszony licznik przerwy, którego nie potrzebuję.

- **AC-1.1 (etykieta).** Given otwarta jest dokładnie jedna ostatnia niezaliczona seria w całej sesji, a jej zaliczenie jest możliwe (ciężar > 0 i powtórzenia > 0 — reguła `canCompleteWorkoutSet`), When ekran serii jest wyświetlony, Then główny przycisk ma tekst „Zakończ ostatnią serię i zapisz” (zamiast dzisiejszego „Zapisz serię N” z `primarySetActionLabel`).
- **AC-1.2 (brak przerwy).** Given jak w AC-1.1, When użytkownik tapnie przycisk, Then seria zostaje oznaczona jako wykonana, `startRest` nie jest wywołany, na ekranie nie pojawia się `RestBreakScreen` ani napis „Koniec treningu”, a aplikacja przechodzi wprost do P2 (gdy są pominięte lub niewykonane serie) albo do P3 (gdy nie ma).
- **AC-1.3 (kolejna seria bez zmian).** Given na sesji są jeszcze inne niezaliczone serie, When użytkownik zalicza serię, Then etykieta to „Zapisz serię N” (lub „Popraw serię N” dla już zaliczonej), a przerwa uruchamia się wg dotychczasowych ustawień (`autoStart`, `defaultSeconds`).
- **AC-1.4 (ostatnia seria pominięta przez link „Pomiń”).** Given ostatnia otwarta seria jest pominięta przez link „Pomiń” (nie spełnia warunków zaliczenia: brak ciężaru lub powtórzeń), When pominięcie następuje, Then nie uruchamia się przerwa (zgodnie z F-3/BR-4 — nadal `done=true, skipped=true` domyka trening), a przejście do P2 lub P3 następuje jak w AC-1.2. Etykieta linku „Pomiń” nie zmienia się na ostatniej serii (do potwierdzenia przez `ux`, czy potrzebny jest dodatkowy komunikat).
- **AC-1.5 (poprawa po zaliczeniu).** Given wszystkie serie są już zaliczone, When użytkownik edytuje którąś serię przez przycisk „Popraw serię N”, Then nie pojawia się ponownie potwierdzenie ani zapis (A-9).
- **AC-1.6 (brak regresji przerwy).** Given sesja nie jest zakończona, When użytkownik zalicza dowolną serię inną niż ostatnia, Then zachowanie przerwy i `persistRestSecondsFromTimer` pozostaje bez zmian (test regresji).

### P2. Dialog pominiętych serii: podłączenie, poprawny tytuł i rozdzielenie liczników

**US-2.** Jako osoba ćwicząca chcę dostać ostrzeżenie o niewykonanych lub pominiętych seriach przed zapisem, aby wiedzieć, co zostanie zapisane, a tytuł nie przeczył treści.

- **AC-2.1 (wyzwolenie — wymaga podłączenia, F-1).** Given zakończenie (P1 lub dowolna z trzech ścieżek z F-2) i co najmniej jedna seria pominięta lub niewykonana, When trening ma być zapisany, Then najpierw pokazuje się dialog `WorkoutAllSetsDoneDialog` (wymaga wywołania `setAllSetsDoneOpen(true)` wraz z faktycznym celem w `setAllSetsDoneSkipped(...)` — dziś to wywołanie nie istnieje w kodzie, patrz F-1), a zapis nie jest jeszcze wywołany. Test musi wykryć regresję do stanu martwego (dialog się nie pojawia).
- **AC-2.2 (zero wyjątków).** Given żadna seria nie jest pominięta ani niewykonana, When trening ma być zapisany, Then dialog się nie pokazuje, a zapis startuje od razu.
- **AC-2.3 (tytuł zgodny z treścią).** Tytuł zależy od rodzaju brakujących serii:

  | Stan | Tytuł | Opis (mikrokopia do zatwierdzenia przez `ux`) |
  |---|---|---|
  | Są pominięte serie | „Zostały pominięte serie” | „Blok siłowy jest zamknięty. Pominięte serie nie wejdą do tonażu.” |
  | Są tylko niewykonane | „Nie wszystkie serie wykonane” | „Niewykonane serie nie wejdą do tonażu.” |
  | Są obie | „Zostały pominięte serie” | Dwie liczby w osobnych wierszach: pominięte i niewykonane. |

  Tytuł „Wszystkie serie wykonane” (dzisiejszy, sprzeczny z treścią — patrz F-1) nie może pojawić się przy żadnym stanie dialogu.
- **AC-2.4 (liczby, rozdzielone).** Dialog pokazuje liczbę pominiętych I osobno liczbę niewykonanych serii (dziś liczony jest tylko `skippedCount` przez `countSkippedWorkoutSets`; potrzebny analogiczny licznik niewykonanych) oraz pierwszą do uzupełnienia (ćwiczenie + numer serii), jak dziś przez `findFirstSkippedWorkoutTarget`.
- **AC-2.5 (przyciski).** Główne działanie „Wróć do serii” (dziś „Wróć do pominiętej serii”) ustawia fokus na pierwszej pominiętej lub niewykonanej serii, zamyka dialog i NIE zapisuje. Działanie „Zakończ i zapisz” (dziś „Zakończ trening” w tym dialogu) zamyka dialog i uruchamia P3. Oba przyciski mają ten sam kolor CTA (P9).
- **AC-2.6 (zamknięcie bez wyboru).** Given dialog jest otwarty, When użytkownik zamknie go klawiszem Esc, tapnięciem poza nim lub przyciskiem zamknięcia, Then zachowanie jest jak „Wróć do serii” (brak zapisu, sesja trwa).

### P3. Zapis w momencie potwierdzenia, ekran „Zapisuję trening…”

**US-3.** Jako osoba ćwicząca chcę, aby trening był zapisany w chwili potwierdzenia, zanim zobaczę podsumowanie, abym miał pewność, że dane są bezpieczne.

- **AC-3.1 (kolejność).** Given potwierdzenie zakończenia (P2 „Zakończ i zapisz” albo brak dialogu), When startuje zapis, Then najpierw pojawia się ekran „Zapisuję trening…”, a dopiero po wyniku zapisu ekran „Trening zakończony” (P4). Ekran „Trening zakończony” nie jest pokazany ani na chwilę przed zapisem (dziś w ścieżce 1 z F-2 jest odwrotnie: `WorkoutFinishedScreen` renderuje się przed `completeWorkout()`).
- **AC-3.2 (jeden zapis).** Given zapis trwa, When użytkownik tapnie ponownie cokolwiek w przepływie zakończenia, Then nie wysyła się drugie żądanie zapisu (0 dodatkowych wywołań `POST /api/workouts/complete`).
- **AC-3.3 (sukces).** Given serwer zwrócił sukces, When zapis się kończy, Then store sesji jest czyszczony, a wyświetla się P4 ze statusem zapisu „zapisany”.
- **AC-3.4 (kolejka offline).** Given `submitCompletedWorkout` zwraca `queued`, When zapis się kończy, Then wyświetla się P4 z informacją „Zapisany offline — wyślemy po odzyskaniu połączenia”, a banner `/reports?queued=1` nie jest wymagany w tym wejściu.
- **AC-3.5 (błąd).** Given zapis zwrócił `error` (np. 5xx, 4xx lub błąd bez kolejki), When zapis się kończy, Then NIE pokazuje się „Trening zakończony”. Zamiast tego ekran zapisu przechodzi w stan błędu: komunikat „Nie udało się zapisać treningu. Twoje serie są nadal na ekranie.”, przycisk „Spróbuj ponownie” (ponawia zapis z tymi samymi danymi, a `endedAt` pozostaje z pierwszej próby) i przycisk „Wróć do treningu” (zamyka stan błędu, sesja w store nienaruszona, brak resetu).
- **AC-3.6 (błąd bez alertu).** Komunikat błędu jest wyświetlany w ekranie (nie przez `window.alert`, jak dziś w pasku globalnym — ścieżka 2 z F-2, linia 149 w `active-workout-global-bar.tsx`).
- **AC-3.7 (wolne połączenie).** Given zapis trwa dłużej niż próg z A-4, When upłynie czas, Then ekran zapisu pokazuje „Wolne połączenie, nadal zapisujemy…” bez przerywania żądania i bez przycisków.
- **AC-3.8 (dostępność).** Stan „Zapisuję trening…” ma `aria-live="polite"`; stan błędu ma `role="alert"`; przyciski mają wysokość min. 44 px.

### P4. Jeden ekran „Trening zakończony”

**US-4.** Jako osoba ćwicząca chcę zobaczyć jedno, kompletne podsumowanie treningu, w którym widzę tonaż, zmianę względem ostatniej sesji, każde ćwiczenie ze wszystkimi seriami, porównanie i cardio.

- **AC-4.1 (nagłówek).** Given zapis zakończony sukcesem lub kolejką, When wyświetla się ekran, Then tytuł to „Trening zakończony”, a nad nim nazwa planu/treningu i data+godzina zakończenia w strefie lokalnej urządzenia.
- **AC-4.2 (tonaż i delta).** Given istnieje poprzednia zapisana sesja tego samego planu z tonażem > 0, When ekran jest wyświetlony, Then pokazuje tonaż (kg, format pl-PL, tylko serie wykonane) oraz deltę „vs ostatnio” (zgodnie z A-5, kolor: zielony wzrost, czerwony spadek, neutralny 0). Wartość delty pochodzi z `planCompare.volumeDeltaPercent`, bez nowego zapytania.
- **AC-4.3 (brak porównania).** Given nie ma poprzedniej sesji tego planu, lub poprzedni tonaż = 0, When ekran jest wyświetlony, Then delta pokazuje „—”, a pod nią tekst „Pierwsza zapisana sesja tego planu — brak porównania” (lub „Brak zapisanej sesji tego planu” dla treningu bez planu).
- **AC-4.4 (czas, serie, ćwiczenia).** Pokazuje czas trwania (`formatWorkoutDurationPl`), liczbę serii wykonanych / łącznie (łącznie tylko gdy różni się od wykonanych, jak dziś) i liczbę ćwiczeń.
- **AC-4.5 (Najlepsze serie - wiersz główny).** Każde ćwiczenie ma wiersz z nazwą i najlepszą serią (wartość jak dziś: kg × powtórzenia lub powtórzenia dla masy ciała, `bestSetsFromSession`).
- **AC-4.6 (Najlepsze serie - druga linia).** Pod każdym wierszem jest druga, wyciszona linia (mniejsza czcionka, `text-white/45` lub odpowiednik) z WSZYSTKIMI seriami tego ćwiczenia w kolejności, np. „1: 80×8 · 2: 80×7 · 3: pominięta · 4: niewykonana”. Najlepsza seria jest oznaczona (np. pogrubieniem). Serie pominięte mają etykietę „pominięta” (`isSkippedWorkoutSet`), niewykonane „niewykonana” (`done=false`).
- **AC-4.7 (nowe rekordy).** Gdy wykryto rekord ciężaru (`detectSessionNewMaxes`), ekran pokazuje sekcję „Nowe rekordy” i wyróżnienie PR (grafika jak w popupie); logika wykrywania bez zmian (Q4).
- **AC-4.8 (zobacz postęp).** Given `planCompare` istnieje, When użytkownik tapnie „Zobacz postęp”, Then sekcja rozwija się w tym samym ekranie (nie otwiera nowego modala), przycisk ma `aria-expanded`, a zawartość to dawny `PlanCompareDialog`: tonaż vs poprzednia sesja, liczba ćwiczeń w górę / w dół / bez porównania, lista ćwiczeń z deltą. Ponowne tapnięcie zwija sekcję.
- **AC-4.9 (zobacz postęp - brak danych).** Given `planCompare` jest `null` (np. trening bez planu lub kolejka), When ekran jest wyświetlony, Then „Zobacz postęp” jest ukryte.
- **AC-4.10 (cardio).** Pasek cardio pokazuje „Dodaj cardio po treningu”, gdy minut = 0, albo podsumowanie (minuty, km, kcal, kroki), gdy są dane. Szczegóły zapisu w P6.
- **AC-4.11 (Zamknij).** Given ekran „Trening zakończony” jest wyświetlony, When użytkownik tapnie „Zamknij”, Then ekran znika, NIE wykonywane jest żadne żądanie zapisu (0 wywołań `POST`/`PATCH` treningu), a aplikacja przechodzi na `/workout-plan` (A-2). Przycisk „Zamknij” jest jedynym działaniem kończącym ekran (brak „Gotowe”).
- **AC-4.12 (odświeżenie).** Given użytkownik odświeża stronę na ekranie „Trening zakończony”, Then trening pozostaje zapisany, a ekran się nie wznawia (trening nie jest zapisywany drugi raz).

### P5. Trzy ścieżki zapisu → jeden ekran: usunięcie popupu, round-trip `sessionStorage` i rozjazdu pasek globalny/dolne „Zakończ”

**US-5.** Jako osoba ćwicząca chcę widzieć podsumowanie w jednym miejscu, niezależnie od tego, którym przyciskiem skończyłam/em trening, bez drugiego modala po nawigacji, który powtarza te same dane.

- **AC-5.1.** Po zapisie żaden modal „Trening zapisany” nie pojawia się na żadnej trasie (test: po zapisie na `/workout-plan`, `/reports` i `/progress/...` brak elementu z tekstem „Trening zapisany”).
- **AC-5.2.** Klucze `workout:completedSummary` i `gymbrat:newMaxToast` nie są zapisywane ani czytane w `sessionStorage` — ani w `active-workout-view.tsx`, ani w `active-workout-global-bar.tsx` (dziś oba pliki zapisują te klucze niezależnie — F-2, ścieżki 1 i 2).
- **AC-5.3.** `WorkoutCompletePopup` nie jest montowany w `app-shell.tsx`, a plik komponentu jest usunięty (martwy kod).
- **AC-5.4.** Pasek globalny (ścieżka 2 z F-2) i dolne „Zakończ” (ścieżka 3 z F-2) prowadzą do tego samego ekranu „Trening zakończony” co P1 — zgodnie z decyzją Q3, A-10. Baner kolejki (`QueuedWorkoutBanner`, `gymbrat:workoutQueued`) przestaje być potrzebny jako osobna ścieżka komunikacji, bo informacja o kolejce jest na ekranie P4 (AC-3.4); do potwierdzenia przez architekta, czy baner na `/reports` zostaje dla przypadków spoza przepływu zakończenia.

### P6. Cardio po zapisie: osobny, lekki zapis uzupełniający

**US-6.** Jako osoba ćwicząca chcę dopisać cardio po zakończeniu treningu bez ponownego zapisywania serii, aby zmiana była szybka i nie ryzykowała danych siłowych.

- **AC-6.1 (brak ponownego zapisu serii).** Given trening został zapisany (sukces lub kolejka), When użytkownik dodaje lub zmienia cardio na P4 i zapisuje, Then wysyłane jest wyłącznie pole cardio (minuty i opcjonalne dane), bez listy ćwiczeń i serii.
- **AC-6.2 (w tle).** Given zmiana cardio jest zapisywana, When żądanie trwa, Then ekran pokazuje mały wskaźnik przy pasku cardio, a tonaż, serie i porównanie pozostają widoczne i klikalne.
- **AC-6.3 (sukces).** Given zapis cardio się udał, When wynik wraca, Then pasek cardio pokazuje nowe wartości („Cardio: 20 min · 3,2 km · 210 kcal”) i nie zmienia się nic innego na ekranie.
- **AC-6.4 (błąd cardio).** Given zapis cardio nie powiódł się, When wynik wraca, Then pod paskiem cardio pojawia się komunikat „Nie udało się zapisać cardio. Spróbuj ponownie.”, a trening pozostaje zapisany bez zmian (tonaż, serie, czas).
- **AC-6.5 (brak cardio).** Given użytkownik nie dodał cardio (0 min), When tapnie „Zamknij”, Then żądanie cardio nie jest wysyłane.
- **AC-6.6 (zero minut po edycji).** Given cardio było dodane, a użytkownik ustawia 0 minut, Then jest to świadome usunięcie cardio (wymaga decyzji architekta, czy to wysyła `null` czy pomija). Do potwierdzenia.
- **AC-6.7 (kolejka).** Given trening jest w kolejce offline (brak identyfikatora zapisu po stronie serwera — `submitCompletedWorkout` dziś nie zwraca żadnego id, zweryfikowane w `lib/workout-complete-submit.ts`), When użytkownik chce dodać cardio, Then cardio jest dołączane do wpisu kolejki przed wysyłką albo akcja jest niedostępna z komunikatem „Cardio będzie dostępne po wysłaniu treningu” (decyzja architekta, Q-tech-2).
- **AC-6.8 (brak duplikatów w feedzie).** Zmiana cardio po zapisie nie tworzy nowego wpisu w feedzie zespołu (`lib/community/team-feed-auto.ts`) ani nie kopiuje treningu (test regresji, patrz R-5).

### P7. Nazewnictwo: jedna nazwa zdarzenia, niezależnie od ścieżki

**US-7.** Jako osoba ćwicząca chcę, aby cały przepływ nazywał się tak samo niezależnie od tego, którym przyciskiem skończyłam/em trening, abym wiedział, że trening jest zakończony.

- **AC-7.1.** Tekst „Trening zakończony” jest jedynym tytułem ekranu końcowego. Ciągi „Trening zrobiony” i „Trening zapisany” nie występują w `components/` ani `lib/` (wyszukiwanie tekstowe zero wyników poza testami).
- **AC-7.2.** Akcja w pasku aktywnego treningu, w pasku globalnym i w dolnym menu sesji to jednolicie „Zakończ trening” (dziś dolne menu ma „Zakończ”, bez „trening” — do ujednolicenia). Akcja zapisu w dialogu to „Zakończ i zapisz”. Akcja zamknięcia ekranu to „Zamknij”. Przycisk „Gotowe” nie występuje w przepływie.
- **AC-7.3.** Napis „Koniec treningu” nie pojawia się jako stan przerwy (zniknięcie wymuszonej przerwy, P1).
- **AC-7.4.** Nagłówek w `lib/workout-finish-format.ts` (funkcja zwraca dziś tekst „Po „Gotowe” zapiszesz N. trening w tym tygodniu. Ciężary trafią do historii i Postępów.”, linia 24) zostaje zastąpiony treścią zgodną z nowym przepływem (np. „Ciężary trafią do historii i Postępów po zapisie.”) - tekst do zatwierdzenia przez `ux`.

### P8. Terminologia: „pominięte serie” vs „ćwiczenia bez porównania”

**US-8.** Jako osoba ćwicząca chcę rozumieć, co oznacza „pominięte” przy serii, a co przy ćwiczeniu w porównaniu, bo dziś oba słowa oznaczają różne rzeczy.

- **AC-8.1 (serie).** Słowo „pominięte” używane jest wyłącznie przy seriach (definicja z `isSkippedWorkoutSet`). Liczba w podsumowaniu porównania „N pominiętych” zmienia się na „N bez porównania” w UI (`workout-complete-popup.tsx` i `PlanCompareDialog`).
- **AC-8.2 (ćwiczenia).** Badge statusu `skipped` w `PlanCompareDialog` („pominięte”) zmienia etykietę na „bez porównania”. Znaczenie: ćwiczenie bez zaliczonej serii w tej sesji albo obecne w poprzedniej sesji, a nieobecne w tej (`lib/workout-plan-compare.ts`, `exerciseStatus` i `buildExerciseVolumeRows`).
- **AC-8.3 (klucze bez zmian).** Wartość `status: "skipped"` w JSON pozostaje (A-6); zmiana dotyczy tylko warstwy prezentacji.
- **AC-8.4.** Test sprawdza, że przy zerze pominiętych serii w sesji nie ma słowa „pominięte” w żadnym komunikacie tego ekranu.

### P9. Jeden kolor głównego CTA: złoty

**US-9.** Jako osoba ćwicząca chcę, aby wszystkie główne akcje zakończenia miały ten sam, rozpoznawalny kolor, bez mieszania czerwieni i złota.

- **AC-9.1.** Przyciski „Zakończ trening” (pasek globalny `active-workout-global-bar.tsx`, dolne menu sesji), „Zakończ ostatnią serię i zapisz”, „Zakończ i zapisz”, „Zapisz cardio”, „Zamknij” (ekran P4) i „Spróbuj ponownie” (stan błędu) używają tego samego wariantu złotego CTA (`gym-btn-primary` lub token `--gym-gold`).
- **AC-9.2.** W przepływie zakończenia nie występuje kolor `#FF1A4B` (zweryfikowane dziś na dwóch miejscach w `active-workout-global-bar.tsx`: przycisk „Zakończ trening” linia 204 i przycisk potwierdzenia „Zakończ i zapisz” w dialogu linia 279). Test: wyszukiwanie literału `#FF1A4B` w plikach przepływu zwraca zero wyników.
- **AC-9.3.** Czerwień pozostaje tylko w znaczeniu semantycznym (spadek tonażu w delcie, błąd zapisu w komunikacie). Przycisk „Odrzuć” (dziś `variant="destructive"` w `active-workout-global-bar.tsx` linia 321) zostaje w stylu destrukcyjnym (założenie do potwierdzenia przez `ux`).
- **AC-9.4.** Przegląd wizualny (etap 8) potwierdza kontrast złotego CTA na czarnym tle ≥ 4,5:1 dla tekstu przycisku.

### P10. „vs poprzedni plan” → „vs ostatnio”

**US-10.** Jako osoba ćwicząca chcę, aby etykieta porównania była zrozumiała i nie sugerowała porównania z innym planem.

- **AC-10.1 (etykieta).** Tekst „vs poprzedni plan” zostaje zastąpiony przez „vs ostatnio” w każdym miejscu przepływu. Nagłówek sekcji w `PlanCompareDialog` „Postęp vs poprzedni” zmienia się na „Postęp vs ostatnio”.
- **AC-10.2 (znaczenie).** „Ostatnio” oznacza ostatnią zapisaną sesję TEGO SAMEGO planu (`workoutPlanId`). Sesje innych planów nie biorą udziału w deltach. Test: sesja planu B nie zmienia porównania sesji planu A.
- **AC-10.3 (data).** Podpis porównania pokazuje datę poprzedniej sesji (`formatHistoryShortDate`) i „→ dziś” jak dziś, np. „Plan A · 18 paź → dziś”.
- **AC-10.4 (brak poprzedniej sesji).** Zgodnie z AC-4.3.

## 8. Reguły biznesowe

- **BR-1.** Ekran „Trening zakończony” pokazuje się wyłącznie po zapisie zakończonym sukcesem lub kolejką (offline). Nigdy przed zapisem i nigdy po błędzie zapisu.
- **BR-2.** Zapis pełnego treningu jest wykonany dokładnie raz na sesję, niezależnie od tego, którą z trzech ścieżek (F-2) użytkownik wybrał. Ponowienie po błędzie (AC-3.5) używa tego samego identyfikatora operacji, aby serwer nie utworzył duplikatu (wymaganie dla architekta, patrz R-2).
- **BR-3.** Zmiana cardio po zapisie jest osobną operacją; nie zmienia serii, tonażu, czasu ani porównania.
- **BR-4.** Definicje serii (bez zmian w kodzie, o ile Q1 nie zmieni reguły):
  - *zaliczona*: `done=true` i nie spełnia warunków pominięcia;
  - *pominięta*: `done=true` i (`skipped=true` albo brak powtórzeń albo `weight<=0`) - reguła `isSkippedWorkoutSet`;
  - *niewykonana*: `done=false`.
- **BR-5.** Tonaż liczy tylko serie zaliczone (bez zmian w `lib/workout-session-calculations.ts`).
- **BR-6.** Delta „vs ostatnio” = zmiana tonażu względem ostatniej zapisanej sesji tego samego planu; jeśli brak poprzedniej sesji albo tonaż poprzedniej = 0, delta to „—” (istniejące `deltaPercent` zwraca `null` dla `prev === 0`).
- **BR-7.** Dialog potwierdzenia pojawia się, gdy istnieje co najmniej jedna seria pominięta lub niewykonana (AC-2.1), niezależnie od ścieżki zakończenia (P1, pasek globalny, dolne „Zakończ”). Brak takich serii = zapis bez dialogu.
- **BR-8.** Wykrywanie rekordów (`detectSessionNewMaxes`, `finishWeightRecords`) i sposób liczenia `bestSetsFromSession` nie zmieniają się.
- **BR-9.** Dane cardio (minuty, dystans, tętno, kcal, kroki) są opcjonalne. Ich brak nigdy nie blokuje zapisu siłowego.
- **BR-10.** Trening z zerową liczbą zaliczonych serii: zgodnie z decyzją Q5.

## 9. Przypadki brzegowe

| # | Sytuacja | Oczekiwane zachowanie |
|---|---|---|
| E-1 | Trening bez cardio | Pasek cardio: „Dodaj cardio po treningu”. Brak żądania cardio przy „Zamknij” (AC-6.5). |
| E-2 | Trening bez planu (brak `workoutPlanId`) | Brak porównania: delta „—”, tekst „Brak zapisanej sesji tego planu”, „Zobacz postęp” ukryte. Zapis i P4 działają. |
| E-3 | Pierwsza sesja planu | Delta „—” + komunikat „Pierwsza zapisana sesja tego planu — brak porównania” (AC-4.3). Ta sama treść w „Zobacz postęp” (jeśli sekcja jest widoczna). |
| E-4 | Trening samymi seriami z masą ciała (0 kg) | Zależne od Q1. Przy regule obecnej (F-3): wszystkie serie pominięte, dialog przy każdym treningu, tonaż 0, delta „—” i „Najlepsze serie” pokazują powtórzenia. Przy regule zaproponowanej (Q1): serie zaliczone, bez dialogu, tonaż 0 (delta „—”). Test musi pokryć oba warianty po decyzji. |
| E-5 | Zapis nieudany: błąd sieci bez kolejki (`TypeError`), 5xx, 4xx | Stan błędu z „Spróbuj ponownie” i „Wróć do treningu” (AC-3.5). Sesja nie znika, store nie jest resetowany. Brak „Trening zakończony”. |
| E-6 | Zapis w kolejce offline (`queued`) | P4 z informacją „Zapisany offline”. Delta i „Zobacz postęp” niedostępne („—”), zgodnie z A-8 i AC-6.7. Cardio zgodnie z decyzją architekta. |
| E-7 | Trening przerwany w połowie (np. 3/8 serii), zakończony dolnym „Zakończ” | Dolne „Zakończ” pokazuje dialog z liczbą niewykonanych (Q2) — dziś pomija dialog w ogóle (F-2, ścieżka 3). Po zapisie P4 pokazuje 3/8 i wiersze z „niewykonana”. |
| E-8 | Wszystkie serie pominięte (0 zaliczonych) | Zależne od Q5. Dialog z komunikatem „Nie zaliczono żadnej serii” przed zapisem. |
| E-9 | Zmiana strefy czasowej lub zmiana dnia lokalnego w trakcie treningu | Czas trwania liczony z `startedAt`/`endedAt` (bez zmian). Data na ekranie P4 w strefie lokalnej urządzenia z chwili zakończenia. Porównanie „ostatnio” po dacie kalendarzowej lokalnej (`calendarDateKey`). Trening zakończony po północy: data = dzień zakończenia. |
| E-10 | Trening zakończony o północy, zapisany po północy | Jak E-9. Data w podpisie porównania odnosi się do poprzedniej sesji, nie do dnia treningu. |
| E-11 | Dwa urządzenia jednocześnie (ten sam aktywny trening w chmurze) | Po zapisie na jednym urządzeniu drugie NIE może zapisać tego samego treningu ponownie ani wznowić go jako nowego (R-8). Zachowanie do ustalenia przez architekta. |
| E-12 | Zamknięcie karty lub utrata połączenia podczas „Zapisuję trening…” | Jeśli serwer zapisał, a klient nie dostał odpowiedzi, ponowny zapis nie może utworzyć duplikatu (BR-2, R-2). Sesja w store nie jest czyszczona przed potwierdzeniem zapisu. |
| E-13 | Trening zakończony z rekordem ciężaru | P4 pokazuje „Nowe rekordy” i wyróżnienie PR (AC-4.7). Brak przekierowania do Postępów (Q4). |
| E-14 | „Popraw serię N” po zaliczeniu ostatniej serii | Brak ponownego potwierdzenia i zapisu (A-9, AC-1.5). |
| E-15 | Cardio dodane po zapisie, a trening w feedzie zespołu już opublikowany | Brak nowego wpisu i brak kopiowania (AC-6.8). Wpis w feedzie nie zawiera cardio dopisanego później (R-5). |
| E-16 | Odrzucenie treningu (`confirmDiscardSession` w `active-workout-view.tsx`, „Odrzuć” w pasku globalnym) | Bez zmian: bez zapisu, powrót na `/workout-plan`. Nie wchodzi w przepływ zakończenia. |
| E-17 | Zakończenie treningu przyciskiem paska globalnego (ścieżka 2 z F-2) z błędem zapisu | Dziś: `window.alert` (F-2). Po zmianie (Q3): ekran błędu w P4/P3, nie natywny alert (AC-3.6). |

## 10. Co pozostaje bez zmian

- Reguły liczenia serii pominiętych i zaliczonych (`lib/workout-skipped-sets.ts`) - do czasu decyzji Q1.
- Liczenie tonażu i sum powtórzeń (`lib/workout-session-calculations.ts`).
- Wykrywanie rekordów wagowych (`lib/session-new-max.ts`) i `bestSetsFromSession`.
- Ghost Training (`GhostPickerSheet`, `GhostRaceHud`, `lib/ghost-training/`) - poza przepływem zakończenia.
- Zwykła przerwa między seriami (`RestBreakScreen` przy zaliczeniu innej serii, ustawienia `autoStart` i `defaultSeconds`).
- Obliczanie `planCompare` po stronie serwera (`buildWorkoutPlanCompare`) i kształt JSON.
- Kolejka offline (`lib/workout-outbox-db.ts`, `workout-outbox-flush.tsx`) i banner kolejki na `/reports`.
- Odrzucenie treningu (`confirmDiscardSession`, „Odrzuć” w pasku globalnym).
- Edycja historii treningu (`components/workout-history/workout-history-edit-client.tsx`) - poza zakresem; ewentualna późniejsza edycja cardio tam to osobna decyzja.

## 11. Wymagania niefunkcjonalne

- **NFR-1 (telefon w trakcie treningu).** Ostatnia seria zamykana jednym tapnięciem (bez dodatkowego kroku poza dialogiem z F-1/P2). Przyciski min. 44 x 44 px, główny CTA w strefie kciuka na dolnej części ekranu.
- **NFR-2 (szybkość).** Od tapnięcia do pokazania ekranu „Zapisuję trening…” maksymalnie 100 ms (bez czekania na sieć). Czas do pokazania P4 po sukcesie zapisu: cel do ustalenia przez `tester-wydajnosci` (propozycja: p95 ≤ 2 s w sieci mobilnej).
- **NFR-3 (offline / PWA).** Zapis bez sieci kończy się w kolejce i pokazuje P4 w stanie „zapisany offline”. Wszystkie dane P4 poza porównaniem (tonaż, serie, czas) są liczone lokalnie, więc działają bez sieci.
- **NFR-4 (dostępność).** Dialog i ekran podsumowania z obsługą klawiatury i czytnika (role `dialog`, fokus przy otwarciu, zwrot fokusu po zamknięciu). Status „pominięta” i „niewykonana” oznaczony tekstem, nie tylko kolorem. Kontrast tekstu wtórnego (`text-white/45`) do weryfikacji w etapie 8.
- **NFR-5 (bezpieczeństwo).** Jeden zapis z identyfikatorem operacji (BR-2), niezależnie od ścieżki wejścia (F-2). Żądanie cardio przesyła tylko pola cardio. Wszystkie żądania z nagłówkami CSRF jak dziś (`getXsrfHeaders`).
- **NFR-6 (prywatność i logi).** Tętno, kalorie, kroki i dystans są danymi o zdrowiu. Nie trafiają do logów, Sentry ani komunikatów błędu w aplikacji. Patrz sekcja 12.
- **NFR-7 (koszty).** Dodatkowe żądanie cardio to jeden lekki zapis (bez przeliczania całego treningu). Porównanie „vs ostatnio” pochodzi z odpowiedzi zapisu, bez dodatkowego zapytania do bazy. Limity darmowego Turso i Upstash nie powinny wzrosnąć znacząco; liczbę zapytań potwierdza `tester-wydajnosci`.
- **NFR-8 (spójność z wyglądem).** Komponenty w jednym katalogu (`components/active-workout/` dla ekranu zakończenia). Brak duplikatu `PlanCompareDialog` i `WorkoutFinishedScreen` po scaleniu. Komponent `active-workout-global-bar.tsx` i dolne menu sesji (`guided-session-layout.tsx` / `SessionMenuSheet`) wołają ten sam ekran/dialog, nie własne kopie.

## 12. Prywatność i dane wrażliwe (dla `prawnik`)

- Dane cardio z tego przepływu (`avgHr`, `calories`, `steps`, `distanceKm`, minuty) są danymi o zdrowiu w rozumieniu RODO (tętno, aktywność fizyczna powiązana z danymi osoby). Wymagają podstawy przetwarzania i ograniczenia zakresu. Prawnik ocenia, czy zmiana sposobu zbierania (dopisanie po zapisie) wymaga aktualizacji informacji dla użytkownika.
- Tonaż, serie i rekordy są danymi treningowymi osoby; przetwarzanie bez zmian, ale prezentowane w nowym ekranie.
- Brak nowych zgód; brak zmian w zgodach dotyczących zdjęć (nie dotyczy tego przepływu).
- Prawnik proszony o wskazanie, czy porównanie „vs ostatnio” z innymi użytkownikami społeczności (feed zespołu) wymaga osobnej informacji. Ten dokument nie zmienia feedu.

## 13. Zależności i wpływ na Android i Java

- **Next.js (`app/api/workouts/complete/route.ts`).** Endpoint zapisu jest rdzeniem zmian. Nowa operacja cardio wymaga kontraktu (architekt, etap 3, ADR).
- **Java backend (`java-backend/src/main/java/pl/gymbrat/backend/workout/WorkoutController.java`).** Kontroler obsługuje zapis treningu; zmiana kontraktu (identyfikator operacji, zwracany identyfikator zapisu, operacja cardio) dotyka także Javy. Architekt potwierdza, czy Next proxuje tę ścieżkę do Javy, czy obsługuje ją TypeScript.
- **Android (`android/`).** Do potwierdzenia przez architekta, czy aplikacja natywna wywołuje `/api/workouts/complete` lub używa innego kanału. Jeśli tak, zmiana kontraktu wymaga wersjonowania.
- **Outbox (`lib/workout-outbox-db.ts`, `components/workout/workout-outbox-flush.tsx`).** Wysyłka kolejki używa tego samego payloadu zapisu; identyfikator operacji (BR-2) musi być w payloadzie kolejki.
- **Feed zespołu (`lib/community/team-feed-auto.ts`, `lib/community/team-feed.ts`).** Automatyczne wpisy z treningu zależą od zapisu. Architekt określa, czy cardio dopisane po zapisie wpływa na wpis (R-5).
- **Changelog (`components/changelog/changelog-data.ts`).** Wpis z `planned: true` na PR; zmiana zachowania dialogu (F-1) i etykiet wymaga opisu dla użytkownika.
- **Konfiguracja.** Brak nowych zmiennych środowiskowych w tym zakresie (wpis w `lib/admin-config-status.ts` niepotrzebny, chyba że architekt doda zależność).

## 14. Ryzyka

| ID | Ryzyko | Prawdopodobieństwo | Wpływ | Mitigacja / właściciel |
|---|---|---|---|---|
| R-1 | Masa ciała 0 kg traktowana jako pominięta (F-3): dialog przy każdym treningu bodyweight, zaniżony tonaż wizualnie | Wysokie | Wysoki | Decyzja Q1 przed etapem 3 (właściciel produktu); test obu wariantów (`analityk`, `tester`). |
| R-2 | Duplikat treningu przy ponowieniu zapisu po utracie odpowiedzi serwera (retry, zamknięcie karty, dwukrotne tapnięcie, lub zapis równolegle z dwóch ścieżek z F-2) | Średnie | Wysoki | Identyfikator operacji zapisu, blokada podwójnego kliknięcia, nie czyścić store przed sukcesem (`architekt`). |
| R-3 | Cardio po zapisie wymaga identyfikatora zapisanego treningu; obecny wynik `submitCompletedWorkout` nie zwraca identyfikatora (zweryfikowane w `lib/workout-complete-submit.ts`); kolejka offline go nie ma | Pewne | Średni | Architekt rozstrzyga zwracanie identyfikatora i obsługę kolejki (AC-6.7). |
| R-4 | Dialog F-1 zaczyna działać po raz pierwszy: użytkownicy zobaczą nowe ostrzeżenie | Pewne | Średni | Changelog, testy regresji, ewentualnie wyłączenie przy Q1. |
| R-5 | Feed zespołu zapisany przy zapisie treningu bez cardio, a cardio dopisane później - rozjazd treści | Średnie | Niski | Architekt: czy wpis aktualizuje się przy patchu; `tester` sprawdza brak duplikatu (AC-6.8). |
| R-6 | Pasek globalny i dolne „Zakończ” (ścieżki 2 i 3 z F-2) nie zmienią się razem z resztą: trzy różne nazwy, trzy różne zachowania (ekran vs `/reports` vs brak dialogu) | Wysokie bez decyzji Q3 | Średni | Decyzja Q3; zakres P5/A-10 obejmuje wszystkie trzy ścieżki. |
| R-7 | Usunięcie przekierowania do Postępów przy NOWY MAX (Q4) zmienia oczekiwanie części użytkowników | Średnie | Niski | Potwierdzenie Q4; wyróżnienie rekordu zostaje na ekranie. |
| R-8 | Dwa urządzenia z tym samym aktywnym treningiem w chmurze: ponowny zapis albo wskrzeszenie sesji po zapisie na drugim | Średnie | Wysoki | Architekt: znacznik zamknięcia sesji w chmurze; test dwóch klientów (`tester-bezpieczenstwa`). |
| R-9 | Dane zdrowotne (tętno, kcal, kroki) w nowym żądaniu cardio trafiają do logów lub Sentry | Niskie | Wysoki | Zakaz logowania payloadu cardio; przegląd `tester-bezpieczenstwa`. |
| R-10 | Martwy komponent `WorkoutSummary.tsx` z czerwonym CTA pozostaje w repozytorium i wprowadza w błąd przy przeglądzie | Pewne | Niski | Usunięcie w tej zmianie lub backlog (frontend). |
| R-11 | Różne odcienie koloru w kodzie przepływu (złoto vs `#FF1A4B` w pasku globalnym): ujednolicenie wymaga przeglądu kilku komponentów | Średnie | Niski | Token w motywie; przegląd wizualny (etap 8). |

## 15. Priorytetyzacja MoSCoW

- **Must:** P1 (bez wymuszonej przerwy po ostatniej serii), P3 (zapis przed podsumowaniem, obsługa błędu i kolejki), P4 (jeden ekran i „Zamknij” bez zapisu), P5 (usunięcie popupu, `sessionStorage` i rozjazdu trzech ścieżek), P7 (nazwa zdarzenia), P10 (etykieta „vs ostatnio”).
- **Must (po decyzji Q1):** P2 (dialog pominiętych - podłączenie, tytuł i rozdzielenie liczników, bo dziś nie działa, F-1).
- **Should:** P6 (cardio po zapisie jako patch, z obsługą błędu), P8 (rozdział terminów), P9 (kolor CTA).
- **Could:** rozszerzenie porównania o dane bodyweight (reps), baner „Wróć do pominiętej” na ekranie P4, edycja cardio z historii.
- **Won't (w tej zmianie):** zmiana algorytmu coacha, przebudowa historii treningów, zmiana zasad zgód i zdjęć.

## 16. Pytania techniczne do architekta (nie blokują analizy)

- Q-tech-1. Zwracanie identyfikatora zapisanego treningu z `POST /api/workouts/complete` i kontrakt operacji cardio (patch vs osobny endpoint).
- Q-tech-2. Zachowanie cardio dla treningu w kolejce offline (dołączanie do payloadu vs blokada).
- Q-tech-3. Identyfikator operacji zapisu i idempotencja po stronie serwera (Next i Java).
- Q-tech-4. Czy Android wywołuje ten sam kontrakt; czy zmiana wymaga wersjonowania.
- Q-tech-5. Zachowanie przy zapisie na drugim urządzeniu (znacznik zamknięcia sesji w chmurze).
- Q-tech-6. Jak scalić trzy osobne implementacje zapisu (`completeWorkout` w `active-workout-view.tsx`, `completeWorkoutFromBar` w `active-workout-global-bar.tsx`) w jeden punkt wywołania bez duplikowania logiki `sessionStorage`/nawigacji (F-2).

## 17. Wpływ na dokumentację i wdrożenie

- Changelog: wpis `planned: true` na PR z opisem zmiany zachowania (dialog pominiętych, nowa nazwa ekranu, cardio po zapisie, ujednolicenie trzech ścieżek zakończenia).
- Dokumentacja zespołu: ADR dla kontraktu zapisu (etap 3, `docs/adr/`), projekt ekranu (etap 4, `docs/ux/`).
- Baza wiedzy `docs/zespol/wiedza-o-projekcie.md` istnieje w repozytorium i została przeczytana przy tym przebiegu (poprzedni przebieg błędnie zgłosił jej brak).

## 18. Werdykt analityka

**ZATWIERDZONE Z UWAGAMI.**

Ta powtórka etapu 1 została wykonana samodzielnie na gałęzi `feat/koniec-treningu-flow` (zweryfikowano odczytem `.git/HEAD`), nie na `master`. Wymagania są kompletne i testowalne dla wszystkich 10 ustalonych kierunków. Kierunek produktowy nie jest kwestionowany. Uwagi do uwzględnienia przed etapem 3 (architekt):

1. **Q1 (masa ciała 0 kg) jest blokerem** dla finalnej reguły pominięcia, dialogu (P2) i ekranu (P4). Bez decyzji właściciela architekt nie może zamknąć projektu zapisu, bo zależy od tego, czy dialog pojawia się przy treningach bodyweight. Kod dziś ma dwie sprzeczne reguły dla tego samego zdarzenia (`isSkippedWorkoutSet` vs `kind: "bodyweight"` w `workout-session-calculations.ts`/`progress-hub.ts`) — zweryfikowane w tym przebiegu.
2. **F-1 (dialog nigdy się nie pokazuje)** — potwierdzone ponownie, samodzielnie: w `active-workout-view.tsx` nie istnieje żadne wywołanie `setAllSetsDoneOpen(true)`. Zmienia zakres P2 z „zmiana tytułu” na „podłączenie, zmiana tytułu i rozdzielenie liczników pominiętych/niewykonanych”.
3. **F-2 (trzy ścieżki zapisu, nie jedna)** — potwierdzone: `completeWorkout` (ekran główny), `completeWorkoutFromBar` (pasek globalny, przekierowanie do `/reports`, błąd przez `window.alert`) i dolne „Zakończ” (`onFinishSession` → `setFinishOpen(true)` bez żadnego dialogu). P5 i Q3 muszą objąć wszystkie trzy, inaczej ujednolicenie nazw i ekranu będzie częściowe.
4. **Korekta względem pierwszego przebiegu:** `primarySetActionLabel` i `lib/active-workout-copy.ts` ISTNIEJĄ (wbrew poprzedniemu raportowi) i są używane w `guided-session-layout.tsx`. Faktyczna etykieta głównego przycisku to „Zapisz serię N” / „Popraw serię N”, pominięcie jest osobnym linkiem „Pomiń”. Ta korekta jest wpisana do karty zadania (bramka 1).
5. **R-2 i R-3 (idempotencja, identyfikator zapisu)** to decyzje architektoniczne, nie wymagania; są warunkiem dla P3 i P6, i dodatkowo dla scalenia trzech ścieżek zapisu z uwagi 3 (Q-tech-6).

Uwagi są niskiego do średniego ryzyka dla samych wymagań, ale Q1, F-2 i R-2 mają wysoki wpływ na implementację; dlatego werdykt to ZATWIERDZONE Z UWAGAMI, a nie ZATWIERDZONE. Przejście do etapu 2 (prawnik, bramka wejściowa) i etapu 3 (architekt) możliwe po odnotowaniu Q1, F-2 i R-2 w karcie.
