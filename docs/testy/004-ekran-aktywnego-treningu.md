# 004 - Ekran aktywnego treningu: raport testów (etap 7, tester)

Autor: tester. Data: 2026-10-24. Zakres: tylko zadanie 004 (w drzewie są zmiany zadań 001 i 003, nie oceniane). Wejście: karta, analiza (US-1..US-14, BR-1..BR-13; P-1: pominięta = pomarańczowa, ma pierwszeństwo przed BR-2), ADR 0003 (w tym przegląd kodu §11, M-1), spec ux. Spójność wyglądu: przegląd wizualny wykonuje osobno `ux` (etap 8); tu tylko obserwacje.

## 1. Wyniki uruchomień
| Polecenie | Wynik |
|---|---|
| `npx vitest run` (7 plików `lib/` zadania) | 75 testów zielonych (po dopisaniu moich: 80) |
| `npm test` (pełny) | 132 pliki zielone, 1 nieudany: `lib/android-version.test.ts` (2 testy, znane, poza zadaniem). 959 zaliczonych, 2 nieudane. Po dopisaniu testów `npx vitest run lib`: 919 zaliczonych, 2 nieudane (te same) |
| `npx tsc --noEmit` | 0 błędów w plikach zadania. Pierwszy bieg pokazał 3 błędy w `ghost-picker-sheet.tsx` (`TargetsState`, linie 183/188); po zmianie typu w drzewie roboczym (niezatwierdzona) czysto. Zostają tylko znane błędy `docs/wydajnosc/skrypty/001-takeover-batch.bench.ts` (zadanie 001) |
| `eslint` na `components/active-workout`, plikach `lib/` zadania, nowym e2e | 8 błędów `react-hooks/set-state-in-effect` + 1 ostrzeżenie, wszystkie w niezmienionych efektach (`active-workout-view.tsx` 4, `workout-finished-screen.tsx` 3, `active-workout-global-bar.tsx` 1+1), potwierdzone w przeglądzie (ADR §11). Nowe pliki zadania i moje: czyste |
| `npm run deploy:check` | nie uruchamiany (bramka koordynatora przed merge) |
| Nowy e2e `e2e/active-workout.spec.ts` (Playwright, Edge, 390x780 i 360x640) | 12/12 zielonych (po restarcie serwera; jeden bieg miał flake zimnego startu dev: logowanie > 30 s przy pierwszej kompilacji, powtórzony zielony) |

## 2. Środowisko e2e (jednorazowe, bez prawdziwych danych)
Repo ma Playwright (`playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/diet-admin-session.spec.ts`; konto z `E2E_EMAIL`/`E2E_PASSWORD`) ale nie ma seedów ani `.env`. Zrobiłem:
1. Baza tymczasowa `file:` w katalogu scratch (poza repo): `TURSO_DATABASE_URL=file:<scratch>/e2e.db`, `npx drizzle-kit push --force`.
2. Konto testowe `e2e@example.test` (bcrypt, `email_verified_at`, pełny profil: `activity_level` musi być `low|medium|high`, inaczej przekierowanie na `/complete-profile`).
3. `npx next dev -p 3100 -H 127.0.0.1` z `AUTH_SECRET` testowym, `AUTH_TRUST_HOST=true`.
4. Uruchomienie: `E2E_EMAIL=e2e@example.test E2E_PASSWORD=<hasło> E2E_BROWSER_CHANNEL=msedge PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test e2e/active-workout.spec.ts --workers=1`. Przeglądarki Playwrighta nie były zainstalowane (brak `ms-playwright`), więc `E2E_BROWSER_CHANNEL=msedge` (opcjonalna zmienna w spec; bez niej domyślny chromium).
5. Stan sesji treningowej wstrzykiwany do `localStorage["active-workout"]` skryptem `addInitScript` (jednorazowo na kartę), a sesja w chmurze (`/api/active-workout-session`) usuwana przez `DELETE` poza aplikacją (`about:blank`), bo inaczej sesja z poprzedniego testu wygrywa z lokalną (istniejące zachowanie synchronizacji, nie defekt). Zgody cookies ustawiane w `localStorage` (baner zasłania dolny pasek akcji). Dialog „Kontynuuj” (wznowienie) zatwierdzany jak przez użytkownika.
6. Limity: logowanie ma limit 20 prób/15 min na adres (w pamięci procesu); przy wielokrotnych biegach trzeba zrestartować serwer. Spec jest pomijany bez `E2E_EMAIL`/`E2E_PASSWORD`.

Po testach: serwer zatrzymany, baza i `test-results/` poza repo/usunięte.

## 3. Macierz AC -> test / wynik
A = Vitest (`lib/`), E = nowy e2e (`e2e/active-workout.spec.ts`, numer testu w kolejności pliku), R = przegląd kodu, M = test ręczny (sekcja 6). Wynik: OK = zaliczone, LUKA = brak dowodu.

| AC | Dowód | Wynik |
|---|---|---|
| US-1 nagłówek „trening m:ss · seria X/Y”, bez wiersza „A/B serii” | E1 (`seria 1/7`, pasek 0 z 7), A `formatSessionClock(Spoken)` (`active-workout-copy.test.ts`), A `currentOrdinal` po pominięciu (`workout-session-progress.test.ts`), E8 (po pominięciu „seria 3/7”); aria-label sr-only w `session-chrome.tsx` (R) | OK. Zmiana strefy w trakcie: R (czas liczony od startu sesji), brak testu |
| US-2 pasek: segmenty per ćwiczenie, zielone zapisane, grupa zielona, pominięta, edycja nie zmienia | A `buildSessionProgress` (stany, BR-3, 1 i 10 serii, **nowe**: inwariant 200 losowych sesji, 60 serii), E2/E4/E8 (`aria-valuetext` „Zapisano N z 7 serii, pominięto M”), E7 (edycja), R `session-segmented-progress.tsx` (kształt: bieżąca wyższa, pominięta pusta obrys, zaliczone ćwiczenie = ciągła belka) | OK. Szerokość 320 px z 10/60 seriami: tylko M (wizualnie) |
| US-3 nagłówek ćwiczenia, pigułki, wideo | A `formatExerciseSchemeParts` / `formatRepTarget`, E8 (kolory pigułek: zapisana = `--gym-success`, pominięta = `--gym-skipped`, rozwiązane do rgb i porównane), E7 (przełączanie serii pigułką), R (brak linku bez URL: `techniqueUrl ?`); screenshot 360 px: „ĆWICZENIE 1 Z 2”, „3 serie × 6–8 · RIR 1” | OK. Przycisk wideo i etykieta superserii: M |
| US-4 wiersz „ostatnio + sugestia”, kierunek kolorem i ikoną, tap w chip | A `resolveSuggestionDirection` / `buildSetSuggestionView` (up/down/hold, deload `kind=reps`, **nowe**: antysymetria, tolerancja 0,01, NaN/Infinity/0/ujemne), E1 (chip „Sugestia: więcej, 67,5 kg”), E3 („lżej, 62,5 kg” na przerwie), screenshot: zielony chip z strzałką | OK. Kontrast zieleni i czerwieni (R-4) wymaga pomiaru: M |
| US-5 wartość początkowa, brak „Pomiń serię”, walidacja, steppery | A `resolveInitialSetDraft` (BR-7 źródła 1-5, 61,25 kg), A `resolveWeightAdjustSteps`, A regresja „Pomiń serię” przy podpowiedzi (`active-workout-copy.test.ts`), E1 (pole 67.5, przycisk „Zapisz serię 1”), E3 (seria 2 = 67.5, następne ćwiczenie 62.5), E5 (puste pole bez historii: „Podaj ciężar”) | OK. Klik steppera/szybkich przycisków i granice 0/999: A `clampWeight`; klik w UI: M |
| US-6 powtórzenia, „✓ w celu 6–8”, brak powtórzeń = komunikat | A `formatRepTarget`, A `resolveSetSaveIssue`, E6 („Podaj liczbę powtórzeń”, fokus, brak zapisu), screenshot: „✓ w celu 6–8” | OK |
| US-7 RIR w jednym rzędzie, domyślnie cel, `aria-pressed` | E11 (cel 1 `aria-pressed=true`, 0 = false, 4 przyciski w jednym rzędzie), E12 (360x640: przycisk główny w widoku, RIR nad nim, wysokość 43,99 px = 44 z dokładnością do podpikseli), R `rir-picker.tsx` (brak celu = brak podświetlenia) | OK. Brak celu RIR (`targetRir` null) i „3+” przy 4: R, bez testu (LUKA niska) |
| US-8 „Zapisz serię” zawsze, jedno dotknięcie, walidacja, podwójne tapnięcie, wznowienie | A `primarySetActionLabel`, E1/E2 (zapis jednym dotknięciem -> karta „Zapisano”), E5 (brak zapisu, fokus, `aria-invalid`), E4 (`click()` x2 w jednym zdarzeniu -> 1 seria), E7 („Popraw serię 1”) | OK. Wznowienie po zamknięciu aplikacji: E-setup wznawia z localStorage (dialog „Kontynuuj”), ale bez scenariusza „3 serie zapisane -> reload”: LUKA niska. Offline: M |
| US-9 dolne linki, „Zakończ” w menu, `finishPending`, „Wstecz” wyłączone na 1. serii | E9 (brak „Zakończ” w dolnym rzędzie, „Wstecz” nieaktywne, ☰ -> „Zakończ trening” -> „Trening zrobiony”), E8 („Pomiń” zapisuje pominiętą bez przerwy), R `session-menu-sheet.tsx` („Kończenie…”) | OK. Pozycja „Kończenie…” i „Pomiń” wyłączone po zapisie: R, bez testu |
| US-10 złota estetyka, tokeny | R: brak literałów hex i `emerald-*`/`orange-*` w plikach zadania (grep czysty); screenshot: złoto spójne | OK (R). Kontrast: M |
| US-11 ekran przerwy: karta „Zapisano”, licznik, −15/+30 s, „Zacznij…” | E2 (`role=status`: „67,5 kg × 8”, „RIR 1”), E3 (+30 s: czas rośnie >= 28 s; −15 s: maleje >= 14 s; „Zacznij serię 2/3”, „Zacznij ćwiczenie 2”, „ćwiczenie ✓”), A `buildRestCompletedSet` / `buildRestNextStep`, A `formatClockMmSs` | OK. Wibracja końca przerwy (istnieje `hapticRestEnd`): M (urządzenie). Masa ciała „12 powt.”: nie dotyczy (P-2: zapis wymaga ciężaru > 0) |
| US-12 „NASTĘPNIE” z kolorem sugestii | E3 (sugestia ↑ po łatwej serii, `Następnie · ćwiczenie 2 z 3` z „lżej, 62,5 kg”), A `buildRestNextStep` (inne ćwiczenie, koniec treningu -> `null`) | OK. Komunikat „Koniec treningu” (`WorkoutEndCard`): R, bez testu e2e (LUKA niska) |
| US-13 plakietka Ghost | E10 (plakietka „Ghost: wybierz rywala” w nagłówku, brak „bez zapisu” na ekranie), screenshot | OK. Wybór rywala, „Ghost: vs …”, brak treningu: M (wymaga historii w bazie). Identyczność zapisu z Ghostem i bez (LR-8 c): LUKA (brak testu) |
| US-14 dostępność i prywatność | E5/E6 (`role=alert`, `aria-invalid`), aria-label chipa/pigułek/paska w snapshotach; grep `console.*`/Sentry w nowych plikach: brak | OK. WCAG kontrast, deuteranopia, czytnik ekranu: M |
| M-1 (przegląd, ADR §11) | A `resolveSkippedAfterEdit` (`workout-skipped-sets.test.ts`), E7: zapisana seria -> wyczyść ciężar -> pigułka „pominięta”, pasek „pominięto 1” -> wpisz 72 -> „zapisana: 72 kg”, pasek „Zapisano 1 z 7” | OK: poprawka obecna w drzewie (`resolveSkippedAfterEdit` w `patchSet`), regresji nie ma |
| BR-13 / Z2 brak nowych wywołań sieciowych, bez zmian kontraktu | R (brak nowych `fetch`); e2e: jedyne błędy konsoli to 401 na ekranie logowania i 403 z `POST /api/community/friends/live/presence` (istniejący mechanizm, patrz O-4) | OK |
| Java vs TypeScript | Brak wpływu: ekran klienta, kontrakty bez zmian (`/api/active-workout-session` bez zmian). e2e wykonane na ścieżce TypeScript (brak `JAVA_API_BASE_URL`) | brak wpływu |

## 4. Dopisane testy
- `lib/workout-session-progress.test.ts`: inwariant na 200 deterministycznych losowych sesjach (zapisane + pominięte + otwarte = wszystkie; dokładnie jedna bieżąca; grupa `completed` tylko z zapisanych), skala 60 serii (liczniki, numer bieżącej 32).
- `lib/set-suggestion-view.test.ts`: antysymetria kierunku po zamianie ciężarów (siatka wartości), tolerancja 0,01 kg (65,01 = hold, 65,02 = up), NaN/Infinity/0/ujemne odniesienie/999 kg.
- `e2e/active-workout.spec.ts` (nowy, 12 scenariuszy): nagłówek i pole ciężaru z sugestią; zapis jednym dotknięciem i karta „Zapisano”; przerwa −15/+30 s, „Następnie”, „Zacznij serię/ćwiczenie”, „ćwiczenie ✓”; podwójne tapnięcie; walidacja ciężaru (role=alert, fokus, `aria-invalid`) i powtórzeń; M-1; kolory zapisanej/pominiętej pigułki i brak przerwy po pominięciu; „Zakończ” tylko w ☰; plakietka Ghost; RIR w jednym rzędzie; 360x640. Spec pomija się bez `E2E_EMAIL`/`E2E_PASSWORD`.

## 5. Defekty i obserwacje
Brak defektów blokujących ani średnich w zakresie 004. Przegląd kodu M-1 jest naprawiony.

| ID | Waga | Opis | Kroki / dowód | Moduł | Kierunek |
|---|---|---|---|---|---|
| D-1 | niska | Szybkie dotknięcie „Zapisz serię N” w ciągu 700 ms od poprzedniego zapisu jest ignorowane bez żadnej informacji zwrotnej (`SAVE_TAP_GUARD_MS`). Zamierzone przeciw podwójnemu tapnięciu (US-8), ale użytkownik z wyłączoną przerwą, który zapisze serię i od razu poprawi wartość i zapisze następną, nie dostanie sygnału. To samo co L-2 przeglądu (okno stałe 700 ms zamiast „później z 700 ms lub pierwszego renderu nowej serii”). | e2e: po „Zacznij serię 2” kliknięcie „Zapisz serię 2” w < 700 ms od zapisu serii 1 nie zapisuje (seria 2 zostaje bieżąca; test wymagał `waitForTimeout(800)`). | `components/active-workout/guided-session-layout.tsx:48,333` | frontend (backlog L-2) |
| D-2 | niska (poza 004) | Istniejące specyfikacje e2e są nieaktualne po zmianie formularza logowania (zadanie 001): szukają przycisku „Zaloguj się jako zawodnik”, którego nie ma w `components/` (jest „Zaloguj się”). Dotyczy `e2e/smoke.spec.ts` (testy „start bez sesji…” i „po zalogowaniu”) oraz `e2e/diet-admin-session.spec.ts` (logowanie). Nie uruchomiłem ich pełnie (brak chromium Playwrighta w tej instalacji), stwierdzenie na podstawie `grep` i snapshotu strony logowania. | `grep -rn "jako zawodnik" components app` = 0 trafień; strona logowania ma jeden przycisk „Zaloguj się”. | `e2e/smoke.spec.ts:43,55`, `e2e/diet-admin-session.spec.ts:10` | tester / zadanie 001 |
| O-1 | info | Przyciski RIR mają na ekranie 360x640 wysokość 43,99 px (nominalnie 44, subpiksele). | e2e 12 | `rir-picker.tsx` | bez akcji |
| O-2 | info (do `ux`, etap 8) | 360x640, screenshot: wiersz „Ostatnio ... + sugestia” jest ciasny (3 linie w ~50 px, tekst blisko ramki), na przerwie karta „Następnie” przechodzi pod dolny przycisk (przewijana, poprawnie), powód sugestii ucięty („forma / zmęczenie —”). Do oceny wizualnej. | screenshoty A/B w scratch (poza repo) | `set-suggestion-row.tsx`, `rest-break-screen.tsx` | ux |
| O-3 | info | Każdy zapis serii wywołuje `POST /api/community/friends/live/presence`, który dla konta bez znajomych odpowiada 403 „Brak wzajemnego udostępniania treningu.” i zostaje zalogowany jako błąd w konsoli przeglądarki (`[GymBrat][przeglądarka][403]`). Istniejący mechanizm, nie zmieniany przez 004; do oceny, czy 403 powinno być błędem w logach/Sentry (tester-bezpieczenstwa). | konsola podczas e2e po „Zapisz serię 1” | `app/api/community/friends/live/presence` | backend (poza 004) |

## 6. Braki pokrycia i scenariusze ręczne dla właściciela (Preview, telefon)
Nie dało się zautomatyzować w tym środowisku (brak seedów historii w bazie, brak Androida/WebView, brak sprzętu):
1. Ghost z wybranym rywalem: konto z co najmniej jednym ukończonym treningiem tego planu; wybierz „Ghost: wybierz rywala” -> rywal; plakietka zmienia się na „Ghost: …”, zapis serii działa tak samo (US-13, LR-8 c). Konto bez historii: komunikat „Brak treningu do wyścigu”.
2. Offline: włącz tryb samolotowy w trakcie treningu; zapisz 2 serie (karta „Zapisano”, przerwa działa), wyłącz tryb; sesja synchronizuje się bez komunikatu błędu (BR-13).
3. Dwa urządzenia: zapisz serię na A, otwórz trening na B (dialog „Kontynuuj”), pole ciężaru pokazuje zapisaną wartość; edycja na B nie nadpisuje się wejściem na serię.
4. Android WebView / PWA: cele dotyku >= 44 px, `safe-area` pod przyciskiem „Zapisz serię”, klawiatura numeryczna nie zasłania przycisku, systemowy „wstecz” bez zmian.
5. Wibracja na końcu przerwy (włączony dźwięk), wygaszenie ekranu w trakcie przerwy (licznik od znacznika czasu).
6. Kontrast i barwy: zielony ↑ i czerwony ↓ na czarnym tle >= 4,5:1, rozróżnialność przy deuteranopii (symbole ↑ ↓ = obecne), czytnik ekranu (TalkBack): odczyt nagłówka „Trening trwa …, seria X z Y”, chipa, pigułek, paska.
7. Pasek postępu 320 px przy 60 seriach i 1 serii w ćwiczeniu; bardzo długie nazwy dnia i ćwiczenia (screenshot 360 px: obcięcie wielokropkiem OK).
8. Ćwiczenia hantlami/kettlebell: szybkie przyciski = 2 kroki (2/4 kg, 4/8 kg), wartości możliwe do załadowania (P-4); wpis „62,5” z przecinkiem.
9. Ćwiczenie z masą ciała: zapis wymaga ciężaru > 0 (P-2, backlog: osobne zadanie), komunikat „Podaj ciężar”.
10. Superseria (litera w kickerze), przycisk wideo techniki (z URL i bez), „Później” na ostatnim ćwiczeniu, „Wstecz” między ćwiczeniami, „+ Seria” z menu (pasek i „Następnie” spójne).
11. Pozostałe luki automatyczne (niskie): scenariusz „reload po 3 zapisanych seriach”, `targetRir` null, `WorkoutEndCard` po ostatniej serii, wyłączone „Pomiń” po zapisie, „Kończenie…”; brak testów komponentów (repo bez jsdom/RTL, wzorzec: Vitest node + e2e).

## 7. Spójność wyglądu (z `ux`, wszystko pod ocenę etapu 8)
Zweryfikowane automatycznie: tokeny w klasach pigułek (zapisana `--gym-success`, pominięta `--gym-skipped`), brak literałów hex/`emerald-`/`orange-` w plikach zadania (grep), plakietka Ghost w nagłówku, RIR w jednym rzędzie. Obserwacje ze screenshotów (360x640, tryb ciemny; jasny: ekran ma być zawsze ciemny, nie sprawdzano przełącznika): patrz O-2. Regresji wizualnej (porównanie ze wzorcem) nie wykonywałem: brak zatwierdzonych zrzutów wzorca w repo, a przegląd robi `ux`.

## Werdykt
**ZATWIERDZONE Z UWAGAMI.** Wszystkie 12 scenariuszy e2e i 80 testów jednostkowych zadania zielone; M-1 naprawiony; brak defektów średnich i wyższych. Uwagi niskiego ryzyka: D-1 (frontend, backlog L-2), D-2 (przestarzałe e2e logowania, tester/zadanie 001), O-2 (ux), O-3 (backend, poza 004) oraz scenariusze ręczne z sekcji 6 (Ghost z rywalem, offline, dwa urządzenia, WebView, kontrast, wibracja) do wykonania na Preview przed Promote.
