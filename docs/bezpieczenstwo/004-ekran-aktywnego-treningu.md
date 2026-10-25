# 004 — Ekran aktywnego treningu: bezpieczeństwo (etap 9)

Karta: `docs/zadania/004-ekran-aktywnego-treningu.md`. Agent: `tester-bezpieczenstwa`. Ocena statyczna (bez uruchomienia lokalnej instancji z bazą) — patrz sekcja „Nie testowano” na końcu.

## Werdykt: ODRZUCONE

Blokuje V-1 (wysoka). Zmiany samego zadania 004 (komponenty UI) nie wprowadzają podatności krytycznych/wysokich. V-1 jest luką sprzed 004 w `lib/ghost-training/*` i `app/api/ghost-training/*`, ale jest osiągalna z przebudowanego ekranu treningu (plakietka Ghost), więc blokuje wydanie tego zadania wg zasad przepływu (podatności krytyczne i wysokie blokują wydanie).

## V-1 (wysoka, CWE-639 / OWASP A01 BOLA) — Ghost: nieznany `kind` omija autoryzację danych treningowych

- **Miejsca**: `app/api/ghost-training/timeline/route.ts:13` (`kind` rzutowane przez `as`, bez walidacji), `:16-21`. `lib/ghost-training/targets.ts:118-146` (sprawdzenia tylko dla `self`, `friend`, `leader`, brak domyślnej odmowy), `:148-154` (zapytanie po `workouts.id` + `workouts.userId`).
- **Wpływ**: zalogowany użytkownik odczyta nazwy ćwiczeń, ciężary, powtórzenia i daty cudzego treningu, jeśli zna `userId` i `workoutId`. Dane treningowe są wrażliwe. Warunek: znajomość obu ID (UUID z `db/schema.ts:267-270`, nie do zgadnięcia), CVSS 3.1 `AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:N/A:N` ≈ 5.9–6.5. Oceniono jako wysoką przez brak domyślnej odmowy i wrażliwość danych.
- **Pochodzenie**: sprzed 004 (`lib/ghost-training/*` i `app/api/ghost-training/*` nie zmienione w 004). Route zyskał tylko `withApiErrors`. Ekran 004 wywołuje to API (`ghost-picker-sheet.tsx:93`).
- **Odtworzenie** (lokalnie, dwóch użytkowników syntetycznych): zaloguj B, wywołaj `GET /api/ghost-training/timeline?kind=x&userId=<A>&workoutId=<wA>`. Oczekiwane 403, obecnie 200 z osią czasu A.
- **Poprawka (backend)**: zod enum `kind` (`self|friend|leader`) w route i na początku `loadGhostTimelineForTarget`, odmowa dla każdej wartości spoza listy (domyślnie odmów).
- **Retest**: test jednostkowy (`kind` spoza listy zwraca `null`, także z istniejącym `workoutId`), plus powtórzenie odtworzenia na localhost.

## V-2 (średnia, LR-3 / integralność danych, wprowadzona przez 004) — wartość początkowa utrwalona jako dana serii i wraca do sugestii

- **Miejsca**: `components/active-workout/guided-session-layout.tsx:235-251` (`flushDraft` zapisuje wartości szkicu, także wstępnie wypełnione, z `done: set.done` = false). Wywołania: `onBlur` (`:544`, `:583`), ☰ (`:452-455`), przejście między seriami (`:271-275`), `goPrev`, `deferExercise`. Każde wywołanie idzie przez `patchSet` (`active-workout-view.tsx:668`), czyli debounced push do chmury.
- **Następnie**: `app/api/workouts/complete/route.ts:290,376` zapisuje `exercises` bez filtrowania; `lib/workout-plan-compare.ts:215-218` przepuszcza je bez zmian. Zakończenie treningu z niewykonaną serią utrwala jej wartość.
- **Odczyt bez filtra `done`**: `lib/last-workout-hints.ts:410-412` (`lastSessionSets`), `:414-416` (`workingHist`, filtr tylko `weight>0` i `reps>0`), `:426-427` (sugestia). Wpływ: „Ostatnio” i chip sugestii pokazują wartość z serii nigdy niewykonanej, a silnik progresji z niej korzysta. Może to się samowzmacniać przy kolejnych treningach.
- Raporty (`progress-hub`, `home-stats`, `workout-history`) filtrują `done`, więc wpływ ogranicza się do sugestii i „Ostatnio”.
- **Poprawka**: (a) filtr `done` w `workingHist` i w `lastSessionSets` dla sugestii (wspólna funkcja); (b) `flushDraft` zapisuje tylko pola zmienione przez użytkownika albo nie utrwala wartości z sugestii dla serii niezapisanej (wariant L-1 z ADR 0003); (c) rozważyć odrzucenie niezaliczonych serii z `weight>0` przy zakończeniu.
- **Retest**: test regresji (seria niezapisana z wartością początkową nie wpływa na `lastSessionSets` ani sugestię; wejście na serię i ☰ nie zmieniają `workouts.exercises` poza zmianami użytkownika).
- Nie blokuje wydania wg zasad (średnia), ale narusza sens LR-3. Zalecana naprawa przed merge.

## V-3 (niska, CWE-79 obrona w głąb, self-XSS, pochodzenie sprzed 004) — `techniqueYoutubeUrl` w `href` bez walidacji przy renderze

- **Miejsca**: `guided-session-layout.tsx:370` (`trim()` bez walidacji), `:477-482` (`href={techniqueUrl}`). Źródło: `lib/start-workout-session.ts:46` (tylko `trim`). `actions/workout-plan.ts:187,210` zapisuje `JSON.stringify(plan)` bez normalizacji. Odczyt planu normalizuje (`actions/workout-plan.ts:65`, `lib/workout-plan-utils.ts:36-38`), a przywracanie sesji z chmury nie.
- **Wpływ**: `javascript:` w linku technicznym to wyłącznie self-XSS, bo dane są własne. Brak ścieżki do cudzego konta.
- **Poprawka**: przed `href` użyć `isAllowedYoutubeUrl` (`lib/youtube-url.ts`); opcjonalnie normalizować w `saveWorkoutPlan`.

## Uwagi niskie (poza zakresem blokad)

- N-1: „Usuń ostatnią serię” w menu (`session-menu-sheet.tsx:163-167`, `active-workout-view.tsx:874-875`, `lib/stores/active-workout.ts:148-158`) usuwa też zapisaną serię bez potwierdzenia. Element sprzed 004. Właściciel: frontend/ux.
- N-2 (LR-4, do prawnika i ux): nowa treść w `lib/live-set-coach.ts` („Jeden słabszy set to jeszcze nie problem”) zawiera „słabszy”, blisko zakazanego „słabo”.
- N-3 (łańcuch dostaw): `package-lock.json` w commicie `0a3214f` podbija `zod` 4.3.6 → 4.6.7 bez zmiany `package.json`. Nie jest częścią 004. Wymaga sprawdzenia pochodzenia. Osobno, na poziomie gałęzi (commity „huj”, nie 004): zmiany `package.json` (usunięto `xlsx`; dodano `fflate`, `saxes`, `web-push`; `nodemailer` 10 z `overrides`; `next` 16.4.2). Nieocenione tutaj — do przekazania `tester-bezpieczenstwa` na poziomie gałęzi.
- N-4: zakres dostępu lidera w Ghost (U-1, `targets.ts:128-145`) bez flagi udostępniania. Znane z `prawnik`, poza 004.

## Sprawdzone bez uwag

- Ghost plakietka i panel: `sourceLabel` anonimizuje rywala (`targets.ts:159-164`). `ghostExerciseName` i etykiety były w bazie. Aria-label „Twój trening zapisuje się normalnie” zgodna z prawdą.
- Walidacja pól: `parseWeightInput`/`parseRepsInput`/`clampWeight`/`clampReps` (`lib/workout-set-draft.ts:19-45`) odrzucają nieskończoność i NaN, przycinają 0..999 i 0..99. React escapuje tekst. Brak `innerHTML`/`dangerouslySetInnerHTML`/`eval` w zakresie 004.
- Mailto „Zgłoś problem” (`guided-session-layout.tsx:435-442`): stały adres, `encodeURIComponent`, akcja inicjowana przez użytkownika. Odziedziczone z bazy.
- CSS (`app/globals.css`): brak `url()`/`@import`/zewnętrznych zasobów w diffie.
- Wpis changelog: `planned: true` i `sourceRepo` w 004.
- LR-1: brak `console.*`, Sentry, PostHog w plikach 004. Komunikaty walidacji są stałymi bez wartości.
- LR-9: brak nowych `fetch` i kluczy storage poza już istniejącymi w bazie.
- Pakiety (poza N-3): 004 nie dodało żadnego pakietu.
- Sekrety: brak w plikach 004. E2E czyta `E2E_EMAIL`/`E2E_PASSWORD` ze zmiennych środowiskowych.

## Nie testowano / ryzyka resztkowe

- Brak testów dynamicznych V-1, V-2, V-3 (nie uruchomiono lokalnej instancji z bazą). Ocena V-1 oparta na analizie kodu z numerami linii.
- Nie przeglądano pełnego kodu `lib/ghost-training/deltas.ts` i `buildGhostTimeline` pod kątem dalszych wycieków.
- Nie sprawdzono `set-pills.tsx`, `session-chrome.tsx`, `rir-picker.tsx`, `session-segmented-progress.tsx` pod kątem sinków (grep bez trafień).
- Nie uruchomiono `npm audit` ani semgrep (poza zakresem tego etapu).

## Retest po poprawkach

V-1 obowiązkowo przed wydaniem (backend, test jednostkowy + lokalne odtworzenie). V-2 i V-3 do potwierdzenia testami regresji.

## Retest (2026-10-25, tester-bezpieczenstwa)

**Werdykt retestu: ZATWIERDZONE Z UWAGAMI.** Blokada V-1 zamknięta. V-2 zamknięta w zakresie sugestii i „Ostatnio”, z pozostałością niskiego ryzyka (RT-2). V-3 nadal otwarta, niska, w backlogu.

### V-1 — ZAMKNIĘTA
- **Route** (`app/api/ghost-training/timeline/route.ts:7,16-25`): `rawKind` z `searchParams.get` (zawsze string albo `null`; tablica parametrów nieosiągalna, `get` zwraca pierwszą wartość). Kolejność: `auth()` → brak `kind`/`userId`/`workoutId` (400, obejmuje `""` i `null`) → `ghostKindSchema.safeParse` (400 dla wartości spoza `self|friend|leader`) → dopiero `loadGhostTimelineForTarget`. Walidacja jest przed jakimkolwiek dostępem do danych. Brak luki dla pustego, `null`, innego typu niż string (typ jest zawsze string z URL).
- **Targets** (`lib/ghost-training/targets.ts:117-125`): wczesna gałąź `kind` spoza trójki zwraca `null` przed `ensureCriticalSchema()` i przed jakimkolwiek zapytaniem. Gałęzie `self`/`friend`/`else` (leader) są po jawnym sprawdzeniu, więc `else` obejmuje wyłącznie `leader`.
- **Testy**: `npx vitest run lib/ghost-training/targets.test.ts` — 2/2 zielone. Scenariusze odpowiadają odtworzeniu z raportu (`kind:"x"` i `kind:""`, `userId` innego konta, `workoutId` istniejący). Test nie mockuje bazy, więc wynik `null` dowodzi, że guard działa przed dostępem do danych (bez zapytania nie ma czego zwrócić).
- **Ograniczenie retestu**: nie wykonano dynamicznego odtworzenia HTTP na lokalnej instancji z seedowaną bazą (brak uruchomionej instancji w tej sesji). Ocena dynamiczna oparta na kodzie route i teście jednostkowym warstwy `targets.ts`. Zalecane dopisanie testu route (401/400/403) do backlogu testów.

### V-2 — ZAMKNIĘTA dla sugestii i „Ostatnio”, RT-2 (niska) otwarta
- **Dowód różnicy** (tymczasowy test porównawczy na wersji z `HEAD` i nowej, pliki usunięte po teście): dla historii `[10×36 done, 10×36 done, 20×999 niezapisana]` stara wersja dawała sugestię `[999, 36]` (wartość niezapisanej serii wracała do chipa), nowa `[36, 36]`. „Ostatnio” (`lastSessionSets`) w obu wersjach pokazuje tylko zaliczone serie.
- **Test regresji** (`lib/last-workout-hints.test.ts`, „V-2: niezapisana wartość…”): przechodzi. Uwaga jakościowa: asercja na `lastSessionSets` (`weight !== 999`) nie rozróżnia starej i nowej wersji (stara też nie wstawia 999, bo długość historii jest mniejsza niż lista serii). Rozróżnia ją dopiero asercja na `suggestedWeights` `[36,36]`. Test jest poprawny, ale pierwsza asercja nie wnosi dowodu; zalecane wzmocnienie (backlog, niski).
- **Regresja zwykłego treningu**: 12/12 testów w `lib/last-workout-hints.test.ts` zielonych, w tym przypadki z pełnie zapisanymi seriami (`done:true`): chip +kg z dwóch treningów na górze zakresu, hold przy jednym treningu, RIR twardy, krok maszyny, ćwiczenie bez historii. Filtr `isCompletedWorkoutSet` nie zmienia wyniku dla serii z `done:true`, `reps>0` i ciężarem `>0`.
- **RT-2 (niska, nowa, pozostałość V-2)**: `mergeHintsIntoExercises` nadal przepisuje `reps`/`rpe`/`rir` z NIEZAPISANEJ serii historii do pustych pól nowej sesji (`lib/last-workout-hints.ts:470-478`, używa surowego `h.sets[i]`). Dowód: historia z jedną niezapisaną serią `20 powt.` daje w nowej sesji `reps: 20` na tej pozycji (ciężar zostaje 0). Wartość pochodzi z własnego konta i nie trafia do sugestii ani „Ostatnio”, ale jest to ta sama klasa („wartość niezapisana wraca”). Zalecenie: w `mergeHintsIntoExercises` dla prefillu użyć `completedHistSets` albo jawnie udokumentować prefill jako podpowiedź. Właściciel: backend, priorytet niski, nie blokuje.
- **Poza zakresem retestu**: poprawka (b) z pierwotnego raportu (`flushDraft` nie utrwala wartości z sugestii dla serii niezapisanej w `workouts.exercises`) nie została wdrożona. Dane w chmurze nadal mogą zawierać wartości niezaliczonych serii, ale nie wpływają już na sugestię ani „Ostatnio”. Ryzyko resztkowe LR-3 (integralność danych) zapisane w backlogu jako L-1 karty.

### V-3 — bez zmian (niska, backlog)
- Nie weryfikowano w retestcie (poza zakresem poprawek). `techniqueYoutubeUrl` nadal bez `isAllowedYoutubeUrl` przed `href`. Wpływ: self-XSS, bez ścieżki do cudzego konta.

### Kontrole jakości
- `npx tsc --noEmit`: exit 0, bez błędów.
- `npx eslint` na: `app/api/ghost-training/timeline/route.ts`, `lib/ghost-training/targets.ts`, `lib/ghost-training/targets.test.ts`, `lib/last-workout-hints.ts`, `lib/last-workout-hints.test.ts`: bez uwag.
- `npx vitest run lib/ghost-training/targets.test.ts lib/last-workout-hints.test.ts`: 14/14 zielonych.
- Nie zmieniono kodu ani karty zadania. Tymczasowe pliki porównawcze (`lib/zz-old-hints-retest*.ts`) utworzono i usunięto w tej samej sesji.

### Ryzyka resztkowe i zakres nieprzetestowany
- Brak dynamicznego testu HTTP route (401/400/403) na lokalnej instancji z bazą.
- N-3 (łańcuch dostaw, `zod` i zmiany `package.json` na gałęzi) nadal nieocenione na poziomie gałęzi; poza 004, nie blokuje 004 wg zasad (nie jest podatnością krytyczną/wysoką potwierdzoną w 004).
- Brak `npm audit` i semgrep w tym retestcie.
- Mikrokopia i treść powodu sugestii: zatwierdzenie prawnika-człowieka (zgodnie z etapem 8).
