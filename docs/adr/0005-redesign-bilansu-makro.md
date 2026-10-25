# ADR 0005: Bilans makro „MAKRO DZIŚ” — jedno źródło sum tygodnia, model stanu dnia, audyt wyliczeń

- Status: zaproponowany (etap 3 zadania 006)
- Data: 2026-10-25
- Autor: architekt
- Karta: `docs/zadania/006-redesign-bilansu-makro.md`
- Wejście: `docs/analiza/006-redesign-bilansu-makro.md` (AU-1..AU-16, BR-1..BR-11, US-1..US-10, Q-O1..Q-O5)
- Równolegle: `docs/ux/006-...` (makieta, mikrokopia stanów) — ten ADR ustala kontrakt danych (DTO), miejsce liczenia i zmiany modelu, nie ustala wyglądu.
- Next.js: zmiana dotyczy Server Component (`app/(dashboard)/nutrition/today/page.tsx`), czystych funkcji `lib/` i jednego komponentu klienckiego (`"use client"`, prezentacyjny). Brak nowych route handlerów, cache segmentów ani `proxy.ts` — standardowe przenoszenie obliczeń z `useMemo` klienta do RSC, zgodne z już stosowanym wzorcem w repo (np. `nutrition/week/page.tsx`).
- Zakres: brak implementacji w tym przebiegu. Deliverable to decyzje projektowe i lista zmian dla `backend`/`frontend` po decyzji właściciela.

## 0. Werdykt audytu AU-1..AU-16 (dowody w kodzie)

| ID | Werdykt | Dowód |
|---|---|---|
| AU-1 | **Potwierdzony błąd projektowy (nie literalny bug, ale realna niespójność).** `buildWeeklyNutritionRollup` (`lib/nutrition-goals.ts:148-199`) sumuje po **wszystkich 7 dniach** tygodnia (`weekDateKeysMondayFirst`), łącznie z dniami przyszłymi względem `todayKey` — nie ma filtra `dateKey <= todayKey`. `buildPeriodMacroBalance` (`lib/nutrition-day-balance.ts:154-193`) sumuje wyłącznie `daysThroughToday` (pn→dziś). To są **dwie różne metryki** („cel całego tygodnia” vs „suma do dziś”), nie jeden błąd w jednej z nich — ale obie są nazwane podobnie („bilans tygodnia”) i obie czytają te same dane, więc użytkownik słusznie oczekuje jednej prawdy. Wymaga ujednolicenia pod wspólną funkcję z jawnym parametrem zakresu (decyzja niżej). |
| AU-2 | **Potwierdzony.** `daysThroughToday` wlicza dzisiejszy dzień w całości; `buildPeriodMacroBalance` nie odróżnia „dziś w trakcie” od dni zamkniętych — cel dzisiejszy wchodzi do sumy w 100%, spożycie tylko częściowe (`lib/nutrition-day-balance.ts:168-184`). |
| AU-3 | **Potwierdzony w UI.** `buildDayMacroBalance` ocenia dziś tym samym `classifyMacroBalance` co dni zamknięte (`lib/nutrition-day-balance.ts:114-134`) — brak specjalnego stanu „w toku”. |
| AU-4 | **Potwierdzony, realny błąd.** `buildMacroBalance` nie wie nic o braku wpisów — liczy `delta = 0 − goal` i `status = "deficit"` dla dnia bez żadnego posiłku, o ile cel > 0. `hasFood` (`macros.some(m.consumed > 0)`) jest tylko flagą do etykiety karty; **nie** blokuje wejścia takiego dnia na listę odchyleń: `collectDayHighlights` pomija dzień tylko gdy `!hasFood && highlights.length === 0` (`lib/nutrition-day-balance.ts:196-211`) — jeśli `highlights.length > 0` (bo wygenerowano „brakuje 100%”), dzień **wchodzi** na listę mimo `hasFood === false`. Czterokrotne „brakuje 100%” dla dnia bez wpisu to realny szum opisany w analizie. |
| AU-5 | **Brak błędu — już poprawnie zabezpieczone.** `buildMacroBalance` ma guard `goal == null \|\| !(goal > 0)` → `status: "no_goal"`, bez `NaN`/`Infinity` (`lib/nutrition-day-balance.ts:84-96`). Zostawić jako test regresji, nie zmieniać logiki. |
| AU-6 | **Brak realnego ryzyka.** `deltaPct = round((consumed/goal − 1) × 100)` jest matematycznie identyczne z `adherencePct(...) − 100`, bo `round(x) − 100 === round(x − 100)` dla całkowitego przesunięcia o 100. Para „delta g” / „%” pochodzi z tych samych surowych wartości `consumed`/`goal`, zaokrąglanych niezależnie, ale bez źródła realnego rozjazdu > 1 w normalnych zakresach. Nie wymaga zmiany — wystarczy test jednostkowy jako dokumentacja założenia. |
| AU-7 | **Brak błędu — architektura już poprawna.** `todayKey` liczony raz w RSC (`app/(dashboard)/nutrition/today/page.tsx:27`, `calendarDateKey(new Date())`) i przekazywany jako prop do klienta; `useMemo` w `nutrition-today-view.tsx` używa wyłącznie przekazanego `todayKey`, nigdy `new Date()` po stronie klienta. `calendarDateKey` (`lib/local-date.ts:18-35`) liczy dzień w stałej strefie (`CALENDAR_TIMEZONE`/`NEXT_PUBLIC_CALENDAR_TIMEZONE`, domyślnie `Europe/Warsaw`), tej samej po stronie serwera i (dla ewentualnego kodu klienckiego) przeglądarki. BR-9 jest już spełnione. Utrzymać ten wzorzec przy dalszych zmianach (nie wprowadzać `new Date()` bez strefy). |
| AU-8 | **Potwierdzony, realne ryzyko.** `resolveProfileDayGoals` (`lib/nutrition-goals.ts:92-111`) czyta **bieżące** `settings.training`/`settings.rest` (aktualne wartości z profilu) dla dowolnego `dateKey` — przechowywany jest tylko typ dnia (`dayTypes[dateKey]`), nie wartości celu w gramach. Zmiana celów w profilu dziś **przepisuje ocenę wszystkich dni historycznych** przy następnym odczycie. Brak snapshotu. |
| AU-9 | **Brak błędu — spójność wymuszona konstrukcyjnie.** `parseGoals` liczy `calories = kcalFromMacros(proteinG, fatG, carbsG)` (`lib/nutrition-goals.ts:41`) — cel kcal zawsze pochodzi z B/W/T tego samego payloadu, nie może być z nim sprzeczny. |
| AU-10 | **Brak błędu — hipoteza o duplikacji jest błędna.** `applyProfileGoalsAndManualConsumption` (`lib/nutrition-dashboard.ts:80-88`) woła `replaceConsumptionWithMealLogs`, która **podmienia** (nie dodaje) `caloriesConsumed`/`macros` wartościami z agregatu `meal_logs`; przy braku wpisów ustawia zera (`lib/meal-logs.ts:34-48`). Nie ma osobnego „ręcznego spożycia” poza `meal_logs` w tej ścieżce — nazwa funkcji jest myląca (sugeruje dwa źródła), ale kod nie dubluje. Rekomendacja: zmienić nazwę przy okazji (np. `applyProfileGoalsAndLoggedConsumption`) — porządkowe, niskie ryzyko, nie blokujące. |
| AU-11 | **Nierozstrzygnięte w tej ścieżce odczytu — wymaga sprawdzenia ścieżki zapisu.** `meal_logs` przechowuje już rozwiązane liczby (`calories`, `proteinG`, `fatG`, `carbsG`) wpisane przy dodaniu posiłku; ta ścieżka (`lib/meal-logs.ts`) tylko sumuje kolumny. Czy produkt z niepełnymi makro zapisuje `0` czy odrzuca wpis — rozstrzyga handler zapisu (`app/api/meal-logs` / `lib/food-products.ts`), poza zakresem tego researchu. **Decyzja**: nie blokować redesignu na to; dodać kolumnę `isIncomplete`/`hasEstimatedMacros` (nullable boolean) w `meal_logs` dopiero gdy `backend` potwierdzi, że zapis faktycznie czyści braki do zera. Odłożone do etapu implementacji jako zadanie weryfikacyjne dla `backend`. |
| AU-12 | Kosmetyczne, decyzja `ux` — bez wpływu na poprawność danych. |
| AU-13 | **Brak błędu.** Badge `N odchył.` w `DayCard` renderuje `day.highlights.length` (`nutrition-today-view.tsx:164-166`) — ta sama tablica zasila listę `collectDayHighlights`. Liczniki są z definicji spójne, dopóki nikt nie filtruje jednej strony bez drugiej (uważać przy wdrażaniu filtra z US-8 — patrz p. 6). |
| AU-14 | Decyzja biznesowa (Q-O3), poniżej przyjęto założenie domyślne. |
| AU-15 | **Potwierdzony, zakres `ux`.** Status komunikowany kolorem (`statusTone`/`statusChip`/pasek) w `MacroStatRow` bez stałego tekstu statusu (tylko wartość liczby ma kolor). `highlightVerb` daje tekst wyłącznie w `HighlightList`, nie w `MacroStatRow`/`DayCard`. Model danych już niesie `status` jako enum string — to zadanie czysto prezentacyjne (frontend/ux), bez zmiany architektury. |
| AU-16 | **Brak odpowiednika.** Wyszukiwanie (`grep`) frazy `nutrition|macro|bilans` w `java-backend/` nie zwróciło wyników — Java nie implementuje tego bilansu. Android nieprzeszukiwany tym samym mechanizmem (brak dedykowanego ekranu `/api/android/*` dla tego widoku) — zakładam brak parytetu do utrzymania, bo ekran działa wyłącznie na danych RSC Next.js, nie przez publiczne API. Jeśli to się zmieni (nowy endpoint), wymagany osobny ADR. |

**Podsumowanie**: trzy potwierdzone błędy wymagające zmiany kodu: **AU-1** (dwie niespójne definicje „tygodnia”), **AU-2/AU-3** (dzień dzisiejszy oceniany jak zamknięty), **AU-4** (dzień bez wpisów generuje fałszywe „brakuje 100%”). Jedno potwierdzone ryzyko wymagające decyzji produktowej z kompromisem kosztowym: **AU-8** (historia celów nie jest zamrożona). Reszta to: już poprawne (AU-5, AU-6, AU-7, AU-9, AU-10, AU-13), poza zakresem tej ścieżki (AU-11), kosmetyczne/ux (AU-12, AU-14, AU-15), brak wpływu (AU-16).

## 1. Założenia przyjęte zamiast odpowiedzi właściciela (Q-O1..Q-O5)

Zgodnie z poleceniem — to etap analizy architektonicznej, nie wdrożenia. Przyjmuję założenia domyślne zgodne z BR-1..BR-11 z dokumentu analizy; właściciel może je obalić przed etapem 5 bez zmiany architektury (parametry, nie fundamenty):

- **Q-O1 → próg „w normie”**: zostaje jeden próg dla wszystkich czterech wartości (±5 pp lub <1 jednostki), jako parametr `MACRO_TOLERANCE_PP = 5` w jednym miejscu (dziś już tak jest, tylko nazwać stałą zamiast liczby magicznej `5`/`1` w `classifyMacroBalance`). Rozbicie progu per makro to osobna, mała zmiana później (parametr, nie nowa architektura).
- **Q-O2 → BR-3/BR-4 zaakceptowane**: dziś nie jest oceniane jako niedobór do końca dnia (stan `in_progress`); dzień bez wpisów to stan `no_entries`, nie odchylenie. Cel historyczny: **nie zamrażamy w tej iteracji** (patrz p. 4) — zamiast tego jawna adnotacja „cel wg aktualnego planu” na kartach dni starszych niż bieżący tydzień; zamrożenie (snapshot) jako opcjonalne rozszerzenie etapu 2, gdy właściciel potwierdzi, że to problem w praktyce.
- **Q-O3 → BR dla AU-14**: nadwyżka węglowodanów w dniu treningowym jest traktowana jako **neutralna informacja**, nie odchylenie wymagające koloru ostrzegawczego — wystarczy rozszerzyć `classifyMacroBalance` o opcjonalny parametr `dayType` i podnieść tolerancję tylko dla `carbs` w dniu treningowym (nie zmieniać progu dla reszty makro). Decyzja odwracalna przez właściciela bez zmiany kontraktu.
- **Q-O4 → zakres „Tydzień →”**: bez zmian w tym zadaniu (Won't, zgodnie z sekcją 11 analizy) — nawigacja zostaje jak dziś.
- **Q-O5 → strefa**: strefa z `CALENDAR_TIMEZONE`/`NEXT_PUBLIC_CALENDAR_TIMEZONE` (już wdrożone, p. AU-7) — **nie** strefa urządzenia. Brak zmiany.

## 2. Jedno źródło wyliczeń sum (AU-1, BR-5, BR-6)

### Opcje rozważane

**A. Scalić pliki `lib/nutrition-day-balance.ts` i `lib/nutrition-week-stats.ts` w jeden moduł, przepisać `buildWeeklyNutritionRollup`.**
Czyste rozwiązanie, ale `nutrition-week-stats.ts` ma dziś 19 plików zależnych (`grep` potwierdza import z `@/lib/nutrition-week-stats` lub `@/lib/nutrition-goals` w: `lib/home-start.ts`, `components/profile/nutrition-plan-section.tsx`, `components/meal-suggestions/*`, `app/(dashboard)/profile/page.tsx`, `actions/diet-day.ts`, `lib/progress-hub.ts`, `app/(dashboard)/nutrition/{today,week}/page.tsx`, `components/nutrition/nutrition-week-view.tsx`, `lib/week-nutrition-rows.ts`, `lib/nutrition-dashboard.ts`, `lib/diet-training-weeks.ts`, `components/home/week-nutrition-sheet-body.tsx`, `components/home/nutrition-progress-bars.tsx`). Scalanie plików to duże ryzyko regresji poza zakresem zadania 006.

**B. Zostawić pliki jak są; dodać JEDNĄ nową funkcję w `lib/nutrition-week-stats.ts` (już dziś pełni rolę „matematyki bazowej”, ma najmniej zależności specyficznych dla UI) i przepisać `buildPeriodMacroBalance` oraz `buildWeeklyNutritionRollup`, by obie wołały tę samą funkcję z różnymi parametrami zakresu.** Minimalny blast radius: zmieniają się tylko wnętrza dwóch funkcji, sygnatury publiczne (`PeriodMacroBalance`, `NutritionWeekRollup`) zostają kompatybilne, 19 zależnych plików nie widzi różnicy poza poprawionymi liczbami.

**C. Nowy endpoint/server action zwracający sumy, używany przez oba ekrany zamiast lokalnego liczenia.** Odrzucone na tym etapie — NFR „brak nowych zapytań” (A-5) i oba ekrany już mają dane załadowane po stronie serwera (RSC); nowy endpoint dodałby round-trip bez potrzeby.

### Decyzja: **Opcja B.**

Nowa funkcja w `lib/nutrition-week-stats.ts`:

```ts
export type DayEvaluationState =
  | "future"          // dateKey > todayKey
  | "in_progress"      // dateKey === todayKey
  | "no_entries"       // dateKey < todayKey, brak wpisów (entryCount === 0)
  | "evaluated";       // dateKey < todayKey, z wpisami — pełna ocena

export function classifyDayState(
  row: WeekDayNutritionRow,
  todayKey: string,
): DayEvaluationState { /* patrz p. 3 — wymaga pola hasEntries na WeekDayNutritionRow */ }

export function rollupMacroWindow(
  rows: WeekDayNutritionRow[],
  todayKey: string,
  key: MacroKey,
  opts: { includeFutureDays: boolean; includeInProgressGoal: "only_if_consumed" | "always" | "never" },
): MacroTotals & { daysEvaluated: number; daysNoEntries: number };
```

- `buildPeriodMacroBalance` (Bilans, „SUMA PN→DZIŚ”) wywołuje z `{ includeFutureDays: false, includeInProgressGoal: "only_if_consumed" }` — naprawia AU-2 (cel dziś wchodzi do sumy tylko gdy jest dzisiejsze spożycie) i AU-4 (dni `no_entries` wykluczone z sumy i z `highlights`).
- `buildWeeklyNutritionRollup` (Start, „Bilans tygodnia pon.–niedz.”) wywołuje z `{ includeFutureDays: true, includeInProgressGoal: "always" }` — to świadomie **inna metryka** („cel całego tygodnia” jako punkt odniesienia), ale teraz liczona tą samą funkcją, z tymi samymi regułami dla dni bez wpisów, więc różnice między ekranami wynikają wyłącznie z jawnego parametru zakresu, nie z rozjechanej logiki. Etykieta w UI musi to nazwać inaczej niż „pn→dziś” (np. zostaje „Bilans tygodnia pon.–niedz.” jak dziś, ale dodać dopisek że cel obejmuje też dni, które jeszcze nie nadeszły — zadanie dla `ux`).

**US-1 z dokumentu analizy** („sumy identyczne na obu ekranach”) **wymaga korekty**: to dwie różne, celowo odmienne metryki (suma do dziś vs cel całego tygodnia), nie jedna wartość. Rekomendacja dla `ux`/właściciela: zamiast wymuszać identyczność, nazwać je jawnie różnymi etykietami i upewnić się, że **dzień bez wpisów** traktowany jest identycznie (wykluczony z sumy celów) na obu ekranach — to jest część wspólna, którą opcja B faktycznie ujednolica.

## 3. Rozszerzenie modelu dnia (AU-4, kierunek architektoniczny #5 z analizy)

`WeekDayNutritionRow` (`lib/week-nutrition-rows.ts:9-20`) nie niesie dziś informacji o liczbie wpisów — `hasFood` jest wnioskowane z `consumed > 0`, co błędnie klasyfikuje dzień z wpisem o zerowych makro (np. czarna kawa) jako „brak wpisów”. Decyzja: dodać pole `entryCount: number` do `WeekDayNutritionRow`, przekazywane z `MealDayAggregate.entryCount` (już istnieje w `lib/meal-logs.ts:26-31`, dziś odrzucane w `replaceConsumptionWithMealLogs`). Wymaga:
- dodania `entryCount` do `FitatuDaySummary` (typ w `types/fitatu.ts`) lub przeniesienia go bocznym kanałem do `buildWeekNutritionRows` — do ustalenia przez `backend` (najmniejsza zmiana: dodać opcjonalne pole `entryCount?: number` do `FitatuDaySummary`, wypełniane w `replaceConsumptionWithMealLogs`).
- `classifyDayState` korzysta z `entryCount > 0`, nie z sumy makro.

`DayEvaluationState` zastępuje dzisiejsze domieszanie `isToday`/`hasFood` jako osobnych flag (żądanie z sekcji 10.5 analizy) — jeden typ wyliczony, reszta kodu (`DayCard`, `HighlightList`, badge) przełącza się na `switch (state)` zamiast kombinacji booleanów.

## 4. Cele historyczne (AU-8, BR-7)

### Opcje rozważane

**A. Snapshot przy zapisie**: zapisać rozwiązone cele (kcal/B/W/T) per `(userId, dateKey)` w nowej tabeli `nutrition_day_goals`, wypełnianej leniwie przy pierwszym odczycie dnia, który stał się przeszłością (dateKey < todayKey) i nie ma jeszcze wiersza. Migracja Drizzle, nowa tabela, bez zmiany istniejących.

**B. Bez zmiany schematu — jawna adnotacja w UI**: karta dnia historycznego pokazuje adnotację „cel wg aktualnego planu żywieniowego” (bez twierdzenia, że to cel obowiązujący wtedy), bez zamrażania wartości.

### Decyzja: **Opcja B na ten etap (MVP), Opcja A jako udokumentowany dług do osobnego ADR.**

Uzasadnienie: zmiana schematu (nowa tabela, migracja, logika zapisu przy odczycie) jest nieproporcjonalnie droga wobec dzisiejszej skali problemu (wymaga, żeby użytkownik **zmienił** cele treningowe/odpoczynkowe w profilu i **potem** wrócił do przeszłych dni — rzadka ścieżka). Ryzyko R-3 z analizy jest realne, ale niskiego prawdopodobieństwa przy typowym użyciu. Transparentna adnotacja kosztuje jedno zdanie w UI i nic w architekturze; jeśli właściciel po wdrożeniu zobaczy skargi użytkowników na „przepisaną historię”, otwieramy nowy ADR dla opcji A (tabela + lazy snapshot). Nie blokować tego zadania na budowę tabeli, której potrzeba nie jest potwierdzona.

## 5. Gdzie liczyć model widoku (AU-7 rozwiązane, pytanie 13.2.7 analizy)

### Opcje rozważane

**A. Model widoku liczony w RSC (`app/(dashboard)/nutrition/today/page.tsx`), przekazywany jako gotowe DTO do komponentu prezentacyjnego.**
**B. Zostawić liczenie w `useMemo` na kliencie, tylko ujednolicić `todayKey` (już zrobione, p. AU-7).**

### Decyzja: **Opcja A.**

Uzasadnienie:
- Dane wejściowe (`dayRows`, `settings`, `todayKey`) są już w 100% dostępne w RSC — zero nowych zapytań (zgodne z NFR/A-5).
- Ekran nie ma interaktywności wymagającej przeliczeń w locie poza **filtrem odchyleń po makro** (US-8) — to czyste filtrowanie już gotowej tablicy `highlights` po `macro.key`, nie wymaga ponownego liczenia `%`/delt. Zostaje po stronie klienta jako prosty `Array.filter`, bez importu ciężkiej logiki.
- Usuwa ryzyko przyszłego rozjazdu klient/serwer (nawet jeśli dziś go nie ma — p. AU-7), zmniejsza JS wysyłany do przeglądarki, upraszcza testy (jedna czysta funkcja budująca DTO, testowalna bez renderowania komponentu).
- Zgodne z domyślnym stylem RSC tej wersji Next.js (dane i obliczenia po stronie serwera, komponent kliencki tylko prezentacyjny + lekka interakcja) — przed implementacją `backend`/`frontend` mają i tak obowiązek przeczytać właściwy przewodnik w `node_modules/next/dist/docs/` zgodnie z `AGENTS.md`; tu nie zmieniamy segment config/cache, więc ryzyko niezgodności z frameworkiem jest niskie, ale przeczytanie przewodnika RSC/Server Actions pozostaje obowiązkowe przed kodowaniem.

Kontrakt DTO (do potwierdzenia z `ux` dla kształtu, nie nazw pól):

```ts
export type MacroBalanceViewModel = {
  todayKey: string;
  weekLabel: string;
  today: DayCardViewModel | null;        // state zawsze "in_progress" albo "future" (nie powinno wystąpić)
  period: {
    state: "evaluated" | "no_data";
    daysEvaluated: number;
    macros: MacroBalance[];
  };
  pastDays: DayCardViewModel[];           // state "evaluated" | "no_entries", bez "future"
};

export type DayCardViewModel = {
  dateKey: string;
  headline: string;
  state: DayEvaluationState;
  hasIncompleteData: boolean;             // AU-11, domyślnie false dopóki backend nie potwierdzi źródła
  macros: MacroBalance[];
  highlightsCount: number;                // AU-13 — ten sam licznik zasila badge i filtr
};
```

Budowana w nowej funkcji `buildMacroBalanceViewModel(dayRows, todayKey)` w `lib/nutrition-day-balance.ts` (rozszerzenie istniejącego modułu, nie nowy plik — zachowuje istniejące testy jako punkt wyjścia).

## 6. Filtr odchyleń (US-8) a liczniki (AU-13)

Filtr po makro w `HighlightList` musi filtrować tę samą tablicę, z której liczony jest badge `N odchył.` na karcie dnia — inaczej badge i lista się rozjadą po wprowadzeniu filtra. Rekomendacja: filtr zmienia tylko **widoczność** pozycji na liście płaskiej (`collectDayHighlights`), **nie** przelicza `highlightsCount` na kartach dni (to zostaje licznikiem „wszystkich” odchyleń dnia, niezależnym od filtra — zgodnie z tym, jak `ux` zaprojektuje mikrokopię, np. „3 z 4 widoczne po filtrze”).

## 7. Parytet Android/Java (AU-16)

Brak logiki do utrzymania w `java-backend/` i brak publicznego `/api/android/*` dla tego ekranu — zmiana nie wymaga aktualizacji kontraktu Android/Java. Jeśli w przyszłości ten bilans ma być eksponowany przez API (np. do wyświetlenia w aplikacji Android), wymagany osobny ADR z kontraktem `GET /api/android/nutrition/balance` i wersjonowaniem.

## 8. Konsekwencje i zmiany do wdrożenia (gdy właściciel zdecyduje o implementacji)

**Backend / lib (bez `"use client"`)**
- `lib/nutrition-week-stats.ts` — nowe: `DayEvaluationState`, `classifyDayState`, `rollupMacroWindow` (zastępuje ręczne pętle w dwóch miejscach niżej); testy jednostkowe dla: dzień przyszły, dzień w toku z/bez spożycia, dzień bez wpisów z celem >0, dzień z celem null.
- `lib/nutrition-day-balance.ts` — `buildPeriodMacroBalance` przepisane na `rollupMacroWindow({ includeFutureDays: false, includeInProgressGoal: "only_if_consumed" })`; nowa `buildMacroBalanceViewModel`; `collectDayHighlights` pomija dni ze stanem `no_entries` i `future` bez wyjątków (naprawa AU-4, usunięcie dzisiejszej furtki `highlights.length > 0`).
- `lib/nutrition-goals.ts` — `buildWeeklyNutritionRollup` przepisane na `rollupMacroWindow({ includeFutureDays: true, includeInProgressGoal: "always" })` dla każdego makro; bez zmiany publicznego kształtu `NutritionWeekRollup` (kompatybilne z 19 zależnymi plikami).
- `lib/meal-logs.ts` — `replaceConsumptionWithMealLogs` dodaje `entryCount` do zwracanego `FitatuDaySummary` (wymaga rozszerzenia typu w `types/fitatu.ts` o opcjonalne pole).
- `lib/week-nutrition-rows.ts` — `buildWeekNutritionRows` przenosi `entryCount` z `FitatuDaySummary` do `WeekDayNutritionRow`.
- `lib/nutrition-dashboard.ts` — bez zmiany kontraktu `loadNutritionWeekHistory`/`loadNutritionDashboard`; dodać wywołanie `buildMacroBalanceViewModel` w `app/(dashboard)/nutrition/today/page.tsx`, nie w tym module (zachować `lib/nutrition-dashboard.ts` jako warstwę ładowania danych, nie prezentacji).
- Opcjonalnie (AU-11, do potwierdzenia przez `backend` przed decyzją): kolumna `isIncomplete` w `meal_logs` + migracja — **tylko jeśli** `backend` potwierdzi utratę informacji o brakujących makro przy zapisie. Nie zakładać z góry.
- `lib/admin-config-status.ts` — bez nowego wpisu (żadna nowa zmienna środowiskowa; `CALENDAR_TIMEZONE` już istnieje i jest obsłużona).

**Frontend**
- `app/(dashboard)/nutrition/today/page.tsx` — woła `buildMacroBalanceViewModel`, przekazuje DTO zamiast surowych `dayRows`/`todayKey` do `NutritionTodayView`.
- `components/nutrition/nutrition-today-view.tsx` — usunięcie `useMemo` z `buildDaysMacroBalance`/`buildPeriodMacroBalance` (liczone teraz w RSC); komponent przyjmuje `MacroBalanceViewModel`; dodanie filtra po makro (US-8) jako lokalny `useState`/`Array.filter`; `MacroStatRow`/`DayCard` zyskują tekstowy status obok koloru (AU-15, razem z `ux`).
- `components/home/week-nutrition-sheet-body.tsx` — etykieta „Bilans tygodnia pon.–niedz.” dostaje dopisek rozróżniający od „pn→dziś” (treść do `ux`); logika sum bez zmian poza przejściem `buildWeeklyNutritionRollup` na wspólną funkcję (transparentne dla tego komponentu).
- `components/changelog/changelog-data.ts` — wpis `planned: true` na PR.

**Testy**
- Rozszerzyć `lib/nutrition-day-balance.test.ts` i `lib/nutrition-week-stats.test.ts` o przypadki z audytu: dzień bez wpisów z celem (AU-4, oczekiwane: wykluczony z sumy i highlights), dzień dzisiejszy z/bez spożycia (AU-2/AU-3), porównanie `rollupMacroWindow` z `includeFutureDays: true` vs `false` na tych samych danych (dokumentuje świadomą różnicę z AU-1), test regresji na istniejące guardy (AU-5, AU-6, AU-9, AU-10).
- Test porównawczy z pytania 13.2.1 analizy: potwierdzony wynikiem code review (nie testem uruchomionym) — obie funkcje **nie** dają dziś identycznego wyniku dla tego samego tygodnia, z przyczyny opisanej w AU-1. Po wdrożeniu `rollupMacroWindow` różnica będzie wyłącznie z jawnego parametru zakresu, nie z rozjechanej logiki — potwierdzić testem jednostkowym przy implementacji.

## 9. Ryzyka i dług świadomie odłożony

| Ryzyko | Decyzja |
|---|---|
| AU-8 bez snapshotu — historia może się zmienić po edycji profilu | Zaakceptowane na ten etap, złagodzone adnotacją w UI; osobny ADR, jeśli się potwierdzi jako problem w praktyce. |
| AU-11 (produkt bez wartości makro) nie do końca zweryfikowany w tej ścieżce | `backend` musi sprawdzić ścieżkę zapisu przed decyzją o kolumnie `isIncomplete`; nie zakładać rozwiązania bez potwierdzenia. |
| Zmiana nazwy/sygnatury `buildPeriodMacroBalance`/`buildWeeklyNutritionRollup` wewnętrznie dotyka kodu używanego przez 19 plików | Zminimalizowane wyborem opcji B (p. 2) — publiczne kształty bez zmian, zmiana tylko wewnątrz dwóch funkcji; mimo to `tester` musi uruchomić pełny plan testów przy implementacji (logika wysokiego ryzyka, zgodnie z kartą zadania). |
| Rozbieżność semantyki „tydzień” między ekranami pozostaje (z premedytacją) | Wymaga jasnej mikrokopii od `ux`, inaczej ryzyko R-2 z analizy (zmiana zrozumienia „dziś”) rozciąga się na „tydzień”. |

## 10. Werdykt etapu 3

**ZATWIERDZONE Z UWAGAMI.**

Uzasadnienie: audyt potwierdza 3 realne błędy do naprawienia (AU-1 jako niespójność nazewnictwa/zakresu, AU-2/AU-3, AU-4) i jedno świadomie odłożone ryzyko (AU-8) z udokumentowanym kompromisem kosztowym. Architektura (opcja B dla wspólnej funkcji, opcja A dla modelu widoku w RSC) jest ewolucyjna — nie wymaga przepisania 19 zależnych plików, nie dodaje nowych zapytań, nie zmienia kontraktu Android/Java. Uwagi niskiego ryzyka do backlogu: nazwa `applyProfileGoalsAndManualConsumption` (AU-10, kosmetyka), próg tolerancji jako magiczna liczba (Q-O1, do wydzielenia jako stała), `isIncomplete` dla `meal_logs` (AU-11, warunkowe na potwierdzenie przez `backend`).

Blokujące przed implementacją: brak — żadna z uwag nie wymaga decyzji właściciela przed etapem `ux` (etap 4); założenia z p. 1 są odwracalne bez zmiany architektury.
