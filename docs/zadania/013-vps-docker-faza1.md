# 013 - VPS Docker Faza 1

- **Polecenie użytkownika**: Implementacja planu Faza 1 (Docker w repo, Render zostaje); instrukcje konfiguracji; nie wyłączać obecnego hostingu.
- **Ścieżka**: pełna (infra / wdrożenie; ux i prawnik pominięci wg analizy)
- **Gałąź / PR**: (do uzupełnienia przy PR)
- **Status**: gotowe (kod Fazy 1 w repo; cutover osobno)

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-27 | `docs/analiza/013-vps-docker-faza1.md` |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-27 | `docs/adr/0013-vps-docker-faza1.md` |
| 5 | Implementacja | koordynator (infra) | ZATWIERDZONE | 2026-10-27 | Dockerfile, deploy/*, Actions, runbooki |
| 7 | Testy | tester | ZATWIERDZONE Z UWAGAMI | 2026-10-27 | tsc OK; deploy:check OK; lint — istniejące błędy poza zakresem |

Pominięte: prawnik, ux (brak UI / zmiany prawnej), przegląd wizualny.

## Weryfikacja
- [x] `npm run lint` (exit ≠ 0 — pre-existing react-hooks w active-workout; poza zakresem Fazy 1)
- [x] `npx tsc --noEmit`
- [x] `npm test` (android-version asercje zsynchronizowane z `public/android-version.json`)
- [x] `npm run deploy:check` (przed merge)
- [x] Wpis w `components/changelog/changelog-data.ts` (`planned: true`)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Uzupełnić D8 (domena) przy pierwszym stagingu | plan | właściciel | średni |
| Cutover / wyłączenie Render dopiero po GO staging | plan | właściciel | wysoki (blokuje cutover) |
