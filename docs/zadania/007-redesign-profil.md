# 007 - Redesign ekranu Profil

- **Polecenie użytkownika**: zrobić analizę techniczną i wizualną ekranu Profil, zaproponować nowy wygląd oraz zmiany architektoniczne/techniczne/wizualne, sprawdzić poprawność przekazywanych i wyliczanych wartości, napisać nową architekturę i zrobić makietę — następnie wdrożyć według pakietu dokumentów.
- **Ścieżka**: pełna (projekt + implementacja).
- **Gałąź / PR**: bieżąca gałąź robocza.
- **Status**: implementacja w toku (etap 5)

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-25 | `docs/analiza/007-redesign-profil.md` |
| 2 | Bramka wejściowa | prawnik | ZATWIERDZONE Z UWAGAMI | 2026-10-25 | `docs/prawo/006-redesign-profil-ocena-wejsciowa.md` |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-25 | `docs/adr/0006-redesign-profil.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-25 | `docs/ux/007-redesign-profil.md`, makieta `docs/ux/007-redesign-profil-makieta.html` |
| 5 | Implementacja | backend + frontend | W TOKU | 2026-10-28 | kod: `app/(dashboard)/profile/(settings)/*`, `lib/current-weight.ts`, `lib/consents.ts`, `user_consents` |

## Weryfikacja
- [x] Trasy podstron profilu + przegląd; `workout-plan` poza layoutem ustawień (U-5)
- [x] `getCurrentWeightKg` + write-through z formularza ciała do `weight_logs`
- [x] Puste placeholdery ciała (bez 80/180/25); aktywność bez wymuszania domyślnej (U-3)
- [x] Makro posiłków `{ training, rest }` + konsumenci po typie dnia
- [x] Tabela `user_consents` + zapis serwerowy zgód (cache localStorage)
- [ ] Pełne przejście wszystkich formularzy na `ProfileSaveBlock` (częściowo: komponent gotowy, podłączone zgody/konflikt diety)
- [ ] Bramka PostHog po `getCurrentConsents` (poza ADR jako osobne zadanie — warunek Promote wg prawnika)
- [ ] Przegląd `tester` / `tester-bezpieczenstwa` / bramka wyjściowa prawnik

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Bramka serwerowa PostHog na `getCurrentConsents` | prawnik / ADR §10 | backend | P1 (Promote) |
| Dokończyć `ProfileSaveBlock` na cardio/reminders/delta | ADR §5 | frontend | P2 |
| Kolumna `weight_logs.source` (etykieta pochodzenia) | ADR §11 | architekt | P3 |
