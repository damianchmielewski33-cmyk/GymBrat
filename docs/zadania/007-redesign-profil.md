# 007 - Redesign ekranu Profil

- **Polecenie użytkownika**: zrobić analizę techniczną i wizualną ekranu Profil, zaproponować nowy wygląd oraz zmiany architektoniczne/techniczne/wizualne, sprawdzić poprawność przekazywanych i wyliczanych wartości, napisać nową architekturę i zrobić makietę.
- **Ścieżka**: pełna (zadanie projektowe — analiza, architektura, makieta; bez implementacji na tym etapie).
- **Gałąź / PR**: `feat/koniec-treningu-flow` (bieżąca gałąź robocza; brak zmian kodu produkcyjnego w tym zadaniu — same dokumenty).
- **Status**: w toku

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-25 | `docs/analiza/007-redesign-profil.md` |
| 2 | Bramka wejściowa | prawnik | ZATWIERDZONE Z UWAGAMI | 2026-10-25 | `docs/prawo/006-redesign-profil-ocena-wejsciowa.md` |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-25 | `docs/adr/0006-redesign-profil.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-25 | `docs/ux/007-redesign-profil.md`, makieta `docs/ux/007-redesign-profil-makieta.html` |

Etapy implementacji (backend, frontend, tester, przegląd architekta, bezpieczeństwo/wydajność, bramka wyjściowa prawnik) nie wchodzą w zakres tego zadania — zostaną założone jako osobne zadanie, gdy użytkownik zdecyduje o wdrożeniu redesignu.

## Weryfikacja
- [ ] Nie dotyczy (brak zmian kodu na tym etapie)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| P-1 źródło prawdy o wadze (3 niezależne źródła) | analityk | architekt | P1 |
| P-2 makro posiłków niepowiązane z celami dnia (2812 vs 2050/1890 kcal) | analityk | architekt | P1 |
| P-3 wartości domyślne 80/180/25 w formularzu ciała | analityk | architekt | P1 |
| P-4 zgody RODO tylko w localStorage | analityk | prawnik | P1 |
| P-5 forma nawigacji (podstrony / zakładki / jedna strona) | analityk | ux | P2 |
| U-1 wiersz konta bez kafelków wagi/wzrostu/wieku (odstępstwo od ADR sekcja 1) | ux | architekt | P2 |
| U-2 czy baza odróżnia cel cardio zapisany od domyślnego 150 (`s?.goal ?? 150`) | ux | architekt / backend | P2 |
| U-3 poziom aktywności bez domyślnej wartości zapisu (LR-8 analogicznie) | ux | architekt / backend | P1 |
| U-4 konflikt: czy przycisk „Zachowaj moje zmiany” (nadpisanie) | ux | właściciel / architekt | P2 |
| U-5 `/profile/workout-plan` poza layoutem profilu (grupa tras) | ux | architekt | P1 |
| U-6 marketing jako stan „Nieaktywne w tej wersji” czy ukryty | ux | właściciel (prawnik LR-4) | P2 |
| U-7 tekst statystyk: wariant docelowy (wymaga bramki serwerowej) czy awaryjny | ux | prawnik (człowiek) | P2 |
| U-8 kalendarz: oznaczenie konkretnych dat czy wzorca tygodniowego | ux | analityk | P2 |
| U-9 brak wartości pól w logach i Sentry (LR-11) | ux | frontend / tester-bezpieczenstwa | P2 |
| U-10 zapis inline zamiast modalu w profilu (świadome odstępstwo) | ux | ux (zapisane w specyfikacji) | P3 |
| U-11 nazwy ikon lucide do sprawdzenia | ux | frontend | P3 |
| U-12 jeden zakres wagi 1–400 kg | ux | frontend | P3 |
