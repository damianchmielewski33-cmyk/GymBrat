# Audyt przedkomercyjny GymBrat — 2026-11-01

Zakres: UX, bezpieczeństwo, wydajność, jakość, wartość biznesowa, spójność logiczna, architektura, płatności, spójność wizualna. Na końcu: plan prac. Backlog z user stories: [2026-11-01-backlog-komercjalizacja.md](2026-11-01-backlog-komercjalizacja.md).

Poprzednie dokumenty (stan 2026-10-23: `docs/zespol/backlog.md`, `docs/bezpieczenstwo/`, `docs/ux/`, `docs/wydajnosc/`) zostały użyte jako punkt wyjścia; ten audyt weryfikuje, co z nich nadal jest prawdą.

## 0. Metoda i granice audytu

Co zostało **zrobione i zweryfikowane**:
- `npm test`: 164 pliki, **1237 testów, wszystkie zielone**. `tsc --noEmit`: **czysto**. `eslint`: **102 błędy, 39 ostrzeżeń** (było 114 błędów 23.10).
- Lektura kodu: płatności (`app/api/package/checkout`, `app/api/payments/hotpay/notify`, `lib/hotpay.ts`, `lib/user-package.ts`), `proxy.ts`, `next.config.ts`, rejestracja (`actions/auth.ts`, `lib/register-email-mode.ts`), usuwanie konta i eksport, rate limiting, schemat bazy, statystyki rozmiaru plików.
- Uruchomienie lokalne (`npm run dev`, baza `file:./local.db`), dane mock ze skryptu `scripts/seed-local-mock.cjs` (3 konta `*@gymbrat.test`, 10 treningów, 12 pomiarów wagi, posiłki), logowanie przez formularz, **przejście 55 tras** (kod 200, czas, rozmiar odpowiedzi, błędy serwera) i oględziny ekranów mobilnych (375×812): Pulpit, Trening, Analiza, Dieta/Bilans, Pakiet, Społeczność.
- Test anonimowy webhooka płatności i `/admin` przez `curl`.

> Aktualizacja: część poniższych braków domknięto w drugiej rundzie na mockach — patrz sekcja 14 (admin, plany, aktywny trening, raport, webhook płatności). Lista w sekcji 14 „Nadal niezweryfikowane" jest aktualna; ta poniżej opisuje stan po pierwszej rundzie.

Czego **nie** zweryfikowano (nie traktować jako „sprawdzone"):
- Produkcja (Render/VPS), Turso, Upstash, Sentry, PostHog — brak dostępu; wartości z `decyzje-wlasciciela.md`.
- Wizualnie nie obejrzano: ekranów admina (tylko kod i odpowiedź 307 dla anonima), aktywnego treningu krok po kroku, formularza raportu ciała, planów (edytor/atlas/import), pozostałych podstron profilu i społeczności. Dla nich sprawdzono tylko, że trasa renderuje się bez błędu serwera.
- Prawdziwa płatność HotPay (brak sandboxa i kluczy), Android WebView, iOS, backend Java.
- Testy E2E Playwright (`e2e/`) — nie uruchamiane.
- Czasy z dev (Turbopack) zawyżone przez kompilację na żądanie; liczby rozmiarów HTML są wiarygodne, czasy tylko orientacyjne.

## 1. Werdykt

**Nie gotowe do komercjalizacji.** Rdzeń produktu (trening, dieta, postępy, społeczność) jest szeroki i dobrze przetestowany jednostkowo, ale **płatności nie działają end-to-end**, a **produkt, który sprzedaje, nie istnieje** (pakiet = „bez reklam", reklamy nie są skonfigurowane). Do tego brak podstaw prawnych dla danych zdrowotnych i kilka luk bezpieczeństwa.

Trzy blokery (P0):
1. **Webhook płatności jest nieosiągalny** — HotPay dostanie 401 (sekcja 2.1).
2. **Pakiet nic nie odblokowuje** — brak wartości za którą ktoś zapłaci (sekcja 11).
3. **Dane o ciele bez zgody art. 9 RODO / brak rejestru zgód / analityka bez zgody** (sekcja 4).

## 2. Płatności (HotPay)

Przepływ: `/package` → checkbox regulaminu (tylko klient) → `POST /api/package/checkout` tworzy zamówienie `pending` i zwraca pola formularza z hashem → przeglądarka robi POST do HotPay → HotPay woła `POST /api/payments/hotpay/notify` → zamówienie `paid` + `extendUserPackage`.

| ID | Waga | Znalezisko |
|---|---|---|
| PAY-1 | **Krytyczne** | `proxy.ts` nie ma wyjątku dla `/api/payments/hotpay/notify` ani nie ma jej w `ANONYMOUS_PUBLIC_PATHS`. Serwer HotPay nie ma sesji NextAuth, więc dostaje **401 JSON** (potwierdzone `curl`: anonimowy POST → 401). Żadna płatność nie zostanie nigdy zaksięgowana; użytkownik zapłaci i nie dostanie pakietu. Wyjątki są dla `/api/cron/`, `/api/branding` itd. — tej trasy zabrakło. Brak testu, który by to wychwycił. |
| PAY-2 | Wysokie | Webhook nie porównuje `KWOTA` z `order.amountGrosze`. Hash chroni integralność powiadomienia, ale nie zgodność z zamówieniem (zmiana ceny planu po utworzeniu zamówienia, błąd integracji, ręczne zamówienie w panelu HotPay na inną kwotę → pakiet za złą cenę). |
| PAY-3 | Wysokie | Brak atomowości: `UPDATE status=paid` i `extendUserPackage` to dwa osobne zapytania. Błąd między nimi = zamówienie `paid` bez pakietu; ponowne powiadomienie nie naprawi (status już `paid`, `changed.length === 0`). Potrzebne `db.batch` lub kolumna `fulfilled_at` + ponawialne księgowanie. |
| PAY-4 | Wysokie | Zgoda na natychmiastowe świadczenie i utratę prawa odstąpienia (art. 38 pkt 13 ustawy o prawach konsumenta) jest tylko checkboxem klienta. Serwer jej nie wymaga ani nie zapisuje (brak znacznika czasu, wersji regulaminu, IP) — w sporze brak dowodu. |
| PAY-5 | Wysokie | Usunięcie konta `DELETE /api/user/account` kasuje wiersz `users`, a `subscription_orders` ma `ON DELETE CASCADE` → znikają dokumenty sprzedaży. Wymóg przechowywania dokumentacji księgowej (5 lat) przeczy temu; trzeba anonimizacji zamiast kaskady (jest w starym backlogu #5, nie zrobione). Brak też ponownego uwierzytelnienia przy usuwaniu. |
| PAY-6 | Średnie | Brak faktur/paragonów i danych podatkowych (NIP/VAT, wybór stawki, e-mail z potwierdzeniem zakupu). `D17`: administrator = osoba prywatna, `D17` w backlogu: decyzja o działalności gospodarczej nadal otwarta — **sprzedaż bez działalności jest blokerem prawnym niezależnym od kodu**. |
| PAY-7 | Średnie | Brak: ekranu statusu zamówienia (po powrocie `?paid=1` UI tylko „podpowiada"), historii zamówień użytkownika, obsługi zamówień `pending` starszych niż N godzin (cron czyszczący), obsługi zwrotów (log tylko `logServerError` przy płatności za zamówienie `cancelled`), odnowień/przypomnienia o końcu pakietu. |
| PAY-8 | Średnie | Rate limit checkoutu używa `RATE.adminMutation` (nazwa wskazuje na admina); bez Upstash limit jest w pamięci procesu (reset przy restarcie, brak współdzielenia między instancjami). Brak idempotencji: każde kliknięcie tworzy nowe zamówienie `pending`. |
| PAY-9 | Niskie | Brak testów jednostkowych `hotpay.ts` i trasy `notify` (`grep` w `lib/*.test.ts` znajduje tylko status konfiguracji). Brak sandboxowego scenariusza E2E. |
| PAY-10 | Informacja | Pozytywne: hash weryfikowany stałoczasowo (`timingSafeEqualHex`), przejście `pending → paid` jest warunkowe (idempotentne przy powtórzeniach), cena zawsze z bazy (nie z klienta), CSRF + rate limit na checkoucie, konfiguracja widoczna w panelu (`admin-config-status.ts`). |

## 3. Bezpieczeństwo

Stan względem listy z 23.10:

| ID | Status | Uwagi |
|---|---|---|
| Kod rejestracji `1234` na produkcji | **Naprawione** | `getRegisterEmailMode` zwraca `disabled` na hostingu bez SMTP; `test` tylko w dev/test bez znaczników hostingu. Skutek: **na produkcji bez SMTP nie da się założyć konta e-mailem** (zostaje Google) — to wymaga SMTP przed startem. |
| `ADMIN_EMAILS` tylko zweryfikowany e-mail | Naprawione | `lib/admin-config.ts` wymaga `emailVerified`. |
| Unieważnianie sesji | Naprawione | `session_version`, sprawdzane w `proxy.ts` (fail-open przy błędzie bazy — świadoma decyzja). |
| Indeks `workouts(user_id,date)` | Naprawione | Jest w schemacie. |
| Java `GYMBRAT_PROXY_TOKEN` | **Otwarte** | `application.yml`: `proxy-token: ${GYMBRAT_PROXY_TOKEN:}`, README: „opcjonalnie". Bez tokenu Java ufa nagłówkowi użytkownika. Do potwierdzenia, czy Java działa na produkcji (D5); jeśli nie — usunąć z repo/deployu. |
| PIN admina | Do weryfikacji | Decyzja D15: usunąć; trasy `/api/admin/lock|unlock` nadal istnieją. |
| Usunięcie konta bez ponownego uwierzytelnienia | **Otwarte** | Wystarczy ważna sesja + CSRF. |

Nowe znaleziska:

| ID | Waga | Znalezisko |
|---|---|---|
| SEC-1 | Wysokie | **CSP wyłącznie Report-Only** (`next.config.ts`), a produkcyjna aplikacja z formularzami i danymi zdrowotnymi nie ma egzekwowanej polityki treści. Do przełączenia na enforce po zebraniu raportów (endpoint `/api/security/csp-report` istnieje). Brak `script-src`. |
| SEC-2 | Średnie | `connect-src 'self'` w CSP Report-Only, a aplikacja używa PostHog/Sentry/Pollinations → po włączeniu enforce zepsuje analitykę/obrazy, jeśli lista nie zostanie uzupełniona. |
| SEC-3 | Średnie | Rate limit: fallback w pamięci procesu bez Upstash; `clientIpFromHeaders` ufa pierwszemu `x-forwarded-for` (spoofowalne bez zaufanego proxy). Limity logowania/rejestracji można ominąć zmianą nagłówka na hostingu bez poprawnej konfiguracji. |
| SEC-4 | Średnie | `Cross-Origin-Resource-Policy: cross-origin`, `Cross-Origin-Opener-Policy: unsafe-none` oraz osadzanie w iframe AWP (`frame-ancestors`) — ekspozycja powierzchni ataku dla funkcji, której status biznesowy jest niejasny (czy AWP nadal potrzebne?). |
| SEC-5 | Średnie | Hasło: `bcrypt` koszt 12 — OK; brak informacji o blokadzie konta po serii prób/powiadomień o logowaniu (jest `security_events`, ale nie widać ścieżki dla użytkownika). Brak 2FA (dla panelu admina to realne ryzyko). |
| SEC-6 | Niskie | Katalog `undefined/` w korzeniu repo, `test-results/`, `tsconfig.tsbuildinfo` — artefakty w drzewie roboczym (hygiene). Repo jest **publiczne** (D6) — przy komercjalizacji rozważyć prywatne (logika płatności, `docs/` z modelem zagrożeń i wykazem podatności jest publiczną mapą dla atakującego). |
| SEC-7 | Niskie | 54 trasy admina mają kontrolę roli (`grep`), ale brak jednolitego testu „każda trasa `/api/admin/*` zwraca 401/403 dla zwykłego użytkownika". Warto dodać test enumerujący trasy. |

## 4. Prywatność i zgodność (RODO) — blokery komercyjne

Aplikacja przetwarza masę ciała, wymiary, zdjęcia sylwetki, tętno, posiłki (dane zdrowotne, art. 9). Stan z `docs/prawo/` i `wiedza-o-projekcie.md` (nie zmieniony w kodzie, który przeczytałem):
- Brak wyraźnej, wersjonowanej zgody na dane o ciele; zgody (cookies) w localStorage; PostHog i Sentry klienta bez zgody (backlog #3).
- Minimalny wiek: kod nadal przyjmuje `age >= 13` (`lib/profile-complete.ts`), decyzja D18 mówi 16 (backlog #4).
- Pollinations dostaje prompty z danymi użytkownika (D25) — transfer poza EOG (backlog #6).
- Retencja bez automatycznego usuwania (backlog #7); administrator danych = osoba prywatna (D17).
- Eksport danych istnieje (`/api/user/export`, JSON/CSV) — dobrze; właściciel uznał go za „zbędny", ale to realizacja art. 20 — **nie usuwać**.
- Polityka prywatności i regulamin istnieją (`/regulamin`, `/polityka-prywatnosci`); regulamin ma §7 odstąpienie i §8 reklamacje. Wymagają przeglądu prawnika-człowieka przed sprzedażą.

## 5. Architektura

Mocne strony: spójny stos (Next 16, React 19, Drizzle/libSQL), guardy akcji (`guardAction`, `withApiErrors`, CSRF), logika domenowa wydzielona do `lib/` z 164 plikami testów, wbudowane migracje i `ensure-schema`.

| ID | Waga | Znalezisko |
|---|---|---|
| ARCH-1 | Wysokie | **Dwa źródła schematu**: `db/schema.ts` (2304 linie) i `db/ensure-schema.ts` (1630 linii, „faktyczne źródło"), plus migracje Drizzle. Ryzyko rozjazdu; `ensureCriticalSchema()` jest wołane w pojedynczych funkcjach (`await ensureCriticalSchema()` w każdym `getX`) — koszt przy każdym żądaniu i niejasna odpowiedzialność. Potrzebna jedna ścieżka: migracje przy starcie/deployu. |
| ARCH-2 | Wysokie | Zdjęcia (ciało, cardio, avatar, marka) trzymane jako `data URL` w tabelach Turso (`data_url` w 6 tabelach). Rosną koszt, limity zapisu/odczytu i rozmiar backupu; duże rekordy blokują zapytania. Magazyn obiektowy (S3/R2) + sygnowane URL. |
| ARCH-3 | Średnie | Aplikacja realizuje 4 kanały: web/PWA, Android WebView, iOS WKWebView, Java (5 tras, dane w pamięci). Java dubluje logikę (tydzień cardio), nie ma trwałości — koszt utrzymania bez jasnej wartości. Decyzja: usunąć albo zrobić pełnoprawnie. |
| ARCH-4 | Średnie | Duże moduły: `lib/progress-hub.ts` 1720 linii, `lib/community/teams.ts` 1367, `components/reports/body-report-form.tsx` 1241, `lib/home-start.ts` 1110, `changelog-data.ts` 1656 (dane w kodzie, 6 odniesień do płatności). Trudne do przeglądu i testowania. |
| ARCH-5 | Średnie | Wzorzec SELECT-then-UPDATE bez CAS w 7 plikach społeczności (lista w `bledy.md`) — wyścigi na XP/wojnach/misjach. |
| ARCH-6 | Niskie | Pomysły „na później" w repo: martwe komponenty (UX 11), `docs/*.json` nieaktualne, rola `trener` + `inbox` do usunięcia (D7), `labs`/`promo-codes` nieokreślone (D11) — `/promo-codes` i `/labs` renderują się w produkcie bez definicji produktu. |
| ARCH-7 | Niskie | Brak środowiska staging poza dokumentacją (`docs/staging.md`), brak monitoringu płatności (alert gdy `paid` bez `extend` lub zamówienie `pending` > 1 h). |

## 6. Wydajność

Pomiar lokalny (dev, rozmiar HTML SSR, 55 tras): większość 50–80 kB; **`/nutrition/week` 209 kB**, **`/plany/atlas` 148 kB**, `/cardio` 87 kB, `/nutrition/today` 83 kB. Czasy w dev nie nadają się do wniosków, ale warto zauważyć wolne trasy po kompilacji: `/progress` ~10 s, `/supplements` ~17 s, `/reports` ~10,6 s, `/meal-suggestions` ~9,5 s (pierwsze wejście, wliczona kompilacja) — kandydaci do pomiaru na buildzie produkcyjnym.

| ID | Waga | Znalezisko |
|---|---|---|
| PERF-1 | Średnie | RSC payload 150–210 kB na `nutrition/week` i `plany/atlas` (dane serializowane do klienta). Ograniczyć dane przekazywane do komponentów klienckich, paginacja. |
| PERF-2 | Średnie | Zdjęcia w bazie (ARCH-2) i `ensureCriticalSchema` w ścieżce żądania. |
| PERF-3 | Średnie | Ostrzeżenia Recharts „width(-1) height(-1)" na `/progress` — kontenery wykresów bez wymiarów przy pierwszym renderze (flash/pusty wykres, zbędny re-render). Ekran `/progress` przy pierwszym wejściu pokazał szkielety zamiast treści. |
| PERF-4 | Średnie | Synchronizacja aktywnego treningu co 8 s z pełnym payloadem (~9,4 kB) — ok. 40% darmowego limitu zapisów Turso przy 300 treningach dziennie (wiersz w `bledy.md`); przy skali komercyjnej to koszt i limit. |
| PERF-5 | Niskie | Polling społeczności (powiadomienia, czat, obecność) obok SSE — bez cache; brak budżetu wydajności w CI. |
| PERF-6 | Niskie | Brak pomiaru Core Web Vitals w audycie — brak danych do oceny LCP/INP. Zalecany Lighthouse na buildzie produkcyjnym. |

## 7. Jakość kodu i testów

- Testy jednostkowe: **bardzo dobre** (1237 zielonych), `tsc` czysty.
- **Lint czerwony** (102 błędy, głównie reguły React Compiler) — nie może blokować CI, więc bramki są osłabione; brak pewności, czy `deploy:check` go uwzględnia.
- Testy E2E: 3 pliki (smoke, aktywny trening, dieta-admin), pełny smoke wymaga `E2E_EMAIL/E2E_PASSWORD` i jest pomijany bez nich. **Brak E2E płatności, rejestracji, usuwania konta.**
- Brak testów kontraktowych dla webhooka HotPay (PAY-9) i dla „wszystkie trasy wymagają sesji" (jeden test enumerujący `app/api/**` względem listy wyjątków `proxy.ts` złapałby PAY-1).
- Changelog w kodzie (`changelog-data.ts`) obsługuje flow Preview/Promote — zgodne z `AGENTS.md`, ale plik ma 1656 linii.

## 8. UX (obserwacje z przejścia lokalnego, mobile 375 px)

| ID | Waga | Obserwacja |
|---|---|---|
| UX-1 | Wysokie | **Niespójne dane**: Pulpit pokazuje cardio „20 / 150 min", a ekran Trening „0 min · 1 sesja" w tym samym tygodniu (26.10–01.11). To bezpośredni błąd logiki (dwie ścieżki liczenia — patrz też wiersz o strefach w `bledy.md` i decyzja D9 o tygodniu pon–niedz). Użytkownik traci zaufanie do liczb. |
| UX-2 | Średnie | Pulpit dla konta z 10 treningami w historii: „Dodaj plan treningowy", „Dodaj pierwszy raport · 0 raportów", „Skonfiguruj pierwszy tydzień" — onboarding pokazuje się mimo aktywności; brakuje stanu „masz historię, ale nie plan" (szybki plan z ostatnich treningów). |
| UX-3 | Średnie | Pływający przycisk „+ Raport" zasłania treść i pasek nawigacji; na Pulpicie nachodzi na kartę „Treningi w tym tygodniu"; główny przycisk akcji każdego ekranu to ta sama czynność (raport ciała), nawet na ekranie Treningu, gdzie oczekiwany byłby „Rozpocznij trening". |
| UX-4 | Średnie | Sprawdzone trasy po zalogowaniu (Pulpit, onboarding, start-workout, active-workout, workout-plan, plany) mają ten sam tytuł dokumentu „GymBrat — centrum treningowe" (własne tytuły mają tylko logowanie, rejestracja, regulamin, polityka; pozostałych tras nie sprawdzono) — słabe dla historii przeglądarki, dostępności i SEO stron publicznych; metadata per trasa. |
| UX-5 | Średnie | Ekran Analiza: puste szkielety przy pierwszym wejściu, bez komunikatu postępu; zakładki „Przegląd/Siła/Sylwetka/Tygodnie" ok. |
| UX-6 | Niskie | „Dodaj pierwszy raport · 0 raportów" łamie się w dwóch liniach (węzeł tekstu pod przyciskiem). |
| UX-7 | Niskie | Nazewnictwo: zakładka „DIETA" prowadzi do ekranu „Statystyki bilansu"/„Makro dziś" — różne nazwy tej samej sekcji. |
| UX-8 | Niskie | Ekrany `labs`, `promo-codes`, `inbox` istnieją w nawigacji/trasach bez zdefiniowanego produktu (D7, D11). |
| UX-9 | Informacja | Pozytywne: spójna ciemna estetyka „black iron & gold", czytelne karty, polski język, wyraźne CTA, baner cookies z „Tylko niezbędne". |

## 9. Spójność wizualna

- **Nagłówki ekranów różne**: Pulpit i Trening mają logo GYM BRAT + menu (hamburger), Dieta/Bilans ma strzałkę wstecz i kicker, Społeczność logo + menu. Reguły kiedy „strzałka wstecz", a kiedy „logo" nie są jednolite.
- **Złoto zakodowane na sztywno** w wielu miejscach zamiast tokenu (znalezisko UX z 23.10, backlog #18, nie zamknięte): w `package-page-client.tsx` użyto `var(--gym-gold)` (dobrze), ale w całym projekcie nadal są literały.
- Kafelki statystyk w 3 wariantach (Pulpit, Bilans, Społeczność „Community level") — brak jednego komponentu.
- Rozmiary i odstępy przycisków głównych różne (Pulpit „Utwórz plan" duży, Pakiet „Kup pakiet" `rounded-full text-[13px]`).
- Pływający element Next dev w prawym dolnym rogu zasłania pierwszą ikonę nawigacji — tylko dev, ale pokazuje, że **dolna nawigacja nie ma bezpiecznego marginesu** na elementy pływające (FAB + system gest-bar).
- Brak trybu jasnego (decyzja produktowa „tylko ciemny") — kontrast tekstu pomocniczego (szary na czarnym) do weryfikacji WCAG AA narzędziem.

## 10. Spójność logiczna

1. **Cardio**: Pulpit (`lib/home-start.ts`) i ekran Trening (`lib/treningi-hub-stats.ts`) pokazują różne minuty dla tego samego tygodnia (UX-1); **przyczyny w kodzie nie zbadano** — hipoteza: różne źródła (`workouts.cardio_minutes` vs `training_sessions`) i strefy czasowe. Silnik „dodatkowego cardio" używa trzeciej definicji tygodnia. Docelowo jedna funkcja domenowa + test kontraktowy (D9: pon–niedz).
2. **Pakiet vs reklamy**: pakiet odblokowuje „bez reklam", ale AdMob nie jest skonfigurowany (D24) — oferta bez przedmiotu.
3. **Rola `trener`**: decyzja usuń (D7), kod i ekrany nadal są.
4. **Wiek**: decyzja 16+ vs kod 13+.
5. **Eksport/usuwanie konta**: właściciel „zbędne", prawo „obowiązkowe".
6. **Rejestracja**: bez SMTP tylko Google — komunikaty na ekranie rejestracji mówią o kreatorze imię/nazwisko, który po wejściu nie informuje, że e-mail jest wyłączony (do sprawdzenia na produkcji).
7. **Admin**: `ADMIN_EMAILS` pusta (D4), potem „ustawi przed Promote" (DW-3) — brak potwierdzenia, że zostało zrobione.

## 11. Wartość biznesowa

| ID | Znalezisko |
|---|---|
| BIZ-1 | **Jedyna monetyzacja to „bez reklam"**, a reklamy nie są skonfigurowane. Sprzedaż produktu, którego nie ma, jest zarówno biznesowo bez sensu, jak i prawnie ryzykowna (wprowadzenie w błąd). |
| BIZ-2 | Model: pakiety dniowe (7/30/90/365), jednorazowe, bez odnowienia, bez okresu próbnego. Brak ceny roboczej/benchmarku; brak testów cenowych. |
| BIZ-3 | Funkcje o największej wartości (analiza postępów, coach heurystyczny, plany, społeczność, raporty ciała) są darmowe — brak zróżnicowania Free/Premium. Zalecana decyzja produktowa: co jest Premium (np. zaawansowana analiza, raporty PDF, import planów, ghost-training, historia > N miesięcy). |
| BIZ-4 | Brak lejka i metryk biznesowych: aktywacja (rejestracja → pierwszy trening), retencja D1/D7/D30, konwersja do płatnego; PostHog jest w kodzie, ale bez zgody (sekcja 4) i bez zdefiniowanych KPI. |
| BIZ-5 | Dystrybucja: Android (Google Play planowany, D23), iOS bez Apple Developer (PWA), web. Brak wymagań sklepów: polityka prywatności + `/usun-konto` (backlog #5), Data Safety, płatności w aplikacji w Google Play (cyfrowe usługi w aplikacji **muszą** iść przez Play Billing, nie zewnętrzną bramkę — obecny HotPay w WebView Androida złamie politykę Google Play). |
| BIZ-6 | Pozytywne: szeroki zakres, unikalna mieszanka treningu + diety + społeczności, polski rynek, gamifikacja. Ryzyko: szerokość kosztem głębi (labs, wars, quests, ghost…), duży koszt utrzymania przy jednym deweloperze. |

## 12. Czego brakuje (lista braków przed komercjalizacją)

Płatności i sprzedaż: poprawny webhook + testy, zapis zgód konsumenckich, historia zamówień, e-mail potwierdzający, faktury/paragony, zwroty, odnowienia i przypomnienia, panel finansowy (przychody, zamówienia `pending`), plan Free/Premium z faktycznym gatingiem, konfiguracja reklam albo zmiana oferty.
Prawo i zaufanie: rejestr zgód, zgoda art. 9, wiek 16+, retencja, `/usun-konto`, anonimizacja zamówień, rejestr czynności przetwarzania, umowy powierzenia (Turso, Sentry, PostHog, Upstash, hosting, SMTP), DPIA dla danych zdrowotnych, review prawnika, działalność gospodarcza/dane sprzedawcy.
Operacje: SMTP produkcyjny, staging, backup/restore przetestowany (`docs/disaster-recovery.md` istnieje — test przywracania niepotwierdzony), monitoring i alerty, status page, runbook płatności, SLO.
Produkt: spójne liczby (cardio), onboarding świadomy historii, nazewnictwo sekcji, tytuły stron, wsparcie (kontakt, FAQ), mechanizm zgłaszania błędów (`bug-report` jest), changelog publiczny.
Jakość: lint zielony, E2E krytycznych ścieżek, test enumerujący trasy vs proxy, budżet wydajności, WCAG.

## 13. Plan prac

Fazy (szacunki w dniach roboczych jednego dewelopera, orientacyjne):

**Faza 0 — Decyzje właściciela (równolegle, 1–3 dni, bez kodu).** Działalność gospodarcza i dane sprzedawcy; co jest Premium i jaki jest model cen; reklamy (AdMob) czy rezygnacja; Java: zostaje czy znika; czy AWP iframe potrzebny; repo prywatne; Google Play Billing vs web-only.

**Faza 1 — Blokery płatności i bezpieczeństwa (5–8 dni).** PAY-1 (webhook), PAY-2, PAY-3, PAY-4, PAY-9 (testy), ARCH-1 częściowo (migracje), SEC-1 przygotowanie CSP enforce, usunięcie lub zabezpieczenie Javy, SMTP.

**Faza 2 — Zgodność (8–12 dni).** Rejestr zgód i zgoda art. 9, wiek 16+, retencja, usuwanie konta z re-auth i anonimizacją zamówień (PAY-5), `/usun-konto`, analityka po zgodzie, Pollinations bez danych osobowych. Review prawnika.

**Faza 3 — Wartość produktu (8–12 dni).** Gating Premium, spójna definicja cardio (UX-1), onboarding świadomy historii (UX-2), historia zamówień, e-maile transakcyjne, faktury, ekran statusu zamówienia, KPI w PostHog.

**Faza 4 — Jakość i wydajność (6–10 dni).** Lint zielony, E2E (rejestracja, płatność w sandboxie, usuwanie konta), zdjęcia poza bazą (ARCH-2), redukcja RSC payload (PERF-1), Recharts (PERF-3), tytuły stron (UX-4), ujednolicenie nagłówków/tokenów/kafli (sekcja 9), Lighthouse i WCAG.

**Faza 5 — Wejście na rynek (3–5 dni).** Staging → Preview → Promote wg `AGENTS.md`, test przywracania backupu, runbook płatności, alerty, Google Play (Billing lub web-only), soft launch na wąskiej grupie.

Kryteria „gotowe do komercjalizacji" (Definition of Launch): wszystkie P0 zamknięte; płatność sandbox → produkcja przechodzi E2E i księguje się bez interwencji; zgody i usuwanie konta zweryfikowane przez prawnika; `deploy:check`, testy, `tsc` i lint zielone; backup przywrócony na próbę; Premium faktycznie odblokowuje funkcje.

## 14. Weryfikacja uzupełniająca na mockach (2026-11-01, druga runda)

Zweryfikowane lokalnie (dev, dane mock, HotPay z **testowymi** wartościami `HOTPAY_*` w `.env.local`):

| Obszar | Wynik |
|---|---|
| PAY-1 webhook | **POTWIERDZONE.** Anonimowy POST z poprawnie podpisanym hashem (SHA-256 wg `lib/hotpay.ts`) przez HTTP → **401** z `proxy.ts`. |
| PAY-2 kwota | **POTWIERDZONE** testem wywołującym handler `notify` na lokalnej bazie: zamówienie 19,99 zł (`amount_grosze=1999`) zostało zaksięgowane jako `paid` przy `KWOTA=0.01`, a `packageEndsAt` przesunięte o 30 dni. |
| Idempotencja powtórki | Działa poprawnie: drugie to samo powiadomienie zwraca 200 i **nie** przedłuża pakietu drugi raz. |
| PAY-3 atomowość | Tylko analiza kodu (nie wymuszono awarii między dwoma zapytaniami) — nadal hipoteza o wysokim prawdopodobieństwie. |
| Admin | Kontrola roli działa: konto z rolą zmienioną w bazie, ale ze starą sesją, dostało „Brak dostępu", dopiero po ponownym zalogowaniu panel się otworzył (uwaga: sesja z podbitym `session_version` żyła jeszcze > 30 s i zachowała starą rolę). Analityka ładuje się, baner „Trzeba skonfigurować na hostingu 8 funkcji" i wskaźnik przy „Konfiguracja" działają zgodnie z `AGENTS.md`. Konta: filtr nadal zawiera „Trenerzy" (D7 niewykonane). Pakiety: 3,99 / 8,99 / 24,99 / 79,99 zł; **brak w panelu listy zamówień i płatności** (potwierdza E1-7). |
| Plany | Wybór „Od zera / Z pliku", edytor (nazwa, serie, powtórzenia, RIR, tempo), katalog 165 ćwiczeń z filtrami i zapis planu działają. Katalog zaczyna się alfabetycznie od mało popularnej „Antyrotacja Pallofa" (brak sekcji popularnych/ostatnich). |
| Aktywny trening | Cały przepływ działa: start (wybór Samodzielnie/Grupowo), zapis serii, timer przerwy, zakończenie, zapis (`POST /api/workouts/complete` 200), ekran podsumowania z komunikatem dla serii bez obciążenia. Brak pełnoekranowej reklamy przed treningiem przy braku pakietu (zgodnie z BIZ-1: reklamy nie są skonfigurowane). |
| Raport ciała | Kreator 5-krokowy: krok 1 wymaga 5 pomiarów naraz (waga, pas, udo, klatka, ramię), krok 2 — 4 skal 1–10 wszystkie wymagane. Dalszych kroków (zdjęcia itd.) **nie** przeszedłem. Przed pierwszym zapisem danych o ciele **nie ma** kroku zgody (potwierdza E3-1). |

Nowe znaleziska z tej rundy:

| ID | Waga | Znalezisko |
|---|---|---|
| NEW-1 | Średnie | **Szum błędów 403 w aktywnym treningu**: każda akcja (zapis serii itd.) wysyła `POST /api/community/friends/live/presence`, który dla użytkownika bez udostępniania zwraca 403 (`Brak wzajemnego udostępniania treningu`) — 38 błędów w konsoli w jednym treningu. Zbędny ruch, zaśmiecone logi/Sentry, ryzyko fałszywych alarmów. Klient powinien nie wysyłać obecności bez aktywnego udostępniania. |
| NEW-2 | Średnie | **Zapis serii z 0 kg bez ostrzeżenia** dla ćwiczenia, które nie jest ewidentnie z masą ciała; skutek: tonaż 0 i „brak porównania". Warto wymusić świadomy wybór „bez obciążenia". |
| NEW-3 | Średnie | **Ekran Trening z niedokończoną sesją** pokazuje trzy równoległe sterowania: karta „Kontynuuj trening / Porzuć", pływający mini-pasek (Zakończ / Kontynuuj / pauza / kosz) i przycisk „Raport"; mini-pasek zasłania „Narzędzia" i nawigację. |
| NEW-4 | Średnie | **Dostępność formularza raportu**: pola pomiarów mają nazwę dostępną „—" (placeholder zamiast etykiety powiązanej), skale samopoczucia to 10 pustych okręgów bez opisu końców. |
| NEW-5 | Niskie | Pulpit i Trening liczą cardio inaczej **tylko w stanie bez planu**: przed utworzeniem planu Trening pokazywał „0 min · 1 sesja" przy 20 min na Pulpicie; po utworzeniu planu to samo 20 min. Doprecyzowanie UX-1 — rozbieżność dotyczy gałęzi „brak planu", przyczyny w kodzie nie zbadano. |
| NEW-6 | Niskie | `/start-workout` zawsze przekierowuje na `/workout-plan` (osobny punkt wejścia jest martwy lub zbędny). |
| NEW-7 | Niskie | Wyróżniający się w dev wskaźnik „Issues" (4) po jednym treningu — do wyczyszczenia przed przeglądami wizualnymi (konsola: błędy 403 z NEW-1, ostrzeżenia Recharts). |

Nadal **niezweryfikowane** (brak narzędzi lub dostępu w tym środowisku):
- **Produkcja** (Render/VPS, Turso, Upstash, Sentry, PostHog) — brak dostępu.
- **Prawdziwa płatność HotPay** — brak konta i kluczy; sprawdzono tylko logikę po naszej stronie na wartościach testowych.
- **Android i iOS** — brak emulatora/urządzenia i Xcode.
- **Java** — brak JDK/Maven w środowisku, nie uruchomiono; potwierdzono tylko statycznie w `UserContextFilter.java`, że przy pustym `GYMBRAT_PROXY_TOKEN` token nie jest sprawdzany, a użytkownik jest brany z nagłówka (zgodne z SEC „Java fail-closed").
- **Testy E2E Playwright** — wykonane w trzeciej rundzie (sekcja 14a), ale zestaw **nie przechodzi**, a przyczyn części porażek nie ustaliłem do końca.
- Pozostałe ekrany admina (konfiguracja, błędy, katalog, ćwiczenia, branding), pozostałe kroki raportu, import planów z pliku, grupa/społeczność z drugim kontem.

## 14a. Testy E2E Playwright (trzecia runda, za zgodą użytkownika na pobranie Chromium)

Środowisko: `npx playwright install chromium`, dev `localhost:3000`, konto `mock.friend@gymbrat.test` (zawodnik bez planu), `workers=1`, 41 testów w 3 plikach (`active-workout`, `diet-admin-session`, `smoke`).

| Przebieg | Wynik |
|---|---|
| 1. Specyfikacje w stanie z repo | **6 zaliczonych, 35 nieudanych.** Pierwsza przyczyna: selektor `getByLabel("Email")`, a formularz ma etykietę „E-mail" (test nie logował się wcale). |
| 2. Po poprawce selektorów (3 pliki), przycisku „Zaloguj się jako zawodnik" (formularz go już nie ma — 3 miejsca) i czyszczenia sesji (`DELETE /api/active-workout-session` wymaga teraz body `{revision}`, spec wysyłał puste) | **9 zaliczonych, 32 nieudanych.** |

Diagnoza po drugim przebiegu:
- **Dryf specyfikacji względem aplikacji (potwierdzony, trzy przypadki):** etykieta pola e-mail, przyciski wyboru roli przy logowaniu, kontrakt DELETE sesji treningu. To sugeruje, że **E2E nie są utrzymywane** (w `.github/workflows` nie ma joba E2E: są tylko android-apk, deploy-guardian, deploy-vps, dependency-security, reminders-cron i android-signing-bootstrap) (E8-7).
- **Prawdopodobnie ograniczanie logowania/limitów przy logowaniu w każdym teście** (16 testów pada na `waitForURL("/")` lub czyszczeniu sesji, a serwer odpowiada na `POST /api/auth/callback/credentials` w ~8 ms z kodem 200, co wygląda na odrzucenie przed sprawdzeniem hasła). To **hipoteza** — nie potwierdziłem odpowiedzi serwera ani nie widziałem 429 w logach. Jeśli się potwierdzi, specyfikacje powinny logować się raz (`storageState`) zamiast w każdym teście.
- **Realne rozbieżności asercji (4 testy, jeden raz widziane):** oczekiwano sugestii „67,5 kg × 8", aplikacja daje „× 6" (zmiana silnika sugestii, test lub kod nieaktualny); brak pola `#set-reps` w jednym stanie; brak linku „GymBrat" w nagłówku jednego ekranu. Do zbadania przez właściciela funkcji — nie rozstrzygnąłem, czy błąd jest w teście, czy w aplikacji.
- 5 testów „bez logowania" (Dieta/admin wymagają logowania, itd.) przechodzi.

Zmiany w repo wykonane przy okazji (do przeglądu w diffie): `e2e/smoke.spec.ts`, `e2e/diet-admin-session.spec.ts`, `e2e/active-workout.spec.ts` — selektory, body DELETE i komunikat asercji ze statusem odpowiedzi. Zestaw nadal czerwony.

## 15. Załączniki robocze

- Skrypt danych mock: `scripts/seed-local-mock.cjs` (tylko `file:` DB; hasło testowe z `MOCK_PASSWORD` lub domyślne developerskie). Konta: `mock.user@`, `mock.friend@`, `mock.admin@gymbrat.test`.
- Lokalny `.env.local` (ignorowany przez git) utworzony do uruchomienia dev: baza `file:./local.db`, wygenerowany `AUTH_SECRET`.
- Test logiki webhooka był tymczasowym plikiem vitest (usunięty); zamówienie testowe i pakiet konta mock zostały wycofane z lokalnej bazy. Konto `mock.user` ma lokalnie rolę admin (tylko `local.db`).
- Surowe wyniki przejścia 55 tras: wszystkie 200, brak błędów serwera w logach dev (`preview_logs level=error`: pusto).
