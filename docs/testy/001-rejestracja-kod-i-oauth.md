# Raport testów 001 - Rejestracja: kod e-mail i łączenie kont OAuth

Autor: tester. Data: 2026-10-24. Etap 7 (część tester; spójność wyglądu ocenia `ux`). Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`.

## 1. Wyniki uruchomień
| Polecenie | Wynik | Linia bazowa |
|---|---|---|
| `npx tsc --noEmit` | 0 błędów | czysto |
| `npm run lint` | 151 problemów: 112 błędów, 39 ostrzeżeń | 114 / 40 - brak nowych błędów (spadek o 2 / 1, prawdopodobnie przez zmiany innej sesji) |
| `npm test` | 127 plików zaliczonych, 1 nieudany (`lib/android-version.test.ts`, 2 testy: oczekiwane 0.1.10/versionCode 11, jest 0.1.11/12); 882 zaliczone, 2 nieudane | znany nieudany plik, nie dotyczy 001 |
| Nowy test `lib/validations/register.test.ts` | 22 testy zaliczone | - |

Po dopisaniu testu nie powtarzałem pełnego `npm test` (zmiana to nowy, izolowany plik, zaliczony osobno). Błędów w plikach zadania 004 nie stwierdzono w tsc ani w testach.

## 2. Macierz kryteriów akceptacji
A = test automatyczny, M = test ręczny (Preview), E = eksploracyjny lokalnie.

| Kryterium | Pokrycie |
|---|---|
| US-1 kod 6 cyfr, "Kod wysłany" po nadaniu, błędny kod, wygasły, send_failed, limit 60 s, istniejące konto, kod nadpisany | A: `actions/auth.test.ts`, `lib/validations/register.test.ts` (nowy: 1234, 5 i 7 cyfr, litery, spacje odrzucane); wygaśnięcie 10 min i limit 5 prób: tylko logika w kodzie, brak dedykowanego testu (M) |
| US-1 brzeg: dwie równoległe rejestracje, brak sieci | równoległość: batch z unikalnością (A częściowo przez `account_exists`); brak sieci: M |
| US-2 produkcja bez SMTP odmawia po stronie serwera, bez zapisu | A: `lib/register-email-mode.test.ts`, `actions/auth.test.ts` (`registration_disabled`); UI 1B-1D: A `components/auth/auth-copy.test.ts`; widok: M |
| US-3 tryb testowy tylko dev/test, `MOCK_REGISTER_EMAIL_CODE` ignorowane, RENDER/VERCEL blokują | A: `lib/register-email-mode.test.ts`; konto z trybu testowego niezweryfikowane: A `actions/auth.test.ts` |
| US-4 łączenie OAuth (tabela decyzji, Facebook nigdy nie łączy, brak przenoszenia powiązań) | A: `lib/oauth-link-policy.test.ts`, `lib/google-auth.signin.test.ts` (integracja na bazie) |
| US-4 brzeg: ten sam nowy adres z dwóch urządzeń naraz, zmiana adresu w Google | zmiana adresu: A (`login_linked`); wyścig dwóch logowań: brak testu (M na Preview) |
| US-5 przejęcie: reset, purge, sesje, jedna operacja, no-op przy powtórzeniu, admin nie jest przejmowany | A: `lib/account-takeover.test.ts`, `lib/account-purge.test.ts`; ekran potwierdzenia z prawdziwym Google: M |
| US-6 rola admina tylko dla zweryfikowanego e-maila, bez adresu w kodzie | A: `lib/admin-config.test.ts`; brak `PRIMARY_ADMIN_EMAIL` w kodzie (grep): potwierdzone; logowanie właściciela: M |
| US-7 baner/Konfiguracja, `registrationBlocked`, `ADMIN_EMAILS` | A: `lib/admin-config-status.test.ts`; widok banera w panelu: M (wymaga logowania admina) |
| US-8 komunikaty błędów OAuth | A: `components/auth/auth-copy.test.ts`; widok po prawdziwej odmowie: M |
| US-9/BR-13 dziennik bez e-maila, retencja 180 dni | A: `lib/security-events.test.ts`, `lib/db-retention.test.ts`; widok dziennika w panelu poza zakresem |
| BR-1 retencja kodów 24 h | A: `lib/db-retention.test.ts`, `actions/auth.test.ts` |
| Sesje: unieważnienie, fail-open | A: `lib/account-auth-state.test.ts`, `lib/security-events.test.ts` (dławienie); `auth.ts` `jwt` i `proxy.ts` `isSessionRevoked`: brak testu (luka, M na Preview) |
| Backfill istniejących kont R-A/R-B/R-C | A: `lib/migrate-email-verification.test.ts` |
| Ścieżka publiczna `/login/zabezpiecz-konto` | A: `lib/auth-public-paths.test.ts` |
| Java vs TypeScript | brak wpływu (uwierzytelnianie w Next) |

## 3. Testy eksploracyjne (lokalnie, dev, baza `file:` tymczasowa, bez SMTP)
Serwer `next dev` na porcie 3200 (3100 zajmował serwer innej sesji, później zamknięty). Rejestracji z kodem w przeglądarce nie wykonałem (brak narzędzia przeglądarkowego w tej sesji): przepływ kodu 123456/odrzucenia 1234 pokrywa `actions/auth.test.ts` na prawdziwej bazie `:memory:`.
- `/register`: 200. `/login?session=expired`: 200, tekst "Sesja wygasła.". `/login?error=OAuthAccountNotLinked`: ogólny komunikat "Nie udało się zalogować przez konto zewnętrzne." (stara obietnica łączenia znikła). Kody `OAuthEmailUnverified`, `OAuthLinkRefused`: 200, treść renderowana po stronie klienta (nie widoczna w HTML) - M.
- `/login/zabezpiecz-konto?t=zly` i bez tokenu: 200, ekran "Ten link wygasł" z wyjaśnieniem, bez danych konta.
- Trasy chronione bez sesji: `/admin`, `/treningi` 307 na `/login?callbackUrl=...`; `/api/user/account` 401.
- Nie wykonano (wymaga prawdziwych kont lub sesji): łączenie Google/Facebook, baner w panelu admina (wymaga logowania + PIN), pętla przekierowań po unieważnieniu sesji (A5 z ADR).
- Serwer zatrzymany, tymczasowa baza usunięta.

## 4. Defekty
Nie stwierdzono defektów w kodzie 001. Luki w pokryciu (niski priorytet, do uzupełnienia testem integracyjnym lub e2e):
| ID | Opis | Priorytet | Właściciel |
|---|---|---|---|
| L1 | Brak testu `auth.ts` `jwt` (odświeżenie roli, zwrot `null` przy unieważnieniu) i `proxy.ts` (czyszczenie ciasteczek, `session=expired`) | średni | backend |
| L2 | Brak testu wygaśnięcia kodu po 10 min i limitu 5 prób | niski | backend |
| L3 | Brak testu wyścigu dwóch logowań Google na nowy adres | niski | backend |
| Uwaga | `registerSchema` dopuszcza wiek od 13 lat (LR-30/D18: docelowo 16, śledzone osobno) | niski | analityk/frontend |

## 5. Lista testów na Preview przed Promote
1. Panel Konfiguracja: SMTP "brak", baner rejestracji, `registrationBlocked` przy braku Google/Facebooka; `ADMIN_EMAILS` ustawione.
2. Rejestracja e-mailem bez SMTP: przycisk nieaktywny; wywołanie akcji bezpośrednio daje `registration_disabled`; kod 1234 i 123456 nie tworzą konta.
3. Google z prawdziwym kontem: nowy adres (konto zweryfikowane, kroki rejestracji); adres istniejącego konta zweryfikowanego (link bez duplikatu); odmowa przy `email_verified` fałszywym.
4. Facebook: nowy adres tworzy konto bez admina; adres istniejący daje `OAuthLinkRefused`.
5. Przejęcie na koncie testowym niezweryfikowanym (z danymi): ekran potwierdzenia, purge, nowy właściciel widzi puste konto, stara sesja wylogowana, `subscription_orders` zachowane, zamówienia `pending` anulowane, wpis `security.account_takeover` bez e-maila.
6. Batch przejęcia na kopii bazy Turso: czas i limit instrukcji (U8, A4).
7. Backfill przy starcie na kopii bazy: konto właściciela dostaje `email_verified_at`, logowanie hasłem i rola admina działają; idempotencja po restarcie.
8. Unieważniona sesja na dwóch urządzeniach (okno do 60 s), brak pętli przekierowań, WebView Android/PWA.
9. Awaria bazy: fail-open (nikt nie jest wylogowywany), jeden wpis logu na 60 s.
10. Powtórzone żądania wysyłki kodu i dwa urządzenia naraz.
11. Przed Promote (BR-14): ocena incydentu, polityka prywatności, `npm run deploy:check`.

## 6. Werdykt (część tester)
ZATWIERDZONE Z UWAGAMI: tsc czysty, lint bez nowych błędów, `npm test` bez nowych niepowodzeń, krytyczne kryteria pokryte testami automatycznymi; uwagi: luki L1-L3 i ręczne testy OAuth/przejęcia na Preview (lista powyżej), ocena `ux` osobno.
