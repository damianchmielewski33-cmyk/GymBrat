# 005 - Koniec treningu: testy funkcjonalne (etap 7)

- **Zadanie**: `docs/zadania/005-koniec-treningu-przeplyw.md`
- **Autor**: tester (etap 7, pełny plan testów - zmiana wysokiego ryzyka: reguła zaliczenia serii, idempotencja zapisu, kontrakt API, wiele modułów)
- **Data**: 2026-10-25
- **Gałąź**: `feat/koniec-treningu-flow`
- **Podstawa**: `docs/analiza/005-koniec-treningu-przeplyw.md` (P1-P10, E-1..E-17), `docs/adr/0004-koniec-treningu-przeplyw.md`, `docs/ux/005-koniec-treningu-przeplyw.md`
- **Metoda**: testy automatyczne Vitest (node, bez DOM) + weryfikacja kryteriów przez czytanie kodu (brak środowiska E2E w tej sesji). Każde kryterium oznaczone: **A** = test automatyczny, **C** = potwierdzone czytaniem kodu (wskazane miejsce), **N** = niezweryfikowane (wymaga E2E / ręcznego przejścia).

---

## 1. Zakres testów

1. Przegląd istniejących testów dodanych przez backend/frontend i ocena pokrycia względem P1-P10 oraz E-1..E-17.
2. Dopisanie testów automatycznych tam, gdzie możliwe bez DOM (repo nie ma `@testing-library/react` ani środowiska `jsdom`; `vitest.config.ts` obejmuje `**/*.test.ts` w środowisku `node`).
3. Weryfikacja przez czytanie kodu: trzy ścieżki zakończenia, reguła masy ciała (0 kg), błąd zapisu i `operationId`, patch cardio (0 min), kolejka offline, pierwsza sesja planu (D-4).
4. Spójność danych między ekranem serii przed zapisem a ekranem „Trening zakończony” (tonaż, serie, czas).
5. Regresja: `npm test`, `npx tsc --noEmit`, `npm run lint`.

Poza zakresem tego etapu: wizualna zgodność z makietą (etap 8, `ux`), testy bezpieczeństwa i wydajności (etap 9), E2E w Playwright (nie uruchamiane w tej sesji).

---

## 2. Dopisane testy automatyczne

| Plik | Nowe testy | Co pokrywają |
|---|---|---|
| `components/active-workout/use-workout-finish-flow.test.ts` (nowy, 12 testów) | 12 | Logika `useWorkoutFinishFlow` wywołana bez DOM: `requestFinish`, `confirmFinishFromDialog`, `goToSkippedTarget`, `retry`, `returnToWorkout`, `close`. Zob. sekcja 2.1. |
| `lib/ghost-training/timeline.test.ts` | +2 | Reguła masy ciała w Ghost Training (Q-P1): 0 kg + powt. > 0 wchodzi na oś czasu z tonażem 0; `reps: null` nadal wykluczone. Wcześniej martwa strefa - brak testu. |
| `lib/workout-skipped-sets.test.ts` | +2 | Trening wyłącznie z serii na masę ciała: zero pominiętych i niewykonanych, brak celu dialogu (AC-2.2, BR-7). Seria 0 kg z jawnym „Pomiń” nadal pominięta. |

Wynik lokalny: `npx vitest run` dla tych plików - zielone (hook 12/12, timeline 6/6, skipped-sets 21/21).

### 2.1 Co dokładnie testuje `use-workout-finish-flow.test.ts`

- P2/AC-2.1: pominięta seria otwiera dialog z `skippedCount`, `incompleteCount` i pierwszym celem; zapis NIE startuje.
- AC-2.2: brak pominięć = zapis od razu, bez dialogu; po sukcesie store czyszczony (AC-3.3).
- AC-2.3 (wariant „niewykonane”): `incompleteCount` poprawny.
- 005 p.7: trening wyłącznie z serii 0 kg + powt. zapisuje się bez dialogu, tonaż 0.
- AC-2.5: „Zakończ i zapisz” z dialogu = jeden zapis; „Wróć do serii” = brak zapisu, ustawienie celu (`done=false`, `skipped=false`), `router.push("/active-workout")`.
- AC-3.2/BR-2: trzy wywołania w trakcie zapisu (dwa `requestFinish` + `retry`) = jedno żądanie.
- AC-3.4/E-6: `queued` = ekran końcowy z `saveStatus: "queued"`, `workoutId: null`, `planCompare: null`.
- AC-3.5/E-5/E-12: błąd = stan `error`, sesja w store nienaruszona (serie, `operationId`), `finishPending` wyzerowany.
- BR-2: „Spróbuj ponownie” wysyła ten sam `operationId` i ten sam `endedAt`.
- AC-3.5: „Wróć do treningu” zamyka stan błędu bez resetu sesji.
- AC-4.11: „Zamknij” nie wysyła żądania zapisu i przechodzi na `/workout-plan`.

Metoda: mock `react` (`useCallback` przepuszcza funkcję), store `useActiveWorkoutStore` zastąpiony wrapperem czytającym `getState()` (zustand v5 pobiera `React` z `node_modules`, którego mock nie obejmuje), `localStorage` stub (persist w `node`), zapis `submitCompletedWorkout` jako atrapa. Stabilne: brak `sleep`, asercje przez `vi.waitFor`.

---

## 3. Wyniki

| Komenda | Wynik |
|---|---|
| `npm test` | **1051 testów: 1049 zaliczonych, 2 niezaliczone** (140 plików: 139 OK, 1 z 2 awariami). Baseline architekta: 1035 (1033 OK, 2 niezaliczone). Dopisane przez testera: +16 (hook 12, timeline 2, skipped-sets 2). |
| `npx tsc --noEmit` | Czysto (brak błędów). |
| `npm run lint` | 140 problemów (104 błędy, 36 ostrzeżeń) - **identycznie z baseline** architekta (`5aa8209`: 141/105/36, po przeglądzie 140/104/36). Nowe pliki testów czyste (`npx eslint` na trzech plikach: 0 problemów). |

Niezaliczone (niezwiązane z tą zmianą): `lib/android-version.test.ts` - 2 testy (`bundledAndroidVersion`, `resolveAndroidVersion`), oczekiwano `11`, otrzymano `12`; źródło to `public/android-version.json`, którego nie ma w diffie gałęzi. Pre-istniejąca awaria, potwierdzona przez architekta (etap 6).

---

## 4. Pokrycie kryteriów akceptacji

Legenda: A = test automatyczny, C = czytanie kodu (miejsce podane), N = niezweryfikowane (E2E / ręcznie).

### P1 - Ostatnia seria bez przerwy
- AC-1.1 (etykieta „Zakończ ostatnią serię i zapisz”): C - `guided-session-layout.tsx:384` (`isLastOpenSet`), `:643` (`primarySetActionLabel`), `lib/active-workout-copy.ts:97`. Test etykiety: A (`lib/active-workout-copy.test.ts:80`).
- AC-1.2 (brak `startRest` po ostatniej serii): C - `active-workout-view.tsx` `patchSet`, gałąź `workoutComplete` (ok. linii 673-677) wywołuje `flow.requestFinish()` i `return` przed `startRest`.
- AC-1.3, AC-1.6 (inne serie bez zmian): C - `active-workout-view.tsx` (blok `autoStart` -> `startRest`).
- AC-1.4 (ostatnia pominięta linkiem „Pomiń”): C - `isDoneNext` = true, `workoutComplete` = true -> `requestFinish`.
- AC-1.5 (poprawa po zaliczeniu nie zapisuje ponownie): C - `wasDone` blokuje gałąź zakończenia. Brak testu automatycznego.

### P2 - Dialog pominiętych serii
- AC-2.1 (wyzwolenie): A (hook: „pominięta seria otwiera dialog…”). Wiring C: `active-workout-view.tsx:806-817` i `active-workout-global-bar.tsx:208-220`. Dialog NIE jest martwy (defekt z analizy zamknięty).
- AC-2.2 (zero wyjątków): A.
- AC-2.3 (tytuły): C - `workout-all-sets-done-dialog.tsx:24-29`. **Odstępstwo** (sekcja 5, D-11): wariant „obie” ma tytuł „Nie wszystkie serie wykonane” zamiast „Zostały pominięte serie”. Zgodne z UX D-1, niezgodne z tabelą AC-2.3.
- AC-2.4 (liczby rozdzielone): A (liczniki) + C (dl/dd w dialogu).
- AC-2.5 (przyciski): A (`goToSkippedTarget`, `confirmFinishFromDialog`). Kolor CTA: C.
- AC-2.6 (Esc/tap poza = „Wróć do serii”): C - `workout-all-sets-done-dialog.tsx:71-74` (Radix `onOpenChange(false)` -> `onGoToSkipped`). Przyciski wywołują prop `onOpenChange` bezpośrednio, więc „Zakończ i zapisz” nie uruchamia powrotu (brak wyścigu).

### P3 - Zapis w momencie potwierdzenia
- AC-3.1 (kolejność: ekran zapisu przed „Trening zakończony”): A częściowo (faza `done` dopiero po sukcesie), C - `use-workout-finish-flow.ts:43` (`saving`) przed `submitCompletedWorkout`, `:136` (`done`) po nim.
- AC-3.2 (jeden zapis): A.
- AC-3.3 (sukces: store czyszczony, P4): A.
- AC-3.4 (kolejka): A.
- AC-3.5 (błąd: stan błędu, „Spróbuj ponownie” z tym samym `operationId`, „Wróć do treningu”): A (hook). Teksty: C - `workout-saving-screen.tsx:93-123`.
- AC-3.6 (bez `window.alert`): C - brak `alert(` w `components/`, `lib/`, `app/` poza testami.
- AC-3.7 (wolne połączenie po 10 s, bez przycisków): C - `workout-saving-screen.tsx:10,54,102`.
- AC-3.8 (ARIA i rozmiar celu): C - `role="alert"` w błędzie, `aria-live="polite"` w zapisie, przyciski `h-14` / `h-12` (>= 44 px). Wizualnie: etap 8.

### P4 - Ekran „Trening zakończony”
- AC-4.1 (tytuł, data lokalna): C - `workout-finished-screen.tsx:288` (tytuł), `:186-196` (`endedLabel` z `endedAtMs`).
- AC-4.2 (tonaż i delta z `planCompare`, bez nowego zapytania): C - `:340-352`; dane z `result.planCompare` (`use-workout-finish-flow.ts:129`).
- AC-4.3 (brak porównania = „—” + tekst): C - `volumeCaption` `:101-122` (warianty: brak planu, pierwsza sesja, zero tonażu). D-4: karta „Zobacz postęp” ukryta, gdy `previousVolumeKg` nie jest > 0 (`:214-218`) - zgodne z D-4.
- AC-4.4 (czas, serie, ćwiczenia): C - `:362` (`formatWorkoutDurationPl`). Spójność czasu: **defekt D-05** (sekcja 5).
- AC-4.5/4.6 (najlepsze serie + wszystkie serie w linii 2): A (`lib/workout-finish-sets-line.test.ts`) dla linii 2; C dla wiersza głównego.
- AC-4.7 (nowe rekordy, bez zmian logiki): C - `:396` (sekcja „Nowe rekordy”); logika `session-new-max.ts` bez zmian.
- AC-4.8 (zobacz postęp rozwijany, `aria-expanded`): C - `:497-502`.
- AC-4.9 (brak `planCompare` = brak przycisku): C - `:214-218`.
- AC-4.10 (pasek cardio): C - `:747` (`Dodaj cardio po treningu` / podsumowanie).
- AC-4.11 (Zamknij, bez zapisu, `/workout-plan`): A (hook: „Zamknij” kończy ekran bez żądania zapisu).
- AC-4.12 (odświeżenie nie zapisuje drugi raz): C - `finishFlow` i `finishPending` NIE są w `partialize` (`lib/stores/active-workout.ts:257-269`); po sukcesie store wyczyszczony (`reset`), więc odświeżenie nie wraca do zapisu. Brak testu E2E.

### P5 - Jedna ścieżka, jeden ekran
- AC-5.1 (brak modala „Trening zapisany”): C - `WorkoutCompletePopup` nie jest montowany (brak odwołań w `app-shell.tsx`), plik usunięty (`git status`: `D components/reports/workout-complete-popup.tsx`).
- AC-5.2 (brak `workout:completedSummary` i `gymbrat:newMaxToast`): C - grep w `components/`, `lib/`, `app/`, `actions/`: zero trafień. Jedyny klucz `sessionStorage` w przepływie to `gymbrat:workoutQueued` (`use-workout-finish-flow.ts:140-146`), zgodnie z ADR p.7.
- AC-5.3 (popup usunięty): C (plik nieobecny; grep zero).
- AC-5.4 (trzy ścieżki prowadzą do tego samego ekranu): C - ekran główny i dolne „Zakończ” (`active-workout-view.tsx:821-826` przez `WorkoutFinishConfirmDialog` -> `flow.requestFinish`), pasek (`active-workout-global-bar.tsx:201-206` -> `flow.requestFinish`). Wszystkie trzy przechodzą przez `requestFinish` z dialogiem pominiętych (Q-P4 spełnione).

### P6 - Cardio po zapisie
- AC-6.1 (wysyłane tylko pola cardio): C - `lib/workout-cardio-patch-submit.ts:25-39`, body `{cardioMinutes, cardio}`.
- AC-6.2 (w tle, tonaż klikalny): C częściowo - wskaźnik „Zapisuję cardio…” jest w edytorze (`workout-finished-screen.tsx:726-729`), a nie przy pasku; odstępstwo drobne, do decyzji `ux`.
- AC-6.3 (sukces: nowe wartości na pasku): C - `:259-276`.
- AC-6.4 (błąd: komunikat, trening bez zmian): C - `:694-698`. Komunikat jest w edytorze (nie „pod paskiem”).
- AC-6.5 (Zamknij bez cardio = brak żądania): C - `Zamknij` tylko `onClose` (`:757`), brak `patchWorkoutCardio`.
- AC-6.6 (0 min usuwa cały obiekt cardio): A - `app/api/workouts/[workoutId]/cardio/route.test.ts:80-99` (tętno, kalorie, kroki), `lib/workout-plan-compare.test.ts:133`. UI: wysyła `cardioMinutes: 0, cardio: null` (`workout-finished-screen.tsx:238-239`). **Edytor po zapisie 0 min nie wraca do stanu pustego - defekt D-03.**
- AC-6.7 (kolejka: cardio niedostępne z komunikatem): C - `workout-finished-screen.tsx:616-621` (`data.workoutId == null` -> „Cardio będzie dostępne po wysłaniu treningu.”). Decyzja ADR p.2 spełniona. Uwaga treściowa D-13.
- AC-6.8 (brak duplikatu w feedzie): C - PATCH nie wywołuje `publishTeamFeedAfterWorkout` (tylko ścieżka `INSERT` w `app/api/workouts/complete/route.ts:506`). Brak testu automatycznego (luka).

### P7 - Nazewnictwo
- AC-7.1 („Trening zakończony” jedyny tytuł): A (`components/active-workout/finish-flow-copy.test.ts`: brak „Trening zrobiony”, „Trening zapisany” w katalogu `active-workout/`). Zakres testu jest węższy niż AC (components + lib) - D-14.
- AC-7.2 (nazwy akcji: „Zakończ trening”, „Zakończ i zapisz”, „Zamknij”, bez „Gotowe”): C - `session-menu-sheet.tsx:210`, `active-workout-global-bar.tsx:160`, `workout-all-sets-done-dialog.tsx:167`, `workout-finish-confirm-dialog.tsx:75`, `workout-finished-screen.tsx:757`. Brak „Gotowe” w przepływie: C.
- AC-7.3 („Koniec treningu” nie jako stan przerwy): **częściowo niespełnione** - D-10 (`rest-break-screen.tsx:183`).
- AC-7.4 (nagłówek `workout-finish-format` bez starego tekstu): A (grep w testach; treść nie zawiera „Gotowe”).

### P8 - Terminologia
- AC-8.1 (liczba „N bez porównania” zamiast „pominiętych” w porównaniu): C - `workout-finished-screen.tsx:552`, `:592`.
- AC-8.2 (badge „bez zaliczonej serii” / „bez porównania”): C - `:465`.
- AC-8.3 (klucze `status: "skipped"` bez zmian): C - brak zmiany w `lib/workout-plan-compare.ts`.
- AC-8.4 (brak słowa „pominięte” przy zerze pominiętych): **N** - brak testu; wymaga E2E lub testu renderowania.

### P9 - Złoty CTA
- AC-9.1 (wariant `cta` na głównych przyciskach): C częściowo - `variant="cta"` w `workout-all-sets-done-dialog.tsx:161`, `workout-saving-screen.tsx:113`, `workout-finished-screen.tsx:757`. Pełna weryfikacja w etapie 8.
- AC-9.2 (brak `#FF1A4B` w przepływie): A (`finish-flow-copy.test.ts`; wyjątek `workout-plan-card.tsx` zgodnie z D-14).
- AC-9.3 (czerwień tylko semantyczna): C.
- AC-9.4 (kontrast 4,5:1): **N** - etap 8.

### P10 - „vs ostatnio”
- AC-10.1 (etykieta „vs ostatnio”, brak „vs poprzedni plan”): A/C - grep: zero trafień „vs poprzedni plan” / „Postęp vs poprzedni”; „vs ostatnio” w `workout-finished-screen.tsx:338`, `:516`.
- AC-10.2 (porównanie tylko tego samego planu): C - `app/api/workouts/complete/route.ts:266-271` filtruje `workoutPlanId`. Test „plan B nie zmienia porównania planu A”: brak (luka, wymaga testu integracyjnego z bazą - jest `createMemoryDb`, można dopisać).
- AC-10.3 (podpis z datą poprzedniej sesji): **N** - nie zweryfikowano formatu „18 paź → dziś” w UI.
- AC-10.4 (brak poprzedniej sesji): C - `volumeCaption` (`:111-116`).

### E-1..E-17 (przypadki brzegowe)
| # | Status | Uwagi |
|---|---|---|
| E-1 trening bez cardio | C | „Dodaj cardio po treningu”; brak żądania przy Zamknij. |
| E-2 bez planu | C | „Brak zapisanej sesji tego planu.” (`:112-113`); „Zobacz postęp” ukryte. |
| E-3 pierwsza sesja planu | C | `:115-116`; D-4 spełnione. |
| E-4 masa ciała (0 kg) | A + C | Oś czasu A, pominięcia A, hook bez dialogu A. **Defekt D-06**: tekst „Brak zaliczonych serii.” (`:110`) przy tonażu 0 przeczy zaliczonym seriom. |
| E-5 błąd zapisu | A | Stan błędu, sesja zachowana. |
| E-6 kolejka | A + C | `queued`, brak `workoutId`, komunikaty. |
| E-7 przerwany trening dolnym „Zakończ” | C | Menu -> dialog potwierdzenia -> `requestFinish` -> dialog pominiętych (liczniki A). |
| E-8 zero zaliczonych serii | C | Tekst „Nie zaliczono żadnej serii. Trening zapisze się bez tonażu.” (`workout-all-sets-done-dialog.tsx:~118`). |
| E-9 zmiana strefy / dnia | C | Data w `startedAt` (`route.ts:473`) i na ekranie z `endedAtMs`: **rozjazd po północy**, D-12. |
| E-10 po północy | C | Jak E-9. |
| E-11 dwa urządzenia | **N, defekt blokujący B-1** | Potwierdzone czytaniem kodu: `operationId` nie jest w payloadzie chmury. |
| E-12 zamknięcie karty podczas zapisu | A + C | Store nie czyszczony przed potwierdzeniem; ten sam `operationId` po powrocie (`ensureOperationId` persist). Serwer deduplikuje (`route.ts:436-448`). |
| E-13 rekord ciężaru | C | Sekcja „Nowe rekordy” (`:396`), bez przekierowania. |
| E-14 „Popraw serię N” po ostatniej | A + C | `wasDone` (`active-workout-view.tsx`). |
| E-15 cardio po publikacji w feedzie | C | Brak publikacji w PATCH; brak testu (luka). |
| E-16 odrzucenie treningu | C | `confirmDiscardSession` bez zmian. |
| E-17 błąd z paska globalnego | C + A | `window.alert` usunięty; stan błędu w `workout-saving-screen`. |

---

## 5. Defekty

Waga: **blokujący** (blokuje wydanie), **ważny** (naprawić przed Promote lub ustalić decyzję), **niski** (backlog z właścicielem). Właściciel wg `docs/zespol/przeplyw.md`: `backend` lub `frontend`.

### B-1 - blokujący - idempotencja `operationId` nie przechodzi między urządzeniami ani przy przywracaniu sesji z chmury
- **Plik / linie**: `lib/active-workout-persist.ts:8-19` (`snapshotActiveWorkoutPayload` bez `operationId`); `lib/active-workout-cloud.ts:4-14` (`ActiveWorkoutCloudPayload` bez pola); `components/active-workout/active-workout-cloud-sync.tsx:72-86` (`applyCloudPayload` nie ustawia `operationId`); `lib/stores/active-workout.ts:246-251` (`ensureOperationId` generuje nowy UUID, gdy pole puste).
- **Scenariusz A (duplikat)**: urządzenie A zapisuje trening (klucz X), po czym resetuje store i wysyła pusty stan do chmury. Urządzenie B, które odebrało sesję z chmury (brak `operationId` lokalnie), kończy ten sam trening -> nowy UUID Y -> serwer tworzy DRUGI wiersz w historii.
- **Scenariusz B (utrata danych)**: B ma niezakończoną sesję 1 z kluczem X. A kończy sesję 1 (X zapisany) i startuje sesję 2 (nowy klucz Z, który nie trafia do chmury). Chmura zwraca sesję 2 do B; `applyCloudPayload` nie zmienia `operationId` na B, więc B kończy sesję 2 z kluczem X. Serwer (`app/api/workouts/complete/route.ts:436-448`) zwraca wynik sesji 1 z `duplicate: true`. Hook (`use-workout-finish-flow.ts:128`) ignoruje pole `duplicate`, więc ekran pokazuje „Trening zakończony” dla sesji 2, której nie ma w historii.
- **Konsekwencja**: narusza BR-2 / E-11 / R-8 i wymóg LR-3 z prawnika (klucz generowany raz na sesję). Scenariusz B jest cichą utratą danych.
- **Jak odtworzyć**: dwa urządzenia (lub dwie karty z różnym stanem) na tym samym koncie; zakończyć sesję na A; na B (z sesją z chmury) zakończyć. Lub: na B niezakończona sesja, A kończy i startuje nową, B odświeża. Oczekiwane: jeden wpis na sesję, nowa sesja zapisana pod własnym kluczem.
- **Sugestia**: dodać `operationId` do `ActiveWorkoutCloudPayload`, `snapshotActiveWorkoutPayload` i `applyCloudPayload` (ustawić `payload.operationId ?? null`, a przy zmianie sesji nadpisać); po `applyCloudPayload` nie zostawiać lokalnego klucza z innej sesji. Plus: obsługa `duplicate: true` w hooku (pokazać dane z żądania albo ostrzeżenie), aby brak zapisu nie był cichy.
- **Test do dopisania (po poprawce)**: test `applyCloudPayload`-podobnej logiki w module bez JSX (wyciągnięcie do `lib/`) oraz test trasy z dwoma różnymi kluczami i tą samą sesją.

### B-2 - blokujący (przed Promote, jeśli w produkcji mogą być wpisy kolejki) - wpisy offline bez `operationId` nigdy się nie wysyłają
- **Plik / linie**: `lib/workout-outbox-db.ts:6` (`DB_VERSION = 1`, bez migracji), `:7-9` (typ z wymaganym `operationId`); `components/workout/workout-outbox-flush.tsx:33-44` (przy odpowiedzi 400 wpis zostaje w kolejce i jest ponawiany co 120 s w nieskończoność); `app/api/workouts/complete/route.ts:153` (`operationId: z.string().uuid()` wymagane).
- **Scenariusz**: trening zapisany offline przed wdrożeniem (wpis bez `operationId`) -> po wdrożeniu flush dostaje 400 (zod) -> wpis nigdy nie jest usuwany i nigdy nie trafia do historii.
- **Jak odtworzyć**: w starej wersji zapisać trening bez sieci, wdrożyć nową wersję, przywrócić sieć, obserwować żądania `POST /api/workouts/complete` (400) i IndexedDB (wpis zostaje).
- **Sugestia**: przy `outboxList` nadać `operationId` wpisom bez pola (zapisać go w rekordzie) lub podbić `DB_VERSION` z migracją; w flush traktować 4xx (poza 401/429) jako wpis do odrzucenia z komunikatem, nie jako ponowienie bez końca.

### D-03 - ważny - edytor cardio po zapisie 0 min nie wraca do stanu pustego (szkice zachowują stare wartości)
- **Plik / linie**: `components/active-workout/workout-finished-screen.tsx:742` (`setCardioEditing(true)` bez resetu), `:164-171` (szkice `draftDistance`, `draftHr`, `draftCalories`, `draftSteps` inicjowane tylko przy montowaniu), `:166-168` (`draftMinutes` = 20 tylko przy montowaniu).
- **Skutek**: po usunięciu cardio (0 min) i ponownym otwarciu edytora pola dystansu, tętna, kalorii i kroków pokazują usunięte wartości; minuty 0 zamiast domyślnych 20. Zapis samych minut przywraca usunięte dane (tętno, kroki), mimo że użytkownik je usunął.
- **Jak odtworzyć**: dodać cardio 20 min, tętno 140, dystans 4 km -> zapisać; otworzyć, ustawić 0 min -> zapisać (pasek: „Dodaj cardio po treningu”); kliknąć „Dodaj cardio po treningu”: pola pokazują 4 km / 140 bpm; ustawić 10 min i zapisać -> w bazie wraca tętno 140.
- **Sugestia**: przy otwarciu edytora przepisać szkice z aktualnego stanu (`cardioMinutes`, `cardioExtras`), a przy 0 min ustawić domyślne 20 min i puste pola.

### D-04 - ważny - tempo cardio (`paceMinPerKm`) jest zapisywane ze starej wartości po edycji
- **Plik / linie**: `components/active-workout/workout-finished-screen.tsx:245` (wysyła `cardioExtras.paceMinPerKm ?? null`), `:260-266` (`setCardioExtras` nie aktualizuje tempa); `lib/workout-plan-compare.ts:266-271` (podane tempo ma pierwszeństwo przed `cardioMinutes / distanceKm`).
- **Skutek**: zmiana dystansu lub minut po zapisie zachowuje stare tempo w bazie (np. 5,0 min/km zamiast przeliczonych 4,0).
- **Jak odtworzyć**: zapisać 20 min i 4 km (tempo 5,0 jeśli było), zmienić dystans na 5 km, zapisać; sprawdzić `exercises.cardio.paceMinPerKm` w bazie (oczekiwane 4,0).
- **Sugestia**: nie wysyłać `paceMinPerKm` z klienta (przeliczać po stronie serwera z minut i dystansu) albo przeliczać je w `saveCardio`.

### D-05 - ważny - czas treningu na ekranie „Trening zakończony” różni się od czasu w historii po pauzie
- **Plik / linie**: `components/active-workout/use-workout-finish-flow.ts:52-55` (czas bez pauz: `pausedElapsedSeconds + (endedAt - startedAt)`), `:75` (w zapisie `startedAt = store.workoutStartedAtMs`, czyli pierwszy start, z pauzami); `lib/workout-history-overview.ts:32-40` (historia liczy `endedAt - startedAt`, z pauzami).
- **Skutek**: ten sam trening ma inny czas na ekranie końcowym i w historii, gdy była pauza. Zegar przed zapisem (`active-workout-view.tsx:591-595`) zgadza się z ekranem końcowym, nie z historią.
- **Jak odtworzyć**: start, pauza 5 min, wznowienie, zakończenie. Porównać czas na ekranie końcowym z „Historia” (`durationMinutes`).
- **Sugestia**: ustalić, co jest „czasem treningu” (bez pauz czy od startu do końca), i ujednolicić: albo zapisać `durationSeconds` w payloadzie, albo liczyć w historii z pauzami. Decyzja analityka.

### D-06 - ważny - komunikat „Brak zaliczonych serii.” przy treningu samą masą ciała
- **Plik / linie**: `components/active-workout/workout-finished-screen.tsx:110-111` (`volumeKg <= 0` -> „Brak zaliczonych serii.”).
- **Skutek**: po decyzji 005 p.7 serie 0 kg + powt. są zaliczone, a tonaż wynosi 0. Ekran mówi, że nic nie zaliczono.
- **Jak odtworzyć**: trening wyłącznie z pompek (0 kg, 12 powt.), zapis, ekran końcowy: karta „vs ostatnio”, podpis.
- **Sugestia**: rozróżnić „brak tonażu” od „brak zaliczonych serii” (liczyć `setsDone`), np. „Bez tonażu (ciężar 0 kg).”.

### D-07 - ważny - testy E2E są nieaktualne wobec nowego przepływu
- **Plik / linie**: `e2e/active-workout.spec.ts:277-292` (oczekuje komunikatu „Podaj ciężar” i blokady zapisu bez ciężaru; ten komunikat już nie istnieje, `guided-session-layout.tsx:600` obsługuje tylko powtórzenia; test zostanie czerwony), `:350-355` (menu „Zakończ trening” -> oczekuje nagłówka „Trening zrobiony” bez kroku potwierdzenia; w kodzie: menu -> dialog potwierdzenia -> „Trening zakończony”).
- **Skutek**: `npm run test:e2e` nie przejdzie. Nie uruchamiano go w tej sesji, więc to ocena z kodu.
- **Sugestia**: zaktualizować oba testy do Q1 (pusty ciężar = 0 kg, zaliczenie) i nowego ekranu; dodać E2E na ścieżki P1, P2, P3 (błąd i „Spróbuj ponownie”).

### D-08 - ważny (decyzja produktowa) - pusty ciężar zapisuje serię jako masę ciała bez ostrzeżenia
- **Plik / linie**: `components/active-workout/guided-session-layout.tsx:242-244` (`draftValues`: `parseWeightInput(weightText) ?? 0`), `:346-351` (`saveSet` nie waliduje ciężaru).
- **Skutek**: użytkownik, który nie wpisał ciężaru w przysiadzie, zapisuje serię jako 0 kg (zaliczoną), tonaż jest zaniżony, bez żadnej informacji. Poprzednie zachowanie (komunikat „Podaj ciężar”) zostało usunięte bez śladu w UX (`docs/ux/005` nie opisuje tego przypadku dla pustego pola).
- **Decyzja do potwierdzenia przez analityka i `ux`**: czy pusty ciężar ma być ostrzeżeniem (np. potwierdzenie „Zapisać jako masę ciała?”), czy celowo bez ostrzeżenia.

### D-09 - ważny (warunkowe, świadomie ograniczone w ADR p.9) - parytet Javy przy włączonym `JAVA_API_BASE_URL`
- **Plik / linie**: `java-backend/.../workout/WorkoutService.java:17-18, 25-35` (mapa w pamięci, bez `planCompare`, `strengthDeltaPercent`); `app/api/workouts/[workoutId]/cardio/route.ts` (PATCH tylko przez Drizzle, bez proxy).
- **Skutek przy Javie**: zapis działa (`workoutId` zwrócony), ale brak porównania „vs ostatnio” (karta „—”), a PATCH cardio nie znajduje wiersza w bazie -> 404 -> komunikat „not-found”. Dedup działa tylko w pamięci procesu (restart = brak deduplikacji).
- **Stan**: ADR p.9 i analiza przyjmują to jako zakres ograniczony; produkcja biegnie przez TypeScript (brak `JAVA_API_BASE_URL`). Wymaga wpisu w backlogu z właścicielem.

### D-10 - niski (uwaga architekta, do rozstrzygnięcia) - tekst „Koniec treningu” w `RestBreakScreen`
- **Plik / linie**: `components/active-workout/rest-break-screen.tsx:183` (nagłówek „Koniec treningu”), `:261` (etykieta „Zakończ trening”).
- **Skutek**: AC-7.3 wymaga, by napis „Koniec treningu” nie pojawiał się jako stan przerwy. Gałąź jest osiągalna rzadko (`resolveAdvanceAfterSet` zwraca `null` podczas odliczania przerwy). Architekt zachował ją świadomie.
- **Sugestia**: przy zgodności literalnej zastąpić nagłówek tekstem „Trening do zakończenia” lub przejść od razu do `requestFinish`.

### D-11 - niski (wymaga akceptacji analityka) - tytuł dialogu dla wariantu „obie”
- **Plik / linie**: `components/active-workout/workout-all-sets-done-dialog.tsx:24-29`.
- **Skutek**: przy pominiętych I niewykonanych tytuł „Nie wszystkie serie wykonane” (zgodnie z UX D-1), a AC-2.3 mówi „Zostały pominięte serie”. Odstępstwo jest jawne w UX, ale nie zatwierdzone w analizie.

### D-12 - niski - data treningu: ekran (dzień zakończenia) i zapis (dzień startu)
- **Plik / linie**: `app/api/workouts/complete/route.ts:473` (`dateKey` z `startedAt`), `components/active-workout/workout-finished-screen.tsx:186-196` (`endedLabel` z `endedAtMs`).
- **Skutek**: trening zakończony po północy: ekran pokazuje nowy dzień, historia zapisuje dzień startu (E-10 oczekuje dnia zakończenia na ekranie, zapis nie był zmieniany). Do decyzji.

### D-13 - niski - obietnice w kopii dla kolejki
- **Plik / linie**: `components/active-workout/workout-finished-screen.tsx:619` („Cardio będzie dostępne po wysłaniu treningu.”), `:107` („Porównanie będzie dostępne po wysłaniu treningu.”).
- **Skutek**: po zamknięciu ekranu nie ma ścieżki, by to uzupełnić; treść obiecuje coś, czego ekran nie daje. Zalecenie: „Cardio można dodać tylko po zapisaniu treningu w historii.” Do potwierdzenia przez `ux`.

### D-14 - niski - zakres testu kopii obejmuje tylko `components/active-workout/`
- **Plik**: `components/active-workout/finish-flow-copy.test.ts`. AC-7.1 wymaga sprawdzenia także w `lib/`. Brak skutku dziś (grep: zero trafień), ale test nie zabezpiecza regresji poza katalogiem.

### D-15 - niski (pre-istniejące, poza zakresem) - dwie awarie `lib/android-version.test.ts`
- Źródło: `public/android-version.json` (nie w tej gałęzi). Nie blokuje tej zmiany; właściciel: wydania Android.

### D-16 - niski (uwaga UX) - dwa kolejne potwierdzenia z paska i menu
- Pasek i menu: najpierw `WorkoutFinishConfirmDialog`, a przy pominiętych seriach zaraz potem `WorkoutAllSetsDoneDialog`. ADR D-3 zakłada jedno potwierdzenie. Do decyzji `ux`.

---

## 6. Luki testowe (do dopisania w kolejnych etapach)

- Renderowanie komponentów (brak `@testing-library/react` i `jsdom`): edytor cardio (D-03), ekran końcowy (AC-4.x, AC-8.4), dialog (AC-2.6). Potrzebne E2E w Playwright lub dodanie środowiska DOM - decyzja architekta.
- Test integracyjny (`createMemoryDb`) dla AC-10.2 (plan B nie zmienia porównania planu A) i AC-6.8 (PATCH nie publikuje w feedzie, E-15).
- Test wielourządzeniowy dla B-1 (po poprawce) - wymaga kontraktu chmury z `operationId`.
- Test `paceMinPerKm` po stronie serwera (D-04), jeśli tempo przestanie być wysyłane z klienta.

---

## 7. Ryzyka resztkowe

- Realne zachowanie w przeglądarce, na telefonie i w PWA (przerwanie zapisu przy zamknięciu karty, `pagehide`, tryb offline) nie zostało przetestowane end-to-end; wnioski oparte o kod i testy jednostkowe hooka.
- Zmiana reguły masy ciała (Q1) wpływa na dane historyczne: serie 0 kg z przeszłości bez flagi `skipped` są teraz zaliczone (Ghost, podpowiedzi, wykresy). Oczekiwane wg decyzji właściciela, ale wymaga komunikacji i weryfikacji na danych produkcyjnych.
- `tester-bezpieczenstwa` i `tester-wydajnosci` (etap 9) nie są objęte tym raportem.

---

## 8. Werdykt

**ODRZUCONE** (cofnięcie do etapu 5: `backend` i `frontend`).

Uzasadnienie:
1. **B-1 (blokujący)**: idempotencja zapisu nie jest spójna między urządzeniami i przy przywracaniu sesji z chmury. Scenariusz B może cicho pominąć zapis nowego treningu i pokazać „Trening zakończony”. To narusza BR-2 i wymóg LR-3 „przed merge”.
2. **B-2 (blokujący przed Promote, jeśli są wpisy kolejki)**: wpisy offline sprzed zmiany nigdy się nie wyślą.
3. Pozostałe defekty ważne (D-03, D-04, D-05, D-06, D-07, D-08, D-09) wymagają naprawy lub decyzji właściciela przed Promote. Kluczowe to D-03 i D-04 (dane cardio), D-07 (testy E2E czerwone), D-08 (decyzja produktowa).

Po poprawkach powtórzyć: `tester` (testy B-1, B-2, D-03, D-04 w odpowiednich modułach), `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run test:e2e` (po aktualizacji D-07).

Wszystkie kryteria P1-P10 są zaimplementowane w kodzie zgodnie z ADR i UX, z wyjątkiem: AC-2.3 (D-11, uzgodnione w UX), AC-7.3 (D-10), AC-6.2/6.4 (lokalizacja wskaźnika w edytorze, drobne), AC-10.3 (N). Najpoważniejsze ryzyko to B-1.
