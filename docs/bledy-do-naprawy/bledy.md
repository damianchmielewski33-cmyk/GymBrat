# Błędy do naprawy później — cała aplikacja

Jeden wspólny worek dla całej aplikacji GymBrat, nie per zadanie. Tu trafiają wszystkie znaleziska **niskiego/średniego ryzyka, nieblokujące** wykryte przez zespół agentów podczas dowolnego zadania (testy funkcjonalne, bezpieczeństwo, wydajność, ux, prawo) — zgodnie z zasadą „Błędy brzegowe i niski priorytet" w `docs/zespol/przeplyw.md`. Właściciel (użytkownik) przegląda tę listę samodzielnie i decyduje, co i kiedy naprawić. **Pozycje stąd nie wracają automatycznie do zespołu** — żaden agent nie cofa zadania ani nie wszczyna naprawy pozycji z tego pliku bez wyraźnej decyzji właściciela.

Nowe pozycje dopisuje koordynator na końcu właściwej sekcji (albo nowej, jeśli żadna nie pasuje), z kolumną **Zadanie źródłowe** (numer/nazwa karty w `docs/zadania/`, np. `005`). Gdy właściciel decyduje się coś naprawić, pozycję można usunąć z tego pliku albo oznaczyć jako „W TRAKCIE" / „ZROBIONE" (nie usuwać automatycznie — niech ślad zostanie do czasu potwierdzenia).

## Mikrokopia / tekst
| Opis | Lokalizacja | Zadanie źródłowe | Źródło (agent) |
|---|---|---|---|
| B-1: przycisk „Zakończ trening” na ekranie przerwy po ostatniej serii (rzadka, defensywna gałąź) zapisuje od razu bez słowa „zapisz” w etykiecie | `components/active-workout/rest-break-screen.tsx:260-261`, `active-workout-view.tsx:697-703` | 005 | prawnik, etap 10 |
| B-2: „Zapisano X z Y serii” i kicker „Trening zakończony” na ekranie przerwy pojawiają się przed faktycznym zapisem treningu — sugerują trwały zapis przedwcześnie | `rest-break-screen.tsx:183,189` | 005 | prawnik, etap 10 |
| B-3: tekst „Ciężary są w historii i w Postępach” nieprawdziwy dla treningu złożonego z samych serii na masę ciała (brak ciężarów) | `workout-finished-screen.tsx:343` | 005 | prawnik, etap 10 |
| B-4: wpis w changelogu „Zapowiedź — Koniec treningu” nie wspomina, że serie na masę ciała są teraz widoczne dla rywali Ghost Training, także w treningach historycznych | `components/changelog/changelog-data.ts` | 005 | prawnik, etap 10 |

## Decyzje produktowe/prawne wymagające właściciela-człowieka (przed Promote)
| Opis | Opcje | Zadanie źródłowe | Źródło |
|---|---|---|---|
| Q-P2: czy tętno/kalorie/kroki/dystans z cardio to dane zdrowotne art. 9 RODO | (A) zgoda art. 9 przy pierwszym wpisie tętna/kroków (osobne, wersjonowane, wycofywalne pole), albo (B) do czasu zgody nie zapisywać tętna/kroków po treningu | 005 | prawnik, etap 2 i 10 |
| U-1: lider zespołu bez flagi `mutualShare` widzi zmianę widoczności Ghost (bodyweight) — czy to wymaga osobnej decyzji | decyzja właściciela produktu | 005 | prawnik, etap 10 |
| N-7h-1: retencja `active_workout_sessions` (7 dni) vs mechanizm tombstone (zakłada że wiersz nigdy nie znika fizycznie) | rekomendacja prawnika: zerować payload po 24-72h (podmiana na tombstone), 7 dni jako maksimum do fizycznego purge; wymaga zatwierdzenia w `docs/prawo/01-...` | 005 | prawnik, etap 10; tester, etap 7h |
| LR-7: `lib/pr-achievement-image.ts` wysyła `valueKg` w seedzie do Pollinations i ręczną nazwę ćwiczenia w promptcie | usunąć `valueKg` z seeda, test regresji | 005 | prawnik, etap 2 i 10 |
| Aktualizacja dokumentów prawnych po zatwierdzeniu: `docs/prawo/00-inwentaryzacja-danych.md` (kategoria 9), `docs/prawo/01-podstawy-prawne-i-retencja.md` (wiersz 9, okres retencji), polityka prywatności (tętno/kroki) | — | 005 | prawnik |

## Dług techniczny / bezpieczeństwo (niskie)
| Opis | Lokalizacja | Zadanie źródłowe | Źródło |
|---|---|---|---|
| F-1b: `db/with-retry.ts` loguje obcięty komunikat SQL (głównie identyfikatory, nie dane zdrowotne) przy przejściowym błędzie | `db/with-retry.ts:44-48` | 005 | tester-bezpieczenstwa |
| F-1c: `instrumentation.ts` loguje surowy błąd przy starcie (głównie zaszyfrowane wartości) | `instrumentation.ts` | 005 | tester-bezpieczenstwa |
| R-1: łańcuch `cause` w błędzie może ominąć sanityzację `captureToSentry`, jeśli ktoś w przyszłości doda opakowanie błędu bazy bez `original` | `lib/errors/server-log.ts` | 005 | tester-bezpieczenstwa |
| F-4: `isActiveWorkoutCloudPayload` nie waliduje elementów `exercises`; brak limitu rozmiaru body (PUT/POST complete) | `lib/active-workout-cloud.ts` | 005 | tester-bezpieczenstwa |
| F-5: `GET /api/active-workout-session` może mutować (wygaszanie ghost) — ryzyko CSRF-GET ograniczone przez SameSite | `app/api/active-workout-session/route.ts` | 005 | tester-bezpieczenstwa |
| F-6: `clientIpFromHeaders` bierze pierwszy wpis `x-forwarded-for` (spoofowalny bez poprawnej konfiguracji platformy) | `lib/rate-limit.ts:70-76` | 005 | tester-bezpieczenstwa |
| F-7: brak maksimum `revision` w `putSchema`/`deleteSchema` (self-DoS) | `app/api/active-workout-session/route.ts` | 005 | tester-bezpieczenstwa |
| F-8: ścieżka Javy `/complete` dedup w pamięci, bez trwałości/limitu mapy; Java nie wspiera PATCH cardio (świadomie, ADR p.9) | `java-backend/...` | 005 | architekt, tester-bezpieczenstwa |
| F-9: brak testu izolacji wielu użytkowników w dedupie `/complete` | `app/api/workouts/complete/route.test.ts` | 005 | tester-bezpieczenstwa |
| N-7h-3: `PATCH` cardio to read-modify-write bez CAS (ta sama klasa co naprawione `activeWorkoutSessions`, ale okno ms na własnych danych użytkownika) | `app/api/workouts/[workoutId]/cardio/route.ts` | 005 | tester, etap 7h |
| N-7h-4: `publishTeamFeedAfterWorkout` bez ponowienia po błędzie publikacji | `app/api/workouts/complete/route.ts` | 005 | tester, etap 7h |
| N-7h-5: `isUniqueViolation` rozpoznaje tylko komunikat błędu SQLite, nie zweryfikowano na Turso/Hrana | `db/errors.ts` | 005 | architekt, etap 3g |
| 7 plików z wzorcem SELECT-then-UPDATE bez CAS poza `activeWorkoutSessions` (osobny dług, nie ten sam mechanizm) | `lib/community/hof.ts`, `team-quests.ts`, `team-wars.ts`, `progression.ts`, `teams.ts`, `lib/meal-catalog-images.ts`, `lib/app-settings.ts` | 005 | architekt, etap 3g — priorytet: `team-wars.ts`/`team-quests.ts` |
| N-P13-2: `clearedPushedRef` od `false` zamiast `true` na świeżej karcie — zbędny jeden DELETE, bez wpływu na poprawność po naprawie CAS | `components/active-workout/active-workout-cloud-sync.tsx` | 005 | architekt, etap 3e |
| Ten sam błąd etykiety „TYDZIEŃ N” (numer sesji dnia planu mylony z tygodniem) co naprawiany w liście historii (011) występuje też na ekranie edycji sesji | `components/workout-history/workout-history-edit-client.tsx:206` | 011 | architekt, etap 3 (ADR 0010, sekcja 6.1) |
| Dwie niezależne implementacje liczenia tonażu/czasu/liczby serii z tego samego surowego JSON sesji (`lib/treningi-hub-stats.ts` reimplementuje, zamiast reużyć `computeWorkoutDetails` z `lib/workout-history.ts`) — ryzyko rozjazdu liczb między Pulpitem a historią | `lib/treningi-hub-stats.ts`, `lib/workout-history.ts` | 011 | architekt, etap 3 (ADR 0010, sekcja 2.8/6.2) |
| `planCompareKey` po znormalizowanej nazwie dnia planu rozdziela historię/porównania przy zmianie nazwy dnia — istniejące zachowanie całego modułu porównań (używane też w 005), do oceny w osobnym zadaniu | `lib/workout-plan-compare-key.ts` | 011 | architekt, etap 3 (ADR 0010, sekcja 2.10/6.3) |
| Rozjazd licznika nagłówka historii (`workoutsTotal - removedIds.size`) po usunięciu treningu na dwóch urządzeniach jednocześnie — rzadki wyścig, niski priorytet | `components/workout-history/workout-history-view.tsx` | 011 | architekt, etap 3 (ADR 0010, sekcja 2.9/6.4) |

## Wydajność
| Opis | Zadanie źródłowe | Źródło |
|---|---|---|
| P3 właściwe: PUT co 8s z pełnym payloadem (~9,4KB), ~40% darmowego limitu zapisów Turso przy 300 treningach/dzień — decyzja architekta: wykrywanie zmian przed PUT, odchudzenie payloadu (-52% możliwe) | 005 | tester-wydajnosci |
| `schedulePush`/`pendingChangeRef` w `finally` omija bramkę backoff przy realnej zmianie (nie pętla, ale każda zmiana podczas 429 = żądanie) | 005 | tester-wydajnosci |
| Listener `online` w `active-workout-cloud-sync.tsx` nie jest zdejmowany w cleanup efektu | 005 | tester-wydajnosci |
| Dedup SELECT w `/complete` mógłby iść równolegle z `planRow`/`recent` (`Promise.all`) zamiast szeregowo | 005 | tester-wydajnosci |
| `use-workout-finish-flow.ts`: `fetchLastWorkoutHintsForPlan` szeregowo przed `submitCompletedWorkout`, mogłoby być `Promise.all` | 005 | tester-wydajnosci |
| 403 z CSRF/origin traktowane jak 401 w `pausedAuthRef` — wstrzymuje sync bez ponowienia (ryzyko niskie) | 005 | tester-wydajnosci, etap 9g |
| Kolejność efektów: `pausedAuthRef` resetowany w drugim efekcie (push), ale `hydrate()` w pierwszym efekcie czyta flagę wcześniej — po 401 i ponownym zalogowaniu bez przeładowania strony hydracja z chmury może być pominięta raz | 005 | tester-wydajnosci, etap 9g |

| Historia treningów: zapytanie ogranicza się do 400 ostatnich sesji (`.limit(400)`), bez komunikatu; KPI „łącznie” (tonaż, liczba treningów) cicho zaniża wynik dla użytkowników z dłuższą historią; cała lista z seriami idzie w jednym payloadzie | `lib/workout-history-overview.ts:357` | 011 | analityk, etap 1 (decyzja Q3 w analizie 011) |

## Redesign Team (012): prawo, decyzje właściciela (nieblokujące)
| Opis | Lokalizacja | Zadanie źródłowe | Źródło (agent, etap) |
|---|---|---|---|
| Z-1: czy minuty cardio (bez tętna i kalorii) traktować ostrożnościowo jako dane pośrednio art. 9; przyjęto zgodę osobną C-T2 - decyzja właściciela i prawnika-człowieka | `docs/prawo/012-redesign-funkcji-team.md` (3.1, 3.3) | 012 | prawnik, etap 2 |
| Z-2: czy zwolnienie mikroprzedsiębiorstw z DSA art. 19 (i art. 28 o małoletnich) obejmie GymBrat po rejestracji działalności - pytanie do prawnika-człowieka | `docs/prawo/012-redesign-funkcji-team.md` (4) | 012 | prawnik, etap 2 |
| Z-3: posty ręczne członka po wyjściu z grupy - usunąć czy anonimizować (domyślnie: auto-posty usuwane, komentarze z oznaczeniem "były członek") | `docs/prawo/012-redesign-funkcji-team.md` (6.2, LR-T9, PO-T3) | 012 | prawnik, etap 2 |
| Z-4: pole `age` bez daty urodzenia starzeje się; decyzja, czy wystarczy samodeklaracja 16+ przy progu wiekowym | `users.age`, `lib/validations/register.ts` | 012 | prawnik, etap 2 (PO-T7) |
| Z-5: lista publicznych grup i liczba członków widoczna dla niezalogowanych (niskie ryzyko, do oceny po hotfixie B-2) | `lib/community/discover.ts:44-58` (`listPublicTeams`) | 012 | prawnik, etap 2 |
| Z-6: komponent "live" w FCS ujawnia obecność na treningu w czasie rzeczywistym; domyślnie wyłączyć w MVP (C-T5) - decyzja właściciela | `lib/community/fcs.ts`, analiza 012 sekcja 2.1 | 012 | prawnik, etap 2 |

## UX
| Opis | Lokalizacja | Zadanie źródłowe |
|---|---|---|
| S-1: `aria-controls` na nieistniejący `id` przy zwiniętym „Zobacz postęp” | `workout-finished-screen.tsx` | 005 |
| S-2: wiersz cardio bez `aria-expanded`, bez szewronu i etykiety „Edytuj” | `workout-finished-screen.tsx` | 005 |
| S-3: brak etykiety „Minuty cardio” i obsługi Esc w edytorze cardio | `workout-finished-screen.tsx` | 005 |
| S-4: kontener główny to `div` zamiast `section aria-labelledby` | `workout-finished-screen.tsx` | 005 |
| S-5: `sr-only` licznika serii przy `setsTotal = 0` (praktycznie nieosiągalne) | `workout-finished-screen.tsx` | 005 |
| S-6: pusta karta „Najlepsze serie”, gdy brak ćwiczeń | `workout-finished-screen.tsx` | 005 |
| S-7: tekst błędu na ekranie zapisu 13px zamiast 14px; przyciski w `max-w-lg` zamiast `max-w-sm` | `workout-saving-screen.tsx` | 005 |
| S-8: lista w „Zobacz postęp” renderuje `ex.name` zamiast `displayExerciseName(ex.name)` | `workout-finished-screen.tsx:619` | 005 |
| N-22-2: `aria-label` „Kontynuuj trening” przy widocznym tekście „Kontynuuj” | `active-workout-global-bar.tsx:107` | 005 |
| N-23-1: ćwiczenie ze statusem „nowe” i tonażem 0 pokazuje „—” zamiast badge „nowe” (gałąź „—” sprawdzana pierwsza) | `workout-finished-screen.tsx` | 005 |
| N-23-2: brak `sr-only` przy „—” (brak porównania) dla czytnika ekranu | `workout-finished-screen.tsx` | 005 |
| D-05: niespójność czasu trwania między ekranem końcowym (bez pauz) a historią (z pauzami) — pre-istniejące, wymaga decyzji analityka co to jest „czas treningu” | `use-workout-finish-flow.ts`, `lib/workout-history-overview.ts` | 005 |
| D-09: parytet Java (brak PATCH cardio, brak planCompare) — świadomie poza zakresem, ADR p.9 | `java-backend/...` | 005 |

## Środowisko / weryfikacja wymagająca zewnętrznych zasobów
| Opis | Wymaga | Zadanie źródłowe |
|---|---|---|
| D-07 / N-7g-1: `npm run test:e2e` nigdy faktycznie nie uruchomiony w żadnej sesji tego zadania | `E2E_EMAIL`/`E2E_PASSWORD`, środowisko Playwright | 005 |
| `npm run deploy:check` przed merge (wymóg `AGENTS.md`) | uruchomienie przed PR/merge | 005 |
| Zachowanie unikalnego indeksu `(userId, operationId)` z `NULL` na realnym Turso/libSQL — zweryfikowane tylko na SQLite `:memory:` | branch deweloperski Turso | 005 |
| Test eksportu danych (`lib/user-data-export.ts`) po patchu cardio (LR-8) | — | 005 |
| Potwierdzenie, czy Android woła `/api/workouts/complete` bezpośrednio (backend potwierdził że NIE — WebView, ale warto re-zweryfikować przy zmianie natywnej apki) | — | 005 |

## Analiza postępów (009): decyzje produktowe i dług poza zakresem UX
| Opis | Lokalizacja | Zadanie źródłowe | Źródło (agent, etap) |
|---|---|---|---|
| Q-U2: cele „Następne cele” (15 cm w pasie, 50 t, 4 tygodnie) stałe w kodzie; czy użytkownik ma je ustawiać w profilu | `lib/progress-hub.ts` (`waistGoalCm`, `tonnageGoalKg`, `streakGoal`) | 009 | ux, etap 4 (decyzja właściciela) |
| Q-U5: dieta i cardio w zakładce Tygodnie zwinięte (propozycja), czy mają być osobnymi zakładkami | `components/progress/week-tab.tsx` | 009 | ux, etap 4 (decyzja właściciela) |
| Q-U6: miejsce osiągnięć („Zdobyte”) - propozycja: karta zwinięta na Przeglądzie, nazwa „Osiągnięcia” | `components/progress/overview-tab.tsx` | 009 | ux, etap 4 (decyzja właściciela) |
| Q-U3: próg stagnacji (28 dni, min. 3 sesje) do potwierdzenia po testach danych | `lib/analytics/` (stagnacja) | 009 | ux, etap 4 (`architekt` + właściciel) |
| Definicje „twardych serii” i RIR/RPE w `Explainer` do potwierdzenia z kodem przed publikacją tekstu | `lib/intensity-analysis.ts` | 009 | ux, etap 4 |
| W2: „kg/tydz. 6 tygodni” to różnica końców okna; UI ma etykietę „Zmiana w 6 tyg.”, metoda (regresja/średnia) do decyzji | `lib/progress-hub.ts`, `components/progress/body-tab.tsx` | 009 | ux, etap 4 (`architekt` + właściciel) |
| Kolor złota poza tokenem (`#d4af37`, `#DDBB6D`, `#D6B36A` i inne odcienie) w wykresach i raportach poza modułem analizy | `components/reports/*`, `components/home/weight-range-chart.tsx`, `components/layout/app-shell.tsx` | 009 | ux, etap 4 (`docs/ux/00-system-projektowy-stan.md` pkt 8.1) |
| Kafel statystyki w czterech wersjach poza modułem (`AppStatTile`, `StatCard`, `AdminStat`); w 009 zostaje `StatTile` z `progress-ui.tsx` | `components/layout/screen.tsx`, `components/reports/stat-card.tsx`, `components/admin/admin-ui.tsx` | 009 | ux, etap 4 |
| Kontrast `text-white/40|35|30` (naprawiany w module analizy) występuje dalej w innych modułach | cała aplikacja, m.in. `components/home/*` | 009 | ux, etap 4 (`docs/ux/00-system-projektowy-stan.md` pkt 7) |
| Nazwy pasm w kodzie (np. „przeciążenie”) mogą wrócić w innych miejscach aplikacji (poza analizą) - przegląd słownictwa | `lib/analytics/fatigue-score.ts` (źródło etykiet) | 009 | ux, etap 4 (BR-7) |
| W6: nie zweryfikowano w pełni, czy produkt w dzienniku posiłków bez wartości odżywczych jest liczony jako „brak danych” czy jako 0 kcal w agregacji tygodniowej dieta-vs-trening — weryfikacja wymaga przeczytania całej warstwy agregacji posiłków (`replaceConsumptionWithMealLogs` i wyżej), nie tylko `diet-training-weeks.ts` | `lib/diet-training-weeks.ts:169-215` i warstwa budująca `NutritionDaySummary` z wpisów dziennika | 009 | architekt, etap 3 (ADR 0008, sekcja 2/8) |
| Indeks `idx_workouts_user_tonnage` (nowa kolumna `workouts.tonnage_kg`, ADR 0008) odłożony do pomiaru rzeczywistej potrzeby na danych produkcyjnych, zamiast dodawać „na wszelki wypadek” | `db/schema.ts` (`workouts`) | 009 | architekt, etap 3 (ADR 0008, sekcja 3.1/8) |
| Wzmianki `progress-analysis` w `components/layout/app-shell.tsx` i `lib/analytics-screen.ts` (znalezione przez Grep przy weryfikacji martwego kodu W7) nie zostały jednozdaniowo potwierdzone jako nieszkodliwe (prawdopodobnie nazwy ekranów analityki zdarzeń, nie importy) — do potwierdzenia przez `backend` tuż przed usunięciem `components/progress-analysis/*` | `components/layout/app-shell.tsx`, `lib/analytics-screen.ts` | 009 | architekt, etap 3 (ADR 0008, sekcja 2/4) |

## Historia treningów (011): UX poza zakresem lub niskie ryzyko
| Opis | Lokalizacja | Zadanie źródłowe | Źródło (agent, etap) |
|---|---|---|---|
| Strona szczegółu sesji `workout-history/[id]` nie ma projektu UX i po zmianie linku z Pulpitu (rekomendacja 011: lista z rozwiniętym wierszem) nie ma wejścia z listy; decyzja właściciela: zostawić czy usunąć | `app/(dashboard)/workout-history/[id]/page.tsx` | 011 | ux, etap 3 (A-4) |
| Ekran edycji sesji ma inny nagłówek niż przeprojektowana historia; ujednolicenie w osobnym zadaniu (formularz bez zmian) | `app/(dashboard)/workout-history/[id]/edit/page.tsx` | 011 | ux, etap 3 (sekcja 5.2 analizy) |
| Kontener historii `max-w-lg` zamiast `APP_SHELL_MAX` (węższy ekran na tabletach niż reszta aplikacji) | `components/workout-history/workout-history-view.tsx` (kontener główny) | 011 | ux, etap 3 (`00-system` sekcja 2) |
| Payload historii zawiera `cardio` (do 30 wpisów) nieużywany w widoku; zbędny transfer do czasu decyzji o cardio w historii (Q5) | `lib/workout-history-overview.ts` (`cardio`) | 011 | ux, etap 3 (analiza 2.3, Q5) |
| Pulpit „Ostatnie treningi” prowadzi wierszem do szczegółu, a stopką do listy; po wdrożeniu deep linku `?sesja=` ujednolicić oba wejścia | `components/home/home-recent-workouts.tsx` | 011 | ux, etap 3 (AC-10.1) |
| Nagłówki ekranów historii, szczegółu i edycji nie korzystają ze wspólnego `AppPageHeader` (Wróć tekstowy, inny kicker) | `workout-history-view.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx` | 011 | ux, etap 3 (`00-system` pkt 9) |
| Duplikat wzorca chipów filtra (`fbar`/`chp`) w innych listach z filtrem (np. atlas, hub) - kandydat do wspólnego komponentu po wdrożeniu 011 | `components/workout-plan/*`, `components/community/*` | 011 | ux, etap 3 (`00-system` sekcja 4) |

## Plany treningowe / atlas (008): dokończenie v1.1
| Opis | Lokalizacja | Zadanie źródłowe | Źródło (agent) |
|---|---|---|---|
| Pełna karta ćwiczenia (`?cwiczenie=`) z sekcją „Tylko dla Ciebie” — v1 ma atlas partii/listę bez szczegółów | `components/plany/atlas-client.tsx`, `actions/user-exercise-notes.ts` | 008 | koordynator (implementacja) |
| Pełny CRUD admina ćwiczeń + UI wyszukiwania YouTube (wrapper API już jest) | `components/admin/admin-exercises-client.tsx`, `lib/exercises/youtube-search.ts` | 008 | ADR 0007 §2.4/2.4a |
| Tryb „Zmień kolejność” planów na liście (↑↓ z natychmiastowym zapisem) | `components/plany/plan-list-client.tsx` | 008 | ux §4.3 |
| Prywatna notatka ćwiczenia w eksporcie danych / usuwaniu konta | `user_exercise_notes` | 008 | ux Q-A6 / prawnik |
| Treści opisów i cue dla atlasu (BR-11) — migracja seed bez opisów | tabela `exercises` | 008 | właściciel produktu |
