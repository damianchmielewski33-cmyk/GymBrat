# 001 - Rejestracja: stały kod 1234 i łączenie kont OAuth

- **Polecenie użytkownika**: "Zaczynamy od zadania 1 (rejestracja: kod 1234 i łączenie kont OAuth), pełnym przepływem. Lint liczymy jako 'bez nowych błędów', dopóki nie naprawimy linii bazowej."
- **Ścieżka**: pełna (zmiana uwierzytelniania)
- **Gałąź / PR**: feat/error-handling-system (bieżąca; osobna gałąź i PR do ustalenia z właścicielem przed commitem), PR: brak
- **Status**: w toku
- **Źródło**: backlog P0 #1, podatność W1 w `docs/bezpieczenstwo/00-model-zagrozen-bazowy.md`, decyzje D3, D4, D6 w `docs/zespol/decyzje-wlasciciela.md`

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania (rewizja po bramce prawnej 2026-10-23) | analityk | ZATWIERDZONE Z UWAGAMI (DW-1, DW-3, DW-4 rozstrzygnięte w `docs/zespol/decyzje-wlasciciela.md`) | 2026-10-23 | `docs/analiza/001-rejestracja-kod-i-oauth.md` |
| 2 | Bramka wejściowa | prawnik | ZATWIERDZONE Z UWAGAMI (analiza robocza, do zatwierdzenia przez prawnika-człowieka; reguły LR-19 do LR-30; zmiana BR-7/DW-2 u analityka; ocena incydentu przed Promote) | 2026-10-23 | `docs/prawo/001-bramka-wejsciowa-rejestracja.md` |
| 3 | Projekt techniczny | architekt | | | `docs/adr/` |
| 4 | Projekt ekranów | ux | | | `docs/ux/` |
| 5 | Implementacja | backend, frontend | | | |
| 6 | Przegląd kodu | architekt | | | |
| 7 | Testy funkcjonalne i spójność | tester, ux | | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | | | `docs/bezpieczenstwo/`, `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | | | `docs/prawo/` |

## Weryfikacja
Decyzja właściciela (2026-10-23): dopóki linia bazowa nie zostanie naprawiona (backlog #13, #14), `npm run lint` liczy się jako zaliczony, gdy zadanie nie dodaje nowych błędów względem linii bazowej (114 błędów, 40 ostrzeżeń - `docs/testy/00-stan-testow.md`). Analogicznie `npm test`: bez nowych nieudanych plików poza 4 znanymi.
- [ ] `npm run lint` (bez nowych błędów)
- [ ] `npx tsc --noEmit`
- [ ] `npm test` (bez nowych niepowodzeń)
- [ ] `npm run deploy:check` (przed merge)
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
