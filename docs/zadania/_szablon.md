# <numer> - <nazwa zadania>

- **Polecenie użytkownika**: <treść polecenia>
- **Ścieżka**: pełna / skrócona (uzasadnienie)
- **Gałąź / PR**: <gałąź>, <link do PR>
- **Status**: w toku / gotowe / wstrzymane

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | | | `docs/analiza/` |
| 2 | Bramka wejściowa | prawnik | | | `docs/prawo/` |
| 3 | Projekt techniczny | architekt | | | `docs/adr/` |
| 4 | Projekt ekranów | ux | | | `docs/ux/` |
| 5 | Implementacja | backend, frontend | | | |
| 6 | Przegląd kodu | architekt | | | |
| 7 | Testy funkcjonalne i spójność | tester, ux | | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | | | `docs/bezpieczenstwo/`, `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | | | `docs/prawo/` |

W ścieżce skróconej usuń wiersze etapów, które jej nie dotyczą.

## Weryfikacja
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run deploy:check` (przed merge)
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
