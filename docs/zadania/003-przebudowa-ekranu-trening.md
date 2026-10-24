# 003 - Przebudowa ekranu Trening

- **Polecenie użytkownika**: Zaproponować i zbudować poprawiony wygląd całego ekranu Trening (`/workout-plan`, `components/treningi/treningi-hub.tsx`), w tym ikony partii mięśni zamiast oznaczeń D1–D5.
- **Ścieżka**: pełna (zmiana układu i zakresu danych całego ekranu, nowe dane w hubie: ostatnie obciążenia, grupy mięśni dni planu)
- **Gałąź / PR**: feat/error-handling-system (w drzewie są niezatwierdzone zmiany innych zadań), PR do założenia
- **Status**: w toku

## Zatwierdzona propozycja (makieta z rozmowy)
1. Nagłówek: „Trening”, zakres tygodnia, chip serii tygodni („4 tyg. z rzędu”). Usunięty kicker „PLAN · 5 DNI · 4 TYG.” i cyfra bez jednostki.
2. Karta tygodnia: Siłownia `X / liczba dni planu`, Cardio `min · sesje`; pasek segmentów — po jednym na dzień planu (wykonany w tym tygodniu = wypełniony, następny = obrys).
3. Karta „Następny · Dzień N”: nazwa, `N ćwiczeń · ostatnio DD.MM (relatywnie)`, pierwsze 3 ćwiczenia z ostatnim obciążeniem (ciężar × powtórzenia) i „+ N kolejne”, duża sylwetka mięśni, przycisk „Rozpocznij trening”. Wariant „Niedokończony trening” i „Brak planu” zachowane.
4. Dni planu: jeden zwarty panel (wiersze z separatorami). Ikona-sylwetka z zaznaczonymi max 3 grupami mięśni (najwięcej ćwiczeń) zamiast „D1”; podpis „Dzień N · N ćw. · data”; ptaszek w rogu ikony = wykonany w tym tygodniu; następny = złota ramka + „Następny”. Tap wiersza = start; menu ⋮: Start, Dziennik obciążeń, Podgląd ćwiczeń. Nagłówek sekcji: PDF + Edytuj. Usunięta stopka „Tap = … Notes = …”, zielony chip „Wykonano”, zdublowana strzałka.
5. Narzędzia: siatka 2×2 zamiast sekcji 02–04: Dodaj cardio, Dziennik (historia), Technika, Rekordy (→ Analiza `/progress`; do decyzji, czy zostaje).
6. Sylwetka: przód / tył (tył gdy plecy lub pośladki bez klatki i brzucha); ramiona zaznaczone dla biceps lub triceps; brak rozpoznanych mięśni = ikona sztangi. Grupy z `lib/analytics/muscle-groups.ts`, mapowanie ćwiczeń przez `lib/resolve-exercise-muscles.ts`.
7. Poza zakresem: dolne menu (`components/layout/app-shell.tsx`) bez zmian.

## Decyzje użytkownika (2026-10-23, odpowiedzi na P-1..P-5 analityka)
- P-1 Rekordy: usunąć — Narzędzia = 3 kafelki (Dodaj cardio, Dziennik, Technika).
- P-2 Tie-break kolejki: ujednolicić z Home (remis = najniższy numer dnia).
- P-3 Biceps + triceps: liczone jako jedna grupa „Ramiona” przy limicie 3 zaznaczeń.
- P-4 Seria tygodni w poniedziałek: bez zmian (`streakWeeks` zostaje jak jest).
- P-5 Potwierdzenie „Porzuć”: tak.

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | `docs/analiza/003-przebudowa-ekranu-trening.md` — stały numer dnia (createdAt), wspólny tie-break kolejki z Home, „X / N” = wypełnione segmenty, ostatnie obciążenie = najcięższa seria ostatniej sesji planu, Android tylko WebView (brak zmian API) |
| 2 | Bramka wejściowa | prawnik | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | `docs/prawo/003-przebudowa-ekranu-trening-wejscie.md` — reguły LR-1..LR-8 (brak danych w logach/Sentry/analityce, filtr user_id, brak nowych pól i zmian API, dostępność ikon i segmentów, neutralna mikrokopia, licencja ikon, potwierdzenie „Porzuć”). Projekt roboczy — wymaga zatwierdzenia przez prawnika-człowieka |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | `docs/adr/0002-ekran-trening-dane-huba.md` — `dayNumber` w DTO, wspólny loader `lib/workout-plans-with-last-workout.ts` (Home 4→2 zapytania), `pickNextWorkoutPlan` dla Home i Treningu, mięśnie i ostatnie obciążenia liczone w RSC (`server-only`), bez zmian schematu/API/env. Uwagi: test regresji Home (zmiana wyboru dnia), seria pominięta z ciężarem 0, rozmiar bundla `formatKgPl` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | `docs/ux/003-przebudowa-ekranu-trening.md` + makieta `docs/ux/003-przebudowa-ekranu-trening-makieta.html`; jedyny nowy komponent `components/treningi/muscle-glyph.tsx`; tokeny `--gym-glyph-base`, `--gym-glyph-stroke`, `--gym-on-gold`. Koordynator: potwierdzenie „Zacząć nowy trening?” przy starcie innego dnia w trakcie niedokończonego — w zakresie (rozszerzenie P-5, ta sama utrata sesji) |
| 5 | Implementacja | backend, frontend | backend: ZATWIERDZONE Z UWAGAMI; frontend: ZATWIERDZONE Z UWAGAMI | 2026-10-24 | backend: loader `lib/workout-plans-with-last-workout.ts`, `lib/plan-day-muscles.ts`, `lib/plan-last-session-loads.ts`, `lib/treningi-hub-data.ts`, `pickNextWorkoutPlan`, `calendarWeekMondayKey`; vitest 66/66 (pełny 809/811 — 2 błędy w `lib/android-version.test.ts`, poza zadaniem), tsc 0, eslint czysto. Odstępstwa: usunięty nieosiągalny 3. tie-break, `withDbRetry` w loaderze, eksport `getNextWorkoutPlan`. Uwaga AC-3.7: nowe serie 0 kg są `skipped`, więc „× N powt.” tylko dla starych sesji. frontend: 11 komponentów w `components/treningi/` (+ `main-card-shell`, `muscle-glyph`), `lib/treningi-hub-format.ts`, tokeny w `globals.css`, `titleAs` w `SectionLabel`, changelog `planned: true`; martwy kod z D6 usunięty; testy 74/74, tsc czysto, eslint czysto (2 istniejące błędy w `cardio-log-sheet.tsx`). Odstępstwa przyjęte przez koordynatora: `ConfirmDialog` z kopią ux zamiast `WorkoutDiscardSessionDialog` (ten ma sztywną kopię „Zakończyć bez zapisu?”), `formatLastDoneWithRelative` w `treningi-hub-format.ts`, teksty dla czytnika w `sr-only`, `startingPlanId` zamiast `useTransition` |
| 6 | Przegląd kodu | architekt | ZATWIERDZONE Z UWAGAMI | 2026-10-24 | Zgodne z ADR 0002, granica server-only, LR-1, LR-2 OK; tsc 0, eslint czysto w plikach zadania, vitest 860/862 (2 poza zadaniem). Koordynator: uwagi 1 (`withDbRetry` w `getLastSessionLoadsForPlan`) i 3 (duplikaty `MONTHS_GENITIVE`/`parseDateKey`/`daysBetween`) poprawiane przed etapem 7, potem ponowny przegląd delty. Delta: ZATWIERDZONE Z UWAGAMI (2026-10-24) — uwagi 1 i 3 zamknięte, wynik dat w analytics identyczny dla poprawnych kluczy; vitest 882/884 (2 istniejące w `android-version.test.ts`) |
| 7 | Testy funkcjonalne i spójność | tester, ux | tester: ZATWIERDZONE Z UWAGAMI; ux: w toku | 2026-10-24 | `docs/testy/003-przebudowa-ekranu-trening.md` — mapa AC → dowód, +3 testy w `treningi-hub-data.test.ts`; tsc czysto, npm test 917/919 (2 znane `android-version`), lint 111 błędów w repo, 0 w plikach 003. Playwright niewykonany (brak `.env`/konta/seedu) → lista ręczna M-1..M-8 na Preview. T-1: AC-3.7 nieosiągalne dla nowych sesji (decyzja właściciela) |
| 8 | Przegląd wizualny | ux | | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | | | `docs/bezpieczenstwo/`, `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | | | `docs/prawo/` |

## Weryfikacja
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run deploy:check` (przed merge)
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Szkielet ładowania w kształcie ekranu Trening | ux | frontend | niski |
| Ogólny wskaźnik offline w aplikacji | ux | frontend | niski |
| Deklaracja dostępności i dane administratora — do uzupełnienia | prawnik | właściciel | niski |
| Indeks `workouts(user_id, workout_plan_id, date)` — osobne zadanie (zmiana schematu) | architekt | backend | niski |
| Pozostałe kopie `mondayOfWeek` w `cardio-hub`, `progress-hub`, `exercise-period-compare` | architekt | backend | niski |
| Wspólny helper różnicy dni i progu 14 dni (`formatLastDoneWithRelative` vs `formatPlanLastDoneRelative`); Home na jeden format po decyzji ux | architekt | frontend | niski |
| Ujednolicić `formatWeekRangeAria` z `formatPlCalendarRange` | architekt | frontend | niski |
| Jedna funkcja porzucenia sesji w `lib/` (hub nie czyści `useCommunityWorkoutStore`; zachowanie sprzed zmiany) | architekt | frontend | niski |
| Lokalna kopia `daysBetween` w `components/progress/photos-tab.tsx:23` → `daysBetweenDateKeys` | architekt | frontend | niski |
| T-2: sylwetka nie podświetla grup spoza widoku (klatka + plecy + barki → plecy niewidoczne) | tester | ux → frontend | niski |
| T-3: `aria-live` na podpisie wiersza (`plan-day-row.tsx:89`) dodawany razem ze zmianą treści | tester | frontend | niski |
| T-4: brak testów komponentów i e2e dla ekranu Trening | tester | tester/backend | niski |
| Lista ręczna M-1..M-8 do wykonania na Preview | tester | właściciel | średni |
| Sprawdzić, czy PostHog nie zbiera danych treningowych z ekranu Trening | prawnik | tester-bezpieczenstwa (etap 9) | średni |
