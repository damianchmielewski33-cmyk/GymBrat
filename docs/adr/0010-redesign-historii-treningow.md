# ADR 0010 — Redesign ekranu „Historia treningów” (architektura, bez implementacji)

- **Karta zadania**: `docs/zadania/011-redesign-historii-treningow.md`
- **Etap**: 3 — Projekt techniczny (`architekt`). Zero zmian w kodzie produkcyjnym, danych i kontraktach API.
- **Wejście**: `docs/analiza/011-redesign-historii-treningow.md` (etap 1, ZATWIERDZONE), decyzje właściciela produktu Q1–Q5 (patrz niżej).
- **Autor**: architekt (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `ux` (etap 4, równolegle) i dla przyszłego zadania implementacyjnego (etap 5)

Przeczytany kod źródłowy potwierdzający ocenę: `app/(dashboard)/workout-history/page.tsx`, `components/workout-history/workout-history-view.tsx` (490 linii), `lib/workout-history-overview.ts` (615 linii), `lib/workout-history.ts` (`computeWorkoutDetails`), `lib/workout-plan-compare-key.ts`, `lib/local-date.ts`, `lib/treningi-hub-stats.ts`, `actions/workout-history.ts`, `app/(dashboard)/workout-history/[id]/edit/page.tsx`, `components/workout-history/workout-history-edit-client.tsx`, `components/home/home-recent-workouts.tsx`.

**Decyzje właściciela produktu wiążące dla tego ADR** (z polecenia koordynatora):
1. Numer sesji („tydz. N”) — usunąć z karty treningu na liście historii.
2. Statystyki zbiorcze mają reagować na wybrany filtr typu treningu.
3. Limit ~400 sesji zostaje (bez zmiany logiki zapytań), ale musi być jawnie zasygnalizowany w UI.
4. Porównanie z poprzednią sesją tego samego dnia planu — ma wejść do nowego projektu.
5. Cardio — poza zakresem v1.

---

## 1. Kontekst

Ekran `/workout-history` renderuje `WorkoutHistoryView` (klient) na danych z `getWorkoutHistoryOverview` (serwer, RSC `page.tsx`). Problem nie jest w modelu danych bazy — jest w **miejscu, gdzie liczone są agregaty**, w **braku stanu filtra w URL** i w **pliku-bogu** łączącym pięć odpowiedzialności w jednym komponencie klienckim. Dane potrzebne do porównania z poprzednią sesją (US-5) i do statystyk per filtr (US-2) **już istnieją** w zwracanym payloadzie — to wyłącznie kwestia architektury widoku i ponownego użycia już policzonych pól, nie nowe zapytania do Turso.

---

## 2. Decyzje

### 2.1 Podział pliku-boga `workout-history-view.tsx`

**Opcje rozważane**
1. Zostawić jeden plik kliencki, tylko dodać nowe sekcje (filtr+delta+limit) wewnątrz niego.
2. Rozbić na katalog `components/workout-history/` z komponentami i hookami o jednej odpowiedzialności każdy (wzorzec już zastosowany w zadaniu 008/009 dla innych ekranów).

**Decyzja**: Opcja 2. Plik dziś (490 linii) łączy: stan filtra, obliczanie KPI, grupowanie tygodniowe, kartę sesji, listę serii, dialog usuwania i long-press. Dodanie czterech nowych wymagań (statystyki per filtr, URL, limit 400, delta vs poprzednia) do tej samej struktury pogłębiłoby dług, a nie go spłaciło. Rozbicie jest tańsze teraz niż po dołożeniu kolejnej logiki.

**Konsekwencje — nowa struktura plików** (żadna strona/trasa się nie zmienia, tylko wnętrze katalogu `components/workout-history/`):

```
app/(dashboard)/workout-history/
  page.tsx                              # bez zmian architektury: auth() + getWorkoutHistoryOverview(userId) + render WorkoutHistoryView
                                         # NOWE: czyta searchParams (plan, open) i przekazuje jako initialPlanKey/initialOpenId (2.3)

components/workout-history/
  workout-history-view.tsx              # ZOSTAJE jako kompozycja (layout, nagłówek, sekcje) — nie liczy już niczego samodzielnie
  workout-history-filters.tsx           # Pasek chipów + stan filtra przez URL (2.3), licznik sesji per chip (planFilters[].count — już w payloadzie, dziś nieużyty)
  workout-history-stats.tsx             # Karta KPI (3 kolumny) — przyjmuje już POLICZONE kpis dla aktualnego filtra (2.4), nie liczy ich sama
  workout-history-week-group.tsx        # Nagłówek tygodnia (zakres dat, liczba treningów, tonaż tygodnia)
  workout-history-session-card.tsx      # Była `SessionRow` — wiersz + rozwinięcie (bez dialogu usuwania w tym samym pliku)
  workout-history-session-delete-dialog.tsx   # Wydzielony `AlertDialog` usuwania (reużywalny, dziś zduplikowany inline w SessionRow)
  workout-history-exercise-list.tsx     # Lista ćwiczeń + `SetPill` rozwinięcia karty
  workout-history-compare-delta.tsx     # NOWY — linia „+5% vs ostatni Push A” / „Pierwszy trening tego dnia” (US-5), czyta `volumeDeltaKg`/`compare`/`noComparison` już obecne w `WorkoutHistoryCard`
  workout-history-limit-banner.tsx      # NOWY — etykieta „Statystyki: ostatnie N sesji” gdy limit zastosowany (2.5)
  use-workout-history-filter.ts         # Hook: czyta/pisze `?plan=` w URL (2.3), bez przeładowania strony
  workout-history-stats.ts              # (katalog `lib/`, nie `components/` — patrz 2.4) czysta funkcja agregacji, reużywana serwer+klient

lib/workout-history-overview.ts         # ZOSTAJE punktem wejścia zapytania; pętla agregująca KPI wydzielona do nowej, eksportowanej funkcji (2.4)
```

`mondayOfWeek`/`groupByWeek` zostają w `workout-history-week-group.tsx` (lub osobnym `lib/workout-history-week-group.ts`, do decyzji `backend` wg konwencji katalogu) — ale **wywołują `calendarWeekMondayKey`**, nie własną reimplementację (2.2).

### 2.2 Duplikat `mondayOfWeek` — usunięcie, zastąpienie istniejącą funkcją z `lib/local-date.ts`

**Ustalenie kluczowe**: `mondayOfWeek` (identyczna w `workout-history-view.tsx:36-40` i `lib/workout-history-overview.ts:26-30`) **jest bit-do-bitu tą samą formułą co już istniejąca, eksportowana `calendarWeekMondayKey`** w `lib/local-date.ts:146-149` (`dow = calendarWeekdaySun0(dateKey); addCalendarDays(dateKey, dow === 0 ? -6 : 1 - dow)`), używana już dziś w `lib/treningi-hub-stats.ts`. To nie jest „podobna logika do ujednolicenia” — to dokładnie ta sama funkcja wpisana trzeci raz.

**Opcje**: (1) zostawić duplikaty i tylko dopisać komentarz „ta sama logika co X”; (2) usunąć obie lokalne definicje `mondayOfWeek` i zastąpić importem `calendarWeekMondayKey` z `@/lib/local-date`.

**Decyzja**: Opcja 2. Zero ryzyka behawioralnego (identyczna formuła), czysty dług do spłacenia przy tej samej okazji co reszta refaktoru. `backend` usuwa obie prywatne funkcje `mondayOfWeek` i podmienia wywołania na `calendarWeekMondayKey`.

### 2.3 Stan filtra: URL (`searchParams`), nie stan lokalny komponentu

**Opcje rozważane**
1. Zostaje `useState<string | "all">("all")` lokalnie w `WorkoutHistoryView` (dzisiejszy stan) — zero zmian w routingu.
2. Stan filtra w URL (`?plan=<planCompareKey>`), czytany przez `page.tsx` (`searchParams`) i synchronizowany klientem przez `useRouter().replace()` (bez przeładowania, `scroll: false`).

**Decyzja**: Opcja 2, zgodnie z AC-3.3 (zachowanie wyboru po nawigacji wstecz) i z potrzebą deep linku z Pulpitu (AC-10.1). `planCompareKey` jest już stabilnym, URL-safe stringiem (`name:<slug>` lub `id:<uuid>`) — koduje się bezpośrednio jako wartość query param (bez dodatkowego mapowania). Brak nowego query param niesie ryzyko iniekcji/XSS? Nie — wartość jest tylko porównywana (`===`) z listą znanych `planFilters[].id` po stronie klienta/serwera, nigdy nie trafia do zapytania SQL ani `dangerouslySetInnerHTML`; nieznana wartość w URL po prostu nie dopasowuje żadnego chipa i renderuje „Wszystkie”.

**Dodatkowy param `open`**: `?open=<workoutId>` do deep linku z Pulpitu (AC-10.1) — `WorkoutHistoryView` rozwija kartę o tym `id` przy montażu i scrolluje do niej (`scrollIntoView`), bez zmiany zapytania serwerowego (sesja jest już w załadowanych 400).

**Konsekwencje**: `page.tsx` (RSC) dostaje `searchParams: Promise<{ plan?: string; open?: string }>` (zgodnie z API tej wersji Next.js — `searchParams` jest asynchroniczne, do zweryfikowania w `node_modules/next/dist/docs/` przed implementacją) i przekazuje `initialPlanKey`/`initialOpenId` do `WorkoutHistoryView`. Link z Pulpitu (`home-recent-workouts.tsx`) zmienia `href` z `/workout-history/[id]` (szczegół) na `/workout-history?open=[id]` — **decyzja do potwierdzenia przez `ux`** (US-10, AC-10.1 zostawia wybór między „otwórz szczegół” i „otwórz listę z rozwiniętą kartą” jemu); architektura wspiera obie opcje bez zmiany kontraktu danych.

### 2.4 Statystyki zależne od filtra — wspólna, czysta funkcja agregacji (klient, bez nowego zapytania)

**Opcje rozważane**
1. **Serwer**: `page.tsx` czyta `searchParams.plan`, filtruje `cards` i liczy KPI przed przekazaniem do `WorkoutHistoryView` — przeliczenie wymaga **nawigacji serwerowej** (klik chipa = request do serwera) albo API route zwracającego tylko KPI dla danego filtra.
2. **Klient, bez nowego zapytania**: wszystkie `cards` (do 400, z pełnymi seriami) **i tak już trafiają do klienta** dzisiaj (patrz 3.1 pkt 3 analizy) — więc przeliczenie KPI dla podzbioru przefiltrowanego po `planCompareKey` jest tanie (do ~400 elementów, operacja liniowa w pamięci), pod warunkiem że logika liczenia jest **dokładnie ta sama** co po stronie serwera.

**Decyzja**: Opcja 2. Nawigacja serwerowa przy każdym kliknięciu chipa (opcja 1) byłaby regresją UX (opóźnienie przy filtrze, dziś natychmiastowy) bez żadnej korzyści — dane i tak są w pamięci klienta. Ryzyko tej opcji to **rozjazd wzoru** (klient liczy inaczej niż serwer) — mitygacja: **jedna eksportowana, czysta funkcja** używana w obu miejscach.

**Konkretna zmiana w `lib/workout-history-overview.ts`**: wydzielić pętlę agregującą (dziś linie ~528–560, zmienne `tonnageTotalKg`, `avgDurationMinutes`, `avgWorkoutsPerWeekLast8`, `workoutsThisWeek`, `tonnageThisWeekKg` itd.) do nowej, eksportowanej funkcji:

```ts
export function computeHistoryKpis(
  cards: WorkoutHistoryCard[],
  todayKey: string = calendarDateKey(),
): WorkoutHistoryKpis { /* dokładnie dzisiejsza pętla, bez zmiany wyników */ }
```

`getWorkoutHistoryOverview` wywołuje ją raz dla **całego** zbioru (filtr „Wszystkie”, jak dziś). `components/workout-history/workout-history-view.tsx` (klient) importuje tę samą funkcję z `@/lib/workout-history-overview` i wywołuje ją ponownie na `cards.filter(c => c.planCompareKey === filterPlanKey)` przy każdej zmianie filtra (zmemoizowane przez `useMemo`, jak dziś robi `groupByWeek`). Zero nowego zapytania do Turso, zero duplikacji wzoru — jedna definicja, dwa miejsca wywołania.

**Etykieta zakresu (AC-2.1/AC-2.2)**: `workout-history-stats.tsx` pokazuje pod kartą KPI tekst „cała historia” lub nazwę wybranego dnia planu (`planFilters` → `label`), zgodnie z US-2.

**Brzeg AC-2.3** (filtr bez sesji): `computeHistoryKpis([])` zwraca `avgDurationMinutes: null`, `tonnageTotalKg: 0`, `avgWorkoutsPerWeekLast8: 0` — UI renderuje „—” zamiast zera dla pól, gdzie 0 myli (decyzja wizualna `ux`, dane już to wspierają przez `null`/`0` rozróżnienie istniejące w typie).

### 2.5 Limit 400 sesji — sygnalizacja bez zmiany zapytania (Q3, decyzja: zostaje)

**Ustalenie właściciela**: limit ~400 zostaje, ma być tylko zasygnalizowany. To eliminuje potrzebę nowego zapytania COUNT czy paginacji w tym zadaniu — ale **trzeba wiedzieć, czy limit faktycznie przyciął wynik**, żeby nie pokazywać etykiety „ostatnie 400 sesji” użytkownikowi, który ma np. 12 treningów w historii.

**Opcje rozważane**
1. Osobne zapytanie `SELECT COUNT(*) FROM workouts WHERE user_id = ?` przed głównym zapytaniem — dokładna liczba, koszt: jeden dodatkowy, tani, indeksowany odczyt (`userId` ma już indeks z racji `eq(workouts.userId, ...)` w zapytaniu głównym).
2. Heurystyka bez dodatkowego zapytania: `rows.length === 400` ⇒ zakładamy, że limit przyciął (fałszywy pozytyw tylko w dokładnie-400-sesji, brzeg nieszkodliwy — komunikat „ostatnie 400 sesji” jest wtedy technicznie prawdziwy, tylko niepotrzebny).

**Decyzja**: Opcja 2 — bez nowego zapytania, zgodnie z duchem „bez zmiany logiki zapytań” z decyzji właściciela. `rows.length === 400` (nie `cards.length`, bo `rows` zawiera też wpisy cardio odsiewane później — sprawdzić dokładną liczbę przed `limit(400)` zwraca; licznik przycięcia musi być liczony na surowym `rows.length` z zapytania, nie na finalnych `cards`). Różnica kosztu dodatkowego `COUNT` jest niska, ale **nie ma potrzeby jej ponosić**, skoro próg 400 i tak nie jest dziś osiągany przez realnych użytkowników w pierwszym roku (analiza, sekcja 3.1 pkt 4) — można to przejrzeć ponownie, gdy limit realnie zacznie być osiągany (US-12, Should).

**Kontrakt**: `WorkoutHistoryOverview` dostaje nowe pole:

```ts
export type WorkoutHistoryOverview = {
  kpis: WorkoutHistoryKpis;
  cards: WorkoutHistoryCard[];
  cardio: WorkoutHistoryCardioItem[];
  planFilters: Array<{ id: string; label: string; count: number }>;
  /** NOWE — true gdy zapytanie ucięło wynik limitem (rows.length === 400 w `getWorkoutHistoryOverview`). */
  sessionsLimitReached: boolean;
};
```

UI (`workout-history-limit-banner.tsx`) renderuje etykietę tylko gdy `sessionsLimitReached === true`, w miejscu statystyk „Tonaż”/„łącznie” (US-2 AC-2.4, US-12 AC-12.3) — treść dokładna do `ux` (np. „Dane: ostatnie 400 sesji”).

### 2.6 Porównanie z poprzednią sesją (US-5) — bez nowego zapytania, dane już gotowe

`volumeDeltaKg`, `volumeDeltaPercent`, `compare` (`up`/`down`/`skipped`), `firstOfDay`, `noComparison`, `prevDate` są **już liczone** w `getWorkoutHistoryOverview` (linie 450–462) i **już w typie** `WorkoutHistoryCard` — dziś po prostu nieużyte w widoku. Nie ma decyzji architektonicznej do podjęcia poza: **nie dodawać nowego zapytania** — wystarczy nowy komponent prezentacyjny `workout-history-compare-delta.tsx` czytający te pola z już przekazanego `card`. Reguła BR-7 (bodyweight nie liczone jako spadek, N-22-1) jest już zaimplementowana w `compareWorkoutExercises` — bez zmian.

Rekomendacja dla `ux` (do makiety): render warunkowy — `card.noComparison` ⇒ tekst „Pierwszy trening tego dnia — brak porównania” (AC-5.2); inaczej linia z `volumeDeltaKg`/`volumeDeltaPercent` (kierunek strzałką/kolorem + tekstem, nie samym kolorem, spójnie z US-6) i opcjonalnie liczniki `compare.up`/`compare.down`/`compare.skipped`.

### 2.7 Trasa `/workout-history` zostaje bez zmian

Żadna z decyzji powyżej nie wymaga nowej trasy — `searchParams` (`plan`, `open`) wystarczają do deep linku i stanu filtra. Brak przekierowań do dodania.

### 2.8 Spójność z Pulpitem (`lib/treningi-hub-stats.ts` vs `lib/workout-history-overview.ts`) — rekomendacja, poza zakresem implementacyjnym tego zadania

Oba moduły liczą tonaż/czas trwania/liczbę serii **z tego samego surowego `workouts.exercises` JSON, ale dwoma niezależnymi zestawami funkcji**: `treningi-hub-stats.ts` ma własne `volumeFromExercises`/`durationMinutesFromDetails`-odpowiednik/`setsDoneFromExercises` (reimplementacja), podczas gdy `workout-history-overview.ts` używa `computeWorkoutDetails` z `lib/workout-history.ts` (inny moduł, z e1RM/PR). To są dwie definicje tej samej logiki biznesowej („ile serii zaliczono”, „jaki tonaż”) — ryzyko rozjazdu realne (AC-10.2), ale **refaktor obu modułów do wspólnego źródła jest zadaniem większym niż ten redesign** (dotyka Pulpitu, nie tylko historii) i nie jest wymagany do spełnienia US-1–US-9 tego zadania.

**Decyzja**: nie refaktorować `treningi-hub-stats.ts` w tym zadaniu. Zamiast tego: `computeHistoryKpis`/filtrowanie klienckie (2.4) używają wyłącznie danych już spójnych wewnątrz `workout-history-overview.ts` (`computeWorkoutDetails`), więc **ten redesign nie pogłębia** istniejącego rozjazdu — tylko go nie naprawia. Wpis do `docs/bledy-do-naprawy/bledy.md` (sekcja 6 niżej) jako osobny temat do rozważenia przez `architekt` przy przyszłym zadaniu obejmującym też Pulpit.

### 2.9 Usuwanie treningu — zostaje server action + rewalidacja, dodanie widocznej akcji to zmiana UI, nie kontraktu

`actions/workout-history.ts` (`deleteCompletedWorkout`) zostaje bez zmian kontraktu. Wymaganie US-7 (widoczna akcja „Usuń” obok przytrzymania) jest w całości rozwiązywalne w `workout-history-session-delete-dialog.tsx` + `workout-history-session-card.tsx` (np. przycisk/ikona w rozwiniętym widoku wywołujący ten sam `setDeleteOpen(true)`, który dziś wywołuje tylko long-press) — bez zmiany server action, bez zmiany bazy. `removedIds` (lokalny stan optimistic update) zostaje jako mechanizm — jest poprawny dla pojedynczej karty wywołanej przez jej właściciela; rozjazd licznika nagłówka po `router.refresh()` (3.1 pkt 6 analizy) jest **niski priorytet** (próba usunięcia na dwóch urządzeniach jednocześnie), do backlogu, nie blokuje.

### 2.10 `planCompareKey` po nazwie planu (zmiana nazwy rozdziela historię) — bez zmiany w tym zadaniu

Ryzyko opisane w analizie (3.1 pkt 8, AC-3.5) jest **istniejącym zachowaniem całego modułu porównań** (`lib/workout-plan-compare-key.ts`), używanym też w ekranie zakończenia treningu (zadanie 005) i edycji. Zmiana tego klucza (np. dodanie stabilnego `workoutPlanId` jako głównego klucza zamiast nazwy) jest decyzją wykraczającą poza ten ekran — wpływa na porównania w `workout-finished-screen.tsx` i PR-y. **Decyzja**: bez zmian w tym zadaniu; AC-3.5 spełnione przez wyświetlenie filtra zgodnie z dzisiejszym zachowaniem (zmiana nazwy = nowy, osobny chip), bez błędu — to jest już dziś poprawne zachowanie, tylko nieoczekiwane. Wpis do backlogu (sekcja 6).

---

## 3. Kontrakt danych — podsumowanie zmian

| Element | Zmiana | Wpływ |
|---|---|---|
| `WorkoutHistoryOverview.sessionsLimitReached: boolean` | NOWE pole | `getWorkoutHistoryOverview`, UI banera limitu (2.5) |
| `computeHistoryKpis(cards, todayKey)` | NOWA eksportowana funkcja (wydzielona z istniejącej pętli) | `lib/workout-history-overview.ts`, reużywana klient+serwer (2.4) |
| `mondayOfWeek` (lokalne w 2 plikach) | USUNIĘTE, zastąpione importem `calendarWeekMondayKey` z `@/lib/local-date` | `workout-history-view.tsx`, `workout-history-overview.ts` (2.2) |
| `page.tsx` `searchParams: { plan?: string; open?: string }` | NOWE — odczyt filtra/deep linku z URL | zgodność z API `searchParams` tej wersji Next.js do zweryfikowania w `node_modules/next/dist/docs/` przed implementacją (2.3) |
| `WorkoutHistoryCard.planOccurrence` | **Pole zostaje w danych** (używane w `[id]/edit/page.tsx` jako „TYDZIEŃ {N}” — poza zakresem tego zadania), ale **nie jest renderowane** w `workout-history-session-card.tsx` (usunięcie `tydz. ${card.planOccurrence}` z linii `meta`, decyzja właściciela 1) | brak zmiany kontraktu; zmiana tylko w komponencie listy |
| `actions/workout-history.ts`, zapytanie Drizzle w `getWorkoutHistoryOverview` (`.limit(400)`) | **Bez zmian** | zgodnie z decyzją właściciela (3) |

Brak zmian w `/api/android/*` i w Java backend (ekran jest ścieżką WWW w WebView, historia nie jest obsługiwana w Javie — potwierdzone w analizie, sekcja 9). Brak nowych zmiennych środowiskowych — brak wpisu w `lib/admin-config-status.ts`.

---

## 4. Wydajność i koszty Turso

- Zero nowych zapytań do bazy względem dzisiejszego stanu (2.4, 2.5) — cały redesign pracuje na danych już pobieranych w jednym zapytaniu `.limit(400)`.
- `computeHistoryKpis` wywoływana ponownie w kliencie przy zmianie filtra to operacja w pamięci (≤400 elementów, liniowa) — pomijalny koszt CPU na urządzeniu użytkownika, bez ruchu sieciowego.
- Payload pozostaje tej samej wielkości (pełne serie wszystkich do 400 sesji) — **nie jest to rozwiązane w tym zadaniu** (US-12 pozostaje Should/poza zakresem v1, zgodnie z decyzją właściciela ograniczającą się do „zasygnalizować limit”). Rekomendacja na przyszłość (nie teraz): ładowanie `exercises` per karta leniwie (osobny mały endpoint na rozwinięcie), zamiast w jednym payloadzie — do rozważenia dopiero jeśli `tester-wydajnosci` zmierzy realny problem.

---

## 5. Android i Java backend

- Ekran jest trasą WWW renderowaną w WebView Androida — brak natywnego ekranu historii do synchronizacji. Zmiana `searchParams` (`plan`, `open`) nie wpływa na natywne linkowanie (deep linki Androida nie celują dziś w `/workout-history` z parametrami — do potwierdzenia przez `backend`, niskie ryzyko).
- Java backend nie obsługuje historii (potwierdzone w analizie, BR-9 / sekcja 9) — brak zmian.

---

## 6. Dług techniczny zidentyfikowany poza zakresem redesignu (do `docs/bledy-do-naprawy/bledy.md`)

1. **Ten sam błąd etykiety „TYDZIEŃ N” istnieje też na ekranie edycji** (`components/workout-history/workout-history-edit-client.tsx:206`, `{initial.weekdayLabel} · TYDZIEŃ {initial.planOccurrence}`) — ta sama mylącą semantyka co naprawiana w liście (US-4), ale poza zakresem tego zadania (dotyczy ekranu `[id]/edit`, nie listy historii).
2. **Dwie niezależne implementacje liczenia tonażu/czasu/serii** (`lib/treningi-hub-stats.ts` własne funkcje vs `lib/workout-history.ts` → `computeWorkoutDetails`) — ryzyko rozjazdu liczb między Pulpitem a historią (AC-10.2), do ujednolicenia w osobnym zadaniu obejmującym oba moduły.
3. **`planCompareKey` po znormalizowanej nazwie planu** rozdziela historię/porównania przy zmianie nazwy dnia planu — istniejące zachowanie całego modułu porównań (używane też w zadaniu 005), zmiana wymagałaby ADR obejmującego `workout-finished-screen.tsx` i PR-y, nie tylko historię.
4. **Rozjazd licznika nagłówka po usunięciu na dwóch urządzeniach** (`removedIds` lokalny + `workoutsTotal` z serwera) — rzadki wyścig, niski priorytet (AC-7.4 pokryte komunikatem błędu, nie synchronizacją liczby w czasie rzeczywistym).

---

## 7. Ryzyka

| Ryzyko | Wpływ | Prawdopodobieństwo | Mitygacja |
|---|---|---|---|
| Klient i serwer liczą KPI inną ścieżką kodu mimo wspólnej funkcji (błąd przy przyszłej zmianie jednego miejsca bez drugiego) | Średni | Niskie (jedna funkcja, jeden import) | Test jednostkowy `computeHistoryKpis` z co najmniej 2 wywołaniami (pełny zbiór + podzbiór) w `tester` |
| `searchParams.plan` z nieznaną/spreparowaną wartością | Niski | Niskie | Wartość tylko porównywana z listą `planFilters.id`, nigdy nie trafia do zapytania SQL (2.3) |
| `rows.length === 400` heurystyka fałszywie pokazuje baner przy dokładnie 400 sesjach bez przycięcia | Niski | Bardzo niskie | Komunikat i tak technicznie prawdziwy (ostatnie 400 to cała historia), nieszkodliwy fałszywy pozytyw |
| Przeniesienie długiej listy odpowiedzialności z jednego pliku do wielu zwiększa liczbę plików do utrzymania | Niski | Pewne (świadomy kompromis) | Każdy plik ma jedną, testowalną odpowiedzialność — niższy koszt zmiany pojedynczej funkcji w przyszłości |
| `page.tsx` `searchParams` async (API tej wersji Next.js) źle zaimplementowane | Średni | Średnie | `backend` czyta `node_modules/next/dist/docs/` przed implementacją (wymóg `AGENTS.md`) |

---

## 8. Następne kroki

1. `ux` (etap 4, równolegle): makieta HTML uwzględniająca brak numeru sesji na karcie (decyzja 1), banner limitu (2.5), linię porównania z poprzednią sesją (2.6), etykietę zakresu statystyk (2.4).
2. Po akceptacji makiet: zadanie implementacyjne (etap 5) — `backend` wydziela `computeHistoryKpis` i `sessionsLimitReached`, `frontend` rozbija komponent wg struktury z sekcji 2.1 i wdraża `use-workout-history-filter.ts`.
3. `tester` (etap 6, w implementacji): test filtra URL + wstecz, test KPI per filtr (w tym pusty podzbiór), test braku regresji w `[id]/edit` (nie dotyka go to zadanie, ale dzieli `lib/workout-history-overview.ts`).
4. Aktualizacja `docs/zespol/wiedza-o-projekcie.md` po implementacji (stan ekranu historii).
5. Wpis w `components/changelog/changelog-data.ts` z `planned: true` na PR implementacyjny.

---

Werdykt etapu 3: **ZATWIERDZONE**. Brak blokad dla etapu `ux` — makieta może powstać na bazie decyzji z sekcji 2 (brak numeru sesji, baner limitu, delta vs poprzednia sesja, statystyki per filtr z etykietą zakresu).
