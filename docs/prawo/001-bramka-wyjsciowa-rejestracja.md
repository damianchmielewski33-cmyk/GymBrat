# 001 - Bramka wyjściowa (prawnik): rejestracja, weryfikacja e-maila, łączenie kont OAuth

- Wersja: 0.1 (projekt roboczy), data: 2026-10-24. Karta: `docs/zadania/001-rejestracja-kod-i-oauth.md`. Bramka wejściowa: `docs/prawo/001-bramka-wejsciowa-rejestracja.md` (LR-19 do LR-30); LR-1 do LR-18: `docs/prawo/01-podstawy-prawne-i-retencja.md`.
- **Status: analiza robocza asystenta AI. Nie jest poradą prawną. Werdykt, teksty dla użytkowników, ocenę incydentu i decyzje o zgłoszeniu do UODO musi zatwierdzić prawnik-człowiek.**
- Weryfikacja stanu prawnego: w tym przebiegu NIE sprawdzano przepisów w ISAP/EUR-Lex/UODO/EROD; odwołania pochodzą z wiedzy asystenta. Data weryfikacji: [do uzupełnienia przez prawnika-człowieka].
- Zakres oceny: kod i dokumenty w repozytorium (stan 2026-10-24). Nie sprawdzano produkcji (Render), konsol Google/Meta ani konfiguracji SMTP.

## 1. Werdykt

**ZATWIERDZONE Z UWAGAMI** dla merge i Preview. **Promote na produkcję jest warunkowy**: patrz sekcja 3 (warunki W-1 do W-6). Kod realizuje reguły LR-19 do LR-30; braki dotyczą warstwy dokumentów i czynności właściciela, nie zachowania aplikacji, z jednym wyjątkiem operacyjnym (brak harmonogramu cleanup na Render, sekcja 2.1).

## 2. Ocena punktów szczegółowych

| # | Punkt | Ocena | Uzasadnienie |
|---|---|---|---|
| 1 | Retencja kodów 24 h (LR-20) | Zgodne w kodzie, **luka operacyjna** | `lib/db-retention.ts`: `emailCodesHours = min(24, env)`, kasuje wiersze starsze niż 24 h lub z `consumedAt`. `actions/auth.ts`: kod usuwany po użyciu (batch rejestracji), a każda wysyłka kasuje kody starsze niż 24 h (`CODE_RETENTION_MS`). W bazie tylko hash. Ale `/api/cron/cleanup` jest zaplanowany tylko w `vercel.json`; produkcja to Render (D1) i brak tam wywołania (karta, backlog ADR D8; w `.github/workflows` jest tylko `reminders-cron.yml`). Bez cronu ostatni niewysłany/niewykorzystany kod (z adresem e-mail osoby trzeciej) może leżeć dłużej niż 24 h, gdy nikt nie zamawia kodu. Ryzyko niskie przy małej skali, ale LR-20 wymaga cleanupu co najmniej raz na dobę. |
| 2 | Dziennik bezpieczeństwa min. 180 dni (LR-26) | Zgodne | Zdarzenia `security.*` są w `admin_audit_log` (bez klucza obcego, więc nietykane przez purge konta). Cleanup: `adminAuditDays = max(180, env)`, zmienna nie skróci okresu. 45 dni dotyczy tylko `site_activity_log` (i `page_views` 21 dni). Emergency purge (hard limit Turso) kasuje wyłącznie `notifications`, `page_views`, `site_activity_log`, nie `admin_audit_log`. `meta` ma tylko `reason` i `provider`; brak e-maila, kodu, hasła. Uwaga: jeśli właściciel włączy cron w trakcie sprawy BR-14, patrz W-2. |
| 3 | Komunikaty przejęcia (LR-23, LR-25, LR-29) | Zgodne | Komunikat po przejęciu (`register-form.tsx`): "Ten adres był wcześniej użyty bez potwierdzenia. Zabezpieczyliśmy konto: dotychczasowe hasło i dane konta zostały usunięte. Zaczynasz od nowa." - zgodny z treścią z bramki wejściowej, nie mówi, co konto zawierało. Ekran potwierdzenia (4A) widzi tylko osoba po uwierzytelnieniu w Google z `email_verified` (token podpisany, 10 min, bez imienia i e-maila w URL), więc nie ujawnia istnienia konta obcym. Ostrzeżenie "wszystkie dane tego konta zostaną trwale usunięte. Tego nie da się cofnąć" i bezpieczny domyślny przycisk "Zaloguj się hasłem" - dobre. Komunikaty odmów OAuth są neutralne (`auth-copy.ts`); jedyny świadomy wyjątek to kolizja Facebooka (udokumentowany, ryzyko niskie). Uwaga niska: sformułowanie "wszystkie dane" jest nieco szersze niż faktyczne (zamówienia `subscription_orders` zostają, pkt 5); doprecyzować przy zatwierdzaniu tekstu przez prawnika. |
| 4 | Polityka prywatności (LR-25) | **Luka: warunek Promote** | `app/(legal)/polityka-prywatnosci/page.tsx` (stan "17 października 2026") NIE zawiera akapitów z sekcji 5 bramki wejściowej: brak danych przekazywanych przez Google/Facebook i odrębnych administratorów, brak informacji o niepotwierdzaniu adresu przez Facebook, o weryfikacji kodem, o przejęciu konta niezweryfikowanego i usunięciu danych, o dzienniku bezpieczeństwa (180 dni), o SMTP jako procesorze oraz o retencji kodu. Wzmianki są tylko ogólne (Google/Facebook jako odbiorcy; okres przechowywania bez liczb). Jest tylko krótka nota `OAuthPrivacyNote` na ekranie logowania. Nie blokuje merge ani Preview; **blokuje Promote**, bo funkcja kasująca dane musi być opisana w polityce przed uruchomieniem (art. 12-13 RODO, rzetelność). Rekomendacja: wstawić projekt z sekcji 5 poniżej po zatwierdzeniu przez prawnika-człowieka, podbić datę aktualizacji i wersję, wpisać adres polityki w konsolach Google/Meta. Nie publikować tekstu bez prawnika-człowieka. |
| 5 | `subscription_orders` przy przejęciu | Dopuszczalne, ocena warunkowa | Zamówienia zostają (`PURGE_EXCLUDED_TABLES`): podstawa to obowiązek prawny przechowywania dokumentów rozliczeniowych 5 lat (art. 6 ust. 1 lit. c; wyłączenie prawa do usunięcia, art. 17 ust. 3 lit. b) [weryfikacja przepisów o rachunkowości i podatkach]. Wiersze nie są widoczne w UI ani eksporcie nowego właściciela (zgodnie z komentarzem w kodzie). Anulowanie `pending` w batchu przejęcia jest właściwe (nowy właściciel nie dostaje pakietu cudzej płatności). Płatność po przejęciu za `cancelled`/`failed`: log z identyfikatorami do ręcznego zwrotu - akceptowalne, o ile (a) log nie zawiera e-maila ani danych zdrowotnych, (b) właściciel ma procedurę zwrotu (nowy właściciel nie jest stroną tej umowy; zwrot płatnikowi w ciągu terminu ustawowego), (c) N1 (log wyścigu) zostanie domknięty. Zakres wiadomości do osoby płacącej poza aplikacją: zwrot przez operatora płatności. Pytanie otwarte do prawnika: czy wiersze zamówień powiązane z kontem przejętym należy dodatkowo pseudonimizować (np. odłączyć od `users.id`) po okresie przejęcia - rekomendacja: nie w tym zadaniu. |
| 6 | Zakres purge (art. 9) | Zgodne, uwagi niskie | Purge wyprowadza kroki z metadanych FK Drizzle (kaskady rekurencyjnie, dzieci przed rodzicami), więc obejmuje m.in. `body_reports`, `body_report_photos`, `weight_logs`, `meal_logs`, `workouts`, `daily_checkins`, `push_subscriptions`, czat, posty. Test gwarantuje, że każda kolumna `user_id` ma FK do `users` (ryzyko A3), a wiersz `users` jest czyszczony z waga/wzrost/wiek/płeć/aktywność/imię/notatka admina/pakiet. Nie sprawdziłem tabel przez uruchomienie na kopii bazy. Uwagi: (a) test A3 obejmuje tylko kolumnę `user_id`; kolumny `owner_user_id`, `author_user_id`, `created_by_user_id`, `host_user_id`, `invited_by_user_id`, `mentioned_user_id` nie są objęte testem (backlog: rozszerzyć test o wszystkie kolumny kończące się na `user_id`/`created_by`); (b) klucze `set null` bezpośrednio do `users` (`page_views`, `site_activity_log`, `notifications.actor_user_id`, `challenges.created_by`) zostają - to identyfikatory bez treści zdrowotnych, retencja krótka, akceptowalne; (c) zdarzenia w cudzych zasobach bez FK z retencją 7 dni (A8) - akceptowalne; (d) deprecated `users.fitatu_access_token` nie jest zerowany przy przejęciu (dopisać do resetu lub usunąć kolumnę, niski). Kopie zapasowe Turso i logi hostingu mogą zawierać dane do upływu własnej retencji dostawcy - opisać w polityce (LR-11). |
| 7 | SMTP jako procesor (LR-22) | Warunek uruchomienia SMTP | Kod: bez `SMTP_*` rejestracja e-mailem jest wyłączona (fail-closed), wpis w `lib/admin-config-status.ts` (id `email`) i opis w `env.example` z zaleceniem dedykowanej skrzynki, DPA, SPF/DKIM/DMARC - zgodne z LR-22. E-mail zawiera kod, ważność i "jeśli to nie Ty, zignoruj"; brak marketingu i danych zdrowotnych (LR-19). Do uzupełnienia: nazwa administratora w treści wiadomości (LR-19 wymaga) - uwaga niska. Przed pierwszą wysyłką produkcyjną właściciel musi mieć: DPA (art. 28), wpis do ewidencji dostawców (siedziba, region, transfer, retencja logów dostawcy), SPF/DKIM/DMARC, dedykowaną skrzynkę (nie prywatny Gmail). Do czasu SMTP produkcja działa tylko z Google/Facebook (to dopuszczalne i bezpieczniejsze). |
| 8 | Warunki wdrożenia BR-14/LR-27 | Nie zrealizowane (czynność właściciela) | Patrz W-1 do W-3. Migracja 0031 nie zawiera `DELETE`/`DROP` (dowody nie są kasowane przez wdrożenie). Cron `/api/cron/cleanup` nie jest wywoływany na Render, więc okno logów `site_activity_log` (45 dni) nie kurczy się samo; nie włączać go przed zabezpieczeniem dowodów. |
| 9 | Ryzyko resztkowe DW-5 | Do formalnej akceptacji | Konta sprzed wdrożenia dostają `email_verified_at = now` (reguła R-B) bez resetu hasła i sesji; ewentualny wcześniejszy założyciel na cudzy adres może nadal znać hasło. Zgodne z bezpieczeństwem (F-2, W1 zamknięte dla nowych kont); zaakceptowane przez właściciela w karcie (etap 9). Wymagane: akceptacja zapisana w rejestrze incydentów (W-3) i audyt konta admina oraz kont R-B przed Promote. Zdarzenie `security.backfill_verified` dokumentuje oznaczenie. |

## 3. Warunki przed Promote na produkcję

- **W-1 (LR-27a)**: wpis w rejestrze incydentów (art. 33 ust. 5) z datą uzyskania informacji o luce (2026-10-23), opisem i statusem "w ocenie".
- **W-2 (LR-27b)**: zabezpieczyć dowody przed jakimkolwiek sprzątaniem: eksport `site_activity_log`, `admin_audit_log`, `users`, `oauth_accounts`, `email_verification_codes` do szyfrowanego pliku (traktować jako dane osobowe, usunąć po zamknięciu sprawy). Nie włączać cronu cleanup do tego czasu.
- **W-3 (LR-27c, d)**: kontrole z sekcji 4.2 pkt 3-5 bramki wejściowej (konto `PRIMARY_ADMIN`/admini, `admin_audit_log`, rejestracje z `emailCodeMock: true`, logi Render), zapis wniosku i decyzji (UODO tak/nie, zawiadomienie osób tak/nie) z uzasadnieniem; zapisać też akceptację ryzyka DW-5. Jeśli potwierdzono S2/S3: 72 h od potwierdzenia (LR-18), decyzja prawnika-człowieka.
- **W-4 (LR-28, DW-3)**: `ADMIN_EMAILS` ustawione na Render, lista kont admin przejrzana.
- **W-5 (LR-25)**: polityka prywatności uzupełniona (sekcja 5), zatwierdzona przez prawnika-człowieka, adres wpisany w konsolach Google i Meta; krótka informacja na ekranie logowania już jest.
- **W-6 (LR-20, LR-22)**: po zamknięciu W-2 uruchomić harmonogram `/api/cron/cleanup` raz na dobę (np. GitHub Actions jak `reminders-cron.yml`); SMTP włączać dopiero po DPA i SPF/DKIM/DMARC (gdy SMTP wyłączone, W-6 część SMTP nie dotyczy).
- Pozostałe wymagania ogólne: wpis w changelogu `planned: true` jest; `npm run deploy:check` przed merge (karta, otwarte); podatność F-1 (`zod`, wysoka) z etapu 9 musi być zamknięta (blokuje wydanie wg przepływu, niezwiązana z LR).

## 4. Zgodność z regułami LR

| Reguła | Status |
|---|---|
| LR-19 treść i moment komunikatu | Zgodne (nazwa administratora w e-mailu: uwaga niska) |
| LR-20 retencja kodów | Zgodne w kodzie; wymaga harmonogramu cleanup (W-6) |
| LR-21 brak trybu testowego na produkcji | Zgodne (tryb testowy tylko poza Render/Vercel; kod 123456, nie 1234) |
| LR-22 SMTP | Zgodne w kodzie i konfiguracji; DPA i DNS - czynność właściciela |
| LR-23 przejęcie | Zgodne: purge w jednym batchu z resetem hasła, sesji, powiązań i zdarzeniem |
| LR-24 istniejące konta | Zgodne (bez masowego powiadomienia i kasowania); opis w polityce - W-5 |
| LR-25 informacja | **Niezgodne do czasu W-5** |
| LR-26 dziennik | Zgodne |
| LR-27 incydent | Oczekuje na właściciela (W-1 do W-3) |
| LR-28 rola admina | Zgodne w kodzie (rola tylko dla zweryfikowanego e-maila, brak adresu w repo); przegląd kont - W-3/W-4 |
| LR-29 komunikaty | Zgodne |
| LR-30 granice | Zgodne (brak nowych kategorii danych; zgody art. 9 i wiek 16+ nadal otwarte, backlog #2, #3) |
| LR z pliku 01 (retencja, rozliczalność) | Retencja dziennika i kodów zgodna; wiersz dot. zamówień (5 lat) uwzględniony; eksport/usuwanie konta przez FK - backlog "wysoki" z karty (przejść na `account-purge`) pozostaje wymogiem dla pełnej zgodności art. 17 |

## 5. Projekt akapitów polityki prywatności (do wstawienia po zatwierdzeniu przez prawnika-człowieka)

Do włączenia przez osobne zadanie dokumentowe do `app/(legal)/polityka-prywatnosci/page.tsx`, z podbiciem wersji i daty. Teksty z bramki wejściowej (sekcja 5), zaktualizowane o stan wdrożenia:

> **Logowanie przez Google lub Facebook.** Jeśli założysz konto lub zalogujesz się przez Google albo Facebook, otrzymujemy od dostawcy [adres e-mail, imię i nazwisko lub nazwę profilu, identyfikator konta u dostawcy]. Nie otrzymujemy hasła do tego konta ani listy znajomych. Podstawą jest umowa o prowadzenie konta (art. 6 ust. 1 lit. b RODO). Google i Meta są odrębnymi administratorami w zakresie własnego uwierzytelniania i przetwarzają dane według własnych zasad, także w USA [mechanizm transferu: do weryfikacji].
> **Potwierdzanie adresu e-mail.** Aby chronić konto, potwierdzamy, że adres e-mail należy do Ciebie: wysyłamy jednorazowy kod ważny 10 minut, a przy Google korzystamy z potwierdzenia adresu przez Google. Facebook nie potwierdza adresu, więc takie konto ma adres niepotwierdzony. Kod przechowujemy wyłącznie w postaci skrótu, najdłużej 24 godziny lub do wpisania. Nie wysyłamy go w celach marketingowych.
> **Konta bez potwierdzonego adresu.** Jeśli ktoś założy konto na adres, do którego nie ma dostępu, właściciel adresu może to konto zabezpieczyć, logując się przez Google i potwierdzając wyraźnie krok na ekranie. Dotychczasowe hasło i wszystkie dane takiego konta są wtedy trwale usuwane. Zachowujemy tylko dokumenty rozliczeniowe zamówień, które musimy przechowywać z mocy przepisów [okres: 5 lat, do weryfikacji].
> **Dziennik zdarzeń bezpieczeństwa.** Zapisujemy zdarzenia takie jak przejęcie konta, połączenie z kontem Google czy odmowa nadania roli administratora (typ zdarzenia, numer konta, czas) przez [180 dni], na podstawie uzasadnionego interesu (bezpieczeństwo, art. 6 ust. 1 lit. f RODO).
> **Wysyłka e-maili.** Wiadomości z kodem wysyła dla nas [nazwa dostawcy poczty], działający jako podmiot przetwarzający na podstawie umowy powierzenia [region przetwarzania].

## 6. Ryzyka

| Ryzyko | P | S | Środek |
|---|---|---|---|
| Promote bez zaktualizowanej polityki | średnie | średnie (art. 13, rzetelność, wymagania Google/Meta) | W-5 |
| Nieocenione S2/S3 i brak rejestru | niepewne | wysokie | W-1 do W-3 |
| Cleanup nie działa na Render: kody i adresy dłużej niż 24 h | wysokie | niskie | W-6 |
| Cleanup włączony przed eksportem dowodów | średnie | wysokie | W-2 przed W-6 |
| Utrata danych prawdziwego użytkownika, który zapomniał hasła | niskie | niskie/średnie | ekran 4A z ostrzeżeniem, opcja logowania hasłem |
| Płatność po przejęciu bez procedury zwrotu | niskie | niskie | procedura zwrotu właściciela, N1 |
| Pominięte kolumny użytkownika poza `user_id` w purge | niskie | średnie (art. 9) | rozszerzyć test A3 |
| SMTP bez DPA/DNS | zależy od właściciela | średnie | warunek uruchomienia SMTP |

## 7. Uwagi do backlogu (z właścicielem)

| Uwaga | Właściciel | Priorytet |
|---|---|---|
| Harmonogram `/api/cron/cleanup` na Render (po W-2), kontrola działania co dobę | właściciel + backend | średni (przed uruchomieniem SMTP: wysoki) |
| Uzupełnić politykę prywatności (sekcja 5) i wersjonować; adres w konsolach Google/Meta | prawnik-człowiek + właściciel | wysoki (warunek Promote) |
| Rozszerzyć test A3 o kolumny `*_user_id`, `created_by`; wyzerować `fitatu_access_token` przy przejęciu | backend | niski |
| Nazwa administratora w e-mailu z kodem (LR-19) | backend | niski |
| Doprecyzować treść 4A/4B ("wszystkie dane" a zamówienia) po zatwierdzeniu prawnika | ux + prawnik-człowiek | niski |
| Procedura zwrotu płatności po przejęciu; domknąć N1 | właściciel + backend | niski |
| Ewidencja dostawców: SMTP, Render, Turso, Sentry, Upstash (DPA, region, retencja logów) | właściciel | średni |
| Usuwanie konta przez `account-purge` (karta: wysoki) | backend | wysoki |

## 8. Pytania otwarte

1. Który dostawca SMTP i region? Czy własna domena z SPF/DKIM/DMARC?
2. Czy cron cleanup kiedykolwiek działał na produkcji (jakie okno logów istnieje)?
3. Czy właściciel potwierdza akceptację DW-5 w rejestrze incydentów?
4. Czy aplikacja Facebook ma adres polityki i instrukcję usuwania danych w konsoli Meta?

## 9. Do zatwierdzenia przez prawnika-człowieka

Cały dokument, w szczególności: ocena podstaw (art. 6 ust. 1 lit. b, c, f; art. 17 ust. 3 lit. b), usuwanie danych przy przejęciu i brak indywidualnej informacji (art. 14 ust. 5 lit. b), pozostawienie zamówień, projekt akapitów polityki, kwalifikacja incydentu i decyzje o UODO, status SMTP jako procesora i transferów oraz weryfikacja przepisów i wytycznych w oficjalnych źródłach: [data weryfikacji].
