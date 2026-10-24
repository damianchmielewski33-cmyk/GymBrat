# Wydajność zadania 001 - rejestracja z kodem i łączenie kont OAuth

Data: 2026-10-24. Autor: tester-wydajnosci. Etap 9 (część wydajność). Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`.
Kod: commit 4a3df0a + niezacommitowane poprawki 001 (zmiany zadania 004 pominięte).

## Werdykt

**ZATWIERDZONE Z UWAGAMI.** Żadne uzgodnione SLO nie jest przekroczone w modelu szczytu (300 aktywnych użytkowników, wieczorny pik), nic nie blokuje wydania. Do backlogu trafia 8 uwag (3 średnie, 5 niskie). Nie zmierzono: opóźnień do prawdziwego Turso i Render Free, ścieżki SMTP z realnym dostawcą, urządzeń mobilnych, rozmiaru żądania HTTP batcha.

Metoda: analiza statyczna, `EXPLAIN QUERY PLAN` na schemacie Drizzle (SQLite 3 przez libsql), pomiar batcha przejęcia na bazie `file:` (62 MB, 500 kont x 20 wierszy w 55 tabelach), jeden `next build --webpack` (baza `file:` w katalogu tymczasowym, `AUTH_SECRET=x`, artefakty usunięte). Wersje: Next 16.4.2, libsql client z repo, Vitest 2.1.9, Node 24.14.1, Windows 10 (SSD lokalny, brak RTT sieciowego).

## 1. Wyniki pomiarów

| Pomiar | Wynik | Uwaga |
|---|---|---|
| Instrukcje batcha przejęcia | 129 (124 purge + reset konta, anulowanie zamówień, ustawienia, oauth, zdarzenie) | zgodne z U8 |
| Czas batcha przejęcia (lokalnie, 15 prób) | p50 291 ms, p95 1073 ms (pierwsza próba, zimna), max 1073 ms | 20 wierszy w 55 tabelach + skany |
| Powtórne wywołanie (token zużyty, guard = false) | p50 79 ms, p95 182 ms | skany tabel wykonują się mimo guardu |
| Pełne skany tabel w purge (`SCAN` bez indeksu) | 16 z 124 kroków | lista w F1 |
| `bcryptjs` hash, koszt 12 | p50 347-400 ms (CPU lokalnego PC) | na Render Free (0,1 vCPU) wielokrotnie więcej, niezmierzone |
| Bundle `/register` (chunki z manifestu klienta, gzip) | 329 KB vs 327 KB przed zadaniem (+0,6%) | surowo 1005 vs 1012 KB |
| Bundle `/login` | 316 KB vs 313 KB (+1%) | |
| Bundle `/login/zabezpiecz-konto` | 319 KB | nowa trasa, dzieli chunki wspólne |
| Ciężkie moduły serwera w chunkach klienta | brak: `nodemailer`, `bcryptjs`, `timingSafeEqual`, `TEST_REGISTER_CODE` = 0 trafień; `createTransport` to Sentry (466 KB, istniało przed zadaniem) | |
| `admin-config-status` po stronie klienta | tylko chunk trasy `/admin` (`1791-...`, 4,3 KB surowo) | import zgodny: czysty moduł bez `server-only`, typ trybu rejestracji importowany jako `import type` |

Skrypt: `docs/wydajnosc/skrypty/001-takeover-batch.bench.ts`, konfiguracja `001-vitest.config.ts` (poza `npm test`). Uruchomienie: `BENCH_USERS=500 npx vitest run --config docs/wydajnosc/skrypty/001-vitest.config.ts`. Uwaga: `EXPLAIN QUERY PLAN DELETE` w libsql zostawia otwartą instrukcję (SQLITE_BUSY przy commicie), dlatego EXPLAIN idzie osobnym połączeniem.

## 2. Ocena punktów zlecenia

### (1) Stan sesji w `proxy.ts` i `jwt` (cache 60 s)

- Zapytanie: po kluczu głównym `users.id` (1 wiersz odczytu), 4 kolumny (`lib/account-auth-state.ts:48-57`). Cache `globalThis` w procesie, TTL 60 s, wspólny dla `proxy.ts:56` i `auth.ts:213` (ten sam proces Node), więc kolejne wywołania w tym samym żądaniu to trafienia.
- Koszt stały: najwyżej 1 zapytanie na użytkownika na minutę na instancję. Model: 300 aktywnych x 60 min x 3 h szczytu = ok. 54 tys. zapytań = 54 tys. odczytanych wierszy na wieczór; miesięcznie rząd 1,6 mln wobec 500 mln limitu Turso Free (0,3%). Pomijalne wobec skanów z D1/F1.
- Zimny start Render Free: pusty cache, pierwsze żądanie każdego użytkownika płaci 1 RTT do Turso (nie więcej niż liczba aktywnych użytkowników po wybudzeniu). Brak ochrony przed jednoczesnymi trafieniami: równoległe żądania jednego użytkownika (strona + 5-10 fetchy/pollingów) na pustym cache wykonują każde własne zapytanie (F4).
- Błąd bazy: fail-open bez zapisu do cache (`proxy.ts:58-61`, `auth.ts:217-220`), więc w awarii Turso każde żądanie ponawia zapytanie przez `db/resilient-client.ts` (do 3 prób, backoff 150 ms) i dokłada ok. 0,45 s+ do każdej nawigacji (F4).
- Limit 5000 wpisów (`account-auth-state.ts:69-73`) czyści tylko wygasłe; jeśli wszystkie są ważne, mapa rośnie dalej (wpis ok. 200 B, 10 tys. użytkowników = 2 MB, bez znaczenia na 512 MB).
- Anonimowi odwiedzający (bez tokenu) nie generują zapytań.

### (2) Backfill `email_verified_at` w `instrumentation.ts:45-56`

- Idempotentny (warunek `email_verified_at IS NULL`), ale wykonywany przy każdym starcie procesu. Zimny start powtarza: 1 SELECT z joinem (plan: `SEARCH o USING INDEX oauth_accounts_provider_account (provider=?)` + `SEARCH u` po PK + temp B-tree; odczyt ok. 2 x liczba kont Google, dla 300 użytkowników najwyżej kilkaset wierszy) oraz 1 UPDATE adminów po `users_email_unique`. Koszt: 2 dodatkowe RTT w łańcuchu startu (ok. 0,1-0,3 s) i rząd 600 odczytanych wierszy; Render Free usypia po 15 min, czyli do ok. 96 startów/dzień = poniżej 60 tys. wierszy/dzień. Pomijalne.
- Ryzyko jednorazowe: przy pierwszym wdrożeniu pętla `lib/migrate-email-verification.ts:48-67` wykonuje po jednym żądaniu sekwencyjnie na każde niezweryfikowane konto z Google (R-A: UPDATE, R-B: batch). 300 kont x 50-150 ms = 15-45 s. `register()` blokuje start serwera (F5).
- `register()` łączy teraz w szereg: migracje, `ensureCriticalSchema`, backfill, szyfrowanie pól wrażliwych; zimny start rośnie o 2 RTT (D5 z analizy bazowej nadal otwarte).

### (3) Batch przejęcia konta (128 + reset)

- Zgodnie z U8: 129 instrukcji w jednym `db.batch`. Lokalnie p50 291 ms. Szacunek Turso (nie pomiar): 1 żądanie HTTP, wykonanie 1,5-3x wolniejsze niż lokalny SSD, plus RTT, plus bcrypt przed batchem: ok. 0,6-1,5 s serwera DB, p95 poniżej 3 s. Wymiar: rozmiar żądania (SQL z zagnieżdżonymi `EXISTS`, kilkadziesiąt KB) nie został zmierzony.
- Limity: oficjalnej granicy liczby instrukcji w batchu nie znalazłem; batch to jedna transakcja, rollback przy błędzie. Źródło trzecie (nieoficjalne) mówi o 5 s okna transakcji w HTTP API, więc jedynym realnym ryzykiem jest czas wykonania: dominują skany F1 i rosną liniowo z liczbą użytkowników. Weryfikacja na kopii bazy w Preview pozostaje (U8).
- Rozliczenie odczytów: 16 skanów x rozmiar tabeli. Przy 500 kontach x 20 wierszy: ok. 160 tys. wierszy na przejęcie, nawet gdy guard jest fałszywy. Przy 300 realnych użytkownikach (np. `workouts` 45 tys. wierszy) rząd 100-200 tys. wierszy = 0,04% miesięcznego limitu na jedno przejęcie; limit akcji 10/h/sesję (`actions/account-takeover.ts:43`).

### (4) Bundle

Brak ciężkich zależności w kliencie. Przyrost `/register` +2 KB gzip, `/login` +3 KB gzip (nowe komponenty `AuthCard`, `InlineBanner`, kopie). Bazowy bundle `/` ok. 307-313 KB gzip wg chunków manifestu, więc cel ze SLO bazowego (<= 200 KB) jest nieosiągnięty niezależnie od 001 (B1, B2 z analizy bazowej). Rozmiar metryką z manifestu referencji klienta: nie jest to "First Load JS" z Lighthouse.

### (5) Ścieżka rejestracji

- `sendRegisterCode` (smtp): `guardAction` (do 3 kontroli limitu) + 2 kontrole limitu + SELECT konta + DELETE retencji + SELECT ostatniego kodu + DELETE kodów e-maila + INSERT + SMTP. To 5 zapytań DB sekwencyjnie (ok. 0,25-0,5 s RTT) i 5 wywołań limitera przed wysyłką.
- `registerUser`: limitery, SELECT kodu, UPDATE próby, SELECT konta, bcrypt koszt 12, batch (5 instrukcji). 4 RTT + ok. 0,4 s CPU.
- SMTP jest synchroniczny w akcji (`actions/auth.ts:245`), bez własnych timeoutów (F3); transporter tworzony przy każdej wysyłce (`lib/email.ts:34-37`, `77-92`) - bez puli i weryfikacji połączenia.
- Limity w pamięci (bez Upstash) zob. F6. Z Upstash: 5 wywołań REST na krok rejestracji; przy 10 tys. komend/dzień (limit orientacyjny, do weryfikacji) jedna rejestracja (2 kroki) zużywa ok. 10 komend, wraz z innymi akcjami budżet kończy się szybko.

### (6) Indeksy

| Zapytanie | Plan | Ocena |
|---|---|---|
| kody po `(email, purpose)` + `ORDER BY created_at DESC LIMIT 1` | `idx_email_verification_codes_email_purpose` + temp B-tree (kilka wierszy) | OK |
| retencja `DELETE ... WHERE created_at < ?` (`actions/auth.ts:197-199`) | `SCAN email_verification_codes` | niski (F8); indeks `expires_at` istnieje, ale nieużyty |
| `oauth_accounts` po `(provider, provider_account_id)` i `user_id` | `oauth_accounts_provider_account` (unikalny), `oauth_accounts_user` | OK |
| `users` po `email` | `users_email_unique` | OK |
| `subscription_orders` anulowanie `pending` po `user_id` + `status` | planer wybiera `subscription_orders_status` (`status = ?`), nie `(user_id, created_at)` | OK przy małej liczbie `pending`; pod obserwacją |
| backfill adminów | `users_email_unique` | OK |

## 3. Ustalenia

Priorytet: S = średni, N = niski. Adresat w nawiasie.

| ID | Pr. | Miejsce | Ustalenie i dowód | Rekomendacja |
|---|---|---|---|---|
| F1 | S | `lib/account-purge.ts:154-165` (kroki purge); `db/schema.ts` brak indeksów `user_id` | 16 tabel jest skanowanych w całości: `body_reports`, `workouts`, `workout_plans`, `weight_logs`, `training_sessions`, `team_fcs_scores`, `team_invitations`, `team_post_comments`, `team_post_reactions`, `team_post_mentions`, `group_workout_participants`, `chat_message_reactions`, `chat_typing`, `challenges`, `challenge_progress`, `team_quest_contributions` (EXPLAIN w skrypcie). Replay (guard = false) kosztuje 79 ms p50 i ok. 160 tys. odczytów przy 10 tys. wierszy/tabelę. Koszt rośnie liniowo z liczbą użytkowników i liczy się do limitu odczytów Turso. Indeksy `workouts(user_id, ...)` są w nieskommitowanej migracji `0032` zadania 004 - poza zakresem tej oceny, ale usuną skan `workouts` po wdrożeniu (backend + architekt) | Dodać indeksy po `user_id` (lub kolumnie FK) dla pozostałych 15 tabel migracją Drizzle + `db/ensure-schema.ts`; test w `account-purge.test.ts`, że żaden krok purge nie jest `SCAN` (skrypt gotowy do wpięcia). Zbieżne z D1 z analizy bazowej |
| F2 | S | `lib/account-takeover.ts:209`, `actions/account-takeover.ts:42-52` | `confirmAccountTakeover` wykonuje bcrypt koszt 12 (347-400 ms CPU lokalnie, na Render Free 0,1 vCPU wielokrotnie więcej) i batch 129 instrukcji także dla zużytego tokenu (ważny 10 min, limit 10/h). Brak wstępnego sprawdzenia kwalifikacji (`isTakeoverPending`, 1 odczyt po PK) przed kosztownym krokiem (backend) | Przed `hash` sprawdzić `isTakeoverPending(payload)` i zwrócić `EXPIRED`; zostawić guard w batchu jako obronę przed wyścigiem |
| F3 | S | `lib/email.ts:34-37`, `actions/auth.ts:245` | Wysyłka SMTP jest synchroniczna i bez jawnych timeoutów (`createTransport` bez `connectionTimeout`, `greetingTimeout`, `socketTimeout`; domyślne nodemailer to rzędu dziesiątek sekund do minut). Zawieszony SMTP trzyma akcję i wiersz kodu, formularz wisi na "Wysyłam", zużywa limit 5/h na e-mail (backend) | Ustawić timeouty (np. połączenie 5 s, powitanie 5 s, gniazdo 10 s), współdzielić transporter na proces; kod błędu `send_failed` już istnieje. Wysyłka w tle odpada (UI musi znać wynik) |
| F4 | N | `lib/account-auth-state.ts:43-76`, `proxy.ts:52-62`, `auth.ts:208-220` | Brak deduplikacji jednoczesnych zapytań o ten sam `userId` (single-flight) oraz brak krótkiego cache błędu: po zimnym starcie i w awarii Turso każde równoległe żądanie wykonuje zapytanie, a przy błędzie dochodzi retry `resilient-client` (ok. 0,45 s na żądanie) (backend) | Mapa `Promise` w locie na `userId`; przy błędzie zapisać wynik "fail-open" w cache na 5-10 s |
| F5 | S | `lib/migrate-email-verification.ts:48-67`, `instrumentation.ts:45` | Pierwsze uruchomienie backfillu: sekwencyjnie 1 RTT na konto (R-A UPDATE, R-B batch). 300 kont = 15-45 s blokady `register()`, czyli startu serwera (przy Render Free ryzyko przekroczenia limitu startu/health checku). Kolejne starty: 2 RTT i ok. 600 odczytów (pomijalne) (backend) | Jeden `UPDATE ... WHERE id IN (...)` lub `db.batch` porcjami po 100; opcjonalnie znacznik w `app_settings`, by zakończony backfill nie powtarzał zapytań |
| F6 | S | `lib/rate-limit.ts:4`, `57-59`, `76-82` | Mapa `buckets` nigdy nie jest czyszczona (wpisy wygasłe są tylko nadpisywane przy ponownym użyciu tego samego klucza), a klucze zawierają dowolny e-mail (`register-send-email:`, `login-email:`) i IP z pierwszego elementu `X-Forwarded-For` (kontrolowany przez klienta, gdy proxy tylko dopisuje). Bez Upstash (Render Free) wzrost pamięci jest nieograniczony, a limity IP są obchodzone. Powiązane: bezpieczeństwo (`tester-bezpieczenstwa`) (backend + architekt) | Okresowe czyszczenie (np. przy rozmiarze > 10 tys.), limit liczby kluczy, IP z zaufanego nagłówka hosta; Upstash jako stan docelowy |
| F7 | N | `lib/account-auth-state.ts:69-74` | Limit 5000 wpisów nie jest twardy (patrz pkt 1) (backend) | Usuwać najstarszy wpis przy braku wygasłych |
| F8 | N | `actions/auth.ts:197-199` | Retencja kodów po `created_at` bez indeksu = `SCAN` tabeli przy każdym `sendRegisterCode`; tabela jest mała (kody z 24 h), więc koszt pomijalny, ale to dodatkowe zapytanie na ścieżce krytycznej (backend) | Warunek po `expires_at` (indeks istnieje) i/lub połączyć z DELETE kodów e-maila; wykonywać rzadziej niż co żądanie |

## 4. Proponowane SLO (do uzgodnienia z architektem)

Warunki: ciepła instancja, baza Turso w tym samym regionie co host, telefon klasy średniej, 4G.

| Ścieżka | Metryka | Cel |
|---|---|---|
| Logowanie hasłem (`authorize`) | p95 / p99 (serwer) | < 1,2 s / < 2,5 s; błędy < 0,5% (bcrypt + 2 limity + 1 zapytanie) |
| Callback OAuth Google (`signIn` + `jwt`) | p95 | < 2,5 s; nie więcej niż 8 zapytań DB |
| `sendRegisterCode`, tryb testowy | p95 | < 600 ms |
| `sendRegisterCode`, SMTP | p95 / twardy limit | < 3 s / 10 s (timeout z F3) |
| `registerUser` | p95 | < 1,5 s ciepło (bcrypt 12 + 4 RTT + batch); zimny start < 4 s |
| `confirmAccountTakeover` | p95 | < 3 s; batch <= 150 instrukcji, 0 pełnych skanów |
| Sesja (proxy/jwt) | zapytań DB | <= 1 na użytkownika na 60 s na instancję; trafienie cache < 1 ms; chybienie p95 < 150 ms |
| Zimny start (rejestracja) | dodatkowy koszt backfillu | < 500 ms przy braku wierszy do uzupełnienia; < 5 s przy pierwszym uruchomieniu |
| Bundle tras auth | JS gzip | regresja <= 10% względem 329 KB (`/register`), 316 KB (`/login`); docelowo <= 200 KB (zob. B1, B2) |

## 5. Ryzyka resztkowe i niezmierzone

- Brak pomiarów przez prawdziwe Turso (RTT, limity, rozmiar żądania batcha, timeout transakcji) - weryfikacja U8 na kopii w Preview pozostaje otwarta.
- Brak realnego SMTP (czasy, odrzucenia), brak realnych urządzeń i Lighthouse; rozmiary bundla z manifestów, nie z "First Load JS".
- Czas bcrypt na docelowym hoście (Render Free, 0,1 vCPU) nieznany - zmierzyć po wdrożeniu na Preview; może wymagać obniżenia kosztu lub przeniesienia na instancję z większym CPU.
- Zmiany zadania 004 (indeksy `workouts`, migracja `0032`) nie były oceniane i wpływają na F1.
- Limity darmowych planów (Turso 500 mln odczytów/mies., Upstash dziennie) pochodzą z cenników i wiedzy ogólnej; zweryfikować w panelach.

Źródła: [Turso Pricing](https://turso.tech/pricing.md), [Turso: wskazówki o odczytach](https://blog.turso.tech/tips-for-maximizing-your-turso-billing-allowances-48a0fca163e9).
