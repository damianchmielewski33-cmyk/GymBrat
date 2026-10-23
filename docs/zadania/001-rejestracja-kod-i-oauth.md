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
| 5 | Implementacja | backend, frontend | frontend: ZATWIERDZONE Z UWAGAMI (UX 1A-1F, 2A-2B, 3, 4A-4B, 5A-1, 5A-2 (z `summary.emailRegistrationMode`), 5B kotwica, 5C; tsc czysty, eslint bez nowych błędów w zmienionych plikach, test `components/auth/auth-copy.test.ts`); backend: ZATWIERDZONE Z UWAGAMI (ADR 0001 D1-D9; DW-5: R-B tylko `email_verified_at = now` + `security.backfill_verified`, bez resetu hasła i sesji; A9: `subscription_orders` wyłączone z purge w `PURGE_EXCLUDED_TABLES`; odchylenia: token przejęcia bez imienia/nazwiska, opcja purge `guard` zamiast `onlyIfUnverified`, `summarizeConfig(items, { registrationBlocked })`; tsc czysty, lint 114/40 bez zmian, `npm test` 1 nieudany plik `lib/android-version.test.ts` ze znanych - alias `server-only` naprawił 3 pozostałe) | 2026-10-23 | `components/auth/`, `components/admin/admin-registration-notice.tsx`, `app/(auth)/login/zabezpiecz-konto/page.tsx`; backend: `lib/account-*.ts`, `lib/oauth-link-policy.ts`, `lib/register-email-mode.ts`, `lib/security-events.ts`, `lib/migrate-email-verification.ts`, `actions/auth.ts`, `actions/account-takeover.ts`, `auth.ts`, `proxy.ts`, `db/migrations/0031_users_email_verification.sql` |
| 6 | Przegląd kodu | architekt | | | |
| 7 | Testy funkcjonalne i spójność | tester, ux | | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | | | |
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
