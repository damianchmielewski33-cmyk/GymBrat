# ADR 0007 — Redesign modułu „Plany treningowe” (architektura, bez implementacji)

- **Karta zadania**: `docs/zadania/008-redesign-planu-treningowego.md`
- **Etap**: 3 — Projekt techniczny (`architekt`). Zero zmian w kodzie produkcyjnym.
- **Wejście**: `docs/analiza/008-redesign-planu-treningowego.md` (etap 1, ZATWIERDZONE, Q1–Q5 otwarte z założeniami).
- **Autor**: architekt (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `ux` (etap 4) i dla przyszłego zadania implementacyjnego (etap 5)

---

## 1. Kontekst

Moduł planu treningowego żyje dziś w `/profile/workout-plan`, w jednym pliku-bogu `components/workout-plan/workout-plan-editor.tsx` (1143 linii), który łączy listę planów, edytor, panel wyboru ćwiczeń, import z pliku i generator „AI” (w rzeczywistości heurystyka bez LLM, `ai/coach.ts`). Katalog ćwiczeń (`lib/workout-exercise-catalog.ts`) to 165 statycznych pozycji bez opisów, cue, sprzętu czy poziomu trudności.

Użytkownik zlecił przebudowę od zera: nowy flow dostępny wyłącznie z szuflady „Menu”, nowy i bogatszy atlas ćwiczeń, oraz całkowite usunięcie funkcji „Stwórz plan z AI” z kodu (nie tylko z UI). Ten dokument odpowiada za architekturę danych i modułów; wygląd ekranów projektuje `ux` w etapie 4 na bazie tego ADR.

Przeczytany kod źródłowy potwierdzający zakres: `components/workout-plan/workout-plan-editor.tsx`, `components/workout-plan/workout-card.tsx`, `db/schema.ts` (`workoutPlans`, `exerciseTechniqueLinks`, `workouts.workoutPlanId`), `lib/workout-plan-types.ts`, `lib/workout-exercise-catalog.ts`, `actions/workout-plan.ts`, `actions/backend.ts` (`aiGeneratePlan`), `ai/coach.ts`, `components/layout/app-menu-button.tsx`, `scripts/codemod-guard-server-actions.mjs`.

---

## 2. Decyzje (ADR skrócone per temat)

### 2.1 Q1 — Miejsce wejścia: szuflada „Menu”, bez stałego panelu bocznego

**Opcje rozważane**
1. Szuflada „Menu” (prawa, `app-menu-button.tsx`) — jedyne wejście, zgodnie z założeniem analityka.
2. Dodatkowo stały panel boczny na desktopie/tablecie (`md:` breakpoint), niezależny od szuflady.

**Decyzja**: Opcja 1. Aplikacja ma dziś jednokolumnowy układ (`APP_SHELL_MAX`) na wszystkich szerokościach — nie istnieje żaden stały panel boczny, więc wprowadzenie go tylko dla planów byłoby niespójne z resztą nawigacji (Treningi, Dieta, Społeczność też żyją w szufladzie/dolnej belce). Stały panel to nowy wzorzec nawigacyjny obejmujący całą aplikację — poza zakresem tego zadania i wymagałby własnego ADR + `ux` całej navigacji.

**Konsekwencje**: wejście „Plany treningowe” trafia do sekcji „Trening” w `components/layout/app-menu-button.tsx` jako odrębny wiersz, osobno od „Treningi” (patrz 2.2). Brak zmian w `app-shell.tsx` (dolna belka, FAB).

### 2.2 Q2 — Rozdzielenie „Start” (Treningi) i „Zarządzanie” (Plany), CTA w pustych stanach zostają

**Opcje rozważane**
1. CTA w pustych stanach Treningów (`NoPlanCard`, `NextWorkoutCard`, `PlanDayRow`, `PlanDaysPanel`) usunięte całkowicie — jedyna droga to szuflada Menu.
2. CTA zostają jako link do nowej listy planów (`/plany`), bez edytora inline w Treningach.

**Decyzja**: Opcja 2, zgodnie z założeniem analityka (AC-1.5, US-15). „Wyłącznie z paska bocznego” rozumiem jako: **zarządzanie planem** (tworzenie/edycja/usuwanie) nie żyje już w Profilu, tylko pod nową trasą dostępną z Menu. To nie oznacza zakazu linkowania do tej trasy z innych miejsc produktu — inaczej użytkownik bez planu w hubie Treningi musiałby pamiętać, że CTA zniknęło, i szukać w Menu, co jest regresją UX. CTA prowadzą do tej samej trasy `/plany`, nigdy do osobnego skróconego edytora.

**Konsekwencje**: `components/treningi/no-plan-card.tsx`, `next-workout-card.tsx`, `plan-day-row.tsx`, `plan-days-panel.tsx`, `plan-day-preview-sheet.tsx` zmieniają link z `/profile/workout-plan` na `/plany` (sekcja 4).

### 2.3 Q3 — Model danych: zostaje „jeden rekord = jeden dzień”, bez migracji schematu

**Opcje rozważane**
1. **Zostać przy obecnym modelu**: tabela `workout_plans` (`id`, `user_id`, `plan_json`, `created_at`, `updated_at`), jeden wiersz = jeden dzień/wariant treningu; grupowanie w UI jest wyłącznie prezentacyjne (sortowanie wg `updated_at` lub kolejności ręcznej).
2. **Nowa encja „program tygodniowy”** nadrzędna nad dniami: nowa tabela `training_programs` (nazwa programu, lista `workout_plan_id` w kolejności) + `workout_plans.program_id` opcjonalne. Wymaga migracji Drizzle, zmiany `getWorkoutPlansWithLastWorkout`, kolejki sesji w Treningach i porównań historii.

**Decyzja**: Opcja 1 — zostajemy przy modelu „dzień” w v1. Uzasadnienie:
- Koszt/ryzyko opcji 2 jest wysoki względem korzyści: trzeba migrować dane istniejących użytkowników (gdzie nie ma dziś żadnej grupy — trzeba by wymyślić heurystykę przypisania dni do programu albo zostawić je jako „bez programu”, co i tak odtwarza dzisiejszy model), przepisać kolejkę treningów (`getWorkoutPlansWithLastWorkout`, `fetchLastWorkoutHintsForPlan`) i ryzykować regresję w historii/postępach (BR-7, BR-8, US-16) — obszary oznaczone jako „nie podlegają czyszczeniu” i krytyczne dla zaufania do danych.
- Problem zgłoszony przez użytkownika („bałagan") jest przede wszystkim wizualno-architektoniczny (plik-bóg, pięć ścieżek na jednym ekranie), nie strukturalny w sensie modelu danych. Rozwiązuje go nowy podział komponentów i flow (sekcja 3), nie zmiana schematu.
- Nazewnictwo „plan” dla pojedynczego dnia to rozjazd pojęciowy wymagający poprawki, ale to zadanie dla `ux` (słownik UI: lista pokazuje karty „Dzień treningowy”, a nie „Plan”), nie dla schematu bazy.
- Grupowanie dni w program to naturalne rozszerzenie v1.1 — zostaje świadomie odłożone (Won't v1, zgodnie z priorytetyzacją analityka), z notatką w ryzykach (sekcja 6).

**Konsekwencje**: `db/schema.ts` (`workoutPlans`), `lib/workout-plan-types.ts` (`WorkoutPlanPayload` v2), `actions/workout-plan.ts` (`getWorkoutPlans`, `saveWorkoutPlan`, `deleteWorkoutPlan`, `getWorkoutPlansWithLastWorkout`, `fetchLastWorkoutHintsForPlan`) zostają **bez zmian kontraktu**. Nowy frontend konsumuje te same server actions.

**Rekomendacja terminologiczna dla `ux`**: w nowym UI nazywać jednostkę „dzień treningowy” (nie „plan”), a słowo „plan” zarezerwować dla przyszłej, nieistniejącej jeszcze encji programu — unika to dalszego pogłębiania rozjazdu pojęciowego, który dziś myli użytkowników (US-2 AC-2.5).

### 2.4 Q4 — Atlas ćwiczeń: **ZMIANA DECYZJI** — tabela `exercises` w Turso + panel admina, nie statyczny plik

> **Decyzja zmieniona po rozmowie z właścicielem produktu** (patrz "Aktualizacja" na końcu dokumentu). Pierwotna rekomendacja architekta (Opcja 1 — statyczny katalog w kodzie) jest **odrzucona**. Właściciel produktu chce dużą, stale kuratorowaną bazę ćwiczeń zarządzaną z panelu admina, nie przez PR w repo. Treść poniżej zastępuje pierwotną sekcję 2.4 w całości.

**Opcje rozważane (ponownie, z nowym kryterium "duża, stale kuratorowana baza")**
1. Statyczny katalog w kodzie, rozszerzony o metadane (pierwotna decyzja) — odrzucona: edycja wymaga PR + deploy na każdą zmianę opisu/techniki/kategorii, co jest nie do przyjęcia przy bazie mającej rosnąć do setek/tysięcy pozycji i być aktualizowana często przez osoby niebędące programistami.
2. **Tabela `exercises` w Turso + panel admina (CRUD)** — admin dodaje/edytuje/dezaktywuje ćwiczenia bez deployu, treść (opis, cue, kategorie, sprzęt, link YouTube) żyje w jednym miejscu zarządzanym operacyjnie.

**Decyzja**: Opcja 2.

**Schemat tabeli `exercises` (Drizzle, `db/schema.ts`)**:

```ts
export const exercises = sqliteTable(
  "exercises",
  {
    // id NIE jest losowym UUID — przy migracji (patrz niżej) przejmuje istniejące,
    // stabilne id z lib/workout-exercise-catalog.ts (np. "c-bench-bar"), żeby zapisane
    // plany (WorkoutPlanPayload.exercises[].catalogId) nie wymagały migracji danych (BR-6).
    id: text("id").primaryKey(),
    name: text("name").notNull(),                     // PL, jak dziś
    categoryId: text("category_id").notNull(),         // partia główna
    secondaryCategoryIds: text("secondary_category_ids", { mode: "json" }).$type<string[]>(),
    aliasesEn: text("aliases_en", { mode: "json" }).$type<string[]>(),
    aliasesPl: text("aliases_pl", { mode: "json" }).$type<string[]>(),   // NOWE — synonimy PL
    equipment: text("equipment", { mode: "json" }).$type<string[]>(),     // NOWE
    difficulty: text("difficulty"),                    // "beginner" | "intermediate" | "advanced", opcjonalne
    // Instrukcja techniki — pole PODSTAWOWE, patrz 2.4b. Nie opcjonalne w UI formularza admina
    // (wymagane przy tworzeniu), ale opcjonalne w schemacie (NOT NULL na poziomie Zod/formularza,
    // nie na poziomie kolumny) — dopuszcza migrację pozycji historycznych bez opisu do czasu uzupełnienia.
    description: text("description"),
    cues: text("cues", { mode: "json" }).$type<string[]>(),
    // Zatwierdzony przez admina film — scala dawną tabelę exercise_technique_links (patrz niżej),
    // zamiast trzymać dwie tabele o tej samej odpowiedzialności ("domyślny link do ćwiczenia").
    techniqueYoutubeUrl: text("technique_youtube_url"),
    techniqueYoutubeTitle: text("technique_youtube_title"),   // tytuł kandydata zapamiętany przy zatwierdzeniu (2.4a), do wyświetlenia bez dodatkowego zapytania do YouTube
    // Soft-delete: ćwiczenia używane w istniejących planach nie mogą zniknąć z FK przy "usunięciu" w adminie.
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
  },
  (t) => [
    index("idx_exercises_category").on(t.categoryId),
    index("idx_exercises_name").on(t.name),
    index("idx_exercises_active").on(t.isActive),
  ],
);
```

**Scalenie z `exercise_technique_links`**: ta tabela zostaje **usunięta** (migracja Drizzle), jej dane (`id`, `youtubeUrl`, `updatedAt`, `updatedByUserId`) przechodzą do nowych kolumn `exercises.techniqueYoutubeUrl` / `updatedAt` / `updatedByUserId` w tym samym skrypcie seed opisanym niżej. Uzasadnienie: dziś to dwie tabele o jednej odpowiedzialności konceptualnej ("metadane ćwiczenia widoczne w atlasie i edytowalne przez admina") — po przejściu katalogu do bazy, trzymanie linku YouTube osobno nie ma już żadnej korzyści (wcześniejszy argument "to pole zmienia się częściej, nie duplikujemy wzorca" przestaje obowiązywać, bo *cała* tabela jest teraz edytowalna, nie tylko link). Jedna tabela = jeden panel admina, jedna ścieżka zapytań, mniej kodu.

**Migracja danych z `lib/workout-exercise-catalog.ts` (165 pozycji) — skrypt seed jednorazowy**:
- Nowy skrypt `scripts/seed-exercises-from-catalog.ts` (analogicznie do istniejących skryptów w `scripts/`), uruchamiany raz przy wdrożeniu tej zmiany: czyta `CATALOG_EXERCISES` + istniejące wiersze `exercise_technique_links`, wstawia do `exercises` z zachowanymi `id`, `name`, `categoryId`, `aliasesEn` oraz dociąga `techniqueYoutubeUrl`/`updatedAt`/`updatedByUserId` z `exercise_technique_links` po `id`. Pola nowe (`description`, `cues`, `equipment`, `difficulty`, `aliasesPl`, `secondaryCategoryIds`) zostają `NULL` dla pozycji historycznych — admin uzupełnia je stopniowo z panelu (patrz 2.4b: pole jest podstawowe *w UI formularza dla nowych wpisów*, ale migracja nie blokuje się na uzupełnieniu 165 opisów na starcie).
- Po migracji `lib/workout-exercise-catalog.ts` jako źródło danych **przestaje być używany** w czasie działania aplikacji (zapytania o katalog idą do `exercises`); plik może zostać w repo tylko jako historyczne źródło seeda albo zostać usunięty po potwierdzeniu, że seed się powiódł — decyzja operacyjna `backend` przy implementacji, nie wpływa na architekturę.
- Stałe `id` (np. `c-bench-bar`) są warunkiem brzegowym migracji: zero zmian w zapisanych `WorkoutPlanPayload.exercises[].catalogId` (BR-6, AC-10.1 — bez zmian w stosunku do pierwotnego ADR, tylko inne miejsce przechowywania).

**Panel admina — rozszerzenie `components/admin/admin-exercises-client.tsx`, nie nowy moduł**:
- Decyzja: **rozszerzyć istniejący komponent**, nie tworzyć równoległego. Dzisiejszy panel już ma listę, filtr po kategorii/query, paginację (`PAGE_SIZE = 40`) i edycję linku YouTube per wiersz — to jest w 80% ten sam UI, jaki potrzebuje pełny CRUD ćwiczeń. Zmiany: formularz wiersza/modal rozszerzony o pola `name`, `categoryId` (select), `secondaryCategoryIds` (multiselect), `aliasesEn`/`aliasesPl` (tagi), `equipment` (tagi), `difficulty` (select), `description` (textarea, wymagany w formularzu dla nowych pozycji), `cues` (lista), plus akcje "Dodaj nowe ćwiczenie" i "Dezaktywuj" (soft-delete, `isActive = false` — nie `DELETE`, żeby nie łamać FK z planami i prywatnymi notatkami użytkowników, patrz 2.4c).
- Endpointy admina: rozszerzenie dzisiejszego `GET /api/admin/exercises/technique` o pełny CRUD: `GET /api/admin/exercises` (lista + filtr + paginacja po stronie serwera, nie całość na klienta — patrz koszt Turso niżej), `POST /api/admin/exercises` (nowe), `PATCH /api/admin/exercises/[id]` (edycja, w tym zatwierdzenie linku z 2.4a), `PATCH /api/admin/exercises/[id]/deactivate`. Wszystkie chronione istniejącym mechanizmem autoryzacji admina (jak dziś `/api/admin/exercises/technique`), walidacja Zod serwerowa dla każdego pola (BR-4/BR-11 — treść redakcyjna wpisywana w produkcji bez PR-review wymaga teraz walidacji długości/formatu jako jedynej bariery jakości, skoro code review przestaje być barierą).

**Koszt/limity Turso (plan darmowy) przy dużej, rosnącej tabeli**:
- Rozmiar: nawet "bardzo rozbudowana" baza ćwiczeń to realistycznie niskie tysiące wierszy (nie miliony) — rozmiar na dysku jest nieistotny dla limitu storage darmowego planu Turso. Właściwy koszt to **liczba odczytów** (atlas jest czytany bardzo często — każde otwarcie ekranu wyboru ćwiczenia).
- Mitygacja: atlas i picker ćwiczeń **nie odpytują Turso przy każdym żądaniu**. Strony `app/(dashboard)/plany/atlas/**` są Server Components, dane ćwiczeń wczytywane przez funkcję cache'owaną `unstable_cache`/tag-based cache Next.js (ten sam mechanizm co inne dane rzadko zmieniane w projekcie), z `revalidateTag("exercises")` wywoływanym tylko przy zapisie w panelu admina (`POST`/`PATCH`/deactivate). Efekt: odczyty z Turso tylko po zmianie przez admina, nie per użytkownik/per żądanie — koszt pozostaje praktycznie taki jak dla dzisiejszego statycznego pliku, mimo przejścia do bazy.
- Wyszukiwarka w atlasie (`atlas-exercise-list.tsx`, dziś filtruje tablicę w pamięci klienta): przy kilku tysiącach wierszy w cache'owanym zestawie, filtrowanie po stronie serwera (RSC) lub klienta na już wczytanym, zcache'owanym zestawie w pamięci jest wystarczające — **indeks pełnotekstowy (SQLite FTS5) nie jest potrzebny w v1** przy tej skali; zostaje jako opcja do rozważenia w przyszłości, jeśli baza przekroczy rząd dziesiątek tysięcy pozycji lub wyszukiwanie przez cache okaże się zbyt wolne (próg do zmierzenia przez `backend`, nie zakładany teoretycznie).
- Paginacja w panelu admina: zostaje (dzisiejszy `PAGE_SIZE = 40` + filtr po kategorii/query), bo to jedyne miejsce z realnym ryzykiem wielu zapytań przy przewijaniu dużej listy bez cache (admin edytuje, więc świeżość ważniejsza niż cache tutaj) — endpoint admina **nie** korzysta z `unstable_cache` (musi widzieć własne zmiany natychmiast), tylko zapytanie z `LIMIT`/`OFFSET` indeksowane po `idx_exercises_category`/`idx_exercises_name`.

**Odpowiedź do użytkownika (Q4, zaktualizowana)**: baza ćwiczeń przechodzi do tabeli `exercises` w Turso z pełnym CRUD w panelu admina (rozszerzenie istniejącego `admin-exercises-client.tsx`). Odczyty w aplikacji użytkownika są cache'owane i rewalidowane tylko przy zmianie przez admina, więc koszt Turso pozostaje zbliżony do dzisiejszego pliku statycznego mimo przejścia do bazy. `exercise_technique_links` zostaje scalone do `exercises` (jedna tabela, jeden panel) w ramach tej samej migracji.

### 2.4a — Linki YouTube do ćwiczeń: wyszukiwanie kandydatów przez YouTube Data API + ręczna akceptacja admina

Potwierdzenie mechanizmu zarekomendowanego koordynatorowi i zaakceptowanego przez właściciela produktu: **nie** generujemy linków "czystym AI" (modele językowe halucynują nieistniejące `videoId`), tylko wyszukujemy realne kandydatury przez oficjalne API, a admin wybiera i zatwierdza.

**Przepływ**:
1. W panelu admina (rozszerzony `admin-exercises-client.tsx`, wiersz/modal ćwiczenia) przycisk "Szukaj filmu" wywołuje nowy endpoint `POST /api/admin/exercises/[id]/youtube-search` (chroniony jak pozostałe endpointy admina).
2. Endpoint woła **YouTube Data API v3** (`search.list`, `type=video`) z zapytaniem złożonym z `name` + `aliasesEn`/`aliasesPl` ćwiczenia (np. "bench press technique" dla `c-bench-bar`), zwraca do 5 kandydatów: `videoId`, `title`, `channelTitle`, miniaturę.
3. Admin w UI widzi listę kandydatów (miniatura + tytuł + kanał + link do podglądu na YouTube) i klika "Zatwierdź" przy jednym z nich — **żaden link nie trafia do bazy automatycznie**, zawsze wymaga ręcznego wyboru człowieka.
4. Zatwierdzenie zapisuje `techniqueYoutubeUrl` (zbudowany z `videoId`, np. `https://www.youtube.com/watch?v=...`, przez istniejącą `normalizeYoutubeUrl`) i `techniqueYoutubeTitle` w wierszu `exercises` (`PATCH /api/admin/exercises/[id]`), z `updatedByUserId`/`updatedAt` jak dziś.
5. Admin może też wkleić link ręcznie (dzisiejsze zachowanie zostaje jako alternatywa do wyszukiwania) — wyszukiwanie jest ułatwieniem, nie jedyną ścieżką.

**Konfiguracja**: nowa zmienna środowiskowa `YOUTUBE_API_KEY` (klucz API Google Cloud z włączonym "YouTube Data API v3", limit kwoty domyślnie 10 000 jednostek/dzień, `search.list` kosztuje 100 jednostek — ok. 100 wyszukiwań/dzień na koncie darmowym, wystarczające dla pracy redakcyjnej, nie dla ruchu użytkowników, bo wyszukiwanie dzieje się wyłącznie w panelu admina). Wymaga wpisu w `lib/admin-config-status.ts` (funkcja "Wyszukiwanie filmów techniki w panelu admina" — baner + link do konfiguracji, gdy zmienna nie jest ustawiona na hostingu) oraz opisu w `env.example`, zgodnie z `AGENTS.md`. Bez klucza: przycisk "Szukaj filmu" pozostaje widoczny, ale zwraca komunikat o brakującej konfiguracji (nie błąd 500) — ręczne wklejanie linku działa niezależnie.

**Dlaczego nie "czyste AI"**: modele generatywne bez wywołania zewnętrznego narzędzia zwracają syntaktycznie poprawne, ale nieistniejące lub niepowiązane z treścią `videoId` (znane ograniczenie — brak dostępu do rzeczywistego indeksu YouTube). Wyszukiwanie przez YouTube Data API zwraca tylko realne, istniejące filmy; ryzyko "złego" wyniku (np. nieaktualny/niskiej jakości film) jest i tak mitygowane przez wymóg ręcznej akceptacji admina w kroku 3.

### 2.4b — Instrukcja techniki (opis) jako pole podstawowe

**Zmiana wobec pierwotnego ADR**: `description`/`cues` nie są "nice to have" — to pole podstawowe, zawsze dostępne w karcie ćwiczenia atlasu (AC-8.4 z pierwotnej analizy traktował brak pola jako normalny stan "sekcja ukryta"; teraz: formularz admina **wymaga** wypełnienia `description` przy tworzeniu nowego ćwiczenia od zera — walidacja Zod `min(20)` znaków na poziomie endpointu `POST /api/admin/exercises`). Film YouTube (2.4a) jest dodatkiem do opisu, nigdy jego zamiennikiem — ćwiczenie może mieć sam opis bez filmu i być w pełni użyteczne; nie może (dla nowych wpisów) mieć filmu bez opisu.

Dla 165 pozycji migrowanych z katalogu statycznego (2.4), `description` startuje jako `NULL` — to świadomy dług startowy uzupełniany przez admina z panelu, nie blokada migracji. UI atlasu pokazuje dla takich pozycji stan przejściowy "Opis w przygotowaniu" (do zaprojektowania przez `ux`), nie błąd.

### 2.4c — Prywatne notatki i link YouTube użytkownika: nowa, lekka tabela `user_exercise_notes`

**Nowa decyzja**, odrębna od 2.4a/2.4b: każdy użytkownik może dodać do dowolnego ćwiczenia z atlasu **własny, prywatny** link YouTube i/lub notatkę tekstową — widoczny tylko dla niego. To nie jest to samo co `exercises.techniqueYoutubeUrl` (publiczny, zatwierdzony przez admina, wspólny dla wszystkich) i nie jest to samo co `techniqueYoutubeUrl` per-ćwiczenie-w-planie opisane w 2.6 (który jest polem *planu*, nie atlasu) — to trzecie, niezależne miejsce przechowywania linku, celowo.

**Schemat (Drizzle, `db/schema.ts`)**:

```ts
export const userExerciseNotes = sqliteTable(
  "user_exercise_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    personalYoutubeUrl: text("personal_youtube_url"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("uq_user_exercise_notes_user_exercise").on(t.userId, t.exerciseId), // jeden wpis per użytkownik per ćwiczenie — "Edytuj", nie "Dodaj kolejny"
    index("idx_user_exercise_notes_user").on(t.userId),
  ],
);
```

- Autoryzacja na poziomie zasobu: wszystkie zapytania filtrują po `userId` z sesji (jak reszta danych wrażliwych w projekcie) — serwer nigdy nie zwraca notatek innego użytkownika, nie ma trasy publicznej do tej tabeli.
- **Bez bramki prawnej/moderacji**: to pole jest prywatne, niepubliczne, nie jest współdzielone z innymi użytkownikami i nie jest treścią UGC w sensie "treści widoczne przez innych" (różni się od np. postów społeczności) — nie wymaga tych samych reguł co publiczny komentarz czy zdjęcie w społeczności. Potwierdzenie: `prawnik` był pominięty w tym zadaniu (karta zadania, etap 1) z uzasadnieniem "ta sama domena — plany/ćwiczenia"; ta ocena zostaje aktualna także dla tej tabeli, bo link/notatka jest analogiczna do istniejącego pola `techniqueYoutubeUrl` per ćwiczenie-w-planie (2.6), które już jest prywatne per użytkownik i nie przechodziło przez `prawnik` jako osobna kategoria.
- UI: karta ćwiczenia w atlasie (`atlas-exercise-card.tsx`) dostaje dodatkową, oznaczoną jako prywatna sekcję "Twoja notatka" (pole tekstowe + pole linku), edytowalną inline, zapisywaną przez nową, małą server action `actions/user-exercise-notes.ts` (`getUserExerciseNote`, `saveUserExerciseNote`) — nie przez panel admina, nie przez `exercises`.
- Brak wpływu na koszt Turso ponad to, co już zakładano dla danych użytkownika (jedna mała tabela, zapytania po `userId`+`exerciseId` z unikalnym indeksem, zero ryzyka N+1 przy liście — ładowana razem z kartą jednego ćwiczenia, nie z całym atlasem).

### 2.5 Q5 — Import z pliku: krok podglądu przed zapisem

**Opcje rozważane**
1. Zostaje dzisiejszy przepływ: `POST /api/workout-plans/import` parsuje i **natychmiast zapisuje** jeden lub więcej wierszy `workout_plans`, potem przekierowuje do edycji.
2. Dwuetapowy: `POST /api/workout-plans/import/preview` parsuje i zwraca strukturę (bez zapisu), UI renderuje podgląd z checkboxami dni/ćwiczeń, `POST /api/workout-plans/import/confirm` zapisuje tylko zaznaczone pozycje.

**Decyzja**: Opcja 2, zgodnie z rekomendacją analityka (AC-7.1, AC-7.2, BR-3).

**Dopisek po decyzji właściciela produktu**: dokładność odczytu plików jest wymogiem krytycznym ("system nie może się mylić"), nie tylko wygodą UX — poniższy projekt kroku podglądu jest rozszerzony o wskaźnik pewności per pozycja i obowiązkową weryfikację niepewnych pozycji (patrz akapit "Pewność parsowania" niżej), zamiast prostego podglądu checkboxów z pierwotnej wersji.

**Projekt techniczny kroku podglądu**:
- Nowy endpoint `POST /api/workout-plans/import/preview`: te same parsery (`lib/pdf/workout-plan-import.ts`, `lib/docx/workout-plan-import.ts`, `lib/excel/workout-plan-import.ts`), ta sama walidacja (CSRF, limit 8 MB, typ plików, rate limit) — **zwraca JSON** (`{ ok: true, days: ParsedWorkoutDay[] }` lub błąd), nie zapisuje nic w bazie. `ParsedWorkoutDay` rozszerza `WorkoutPlanPayload` o metadane pewności opisane niżej (typ żyje tylko w warstwie importu, nie zmienia `WorkoutPlanPayload` zapisywanego do bazy — `confirm` odrzuca te pola przed wywołaniem `saveWorkoutPlan`).
- Stan przejściowy: wynik podglądu żyje **tylko w pamięci klienta** (React state w kreatorze, nie w bazie, nie w cookie) — plan po stronie klienta ma checkboxy per dzień i per ćwiczenie; odznaczone pozycje są filtrowane przed wysłaniem kroku zatwierdzenia. To unika nowej tabeli „szkiców importu” i nowego stanu do czyszczenia (brak TTL do zarządzania, brak dodatkowych wierszy w Turso).
- `POST /api/workout-plans/import/confirm`: przyjmuje `{ days: WorkoutPlanPayload[] }` (już przefiltrowany przez klienta) + ponowna walidacja Zod serwerowa tych samych limitów co `saveWorkoutPlan` (nie ufamy klientowi — BR-4) — zapisuje przez `saveWorkoutPlan` w pętli (reużycie istniejącej akcji, nie duplikacja logiki zapisu).
- Ryzyko: rozbicie jednego requesta na dwa zwiększa powierzchnię ataku (upload dużego pliku + ponowne przesłanie dużej struktury JSON w drugim kroku). Mitygacja: limit liczby dni/ćwiczeń w `confirm` identyczny z limitem w `preview` (żeby ktoś nie doklejał dni między krokami) + limit wielkości payloadu `confirm` (np. 256 KB, wystarczające dla ~30 ćwiczeń × kilka dni).
- Nazewnictwo rate limit: dzisiejszy bucket `bodyReportImport` używany dla importu planu jest przypadkowym współdzieleniem z raportami ciała (różna domena, ten sam klucz) — **do naprawy przy implementacji**: nowy bucket dedykowany `workoutPlanImport` dla obu endpointów (`preview` i `confirm`), żeby limity jednej funkcji nie zjadały budżetu drugiej. Niskie ryzyko, nie blokuje ADR, zapisane w sekcji 6 (ryzyka) i do `docs/bledy-do-naprawy/bledy.md` jeśli nie zostanie zrobione w tym samym zadaniu implementacyjnym.

**Pewność parsowania — wskaźnik per wykryta pozycja i obowiązkowa weryfikacja**:
- Każdy parser (`lib/pdf/...`, `lib/docx/...`, `lib/excel/...`) zwraca dla każdej wykrytej pozycji (dzień, ćwiczenie, zestaw serii/powtórzeń) pole `confidence: "high" | "low"` zamiast dotychczasowego bezwarunkowego zaufania do wyniku parsowania. Reguła przypisania (ustalana per format pliku przez `backend` przy implementacji, orientacyjnie): `high` gdy struktura jest jednoznaczna (np. tabela Excel z nagłówkami kolumn rozpoznanymi 1:1, lista Word z regularnym wzorcem "ćwiczenie — serie x powtórzenia"); `low` gdy parser musiał zgadywać (np. PDF bez tabel, tekst łamany w locie, liczby wywnioskowane przez wyrażenie regularne z niejednoznacznego formatu, brak jednostki przy liczbie).
- UI podglądu (`import-preview-step.tsx`) oznacza wizualnie pozycje `low` (np. ramka/ikona ostrzeżenia + etykieta "Do sprawdzenia") i **blokuje przycisk "Zatwierdź import"**, dopóki użytkownik nie otworzył/potwierdził każdej pozycji `low` ręcznie (checkbox "Sprawdziłem" per pozycja albo wymuszone rozwinięcie szczegółów — decyzja wizualna dla `ux`, wymóg funkcjonalny jest wiążący: niepewna pozycja nie może przejść do zapisu bez jawnego potwierdzenia człowieka). Pozycje `high` zachowują się jak w pierwotnym projekcie (checkbox włącz/wyłącz, bez dodatkowego kroku).
- Dopasowanie nazwy ćwiczenia do atlasu (fuzzy match): po przejściu do tabeli `exercises` (2.4), nazwa sparsowana z pliku (często inna forma/skrót/literówka) jest porównywana z `exercises.name` + `aliasesEn`/`aliasesPl` przez nową funkcję `lib/workout-plan/match-exercise-name.ts` (dopasowanie tokenowe/odległość edycji, bez nowej zależności zewnętrznej — wystarczy prosta heurystyka na małym, zcache'owanym zestawie, patrz 2.4 koszt Turso). Wynik: dopasowanie jednoznaczne z wysokim podobieństwem → podgląd pokazuje nazwę z atlasu + `catalogId` wypełniony automatycznie (traktowane jak `confidence: "high"` dla tej pozycji, niezależnie od pewności reszty parsowania wiersza); dopasowanie niejednoznaczne (kilku kandydatów podobnych) lub brak dopasowania → `confidence: "low"` wymuszony dla nazwy, UI pokazuje selektor "Wybierz z atlasu" lub "Dodaj jako własne ćwiczenie" (US-5), żeby import nie tworzył cichych duplikatów nazw niespójnych z atlasem (np. "wyciskanie na ławce" vs. istniejące "Wyciskanie sztangi na ławce poziomej").
- `POST /api/workout-plans/import/confirm` nadal przyjmuje tylko czyste `WorkoutPlanPayload[]` (bez pól `confidence`/kandydatów dopasowania — te są wyłącznie stanem UI kroku podglądu, nie trafiają do zapisu) i stosuje te same limity/walidację Zod co dziś opisano w tej sekcji (bez zmian).

**Odpowiedź do użytkownika (Q5)**: tak, podgląd wchodzi w v1, parsery bez zmian logiki parsowania jako takiej, ale rozszerzone o jawny wskaźnik pewności i dopasowanie do atlasu — zgodnie z wymogiem "system nie może się mylić" ustalonym przez właściciela produktu.

### 2.6 Linki techniki — **trzy** poziomy po decyzjach właściciela produktu (zaktualizowane, było: dwa)

Pierwotna wersja tej sekcji opisywała dwa miejsca (`techniqueYoutubeUrl` per plan, `exercise_technique_links` per `catalogId` w adminie). Po decyzjach z sekcji 2.4/2.4a/2.4c jest to teraz **trzy** niezależne poziomy, każdy z inną widocznością i innym właścicielem danych:

1. **Atlas, publiczny, kuratorowany przez admina**: `exercises.techniqueYoutubeUrl` (dawniej `exercise_technique_links[catalogId]`, scalone do jednej tabeli — patrz 2.4) + `description`/`cues` (2.4b). Widoczny dla wszystkich użytkowników, jedno źródło prawdy, ustawiany wyłącznie przez wyszukiwanie YouTube Data API + ręczną akceptację (2.4a) albo ręczne wklejenie w panelu. Brak linku = „Brak filmu” (AC-8.5), ale `description` jest i tak dostępny (2.4b) — atlas nigdy nie jest "pusty" nawet bez filmu.
2. **Plan, prywatny, per dzień treningowy**: pole `techniqueYoutubeUrl` w `WorkoutPlanExercise` — nadpisanie *w kontekście konkretnego dnia planu* użytkownika, jak w pierwotnej wersji ADR. Wstępnie wypełniane z poziomu 1, jeśli użytkownik jeszcze nie ustawił własnego: `plan.techniqueYoutubeUrl ?? exercises.techniqueYoutubeUrl ?? null` (ta sama logika co pierwotnie, inne miejsce odczytu — tabela `exercises` zamiast `exercise_technique_links`). Do wykonania przez `backend` w `actions/workout-plan.ts`/komponentach wyboru ćwiczenia.
3. **Atlas, prywatny, per użytkownik, NOWY (2.4c)**: `userExerciseNotes.personalYoutubeUrl` + `note` — widoczny tylko dla danego użytkownika, niezależnie od tego, czy ma jakiś plan w ogóle. To nie jest nadpisanie poziomu 1 dla innych — każdy użytkownik widzi własną notatkę na karcie ćwiczenia w atlasie, obok (nie zamiast) publicznego linku admina.

**Dlaczego trzy, a nie scalenie 2 i 3**: poziom 2 (plan) ma sens tylko w kontekście konkretnego dnia treningowego i zanika razem z usunięciem dnia; poziom 3 (atlas, prywatny) jest trwały i niezależny od istnienia jakiegokolwiek planu — użytkownik może przeglądać atlas i zapisywać sobie notatki bez układania planu. Scalenie tych dwóch pól w jedno wymagałoby albo duplikowania zapisu przy każdym dodaniu ćwiczenia do planu, albo wiązania notatki atlasu z planem, co jest nieintuicyjne (notatka "zniknęłaby" po usunięciu dnia). Osobne, lekkie tabele/pola są prostsze i jedna funkcjonalność ma jedno miejsce (poziom per kontekst, nie per typ danych).

Tekst pomocy w `components/admin/admin-exercises-client.tsx` ("Główne linki... ustawiasz przy układaniu planu") zmienia się na: "Te linki są domyślną techniką w atlasie (wraz z opisem/instrukcją); użytkownik może nadpisać własnym linkiem w swoim planie albo zapisać sobie prywatną notatkę w atlasie — żadna z tych nadpisań nie jest widoczna dla innych użytkowników."

---

## 3. Architektura modułu — struktura katalogów i komponentów

Cel: zero plików-bogów, jedna odpowiedzialność per komponent/hook, podział zgodny z istniejącą konwencją `components/<domena>/`.

```
app/(dashboard)/
  plany/
    page.tsx                      # Lista dni treningowych (US-2) — RSC, czyta getWorkoutPlansWithLastWorkout
    nowy/page.tsx                 # Kreator: wybór "Od zera" / "Z pliku" (US-3, US-11)
    [id]/page.tsx                 # Edytor dnia (US-3, US-6)
    import/page.tsx               # Krok podglądu importu (US-7) — osobna trasa, nie modal pełnoekranowy
    atlas/page.tsx                # Atlas: lista partii (US-8, US-9)
    atlas/[categoryId]/page.tsx   # Lista ćwiczeń partii
    atlas/[categoryId]/[exerciseId]/page.tsx  # Karta ćwiczenia (US-8.3)

app/(dashboard)/profile/
  workout-plan/page.tsx           # ZOSTAJE tylko jako redirect 308 -> /plany (lub /plany/[id] z ?edit=)

components/workout-plan/          # reużywalne UI dnia/ćwiczenia (nie strony)
  plan-list.tsx                   # Lista kart dni (zastępuje listę w edytorze)
  plan-list-item.tsx
  plan-empty-state.tsx            # US-2 AC-2.2
  plan-editor-form.tsx            # Formularz dnia: nazwa + lista ćwiczeń (bufor, "Zapisz"/"Odrzuć zmiany")
  plan-exercise-row.tsx           # Jeden wiersz ćwiczenia (serie/powt./RIR/tempo/notatka/YouTube/superseria)
  plan-exercise-row-mobile.tsx    # Wariant kompaktowy telefonu (US-14), albo responsywny w jednym pliku — do ux
  unsaved-changes-guard.tsx       # Hook/komponent: potwierdzenie przy zamknięciu z niezapisanymi zmianami (AC-3.5)
  draft-autosave.ts               # Hook: zapis szkicu do localStorage, odczyt przy wejściu (AC-3.6)
  delete-plan-dialog.tsx          # Dialog (nie window.confirm) — usunięcie dnia
  delete-exercise-undo-toast.tsx  # Toast z cofnięciem usunięcia ćwiczenia (AC-6.2)

components/workout-plan/import/
  import-upload-step.tsx          # Wybór pliku (reużywa dzisiejszą logikę workout-plan-word-import.tsx)
  import-preview-step.tsx         # Podgląd dni/ćwiczeń z wyraźnym wskaźnikiem pewności per pozycja i blokadą zatwierdzenia dla pozycji niepewnych (zaktualizowane, 2.5)

components/workout-plan/atlas/
  atlas-category-grid.tsx         # Kafelki partii z ikoną/sylwetką (US-9)
  atlas-exercise-list.tsx         # Lista ćwiczeń partii + wyszukiwarka (czyta z cache'owanego zestawu `exercises`, patrz 2.4)
  atlas-exercise-card.tsx         # Karta ćwiczenia pełna (US-8.3) + sekcja "Twoja notatka" (prywatna, 2.4c)
  exercise-picker-sheet.tsx       # Sheet wyboru ćwiczenia W KONTEKŚCIE edytora planu (US-4) — reużywa atlas-exercise-list w trybie "picker"
  custom-exercise-form.tsx        # Dodanie własnego ćwiczenia (US-5)

components/admin/
  admin-exercises-client.tsx      # ROZSZERZONY (nie nowy moduł): pełny CRUD `exercises` + wyszukiwanie kandydatów YouTube (2.4, 2.4a) — zastępuje dzisiejszy zakres "tylko link techniki"

lib/workout-plan/                 # logika bez UI (testowalna w izolacji)
  plan-draft.ts                    # jedna funkcja domyślnych wartości ćwiczenia (3 serie/10 powt./RIR 1) — zastępuje 4 duplikaty z dzisiejszego edytora (problem 4.1-7)
  plan-validation.ts               # Zod schema limitów (BR-4, BR-5) — używana i w UI (react-hook-form), i w server action (jedno źródło prawdy)
  plan-draft-storage.ts            # localStorage dla AC-3.6 (szkic), namespaced per planId/"new"
  match-exercise-name.ts           # NOWY — fuzzy match nazwy sparsowanej z importu do `exercises.name`/aliasów (2.5)

lib/exercises/                     # NOWY katalog — zapytania/cache do tabeli `exercises` (zastępuje rolę `lib/workout-exercise-catalog.ts` w runtime)
  exercises-repository.ts          # zapytania Drizzle (lista, po kategorii, po id) + `unstable_cache`/`revalidateTag("exercises")` (koszt Turso, patrz 2.4)
  youtube-search.ts                # wrapper na YouTube Data API `search.list` (2.4a), używany tylko z panelu admina

lib/workout-exercise-catalog.ts   # ŹRÓDŁO SEEDA tylko na czas migracji (2.4) — po migracji nieużywany w runtime, decyzja o usunięciu pliku przy implementacji
lib/resolve-exercise-muscles.ts   # ZOSTAJE (fallback secondary, preferBackView)
lib/infer-muscle-category.ts      # ZOSTAJE (fallback dla starych własnych ćwiczeń zapisanych jako string)

actions/workout-plan.ts           # ZOSTAJE (kontrakt bez zmian) + nowe akcje poniżej
actions/workout-plan-import.ts    # NOWY: previewWorkoutPlanImport, confirmWorkoutPlanImport (zamiast/obok route.ts — do decyzji backend: server action vs route handler, patrz 4.3)
actions/user-exercise-notes.ts    # NOWY: getUserExerciseNote, saveUserExerciseNote (2.4c) — autoryzacja po userId z sesji

scripts/seed-exercises-from-catalog.ts  # NOWY — skrypt jednorazowy: CATALOG_EXERCISES + exercise_technique_links -> exercises (2.4)
```

**Dlaczego ten podział**: każdy plik ma jedną odpowiedzialność (lista vs formularz vs wiersz vs atlas vs import), zgodnie z zasadą „jedna funkcjonalność w jednym miejscu” z `docs/zespol/przeplyw.md`. `lib/workout-plan/plan-validation.ts` jako jedno źródło walidacji eliminuje dzisiejszy problem 4.1-7 (zduplikowana logika domyślnych wartości w czterech miejscach) i 4.1-8 (brak limitów serwerowych) — ten sam Zod schema importowany przez formularz (walidacja natychmiastowa) i przez `saveWorkoutPlan` (walidacja serwerowa, nie do obejścia).

`workout-card.tsx` (`WorkoutCard`) — potwierdzam martwy kod (brak importów w repo) — **do usunięcia** w ramach tego zadania, nie czeka na osobne porządki.

---

## 4. Routing, przekierowania i rewalidacja

### 4.1 Nowe trasy i przekierowania (AC-1.3, AC-1.4)

| Stara trasa | Nowa trasa | Mechanizm |
|---|---|---|
| `/profile/workout-plan` | `/plany` | `redirect()` (308, trwałe) w `app/(dashboard)/profile/workout-plan/page.tsx` — plik zostaje jako cienki redirect, nie usuwany, żeby zakładki/historia przeglądarki i ewentualne odwołania z Androida (WebView) nie dostały 404 |
| `/profile/workout-plan?edit=<id>` | `/plany/<id>` | Odczyt `searchParams.edit` w tym samym pliku redirect, `redirect(`/plany/${editId}`)` gdy obecny, inaczej `redirect("/plany")` |

Trasa `/workout-plan` (hub Treningi — start sesji) **nie zmienia się** — to inna funkcja (start, nie zarządzanie), zgodnie z analizą (poza zakresem 2.2).

### 4.2 Punkty wejścia do przepięcia (z sekcji 3.3 analizy — potwierdzenie i decyzja per wiersz)

| Miejsce | Nowy link |
|---|---|
| `app-menu-button.tsx`, sekcja "Trening" | Dodać wiersz **"Plany treningowe"** → `/plany` (nowy, odrębny od istniejącego "Plan treningowy" → `/workout-plan`, które zmienia etykietę na **"Treningi"**, zgodnie z AC-1.5 — unika dwóch wierszy nazwanych podobnie) |
| `no-plan-card.tsx`, `next-workout-card.tsx`, `plan-day-row.tsx`, `plan-days-panel.tsx`, `plan-day-preview-sheet.tsx` | `/plany` (zob. 2.2) |
| `app/api/workout-plans/import/route.ts` → zastępowany przez `actions/workout-plan-import.ts` (4.3), `revalidatePath` celuje w `/plany` i `/plany/[id]` |
| `actions/workout-plan.ts`, 6× `revalidatePath` | Zmiana ścieżek na `/plany`, `/plany/[id]`, zachowanie rewalidacji `/workout-plan` (hub czyta też te dane) |
| `admin-exercises-client.tsx` | Tekst pomocy zaktualizowany (2.6) |
| `lib/reminders-schedule.ts`, `lib/web-push.ts`, `ReminderReceiver.java` (Android), `app/(dashboard)/start-workout/page.tsx` | **Bez zmian** — kierują do `/workout-plan` (start), nie do zarządzania |
| `docs/workout-plan-creation.json` | Aktualizacja `uiRoute`/`relatedRoutes` w ramach implementacji |
| `lib/auth-public-paths.test.ts` | Sprawdzić czy `/plany` wymaga `mustCompleteProfile` tak jak `/workout-plan` dziś — **tak, ten sam kontrakt** (obie trasy wymagają zalogowania i uzupełnionego profilu identycznie, AC-1.6) |

### 4.3 Import: server action czy route handler?

**Opcje**: (a) zostać przy `app/api/workout-plans/import/route.ts` jako route handler (dzisiejszy wzorzec — multipart/form-data, trudny do wywołania przez `"use server"` actions bez dodatkowej pracy z `FormData`), rozbity na `/preview` i `/confirm`; (b) przenieść całość do server actions.

**Decyzja**: (a) — route handlery zostają dla upload pliku (multipart), bo server actions w tej wersji Next.js obsługują `FormData`, ale upload pliku + CSRF + rate limit już działają jako route handler i nie ma powodu migrować wzorca tylko dla tego zadania. Nowe endpointy: `POST /api/workout-plans/import/preview` (zwraca podgląd, nie zapisuje), `POST /api/workout-plans/import/confirm` (zapisuje, przyjmuje JSON nie plik). Katalog `actions/workout-plan-import.ts` wymieniony w sekcji 3 **koryguję**: to będą route handlery pod `app/api/workout-plans/import/`, nie server actions — ujednolicenie z dzisiejszym `route.ts`. (Poprawka do uwzględnienia przez `backend` — nie zmienia architektury, tylko lokalizację plików.)

---

## 5. Usunięcie funkcji AI — plan bezpiecznego usuwania

Potwierdzam listę analityka jako kompletną względem przeszukania kodu wykonanego w tym ADR (`grep` na `@/ai/coach` importerów — wynik: **tylko `actions/backend.ts`**, poza plikiem `ai/coach.ts` samym). Kolejność usuwania (żeby `tsc`/`lint` były zielone na każdym kroku, nie tylko na końcu):

1. **UI najpierw**: `components/workout-plan/workout-plan-editor.tsx` — ale ten plik i tak jest całkowicie przepisywany (sekcja 3), więc w praktyce kafelek AI (linie ~580-698) po prostu **nie ma odpowiednika** w nowym `plan-editor-form.tsx`. Nie ma potrzeby "wycinać" ze starego pliku, jeśli stary plik jest zastępowany nowym zestawem komponentów — stary plik usuwany w całości po migracji ekranu.
2. `actions/ai-workout-plan.ts` — usunąć cały plik (`generateAndSaveAiWorkoutPlans`).
3. `actions/backend.ts` — usunąć `aiGeneratePlan` (linie ~257-343 wg odczytu w tym ADR: schema `aiPlanSchema` + funkcja), usunąć import `generateTrainingPlan`, `TrainingPlanInput` z `@/ai/coach` (zostawić `analyzeBodyPhoto`, `AiImage` — używane przez `aiAnalyzePhoto`, zostaje). **Sprawdzić przy implementacji**: `loadTodaysNutritionSummary` i mapowanie `activityMap` (linie 315-324) były używane wyłącznie przez `aiGeneratePlan` — jeśli `loadTodaysNutritionSummary` nie jest wywoływana nigdzie indziej w `backend.ts`, usunąć też ją i jej import (martwy kod po usunięciu wywołania); jeśli jest używana gdzie indziej (np. w podsumowaniu diety), zostaje.
4. `ai/coach.ts` — usunąć `TrainingPlanSchema`, `TrainingPlan`, `TrainingPlanInput`, `makeHeuristicPlan`, `generateTrainingPlan`. Zostają: `analyzeBodyPhoto`, `compareProgressPhotos`, `AiImage`, `BodyAnalysis`, `ProgressReport`, `ActivityLevel`, `CardioPerformance` (sprawdzić w implementacji czy `ActivityLevel`/`CardioPerformance` są używane tylko przez usuwany kod — z odczytu linii 1-30 `ActivityLevel` jest eksportowany i może być używany przez typy wejściowe usuwanej funkcji; `backend` weryfikuje przed usunięciem, nie zakładać na slepo).
5. `lib/ai-training-plan-to-payload.ts` — usunąć cały plik.
6. `lib/training-feature-pack.test.ts` — usunąć tylko przypadki testujące `trainingPlanToWorkoutPayloads`, zostawić resztę (import tego modułu usunąć).
7. `scripts/codemod-guard-server-actions.mjs`, linie 18-19 (`STRICT` obiekt) — usunąć wpisy `aiGeneratePlan`, `generateAndSaveAiWorkoutPlans`; **`aiAnalyzePhoto` (linia 17) zostaje** — to osobna funkcja (analiza zdjęcia postawy), nie w zakresie usunięcia.
8. `docs/workout-plan-creation.json` — aktualizacja opisu trzech ścieżek na dwie (Od zera / Z pliku).
9. Weryfikacja końcowa: `npx tsc --noEmit` i grep na `generateAndSaveAiWorkoutPlans|aiGeneratePlan|generateTrainingPlan|trainingPlanToWorkoutPayloads|ai-workout-plan` w kodzie produkcyjnym — zero wyników (AC-12.2).

Nie znaleziono dodatkowych zależności poza listą analityka. Dane: plany zapisane wcześniej przez generator nie mają znacznika źródła w `plan_json` — usunięcie funkcji nie wymaga migracji (BR-9, potwierdzone).

---

## 6. Ryzyka i dług techniczny świadomie odłożony

| Ryzyko / dług | Decyzja |
|---|---|
| Model "dzień" zamiast "program tygodniowy" (Q3) | Odłożone do v1.1, patrz 2.3. Jeśli użytkownik mimo uzasadnienia chce programu już teraz — wymaga nowego ADR i migracji, nie da się zrobić "po drodze" w tym zadaniu bez ryzyka dla historii treningów. |
| Bucket rate limit `bodyReportImport` współdzielony z importem planu | Do naprawy w tym samym zadaniu implementacyjnym jeśli czas pozwoli (nowy bucket `workoutPlanImport`); jeśli nie — wpis do `docs/bledy-do-naprawy/bledy.md`, nie blokuje. |
| Rozmiar bundla po rozszerzeniu katalogu metadanymi | **Nieaktualne po zmianie 2.4** (katalog nie jest już plikiem w bundlu, tylko tabelą czytaną po stronie serwera przez RSC + cache) — ryzyko bundla zastąpione ryzykiem kosztu Turso, zaadresowanym w 2.4 (`unstable_cache`/`revalidateTag`). |
| Koszt odczytów Turso przy dużej, rosnącej tabeli `exercises` (NOWE, po zmianie 2.4) | Zaadresowane w 2.4 przez cache po stronie serwera, rewalidowany tylko przy zapisie admina. Jeśli w praktyce cache nie wystarczy (np. bardzo częste rewalidacje przy intensywnej edycji) — do zmierzenia przez `backend` po wdrożeniu, nie blokuje ADR. |
| Jakość treści redakcyjnej (`description`/`cues`) bez code review, wpisywana przez admina w produkcji (NOWE, po zmianie 2.4) | Walidacja Zod (długość minimalna/maksymalna) jest jedyną barierą automatyczną — brak PR/review. Ryzyko jakości tekstu akceptowane świadomie jako koszt elastyczności (częste aktualizacje bez deployu); odłożone jako dług, nie blokuje. |
| Migracja `exercise_technique_links` → `exercises.techniqueYoutubeUrl` (NOWE, po zmianie 2.4) | Jednorazowy skrypt seed (3. w sekcji 3) musi przebiec przed usunięciem starej tabeli — `backend` weryfikuje liczbę przeniesionych wierszy przed `DROP TABLE` w migracji Drizzle, żeby nie zgubić istniejących, zatwierdzonych linków. |
| Limit kwoty YouTube Data API (100 wyszukiwań/dzień przy domyślnej kwocie, NOWE po zmianie 2.4a) | Akceptowalne — wyszukiwanie dzieje się tylko w panelu admina, nie przy ruchu użytkowników. Jeśli zespół redakcyjny wyczerpie kwotę przy masowym uzupełnianiu 165+ pozycji na starcie, rozwiązanie operacyjne: rozłożyć uzupełnianie na kilka dni albo zgłosić zwiększenie kwoty w Google Cloud Console — nie wymaga zmiany architektury. |
| Własne ćwiczenia: zmiana `userCustomExerciseNames: string[]` → obiekty z partią | Wymaga aktualizacji `normalizeWorkoutPlan` (tolerancja starego formatu) i testu regresji dla planów zapisanych przed zmianą. `backend` pisze test na starym formacie wejściowym przed zmianą kodu. |
| Dwuetapowy import (preview/confirm) zwiększa złożoność API i powierzchnię ataku | Mitygacja opisana w 2.5 (limity po stronie `confirm`). `tester-bezpieczenstwa` w etapie implementacji powinien zweryfikować, że `confirm` nie przyjmuje więcej dni/ćwiczeń niż limit niezależnie od tego, co zwrócił `preview`. |
| Sylwetka partii (komponent) nie został zlokalizowany w repo (wg analizy) | `architekt` potwierdza: w przeszukaniu kodu wykonanym w tym ADR również nie znaleziono komponentu `MuscleMap`/`BodyMap`. **Założenie**: sylwetka z US-9 to nowy komponent SVG do zaprojektowania przez `ux` i zaimplementowania przez `frontend`, nie reużycie istniejącego. Dane o partiach (`resolve-exercise-muscles.ts`, `SECONDARY_BY_PRIMARY`, `preferBackView`) już istnieją i są gotowe do zasilenia takiego komponentu. |
| AC-3.4 (zapis offline na siłowni) | Rekomendacja: **nie** budować pełnego mechanizmu synchronizacji offline w v1 (poza zakresem wg analizy). Minimalny zakres: `draft-autosave.ts` (localStorage) chroni przed utratą danych przy zamknięciu/odświeżeniu (AC-3.6), ale zapis do serwera wciąż wymaga sieci; błąd sieci przy "Zapisz" pokazuje komunikat z retry (AC-13.2), formularz nie czyści się. To rozwiązuje ryzyko utraty danych bez budowy outboxa jak w aktywnej sesji treningu (poza zakresem i kosztem tego zadania). |

---

## 7. Zgodność z Android / Java / konfiguracja

- **Java backend**: potwierdzam ustalenie analityka — brak CRUD planów w `java-backend/` (potwierdzone również przez brak odwołań znalezionych podczas przeglądu `db/schema.ts` i `actions/workout-plan.ts`, które operują bezpośrednio na Drizzle/libSQL, nie przez proxy Javy). Brak zmian wymaganych w Javie.
- **Android**: aplikacja otwiera trasy WWW w WebView; nowa trasa `/plany` musi być dostępna tak jak `/workout-plan` dziś (brak specjalnej listy dozwolonych ścieżek w kodzie Android wg analizy — do potwierdzenia przez `backend`/`frontend` przy implementacji, jeśli WebView ma allowlistę domen/ścieżek). `ReminderReceiver.java` zostaje bez zmian (kieruje do `/workout-plan`, nie do `/plany`).
- **`/api/android/*`**: brak dotyczących planu — bez zmian kontraktu.
- **`lib/admin-config-status.ts` / `env.example`** (**ZMIANA po decyzjach właściciela produktu** — pierwotne "brak nowych zmiennych" nieaktualne): ten redesign wprowadza jedną nową zmienną środowiskową, `YOUTUBE_API_KEY` (2.4a), używaną wyłącznie przez wyszukiwanie kandydatów w panelu admina. Wymaga wpisu w `lib/admin-config-status.ts` (funkcja opcjonalna — bez klucza panel admina działa, tylko bez przycisku "Szukaj filmu"; ręczne wklejanie linku zostaje) i opisu w `env.example`, zgodnie z `AGENTS.md`. Grafiki partii SVG — rekomendacja z pierwotnego ADR (trzymać w repo, nie CDN) zostaje bez zmian, nie dotyczy decyzji właściciela produktu.

---

## 8. Odpowiedzi zespołu na pytania Q1–Q5 (dla użytkownika)

| # | Pytanie | Rekomendacja architekta |
|---|---|---|
| Q1 | Gdzie ma być wejście? | Szuflada "Menu" — potwierdzam założenie analityka. Stały panel boczny na desktopie to zmiana całej nawigacji, poza zakresem. |
| Q2 | Czy CTA w Treningach znika całkowicie? | Nie — CTA zostają jako link do `/plany` (ta sama trasa zarządzania, nie osobny edytor). "Wyłącznie z Menu" dotyczy miejsca **zarządzania**, nie zakazu linkowania do niego. |
| Q3 | Zmienić model dane na "program tygodniowy"? | Nie w v1. Zostać przy "jeden rekord = jeden dzień" — koszt migracji i ryzyko dla historii/kolejki przewyższa korzyść; problem użytkownika jest wizualno-architektoniczny, nie strukturalny. Nazwa w UI: "dzień treningowy", nie "plan". Program jako encja nadrzędna — kandydat na v1.1. |
| Q4 | Katalog statyczny czy baza edytowalna przez admina? | **ZDECYDOWANE PRZEZ WŁAŚCICIELA PRODUKTU (zmiana rekomendacji architekta)**: tabela `exercises` w Turso + pełny CRUD w panelu admina (rozszerzenie `admin-exercises-client.tsx`), nie plik statyczny. Scalona z dawną `exercise_technique_links`. Linki YouTube: wyszukiwanie kandydatów przez YouTube Data API + ręczna akceptacja admina (2.4a). Opis techniki — pole podstawowe (2.4b). Prywatne notatki/linki użytkownika — osobna tabela `user_exercise_notes` (2.4c). Koszt Turso zaadresowany przez cache po stronie serwera (2.4). |
| Q5 | Podgląd przed zapisem importu? | Tak — dwuetapowe API (`preview`/`confirm`), stan podglądu tylko w pamięci klienta, bez nowej tabeli. **Doprecyzowane przez właściciela produktu**: każda wykryta pozycja ma wskaźnik pewności parsowania (wysoka/niska), pozycje niepewne wymagają obowiązkowej ręcznej weryfikacji przed zapisem; nazwa ćwiczenia jest dopasowywana (fuzzy match) do tabeli `exercises`, żeby import nie tworzył niespójnych duplikatów (2.5). |

---

## 9. Kolejność wdrażania (rekomendacja dla etapu 5, przyszłe zadanie)

1. Usunięcie funkcji AI (sekcja 5) — niezależne, bezpieczne jako pierwszy krok, zmniejsza ryzyko konfliktów z nowym edytorem.
2. **(ZMIENIONE)** Migracja Drizzle: nowa tabela `exercises`, nowa tabela `user_exercise_notes`, usunięcie `exercise_technique_links` po przeniesieniu danych; skrypt seed `scripts/seed-exercises-from-catalog.ts` (sekcja 2.4) — niezależne od UI, może iść równolegle z punktem 1. Wykonywane PRZED punktem 4, bo UI atlasu/edytora czyta już z nowej tabeli.
3. Nowe trasy `/plany` + przekierowania ze starych ścieżek + przepięcie punktów wejścia (sekcja 4) — żeby w każdym momencie istniała działająca ścieżka (nie urywać starej, zanim nowa nie działa).
4. Panel admina: rozszerzenie `admin-exercises-client.tsx` o CRUD `exercises` + wyszukiwanie YouTube Data API (2.4, 2.4a) — zespół redakcyjny może zacząć uzupełniać opisy/filmy równolegle z punktem 5, nawet przed ukończeniem nowego UI atlasu.
5. Lista dni + edytor + atlas (komponenty z sekcji 3), w tym sekcja prywatnych notatek (2.4c) — główna implementacja, zgodnie z makietami `ux` (etap 4, do zaktualizowania o nowe elementy z tej rewizji — wskaźnik pewności importu, panel admina, notatki prywatne).
6. Import z podglądem, wskaźnikiem pewności i fuzzy matchem do atlasu (nowe endpointy `preview`/`confirm`, sekcja 2.5) — na końcu, bo zależy od ustabilizowanego formatu edytora i od tabeli `exercises` (fuzzy match).
7. Usunięcie bloku planu z `app/(dashboard)/profile/page.tsx`.
8. Aktualizacja `docs/workout-plan-creation.json`, `docs/zespol/wiedza-o-projekcie.md`, `lib/admin-config-status.ts`/`env.example` (`YOUTUBE_API_KEY`), changelog (`planned: true`).

---

## 10. Werdykt

**ZATWIERDZONE** — architektura gotowa do przekazania `ux` (etap 4, makiety na bazie struktury komponentów i decyzji terminologicznych z sekcji 2.3) oraz do przyszłego zadania implementacyjnego (`backend`/`frontend`, etap 5), po akceptacji użytkownika dla odpowiedzi Q1-Q5 w sekcji 8.

Brak zmian w kodzie produkcyjnym wykonano w tym etapie, zgodnie z poleceniem.

---

## 11. Aktualizacja 2026-10-26 po decyzjach właściciela produktu

Po przekazaniu tego ADR do akceptacji, właściciel produktu podjął cztery decyzje doprecyzowujące/zmieniające pierwotną treść. Ten rozdział podsumowuje zmiany; szczegóły są wpisane w odpowiednich sekcjach wyżej (edytowane in-place, nie w osobnym pliku).

1. **Linki YouTube do ćwiczeń (potwierdzenie)** — dodana nowa sekcja **2.4a**: wyszukiwanie kandydatów przez YouTube Data API (`search.list`), ręczna akceptacja w panelu admina, zapis dopiero po wyborze człowieka. Nowa zmienna środowiskowa `YOUTUBE_API_KEY` (sekcja 7).
2. **Atlas ćwiczeń — ZMIANA DECYZJI** — sekcja **2.4** przepisana w całości: zamiast statycznego pliku w kodzie (pierwotna rekomendacja architekta, odrzucona), katalog przechodzi do tabeli Drizzle `exercises` w Turso z pełnym CRUD w rozszerzonym `admin-exercises-client.tsx`. Scalona z dawną `exercise_technique_links` (jedna tabela, jeden panel). Jednorazowy skrypt seed migruje 165 pozycji z `lib/workout-exercise-catalog.ts`. Koszt odczytów Turso zaadresowany przez cache po stronie serwera (`unstable_cache`/`revalidateTag`), nie przez FTS5 (niepotrzebne przy obecnej skali). Zaktualizowano sekcje 3 (struktura katalogów), 6 (ryzyka), 7 (konfiguracja), 8 (odpowiedź Q4), 9 (kolejność wdrażania).
3. **Instrukcje techniki jako pole podstawowe + prywatny link użytkownika** — nowe sekcje **2.4b** (opis/instrukcja to pole podstawowe formularza admina, film jest dodatkiem, nie wymogiem) i **2.4c** (nowa, lekka tabela `user_exercise_notes` — prywatny link/notatka per użytkownik per ćwiczenie, bez bramki prawnej/moderacji, bo nie jest publicznym UGC). Sekcja **2.6** przepisana z "dwóch poziomów" na "trzy poziomy" linków techniki (atlas publiczny / plan prywatny per dzień / atlas prywatny per użytkownik).
4. **Walidacja/pewność importu** — sekcja **2.5** rozszerzona o wskaźnik `confidence: "high" | "low"` per wykryta pozycja, obowiązkową ręczną weryfikację pozycji niepewnych przed zatwierdzeniem importu, oraz fuzzy match sparsowanej nazwy ćwiczenia do tabeli `exercises` (nowa funkcja `lib/workout-plan/match-exercise-name.ts`), żeby uniknąć niespójnych duplikatów nazw.

Potwierdzone bez zmian: kolejność dni/ćwiczeń na liście przez przyciski góra/dół (nie drag-and-drop) — rekomendacja z etapu `ux` (etap 4) zostaje.

**Nowe otwarte pytania/ryzyka wynikające z tych decyzji** (wpisane też do sekcji 6, powtórzone tu dla widoczności):
- Koszt odczytów Turso dla tabeli `exercises` przy realnym obciążeniu — zaprojektowany cache powinien wystarczyć, ale nie był mierzony na produkcyjnym ruchu; `backend` weryfikuje po wdrożeniu.
- Jakość treści redakcyjnej (`description`/`cues`) wpisywanej przez admina bez code review — jedyną barierą jest walidacja długości Zod; ryzyko jakości tekstu świadomie zaakceptowane jako koszt elastyczności.
- Panel admina rośnie w zakresie (CRUD pełnego ćwiczenia + wyszukiwanie YouTube) — większy niż pierwotnie zakładany zasięg prac `frontend`/`backend` dla tego ekranu; do uwzględnienia w szacowaniu zadania implementacyjnego.
- Limit kwoty YouTube Data API (orientacyjnie 100 wyszukiwań/dzień na kluczu domyślnym) może być wąskim gardłem przy jednorazowym, masowym uzupełnianiu filmów dla 165+ istniejących pozycji — rozwiązanie operacyjne (rozłożenie w czasie lub zwiększenie kwoty), nie architektoniczne.
- `ux` (etap 4) powinien otrzymać ten zaktualizowany ADR przed dalszą pracą nad makietami, bo zakres ekranu admina, karty ćwiczenia (notatka prywatna) i kroku importu (wskaźnik pewności) się zmienił względem makiet zaakceptowanych wcześniej z werdyktem ZATWIERDZONE Z UWAGAMI.
