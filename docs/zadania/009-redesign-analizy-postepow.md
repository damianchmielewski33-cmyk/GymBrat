# 009 - Redesign modułu Analiza postępów

- **Polecenie użytkownika**: Zbudować od nowa moduł "Analiza postępów" (zakładki Przegląd, Siła, Sylwetka, Tygodnie oraz szczegół ćwiczenia) na poziomie topowych aplikacji fitness-analytics — zgodnie z makietami i ADR 0008.
- **Ścieżka**: pełna (etapy 1–4 zamknięte dokumentami; etap 5 implementacja).
- **Gałąź / PR**: bieżąca gałąź robocza.
- **Status**: implementacja w toku (etap 5)

## Dokumenty
- Analiza: `docs/analiza/009-redesign-analizy-postepow.md`
- ADR: `docs/adr/0008-redesign-analizy-postepow.md`
- UX: `docs/ux/009-redesign-analizy-postepow.md`, makieta `docs/ux/009-redesign-analizy-postepow-makieta.html`

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-26 | `docs/analiza/009-redesign-analizy-postepow.md` |
| 2 | Bramka wejściowa | prawnik | POMINIĘTA | | |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-26 | `docs/adr/0008-redesign-analizy-postepow.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | `docs/ux/009-redesign-analizy-postepow.md` + makieta |
| 5 | Implementacja | backend, frontend | W TOKU | 2026-10-28 | UI makieta + `resolveProgressStart`, tonnage przy complete |

## Weryfikacja
- [x] Przegląd: hero „Ten tydzień” (DayStrip ikony siła/cardio), Gotowość z /100, Postęp 30 dni, Cele; stan pierwszego użycia
- [x] Siła: jedna lista + filtry + intensywność zwinięta (już w kodzie)
- [x] `resolveProgressStart` — jedna definicja startu (hub / body / photos)
- [x] `tonnageKg` przy `/api/workouts/complete`
- [x] Changelog `planned: true`
- [ ] Pełne testy `tester` + pomiar `tester-wydajnosci` na realnych danych
- [ ] Backfill historycznych `tonnage_kg` na produkcji (`scripts/backfill-workout-tonnage.ts`)

## Uwagi do backlogu
| Uwaga | Źródło | Właściciel | Priorytet |
|---|---|---|---|
| W6 agregacja posiłków 0 vs brak danych | ADR §8 | backend żywienia | średni |
| Indeks `idx_workouts_user_tonnage` po pomiarze | ADR §3.1 | tester-wydajnosci | niski |
