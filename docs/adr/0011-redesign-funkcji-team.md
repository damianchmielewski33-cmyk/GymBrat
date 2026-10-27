# ADR 0011 — Redesign funkcji Team (prezentacja, katalog odznak, pierścienie, rotacja misji)

- **Status**: Zaakceptowane (projekt techniczny, etap 3 pełnego przepływu). Implementacja (etap 5) nie jest objęta tym ADR i wymaga osobnego zadania.
- **Karta zadania**: `docs/zadania/012-redesign-funkcji-team.md`
- **Wejście**: `docs/analiza/012-redesign-funkcji-team.md` (analityk, ZATWIERDZONE)
- **Autor**: architekt (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Równolegle**: `ux` (makiety, `docs/ux/012-...`), `prawnik` (widoczność/RODO, `docs/prawo/`). Zobacz sekcję 9 "Punkty do korekty po decyzji prawnika/UX".

---

## 1. Kontekst

Analiza 012 opisuje Team jako funkcję z gotowymi mechanikami (FCS, XP x4 tory, RP, wojny, misje, wyzwania, HoF, odznaki), ale rozproszoną prezentacją i brakiem pętli powrotu (pierścienie, seria, katalog odznak, rotacja). Zadanie: zaprojektować model danych i kontrakty dla nowej prezentacji, bez zmiany algorytmu FCS (Z3) i bez nowych usług infrastrukturalnych (Z7), rozstrzygając najpierw krytyczne ryzyko ścieżki zapisu treningu przez Javę (sekcja 11 pkt 1 analizy).

---

## 2. Rozstrzygnięcie ryzyka krytyczne: ścieżka zapisu treningu przez Javę

### 2.1 Co potwierdzono w kodzie

- `app/api/workouts/complete/route.ts`: gdy `isJavaApiEnabled()` (czyli `JAVA_API_BASE_URL` ustawione), żądanie idzie **w całości** do Javy przez `fetchJavaApi(...)` i odpowiedź Javy jest zwracana wprost (`passThroughJavaResponse`). **Cała logika TS poniżej tego bloku — zapis do `workouts`, porównanie z planem, a przede wszystkim `publishTeamFeedAfterWorkout` (auto-post, który odpala XP/feed/misje) — jest pomijana całkowicie.**
- `java-backend/.../WorkoutController.java` → `WorkoutService.java`: trening jest zapisywany **tylko w pamięci procesu** (`ConcurrentHashMap<String, List<StoredWorkout>>`), bez żadnej bazy danych. Brak wywołania feedu, XP, reputacji, misji. Restart procesu Java = utrata wszystkich treningów zapisanych tą ścieżką. Trening nie trafia też do Turso, więc żadna inna funkcja (dieta, raporty, Team, historia) go nie zobaczy.
- `docs/adr/0000-architektura-stanu-obecnego.md` (D5): "Backend Java na produkcji — **Nieznane**. W repo brak `render.yaml` i Dockerfile; do sprawdzenia w panelu Render, czy ustawiono `JAVA_API_BASE_URL`." `lib/admin-config-status.ts` opisuje `java-api` jako integrację **opcjonalną** ("Bez zmiennej Next obsługuje API samodzielnie").

### 2.2 Wniosek

Ryzyko z analizy 012 się potwierdza, ale w ostrzejszej formie niż tylko "brak feedu/XP": **jeśli `JAVA_API_BASE_URL` byłoby kiedykolwiek ustawione w środowisku obsługującym `POST /api/workouts/complete`, aplikacja utraciłaby trwały zapis treningów w ogóle** — to usterka poważniejsza niż sama funkcja Team i blokuje nie tylko Team, ale całą resztę produktu (historia, dieta łączona z dniem treningowym, raporty postępów). `WorkoutService` w Javie jest w stanie zalążkowym/eksperymentalnym (stub in-memory), nie produkcyjnym substytutem.

**Decyzja (wiążąca dla tego zadania i poza nim):**

1. `POST /api/workouts/complete` **pozostaje obsługiwany wyłącznie przez ścieżkę TypeScript/Drizzle/Turso** do czasu, aż `java-backend` dostanie trwały zapis (DB) **i** publikację zdarzeń Team (feed/XP/misje/reputacja) z parytetem funkcjonalnym. Nie projektujemy duplikowania logiki Team w Javie w tym zadaniu (naruszałoby to zasadę "jedna funkcjonalność w jednym miejscu" z `AGENTS.md`).
2. Rekomendacja operacyjna (poza zakresem ADR, do przekazania właścicielowi): **sprawdzić w panelu Render, czy `JAVA_API_BASE_URL` jest ustawione dla usługi obsługującej `/api/workouts/complete`.** Jeśli tak — to osobny, pilny incydent (utrata danych o treningach), niezależny od zadania 012, do zgłoszenia natychmiast i rozwiązania przed jakimkolwiek dalszym rozwojem Team.
3. Dla zakresu tego ADR: cała nowa logika Team (katalog odznak, pierścienie, rotacja misji, rozszerzenia FCS) jest projektowana i — przy implementacji — pisana wyłącznie po stronie TS/Drizzle, zasilana z `publishTeamFeedAfterWorkout` i miejsc, które już wywołuje (`team-feed-auto.ts`, `team-quests.applyQuestProgressAfterWorkout`, `awardProgressionXp`). Java nie jest rozszerzana.
4. Wpis do `docs/bledy-do-naprawy/bledy.md` (sekcja "Krytyczne/Java", patrz sekcja 10 tego ADR) — to pozycja wymagająca **decyzji właściciela**, nie automatycznego działania zespołu.

---

## 3. Definicja tygodnia (D9) — stan faktyczny i rozwiązanie tymczasowe

**Ustalenie nieoczekiwane, ale korzystne:** `lib/community/fcs-compute.ts` **już liczy tydzień poniedziałek–niedziela** (`weekDateKeysMondayFirst`, `mondayOf()`, cache klucz `fcs:rank:{teamId}:{weekStart}`). D9 jest więc **już wdrożone dla FCS i rankingu grupy**. Luka opisana w analizie 012 (sekcja 2.2, "cardio dziś liczy kroczące 7 dni") dotyczy osobnego miejsca: `lib/cardio.ts` (komentarz w kodzie: *"Rolling 7-day cardio"*), używanego na pulpicie/kartach cardio poza Team.

**Decyzja:** Nowe mechanizmy Team (pierścienie, seria, rotacja misji) używają **tej samej definicji tygodnia co FCS** — wydzielić `mondayOf()` i `weekDateKeysMondayFirst` z `fcs-compute.ts` (lub `lib/local-date.ts`, jeśli tam już częściowo żyje) do współdzielonej funkcji `weekBounds(dateKey)` w `lib/community/week.ts` (nowy, mały moduł — nie nowa usługa, tylko refaktoryzacja istniejącej funkcji do wspólnego miejsca). Pierścień cardio liczy minuty **z tego tygodnia (pon–nd)**, niezależnie od tego, co pokazuje kroczący widget na pulpiecie. To są dwie różne prezentacje tej samej tabeli `workouts`/cardio — nie wymaga zmiany `lib/cardio.ts` ani ryzyka rozjazdu z D9 jako globalną decyzją produktową (ta decyzja może przyjść później i ujednolicić pulpit, ale Team nie musi na nią czekać).

AC-3.4 analizy ("cardio przed zmianą D9") jest więc **nieaktualne w tej formie** — nie ma przed/po D9 dla Team, bo Team od początku liczy pon–nd. Zostaje do potwierdzenia przez `ux`/`tester`, czy warto ujednolicić też pulpit (poza zakresem MVP Team).

---

## 4. Model danych

Zasada: rozszerzamy istniejące tabele i wzorce (`sourceKey` UNIQUE, `ensureCriticalSchema`/`ensure-schema.ts`), nie tworzymy równoległych silników XP/odznak. Każda nowa tabela wymaga wpisu w Drizzle (`db/schema.ts` + `npm run db:generate`) **oraz** w `db/ensure-schema.ts` (istniejący wzorzec dla tabel community — patrz R3 w `docs/adr/0000-architektura-stanu-obecnego.md`, dług techniczny zaakceptowany, nie naprawiany w tym zadaniu).

### 4.1 Katalog definicji odznak (nowe) — `badge_definitions`

Dziś katalog istnieje tylko "w kodzie" (stałe w `challenge-types.ts`, `team-quest-types.ts`, `progression-rewards.ts`, `hof-types.ts`) i częściowo "w locie" (team quest badge key = `quest_{templateKey}_{questId}`, czyli **unikalny per uruchomienie misji**, nie per szablon — to celowe, bo każda misja to osobne wspomnienie, nie powtarzalny katalogowy wpis).

```
badge_definitions (
  key                 TEXT PRIMARY KEY,       -- np. "badge_sessions_50", "prestige_1", "quest_template:team_sessions_100"
  category            TEXT NOT NULL,          -- 'challenge' | 'team_quest' | 'progression' | 'hof' | 'streak'
  title                TEXT NOT NULL,
  emoji                TEXT NOT NULL,
  description          TEXT,                  -- jedno zdanie "jak zdobyć"
  target_value         INTEGER,                -- NULL gdy nie da się wyrazić liczbowo (np. prestige)
  unit_label           TEXT,
  is_repeatable        INTEGER NOT NULL DEFAULT 0, -- 1 dla team_quest (ta sama definicja, wiele instancji z różnym badge_key w user_badges)
  rarity_cache_pct     REAL,                   -- odśwież agregacją w tle (sekcja 6), NULL = nieznane/ukryte (US-6 AC-6.2)
  rarity_cache_updated_at INTEGER,
  created_at           INTEGER NOT NULL
)
```

**Dowiązanie `user_badges` → katalog (bez migracji wstecznej danych):** dodać nową, **nullable** kolumnę `user_badges.definition_key TEXT REFERENCES badge_definitions(key)`. Zapisywana od teraz przy każdym nowym `insert` do `user_badges` (stałe mapowanie 1:1 dla `challenge`/`progression`/`hof`; dla `team_quest` każdy nowy badge dostaje `definition_key = 'quest_template:' || templateKey`, a `badge_key` zostaje unikalny per instancja jak dziś — **unique index na `(userId, badgeKey)` się nie zmienia**, więc BR-11 (nieodwracalność) i istniejąca idempotencja zostają nietknięte). Stare wiersze `user_badges` mają `definition_key = NULL`: katalog pokazuje je jako "zdobyte, nieskatalogowane" (grupa osobna w UI, decyzja `ux`) — zgodne z BR-11 (nie znikają, nie wymagają backfillu w MVP). Backfill `definition_key` dla istniejących wierszy jest **możliwy i tani (match po prefiksie `badge_key`), ale opcjonalny** — rekomendacja: zrobić go jednorazowym skryptem przy wdrożeniu (nie jest blokujący).

Katalog ma być zasiewany (seed) z istniejących stałych (`CHALLENGE_TEMPLATES`, `TEAM_QUEST_TEMPLATES`, `USER_LEVEL_REWARDS`, `HOF` kategorie) przy starcie / migracji — jedno źródło prawdy (stałe TS), tabela to tylko **cache zapytywalny + miejsce na `rarity_cache_pct`**. To nie duplikuje definicji: funkcje `listQuestTemplates()`, `CHALLENGE_TEMPLATES` zostają jedynym miejscem treści; `badge_definitions` jest materializacją do SQL (upsert idempotentny po `key` przy każdym starcie aplikacji lub przez mały skrypt `db:seed-badges`, podobnie jak `ensure-schema.ts` jest wołany lениво).

### 4.2 Pierścienie tygodnia — bez nowej tabeli stanu

Pierścień to **widok**, nie nowy fakt do przechowania: trening = COUNT dni z `workouts` w tygodniu (pon–nd) vs cel z `fitnessGoalsJson` (`lib/fitness-goals.ts`, już istnieje); cardio = SUM `cardioMinutes` w tygodniu vs `userSettings.weeklyCardioGoalMinutes` (już istnieje). **Brak nowej tabeli.** Jedyny nowy fakt: **zdarzenie "pierścień zamknięty"**, żeby nie duplikować gratulacji (AC-3.2) — rozwiązanie: rozszerzyć istniejący wzorzec `progression_xp_ledger.sourceKey` UNIQUE: `awardProgressionXp({ source: "ring_closed", sourceKey: "ring:{userId}:{weekStart}:{ringType}" , amount: X })`. Insert idempotentny (już istniejący mechanizm — `try { insert } catch { continue /* idempotent */ }`) daje za darmo "raz na tydzień, raz na typ pierścienia" bez nowej tabeli i bez nowego CAS.

### 4.3 Seria tygodni (streak) — bez nowej tabeli

`streakWeeks` jest już policzone w `fcs-compute.ts` (`streakWeeksFromDates`). US-4 wymaga tylko **ekspozycji** tej liczby na hubie, nie nowego przechowywania. Komunikat AC-4.2 ("Zrób dziś trening, by utrzymać serię") to czysta prezentacja: `streakWeeks` liczone na dziś vs na koniec tygodnia — logika istnieje, trzeba dodać tylko flagę `atRiskThisWeek: boolean` w widoku (czy bieżący tydzień ma już ≥1 trening).

### 4.4 Rotacja misji i wyzwań — bez nowej tabeli, leniwe uruchomienie

Zob. sekcja 5.

### 4.5 Widoczność / opt-out w rankingu

Rozszerzyć `userSocialProfiles` o nową kolumnę (nie nowa tabela, zgodnie z "rozszerzaj, nie duplikuj"):

```
user_social_profiles.hide_from_team_ranking INTEGER NOT NULL DEFAULT 0
```

Uzasadnienie kolumny per-użytkownik (nie per-team): US-15/BR-10 opisują "ukryj się w rankingu" jako wybór osobisty niezależny od konkretnej grupy (member jednej grupy prywatny, w innej nie — to jest **Could**, poza MVP; MVP: jedna globalna flaga, prostsza i tańsza w zapytaniu). Jeśli `prawnik` albo `ux` zdecyduje, że widoczność ma być per-grupa, to **nowa kolumna w `team_members`** (`hide_from_ranking INTEGER DEFAULT 0`), nie osobna tabela — zostawiam to jako punkt otwarty w sekcji 9.

---

## 5. Rotacja misji i wyzwań — mechanizm bez nowych usług (Z7)

**Decyzja: leniwe uruchomienie (lazy trigger) przy pierwszym wejściu w tygodniu, nie cron.**

Uzasadnienie (odpowiedź na pytanie z sekcji 15.2 analizy):
- Repo nie ma dziś ogólnego mechanizmu cron poza Vercel Cron/Render Cron Job nieużywanym dla community (sprawdzone: brak odwołań do harmonogramu w `lib/community/`). Dodanie crona to nowa usługa/konfiguracja (`vercel.json` cron albo Render Cron Job) — koszt operacyjny i zmienną środowiskową, sprzeczne z Z7, chyba że właściciel zaakceptuje jawnie.
- Wzorzec "leniwe odświeżenie przy wejściu" **już istnieje** w tym samym module: `getWarsHubData()` woła `finalizeWarIfDue(war.id)` przy każdym otwarciu huba wojen, `getQuestBoardView()` woła `expireIfNeeded()`. Rotacja misji/wyzwań rozszerza ten sam, sprawdzony wzorzec — nie tworzy nowego.

**Projekt:**
```
async function ensureActiveQuestForTeam(teamId: string): Promise<TeamQuest> {
  const active = await getActiveQuestForTeam(teamId);
  if (active && active.endsAt > now) return active;
  if (active) await expireIfNeeded(active.id, active.endsAt); // już status -> expired
  return startNextQuestInRotation(teamId); // nowa funkcja, sekcja 5.1
}
```
Wołane z: strony grupy (US-1/US-8), huba (US-1), i opcjonalnie z `publishTeamFeedAfterWorkout` po treningu (żeby misja startowała nawet bez odwiedzenia strony — **Should**, nie blokujące MVP: bez tego pierwsza osoba, która wejdzie na stronę grupy w nowym tygodniu, "odpala" misję dla wszystkich, co jest akceptowalnym opóźnieniem rzędu godzin, nie dni).

### 5.1 Wybór kolejnego szablonu (rotacja bez pracy admina)

- Pula: `TEAM_QUEST_TEMPLATES` (5 szablonów). Wybór: **deterministyczny, nie losowy** — `templates[hashWeek(teamId, weekStart) % templates.length]` pomijając szablon użyty w poprzednim tygodniu tej drużyny (lista `teamQuestCompletions` ostatnie N). Deterministyczność (nie `Math.random()`) jest ważna, bo dwa równoczesne żądania (dwóch członków wchodzących na stronę w tej samej sekundzie) muszą wybrać **ten sam** szablon — inaczej dwa równoległe `startTeamQuest` z różnym `templateKey` i obaj przejdą walidację `getActiveQuestForTeam` (brak aktywnej) w wyścigu. To prowadzi do sekcji 6 (CAS na starcie misji).
- Dla wyzwań (US-9, poziom dopasowany): próg wybierany z istniejących dwóch wariantów szablonu (`challenge-types.ts` już ma pola progowe w części szablonów, do potwierdzenia przy implementacji który próg per poziom aktywności z ostatnich 4 tygodni — liczone z `workouts`, bez nowej tabeli).

### 5.2 Grupa z 1 członkiem (AC-8.3)

Decyzja projektowa (współdzielona z `ux`): misja **startuje normalnie**, ale `targetValue` nie jest skalowany per liczbę członków w MVP (skalowanie celu do wielkości grupy to osobna zmiana na `TeamQuestTemplate`, **Could**, nie blokuje). UI oznacza "wymaga więcej osób" tylko wizualnie (flaga `teamSize < 3`), dane się nie zmieniają — zero zmian w modelu.

---

## 6. Wyścigi i CAS — plan naprawy skoncentrowany na realnym ryzyku

Analiza słusznie oznacza `team-wars.ts`, `team-quests.ts`, `progression.ts`, `hof.ts` jako SELECT-then-UPDATE. Po przeczytaniu kodu rozróżniam ryzyko **już zamortyzowane przez unique constraints** od ryzyka **realnego, wymagającego poprawki przed rozszerzeniem**:

| Miejsce | Wzorzec | Czy już bezpieczne? | Działanie |
|---|---|---|---|
| `progression_xp_ledger` insert (`awardProgressionXp`) | insert + `catch { continue }` na UNIQUE(`sourceKey`) | **Tak** — podwójne naliczenie XP niemożliwe (constraint łapie duplikat przed `creditUserXp`/`creditTeamXp`) | Żadne — wzorzec do powielenia dla pierścieni (sekcja 4.2) |
| `user_badges` insert | insert + `catch` na UNIQUE(`userId`,`badgeKey`) | **Tak** dla odznak z kluczem deterministycznym | Żadne |
| `team_quest_completions` insert w `tryCompleteQuest` | insert + `catch { return }` na UNIQUE(`questId`) | **Tak** — dwa równoczesne wywołania `tryCompleteQuest` dla tej samej misji: tylko jeden insert się powiedzie, drugi `catch` i `return` **przed** przyznaniem nagród. Nagroda per użytkownik dodatkowo chroniona przez `sourceKey` XP i `badgeKey` unikalny. | Żadne — to już poprawny CAS przez constraint, mimo braku jawnej transakcji |
| `teamQuestContributions` SELECT→UPDATE `amount` | brak unique, czyste "lost update" przy dwóch równoczesnych treningach tego samego użytkownika | Ryzyko niskie (rzadkie, jeden użytkownik rzadko kończy 2 treningi w tej samej milisekundzie), **do naprawy później** wg kryteriów koordynatora (przypadek brzegowy, nie główna ścieżka) | Wpis do `docs/bledy-do-naprawy/bledy.md`, nie blokuje |
| **`startTeamQuest` (nowy start w rotacji, sekcja 5)** | SELECT `getActiveQuestForTeam` (brak aktywnej) → INSERT nowej misji, **bez unique constraint na "jedna aktywna misja na drużynę"** | **Nie — realne ryzyko nowe**, wprowadzone przez rotację bez interakcji admina (wcześniej admin klikał ręcznie, rzadka współbieżność; leniwe uruchomienie przez wielu członków jednocześnie zwiększa prawdopodobieństwo) | **Naprawić przed MVP**: dodać częściowy unikalny indeks `uniqueIndex("team_quests_team_active_uidx").on(t.teamId).where(sql`status = 'active'`)` (SQLite obsługuje partial unique index) **albo**, jeśli Drizzle/libSQL w tym repo nie wspiera `.where()` na `uniqueIndex` w używanej wersji — do zweryfikowania przez `backend` przy implementacji — alternatywa: `UNIQUE(teamId, status)` nie zadziała (status się zmienia dla wielu wierszy historycznych), więc **rekomendacja: dedykowana tabela-semafor** `team_active_quest_lock(team_id TEXT PRIMARY KEY, quest_id TEXT)` zapisywana w tej samej transakcji co `INSERT INTO team_quests`; `INSERT INTO team_active_quest_lock` z PK na `team_id` rzuci UNIQUE przy wyścigu — przegrany `catch`, odczytuje istniejący `quest_id` z locka i go zwraca. Usuwany/aktualizowany przy `expireIfNeeded`/`tryCompleteQuest` (ten sam miejsce co dziś zmienia `status`). To ten sam, sprawdzony wzorzec (constraint + catch), zero nowej infrastruktury. |
| `wars` finalize (`finalizeWarIfDue` → `applyWarResults`) | SELECT status='live' → (poza oknem czasowym) UPDATE status='completed' **bez warunku WHERE status='live' sprawdzanego na affected rows** → `patch()` na `teamWarStats` (LP/wyniki) bez CAS | **Tak, realne** — potwierdzone czytaniem kodu: `getWarsHubData()` woła `finalizeWarIfDue` przy **każdym** wejściu członka na hub; dwóch członków otwierających hub w tym samym momencie dla wojny, która właśnie minęła termin, oboje przejdą `war.status !== "live"` (fałsz, bo status wciąż "live" dla obu odczytów przed update), oboje zapiszą `teamWarStats` (podwójne +25/-15 LP, podwójne wins/losses). XP nagrody są chronione przez `sourceKey` (`war:{warId}:{teamId}:{userId}`, UNIQUE) — **nie** podwajają się. | **Naprawić przed MVP** (to już dziś ryzyko, niezależnie od zadania 012, ale rozszerzanie wojen o widoczność na hubie US-11 zwiększa ruch w `getWarsHubData` i częstotliwość trafień w okno wyścigu). Rozwiązanie: zmienić `UPDATE wars SET status='completed' ... WHERE id=? AND status='live'` na zapytanie, którego wynik sprawdzamy (`rowsAffected`, wzorzec **już używany** w `lib/account-takeover.ts`), i wykonywać `applyWarResults`/`grantWarRewards` **tylko gdy `rowsAffected === 1`**. Przegrany odczyt po prostu nic nie robi (wojna i tak zostanie zakończona przez zwycięzcę wyścigu). |
| `hof.ts` | nie analizowano linia po linii w tym ADR (poza zakresem zmian 012 — HoF nie jest rozszerzany w MVP, tylko odczytywany dla katalogu odznak) | Do oceny przy osobnym zadaniu, jeśli HoF będzie rozszerzany | Wpis do `bledy.md` jako obserwacja, nie blokuje 012 |

**Zasada ogólna do zastosowania przy implementacji (dla `backend`):** każdy nowy "zrób coś raz" w Team ma mieć **unikalny constraint** jako jedyne źródło prawdy o pierwszeństwie (nie flagę w pamięci, nie kolejność zapytań) — zgodnie z istniejącym, dobrym wzorcem `sourceKey`/`badgeKey`/`questId` UNIQUE. Transakcje wieloinstrukcyjne (Drizzle `db.transaction`) są dopuszczalne tam, gdzie kilka tabel musi się zgadzać atomowo (np. zakończenie wojny: status + staty obu drużyn) — do wyboru przez `backend` między "transakcja" a "unique + catch + warunkowy update z rowsAffected", kierując się tym, co jest prostsze w libSQL/Turso (transakcje w trybie HTTP/edge bywają ograniczone — `backend` ma zweryfikować wsparcie w aktualnej wersji sterownika przed wyborem).

---

## 7. Idempotencja nagrody za misję grupową (US-7, BR-7)

Już dobrze rozwiązane przez istniejący wzorzec w `tryCompleteQuest` (sekcja 6, wiersz `team_quest_completions`): nagroda jest przyznawana **raz na misję** dzięki UNIQUE(`questId`), a każdemu uczestnikowi raz dzięki UNIQUE(`userId`,`badgeKey`) i UNIQUE(`sourceKey`) w XP. To zostaje bez zmian.

**Dopracowanie BR-7 ("tylko członkowie aktywni w okresie misji"):** dziś `activeContribs = contribs.filter((c) => c.amount > 0)` — czyli nagrodę dostają ci, którzy **wnieśli jakikolwiek wkład** (amount > 0), niezależnie od tego, czy nadal są w grupie w momencie zakończenia. To już realizuje ducha BR-7 (aktywność w okresie misji, nie "obecność w grupie na koniec") i jest **lepsze** niż alternatywa "tylko obecni teraz" (ta ukarałaby kogoś, kto słusznie odszedł z grupy tuż przed zamknięciem misji, mimo że przyczynił się do wyniku). **Decyzja architekta:** zachować obecną semantykę (`amount > 0` w okresie misji = aktywny), udokumentować ją jawnie jako realizację BR-7 (AC-7.2) — nie wymaga zmiany kodu, tylko potwierdzenia w kryteriach akceptacji przy implementacji. Jeśli `prawnik` uzna, że osoba, która opuściła grupę, nie powinna dostawać powiadomienia/odznaki widocznej w grupie, do której już nie należy — to kwestia **gdzie odznaka jest pokazywana** (profil użytkownika, zawsze dostępny), nie czy jest przyznana; brak konfliktu.

---

## 8. Kontrakty API / server actions

Zasada: **rozszerzenie istniejących modułów `lib/community/*`, nowe funkcje odczytowe eksportowane dla RSC** (ten projekt renderuje głównie przez Server Components + server actions, nie REST — zgodnie z `docs/adr/0000-architektura-stanu-obecnego.md` sekcja 5). Nowe trasy HTTP tylko tam, gdzie potrzebny jest klient (SSE już istnieje) — nie projektuję nowych REST endpointów w tym zadaniu poza jednym wyjątkiem (8.5).

| Potrzeba (US) | Nowe czy rozszerzenie | Moduł / funkcja |
|---|---|---|
| Hub "Dziś w zespole": miejsce w rankingu + wskazówka (US-1) | Rozszerzenie | `lib/community/fcs-compute.ts`: nowa funkcja `getMyRankingSummary(teamId, userId)` zwracająca `{ rank, score, gapToNext: { rank, score, delta } | null, tip: string }`, budowana nad istniejącym `computeTeamFcsRanking` (bez zmiany algorytmu) |
| XP osoby i grupy na stronie grupy i hubie (US-2) | Rozszerzenie prezentacji | `lib/community/progression.ts`: `getUserProgressionView` i nowa `getTeamProgressionView(teamId)` (odczyt `team_xp`, dziś niewykorzystywany w UI) — żadnej nowej logiki zapisu |
| Pierścienie tygodnia (US-3) | Nowe (cienkie) | `lib/community/rings.ts` (nowy plik, mała logika odczytowa + `awardProgressionXp` przy zamknięciu, sekcja 4.2); czyta `fitness-goals.ts`, `userSettings`, `workouts` |
| Seria tygodni (US-4) | Rozszerzenie ekspozycji | `fcs-compute.ts` już liczy `streakWeeksFromDates` — eksportować w widoku rankingu zamiast tylko jako komponent wagi |
| Katalog odznak z progresem (US-5), rzadkość (US-6) | Nowe | `lib/community/badge-catalog.ts` (nowy): `getBadgeCatalogForUser(userId)` łączy `badge_definitions` + `user_badges` (LEFT JOIN po `definitionKey`/`badgeKey`) + progres (liczony z istniejących źródeł: `challenges.ts` progress, `workouts` dla "pierwszy trening" itd.) |
| Nagroda za misję (US-7) | Bez zmian kontraktu | `team-quests.ts` (sekcja 7) |
| Rotacja misji/wyzwań (US-8, US-9) | Rozszerzenie | `team-quests.ts`: `ensureActiveQuestForTeam(teamId)` (sekcja 5); `challenges.ts`: analogiczna `ensureRotatingChallengeFor(teamId lub scope)` |
| Pojedynek 1 na 1 (US-10, v1.1) | Nowe (osobne zadanie) | Poza zakresem tego ADR — wymaga nowej tabeli `duels` i osobnej analizy/ADR przy starcie v1.1 |
| Liga wojny na hubie (US-11) | Rozszerzenie | `team-wars.ts`: `getWarsHubData` już zwraca potrzebne dane; nowa, **mniejsza** funkcja `getMyTeamWarSummary(teamId)` dla karty na hubie głównym (`/community`), żeby nie ciągnąć pełnego `getWarsHubData` (wszystkie drużyny, 50 wierszy standings) na każdym wejściu do huba — wydajność, sekcja 9 analizy NFR |
| Gratulacje w tablicy (US-12) | Rozszerzenie | `team-feed-auto.ts`: limit liczby auto-postów na trening (już powinien być `source_key` per trening — sprawdzić przy implementacji czy już ogranicza; jeśli nie, dodać dedup na poziomie "1 post typu personal_record na trening") |
| Powiadomienia o wyprzedzeniu/odznace (US-13) | Rozszerzenie | `lib/community/notifications.ts`: nowy `kind: "ranking_overtaken"`, wywoływany z `fcs-compute.ts` po przeliczeniu rankingu tygodnia (porównanie poprzedniego cache vs nowego) — **musi sprawdzać `hideFromTeamRanking`/opt-out (sekcja 4.5) przed wysyłką**, zgodnie z AC-13.2 |
| Kontrola widoczności (US-15) | Nowe pole + filtr zapytań | Sekcja 4.5; każde miejsce czytające ranking grupy (`fcs-compute.ts` ranking, przyszłe `getMyRankingSummary`) filtruje `WHERE hide_from_team_ranking = 0` **po stronie serwera** |

### 8.5 Jedyny nowy endpoint HTTP rozważany: brak w MVP

Wszystko powyżej da się zrealizować jako funkcje wołane z Server Components / server actions istniejących stron (`/community`, `/community/teams/[id]`). Jeśli `ux` zaprojektuje panel z częstym odświeżaniem (np. licznik pierścienia aktualizujący się bez przeładowania strony), **rozszerzyć istniejący SSE feedu** (`team-feed-auto` już ma SSE) o zdarzenie `ring_progress`, zamiast tworzyć nowy endpoint. Decyzja ostateczna przy implementacji, zależna od makiety `ux`.

---

## 9. Wydajność

- **Ranking grupy (max 50 członków):** już liczony z cache 45 s in-process (`CACHE_TTL_MS` w `fcs-compute.ts`). Nowe pola (`gapToNext`, `tip`) to czysta pochodna z tego samego wyniku — zero dodatkowych zapytań do Turso.
- **Rzadkość odznak (US-6):** **zakaz liczenia na żądanie** (zgodne z AC-6.3). `rarity_cache_pct` w `badge_definitions` odświeżany przez agregację wsadową: `SELECT badge_key_prefix/definition_key, COUNT(DISTINCT user_id) FROM user_badges GROUP BY ...` uruchamiana **leniwie, nie częściej niż raz na X godzin per definicję** (podobny wzorzec jak `expireIfNeeded`: sprawdź `rarity_cache_updated_at`, jeśli starsze niż np. 6 h, przelicz i zapisz, inaczej zwróć cache). Próg ukrycia (AC-6.2, N=20) liczony z tego samego zapytania — brak nowej usługi, brak nowego harmonogramu.
- **Liga wojny na hubie (US-11):** nowa, węższa funkcja `getMyTeamWarSummary` (sekcja 8) zamiast pełnego `getWarsHubData` — unika pobierania 50-wierszowego rankingu globalnego i historii 15 wojen tylko po to, by pokazać 1 kartę.
- **Katalog odznak (US-5):** zapytanie `user_badges LEFT JOIN badge_definitions` jest tanie (indeks `user_badges_user_idx` już istnieje), bez per-wejściowego skanu całej tabeli — rzadkość jest jedynym agregatem i ten jest cache'owany (punkt wyżej).
- **Cache in-process a wiele instancji Render/Vercel:** `perf-cache.ts` nie jest współdzielony między instancjami. To istniejące ograniczenie (już dotyczy FCS) — przy skalowaniu poziomym możliwe krótkotrwałe niespójności rankingu między instancjami (maks. 45 s–6 h w zależności od agregatu). Akceptowalne dla MVP, nie wprowadza nowego ryzyka ponad to, co już istnieje dla FCS.

---

## 10. Zmienne środowiskowe i nowe usługi — potwierdzenie Z7

**Potwierdzam Z7: brak nowych zmiennych środowiskowych i nowych usług zewnętrznych wymaganych przez ten projekt.** Rotacja działa przez leniwe uruchomienie (sekcja 5), rzadkość przez cache w tabeli (sekcja 9), bez crona, bez kolejki, bez Upstash poza tym, co już jest używane (rate limiting istniejących endpointów, bez zmian). Jeśli przy implementacji `backend` uzna, że leniwe uruchomienie nie wystarcza (np. właściciel chce, by misja startowała dokładnie o północy pon., niezależnie od ruchu), to wymaga osobnej decyzji i ADR — nie zakładać tego domyślnie.

---

## 11. Co NIE zmienia się w MVP (dla `backend`/`frontend` przy ewentualnej implementacji)

- **Algorytm FCS** (`lib/community/fcs.ts`) — wagi, wzór, newcomer boost. Zero zmian. Zmienia się tylko to, co i jak jest pokazywane z już policzonego wyniku.
- **Definicja tygodnia** jest już pon–nd dla rankingu (sekcja 3) — nie czekamy na żadną globalną decyzję D9, nie zmieniamy `lib/cardio.ts`.
- **Java backend** nie dostaje żadnej nowej logiki Team. `POST /api/workouts/complete` zostaje w całości po stronie TS (sekcja 2).
- **Model monetyzacji**: Team pozostaje darmowy (Z2/Q2 z analizy), żadna tabela ani kontrakt nie wprowadza bramki pakietu.
- **Dane zabronione** (BR-3, BR-12): żadna nowa tabela nie przechowuje wagi ciała, obwodów, zdjęć, makro ani kalorii jako pola rankingowego. Cardio wchodzi tylko minutami (Q5 — założenie analityka, do potwierdzenia przez `prawnik`, patrz sekcja 12 poniżej).
- **Pojedynek 1 na 1 (US-10)**: poza zakresem tego ADR, osobne zadanie/ADR w v1.1 (wymaga nowej tabeli `duels`, weryfikacji serwerowej postępu, integracji z `friendships`).
- **HoF** (`hof.ts`): nie rozszerzany, tylko czytany jako jedno ze źródeł katalogu odznak.
- **Reakcje/komentarze (US-14)**: bez zmian kontraktu, zgodnie z analizą.
- **Capy anty-farmingowe** (dzienne RP, 20 zdarzeń social w FCS): bez zmian; nowe mechanizmy (pierścienie) dostają **własny** cap przez unikalność `sourceKey` tygodniowy — nie modyfikują istniejących capów.
- **IDOR w presence (audyt HIGH)**: ten projekt go nie dotyka i go nie naprawia — ale **blokuje rozszerzanie widoków "Aktywne treningi"/live na hubie**, jeśli taki widok miałby być częścią US-1/US-11 (do decyzji `ux`/`tester-bezpieczenstwa`: jeśli hub pokazuje tylko ranking/pierścienie/ligę, bez presence, nie jest zablokowany; jeśli ma pokazywać "kto trenuje live", wymaga wcześniejszego zamknięcia IDOR).

---

## 12. Punkty do korekty po decyzji prawnika/UX (zostawione świadomie otwarte)

1. **Widoczność domyślna (Q3, BR-9):** sekcja 4.5 projektuje `hide_from_team_ranking` jako **opt-out** (domyślnie widoczny w grupie, zero poza grupą — zgodnie z założeniem analityka). Jeśli `prawnik` zdecyduje inaczej (np. opt-in zamiast opt-out, albo potrzebna osobna zgoda przy dołączeniu do grupy), kolumna i domyślna wartość (`DEFAULT 0`) mogą wymagać zmiany na `DEFAULT 1` lub przeniesienia decyzji do ekranu dołączania do grupy (`teams.ts` join flow) — nie zmienia to struktury tabeli, tylko wartość domyślną i miejsce, gdzie się ją ustawia.
2. **Cardio w rywalizacji (Q5, BR-3):** model w sekcji 4.2 zakłada tylko `cardioMinutes` (żadnych pól tętna/kcal w żadnej nowej tabeli ani zapytaniu rankingowym). Jeśli `prawnik` zakwestionuje nawet same minuty jako pole wymagające zgody, pierścień cardio (US-3) staje się **Could** zamiast **Should** — nie wymaga zmiany schematu, tylko wyłączenia widoku w UI.
3. **Konta 16-17 lat (AC-15.4, D18):** poza zakresem tego ADR (D18 nie jest wdrożone). Gdy D18 wejdzie, filtr `hide_from_team_ranking`/widoczności poza grupą ma dodatkowo sprawdzać wiek konta — punkt do uwzględnienia w implementacji `getMyRankingSummary`/katalogu, nie wymaga nowej kolumny (data urodzenia już musi istnieć dla D18 niezależnie).
4. **Widoczność per-grupa zamiast globalnej (wzmianka w sekcji 4.5):** jeśli `ux`/`prawnik` uzna model per-grupa za konieczny od MVP (nie Could), zmienić miejsce kolumny z `user_social_profiles` na `team_members.hide_from_ranking` — izolowana zmiana, nie wpływa na resztę ADR.

---

## 13. Fazowanie (zgodne z MoSCoW analizy, sekcja 9)

| Faza | Zakres | Zależność |
|---|---|---|
| **0 — Blokująca** | Potwierdzenie z właścicielem: czy `JAVA_API_BASE_URL` jest ustawione na produkcji dla `/api/workouts/complete` (sekcja 2.2 pkt 2). Jeśli tak: naprawić to jako osobny, pilny incydent przed czymkolwiek innym. | — |
| **1 — Widoczność istniejących sygnałów** | US-1, US-2, US-11 (karta wojny na hubie) — zero nowych tabel, tylko nowe funkcje odczytowe nad istniejącymi danymi (sekcja 8) | Faza 0 |
| **2 — Katalog i rotacja** | US-5, US-6, US-8, US-9 — `badge_definitions`, `user_badges.definition_key`, `ensureActiveQuestForTeam` + CAS start misji (sekcja 6), rarity cache | Faza 1 (dla spójnej prezentacji XP obok katalogu) |
| **3 — Widoczność i zgodność prawna** | US-15, US-16 — `hide_from_team_ranking`, filtrowanie rankingu, dopiero po ocenie `prawnik` | Może iść równolegle z fazą 2, musi być gotowa **przed** wdrożeniem fazy 1/2 na produkcję (kolejność wdrożenia ≠ kolejność projektowania — zgodnie z priorytetyzacją analizy: "Kontrola widoczności jest warunkiem wstępnym dla wdrożenia 1 i 2 w produkcji") |
| **4 — Pierścienie i seria** | US-3, US-4 — `lib/community/rings.ts`, ekspozycja `streakWeeks` | Faza 1 (potrzebuje widoku huba) |
| **5 — Rytm społeczny** | US-12, US-13 | Faza 1 |
| **6 — v1.1** | US-10 (pojedynki 1 na 1) — osobne zadanie i ADR | Po fazie 3 (wzorce widoczności/CAS muszą być sprawdzone w praktyce) |

Naprawa CAS dla `team-wars.ts` (sekcja 6, wiersz "wars finalize") powinna wejść **w fazie 1**, razem z US-11, bo to ta sama ścieżka kodu (`getWarsHubData`), a US-11 zwiększa ruch na niej.

---

## 14. Lista kontrolna zgodności z `AGENTS.md` dla implementacji (do przypomnienia `backend`/`frontend`, nie wykonywana w tym ADR)

- Migracja Drizzle (`npm run db:generate`) **i** wpis w `db/ensure-schema.ts` dla: `badge_definitions`, `user_badges.definition_key`, `user_social_profiles.hide_from_team_ranking`, `team_active_quest_lock` (sekcja 6).
- Brak nowych zmiennych środowiskowych (sekcja 10) — jeśli to się zmieni przy implementacji, wpis w `lib/admin-config-status.ts` i `env.example` obowiązkowy.
- Changelog (`components/changelog/changelog-data.ts`) z `planned: true` na PR.
- `npm run deploy:check` przed merge.
- Android: brak zmian w `/api/android/*` (Z8) — strony Team renderowane w WebView bez zmian kontraktu.

---

**Werdykt etapu 3 (architekt): ZATWIERDZONE Z UWAGAMI.**

Uwagi (nieblokujące projekt, do pilnowania przy implementacji):
1. Potwierdzenie stanu `JAVA_API_BASE_URL` na produkcji jest **działaniem właściciela poza tym zadaniem** — ADR zakłada najbezpieczniejszy wariant (TS jako jedyna ścieżka), ale nie może wykluczyć, że ktoś ustawi tę zmienną później bez świadomości konsekwencji dla `/api/workouts/complete`. Rekomendacja dodatkowa: rozważyć w osobnym zadaniu "twardą blokadę" — jawny log/alert startowy, jeśli `JAVA_API_BASE_URL` jest ustawione, dopóki `WorkoutService` w Javie nie ma trwałego zapisu (poza zakresem 012).
2. Partial unique index (`WHERE status = 'active'`) wymaga potwierdzenia wsparcia w wersji libSQL/Turso używanej przez projekt — jeśli niewspierane, użyć wariantu z tabelą-semaforem opisanego w sekcji 6 (już zaprojektowanego jako plan B, nie blokuje decyzji).
