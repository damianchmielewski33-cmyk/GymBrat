# 003 - Przebudowa ekranu Trening: raport testów (etap 7, tester)

Data: 2026-10-24. Zakres: tylko zadanie 003 (w drzewie są zmiany innych zadań). Wejście: karta, analiza, ADR 0002 (sekcja 5), spec ux, bramka prawna (LR-5, LR-6, LR-8).

## 1. Środowisko i metoda
- Uruchomienie lokalne i testy eksploracyjne Playwright przy 380 px: NIE wykonane. Powody: brak `.env` (jest tylko `env.example`), logowanie kodem e-mail/OAuth, brak seedowanej bazy i konta testowego; repo nie ma testów komponentów (brak jsdom i `@testing-library`, `vitest` = `environment: node`), a `e2e/` zawiera tylko smoke bez logowania.
- Podstawa wniosków: testy automatyczne (Vitest, baza w pamięci `db/test-memory-db.ts`) + przegląd kodu komponentów. Wszystko, co wymaga przeglądarki, jest w sekcji 5 jako test ręczny.

## 2. Wyniki komend
| Komenda | Wynik |
|---|---|
| `npx tsc --noEmit` | 0 błędów |
| `npm test` | po dopisaniu testów: 917 przeszło, 2 nie (`lib/android-version.test.ts`, znane sprzed zadania); 129 z 130 plików zielonych |
| `npm run lint` | 111 błędów w repo, żaden w plikach zadania 003. W katalogu zadania tylko istniejące `components/treningi/cardio-log-sheet.tsx` (101, 108); `components/home/home-start-panels.tsx:133` i `lib/meal-catalog-images.ts:304` niezmienione przez 003 |
| `npm run deploy:check` | nie uruchamiany (przed merge, bramka koordynatora) |

Dopisane testy (`lib/treningi-hub-data.test.ts`): serie zapisane jako `skipped` 0 kg nie dają obciążenia (zostaje zamiennik; seria 40 kg × 8 w tym samym ćwiczeniu wygrywa); plan 1-dniowy (jeden dzień = następny, numer 1, brak historii bez błędu); plan 10-dniowy (numery 1..10, pusty dzień 1 nie jest następny).

## 3. Mapa AC -> dowód
Oznaczenia: A = test automatyczny, R = przegląd kodu, M = test ręczny do wykonania (sekcja 5), brak = brak dowodu.

| AC | Dowód |
|---|---|
| 1.1 nagłówek bez kickera | R (`treningi-header.tsx`), A `formatWeekRange` (`treningi-hub-format.test.ts`) |
| 1.2 chip serii, odmiana, ukryty przy 0 | A (`formatStreakWeeks`, `...Aria`), R |
| 1.3 odświeżenie po północy | R (`treningi-hub-client.tsx`: `useVisibilityInterval` robi tick od razu po powrocie do widoczności + co 60 s, najwyżej jedno `router.refresh()` na `todayKey`), A zakresu tygodnia w `local-date.test.ts`; M |
| 1.4 jedna strefa | A (`todayKey` z serwera wyznacza tydzień: `treningi-hub-stats.test.ts`, `treningi-hub-data.test.ts`); R |
| 2.1 X / N, N segmentów, >7 bez przepełnienia | A (`buildTreningiHubDays`, 10 dni), R (`min-w-[6px] flex-1`, gap 1 przy >12); M 320 px |
| 2.2 stany segmentów + tekst | A (`formatWeekSegmentLabel`), R (`<li>` z `sr-only`) |
| 2.3 X = różne dni, nie sesje | A (wielokrotne wykonanie = jedno wypełnienie) |
| 2.4 jeden `today` | A, R (`workout-plan-page-content.tsx`) |
| 2.5 cardio min · sesje | A (`formatCardioSessions`), R |
| 2.6 brak planu: tylko cardio | R (`hasPlan`), M |
| 2.7 pierwszy raz 0 / N | A (plan 1-dniowy, dopisane), R |
| 3.1 karta Następny | A format, R; M (zawijanie 2 linie `line-clamp-2`) |
| 3.2 wybór dnia (D-4) | A (`workout-plan-queue.test.ts`: nigdy niewykonany, najstarsza data, remis dat, dwa niewykonane, pusty dzień) |
| 3.3 + N kolejne | A (`formatMoreExercises`), R |
| 3.4 ciężar x powt., format PL | A (`formatLastLoad`, `pickHeaviestCompletedSet`, `extractExerciseLastLoads`) |
| 3.5 pierwszy raz | A (`formatLastDoneWithRelative` "pierwszy raz", `formatPlanTarget`) |
| 3.6 nowe ćwiczenie / bez serii | A (`extractExerciseLastLoads`, dopisany test hubu) |
| 3.7 masa ciała | A formatu; patrz defekt T-1 (osiągalne tylko dla starych sesji) |
| 3.8 brak mięśni -> sztanga | A (`muscle-glyph.test.ts`, `plan-day-muscles` zwraca null), R |
| 3.9 start solo/grupa, "Startuję…", blokada | R (`startingPlanId`, `disabled`, `aria-busy`); M |
| 3.10 offline | R (start solo z lokalnego store, brak zależności od sieci); M |
| 3.11 pusty następny dzień | R (`NextWorkoutCard`: "Dzień N jest pusty" + "Uzupełnij plan"), M |
| 3.12 niedokończony + Porzuć z potwierdzeniem | R (`UnfinishedWorkoutCard` + `ConfirmDialog`), M |
| 3.13 brak skoku po hydratacji | R (`MainCardSkeleton` min-h 296 px), M (porównać wysokość karty) |
| 3.14 brak planu: jedno CTA | R (`days.length > 0` ukrywa panel), M |
| 3.15 nie pogarszać | R (start z wiersza/menu/podglądu przy niedokończonym idzie przez `requestBegin` + "Zacząć nowy trening?") |
| 4.1 panel, kolejność 1..N | A (`buildTreningiHubDays` sort po `dayNumber`) |
| 4.2 ikona, nazwa, podpis | A (`formatPlanDayCaption`), R |
| 4.3 ptaszek złoty | R (`--gym-gold`, `aria-hidden`; status w `aria-label`), A (`formatPlanDayAriaLabel`) |
| 4.4 ramka + "Następny" | R |
| 4.5 tap = start, cele 44 px | R (`min-h-16` wiersz, `size-11` menu), M |
| 4.6 menu 3 pozycje, klawiatura | R (DropdownMenu @base-ui, `min-h-11`, podgląd zwraca fokus `finalFocus`), M klawiatura/Esc |
| 4.7 pusty wiersz | R (Link do `/profile/workout-plan`, "Start" disabled z powodem), A (aria "Uzupełnij plan") |
| 4.8 długie nazwy 320 px | R (`truncate`, `min-w-0`, `[overflow-wrap:anywhere]` w tytule), M |
| 4.9 PDF + Edytuj; brak planów | R (`PlanDaysPanel`), M |
| 4.10 brak stopki | R (brak w kodzie) |
| 4.11 ta sama nazwa | A (numer dnia w podpisie i aria) |
| 4.12 jeden dzień | A (dopisany), R (`divide-y`: brak separatora dla 1 elementu) |
| 4.13 nierozpoznane pomijane | A (`plan-day-muscles.test.ts`) |
| 5.1-5.3 narzędzia 3 kafelki | R (`training-tools-grid.tsx`: Dodaj cardio, Dziennik, Technika; brak Rekordów), `min-h-[88px]` |
| 6.1 320-430 px, kontrast | brak (M; kontrasty `text-white/60` na ciemnym tle do pomiaru) |
| 6.2 czytnik ekranu | A (aria-label wiersza, segmentów, ciężarów), R |
| 6.3 reduced motion | R (`motion-reduce:animate-none`, `AnimatedMetric` istniejący) ; M |
| 6.4 CTA above the fold 360x640 | brak (M; `[@media(max-height:680px)]:line-clamp-1` to zabezpieczenie) |

## 4. Weryfikacja punktów zleconych
1. Następny dzień. Tie-break = najniższy `dayNumber`, nigdy niewykonane przed wykonanymi, pusty dzień nie polecany: pokryte w `workout-plan-queue.test.ts` (4 testy porównania, 4 `pickNextWorkoutPlan` w tym brak mutacji). Regresja Home: `lib/home-start.test.ts` ma 3 testy na bazie w pamięci (remis nigdy niewykonanych -> p1 mimo najświeższego `updatedAt` p2, zgodność z `pickNextWorkoutPlan`, pusty dzień, najstarsza data). POTWIERDZONE. Luka: brak testu Home dla remisu dat wykonania (dwa dni tego samego dnia) - pokryte pośrednio testem kolejki.
2. "X / N", segmenty, stały numer: `doneThisWeek` testowane na granicach tygodnia, X = liczba dni z `doneThisWeek` (`WeekProgressCard` liczy `days.filter`), numer z `dayNumber` (createdAt) niezależny od kolejki (`workout-plans-with-last-workout.test.ts`). POTWIERDZONE.
3. Ostatnie obciążenia: wybór najcięższej ukończonej serii ostatniej sesji planu, pomijanie `skipped`, `done:false`, powtórzeń 0/NaN/ujemnych, remis -> więcej powtórzeń, dopasowanie po id, potem tożsamości; filtr `user_id`; LR-1 (brak logowania). POTWIERDZONE (A). Zapis: `actions/workout-history.ts:169-181` zapisuje `skipped`, a `active-workout-view.tsx:766-772` ustawia `skipped: true` przy zaliczeniu serii bez ciężaru > 0 lub powtórzeń > 0. Nowe serie 0 kg SĄ więc `skipped`, a wtedy karta pokazuje zamiennik "plan 3 × 10". AC-3.7 jest spełnione w sensie "nigdy nie pokazuje 0 kg", ale wariant "× N powt." jest nieosiągalny dla nowych sesji, bo aplikacja nie pozwala zapisać serii z masą ciała jako wykonanej (BR-8/P-2). Wymaga decyzji - T-1.
4. Grupy mięśni: max 3, biceps + triceps + przedramiona = "Ramiona" (P-3), przód/tył, null -> sztanga: `plan-day-muscles.test.ts` (11 testów) i `muscle-glyph.test.ts`. POTWIERDZONE. Uwaga T-2.
5. Potwierdzenia: "Porzuć" (`UnfinishedWorkoutCard`) i "Zacząć nowy trening?" (`treningi-hub.tsx` `requestBegin` - wspólna ścieżka dla karty, wiersza, menu i podglądu) - R. Fokus po porzuceniu: callback ref tytułu nowej karty z flagą (`focusTitleAfterDiscard`), `aria-live="polite"` ogłasza "Trening porzucony." - R; zachowanie fokusu względem zamykanego dialogu wymaga testu ręcznego (M-5).
6. Stany: brak planu (panel Dni planu ukryty - R), plan bez ćwiczeń (A+R), 1 i 10 dni (A dopisane), długie nazwy (R), odświeżenie po zmianie dnia (R).
7. Dostępność: aria/sr-only dla segmentów i wierszy (A), cele 44 px (R), menu ⋮ na komponencie @base-ui (klawiatura do potwierdzenia ręcznego).

## 5. Defekty i uwagi
| ID | Dotkliwość | Opis | Plik | Przypisanie |
|---|---|---|---|---|
| T-1 | niska (decyzja produktowa) | AC-3.7 ("× N powt." dla ciężaru 0) nieosiągalne dla nowych sesji: `canCompleteWorkoutSet` wymaga ciężaru > 0, więc serie z masą ciała są zapisywane jako `skipped`, a karta pokazuje cel z planu zamiast ostatnich powtórzeń. Kroki: wykonaj pompki bez ciężaru, zaliczaj serie, zakończ, otwórz Trening. Oczekiwane wg AC: "× 12 powt."; faktyczne: "plan 3 × 12". Nie jest defektem kodu hubu (`pickHeaviestCompletedSet` obsługuje 0 kg), tylko konsekwencją reguły zapisu serii. | `lib/workout-skipped-sets.ts:60-67`, `lib/plan-last-session-loads.ts:41-52` | analityk/właściciel (zaakceptować zamiennik albo zmienić BR-8); backend/frontend po decyzji |
| T-2 | niska | Sylwetka rysuje tylko grupy widoczne w wybranym widoku: przy np. klatka + plecy + barki (przód) plecy nie są podświetlone, choć ikona "wygląda" na 2 grupy; pełna lista tylko w tekście dla czytnika. Podobnie pośladki z klatką lub brzuchem. | `components/treningi/muscle-glyph.tsx` (`GLYPH_PARTS`, `views`) | ux (decyzja) -> frontend |
| T-3 | niska | `aria-live` na podpisie wiersza jest dodawany w tym samym renderze, w którym zmienia się treść ("Startuję…"); region live dodany razem z treścią często nie jest ogłaszany. Stan "Startuję…" i tak jest dostępny przez `aria-busy` na przycisku. | `components/treningi/plan-day-row.tsx:89` | frontend |
| T-4 | informacja | Brak testów komponentów i e2e dla ekranu (brak infrastruktury: jsdom, konto testowe, seed). Zalecenie do backlogu: e2e Playwright z kontem seedowanym (`/workout-plan`: start, Porzuć, menu ⋮) i zrzuty 320/380/430 px. | `vitest.config.ts`, `e2e/` | tester / backend |

Brak defektów krytycznych, wysokich ani średnich.

## 6. Testy ręczne do wykonania przed Promote (Preview, 380 px i 320 px, Android WebView)
- M-1: stany ekranu: brak planu, plan z pustym dniem, 1 dzień, 7 i 10 dni, nazwy 60 znaków bez spacji i z emoji; brak poziomego przewijania; CTA "Rozpocznij trening" widoczne na 360x640 (AC-6.4).
- M-2: tryb jasny i ciemny, `prefers-reduced-motion`, kontrast `text-white/60` (>= 4,5:1).
- M-3: start z karty, wiersza, menu i podglądu: wybór solo/grupa, blokada celów w trakcie, "Startuję…"; z niedokończonym treningiem: dialog "Zacząć nowy trening?" (Wróć nie niszczy sesji).
- M-4: menu ⋮ klawiaturą (Enter, strzałki, Esc), zwrot fokusu po podglądzie; czytnik (TalkBack): segmenty, wiersze, ciężary.
- M-5: "Porzuć": potwierdzenie, fokus ląduje na tytule nowej karty, ogłoszenie "Trening porzucony.".
- M-6: niedziela 23:59 -> poniedziałek: odświeżenie zakresu i segmentów po powrocie do karty; zmiana strefy urządzenia.
- M-7: tryb offline (PWA): ekran i start solo bez błędu.
- M-8: zapis treningu z serią 0 kg -> wygląd karty "Następny" (T-1).

## 7. Ryzyka resztkowe
Brak weryfikacji w przeglądarce (układ, kontrast, fokus, WebView); `deploy:check` nie uruchamiany; Home w produkcji zmienia wskazanie "następnego" dnia (zamierzone, P-2) - komunikować w changelogu.

## 8. Werdykt (tester): ZATWIERDZONE Z UWAGAMI
Warunki: wykonać testy ręczne M-1..M-8 na Preview; zapisać decyzję w sprawie T-1; T-2, T-3 do backlogu (niski priorytet).

---

# Aktualizacja: regresja po zmianach kodu po etapie 6 (2026-10-24)

Zakres zmian: poprawki ux F-1..F-5, F-7, F-9, T-3; usunięcie szkieletu karty głównej (render z danych serwera, „Niedokończony" po zamontowaniu); wariant `compact` (`@custom-variant compact` = `max-height: 719px`); indeksy `workouts` (schemat, migracja 0032, `ensureCriticalSchema`); `Object.create(null)` w `lib/plan-last-session-loads.ts`.

## Wyniki komend
| Komenda | Wynik |
|---|---|
| `npx tsc --noEmit` | 3 błędy, wszystkie w `docs/wydajnosc/skrypty/001-takeover-batch.bench.ts` (zadanie 001); w plikach 003 brak |
| `npm test` | 959 przeszło, 2 nie (`lib/android-version.test.ts`, znane); 132 z 133 plików zielonych (wcześniej 917/2, 129/130) |
| `npm run lint` | 105 błędów (było 111, nie przybyło). Błędy w katalogach 003/004: `cardio-log-sheet.tsx` (101, 108, istniejący dług), `active-workout-global-bar.tsx`, `active-workout-view.tsx`, `workout-finished-screen.tsx` (reguła setState w efekcie; zadanie 004 / dług, nie pliki 003) |

## Wpływ zmian na AC i dowody
| AC / obszar | Zmiana dowodu |
|---|---|
| 3.12 niedokończony + Porzuć | R: karta renderowana z danych serwera, stan „Niedokończony" ustawiany po zamontowaniu (`treningi-hub.tsx`: `unfinished`); A brak (brak jsdom); M-5 bez zmian |
| 3.13 brak skoku po hydratacji | Zmiana mechanizmu: zamiast `MainCardSkeleton` (min-h 296 px) brak szkieletu, karta od razu z serwera. Ryzyko: przeskok treści karty „Następny" -> „Niedokończony" po zamontowaniu (źródło niedokończonego to lokalny store). Wymaga M-1 (porównać wysokość/CLS obu kart) |
| 3.15, „Zacząć nowy trening?" i „Porzuć" | R: nadal wspólna ścieżka `requestBegin` + `ConfirmDialog`; M-3, M-5 |
| 6.4 CTA above the fold 360x640 | Zmiana: `[@media(max-height:680px)]` zastąpione wariantem `compact:` (próg 719 px, `line-clamp-1`, ukryte części podglądu i podpisu). Pokrywa 640 px; brak automatu, M-1 |
| 3.4/3.6 ostatnie obciążenia, mapa `__proto__` | A: `lib/plan-last-session-loads.test.ts:129` (id `__proto__` zwykłym kluczem, `Object.keys` = `["__proto__"]`, bez zmiany prototypu) - POTWIERDZONE |
| Wydajność zapytania „ostatnia sesja planu" | A: `db/workouts-indexes.test.ts` (4 testy): schemat tworzy 2 indeksy; EXPLAIN = SEARCH po `idx_workouts_user_plan_date`, bez SCAN/TEMP B-TREE; migracja 0032 uruchomiona 2x na istniejących danych (idempotencja, dane nietknięte); `ensureCriticalSchema` dopisuje brakujące indeksy. Migracja to `IF NOT EXISTS` wg testu |
| Kontrakt `TreningiHubData` | A dopisany (`lib/treningi-hub-data.test.ts`): dokładnie pola `days`, `nextLastLoads`, `nextPlanId`, `week`; użytkownik bez danych -> pusty plan, `nextPlanId` null, brak obciążeń. Pozostałe testy hubu bez zmian i zielone |
| T-3 (aria-live w wierszu) | R: poprawka ux; ponowna weryfikacja z czytnikiem w M-4 |
| ux F-1..F-5, F-7, F-9 | R/M: zmiany wizualne, bez automatu; objęte M-1, M-2, M-4 |

## Defekty
Bez nowych. Otwarte: T-1 (niska, decyzja produktowa), T-2 (niska), T-4 (informacja; nadal brak testów komponentów). T-3 do potwierdzenia ręcznie.

## Werdykt (regresja): ZATWIERDZONE Z UWAGAMI
Warunki jak wyżej: M-1..M-8 na Preview, ze szczególnym naciskiem na brak przeskoku karty głównej po hydratacji (3.13) i 6.4 na 360x640 z wariantem `compact`.
