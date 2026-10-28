# 011 - Redesign ekranu Historia treningów

- **Polecenie użytkownika**: implementacja wg ADR 0010 i makiet UX 011
- **Ścieżka**: pełny przepływ (analiza+ADR+UX już ZATWIERDZONE; faza implementacyjna)
- **Gałąź / PR**: do ustalenia przy PR
- **Status**: w toku (implementacja)

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-26 | `docs/analiza/011-redesign-historii-treningow.md` |
| 2 | Prawo | prawnik | POMINIĘTE | 2026-10-28 | Brak nowych danych osobowych/zdrowotnych, zgód ani treści prawnych — tylko UI i agregacja już pobranych sesji |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-26 | `docs/adr/0010-redesign-historii-treningow.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | `docs/ux/011-redesign-historii-treningow.md`, makieta HTML |
| 5a | Backend | backend | ZATWIERDZONE | 2026-10-28 | `computeHistoryKpis`, `sessionsLimitReached`, `calendarWeekMondayKey`, pole `same` w compare |
| 5b | Frontend | frontend | ZATWIERDZONE | 2026-10-28 | Rozbicie `components/workout-history/*` wg ADR 2.1 + makieta |
| 6 | Testy | tester | ZATWIERDZONE Z UWAGAMI | 2026-10-28 | Unit: overview + compare; lint zmienionych plików OK; pełny `npm run lint` ma wcześniejsze błędy poza zakresem; brak E2E w sesji |
| 7a | Bezpieczeństwo | tester-bezpieczenstwa | POMINIĘTE (wstępnie) | 2026-10-28 | Filtr URL tylko porównywany z znanymi kluczami; bez SQL/XSS; brak zmian auth |
| 7b | Wydajność | tester-wydajnosci | POMINIĘTE (wstępnie) | 2026-10-28 | Zero nowych zapytań; KPI w pamięci ≤400 kart (ADR 4) |

## Weryfikacja
- [x] `npx eslint` na zmienionych plikach — OK
- [x] `npx tsc --noEmit` — OK
- [x] `npx vitest run lib/workout-history-overview.test.ts lib/workout-plan-compare*.test.ts` — OK
- [ ] Pełny `npm run lint` / `npm test` — repo ma wcześniejsze błędy poza 011
- Changelog: wpis `planned: true` w `components/changelog/changelog-data.ts`

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Ekran edycji nadal ma „TYDZIEŃ N” | ADR §6 | backlog | niski |
| Rozjazd tonażu Pulpit vs historia | ADR §6 | backlog | średni |
| `planCompareKey` po nazwie planu | ADR §6 | backlog | średni |
