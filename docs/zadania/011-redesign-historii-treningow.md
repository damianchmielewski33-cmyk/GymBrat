# 011 - Redesign ekranu Historia treningów

- **Polecenie użytkownika**: "tak wygląda ekran historia treningów, zrób analizę architektoniczną i ux, następnie zaproponuj na makietach nową architekturę i wygląd ekranu, bez zmian w kodzie"
- **Ścieżka**: ograniczona do analizy i projektu (analiza architektoniczna + UX + makieta HTML) — brak implementacji na wyraźne żądanie użytkownika ("bez zmian w kodzie"). Etapy backend/frontend/tester/prawnik/bezpieczeństwo/wydajność pominięte: zadanie nie zmienia kodu produkcyjnego ani przetwarzania danych.
- **Gałąź / PR**: feat/koniec-treningu-flow (bieżąca, brak nowego PR — tylko dokumentacja)
- **Status**: w toku

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE (pytania Q1-Q5 otwarte z założeniami) | 2026-10-26 | `docs/analiza/011-redesign-historii-treningow.md` |
| 2 | Projekt techniczny / analiza architektoniczna | architekt | ZATWIERDZONE | 2026-10-26 | `docs/adr/0010-redesign-historii-treningow.md` |
| 3 | Projekt ekranów (UX + makieta) | ux | ZATWIERDZONE Z UWAGAMI (uwagi do domknięcia przed implementacją: źródło statystyk per filtr i limit 400 (A-1, A-2), adres filtra i deep link z Pulpitu (A-3), szczegół `[id]` (A-4), patrz sekcja 10 raportu) | 2026-10-26 | `docs/ux/011-redesign-historii-treningow.md`, makieta `docs/ux/011-redesign-historii-treningow-makieta.html` |

## Weryfikacja
- Nie dotyczy — brak zmian w kodzie produkcyjnym w tym zadaniu.

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
