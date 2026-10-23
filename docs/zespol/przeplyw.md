# Zespół agentów GymBrat - obowiązkowy przepływ zadania

Repozytorium ma zespół wyspecjalizowanych agentów (definicje w `.claude/agents/`): `analityk`, `prawnik`, `architekt`, `ux`, `backend`, `frontend`, `tester`, `tester-bezpieczenstwa`, `tester-wydajnosci`. Jako główny Claude jesteś koordynatorem: delegujesz pracę agentom (narzędzie Agent, `subagent_type` równe nazwie agenta) i pilnujesz, aby zadanie przeszło przez wszystkie bramki. Agenci nie uruchamiają innych agentów, więc całą koordynację prowadzisz Ty.

Jeśli agent o danej nazwie nie jest dostępny w sesji (np. plik dodano po jej starcie), przeczytaj jego definicję z `.claude/agents/<nazwa>.md` i uruchom agenta ogólnego (`general-purpose`), przekazując całą treść definicji jako jego instrukcję wraz z zadaniem. Przepływ i bramki obowiązują tak samo.

## Kiedy przepływ startuje
Przepływ startuje automatycznie po każdym poleceniu użytkownika, które zmienia aplikację: nowa funkcja, zmiana działania, zmiana wyglądu, poprawka błędu, migracja bazy, zmiana konfiguracji lub wdrożenia. Użytkownik nie musi wywoływać agentów po nazwie.

Przepływu nie uruchamiaj dla pytań, wyjaśnień, przeglądu kodu bez zmian, drobnych poprawek poza kodem produkcyjnym (literówka w dokumentacji) oraz gdy użytkownik wprost wskaże jednego agenta albo napisze, że pomijasz zespół. W razie wątpliwości zapytaj jednym zdaniem, czy uruchomić pełny przepływ.

## Ścieżka skrócona
Dla drobnych poprawek stosuj ścieżkę skróconą zamiast pełnego przepływu. Zadanie kwalifikuje się, gdy spełnia wszystkie warunki:
- poprawia błąd albo drobny szczegół istniejącego działania (bez nowej funkcji i bez zmiany wymagań),
- nie zmienia schematu bazy, kontraktów API (w tym `/api/android/*` i Javy), uwierzytelniania, uprawnień ani zmiennych środowiskowych,
- nie dotyka przetwarzania danych o zdrowiu i ciele, zgód ani dokumentów prawnych,
- obejmuje niewielką liczbę plików w jednym obszarze.

Etapy ścieżki skróconej: `backend` lub `frontend` (poprawka z testem regresji), `architekt` (przegląd kodu), `tester` (weryfikacja poprawki i regresji). Jeśli zmiana dotyka wyglądu, `ux` wykonuje przegląd wizualny. Gdy którykolwiek agent stwierdzi, że warunki nie są spełnione, zadanie przechodzi do pełnego przepływu. Karta zadania, werdykty i wymóg przejścia `npm run lint`, `npx tsc --noEmit` i `npm test` obowiązują tak samo.

## Start zadania
Na początku krótko napisz użytkownikowi, że zadanie wchodzi w przepływ (pełny albo skrócony) i jakie bramki obejmie. Jeśli polecenie jest niejednoznaczne, `analityk` zbiera pytania; zadaj je użytkownikowi zbiorczo, zanim zaczną się kosztowne etapy.

## Etapy
W pełnym przepływie nie pomijaj etapów, nawet gdy zadanie wydaje się małe (drobne poprawki idą ścieżką skróconą). Jeśli etap nie ma zastosowania, agent i tak wydaje werdykt "brak wpływu" z uzasadnieniem. Każdy agent kończy werdyktem ZATWIERDZONE, ZATWIERDZONE Z UWAGAMI albo ODRZUCONE.

1. `analityk`: wymagania i kryteria akceptacji (`docs/analiza/`).
2. `prawnik`: bramka wejściowa, reguły LR, zgody, dokumenty (`docs/prawo/`).
3. `architekt`: projekt techniczny, ADR-y, kontrakty API, zmiany schematu Drizzle (`docs/adr/`).
4. `ux`: specyfikacje i makiety ekranów, gdy zadanie dotyka interfejsu (`docs/ux/`).
5. `backend` i `frontend`: implementacja z testami, równolegle po uzgodnieniu kontraktów.
6. `architekt`: przegląd kodu (czystość, brak duplikatów, brak martwego i pustego kodu, zgodność z regułami repozytorium).
7. `tester` razem z `ux`: testy funkcjonalne i spójność wyglądu aplikacji i komponentów (`docs/testy/`).
8. `ux`: przegląd wizualny zaimplementowanych ekranów.
9. `tester-bezpieczenstwa` i `tester-wydajnosci`, równolegle (`docs/bezpieczenstwo/`, `docs/wydajnosc/`).
10. `prawnik`: bramka wyjściowa, zgodność wdrożenia z regułami LR.
11. Zadanie jest gotowe, gdy wszystkie bramki mają werdykt ZATWIERDZONE lub ZATWIERDZONE Z UWAGAMI.

## Zasady koordynacji
- Dla każdego zadania zakładaj kartę `docs/zadania/<numer>-<nazwa>.md` na podstawie `docs/zadania/_szablon.md`: lista bramek, werdykty, daty, odnośniki do raportów. Aktualizuj ją po każdym etapie.
- Przekazuj agentom pełny kontekst: wyniki poprzednich etapów, ścieżki dokumentów, uwagi do uwzględnienia. Agenci startują bez pamięci rozmowy; stan projektu opisuje baza wiedzy `docs/zespol/wiedza-o-projekcie.md`.
- Werdykt ODRZUCONE cofa zadanie do właściwego etapu (kod do 5, projekt do 3 lub 4, wymagania do 1). Po poprawkach powtórz bramki, na które zmiana mogła wpłynąć. Każda zmiana kodu po etapie 6 wymaga ponownego przeglądu kodu i testów.
- Blokują wydanie: podatności krytyczne i wysokie, przekroczone SLO wydajności w scenariuszu szczytowym, brak wymaganej zgody lub podstawy prawnej, niedziałające testy, odrzucenie przeglądu kodu.
- ZATWIERDZONE Z UWAGAMI dopuszczaj tylko dla uwag niskiego ryzyka; zapisuj je w backlogu z właścicielem.
- Uruchamiaj niezależne etapy równolegle (backend i frontend; tester-bezpieczenstwa i tester-wydajnosci).
- Dokumenty prawne tworzone przez `prawnik` są projektami roboczymi; przypominaj, że przed publikacją musi je zatwierdzić prawnik-człowiek.
- Nie zgłaszaj zadania jako zakończonego, dopóki nie sprawdziłeś, że wszystkie bramki mają werdykt, a `npm run lint`, `npx tsc --noEmit` i `npm test` faktycznie przeszły.

## Zgodność z istniejącymi regułami wdrożeń (`AGENTS.md`)
Przepływ zespołu uzupełnia, a nie zastępuje reguł wdrożeniowych repozytorium.
- Praca idzie na gałęzi i przez PR. Nie pushuj na gałąź produkcyjną i nie commituj bez prośby użytkownika.
- Wpis w `components/changelog/changelog-data.ts` z `planned: true` na PR; po Promote data i bez `planned`.
- Przed merge: `npm run deploy:check` albo agent `.cursor/agents/deploy-guardian.md`. Wynik zapisz w karcie zadania.
- Funkcja zależna od zmiennych środowiskowych: wpis w `lib/admin-config-status.ts` i opis w `env.example`.
- Źródło zmian produkcyjnych: wyłącznie repozytorium `damianchmielewski33-cmyk/GymBrat`.
- Przed kodem zależnym od frameworka czytaj `node_modules/next/dist/docs/` (zob. `AGENTS.md`).

## Standardy wspólne
- Dane o ciele i zdrowiu (waga, pomiary, zdjęcia, posiłki) to dane wrażliwe: minimalizacja, zgody, brak w logach i Sentry.
- Jedna funkcjonalność w jednym miejscu; jeden komponent w jednym katalogu komponentów; brak martwego kodu, pustych metod i zdublowanych funkcji.
- Interfejs po polsku; spójna mikrokopia.
- Dokumentacja zespołu w `docs/`: `analiza/`, `prawo/`, `adr/`, `ux/`, `testy/`, `bezpieczenstwo/`, `wydajnosc/`, `zadania/`. Istniejące dokumenty w `docs/` zostają bez zmian.
