# Raport bezpieczeństwa 001: rejestracja z kodem e-mail i łączenie kont OAuth

- Data: 2026-10-24. Etap 9 (część bezpieczeństwo), autor: tester-bezpieczenstwa. Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`.
- Zakres: commit `4a3df0a` i niezacommitowane poprawki U1-U6, P1-P6: `lib/register-email-mode.ts`, `actions/auth.ts`, `actions/account-takeover.ts`, `lib/account-takeover.ts`, `lib/account-purge.ts`, `lib/account-auth-state.ts`, `lib/oauth-link-policy.ts`, `lib/google-auth.ts`, `lib/admin-config.ts`, `lib/admin-session.ts`, `lib/security-events.ts`, `lib/migrate-email-verification.ts`, `auth.ts`, `proxy.ts`, `app/api/payments/hotpay/notify/route.ts`, `app/(auth)/login/zabezpiecz-konto/page.tsx`, `components/auth/account-takeover-screen.tsx`, migracja `0031`. Pominięto zmiany zadania 004.
- Metoda: przegląd kodu (STRIDE), macierze wyczerpujące w testach jednostkowych, uruchomienie 15 plików testów domeny (132 testy zaliczone), `npm audit --omit=dev`, skan sekretów w diffie. Środowisko: wyłącznie lokalne, baza `:memory:`/`file:`, bez SMTP, bez dostępu do produkcji.
- Nie testowano: przepływu z prawdziwym Google/Facebook (Preview), zachowania na wielu instancjach, nagłówków `Cache-Control` na zbudowanej aplikacji, DAST pełnego UI, batcha przejęcia na kopii bazy Turso (U8), Javy i Androida (poza zakresem zadania).

## Werdykt
**ODRZUCONE do usunięcia F-1** (wysoka podatność zależności `zod`, wykryta nowym skanem; poprawka jednolinijkowa, niezwiązana z kodem 001). Kod zadania 001: **brak ustaleń krytycznych ani wysokich**; pozostałe ustalenia są średnie i niskie. Po `npm audit fix` (zod >= 4.6.6) i powtórnym `npm audit --omit=dev` bez wysokich werdykt przechodzi na **ZATWIERDZONE Z UWAGAMI** (warunki wdrożenia w sekcji 4).

## Retest W1 (`00-model-zagrozen-bazowy.md`)
**Status: ZAMKNIĘTE dla nowych kont; ryzyko resztkowe dla kont sprzed wdrożenia (F-2, zaakceptowane przez właściciela, DW-5).**

| Ścieżka z W1 | Dowód | Wynik |
|---|---|---|
| Kod `1234` / tryb mock na produkcji | `getRegisterEmailMode` (`lib/register-email-mode.ts:31`): `test` tylko dla `NODE_ENV` development/test, bez SMTP i bez `VERCEL`/`RENDER`; `MOCK_REGISTER_EMAIL_CODE` usunięte z kodu. Test macierzowy `lib/security-001.test.ts` (8 wartości NODE_ENV x 6 x 6 znaczników x SMTP): `test` wyłącznie w dozwolonym przypadku; production, Preview (VERCEL=1, NODE_ENV=production) i Render zawsze `disabled` lub `smtp`. Schemat odrzuca `1234` (`^\d{6}$`). `grep` po kodzie produkcyjnym: brak `1234`/`MOCK_REGISTER`. | zamknięte |
| Rejestracja bez SMTP także serwerowo | `sendRegisterCode` (`actions/auth.ts:185`) i `registerUser` (`:264`) zwracają `registration_disabled` przed jakimkolwiek zapisem (po `guardAction`); UI nie jest jedyną barierą. Test `actions/auth.test.ts`. Bezpośrednie wywołanie akcji bez SMTP: bez zapisu. | zamknięte |
| Łączenie OAuth po e-mailu | Macierz wyczerpująca (`lib/security-001.test.ts`, 80 kombinacji): Facebook nigdy nie daje `link_existing`/`takeover_confirm`; Google bez `email_verified === true` nigdy nie łączy ani nie tworzy; odmowa identyczna dla konta istniejącego i nieistniejącego; admin bez weryfikacji nigdy nie trafia do przejęcia; istniejące powiązanie nigdy nie jest przenoszone (`ensureOauthLink` rzuca przy konflikcie). `email_verified` czytane ścisłym `=== true` (`auth.ts:173`). Zmiana e-maila w profilu Google nie zmienia konta: decyzja po `(provider, providerAccountId)`; w aplikacji brak funkcji zmiany e-maila. | zamknięte |
| Auto-admin po e-mailu | `resolveEffectiveRole` (`lib/admin-config.ts:34`) jedyne miejsce reguły; `ADMIN_EMAILS` działa tylko z `emailVerified`; adres właściciela usunięty z kodu (test: pusta lista nie daje admina). `syncAdminRoleOnLogin` woła tylko tę funkcję. Nowe konta z kodem SMTP lub Google są weryfikowane skrzynką, konta Facebook i trybu testowego nie. | zamknięte |

## Wyniki pozostałych punktów zlecenia

**(4) Przejęcie konta.** Token HMAC-SHA256 z `AUTH_SECRET` i prefiksem domenowym `takeover:`, stałoczasowe porównanie, TTL 10 min (granica sprawdzona testem), ładunek `{uid, pid, exp}` bez e-maila; brak sekretu = fail-closed. Testy: przedłużenie `exp`, podpis z innego kontekstu, ładunki spoza schematu, śmieci (bez wyjątków). `uid` pochodzi z serwera (`signIn`), nie od klienta: brak IDOR; akcje to server actions (kontrola Origin Next.js), więc CSRF nie dotyczy. Jednorazowość wynika ze stanu konta (`email_verified_at IS NULL`), nie ze zużycia tokenu: powtórka daje `expired`, przed przejęciem jest idempotentna. Wyścig dwóch urządzeń: reset z warunkiem, pozostałe instrukcje z warunkiem `email_verified_at = :now`; drugi batch niczego nie zmienia (test). Atomowość: jeden `db.batch`, błąd ostatniej instrukcji wycofuje całość (test). Wyciek danych dawnego konta: purge z metadanych FK + reset kolumn `users` (w tym `admin_note`, pakiet); zostają celowo `subscription_orders` (obowiązek przechowywania) i dowody (`site_activity_log`, `admin_audit_log`), niewidoczne dla użytkownika. Enumeracja przez OAuth: komunikat taki sam; różnica czasu opisana w F-8.

**(5) Sesje.** `session_version` w `jwt` i `proxy.ts`; cache 60 s per proces, `invalidateAccountAuthState` natychmiast na tej instancji; token bez `sv` = 0 (zgodność wsteczna), `sv` nieliczbowe nie omija podbitej wersji (test). Fail-open przy błędzie bazy: ocena w F-6. Sesje 30 dni bez odświeżania hasła (S2 w backlogu).

**(6) Rola admina.** Zgodnie z projektem; jedyne odstępstwo to konta z `app_role = admin` zapisanym w bazie, które zachowują rolę bez weryfikacji (F-2, F-11).

**(7) Kody weryfikacyjne.** 6 cyfr z `crypto.randomInt` (10^6), skrót SHA-256 z sekretem, porównanie `timingSafeEqual`, 5 prób zużywanych atomowo przed porównaniem (równoległe zgadywanie nie obejdzie limitu), ważność 10 min, usunięcie przy rejestracji i oportunistyczne sprzątanie po 24 h (bez crona). Granica odgadnięcia: limity per e-mail (wysyłka 5/h, zatwierdzenie 15/h) nie zależą od `X-Forwarded-For`, więc przy maks. 15 próbach/h szansa trafienia to około 1,5 x 10^-5 na godzinę na adres. Limity per IP są omijalne poza Vercelem (F-3).

**(8) HotPay notify.** Podpis SHA-256 z hasłem notyfikacji, porównanie stałoczasowe, 403 przed jakimkolwiek odczytem zamówienia; przedłużenie pakietu tylko po `UPDATE ... WHERE status='pending' RETURNING` (powtórki i wyścig równoległych SUCCESS: jeden zwycięzca, test). Uwagi w F-4.

**(9) Logi.** `logAuthFailure` zapisuje tylko miejsce i nazwę typu błędu; `meta` zdarzeń `security.*` ma wyłącznie `reason` i `provider` (test); e-mail usunięty z `site_activity_log` przy powiązaniu; log HotPay zawiera tylko identyfikatory; `onRequestError` obcina query z ścieżki. Wyjątek: F-7.

**(10) Migracja 0031 i backfill.** Migracja addytywna (dwie kolumny, `session_version DEFAULT 0 NOT NULL`), wpis w journalu i `ensure-schema` zgodne. Backfill nie podnosi uprawnień poza R-C (patrz F-2). Idempotentny (dotyka tylko `email_verified_at IS NULL`). Uruchamia się tylko przy `TURSO_DATABASE_URL` (lokalnie pomijany).

**(12) Zależności i sekrety.** `npm audit --omit=dev`: **1 wysoka** (F-1). Skan diffu (wzorce kluczy, tokenów, URL libsql, JWT, przypisania sekretów): brak trafień; `env.example` bez wartości.

## Ustalenia

### Wysokie
**F-1. Zależność `zod` 4.3.6 podatna (GHSA-mrhx-c7xc-m3w5, CVSS 4.0: 8.2, DoS pamięci)**
- Plik: `package.json:52` (`"zod": "^4.3.6"`), `package-lock.json`.
- Scenariusz: walidacja dużej tablicy z wieloma błędnymi elementami w schemacie `z.array` bez limitu wyczerpuje pamięć procesu. Schematy rejestracji i przejęcia tablic nie zawierają; tablice są w trasach po uwierzytelnieniu (`app/api/body-reports`, `workouts/complete`, `community/notifications/*`, `actions/backend.ts`), więc wektor to zalogowany użytkownik.
- Rekomendacja (backend): `npm audit fix` do zod >= 4.6.6, uruchomić testy; dodatkowo `.max()` na tablicach wejściowych. Blokuje wydanie według reguły repozytorium (`npm audit --omit=dev` bez wysokich).
- Odniesienie: CWE-770, OWASP A06:2021.

### Średnie
**F-2. Konta sprzed wdrożenia: R-B, R-C i brak unieważnienia sesji (ryzyko resztkowe, DW-5 zaakceptowane)**
- Plik: `lib/migrate-email-verification.ts:57-82`.
- Scenariusz A (R-B): jeśli przed wdrożeniem ktoś założył konto kodem `1234` na cudzy adres, a ofiara później dołączyła Google, backfill nadaje `email_verified_at`, a założyciel nadal zna hasło i ma ważne JWT (brak resetu hasła i podbicia `session_version`, decyzja DW-5). Scenariusz B (R-C): jeśli konto na adres z `ADMIN_EMAILS` z rolą admin założył ktoś inny (stary auto-admin), backfill je uwierzytelnia, a właściciel dołączy się do niego przez Google. Rola `admin` w bazie nie wymaga weryfikacji (F-11).
- Prawdopodobieństwo: zależy od faktycznego wykorzystania W1 w przeszłości; DW-1 potwierdza, że jedyne konto admin należy do właściciela.
- Rekomendacja (właściciel, nie kod): przed Promote sprawdzić w produkcyjnej bazie, czy konto admin ma wpis „Rejestracja konta” w `site_activity_log` z `emailCodeMock: true` i czy `created_at` zgadza się z jego pamięcią (zgodnie z `docs/prawo/001-bramka-wejsciowa-rejestracja.md`); przejrzeć konta z dołączonym Google po rejestracji hasłem (reguła R-B) pod kątem nieznanych adresów. Opcjonalnie później: podbicie `session_version` i wymuszenie ustawienia hasła dla kont R-B (osobna decyzja).
- Odniesienie: CWE-287, CWE-613; ASVS V2.5, V3.3.

**F-3. Limity per IP omijalne poza Vercelem (`X-Forwarded-For`; S7 z bazowego, bez zmian)**
- Plik: `lib/rate-limit.ts:70-76`, `lib/action-guard.ts:61-68` (klucz `action:<nazwa>:<sesja albo IP>`).
- Scenariusz: na Renderze atakujący zmienia pierwszy wpis `X-Forwarded-For` i omija limity IP oraz limit akcji dla anonima: `sendRegisterCode` pozwala bez ograniczeń sprawdzać, które adresy mają konto (`account_exists`, F-8). Limity per e-mail (kody, logowanie) działają, więc brute force kodu i hasła nadal jest ograniczony. Bez Upstash limity są per proces.
- Rekomendacja (backend): IP z zaufanego nagłówka platformy (np. ostatni hop lub `cf-connecting-ip` zależnie od proxy Rendera), Upstash w produkcji z wpisem w `admin-config-status`.
- Odniesienie: CWE-348, CWE-307; API4:2023.

**F-4. HotPay notify: brak atomowości i zmiana zachowania dla ponowionej płatności (U1)**
- Plik: `app/api/payments/hotpay/notify/route.ts:78-106,110-116`.
- Scenariusze: (a) status zmieniany na `paid`, dopiero potem `extendUserPackage`; błąd lub restart między krokami zostawia opłacone zamówienie bez pakietu, a ponowienie od HotPay jest już bez efektu (`changed` puste, `paid`). (b) SUCCESS po FAILURE dla tego samego `ID_ZAMOWIENIA` (ponowna próba płatności) trafia do gałęzi „do zwrotu” i nie przyznaje pakietu, choć wcześniej przyznawał. (c) gałąź FAILURE aktualizuje wiersz bez warunku `status='pending'`, więc przy wyścigu z SUCCESS może zmienić `paid` na `failed`.
- Rekomendacja (backend): zmiana statusu i przedłużenie w jednym `db.batch`, warunek `status='pending'` w gałęzi FAILURE; potwierdzić u HotPay, czy numer zamówienia bywa używany ponownie po FAILURE i ewentualnie dopuścić `failed` -> `paid` (przejście wprost). Podpis i idempotencja poprawne; N4 (brak porównania `KWOTA`/`SEKRET` z zamówieniem) bez zmian.
- Odniesienie: CWE-362, CWE-840.

### Niskie
**F-5. Token przejęcia w adresie URL**
- Plik: `auth.ts:179-182`, `app/(auth)/login/zabezpiecz-konto/page.tsx`.
- Ochrona obecna: `referrer: no-referrer` w metadanych strony, `robots` noindex, ścieżka bez cache (strona dynamiczna), logi serwera obcinają query (`safePath`), tracker analityczny zapisuje sam `pathname`. Luki: adres z `?t=` zostaje w historii przeglądarki, w logach dostępowych hostingu i w Sentry (zdarzenia i nawigacje niosą pełny URL; `sendDefaultPii: false` nie obcina query); brak jawnego `Cache-Control: no-store` dla tej trasy w `next.config.ts` (jak dla `/login` i `/register`), nie zweryfikowano nagłówka na buildzie. Wpływ ograniczony: token żyje 10 min i pozwala jedynie wyzwolić przejęcie na rzecz właściciela konta Google z tokenu (zniszczenie danych niezweryfikowanego konta), nie daje dostępu.
- Rekomendacja: po odczycie usunąć `t` z paska (`history.replaceState`), `beforeSend`/`beforeBreadcrumb` w Sentry czyszczące query tej trasy, dopisać trasę do nagłówków `no-store`.

**F-6. Fail-open sprawdzania sesji przy błędzie bazy (ocena)**
- Plik: `auth.ts:217-220`, `proxy.ts:57-60`.
- Ocena: akceptowalne. Okno nadużycia unieważnionej sesji (np. dawny właściciel po przejęciu) jest równe czasowi awarii bazy, w którym i tak brak dostępu do danych; logi dławione (1/min, bez parametrów). Ryzyka dodatkowe: rola w tokenie pozostaje nieodświeżona w trakcie awarii (admin odebrany w panelu jeszcze działa); cache 60 s na każdej instancji osobno (po przejęciu inne instancje akceptują starą sesję do 60 s). Rekomendacja: przy skalowaniu poziomym rozważyć krótszy TTL dla ról uprzywilejowanych.

**F-7. Niełapane błędy bazy w `sendRegisterCode` mogą zawierać adres e-mail**
- Plik: `actions/auth.ts:194-240` (select/delete/insert bez `try/catch`; w `registerUser` błąd jest obsłużony).
- Scenariusz: błąd Drizzle (np. awaria Turso) ma w komunikacie parametry zapytania (e-mail, skrót kodu); trafia do `onRequestError`/Sentry. Rekomendacja: ten sam wzorzec `logAuthFailure` + `AppError("INTERNAL")`.
- Odniesienie: CWE-532; standard „brak danych osobowych w logach i Sentry”.

**F-8. Enumeracja kont (stan bazowy N5 i różnice czasowe)**
- `sendRegisterCode` zwraca `account_exists` (wymagane UX, limit patrz F-3). `authorize` w `auth.ts:116-120`: brak konta = natychmiastowe `null`, istniejące konto = bcrypt (czas jak ~250 ms), więc czas odpowiedzi ujawnia istnienie adresu (limit per e-mail 20/15 min, per IP omijalny); rozwiązanie: fikcyjne porównanie bcrypt. Odmowy OAuth: `resolveOAuthSignIn` (`lib/google-auth.ts:307-314`) zapisuje wiersz audytu tylko, gdy konto istnieje, więc różnica czasu rzędu pojedynczego zapisu odróżnia istniejące konto dla atakującego z własnym kontem Google bez potwierdzonego adresu; ten sam wektor pozwala zapełniać `admin_audit_log` wpisami `oauth_link_rejected` (brak limitu, retencja 180 dni). Wpływ niski.

**F-9. Warunek `takenOverNow` oparty o równość milisekund**
- `lib/account-takeover.ts:135`. Drugi batch z tą samą wartością `now` co pierwszy (identyczna milisekunda) uznałby konto za „przejęte w tym batchu” i powtórzył purge. Praktycznie nieosiągalne (batche serializowane, bcrypt przed każdym), do ewentualnego wzmocnienia unikalnym znacznikiem (np. `session_version` po zwiększeniu). Pokrewne: przy wyścigu `INSERT oauth_accounts ... ON CONFLICT DO NOTHING` konto zostaje wyczyszczone bez powiązania, jeśli `pid` zdążył zostać powiązany gdzie indziej; skutek: ponowne logowanie wejdzie na tamto konto, brak ucieczki danych.

**F-10. Domeny firmowe Google i brak ograniczenia `hd`**
- `email_verified` dla adresu w domenie zarządzanej przez Google Workspace potwierdza administrator tenantu. Były pracownik lub administrator domeny może uzyskać potwierdzony Google dla adresu, na który istnieje konto w GymBrat (łączenie `link_existing` bez wiedzy użytkownika). Ryzyko resztkowe typowe dla OAuth po e-mailu; rozważyć zawężenie auto-łączenia do `@gmail.com`/`@googlemail.com` albo wymóg potwierdzenia hasłem dla innych domen.

**F-11. Rola `admin` zapisana w bazie nie wymaga weryfikacji e-maila**
- `lib/admin-config.ts:39`. Udokumentowane (US-6, właściciel nie traci panelu). Konsekwencja: dotyczy tylko kont sprzed wdrożenia; nowe konta admina powstają wyłącznie ze zweryfikowanego adresu lub ręcznie przez głównego admina w panelu (`isOwnerAdminActor`). Powiązane z F-2.

## 4. Warunki wdrożenia i testy na Preview
1. Usunąć F-1, powtórzyć `npm audit --omit=dev` (oczekiwane 0 wysokich) i `npm test`.
2. Właściciel: audyt konta admina i kont R-B (F-2) przed Promote; `ADMIN_EMAILS` ustawione (DW-3).
3. Preview (tester): pełny przepływ Google (nowe konto, link do zweryfikowanego, odmowa przy `email_verified=false`), Facebook (odmowa dla istniejącego adresu), przejęcie z dwóch urządzeń, nagłówki odpowiedzi `/login/zabezpiecz-konto`, batch przejęcia na kopii bazy (U8).
4. Backlog (właściciel `backend`): F-3, F-4, F-7, F-8 jako zadania; F-5, F-6, F-9, F-10 jako niskie.

## 5. Testy dodane
`lib/security-001.test.ts` (20 testów, bez zmian w kodzie produkcyjnym): macierz trybu kodu rejestracji, niezmienniki decyzji OAuth, reguła roli admina, odporność tokenu przejęcia, brzegi `isTokenRevoked`. Wynik: 20/20 zaliczone; razem z istniejącymi testami domeny 132/132.

## 6. Sygnały dla prawnika
Zdarzenia `security.*` nie zawierają danych osobowych (potwierdzone testem). F-5 (token w logach hostingu i Sentry) i F-7 (e-mail w logach błędów) do oceny pod kątem minimalizacji danych. F-2 dotyczy możliwego wcześniejszego nieuprawnionego dostępu do danych o ciele (incydent z BR-14/LR-27, ocena przed Promote).
