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

---

## 9. Powtórka po poprawkach (etap 7b)

- **Data**: 2026-10-25, tester (powtórka po odrzuceniu etapu 7; zakres: B-1, B-2, D-03, D-04, D-06, D-07).
- **Metoda**: czytanie zmienionego kodu, testy celowane Vitest, sonda na prawdziwym handlerze `app/api/active-workout-session/route.ts` (harness `createMemoryDb`, mock auth/CSRF; plik sondy usunięty po przebiegu, nie został w repo), próba `npm run test:e2e`.

### 9.1 Wyniki komend

| Komenda | Wynik |
|---|---|
| `npx vitest run` (4 pliki: cloud, persist, outbox-db, use-workout-finish-flow) | 22/22 zaliczonych |
| `npm test` | 1060 testów: **1058 OK**, 2 niezaliczone (`lib/android-version.test.ts`, D-15 - pre-istniejące, bez zmian). 142 pliki: 141 OK, 1 z 2 awariami. |
| `npx tsc --noEmit` | czysto (exit 0) |
| `npm run lint` | 142 problemy: **104 błędy** (= baseline), 38 ostrzeżeń |
| `npm run test:e2e` (`e2e/active-workout.spec.ts`) | **nie wykonano wykonawczo**: wszystkie 28 testów pominięte przez `test.skip` - brak `E2E_EMAIL` / `E2E_PASSWORD` w tej sesji (lokalna jednorazowa baza) |

### 9.2 B-1 - idempotencja `operationId` między urządzeniami

**Propagacja pola (zweryfikowana czytaniem kodu)**: `lib/stores/active-workout.ts` (`start()` generuje klucz tylko gdy `null`; `applyPlan`/`reset` czyszczą; `partialize` zawiera `operationId`) → `snapshotActiveWorkoutPayload` (`lib/active-workout-persist.ts`) → body `PUT` (`lib/active-workout-cloud.ts`, pole opcjonalne, walidacja `isActiveWorkoutCloudPayload`) → serwer zapisuje cały payload JSON (`route.ts`) → `GET`/konflikt 409 → `applyCloudPayload` (`components/active-workout/active-workout-cloud-sync.tsx`, `operationId: payload.operationId ?? null`) → `persistActiveWorkoutLocalNow` → `doSave` używa `ensureOperationId()`. Łańcuch jest kompletny.

**Scenariusz A (dwa urządzenia, ten sam trening)**: duplikat wiersza jest zablokowany. Urządzenie B z kluczem X po odebraniu sesji dostaje X i serwer zwraca `duplicate: true`. Zamknięte w zakresie duplikatów wierszy.

**Scenariusz B (B z nieaktualną sesją 1, A kończy 1 i startuje 2)**: pierwotny defekt (klucz sesji 1 przy zapisie sesji 2) jest naprawiony pod warunkiem, że B dostanie stan z chmury przed zakończeniem. **Odkryto nowy defekt B-1b (blokujący), który uniemożliwia zamknięcie scenariusza B.** Sonda na handlerze PUT/DELETE (wynik z konsoli):
```
A session2 revision 1
B stale status 200
B stale body {"ok":true,"revision":6,...}
CLOUD AFTER op-X Sesja 1 devB-bbbbbbbb
```
Przebieg: B synchronizował sesję 1 pięć razy (rewizja klienta 5). A kończy sesję 1 - `deleteCloud()` kasuje wiersz i zeruje lokalną rewizję do 0. A startuje sesję 2 (`op-Z`) z rewizją 0 → serwer ustawia rewizję 1. Następny push B z rewizją 5 przechodzi, bo konflikt zgłaszany jest tylko przy `clientRevision < serverRevision` (`route.ts`, `handlePUT`). Sesja 2 zostaje nadpisana stanem B. A dostaje 409 i przejmuje sesję 1 z kluczem `op-X`. Zakończenie na A zwraca `duplicate: true` i nie zapisuje sesji 2. Sesja 2 jest cicho utracona. Serwer (`route.ts`) i `lib/active-workout-cloud.ts` nie zmieniły się względem `5aa8209`, więc defekt jest pre-istniejący, ale scenariusz B z pierwotnego raportu (cicha utrata) pozostaje otwarty.

**Pokrycie testami B-1**: `lib/active-workout-cloud.test.ts` (4) testuje tylko `isActiveWorkoutCloudPayload`; `lib/active-workout-persist.test.ts` (+1) testuje tylko snapshot. Funkcja `applyCloudPayload` (jedyne miejsce przywracające klucz z chmury po stronie klienta) nie ma testu - jest w komponencie, bez eksportu. Brak testu integracyjnego wielourządzeniowego. Luka jest realna, ale sama w sobie nie blokuje; blokuje ją defekt B-1b, który test wielourządzeniowy by wykrył.

**Werdykt B-1: NIE ZAMKNIĘTE** (propagacja klucza OK; scenariusz B nadal prowadzi do utraty sesji).

### 9.3 B-2 - wpisy kolejki offline bez `operationId`

- `lib/workout-outbox-db.ts` `outboxList()`: wpis bez klucza dostaje `crypto.randomUUID()`, a rekord jest zapisywany ponownie przez `outboxPut` (osobna transakcja, `await`), dopiero potem zwracany. Zapis jest trwały, a nie tylko w pamięci. Potwierdzone czytaniem kodu.
- `lib/workout-outbox-db.test.ts` (2): sprawdza wartość zwróconą z `outboxList()`, ale **nie sprawdza trwałości** (ponowny odczyt tego samego rekordu z atrapy IDB). Luka niskiego ryzyka.
- Residuum: gdy `outboxPut` się nie uda (błąd jest połknięty), każdy kolejny odczyt generuje nowy klucz. Jeśli pierwsze POST doszło do serwera, a wpis nie został usunięty, może powstać duplikat. Niskie ryzyko (wyjątek IDB przy zapisie).
- Pętla 400 w `components/workout/workout-outbox-flush.tsx` **nie została zmieniona**. Wpis z 400 z innej przyczyny nadal jest ponawiany co 120 s bez końca. Przyczyna z brakiem klucza jest usunięta.

**Werdykt B-2: ZAMKNIĘTE** (brak klucza jest naprawiany przy odczycie i utrwalany). Uwagi: pętla 400 (średni, backlog frontend) i brak asercji trwałości w teście (niski).

### 9.4 D-03 - edytor cardio po zapisie 0 min

- `openCardioEditor()` (`components/active-workout/workout-finished-screen.tsx`, ok. l. 240) ustawia szkice z aktualnego `cardioMinutes`/`cardioExtras` przy każdym otwarciu. Po zapisie 0 min `setCardioExtras` ustawia `distanceKm`/`avgHr`/`calories`/`steps` na `null`, a `draftMinutes` wraca do 20.
- Brak testu automatycznego (brak DOM). Potwierdzone czytaniem kodu.

**Werdykt D-03: ZAMKNIĘTE** (C; test renderowania nadal w luce, E2E do wykonania).

### 9.5 D-04 - tempo cardio

- Klient wysyła `paceMinPerKm: null` (`workout-finished-screen.tsx`, ok. l. 265). Serwer w `patchCardioInCompletedSessionJson` (`lib/workout-plan-compare.ts`, l. 266-271) liczy tempo jako `cardioMinutes / distanceKm`, gdy klient go nie poda. Tempo nie jest wyświetlane w `cardioSummaryLine` (pokazuje min, km, kcal, kroki), więc lokalny stan nie pokazuje starego tempa.
- Ścieżka `null` + dystans przelicza tempo. Test jednostkowy konkretnie tej ścieżki nie został zweryfikowany. Potwierdzone czytaniem kodu.

**Werdykt D-04: ZAMKNIĘTE** (C).

### 9.6 D-06 - „Brak zaliczonych serii” przy masie ciała

- `volumeCaption()` (l. 111) i karta „Najlepsze serie” (l. 465) używają `data.setsDone === 0`. Trening z zaliczonymi seriami 0 kg nie dostaje błędnego komunikatu. Potwierdzone czytaniem kodu; brak testu renderowania.

**Werdykt D-06: ZAMKNIĘTE** (C).

### 9.7 D-07 - testy E2E

- Asercje w `e2e/active-workout.spec.ts` (statyczne porównanie z kodem): „Podaj ciężar” usunięte (asercja `toHaveCount(0)`), zapis masy ciała („Seria 1, zapisana: 0 kg”, „Zapisano 1 z 7 serii”), komunikat „Podaj liczbę powtórzeń” (`guided-session-layout.tsx:600`), menu „Zakończ trening” → „Zakończyć trening?” → „Zakończ i zapisz” → „Zapisuję trening…” → „Trening zakończony”. Wszystkie teksty istnieją w komponentach. Zgodność statyczna: tak.
- **Nie wykonano** (brak credentials). Wszystkie 28 testów pominięte. Status: niewykonane end-to-end.

**Werdykt D-07: NIEWYKONANE** (statycznie zgodne, wymaga przebiegu z `E2E_EMAIL`/`E2E_PASSWORD`).

### 9.8 Ustalenia powtórki

| ID | Status | Waga | Właściciel | Opis |
|---|---|---|---|---|
| B-1b (nowy) | otwarty | **blokujący** | backend (`app/api/active-workout-session/route.ts`), frontend (`active-workout-cloud-sync.tsx`) | Rewizja zerowana po DELETE pozwala nieaktualnemu urządzeniu nadpisać nową sesję (sonda). Do naprawy: monotoniczna rewizja po DELETE (np. wiersz-nagrobek albo klient przejmuje rewizję z odpowiedzi DELETE) i test regresji na handlerze PUT/DELETE (sonda jako stały test). |
| B-1 (test) | otwarty | wysoki | frontend | Wyciągnąć `applyCloudPayload` do `lib/` i dopisać test propagacji `operationId`; test wielourządzeniowy po naprawie B-1b. |
| B-2 pętla 400 | otwarty | średni | frontend | `workout-outbox-flush.tsx`: traktować 4xx (poza 401/429) jako odrzucenie z komunikatem, a nie ponawianie w nieskończoność. |
| B-2 trwałość | otwarty | niski | frontend | Asercja w `lib/workout-outbox-db.test.ts` na ponowny odczyt rekordu; obsługa błędu `outboxPut`. |
| D-07 | otwarty | wysoki przed merge | tester z credentials / frontend | Przebieg `npm run test:e2e` z `E2E_EMAIL`/`E2E_PASSWORD` na lokalnej bazie. |
| D-03, D-04, D-06 | zamknięte | - | - | Potwierdzone czytaniem kodu; testy renderowania w luce (sekcja 6). |

### 9.9 Czy luka testowa B-1 blokuje ZATWIERDZENIE

Sama luka (brak testu integracyjnego wielourządzeniowego i brak testu `applyCloudPayload`) to uwaga na poziomie „ZATWIERDZONE Z UWAGAMI” z wpisem do backlogu. Sonda jednak pokazała, że przy scenariuszu B dochodzi do utraty danych, a test wielourządzeniowy by to wykrył. Dlatego luka razem z B-1b blokuje wydanie. Warunek zatwierdzenia: naprawiona rewizja po DELETE, stały test regresji na handlerze PUT/DELETE (sonda), test `applyCloudPayload` oraz przebieg E2E.

### 9.10 Werdykt etapu 7b (tester)

**ODRZUCONE** - cofnięcie do etapu 5 (`backend`: rewizja po DELETE w `app/api/active-workout-session/route.ts` + test regresji; `frontend`: przejęcie rewizji po DELETE / wyciągnięcie `applyCloudPayload` z testem, pętla 400 w flushu, asercja trwałości). Pozostałe pozycje (D-03, D-04, D-06, B-2 jako mechanizm klucza) przechodzą. D-07 wymaga przebiegu E2E przed merge.

### 9.11 Ryzyka resztkowe

- Brak wykonanego E2E (D-07) i brak testu renderowania ekranu końcowego i edytora cardio.
- Zachowanie przeglądarki (pagehide, dwie karty z tym samym `deviceId` - `localStorage` jest wspólny dla kart) nie zostało przetestowane end-to-end.
- Sonda pokazuje, że po naprawie B-1b trzeba potwierdzić zachowanie przy dwóch kartach na tym samym urządzeniu (ten sam `deviceId`).

---

## 10. Finalna weryfikacja (etap 7c, tester, 2026-10-25)

- **Zakres**: B-1b (naprawa z etapu 5b: `handleDELETE`, GET ghost, `deleteCloud`, `respondWithExistingWorkout`), pięć poprawek ux z sekcji 19 raportu ux, komendy regresji, E2E (D-07). Metoda: czytanie kodu, testy Vitest, dwie tymczasowe sondy na prawdziwych handlerach `app/api/active-workout-session/route.ts` i klienta `lib/active-workout-cloud-client.ts` (atrapa `fetch` kierowana do `PUT`/`DELETE`/`GET` handlera, harness `createMemoryDb`). Pliki sond usunięte po przebiegu; nie zostały w repo.

### 10.1 Wyniki komend (uruchomione w tej sesji)

| Komenda | Wynik |
|---|---|
| `npm test` | 1081 testów: **1079 OK**, 2 niezaliczone (`lib/android-version.test.ts`, D-15, pre-istniejące). 144 pliki: 143 OK, 1 z 2 awariami. |
| `npx tsc --noEmit` | czysto (exit 0) |
| `npm run lint` | **142 problemy: 104 błędy, 38 ostrzeżeń** = baseline (`5aa8209`/etap 7b). Dwa błędy w dotkniętych plikach (`active-workout-global-bar.tsx:69`, `workout-finished-screen.tsx:185`, reguła `react-hooks/set-state-in-effect`) są identyczne z HEAD (wzorzec pre-istniejący). |
| `npm run test:e2e` | **NIE WYKONANO**: brak `E2E_EMAIL` / `E2E_PASSWORD` w tej sesji (sprawdzone w środowisku, brak wpisu w `.env.local`). `e2e/active-workout.spec.ts` pomija 28 testów przez `test.skip`. Nie blokuje werdyktu tego etapu (wymóg przed merge, po stronie środowiska użytkownika / CI). |

### 10.2 B-1b - scenariusz z sekcji 9.2 (zamknięty na poziomie serwera, ale nie na poziomie klienta)

**Serwer (zweryfikowane)**: `app/api/active-workout-session/route.test.ts` odtwarza sekwencję z sekcji 9.2 (B pushuje 5×, A `DELETE` → rewizja 6, A `PUT` z rewizją 0 → 409, `GET` → rewizja 7, `PUT` z 7 → 200 rewizja 8, zaległy `PUT` B z rewizją 5 → 409, sesja 2 nienaruszona). Test przechodzi. `DELETE` nie zeruje już rewizji i nie usuwa wiersza. Scenariusz z sondy testera (`op-X` nadpisujące `op-Z`) jest na poziomie serwera zamknięty.

**Klient (defekt, sonda)**: scenariusz końcowy nie jest zamknięty, bo `deleteCloud()` i `push()` w `components/active-workout/active-workout-cloud-sync.tsx` zakładają, że po DELETE lokalna rewizja wraca do 0. Po zmianie 5b jest inaczej (patrz B-1c i B-1d poniżej). Dwie sondy wykazały regresje względem `HEAD`.

### 10.3 Nowe defekty znalezione w tej rundzie

#### B-1c - BLOKUJĄCY - pętla DELETE co 8 s na bezczynnym urządzeniu; kasowanie aktywnej sesji drugiego urządzenia
- **Plik / linie**: `components/active-workout/active-workout-cloud-sync.tsx:152` (`if (readRevision() > 0)` → `deleteCloud()`), `:248`/`:216` (`setInterval(push, 8 000)`), `lib/active-workout-cloud-client.ts:125-126` (`deleteCloud` zapisuje zwróconą rewizję ≥ 1); `app/api/active-workout-session/route.ts` `handleDELETE` (rewizja +1 przy każdym DELETE).
- **Mechanizm**: w `HEAD` `deleteCloud` zapisywało `writeRevision(0)`, więc warunek `readRevision() > 0` przestawał być prawdziwy po jednym DELETE. Po zmianie 5b lokalna rewizja po DELETE zawsze wynosi ≥ 1, więc każdy tick interwału (co 8 s, także bez żadnej zmiany) na bezczynnej karcie z kiedykolwiek zakończoną sesją wysyła kolejny `DELETE`. Rewizja serwera rośnie bez końca, a wiersz (czyli aktywna sesja zapisana z innego urządzenia tego samego konta) jest nadpisywany pustym payloadem.
- **Sonda** (`lib/tmp-probe-b1c.test.ts`, usunięta): warunek dokładnie jak w linii 152, pięć ticków → lokalna rewizja `[3,4,5,6,7]` (w `HEAD` zatrzymanie na 0). Drugi scenariusz: urządzenie B startuje sesję (PUT, rewizja 6), bezczynna karta A wykonuje jeden tick → `PUT` z B dostaje `409` z payloadem `exercises.length === 0`, czyli aktywna sesja B zostaje wyzerowana (`applyCloudPayload` w `:177-178`), a następnie B też wysyła DELETE.
- **Skutek**: utrata trwającego treningu na drugim urządzeniu / w drugiej karcie (ta sama `deviceId`), niezależnie od intencji użytkownika. Dodatkowo stały ruch: DELETE + UPDATE co 8 s na każdą otwartą kartę, z ryzykiem trafienia w limit `RATE.activeWorkoutSession` (90/min na użytkownika), a wtedy `deleteCloud` zwraca `false` → `pendingPushRef` → natychmiastowe ponawianie.
- **Waga**: blokujący (utrata danych treningu, regresja względem `HEAD`).
- **Właściciel**: frontend (`active-workout-cloud-sync.tsx`: wartownik „chmura już wyzerowana” zamiast `readRevision() > 0`; DELETE jednorazowo na przejście aktywna→pusta); backend (ewentualnie: DELETE na już wygaszonym wierszu nie powinien inkrementować rewizji - patrz B-1d).

#### B-1d - BLOKUJĄCY - pierwszy zapis nowego treningu po przeładowaniu aplikacji zostaje skasowany (409 z wygaszonym payloadem)
- **Plik / linie**: `app/api/active-workout-session/route.ts` `handleGET` (gałąź ghost: `db.update` z `revision: row.revision + 1` przy KAŻDYM odczycie wygaszonego wiersza; hydratacja `ActiveWorkoutCloudSync` robi `fetchCloud()` przy każdym załadowaniu aplikacji); `components/active-workout/active-workout-cloud-sync.tsx:177-183` (przy `result.conflict` klient ZAWSZE wywołuje `applyCloudPayload(result.conflict.payload)` i `writeRevision`, także gdy payload jest wygaszony, czyli bez aktywnej sesji w chmurze).
- **Mechanizm**: zakończenie treningu → `DELETE` (lokalna rewizja N+1) → przeładowanie aplikacji → `GET` na wygaszonym wierszu podbija rewizję serwera do N+2 → start nowego treningu → pierwszy `PUT` z rewizją N+1 → `409 { conflict: true, session: <wygaszony payload> }` → klient stosuje wygaszony payload, czyli kasuje świeżo rozpoczętą sesję lokalnie (i potem DELETE w chmurze).
- **Sonda** (`lib/tmp-probe-b1d.test.ts`, usunięta): `putCloud` → `writeRevision` → `deleteCloud` → `fetchCloud` (null) → `putCloud(payload s2, readRevision())` → `{ ok: false, conflict: true, conflictExercises: 0, conflictRevision: 3 }`. Test oczekujący `ok: true` nie przeszedł. W `HEAD` ten sam przebieg kończył się `ok: true` (DELETE usuwał wiersz, GET nie zmieniał stanu).
- **Skutek**: regresja względem `HEAD` w częstym przepływie „zakończ trening → zamknij/otwórz aplikację → zacznij trening". Nowa sesja znika w ciągu około 1 s (komunikat „Sesja zaktualizowana na innym urządzeniu”), a ewentualne serie zapisane po tym momencie są tracone. Nie jest to błąd cichy w sensie zapisu do historii (nic nie trafia do bazy), ale użytkownik traci trening w trakcie. Wcześniej działało.
- **Uwaga kontraktowa**: ADR 0004 p.12 (krok 3) przyznaje, że GET zmienia rewizję i klient ma tego „nie zakładać”. Klient tego nie uwzględnia: traktuje każdy `409` jako „serwer nowszy, przejmij”.
- **Waga**: blokujący.
- **Właściciel**: backend (GET nie może zmieniać rewizji; wygaszenie bez inkrementacji albo tylko zapis payloadu bez `revision`) oraz frontend (409 z payloadem bez aktywnej sesji, a lokalnie aktywną: nie stosować pustego payloadu, tylko ponowić PUT z `conflict.revision` - „lokalna sesja wygrywa, chmura pusta”).

#### Uwagi niskiego ryzyka (backlog, nie blokują)
- **N-B1d-1 (niski)**: wyścig dwóch urządzeń w oknie między `DELETE` A a pierwszym `PUT` nowej sesji A: stale push B (rewizja sprzed DELETE, co 8 s) zwraca 409 z wygaszonym payloadem, B kasuje swoją sesję i wysyła DELETE, A dostaje 409 i traci świeżo startowaną sesję. Okno ~1 s; po naprawie B-1c/B-1d to ryzyko się zmniejsza, ale nie znika. Do rozważenia w tej samej poprawce (ta sama logika „pusty payload w 409 nie wygrywa z lokalną aktywną sesją”).
- **N-B1-2 (niski)**: ścieżka `respondWithExistingWorkout` 409 (kolizja `operationId`) jest „ślepą uliczką”: po błędzie „Spróbuj ponownie” klient wysyła ten sam klucz i dostaje ten sam 409. Nie ma ciche utraty danych (użytkownik widzi błąd), ale bez odrzucenia treningu nie ma wyjścia. Scenariusz wymaga legacy stanu (dwie sesje z tym samym kluczem), więc rzadki.

### 10.4 Pięć poprawek ux (sekcja 19 raportu ux) - weryfikacja w kodzie i testach

| # | Poprawka | Wynik | Dowód |
|---|---|---|---|
| 1 | Licznik serii: widoczna liczba `aria-hidden`, pełny tekst w `sr-only` | **OK** | `workout-finished-screen.tsx:398-408`: `<span aria-hidden="true">{setsDone}/{setsTotal}</span>` + `<span className="sr-only">{setsDone} z {setsTotal} serii wykonanych</span>`. Brak sprzeczności „14/16 z 16”. |
| 2 | Odmiana „kolejne/kolejnych rekordów” przez `plural()` | **OK** | `workout-finished-screen.tsx:456-461` używa `plural(n, "kolejny rekord", "kolejne rekordy", "kolejnych rekordów")` z `lib/progress-format.ts:40-47`. Sprawdzone ręcznie: 1 → „kolejny”, 2-4 → „kolejne”, 5, 0, 11-14 → „kolejnych”, 22 → „kolejne” (poprawna polska odmiana). |
| 3 | Format liczb PL w cardio (`formatCountPl`, `formatDistanceKmPl`) | **OK** | `lib/workout-finish-format.ts`. Node ICU: `Intl.NumberFormat("pl-PL")` bez opcji daje `4500` i `1000` (potwierdzone: grupowanie „auto” nie grupuje 4-cyfrowych), `useGrouping: true` daje `4 500`, `1 000` (spacja NBSP U+00A0). `formatDistanceKmPl`: `3.2 → "3,2"`, `3 → "3"`, `0.25 → "0,3"`, `12.34 → "12,3"`, `0.05 → "0,1"`. Użyte w `cardioSummaryLine` (`:229-237`): `3,2 km`, `4 500 kroków`. Testy: `lib/workout-finish-format.test.ts` (+2). |
| 4 | Wspólny `WorkoutDiscardSessionDialog` w pasku (nie inline) | **OK** | `active-workout-global-bar.tsx:231` (import z `workout-discard-session-dialog.tsx`), ten sam komponent w `active-workout-view.tsx:843`. Brak inline `AlertDialog` z tytułem „Odrzucić aktywny trening?” (grep: zero trafień). Tytuł we wspólnym pliku: „Zakończyć bez zapisu?”. |
| 5 | „Trening zakończony” zamiast „Koniec treningu” w `rest-break-screen.tsx:183` | **OK** | `rest-break-screen.tsx:183` (`WorkoutEndCard`: kicker „Trening zakończony”). Grep w `components/`, `lib/`, `app/`: jedyne „Koniec treningu” to komentarz w `active-workout-view.tsx:419` i wpisy changelogu (`changelog-data.ts`, nie UI). |

Dodatkowo potwierdzone w kodzie (poza 5 poprawkami): B-3 (`requestFinishFromSecondaryEntry` w `use-workout-finish-flow.ts:205-217`, wywołania: pasek `active-workout-global-bar.tsx:150`, menu `active-workout-view.tsx:742`; testy `use-workout-finish-flow.test.ts` w bloku B-3), B-4 (`aria-label` na przycisku „Zakończ trening” w pasku, `active-workout-global-bar.tsx:147`).

Uwaga przy okazji (do etapu 8, nie defekt funkcjonalny): tekst opisu w `WorkoutDiscardSessionDialog` używa `text-white/65`; kontrast do sprawdzenia w etapie 8 (N-1 z ux obejmuje `white/45`).

### 10.5 Pozostałe weryfikacje z zakresu 7b/7c

- **B-1 (test)**: zamknięty. `lib/active-workout-cloud-client.test.ts` (10 testów, bez DOM) i `lib/active-workout-cloud.test.ts` (+2).
- **B-2 (wpisy offline bez `operationId`)**: zamknięty (backfill w `outboxList()`, potwierdzone w 7b). Pętla 400 w `workout-outbox-flush.tsx` pozostaje w backlogu (średni).
- **D-03, D-04, D-06**: bez zmian względem 7b (czytanie kodu).
- **D-07 (E2E)**: NIEWYKONANE (brak credentials). Statyczna zgodność asercji z tekstami komponentów: bez zmian.
- **Test regresji B-1c/B-1d**: w `route.test.ts` brak. Test „GET zmienia rewizję” (linie 116-128) utrwala zachowanie, które powoduje B-1d; dodatkowo testy klienta nie obejmują pętli DELETE ani 409 z wygaszonym payloadem przy lokalnej aktywnej sesji.

### 10.6 Werdykt etapu 7c (tester)

**ODRZUCONE** - cofnięcie do etapu 5 (`backend` i `frontend`).

Uzasadnienie:
1. **B-1c (blokujący)**: po zmianie 5b bezczynna karta z kiedykolwiek zakończoną sesją powtarza `DELETE` co 8 s i kasuje aktywną sesję drugiego urządzenia tego samego konta (sonda: rewizja `3,4,5,6,7`, 409 z wyzerowanym payloadem).
2. **B-1d (blokujący, regresja względem `HEAD`)**: `GET` na wygaszonym wierszu podbija rewizję serwera, a klient przy 409 stosuje wygaszony payload, więc pierwszy zapis nowego treningu po przeładowaniu aplikacji jest kasowany (sonda: `ok: false`, `conflict: true`, `exercises: 0`).
3. Naprawa B-1b na poziomie serwera (monotoniczność rewizji po DELETE, test sekwencji 9.2) jest zrealizowana i przechodzi. Warunek zamknięcia scenariusza B z sekcji 9.2 wymaga też poprawki klienta (B-1c, B-1d).
4. Poprawki ux z sekcji 19 (pięć pozycji) przechodzą w kodzie i testach. Wizualnie: etap 8.
5. E2E (D-07) nieuruchomione: wymóg przed merge, nie blokuje tego werdyktu.

**Warunki ponownej weryfikacji (etap 6b/7d)**:
- frontend: DELETE wysyłany jednorazowo przy przejściu aktywna→pusta (bez `readRevision() > 0` jako wartownika), oraz: 409 z payloadem bez aktywnej sesji, gdy lokalna sesja jest aktywna → ponowić PUT z `conflict.revision` zamiast stosować pusty payload.
- backend: GET nie zmienia rewizji (wygaszenie wiersza bez inkrementacji albo bez zapisu), i aktualizacja testu „GET zmienia rewizję” w `route.test.ts`; ADR 0004 p.12 do korekty.
- Testy regresji: sekwencja sondy B-1d (`finish → GET → start → PUT 200`), sekwencja B-1c (kolejne ticki nie wysyłają DELETE bez zmiany stanu), i scenariusz wielokartowy (ta sama `deviceId`) w `lib/active-workout-cloud-client.test.ts`.
- Po poprawkach: `npm test`, `npx tsc --noEmit`, `npm run lint`, a przed merge `npm run test:e2e` z `E2E_EMAIL`/`E2E_PASSWORD` (D-07).

### 10.7 Ryzyka resztkowe
- Brak przebiegu E2E (D-07) i brak testu renderowania ekranu końcowego, edytora cardio i dialogów (sekcja 6).
- Zachowanie wielokartowe i `pagehide` w przeglądarce nie zostały przetestowane end-to-end; sondy działają na atrapie `fetch` i handlerze w pamięci.
- N-B1d-1 i N-B1-2 (sekcja 10.3) - niskie, backlog.

## 11. Weryfikacja pivotu p.13 (tester, etap 7d, 2026-10-25)

- **Zakres**: pivot ADR 0004 p.13 (deterministyczny `operationId`, korekta B-1c/B-1d w kliencie i w `handleGET`). Sondy na prawdziwych handlerach `app/api/active-workout-session/route.ts`, prawdziwych funkcjach `lib/active-workout-cloud-client.ts`, prawdziwym `decideCloudHydrateAction` oraz kopii closure `push()`/hydrate z `components/active-workout/active-workout-cloud-sync.tsx` (komponent `"use client"` nie da się wyrenderować bez DOM — brak jsdom/testing-library w repo, jak w poprzednich rundach). Plik sondy `lib/tmp-probe-p13.test.ts` usunięty po przebiegu.
- **Uwaga o środowisku**: pierwsza wersja sondy zawisła na scenariuszu „DELETE zwraca 500” (atrapa `fetch` oddawała się tylko mikrozadaniami, więc pętla ponowień nie oddawała pętli zdarzeń). Atrapę poprawiono (realne oddanie makrozadania) i powtórzono. Proces pierwszego, zawieszonego przebiegu Vitest (ID zadania w tle `blwbo65hg`) może nadal działać; nie został zabity, bo próba zabicia procesu została zablokowana przez uprawnienia — do ręcznego sprzątnięcia przez właściciela środowiska. Nie wpływa na pliki repo.

### 11.1 Wyniki komend (uruchomione w tej sesji)

| Komenda | Wynik |
|---|---|
| `npx tsc --noEmit` | exit 0, czysto |
| `npm run lint` | **142 problemy: 104 błędy, 38 ostrzeżeń** = baseline, bez nowych problemów |
| `npm test` | 145 plików: 144 OK, 1 plik z 2 awariami (`lib/android-version.test.ts`, D-15, pre-istniejące, niepowiązane). Zielone m.in.: `lib/workout-operation-id.test.ts`, `lib/active-workout-cloud-client.test.ts` (w tym 4 kombinacje `shouldApplyConflictPayload`), `app/api/active-workout-session/route.test.ts` (sekwencja 9.2 i „GET na wygaszonym wierszu nie mutuje”) |
| `npm run test:e2e` | NIE WYKONANO (brak `E2E_EMAIL`/`E2E_PASSWORD`, jak w 7c) |

### 11.2 Kontrola usunięcia `operationId` (punkt 5 polecenia)

- Grep po `store.operationId`, `ensureOperationId`, `.operationId` w `lib/`, `components/`, `app/`: brak odwołań do pola store, payloadu chmury, `partialize` ani snapshotu. Trafienia: `lib/stores/active-workout.ts` (`migrate()` v3→v4, `delete p.operationId` — zamierzone); komentarz w `lib/workout-operation-id.ts:9-10` wspomina już nieistniejące `ensureOperationId` (kosmetyka, N-P13-5); `lib/workout-outbox-db.ts` (pole kolejki offline, kształt bez zmian); `app/api/workouts/complete/route.ts` (schemat i indeks, bez zmian).
- Wynik: **OK**.

### 11.3 Sonda P1 — B-1c (pętla DELETE)

| Przypadek | Wynik | Ocena |
|---|---|---|
| A: kończy trening (PUT, potem pusty stan), 5 kolejnych ticków bezczynnej karty | DELETE: **1**, rewizja w bazie stała (2,2,2,2,2) | **OK**, pętla zamknięta |
| Reset `clearedPushedRef` | tylko w gałęzi aktywnej sesji (`active-workout-cloud-sync.tsx:177`) i przy nieudanym DELETE (`:165`); nie w każdym ticku pustej karty (`:159` wczesny `return`) | **OK**, zgodnie z ADR p.13.3 krok 8 |
| P1b: świeża karta (rewizja lokalna 0), chmura wygaszona rev 2, 5 ticków | DELETE: **1** | **NISKI**, N-P13-2 (odchylenie od „przejścia aktywna→pusta”) |
| P1c: DELETE zwraca 500, 50 makrozadań | DELETE: **50** (bez czekania na interwał 8 s) | **ŚREDNI, pre-istniejące**, N-P13-3 (ten sam kształt w `HEAD`) |

### 11.4 Sonda P2 — stray DELETE z jednej karty nie kasuje sesji drugiego urządzenia na stałe

- Urządzenie B z aktywną sesją (rev 1); świeża karta A wysyła DELETE (rev 2). Tik B: 409 z wygaszonym payloadem → `shouldApplyConflictPayload` = false → B zachowuje lokalną sesję i wysyła PUT z rev 2.
- Wynik: w chmurze **aktywna sesja B**, rewizja 3, `workoutPlanId: plan-b`, 1 ćwiczenie. **OK**: B samo-naprawia się bez utraty, bo lokalny stan jest źródłem prawdy dla aktywnej sesji.

### 11.5 Sonda P3 — B-1d (GET nie podbija rewizji)

- DELETE (rev 2), potem dwa kolejne GET (reload; `decideCloudHydrateAction` = `noop` x2): rewizja w bazie **2 → 2**. Nowy trening PUT z rewizją klienta 2: **ok**, brak 409. **OK**.
- Cztery kombinacje `shouldApplyConflictPayload` (lokalnie aktywna/pusta × konflikt aktywny/pusty) potwierdzone w `lib/active-workout-cloud-client.test.ts:110-130`: `false` tylko dla (aktywna, pusta), pozostałe `true`. **OK**.

### 11.6 Sonda P4 — zasada „lokalna wygrywa” przy konflikcie z wygaszonym payloadem (DEFEKT)

Scenariusz: A rozpoczyna sesję S1 (rev 1); B hydratuje i dostaje S1 (`apply-other-device`); A kończy trening (DELETE, rev 2); B, z nadal otwartą kartą, wykonuje tik.

- Tik B: 409 z wygaszonym payloadem, B zachowuje S1 i wysyła PUT. **W chmurze znów aktywna sesja S1, rev 3.**
- Przeładowanie A: `decideCloudHydrateAction` zwraca **`apply-other-device`** (lokalnie pusto, chmura aktywna, inne urządzenie). A wznawia S1, czyli trening już **zakończony** na A.
- Konsekwencja: jeśli użytkownik dopisze serie po wznowieniu i zakończy trening, `POST /api/workouts/complete` z tym samym `operationId` (ta sama `workoutStartedAtMs`) trafia w `respondWithExistingWorkout` (`app/api/workouts/complete/route.ts:446-457`; tolerancja startu ±2000 ms przechodzi, `:321-332`). Serwer **zwraca istniejący zapis bez INSERT i bez aktualizacji**, więc nowe serie są odrzucone po cichu. Klient w `use-workout-finish-flow.ts` traktuje `status: "saved"` z `duplicate: true` jako sukces (tylko `console.warn` przy pierwszej próbie).
- Ocena: **WYSOKI, nowa regresja wprowadzona przez pivot** (korekta B-1d po stronie klienta, ADR p.13.3 krok 8). W `HEAD` ta sytuacja kończyła się inaczej: B kasował sesję po cleared payloadzie, a A nie wznawiał. Obie zasady mają scenariusz utraty: „pusta chmura kasuje żywą sesję” (B-1d) albo „zakończony trening wraca i gubi serie” (P4). Pivot nie analizował przypadku „zakończone na jednym urządzeniu, otwarte na drugim”. Szczegóły: N-P13-1.

### 11.7 Sonda P5 — deterministyczność `operationId` (fundament pivotu)

- Dwie niezależne instancje modułu (`vi.resetModules()` + ponowny import), te same argumenty, cztery przypadki (`"plan-1"`, `null`, `"plan-ż-ą"` z polskimi znakami, ułamkowe `startedAtMs`): **identyczne wyniki**, zgodne z niezależną referencją `node:crypto` (SHA-1, UUID v5, ta sama przestrzeń nazw, zaokrąglenie `Math.round`).
- Algorytm referencyjny zweryfikowany na wektorze RFC 4122 (DNS, `www.example.com` → `2ed6657d-e927-568b-95e1-2665a8aea6a2`), więc zgodność nie jest zgodnością dwóch własnych implementacji.
- Test „dwa urządzenia liczą ten sam operationId” w `lib/workout-operation-id.test.ts` jest w praktyce tym samym przypadkiem co „jest deterministyczny” (ten sam moduł, ten sam proces). Sonda P5 dodaje realną izolację i referencję. Zalecam zostawić oba testy, nie traktując testu „dwóch urządzeń” jako dowodu międzyprocesowego.
- Zależność od `crypto.subtle`: działa tylko w kontekście bezpiecznym (HTTPS/localhost). To ten sam profil co wcześniejsze `crypto.randomUUID()` w `start()`, więc nie jest nowym ryzykiem produkcyjnym (produkcja na HTTPS). Niski, odnotowany.
- Wynik: **OK**.

### 11.8 Defekty i uwagi (etap 7d)

- **N-P13-1 (WYSOKI, BLOKUJĄCY): zakończony trening wraca jako aktywny i może pochłonąć dopisane serie.** Pliki/linie: `components/active-workout/active-workout-cloud-sync.tsx:189-193` (zasada „lokalna wygrywa”), `lib/active-workout-cloud-client.ts:61-69` (`shouldApplyConflictPayload`), `app/api/active-workout-session/route.ts` (PUT akceptuje sesję po DELETE od innego urządzenia), `app/api/workouts/complete/route.ts:321-332, 446-457`, `components/active-workout/use-workout-finish-flow.ts` (brak rozgałęzienia na `duplicate`). Kroki: 11.6. Oczekiwane: zakończony trening nie wraca na żadnym urządzeniu, a zapis nie gubi serii. Faktyczne: wznowienie zakończonego treningu i po cichu odrzucone serie. Dotkliwość: wysoka (utrata danych treningu bez sygnału w UI). Prawdopodobieństwo: niskie do średniego (wymaga dwóch jednocześnie otwartych kart lub urządzeń z tą samą sesją). Właściciel: architekt (decyzja o zasadzie konfliktu po zakończeniu sesji), potem backend/frontend. Propozycja do rozważenia przez architekta (niezatwierdzona): wygaszenie zapisuje w tombstonie `workoutStartedAtMs` zakończonej sesji; klient przy konflikcie z tombstonem przyjmuje wygaszenie tylko wtedy, gdy lokalna `workoutStartedAtMs` jest tą samą wartością (zakończona sesja), a zachowuje lokalną, gdy jest inna (nowy trening). To zamyka zarówno B-1d, jak i P4 bez zmiany mechanizmu rewizji.
- **N-P13-2 (NISKI): pierwszy tik na świeżej karcie wysyła DELETE.** `clearedPushedRef` startuje od `false` (`active-workout-cloud-sync.tsx:79`), więc każde załadowanie karty z pustym stanem wysyła jedno DELETE przy pierwszym ticku, nawet bez historii sesji (P1b: 1 DELETE przy rewizji lokalnej 0; gate `readRevision() > 0` w `HEAD` nie wysyłał). Skutek: zbędna rewizja; ewentualna aktywna sesja drugiego urządzenia zostaje wygaszona i samo-naprawiona przez B (P2). Zalecenie: inicjalizować wartownik `true` (DELETE tylko na realnym przejściu aktywna→pusta); ghost po stronie hydrate i tak obsługuje `decideCloudHydrateAction`. Właściciel: frontend. Nie blokuje.
- **N-P13-3 (ŚREDNI, pre-istniejące w `HEAD`): gorąca pętla ponowień przy błędzie DELETE/PUT.** `active-workout-cloud-sync.tsx:164-173` i `:202-213`: nieudany DELETE/PUT ustawia `pendingPushRef`, a `finally` wywołuje `void push()` natychmiast, bez opóźnienia i bez limitu. Sonda P1c: 50 żądań DELETE w 50 makrozadaniach przy odpowiedzi 500. Przy 429 (limit `RATE.activeWorkoutSession`, 90/min) pętla podbija licznik limitu. Nie wprowadzone przez pivot (ten sam kształt w `HEAD`), ale pivot go nie łagodzi. Właściciel: frontend (backoff lub limit prób, najlepiej przed Promote). Nie blokuje tej rundy.
- **N-P13-4 (NISKI): wyścig w ghost GET.** `handleGET` czyta wiersz, a przy przeterminowanej aktywnej sesji `clearRow` nadpisuje go bez warunku na rewizję (`app/api/active-workout-session/route.ts:107-111`, `clearRow` `:42-57`). Jeśli świeży PUT wpadnie między odczytem a zapisem, zostanie nadpisany (okno rzędu milisekund; klient i tak ponowi zapis). Właściciel: backend. Backlog.
- **N-P13-5 (NISKI, kosmetyka):** komentarz w `lib/workout-operation-id.ts:9-10` wspomina `ensureOperationId` (usunięte). Właściciel: frontend. Backlog.

### 11.9 Werdykt etapu 7d (tester)

**ODRZUCONE**: cofnięcie do etapu 3 (architekt: zasada konfliktu po zakończeniu sesji na innym urządzeniu) i wąska poprawka w etapie 5.

Uzasadnienie:
1. Pivot jest zrealizowany poprawnie w zakresie, który miał naprawić: deterministyczny `operationId` (P5, referencja i wektor RFC), usunięcie stanu z store i payloadu (11.2), B-1c zamknięty (P1), B-1d zamknięty na handlerze i w kliencie (P3), scenariusz 9.2 zielony (`route.test.ts`), tsc czysty, lint na baseline, `npm test` bez nowych awarii.
2. Mimo to pivot wprowadza nową regresję klasy „stale urządzenie zmienia stan po zakończeniu” (N-P13-1, P4): zakończony trening wraca na drugim urządzeniu, a jego wznowienie i zakończenie po cichu gubi dopisane serie. To nie jest drobna łatka: wynika z zasady „lokalna wygrywa”, którą ADR p.13.3 krok 8 przyjął bez analizy tego przypadku. Nie jest to więc „niskie ryzyko do backlogu”: utrata serii bez sygnału w UI jest wysoka, a mechanizm należy do funkcji synchronizacji między urządzeniami.
3. Zakres poprawki jest wąski (tombstone z `workoutStartedAtMs` w wygaszeniu i warunek w `shouldApplyConflictPayload`), ale wymaga decyzji architekta, bo zmienia kształt wygaszonego payloadu. Nie wymaga przepisywania pivotu.

Warunki zamknięcia (ponowna weryfikacja przez testera, bez pełnej nowej rundy):
- P4 przechodzi: zakończona sesja nie wraca na A po przeładowaniu, a nowa sesja na B (inny `workoutStartedAtMs`) nie jest kasowana przez wygaszony payload (zachowanie B-1d utrzymane).
- Testy regresji dla obu gałęzi tombstona (klient bez DOM i route handler).
- N-P13-2 (wartownik `true`) zalecane w tej samej poprawce. N-P13-3 zaplanowane przed Promote, bo pogarsza limit API.

Pozostałe elementy (B-1b, B-1c, B-1d, determinizm, usunięcie `operationId`, tsc, lint, testy) są **ZATWIERDZONE** w tej rundzie i nie wymagają ponownej weryfikacji poza testami regresji wymienionymi wyżej.

## 12. Weryfikacja naprawy N-P13-1 (tester, etap 7e, 2026-10-25)

- **Zakres**: sonda P4 z sekcji 11.6 na naprawionym kodzie (ADR 0004 p.14), scenariusz odwrotny (B-1d bez regresji), powtórka `npm test`, `npx tsc --noEmit`, `npm run lint`. Sondy usunięte po przebiegu (plik tymczasowy w `app/api/active-workout-session/`, nie zostawiony w repo). Pivot p.13 (B-1b/c/d, `operationId`) nie był powtarzany.
- **Wyniki komend**: `npx tsc --noEmit` exit 0; `npm run lint` 142 problemy (104 błędy, 38 ostrzeżeń) = baseline; `npm test` 144/145 plików OK, jedyna awaria `lib/android-version.test.ts` (D-15, pre-istniejące, niepowiązane); `vitest` na 3 plikach zmiany (`lib/active-workout-cloud-client.test.ts`, `lib/active-workout-cloud.test.ts`, `app/api/active-workout-session/route.test.ts`) 34/34 OK.

### 12.1 Sonda P4 (scenariusz 1) — A kończy S1, B lokalnie S1

| Krok | Wynik | Ocena |
|---|---|---|
| A: PUT S1 rev 0 → rev 1; A: DELETE | DELETE rev 2, tombstone `clearedSessionStartedAtMs = 1000` (= `workoutStartedAtMs` S1) | OK |
| B tik: PUT S1 rev 1 → 409 z tombstonem | `shouldApplyConflictPayload(S1, tombstone S1)` = **true** → B przyjmuje wygaszenie, nie republikuje | OK |
| A przeładowanie (`GET`) | `session: null` → `decideCloudHydrateAction` = noop, A nie wznawia S1 | OK |

### 12.2 Scenariusz odwrotny (B-1d bez regresji) — B lokalnie S2, tombstone S1

- PUT S2 rev 0 → 409 z tombstonem S1 → `shouldApplyConflictPayload(S2, tombstone S1)` = **false** → B zachowuje S2, PUT z rewizją z konfliktu → 200, w chmurze aktywna S2 (`workoutStartedAtMs = 2000`). **OK**, nic nie ginie.

### 12.3 NOWY DEFEKT N-P13-6 (WYSOKI, BLOKUJĄCY): tożsamość tombstone jest kasowana przez kolejny DELETE

- **Odtworzenie**: (a) P4 scenariusz 1 do kroku „B przyjął wygaszenie”; (b) B wysyła DELETE, bo po zaakceptowaniu lokal jest pusty, a `clearedPushedRef` na B jest `false` (`components/active-workout/active-workout-cloud-sync.tsx:79`, `push()` gałąź pusta, `:~182`). Wynik: DELETE rev 3, tombstone **`clearedSessionStartedAtMs = null`**. (c) Urządzenie C z nadal otwartą S1 (rev 1) wysyła PUT → 409 z `null` → `shouldApplyConflictPayload` = **false** → C republikuje S1 → sesja zakończona wraca jako aktywna w chmurze.
- **Sonda P4b**: sam DELETE na już wygaszonym wierszu (`handleDELETE` → `existingPayload.workoutStartedAtMs` = `null` → nowy tombstone `null`) zeruje tożsamość: po 2× DELETE `clearedSessionStartedAtMs` = `null` (oczekiwane `1000`).
- **Przyczyna**: `handleDELETE` (`app/api/active-workout-session/route.ts`, `clearedSessionStartedAtMs = existingPayload?.workoutStartedAtMs ?? null`) traktuje wygaszony wiersz jak „brak tożsamości do przeniesienia”. ADR 0004 p.14.3 (uwaga o DELETE na już wygaszonym wierszu: „to jest poprawne, bo nie ma już żywej sesji”) jest w tym miejscu błędny: to właśnie tożsamość tombstone'u jest tym, co chroni przed wskrzeszeniem przez zaległe urządzenia.
- **Wyzwalacz w praktyce**: nie tylko B po akceptacji. Każda świeża karta/urządzenie z pustym stanem wysyła DELETE na pierwszym ticku (N-P13-2, `clearedPushedRef` startuje od `false`), więc samo otwarcie aplikacji po zakończeniu treningu kasuje tożsamość.
- **Dotkliwość**: wysoka (ta sama klasa co N-P13-1: zakończony trening wraca i gubi serie), prawdopodobieństwo: niskie-średnie (wymaga trzeciego, zaległego urządzenia z otwartą sesją lub zaległego klienta). Nie wykrywa tego scenariusz 1 z dwoma urządzeniami, dlatego poprzednie testy go nie łapały.
- **Poprawka (do decyzji architekta, rekomendacja testera)**: 
  1. `handleDELETE` i `clearRow` przy wygaszaniu wiersza JUŻ wygaszonego zachowują `clearedSessionStartedAtMs` z poprzedniego tombstone'u (nie nadpisują `null`); tożsamość zmienia się tylko, gdy wygaszana jest prawdziwie aktywna sesja.
  2. Uzupełnienie po stronie frontendu (N-P13-2): wartownik `clearedPushedRef` startuje od `true` (DELETE tylko na realnym przejściu aktywna→pusta), żeby świeża karta nie wysyłała DELETE.
  3. Testy regresji: P4b (2× DELETE zachowuje `1000`), oraz trzy urządzenia (A kończy S1, B akceptuje i wysyła DELETE, C ze stale S1 dostaje 409 → `shouldApplyConflictPayload` = `true`).
- Właściciel: architekt (korekta p.14.3, wyjątek od zasady „nie zmieniać pivotu bez decyzji”), potem backend (route) i frontend (N-P13-2).

### 12.4 Werdykt etapu 7e

- **ODRZUCONE**. Sonda P4 z polecenia (B przyjmuje wygaszenie, A nie wznawia) i scenariusz odwrotny (B-1d) działają zgodnie z ADR p.14. Naprawa N-P13-1 jest jednak niepełna: tożsamość tombstone'u jest tracona przy każdym kolejnym DELETE (N-P13-6), więc zakończona sesja może wrócić na trzecim urządzeniu. Nie cofa to etapu 5 w całości; wymagana jest korekta projektu w ADR p.14.3 (etap 3) i wąska poprawka backend/frontend.
- Etap 8 (przegląd wizualny ux) i 9 (bezpieczeństwo/wydajność) **nie są jeszcze uruchamiane**; zadanie nie jest gotowe.
- Wynik `npm test` / `tsc` / `lint` bez nowych regresji względem baseline (`lib/android-version.test.ts` pre-istniejące).

## 13. Weryfikacja naprawy N-P13-6 (tester, etap 7f, 2026-10-25)

Zakres: macierz ADR 0004 p.15.5 (scenariusze a-f), ocena testów backendu, niezależna sonda scenariusza (d) i poszukiwanie kolejnego wariantu klasy błędu (p.15.7). Pełny plan testów (obszar wysokiego ryzyka: tożsamość sesji, wielu uczestników). Etap 8 (ux) i 9 (bezpieczeństwo/wydajność) nieuruchomione.

### 13.1 Wyniki komend (uruchomione w tej sesji)

- `npx tsc --noEmit`: OK (exit 0).
- `npm run lint`: 142 problemów (104 błędy, 38 ostrzeżeń) = baseline. `eslint` na 6 dotkniętych plikach (`route.ts`, `route.test.ts`, `lib/active-workout-cloud*.ts`, `lib/active-workout-cloud-client*.ts`): exit 0.
- `npm test`: 145 plików, 1110 testów, 1108 OK, 2 awarie pre-istniejące i niepowiązane (`lib/android-version.test.ts`, dryf wersji APK, plik nie dotknięty tym diffem).

### 13.2 Ocena testów backendu (czytanie asercji, nie nazw)

- `lib/active-workout-cloud.test.ts` (4 testy `resolveClearedSessionIdentity`): asercje sprawdzają wartości zgodne z tabelą p.15.2 (`null`→`null`, aktywna→`workoutStartedAtMs`, tombstone z tożsamością→zachowana, tombstone bez tożsamości→`null`). Test „już tombstone" dodatkowo asertuje `workoutStartedAtMs === null` na wejściu, więc sprawdza właściwy mechanizm błędu. OK.
- `app/api/active-workout-session/route.test.ts`, macierz (a)-(f): asercje na rewizjach i na `clearedSessionStartedAtMs` w bazie (odczyt `payload_json` przez SQL, nie przez odpowiedź). Scenariusz (b) jest niezależny od kolejności: bez naprawy (`existingPayload?.workoutStartedAtMs`) po drugim DELETE tożsamość byłaby `null` i asercja `toBe(1000)` by padła, więc test nie jest pusty. Ocena przez rozumowanie o kodzie, nie przez mutację (nie modyfikowałem kodu produkcyjnego).
- Scenariusz (d) w `route.test.ts` (linie 406-451): C dostaje 409 z tombstone `1000` i `shouldApplyConflictPayload(payloadS1, tombstone) === true`. Asercje są właściwe.
- `lib/active-workout-cloud-client.test.ts` (scenariusz (d) na `shouldApplyConflictPayload`): asercja `true` dla tombstone z `clearedSessionStartedAtMs: 1000` po idempotentnym DELETE. OK.

### 13.3 Niezależna sonda scenariusza (d) — trzy urządzenia (PASS)

Sonda napisana od nowa przez testera (nie kopia testu backendu): A `PUT` S1 rev 0→1; B `PUT` S1 rev 1→2; A `DELETE` →3; B idempotentny `DELETE` →4; zachowanie tożsamości w bazie (`1000`); C `PUT` S1 z rewizją 2 → `409`, `conflict.session.payload.clearedSessionStartedAtMs === 1000`; `shouldApplyConflictPayload(S1 lokalna, tombstone) === true` (C przyjmuje wygaszenie, nie wskrzesza). Wynik: **PASS**. Potwierdzenie niezależne od backendu: scenariusz (d) działa na prawdziwych handlerach.

Sonda była tymczasowa (plik poza repozytorium: `C:/Users/damia/AppData/Local/Temp/claude/D--Projekty-GymBrat/be781d14-c0e8-4e8b-bd93-e21f569cc279/scratchpad/zz-probe-7f.test.ts`), usunięta z drzewa roboczego po przebiegu.

### 13.4 NOWY DEFEKT N-P13-7 (WYSOKI, BLOKUJĄCY): DELETE bez warunku tożsamości kasuje aktywną sesję drugiego urządzenia

- **Tytuł**: pusta karta innego urządzenia wysyła DELETE i wygasza aktywną sesję S2 uruchomioną na urządzeniu A; A przyjmuje wygaszenie i traci trening.
- **Kroki (sonda, prawdziwe handlery + `shouldApplyConflictPayload`)**: (1) S1 zakończona, tombstone `1000`, rewizja 3. (2) C hydratuje pusty stan (`GET` → `session: null`). (3) A startuje S2 (`PUT` S2 rev 3 → 200). (4) C wysyła DELETE (pierwszy tick `push()` z pustym stanem, bo `clearedPushedRef` startuje od `false`) → 200. (5) Serwer: tombstone `clearedSessionStartedAtMs === 2000` (S2 wygaszona). (6) A wysyła kolejny `PUT` S2 z rewizją z kroku 3 → `409`. (7) `shouldApplyConflictPayload(S2 lokalna, tombstone 2000)` → **`true`**: A stosuje wygaszenie i kasuje lokalną S2.
- **Oczekiwany**: DELETE od urządzenia, które nie prowadzi sesji S2 (pusty stan, bez wcześniejszej aktywności), nie wygasza S2; albo klient A nie traktuje wygaszenia jako własnego.
- **Faktyczny**: S2 wygaszona; A traci aktywny trening (sonda: `[7f-PROBE] shouldApplyConflictPayload na A: true`).
- **Dotkliwość**: WYSOKA (utrata danych trwającego treningu), prawdopodobieństwo NISKIE: okno to pierwszy tick `push()` (co 8 s, `PUSH_INTERVAL_MS`) albo pierwsze `visibilitychange`/`pagehide` po montażu pustej karty, w którym S2 zostanie uruchomiona na innym urządzeniu. Nie wymaga ponawiania ani awarii sieci.
- **Podejrzany moduł**: `DELETE` w `app/api/active-workout-session/route.ts` (`handleDELETE` nie przyjmuje ani rewizji, ani tożsamości kończonej sesji), wartownik `clearedPushedRef` w `components/active-workout/active-workout-cloud-sync.tsx` (linie 79, 158-166).
- **Dlaczego to NIE jest wariant już zamknięty**: osie p.15.7 (idempotencja, liczba uczestników, symetria nadpisywania) nie obejmują DELETE od aktora, który nie jest właścicielem sesji. Scenariusz (f) testuje DELETE od właściciela S2, nie od obcego pustego klienta.
- **Wniosek o p.15.4 (ADR)**: uzasadnienie „N-P13-2 to tylko optymalizacja ruchu" (punkt 3b) jest błędne. Tombstone niesie tożsamość CURRENT sesji S2 (nie „starej"), więc `shouldApplyConflictPayload` na A daje `true` — samonaprawa nie zachodzi. Wartownik `clearedPushedRef` startujący od `false` jest realnym wyzwalaczem tej utraty, więc N-P13-2 wraca z poziomu „backlog, niski" do poziomu poprawności.
- **Ścieżka po konflikcie (ocena po kodzie, bez harnessu React)**: gdy C zastosował tombstone S0 z konfliktu (`applyCloudPayload` w gałęzi `shouldApplyConflictPayload === true`), lokalny stan staje się pusty, a `clearedPushedRef` nie jest ustawiany w tej gałęzi; kolejny tick może wysłać DELETE ponownie (jeśli wartownik był `false`, czyli C był aktywny w tym montażu). Ta ścieżka wymaga osobnej sondy po stronie frontend.
- **Kierowanie**: `architekt` (etap 3, nowa decyzja p.16 albo nowy ADR: DELETE powinien nieść warunek tożsamości/rewizji albo klient musi mieć wartownik `true` od startu, z uzasadnieniem zamiast p.15.4) oraz `frontend` (wartownik, N-P13-2 jako wymóg poprawności). Backend nie naprawia tego w samym `handleDELETE` bez zmiany kontraktu (DELETE nie ma body) — decyzja architekta.

### 13.5 Próba znalezienia kolejnych wariantów (p.15.7)

- Wyczerpanie stanów wiersza (brak wiersza, nieparsowalny, aktywny, tombstone) — pokryte tabelą 15.2, bez nowych odkryć.
- Wielokrotne DELETE i GET-ghost (idempotencja) — pokryte macierzą (a)-(c), bez odkryć.
- Trzy urządzenia (d) — pokryte i sprawdzone niezależną sondą (13.3).
- Wariant z pustą kartą innego urządzenia (13.4) — **nowy defekt**, nieobjęty żadną osią p.15.7.
- Nie szukałem dalej w nieskończoność (zgodnie z poleceniem): zakres ograniczony do modelu „jeden wiersz + tombstone" i ścieżek klienta wywołujących DELETE/PUT.

### 13.6 Werdykt etapu 7f (tester)

**ODRZUCONE.** Macierz p.15.5 (a)-(f) przechodzi, a scenariusz (d) potwierdzony niezależną sondą. Jednak wykryto nowy defekt N-P13-7 (WYSOKI, blokujący), który podważa twierdzenie p.15.4 i p.15.7 o kompletności. Zgodnie z ADR p.15.7 wraca to do analizy modelu (etap 3, architekt: decyzja o warunku DELETE lub wartowniku od `true`), a nie do kolejnej łatki w `handleDELETE`. Etap 5 (frontend: wartownik) potrzebny po decyzji architekta. Etapy 8 i 9 nie uruchomione. Dotyczy to też punktu 15.4 (N-P13-2 nie jest optymalizacją).

## 14. Weryfikacja naprawy N-P13-7 i ocena kompletności ADR p.16.6 (tester, etap 7g, 2026-10-25)

**Odpowiedź wprost na pytanie koordynatora:** zadanie 005 **NIE jest gotowe** do etapu 8 (przegląd wizualny ux) ani etapu 9 (bezpieczeństwo/wydajność). Naprawa N-P13-7 działa dokładnie tak, jak opisano w ADR p.16 (scenariusz 13.4 przechodzi), ale argument kompletności z ADR p.16.6 ("zamyka całą rodzinę, każda mutacja wymaga dowodu aktualnej rewizji") **jest fałszywy**: dowód rewizji jest sprawdzany przed zapisem, a zapis nie jest warunkowany tą samą rewizją (brak CAS). Wykryto to jako nowy defekt N-P13-8 (WYSOKI, blokujący).

### 14.1 Zakres i metoda

- Przeczytane: ADR 0004 p.16 (w całości), karta 005 wiersze 3f/5f, `route.ts` (`handleGET`, `handlePUT`, `handleDELETE`, `buildRevisionConflictResponse`, `clearRow`), `lib/active-workout-cloud-client.ts` (`deleteCloud`, `putCloud`), `active-workout-cloud-sync.tsx` (hydrate: DELETE linia 119; push: DELETE linia 171; PUT linia 199), testy `route.test.ts` (18) i `active-workout-cloud-client.test.ts` (19).
- Callerzy `deleteCloud`/`putCloud` w repo (grep, bez `*.test.*`): trzy wywołania w `active-workout-cloud-sync.tsx` (119 DELETE w hydracji, 171 DELETE w push, 199 PUT w push) oraz `e2e/active-workout.spec.ts:105` (bezpośredni `page.request.delete` BEZ ciała). Android i `java-backend/` nie używają `/api/active-workout-session`. `lib/db-retention.ts` (purge po wieku) i `lib/community/teams.ts` (odczyt) nie są mutacjami wywołanymi przez klienta.
- Ścieżki mutujące `activeWorkoutSessions` na serwerze: `handlePUT` (UPDATE/INSERT), `handleDELETE` (przez `clearRow`), `handleGET`-ghost (przez `clearRow`, dwie gałęzie: nieparsowalny payload i przeterminowany aktywny payload). Klient nie ma trzeciej ścieżki zapisu: `push()` dla pustego stanu wywołuje wyłącznie `deleteCloud(readRevision())`, dla aktywnego wyłącznie `putCloud(...)`; `hydrate()` wywołuje `deleteCloud(cloud?.revision ?? 0)` tylko w gałęzi `delete-cloud` (tam `cloud` jest niepusty, bo `cloudActive` wymaga `cloud`). Nie znaleziono ścieżki omijającej `deleteCloud(revision)`.
- Sonda: własna, niezależna od testów backendu, na prawdziwych handlerach `GET/PUT/DELETE` i bazie `:memory:` (`createMemoryDb`). Wyścig wstrzykiwany przez opakowanie `client.execute` (libsql): po pierwszym SELECT na `active_workout_sessions` (czyli po odczycie rewizji przez handler, przed jego UPDATE) wykonywane jest współbieżne żądanie drugiego urządzenia. Plik sondy usunięty z drzewa po przebiegu.

### 14.2 Wyniki sond

| Sonda | Scenariusz | Oczekiwany | Faktyczny | Werdykt |
|---|---|---|---|---|
| P1 | Replika 13.4: A PUT S1 (rev 0→1), A DELETE (→2), A PUT S2 (→3); C pusta karta `DELETE {revision:0}` | 409, `conflict.session` z S2 (`workoutStartedAtMs 2000`, rev 3), wiersz identyczny przed/po (SELECT `*`) | 409, `conflict.session.revision === 3`, `workoutStartedAtMs === 2000`, wiersz identyczny (`toEqual`) | **PASS** |
| P2 | Jednostronność: `DELETE {revision: 1000000}` na S2 (rev 2) | 409 byłby oczekiwany, gdyby rewizja musiała być DOWODEM aktualnego stanu (równość), a nie deklaracją ≥ | **200**, S2 wygaszona (tombstone, rev 3) | **FAKT: słabość warunku** (`<` zamiast równości/CAS) |
| P3 | **TOCTOU DELETE**: A `DELETE {revision:3}`; między SELECT A (rev 3, zgodne) a UPDATE A współbieżny B `PUT {revision:3}` z S3 (→ rev 4) | 409 albo S3 nietknięte (zapis A nie może nadpisać nowszego zapisu, którego A nie widział) | **200**; S3 (rev 4) **zgubiona**, wiersz = tombstone rev 4 (`device_id devB`, `clearedSessionStartedAtMs 2000`) | **FAIL: NOWY DEFEKT N-P13-8** |
| P4 | **TOCTOU GET-ghost**: wiersz przeterminowany (updatedAt −24 h), `GET` czyta rev 1; między SELECT a `clearRow` współbieżny A `PUT {revision:1}` z S-new (→ rev 2) | S-new przetrwa (świeża, aktywna sesja nie może być wygaszona przez odczyt, który widział starą wersję) | `GET` zwraca `session: null`, S-new **zgubiona**, wiersz = tombstone rev 2 (`clearedSessionStartedAtMs 1000`) | **FAIL: NOWY DEFEKT N-P13-8** (ta sama klasa, ścieżka GET) |
| P5 | Kontrola PUT-vs-PUT: A `PUT {revision:1}` (A-edit) i współbieżny B `PUT {revision:1}` (B-edit) między SELECT a UPDATE A | Zapis A odrzucony (409), bo rewizja 1 jest w chwili zapisu nieaktualna | A `200`, rev 2, B-edit **nadpisany** (`title A-edit`) | **FAIL: ta sama przyczyna w PUT** (istnieje też przed naprawą 5f; ale ADR p.16.6 opiera się na symetrii PUT/DELETE) |

Pozostałe testy repo (18 w `route.test.ts`, 19 w `active-workout-cloud-client.test.ts`) przechodzą, ale wszystkie żądania są w nich sekwencyjne, więc nie mogą wykryć P3-P5.

### 14.3 Ocena argumentu kompletności ADR p.16.6 (próba obalenia)

Argument architekta: "każda mutacja na `PUT`/`DELETE` wymaga dowodu aktualnej rewizji, więc nie ma drogi do zmiany stanu bez takiego dowodu". Próba obalenia w czterech krokach:

1. **Sprawdzenie i zapis nie są atomowe (P3, P4, P5).** Warunek `clientRevision < serverRevision` jest sprawdzany na wyniku SELECT. Zapis (`clearRow` i UPDATE w `handlePUT`) to `UPDATE ... WHERE user_id = ?` BEZ `AND revision = ?` i bez sprawdzenia liczby zmienionych wierszy. Między SELECT a UPDATE inne żądanie może zmienić rewizję i treść, a zapis nadpisze ją nieaktualnym dowodem. To obala tezę "żadna mutacja bez dowodu aktualnej rewizji": dowód jest aktualny w chwili odczytu, nie w chwili mutacji. Wszystkie trzy ścieżki mają tę samą lukę; naprawa 5f nie zamyka jej dla DELETE, bo klasa błędu (utrata cudzego zapisu) żyje właśnie w tej luce.
2. **Dowód to `>=`, nie równość (P2).** Klient może przysłać dowolną liczbę ≥ rewizji serwera (np. 1 000 000) i przejść. Dowodem jest więc deklaracja klienta, a nie zgodność z wartością serwera. Dla bystandera z rewizją 0 warunek działa, ale tylko dlatego, że `0 < n`, nie dlatego, że bystander "wie" cokolwiek. Warunek jest jednostronny.
3. **GET-ghost (P4).** Argument "operuje na własnym, właśnie odczytanym wierszu, więc bezpieczny" (ADR p.16.1) jest błędny: odczyt i zapis są rozdzielone w czasie, a zapis nie jest warunkowany odczytaną rewizją. Wiersz odczytany jako przeterminowany może zostać w międzyczasie zastąpiony świeżym zapisem, który zostanie wygaszony.
4. **Klient: brak drogi omijającej.** Potwierdzone: `push()`/`hydrate()` nie mają ścieżki wywołującej coś innego niż `deleteCloud(revision)` przy wygaszaniu ani innego zapisu sieciowego. Ta część argumentu jest poprawna. Luka leży po stronie serwera (atomowość zapisu), nie w kliencie.

**Wniosek:** rodzina B-1b/B-1c/B-1d/N-P13-1/N-P13-6/N-P13-7 NIE jest zamknięta mechanizmem p.16. Kolejny wariant tej samej klasy (utrata zapisu przez nieaktualną rewizję w chwili zapisu) jest realny i dotyczy wszystkich trzech mutacji. Zgodnie z ADR p.15.7/p.16.6 kolejne odrzucenie w tym obszarze wymaga analizy modelu, nie łatki. Ten defekt należy do kategorii, którą p.16.6 uznał za zamkniętą, więc jest sprawą architekta.

### 14.4 Defekty etapu 7g

**N-P13-8 (WYSOKI, BLOKUJĄCY): zapis nie jest warunkowany rewizją (brak CAS) w `handleDELETE`, `handleGET`-ghost i `handlePUT`.**
- **Kroki**: sonda 14.2 P3 (DELETE), P4 (GET), P5 (PUT); reprodukcja: współbieżne żądanie wstrzyknięte między SELECT a UPDATE (opakowanie `client.execute`).
- **Oczekiwany**: żaden zapis nie nadpisuje wiersza, którego rewizja zmieniła się od odczytu; w takim przypadku 409 z aktualnym stanem albo ponowny odczyt.
- **Faktyczny**: DELETE i GET wygaszają świeżo zapisaną sesję drugiego urządzenia (utrata aktywnego treningu, cicha, bez 409); PUT nadpisuje edycję drugiego urządzenia (utrata danych w treningu).
- **Dotkliwość**: WYSOKA (utrata danych trwającego treningu). **Prawdopodobieństwo**: NISKIE–ŚREDNIE (okno = czas między dwoma zapytaniami do bazy w jednym żądaniu, dziesiątki ms; realne przy równoczesnym `pagehide`/`visibilitychange` na jednym urządzeniu i `PUT` z drugiego).
- **Podejrzany moduł**: `app/api/active-workout-session/route.ts`: `clearRow` (`where(eq(userId))` bez rewizji), `handlePUT` (UPDATE bez `revision = serverRevision` w warunku), `handleDELETE`/`handleGET` (sprawdzenie na wyniku SELECT).
- **Sugerowany kierunek (do architekta, nie do testera)**: warunkowy UPDATE `WHERE user_id = ? AND revision = ?` z rewizją z SELECT; przy zero zmienionych wierszach ponowny odczyt i 409 z aktualnym wierszem; ścieżka bez wiersza (INSERT): konflikt klucza głównego traktowany jak 409. Warunek równości zamiast `<` usuwa też P2. Alternatywnie transakcja libsql; CAS jest prostszy.
- **Kierowanie**: `architekt` (decyzja: CAS + równość; korekta/uzupełnienie ADR 0004 p.16 i ocena p.16.6), potem `backend` (implementacja + test współbieżności z wstrzyknięciem zapisu między SELECT a UPDATE, wzorzec sondy 14.2). `frontend` bez zmian.

**N-7g-1 (ŚREDNI): regresja testu e2e `e2e/active-workout.spec.ts:105` (`loginAndClearSession`).** Wywołuje `page.request.delete("/api/active-workout-session")` BEZ ciała. Po naprawie 5f serwer zwraca 400 (`Nieprawidłowy JSON`, zgodnie z testem "DELETE bez ciała → 400" w `route.test.ts`), więc `expect(del.ok())` padnie. Playwright nie uruchamiany (wymaga serwera i konta testowego); ocena statyczna i zachowanie potwierdzone testem jednostkowym. Kierowanie: `frontend`/`tester`: poprawić helper (odczyt rewizji przez GET i ciało `{ revision }`, albo czyszczenie stanu inną drogą). Naprawić przed etapem 9.

**N-7g-2 (NISKI): `deleteCloud` przy 409 bez `session` (rekord nieparsowalny) zwraca `{ ok: false }` bez `conflict`.** W `push()` gałąź `!result.ok && !result.conflict` zeruje `clearedPushedRef` i ponawia: przy uszkodzonym wierszu DELETE będzie ponawiany co tick (8 s). Nie jest to utrata danych, tylko ruch sieciowy. Backlog, właściciel `frontend`.

### 14.5 Ryzyka resztkowe

- Wyścig dwóch kart na tym samym urządzeniu (wspólny `localStorage`) jest poza zakresem tej rodziny (ADR p.15.7) i nieobjęty tą oceną.
- Współbieżność nie była testowana na prawdziwym Turso; sonda w pamięci z wstrzykniętym wyścigiem. Częstość w produkcji nieoszacowana ilościowo.
- `npm run test:e2e` i `npm run deploy:check` nie uruchomione w tym etapie (zob. N-7g-1; `deploy:check` wymagany przed merge).

### 14.6 Wyniki poleceń (etap 7g)

- `npx vitest run app/api/active-workout-session lib/active-workout-cloud`: 3 pliki, **48/48 PASS**.
- `npm test` (pełny): 145 plików, 144 OK; 1 plik FAIL `lib/android-version.test.ts` (2 testy, dryf numeru wersji APK), **pre-existing**, nie dotknięty tym diffem (ten sam stan co w 7f/5f).
- `npx tsc --noEmit`: **exit 0**.
- `npm run lint`: 142 problemy (104 errors, 38 warnings), **baseline bez zmian** względem 5f. Pliki 005 (`app/api/active-workout-session/*`, `lib/active-workout-cloud*`, `components/active-workout/active-workout-cloud-sync.tsx`): **0 problemów**.

### 14.7 Werdykt etapu 7g (tester)

**ODRZUCONE.**

- Naprawa N-P13-7 (DELETE wymaga rewizji, 409 bez mutacji): **działa** (P1 PASS, testy repo PASS, tsc/lint bez nowych problemów).
- Argument kompletności ADR p.16.6: **obalony**. Sprawdzenie rewizji nie jest atomowe z zapisem, więc cicha utrata aktywnej sesji (N-P13-8, WYSOKI) pozostaje możliwa w DELETE, GET-ghost i PUT. To nie jest kolejny punktowy przypadek, lecz brak własności, na której p.16.6 się opiera.
- Blokuje etapy 8 i 9. Zadanie wraca do etapu 3 (architekt: CAS/równość, ocena p.16.6), potem 5 (backend: implementacja + test współbieżności), potem 7g ponownie (tester: powtórka sond P2-P5 i P1).
- Dodatkowo przed etapem 9: N-7g-1 (e2e, ŚREDNI). N-7g-2 (NISKI) do backlogu.

---

## 15. Weryfikacja naprawy N-P13-8 — atomowy zapis przez CAS (tester, etap 7h, 2026-10-25)

**Odpowiedź wprost na pytanie koordynatora:** zadanie 005 jest gotowe do etapu 8 (przegląd wizualny, ux) i etapu 9 (bezpieczeństwo/wydajność) — naprawa N-P13-8 działa zgodnie z ADR 0004 p.17 we wszystkich trzech mutacjach. Przed **Promote** (nie przed etapami 8 i 9) pozostają dwa pozycje wagi ważny, które wymagają decyzji architekta (N-7h-1, N-7h-2), oraz trzy pozycje niskie do backlogu. Dziewiąty wariant istnieje, ale należy do innej klasy (cykl życia wiersza i deduplikacja bez kontroli treści), nie do SELECT-then-UPDATE.

### 15.1 Zakres i metoda

- Przeczytane: ADR 0004 p.17 (w całości), `app/api/active-workout-session/route.ts` (cały plik), blok „CAS / wyścig między SELECT i UPDATE” w `route.test.ts`, karta 005 wiersz 5g.
- Sonda niezależna od testów backendu (plik tymczasowy `app/api/active-workout-session/zz-probe-n-p13-8.test.ts`, usunięty po przebiegu, nie zostawiony w repo). Mechanizm inny niż w `route.test.ts`: wrapper `client.execute` uzbrojony PRZED wywołaniem handlera; po PIERWSZYM SELECT na `active_workout_sessions` (handler dostaje nieaktualny odczyt) uruchamiane jest pełne, konkurencyjne żądanie innego urządzenia; dopiero potem handler wykonuje swój UPDATE/INSERT. Poprawność wstrzyknięcia potwierdzona faktem, że przegrane odpowiedzi to 409 zwracane wyłącznie ścieżką CAS (przy sekwencyjnym wykonaniu te same żądania dają 200).
- Dodatkowe sondy wykraczające poza P3-P5 (E1-E5) na tym samym mechanizmie.
- Nie powtarzano P2 niezależnie: jednostronność `>=` jest niezmieniona w kodzie (`handlePUT`/`handleDELETE`, warunek `clientRevision < serverRevision`) i pilnowana testem backendu „kontrola P2”, który przechodzi.

### 15.2 Wyniki sond

| Sonda | Scenariusz | Oczekiwany | Faktyczny | Werdykt |
|---|---|---|---|---|
| P3 | DELETE A `{rev 1}`; w oknie PUT B `{rev 1}` z S3 | A: 409, `conflict.session` = S3 rev 2 (device B); wiersz S3 nietknięty | 409, rev 2, device B, payload S3 (`operationId` s3, `workoutStartedAtMs` 3000) | **PASS** |
| P4 | GET-ghost (`updated_at` −48 h, rev 1); w oknie PUT A `{rev 1}` z S-new | `session` = S-new rev 2; brak tombstone | `session` S-new rev 2; wiersz S-new rev 2, `workoutStartedAtMs` 9500 | **PASS** |
| P5 | PUT A `{rev 1}` (A-edit); w oknie PUT B `{rev 1}` (B-edit) | A: 409 z B-edit rev 2; B-edit nietknięty | 409, rev 2, `title` B-edit; wiersz B-edit | **PASS** |
| E1 | GET-ghost; w oknie DWA kolejne zapisy (B rev 1→2, C rev 2→3) | `session` = C rev 3; brak drugiego czyszczenia | `session` C rev 3; wiersz rev 3 | **PASS** |
| E2 | GET-ghost; w oknie DELETE B (tombstone) | `session` = null; tombstone rev 2 z tożsamością wygaszonej sesji | `session` null; rev 2; `clearedSessionStartedAtMs` 4444 | **PASS** |
| E3 | Dwa pierwsze PUT (INSERT); B wstawia w oknie A | A: 409 (nie 500); jeden wiersz, B-first | 409 z `conflict.session` B-first rev 1; jeden wiersz | **PASS** (patrz N-7h-5) |
| E4 | PUT A `{rev 1}`; w oknie DELETE B | A: 409 z tombstone (`clearedSessionStartedAtMs` 1234), rev 2; brak nadpisania | 409, `clearedSessionStartedAtMs` 1234, rev 2 | **PASS** |
| E5 | Retencja: tombstone S1 (`cleared` 1000) fizycznie usunięty (jak `purgeBatched` w `lib/db-retention.ts`); stale B `PUT {rev 1}` z S1 | Zgodnie z ADR p.12 („wiersz nigdy nie usuwany fizycznie”): brak wiersza nie może wskrzesić zakończonej sesji; oczekiwane co najmniej 409 lub brak sesji | **200**, rev 2, S1 wraca jako AKTYWNA (`GET` zwraca S1 z `device` B) | **FAIL — defekt N-7h-1 (ważny)** |

Wynik zbiorczy sond P3-P5 i E1-E4: **7/7 zgodnie z oczekiwaniem** (sonda E5 wykazała defekt niezwiązany z CAS, patrz 15.4). Wszystkie wykonane sondy wymagały odpowiedzi zwracanych tylko przez gałąź CAS, więc test rzeczywiście obejmował okno wyścigu.

### 15.3 Głębokość retry w `handleGET` (`evaluateActiveRow` / `retryFreshRead`)

Pytanie: czy scenariusz z DWIEMA kolejnymi przegranymi CAS pod rząd wymaga głębszego retry?

**Odpowiedź: nie — w GET takie łańcuchy są niemożliwe z konstrukcji, a retry=1 jest wystarczający.**
- Jedyny zapis w `GET` to `clearRow` i wykonuje się wyłącznie w gałęziach `allowClear === true` (payload nieparsowalny, payload aktywny i przeterminowany).
- Po przegranej CAS wywoływane jest `retryFreshRead`, które robi zwykły `SELECT` i ocenę z `allowClear: false`. W tej ocenie żadna gałąź nie wywołuje `clearRow` (warunki `if (allowClear)` w obu miejscach), więc druga przegrana CAS w tym samym żądaniu nie może wystąpić: nie ma drugiego CAS do przegrania.
- Odczyt po przegranej jest tylko odczytem; może być nieaktualny względem następnego zapisu innego urządzenia, ale to jest nieodłączna właściwość każdego GET (odpowiedź to stan w chwili odczytu) i nie prowadzi do utraty danych.
- Jedyny skutek brzegowy: gdyby świeży wiersz miał przeterminowany aktywny payload (możliwe tylko przy rozjeździe zegarów, bo zapisy ustawiają `updatedAt = now`), GET zwróci `session: null` bez czyszczenia; kolejny GET wygasi wiersz. To jest bezpieczne (brak utraty danych), nie wymaga backlogu.
- Dla DELETE i PUT nie ma retry w ogóle (409 od razu), co jest zgodne z ADR p.17.7.
- Wniosek: **retry=1 wystarcza, nie ma scenariusza wymagającego głębszego retry, pozycja backlogu niepotrzebna.** Dowód: E1 (dwa zapisy w oknie) zakończył się poprawnie bez drugiego czyszczenia.

### 15.4 Dziewiąty wariant — inna kategoria (wynik przeszukania)

Kategorie sprawdzone poza SELECT-then-UPDATE w aktywnej sesji:

1. **Cykl życia wiersza (retencja) — NOWY defekt N-7h-1 (ważny).** `lib/db-retention.ts` (`purgeBatched`, `activeWorkoutSessionsDays`, domyślnie 7 dni) fizycznie usuwa wiersze `active_workout_sessions` z `updated_at` starszym niż cutoff; uruchamiane z `app/api/cron/cleanup/route.ts` i `app/api/admin/maintenance/cleanup/route.ts`. Tymczasem ADR 0004 p.12 i p.17 zakładają, że wiersz NIGDY nie jest usuwany fizycznie, a tożsamość wygaszonej sesji (tombstone, p.14) żyje w tym wierszu. Po purge brak tombstone'u, więc urządzenie, które było offline więcej niż 7 dni i nadal trzyma lokalnie już zakończoną sesję, przy `PUT` z dowolną rewizją dostaje `INSERT` i sesja wraca jako aktywna (sonda E5: 200, S1 aktywna). Skutki: zakończony trening „wraca” na innym urządzeniu (klasa N-P13-1), a kolejne wznowienie i zakończenie trafia w deduplikację (N-7h-2). Prawdopodobieństwo: niskie (wymaga >7 dni offline z otwartą sesją, której drugie urządzenie już nie wygasiło — tj. brak DELETE dotarł). Dotkliwość: wysoka (wskrzeszenie zakończonego treningu, ryzyko cichej utraty dopisanych serii). Właściciel: `architekt` (decyzja: tombstone wyłączony z purge, albo purge tylko payloadów aktywnych; korekta ADR p.12 i p.17.12), potem `backend`.
2. **Deduplikacja bez kontroli treści — N-7h-2 (ważny).** `app/api/workouts/complete/route.ts` (`handlePOST`, dedup przed INSERT, linie 446-461; `respondWithExistingWorkout`, linie 321-349) przy tym samym `operationId` zwraca `ok: true, duplicate: true` ze starym wierszem i NIE porównuje treści `exercises`. Klucz jest deterministyczny (`workoutPlanId` + `startedAt`, ADR p.13), więc ten sam klucz dostaje się do sesji wznowionej z chmury po zgubionym DELETE (zamknięcie karty w ciągu ~8 s po zakończeniu). Jeśli użytkownik dopisze serie do tak wznowionej sesji i ją zakończy, UI pokaże „Trening zapisany”, a serwer zachowa stary zapis (sety dopisane po wznowieniu giną po cichu). Wada dotyczy kontraktu idempotencji (ten sam klucz, inna treść, sukces zamiast konfliktu). Sam mechanizm „zgubiony DELETE” jest znany (pagehide, backlog), nowe jest to, że serwer nie wykrywa rozjazdu treści. Prawdopodobieństwo: niskie. Dotkliwość: wysoka (cicha utrata). Właściciel: `architekt` (decyzja: porównanie hasha treści w wierszu → 409, albo jawne zwrócenie konfliktu do UI), potem `backend`/`frontend`.
3. **Transakcyjność w handlerze `complete`.** INSERT wiersza i `publishTeamFeedAfterWorkout` nie są w jednej transakcji; feed jest `void` i ma wewnętrzny `try/catch` (`lib/community/team-feed-auto.ts:177`). Gdy publikacja padnie po INSERT, wpis w feedzie zostaje pominięty bez ponowienia, bo ponowienie trafia w dedup (`duplicate: true`, bez publikacji). Dotkliwość niska (brak wpisu w feedzie, nie utrata danych treningu). **N-7h-4 (niski, backlog, `backend`).**
4. **Cardio PATCH — RMW bez CAS (ta sama klasa co SELECT-then-UPDATE, ale poza `activeWorkoutSessions`).** `app/api/workouts/[workoutId]/cardio/route.ts`: `SELECT exercises` (linia 95) → obliczenie JSON → `UPDATE ... WHERE id AND userId` bez warunku na `exercises` (linia 118). Równoległe zapisy `workouts.exercises` z `actions/workout-history.ts:199`, `actions/cardio.ts:291,361`, `actions/workout-plan.ts:101` mogą zostać nadpisane przez stary odczyt. Okno: milisekundy, tylko własne dane użytkownika (jedno konto). ADR p.2 twierdzi „jedna transakcja chroni spójność” — to nie chroni przed nieaktualnym odczytem `exercises`. **N-7h-3 (niski, backlog, `backend`).** Uwaga do komunikacji: twierdzenie ADR p.17.9 „zamknięta kategoria” dotyczy wyłącznie `activeWorkoutSessions`.
5. **Klient (`active-workout-cloud-sync.tsx`) bez CAS, w tym `pagehide`, dwie karty.** Znane pozycje backlogu (zgodnie z zleceniem), nie szukano nowych ustaleń; obserwacja N-7h-2 dotyka ich od strony serwera.
6. **Pozostałe pliki z SELECT-then-UPDATE** (`hof.ts`, `team-quests.ts`, `team-wars.ts`, `progression.ts`, `teams.ts`, `meal-catalog-images.ts`, `app-settings.ts`): dług odnotowany w ADR p.17.9, poza zakresem tego zadania; nie oceniano.

### 15.5 Stan defektów (etap 7h)

| # | Waga | Opis | Właściciel | Blokuje |
|---|---|---|---|---|
| N-7h-1 | ważny | Purge retencji (`lib/db-retention.ts`) fizycznie usuwa tombstone; stale urządzenie wskrzesza zakończoną sesję (sonda E5: 200) | architekt → backend | Promote (nie etapy 8, 9) |
| N-7h-2 | ważny | Deduplikacja `complete` ignoruje treść: wznowiona po zgubionym DELETE sesja zakończona z nowymi seriami zapisuje tylko stary zapis, `ok: true` | architekt → backend, frontend | Promote (nie etapy 8, 9) |
| N-7h-3 | niski | Cardio PATCH: RMW `exercises` bez CAS (okno ms, własne dane) | backend | backlog |
| N-7h-4 | niski | Publikacja feedu po INSERT bez ponowienia (dedup nie publikuje ponownie) | backend | backlog |
| N-7h-5 | niski | `isUniqueViolation` rozpoznaje wyłącznie komunikat „UNIQUE constraint failed” (`db/errors.ts`); potwierdzone w libsql `:memory:`, nie potwierdzone na Turso/Hrana | backend | backlog (weryfikacja na Turso) |

Pozycje z zakresu 7b/7c (licznik, odmiana, format) i N-7g-1 (e2e `loginAndClearSession` bez ciała) — bez zmian w tym etapie; N-7g-1 wciąż wymaga naprawy przed etapem 9 (zgodnie z 14.7).

### 15.6 Wyniki poleceń (etap 7h)

- `npm test` (pełny, po usunięciu sondy): 145 plików, 144 OK; 1121 testów: **1119 OK**, 2 niezaliczone — pre-istniejące `lib/android-version.test.ts` (D-15, dryf numeru wersji APK, plik niedotknięty tym diffem). Blok CAS w `route.test.ts`: 5 testów zielone; cały plik 23/23.
- `npx tsc --noEmit`: **exit 0**.
- `npm run lint`: 142 problemy (104 errors, 38 warnings) = **baseline bez zmian**; `npx eslint` na sześciu dotkniętych plikach 005 (`app/api/active-workout-session/*`, `lib/active-workout-cloud*.ts`, `components/active-workout/active-workout-cloud-sync.tsx`): **0 problemów**.
- `npm run test:e2e`: NIEWYKONANE (brak `E2E_EMAIL`/`E2E_PASSWORD`, D-07 — jak w 7b).
- `npm run deploy:check`: NIEWYKONANE w tym etapie (wymagane przed merge).

### 15.7 Werdykt etapu 7h

**ZATWIERDZONE** — dla zakresu etapu, czyli naprawy N-P13-8 (ADR 0004 p.17): trzy mutacje (`clearRow`, `handlePUT` UPDATE, `handlePUT` INSERT) są atomowe przez CAS; P3, P4, P5 i E1-E4 przechodzą na niezależnej sondzie; głębokość retry 1 wystarcza (15.3); testy, tsc i lint bez nowych regresji.

Zastrzeżenia (nie zmieniają werdyktu 7h, ale blokują **Promote**, nie etapy 8 i 9):
- N-7h-1 i N-7h-2 (ważne) wymagają decyzji architekta przed Promote. Wykraczają poza kategorię CAS, więc nie są wariantem „ósmej rundy” tej samej klasy: to cykl życia wiersza i idempotencja bez kontroli treści. Rekomendacja dla architekta: nowy krótki dodatek ADR (p.18), a nie kolejna łatka w `route.ts`.
- ADR p.17.12 zakłada zamknięcie rodziny „mutacja bez atomowego dowodu”; prawda jest węższa — zamknięta jest atomowość zapisu w `activeWorkoutSessions`, nie cały cykl życia wiersza i nie deduplikacja `complete`.

Rekomendacja koordynatora: etap 8 (ux, przegląd wizualny) i etap 9 (tester-bezpieczenstwa — wejście: N-7h-1, N-7h-2, N-7g-1; tester-wydajnosci — bez nowych zapytań poza opisanymi) mogą ruszyć równolegle. Przed Promote: rozstrzygnięcie N-7h-1 i N-7h-2, `npm run deploy:check`, E2E (D-07/N-7g-1) z kontem testowym.
