# 004 - Usprawnienie ekranu aktywnego treningu

- **Polecenie użytkownika**: Usprawnić ekran aktywnego treningu (`components/active-workout/guided-session-layout.tsx` i ekran przerwy `rest-break-screen.tsx`) wg makiety zatwierdzonej w rozmowie: bardziej złote kolory, każda seria zapisywana przyciskiem „Zapisz serię”, zapisane serie/ćwiczenia zielone na pasku postępu, sugestia zwiększenia ciężaru na zielono, obniżenia na czerwono.
- **Ścieżka**: pełna (przebudowa układu głównego ekranu treningu, zmiana zachowania przycisku głównego, nowe stany paska postępu; nie jest drobną poprawką)
- **Gałąź / PR**: feat/error-handling-system (w drzewie są niezatwierdzone zmiany innych zadań, m.in. 001 i 003), PR do założenia
- **Status**: w toku

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
| 2 | Bramka wejściowa | prawnik | | | `docs/prawo/` |
| 3 | Projekt techniczny | architekt | | | `docs/adr/` |
| 4 | Projekt ekranów | ux | | | `docs/ux/` |
| 5 | Implementacja | backend, frontend | | | |
| 6 | Przegląd kodu | architekt | | | |
| 7 | Testy funkcjonalne i spójność | tester, ux | | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | | | `docs/bezpieczenstwo/`, `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | | | `docs/prawo/` |

## Weryfikacja
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run deploy:check` (przed merge)
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Ćwiczenia z masą ciała: zapis 0 kg bez traktowania jako pominięta (`isSkippedWorkoutSet`), wpływ na historię i raporty | analityk (P-2) | właściciel produktu | średni |
| R-2: nietknięty RIR zapisany jako cel planu; przy celu RIR ≥ 2 Live Coach traktuje serie jako łatwe | analityk (P-3) | właściciel produktu | średni |
