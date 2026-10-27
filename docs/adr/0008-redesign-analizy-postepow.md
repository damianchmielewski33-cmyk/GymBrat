# ADR 0008 — Redesign modułu „Analiza postępów” (architektura, bez implementacji)

- **Karta zadania**: `docs/zadania/009-redesign-analizy-postepow.md`
- **Etap**: 3 — Projekt techniczny (`architekt`). Zero zmian w kodzie produkcyjnym.
- **Wejście**: `docs/analiza/009-redesign-analizy-postepow.md` (etap 1, ZATWIERDZONE do akceptacji użytkownika; sekcje 10/11/12 — W1–W11, Q1–Q5, decyzja o bramkach).
- **Autor**: architekt (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `ux` (etap 4) i dla przyszłego zadania implementacyjnego (etap 5)

---

## 1. Kontekst

Moduł „Analiza postępów” (`/progress`) ma dziś jedną funkcję wejściową `getProgressHubData(userId)` w `lib/progress-hub.ts` (1552 linie), która w jednym wywołaniu ładuje i liczy **wszystko**: siłę, sylwetkę, zdjęcia, tydzień, dietę-vs-trening i „Analitykę 11/10” (`lib/analytics/*`), niezależnie od tego, którą zakładkę użytkownik właśnie widzi. Przełączanie zakładek (`components/progress/progress-hub-view.tsx`) jest czysto klienckie (`useState` + `history.replaceState`, bez nawigacji Next) — świadoma decyzja z przeszłości, żeby uniknąć „migania” UI na telefonie przy soft-nav. To dobra intencja, ale dzisiejsza realizacja płaci za nią pełnym, kosztownym ładowaniem przy *każdym* wejściu na `/progress`, również gdy użytkownik zobaczy tylko Przegląd.

Silniki wskaźników w `lib/analytics/*` (fatigue, recovery, consistency, adherence, muscle-volume, stagnation, prediction, strength-velocity, cardio-*, coach-insights) są już **dobrze zaprojektowane**: jedna funkcja = jedna odpowiedzialność, jeden plik, pokryte testami (`analytics-engines.test.ts`, `strength-velocity.test.ts`, `strength-movers.test.ts`). Zweryfikowałem to w kodzie: `computeConsistencyScore` i `computeAdherenceScore` są wywoływane **raz** w `build-intelligence.ts` i ich wynik (`intelligence.consistency`, `intelligence.adherence`) jest tylko **odczytywany** w dwóch miejscach UI (`overview-tab.tsx:63`, `week-tab.tsx:241-263`). Innymi słowy: **D1 i W10 z analizy nie są duplikatem liczenia — są duplikatem prezentacji tej samej, poprawnie policzonej liczby.** To ważne rozróżnienie dla zakresu tego ADR: `lib/analytics/` nie wymaga przebudowy; wymaga jej orkiestrator (`lib/progress-hub.ts`) i sposób ładowania/prezentacji w UI.

Prawdziwy bałagan architektoniczny leży w trzech miejscach:
1. **`lib/progress-hub.ts`** — plik-bóg: surowe zapytania SQL, parsowanie JSON sesji, liczenie tonażu/intensywności *ponownie* (nie przez `lib/analytics/`), okno 180 dni użyte jednocześnie do danych „ostatnich” i „od początku”, trzy stałe cele zaszyte w kodzie, dwie niezależne definicje „startu”.
2. **Brak podziału ładowania wg zakładki** — jeden ciężki `await` przed renderem czegokolwiek.
3. **Martwy kod** `components/progress-analysis/*` + `lib/progress-analysis.ts` — osobna, nieużywana ścieżka z tych samych czasów co dzisiejszy hub.

Przeczytany kod źródłowy potwierdzający ustalenia: `lib/progress-hub.ts` (cały), `app/(dashboard)/progress/page.tsx`, `components/progress/progress-page-content.tsx`, `components/progress/progress-hub-view.tsx`, `components/progress/progress-tabs.tsx`, `components/progress/strength-tab.tsx` (wyjaśnienie tonażu), `app/(dashboard)/progress/exercises/[key]/page.tsx`, `app/(dashboard)/progress-analysis/page.tsx`, `lib/analytics/index.ts`, `lib/analytics/build-intelligence.ts`, `lib/analytics/consistency-score.ts`, `lib/fitness-goals.ts`, `lib/diet-training-weeks.ts` (częściowo — sekcja 2.6), oraz wyszukiwania importów (`Grep`) dla `components/progress-analysis`, `lib/progress-analysis.ts`, `lib/exercise-progress.ts`.

---

## 2. Weryfikacja wątpliwości W1–W11 (potwierdzenie/odrzucenie z kodu)

| # | Werdykt | Dowód | Decyzja (sekcja 3) |
|---|---|---|---|
| **W1** | **POTWIERDZONE — defekt.** Okno `from180 = addCalendarDays(today, -180)`, `limit(400)` (`progress-hub.ts:332,367`) zasila jednocześnie: `strength.sinceDate`/`workoutCount` (nagłówek), `totalTonnageKg` (cel „50 t”), `firstWorkoutDate` (osiągnięcia), `streakWeeks` (ograniczone do 12 tyg., co jest OK, bo to z definicji wskaźnik krótkoterminowy). Dla użytkownika trenującego >180 dni nagłówek i tonaż są **zaniżone i resetują się** w miarę starzenia okna. Narusza BR-5. | `lib/progress-hub.ts:332,367,646-648,1497-1498` | 3.1 |
| **W2** | **POTWIERDZONE.** `kgPerWeekLast6` = `(ostatni − pierwszy) / dni_między_nimi × 7` na oknie 42 dni (`progress-hub.ts:1057-1072`) — różnica dwóch punktów, nie regresja/średnia. Jeden skok wagi (np. po posiłku z dużą ilością sodu) zniekształca wynik. | `lib/progress-hub.ts:1057-1072` | 3.2 |
| **W3** | **POTWIERDZONE.** Dwie niezależne ścieżki: (a) `startKg = weights[0]?.kg` — pierwszy punkt scalonej serii raportów+logów (`progress-hub.ts:1034`), używany w Przeglądzie i w `tempo`; (b) `weightDeltaKg` w sekcji zdjęć bierze wagę z `startPhoto` (zdjęcie z galerii *albo* pierwszy raport ze zdjęciem), z fallbackiem do (a) tylko gdy `startPhoto` nie ma wagi (`progress-hub.ts:1168-1173`). Te dwie wartości **mogą się różnić**, gdy pierwsze zdjęcie nie pokrywa się z pierwszym wpisem wagi. Narusza BR-4. | `lib/progress-hub.ts:1034,1157-1173` | 3.3 |
| **W4** | **POTWIERDZONE — błąd w tekście, nie w kodzie.** `strength-tab.tsx:381`: „Objętość = powtórzenia × kg × serie”. Kod (`volumeFromExercises`, `progress-hub.ts:267-284`, oraz analogiczne `dayVolKg` w pętli `710-876`) liczy `Σ(reps × kg)` po wszystkich seriach — **to jest standardowy, poprawny wzór tonażu** (każda seria już wnosi swój `reps×kg`; dodatkowe „× serie” podwójnie liczyłoby liczbę serii). Naprawa to zmiana **tekstu**, nie wzoru. | `components/progress/strength-tab.tsx:381`, `lib/progress-hub.ts:267-284` | 3.4 (UI copy) |
| **W5** | **POTWIERDZONE.** `waistGoalCm = 15`, `tonnageGoalKg = 50_000`, `streakGoal = 4` — literały w `loadProgressHubData` (`progress-hub.ts:1284,1286,1288`), bez odczytu z ustawień użytkownika. Narusza BR-12 w duchu (cele „Następne cele” nie pochodzą z ustawień, mimo że `weeklySessionsTarget`/`weeklyCardioGoalMinutes` już tak działają — niekonsekwencja w tym samym pliku). | `lib/progress-hub.ts:1284-1289` | 3.5 |
| **W6** | **NIE ZWERYFIKOWANE W PEŁNI — nieblokujące.** `sumNutritionWindow` (`lib/diet-training-weeks.ts:169-215`) sumuje `d.caloriesConsumed`/`d.macros.protein` z już zagregowanego `NutritionDaySummary` per dzień — ta funkcja sama nie odróżnia „produkt bez kcal” od „0 kcal”, to pytanie przesuwa się do warstwy budującej dzienne podsumowanie z wpisów dziennika (`replaceConsumptionWithMealLogs`/agregacja posiłków), którą nie czytałem w całości w tym budżecie czasowym. Klasyfikacja: **do naprawy później** (poza architekturą tego redesignu — to zachowanie istniejącego potoku żywieniowego, nie nowy kod). Patrz sekcja 8 (bledy.md). | `lib/diet-training-weeks.ts:169-215` | — (nie blokuje ADR) |
| **W7** | **POTWIERDZONE — martwy kod.** `Grep` po repo: `components/progress-analysis/*` (5 plików) importowane **tylko wzajemnie** (`progress-charts-dynamic.tsx` → `progress-charts.tsx`, `exercise-progress-dynamic.tsx` → `exercise-progress-client.tsx`), bez żadnego importu z `app/` ani z innego `components/`. `lib/progress-analysis.ts` (`getProgressAnalysisData`) ma dokładnie jedno wystąpienie poza samym plikiem — w dokumencie analizy (nie w kodzie). Trasa `app/(dashboard)/progress-analysis/page.tsx` to już tylko `redirect()` (do `/progress` lub `/progress/exercises/[key]`) i **nie importuje** żadnego z powyższych. Szczegół ćwiczenia (`/progress/exercises/[key]/page.tsx`) używa osobnej, żywej ścieżki: `lib/exercise-progress.ts` (`getExerciseProgressSeries`) + `lib/exercise-period-compare.ts` — **nie** `lib/progress-analysis.ts`. | `Grep` (patrz sekcja „Dowody wyszukiwania” poniżej) | 4 (usunięcie) |
| **W8** | **POTWIERDZONE jako redundancja prezentacji, nie liczenia.** `buildCoachInsights` (`coach-insights.ts:122-147`) renderuje tekst z `args.consistency.week`/`args.adherence` — te same pola, które `ReadinessCard` już pokazuje jako liczbę. To jeden silnik, dwa miejsca prezentacji tego samego wyniku. | `lib/analytics/coach-insights.ts:122-147` | 3.6 (reguła UI, nie zmiana `lib/analytics`) |
| **W9** | **POTWIERDZONE, nieoceniane słownie.** `fatigueBandLabel`/`bandLabel` generowane w `lib/analytics/fatigue-score.ts` — brzmienie etykiet (np. „przeciążenie”) do neutralizacji przez `ux` (BR-7), zero zmiany logiki liczącej. | `lib/analytics/fatigue-score.ts` (nazwa funkcji, nie czytano treści etykiet w tym etapie) | 3.6 |
| **W10** | **ODRZUCONE jako błąd liczenia — to jest D1, potwierdzony jako duplikat prezentacji.** `computeConsistencyScore` wywołane raz w `build-intelligence.ts:118`, wynik czytany w `overview-tab.tsx:63` (`.month`) i `week-tab.tsx:261-263` (`.week`/`.month`/`.days90`) — **ta sama definicja, ten sam obiekt, inny wycinek pól**. BR-1 jest już spełnione na poziomie kodu; problem jest czysto wizualny (dwa miejsca pokazują powiązane liczby bez linku między nimi). | `lib/analytics/build-intelligence.ts:118`, `lib/analytics/consistency-score.ts`, użycia w `overview-tab.tsx`/`week-tab.tsx` | 3.6 |
| **W11** | **POTWIERDZONE.** „Intensywność” w Sile liczona z `intensitySessions.slice(-6)` (ostatnie 6 sesji chronologicznie, niezależnie od tygodnia kalendarzowego) przez `buildProgressIntensitySummary`, podczas gdy Tygodnie pokazują `avgRpe`/`avgRir` per tydzień kalendarzowy (`weekFull`/`weekPartial` w `progress-hub.ts`). Dwie różne próbki pod wspólną nazwą „intensywność” — wymaga jednoznacznych etykiet okresu (BR-2), nie zmiany wzoru. | `lib/progress-hub.ts` (budowa `intensitySessions`, `weekFull.rpe/rir`) | 3.6 (etykietowanie) |

**Dowody wyszukiwania (W7)**: `Grep "progress-analysis|progress_analysis"` → 19 plików, z czego poza `docs/` i samym katalogiem `components/progress-analysis/` trafienia to historyczne wzmianki w `docs/adr/0006-redesign-profil.md`, `components/layout/app-shell.tsx` (nawigacja — do sprawdzenia przy implementacji, czy to żywy link czy komentarz), `lib/analytics-screen.ts` (nazwa ekranu analityki zdarzeń), oraz akcje (`actions/workout-history.ts`, `actions/weight.ts`, `actions/start-photo.ts`, `actions/progress-delta-unit.ts`, `actions/fitness-goals.ts`) i `app/api/body-reports/route.ts` — żadne z nich nie importuje usuwanych komponentów/`lib`, prawdopodobnie to komentarze albo stałe nazwy ekranów analityki (do potwierdzenia jednym zdaniem przez `backend` przy implementacji, nie zmienia decyzji o usunięciu). `Grep "getExerciseProgressSeries|listExerciseNameSuggestions"` → wyłącznie żywa ścieżka (`app/api/progress/exercise/route.ts`, `app/(dashboard)/progress/exercises/[key]/page.tsx`, `lib/exercise-period-compare.ts`, `lib/exercise-progress.ts`) — potwierdza, że szczegół ćwiczenia **nie zależy** od `lib/progress-analysis.ts`.

---

## 3. Decyzje architektoniczne

### 3.1 W1 / BR-5 — Agregaty „od zawsze” bez czytania całej historii: kolumna `workouts.tonnage_kg`

**Opcje rozważane**
1. Usunąć limit 180 dni / 400 wierszy dla agregatów „od startu” i czytać pełną historię treningów przy każdym wejściu na `/progress`.
2. Osobna, materializowana tabela sum (`user_training_totals`) aktualizowana przy każdym zapisie/edycji/usunięciu treningu.
3. **Dodać nullable kolumnę `tonnage_kg` (REAL) do `workouts`, liczoną i zapisywaną raz przy zapisie sesji; agregaty „od zawsze” liczyć jednym zapytaniem SQL `SUM`/`COUNT`/`MIN(date)` po tej kolumnie.**

**Decyzja**: Opcja 3.

**Uzasadnienie**:
- Opcja 1 jest technicznie prosta, ale koliduje z A9/9.4 (koszt Turso, SLO wydajności) — użytkownik trenujący 2 lata ma tysiące wierszy z blobami JSON `exercises`; parsowanie ich wszystkich przy każdym wejściu na stronę nie skaluje się i jest dokładnie tym, co dzisiejszy limit 400/180 dni próbował (błędnie) ograniczyć.
- Opcja 2 rozwiązuje problem, ale wprowadza drugi, niezależny stan do synchronizacji („totals” muszą być inkrementowane/dekrementowane przy edycji i usunięciu treningu, co jest źródłem nowej klasy błędów — rozjazd między `workouts` a tabelą sum, analogicznie do problemu, który ADR 0007 świadomie unikał przy modelu planu). Wymaga też logiki „co jeśli recalc się nie powiedzie” (retry, job).
- Opcja 3 jest prostsza: `tonnage_kg` to pochodna wartość *tej samej* kolumny/wiersza, liczona przez tę samą, kanoniczną funkcję tonażu (przeniesioną do `lib/analytics/tonnage.ts`, patrz 3.4) w tym samym miejscu, gdzie sesja jest zapisywana (`actions/workout-history.ts` / odpowiadający zapis). Agregaty „od zawsze” to płytkie zapytanie SQL po kolumnie liczbowej (nie po JSON), którego koszt nie rośnie z wielkością bloba i jest tani nawet dla wielu tysięcy wierszy (SQLite/Turso skanuje jedną wąską kolumnę, nie parsuje JSON w aplikacji). Brak drugiego źródła prawdy do synchronizacji — `tonnage_kg` jest denormalizacją *tego samego* wiersza, nie osobnej encji.

**Schemat (Drizzle, `db/schema.ts`)**:
```ts
// workouts: nowa kolumna
tonnageKg: real("tonnage_kg"), // NULL = sesja bez wyliczonego tonażu (cardio-only, puste); wypełniane przy zapisie
```
Indeks opcjonalny `idx_workouts_user_tonnage` na `(user_id, tonnage_kg)` tylko jeśli pomiar wydajności (`tester-wydajnosci`) wykaże potrzebę — przy typowej liczbie wierszy per użytkownik (setki do kilku tysięcy) pełny skan własnych wierszy użytkownika po `user_id` (już indeksowanym) jest wystarczająco szybki; dodawanie indeksu „na wszelki wypadek” byłoby odstępstwem od zasady „nie licz zapytań, mierz” — decyzja `backend`/`tester-wydajnosci` przy implementacji na realnych danych.

**Zapytanie agregatów „od zawsze”** (zamiast `from180`/`limit(400)` dla tych trzech wartości):
```sql
SELECT SUM(tonnage_kg) AS total_tonnage_kg,
       COUNT(*)        AS total_strength_sessions,
       MIN(date)        AS first_workout_date
FROM workouts
WHERE user_id = ? AND tonnage_kg IS NOT NULL;
```
To zapytanie zasila `strength.sinceDate`, `strength.workoutCount` (nagłówek „OD … N TRENINGÓW” — zgodnie z BR-5 **pełna historia**, nie 400 ostatnich treningów), oraz licznik celu „50 t” (W5). Okno 180 dni/`limit(400)` **zostaje** dla wszystkiego, co z definicji jest wskaźnikiem krótkoterminowym (listy ćwiczeń, plan groups, trend e1RM/tonażu 7/30/90 dni, intensywność, balans mięśniowy, kalendarz tygodnia) — to jest poprawne użycie okna, zgodne z BR-2, i go nie zmieniamy.

**Migracja i seed**: migracja Drizzle dodająca kolumnę (nullable, bez `NOT NULL DEFAULT`, więc błyskawiczna na istniejącej tabeli — SQLite/libSQL `ALTER TABLE ADD COLUMN` jest O(1)). Skrypt jednorazowy `scripts/backfill-workout-tonnage.ts` (wzorem `scripts/seed-exercises-from-catalog.ts` z ADR 0007): czyta wszystkie `workouts` w batchach (np. 500), liczy `tonnageKg` kanoniczną funkcją, `UPDATE` wsadowy. Koszt: jednorazowy, uruchamiany przy wdrożeniu tej zmiany (poza godzinami szczytu, z `tester-wydajnosci` oszacowującym czas na typowej/maks. liczbie wierszy w produkcji). Nowe treningi od dnia wdrożenia dostają `tonnageKg` automatycznie przy zapisie — brak okna, w którym dane są niespójne (backfill uzupełnia tylko historyczne, nowe wiersze mają wartość od razu).

**Ryzyko**: rozjazd, jeśli ktoś edytuje `exercises` JSON treningu bez przeliczenia `tonnageKg` (np. przyszła zmiana w innym miejscu kodu zapisująca `workouts.exercises` bez przejścia przez kanoniczną funkcję). Mitygacja: `tonnageKg` liczone **wyłącznie** wewnątrz współdzielonej funkcji zapisu sesji (nie duplikowane w kilku akcjach) — do pilnowania przez `backend` przy implementacji i do sprawdzenia przy przeglądzie, jeśli zajdzie wyjątek z sekcji „Dobór ról”.

### 3.2 W2 — Tempo wagi: regresja liniowa zamiast różnicy dwóch punktów

**Opcje rozważane**
1. Zostawić różnicę końców okna (dzisiejsze zachowanie), tylko zmienić nazwę/etykietę, żeby nie sugerowała dokładności.
2. **Regresja liniowa (najmniejsze kwadraty) po punktach w oknie**, slope × 7 dni.
3. Średnia krocząca z różnicowaniem (np. EMA) — bardziej odporna na szum dzień-do-dnia, ale trudniejsza do wyjaśnienia użytkownikowi w jednym zdaniu (US-13).

**Decyzja**: Opcja 2. Regresja liniowa jest standardową, dobrze znaną metodą trendu wagi (używaną przez porównywalne aplikacje, np. Hevy/Renpho), odporna na pojedynczy wyskok (jeden punkt ma mniejszy wpływ na slope niż na różnicę końców), i da się wyjaśnić jednym zdaniem w Explainerze („trend liczony z wszystkich pomiarów w oknie, nie tylko pierwszego i ostatniego”). Zostaje jedna funkcja: `computeWeightTrendKgPerWeek(points: {date, kg}[], windowDays: number): number | null` w `lib/analytics/weight-trend.ts` (nowy plik, ten sam katalog co inne silniki — jedna odpowiedzialność, testowalna w izolacji analogicznie do `strength-velocity.ts`). Używana przez Przegląd i Sylwetkę z tym samym oknem (domyślnie 42 dni, etykietowane explicite — BR-2); Tygodnie mogą użyć tej samej funkcji z innym oknem (np. 90 dni) pod inną, jasno nazwaną etykietą, nigdy pod tą samą nazwą co inne okno (odpowiedź na W11 w duchu ogólnej reguły).

Próg danych: regresja wymaga ≥3 punktów, żeby nie sugerować trendu z 2 pomiarów (dziś kod dopuszcza `weights.length >= 2`); przy <3 punktach — „za mało danych” (BR-3), zamiast liczby z dużą niepewnością.

### 3.3 W3 / BR-4 — Jedna definicja „startu”

**Opcje rozważane**
1. Start = zawsze pierwszy punkt w scalonej serii wag (`weights[0]`), zdjęcia dopasowują się do tej daty/wagi, nie odwrotnie.
2. Start = zawsze zdjęcie startowe (galeria albo pierwszy raport ze zdjęciem), waga dopasowuje się do niego.
3. **Jedna funkcja `resolveProgressStart()` z jasną hierarchią, używana przez wszystkie trzy miejsca (Przegląd, Sylwetka/tempo, Zdjęcia).**

**Decyzja**: Opcja 3, z hierarchią zgodną z dzisiejszym zamiarem w zdjęciach (bo to tam jest pojęcie „własny start” z `hasCustomStart`), ale scaloną w jedno miejsce:

```ts
// lib/progress-metrics/start.ts
export type ProgressStart = {
  date: string | null;
  weightKg: number | null;
  waistCm: number | null;
  /** Czy start pochodzi z ręcznie wybranego zdjęcia startowego (galeria), a nie z pierwszego pomiaru. */
  isCustomPhotoStart: boolean;
};

export function resolveProgressStart(input: {
  weights: ReadonlyArray<{ date: string; kg: number }>; // już scalone raporty+logi, chronologicznie
  hasCustomStartPhoto: boolean;
  customStartPhoto: { date: string; weightKg: number | null; waistCm: number | null } | null;
  firstReportWithPhoto: { date: string; weightKg: number | null; waistCm: number | null } | null;
}): ProgressStart {
  // 1) użytkownik wybrał własne zdjęcie startowe -> ono wygrywa (zachowanie dzisiejsze w zdjęciach, teraz globalne)
  // 2) inaczej: pierwszy raport ze zdjęciem, jeśli istnieje (zachowuje "start" blisko zdjęć)
  // 3) inaczej: pierwszy punkt z `weights` (fallback, gdy brak jakiegokolwiek zdjęcia)
  // W każdym przypadku zwracana jest JEDNA data/waga/pas, używana identycznie w Przeglądzie, Sylwetce i Zdjęciach.
}
```

To usuwa rozjazd: `deltaFromStartKg` w `tempo`, kafelek „od startu” w Przeglądzie i `weightDeltaKg`/`waistDeltaCm` w zdjęciach wołają tę samą funkcję z tymi samymi argumentami (AC-9.1). Brak zmiany schematu — to czysto logika odczytu istniejących danych.

### 3.4 Kanoniczny tonaż — jedna funkcja, jedno miejsce

`volumeFromExercises`/`dayVolKg` (`progress-hub.ts:267-284` i powtórzona logika w pętli `710-768`) przenosimy do `lib/analytics/tonnage.ts` jako `computeSessionTonnageKg(exercises): number`, z komentarzem dokumentującym wzór (`Σ reps × kg po wszystkich zaliczanych seriach — "zaliczana" = done, nie skipped, z powtórzeniami i zewnętrznym obciążeniem`), żeby przyszłe nieporozumienia typu W4 nie powstawały bez jednego miejsca odniesienia. Ta sama funkcja jest wywoływana: (a) przy zapisie treningu, żeby wypełnić `workouts.tonnageKg` (3.1), (b) przez `lib/progress-metrics/strength.ts` przy budowaniu list/sparków z okna 180 dni. Zero duplikacji wzoru w dwóch miejscach (dziś: `progress-hub.ts` ma go raz na poziomie sesji i raz na poziomie pojedynczego ćwiczenia w tej samej pętli — po przeniesieniu, poziom ćwiczenia zostaje osobną, małą funkcją `computeExerciseTonnageKg` w tym samym pliku, bez zmiany zachowania, tylko lokalizacji).

Poprawka tekstu Explainera (W4): „Objętość (tonaż) = suma (powtórzenia × kg) z każdej zaliczonej serii.” — do ustalenia finalnego brzmienia przez `ux`/`frontend`, zgodnie z AC-13.2.

### 3.5 W5 / BR-12 — Cele „Następne cele” z ustawień, bez migracji schematu

**Opcje rozważane**
1. Zostają stałe w kodzie (status quo) — odrzucona, to jest właśnie W5.
2. Nowa tabela `user_progress_goals` dla tych trzech celów.
3. **Rozszerzenie istniejącego `fitnessGoalsSchema` (`lib/fitness-goals.ts`, JSON w `user_settings.fitness_goals_json`) o trzy opcjonalne pola, z domyślnymi wartościami równymi dzisiejszym stałym, gdy pole nie jest ustawione.**

**Decyzja**: Opcja 3, zgodnie z założeniem A4 (cele zostają efektywnie stałe w v1 — brak ekranu ustawień w tym zadaniu) **i** z BR-12 w duchu architektonicznym: przeniesienie do ustawień już teraz (nawet bez UI do ich zmiany) kosztuje zero migracji schematu (ta sama kolumna JSON, ten sam wzorzec co `weeklySessionsTarget`/`targetWeightKg`), i otwiera drogę do przyszłego ekranu „Cele” (Q1) bez żadnej zmiany backendu — tylko formularz w Profilu wywołujący istniejącą akcję zapisu `fitness_goals_json`. Tabela 2 (nowa encja) jest nieuzasadniona dla trzech skalarnych liczb współdzielących cykl życia z resztą celów użytkownika.

```ts
// lib/fitness-goals.ts — dopisanie do fitnessGoalsSchema
waistGoalCm: z.number().positive().max(60).optional(),       // domyślnie WAIST_GOAL_CM_DEFAULT = 15
tonnageGoalKg: z.number().positive().max(10_000_000).optional(), // domyślnie TONNAGE_GOAL_KG_DEFAULT = 50_000
streakWeeksGoal: z.number().int().min(1).max(52).optional(),  // domyślnie STREAK_WEEKS_GOAL_DEFAULT = 4
```

Stałe domyślne żyją jako nazwane eksporty w `lib/fitness-goals.ts` (nie magiczne liczby w `lib/progress-metrics/overview.ts`), np. `WAIST_GOAL_CM_DEFAULT`, `TONNAGE_GOAL_KG_DEFAULT`, `STREAK_WEEKS_GOAL_DEFAULT` — jedno miejsce do zmiany, jeśli produkt zdecyduje inaczej, bez grep-owania całego modułu.

### 3.6 Reguła UI dla duplikatów prezentacji (W8, W10, D1–D9) — kontrakt „jedna metryka, jeden właściciel”

Ponieważ W8/W10/D1-D9 to w większości duplikaty *prezentacji* poprawnie policzonych wartości (sekcja 2), decyzja architektoniczna nie dotyczy `lib/analytics/` (zostaje bez zmian funkcjonalnych), tylko **kontraktu konsumpcji** między zakładkami. Specyfikacja dla `ux`/`frontend` (wiążąca, nie tylko rekomendacja):

| Metryka | Właściciel (pełny widok + etykieta okresu) | Inne zakładki pokazują | Link |
|---|---|---|---|
| Regularność (`consistency`) | Tygodnie (tydz./30/90 dni, pełne definicje) | Przegląd: tylko wynik tygodnia w pasku werdyktu (US-1), bez osobnego kafelka | Przegląd → „Zobacz szczegóły” → Tygodnie |
| Trend e1RM / tonaż | Siła (pełne listy, wybór okresu) | Przegląd: jedna zbiorcza liczba w werdykcie | Przegląd → Siła |
| Intensywność RIR/RPE | Siła (agregat okna, jasno oznaczone „ostatnie N sesji”) | Tygodnie: per tydzień kalendarzowy (inna etykieta — W11); Szczegół ćwiczenia: per ćwiczenie | Każda etykieta zawiera własne okno — nie ma wspólnej karty „Intensywność” do której inne linkują |
| Stagnacja | Siła → Balans mięśniowy (pełna lista) | Szczegół ćwiczenia: tylko status tego jednego ćwiczenia | Lista → klik ćwiczenia → Szczegół |
| Gotowość (zmęczenie+regeneracja) | Przegląd, jedna karta (US-2) | Podpowiedzi coacha (`coach-insights`) **nie powtarzają** liczby z karty gotowości — `buildCoachInsights` dostaje flagę/kontekst „czy gotowość już pokazana wyżej” i pomija redundantny tekst (BR-6) | — |
| Waga od startu | Jedna funkcja `resolveProgressStart` (3.3) | Wszystkie trzy miejsca pokazują identyczną wartość | — |

Implementacyjnie: to są zmiany w komponentach `components/progress/*` (co renderują, nie jak liczą) — zakres `frontend`, nie nowy kod domenowy w `lib/`. Jedyna zmiana w `lib/analytics/coach-insights.ts` to nowy, opcjonalny parametr (np. `suppressReadinessRepeat: boolean`) sterujący tym jednym przypadkiem (W8/BR-6).

---

## 4. Martwy kod — plan usunięcia (W7, US-17)

Do usunięcia w implementacji (bez zmiany zachowania widocznego dla użytkownika):
- `components/progress-analysis/progress-charts.tsx`
- `components/progress-analysis/progress-charts-dynamic.tsx`
- `components/progress-analysis/exercise-progress-client.tsx`
- `components/progress-analysis/exercise-progress-dynamic.tsx`
- `components/progress-analysis/weigh-in-card.tsx`
- `lib/progress-analysis.ts` (`getProgressAnalysisData`)

Zostaje bez zmian: `app/(dashboard)/progress-analysis/page.tsx` (już jest czystym redirectem, nie importuje nic z usuwanego kodu).

Warunek wejścia do usunięcia (do wykonania przez `backend` przy implementacji, nie zmienia tej decyzji): powtórzyć `Grep` po całym repozytorium (w tym `android/` jeśli zawiera referencje do URL-i, nie do plików TS) bezpośrednio przed usunięciem, dla bezpieczeństwa przed regresją z ewentualnych nowych importów dodanych między etapem 3 a implementacją; `npm run lint` i `npx tsc --noEmit` muszą przejść po usunięciu (AC-17.1/17.2).

---

## 5. Nowa architektura modułu — struktura katalogów

Cel: zero plików-bogów (analogicznie do ADR 0007), jedna odpowiedzialność per plik, podział wg zakładki zamiast jednego orkiestratora.

```
lib/progress-metrics/              # NOWY katalog — orkiestracja (zastępuje monolit lib/progress-hub.ts)
  types.ts                          # Typy wspólne (przeniesione z progress-hub.ts: ProgressWeekSummary, ProgressTempo, …)
  start.ts                          # resolveProgressStart() — jedna definicja "startu" (3.3)
  overview.ts                       # loadOverviewMetrics(userId): werdykt tygodnia, gotowość, cele, nagłówek "od zawsze"
                                     #   (woła totals.ts dla agregatów pełnej historii — lekkie zapytanie SQL)
  totals.ts                         # getLifetimeTotals(userId): SUM/COUNT/MIN(date) po workouts.tonnage_kg (3.1)
  strength.ts                       # loadStrengthMetrics(userId, periodDays): maxes, planGroups, intensity, velocity
                                     #   (okno 180 dni / limit 400 zostaje TUTAJ, nie w agregatach "od zawsze")
  body.ts                           # loadBodyMetrics(userId): weights, tempo (weight-trend.ts), measures
  photos.ts                         # loadPhotoMetrics(userId): TYLKO wołane z akcji odsłonięcia zdjęć (BR-8), nigdy z overview.ts
  week.ts                           # loadWeekMetrics(userId): last8, compareWeeks, dietTraining, adherence
  goals.ts                          # Odczyt celów z fitness-goals.ts + stałe domyślne (3.5)

lib/analytics/
  tonnage.ts                        # NOWY — computeSessionTonnageKg, computeExerciseTonnageKg (3.4), kanoniczne, z testem
  weight-trend.ts                   # NOWY — computeWeightTrendKgPerWeek (regresja, 3.2), z testem
  coach-insights.ts                 # ZMIANA: + parametr suppressReadinessRepeat (3.6, W8/BR-6)
  # pozostałe pliki ZOSTAJĄ bez zmian (fatigue-score, recovery-score, consistency-score, adherence-score,
  # muscle-volume, stagnation, prediction, strength-velocity, cardio-*, build-intelligence) — już poprawnie
  # scentralizowane (sekcja 1), zmiana tylko we wpływie wejść (np. tonaż z kolumny, nie z ponownego parsowania)

lib/progress-hub.ts                 # USUNIĘTY po migracji — funkcje przeniesione do lib/progress-metrics/*
                                     # (żaden inny moduł poza components/progress/progress-page-content.tsx
                                     #  go nie importuje — do potwierdzenia przez backend tuż przed usunięciem)

actions/progress-metrics.ts         # NOWY — serwerowe akcje do leniwego dociągania zakładek z klienta (sekcja 6):
                                     #   getStrengthMetricsAction(periodDays), getBodyMetricsAction(),
                                     #   getWeekMetricsAction(), revealPhotosAction() — każda czyta userId
                                     #   z auth() po stronie serwera, NIGDY z argumentu klienta (autoryzacja zasobu)

components/progress/                # ZOSTAJE jako katalog, zmiana wewnętrznej logiki ładowania (sekcja 6):
  progress-hub-view.tsx             # Zarządza stanem per-zakładka (dane + "loading"/"loaded"/"error" per tab),
                                     # zachowuje dzisiejszy wzorzec: tab switch = client state + history.replaceState,
                                     # NIE nawigacja Next (potwierdzona, dobra decyzja z przeszłości — zostaje)
  overview-tab.tsx, strength-tab.tsx, body-tab.tsx, week-tab.tsx, photos-tab.tsx, …  # zmiany treści wg sekcji 3.6,
                                     # bez zmiany sposobu pobierania danych (to robi progress-hub-view.tsx/akcje)

components/progress-analysis/       # USUNIĘTY CAŁKOWICIE (sekcja 4)
lib/progress-analysis.ts            # USUNIĘTY CAŁKOWICIE (sekcja 4)
```

**Dlaczego ten podział**: każdy loader ma jedną zakładkę/odpowiedzialność (zgodnie z `docs/zespol/przeplyw.md` — „jedna funkcjonalność w jednym miejscu”), `totals.ts` izoluje jedyne miejsce, które potrzebuje agregatu pełnej historii (reszta jawnie pracuje na oknie), a `lib/analytics/` zostaje nietknięte poza dwoma nowymi, małymi plikami i jednym parametrem — minimalizuje ryzyko regresji w już przetestowanym kodzie (ryzyko z sekcji 7 analizy: „zbyt duża zmiana naraz”).

---

## 6. Wydajność: ładowanie per zakładka, bez nowej zależności

**Stan dziś**: `ProgressPageContent` (RSC) woła `getProgressHubData(userId)` raz, w całości, przed pierwszym renderem — niezależnie od tego, że użytkownik zobaczy tylko jedną zakładkę. To główny koszt wydajnościowy zgłoszony w analizie (9.4, A9).

**Decyzja**: dwustopniowe ładowanie, bez nowej biblioteki danych (repo nie używa SWR/React Query — `Grep` potwierdza brak; nie dodajemy zależności, zgodnie z zasadą „nudne, sprawdzone technologie” i brakiem uzasadnienia dla nowej paczki):

1. **Pierwszy render (RSC, serwer)**: `app/(dashboard)/progress/page.tsx` woła **tylko** `loadOverviewMetrics(userId)` (werdykt, gotowość, kalendarz tygodnia, cele, nagłówek z `totals.ts`) — to jest jedyne wywołanie przed pierwszym malowaniem, celujące w SLO <2s z AC-14.1. Parametr `tab` z URL (zachowany dla zgodności linków, AC-9.5/16) decyduje, którą zakładkę `ProgressHubView` renderuje jako aktywną od startu, ale **nie** które dane są już wczytane — jeśli użytkownik wejdzie z linkiem `?tab=sila`, strona i tak najpierw pokazuje overview-dane w tle (szkielet Siły), po czym klient douczytuje dane Siły (krok 2) od razu, bez czekania na interakcję — różnica względem „czysto leniwego” ładowania tylko dla UX wejścia głębokiego linku.
2. **Doładowanie klienckie, per zakładka, przy pierwszym wejściu na nią**: `progress-hub-view.tsx` trzyma stan `Record<ProgressTabId, "idle" | "loading" | "loaded" | "error">` + dane per zakładka. Przy pierwszej aktywacji zakładki (klik albo głęboki link z kroku 1) woła odpowiednią akcję z `actions/progress-metrics.ts` (Server Action, nie nowy route handler — konwencja repo). Wynik jest cache'owany w stanie klienta na czas życia strony — powrót do zakładki nie odpytuje serwera ponownie (spełnia AC-14.2 „przełączanie zakładek nie przeładowuje hubu” **po pierwszym** wejściu; pierwsze wejście pokazuje krótki szkielet tej jednej sekcji, nie całego huba).
3. **Zdjęcia (BR-8)**: `loadPhotoMetrics` nie jest wołane nawet przy aktywacji zakładki Sylwetka — tylko po kliknięciu „Pokaż zdjęcia” (`revealPhotosAction`), zgodnie z „na żądanie” z analizy (9.2) i US-10.

**Dlaczego Server Actions, nie Parallel Routes**: alternatywa (osobne trasy równoległe per zakładka, jak w niektórych wzorcach Next.js) zmieniłaby model URL i wymagałaby nowego wzorca routingu tylko dla tego modułu — nieuzasadnione, gdy prostsze „klient woła akcję, cache'uje w stanie” daje te same korzyści wydajnościowe bez ryzyka wynikającego z breaking changes tej wersji Next.js (do zweryfikowania w `node_modules/next/dist/docs/` przez `frontend` przed implementacją, zgodnie z `AGENTS.md`, jeśli zdecyduje się na jakikolwiek nowy prymityw routingu — ten ADR **nie** wymaga żadnego nowego prymitywu).

**Koszt Turso**: redukcja jest głównie w **liczbie odczytywanych/parsowanych wierszy per wejście na stronę**, nie w nowym cache'u. Overview nie potrzebuje 180-dniowego okna treningów w pełni (kalendarz tygodnia = 7 dni, werdykt = bieżący tydzień + cel) — do ustalenia precyzyjnie przez `backend` przy implementacji, czy `loadOverviewMetrics` potrzebuje własnego, węższego zapytania (np. tylko `gte(date, monday-7)` dla kalendarza + `totals.ts` dla nagłówka) zamiast współdzielić zapytanie 180-dniowe z `strength.ts`. Rekomendacja: **tak, osobne, węższe zapytanie dla overview** — to jest największa redukcja kosztu I/O w całym redesignie i powód, dla którego `totals.ts` jest wydzielone (3.1).

**SLO** (propozycja do potwierdzenia przez `tester-wydajnosci` na realnych danych): pierwszy ekran (overview) < 2 s na 4G; doładowanie zakładki < 800 ms (jedno zapytanie, okno 180 dni, bez zdjęć); przełączenie na już doładowaną zakładkę < 100 ms (dane w pamięci klienta, zero sieci).

---

## 7. Android, Java, zmienne środowiskowe, prywatność

- **Android/WebView**: bez zmian kontraktu. Strony `/progress`, `/progress?tab=…`, `/progress/exercises/[key]` zostają pod tymi samymi URL-ami (sekcja 9.5 analizy). Nowe Server Actions są wewnętrzne do Next.js (nie nowy publiczny endpoint `/api/android/*`) — brak wpływu na kontrakt Androida.
- **Java backend**: bez wpływu. Wszystkie wyliczenia (dziś i po redesignie) są w TypeScript (`lib/analytics/`, `lib/progress-metrics/`); `JAVA_API_BASE_URL` nie jest zaangażowane w ten moduł — potwierdzone, zero odwołań do `java-backend/` w przeczytanym kodzie modułu.
- **Zmienne środowiskowe**: brak nowych. Brak nowego cache'u Upstash/Redis — redukcja kosztu wynika z mniejszej liczby/zakresu zapytań SQL, nie z warstwy cache (sekcja 6). Jeśli `tester-wydajnosci` wykaże w implementacji potrzebę cache'u międzyżądaniowego (niespodziewane — dane są per-user, nie współdzielone jak atlas ćwiczeń z ADR 0007), wymagałoby to osobnej decyzji i wpisu w `lib/admin-config-status.ts` — nie zakładamy tego teraz (A9/9.9).
- **Dane wrażliwe / Sentry**: migracja `tonnageKg` na kolumnę nie zmienia kategorii danych (to pochodna z już istniejących `exercises` JSON, nie nowa kategoria). `console.error` w `loadProgressHubData`/nowych loaderach nadal loguje tylko komunikat błędu, nigdy wartości (9.3 analizy) — do pilnowania przez `backend` przy przenoszeniu kodu.
- **`prawnik`**: bez zmiany oceny z etapu 1 (pominięty) — nowa kolumna `workouts.tonnage_kg` jest denormalizacją istniejącej kategorii danych (tonaż treningowy), nie nowym rodzajem danych osobowych/zdrowotnych.

---

## 8. Pozycje „do naprawy później” (nieblokujące)

Zgodnie z `docs/zespol/przeplyw.md`, zapisane do `docs/bledy-do-naprawy/bledy.md`:
- **W6** — nie zweryfikowano w pełni, czy produkt bez wartości odżywczych w dzienniku posiłków jest liczony jako „brak danych” czy jako „0 kcal” w agregacji tygodniowej dieta-vs-trening (`lib/diet-training-weeks.ts` woła warstwę wyżej, którą nie przeczytano w całości w tym etapie). Nie blokuje tego ADR — to zachowanie istniejącego potoku żywieniowego, niezmienianego przez ten redesign.
- **`app-shell.tsx`/`analytics-screen.ts` i inne wzmianki `progress-analysis`** znalezione przez `Grep` (sekcja 2, dowody W7) — prawdopodobnie nazwy ekranów analityki zdarzeń lub stare komentarze, nie importy kodu. Do jednozdaniowego potwierdzenia przez `backend` tuż przed usunięciem martwego kodu (sekcja 4) — nie zmienia decyzji, tylko kolejność kroku weryfikacji.
- **Indeks `idx_workouts_user_tonnage`** (sekcja 3.1) — odłożony do pomiaru rzeczywistej potrzeby przez `tester-wydajnosci`/`backend` na danych produkcyjnych, zamiast dodawać „na wszelki wypadek”.

---

## 9. Ryzyka (uzupełnienie do sekcji 13 analizy)

| Ryzyko | Prawdopodobieństwo / wpływ | Ograniczenie |
|---|---|---|
| Backfill `tonnage_kg` dla historycznych treningów jest kosztowny/czasochłonny dla bardzo aktywnych kont | Niskie / średni | Batch + uruchomienie poza szczytem; `tester-wydajnosci` szacuje czas na próbce przed wdrożeniem |
| Zmiana metody tempa wagi (różnica → regresja, W2) zmienia liczbę, którą użytkownik już znał | Średnie / średni | Komunikat w changelogu; Explainer wyjaśniający nową metodę przy pierwszym wyświetleniu po wdrożeniu |
| Rozjazd `tonnage_kg` vs realny tonaż, jeśli przyszły kod zapisze trening poza kanoniczną funkcją zapisu | Niskie / średni | Jedna funkcja zapisu sesji jako jedyne miejsce ustawiające `tonnage_kg`; `tester` dodaje test regresji przy implementacji |
| Leniwe doładowanie zakładek wprowadza nowy stan błędu per zakładka (częściowa awaria: Przegląd działa, Siła nie) | Średnie / niski | Każda zakładka ma własny, niezależny stan `error` z przyciskiem „Spróbuj ponownie” (wzór z dzisiejszego `progress-page-content.tsx`), bez blokowania innych zakładek |
| Usunięcie `lib/progress-hub.ts` przeoczy jakiś import poza modułem Postępów | Niskie / średni | `Grep`/`npx tsc --noEmit` po usunięciu, zanim PR trafi do review |

---

## 10. Odpowiedzi na pytania otwarte (Q1–Q5) z perspektywy architektury

- **Q1** (cele stałe vs konfigurowalne): architektura **wspiera** konfigurowalność od dnia wdrożenia (3.5) bez kosztu migracji — decyzja produktowa „czy pokazać ekran ustawień w v1” zostaje otwarta i nie blokuje tego ADR.
- **Q2** (prosty/zaawansowany): bez wpływu na architekturę danych — to kwestia UX (`ux`, etap 4) renderowania tych samych, już dostępnych pól z różną gęstością.
- **Q3** (osiągnięcia): bez zmiany architektury — `achievements` (z `lib/achievements.ts`) nadal liczone z `totals.ts` (lifetime) + `streakWeeks` (krótkoterminowe, zostaje jak dziś), tylko inne miejsce w layoucie (`ux`).
- **Q4** (progi „za mało danych”): propozycja A3 z analizy zostaje; `weight-trend.ts` dodaje własny próg ≥3 punktów (3.2), zgodny z duchem A3.
- **Q5** (eksport/udostępnianie): bez zmiany — architektura tego ADR nie dodaje żadnego nowego publicznego endpointu ani eksportu; jeśli produkt zdecyduje inaczej w przyszłości, wymaga odrębnego ADR i `prawnik`.

---

## 11. Plan migracji (kolejność dla implementacji, informacyjnie — nie część etapu 3)

1. Migracja Drizzle: `workouts.tonnage_kg` (nullable) + `scripts/backfill-workout-tonnage.ts`.
2. `lib/analytics/tonnage.ts`, `lib/analytics/weight-trend.ts` (z testami) — bez zmiany zachowania widocznego, czysta ekstrakcja/nowa, niezależna logika.
3. `lib/fitness-goals.ts` — trzy nowe opcjonalne pola + stałe domyślne.
4. `lib/progress-metrics/*` — nowe loadery, konsumujące 1–3; `lib/progress-hub.ts` usunięty po przełączeniu wszystkich wywołań.
5. `actions/progress-metrics.ts` + zmiana `progress-hub-view.tsx` na model per-zakładka (sekcja 6).
6. Poprawki tekstu (W4, Explainer) i reguła UI 3.6 w komponentach `components/progress/*` — równolegle z `ux` (etap 4).
7. Usunięcie `components/progress-analysis/*` + `lib/progress-analysis.ts` (sekcja 4), z potwierdzeniem `Grep` tuż przed usunięciem.
8. `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run deploy:check` przed PR.

---

## 12. Werdykt

**ZATWIERDZONE.** Wymagania z etapu 1 są technicznie wykonalne bez zmiany modelu danych treningów/sylwetki/zdjęć (A2) i bez nowych kategorii danych wrażliwych; jedyna zmiana schematu to jedna nullable kolumna pochodna (`workouts.tonnage_kg`), uzasadniona wydajnościowo i poprawnościowo (W1/BR-5). `lib/analytics/` nie wymaga przebudowy — większość „bałaganu” zgłoszonego przez użytkownika to (a) plik-bóg orkiestrujący ładowanie wszystkiego naraz niezależnie od zakładki, (b) rzeczywiste błędy liczenia/mapowania w trzech konkretnych miejscach (W1, W2, W3, W5), (c) duplikacja prezentacji poprawnie policzonych wartości, nie duplikacja silników. Wejście dla `ux` (etap 4): makiety mogą zakładać istnienie pól z sekcji 3.6 (jeden właściciel metryki, link do szczegółu) i kontraktu ładowania per zakładka z sekcji 6 (pierwszy ekran szybki, kolejne z krótkim szkieletem przy pierwszym wejściu).
