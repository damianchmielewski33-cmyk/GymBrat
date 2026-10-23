# Zespół agentów GymBrat

Dziewięciu wyspecjalizowanych agentów Claude Code. Definicje są w `.claude/agents/` (jedyne źródło), każdy plik `.md` to osobny agent; Claude Code wczytuje je automatycznie przy starcie sesji. Przepływ pracy opisuje `docs/zespol/przeplyw.md`, importowany przez `CLAUDE.md`, więc obowiązuje w każdej sesji Claude Code w tym repozytorium.

## Jak zacząć
Otwórz Claude Code w katalogu repozytorium i napisz polecenie zmieniające aplikację, np. "Dodaj możliwość kopiowania poprzedniego treningu". Claude jako koordynator prowadzi zadanie przez bramki (pełny przepływ albo ścieżkę skróconą dla drobnych poprawek). Nie musisz wywoływać agentów po nazwie. Po zmianie plików w `.claude/agents/` uruchom Claude Code ponownie, aby je wczytał.

## Modele
Agenci budujący i oceniający kod (`architekt`, `ux`, `backend`, `frontend`, `tester-bezpieczenstwa`) dziedziczą model sesji. Agenci dokumentacyjni i testowi (`analityk`, `prawnik`, `tester`, `tester-wydajnosci`) działają na `sonnet` (pole `model:` we frontmatterze), aby ograniczyć koszt przepływu.

Pojedynczego agenta możesz wywołać wprost, np. "Użyj agenta tester-wydajnosci, aby sprawdzić ekran postępów".

## Role
| Agent | Odpowiada za |
|---|---|
| analityk | wymagania, user stories, kryteria akceptacji, reguły biznesowe |
| prawnik | RODO, dane o zdrowiu i ciele, regulamin, polityka prywatności, zgody; bramka wejściowa i wyjściowa |
| architekt | decyzje techniczne, ADR-y, model danych, kontrakty API; strażnik czystości kodu, brak duplikatów i martwego kodu |
| ux | przepływy, makiety, system projektowy, standard wyglądu ekranów; właściciel wzorca spójności |
| backend | server actions, API, Drizzle, uwierzytelnianie, Java backend |
| frontend | implementacja interfejsów zgodnie z projektem ux |
| tester | testy funkcjonalne i E2E, spójność wyglądu aplikacji i komponentów (razem z ux) |
| tester-bezpieczenstwa | modelowanie zagrożeń, przegląd kodu, skanery, testy penetracyjne lokalnie |
| tester-wydajnosci | obciążenie, Core Web Vitals, zapytania do bazy, limity darmowych planów |

## Przepływ
analityk, prawnik (wejście), architekt, ux, backend i frontend, architekt (przegląd kodu), tester z ux, ux (przegląd wizualny), tester-bezpieczenstwa i tester-wydajnosci, prawnik (wyjście). Każdy etap kończy się werdyktem ZATWIERDZONE / ZATWIERDZONE Z UWAGAMI / ODRZUCONE. Odrzucenie cofa zadanie do właściwego etapu.

## Uwagi
- Prawnik jest asystentem AI. Regulamin, politykę prywatności i zgody musi przed publikacją zatwierdzić prawnik-człowiek.
- Zespół działa w ramach istniejących reguł wdrożeń z `AGENTS.md` (PR, Preview, Promote, changelog, `deploy:check`).
- Zespół nie commituje ani nie wypycha zmian bez Twojej prośby.
