# Backlog komercjalizacji GymBrat — 2026-11-01

Źródło: [audyt przedkomercyjny](2026-11-01-audyt-przedkomercyjny.md) (identyfikatory PAY/SEC/ARCH/PERF/UX/BIZ odnoszą się do niego). Poprzedni backlog `docs/zespol/backlog.md` (23.10) jest włączony tam, gdzie pozycje są nadal otwarte; zrobione pozycje pominięto.

> **Numeracja robocza: `US1–US20` w [backlog-us.md](backlog-us.md)** (polecenie „zrealizuj usN", statusy); podzadania `Z1–Z83` w [szczegoly-zadan.md](szczegoly-zadan.md). Ten plik zostaje jako opis epików ze starymi identyfikatorami (E1-2 itd.), które są w nagłówkach sekcji `## Zn`.

Legenda: **Prio** P0 = blokuje komercjalizację, P1 = przed startem sprzedaży, P2 = krótko po starcie, P3 = porządki. **Rozm.** S ≤ 1 dzień, M 2–3 dni, L 4–6 dni (orientacyjnie, jeden deweloper). Przepływ zmian zgodnie z `AGENTS.md`: PR/Preview → zatwierdzenie → Promote; na PR wpis changelogu z `planned: true`.

## Przegląd

| Epik | Cel | Prio |
|---|---|---|
| E0 | Decyzje właściciela (bez kodu) | P0 |
| E1 | Płatności działają i są rozliczalne | P0 |
| E2 | Produkt wart zapłaty (Free/Premium) | P0 |
| E3 | Zgodność prawna i prywatność | P0 |
| E4 | Bezpieczeństwo | P1 |
| E5 | Spójność logiczna danych i UX | P1 |
| E6 | Spójność wizualna | P2 |
| E7 | Wydajność i architektura | P2 |
| E8 | Jakość, testy, CI | P1 |
| E9 | Operacje i wejście na rynek | P1 |
| E10 | Braki produktowe / biznesowe | P2 |

Kolejność realizacji: E0 równolegle ze wszystkim → E1 → E3 + E4 → E2 + E5 → E8 → E9 → E6/E7/E10.

---

## E0 — Decyzje właściciela (bez kodu)

**E0-1 Podmiot sprzedający** (P0, S) — *Jako właściciel chcę zdecydować o formie prowadzenia sprzedaży, aby móc legalnie przyjmować płatności.*
AC: zapisana decyzja w `docs/zespol/decyzje-wlasciciela.md` (działalność / dane sprzedawcy do `lib/legal-seller`); NIP i adres do regulaminu; wybrany sposób rozliczania VAT.

**E0-2 Model Free/Premium** (P0, S) — *Jako właściciel chcę określić, co jest darmowe, a co płatne, aby klient wiedział za co płaci.*
AC: lista funkcji Premium, cennik (7/30/90/365 lub zmiana), czy odnowienia automatyczne, czy okres próbny; zapis w decyzjach.

**E0-3 Reklamy** (P0, S) — *Jako właściciel chcę zdecydować czy używamy AdMob, aby oferta „bez reklam" miała sens.*
AC: decyzja: konfigurujemy AdMob (D24) albo usuwamy „bez reklam" z oferty (patrz E2-1).

**E0-4 Kanały i Java** (P1, S) — *Jako właściciel chcę zdecydować o backendzie Java i iframe AWP, aby zmniejszyć powierzchnię utrzymania i ataku.*
AC: Java: usuwamy z repo i deployu albo wymagamy tokenu (E4-3); AWP: zostaje/znika (E4-5); repo prywatne (E4-6).

**E0-5 Płatności w Google Play** (P1, S) — *Jako właściciel chcę wybrać strategię płatności dla Androida, aby publikacja w Play nie została zablokowana.*
AC: opcja A — Android bez zakupów w aplikacji (zakup tylko na stronie, zgodnie z polityką Play dla swojego rynku), B — Play Billing; decyzja udokumentowana.

---

## E1 — Płatności działają i są rozliczalne

**E1-1 Naprawa webhooka HotPay** (P0, S, PAY-1) — *Jako klient chcę, aby po zapłaceniu pakiet aktywował się automatycznie, aby nie tracić pieniędzy.*
AC: `POST /api/payments/hotpay/notify` omija sprawdzanie sesji w `proxy.ts` (wyjątek jak dla `/api/cron/`); anonimowy POST z poprawnym hashem zwraca 200 `OK`, z błędnym 403; test jednostkowy/integracyjny; test „wszystkie trasy `app/api/**` są albo chronione sesją, albo na jawnej liście wyjątków" (E8-2).

**E1-2 Weryfikacja kwoty i atomowe księgowanie** (P0, M, PAY-2, PAY-3) — *Jako właściciel chcę, aby pakiet był przyznawany tylko za pełną, zgodną kwotę i dokładnie raz.*
AC: `KWOTA` z powiadomienia musi równać się `amount_grosze` zamówienia, inaczej zamówienie `amount_mismatch` + alert i brak pakietu; zmiana statusu i przedłużenie pakietu w jednej transakcji (`db.batch`) albo kolumna `fulfilled_at` z ponawianiem; testy: powtórzone powiadomienie, kolejność FAILURE→SUCCESS, awaria w połowie, równoległe powiadomienia.

**E1-3 Zapis zgód konsumenckich przy zakupie** (P0, M, PAY-4) — *Jako sprzedawca chcę mieć dowód zgody na natychmiastowe świadczenie i utratę prawa odstąpienia, aby wygrać ewentualny spór.*
AC: `POST /api/package/checkout` wymaga `termsAccepted: true` i `immediateServiceConsent: true`; zapis w zamówieniu: znaczniki czasu, wersja regulaminu, hash tekstu zgody; checkout bez zgody → 400; test.

**E1-4 Anonimizacja zamówień zamiast kaskady** (P0, M, PAY-5) — *Jako sprzedawca chcę zachować dokumentację sprzedaży po usunięciu konta, aby spełnić obowiązki księgowe.*
AC: `subscription_orders.user_id` nullable / `ON DELETE SET NULL` + pola minimalne do rozliczeń (kwota, data, status, identyfikator płatności); usunięcie konta nie kasuje zamówień; polityka retencji 5 lat opisana; migracja i test.

**E1-5 Potwierdzenie zakupu i historia zamówień** (P1, M, PAY-6, PAY-7) — *Jako klient chcę widzieć swoje zamówienia i dostać e-mail z potwierdzeniem, aby mieć dowód zakupu.*
AC: sekcja „Moje zamówienia" w Profilu (status, kwota, plan, data); e-mail transakcyjny po `paid` (wymaga SMTP, E9-1); ekran po powrocie z bramki pokazuje faktyczny status (pending/paid/failed), sprawdzany po `order` w URL, z odświeżaniem.

**E1-6 Faktury/paragony** (P1, L, PAY-6) — *Jako klient chcę otrzymać dokument sprzedaży, aby go rozliczyć.*
AC: zależnie od E0-1: generowanie dokumentu/PDF lub integracja z systemem fakturowym; dane nabywcy opcjonalne (NIP); numeracja; dostęp w „Moje zamówienia".

**E1-7 Porządkowanie zamówień i obsługa zwrotów** (P1, M, PAY-7, PAY-8) — *Jako administrator chcę widzieć i obsługiwać zaległe zamówienia i zwroty, aby żadna płatność nie została bez opieki.*
AC: cron oznacza `pending` starsze niż 24 h jako `expired`; panel admina: lista zamówień z filtrem statusu, ręczne zaksięgowanie/anulowanie, notatka o zwrocie; alert (log + panel) dla „zapłacone za zamówienie anulowane"; idempotencja checkoutu (ponowne kliknięcie używa istniejącego `pending` dla planu w ostatnich 15 min); własny klucz limitu `RATE.checkout`.

**E1-8 Testy płatności** (P0, M, PAY-9) — *Jako zespół chcemy automatycznych testów płatności, aby regresje nie przeszły niezauważone.*
AC: testy hash/verify (`lib/hotpay.ts`), trasy `notify` (scenariusze z E1-2), checkoutu (autoryzacja, CSRF, nieaktywny plan, brak konfiguracji); E2E w trybie testowym HotPay lub z symulatorem webhooka.

**E1-9 Alerty płatności** (P1, S, ARCH-7) — *Jako właściciel chcę dostać alert, gdy płatność jest zaksięgowana bez pakietu lub zamówienie wisi zbyt długo.*
AC: zdarzenia do Sentry/logów z tagiem `payments`; widżet w panelu admina (`pending` > 1 h, `paid` bez `fulfilled_at`).

---

## E2 — Produkt wart zapłaty

**E2-1 Realna wartość pakietu** (P0, L, BIZ-1, BIZ-3) — *Jako klient chcę, aby pakiet dawał coś konkretnego, aby miało sens za niego płacić.*
AC: zgodnie z E0-2/E0-3: albo AdMob skonfigurowany i reklamy faktycznie znikają po aktywacji pakietu (test), albo zdefiniowane funkcje Premium chronione `getUserPackageStatus` po stronie serwera (nie tylko ukryte w UI); strona `/package` wymienia dokładnie to, co jest odblokowane; brak sprzedaży przed spełnieniem warunku.

**E2-2 Gating po stronie serwera** (P0, M, BIZ-3) — *Jako właściciel chcę, aby funkcje Premium nie dały się obejść zmianą UI.*
AC: pojedyncza funkcja `requirePremium()` w `lib/user-package.ts`, użyta w akcjach i trasach Premium; test: użytkownik bez pakietu dostaje 402/403; stan wygasłego pakietu obsłużony (grace period opisany).

**E2-3 Przypomnienia o końcu pakietu i odnowienie** (P1, M, PAY-7) — *Jako klient chcę dostać przypomnienie przed końcem pakietu i jednym kliknięciem go przedłużyć.*
AC: banner przy ≤ 7 dniach; e-mail/push opcjonalnie; „Przedłuż" wybiera ten sam plan; przedłużanie liczy od końca bieżącego pakietu (już zaimplementowane w `extendUserPackage`).

**E2-4 Kody promocyjne i Badania — definicja albo usunięcie** (P2, S, BIZ, UX-8) — *Jako właściciel chcę, aby w produkcie nie było ekranów bez zdefiniowanego produktu.*
AC: decyzja D11; ekran albo wdrożony (kody rabatowe w checkoucie z walidacją po stronie serwera) albo ukryty/usunięty.

**E2-5 Cennik i eksperymenty** (P2, S, BIZ-2) — *Jako właściciel chcę móc zmieniać ceny bez wdrożenia.*
AC: ceny w panelu (`/admin/packages`, już istnieje) — zweryfikować, że zmiana ceny nie psuje trwających zamówień (E1-2 chroni kwotę); testy.

---

## E3 — Zgodność prawna i prywatność

**E3-1 Rejestr zgód i zgoda na dane zdrowotne** (P0, L) — *Jako użytkownik chcę świadomie wyrazić i móc cofnąć zgodę na przetwarzanie danych o ciele i zdjęć, aby kontrolować swoje dane.*
AC: tabela `user_consents` (typ, wersja, czas, źródło); ekran zgód przy rejestracji i dla obecnych użytkowników; osobne zgody: zdrowie/ciało, zdjęcia, społeczność, analityka, reklamy, push; cofnięcie w Profilu; brak zapisu danych objętych zgodą bez niej; testy.

**E3-2 Analityka i monitoring po zgodzie** (P0, M) — *Jako użytkownik chcę, aby PostHog i Sentry klienta działały tylko po mojej zgodzie.*
AC: inicjalizacja warunkowa na zgodzie z `user_consents`/cookies; brak zdarzeń przed zgodą (test sieciowy); baner „Tylko niezbędne" nie ładuje skryptów.

**E3-3 Minimalny wiek 16 lat** (P0, M) — *Jako właściciel chcę, aby konta zakładały tylko osoby 16+, zgodnie z decyzją D18.*
AC: walidacja przy rejestracji (e-mail, OAuth, uzupełnianie profilu) i `isUserBodyProfileComplete`; oświadczenie zapisane w rejestrze zgód; obsługa istniejących kont < 16; pakiety od 18 (D18); testy.

**E3-4 Usuwanie konta z ponownym uwierzytelnieniem** (P0, M, PAY-5) — *Jako użytkownik chcę bezpiecznie usunąć konto i dane, aby zrealizować prawo do usunięcia.*
AC: wymaga hasła/kodu e-mail lub świeżego logowania OAuth; usuwa dane zdrowotne, zdjęcia, push, sesje; PostHog/Sentry (jeśli możliwe); zamówienia anonimizowane (E1-4); potwierdzenie e-mailem; test kaskady.

**E3-5 Publiczna strona `/usun-konto`** (P1, S) — *Jako użytkownik Google Play chcę znaleźć instrukcję usunięcia konta bez logowania.*
AC: publiczna trasa (dodana do `ANONYMOUS_PUBLIC_PATHS`), opis procesu i kontakt; link w polityce i w Play Console.

**E3-6 Eksport danych** (P1, S) — *Jako użytkownik chcę pobrać wszystkie swoje dane, aby skorzystać z prawa do przenoszenia.*
AC: istniejący `/api/user/export` obejmuje zdjęcia (lub linki), zamówienia, zgody, przypomnienia; test kompletności względem listy tabel z `user_id`; nie usuwać funkcji (decyzja D8 dotyczy tylko przypomnień PWA).

**E3-7 Pollinations bez danych osobowych** (P1, S) — *Jako użytkownik chcę, aby moje dane nie trafiały do zewnętrznego generatora obrazów.*
AC: prompty bez wag, imion i nazw własnych ćwiczeń użytkownika (m.in. `lib/pr-achievement-image.ts`); oznaczenie grafik AI; test regresji.

**E3-8 Retencja i automatyczne usuwanie** (P1, M) — *Jako właściciel chcę, aby stare dane były usuwane automatycznie zgodnie z polityką.*
AC: okresy zatwierdzone przez prawnika (`docs/prawo/01-…`); crony czyszczące (`/api/cron/cleanup`) obejmują `active_workout_sessions`, kody, logi, nieaktywne konta; testy `db-retention`.

**E3-9 Dokumenty prawne i przetwarzający** (P0, M) — *Jako właściciel chcę komplet dokumentów zatwierdzonych przez prawnika, aby sprzedawać bez ryzyka.*
AC: regulamin (usługi cyfrowe, odstąpienie, reklamacje, dane sprzedawcy), polityka prywatności (tętno/kroki, transfery poza EOG, Pollinations), rejestr czynności, umowy powierzenia (Turso, Sentry, PostHog, Upstash, hosting, SMTP), DPIA dla danych zdrowotnych; wersjonowanie tekstów powiązane z E1-3/E3-1.

---

## E4 — Bezpieczeństwo

**E4-1 CSP w trybie egzekwowania** (P1, M, SEC-1, SEC-2) — *Jako użytkownik chcę, aby przeglądarka blokowała wstrzyknięte skrypty.*
AC: analiza raportów `/api/security/csp-report`; polityka z `script-src` (nonce), `connect-src` uwzględnia PostHog/Sentry/Pollinations; przełączenie na `Content-Security-Policy`; smoke test głównych ekranów bez naruszeń.

**E4-2 Rate limiting produkcyjny** (P1, S, SEC-3) — *Jako właściciel chcę, aby limity działały niezależnie od instancji i nagłówków.*
AC: Upstash wymagany na produkcji (widoczny w `admin-config-status`); adres IP z zaufanego nagłówka platformy (konfigurowalny); test spoofingu `x-forwarded-for`.

**E4-3 Java: fail-closed** (P1, S) — *Jako właściciel chcę, aby backend Java nie ufał nagłówkom bez tajnego tokenu.*
AC: brak `GYMBRAT_PROXY_TOKEN` → start odmawia; `docker-compose` bez publicznego portu 8080; **lub** usunięcie Javy zgodnie z E0-4.

**E4-4 Konto administratora: 2FA i blokada** (P1, M, SEC-5) — *Jako właściciel chcę zabezpieczyć panel admina drugim składnikiem.*
AC: TOTP lub e-mail/WebAuthn dla `appRole=admin`; blokada po serii błędnych logowań; powiadomienie o logowaniu admina; usunięcie martwego kodu PIN (D15: `/api/admin/lock|unlock`, `ADMIN_PIN`).

**E4-5 Osadzanie w iframe (AWP)** (P2, S, SEC-4) — *Jako właściciel chcę ograniczyć powierzchnię osadzania do faktycznie potrzebnych źródeł.*
AC: zgodnie z E0-4; jeśli zostaje — jawna lista originów; jeśli nie — `frame-ancestors 'none'`.

**E4-6 Repozytorium prywatne i higiena** (P1, S, SEC-6) — *Jako właściciel chcę, aby kod płatności i modele zagrożeń nie były publiczną mapą ataku.*
AC: repo prywatne (D6); usunięty katalog `undefined/`, artefakty z drzewa; `.gitignore` uzupełniony; skan sekretów w historii (rotacja jeśli trzeba).

**E4-7 Test uprawnień tras admina i trasy publiczne** (P1, S, SEC-7) — *Jako zespół chcemy test, który pilnuje, że żadna trasa admina nie jest dostępna dla zwykłego użytkownika.*
AC: test enumeruje `app/api/admin/**` i `app/admin/**`; 401 (anonim), 403 (zwykły użytkownik).

**E4-8 Zależności i sekrety** (P2, S) — *Jako właściciel chcę regularnie skanować zależności i rotować sekrety.*
AC: workflow `dependency-security.yml` działa i blokuje High/Critical; procedura rotacji `AUTH_SECRET`, `HOTPAY_*`, `CRON_SECRET` w `docs/`.

---

## E5 — Spójność logiczna danych i UX

**E5-1 Jedna definicja tygodnia i minut cardio** (P1, M, UX-1) — *Jako użytkownik chcę widzieć te same minuty cardio na Pulpicie i w Treningu, aby ufać liczbom.*
AC: jedna funkcja domenowa (tydzień pon–niedz, strefa użytkownika, wszystkie źródła cardio) używana przez Pulpit, hub Treningu, silnik dodatkowego cardio i Javę/tej samej zmiany; test kontraktowy z danymi mock (20 min w tygodniu → wszędzie 20); naprawa rozbieżności z `bledy.md`.

**E5-2 Onboarding świadomy historii** (P2, M, UX-2) — *Jako użytkownik z historią treningów chcę dostać propozycję planu na podstawie moich treningów zamiast komunikatu „dodaj pierwszy".*
AC: gdy brak planu, a są treningi → CTA „Utwórz plan z ostatnich treningów"; karta „Skonfiguruj pierwszy tydzień" ukrywa się po wykonaniu treningów; „0 raportów" tylko dla nowych kont; test stanów Pulpitu.

**E5-3 Kontekstowy główny przycisk akcji** (P2, S, UX-3) — *Jako użytkownik chcę, aby pływający przycisk odpowiadał ekranowi, na którym jestem.*
AC: FAB zależny od sekcji (Trening → „Start", Dieta → „Dodaj posiłek", Analiza → „Raport"); margines pod FAB, żeby nie zasłaniał treści (padding dolny); test wizualny 375 px.

**E5-4 Tytuły stron i nazewnictwo** (P2, S, UX-4, UX-7) — *Jako użytkownik chcę rozpoznawać karty przeglądarki i spójnie nazwane sekcje.*
AC: `generateMetadata` z tytułem „Nazwa · GymBrat" dla wszystkich tras dashboardu; ujednolicone nazwy (Dieta ↔ Bilans); lista nazw w dokumencie systemu projektowego.

**E5-5 Stany ładowania i puste** (P2, S, UX-5, PERF-3) — *Jako użytkownik chcę widzieć, że dane się ładują, i nie widzieć pustych/rozjechanych wykresów.*
AC: ekran Analiza ma szkielety z opisem postępu i obsługą błędu; kontenery Recharts z wymiarem min.; brak ostrzeżeń „width(-1)" w konsoli.

**E5-6 Usunięcie ekranów bez produktu** (P3, S, UX-8, ARCH-6) — *Jako użytkownik nie chcę widzieć zaślepek.*
AC: usunięcie `inbox` i roli `trener` (D7), `labs`/`promo-codes` zgodnie z E2-4; migracja danych roli; testy.

**E5-7 Komunikaty rejestracji bez SMTP** (P1, S) — *Jako nowy użytkownik chcę wiedzieć, że rejestracja e-mailem jest niedostępna i że mogę użyć Google.*
AC: ekran `/register` informuje o dostępnych metodach zależnie od `getRegistrationAvailability`; po wdrożeniu SMTP (E9-1) przepływ kodem e-mail przetestowany E2E.

**E5-8 Obecność w treningu tylko przy udostępnianiu** (P1, S, NEW-1) — *Jako użytkownik nie chcę, aby trening generował błędy w tle.*
AC: klient nie wywołuje `/api/community/friends/live/presence`, gdy użytkownik nie ma aktywnego udostępniania (albo serwer zwraca 204 zamiast 403); 0 błędów 403 w konsoli podczas treningu solo; test.

**E5-9 Seria bez obciążenia** (P2, S, NEW-2) — *Jako użytkownik chcę jasności, czy seria 0 kg jest świadoma.*
AC: przy ćwiczeniu z obciążeniem zapis 0 kg wymaga potwierdzenia/oznaczenia „masa ciała"; tonaż i porównania zgodne z wyborem.

**E5-10 Jedno sterowanie niedokończonym treningiem** (P2, S, NEW-3) — *Jako użytkownik chcę jednego, czytelnego miejsca do wznowienia lub zakończenia treningu.*
AC: ekran Trening i mini-pasek nie dublują akcji; mini-pasek nie zasłania narzędzi ani nawigacji; test 375×667.

**E5-11 Dostępny formularz raportu** (P2, M, NEW-4) — *Jako użytkownik czytnika ekranu chcę etykiet pól i opisanych skal.*
AC: każde pole z `label`/`aria-label` i jednostką; skale 1–10 z opisem końców i `role=radiogroup`; axe bez błędów krytycznych; rozważyć niewymagane pomiary poza wagą.

**E5-12 Spójne cardio także bez planu** (P1, S, NEW-5) — *Jako użytkownik bez planu chcę widzieć te same minuty cardio co na Pulpicie.*
AC: test kontraktowy E8-4 obejmuje stan „brak planu"; usunięty martwy `/start-workout` lub przekierowanie z uzasadnieniem (NEW-6).

---

## E6 — Spójność wizualna

**E6-1 Jeden wzorzec nagłówka ekranu** (P2, M) — *Jako użytkownik chcę, aby nawigacja wstecz i nagłówek zachowywały się tak samo na każdym ekranie.*
AC: reguła: ekrany głównych sekcji — logo + menu, podekrany — strzałka wstecz + tytuł; komponent `ScreenHeader`; migracja wszystkich ekranów z listy z audytu; zrzuty przed/po.

**E6-2 Tokeny kolorów** (P2, M, backlog #18) — *Jako deweloper chcę używać tokenów zamiast literałów złota, aby zmiana motywu była jednym ruchem.*
AC: lint/test zakazujący literałów koloru marki poza `globals.css`; zamiana istniejących; kontrast tekstu pomocniczego ≥ 4,5:1 (WCAG AA) zweryfikowany narzędziem.

**E6-3 Jeden komponent kafla statystyki** (P2, S) — *Jako deweloper chcę jednego komponentu kafla, aby karty wyglądały spójnie.*
AC: `components/ui/stat-tile`; zastąpione 3 warianty (Pulpit, Bilans, Społeczność).

**E6-4 Strefa bezpieczna nawigacji** (P2, S) — *Jako użytkownik telefonu chcę, aby dolna nawigacja i przycisk pływający nie zasłaniały treści ani siebie.*
AC: `padding-bottom` zależny od wysokości nav + FAB + `env(safe-area-inset-bottom)`; test w 375×667 i 412×915.

**E6-5 Przegląd pozostałych ekranów** (P2, M) — *Jako zespół chcemy dokończyć przegląd wizualny, którego nie objęto w audycie.*
AC: zrzuty mobile i desktop: aktywny trening, raport ciała, plany (edytor/atlas/import), profil (wszystkie podstrony), społeczność (zespoły, wojny, wyzwania), admin; lista defektów do E6-1…E6-4.

**E6-6 Martwe komponenty** (P3, S, backlog #19) — AC: usunięte po potwierdzeniu `knip`/ręcznie.

---

## E7 — Wydajność i architektura

**E7-1 Zdjęcia poza bazą** (P1, L, ARCH-2, PERF-2) — *Jako właściciel chcę przechowywać zdjęcia w magazynie obiektowym, aby obniżyć koszt i obciążenie bazy.*
AC: nowy magazyn (S3/R2/Vercel Blob), upload przez podpisany URL, miniatury; migracja istniejących `data_url` skryptem; trasy `/api/media/*` serwują z autoryzacją; limity rozmiaru/typu; plan wycofania `data_url`.

**E7-2 Jedno źródło schematu** (P1, L, ARCH-1) — *Jako deweloper chcę jednej ścieżki zmian schematu, aby uniknąć rozjazdów.*
AC: migracje Drizzle są jedynym źródłem; `ensure-schema.ts` sprowadzony do kontroli zgodności wersji; `ensureCriticalSchema()` usunięte z gorących ścieżek zapytań; test zgodności `schema.ts` ↔ migracje (skill `gymbrat-db-migration`).

**E7-3 Redukcja payloadu RSC** (P2, M, PERF-1) — *Jako użytkownik na słabym łączu chcę szybkich ekranów Dieta/Tydzień i Atlas planów.*
AC: `/nutrition/week` i `/plany/atlas` < 90 kB HTML SSR (z 209/148 kB); dane do klienta tylko niezbędne pola, paginacja listy; pomiar przed/po w PR.

**E7-4 Pomiar wydajności na buildzie** (P1, S, PERF-6) — *Jako zespół chcemy znać realne LCP/INP/TTFB przed startem.*
AC: Lighthouse/WebPageTest na buildzie produkcyjnym dla 10 kluczowych ekranów; budżety w dokumencie i krok w CI dla trzech ekranów.

**E7-5 Mniej zapisów synchronizacji treningu** (P2, M, PERF-4) — *Jako właściciel chcę zmniejszyć liczbę i rozmiar zapisów aktywnego treningu.*
AC: wykrywanie zmian przed PUT, odchudzony payload (cel −50%), backoff bez ominięcia; metryki zapisów w panelu monitoringu.

**E7-6 Optymalizacja pollingu społeczności** (P3, M, PERF-5) — AC: SSE zamiast pollingu tam, gdzie możliwe; cache krótkoterminowy dla list; mniej zapytań na ekran (pomiar).

**E7-7 CAS w modułach społeczności** (P2, M, ARCH-5) — *Jako użytkownik chcę poprawnych punktów XP i wyników wojen mimo równoległych zapisów.*
AC: warunkowe aktualizacje/transakcje w `team-wars.ts`, `team-quests.ts`, `hof.ts`, `progression.ts`, `teams.ts`; testy współbieżności.

**E7-8 Rozbicie dużych modułów** (P3, L, ARCH-4) — AC: `progress-hub.ts`, `teams.ts`, `body-report-form.tsx`, `home-start.ts` podzielone na moduły < 500 linii z zachowaniem testów; `changelog-data.ts` jako dane JSON.

**E7-9 Decyzja o Javie** (P2, M, ARCH-3) — AC: realizacja E0-4: usunięcie lub pełna implementacja z trwałością; aktualizacja `docs/adr`.

---

## E8 — Jakość, testy, CI

**E8-1 Lint zielony** (P1, L) — *Jako zespół chcemy zielonego lintera jako bramki.*
AC: 0 błędów (z 102), ostrzeżenia ≤ ustalony próg; etapami po obszarach; `npm run lint` w CI i w `deploy:check`.

**E8-2 Test „trasy vs proxy"** (P0, S) — *Jako zespół chcemy, aby test wykrywał trasy API bez ochrony.*
AC: test wylicza `app/api/**/route.ts` i porównuje z jawną listą publicznych w `proxy.ts`/`auth-public-paths`; nowa publiczna trasa wymaga dopisku do listy.

**E8-3 E2E krytycznych ścieżek** (P1, L) — *Jako zespół chcemy E2E rejestracji, logowania, treningu, płatności (sandbox) i usunięcia konta.*
AC: Playwright uruchamiany w CI na bazie `file:` z seedem (`scripts/seed-local-mock.cjs` jako punkt wyjścia); stabilne dane testowe; raport w CI.

**E8-7 Naprawa i utrzymanie specyfikacji E2E** (P1, M, sekcja 14a) — *Jako zespół chcemy działających testów E2E w CI, aby chroniły krytyczne ścieżki.*
AC: 41 testów zielonych na lokalnej bazie z seedem; logowanie raz przez `storageState` (bez limitów logowania per test); rozstrzygnięte 4 rozbieżności asercji (sugestia „× 8" vs „× 6", `#set-reps`, link „GymBrat"); job CI uruchamia E2E przy PR; selektory oparte na rolach i stabilnych `data-testid`.

**E8-4 Testy kontraktowe liczb** (P1, M, UX-1) — *Jako zespół chcemy test pilnujący, że te same dane dają te same liczby na różnych ekranach.*
AC: zestaw danych mock → oczekiwane wartości (cardio tydzień, tonaż, serie, kcal) sprawdzane przez funkcje używane na Pulpicie, Treningu, Analizie.

**E8-5 Dostępność (WCAG AA)** (P2, M) — AC: audyt axe dla 10 ekranów; naprawa krytycznych (kontrast, etykiety, fokus, obsługa klawiatury); wyniki w dokumencie.

**E8-6 `deploy:check` rozszerzony** (P1, S) — AC: sprawdza obecność zmiennych płatności (`HOTPAY_*`), SMTP, Upstash, `CRON_SECRET`, `ADMIN_EMAILS`; blokuje promote przy braku.

---

## E9 — Operacje i wejście na rynek

**E9-1 SMTP produkcyjny** (P0, S) — *Jako nowy użytkownik chcę zarejestrować się e-mailem, aby nie być zmuszonym do Google.*
AC: dedykowana skrzynka (D22), `SMTP_*` na hostingu, SPF/DKIM/DMARC; rejestracja kodem i reset hasła działają na produkcji; widoczne w `admin-config-status`.

**E9-2 Środowisko staging i Preview** (P1, M) — *Jako zespół chcemy testować płatności i migracje przed produkcją.*
AC: staging z osobną bazą i kluczami HotPay testowymi; procedura Preview → Promote z `AGENTS.md` przećwiczona na zmianie płatności.

**E9-3 Test przywracania backupu** (P1, S) — *Jako właściciel chcę wiedzieć, że backup da się przywrócić.*
AC: przywrócenie bazy Turso na stagingu wg `docs/disaster-recovery.md`; czas i kroki zapisane (RTO/RPO).

**E9-4 Monitoring i status** (P1, M, ARCH-7) — AC: Sentry z alertami (5xx, płatności, logowanie), uptime check `/api/version`, strona statusu lub kanał powiadomień; SLO dla logowania, zapisu treningu i płatności.

**E9-5 Wsparcie klienta** (P1, S) — *Jako klient chcę wiedzieć, jak się skontaktować i złożyć reklamację.*
AC: adres i formularz w Profilu i regulaminie; FAQ (płatności, zwroty, konto); SLA odpowiedzi 14 dni zgodne z §8.

**E9-6 Publikacja Android** (P1, L, BIZ-5) — AC: zgodnie z E0-5; formularz Data Safety, polityka i `/usun-konto` (E3-5), podpisane AAB, test na urządzeniach; iOS: instrukcja PWA lub App Store wg `docs/ios-app-store.md`.

**E9-7 Soft launch** (P1, M) — AC: zaproszeni testerzy (20–50), monitorowane KPI i błędy 2 tygodnie, lista poprawek, decyzja go/no-go z kryteriami z audytu (sekcja 13).

---

## E10 — Braki produktowe i biznesowe

**E10-1 KPI i lejek** (P1, M, BIZ-4) — *Jako właściciel chcę widzieć aktywację, retencję i konwersję, aby podejmować decyzje.*
AC: zdarzenia po zgodzie (E3-2): rejestracja, pierwszy trening, D7/D30, wejście na `/package`, start i koniec płatności; dashboard w PostHog; definicje w dokumencie.

**E10-2 Panel finansowy** (P2, M) — AC: w adminie: przychód dzienny/miesięczny, liczba aktywnych pakietów, konwersja, lista zamówień (współdzielone z E1-7).

**E10-3 Publiczna strona produktu** (P2, M) — *Jako potencjalny klient chcę zobaczyć, co robi aplikacja, zanim się zarejestruję.*
AC: publiczna strona główna/landing z opisem, cennikiem, zrzutami i linkami do regulaminu; metadane SEO i OG (część już w `app/opengraph-image.tsx`, `sitemap.ts`).

**E10-4 Powiadomienia e-mail/push o aktywności** (P3, M) — AC: przypomnienia treningowe (PWA push istnieje: `actions/reminders.ts`, cron) — decyzja czy zostają (D8) i zgoda (E3-1).

**E10-5 Mapa drogowa Premium** (P3, S) — AC: lista kandydatów (raporty PDF, zaawansowana analiza, import planów, ghost-training, historia bez limitu 400 sesji) z wartością i kosztem; wybór pierwszych 2.

**E10-6 Aktualizacja dokumentacji** (P3, S) — AC: `docs/zespol/wiedza-o-projekcie.md` i `backlog.md` wskazują na ten backlog; oznaczenie nieaktualnych `docs/*.json` (D13); wpisy „zrobione" w `bledy.md`.

---

## Sugerowana kolejność sprintów (2-tygodniowych)

| Sprint | Zakres |
|---|---|
| 0 (równolegle) | E0-1…E0-5, E9-1 |
| 1 | E1-1, E1-2, E1-3, E1-8, E8-2, E4-3 |
| 2 | E1-4, E3-4, E3-1, E3-2, E3-3 |
| 3 | E2-1, E2-2, E3-5…E3-9, E4-1, E4-2 |
| 4 | E1-5…E1-7, E1-9, E5-1, E8-4, E8-6, E9-2 |
| 5 | E4-4, E4-7, E8-1, E8-3, E7-4, E9-3, E9-4, E9-5 |
| 6 | E5-2…E5-7, E6-*, E7-1, E7-2, E9-6, E9-7 |

Po Sprincie 3 możliwy jest wewnętrzny test płatności w sandboxie; start sprzedaży dopiero po zielonych kryteriach z sekcji 13 audytu.
