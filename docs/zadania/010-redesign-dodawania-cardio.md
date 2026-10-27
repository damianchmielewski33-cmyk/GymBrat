# 010 - Redesign ekranu "Dodaj cardio"

- **Polecenie użytkownika**: Zrobić analizę UX i architektoniczną arkusza "Dodaj cardio" (zrzut ekranu dołączony), sprawdzić czy wszystkie wymagane dane są zbierane i odpowiednio walidowane do wyliczania cardio dodatkowego, poprawić architekturę ekranu oraz poprawić go wizualnie. Na tym etapie BEZ ZMIAN W KODZIE: tylko analiza, architektura i makieta.
- **Ścieżka**: pełna, ograniczona do etapów analityczno-projektowych (etapy 1, 3, 4). Implementacja (5+) dopiero po akceptacji użytkownika - zastrzeżone wprost w poleceniu.
- **Gałąź / PR**: feat/koniec-treningu-flow (robocza, bez PR na tym etapie).
- **Status**: w toku - etapy 1, 3, 4 zakończone; czeka na akceptację właściciela przed etapem 5.

## Dokumenty
- Wymagania: `docs/analiza/010-redesign-dodawania-cardio.md` (analityk) - mapa pól, F-1..F-14 (luki danych/walidacji), U-1..U-12 (luki UX), BR-1..BR-11, user stories, Q-C1..Q-C5.
- Architektura: `docs/adr/0009-redesign-dodawania-cardio.md` (architekt) - jeden model walidacji bez cichych `null`, limit minut 600 (jedna stała klient+serwer), definicja tygodnia pn-nd dla arkusza, naprawa F-13 (`handledIdRef`), kontrakt `fieldErrors`, podział komponentu na 5 plików.
- UX: `docs/ux/010-redesign-dodawania-cardio.md` + makieta `docs/ux/010-redesign-dodawania-cardio-makieta.html` (ux) - hierarchia sekcji (minuty dominujące, szczegóły zwinięte), postęp tygodnia w nagłówku, walidacja inline, bez przekierowania po zapisie.

## Decyzja o bramkach (etap 1, potwierdzona przez koordynatora)
- `prawnik` - POMINIĘTY. Redesign nie wprowadza nowej kategorii danych ani celu przetwarzania (te same pola co dziś). Architekt potwierdził tę ocenę w ADR 0009 sekcja 3. Ponowna ocena przy nowym polu zdrowotnym lub zgodzie.
- `architekt` - TAK (etap 3, wykonane).
- `ux` - TAK (etap 4, wykonane).
- `backend` / `frontend` - odłożone do etapu implementacji (po akceptacji właściciela).
- `tester` - odłożone, pełny plan testów zaplanowany (logika dnia lokalnego/tygodnia).
- `tester-bezpieczenstwa` - analityk zarekomendował TAK na etapie implementacji (zmiana parsowania danych wejściowych, w tym zdrowotnych) - do uwzględnienia przy starcie etapu 5, nie teraz.
- `tester-wydajnosci` - odłożone, wejdzie warunkowo (nowe lekkie zapytanie tygodniowe dla kafelka głównego, ADR 0009 sekcja 2.4).

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE (do akceptacji użytkownika) | 2026-10-26 | `docs/analiza/010-redesign-dodawania-cardio.md` |
| 2 | Bramka wejściowa | prawnik | POMINIĘTA (uzasadnienie wyżej) | | |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE (do akceptacji użytkownika) | 2026-10-26 | `docs/adr/0009-redesign-dodawania-cardio.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | `docs/ux/010-redesign-dodawania-cardio.md`, makieta `docs/ux/010-redesign-dodawania-cardio-makieta.html` |
| 5 | Implementacja | backend, frontend | pominięte w tym zadaniu (po akceptacji) | | |
| 6 | Przegląd kodu | architekt | pominięte (wg wyjątku - decyzja po etapie 5) | | |
| 7 | Testy funkcjonalne i spójność | tester | pominięte w tym zadaniu | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | pominięte w tym zadaniu | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | pominięte w tym zadaniu (wymagane przy implementacji) | | `docs/bezpieczenstwo/`, `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | POMINIĘTA (jw.) | | |

## Odpowiedź na pytanie "czy kalorie są brane pod uwagę do wyliczenia cardio dodatkowego" (potwierdzone kodem, ADR 0009 sekcja 1)
Nie. `countableCardioMinutes()` (`lib/workout-cardio-attribution.ts:46-55`) liczy wyłącznie minuty. Dystans, tętno, kalorie, kroki i wysiłek to metadane do analizy obciążenia/stref, nie wpływają na cel tygodniowy. Nowy projekt `ux` to komunikuje wprost (sekcja minut jako dominująca/wymagana, reszta w zwiniętej sekcji "Szczegóły (opcjonalne)" + zdanie mikrokopii z ADR 0009 sekcja 2.8).

## Rozbieżność do uzgodnienia przed etapem 5 (ważne dla `frontend`)
`ux` przygotował makietę i specyfikację **zanim** ADR 0009 powstał (praca równoległa, nieunikniona przy tym zleceniu), więc sekcje 7 i 9 `docs/ux/010-redesign-dodawania-cardio.md` zawierają **własne, tymczasowe nazwy** kontraktu propsów/wyniku akcji, oznaczone w dokumencie jako `[ADR 0009 - kontrakt do potwierdzenia]`. Po przeczytaniu obu dokumentów stwierdzam rozbieżność nazewniczą (nie merytoryczną - liczby i reguły się zgadzają: limit 600 min, pozostanie w kontekście po zapisie, tydzień pn-nd jako kanoniczny dla arkusza):

| | ADR 0009 (wiążący kontrakt) | UX 010 (założenie robocze) |
|---|---|---|
| Prop postępu tygodnia | `weekProgress: { minutesCompleted, goalMinutes, weekLabel }` | `weeklyCardio: { goalMinutes, doneMinutes, windowLabel, windowStartKey, windowEndKey }` |
| Wynik zapisu (sukces) | `{ ok: true; id; weekMinutesAfter }` | `{ ok: true; id; minutes; dateKey; weekProgress: { doneMinutes; goalMinutes; windowLabel } }` |
| Wynik zapisu (błąd) | `{ ok: false; error?; fieldErrors?: { field; message }[] }` | zgodne (`fieldErrors` + `error`) |

Zgodnie z zasadą projektu ("rozbieżność rozstrzyga ADR w zakresie kontraktu danych, UX w zakresie wyglądu i kolejności") **wiążący jest kontrakt z ADR 0009 sekcja 6**. `frontend` ma budować względem propsów/typów z ADR, a specyfikację `ux` czytać wyłącznie pod kątem układu, hierarchii, mikrokopii i stanów wizualnych - nie kopiować nazw pól z sekcji 7/9 dokumentu ux 1:1. To nie blokuje akceptacji tego etapu (merytorycznie oba dokumenty są spójne), ale wymaga odnotowania w briefie dla `backend`/`frontend` przy starcie etapu 5.

## Pytania do właściciela (nieblokujące, pełna lista w ADR 0009 sekcja 5 i UX 010 sekcja ~13)
- **Q-C1**: po zapisie zostać w arkuszu (rekomendacja architekta i ux, założenie robocze) czy zachować dzisiejsze przekierowanie na `/cardio/[id]`?
- **Q-C2**: limit 600 min w jednym wpisie (rekomendacja architekta, założenie robocze) - czy wystarcza na skrajne przypadki (długie wycieczki, triathlon)?
- **Q-C3**: definicja tygodnia w arkuszu = poniedziałek-niedziela (rekomendacja architekta), ze świadomym, tymczasowym rozjazdem wobec kafelka głównego (który zostaje na oknie kroczącym 7 dni, poza zakresem tego zadania) - zaakceptować rozjazd, czy rozszerzyć zadanie o ujednolicenie `lib/cardio.ts`/`lib/cardio-hub.ts`?
- **Q-C6** (nowe, ADR 0009 sekcja 2.10): przy edycji istniejącego wpisu > 600 min po obniżeniu limitu - blokować zapis, czy dopuścić "grandfathering" wartości historycznej, gdy pole minut nie jest zmieniane?
- **Q-C7** (nowe, ADR 0009 sekcja 2.10): czy ujednolicenie walidacji edycji wpisów cardio (`cardio-detail-client.tsx`, `workout-finished-screen.tsx`) wg tego samego wzorca to kolejne zadanie od razu, czy odłożone bez terminu?

## Weryfikacja
- [x] Brak zmian w kodzie produkcyjnym na etapach 1, 3, 4 (tylko dokumenty `docs/`).
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test` - nie dotyczy etapu analityczno-projektowego; uruchomić przed implementacją.
- [ ] `npm run deploy:check` - przed merge (etap implementacji).
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`) - przy PR implementacji.

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Nazewnictwo kontraktu propsów/wyniku akcji w `docs/ux/010-...md` (sekcje 7, 9) nie zgadza się z ADR 0009 sekcja 6 - do ujednolicenia nazw w dokumentacji albo zignorowania na rzecz ADR przy implementacji | koordynator (porównanie ADR vs ux) | frontend + architekt | średni |
| Dwie definicje tygodnia cardio (`lib/cardio.ts` rolling-7-dni vs `lib/cardio-hub.ts` pn-nd) pozostają w kodzie poza zakresem tego zadania - ryzyko przyszłej niespójności | architekt (ADR 0009 sekcja 4) | architekt (osobne zadanie) | średni |
