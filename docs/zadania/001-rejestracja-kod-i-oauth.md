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
| 3 | Projekt techniczny | architekt | ZATWIERDZONE Z UWAGAMI (DW-5 do właściciela: reguła R-B backfillu; pytanie A9 do prawnika: `subscription_orders` przy przejęciu; ux: kod testowy `123456` i 3 brakujące kopie) | 2026-10-23 | `docs/adr/0001-rejestracja-weryfikacja-i-laczenie-kont.md` |
| 4 | Projekt ekranów | ux | ZATWIERDZONE Z UWAGAMI (zależności od ADR 0001: flagi serwera, osobne kody błędów OAuth, wariant A/B potwierdzenia przejęcia, jednorazowość komunikatu, poziom SMTP; teksty LR-25 do prawnika-człowieka) | 2026-10-23 | `docs/ux/001-rejestracja-i-laczenie-kont.md` |
| 5 | Implementacja | backend, frontend | frontend: ZATWIERDZONE Z UWAGAMI (UX 1A-1F, 2A-2B, 3, 4A-4B, 5A-1, 5A-2 (z `summary.emailRegistrationMode`), 5B kotwica, 5C; tsc czysty, eslint bez nowych błędów w zmienionych plikach, test `components/auth/auth-copy.test.ts`); backend: ZATWIERDZONE Z UWAGAMI (ADR 0001 D1-D9; DW-5: R-B tylko `email_verified_at = now` + `security.backfill_verified`, bez resetu hasła i sesji; A9: `subscription_orders` wyłączone z purge w `PURGE_EXCLUDED_TABLES`; odchylenia: token przejęcia bez imienia/nazwiska, opcja purge `guard` zamiast `onlyIfUnverified`, `summarizeConfig(items, { registrationBlocked })`; tsc czysty, lint 114/40 bez zmian, `npm test` 1 nieudany plik `lib/android-version.test.ts` ze znanych - alias `server-only` naprawił 3 pozostałe); frontend: poprawki U3, U5, U6 2026-10-24 (U3: neutralna kopia `OAuthLinkRefused` bez nazwy dostawcy - URL niesie tylko kod, tekst do akceptacji `ux`; U5: `TAKEOVER_ERROR_MESSAGES` w `auth-copy.ts` jedynym źródłem, akcja zwraca tylko `code`; U6: `registerWelcomeCopy(availability, emailRefused)` bierze `blocked` z serwera); backend: poprawki U1, U2, U4 2026-10-24 (U1: batch przejęcia anuluje zamówienia `pending` konta (`status = 'cancelled'`, warunek `takenOverNow`); notify HotPay przedłuża pakiet tylko, gdy `UPDATE ... WHERE status = 'pending' RETURNING` zmienił wiersz, płatność za `cancelled`/`failed` = log z identyfikatorami do ręcznego zwrotu; U2: `logAuthFailure(where, err, { throttle: true })` - najwyżej 1 wpis na miejsce na 60 s - w catch `auth.jwt.sessionState` i `proxy.sessionState`; U4: `insertIf` na obiektach tabel Drizzle (nazwy i kodowanie z kolumn), wiersz zdarzenia z `securityEventRow` w `lib/security-events.ts`; tsc czysty, eslint zmienionych plików 0 błędów, vitest 16 plików / 117 testów zaliczonych, w tym nowy `app/api/payments/hotpay/notify/route.test.ts`) | 2026-10-23 | `components/auth/`, `components/admin/admin-registration-notice.tsx`, `app/(auth)/login/zabezpiecz-konto/page.tsx`; backend: `lib/account-*.ts`, `lib/oauth-link-policy.ts`, `lib/register-email-mode.ts`, `lib/security-events.ts`, `lib/migrate-email-verification.ts`, `actions/auth.ts`, `actions/account-takeover.ts`, `auth.ts`, `proxy.ts`, `db/migrations/0031_users_email_verification.sql` |
| 6 | Przegląd kodu | architekt | ZATWIERDZONE Z UWAGAMI (ponowny przegląd po poprawkach 2026-10-24: U1-U6 zamknięte, fail-open dopisany do ADR D5; nowe N1 log wyścigu notify/przejęcie - backend, N2 reguła dostępności e-maila w dwóch miejscach - frontend, obie niskie, do backlogu; tsc czysty, eslint 0 błędów w zakresie, vitest 4 pliki / 36 testów zaliczonych; U7, U8 bez zmian w backlogu) | 2026-10-24 | `docs/adr/0001-rejestracja-weryfikacja-i-laczenie-kont-przeglad.md` (sekcja 5) |
| 7 | Testy funkcjonalne i spójność | tester, ux | ux (spójność): ZATWIERDZONE Z UWAGAMI - tokeny bez nowych kolorów i odcieni złota, ekrany złożone z `InlineBanner`/`AdminNotice`/`Button`/`AuthCard`, mikrokopia po polsku; `AuthCard` dopisany do katalogu, kopie inline (P8 do U7); odchylenia O1-O6 zaakceptowane; tester: | 2026-10-24 | `docs/testy/`, `docs/ux/00-system-projektowy-stan.md` (sekcja 4), `docs/ux/001-rejestracja-i-laczenie-kont.md` (sekcja 9) |
| 8 | Przegląd wizualny | ux | ZATWIERDZONE Z UWAGAMI (dev lokalnie 390/1280 px dla 1A, 2A, 3, 4A-wygasły; reszta statycznie; poprawki P1-P3 średnie, P4-P9 niskie) | 2026-10-24 | `docs/ux/001-rejestracja-i-laczenie-kont.md` (sekcja 10) |
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
| Usuwanie konta (`app/api/user/account`, admin DELETE) polega na kaskadzie FK, a FK nie są wymuszane; przejść na `lib/account-purge.ts` | architekt (ADR 0001 D4) | backend | wysoki |
| Podbijanie `session_version` przy zmianie hasła i odebraniu roli (S2) | architekt (ADR 0001 D5) | backend | średni |
| Cron `/api/cron/cleanup` nie jest wywoływany na Render; włączyć dopiero po zabezpieczeniu dowodów (BR-14) | architekt (ADR 0001 D8) | właściciel + backend | średni |
| Widok dziennika bezpieczeństwa w panelu (US-9), `listAdminAuditLogs` bez konsumenta | architekt (ADR 0001 D7) | frontend | niski |
| U1: batch przejęcia anuluje zamówienia `pending`; notify HotPay przedłuża pakiet tylko po faktycznej zmianie statusu - ZAMKNIĘTE 2026-10-24 | architekt (przegląd 001) | backend | niski (przed etapem 9) |
| U2: dławiony `logAuthFailure` w catch `auth.ts` `jwt` i `proxy.ts` `isSessionRevoked` - ZAMKNIĘTE 2026-10-24 | architekt (przegląd 001) | backend | niski (przed etapem 9) |
| U3: kopia `OAuthLinkRefused` mówi o Facebooku także dla odmowy Google (admin bez weryfikacji) - ZAMKNIĘTE 2026-10-24 (brzmienie do akceptacji `ux`) | architekt (przegląd 001) | frontend + ux | niski |
| U4: `insertIf` w `lib/account-takeover.ts` na napisach zamiast typów Drizzle; jedno źródło wiersza zdarzenia `security.*` - ZAMKNIĘTE 2026-10-24 | architekt (przegląd 001) | backend | niski |
| U5: teksty błędów przejęcia zdublowane w akcji i komponencie - ZAMKNIĘTE 2026-10-24 | architekt (przegląd 001) | frontend | niski |
| U6: `registerWelcomeCopy` liczy "zamknięte" na kliencie zamiast `availability.blocked` - ZAMKNIĘTE 2026-10-24 | architekt (przegląd 001) | frontend | niski |
| U7: `complete-profile` i `complete-profile-session-bridge` kopiują panel `AuthCard` inline | architekt (przegląd 001) | frontend | niski |
| U8: batch przejęcia 128 instrukcji - pomiar na kopii bazy w Preview | architekt (przegląd 001) | tester-wydajnosci | niski |
| N1: notify HotPay - brak logu do ręcznego zwrotu przy wyścigu (zamówienie anulowane między odczytem a `UPDATE`) | architekt (ponowny przegląd 001) | backend | niski |
| N2: reguła "e-mail dostępny" liczona w `register-form.tsx` i `registerWelcomeCopy` | architekt (ponowny przegląd 001) | frontend | niski |
| UX P1: fokus po "Wyślij kod" spada na `body` - przenieść na pole kodu | ux (przegląd 001) | frontend | średni |
| UX P2: nagłówek ekranu 4A w stanie "link wygasł" | ux (przegląd 001) | frontend | średni |
| UX P3: kopia 1F "Wróć i wybierz inną metodę." (`actions/auth.ts:56`) | ux (przegląd 001) | backend | średni |
| UX P4-P9: kopia `code_resend_too_soon`, `autoFocus` na linku 4A, kontrast tekstu akceptacji Regulaminu, cel "Wstecz", kopia `AuthCard` w `register-form.tsx:483`, kicker "Rejestracja Google" | ux (przegląd 001) | frontend + backend | niski |
