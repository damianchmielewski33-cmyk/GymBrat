# 004 - Ekran aktywnego treningu: pomiar wydajności (etap 9)

- Autor: tester-wydajnosci. Data: 2026-10-25. Karta: `docs/zadania/004-ekran-aktywnego-treningu.md`.
- Wejście: ADR `docs/adr/0003-ekran-aktywnego-treningu.md` (D1-D8, §11 przegląd kodu), UX `docs/ux/004-ekran-aktywnego-treningu.md`, baza `docs/wydajnosc/00-analiza-bazowa.md` (propozycje SLO K1: otwarcie ekranu treningu TTI < 2,5 s zimny / < 1,2 s ciepły, INP < 200 ms).
- Zakres: `components/active-workout/` (guided-session-layout, set-pills, set-suggestion-row, session-menu-sheet, rest-break-screen, ghost-picker-sheet, active-workout-cloud-sync), `hooks/use-scroll-edge-fade.ts`, `lib/` (set-suggestion-view, workout-session-progress, workout-set-draft, rest-next-step).
- Kod nie został zmieniony. Wszystkie wnioski dotyczą drzewa roboczego z chwili pomiaru (build produkcyjny z 2026-10-25, ok. 01:27); w tym czasie w drzewie pojawiały się też zmiany innych zadań (ghost-training, last-workout-hints).

## 0. Werdykt

**ZATWIERDZONE Z UWAGAMI.** Brak przekroczeń uzgodnionych SLO w scenariuszu szczytowym, brak problemów blokujących wydanie. Uwagi średnie (W-1, W-2) dotyczą zapisów do chmury i są pre-istniejące w `HEAD`, nie wprowadza ich 004; trafiają do backlogu z właścicielem `frontend` (sekcja 5).

## 1. Środowisko i metoda

| Element | Wartość |
|---|---|
| Build | `next build --webpack` (Next 16.4.2) z drzewa roboczego, uruchomiony przez `next start -p 3101` (produkcja lokalna, nie Preview, nie Turso) |
| Baza | libSQL `file:` w katalogu tymczasowym poza repo, konto testowe `e2e@example.test` |
| Przeglądarka | Microsoft Edge (`channel: msedge`), Playwright |
| Urządzenie (symulacja) | viewport 360×640, DPR 2, CDP `Emulation.setCPUThrottlingRate` = 4 (telefon klasy średniej), sieć „Regular 4G”: latencja 150 ms, 1,6 Mb/s w dół, 750 kb/s w górę |
| Model sesji | plan 7 ćwiczeń × 4 serie, 3 pierwsze ćwiczenia z historią (`lastSessionSets`, `suggestedWeights`), sesja wstrzyknięta do `localStorage` (jak `e2e/active-workout.spec.ts`) |
| Powtórzenia | 5 przebiegów otwarcia ekranu; scenariusze interakcji pojedynczo, po jednym przebiegu (wyniki w `docs/wydajnosc/pomiary-004-przegladarka.json`) |
| Skrypty | `docs/wydajnosc/skrypty/004-active-workout-browser.mjs` (przeglądarka), `docs/wydajnosc/skrypty/004-session-model.bench.ts` (mikrobenchmark modeli, Vitest) |

Ograniczenia pomiaru: brak realnych urządzeń; symulacja CPU jest przybliżeniem; opóźnienie wejście→klatka to proxy INP (nie pełny INP z Event Timing); zapisy do chmury liczone na lokalnym libSQL; jeden użytkownik (brak testu współbieżności).

## 2. Wyniki pomiarów

### 2.1 Otwarcie ekranu serii (5 przebiegów, p50 / p95)

| Metryka | p50 | p95 | Próg (SLO K1 / ogólne) | Ocena |
|---|---|---|---|---|
| Czas do gotowości („Zapisz serię 1” widoczne, po ewentualnym wznowieniu) | 681 ms | 1 561 ms | TTI zimny < 2,5 s | spełnia |
| FCP | 324 ms | 348 ms | - | dobrze |
| LCP | 1 628 ms | 1 776 ms | < 2,5 s | spełnia (pozostaje 0,7 s zapasu) |
| CLS | 0 | 0 | < 0,1 | spełnia |
| Długie zadania (>50 ms) w czasie ładowania | 2 na przebieg | 3 | - | do profilowania (W-8) |
| Czas trwania długich zadań | 93 ms | 176 ms | - | uwaga, hydratacja |

Uwaga do odczytu: przebieg 1 był zimny w sensie pamięci podręcznej JS, kolejne ciepłe (cache przeglądarki w kontekście). Liczby p95 z 5 przebiegów są orientacyjne.

### 2.2 Wpisywanie ciężaru i reakcja na wejście (proxy INP)

Miara: od zdarzenia `input` do drugiej klatki po nim (dwa `requestAnimationFrame`), przy CPU x4.

| Scenariusz | Znaki | p50 | p95 | Próg proponowany | Ocena |
|---|---|---|---|---|---|
| Wpis ciężaru w nowej serii | 2 | 19,6 ms (run 3), 27,5 ms (run 2) | 19,6-27,5 ms | p95 ≤ 50 ms (przy CPU x4), INP < 200 ms | spełnia |
| Edycja zapisanej serii | 3 | 27,2 ms | 32,3 ms | jw. | spełnia |

Obie wartości mieszczą się w ok. dwóch klatkach. Nie wykazują regresji widocznej w interakcji; cały `ActiveWorkoutView` przerysowuje się przy każdej zmianie store (patrz W-4), co przy tym planie kosztuje ok. 1-2 klatek.

### 2.3 Przejścia i zapisy

| Czynność | Czas | Uwagi |
|---|---|---|
| Zapis serii 2 (klik „Zapisz serię 2” → widoczne „Zacznij serię 3”) | 249-368 ms | rzeczywisty czas przejścia na przerwę, bez przeładowania |

### 2.4 Zapisy do chmury (`/api/active-workout-session`, metody inne niż GET)

Liczby z przebiegów (run 3; w nawiasie zakres z trzech przebiegów; okno obserwacji 1,5-2 s po akcji).

| Scenariusz | Zapisy | Oczekiwanie | Wniosek |
|---|---|---|---|
| Bezczynność 9 s na ekranie serii (bez dotknięć) | 1 (1 przebieg) | 0 zapisów zdarzeniowych; okresowy co ~8 s | okresowy zapis działa jak opisano w W-2 |
| Przejście pigułką z serii 1 (z wstępnie wypełnioną sugestią) na serię 2 | 1 | brak zapisu przy samym wejściu na serię 2 (LR-3) | zapis dotyczy wyjścia z serii 1: `flushDraft` (W-3) |
| Wpis 2 znaków w nowej serii, pauza 1,5 s | 1-2 | 1 (debounce 700 ms) | zgodne z oczekiwaniem; drugi zapis to okresowy |
| Zapis serii („Zapisz serię 2”) | 2-3 | 1 natychmiastowy | dodatkowy zapis z debounce po zmianie store i/lub okresowy (nie rozdzielono źródła) |
| Edycja zapisanej serii, 3 znaki | 2-3 (run 1: 3) | do 3 natychmiastowych | zapisy koalescują się przy RTT 150 ms (`pushingRef`); patrz W-1 |

### 2.5 Mikrobenchmark modeli (Vitest, bez renderu, mediana / p95 w µs)

| Plan | Serie | `buildSessionProgress` | `buildSetSuggestionView` (1 ćw.) | `buildRestNextStep` | `JSON.stringify` payloadu | Rozmiar payloadu |
|---|---|---|---|---|---|---|
| 7×4 (typowy) | 28 | 3,0 / 10,9 | 32,0 / 67,3 | 29,3 / 50,4 | 24,9 / 31,0 | 5,7 kB |
| 12×5 | 60 | 3,8 / 4,7 | 24,8 / 30,5 | 26,0 / 32,0 | 50,0 / 59,6 | 11,4 kB |
| 20×6 (skrajny) | 120 | 7,0 / 8,8 | 24,6 / 28,7 | 26,1 / 36,0 | 94,6 / 111,7 | 22,0 kB |

Suma kosztu modeli przy zmianie store (progress + sugestia + Superset + ghost-reduce + serializacja, serializacja liczona raz lub dwa razy) przy 120 seriach: ok. 0,13-0,22 ms. Wynik: nie jest to wąskie gardło.

### 2.6 Rozmiar bundla (trasa `/start-workout`, klienckie chunki z client-reference-manifest)

| Element | Wartość |
|---|---|
| Chunki klienckie trasy | 35 plików |
| Rozmiar surowy | 1 089 538 B (ok. 1,04 MB) |
| Rozmiar gzip (zlib, poziom 9) | 353 703 B (ok. 345 kB) |
| Największy chunk | 345 040 B surowe / 102 768 B gzip (współdzielony) |
| Zmiana od 004 | nie zmierzona względem bazy (patrz sekcja 4); szacunek ze źródła |
| Nowe zależności npm | brak (`package.json` bez zmian względem `4a3df0a`) |

Szacunek przyrostu ze źródła (surowe pliki, bez komentarzy w minifikacji): komponenty `components/active-workout/` ok. 79 kB → ok. 88 kB (+~9 kB), nowe pliki `lib/` (set-suggestion-view, workout-session-progress, workout-set-draft, rest-next-step, use-scroll-edge-fade) ok. +20 kB, z czego część to logika już istniejąca przeniesiona. Po minifikacji i gzip realny przyrost oceniam na ok. 5-10 kB gzip (ok. 1,5-3% trasy). Nie blokuje.

### 2.7 Czas testów e2e (informacyjnie)

`e2e/active-workout.spec.ts`: 26 wpisów (1 worker), przebieg 326 s (5,4 min). W tym przebiegu 17 przeszło, 9 nie przeszło: wszystkie 9 na etapie logowania w `loginAndClearSession` (`waitForURL("/")` po 30 s, serwer zalogował `CredentialsSignin`). Przyczyny nie ustalono (brak limitera w logach; 17 przebiegów logowania przeszło na tym samym koncie). Szacunek czasu przy stabilnym logowaniu: ok. 3 s na wpis, czyli ok. 1-1,5 min na plik w CI. Nie jest to bramka. Zalecenie: jedno logowanie na plik (`storageState`) skróci czas o ok. połowę; sprawdzenie „CredentialsSignin” należy do testera (e2e).

## 3. Odpowiedzi na pytania zlecenia

1. **Re-rendery przy polu ciężaru.** Tak, każde naciśnięcie przelicza `buildSessionProgress` dla wszystkich ćwiczeń (memo zależy od `exercises`, które zmienia się przy każdym patchu, `guided-session-layout.tsx` l. 181-188). Koszt jest pomijalny: 3-7 µs dla 28-120 serii (sekcja 2.5). Nie ma potrzeby ograniczania do bieżącego ćwiczenia. Problem leży wyżej: `ActiveWorkoutView` czyta cały store (`useActiveWorkoutStore()`, `active-workout-view.tsx` l. 106, bez selektora, tak samo w 4a3df0a), więc każda zmiana przerysowuje cały widok i `GuidedSessionLayout` bez `memo` (W-4). Mierzone 20-28 ms do następnej klatki przy CPU x4.
2. **`use-scroll-edge-fade.ts`.** Listenery `scroll` i `resize` są dodawane w efekcie i usuwane w funkcji sprzątającej (l. 37-42), bez wycieku. Brak throttle i brak bail-out: `update` zawsze wywołuje `setEdge` z nowym obiektem (l. 26, 29), więc każde zdarzenie `scroll` (zwykle ok. 60/s podczas przewijania) wymusza render hosta (`SetPills`, `RestBreakScreen`). Koszt mały, ale zbędny (W-5). Brak layout thrashing: odczyty `scrollWidth`/`clientWidth`/`scrollTop` w handlerze są tanie, bo przewijanie nie unieważnia układu; w `set-pills.tsx` `getBoundingClientRect` wywołuje się tylko przy wyborze lub fokusie (1 wywołanie na interakcję, bez pętli). Przewijanie samo nie było mierzone (nie było w zakresie tego przebiegu).
3. **Sync do chmury (LR-3).** Wejście na serię nie wysyła zapisu (potwierdzone: w przebiegu bezczynności 0 zdarzeniowych zapisów, `render-phase` ustawia tylko stan lokalny, `guided-session-layout.tsx` l. 207-233). Względem stanu sprzed zadania częstotliwość nie rośnie, a maleje: w `4a3df0a` `flushDraft` wysyłał `onPatchSet` bezwarunkowo (l. 351-380) przy każdym przejściu i `onBlur`; obecny `flushDraft` (l. 242-251) wraca wcześniej, gdy wartości są równe stanowi serii. Jedyny nowy zapis to wyjście z serii z wstępnie wypełnioną, niepotwierdzoną sugestią (W-3). Pre-istniejące i nieusunięte: edycja zapisanej serii wysyła natychmiastowy zapis przy każdym znaku (W-1) oraz okresowy zapis co 8 s bez deduplikacji (W-2).
4. **Bundle.** Nie dodano pakietów npm. Zmierzony absolutny rozmiar trasy i szacunek przyrostu (sekcja 2.6). Pomiar względem bazy nie powiódł się technicznie (junction node_modules nie działa z webpackiem; kopia node_modules przerwana), stąd oznaczenie „szacunek”.
5. **Core Web Vitals / pierwszy render.** Zmierzone na buildzie produkcyjnym w warunkach symulowanych (sekcja 2.1): LCP p50 1,63 s, CLS 0, FCP 0,32 s, gotowość 0,68 s (p50). Spełnia K1 i K3 z analizy bazowej. Nie zmierzono na realnym telefonie.
6. **`set-pills.tsx`.** Brak pętli. `scrollPillIntoView` wywołuje się z `useEffect` przy zmianie `activeSetIndex` i z `onFocus` (1 raz na zdarzenie), czyta 2 prostokąty i co najwyżej raz wywołuje `scrollTo`. Przy 12 pigułkach koszt jest pomijalny. Zdarzenie `scroll` idzie przez hook (W-5).
7. **Czas e2e.** Sekcja 2.7. Informacyjnie, nie blokuje.

## 4. Ryzyka resztkowe i czego nie zmierzono

- Brak realnych urządzeń (Android WebView, starsze telefony). CPU x4 i „Regular 4G” to przybliżenie. Zalecany pomiar na jednym telefonie klasy średniej przed wydaniem (Preview).
- Brak bazowego buildu `4a3df0a`: nie porównano realnie bundla, liczby zapisów i opóźnień przed i po zadaniu. Oceny „nie gorzej” opierają się na analizie kodu (sekcja 3, pkt 3), nie na pomiarze.
- INP zmierzony proxy (dwie klatki po `input`), bez Event Timing ani pełnego INP.
- Przewijanie pigułek i kolumny nie było mierzone (koszt per zdarzenie `scroll` oceniony z kodu).
- Zapisy do chmury mierzone na lokalnym libSQL, bez opóźnienia Turso i bez limitów planu darmowego.
- Brak testów współbieżności i obciążenia (jeden użytkownik, jedna sesja).
- Przyczyna 9 niepowodzeń logowania w e2e nieustalona.
- Build produkcyjny zastąpił poprzedni katalog `.next` (ignorowany przez git; `next dev` musi zbudować go od nowa).

## 5. Ustalenia (wagi: blokujący SLO / średni / niski)

| ID | Scenariusz | Metryka i wynik | Próg | Przyczyna (dowód) | Rekomendacja | Dotkliwość | Właściciel |
|---|---|---|---|---|---|---|---|
| W-1 | Edycja zapisanej serii (ciężar), każdy znak | 2-3 zapisy na 3 znaki; payload 5,7 kB (7×4), 22 kB (20×6) | 1 zapis na pauzę ≥ 700 ms podczas edycji | `active-workout-view.tsx` l. 668: `requestActiveWorkoutCloudPush(nextPatch.done === true)`; `guided-session-layout.tsx` l. 407-419 wysyła `done: currentSet.done` przy każdym znaku. Pre-istniejące w `HEAD` (ten sam wzorzec w `4a3df0a`) | Przy edycji serii już zapisanej wysyłać zapis z debounce (`immediate` tylko przy przejściu `done` false→true i przy pominięciu) | średni | frontend |
| W-2 | Okresowy zapis podczas aktywnej sesji | 1 zapis w 9 s bezczynności, czyli ok. 450 zapisów/h, ok. 2,6 MB/h (5,7 kB) lub 9,9 MB/h (22 kB) | Zapis tylko przy zmianie payloadu | `active-workout-cloud-sync.tsx` l. 25 (`PUSH_INTERVAL_MS = 8000`), l. 308: `setInterval(() => void push())`; `push` (l. 240-270) nie porównuje payloadu z ostatnim wysłanym. Pre-istniejące | Deduplikacja po skrócie payloadu (ostatnio wysłany) przed `putCloud`; interwał tylko jako bezpiecznik | średni (budżet Turso/Upstash, łącze na siłowni) | frontend, architekt (budżet) |
| W-3 | Wyjście z serii z wstępnie wypełnioną sugestią | 1 zapis przy przejściu pigułką bez wpisywania | Zapis tylko po akcji użytkownika (D3, LR-3) | `guided-session-layout.tsx` l. 242-251 (`flushDraft` przy `selectSetIndex`, `goPrev`, `deferExercise`, menu); wartość z sugestii trafia do store (zgodnie z ADR D3 „przejście na inną serię”). Zakres L-1 z przeglądu | Decyzja analityka (L-1): zapisywać w `flushDraft` tylko pola zmienione względem wartości początkowej | niski (dokładność danych) | analityk, frontend |
| W-4 | Każda zmiana store (każdy znak, zapis, co 1 s w sesji) | input→klatka p50 20-28 ms, p95 ≤ 32 ms przy CPU x4 | p95 ≤ 50 ms (proponowany, do uzgodnienia z architektem) | `active-workout-view.tsx` l. 106: `useActiveWorkoutStore()` bez selektora (także w `4a3df0a`); `setNow` co 1 s (l. 496); `GuidedSessionLayout` bez `memo`. Mierzone | Selektory w widoku dla pól używanych w renderze; `memo` na prezentacyjnych podkomponentach; nie pilne | niski (obserwacja) | architekt, frontend |
| W-5 | Przewijanie pigułek i przerwa | `setEdge` z nowym obiektem przy każdym `scroll` (≈ 60/s), brak bail-out, brak throttle | Brak zbędnych renderów przy stałym stanie krawędzi | `hooks/use-scroll-edge-fade.ts` l. 26, 29 (`setEdge({...})`), l. 37 (listener `scroll` bez throttle). Listenery czyszczone poprawnie (l. 39-42), brak wycieku | Zwracać poprzedni obiekt, gdy `start`/`end` bez zmian; resize przez `requestAnimationFrame` | niski | frontend |
| W-6 | Model per zmiana store | 0,15 ms przy 120 seriach (suma modeli, sekcja 2.5) | - | `buildSessionProgress` przelicza wszystkie ćwiczenia (memo na `exercises`). Koszt zbyt mały, by zawężać | Brak działania; zapisane dla porządku | niski (informacyjnie) | - |
| W-7 | Bundle trasy | 1,09 MB surowe / 354 kB gzip (absolutnie); szacunek przyrostu +5-10 kB gzip | Brak progu w analizie bazowej (SLO dla bundla nieustalone) | Pliki sekcja 2.6; brak nowych pakietów | Ustalić budżet bundla dla trasy treningu (np. +10 kB gzip na zadanie) | niski | tester-wydajnosci, architekt |
| W-8 | Ładowanie ekranu treningu | 2 długie zadania (p50 93 ms, p95 176 ms) przy hydratacji | Brak > 50 ms w czasie interakcji; ładowanie nie ma progu | Nieprofilowane (hydratacja Next/React, możliwy wpływ `ActiveWorkoutCloudSync` i store persist) | Profil Performance przy CPU x4 w kolejnym pomiarze; nie blokuje | niski | tester-wydajnosci |
| W-9 | Testy e2e `active-workout.spec.ts` | 9 z 26 wpisów nie przeszło na logowaniu (`CredentialsSignin`, timeout 30 s); czas 5,4 min | Testy zielone; czas CI informacyjny | Przyczyna nieustalona; poza zakresem wydajności | Tester: zbadać logowanie w serii (limit, stan konta, timeouty); jedno logowanie na plik | niski (dla CI) | tester |

Blokujących SLO nie ma. Ocena wg progów: K1 (TTI 0,68 s p50, 1,56 s p95 przy zimnym przebiegu, < 2,5 s), LCP 1,63 s (< 2,5 s), CLS 0, INP proxy ≤ 32 ms (< 200 ms), zapisy do chmury: nie ma wzrostu względem stanu sprzed zadania, pozostają pre-istniejące W-1 i W-2 do obsługi w backlogu.

## 6. Backlog (dopisać do `docs/zespol/backlog.md`)

- W-1 (średni, frontend): debounce zapisu edycji zapisanej serii.
- W-2 (średni, frontend, architekt): deduplikacja okresowego zapisu, budżet zapisów Turso.
- W-3 (niski, analityk/frontend): decyzja L-1 przy wyjściu z serii z sugestią.
- W-4, W-5 (niski, architekt/frontend): selektory store i throttle/bail-out krawędzi.
- W-7, W-8 (niski, tester-wydajnosci): budżet bundla trasy, profil hydratacji przy CPU x4.
- W-9 (niski, tester): stabilność logowania w e2e.

## 7. Dane odtwarzalne

- Przeglądarka: `E2E_EMAIL=... E2E_PASSWORD=... PERF_BASE=http://localhost:3101 PERF_OUT=<plik.json> node docs/wydajnosc/skrypty/004-active-workout-browser.mjs` (wymaga działającego serwera, np. `next start -p 3101` po `next build --webpack`, z `TURSO_DATABASE_URL=file:<poza repo>`). Wyniki: `docs/wydajnosc/pomiary-004-przegladarka.json` (run 3).
- Mikrobenchmark: `npx vitest run --config docs/wydajnosc/skrypty/001-vitest.config.ts docs/wydajnosc/skrypty/004-session-model.bench.ts`.
- Bundle: `.next/server/app/(dashboard)/start-workout/page_client-reference-manifest.js` (liczenie chunków z manifestu; skrypt pomocniczy poza repo).
