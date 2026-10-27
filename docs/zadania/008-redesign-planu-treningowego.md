# 008 - Redesign tworzenia i zarządzania planem treningowym

- **Polecenie użytkownika**: Ekran tworzenia planu treningowego (profil) ma bardzo duży bałagan techniczny i wizualny. Zrobić analizę techniczną i wizualną obecnego ekranu, zaprojektować całość od nowa: nowa architektura/flow tworzenia planu, nowa, lepsza baza ćwiczeń, czytelny i zwandowany atlas ćwiczeń. Plany treningowe mają być ustawiane WYŁĄCZNIE z paska bocznego (nie z ekranu profilu). Funkcja "Stwórz plan treningowy z AI" ma zniknąć całkowicie (nie ma jej dotyczyć żadna dalsza praca). Na tym etapie: BEZ ZMIAN W KODZIE — tylko analiza, plan zmian i makiety (HTML).
- **Ścieżka**: pełna, ograniczona do etapów analityczno-projektowych (bez implementacji na tym etapie — użytkownik wprost zastrzegł brak zmian w kodzie)
- **Gałąź / PR**: feat/koniec-treningu-flow (bieżąca robocza; brak PR na tym etapie, zero zmian kodu produkcyjnego)
- **Status**: gotowe (etap analityczno-projektowy zakończony; czeka na decyzję użytkownika co do implementacji)

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE | 2026-10-26 | `docs/analiza/008-redesign-planu-treningowego.md` |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE | 2026-10-26 (zaktualizowano 2026-10-26 po 4 decyzjach właściciela produktu) | `docs/adr/0007-redesign-planu-treningowego.md` (sekcje 2.4/2.4a/2.4b/2.4c/2.5/2.6 zmienione, sekcja 11 — podsumowanie aktualizacji) |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | `docs/ux/008-redesign-planu-treningowego.md`, `docs/ux/008-redesign-planu-treningowego-makieta.html` — odświeżone o 4 decyzje właściciela (atlas na dużą skalę z filtrami/paginacją, karta ćwiczenia z sekcją "Tylko dla Ciebie", plakietki pewności importu); jedna rozbieżność z ADR do rozstrzygnięcia przy implementacji: karta ćwiczenia jako arkusz `?cwiczenie=` (ux) vs. trasa `atlas/[categoryId]/[exerciseId]` (architekt) — patrz Uwagi do backlogu |

Etapy 5-10 (implementacja, testy, bezpieczeństwo, wydajność, prawnik) celowo pominięte — zadanie kończy się na dostarczeniu analizy, planu i makiet do akceptacji użytkownika. `prawnik` pominięty: brak nowego przetwarzania danych osobowych/zdrowotnych względem stanu obecnego (ta sama domena — plany/ćwiczenia); nowa tabela `user_exercise_notes` jest prywatna/niepubliczna, więc ta ocena zostaje aktualna także po aktualizacji ADR (uzasadnienie w sekcji 2.4c ADR).

## Weryfikacja
- Brak — zero zmian w kodzie produkcyjnym na tym etapie.

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Karta ćwiczenia: arkusz z `?cwiczenie=` (ux) vs. trasa `atlas/[categoryId]/[exerciseId]` (architekt) — rozstrzygnąć przed implementacją | ux / architekt | architekt + frontend | średni |
| Prywatna notatka/link użytkownika (`user_exercise_notes`): potwierdzić ujęcie w eksporcie danych i przy usuwaniu konta | ux (Q-A6) | prawnik | średni |
| Źródło i licencja treści opisów/wskazówek techniki dla rozbudowanej bazy ćwiczeń (kto pisze, na jakiej podstawie) | ux (Q-A11) | właściciel produktu | niski |
