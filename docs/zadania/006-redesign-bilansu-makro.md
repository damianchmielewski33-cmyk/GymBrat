# 006 - Bilans makro „MAKRO DZIŚ” (Statystyki bilansu): audyt i redesign

- **Polecenie użytkownika**: Dla ekranu „Statystyki bilansu” (MAKRO DZIŚ, zakładka Dieta/Analiza): (1) analiza techniczna i wizualna, (2) propozycja nowego wyglądu, (3) zmiany architektoniczne i techniczne, (4) sprawdzenie poprawności przekazywania i wyliczeń wszystkich elementów, (5) nowa architektura i makieta. Na tym etapie BEZ implementacji - deliverable to analiza, ocena, propozycja architektury i makieta.
- **Ścieżka**: pełna (zmiana UI i wyliczeń, wymaga decyzji architektonicznej o jednym źródle sum; etap bez kodu produkcyjnego - bramki implementacyjne pominięte, patrz niżej)
- **Gałąź / PR**: brak na tym etapie. Implementacja po decyzji właściciela: nowa gałąź od `main` (nie `feat/koniec-treningu-flow`, która ma niezcommitowane zmiany zadania 005). PR: (do utworzenia)
- **Status**: w toku (etap 5 wdrożony 2026-10-28 wg ADR 0005 i `docs/ux/006-…`; Q-O1..Q-O3 przyjęte domyślnie z ADR; pozostają testy etapu 6)

## Decyzja o bramkach (etap 1, analityk)

- **prawnik - pominięty**: redesign prezentuje istniejące dane (spożycie z `meal_logs`, cele z profilu) bez nowych celów przetwarzania, zgód i treści prawnych. Wróci, jeśli zakres doda trendy długoterminowe danych zdrowotnych, udostępnianie innym użytkownikom, eksport lub nowe zgody.
- **architekt - wymagany** (etap 3): audyt AU-1..AU-16, jedno źródło wyliczeń (duplikacja `buildPeriodMacroBalance` vs `buildWeeklyNutritionRollup`), model widoku, strefa „dziś”.
- **ux - wymagany** (etap 4): kierunek wyglądu i makieta, specyfikacja stanów (brak wpisów, brak celu, niepełne dane, dzień w toku, brak połączenia).
- **backend, frontend - pominięte na tym etapie**: brak implementacji. Wejdą po decyzji właściciela i zatwierdzeniu ADR/makiety.
- **Przegląd architekta po implementacji - pominięty na tym etapie** (wraca przy implementacji).
- **tester - pominięty na tym etapie** (brak zmiany kodu). Wymagany przy implementacji, pełny plan testów dla wyliczeń (granice dni, zaokrąglenia, dzień niepełny, brak celu).
- **tester-bezpieczenstwa - pominięty**: brak zmian auth, uprawnień, wejść, sekretów i nowej powierzchni ataku. Wróci przy nowym endpointcie lub parametrze zakresu dat z wejścia użytkownika.
- **tester-wydajnosci - pominięty na tym etapie**: wróci, jeśli nawigacja tygodni lub widok dłuższego okresu doda zapytania lub większe listy.

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE Z UWAGAMI (pytania Q-O1..Q-O5 do właściciela; domyślne założenia BR-1..BR-11) | 2026-10-25 | `docs/analiza/006-redesign-bilansu-makro.md` |
| 2 | Bramka wejściowa | prawnik | POMINIĘTA (brak wpływu prawnego, sekcja powyżej) | | |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE Z UWAGAMI (audyt AU-1..AU-16 zamknięty: 3 potwierdzone błędy do naprawy — AU-1, AU-2/AU-3, AU-4; 1 ryzyko świadomie odłożone — AU-8; reszta bez błędu lub poza zakresem) | 2026-10-25 | `docs/adr/0005-redesign-bilansu-makro.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI (warunki: Q-O1..Q-O3 zatwierdzone przez właściciela; odpowiedź architekta na BR-5 i AU-1; model widoku zgodny z sekcją 9 specyfikacji) | 2026-10-25 | `docs/ux/006-redesign-bilansu-makro.md`, makieta `docs/ux/006-redesign-bilansu-makro-makieta.html` |
| 5 | Implementacja | backend, frontend | ZATWIERDZONE Z UWAGAMI (ViewModel RSC, rollupMacroWindow, redesign UI wg makiety; AU-11 bez migracji) | 2026-10-28 | kod: `lib/nutrition-*`, `components/nutrition/*` |
| 6 | Przegląd kodu | architekt | POMINIĘTA na tym etapie | | |
| 7 | Testy funkcjonalne i spójność | tester, ux | POMINIĘTA na tym etapie | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | POMINIĘTA na tym etapie | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | POMINIĘTE (warunki wejścia opisane powyżej) | | |
| 10 | Bramka wyjściowa | prawnik | POMINIĘTA | | |

## Werdykt etapu 3 (architekt, 2026-10-25): ZATWIERDZONE Z UWAGAMI

Pełny audyt i decyzje: `docs/adr/0005-redesign-bilansu-makro.md`. Skrót:
- **Potwierdzone błędy do naprawy**: AU-1 (dwie niespójne definicje „tygodnia” — `buildWeeklyNutritionRollup` liczy cały tydzień pon.–niedz. łącznie z dniami przyszłymi, `buildPeriodMacroBalance` tylko pn→dziś; ujednolicone pod wspólną funkcję `rollupMacroWindow` w `lib/nutrition-week-stats.ts` z jawnym parametrem zakresu — to **dwie celowo różne metryki**, nie jeden błąd do scalenia w jedną liczbę, wbrew US-1 z analizy), AU-2/AU-3 (dzień dzisiejszy oceniany jak zamknięty — nowy stan `DayEvaluationState`), AU-4 (dzień bez wpisów generuje fałszywe „brakuje 100%” — `collectDayHighlights` ma lukę, którą `hasFood` dziś nie blokuje).
- **Ryzyko odłożone świadomie**: AU-8 (historia celów nie jest zamrożona — brak snapshotu). Decyzja: adnotacja w UI zamiast nowej tabeli na ten etap; osobny ADR, jeśli się potwierdzi jako problem w praktyce.
- **Brak błędu, potwierdzone jako poprawne**: AU-5, AU-6, AU-7 (strefa „dziś” już spójna serwer→klient przez `calendarDateKey`+`CALENDAR_TIMEZONE`), AU-9, AU-10 (nazwa `applyProfileGoalsAndManualConsumption` myląca, ale brak dublowania), AU-13.
- **Poza zakresem tej ścieżki, wymaga potwierdzenia `backend` przy implementacji**: AU-11 (czy zapis posiłku zeruje brakujące makro — nie widać w ścieżce odczytu).
- **Model widoku**: liczenie przeniesione z `useMemo` klienta do RSC (`app/(dashboard)/nutrition/today/page.tsx`) — wariant A; nowy DTO `MacroBalanceViewModel`/`DayCardViewModel` z `DayEvaluationState` jako typ wyliczony zamiast flag `isToday`/`hasFood`.
- **Brak zmiany kontraktu** Android/Java (AU-16 — brak odpowiednika do utrzymania), brak nowych zapytań, brak nowej zmiennej środowiskowej.
- **Blast radius ograniczony**: zmiana logiki sum zostaje wewnątrz dwóch funkcji (`buildPeriodMacroBalance`, `buildWeeklyNutritionRollup`), publiczne kształty (`PeriodMacroBalance`, `NutritionWeekRollup`) bez zmian — 19 plików zależnych od `lib/nutrition-week-stats.ts`/`lib/nutrition-goals.ts` nie wymaga modyfikacji.

Uwagi niskiego ryzyka do backlogu (patrz tabela niżej, zaktualizowana).

Odpowiedź na warunek nr 2 z werdyktu etapu 4 (`ux`): rozstrzygnięte powyżej — BR-5 przyjęte jako „cel dziś wchodzi do sumy pn→dziś tylko gdy jest dzisiejsze spożycie” (`includeInProgressGoal: "only_if_consumed"`), AU-1 rozstrzygnięte jako świadomie dwie różne metryki pod wspólną implementacją, nie jedna wartość — `ux` powinien odpowiednio zróżnicować etykiety „Bilans tygodnia pon.–niedz.” (Start) i „Suma pn→dziś” (Bilans), nie sugerować identycznej liczby.

## Werdykt etapu 4 (ux, 2026-10-25): ZATWIERDZONE Z UWAGAMI

Uzasadnienie: specyfikacja i makieta adresują problemy z analizy: jedno miejsce dla dziś (hero) i jedna karta na dzień (duplikacja usunięta), „dzień w toku” bez oceny „brakuje” (BR-3), odcinek „dziś w toku” w sumie tygodnia (AU-2), semantyka odchyleń bez czerwieni i z tekstem (AU-14), filtr z licznikiem zgodnym z listą (BR-11), stany specjalne (pusty start, brak wpisów, brak celu, niepełne dane, offline, błąd, ładowanie). Warunki przed implementacją (bez nich nie wchodzimy w kod):
1. Q-O1..Q-O3 zatwierdzone przez właściciela albo przyjęte rekomendacje z sekcji 10.1 specyfikacji.
2. Odpowiedź architekta na BR-5 (dziś w sumie tygodnia: cel pełnego dnia czy pro-rata) i AU-1 (jedna definicja sumy; test porównawczy z arkuszem Start).
3. Model widoku zgodny z sekcją 9 specyfikacji; statusy i „dziś” z jednego źródła (BR-9).

Nowe klocki do katalogu po implementacji: `MacroTodayTile`, `MacroMeter`, `WeekTrendBars`, `DayBalanceCard` (przebudowa `DayCard`), `DayStatusChip`, `MacroFilterChips`, `DayTypeChip`; rozszerzenie `Meter` (`progress-ui`) o `overflow` i `segments`.

Uwagi do backlogu (niski priorytet, właściciel: ux): sortowanie odchyleń po wadze (BR-10) jako ewentualna zmiana; wariant `md` z siatką kart dni; zakres „Tydzień →” (Q-O4, MVP: bieżący i poprzedni tydzień).

## Weryfikacja (dla etapu implementacji, jeszcze niewykonana)
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run deploy:check` (przed merge)
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true` na PR, po Promote bez `planned`)
- [ ] Aktualizacja `docs/zespol/wiedza-o-projekcie.md`, jeśli zmieni się opisany stan wyliczeń dietetycznych

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet | Stan po etapie 3 |
|---|---|---|---|---|
| Dwie ścieżki sum tygodniowych (Bilans vs arkusz Start) - AU-1 | analityk | architekt | Wysoki | Rozstrzygnięte w ADR 0005 p.2: wspólna funkcja `rollupMacroWindow`, dwie celowo różne metryki (zakres pełny tydzień vs pn→dziś) zamiast jednej sumy — `ux` musi zróżnicować etykiety |
| Suma PN→DZIŚ zawiera cel pełnego dnia przy częściowym spożyciu - AU-2 | analityk | architekt / analityk (BR-5) | Wysoki | Rozstrzygnięte w ADR 0005 p.2: `includeInProgressGoal: "only_if_consumed"` |
| Ocena „brakuje” w trakcie dnia - AU-3 | analityk | ux / analityk (BR-3) | Wysoki | Rozstrzygnięte w ADR 0005 p.3: `DayEvaluationState.in_progress`; zaadresowane też w specyfikacji ux (etap 4) |
| Dni bez wpisów generują odchylenia? - AU-4 | analityk | architekt | Wysoki | Potwierdzony realny błąd (luka w `collectDayHighlights`), naprawa w ADR 0005 p.2-3 (wymaga pola `entryCount`) |
| Źródło „dziś” po stronie klienta vs serwera - AU-7 | analityk | architekt | Wysoki | Zamknięte — brak błędu, `todayKey` już liczony raz w RSC i spójny ze strefą `CALENDAR_TIMEZONE` (ADR 0005 p.0) |
| Możliwe podwójne liczenie wpisów ręcznych i `meal_logs` - AU-10 | analityk | architekt | Wysoki (do weryfikacji) | Zamknięte — brak błędu; tylko myląca nazwa funkcji (porządkowe, niski priorytet) |
| Produkt bez wartości makro liczony jako 0 - AU-11 | analityk | architekt | Wysoki | Poza zakresem ścieżki odczytu; wymaga potwierdzenia `backend` (ścieżka zapisu posiłku) przed decyzją o kolumnie `isIncomplete` |
| Dzielenie przez zero / brak celu - AU-5 | analityk | architekt | Średni | Zamknięte — brak błędu, guard już poprawny w `buildMacroBalance` |
| Zaokrąglenia wartości i % - AU-6 | analityk | architekt | Średni | Zamknięte — brak realnego ryzyka (dowód matematyczny w ADR 0005 p.0) |
| Wybór celu historycznego wg typu dnia - AU-8 | analityk | architekt / właściciel (Q-O2) | Średni | Potwierdzone ryzyko, świadomie odłożone (ADR 0005 p.4): adnotacja UI zamiast snapshotu na ten etap |
| Spójność celów kcal z makro - AU-9 | analityk | architekt | Średni | Zamknięte — brak błędu, wymuszone konstrukcyjnie (`kcalFromMacros`) |
| Semantyka odchyleń (kcal vs białko vs węglowodany) - AU-14 | analityk | właściciel (Q-O3) / ux | Średni | Założenie domyślne architekta: nadwyżka węglowodanów w dniu treningowym = informacja neutralna (ADR 0005 p.1); do zatwierdzenia przez właściciela |
| Dostępność statusów (nie tylko kolor) - AU-15 | analityk | ux | Średni | Potwierdzone, zadanie czysto prezentacyjne — model danych już niesie `status`; do wdrożenia przez `frontend`/`ux` |
| Parytet z Android i Java - AU-16 | analityk | architekt | Średni (do weryfikacji) | Zamknięte — brak odpowiednika w `java-backend/`, brak `/api/android/*` dla tego ekranu |
| Sortowanie listy odchyleń i licznik badge - AU-12, AU-13 | analityk | ux / tester | Niski | AU-13 zamknięte (liczniki spójne z definicji); AU-12 pozostaje decyzją `ux` |
