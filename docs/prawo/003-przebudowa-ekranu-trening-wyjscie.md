# 003 - Przebudowa ekranu Trening: bramka wyjściowa (prawnik)

Projekt roboczy asystenta AI, nie porada prawna. Przed publikacją tekstów dla użytkowników zatwierdza je prawnik-człowiek. Data przeglądu: 2026-10-24. Podstawa: przegląd kodu `components/treningi/**`, `lib/treningi-hub-format.ts`, raporty `docs/bezpieczenstwo/003-...`, `docs/wydajnosc/003-...`, `docs/ux/003-...` oraz `docs/prawo/003-...-wejscie.md`. Stanu prawnego (ISAP/EUR-Lex/EROD) nie weryfikowano ponownie: zmiana nie wprowadza nowych operacji przetwarzania, punktem odniesienia pozostaje ocena z bramki wejściowej.

## Werdykt
ZATWIERDZONE Z UWAGAMI

## Zgodność z regułami LR
| LR | Ocena | Uzasadnienie |
|---|---|---|
| LR-1 brak danych w logach/Sentry/analityce | Spełnione | Brak `console.*`, `captureException`, `track`, `posthog` w `components/treningi`; wg raportu bezpieczeństwa także w nowych modułach `lib/`. PostHog w repo tylko serwerowy (zdarzenia Community), więc pytanie otwarte z wejścia zamknięte. Zastrzeżenie: konfiguracja Sentry Replay/breadcrumbs nie była sprawdzana w runtime. |
| LR-2 filtry user_id, brak cache współdzielonego | Spełnione | `userId` wyłącznie z `auth()`, zapytania filtrowane po `userId`, brak nowych endpointów, brak `use cache`/ISR, strona dynamiczna. Nie sprawdzano nagłówków CDN na żywej instancji. |
| LR-3 brak nowych danych/kolumn/storage | Spełnione | Brak nowych kolumn i tabel, brak localStorage/sessionStorage w komponentach, partie mięśni liczone w locie, brak zmian w `app/api/android/*` i Javie. Migracja 0032 to tylko dwa indeksy na `workouts` (kolumny `user_id`, `workout_plan_id`, `date`) - nie zmieniają zakresu, celu ani retencji danych; rejestr czynności i `01-podstawy-prawne-i-retencja.md` nie wymagają zmiany. |
| LR-4 brak zgód/bannerów, retencja | Spełnione | Brak zmian w zgodach, polityce prywatności i `lib/db-retention.ts`; ekran nie tworzy kopii danych. |
| LR-5 dostępność | Spełnione z uwagą | Są odpowiedniki tekstowe (`sr-only`, `aria-label`, opisy typu „Dzień N: wykonany w tym tygodniu"), stan nie tylko kolorem (ptaszek + tekst), `motion-reduce`, cele `h-11` (44 px). Kontrastu, obsługi klawiaturą i Esc nie sprawdzałem w działaniu - opieram się na raporcie UX (`docs/ux/003-...`). |
| LR-6 mikrokopia | Spełnione | Teksty neutralne i opisowe: „Następny · Dzień N", „ostatnio ...", „80 kg × 8", „N tygodnie z rzędu z treningiem" (informacyjnie, bez presji). Brak porad medycznych/dietetycznych, ocen ciała, poczucia winy i rekomendacji ciężarów (pokazywana wyłącznie historia). Uwaga drobna: etykieta aria „jeszcze nie w tym tygodniu" jest opisowa, ale można rozważyć „niewykonany w tym tygodniu". |
| LR-7 licencje ikon | Spełnione | `MuscleGlyph` to własny SVG ze stałej geometrii, bez zdjęć osób; pozostałe ikony z `lucide-react` (już w projekcie, licencja ISC); brak zmian w `package.json`. |
| LR-8 potwierdzenia | Spełnione | „Porzucić trening?" z jasnym skutkiem („Odhaczone serie z tej sesji zostaną usunięte i nie trafią do dziennika. Zapisane wcześniej treningi zostają bez zmian.", przyciski „Porzuć trening" / „Wróć do treningu") oraz „Zacząć nowy trening?" („Nowy trening zastąpi go ...", „Zacznij nowy"). |

## Pozostałe elementy
- Changelog (`components/changelog/changelog-data.ts`): wpis „Zapowiedź — Trening: nowy układ ekranu i sylwetki partii mięśni" ma `planned: true` i `sourceRepo: GYMBRAT_GITHUB_SLUG`. Opis zgodny ze stanem faktycznym, bez obietnic spoza zakresu (brak gwarancji efektów). Uwaga: ostatni punkt („Sekcje techniki, postępów i cardio zastąpiły trzy kafelki Narzędzi") warto zweryfikować z UX, bo w `components/treningi` nadal jest `training-tools-grid.tsx`.
- Polityka prywatności i zgody: bez zmian, i słusznie (brak nowych operacji, odbiorców, danych).
- Pytanie z raportu bezpieczeństwa (D4): plany treningowe (nazwy ćwiczeń, serie, powtórzenia, dni) przekazywane do klienta zalogowanego właściciela nie zawierają wagi ciała ani pomiarów. Oceniam je jako dane o aktywności, a nie o stanie zdrowia, traktowane ostrożnie jak wrażliwe; minimalizacja (ciężary tylko następnego dnia, 3 ćwiczenia) jest wystarczająca. Do potwierdzenia przez prawnika-człowieka.

## Uwagi (niskie ryzyko, backlog)
1. N-4 (CWE-1321, `next-workout-card.tsx:108`, `lastLoads[ex.id]`) pozostaje otwarte w kodzie: brak `Object.hasOwn`. Skutek: najwyżej błędna etykieta aria dla ćwiczenia o id `__proto__`; brak wycieku danych. Właściciel: frontend. Nie blokuje.
2. N-2 (zod, `npm audit`) poza zakresem 003; osobne zadanie, właściciel backend.
3. Wpis changelogu: sprawdzić punkt o „Narzędziach" (patrz wyżej). Właściciel: frontend/ux.
4. Otwarte, niezależnie od 003: luka wyraźnej zgody art. 9 RODO dla danych o ciele, brak uzupełnionych danych administratora i deklaracji dostępności.

## Do zatwierdzenia przez prawnika-człowieka
- Potwierdzenie, że wyświetlanie ciężarów, historii i planów treningowych właścicielowi nie wymaga osobnej zgody art. 9 RODO (podstawa: art. 6 ust. 1 lit. b).
- Teksty potwierdzeń „Porzucić trening?" i „Zacząć nowy trening?" oraz wpis changelogu.
- Odrębne rozwiązanie luki zgody art. 9 dla danych o ciele.
