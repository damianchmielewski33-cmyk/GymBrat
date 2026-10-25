# 004 - Ekran aktywnego treningu: bramka wyjściowa (prawnik, etap 10)

Projekt roboczy asystenta AI, nie porada prawna. Treści dla użytkowników (mikrokopia, plakietka Ghost, powody sugestii, zdania o zapisie danych) wymagają zatwierdzenia przez prawnika-człowieka przed publikacją (patrz sekcja 5). Data: 2026-10-25.

Podstawa: bramka wejściowa `docs/prawo/004-ekran-aktywnego-treningu-wejscie.md` (LR-1..LR-10), karta `docs/zadania/004-ekran-aktywnego-treningu.md`, analiza, ADR 0003 (§11, rundy 1-3), specyfikacja UX (przegląd wizualny, weryfikacja rund 1-3, zamknięcie etapu 8), raport testów, raport bezpieczeństwa (w tym retest 2026-10-25), raport wydajności. Dodatkowo sprawdzono w kodzie (drzewo robocze, bez `git diff`, którego w tym etapie nie uruchamiano): `components/active-workout/*`, `lib/set-suggestion-view.ts`, `lib/live-set-coach.ts` (ok. l. 470-510), `lib/ghost-training/timeline.ts` (l. 40-80), `components/active-workout/guided-session-layout.tsx` (l. 196-251), `components/active-workout/ghost-picker-sheet.tsx`, `components/changelog/changelog-data.ts` (wpis 004), `android/app/src/main/AndroidManifest.xml`.

Zakres weryfikacji prawnej: nie weryfikowano na nowo ISAP, EUR-Lex, UODO ani EROD w tym etapie (zmiana nie dodaje operacji przetwarzania; punkt odniesienia to bramka wejściowa z 2026-10-23, dokumenty 00/01/003). Przed publikacją dokumentów prawnych (nie tej mikrokopii) stan prawny należy sprawdzić ponownie.

## 1. Werdykt

**ODRZUCONE (wąsko).** Zadanie nie jest gotowe do wydania. Blokuje jedna sprawa: wartość początkowa, której użytkownik nie potwierdził, trafia do danych treningu, a potem do osi czasu i wyścigu Ghost, które pokazują dane także innym osobom (LR-3, LR-8 d). Naprawa obejmuje dwa małe punkty (sekcja 3.3). Reszta wdrożenia spełnia LR-1, LR-2, LR-4..LR-7, LR-9 i LR-10 (z uwagami niskiego ryzyka).

Po naprawach F1 i F2 (sekcja 3.3) wystarczy krótki ponowny przegląd tylko LR-3 i LR-8, bez powtarzania całej bramki. Mikrokopia wymaga osobnego potwierdzenia przez człowieka (sekcja 5) przed Promote.

## 2. Status reguł LR-1..LR-10

| Reguła | Status | Dowód | Uwagi |
|---|---|---|---|
| LR-1 brak danych treningowych w logach, Sentry, analityce | SPEŁNIONE | Brak `console.*`, Sentry, PostHog w `components/active-workout/` i w nowych plikach `lib/` (set-suggestion-view, workout-session-progress, workout-set-draft, rest-next-step, workout-skipped-sets, active-workout-copy, progress-format). Komunikaty walidacji to stałe bez wartości (ADR §3 D3, bezpieczeństwo „Sprawdzone bez uwag”, retest). | Zalecenie dla przyszłości: test lub reguła lint blokująca `console.` w `components/active-workout/`. |
| LR-2 brak zmian API, schematu, Androida, env | SPEŁNIONE z jednym wyjątkiem bezpieczeństwa (sekcja 4) | ADR D8 (architekt); brak migracji; brak nowych zmiennych env; brak nowych zależności. `AndroidManifest.xml:5` już ma `VIBRATE` (bez nowego uprawnienia). | Zmiany w `app/api/ghost-training/timeline/route.ts` i `lib/ghost-training/targets.ts` (fix V-1) wynikają z naprawy podatności, patrz LR-8 f. |
| LR-3 wartość początkowa z własnych danych, bez nadpisania, bez `done`, bez natychmiastowego pushu, pominięcie odróżnione | CZĘŚCIOWO. Naruszenie warunku z analizy (pkt 2) w osi czasu Ghost | Literalnie spełnione: `resolveInitialSetDraft` (źródła własne, `set.weight > 0` nie jest nadpisywane); wejście na serię nie wywołuje `onPatchSet` (`guided-session-layout.tsx:209-220`); `flushDraft` wysyła `done: set.done` (`:246-250`), więc seria nie staje się zaliczona; pominięta ma osobny stan (P-1). Problem: `flushDraft` przy wyjściu z serii zapisuje do store wartość z sugestii, której użytkownik nie potwierdził (`:242-251`). Patrz sekcja 3. | Wymaga F1 i F2. |
| LR-4 neutralna sugestia, bez słów oceniających | SPEŁNIONE | `lib/set-suggestion-view.ts:45-61` (`REASON_BY_RULE`): „zakres zrobiony z zapasem”, „2 treningi na górze zakresu”, „+1 powt.”, „lżej po dłuższej przerwie”, „lżej, nowy cykl zakresu”, „lżej, ostatnio bez zapasu”, domyślnie „na podstawie ostatnich serii”. Tekst silnika (`p.reason`) nie trafia na ekran (ADR §11, runda 3). Grep w `components/active-workout`: brak „Uwaga”, „Świetnie”, „Trzymaj”, „słabo”, „porażk”, „błąd”, „za mało”, „zejdź”, emoji. | Uwagi niskie (sekcja 5.3). N-2 nie jest osiągalne na ekranie (sekcja 6). |
| LR-5 kolor nie jedynym nośnikiem, kontrast, cele dotyku, `aria-label` | SPEŁNIONE (potwierdzone przez ux i tester) | Sugestia: ↑ / ↓ / = plus znak i słowo w `aria-label` (ux §5.3); pominięta: ikona „–” i pusty segment; zapisana: ✓ i pełny segment; bieżąca: wyższy segment i pierścień. Czerwień `--gym-trend-down` #ff5a5a (5,5-6,6:1), nie `--destructive`, bez ikon ostrzegawczych. Cele 44 px (ux, tester E12). | Test deuteranopii i czytnika ekranu (TalkBack) zostały jako ręczne na Preview (raport testów §6 pkt 6). Warunek wydania, nie blokada. |
| LR-6 pominięta pomarańczowa z „–”, nigdy zielona; „Zapisano” bez obietnicy efektu | SPEŁNIONE | Tokeny: `--gym-skipped` #ff9f43; pigułka z ikoną `Minus`; `aria-label` „pominięta”; `isExerciseCompleted` (BR-3) przy pominięciu nie daje „ćwiczenie ✓” (testy E8, `rest-next-step.test.ts`). Karta „Zapisano · ciężar × powt. · RIR” nie zawiera oceny ani efektu. | - |
| LR-7 wibracja tylko przez `hapticRestEnd` | SPEŁNIONE | Koniec przerwy: `finishRestFromTimer` (`active-workout-view.tsx:389-394`) → `playRestTimerEndSignal` (`lib/rest-timer-signal.ts:139`) → `hapticRestEnd`. Przesunięcie −15 s woła ten sam `finishRestFromTimer` (`:412`, `:564`). Brak nowych wywołań `navigator.vibrate` w 004. | Wibracja działa tylko przy włączonym dźwięku, jak dziś. |
| LR-8 plakietka Ghost, bez „bez zapisu”, zapis identyczny, zakres bez zmian, lib/api bez zmian | CZĘŚCIOWO. (a), (b), (e) spełnione. (c) bez testu regresji. (d) wymaga F1. (f) wyjątek bezpieczeństwa | (a) `ghost-picker-sheet.tsx`: „Ghost: wybierz rywala”, „Ghost: wygrywasz/łeb w łeb/rywal prowadzi”, „Ghost: <sourceLabel>”; panel „Ścigasz się z wcześniejszym treningiem. Twój dzisiejszy trening zapisuje się tak samo.”; grep „bez zapisu” w całej aplikacji: zostaje tylko dialog porzucenia sesji „Zakończyć bez zapisu?” (`workout-discard-session-dialog.tsx:44,71`) i komentarze. (c) grep: brak odwołań do ghost w `active-workout-view.tsx` i w `app/api/workouts` (struktura zgodna z tekstem), ale brak testu, tester oznaczył LUKA. (d) patrz 3.2. (f) patrz sekcja 4. | Dialog porzucenia zostaje: opisuje rzeczywiste porzucenie i nie dotyczy Ghost. |
| LR-9 brak nowych wywołań sieci i kluczy storage; potwierdzenie „Zakończ” z `flushDraft` | SPEŁNIONE (z uwagą) | Bezpieczeństwo (dwie rundy): brak nowych `fetch` i kluczy storage w zakresie 004. Grep `components/active-workout`: `fetch` tylko w istniejących miejscach (cloud sync, ghost-picker, widok). Menu „Zakończ”: `hapticTap` → `flushDraft` → zamknięcie → `onFinishSession` (ADR §11, D5). Potwierdzenie `WorkoutFinishedScreen` bez zmian. | Nie porównywano diffa z bazą (brak git w tym etapie); opieram się na raporcie bezpieczeństwa, architekta i ADR §11. Flush z 3.2 (F2) nadal wysyła zapis, ale nie nowy endpoint. |
| LR-10 mikrokopia neutralna, PL, bez nacisku i gwarancji | SPEŁNIONE z uwagami niskimi | Sekcja 5 (tabela decyzji). | Uwagi: „+1 powt.” przy „=”, „nowy cykl zakresu”, „lżej, ostatnio bez zapasu”. Nie blokują. |

## 3. Ustalenia blokujące i rozstrzygnięcia

### 3.1 Wersja V-2 i RT-2 (pytanie koordynatora)

- **V-2 (zakres sugestii i „Ostatnio”): zamknięte.** Retest 2026-10-25 potwierdził, że niezapisana seria nie wpływa na `lastSessionSets` ani na `suggestedWeights` (`lib/last-workout-hints.ts`). Akceptuję. Uwaga jakościowa z retestu (pierwsza asercja testu regresji nie rozróżnia wersji) jest wadą testu, nie prawa: w backlogu, niski.
- **Ryzyko resztkowe: `flushDraft` (L-1 / V-2 b).** Niezamknięte, patrz 3.2. Nie jest to wyłącznie kwestia sugestii: wartość zapisana w store trafia do osi czasu Ghost i do chmury.
- **RT-2 (`lib/last-workout-hints.ts:470-478`): akceptuję jako ryzyko niskie** z trzech powodów:
  1. Dotyczy wyłącznie pól `reps`, `rpe`, `rir` (nie ciężaru) i tylko pustych pól nowej sesji.
  2. Wartość pochodzi z własnego poprzedniego treningu użytkownika, jest widoczna w polu i zapisuje się dopiero po dotknięciu „Zapisz serię” (lub przy zapisie wartości ustawionej przez użytkownika). To jest dokładnie prefill z BR-7, a nie ukryte zapisanie.
  3. Nie trafia do osi czasu Ghost ani do sugestii.
  Warunek: wpis do backlogu (backend, niski), z zaleceniem użycia `completedHistSets` dla prefillu. Różnica względem 3.2: tutaj użytkownik widzi wartość i potwierdza ją zapisem; w `flushDraft` wartość trafia do danych bez potwierdzenia.

### 3.2 Nowe ustalenie: oś czasu Ghost liczy serie niezaliczone (F1, F2)

- `lib/ghost-training/timeline.ts:55-58`: seria jest pomijana tylko przy `skipped`, a serię z `reps > 0` lub `weight > 0` liczy się także wtedy, gdy `done === false`. Oś czasu, liczba serii i objętość wyścigu (`cumulativeSets`, `cumulativeVolume`) biorą takie serie pod uwagę.
- `guided-session-layout.tsx:242-251` (`flushDraft`): przy przejściu na inną serię, przy `onBlur`, przy `☰` i przy `goPrev` zapisuje do store wartości z pól (`draftValues()`), w tym wartość z sugestii wstawioną przez BR-7 (D3), z `done: set.done` = `false`. Push do chmury idzie debounced.
- Skutek: użytkownik, który przejdzie pigułką na inną serię bez zapisu, zostawia w danych treningu serię z wartością, której nie potwierdził. Po zakończeniu treningu `app/api/workouts/complete/route.ts` zapisuje `exercises` bez filtrowania (raport bezpieczeństwa V-2). Wyścig Ghost liczy taką serię jako wykonaną. Gdy rywalem jest znajomy lub lider zespołu, pokazuje to wartość, której ten rywal nie potwierdził. Raporty (`done`) są chronione, Ghost nie.
- Ocena: prawdopodobieństwo średnie (każde przejście pigułką z wstępnie wypełnioną serią), skutek średni (dokładność danych art. 5 ust. 1 lit. d RODO; dane innej osoby pokazane w wyścigu w zakresie zgodnym z ustawieniami, ale z wartością, której ta osoba nie zrobiła). Ryzyko jest w części pre-istniejące (użytkownik mógł zostawić wpisaną wartość przed 004), ale 004 je znacznie zwiększa, bo wstawia wartość automatycznie.
- Dlaczego nie wystarczy backlog: to jest wyraźny wyjątek od warunku z analizy (pkt 2 i LR-3), a ryzyko jest średnie. Przepływ dopuszcza „ZATWIERDZONE Z UWAGAMI” tylko dla niskiego ryzyka.

**Wymagane naprawy (przed Promote):**

- **F1 (backend, `lib/ghost-training/timeline.ts`)**: w `buildGhostTimeline` pomijać serie z `done !== true` (zamiast warunku `reps <= 0 && weight <= 0 && !s.done`). Test regresji: seria `done: false` z wagą i powtórzeniami nie wchodzi do osi czasu ani do liczby serii; seria `done: true` działa jak dotąd. Architekt potwierdza, że `lib/ghost-training/deltas.test.ts` pozostaje zielony. Zmiana zawęża dane wejściowe i nie rozszerza zakresu (zgodnie z duchem LR-8 d).
- **F2 (frontend, `guided-session-layout.tsx`, `flushDraft`)**: do store trafiają tylko wartości, które użytkownik zmienił przy tej serii (np. flaga „dirty” ustawiana przez `onWeightInput`/`onRepsInput`), a wartość wstawiona przez BR-7 bez zmiany użytkownika nie jest zapisywana, dopóki nie nastąpi „Zapisz serię” lub zmiana pola. Architekt wybiera technikę (L-1, decyzja analityka). Test: wejście na serię z sugestią, przejście pigułką, brak wywołania `onPatchSet` z wartością sugestii i brak pozycji w `workouts.exercises`.
- **Test LR-8 c (tester)**: test, że zapis serii i synchronizacja są identyczne przy włączonym i wyłączonym Ghost (może być jednostkowy na funkcji zapisu lub e2e). Zdanie „Twój trening zapisuje się tak samo” ma być poparte testem, nie tylko przeglądem.

Po F1, F2 i teście LR-8 c: ponowny przegląd prawnika tylko LR-3 i LR-8, oraz powtórzenie `npm test` i e2e dla scenariusza przejścia pigułką.

## 4. Wyjątek od LR-8 (f): zmiany w `lib/ghost-training/targets.ts` i `app/api/ghost-training/*`

LR-8 (f) zakazywał zmian w tych plikach w zadaniu 004. Pliki zostały zmienione (`app/api/ghost-training/timeline/route.ts`, `lib/ghost-training/targets.ts`, nowy `targets.test.ts`), żeby zamknąć V-1 (podatność wysoka, BOLA: nieznany `kind` omijał autoryzację danych treningowych). Retest potwierdził zamknięcie.

**Decyzja: wyjątek zatwierdzony.** Zmiana jest wyłącznie zawężająca: odrzuca `kind` spoza `self|friend|leader` przed dostępem do danych i nie zmienia zakresu danych dla poprawnych rodzajów. Nie rozszerza zakresu ani zgód. Zostaje w zadaniu 004 jako element bramki wyjściowej. Zalecenie: w dokumencie zmian (`docs/zadania/004`) zapisać, że LR-8 (f) został zmieniony z powodu V-1.

## 5. Mikrokopia: czy może być uznana za zatwierdzoną do wydania

### 5.1 Rozstrzygnięcie zasady zespołu

Zasada „dokumenty prawne zatwierdza prawnik-człowiek” obejmuje dokumenty prawne (regulamin, polityka prywatności, cookies, zgody, klauzule informacyjne, kody weryfikacyjne) oraz każdy tekst dla użytkownika, który:

- składa oświadczenie o danych, zgodzie, prawach albo skutkach prawnych (np. „Twój trening zapisuje się tak samo”), albo
- jest warunkiem wydania ustalonym w karcie zadania (tu: powody sugestii, karta etapu 8).

Zwykła mikrokopia UI (etykiety przycisków, „Zapisz serię N”, „Zacznij serię N”, „Ostatnio”, komunikaty walidacji bez danych o treningu) nie wymaga osobnego zatwierdzenia przez człowieka jako dokument prawny. Zatwierdza ją `ux` (projekt) i ten etap (treść pod kątem LR-4, LR-5, LR-10).

### 5.2 Decyzja dla tego zadania

| Grupa tekstów | Decyzja | Wymóg przed Promote |
|---|---|---|
| Ogólna mikrokopia ekranu (CTA, linki, nagłówki, „Zapisano”, „Następnie”, „Koniec treningu”, menu, „Podaj ciężar”, „Podaj liczbę powtórzeń”) | ZATWIERDZONE w tym etapie (treść neutralna, bez obietnic, bez oceny, zgodna z LR-4/LR-6/LR-10) | Brak odrębnego zatwierdzenia człowieka wymaganego prawem. Zalecany przegląd przez człowieka w tej samej partii (opcjonalnie). |
| Powody sugestii (`REASON_BY_RULE`, sześć tekstów plus domyślny) | ZATWIERDZONE TREŚĆ, ale warunek karty wymaga zatwierdzenia przez prawnika-człowieka | Tak: potwierdzenie człowieka przed Promote |
| Plakietka Ghost i panel („Ghost: wybierz rywala”, „Ścigasz się z wcześniejszym treningiem. Twój dzisiejszy trening zapisuje się tak samo.”, aria „… Twój trening zapisuje się normalnie”), pozycja w changelog (bullet 5) | ZATWIERDZONE TREŚĆ pod warunkiem F1, F2 i testu LR-8 c (zdanie o zapisie jest prawdziwe według kodu, ale musi być poparte testem). To zdanie opisuje przetwarzanie danych. | Tak: potwierdzenie człowieka przed Promote, po naprawach F1/F2 |
| Changelog 004 (bullets 1-5) | ZATWIERDZONE w zakresie zgodności z ekranem. Bullet 1 („podpowiedź … wypełnia ciężar”) jest prawdziwy tylko po F2 (zapis wyłącznie z potwierdzeniem). | Przed Promote: po F2 powtórzyć weryfikację zgodności tekstu z zachowaniem |

Oświadczenie: powyższa ocena jest projektem roboczym asystenta AI. Treść powodów sugestii i zdania o zapisie Ghost nie jest jeszcze zatwierdzona przez człowieka i nie może być opublikowana, dopóki tego nie zrobi.

### 5.3 Ocena poszczególnych tekstów (LR-4, LR-10)

- „zakres zrobiony z zapasem”, „2 treningi na górze zakresu”, „lżej po dłuższej przerwie”: neutralne opisy faktów z własnych danych. Akceptuję.
- „lżej, nowy cykl zakresu”: neutralne; „zakres” to żargon (uwaga ux 2). Akceptuję, zalecam zmianę na „lżej, nowy cykl powtórzeń” przy najbliższej okazji (niski).
- „lżej, ostatnio bez zapasu”: opisuje poprzednią serię (RIR 0) jako fakt, bez oceny. Nie jest to „za ciężko” ani „słabo”. Akceptuję (odpowiedź na uwagę 3 ux).
- „+1 powt.” przy kierunku „=” („ten sam ciężar · +1 powt.”): plus nie oznacza tu wzrostu ciężaru, bo kierunek to „=”. Akceptuję; zalecana zmiana na „o 1 powt. więcej” (niski, backlog).
- „na podstawie ostatnich serii” (domyślny): neutralne. Akceptuję.
- „Podaj ciężar”, „Podaj liczbę powtórzeń”: neutralne, bez „błąd”. Akceptuję.
- Aria „Sugestia: lżej, 15 kg, 5 powtórzeń. Wstaw”: neutralne, bez oceny. Akceptuję.

## 6. Uwaga N-2 („Jeden słabszy set to jeszcze nie problem”)

Stan: tekst jest w `lib/live-set-coach.ts:489` (wariant „trend-hold”), a także „Jedna twardsza seria…”. Na ekranie 004 NIE jest wyświetlany:

- Widok sugestii używa z porady Live Coach tylko `apply` (ciężar, powtórzenia) i `rule` (kod); `tip.body` i `tip.reason` nie trafiają do UI (`lib/set-suggestion-view.ts:106-130`).
- Jedyny konsument całego tekstu porady to `actions/active-workout-coach.ts` (`liveCoachTipToPlainText`), który ma zero wywołań (zadanie L-8, osierocony).

Ocena: **nie blokuje wydania 004** (tekst nieosiągalny), ale słowo „słabszy” jest blisko zakazanego „słabo” (LR-4). Warunek: przed każdym ponownym podpięciem `actions/active-workout-coach.ts` lub `liveCoachTipToPlainText` tekst musi zostać zmieniony i zatwierdzony przez człowieka (propozycja: „Jeden trudniejszy set to nie problem. Powtórz …”, wymaga oceny), a wariant „Jedna twardsza seria” wymaga tego samego przeglądu. Właściciel: ux/prawnik. Priorytet: niski, ale zapisany z warunkiem.

Uwaga do dokumentu ux (§8): zdanie „Tekst »bez zapisu« znika z całej aplikacji” jest za szerokie. Zakaz dotyczy plakietki i kopii Ghost. Dialog „Zakończyć bez zapisu?” opisuje prawdziwe porzucenie i powinien zostać. Poprawić przy najbliższej aktualizacji dokumentu ux (niski).

## 7. Backlog: co wymaga działania teraz, a co może zostać

| Pozycja | Ocena prawna | Decyzja |
|---|---|---|
| U-1: lider FCS wybieralny jako rywal Ghost bez flagi udostępniania (`lib/ghost-training/targets.ts`) | Istniejące działanie, nie wprowadzone przez 004. Dane (serie, ciężary) innej osoby bez jej wyraźnego ustawienia udostępniania wychodzą poza rozsądne oczekiwania. Ryzyko średnie-wysokie dla prywatności, ale nie wynika z tej zmiany. | Nie blokuje 004. Podnieść priorytet z „średni” do „wysoki” i przekazać do decyzji właściciela produktu (wymóg flagi lub ograniczenie do czasu i objętości). Zmiana w `targets.ts` to osobne zadanie, bo 004 nie może jej robić (LR-8 f). Termin: przed rozszerzeniem Ghost lub kampanią. |
| R-2: nietknięty RIR zapisywany jako cel planu (P-3) | Nie dotyczy danych osobowych wprost. Wpływa na jakość danych i progresji, a więc na zaufanie. Ryzyko średnie, ale nie prawne. | Zostaje w backlogu produktowym (średni). Nie blokuje. Zalecenie: osobne zadanie „RIR wybrany/domyślny”, bo zmiana danych wymaga oceny zgodności wstecznej. |
| Masa ciała 0 kg (P-2) | Dotyczy dokładności danych i raportów (art. 5 ust. 1 lit. d). Obecnie 0 kg = pominięta (zachowanie zgodne z obecnym zapisem, nie wprowadzone przez 004). | Zostaje w backlogu (średni). Nie blokuje. Obecny komunikat „Podaj ciężar” przy 0 kg jest zgodny z LR-10. |
| N-3: `package-lock.json` (`zod` 4.3.6→4.6.7) i zmiany `package.json` na gałęzi | Łańcuch dostaw poza 004. Nie wprowadzone przez 004. | Nie blokuje 004. Przed merge gałęzi: przegląd `tester-bezpieczenstwa` na poziomie gałęzi (warunek przed PR, nie przed Promote 004). Priorytet średni, właściciel: użytkownik. |
| RT-2 (reps/rpe/rir z niezapisanej serii historii) | Akceptowane niskie (sekcja 3.1). | Backlog, backend, niski. |
| N-1: „Usuń ostatnią serię” w menu bez potwierdzenia, usuwa też zapisaną | Kontrola użytkownika nad danymi (LR-9 kierunek). Usunięcie zapisanej serii bez potwierdzenia to utrata danych. Element sprzed 004. | Backlog, frontend/ux, podnieść do średniego. Nie blokuje 004 (nie wprowadzone przez 004). |
| W-1, W-2 (zapisy do chmury) | Nie dotyczy prawa wprost (koszty, łącze). | Backlog, bez wpływu prawnego. |
| O-3 (403 przy presence) | Komunikat błędu w konsoli, bez danych treningowych. | Backlog, bez wpływu prawnego; przy okazji sprawdzić, czy błąd nie trafia do Sentry z danymi. |

## 8. Pytania otwarte

- Czy właściciel produktu zaakceptuje ograniczenie danych lidera Ghost (U-1) i termin decyzji?
- Czy technika F2 (dirty flag vs. zapis tylko po „Zapisz serię”) jest zgodna z decyzją analityka L-1? Architekt wybiera wariant.
- Czy minimalny wiek użytkownika jest ustalony (dokumenty 00/01)? Ekran nie zmienia celów kalorycznych ani wagowych, więc to nie blokuje 004, ale ryzyko zaburzeń odżywiania u młodych osób pozostaje otwarte w dokumentach ogólnych.

## 9. Wymagane przed Promote (lista kontrolna)

1. F1 (backend, `timeline.ts`, test regresji).
2. F2 (frontend, `flushDraft`, test z sugestią i pigułką).
3. Test LR-8 c (zapis identyczny z Ghost włączonym i wyłączonym).
4. Ponowny przegląd kodu (architekt) po F1 i F2, bo to zmiany po etapie 6; następnie `npm run lint`, `npx tsc --noEmit`, `npm test` i e2e (`e2e/active-workout.spec.ts`).
5. Zatwierdzenie przez człowieka: powody sugestii i zdanie o zapisie Ghost (plakietka, panel, changelog bullet 5).
6. Wpis w karcie zadania: wyjątek LR-8 f (sekcja 4) i wynik `npm run deploy:check` przed merge.
7. Ponowna weryfikacja prawnika: LR-3 i LR-8 (krótko, po F1/F2).
8. Ręczne scenariusze z raportu testów (sekcja 6) na Preview: Ghost z rywalem, offline, dwa urządzenia, WebView, kontrast i wibracja. Nie są blokadą prawną, ale pokrywają LR-5 i LR-7 na urządzeniu.

## 10. Co nie zostało zrobione w tym etapie

- Nie uruchomiono nowych testów ani `npm test`; wyniki pochodzą z raportów etapów 7-9 i z kontroli grep w drzewie roboczym. Przed Promote należy je powtórzyć.
- Nie porównano diffa z bazą (brak narzędzia git w tym etapie), więc LR-2 i LR-9 opieram na ADR §11, raporcie bezpieczeństwa i kontroli grep.
- Nie weryfikowano na nowo stanu prawnego (ISAP, EUR-Lex, UODO, EROD). Punkt odniesienia: 2026-10-23.

## Werdykt (pierwsza bramka wyjściowa, 2026-10-25, zastąpiona przez „Finalna weryfikacja” poniżej)

**ODRZUCONE (wąsko)** z powodu LR-3 / LR-8 d: oś czasu Ghost i `flushDraft` (F1, F2). Po F1, F2 i teście LR-8 c werdykt może przejść na ZATWIERDZONE Z UWAGAMI po krótkim ponownym przeglądzie. Mikrokopia wymaga potwierdzenia przez prawnika-człowieka dla powodów sugestii i zdania o zapisie Ghost przed Promote. Zadanie nie jest gotowe do wydania.

## Finalna weryfikacja (2026-10-25)

Zakres: LR-3 i LR-8 po F1 i F2, decyzja w sprawie LR-8 (c), ocena flake e2e logowania oraz werdykt całościowy dla zadania 004. Podstawa: sekcje 2-9 pierwszej bramki, karta `docs/zadania/004-ekran-aktywnego-treningu.md`, raport architekta po F1/F2 (zatwierdzony), retest testera w przeglądarce (e2e F2: wejście z podpowiedzią bez zmiany → store bez wartości; zmiana steperem → store z wartością; `npm test` 985/987, 2 znane w `android-version`).

Zastrzeżenie: w tym etapie nie uruchamiano ponownie testów ani lint/tsc (wyniki z raportu testera i architekta). Nie weryfikowano na nowo ISAP, EUR-Lex, UODO ani EROD; zmiana nie dodaje operacji przetwarzania, a punkt odniesienia to 2026-10-23/2026-10-25.

### 1. Weryfikacja kodu w tym etapie (odczyt i grep, drzewo robocze)

- **F1, `lib/ghost-training/timeline.ts:63-72`**: seria trafia do osi czasu tylko przy `isCompletedWorkoutSet` (`done`, nie pominięta, ciężar > 0, powtórzenia > 0; `lib/workout-skipped-sets.ts:35-42`). Seria z `done: false` (draft z `flushDraft`) jest wykluczona. Testy: `lib/ghost-training/timeline.test.ts` (4).
- **F2, `components/active-workout/guided-session-layout.tsx:252-264`**: `flushDraft` nie wysyła pól, gdy wartość równa store albo równa wartości początkowej z wejścia na serię (`isDraftUnchangedFromInitial`, `lib/workout-set-draft.ts:147-154`). Zapis do store następuje tylko przy zmianie przez użytkownika (wpis, stepper, szybki przycisk) albo przy „Zapisz serię”. Testy: `lib/workout-set-draft.test.ts` (5) oraz e2e `e2e/active-workout.spec.ts:401-425`.
- **Wejście na serię** (`guided-session-layout.tsx:213-225`): tylko ustawienie wartości pól i stanu lokalnego, bez `onPatchSet`. Bez zmian względem poprzedniej weryfikacji.
- **Ghost nie wchodzi do ścieżki zapisu serii** (grep `ghost|Ghost` w repozytorium, z pominięciem `docs/`, `e2e/` i `node_modules/`):
  - Moduł store treningu `lib/stores/active-workout.ts`, synchronizacja `lib/active-workout-cloud.ts`, `app/api/workouts/**` i `components/workout/**` nie zawierają odwołań do Ghost (jedyny wynik w `components/workout/types.ts:19` to komentarz do pola `elapsedSecondsAtCompletion`).
  - Znacznik `elapsedSecondsAtCompletion` jest ustawiany w store bezwarunkowo, przy przejściu serii w `done` (`lib/stores/active-workout.ts:95-101`), niezależnie od tego, czy Ghost jest włączony.
  - Store Ghost (`lib/stores/ghost-training.ts`) czytają wyłącznie `components/active-workout/ghost-race-hud.tsx` i `ghost-picker-sheet.tsx`. Po stronie API Ghost są tylko odczyty (`GET /api/ghost-training/timeline`, `GET /api/ghost-training/targets`).
  - Wniosek: Ghost jest jednokierunkowy (czyta dane, nie zapisuje ich ani nie zmienia ścieżki zapisu).

### 2. LR-3: pełne spełnienie

**Status: SPEŁNIONE** (z jedną uwagą niskiego ryzyka, pkt 2.1).

Warunki LR-3 sprawdzone po kolei:
- wartość początkowa z własnych danych (`resolveInitialSetDraft`, BR-7) wypełnia tylko pole, bez nadpisania wartości zapisanej serii: spełnione;
- wejście na serię nie zapisuje do store i nie wysyła pushu: spełnione (F2 zamknął przejście przez nawigację, blur, menu ☰ i `goPrev`, które wszystkie wołają `flushDraft`);
- seria z podpowiedzią nie staje się zaliczona (`done` bez zmian, `flushDraft` przekazuje `done: set.done`): spełnione;
- oś czasu Ghost nie liczy niezaliczonych serii: spełnione (F1);
- pominięcie jest odróżnione (`skipped`, pomarańczowy segment, „–”): spełnione.

**2.1 Uwaga nowa, niskie ryzyko: przycisk „Pomiń” (`skipSet`, `guided-session-layout.tsx:330-342`).** Przycisk wysyła `draftValues()` razem z `skipped: true`. Jeśli pole zawiera niezmienioną podpowiedź, do store i do chmury trafia ciężar/powtórzenia z podpowiedzi przy serii oznaczonej jako pominięta. Skutki, sprawdzone w kodzie:
- seria pominięta nie wchodzi do osi czasu Ghost (`isCompletedWorkoutSet` odrzuca `skipped`), więc nie jest widoczna dla rywala;
- seria pominięta nie wchodzi do sugestii ani do „Ostatnio” (`findPreviousCompletedSet` i `lastSessionSets` używają tej samej reguły, V-2 zamknięte);
- w historii własnego użytkownika seria jest oznaczona jako pominięta, ale ma wartość, której użytkownik nie potwierdził.
Przed 004 pole nie miało wartości początkowej (placeholder), więc „Pomiń” zapisywało 0 kg. Efekt jest więc nowy w 004. Ocena: ryzyko niskie (dane własne, bez udostępnienia, zdarzenie wymaga akcji użytkownika, flaga pominięcia zachowana). Nie blokuje. **Zalecenie (backlog, frontend, niski):** `skipSet` ma wysyłać ciężar i powtórzenia tylko wtedy, gdy użytkownik je zmienił (ten sam warunek co w `flushDraft`).

### 3. LR-8 (c): decyzja

**Rozstrzygnięcie: LR-8 (c) SPEŁNIONE na podstawie dowodu strukturalnego. Nie jest wymagany dodatkowy test przed wydaniem.**

Uzasadnienie:
1. Mój wymóg z 2026-10-25 („test, że zapis i synchronizacja są identyczne przy włączonym i wyłączonym Ghost”) miał uzasadnić zdanie z panelu Ghost „Twój dzisiejszy trening zapisuje się tak samo” (`ghost-picker-sheet.tsx`, aria „… Twój trening zapisuje się normalnie”). Cel to prawdziwość tego zdania, a nie konkretna forma testu.
2. Architekt ma rację, że nie ma testu tej relacji. Testy F1 i F2 nie pokrywają tego pytania: dotyczą filtra osi czasu i wartości pól, a nie porównania zapisu z Ghost i bez Ghost.
3. Test „z Ghost włączonym i wyłączonym” nie miałby sensu: store zapisu nie czyta stanu Ghost, więc oba przebiegi zawsze byłyby identyczne. Dowodem jest brak zależności (pkt 1), zweryfikowany w tym etapie.
4. Zdanie jest prawdziwe według kodu. Ryzyko dotyczy przyszłej zmiany, która połączy zapis z Ghost, a nie obecnego stanu.

**Warunek:** jeśli kiedykolwiek ścieżka zapisu lub synchronizacji zacznie czytać stan Ghost, zdanie „zapisuje się tak samo” trzeba ponownie ocenić prawnie przed wydaniem tej zmiany. **Zalecenie (backlog, tester, średni):** test strukturalny, który sprawdza, że `lib/stores/active-workout.ts`, `lib/active-workout-cloud.ts` i `app/api/workouts/**` nie importują modułów Ghost (`lib/stores/ghost-training.ts`, `lib/ghost-training/**`, `components/active-workout/ghost-*`). To chroni przed regresją, a nie przed obecnym błędem.

### 4. Flake e2e logowania (CredentialsSignin, ~1/14)

Ocena: **nie wpływa na gotowość wydania.** Problem dotyczy automatycznych testów, a nie produkcji ani zgód. Zostaje w backlogu (tester, niski, powiązany z W-9 z raportu wydajności).

Pytanie otwarte dla testera przy okazji: nieudane logowanie trwa 13-22 ms zamiast ok. 120-170 ms. Należy potwierdzić, że to nie efekt limitu prób logowania (rate limit) ani błędnych danych w środowisku testowym. Jeśli tak, to nadal nie blokuje wydania, ale wymaga zapisu w backlogu.

### 5. Status LR-1..LR-10 po finalnej weryfikacji

| Reguła | Status | Uwagi |
|---|---|---|
| LR-1 brak danych treningowych w logach/Sentry/analityce | SPEŁNIONE | bez zmian względem pierwszej weryfikacji |
| LR-2 brak zmian API, schematu, Androida, env | SPEŁNIONE | wyjątek LR-8 (f) zatwierdzony (sekcja 4 pierwszej weryfikacji) |
| LR-3 wartość początkowa bez pushu i bez `done`, pominięcie odróżnione | SPEŁNIONE | uwaga 2.1 (Pomiń), niska, backlog |
| LR-4 neutralna sugestia | SPEŁNIONE | bez zmian; uwagi niskie w backlogu |
| LR-5 kolor nie jedynym nośnikiem, kontrast, cele dotyku | SPEŁNIONE | warunek: TalkBack i test deuteranopii na Preview (ręcznie) |
| LR-6 pominięta pomarańczowa z „–”, nigdy zielona | SPEŁNIONE | bez zmian |
| LR-7 wibracja tylko przez `hapticRestEnd` | SPEŁNIONE | bez zmian |
| LR-8 (a) plakietka bez „bez zapisu” (b) (c) zapis identyczny (d) osi czasu (e) (f) zakres | SPEŁNIONE | (c) decyzja w pkt 3; (d) zamknięte F1; (f) wyjątek V-1 zatwierdzony |
| LR-9 brak nowych wywołań sieci i kluczy storage; flush przy „Zakończ” | SPEŁNIONE | flush nadal wysyła tylko zmienione wartości (F2) |
| LR-10 mikrokopia neutralna, PL | SPEŁNIONE z uwagami niskimi | treść wymaga zatwierdzenia człowieka (pkt 6, warunek 1) |

### 6. Werdykt całościowy dla zadania 004

**ZATWIERDZONE Z UWAGAMI.**

LR-3 i LR-8 są spełnione w pełni. Luka z pierwszej bramki (`flushDraft` i oś czasu Ghost) jest zamknięta przez F1 i F2, potwierdzone testami jednostkowymi i testem e2e w przeglądarce. Nie ma uwag wysokiego ryzyka, które zostałyby w kodzie. Uwagi z pkt 2.1 i pkt 4 są niskie.

**Warunki przed Promote (nie są blokadą kodu, ale są wymagane):**
1. **Zatwierdzenie przez prawnika-człowieka** tekstów: powody sugestii (`REASON_BY_RULE` w `lib/set-suggestion-view.ts`), plakietka i panel Ghost („Ścigasz się z wcześniejszym treningiem. Twój dzisiejszy trening zapisuje się tak samo.”, aria „… Twój trening zapisuje się normalnie”) oraz pozycja changelog 004 bullet 5. Bez tego nie publikować.
2. **Decyzja właściciela produktu w sprawie U-1** (lider FCS wybieralny jako rywal Ghost bez flagi udostępniania, `lib/ghost-training/targets.ts`): zapisana w karcie zadania jako (a) ograniczenie przed Promote albo (b) akceptacja ryzyka na piśmie z terminem. Zmiana w `targets.ts` jest poza zakresem 004 (LR-8 f), więc to osobne zadanie, ale decyzja musi być udokumentowana przed rozszerzeniem Ghost w tym wydaniu.
3. **`npm run deploy:check`** przed merge, wynik w karcie zadania. Wpis changelog 004 pozostaje z `planned: true` na PR i zmienia się na bez `planned` dopiero po Promote.
4. **Ręczne sprawdzenia na Preview** (LR-5, LR-7): TalkBack, test deuteranopii, WebView, dwa urządzenia, offline (raport testów, sekcja 6). Wynik zapisać w karcie.

**Backlog produktowy (nie blokuje Promote 004):**

| Pozycja | Priorytet | Właściciel |
|---|---|---|
| `skipSet` zapisuje niezmienioną podpowiedź przy serii pominiętej (pkt 2.1) | niski | frontend |
| Test strukturalny LR-8 (c): moduły zapisu i synchronizacji nie importują Ghost (pkt 3) | średni | tester |
| Flake e2e logowania (pkt 4), w tym pytanie o 13-22 ms | niski | tester (z testerem bezpieczeństwa) |
| N-1: „Usuń ostatnią serię” w menu ☰ bez potwierdzenia, usuwa też zapisaną (sprzed 004) | średni | frontend/ux |
| U-1 (lider FCS bez flagi udostępniania) | wysoki, decyzja właściciela (warunek 2) | właściciel produktu |
| N-3: `package-lock.json` (`zod`) i zmiany `package.json` na gałęzi | średni; przegląd `tester-bezpieczenstwa` na poziomie gałęzi przed merge PR (nie przed Promote 004) | użytkownik |
| RT-2, R-2, P-2 (jak w karcie zadania) | niski / średni | backend / właściciel produktu |
| Mikrokopia: „+1 powt.” przy „=”, „nowy cykl zakresu” (żargon), „lżej, ostatnio bez zapasu”, N-2 w `live-set-coach.ts` (warunek: zatwierdzenie człowieka przed ponownym podpięciem) | niski | ux/prawnik |
| L-1 i W-3 (`flushDraft` przy nawigacji) | zamknięte przez F2 w tym zakresie; wpis do aktualizacji karty | koordynator |
| Dialog „Zakończyć bez zapisu?” (`workout-discard-session-dialog.tsx`) poprawnie opisuje porzucenie, nie dotyczy Ghost. Zdanie w `docs/ux/004` §8 („tekst »bez zapisu« znika z całej aplikacji”) jest za szerokie | niski | ux |

## 11. Aktualizacja LR-8 (d) po zadaniu 005 (2026-10-25)

Dopisek asystenta AI (projekt roboczy). Zmienia wyłącznie opis zakresu osi czasu Ghost; nie zmienia werdyktu 004 ani warunków z sekcji 9.

- **Co się zmieniło.** Reguła „0 kg z powtórzeniami = seria zaliczona” (decyzja właściciela produktu, zadanie 005, p. 7-8) zmienia `isSkippedWorkoutSet`, a przez to `isCompletedWorkoutSet`, z którego korzysta `lib/ghost-training/timeline.ts`. Serie na masę ciała (np. pompki) wchodzą teraz do osi czasu, liczby serii i objętości wyścigu. Wcześniej (zakres z pkt 3.2 i 6 tego dokumentu) były wykluczone.
- **Aktualny zakres osi czasu Ghost (zastępuje opis z 3.2 w części „zakres”):** serie `done: true`, niepominięte, z powtórzeniami > 0 (z ciężarem > 0 albo na masę ciała, 0 kg). Serie `done: false` i pominięte nadal są wykluczone (F1 z 004 obowiązuje bez zmian).
- **Kto widzi.** Odbiorcy się nie zmienili: znajomi z `mutualShare` lub `theyShareWorkout` (`lib/ghost-training/targets.ts`) oraz lider zespołu (bez flagi udostępniania, pozycja U-1). Kategoria danych się nie zmieniła (serie treningowe, które rywal już widzi dla serii z ciężarem).
- **Wstecz.** Zmiana dotyczy też treningów zapisanych wcześniej (interpretacja przy odczycie, bez migracji). Użytkownik, który udostępnia trening, zobaczy w osi czasu serie masy ciała także z przeszłości.
- **Ocena prawna.** Nie jest to nowa kategoria danych, nowy cel ani nowy odbiorca, więc nie wymaga nowej zgody. Mieści się w zgodzie na udostępnianie treningów, którą użytkownik daje w ustawieniach. Warunki (wszystkie przed Promote, szczegóły w raporcie `docs/prawo/005-koniec-treningu-przeplyw-wyjscie.md`): (1) wpis w changelogu, że serie na masę ciała, także z dawnych treningów, są widoczne dla rywali Ghost, którym udostępniasz trening; (2) korekta ADR 0004 p. 6 i tabeli LR-5 (dziś błędnie: „bez zmiany filtra Ghost”); (3) decyzja właściciela w sprawie U-1 dla lidera bez flagi, bo tam rozszerzenie dotyczy także osób, które nie udostępniają treningów.
- **Test LR-8 (c)** z sekcji 9 pkt 3 nadal otwarty; ta aktualizacja go nie zamyka.

Zastrzeżenie: projekt roboczy asystenta AI, nie porada prawna. Przed publikacją treści dla użytkowników zatwierdza prawnik-człowiek. Ten dokument nie zastępuje decyzji prawnika-człowieka ani właściciela produktu.
