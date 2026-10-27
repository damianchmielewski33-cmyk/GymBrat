# 009 - Redesign modułu Analiza postępów

- **Polecenie użytkownika**: Zbudować od nowa moduł "Analiza postępów" (zakładki Przegląd, Siła, Sylwetka, Tygodnie oraz szczegół ćwiczenia) na poziomie topowych aplikacji fitness-analytics: nowa architektura danych i wyliczeń, nowy flow przekazywania statystyk, nowy wygląd, czytelna hierarchia bez duplikatów. Na tym etapie BEZ ZMIAN W KODZIE: tylko analiza wymagań, plan i makiety. Dodatkowo weryfikacja poprawności mapowania i wyliczeń obecnych parametrów (zgłoszenie wątpliwości, bez naprawiania).
- **Ścieżka**: pełna, ograniczona do etapów analityczno-projektowych (etapy 1-4). Implementacja (5-10) po akceptacji użytkownika. Użytkownik wprost zastrzegł brak zmian w kodzie na tym etapie.
- **Gałąź / PR**: feat/koniec-treningu-flow (robocza, bez PR na tym etapie).
- **Status**: w toku (etap 1, 3 i 4 zakończone; akceptacja użytkownika przed etapem 5). Etap 3 (`architekt`) rozstrzygnął Q-U4 (W1, okno 180 dni) — patrz `docs/adr/0008-redesign-analizy-postepow.md`, sekcja 3.1: zostaje dla wskaźników krótkoterminowych, nowa kolumna `workouts.tonnage_kg` + zapytanie agregujące dla wartości "od zawsze".

## Dokumenty etapu 4 (ux)
- Specyfikacja: `docs/ux/009-redesign-analizy-postepow.md` (układ czterech zakładek i szczegółu ćwiczenia, komponenty, stany, progi, mikrokopia, dostępność).
- Makieta statyczna: `docs/ux/009-redesign-analizy-postepow-makieta.html` (Przegląd z danymi, Przegląd pierwsze użycie, Siła, Szczegół ćwiczenia; referencja dla `frontend`).
- Warunki przejścia do etapu 5: Q-U4 (W1, okno 180 dni) rozstrzygnięte przez `architekt`; Q-U7 (wynik 0-100 gotowości) zaakceptowany lub ukryty; progi z sekcji 11.1 zatwierdzone; mikrokopia z sekcji 11 zatwierdzona przez użytkownika.
- Uwagi niskiego ryzyka zapisane w `docs/bledy-do-naprawy/bledy.md` (sekcja „Analiza postępów 009”).

## Decyzja o bramkach (etap 1)
- `prawnik` - POMINIĘTY. Redesign prezentacji nad istniejącymi danymi nie wprowadza nowego przetwarzania danych osobowych/zdrowotnych (te same źródła i kategorie, bez nowych usług, retencji ani udostępniania). Ponowna ocena, jeśli pojawi się eksport/udostępnianie analizy, nowe metryki zdrowotne lub zdjęcia w nowych miejscach (analiza 009, sekcja 12, pytanie Q5).
- `architekt` - TAK (etap 3; przegląd po implementacji tylko wg wyjątku).
- `ux` - TAK (etap 4; redesign hierarchii i ekranów).
- `backend` / `frontend` - TAK (etap 5).
- `tester` - TAK (etap 7), pełny plan testów: złożona logika domenowa (okna czasowe, dzień lokalny, tożsamość ćwiczeń, poprawność liczb).
- `tester-bezpieczenstwa` - POMINIĘTY na etapie 1 (brak zmiany uwierzytelniania, uprawnień, danych wejściowych; wyjątek: nowy endpoint, eksport, cache lub udostępnianie zdjęć).
- `tester-wydajnosci` - TAK (etap 9): hub ładuje wiele agregatów (180 dni, 400 treningów, raporty, zdjęcia), zmienia się sposób ładowania zakładek.

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE (do akceptacji użytkownika) | 2026-10-26 | `docs/analiza/009-redesign-analizy-postepow.md` |
| 2 | Bramka wejściowa | prawnik | POMINIĘTA (uzasadnienie wyżej) | | |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE (do akceptacji użytkownika) | 2026-10-26 | `docs/adr/0008-redesign-analizy-postepow.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI (2026-10-26): warunki do etapu 5 w sekcji 17 specyfikacji | 2026-10-26 | `docs/ux/009-redesign-analizy-postepow.md`, makieta `docs/ux/009-redesign-analizy-postepow-makieta.html` |
| 5 | Implementacja | backend, frontend | pominięte w tym zadaniu (po akceptacji) | | |
| 6 | Przegląd kodu | architekt | pominięte (wyjątek - wg decyzji po etapie 5) | | |
| 7 | Testy funkcjonalne i spójność | tester | pominięte w tym zadaniu | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | pominięte w tym zadaniu | | |
| 9 | Wydajność | tester-wydajnosci | pominięte w tym zadaniu (wymagane przy implementacji) | | `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | POMINIĘTA (jw.) | | |

Bramka `tester-bezpieczenstwa` - pominięta na etapie 1 (decyzja jw.).

## Weryfikacja W1-W11 przez `architekt` (etap 3) — wynik w `docs/adr/0008-redesign-analizy-postepow.md`, sekcja 2
- W1: **POTWIERDZONE, defekt.** Rozwiązanie: nowa kolumna `workouts.tonnage_kg` + zapytanie agregujące SQL dla wartości "od zawsze" (ADR 0008, sekcja 3.1); okno 180 dni zostaje dla wskaźników krótkoterminowych.
- W2: **POTWIERDZONE.** Rozwiązanie: regresja liniowa (`lib/analytics/weight-trend.ts`), ADR 0008 sekcja 3.2.
- W3: **POTWIERDZONE.** Rozwiązanie: jedna funkcja `resolveProgressStart()` (`lib/progress-metrics/start.ts`), ADR 0008 sekcja 3.3.
- W4: **POTWIERDZONE — błąd w tekście, nie w kodzie.** Kod liczy poprawny wzór tonażu (Σ reps×kg po seriach); poprawka to zmiana Explainera, nie wzoru. ADR 0008 sekcja 3.4.
- W5: **POTWIERDZONE.** Rozwiązanie: rozszerzenie `fitnessGoalsSchema` o `waistGoalCm`/`tonnageGoalKg`/`streakWeeksGoal` (opcjonalne, bez migracji schematu, domyślne = dzisiejsze stałe). ADR 0008 sekcja 3.5.
- W6: **nie zweryfikowane w pełni — nieblokujące, zapisane w `docs/bledy-do-naprawy/bledy.md`.** Dotyczy warstwy agregacji posiłków poza zakresem query layer tego redesignu.
- W7: **POTWIERDZONE, martwy kod.** `components/progress-analysis/*` (5 plików) i `lib/progress-analysis.ts` do usunięcia w implementacji; szczegół ćwiczenia używa osobnej, żywej ścieżki (`lib/exercise-progress.ts`). ADR 0008 sekcja 4.
- W8, W10: **ODRZUCONE jako błąd liczenia — potwierdzone jako duplikat prezentacji**, nie duplikat silnika (`computeConsistencyScore`/`buildCoachInsights` wołane raz, czytane w dwóch miejscach UI). Rozwiązanie: kontrakt "jedna metryka, jeden właściciel" dla `frontend`/`ux`, ADR 0008 sekcja 3.6.
- W9, W11: **POTWIERDZONE**, wymagają neutralizacji języka (W9, `ux`) i jednoznacznych etykiet okresu (W11), bez zmiany logiki liczącej.

## Pytania do właściciela (nieblokujące, z założeniami w analizie 009, sekcja 11)
- Q1: cele "Następne cele" stałe w v1 czy konfigurowalne?
- Q2: jeden ekran z progresywnym ujawnianiem czy przełącznik prosty/zaawansowany?
- Q3: miejsce osiągnięć ("Zdobyte").
- Q4: akceptacja progów "za mało danych" (A3).
- Q5: czy eksport/udostępnianie analizy jest planowane (wtedy wraca `prawnik`).

## Weryfikacja
- [ ] Brak zmian w kodzie na etapie 1 (tylko dokumenty `docs/`).
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` - nie dotyczy etapu analitycznego (brak zmian kodu); uruchomić przed implementacją.
- [ ] `npm run deploy:check` - przed merge (etap implementacji).
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`) - przy PR implementacji.

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Weryfikacja W1 (okno 180 dni dla wartości "od startu"/licznika/tonażu/celu 50 t) przed redesignem | analityk | architekt + tester | wysoki |
| Weryfikacja W3 (dwie definicje wagi od startu) i W4 (wzór objętości w tekście vs obliczenie) | analityk | architekt + frontend | wysoki |
| Usunięcie martwego kodu `components/progress-analysis/*` i `lib/progress-analysis.ts` po potwierdzeniu | analityk | architekt | średni |
| Metoda tempa kg/tydz. (W2): endpoints vs regresja/średnia krocząca - decyzja metodologiczna | analityk | właściciel produktu + architekt | średni |
| Stałe cele w kodzie (W5) - decyzja Q1 | analityk | właściciel produktu | niski |
| Język pasm zmęczenia ("przeciążenie") i wiarygodność wyniku 0-100 | analityk | ux + właściciel produktu | średni |
