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

Etapy ścieżki skróconej: `backend` lub `frontend` (poprawka z testem regresji), `tester` (szybka weryfikacja poprawki i najbliższego otoczenia, w tym spójność wyglądu wg systemu projektowego `ux`, bez pełnego planu testów i bez udziału `ux`). `architekt` i `ux` wchodzą tylko w wyjątkach opisanych w etapach pełnego przepływu (niepewność projektowa, zmiana kontraktu/schematu, niejednoznaczne odstępstwo wizualne). Gdy którykolwiek agent stwierdzi, że warunki nie są spełnione, zadanie przechodzi do pełnego przepływu. Karta zadania, werdykty i wymóg przejścia `npm run lint`, `npx tsc --noEmit` i `npm test` obowiązują tak samo.

## Dobór modeli (koszt tokenów)
Agenci mają w `.claude/agents/<nazwa>.md` domyślny model dobrany do kosztu ich pracy: tani model (`haiku`) dla `analityk`, `prawnik`, `ux`, `tester`, `tester-bezpieczenstwa`, `tester-wydajnosci` (zbieranie wymagań, dokumenty, testy, przegląd bezpieczeństwa i wydajności - praca w dużej mierze odtwarzalna wg szablonu); średni model (`sonnet`) dla `backend`, `frontend`, `architekt` (tworzenie kodu produkcyjnego i decyzje architektoniczne). Nie uruchamiaj żadnego etapu na `opus` bez wyraźnej prośby użytkownika.

Domyślny model z definicji agenta wystarcza w większości zadań. Koryguj go przy wywołaniu (`Agent` → parametr `model`) tylko w dwie strony:
- **W dół, do `haiku`**, gdy etap jest mechaniczny mimo że agent jest "drogi": `backend`/`frontend` wprowadzają trywialną, dobrze opisaną poprawkę (literówka w logice, zmiana komunikatu, drobna korekta stylu) ze ścieżki skróconej.
- **W górę, do `sonnet`**, gdy etap tani domyślnie trafia na coś wymagającego: `analityk` ma sprzeczne lub bardzo niejasne wymagania; `prawnik` ocenia nowe, nietrywialne przetwarzanie danych o zdrowiu/RODO albo nowy obszar prawny; `ux` projektuje nowy ekran/przepływ od zera (nie przegląd istniejącego); `tester`/`tester-bezpieczenstwa`/`tester-wydajnosci` trafiają na złożoną logikę domenową (okna czasowe, autoryzacja, wydajność zapytań) albo podatność/regresję trudną do jednoznacznej oceny - wtedy `tester` robi też pełny plan testów zamiast testów podstawowych.

Domyślnie po implementacji `tester` robi tylko szybkie testy podstawowe (ścieżka główna + najważniejsze przypadki brzegowe) na `haiku`, a `architekt` nie wykonuje przeglądu kodu (patrz etapy 5-6 i wyjątek przy etapach) - to dwie największe oszczędności w przepływie. Nie traktuj tego jako obniżenia jakości na stałe: gdy `tester` albo `backend`/`frontend` zgłoszą wątpliwość, włącz pełny plan testów i/lub przegląd `architekt` dla tej konkretnej zmiany.

Zasada ogólna: twórz i projektuj (kod, architektura) na `sonnet`, odtwarzaj i sprawdzaj (testy, przeglądy, dokumenty wg szablonu) na `haiku`; przełączaj model lub zakres tylko gdy złożoność konkretnego zadania wyraźnie odbiega od typowej dla danej roli - nie rozszerzaj zakresu "na wszelki wypadek".

## Start zadania
Na początku krótko napisz użytkownikowi, że zadanie wchodzi w przepływ (pełny albo skrócony) i jakie bramki obejmie. Jeśli polecenie jest niejednoznaczne, `analityk` zbiera pytania; zadaj je użytkownikowi zbiorczo, zanim zaczną się kosztowne etapy.

## Dobór ról (który agent jest wywoływany)
Na etapie 1 `analityk` decyduje, które z bramek niżej są potrzebne do tego konkretnego zadania, i zapisuje decyzję z jednozdaniowym uzasadnieniem w karcie zadania. Bramkę uznaną za niepotrzebną **pomijasz całkowicie - nie wywołujesz tego agenta w ogóle**, nawet po to, by wydał werdykt "brak wpływu". To dotyczy każdej bramki warunkowej:
- `prawnik` (etap 2): pomijany, gdy zadanie nie wprowadza i nie zmienia przetwarzania danych osobowych/zdrowotnych, zgód, treści prawnych ani niczego, co mogłoby mieć znaczenie prawne.
- `ux` - makiety (etap 4): pomijany, gdy zadanie nie dotyka interfejsu (np. zmiana czysto backendowa).
- `tester-bezpieczenstwa` / `tester-wydajnosci` (etap 7): każdy pomijany niezależnie, gdy zadanie nie dotyka odpowiednio bezpieczeństwa (auth, uprawnienia, dane wejściowe, sekrety) albo wydajności (nowe zapytania, duże listy, obciążenie).

`architekt` (projekt techniczny, etap 3) i `tester` (testy podstawowe, etap 6) są potrzebne praktycznie zawsze przy zmianie kodu produkcyjnego - pomijaj je tylko gdy zadanie w ogóle nie zmienia kodu (np. czysta dokumentacja). Jeśli w trakcie pracy okaże się, że pominięta bramka jest jednak potrzebna (np. implementacja zaczęła dotykać danych zdrowotnych), wywołaj odpowiedniego agenta wtedy - decyzja z etapu 1 nie jest nieodwracalna.

## Etapy
W pełnym przepływie nie pomijaj etapów uznanych za potrzebne (patrz "Dobór ról" wyżej), nawet gdy zadanie wydaje się małe (drobne poprawki idą ścieżką skróconą). Każdy wywołany agent kończy werdyktem ZATWIERDZONE, ZATWIERDZONE Z UWAGAMI albo ODRZUCONE.

1. `analityk`: wymagania, kryteria akceptacji (`docs/analiza/`) i decyzja, które bramki poniżej są potrzebne (patrz "Dobór ról").
2. `prawnik` - tylko gdy potrzebny: bramka wejściowa, reguły LR, zgody, dokumenty (`docs/prawo/`). Jedna ocena na zadanie wystarcza - nie ma osobnej, zawsze wymaganej bramki wyjściowej; wracaj do `prawnik` po implementacji tylko wyjątkowo, gdy zmieniło się coś prawnie istotne względem ustaleń z etapu 2.
3. `architekt`: projekt techniczny, ADR-y, kontrakty API, zmiany schematu Drizzle (`docs/adr/`).
4. `ux` - tylko gdy zadanie dotyka interfejsu: specyfikacje i makiety ekranów (`docs/ux/`).
5. `backend` i `frontend`: implementacja z testami, równolegle po uzgodnieniu kontraktów. Czystość kodu (brak duplikatów, martwego i pustego kodu, zgodność z regułami repozytorium) sprawdzają sami przed zgłoszeniem gotowości - po implementacji nie ma już domyślnie osobnego przeglądu kodu architekta (patrz "Dobór modeli" i wyjątek poniżej).
6. `tester`: szybkie testy podstawowe (ścieżka główna funkcji + najważniejsze przypadki brzegowe) oraz spójność wyglądu aplikacji i komponentów wg systemu projektowego `ux` z `docs/ux/` (`docs/testy/`) - samodzielnie, bez udziału `ux`. Pełny plan testów tylko dla obszarów wysokiego ryzyka (patrz "Dobór modeli"). Gdy odstępstwo wizualne jest niejednoznaczne (nie wiadomo, czy to błąd implementacji czy luka w projekcie), wezwij `ux` wyjątkowo do oceny - w przeciwnym razie `ux` nie robi osobnego przeglądu po implementacji.
7. `tester-bezpieczenstwa` i `tester-wydajnosci` - każdy tylko gdy potrzebny, równolegle (`docs/bezpieczenstwo/`, `docs/wydajnosc/`).
8. Zadanie jest gotowe, gdy wszystkie wywołane bramki mają werdykt ZATWIERDZONE lub ZATWIERDZONE Z UWAGAMI.

**Wyjątek - przegląd architekta po implementacji**: wezwij `architekt` ponownie po etapie 5 tylko gdy `backend`/`frontend` zgłosi niepewność co do projektu, zmiana dotyka kontraktu API/Android/Javy, schematu bazy lub wielu modułów naraz, albo `tester` znajdzie defekt wskazujący na problem strukturalny. W pozostałych przypadkach (typowa implementacja zgodna z ADR z etapu 3) pomiń ten przegląd - to największa oszczędność tokenów w przepływie.

## Zasady koordynacji
- Dla każdego zadania zakładaj kartę `docs/zadania/<numer>-<nazwa>.md` na podstawie `docs/zadania/_szablon.md`: lista bramek, werdykty, daty, odnośniki do raportów. Aktualizuj ją po każdym etapie.
- Przekazuj agentom pełny kontekst: wyniki poprzednich etapów, ścieżki dokumentów, uwagi do uwzględnienia. Agenci startują bez pamięci rozmowy; stan projektu opisuje baza wiedzy `docs/zespol/wiedza-o-projekcie.md`.
- Werdykt ODRZUCONE cofa zadanie do właściwego etapu (kod do 5, projekt do 3 lub 4, wymagania do 1). Po poprawkach powtórz bramki, na które zmiana mogła wpłynąć. Każda zmiana kodu po etapie 5 wymaga ponownych testów przez `tester`.
- Decyzja z etapu 1, które bramki pomijasz, obowiązuje do końca zadania, o ile charakter zmiany się nie zmieni; wtedy wywołaj pominiętą bramkę wyjątkowo (patrz "Dobór ról").
- Blokują wydanie: podatności krytyczne i wysokie, przekroczone SLO wydajności w scenariuszu szczytowym, brak wymaganej zgody lub podstawy prawnej, niedziałające testy.
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
