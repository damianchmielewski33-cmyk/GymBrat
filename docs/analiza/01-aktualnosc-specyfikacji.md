# Aktualność specyfikacji w `docs/` (decyzja D13)

Stan na 2026-10-23, gałąź `feat/error-handling-system`. Autor: analityk. Weryfikacja: istnienie ścieżek wskazanych w dokumentach (`sourceOfTruth`, komponenty, tabele, trasy) oraz wyrywkowe porównanie reguł z kodem. Zakres: `docs/*.json`, `docs/performance-intelligence-engine-v2.md`, `docs/community-*.md`. Pliki nie były edytowane. Powiązane: `docs/zespol/decyzje-wlasciciela.md` (D13), `docs/analiza/00-mapa-produktu.md`.

Ograniczenie: wartości liczbowe (progi, wagi, scoring) sprawdzono wyrywkowo, nie linia po linii. Werdykt "aktualny" oznacza zgodność struktury i ścieżek oraz brak wykrytych sprzeczności, a nie gwarancję każdej stałej.

## Podsumowanie

| Plik | Werdykt | Rekomendacja |
|---|---|---|
| `analytics-intelligence.json` | aktualny | źródło prawdy |
| `extra-cardio-from-macros.json` | częściowo (jedna sprzeczność z kodem: okno tygodnia) | źródło prawdy po rozstrzygnięciu D9 |
| `food-search-database.json` | aktualny | źródło prawdy |
| `live-set-coach-tips.json` | aktualny | źródło prawdy |
| `progress-screens.json` | aktualny | źródło prawdy dla UI Analizy |
| `progress-training-analysis.json` | częściowo | źródło prawdy dla formuł; sekcja zakładek historyczna |
| `workout-plan-creation.json` | aktualny | źródło prawdy |
| `performance-intelligence-engine-v2.md` | nieaktualny (to plan, zrealizowany inaczej) | traktować jako historyczny/projektowy |
| `community-notion.md` | częściowo | źródło prawdy dla modelu i reguł, z poprawkami z tabeli poniżej |
| `community-audit.md` | częściowo (raport z jednej daty) | historyczny |

Wniosek ogólny: właściciel zakładał "raczej nieaktualne" (D13). Dla siedmiu plików JSON jest odwrotnie: odwołania do plików i komponentów w większości się zgadzają, bo dokumenty powstały 2026-10-16 do 2026-10-23. Nieaktualne są dokumenty projektowe (PIE v2) i opisy, które wyprzedziły lub zostały wyprzedzone przez kod (społeczność).

## Szczegóły

### `analytics-intelligence.json` (2026-10-19, v1.0): aktualny
- Wszystkie pliki `lib/analytics/*` z `sourceOfTruth` istnieją (fatigue-score, recovery-score, muscle-volume, stagnation, consistency-score, adherence-score, prediction, strength-velocity, cardio-hr-zones, cardio-load, cardio-calories, cardio-performance, coach-insights, build-intelligence), a także `lib/cardio-utils.ts`, `lib/progress-hub.ts` (odwołuje się do `intelligence`) i test `analytics-engines.test.ts`.
- Komponenty UI (`readiness-card`, `strength-trend-card`, `muscle-balance-panel`, `week-tab`, `exercise-detail-view`) istnieją.
- Uwaga: `lib/analytics/` zawiera też moduły niezwiązane z tym kontraktem (`posthog.ts`, `track.ts`, `community-events.ts`); dokument ich nie opisuje, co jest poprawne.
- Rekomendacja: zostawić jako źródło prawdy.

### `extra-cardio-from-macros.json` (2026-10-23, v2.1): częściowo
- `lib/extra-cardio-from-macros.ts`, oba testy i `validateCardioMetrics` w `lib/cardio-utils.ts` istnieją.
- Rozbieżność: `dataWindow.week` = "pon-nd", a `lib/cardio.ts::getWeeklyCardioProgress` liczy kroczące 7 dni (`WEEK_MS`, `weekAgo`). Pozostałe miejsca (`lib/cardio-week-stats.ts`, Analiza, Tygodnie) używają tygodnia od poniedziałku. Decyzja D9 (pon-nd) czyni dokument docelowo zgodnym, a kod w `lib/cardio.ts` (i Java) rozbieżnym.
- Rekomendacja: zostawić jako źródło prawdy; po wdrożeniu D9 sprawdzić ponownie.

### `food-search-database.json` (2026-10-19, v1.0): aktualny
- Wszystkie moduły `lib/food-*` i `actions/food-lookup.ts` istnieją, a także komponenty `add-meal-screen`, `food-search-scan`, `food-portion-sheet`, `food-nutrition-details-panel`, `home-scan-button`.
- Wyrywkowa weryfikacja liczności: 49 wpisów `core` i 25 `retail` zgadza się z `countsSnapshot`. Liczności mogą rosnąć, więc traktować jako migawkę z daty.
- Rekomendacja: zostawić jako źródło prawdy.

### `live-set-coach-tips.json` (2026-10-16, v3.0): aktualny
- Istnieją: `lib/live-set-coach.ts`, `set-effort.ts`, `exercise-movement-kind.ts`, `set-progression-suggestion.ts`, `last-workout-hints.ts`, cały `lib/live-coach/*` (readiness, confidence, e1rm-trend, fatigue, rest-awareness, movement-profiles, suspicious-data, progression-bumps, personal-records, hr-signals), `live-coach-banner.tsx`, `rest-break-screen.tsx` i testy.
- Rekomendacja: zostawić jako źródło prawdy.

### `progress-screens.json` (2026-10-23, v2.0): aktualny
- Cztery zakładki (Przegląd, Siła, Sylwetka, Tygodnie), alias `zdjecia -> sylwetka` i `/progress-analysis` są zgodne z `lib/progress-tabs.ts`. Wszystkie komponenty z `sourceOfTruthUi` istnieją (w tym `progress-hub-view`, `photos-tab`, `weight-average-chart`).
- Rekomendacja: zostawić jako źródło prawdy dla UI Analizy.

### `progress-training-analysis.json` (2026-10-19, v1.1): częściowo
- Formuły, kwalifikowalność serii i okna danych: pliki istnieją (`progress-hub`, `intensity-analysis`, `diet-training-weeks`, `workout-history`, `workout-session-calculations`, `workout-cardio-attribution`, `workout-skipped-sets`, `exercise-identity`, `achievements`, `progress-tabs`, `cardio-utils`).
- Rozbieżność: sekcja `tabs` opisuje 4 zakładki "Siła, Sylwetka, Zdjęcia, Tydzień" (bez Przeglądu, ze Zdjęciami jako osobną zakładką). Kod ma Przegląd, Siła, Sylwetka, Tygodnie; Zdjęcia włączono do Sylwetki. `progress-screens.json` (nowszy, 2026-10-23) już to opisuje.
- Rekomendacja: źródło prawdy dla formuł i eligibility; dla układu ekranów obowiązuje `progress-screens.json`.

### `workout-plan-creation.json` (2026-10-22, v1.0): aktualny
- Istnieją: `workout-plan-editor.tsx`, `workout-plan-word-import.tsx`, `actions/workout-plan.ts`, `actions/ai-workout-plan.ts`, `actions/backend.ts`, `lib/ai-training-plan-to-payload.ts`, `lib/workout-plan-types.ts`, `lib/workout-plan-utils.ts`, `lib/workout-exercise-catalog.ts`, parsery pdf/docx/excel, `lib/workout-plan-file-kind.ts`, trasy `profile/workout-plan` i `workout-plan`.
- `ai/coach.ts`: `generateTrainingPlan` zwraca wyłącznie `makeHeuristicPlan` (zgodnie z dokumentem: brak LLM, jeden szablon Full Body, `experienceLevel` ignorowany; tabela sloty i ćwiczenia zgadza się z kodem).
- Rekomendacja: zostawić jako źródło prawdy.

### `performance-intelligence-engine-v2.md` (2026-10-14): nieaktualny
- To dokument projektowy "architektura (zapowiedź)". W kodzie nie ma: `lib/pie-v2/`, tabel `pie_*` w `db/schema.ts`, endpointów `/api/pie/*` (wyszukiwanie `pie_`, `pie-v2`, `api/pie` poza `docs/` nie zwróciło wyników).
- Zrealizowano inaczej i mniej: silniki derive-on-read w `lib/analytics/*` (bez tabel faktów, bez ACWR, Athlete Score, Photo AI, Goal Success Probability, kontraktu 3+3+3). Opisuje to `analytics-intelligence.json` (sam wskazuje PIE jako dokument powiązany).
- Elementy sprzeczne z decyzjami: Photo AI (analiza zdjęć) koliduje z D20 (analiza zdjęć nieużywana, `analyzeBodyPhoto` zwraca stub); opcjonalny LLM (`PIE_LLM=1`) koliduje z założeniem produktu "bez LLM". Zapisywanie wyników analizy zdjęć to dane wrażliwe (wskazać `prawnik`, jeśli kiedykolwiek wróci).
- Rekomendacja: traktować jako historyczny/koncepcyjny. Nie używać jako źródła prawdy ani backlogu bez nowej analizy wymagań.

### `community-notion.md` (v. z 2026-10, "dokument wygenerowany z kodu"): częściowo
Co działa: model tabel i ról (`team-types.ts`, `team-permissions.ts`), FCS (`fcs.ts`, `fcs-compute.ts`, tabela `team_fcs_scores`, domyślne `ranking_metric = fcs`), SSE, trasy `app/api/community/*`.

Rozbieżności:
| Miejsce w dokumencie | Stan w kodzie |
|---|---|
| Nagłówek: migracje `0012`-`0020` | migracje społeczności sięgają `0029` (m.in. `0021_friendships`, `0022_team_fcs`, `0023_user_reputation`, `0024_hall_of_fame`, `0025_team_quests`, `0026_team_wars`, `0027_progression`, `0028_social`); w `db/migrations` brak `0017` i `0018` w wyniku wyszukiwania (do sprawdzenia, czy to luka w numeracji) |
| Roadmapa §15: "Reputation tiers", "Ghost Training", "HoF seasons UI" jako plan/stub | §7.3 tego samego dokumentu i kod mówią "live" (tabele `user_reputation*`, `lib/community/reputation.ts`, `hof*.ts`, `api/ghost-training`); dokument jest wewnętrznie sprzeczny |
| §3 API: lista bez znajomych, HoF, quests, wars, discover, follow | trasy `api/community/friends/*`, `app/(dashboard)/community/{hall-of-fame,wars,discover,global,u/[userId],friends}` istnieją |
| §13 mapa ekranów: bez hall-of-fame, wars, quests, discover, global, friends, `u/[userId]` | strony istnieją |
| §9.4: presence IDOR "na roadmapie" | `community-audit.md` mówi, że naprawiono (2026-10-17) |
| §14: zaufanie do metryk klienta (MEDIUM) | nadal otwarte według audytu |

Dodatkowo (prywatność, do `prawnik`): D19 (zdjęcia sylwetki i czat tylko dla właściciela) nie jest opisane w żadnym z tych dokumentów, a `community-notion.md` zakłada media postów w data URL i podgląd treningu znajomych; zgodność z D19 trzeba osobno sprawdzić.

Rekomendacja: zostawić jako źródło prawdy dla modelu danych, ról i FCS po naniesieniu poprawek z tabeli (do zrobienia przez właściciela dokumentu, bo pliki zostają bez zmian). Do czasu poprawek priorytet ma kod.

### `community-audit.md` (2026-10-17): częściowo, historyczny
- Raport z jednej rundy audytu UI/a11y/security, z checklistą "pozostałe" (kontrast WCAG, test E2E IDOR, zaufanie do metryk klienta, Redis fanout). Nie weryfikowano wykonania poszczególnych poprawek UI; stan checklisty nie jest aktualizowany.
- Rekomendacja: traktować jako historyczny. Otwarte pozycje checklisty przenieść do backlogu `tester-bezpieczenstwa`/`ux`.

## Dokumenty poza zakresem

`docs/vps-docker-production.md` nie był w zakresie D13 (dotyczy D1: docelowy VPS). Warto go zweryfikować przy decyzji o hostingu.

## Pytania otwarte po tej weryfikacji
1. Luka migracji `0017`/`0018`: celowa czy brak plików? (sprawdzić w `db/migrations/meta`).
2. Czy `performance-intelligence-engine-v2.md` ma pozostać w repozytorium jako historia, czy po decyzji właściciela przenieść do archiwum (istniejące dokumenty zostają bez zmian, więc tylko decyzja informacyjna).
