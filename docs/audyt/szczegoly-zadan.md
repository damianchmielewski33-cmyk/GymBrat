# Szczegóły zadań (podzadania Z1–Z83)

Szczegółowe opisy drobnych zadań z audytu z 2026-11-01. **Nie wydawaj poleceń „zrealizuj zN" — pracuje się na dużych US1–US20 z [backlog-us.md](backlog-us.md)**, a każdy US wskazuje, które zadania Z zawiera. Ten plik to „specyfikacja" podzadań: story, kryteria akceptacji, zależności, pliki. Przy realizacji US czytaj tu tylko sekcje `## Zn` wymienione w danym US (Ctrl+F `## Z5 `).

Odnośniki do „Zn" w opisach poniżej to zadania z tego pliku (nie US z backlog-us.md). Stare identyfikatory epików (`E1-2` itd.) są w nagłówku każdej sekcji.

Statusy w tabeli poniżej są per podzadanie; po jego zakończeniu zmień na `ZROBIONE (data)` i zaktualizuj też status US w [backlog-us.md](backlog-us.md).

Prio: P0 blokuje komercjalizację · P1 przed startem sprzedaży · P2 krótko po starcie · P3 porządki. Rozmiar: S ≤ 1 d, M 2–3 d, L 4–6 d.

Lokalne uruchomienie do weryfikacji: `.env.local` z `TURSO_DATABASE_URL=file:./local.db`, `AUTH_SECRET`, `NEXTAUTH_URL=http://localhost:3000`; dane mock: `node scripts/seed-local-mock.cjs` (konta `mock.user|friend|admin@gymbrat.test`, hasło w `MOCK_PASSWORD` lub domyślne developerskie z tego skryptu). Testowe `HOTPAY_SEKRET` i `HOTPAY_NOTIFICATION_PASSWORD` tylko lokalnie.

## Indeks i status

| Z | Tytuł | Typ | Prio | Rozm. | Status |
|---|---|---|---|---|---|
| Z1 | Podmiot sprzedający | decyzja | P0 | S | TODO |
| Z2 | Model Free/Premium i cennik | decyzja | P0 | S | TODO |
| Z3 | Decyzja o reklamach (AdMob) | decyzja | P0 | S | TODO |
| Z4 | Naprawa webhooka HotPay | kod | P0 | S | TODO |
| Z5 | Weryfikacja kwoty i atomowe księgowanie | kod | P0 | M | TODO |
| Z6 | Zapis zgód konsumenckich przy zakupie | kod | P0 | M | TODO |
| Z7 | Anonimizacja zamówień zamiast kaskady | kod | P0 | M | TODO |
| Z8 | Testy płatności | kod | P0 | M | TODO |
| Z9 | Realna wartość pakietu | kod | P0 | L | TODO |
| Z10 | Gating Premium po stronie serwera | kod | P0 | M | TODO |
| Z11 | Rejestr zgód i zgoda na dane zdrowotne | kod+prawnik | P0 | L | TODO |
| Z12 | Analityka i monitoring tylko po zgodzie | kod | P0 | M | TODO |
| Z13 | Minimalny wiek 16 lat | kod | P0 | M | TODO |
| Z14 | Usuwanie konta z ponownym uwierzytelnieniem | kod | P0 | M | TODO |
| Z15 | Dokumenty prawne i podmioty przetwarzające | kod+prawnik | P0 | M | TODO |
| Z16 | Test „trasy API vs proxy" | kod | P0 | S | TODO |
| Z17 | SMTP produkcyjny | decyzja+konfig | P0 | S | TODO |
| Z18 | Decyzja: Java, iframe AWP, repo prywatne | decyzja | P1 | S | TODO |
| Z19 | Decyzja: płatności na Androidzie | decyzja | P1 | S | TODO |
| Z20 | Historia zamówień i e-mail z potwierdzeniem | kod | P1 | M | TODO |
| Z21 | Faktury / paragony | kod | P1 | L | TODO |
| Z22 | Panel zamówień i zwroty (admin) | kod | P1 | M | TODO |
| Z23 | Alerty płatności | kod | P1 | S | TODO |
| Z24 | Przypomnienie o końcu pakietu i odnowienie | kod | P1 | M | TODO |
| Z25 | Publiczna strona `/usun-konto` | kod | P1 | S | TODO |
| Z26 | Kompletny eksport danych | kod | P1 | S | TODO |
| Z27 | Pollinations bez danych osobowych | kod | P1 | S | TODO |
| Z28 | Retencja i automatyczne usuwanie danych | kod+prawnik | P1 | M | TODO |
| Z29 | CSP w trybie egzekwowania | kod | P1 | M | TODO |
| Z30 | Rate limiting produkcyjny i zaufane IP | kod | P1 | S | TODO |
| Z31 | Java fail-closed (lub usunięcie) | kod | P1 | S | TODO |
| Z32 | 2FA i blokada dla admina; usunięcie PIN-u | kod | P1 | M | TODO |
| Z33 | Repo prywatne i higiena drzewa | kod/konfig | P1 | S | TODO |
| Z34 | Test uprawnień tras admina | kod | P1 | S | TODO |
| Z35 | Jedna definicja tygodnia i minut cardio | kod | P1 | M | TODO |
| Z36 | Komunikaty rejestracji bez SMTP | kod | P1 | S | TODO |
| Z37 | Obecność w treningu tylko przy udostępnianiu | kod | P1 | S | TODO |
| Z38 | Spójne cardio także bez planu | kod | P1 | S | TODO |
| Z39 | Zdjęcia w magazynie obiektowym | kod | P1 | L | TODO |
| Z40 | Jedno źródło schematu bazy | kod | P1 | L | TODO |
| Z41 | Pomiar wydajności na buildzie produkcyjnym | kod/pomiar | P1 | S | TODO |
| Z42 | Lint zielony | kod | P1 | L | TODO |
| Z43 | E2E krytycznych ścieżek | kod | P1 | L | TODO |
| Z44 | Testy kontraktowe liczb między ekranami | kod | P1 | M | TODO |
| Z45 | Rozszerzony `deploy:check` | kod | P1 | S | TODO |
| Z46 | Naprawa i utrzymanie specyfikacji E2E | kod | P1 | M | TODO |
| Z47 | Staging z testowymi kluczami HotPay | konfig | P1 | M | TODO |
| Z48 | Test przywracania backupu | ops | P1 | S | TODO |
| Z49 | Monitoring, alerty, status | ops | P1 | M | TODO |
| Z50 | Wsparcie klienta i reklamacje | kod | P1 | S | TODO |
| Z51 | Publikacja Android w Google Play | ops+kod | P1 | L | TODO |
| Z52 | Soft launch i decyzja go/no-go | ops | P1 | M | TODO |
| Z53 | KPI i lejek | kod | P1 | M | TODO |
| Z54 | Kody promocyjne i Badania — definicja albo usunięcie | decyzja+kod | P2 | S | TODO |
| Z55 | Zmiana cen bez wdrożenia | kod | P2 | S | TODO |
| Z56 | Ograniczenie osadzania w iframe | kod | P2 | S | TODO |
| Z57 | Skan zależności i rotacja sekretów | kod+dok | P2 | S | TODO |
| Z58 | Onboarding świadomy historii | kod | P2 | M | TODO |
| Z59 | Kontekstowy przycisk pływający | kod | P2 | S | TODO |
| Z60 | Tytuły stron i nazewnictwo sekcji | kod | P2 | S | TODO |
| Z61 | Stany ładowania i wykresy bez błędów wymiarów | kod | P2 | S | TODO |
| Z62 | Seria 0 kg — świadomy wybór | kod | P2 | S | TODO |
| Z63 | Jedno sterowanie niedokończonym treningiem | kod | P2 | S | TODO |
| Z64 | Dostępny formularz raportu ciała | kod | P2 | M | TODO |
| Z65 | Jeden wzorzec nagłówka ekranu | kod | P2 | M | TODO |
| Z66 | Tokeny kolorów i kontrast | kod | P2 | M | TODO |
| Z67 | Jeden komponent kafla statystyki | kod | P2 | S | TODO |
| Z68 | Strefa bezpieczna dolnej nawigacji | kod | P2 | S | TODO |
| Z69 | Dokończenie przeglądu wizualnego ekranów | pomiar | P2 | M | TODO |
| Z70 | Mniejszy payload RSC (Dieta/Tydzień, Atlas) | kod | P2 | M | TODO |
| Z71 | Mniej zapisów synchronizacji treningu | kod | P2 | M | TODO |
| Z72 | CAS w modułach społeczności | kod | P2 | M | TODO |
| Z73 | Realizacja decyzji o Javie | kod | P2 | M | TODO |
| Z74 | Dostępność WCAG AA | kod | P2 | M | TODO |
| Z75 | Panel finansowy | kod | P2 | M | TODO |
| Z76 | Publiczna strona produktu | kod | P2 | M | TODO |
| Z77 | Usunięcie `inbox` i roli `trener` | kod | P3 | S | TODO |
| Z78 | Usunięcie martwych komponentów | kod | P3 | S | TODO |
| Z79 | Mniej pollingu społeczności | kod | P3 | M | TODO |
| Z80 | Rozbicie dużych modułów | kod | P3 | L | TODO |
| Z81 | Przypomnienia treningowe za zgodą | kod | P3 | M | TODO |
| Z82 | Mapa drogowa funkcji Premium | decyzja | P3 | S | TODO |
| Z83 | Aktualizacja dokumentacji projektu | dok | P3 | S | TODO |

Kolejność i zależności: patrz backlog-us.md.

---

## Z1 — Podmiot sprzedający  *(dawne E0-1)*
**Typ** decyzja · **P0** · S · **Zależności** brak · **Źródło** PAY-6
**Story** Jako właściciel chcę zdecydować o formie prowadzenia sprzedaży, aby legalnie przyjmować płatności.
**AC** Decyzja zapisana w `docs/zespol/decyzje-wlasciciela.md` (działalność gospodarcza lub inna forma, dane sprzedawcy: nazwa, adres, NIP, e-mail, rozliczanie VAT); dane gotowe do wpisania w `lib/legal-seller.ts`.
**Wskazówki** Obecnie D17: administrator = osoba prywatna; sprzedaż bez działalności to bloker prawny niezależny od kodu. Zapytaj właściciela; nie zgaduj.

## Z2 — Model Free/Premium i cennik  *(E0-2)*
**Typ** decyzja · **P0** · S · **Zależności** brak · **Źródło** BIZ-2, BIZ-3
**Story** Jako właściciel chcę określić, co jest darmowe, a co płatne, aby klient wiedział za co płaci.
**AC** Lista funkcji Premium, cennik (dziś 3,99/8,99/24,99/79,99 zł za 7/30/90/365 dni), czy odnowienia automatyczne, czy okres próbny; zapis w decyzjach.
**Wskazówki** Kandydaci: zaawansowana analiza postępów, raporty PDF, import planów, ghost-training, historia bez limitu 400 sesji. Wejście dla Z9, Z10, Z82.

## Z3 — Decyzja o reklamach (AdMob)  *(E0-3)*
**Typ** decyzja · **P0** · S · **Zależności** brak · **Źródło** BIZ-1, D24
**Story** Jako właściciel chcę zdecydować o AdMob, aby oferta „bez reklam" miała sens.
**AC** Decyzja: konfigurujemy AdMob (i pakiet znosi reklamy) albo usuwamy „bez reklam" z oferty (wtedy Z9 definiuje inną wartość pakietu).
**Wskazówki** Dziś brak reklam w aplikacji, a `/package` obiecuje „Bez reklam przed treningiem / przy dodawaniu produktu" (`components/package/package-page-client.tsx`, `lib/admob-gate.ts`).

## Z4 — Naprawa webhooka HotPay  *(E1-1)*
**Typ** kod · **P0** · S · **Zależności** brak · **Źródło** PAY-1 (potwierdzone `curl`em: 401)
**Story** Jako klient chcę, aby po zapłaceniu pakiet aktywował się automatycznie, aby nie tracić pieniędzy.
**AC** `POST /api/payments/hotpay/notify` omija sprawdzanie sesji w `proxy.ts` (wyjątek jak dla `/api/cron/`); anonimowy POST z poprawnym hashem → 200 `OK`, z błędnym → 403; nie dodawać trasy do `ANONYMOUS_PUBLIC_PATHS`; test regresji (proxy przepuszcza trasę); dopisek w changelogu (`planned: true`).
**Wskazówki** `proxy.ts` (lista wyjątków u góry funkcji `proxy`), `app/api/payments/hotpay/notify/route.ts`, `lib/hotpay.ts`. CSRF dla webhooka nie dotyczy (zewnętrzny serwer) — trasa i tak go nie używa. Lokalny test: `HOTPAY_*` w `.env.local`, hash SHA-256 `HASŁO;KWOTA;ID_PLATNOSCI;ID_ZAMOWIENIA;STATUS;SEKRET`.

## Z5 — Weryfikacja kwoty i atomowe księgowanie  *(E1-2)*
**Typ** kod · **P0** · M · **Zależności** Z4 (do testu end-to-end) · **Źródło** PAY-2 (potwierdzone), PAY-3
**Story** Jako właściciel chcę, aby pakiet był przyznawany tylko za zgodną kwotę i dokładnie raz, aby nie tracić przychodu ani nie dawać pakietu za grosze.
**AC** `KWOTA` z powiadomienia musi równać się `subscription_orders.amount_grosze` (format `formatHotpayKwota`), inaczej zamówienie dostaje status `amount_mismatch`, log+alert i **brak** pakietu; zmiana statusu i przedłużenie pakietu w jednej transakcji (`db.batch`) albo ponawialne księgowanie (`fulfilled_at`); testy: powtórzone powiadomienie, FAILURE→SUCCESS, awaria w połowie, równoległe powiadomienia, niezgodna kwota (19,99 zł vs `0.01` — odtworzone lokalnie).
**Wskazówki** `app/api/payments/hotpay/notify/route.ts`, `lib/user-package.ts` (`extendUserPackage`), `db/schema.ts` (`subscriptionOrders`; zmiana schematu → skill `gymbrat-db-migration`). Dziś powtórzone powiadomienie jest idempotentne — nie zepsuj tego.

## Z6 — Zapis zgód konsumenckich przy zakupie  *(E1-3)*
**Typ** kod+prawnik · **P0** · M · **Zależności** Z15 (treść zgód) · **Źródło** PAY-4
**Story** Jako sprzedawca chcę mieć dowód zgody na natychmiastowe świadczenie i utratę prawa odstąpienia, aby wygrać ewentualny spór.
**AC** `POST /api/package/checkout` wymaga `termsAccepted: true` i `immediateServiceConsent: true`; zapis w zamówieniu: znaczniki czasu, wersja regulaminu, hash tekstu zgody; checkout bez zgody → 400; test; UI wysyła flagi.
**Wskazówki** `app/api/package/checkout/route.ts`, `components/package/package-page-client.tsx` (dziś checkbox tylko po stronie klienta), `app/(legal)/regulamin/page.tsx` §7.

## Z7 — Anonimizacja zamówień zamiast kaskady  *(E1-4)*
**Typ** kod · **P0** · M · **Zależności** brak · **Źródło** PAY-5
**Story** Jako sprzedawca chcę zachować dokumentację sprzedaży po usunięciu konta, aby spełnić obowiązki księgowe.
**AC** `subscription_orders.user_id` nullable / `ON DELETE SET NULL` (migracja, skill `gymbrat-db-migration`) + pola minimalne do rozliczeń (kwota, data, status, id płatności, sku); usunięcie konta nie kasuje zamówień; retencja 5 lat opisana w `docs/prawo/01-podstawy-prawne-i-retencja.md`; test.
**Wskazówki** `db/schema.ts` (`subscriptionOrders`, `onDelete: "cascade"`), `app/api/user/account/route.ts`, `lib/account-purge.ts`.

## Z8 — Testy płatności  *(E1-8)*
**Typ** kod · **P0** · M · **Zależności** Z4, Z5 · **Źródło** PAY-9
**Story** Jako zespół chcemy automatycznych testów płatności, aby regresje nie przechodziły niezauważone.
**AC** Testy `lib/hotpay.ts` (hash, `timingSafeEqualHex`, `formatHotpayKwota`), trasy `notify` (scenariusze z Z5), checkoutu (autoryzacja, CSRF, nieaktywny plan, brak konfiguracji 503, limit); opcjonalnie E2E z symulatorem webhooka. Bez prawdziwych kluczy.
**Wskazówki** Wzór testu handlera: import `POST` z route i `Request` z `application/x-www-form-urlencoded`; baza w pamięci `db/test-memory-db.ts`.

## Z9 — Realna wartość pakietu  *(E2-1)*
**Typ** kod · **P0** · L · **Zależności** Z2, Z3 · **Źródło** BIZ-1, BIZ-3
**Story** Jako klient chcę, aby pakiet dawał realną wartość, aby miało sens za niego płacić.
**AC** Zgodnie z Z2/Z3: albo AdMob skonfigurowany i reklamy znikają po aktywacji pakietu (test), albo zdefiniowane funkcje Premium działają za `getUserPackageStatus` po stronie serwera; `/package` wymienia dokładnie to, co jest odblokowane; brak sprzedaży przed spełnieniem warunku (checkout wyłączony do czasu).
**Wskazówki** `lib/user-package.ts`, `lib/admob-gate.ts`, `components/ads/`, `app/(dashboard)/package/page.tsx`.

## Z10 — Gating Premium po stronie serwera  *(E2-2)*
**Typ** kod · **P0** · M · **Zależności** Z2 · **Źródło** BIZ-3
**Story** Jako właściciel chcę, aby funkcje Premium nie dały się obejść zmianą UI.
**AC** Pojedyncza funkcja `requirePremium()` w `lib/user-package.ts`, użyta w akcjach/trasach Premium; użytkownik bez pakietu dostaje 402/403 (kod błędu w `lib/errors`); wygasły pakiet obsłużony (grace period opisany); testy.
**Wskazówki** Skill `gymbrat-server-action`.

## Z11 — Rejestr zgód i zgoda na dane zdrowotne  *(E3-1)*
**Typ** kod+prawnik · **P0** · L · **Zależności** Z15 (treści) · **Źródło** prawo R1; potwierdzone: kreator raportu nie ma kroku zgody
**Story** Jako użytkownik chcę świadomie wyrazić i cofnąć zgodę na przetwarzanie danych o ciele i zdjęć, aby kontrolować swoje dane.
**AC** Tabela `user_consents` (typ, wersja, czas, źródło) — już istnieje w schemacie, zweryfikować i uzupełnić; ekran zgód przy rejestracji i dla obecnych użytkowników; osobne zgody: zdrowie/ciało, zdjęcia, społeczność, analityka, reklamy, push; cofnięcie w Profilu; brak zapisu danych objętych zgodą bez niej (raport ciała, zdjęcia, tętno); testy.
**Wskazówki** `actions/consents.ts`, `lib/consents.ts`, `lib/consent-preferences.ts`, `components/consent/`, `components/reports/body-report-form.tsx`. Skill `gymbrat-sensitive-data`.

## Z12 — Analityka i monitoring tylko po zgodzie  *(E3-2)*
**Typ** kod · **P0** · M · **Zależności** Z11 · **Źródło** prawo R2
**Story** Jako użytkownik chcę, aby PostHog i Sentry klienta działały tylko po mojej zgodzie.
**AC** Inicjalizacja warunkowa na zgodzie; brak zdarzeń/skryptów przed zgodą (test sieciowy); „Tylko niezbędne" nie ładuje analityki.
**Wskazówki** `lib/analytics/posthog.ts`, `lib/analytics/track.ts`, `components/sentry-client.tsx`, `components/analytics-tracker.tsx`.

## Z13 — Minimalny wiek 16 lat  *(E3-3)*
**Typ** kod · **P0** · M · **Zależności** Z11 (oświadczenie) · **Źródło** D18, prawo
**Story** Jako właściciel chcę, aby konta zakładały tylko osoby 16+.
**AC** Walidacja wieku przy rejestracji e-mail, OAuth i uzupełnianiu profilu (dziś `age >= 13` w `lib/profile-complete.ts`); oświadczenie zapisane w rejestrze zgód; obsługa istniejących kont < 16; pakiety od 18; testy.
**Wskazówki** `lib/profile-complete.ts`, `actions/auth.ts` (`registerSchema`), `actions/onboarding.ts`.

## Z14 — Usuwanie konta z ponownym uwierzytelnieniem  *(E3-4)*
**Typ** kod · **P0** · M · **Zależności** Z7 · **Źródło** PAY-5, RODO art. 17
**Story** Jako użytkownik chcę bezpiecznie usunąć konto i dane.
**AC** Wymaga hasła/kodu e-mail lub świeżego logowania OAuth (dziś wystarczy sesja + CSRF); usuwa dane zdrowotne, zdjęcia, push, sesje; zamówienia anonimizowane (Z7); potwierdzenie e-mailem; test kaskady po tabelach z `user_id`.
**Wskazówki** `app/api/user/account/route.ts`, `lib/account-purge.ts`, `components/profile/` (UI usuwania).

## Z15 — Dokumenty prawne i podmioty przetwarzające  *(E3-9)*
**Typ** kod+prawnik · **P0** · M · **Zależności** Z1 · **Źródło** prawo
**Story** Jako właściciel chcę komplet dokumentów zatwierdzonych przez prawnika, aby sprzedawać bez ryzyka.
**AC** Regulamin (usługi cyfrowe, odstąpienie, reklamacje, dane sprzedawcy), polityka prywatności (tętno/kroki, transfery poza EOG, Pollinations), rejestr czynności, umowy powierzenia (Turso, Sentry, PostHog, Upstash, hosting, SMTP), DPIA dla danych zdrowotnych; wersjonowanie tekstów powiązane z Z6/Z11. Projekty w `docs/prawo/`; **zatwierdzenie przez człowieka-prawnika — nie deklarować jako gotowe**.
**Wskazówki** `app/(legal)/`, `docs/prawo/00-inwentaryzacja-danych.md`, `docs/prawo/01-podstawy-prawne-i-retencja.md`.

## Z16 — Test „trasy API vs proxy"  *(E8-2)*
**Typ** kod · **P0** · S · **Zależności** brak (najlepiej razem z Z4) · **Źródło** PAY-1
**Story** Jako zespół chcemy testu, który wykrywa trasy API bez ochrony sesji lub bez jawnego wyjątku.
**AC** Test wylicza `app/api/**/route.ts` i porównuje z jawną listą publicznych tras z `proxy.ts`/`lib/auth-public-paths.ts`; nowa publiczna trasa wymaga dopisku do listy; test czerwony, gdy trasa wymagająca zewnętrznego wywołania (webhook) nie jest na liście.
**Wskazówki** Wzór: `lib/auth-public-paths.test.ts`.

## Z17 — SMTP produkcyjny  *(E9-1)*
**Typ** decyzja+konfig · **P0** · S · **Zależności** brak · **Źródło** D3, D22
**Story** Jako nowy użytkownik chcę zarejestrować się e-mailem, a nie tylko przez Google.
**AC** Dedykowana skrzynka; `SMTP_*` na hostingu; SPF/DKIM/DMARC; rejestracja kodem i reset hasła działają na produkcji; widoczne w `lib/admin-config-status.ts`.
**Wskazówki** Bez SMTP `getRegisterEmailMode()` zwraca `disabled` na hostingu (kod `1234` już naprawiony). Konfiguracja po stronie właściciela; agent przygotowuje checklistę i test.

## Z18 — Decyzja: Java, iframe AWP, repo prywatne  *(E0-4)*
**Typ** decyzja · **P1** · S · **Zależności** brak · **Źródło** SEC-4, SEC-6, ARCH-3
**Story** Jako właściciel chcę zdecydować o backendzie Java, osadzaniu AWP i widoczności repo.
**AC** Trzy decyzje w `decyzje-wlasciciela.md`: Java (usuwamy / wymagamy tokenu), AWP iframe (zostaje / znika), repo (prywatne). Odblokowują Z31, Z33, Z56, Z73.

## Z19 — Decyzja: płatności na Androidzie  *(E0-5)*
**Typ** decyzja · **P1** · S · **Zależności** brak · **Źródło** BIZ-5
**Story** Jako właściciel chcę wybrać strategię płatności dla Androida, aby publikacja w Play nie została zablokowana.
**AC** Opcja A: Android bez zakupów w aplikacji (zakup tylko na stronie) lub B: Play Billing; uzasadnienie zgodne z polityką Google Play dla usług cyfrowych; zapis decyzji. Odblokowuje Z51.

## Z20 — Historia zamówień i e-mail z potwierdzeniem  *(E1-5)*
**Typ** kod · **P1** · M · **Zależności** Z17, Z4 · **Źródło** PAY-6, PAY-7
**Story** Jako klient chcę widzieć historię zamówień i dostać e-mail z potwierdzeniem zakupu.
**AC** Sekcja „Moje zamówienia" w Profilu (status, kwota, plan, data); e-mail transakcyjny po `paid`; ekran po powrocie z bramki (`/package?paid=1&order=…`) pokazuje faktyczny status (pending/paid/failed) z odświeżaniem.
**Wskazówki** `app/(dashboard)/package/page.tsx`, `lib/email.ts`, `app/api/package/status/route.ts`.

## Z21 — Faktury / paragony  *(E1-6)*
**Typ** kod · **P1** · L · **Zależności** Z1, Z20 · **Źródło** PAY-6
**Story** Jako klient chcę otrzymać dokument sprzedaży, aby go rozliczyć.
**AC** Zależnie od Z1: generowanie dokumentu/PDF lub integracja z systemem fakturowym; dane nabywcy opcjonalne (NIP); numeracja; dostęp w „Moje zamówienia".

## Z22 — Panel zamówień i zwroty (admin)  *(E1-7)*
**Typ** kod · **P1** · M · **Zależności** Z5 · **Źródło** PAY-7, PAY-8
**Story** Jako administrator chcę widzieć listę zamówień i obsługiwać zaległe oraz zwroty.
**AC** Cron oznacza `pending` starsze niż 24 h jako `expired`; panel admina: lista zamówień z filtrem statusu, ręczne zaksięgowanie/anulowanie, notatka o zwrocie; alert dla „zapłacone za zamówienie anulowane"; idempotencja checkoutu (ponowne kliknięcie używa istniejącego `pending` w ostatnich 15 min); własny klucz limitu `RATE.checkout` (dziś `RATE.adminMutation`).
**Wskazówki** `app/admin/(panel)/packages/page.tsx` (dziś tylko ceny, brak zamówień), `app/api/cron/cleanup/route.ts`.

## Z23 — Alerty płatności  *(E1-9)*
**Typ** kod · **P1** · S · **Zależności** Z5 · **Źródło** ARCH-7
**Story** Jako właściciel chcę alert, gdy płatność jest zaksięgowana bez pakietu lub zamówienie wisi zbyt długo.
**AC** Zdarzenia do Sentry/logów z tagiem `payments`; widżet w panelu admina (`pending` > 1 h, `paid` bez `fulfilled_at`).

## Z24 — Przypomnienie o końcu pakietu i odnowienie  *(E2-3)*
**Typ** kod · **P1** · M · **Zależności** Z9, Z20 · **Źródło** PAY-7
**Story** Jako klient chcę przypomnienie przed końcem pakietu i przedłużenie jednym kliknięciem.
**AC** Banner przy ≤ 7 dniach; e-mail/push opcjonalnie (za zgodą, Z11); „Przedłuż" wybiera ten sam plan; przedłużanie liczy od końca bieżącego pakietu (`extendUserPackage`).

## Z25 — Publiczna strona `/usun-konto`  *(E3-5)*
**Typ** kod · **P1** · S · **Zależności** Z14 · **Źródło** D23
**Story** Jako użytkownik Google Play chcę znaleźć instrukcję usunięcia konta bez logowania.
**AC** Publiczna trasa (dopisana do `ANONYMOUS_PUBLIC_PATHS` i `sitemap`), opis procesu i kontakt; link w polityce i w Play Console.

## Z26 — Kompletny eksport danych  *(E3-6)*
**Typ** kod · **P1** · S · **Zależności** brak · **Źródło** RODO art. 20
**Story** Jako użytkownik chcę pobrać wszystkie swoje dane.
**AC** `/api/user/export` obejmuje zdjęcia (lub linki), zamówienia, zgody, przypomnienia; test kompletności względem listy tabel z `user_id`. **Nie usuwać funkcji** (decyzja D8 dotyczy tylko przypomnień PWA).
**Wskazówki** `lib/user-data-export.ts`, `lib/user-data-csv.ts`.

## Z27 — Pollinations bez danych osobowych  *(E3-7)*
**Typ** kod · **P1** · S · **Zależności** brak · **Źródło** D25, LR-7
**Story** Jako użytkownik chcę, aby moje dane nie trafiały do zewnętrznego generatora obrazów.
**AC** Prompty bez wag, imion i nazw własnych ćwiczeń użytkownika (m.in. `lib/pr-achievement-image.ts`, `valueKg` w seedzie); oznaczenie grafik AI; test regresji.

## Z28 — Retencja i automatyczne usuwanie danych  *(E3-8)*
**Typ** kod+prawnik · **P1** · M · **Zależności** Z15 (okresy) · **Źródło** prawo
**Story** Jako właściciel chcę, aby stare dane były usuwane automatycznie.
**AC** Okresy zatwierdzone przez prawnika; crony (`/api/cron/cleanup`) obejmują `active_workout_sessions`, kody, logi, nieaktywne konta; testy w stylu `lib/db-retention.test.ts`.

## Z29 — CSP w trybie egzekwowania  *(E4-1)*
**Typ** kod · **P1** · M · **Zależności** Z12 (znane źródła) · **Źródło** SEC-1, SEC-2
**Story** Jako użytkownik chcę, aby przeglądarka egzekwowała politykę treści.
**AC** Analiza raportów `/api/security/csp-report`; polityka z `script-src` (nonce), `connect-src` uwzględnia PostHog/Sentry/Pollinations; przełączenie z `Content-Security-Policy-Report-Only` na `Content-Security-Policy`; smoke test głównych ekranów bez naruszeń.
**Wskazówki** `next.config.ts` (`cspReportOnly`).

## Z30 — Rate limiting produkcyjny i zaufane IP  *(E4-2)*
**Typ** kod · **P1** · S · **Zależności** brak · **Źródło** SEC-3
**Story** Jako właściciel chcę rozproszony rate limiting i zaufane źródło IP.
**AC** Upstash wymagany na produkcji (widoczny w `admin-config-status`); IP z zaufanego nagłówka platformy (konfigurowalny); test spoofingu `x-forwarded-for`.
**Wskazówki** `lib/rate-limit.ts` (`clientIpFromHeaders`).

## Z31 — Java fail-closed (lub usunięcie)  *(E4-3)*
**Typ** kod · **P1** · S · **Zależności** Z18 · **Źródło** SEC
**Story** Jako właściciel chcę, aby Java nie ufała nagłówkom bez tajnego tokenu.
**AC** Brak `GYMBRAT_PROXY_TOKEN` → start odmawia; `docker-compose` bez publicznego portu 8080; **lub** usunięcie Javy zgodnie z Z18.
**Wskazówki** `java-backend/src/main/java/pl/gymbrat/backend/security/UserContextFilter.java` (dziś pusty token = brak sprawdzenia).

## Z32 — 2FA i blokada dla admina; usunięcie PIN-u  *(E4-4)*
**Typ** kod · **P1** · M · **Zależności** Z17 (e-mail) · **Źródło** SEC-5, D15
**Story** Jako właściciel chcę zabezpieczyć panel admina drugim składnikiem.
**AC** TOTP lub e-mail/WebAuthn dla `appRole=admin`; blokada po serii błędnych logowań; powiadomienie o logowaniu admina; usunięcie martwego kodu PIN (`/api/admin/lock|unlock`, `lib/admin-session.ts`, `ADMIN_PIN`, wpis w `admin-config-status`).

## Z33 — Repo prywatne i higiena drzewa  *(E4-6)*
**Typ** kod/konfig · **P1** · S · **Zależności** Z18 · **Źródło** SEC-6
**Story** Jako właściciel chcę prywatne repo i uporządkowane drzewo.
**AC** Repo prywatne (D6); usunięty katalog `undefined/`, artefakty z drzewa; `.gitignore` uzupełniony; skan sekretów w historii (rotacja jeśli trzeba). Zmiana widoczności repo wykonuje właściciel.

## Z34 — Test uprawnień tras admina  *(E4-7)*
**Typ** kod · **P1** · S · **Zależności** brak · **Źródło** SEC-7
**Story** Jako zespół chcemy testu pilnującego, że żadna trasa admina nie jest dostępna dla zwykłego użytkownika.
**AC** Test enumeruje `app/api/admin/**` i `app/admin/**`; 401 (anonim), 403 (zwykły użytkownik).

## Z35 — Jedna definicja tygodnia i minut cardio  *(E5-1)*
**Typ** kod · **P1** · M · **Zależności** brak · **Źródło** UX-1, D9
**Story** Jako użytkownik chcę widzieć te same minuty cardio na Pulpicie i w Treningu.
**AC** Jedna funkcja domenowa (tydzień pon–niedz, strefa użytkownika, wszystkie źródła cardio) używana przez Pulpit, hub Treningu, silnik dodatkowego cardio i Javę; test kontraktowy z danymi mock (20 min w tygodniu → wszędzie 20).
**Wskazówki** `lib/home-start.ts`, `lib/treningi-hub-stats.ts`, `lib/cardio.ts`, `lib/extra-cardio-from-macros.ts`, wiersze w `docs/bledy-do-naprawy/bledy.md`.

## Z36 — Komunikaty rejestracji bez SMTP  *(E5-7)*
**Typ** kod · **P1** · S · **Zależności** brak · **Źródło** audyt, sekcja 10
**Story** Jako nowy użytkownik chcę wiedzieć, że rejestracja e-mailem jest niedostępna, a Google działa.
**AC** `/register` informuje o dostępnych metodach zależnie od `getRegistrationAvailability`; po Z17 przepływ kodem e-mail przetestowany.

## Z37 — Obecność w treningu tylko przy udostępnianiu  *(E5-8)*
**Typ** kod · **P1** · S · **Zależności** brak · **Źródło** NEW-1 (potwierdzone: 38× 403 w konsoli)
**Story** Jako użytkownik nie chcę, aby trening generował błędy 403 w tle.
**AC** Klient nie wywołuje `POST /api/community/friends/live/presence`, gdy użytkownik nie ma aktywnego udostępniania (albo serwer zwraca 204); 0 błędów 403 w konsoli podczas treningu solo; test.
**Wskazówki** `app/api/community/friends/live/presence/route.ts`, klient obecności w `components/active-workout/`.

## Z38 — Spójne cardio także bez planu  *(E5-12)*
**Typ** kod · **P1** · S · **Zależności** Z35 · **Źródło** NEW-5, NEW-6
**Story** Jako użytkownik bez planu chcę widzieć to samo cardio co na Pulpicie.
**AC** Test Z44 obejmuje stan „brak planu"; martwy `/start-workout` usunięty lub przekierowanie uzasadnione.

## Z39 — Zdjęcia w magazynie obiektowym  *(E7-1)*
**Typ** kod · **P1** · L · **Zależności** Z11 (zgody na zdjęcia) · **Źródło** ARCH-2, PERF-2
**Story** Jako właściciel chcę zdjęcia w magazynie obiektowym zamiast w bazie.
**AC** Nowy magazyn (S3/R2/Blob), upload przez podpisany URL, miniatury; migracja istniejących `data_url` skryptem; trasy `/api/media/*` serwują z autoryzacją; limity rozmiaru/typu; plan wycofania `data_url`. Skille `gymbrat-db-migration`, `gymbrat-sensitive-data`.

## Z40 — Jedno źródło schematu bazy  *(E7-2)*
**Typ** kod · **P1** · L · **Zależności** brak · **Źródło** ARCH-1
**Story** Jako deweloper chcę jednej ścieżki zmian schematu.
**AC** Migracje Drizzle jedynym źródłem; `db/ensure-schema.ts` sprowadzony do kontroli zgodności wersji; `ensureCriticalSchema()` usunięte z gorących ścieżek zapytań; test zgodności `schema.ts` ↔ migracje. Skill `gymbrat-db-migration`.

## Z41 — Pomiar wydajności na buildzie produkcyjnym  *(E7-4)*
**Typ** kod/pomiar · **P1** · S · **Zależności** brak · **Źródło** PERF-6
**Story** Jako zespół chcemy znać realne LCP/INP/TTFB przed startem.
**AC** Lighthouse/WebPageTest na `npm run build && npm start` dla 10 kluczowych ekranów; budżety w dokumencie; krok w CI dla trzech ekranów.

## Z42 — Lint zielony  *(E8-1)*
**Typ** kod · **P1** · L · **Zależności** brak · **Źródło** jakość (102 błędy, 39 ostrzeżeń na 2026-11-01)
**Story** Jako zespół chcemy zielonego lintera jako bramki.
**AC** 0 błędów; ostrzeżenia ≤ ustalony próg; etapami po obszarach (reguły React Compiler); `npm run lint` w CI i w `deploy:check`.

## Z43 — E2E krytycznych ścieżek  *(E8-3)*
**Typ** kod · **P1** · L · **Zależności** Z46 · **Źródło** jakość
**Story** Jako zespół chcemy E2E rejestracji, logowania, treningu, płatności (sandbox) i usunięcia konta.
**AC** Playwright w CI na bazie `file:` z seedem (`scripts/seed-local-mock.cjs` jako punkt wyjścia); stabilne dane testowe; raport w CI.

## Z44 — Testy kontraktowe liczb między ekranami  *(E8-4)*
**Typ** kod · **P1** · M · **Zależności** Z35 · **Źródło** UX-1
**Story** Jako zespół chcemy testu pilnującego, że te same dane dają te same liczby na różnych ekranach.
**AC** Zestaw danych mock → oczekiwane wartości (cardio tygodnia, tonaż, serie, kcal) sprawdzane przez funkcje używane na Pulpicie, Treningu, Analizie; w tym stan bez planu.

## Z45 — Rozszerzony `deploy:check`  *(E8-6)*
**Typ** kod · **P1** · S · **Zależności** brak
**Story** Jako zespół chcemy, aby `deploy:check` blokował promote przy braku konfiguracji.
**AC** Sprawdza `HOTPAY_*`, SMTP, Upstash, `CRON_SECRET`, `ADMIN_EMAILS`; lint i testy; blokuje przy braku.
**Wskazówki** `scripts/check-gymbrat-deploy.mjs`, `lib/admin-config-status.ts`.

## Z46 — Naprawa i utrzymanie specyfikacji E2E  *(E8-7)*
**Typ** kod · **P1** · M · **Zależności** brak · **Źródło** audyt, sekcja 14a (9/41 zielonych)
**Story** Jako zespół chcemy działających testów E2E w CI.
**AC** 41 testów zielonych na lokalnej bazie z seedem; logowanie raz przez `storageState` (hipoteza: logowanie per test jest odrzucane przez limity); rozstrzygnięte 4 rozbieżności asercji (sugestia „× 8" vs „× 6", `#set-reps`, link „GymBrat"); job CI uruchamia E2E przy PR.
**Wskazówki** `e2e/*.spec.ts`; selektory już poprawione (E-mail, przycisk „Zaloguj się", body DELETE `{revision}`).

## Z47 — Staging z testowymi kluczami HotPay  *(E9-2)*
**Typ** konfig · **P1** · M · **Zależności** Z4 · **Źródło** audyt
**Story** Jako zespół chcemy staging do testów płatności i migracji przed produkcją.
**AC** Osobna baza i testowe klucze HotPay; procedura Preview → Promote z `AGENTS.md` przećwiczona na zmianie płatności. Zobacz `docs/staging.md`.

## Z48 — Test przywracania backupu  *(E9-3)*
**Typ** ops · **P1** · S · **Zależności** Z47
**Story** Jako właściciel chcę wiedzieć, że backup da się przywrócić.
**AC** Przywrócenie bazy Turso na stagingu wg `docs/disaster-recovery.md`; czas i kroki zapisane (RTO/RPO).

## Z49 — Monitoring, alerty, status  *(E9-4)*
**Typ** ops · **P1** · M · **Zależności** Z23 · **Źródło** ARCH-7
**Story** Jako właściciel chcę monitoring, alerty i status page.
**AC** Sentry z alertami (5xx, płatności, logowanie); uptime check `/api/version`; kanał powiadomień/strona statusu; SLO dla logowania, zapisu treningu i płatności.

## Z50 — Wsparcie klienta i reklamacje  *(E9-5)*
**Typ** kod · **P1** · S · **Zależności** Z1
**Story** Jako klient chcę wiedzieć, jak się skontaktować i złożyć reklamację.
**AC** Adres i formularz w Profilu i regulaminie; FAQ (płatności, zwroty, konto); SLA odpowiedzi 14 dni zgodne z regulaminem §8. Istnieje `bug-report`.

## Z51 — Publikacja Android w Google Play  *(E9-6)*
**Typ** ops+kod · **P1** · L · **Zależności** Z19, Z25, Z14 · **Źródło** BIZ-5, D23
**Story** Jako użytkownik Androida chcę aplikację w Google Play.
**AC** Zgodnie z Z19; formularz Data Safety, polityka i `/usun-konto`; podpisane AAB; test na urządzeniach. iOS: instrukcja PWA lub App Store wg `docs/ios-app-store.md`.

## Z52 — Soft launch i decyzja go/no-go  *(E9-7)*
**Typ** ops · **P1** · M · **Zależności** Z4–Z17 zamknięte
**Story** Jako właściciel chcę soft launch z kryteriami go/no-go.
**AC** 20–50 testerów, monitorowane KPI i błędy 2 tygodnie, lista poprawek; kryteria „Definition of Launch" z sekcji 13 audytu.

## Z53 — KPI i lejek  *(E10-1)*
**Typ** kod · **P1** · M · **Zależności** Z12 · **Źródło** BIZ-4
**Story** Jako właściciel chcę widzieć aktywację, retencję i konwersję.
**AC** Zdarzenia po zgodzie: rejestracja, pierwszy trening, D7/D30, wejście na `/package`, start i koniec płatności; dashboard w PostHog; definicje w dokumencie.

## Z54 — Kody promocyjne i Badania — definicja albo usunięcie  *(E2-4)*
**Typ** decyzja+kod · **P2** · S · **Zależności** Z2 · **Źródło** UX-8, D11
**Story** Jako właściciel chcę, aby w produkcie nie było ekranów bez zdefiniowanego produktu.
**AC** Decyzja D11; `/promo-codes` i `/labs` albo wdrożone (kody rabatowe w checkoucie z walidacją po stronie serwera) albo ukryte/usunięte.

## Z55 — Zmiana cen bez wdrożenia  *(E2-5)*
**Typ** kod · **P2** · S · **Zależności** Z5 · **Źródło** BIZ-2
**Story** Jako właściciel chcę zmieniać ceny bez wdrożenia.
**AC** Ceny w panelu (`/admin/packages`) — zweryfikować, że zmiana ceny nie psuje trwających zamówień (Z5 chroni kwotę); testy.

## Z56 — Ograniczenie osadzania w iframe  *(E4-5)*
**Typ** kod · **P2** · S · **Zależności** Z18 · **Źródło** SEC-4
**Story** Jako właściciel chcę ograniczyć osadzanie do potrzebnych źródeł.
**AC** Jeśli AWP zostaje — jawna lista originów; jeśli nie — `frame-ancestors 'none'`. `next.config.ts`.

## Z57 — Skan zależności i rotacja sekretów  *(E4-8)*
**Typ** kod+dok · **P2** · S · **Zależności** brak
**Story** Jako właściciel chcę regularnie skanować zależności i rotować sekrety.
**AC** `.github/workflows/dependency-security.yml` blokuje High/Critical; procedura rotacji `AUTH_SECRET`, `HOTPAY_*`, `CRON_SECRET` w `docs/`.

## Z58 — Onboarding świadomy historii  *(E5-2)*
**Typ** kod · **P2** · M · **Zależności** brak · **Źródło** UX-2
**Story** Jako użytkownik z historią chcę propozycję planu z moich treningów zamiast „dodaj pierwszy plan".
**AC** Brak planu + są treningi → CTA „Utwórz plan z ostatnich treningów"; karta „Skonfiguruj pierwszy tydzień" znika po treningach; „0 raportów" tylko dla nowych kont; test stanów Pulpitu.

## Z59 — Kontekstowy przycisk pływający  *(E5-3)*
**Typ** kod · **P2** · S · **Zależności** Z68 · **Źródło** UX-3
**Story** Jako użytkownik chcę, aby pływający przycisk odpowiadał bieżącemu ekranowi.
**AC** Trening → „Start", Dieta → „Dodaj posiłek", Analiza → „Raport"; margines pod przyciskiem; test 375 px.

## Z60 — Tytuły stron i nazewnictwo sekcji  *(E5-4)*
**Typ** kod · **P2** · S · **Zależności** brak · **Źródło** UX-4, UX-7
**Story** Jako użytkownik chcę rozpoznawalnych tytułów kart i spójnych nazw sekcji.
**AC** `generateMetadata` „Nazwa · GymBrat" dla wszystkich tras dashboardu; ujednolicone nazwy (Dieta ↔ Bilans); lista nazw w `docs/ux/00-system-projektowy-stan.md`.

## Z61 — Stany ładowania i wykresy bez błędów wymiarów  *(E5-5)*
**Typ** kod · **P2** · S · **Zależności** brak · **Źródło** UX-5, PERF-3
**Story** Jako użytkownik chcę widzieć, że dane się ładują, i nie widzieć pustych wykresów.
**AC** Analiza ma szkielety z opisem i obsługą błędu; kontenery Recharts z minimalnym wymiarem; brak ostrzeżeń „width(-1)" w konsoli.

## Z62 — Seria 0 kg — świadomy wybór  *(E5-9)*
**Typ** kod · **P2** · S · **Zależności** brak · **Źródło** NEW-2
**Story** Jako użytkownik chcę jasności, czy seria 0 kg jest świadoma.
**AC** Przy ćwiczeniu z obciążeniem zapis 0 kg wymaga potwierdzenia/oznaczenia „masa ciała"; tonaż i porównania zgodne z wyborem. Uwaga: E2E `005 p.7/US-14` zakłada, że brak ciężaru nie blokuje zaliczenia — uzgodnić.

## Z63 — Jedno sterowanie niedokończonym treningiem  *(E5-10)*
**Typ** kod · **P2** · S · **Zależności** brak · **Źródło** NEW-3
**Story** Jako użytkownik chcę jednego miejsca do wznowienia lub zakończenia treningu.
**AC** Ekran Trening i mini-pasek nie dublują akcji; mini-pasek nie zasłania narzędzi ani nawigacji; test 375×667.

## Z64 — Dostępny formularz raportu ciała  *(E5-11)*
**Typ** kod · **P2** · M · **Zależności** brak · **Źródło** NEW-4
**Story** Jako użytkownik czytnika ekranu chcę etykiet pól i opisanych skal.
**AC** Każde pole z `label`/`aria-label` i jednostką; skale 1–10 z opisem końców i `role=radiogroup`; axe bez błędów krytycznych; rozważyć niewymagane pomiary poza wagą. `components/reports/body-report-form.tsx`.

## Z65 — Jeden wzorzec nagłówka ekranu  *(E6-1)*
**Typ** kod · **P2** · M · **Zależności** brak
**Story** Jako użytkownik chcę, aby nawigacja wstecz i nagłówek zachowywały się tak samo na każdym ekranie.
**AC** Reguła: główne sekcje — logo + menu, podekrany — strzałka wstecz + tytuł; komponent `ScreenHeader`; migracja ekranów; zrzuty przed/po. Skill `gymbrat-ui`.

## Z66 — Tokeny kolorów i kontrast  *(E6-2)*
**Typ** kod · **P2** · M · **Zależności** brak
**Story** Jako deweloper chcę tokenów zamiast literałów złota; kontrast WCAG AA.
**AC** Lint/test zakazujący literałów koloru marki poza `app/globals.css`; zamiana istniejących; kontrast tekstu pomocniczego ≥ 4,5:1 zweryfikowany narzędziem.

## Z67 — Jeden komponent kafla statystyki  *(E6-3)*
**Typ** kod · **P2** · S · **Zależności** brak
**Story** Jako deweloper chcę jednego komponentu kafla.
**AC** `components/ui/stat-tile`; zastąpione 3 warianty (Pulpit, Bilans, Społeczność).

## Z68 — Strefa bezpieczna dolnej nawigacji  *(E6-4)*
**Typ** kod · **P2** · S · **Zależności** brak
**Story** Jako użytkownik telefonu chcę, aby nawigacja i przycisk pływający nie zasłaniały treści ani siebie.
**AC** `padding-bottom` zależny od wysokości nav + przycisku + `env(safe-area-inset-bottom)`; test 375×667 i 412×915.

## Z69 — Dokończenie przeglądu wizualnego ekranów  *(E6-5)*
**Typ** pomiar · **P2** · M · **Zależności** brak
**Story** Jako zespół chcemy dokończyć przegląd ekranów, którego nie objęto w audycie.
**AC** Zrzuty mobile i desktop: raport ciała (kroki 3–5), plany (atlas, import), profil, społeczność (zespoły, wojny, wyzwania), admin (konfiguracja, błędy, katalog, ćwiczenia, branding); lista defektów do Z65–Z68.

## Z70 — Mniejszy payload RSC (Dieta/Tydzień, Atlas)  *(E7-3)*
**Typ** kod · **P2** · M · **Zależności** Z41 · **Źródło** PERF-1
**Story** Jako użytkownik na słabym łączu chcę szybkich ekranów.
**AC** `/nutrition/week` i `/plany/atlas` < 90 kB HTML SSR (z 209/148 kB); tylko niezbędne pola do klienta, paginacja; pomiar przed/po w PR.

## Z71 — Mniej zapisów synchronizacji treningu  *(E7-5)*
**Typ** kod · **P2** · M · **Zależności** brak · **Źródło** PERF-4
**Story** Jako właściciel chcę zmniejszyć liczbę i rozmiar zapisów aktywnego treningu.
**AC** Wykrywanie zmian przed PUT, payload −50%, backoff bez ominięcia; metryki w monitoringu. `lib/active-workout-cloud-client.ts`, `app/api/active-workout-session/route.ts`.

## Z72 — CAS w modułach społeczności  *(E7-7)*
**Typ** kod · **P2** · M · **Zależności** brak · **Źródło** ARCH-5
**Story** Jako użytkownik chcę poprawnych punktów XP mimo równoległych zapisów.
**AC** Warunkowe aktualizacje/transakcje w `lib/community/team-wars.ts`, `team-quests.ts`, `hof.ts`, `progression.ts`, `teams.ts`; testy współbieżności.

## Z73 — Realizacja decyzji o Javie  *(E7-9)*
**Typ** kod · **P2** · M · **Zależności** Z18 · **Źródło** ARCH-3
**Story** Jako właściciel chcę zrealizować decyzję o Javie.
**AC** Usunięcie `java-backend/` i powiązań (`lib/java-api.ts`, compose) albo pełna implementacja z trwałością; aktualizacja `docs/adr`.

## Z74 — Dostępność WCAG AA  *(E8-5)*
**Typ** kod · **P2** · M · **Zależności** Z66
**Story** Jako użytkownik chcę dostępności zgodnej z WCAG AA.
**AC** Audyt axe dla 10 ekranów; naprawa krytycznych (kontrast, etykiety, fokus, klawiatura); wyniki w dokumencie.

## Z75 — Panel finansowy  *(E10-2)*
**Typ** kod · **P2** · M · **Zależności** Z22
**Story** Jako właściciel chcę widzieć przychody i aktywne pakiety.
**AC** W adminie: przychód dzienny/miesięczny, liczba aktywnych pakietów, konwersja, lista zamówień.

## Z76 — Publiczna strona produktu  *(E10-3)*
**Typ** kod · **P2** · M · **Zależności** Z2 · **Źródło** BIZ
**Story** Jako potencjalny klient chcę zobaczyć, co robi aplikacja, zanim się zarejestruję.
**AC** Publiczna strona z opisem, cennikiem, zrzutami, linkami do regulaminu; metadane SEO/OG (część w `app/opengraph-image.tsx`, `sitemap.ts`).

## Z77 — Usunięcie `inbox` i roli `trener`  *(E5-6)*
**Typ** kod · **P3** · S · **Zależności** brak · **Źródło** D7
**Story** Jako użytkownik nie chcę widzieć zaślepek.
**AC** Usunięte `app/(dashboard)/inbox`, rola `trener` (w tym filtr „Trenerzy" w adminie); migracja danych roli; testy.

## Z78 — Usunięcie martwych komponentów  *(E6-6)*
**Typ** kod · **P3** · S · **Zależności** brak · **Źródło** UX 11
**Story** Jako deweloper chcę usunięte martwe komponenty.
**AC** Lista z `docs/ux/00-system-projektowy-stan.md` zweryfikowana (grep/`knip`) i usunięta.

## Z79 — Mniej pollingu społeczności  *(E7-6)*
**Typ** kod · **P3** · M · **Zależności** Z41 · **Źródło** PERF-5
**Story** Jako właściciel chcę mniej pollingu społeczności.
**AC** SSE zamiast pollingu tam, gdzie możliwe; krótki cache dla list; mniej zapytań na ekran (pomiar).

## Z80 — Rozbicie dużych modułów  *(E7-8)*
**Typ** kod · **P3** · L · **Zależności** brak · **Źródło** ARCH-4
**Story** Jako deweloper chcę mniejszych modułów.
**AC** `lib/progress-hub.ts`, `lib/community/teams.ts`, `components/reports/body-report-form.tsx`, `lib/home-start.ts` podzielone (< 500 linii) z zachowaniem testów; `changelog-data.ts` jako dane JSON.

## Z81 — Przypomnienia treningowe za zgodą  *(E10-4)*
**Typ** kod · **P3** · M · **Zależności** Z11 · **Źródło** D8
**Story** Jako użytkownik chcę przypomnień treningowych za zgodą.
**AC** Decyzja czy zostają (D8); zgoda `push` w rejestrze; cron `/api/cron/reminders` respektuje zgodę.

## Z82 — Mapa drogowa funkcji Premium  *(E10-5)*
**Typ** decyzja · **P3** · S · **Zależności** Z2
**Story** Jako właściciel chcę mapę drogową funkcji Premium.
**AC** Lista kandydatów z wartością i kosztem; wybór pierwszych dwóch.

## Z83 — Aktualizacja dokumentacji projektu  *(E10-6)*
**Typ** dok · **P3** · S · **Zależności** brak
**Story** Jako zespół chcemy aktualnej dokumentacji.
**AC** `docs/zespol/wiedza-o-projekcie.md` i `docs/zespol/backlog.md` wskazują na ten plik; oznaczenie nieaktualnych `docs/*.json` (D13); wpisy „zrobione" w `docs/bledy-do-naprawy/bledy.md`.
