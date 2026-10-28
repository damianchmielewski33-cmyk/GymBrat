# 008 - Redesign tworzenia i zarządzania planem treningowym

- **Polecenie użytkownika**: Ekran tworzenia planu treningowego (profil) ma bardzo duży bałagan techniczny i wizualny. Zrobić analizę techniczną i wizualną obecnego ekranu, zaprojektować całość od nowa: nowa architektura/flow tworzenia planu, nowa, lepsza baza ćwiczeń, czytelny i zwandowany atlas ćwiczeń. Plany treningowe mają być ustawiane WYŁĄCZNIE z paska bocznego (nie z ekranu profilu). Funkcja "Stwórz plan treningowy z AI" ma zniknąć całkowicie (nie ma jej dotyczyć żadna dalsza praca). Na tym etapie: BEZ ZMIAN W KODZIE — tylko analiza, plan zmian i makiety (HTML).
- **Aktualizacja (implementacja)**: użytkownik zlecił wykonanie zadania na podstawie analizy i makiet (etap 5+).
- **Ścieżka**: pełna
- **Gałąź / PR**: lokalna robocza (bez pusha bez prośby)
- **Status**: implementacja domknięta względem ADR 0007 + UX 008 — oczekuje testów / Preview

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-26 | `docs/analiza/008-redesign-planu-treningowego.md` |
| 2 | Prawnik | — | POMINIĘTY | 2026-10-26 | brak nowego publicznego UGC; notatki prywatne — LR w backlogu (eksport/usuwanie konta) |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-26 | `docs/adr/0007-redesign-planu-treningowego.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | `docs/ux/008-redesign-planu-treningowego.md`, makieta HTML |
| 5 | Implementacja | backend + frontend (koordynator) | DONE (lokalnie) | 2026-10-28 | `/plany`, atlas+karta+notatki, import pewność, admin CRUD+YouTube, sort_order, usunięcie AI |
| 6 | Testy | tester | Oczekuje | — | po zielonym `tsc` / `npm test` |
| 7 | Bezpieczeństwo | tester-bezpieczenstwa | Oczekuje | — | import dwuetapowy |
| 7b | Wydajność | tester-wydajnosci | POMINIĘTY (na razie) | — | katalog cache'owany; wrócić przy rastrowych grafikach |

## Rozstrzygnięcia przy implementacji
- Karta ćwiczenia: arkusz / query `?cwiczenie=` (UX Q-A9).
- Odpoczynek w wierszu ćwiczenia: poza v1 (brak w `WorkoutPlanPayload`).
- FAB Raport: nie na `/plany*`.
- Belka dolna ukryta w edytorze / imporcie / nowym planie.
- Kolejność dni: kolumna `sort_order` + tryb „Zmień kolejność” (↑↓), nie drag-and-drop.

## Weryfikacja
- Changelog: wpis `planned: true` w `components/changelog/changelog-data.ts`.
- `YOUTUBE_API_KEY` w `lib/admin-config-status.ts` + `env.example`.
- Seed: `scripts/seed-exercises-from-catalog.ts` (+ auto-seed przy pierwszym odczycie).

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Prywatna notatka w eksporcie/usuwaniu konta | ux Q-A6 | prawnik | średni |
| Treści opisów/cue dla atlasu (BR-11) | ux | właściciel produktu | niski |
| Encja programu tygodniowego | ADR 2.3 | architekt | niski (v1.1) |
