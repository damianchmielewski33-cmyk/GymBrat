# 010 - Redesign ekranu "Dodaj cardio"

- **Polecenie użytkownika**: implementacja wg ADR 0009 (i makiet UX 010)
- **Ścieżka**: pełna — etapy 1–4 już ZATWIERDZONE; etap 5+ w toku/zakończony
- **Gałąź / PR**: do ustalenia przy PR
- **Status**: implementacja gotowa do PR/Preview

## Dokumenty
- Wymagania: `docs/analiza/010-redesign-dodawania-cardio.md`
- Architektura: `docs/adr/0009-redesign-dodawania-cardio.md` (wiążący kontrakt)
- UX: `docs/ux/010-redesign-dodawania-cardio.md` + makieta HTML

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-26 | `docs/analiza/010-redesign-dodawania-cardio.md` |
| 2 | Prawo | prawnik | POMINIĘTA | 2026-10-26 | Brak nowej kategorii danych |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-26 | ADR 0009 |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | UX 010 + makieta |
| 5a | Backend | backend | ZATWIERDZONE | 2026-10-28 | `validateCardioMetrics` fieldErrors, limit 600, `getCardioWeekProgressPnNd`, `weekMinutesAfter`, grandfathering Q-C6 |
| 5b | Frontend | frontend | ZATWIERDZONE | 2026-10-28 | Podział arkusza, postęp tygodnia, sukces w miejscu, `handledIdRef` |
| 6 | Testy | tester | ZATWIERDZONE Z UWAGAMI | 2026-10-28 | Unit walidacji; brak E2E w sesji |
| 7a | Bezpieczeństwo | tester-bezpieczenstwa | POMINIĘTE wstępnie | 2026-10-28 | Walidacja bez interpolacji wartości w komunikatach; brak nowych env |
| 7b | Wydajność | tester-wydajnosci | POMINIĘTE wstępnie | 2026-10-28 | Home już ma minuty pn–nd; lekka funkcja tylko po zapisie |

## Weryfikacja
- [x] `npx tsc --noEmit`
- [x] `npx vitest run lib/cardio-validation.test.ts`
- [x] eslint zmienionych plików
- Changelog: wpis `planned: true`
- Domknięcie 2026-10-28: arkusz z Pulpitu dostaje `getCardioWeekProgressPnNd`; Esc / fokus minut; CTA z datą wstecz; skala wysiłku jako radiogroup; podgląd „Cel osiągnięty”

## Założenia robocze (Q otwarte właściciela)
- Q-C1: zostać w kontekście po zapisie ✓
- Q-C2: limit 600 min ✓
- Q-C3: arkusz pn–nd; kafelek główny bez zmiany rolling w tym zadaniu (home już i tak podaje minuty kalendarzowe do arkusza)
- Q-C6: grandfathering minut > 600 przy edycji bez zmiany minut ✓
- Q-C7: pełna przebudowa UI edycji — poza zakresem
