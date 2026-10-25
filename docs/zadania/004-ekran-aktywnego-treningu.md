# 004 - Usprawnienie ekranu aktywnego treningu

- **Polecenie użytkownika**: Usprawnić ekran aktywnego treningu (`components/active-workout/guided-session-layout.tsx` i ekran przerwy `rest-break-screen.tsx`) wg makiety zatwierdzonej w rozmowie: bardziej złote kolory, każda seria zapisywana przyciskiem „Zapisz serię”, zapisane serie/ćwiczenia zielone na pasku postępu, sugestia zwiększenia ciężaru na zielono, obniżenia na czerwono.
- **Ścieżka**: pełna (przebudowa układu głównego ekranu treningu, zmiana zachowania przycisku głównego, nowe stany paska postępu; nie jest drobną poprawką)
- **Gałąź / PR**: feat/error-handling-system (w drzewie są niezatwierdzone zmiany innych zadań, m.in. 001 i 003), PR do założenia
- **Status**: gotowe (wszystkie bramki ZATWIERDZONE/ZATWIERDZONE Z UWAGAMI) — warunki przed Promote w sekcji „Warunki przed Promote” poniżej

## Zatwierdzona propozycja (makieta v2 z rozmowy, 2026-10-23)
Ekran A - seria aktywna:
1. Nagłówek: X (zamknij), tytuł dnia, pod nim podpisany czas „trening m:ss · seria X/Y” (dziś sam czas bez podpisu), menu ☰. Osobny wiersz „0/16 serii · 0/7 ćw.” usunięty (dubel z paskiem).
2. Pasek postępu: segment = seria, segmenty pogrupowane per ćwiczenie (odstęp między grupami). Seria zapisana = **zielona**, bieżąca = złota, do zrobienia = ciemna. Ćwiczenie z wszystkimi seriami zapisanymi = cała grupa zielona.
3. Nagłówek ćwiczenia: złoty kicker „ĆWICZENIE N Z M”, nazwa, „2 serie × 6–8 · RIR 1”, przycisk wideo techniki, pigułki serii (zapisana = zielona z ✓, bieżąca = złota).
4. Jeden wiersz „ostatnio + sugestia” zastępuje cztery elementy (baner „Start jak ostatnio”, kartę „Ostatnio · 65 kg × 11”, „Powtórz bazę”, „Sugestia: 65 kg”): `Ostatnio 65×11 · 5 dni` + chip sugestii (tap = zastosuj) + krótki powód. **Fragment z ciężarem: zielony gdy sugestia zwiększa ciężar (↑), czerwony gdy obniża (↓)**, neutralny (złoty/biały) gdy utrzymuje.
5. Ciężar: wartość wpisana (nie wyblakły placeholder), steppery − / +, szybkie przyciski ±2,5 / ±5 (lub wielokrotność kroku ćwiczenia - do decyzji architekta/ux).
6. Powtórzenia: steppery, znacznik „✓ w celu 6–8”.
7. RIR 0 / 1 / 2 / 3+ w jednym rzędzie, mieści się bez przewijania; domyślnie podświetlony cel, nie 0.
8. Przycisk główny zawsze „Zapisz serię” (zapisuje serię); po zapisie seria poprawiana = „Popraw serię N” (jak dziś).
9. Dolne linki: Wstecz · Później · Pomiń. „Zakończ” przeniesione do menu ☰ (z potwierdzeniem jak dziś).
10. Więcej złota: nasycony akcent (ok. #F5C542, obrys przycisku jaśniejszy), złoty odcień tła kart i ramek; spójnie z paletą aplikacji (do ustalenia przez ux: tokeny, nie hex w komponentach).

Ekran B - przerwa po zapisaniu serii:
11. Pasek postępu jak w A (zielone zapisane).
12. Zielona karta potwierdzenia „Zapisano · 70 kg × 8 · RIR 1” (+ „ćwiczenie ✓” gdy ostatnia seria ćwiczenia).
13. Duży złoty licznik przerwy z pierścieniem, −15 s / +30 s, wibracja na koniec (o ile istnieje dziś - nie dokładać nowych uprawnień).
14. „NASTĘPNIE”: następna seria lub ćwiczenie z wierszem sugestii w tych samych kolorach (↑ zielony / ↓ czerwony).
15. Przycisk „Zacznij serię N” / „Zacznij ćwiczenie N”.

## Decyzje użytkownika (2026-10-23)
- D-1 Ghost Training zostaje wyścigiem z poprzednim treningiem (bez nowego trybu bez zapisu). Poprawić plakietkę: obecny tekst „Ghost Training · bez zapisu” (`ghost-picker-sheet.tsx:52`) sugeruje brak zapisu treningu, a oznacza „nie wybrano przeciwnika”. Nowa mikrokopia + przeniesienie do nagłówka (ux).
- D-2 Przycisk główny zawsze „Zapisz serię”; nie zmienia się w „Pomiń serię” (pomijanie tylko linkiem „Pomiń”).
- D-3 Reguła progresji (`lib/set-progression-suggestion.ts`) bez zmian - zmieniają się tylko kolory prezentacji sugestii.

## Odpowiedzi na pytania analityka (2026-10-23)
- P-1 Seria pominięta: **pomarańczowa** (jak dzisiejsza pigułka), także segment na pasku; nie zielona. Ćwiczenie z pominięciem bez „ćwiczenie ✓”. Zmienia BR-2 analizy (szary z przekreśleniem → pomarańczowy; nadal dodatkowy symbol „–” dla dostępności).
- P-2 Masa ciała (0 kg): poza zakresem, osobne zadanie (backlog). Teraz zapis wymaga ciężaru > 0, przy braku - komunikat walidacji.
- P-3 Nietknięty RIR: zapis jak dziś (cel z planu). Ryzyko R-2 do backlogu.
- P-4 Szybkie przyciski ciężaru: wielokrotności kroku ćwiczenia (±1 i ±2 kroki).
- P-5 „Zapisane” w nagłówku: tylko faktycznie zapisane serie (pominięte osobno) - przyjęta rekomendacja analityka.

## Znaleziony błąd (do naprawy w ramach zadania)
- Na zrzucie użytkownika przycisk główny pokazywał „Pomiń serię” mimo widocznego „65 kg”. Przyczyna: „65” to `placeholder` pola ciężaru (podpowiedź), `weightText` jest pusty, więc `canZaliczyc` = false i `primaryLabel` = „Pomiń serię” (`guided-session-layout.tsx` ok. l. 255 i 535). Oczekiwane: podpowiedź z poprzedniego treningu / sugestii wypełnia wartość ciężaru, a przycisk zawsze „Zapisz serię”. Gdy brak ciężaru/powtórzeń przy zapisie - komunikat walidacji, nie ciche nic.

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | `docs/analiza/004-ekran-aktywnego-treningu.md` — US-1..US-14, BR-1..BR-13, R-1..R-8; pytania P-1..P-5 |
| 2 | Bramka wejściowa | prawnik | ZATWIERDZONE Z UWAGAMI | 2026-10-24 | `docs/prawo/004-ekran-aktywnego-treningu-wejscie.md` — LR-1..LR-10 (brak danych w logach/Sentry, brak zmian API/schematu, wartość początkowa tylko z własnych danych bez pushu, neutralna mikrokopia obniżenia, kolor nie jedynym nośnikiem, pominięta pomarańczowa z „–”, wibracja przez `hapticRestEnd`, plakietka Ghost bez „bez zapisu”). Projekt roboczy — mikrokopię zatwierdza prawnik-człowiek |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE Z UWAGAMI | 2026-10-24 | `docs/adr/0003-ekran-aktywnego-treningu.md` — czyste funkcje `lib/set-suggestion-view.ts`, `lib/workout-session-progress.ts`, `lib/workout-set-draft.ts`, `lib/rest-next-step.ts`; wartość początkowa tylko w polu (bez pushu); tokeny `--gym-*`; brak zmian schematu/API/Androida |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-24 | `docs/ux/004-ekran-aktywnego-treningu.md` + `-makieta.html` — złoto = istniejący `--gym-gold`, tekst na złocie `--neon-fg`; nowe tokeny `--gym-success`, `--gym-trend-up/down`, `--gym-skipped`, `--gym-track`, `--gym-surface-gold`, `--gym-border-gold`, `--gym-text-secondary`; stany serii także kształtem; akcje pomocnicze do menu ☰. Koordynator: nazwy tokenów wg ux (zastępują propozycję `--gym-set-*`/`--gym-suggest-*` z ADR) |
| 5 | Implementacja | backend, frontend | WYKONANE (czeka na przegląd) | 2026-10-24 | backend: `lib/set-suggestion-view.ts`, `workout-session-progress.ts`, `workout-set-draft.ts`, `rest-next-step.ts` + testy; frontend: nowe komponenty w `components/active-workout/`, `lib/active-workout-copy.ts`, tokeny w `app/globals.css`, wpis changelog `planned: true`. tsc i eslint na zmienionych plikach czyste; `npm test` 917/919 (2 znane w `lib/android-version.test.ts`) |
| 6 | Przegląd kodu | architekt | ZATWIERDZONE (runda 3: poprawki powodu sugestii i kompaktu 360×640 zweryfikowane, 58/58 testów, tsc/eslint czyste; wcześniej runda 2: M-1, L-3 zamknięte, N-1 niska w backlogu) | 2026-10-24 | `docs/adr/0003-ekran-aktywnego-treningu.md` §11 — M-1: wyczyszczenie ciężaru w zapisanej serii ustawia `skipped`, ponowne wpisanie tego nie cofa (`active-workout-view.tsx:654-664`, `guided-session-layout.tsx:416-436`); L-1..L-8 niskie |
| 7 | Testy funkcjonalne i spójność | tester, ux | ZATWIERDZONE Z UWAGAMI | 2026-10-24 | `docs/testy/004-ekran-aktywnego-treningu.md` — 80 testów `lib/` zielonych, `npm test` 959/961 (2 znane `android-version`), e2e `e2e/active-workout.spec.ts` 12/12 (Edge, jednorazowa baza `file:`), M-1 zamknięty; defekty niskie D-1 (=L-2), D-2 (stare e2e szukają przycisku „Zaloguj się jako zawodnik” po zmianie z zad. 001), O-3 (403 presence przy braku znajomych, poza 004) |
| 8 | Przegląd wizualny | ux | ZATWIERDZONE Z UWAGAMI — ZAMKNIĘTE (2026-10-25). Oba defekty średnie (powód sugestii, pigułki 360×640) i wszystkie regresje z rund 1-3 (w tym D-1 pierścień fokusu) zamknięte, zmierzone realnym Tab w przeglądarce; baseline zrzutów zatwierdzony (`*-v4.png`, `docs/ux/zrzuty-004/`). Warunek wydania: mikrokopię powodu sugestii zatwierdza prawnik-człowiek | 2026-10-25 | `docs/ux/004-ekran-aktywnego-treningu.md` sekcja „Zamknięcie etapu 8” — pełna historia rund 1-3 w sekcjach „Przegląd wizualny” i „Weryfikacja poprawek” tego samego dokumentu |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | OBA ZATWIERDZONE Z UWAGAMI. Bezpieczeństwo (retest 2026-10-25): V-1, V-2 zamknięte (14/14 testów, tsc/eslint czyste); RT-2 niska w backlogu; V-3, N-3 nadal w backlogu. Wydajność: brak przekroczeń SLO; ekran serii p50 681 ms/p95 1561 ms, LCP p50 1,63 s, CLS 0, wpis ciężaru p50 20-28 ms (próg 200 ms), bundle +~2% gzip, brak wzrostu częstotliwości sync do chmury; W-1..W-9 (pre-istniejące w HEAD, nie wprowadzone przez 004) w backlogu | 2026-10-25 | `docs/bezpieczenstwo/004-ekran-aktywnego-treningu.md`, `docs/wydajnosc/004-ekran-aktywnego-treningu.md` |
| 10 | Bramka wyjściowa | prawnik | ZATWIERDZONE Z UWAGAMI (finalna, 2026-10-25) — LR-3 spełnione w pełni (F1+F2 zweryfikowane kodem, testami i e2e); LR-8(c) rozstrzygnięte jako spełnione dowodem strukturalnym (Ghost to tylko odczyt, nie wpływa na ścieżkę zapisu), test dodatkowy w backlogu, nie warunek wydania | 2026-10-25 | `docs/prawo/004-ekran-aktywnego-treningu-wyjscie.md` sekcja „Finalna weryfikacja (2026-10-25)” | `docs/prawo/004-ekran-aktywnego-treningu-wyjscie.md` |

## Warunki przed Promote (z bramki wyjściowej, prawnik)
1. Zatwierdzenie przez prawnika-człowieka: powody sugestii, tekst panelu Ghost „Twój trening zapisuje się tak samo”, changelog bullet 5.
2. Decyzja właściciela produktu w sprawie U-1 (lider FCS w Ghost bez flagi udostępniania, podniesione do wysokiego) — zapisać wynik w tej karcie.
3. `npm run deploy:check` przed merge.
4. Ręczne sprawdzenia na Preview: czytnik ekranu (TalkBack), deuteranopia/kontrast kolorów, Android WebView, dwa urządzenia jednocześnie (Ghost na żywo).

## Weryfikacja
- [x] `npm run lint` — 0 błędów w plikach zadania 004 (105 błędów/36 ostrzeżeń są w plikach poza zakresem, pre-istniejące w gałęzi)
- [x] `npx tsc --noEmit` — czyste (poza znanym błędem w `docs/wydajnosc/skrypty/001-takeover-batch.bench.ts`, zadanie 001, poza zakresem)
- [x] `npm test` — 985/987 (2 znane niepowodzenia w `lib/android-version.test.ts`, nieaktualna oczekiwana wersja, niezwiązane z 004)
- [ ] `npm run deploy:check` (przed merge) — nie uruchomiony w tej sesji, patrz „Warunki przed Promote”
- [x] Wpis w `components/changelog/changelog-data.ts` (`planned: true`, `sourceRepo` tego repo)

Zweryfikowane przez koordynatora 2026-10-25, po finalnym werdykcie bramki wyjściowej.

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Ćwiczenia z masą ciała: zapis 0 kg bez traktowania jako pominięta (`isSkippedWorkoutSet`), wpływ na historię i raporty | analityk (P-2) | właściciel produktu | średni |
| U-1 (poza zakresem): Ghost — rywal „lider FCS” dostępny przy samym wspólnym zespole, bez sprawdzenia flagi udostępniania treningów (`lib/ghost-training/targets.ts`) | prawnik | backend | średni |
| Podsumowanie po treningu liczy pominięte serie jako wykonane | architekt (ADR 0003 §10) | frontend | niski |
| 4 dodatkowe kopie `formatElapsed` poza `active-workout` | architekt (ADR 0003 §10) | frontend | niski |
| Przerwa zapisuje czas do niewłaściwej serii przy zmienionej kolejności serii | architekt (ADR 0003 §10) | frontend | średni |
| Osierocona `actions/active-workout-coach.ts` (używał jej tylko usunięty `ActiveWorkoutCoachPanel`) | frontend | architekt | niski |
| Powód sugestii: brak mapowania `rule` → tekst z UX §5.3 (`SetSuggestionView` nie niesie `rule`) | frontend | backend | niski |
| Karta „Następnie” na przerwie 360×640 z dwuliniowym powodem ucięta pod paskiem dolnym — niezmierzone, czy kolumna przerwy się przewija | ux (weryfikacja) | frontend | średni |
| Mikrokopia: „+1 powt.” mylące z przyrostem ciężaru, „lżej, nowy cykl zakresu” to żargon, `DEFAULT_REASON` zdublowany w `set-suggestion-row.tsx:17`, „serii” osamotnione w zawinięciu | ux (weryfikacja) | frontend/prawnik | niski |
| D-2: `e2e/smoke.spec.ts` i `e2e/diet-admin-session.spec.ts` szukają przycisku „Zaloguj się jako zawodnik”, którego nie ma po zmianie z zadania 001 | tester | właściciel zad. 001 | średni |
| O-3: każdy zapis serii woła `POST /api/community/friends/live/presence` → 403 dla konta bez znajomych, błąd w konsoli (mechanizm sprzed 004) | tester | backend | niski |
| Luki bez testu: reload po zapisanych seriach, brak celu RIR, karta „Koniec treningu”, wyłączone „Pomiń” po zapisie, stan „Kończenie…” | tester | tester | niski |
| „Pomiń” zapisuje niezmienioną podpowiedź dla serii pominiętej (nie trafia do osi Ghost ani sugestii/„Ostatnio”) | prawnik (finalna weryfikacja) | frontend | niski |
| LR-8(c) test „zapis identyczny z Ghost on/off” — rozstrzygnięte jako spełnione strukturalnie, test dodatkowy opcjonalny | prawnik (finalna weryfikacja) | tester | niski |
| Flake logowania e2e (~1/14, CredentialsSignin ~13-22 ms zamiast ~120-170 ms, przyczyna nieustalona) — pre-istniejące, powiązane z W-9 | tester (weryfikacja F1/F2) | tester/backend | niski |
| U-1 (Ghost lider bez flagi udostępniania) podniesiony do WYSOKIEGO przez prawnika (bramka wyjściowa) — decyzja właściciela produktu wymagana | prawnik (bramka wyjściowa) | właściciel produktu | wysoki |
| N-1 (usuwanie zapisanej serii z menu bez potwierdzenia) podniesiony do ŚREDNIEGO przez prawnika (bramka wyjściowa) | prawnik (bramka wyjściowa) | frontend/ux | średni |
| W-1: edycja zapisanej serii wysyła natychmiastowy zapis przy każdym znaku (2-3 zapisy/3 znaki), pre-istniejące | tester-wydajnosci | frontend | średni |
| W-2: okresowy zapis co 8 s bez deduplikacji (~450/h przy bezczynności), pre-istniejące | tester-wydajnosci | frontend/architekt | średni |
| W-3 (= L-1): ZAMKNIĘTE przez F2 (2026-10-25) | tester-wydajnosci | — | zamknięte |
| W-4..W-9: selektor całego store w `ActiveWorkoutView`, bail-out w `use-scroll-edge-fade`, budżet bundla, profil hydratacji, stabilność logowania w e2e (9/26 nieudanych na CredentialsSignin, przyczyna nieustalona) | tester-wydajnosci | frontend/tester | niski |
| RT-2: `lib/last-workout-hints.ts:470-478` przepisuje reps/rpe/rir z niezapisanej serii historii do nowej sesji (nie wpływa na sugestię ani „Ostatnio”, tylko na puste pola) | tester-bezpieczenstwa (retest) | backend | niski |
| N-1: „Usuń ostatnią serię” w menu ☰ bez potwierdzenia, usuwa też zapisaną serię (sprzed 004) | tester-bezpieczenstwa | frontend/ux | niski |
| N-2: tekst Live Coach „Jeden słabszy set to jeszcze nie problem” — blisko zakazanego „słabo” (LR-4) | tester-bezpieczenstwa | prawnik/ux | niski |
| N-3: `package-lock.json` podbija `zod` 4.3.6→4.6.7 w commicie `0a3214f` bez zmiany `package.json`; zmiany `package.json` na gałęzi (usunięty `xlsx`, dodane `fflate`/`saxes`/`web-push`, `next` 16.4.2) nieocenione — poza 004, do `tester-bezpieczenstwa` na poziomie gałęzi | tester-bezpieczenstwa | użytkownik | średni |
| D-2: kółko bieżącej/wybranej pigułki częściowo w strefie gradientu krawędzi (9/23 przypadków w pomiarze) | ux (zamknięcie etapu 8) | frontend | niski |
| Cień/gradient na dolnej krawędzi kolumny przerwy — dopracowanie wizualne | ux (zamknięcie etapu 8) | frontend | niski |
| N-1: seria pominięta przez „Pomiń” z kompletnymi danymi w polach staje się zapisaną po późniejszej edycji wartości, bez „Zapisz serię”; brak testu tego przejścia | architekt (runda 2) | ux | niski |
| L-1: `flushDraft` utrwala niepotwierdzoną sugestię przy nawigacji/menu/blurze — ZAMKNIĘTE przez F2 (2026-10-25) | architekt (przegląd 004) | — | zamknięte |
| L-2: ochrona przed podwójnym tapnięciem tylko 700 ms (D3: późniejsze z 700 ms lub pierwszego renderu nowej serii), brak testu E2E (US-8) | architekt (przegląd 004) | frontend/tester | niski |
| L-5: literały kolorów w stanie pustym `active-workout-view.tsx:905,998,999` (kod sprzed 004) | architekt (przegląd 004) | frontend | niski |
| L-6: `formatSignedKg` w `lib/active-workout-copy.ts` i w `components/home/start-metric-tiles.tsx` (ta sama nazwa) | architekt (przegląd 004) | frontend | niski |
| Commit `fd61b1e` miesza zmiany zadań 001, 003, 004 i HotPay — rozdzielić przed PR | koordynator | użytkownik | średni |
| R-2: nietknięty RIR zapisany jako cel planu; przy celu RIR ≥ 2 Live Coach traktuje serie jako łatwe | analityk (P-3) | właściciel produktu | średni |
