# 002 - Dodatkowe cardio: limit 90 min ukrywa wykonane minuty

- **Polecenie użytkownika**: Cel cardio 170 min, strona zaleciła +90 min dodatkowego cardio. Po 20 min dodatkowego cardio (pasek ponad 170 min) nadal pokazuje +90. Napraw ucinanie do 90 min.
- **Ścieżka**: skrócona (poprawka błędu w jednym module `lib/extra-cardio-from-macros.ts`, bez zmian schematu, API, uprawnień, zgód i zmiennych środowiskowych)
- **Gałąź / PR**: feat/error-handling-system, PR do założenia
- **Status**: w toku

## Diagnoza
`computeExtraCardioAdvice` odejmuje wykonane cardio (offset ponad cel tygodnia) od celu kcal, a dopiero potem ucina minuty do 90. Gdy cel przed cardio przekracza 90 min (np. 130 min), po 20 min offsetu zostaje 110 min, ucięte do 90 — wykonane minuty są niewidoczne.

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 5 | Implementacja | backend | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | `MAX_EXTRA_MINUTES`, cel ucinany przed offsetem; test regresji 90 → 70 → brak; vitest 37/37. Uwaga: `tsc` pada w plikach równoległej pracy (rejestracja) |
| 6 | Przegląd kodu | architekt | ZATWIERDZONE | 2026-10-23 | Limit ucina cel przed offsetem; brzegi OK (burn ≥ 2 z clampBurn, offset > cel → 0, min 5 min, effective ≤ openDebt); stała MAX_EXTRA_MINUTES jedyna, brak kopii w UI/Java/Android; vitest 37/37, eslint czysty. Błędy `tsc` tylko w plikach równoległej pracy (rejestracja), nie w tym zadaniu |
| 7 | Weryfikacja poprawki i regresji | tester | ZATWIERDZONE Z UWAGAMI | 2026-10-23 | Kryterium 90 -> 70 -> brak potwierdzone testem; ścieżka danych home-start spójna (offset i pasek z tych samych workouts + legacy, filtr cardio>0, bez limitu 60 dla bieżącego tygodnia). `npm test`: 669/671, 2 błędy tylko w `lib/android-version.test.ts` (poza zakresem); testy cardio zielone; `tsc`/eslint bez błędów w plikach cardio. Uwagi: offset liczony w kcal (wpisy z kalorią dają inne zmniejszenie niż minuty x burn); legacy training_sessions: pasek filtruje strefą serwera, offset `calendarDateKey` (strefa kalendarza) - możliwa rozbieżność na granicy doby |

## Weryfikacja
- [ ] `npm run lint` — pliki zadania czyste (eslint); całe repo ma błędy w innych plikach
- [ ] `npx tsc --noEmit` — 8 błędów, wszystkie poza zadaniem: `lib/account-purge.ts` (5), `proxy.ts` (2), `components/admin/admin-settings-client.tsx` (1) — równoległa praca nad rejestracją/adminem
- [ ] `npm test` — 669/671; 2 błędy w `lib/android-version.test.ts` (oczekiwane 0.1.10, jest 0.1.11), poza zadaniem; testy cardio 37/37
- [ ] `npm run deploy:check` (przed merge)
- [x] Wpis w `components/changelog/changelog-data.ts` (`planned: true`) — punkt w istniejącej zapowiedzi „Dodatkowe cardio”

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Offset liczony w kcal: wpisy z kaloriami zmniejszają zalecenie inaczej niż minuty × spalanie | tester | backend | niski |
| Legacy `training_sessions`: pasek filtruje tydzień strefą serwera, offset `calendarDateKey` — rozbieżność na granicy doby | tester | backend | niski |
