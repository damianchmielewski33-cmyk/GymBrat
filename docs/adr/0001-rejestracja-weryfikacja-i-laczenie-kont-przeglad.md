# Przegląd kodu zadania 001 (etap 6) - ADR 0001

- Data: 2026-10-24
- Autor: architekt
- Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`
- Zakres: pliki zadania 001 z commita `4a3df0a` (bez zmian zadania 002 i bez niezacommitowanych zmian zadania 004).
- Werdykt: **ZATWIERDZONE Z UWAGAMI** (brak uwag blokujących; uwagi niskiego ryzyka poniżej, z adresatem).

## 1. Weryfikacja

| Sprawdzenie | Wynik |
|---|---|
| `npx tsc --noEmit` | czysty (całe drzewo robocze) |
| ESLint na plikach 001 | 14 błędów / 7 ostrzeżeń, wszystkie w liniach sprzed `4a3df0a` (`git blame`: `react-hooks/set-state-in-effect` w `components/admin/*`, `app-menu-button.tsx:416`; `no-location-assign` w formularzach auth). Brak nowych błędów |
| Vitest, 15 plików testów 001 | 15/15, 100 testów zaliczonych |
| Martwy kod z ADR | `PRIMARY_ADMIN_EMAIL`, `isPrimaryAdminEmail`, `getPrimaryAdminUserId`, `MOCK_REGISTER_EMAIL_CODE`, `isRegisterEmailMockMode`, `allowDangerousEmailAccountLinking`, `resolveAppRole`, `resolveGoogleSignInUser`, `founderUserId`, `RETENTION_EMAIL_CODES_DAYS`, `emailCodesDays` - usunięte z kodu; zostały tylko w testach jako przypadki negatywne (`register-email-mode.test.ts`, `auth.test.ts`, `auth-copy.test.ts`) |
| Komponenty klienckie a `lib/admin-config` | żaden komponent go nie importuje (adres e-mail poza bundlem klienta) |
| Migracja | addytywna (`ADD COLUMN`, NULL i `DEFAULT 0 NOT NULL`), bezpieczna dla działającej bazy Turso; `ensure-schema` jako faktyczne źródło; journal `idx 24` zgodnie z ADR (luka 0029/0030 to znane R3) |
| Java (`java-backend/`) | brak wpływu (brak logiki rejestracji, ról ani OAuth) |
| Android `/api/android/*` | bez zmian; proxy pomija te ścieżki |
| Reguły repo | changelog `planned: true` z `sourceRepo`; `admin-config-status` (SMTP z `hostingHint`, `ADMIN_EMAILS` nieopcjonalne); `env.example` (SMTP, `ADMIN_EMAILS`, `RETENTION_EMAIL_CODES_HOURS`, min. 180 dni audytu) |

## 2. Zgodność z ADR 0001

- D1: jedno źródło trybu (`lib/register-email-mode.ts`), tryb testowy tylko jako transport, bez osobnej ścieżki tworzenia konta; walidacja `^\d{6}$`. Zgodne.
- D2: kolumny, `ensure-schema`, backfill z `instrumentation.ts`; R-B zgodnie z DW-5 (tylko `email_verified_at = now` + `security.backfill_verified`). Zgodne.
- D3: czysta funkcja `decideOAuthSignIn`, mutacja w `signIn`, `jwt` tylko odczyt po powiązaniu; `ensureOauthLink` bez przenoszenia. Zgodne.
- D4: token HMAC, akcja z `guardAction` i Zod, jeden `db.batch`. Zgodne z odchyleniami z sekcji 3.
- D5: `session_version` + cache 60 s w `jwt` i `proxy.ts`, czyszczenie ciasteczek, wyjątek `session=expired`. Zgodne (z rozstrzygnięciem 3.5).
- D6: jedno miejsce reguły roli: `resolveEffectiveRole` (`lib/admin-config.ts`); `syncAdminRoleOnLogin` tylko go woła i zapisuje skutek przy logowaniu. Brak drugiego miejsca decyzji o roli. Zgodne.
- D7: `lib/security-events.ts` nad `admin_audit_log`, `meta` z listą dozwolonych kluczy; e-mail usunięty z `metaJson` powiązania OAuth. Zgodne.
- D8, D9: zgodne. Login page nie dostaje `availability` (ADR sekcja 3) - nie jest potrzebne dla UX logowania; akceptowane.
- Deduplikacja: drugi baner konfiguracji na `/admin/overview` usunięty (UX 5C); `adminAuditValues` wspólne dla zapisu pojedynczego i batcha; `isSmtpConfigured` w jednym miejscu.

## 3. Rozstrzygnięcia odchyleń

1. **Token przejęcia bez imienia i nazwiska** - AKCEPTOWANE. Minimalizacja danych w URL-u. Imię i nazwisko uzupełnia `fillMissingNames` przy ponownym logowaniu Google (`login_linked`), które i tak następuje po przejęciu. ADR D4 zaktualizowany.
2. **Opcja purge `guard: SQL` zamiast `onlyIfUnverified`** - AKCEPTOWANE. Kolejność batcha zmieniona na: reset konta, potem purge i wstawienia z warunkiem `email_verified_at = :now`. Jest to wymuszone tym, że reset ustawia `email_verified_at`, a `guard` jest ogólniejszy i nie wiąże modułu purge z przejęciem. Przypadek brzegowy (dwa wywołania w tej samej milisekundzie) jest nieszkodliwy: powtórny purge i ponowne wstawienie tych samych danych domyślnych.
3. **`summarizeConfig(items, { registrationBlocked, emailRegistrationMode })`** - AKCEPTOWANE. `lib/admin-config-status.ts` zostaje czysty (bez `server-only` i bez drugiej kopii sprawdzania SMTP/OAuth), a stan liczy jedno źródło (`getRegistrationAvailability`).
4. **`subscription_orders` w `PURGE_EXCLUDED_TABLES`** - AKCEPTOWANE (obowiązek przechowywania dokumentów rozliczeniowych). Zgłoszony przypadek (opłacenie oczekującego zamówienia po przejęciu przyznaje pakiet nowemu właścicielowi) to realna luka, ale niskiego ryzyka: wymaga zamówienia `pending` na koncie niezweryfikowanym w chwili przejęcia. Dodatkowo w `app/api/payments/hotpay/notify/route.ts:73-91` pakiet jest przedłużany dla każdego statusu różnego od `paid` (także `cancelled`/`failed`), niezależnie od wyniku `UPDATE ... WHERE status = 'pending'`. Wymagane (uwaga U1).
5. **Przy błędzie bazy `proxy`/`jwt` nie wylogowują (fail-open)** - AKCEPTOWANE jako świadomy kompromis na rzecz dostępności. Fail-closed przy chwilowym błędzie Turso wylogowałby wszystkich użytkowników (proxy czyści ciasteczka 30-dniowych sesji). Okno nadużycia jest ograniczone do czasu awarii bazy, kiedy dostęp do danych i tak nie działa (Java korzysta z tej samej bazy). Błędy nie są cache'owane. Warunek: catch nie może być cichy (uwaga U2). Do dopisania w ADR D5.

## 4. Uwagi

| # | Plik:linia | Problem | Wymagana zmiana | Priorytet | Adresat |
|---|---|---|---|---|---|
| U1 | `lib/account-takeover.ts:153-183`; `app/api/payments/hotpay/notify/route.ts:73-91` | Zamówienie `pending` konta przejmowanego, opłacone po przejęciu, przedłuża pakiet nowemu właścicielowi; notify przedłuża pakiet także dla `cancelled`/`failed` | W batchu przejęcia: `UPDATE subscription_orders SET status = 'cancelled' WHERE user_id = :uid AND status = 'pending' AND <takenOverNow>`. W notify: przedłużać pakiet tylko, gdy `UPDATE` zmienił wiersz (`returning`), z jawną listą statusów źródłowych (`pending`, ewentualnie `failed`). Płatność za anulowane zamówienie: log bez danych osobowych do ręcznego zwrotu | niski | backend |
| U2 | `auth.ts:217-219`; `proxy.ts` (`isSessionRevoked`, catch) | Puste klauzule catch w punkcie egzekwowania kontroli bezpieczeństwa: brak sygnału w logach/Sentry, gdy unieważnianie sesji jest wyłączone przez błąd bazy | `logAuthFailure("auth.jwt.sessionState" / "proxy.sessionState", err)` z dławieniem (np. najwyżej raz na 60 s na proces, żeby awaria nie zalała Sentry) | niski | backend |
| U3 | `components/auth/auth-copy.ts:12-13` | `OAuthLinkRefused` zwracany też dla Google (admin bez weryfikacji, ADR D2 pkt 3), a kopia mówi o Facebooku; właściciel zobaczyłby mylący komunikat | Neutralna kopia bez nazwy dostawcy albo wariant zależny od dostawcy bez ujawniania stanu konta (LR-29); tekst od `ux` | niski | frontend (+ux) |
| U4 | `lib/account-takeover.ts:88-105, 157-182` | `insertIf` używa nazw tabel i kolumn jako napisów, omijając typy Drizzle; zmiana nazwy kolumny nie zostanie wykryta przez `tsc`. Zdarzenie budowane ręcznie obok `securityEventInsert` (drugi wzorzec `security.*`) | Nazwy z `getTableConfig(...)`/obiektów kolumn (`oauthAccounts.userId.name`) albo `db.insert(t).select(...)` z Drizzle 0.45; wiersz zdarzenia z jednej funkcji eksportowanej z `lib/security-events.ts` | niski | backend |
| U5 | `actions/account-takeover.ts:22-32`; `components/auth/account-takeover-screen.tsx:61-62, 114` | Te same teksty błędów w akcji i w komponencie | Komponent pokazuje `res.error` z serwera (jedno źródło kopii) | niski | frontend |
| U6 | `components/auth/auth-copy.ts:45-74` | `RegisterMethods` i warunek "zamknięte" liczony ponownie na kliencie, choć serwer daje `availability.blocked` | Przyjmować `RegistrationAvailability` (import typu) i `blocked` z serwera | niski | frontend |
| U7 | `app/(dashboard)/complete-profile/page.tsx:58`; `components/auth/complete-profile-session-bridge.tsx:35` | Ten sam panel `glass-panel gold-panel` co nowy `AuthCard` zostaje skopiowany inline | Przejść na `AuthCard` (backlog, poza zakresem 001) | niski | frontend |
| U8 | `lib/account-purge.ts` | Purge generuje 124 instrukcje (+4 przejęcia = 128 w jednym batchu), więcej niż szacunek 60-80 w ADR (A4) | Pomiar czasu batcha na kopii bazy w Preview (`tester-wydajnosci`, etap 9) | niski | tester-wydajnosci |

Uwagi U1 i U2 należy wprowadzić w ramach zadania 001 przed etapem 9 (zmiana kodu po etapie 6 wymaga ponownego przeglądu tych plików). U3-U8 do backlogu karty.

## 5. Ponowny przegląd po poprawkach U1-U6 (2026-10-24)

- Zakres: niezacommitowany diff względem `4a3df0a` w `lib/account-takeover.ts` (+test), `app/api/payments/hotpay/notify/route.ts` (+nowy `route.test.ts`), `lib/security-events.ts` (+test), `auth.ts`, `proxy.ts`, `components/auth/{auth-copy.ts,auth-copy.test.ts,register-form.tsx,account-takeover-screen.tsx}`, `actions/account-takeover.ts`. Zmiany zadania 004 pominięte.
- Werdykt: **ZATWIERDZONE Z UWAGAMI** (U1-U6 wprowadzone poprawnie; nowe uwagi N1-N2 niskiego ryzyka, do backlogu).

| Sprawdzenie | Wynik |
|---|---|
| `npx tsc --noEmit` | czysty |
| ESLint, 13 plików zakresu | 0 błędów; 3 ostrzeżenia w `register-form.tsx` (`watch`, `location.assign`) sprzed `4a3df0a` |
| Vitest: `account-takeover`, `hotpay/notify/route`, `security-events`, `auth-copy` | 4/4 pliki, 36 testów zaliczonych |
| Martwy kod | `RegisterMethods`, `TAKEOVER_FAILED_MESSAGE`, `TAKEOVER_OFFLINE_MESSAGE`, pole `error` akcji, import `adminAuditValues` w przejęciu - usunięte, brak pozostałych odwołań |

Ocena poprawek:
- U1 - ZAMKNIĘTE. `cancelPendingOrders` z warunkiem `takenOverNow` (powtórne wywołanie nie anuluje nowych zamówień nowego właściciela - test). Notify: pakiet tylko przy `UPDATE ... WHERE status = 'pending' RETURNING` z wierszem; `cancelled`/`failed` + `SUCCESS` = log z identyfikatorem zamówienia i płatności, bez `user_id` (test). Pominięcie `failed → paid` akceptowane (ręczna obsługa zamiast automatu).
- U2 - ZAMKNIĘTE. `logAuthFailure(where, err, { throttle })`, mapa kluczowana stałymi napisami (ograniczona), `now` wstrzykiwalne w teście. `proxy.ts` importuje moduł `server-only` z `getDb` tak jak dotąd `account-auth-state` (runtime Node.js). Fail-open dopisany do ADR D5.
- U4 - ZAMKNIĘTE. `insertIf<T extends SQLiteTable>` z `T["$inferInsert"]`, nazwy z `getTableColumns`, kodowanie przez `sql.param(v, column)` (test zapisu `timestamp_ms`). `securityEventRow` jedynym miejscem budowy wiersza `security.*`.
- U3 - ZAMKNIĘTE po stronie kodu; tekst neutralny zgodny z LR-29, akceptacja brzmienia przez `ux` w etapie 8.
- U5 - ZAMKNIĘTE. Akcja zwraca tylko `code`; `TAKEOVER_ERROR_MESSAGES` jedynym źródłem. Wariant wybrany przez kody serwera, nie przez porównanie tekstów.
- U6 - ZAMKNIĘTE. `blocked` z serwera (`getRegistrationAvailability`: `disabled && !google && !facebook`). Wyjątek 1F akceptowany: `emailRefused` (`registration_disabled` w trakcie rejestracji) to stan znany tylko klientowi, a dodatkowy warunek zamknięcia dotyczy wyłącznie tego przypadku (bez `emailRefused` nie jest osiągalny przy `blocked = false`).

Nowe uwagi:

| # | Plik:linia | Problem | Wymagana zmiana | Priorytet | Adresat |
|---|---|---|---|---|---|
| N1 | `app/api/payments/hotpay/notify/route.ts` (gałąź `else if`) | Wyścig: zamówienie odczytane jako `pending`, anulowane przez przejęcie przed `UPDATE` - pakiet nieprzyznany (poprawnie), ale brak logu do ręcznego zwrotu | Przy `changed.length === 0` ponownie odczytać status albo logować także dla `order.status === 'pending'` | niski | backend |
| N2 | `components/auth/register-form.tsx:176`; `components/auth/auth-copy.ts` (`registerWelcomeCopy`) | Reguła "e-mail dostępny" (`emailMode !== 'disabled' && !emailBlocked`) liczona w dwóch miejscach | Jedna eksportowana funkcja w `auth-copy.ts` używana przez formularz | niski | frontend |
