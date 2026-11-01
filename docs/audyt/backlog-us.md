# Backlog US — komercjalizacja GymBrat (20 user stories)

**Jedyne źródło prawdy dla poleceń „zrealizuj us5".** Numeracja `US1…US20` jest stała. Każdy US to duży, spójny pakiet prac złożony z podzadań `Z` (szczegółowe opisy, kryteria akceptacji i wskazówki o plikach: [szczegoly-zadan.md](szczegoly-zadan.md), sekcje `## Zn`). Powstał z audytu z 2026-11-01: [audyt](2026-11-01-audyt-przedkomercyjny.md) (identyfikatory PAY/SEC/ARCH/PERF/UX/BIZ/NEW).

## Jak realizować „zrealizuj usN"

1. Przeczytaj sekcję `## USN` poniżej oraz sekcje `## Zn` z [szczegoly-zadan.md](szczegoly-zadan.md) **tylko dla podzadań tego US** (Ctrl+F `## Z5 `). Sprawdź **Zależności** — jeśli zależą od niezakończonego US, powiedz to użytkownikowi, zanim zaczniesz.
2. US jest duży: zrób **plan podzadań** (update_plan), realizuj po kolei, po każdym podzadaniu testy i osobny, mały commit/PR tylko jeśli użytkownik poprosi. Jeśli US nie mieści się w jednej sesji, dokończ możliwie najdalej, oznacz zrobione podzadania w polu **Postęp** i powiedz, co zostało.
3. **Prace poza kodem są na sam koniec** (sekcja „Zasada: prace poza kodem na sam koniec" niżej): pomijaj podzadania `[NA KONIEC]`; jeśli kod zależy od decyzji właściciela, **zapytaj o nią i poczekaj na akceptację** (nie przyjmuj założeń sam), a w międzyczasie rób to, co od niej nie zależy. Podzadanie typu **decyzja** = brak kodu: zadaj właścicielowi pytania (AskUserQuestion), zapisz odpowiedź w `docs/zespol/decyzje-wlasciciela.md`. Podzadanie **kod+prawnik** = kod gotowy, treści prawne wymagają zatwierdzenia przez człowieka — nie deklaruj ich jako zatwierdzone. Podzadania „konfig/ops" (np. ustawienia hostingu) wykonuje właściciel; przygotuj checklistę i weryfikację.
4. Pracuj jak agent `webdev` (zob. `CLAUDE.md`): zwięźle, minimum odczytów. Zasady repo: `AGENTS.md` (PR/Preview → Promote, changelog `planned: true`, `npm run deploy:check`, funkcje zależne od env w `lib/admin-config-status.ts`). Skille: `gymbrat-server-action`, `gymbrat-db-migration`, `gymbrat-sensitive-data`, `gymbrat-ui`, `gymbrat-ship`.
5. Przed zakończeniem: testy dla zmiany (`npx vitest run <plik>`), `npx tsc --noEmit`, lint zmienionych plików. Nie pogarszaj stanu bazowego (2026-11-01: testy 1237 zielone, tsc czysty, eslint 102 błędy, E2E 9/41).
6. Po zakończeniu uzupełnij **Postęp** US i statusy podzadań w tabeli w `szczegoly-zadan.md`; w tabeli poniżej zmień **Status** US na `ZROBIONE (data)` dopiero, gdy wszystkie jego podzadania są zrobione.
7. Realizuj **tylko** wskazany US; znaleziska poza zakresem zgłoś, nie naprawiaj po cichu.

Prio: P0 blokuje komercjalizację · P1 przed startem sprzedaży · P2 krótko po starcie · P3 porządki. Rozmiar: M ≈ 3–5 dni, L ≈ 1–2 tyg., XL ≈ 2+ tyg. (jeden deweloper, orientacyjnie).

## Indeks

| US | Tytuł | Prio | Rozm. | Podzadania (Z) | Status |
|---|---|---|---|---|---|
| US1 | Decyzje właściciela | P0 | M | Z1, Z2, Z3, Z18, Z19, Z82 | TODO |
| US2 | Naprawa płatności HotPay | P0 | L | Z4, Z5, Z8, Z16 | TODO |
| US3 | Zgody i prywatność użytkownika | P0 | XL | Z11, Z12, Z13, Z81 | TODO |
| US4 | Zamówienia: zgody, anonimizacja, historia, faktury | P0 | XL | Z6, Z7, Z20, Z21 | TODO |
| US5 | Premium: realna wartość pakietu | P0 | XL | Z9, Z10, Z24, Z54 | TODO |
| US6 | Prawa użytkownika (usunięcie, eksport, dane AI) | P0 | L | Z14, Z25, Z26, Z27 | TODO |
| US7 | Dokumenty prawne i retencja | P0 | L | Z15, Z28 | TODO |
| US8 | Operacje i uruchomienie | P0 | L | Z17, Z47, Z48, Z49, Z50 | TODO |
| US9 | Admin: zamówienia, alerty, finanse | P1 | L | Z22, Z23, Z55, Z75 | TODO |
| US10 | Bezpieczeństwo aplikacji | P1 | L | Z29, Z30, Z56, Z57 | TODO |
| US11 | Bezpieczeństwo admina, Java i repo | P1 | L | Z31, Z32, Z33, Z34, Z73 | TODO |
| US12 | Spójność liczb (cardio) | P1 | M | Z35, Z38, Z44 | TODO |
| US13 | Trening i raport ciała: poprawki UX | P1 | L | Z37, Z62, Z63, Z64 | TODO |
| US14 | Jakość: lint, E2E, bramki wdrożeniowe | P1 | XL | Z42, Z43, Z45, Z46 | TODO |
| US15 | Dane i architektura | P1 | XL | Z39, Z40, Z72 | TODO |
| US16 | Wydajność | P2 | L | Z41, Z70, Z71, Z79 | TODO |
| US17 | Spójność wizualna i dostępność | P2 | XL | Z59, Z60, Z61, Z65, Z66, Z67, Z68, Z69, Z74 | TODO |
| US18 | Onboarding, rejestracja i porządki produktu | P2 | L | Z36, Z58, Z77, Z78 | TODO |
| US19 | Android i soft launch | P1 | XL | Z51, Z52 | TODO |
| US20 | Analityka, strona produktu, refaktor, dokumentacja | P2 | XL | Z53, Z76, Z80, Z83 | TODO |

Weryfikacja pokrycia: 6+4+4+4+4+4+2+5+4+4+5+3+4+4+3+4+9+4+2+4 = 83 podzadania (każde Z1–Z83 występuje dokładnie raz).

## Zasada: prace poza kodem na sam koniec (decyzja właściciela)

Właściciel zrobi wszystko, co nie jest kodem, **na końcu**. Dlatego przy realizacji dowolnego US agent **pomija podzadania oznaczone `[NA KONIEC]`** (zostawia je jako niewykonane, wymienia w raporcie) i robi tylko część w repo. **Każda decyzja, od której zależy kod, wymaga akceptacji właściciela.** Gdy podzadanie zależy od decyzji, której jeszcze nie ma, agent **pyta właściciela** (AskUserQuestion: krótko, z rekomendowaną opcją jako pierwszą i skutkami) i dopiero po jego akceptacji implementuje to, co od niej zależy; zapisuje decyzję w `docs/zespol/decyzje-wlasciciela.md` i w polu **Decyzje** danego US. Do czasu odpowiedzi agent robi wszystko, co od decyzji **nie** zależy, i wskazuje, co czeka. Agent nie przyjmuje decyzji sam, także „tymczasowo". Kod zależny od decyzji ma być konfigurowalny (stała/flaga/env), żeby zmiana decyzji nie wymagała przebudowy.

Podzadania `[NA KONIEC]` (faza końcowa, robi właściciel; agent przygotowuje checklisty/projekty, ale nie zamyka ich sam):
- **US1 w całości** — Z1, Z2, Z3, Z18, Z19, Z82 oraz część „decyzja" z Z54 (decyzje właściciela). Propozycje do akceptacji (przed implementacją zależnego kodu agent MUSI zapytać właściciela): Z2/Z3 — pakiet = „bez reklam" wyłączony z oferty do czasu decyzji, checkout za flagą wyłączony (`/package` bez możliwości zakupu), cennik z bazy bez zmian; Z1 — dane sprzedawcy z `lib/legal-seller.ts` bez zmian, faktury (Z21) projektowane pod wersję „działalność gospodarcza"; Z18 — Java traktowana jako do usunięcia (kod z Z31 fail-closed, Z73 usunięcie), AWP bez zmian, repo prywatne dopiero na końcu; Z19 — Android bez zakupów w aplikacji.
- **Konfiguracja i operacje po stronie właściciela:** Z17 (SMTP, DNS SPF/DKIM/DMARC, zmienne na hostingu), Z47 (utworzenie stagingu i kluczy HotPay), Z48 (test przywracania backupu), Z49 (skonfigurowanie alertów w Sentry/uptime), Z33 (zmiana widoczności repo i rotacja sekretów), Z57 (rotacja sekretów — sama procedura/dokument jest w kodzie), Z51 (Google Play: konto, Data Safety, publikacja), Z52 (soft launch z testerami).
- **Zatwierdzenia prawne:** część Z15 i Z28 „zatwierdzenie przez prawnika" (projekty dokumentów i okresy retencji agent przygotowuje w repo wcześniej, jako szkice).

Agent może zrobić wcześniej i w repo: kod, testy, migracje, szkice dokumentów, checklisty i skrypty dla prac `[NA KONIEC]`.

## Kolejność i zależności między US

**Faza 1 — kod i dokumenty w repo:** `US2` (webhook; bloker płatności) → `US3` (zgody) → `US4`, `US5`, `US6` → `US7` (szkice dokumentów) → `US9`–`US15` wg priorytetu → `US16`–`US18`, `US20`; w `US8` tylko Z50 (wsparcie w aplikacji), w `US11` tylko część w repo (Z31, Z32, Z34, Z73), w `US10` Z29, Z30, Z56 i dokument rotacji z Z57.
**Faza 2 — na sam koniec, prace poza kodem:** `US1` (decyzje) → konfiguracja i ops z US8 (Z17, Z47, Z48, Z49) → Z33, rotacja sekretów (Z57) → zatwierdzenia prawne (Z15, Z28) → domknięcie decyzji z pól „Decyzje" → `US19` (Z51 publikacja, Z52 soft launch, decyzja go/no-go).

---

## US1 — Decyzje właściciela  **[NA KONIEC — cały US]**
**P0 · M · Zależności** brak · **Postęp** 0/6 · **Decyzje** brak zapisanych (patrz „Zasada: prace poza kodem na sam koniec"); poniższe są **propozycjami do akceptacji**, nie ustaleniami
**Cel** Zebrać wszystkie decyzje, które blokują kod i dokumenty: komu i jak sprzedajemy, co jest Premium, reklamy, Java/AWP/repo, płatności na Androidzie, kody promocyjne/Badania, mapa Premium.
**Podzadania** Z1 podmiot sprzedający · Z2 model Free/Premium i cennik · Z3 reklamy AdMob · Z18 Java, iframe AWP, repo prywatne · Z19 płatności na Androidzie · Z82 mapa drogowa Premium (+ decyzja części „definicja" z Z54).
**Gotowe, gdy** Wszystkie decyzje są zapisane w `docs/zespol/decyzje-wlasciciela.md`; US2–US5, US11, US19 mają jednoznaczne wejście. Zadaj pytania paczką (AskUserQuestion, max 4 naraz).

## US2 — Naprawa płatności HotPay
**P0 · L · Zależności** brak · **Postęp** 0/4
**Cel** Płatność kończy się aktywacją pakietu dokładnie raz i za właściwą kwotę; powstaje siatka testów.
**Podzadania** Z4 webhook omija sesję (potwierdzony błąd 401) · Z5 weryfikacja kwoty i atomowe księgowanie · Z16 test „trasy API vs proxy" · Z8 testy płatności.
**Kolejność** Z4 → Z16 (razem) → Z5 → Z8.
**Gotowe, gdy** Podpisany anonimowy POST na `/api/payments/hotpay/notify` zwraca 200; zamówienie 19,99 zł z `KWOTA=0.01` nie daje pakietu; powtórka nie przedłuża; test chroni nowe trasy publiczne.

## US3 — Zgody i prywatność użytkownika
**P0 · XL · Zależności** US7 (treści zgód — można zacząć równolegle z szkicami) · **Postęp** 0/4
**Cel** Zgody na dane o ciele i zdjęcia, analityka/Sentry dopiero po zgodzie, minimalny wiek 16, push za zgodą.
**Podzadania** Z11 rejestr zgód i zgoda na dane zdrowotne · Z12 analityka i monitoring po zgodzie · Z13 wiek 16+ · Z81 przypomnienia za zgodą.
**Gotowe, gdy** Nie da się zapisać raportu ciała/zdjęć bez zgody; przed zgodą brak zdarzeń PostHog/Sentry (test sieciowy); rejestracja odrzuca < 16 lat; cofnięcie zgód w Profilu działa.

## US4 — Zamówienia: zgody, anonimizacja, historia, faktury
**P0 · XL · Zależności** US2, US1 (Z1 dla faktur), US7 (treść zgody) · **Postęp** 0/4
**Cel** Kompletny, rozliczalny cykl zamówienia po stronie klienta i sprzedawcy.
**Podzadania** Z6 zapis zgód konsumenckich przy zakupie · Z7 anonimizacja zamówień zamiast kaskady · Z20 historia zamówień i e-mail z potwierdzeniem (wymaga SMTP z US8) · Z21 faktury/paragony.
**Gotowe, gdy** Checkout bez zgód zwraca 400 i zapisuje dowód zgody; usunięcie konta nie kasuje zamówień; klient widzi historię i dostaje e-mail; dokument sprzedaży jest dostępny.

## US5 — Premium: realna wartość pakietu
**P0 · XL · Zależności** US1 (Z2, Z3) · **Postęp** 0/4
**Cel** Pakiet faktycznie coś odblokowuje i jest to egzekwowane po stronie serwera; checkout włączany dopiero, gdy wartość istnieje.
**Podzadania** Z9 realna wartość pakietu (AdMob albo funkcje Premium) · Z10 gating `requirePremium()` po stronie serwera · Z24 przypomnienie o końcu pakietu i odnowienie · Z54 kody promocyjne i Badania (wdrożyć albo usunąć wg decyzji).
**Gotowe, gdy** Użytkownik bez pakietu nie dostaje funkcji Premium (test 402/403); `/package` wymienia dokładnie to, co jest odblokowane; banner końca pakietu i „Przedłuż" działają.

## US6 — Prawa użytkownika (usunięcie, eksport, dane AI)
**P0 · L · Zależności** US4 (Z7), US3 · **Postęp** 0/4
**Cel** Realizacja praw RODO i wymogów Google Play.
**Podzadania** Z14 usuwanie konta z ponownym uwierzytelnieniem · Z25 publiczna strona `/usun-konto` · Z26 kompletny eksport danych · Z27 Pollinations bez danych osobowych.
**Gotowe, gdy** Usunięcie wymaga hasła/świeżego logowania i usuwa dane zdrowotne, zdjęcia, push, sesje; eksport pokrywa wszystkie tabele z `user_id`; prompty obrazów bez danych osobowych; `/usun-konto` jest publiczna.

## US7 — Dokumenty prawne i retencja
**P0 · L · Zależności** US1 (Z1) · **Postęp** 0/2
**Cel** Komplet dokumentów i automatyczna retencja. **Zatwierdzenie przez człowieka-prawnika; nie deklaruj jako gotowe.**
**Podzadania** Z15 dokumenty prawne i podmioty przetwarzające (regulamin, polityka, RCP, umowy powierzenia, DPIA) — szkice w repo teraz, zatwierdzenie prawnika `[NA KONIEC]` · Z28 retencja i automatyczne usuwanie (crony + testy; okresy z projektu w `docs/prawo/01-…`, zatwierdzenie `[NA KONIEC]`).
**Gotowe, gdy** Projekty w `docs/prawo/` i teksty w aplikacji są wersjonowane i gotowe do przeglądu prawnika; crony czyszczące działają zgodnie z zatwierdzonymi okresami.

## US8 — Operacje i uruchomienie
**P0 · L · Zależności** US2 (staging do testów płatności) · **Postęp** 0/5
**Cel** Środowisko produkcyjne gotowe do obsługi klientów: e-mail, staging, backup, monitoring, wsparcie.
**Podzadania** Z17 SMTP produkcyjny `[NA KONIEC]` · Z47 staging z testowymi kluczami HotPay `[NA KONIEC]` · Z48 test przywracania backupu `[NA KONIEC]` · Z49 monitoring, alerty, status `[NA KONIEC]` (w repo tylko ewentualne zdarzenia/tagi do Sentry) · Z50 wsparcie klienta i reklamacje (kod, robić od razu).
**Gotowe, gdy** Rejestracja kodem i reset hasła działają na produkcji; płatność testowa przechodzi na stagingu; backup przywrócony na próbę (RTO/RPO zapisane); alerty skonfigurowane; kontakt i FAQ dostępne.

## US9 — Admin: zamówienia, alerty, finanse
**P1 · L · Zależności** US2, US4 · **Postęp** 0/4
**Cel** Właściciel widzi i obsługuje płatności bez wchodzenia do bazy.
**Podzadania** Z22 panel zamówień i zwroty · Z23 alerty płatności · Z55 zmiana cen bez wdrożenia (bez psucia trwających zamówień) · Z75 panel finansowy.
**Gotowe, gdy** Lista zamówień z filtrem, ręczne księgowanie/anulowanie, cron wygaszający `pending`, alerty dla płatności bez pakietu, przychody i aktywne pakiety w panelu.

## US10 — Bezpieczeństwo aplikacji
**P1 · L · Zależności** US3 (Z12 — znane źródła do CSP) · **Postęp** 0/4
**Cel** Utwardzić warstwę HTTP.
**Podzadania** Z29 CSP w trybie egzekwowania · Z30 rate limiting produkcyjny i zaufane IP · Z56 ograniczenie osadzania w iframe · Z57 skan zależności i rotacja sekretów (workflow i dokument procedury w repo teraz; sama rotacja `[NA KONIEC]`).
**Gotowe, gdy** CSP jest egzekwowane bez naruszeń na głównych ekranach; limity działają przez Upstash; spoofing `x-forwarded-for` nie omija limitów; workflow zależności blokuje High/Critical.

## US11 — Bezpieczeństwo admina, Java i repo
**P1 · L · Zależności** US1 (Z18) · **Postęp** 0/5
**Cel** Zamknąć ryzyka kont uprzywilejowanych, backendu Java i widoczności kodu.
**Podzadania** Z31 Java fail-closed · Z73 realizacja decyzji o Javie (zależne od decyzji Z18 — zapytaj właściciela; propozycja: usunięcie) · Z32 2FA i blokada dla admina, usunięcie PIN-u · Z33 repo prywatne `[NA KONIEC]` (w repo tylko higiena drzewa: usunięcie `undefined/`, `.gitignore`) · Z34 test uprawnień tras admina.
**Gotowe, gdy** Java nie ufa nagłówkom bez tokenu (lub jest usunięta); admin ma 2FA; martwy kod PIN usunięty; test enumeruje trasy admina; drzewo robocze czyste.

## US12 — Spójność liczb (cardio)
**P1 · M · Zależności** brak · **Postęp** 0/3
**Cel** Te same minuty cardio i tydzień (pon–niedz) na Pulpicie, w Treningu i w silniku dodatkowego cardio, także bez planu.
**Podzadania** Z35 jedna definicja tygodnia i minut cardio · Z38 spójne cardio bez planu (+ martwy `/start-workout`) · Z44 testy kontraktowe liczb między ekranami.
**Gotowe, gdy** Dane mock (20 min w tygodniu) dają 20 wszędzie, także w stanie „brak planu"; test kontraktowy pilnuje.

## US13 — Trening i raport ciała: poprawki UX
**P1 · L · Zależności** brak · **Postęp** 0/4
**Cel** Usunąć tarcie i błędy znalezione na mockach w głównych ścieżkach.
**Podzadania** Z37 obecność w treningu tylko przy udostępnianiu (38× 403 w konsoli) · Z62 seria 0 kg — świadomy wybór · Z63 jedno sterowanie niedokończonym treningiem · Z64 dostępny formularz raportu ciała.
**Gotowe, gdy** Trening solo nie generuje błędów 403; 0 kg wymaga świadomego wyboru; ekran Trening nie dubluje akcji; pola i skale raportu mają etykiety (axe bez błędów krytycznych).

## US14 — Jakość: lint, E2E, bramki wdrożeniowe
**P1 · XL · Zależności** brak (Z46 przed Z43) · **Postęp** 0/4
**Cel** Zielone bramki jakości i działające E2E w CI.
**Podzadania** Z46 naprawa specyfikacji E2E (dziś 9/41) · Z43 E2E krytycznych ścieżek (rejestracja, płatność sandbox, usunięcie konta) · Z42 lint zielony (102 błędy) · Z45 rozszerzony `deploy:check`.
**Gotowe, gdy** 0 błędów lint; E2E zielone lokalnie i w CI; `deploy:check` blokuje promote przy braku konfiguracji płatności/SMTP/Upstash/`CRON_SECRET`/`ADMIN_EMAILS`.

## US15 — Dane i architektura
**P1 · XL · Zależności** US3 (zgody na zdjęcia) · **Postęp** 0/3
**Cel** Uporządkować magazynowanie i schemat zanim wzrośnie skala.
**Podzadania** Z40 jedno źródło schematu (migracje Drizzle) · Z39 zdjęcia w magazynie obiektowym zamiast `data_url` w bazie · Z72 CAS w modułach społeczności.
**Gotowe, gdy** `ensure-schema` sprowadzony do kontroli wersji; zdjęcia poza bazą z migracją danych; równoległe zapisy XP/wojen nie gubią punktów (testy współbieżności).

## US16 — Wydajność
**P2 · L · Zależności** brak · **Postęp** 0/4
**Cel** Zmierzyć i obniżyć koszty wydajności.
**Podzadania** Z41 pomiar na buildzie produkcyjnym (Lighthouse, 10 ekranów) · Z70 mniejszy payload RSC (`/nutrition/week` 209 kB, `/plany/atlas` 148 kB → < 90 kB) · Z71 mniej zapisów synchronizacji treningu · Z79 mniej pollingu społeczności.
**Gotowe, gdy** Budżety zapisane i sprawdzane w CI dla 3 ekranów; payload RSC poniżej progu; zapisy synchronizacji −50%.

## US17 — Spójność wizualna i dostępność
**P2 · XL · Zależności** brak · **Postęp** 0/9
**Cel** Jeden wygląd i zachowanie ekranów oraz WCAG AA.
**Podzadania** Z69 dokończenie przeglądu wizualnego ekranów · Z65 jeden wzorzec nagłówka · Z66 tokeny kolorów i kontrast · Z67 jeden kafel statystyki · Z68 strefa bezpieczna dolnej nawigacji · Z59 kontekstowy przycisk pływający · Z60 tytuły stron i nazewnictwo · Z61 stany ładowania i wykresy bez błędów wymiarów · Z74 WCAG AA (axe, 10 ekranów).
**Gotowe, gdy** `ScreenHeader` i kafel stosowane na wszystkich ekranach z listy defektów; brak literałów koloru marki poza `globals.css`; tytuły stron per trasa; brak ostrzeżeń „width(-1)"; axe bez błędów krytycznych.

## US18 — Onboarding, rejestracja i porządki produktu
**P2 · L · Zależności** US8 (Z17) dla pełnego przepływu rejestracji · **Postęp** 0/4
**Cel** Lepszy pierwszy kontakt i usunięcie zaślepek.
**Podzadania** Z36 komunikaty rejestracji bez SMTP · Z58 onboarding świadomy historii (plan z ostatnich treningów) · Z77 usunięcie `inbox` i roli `trener` · Z78 usunięcie martwych komponentów.
**Gotowe, gdy** `/register` mówi, jakie metody są dostępne; konto z historią dostaje propozycję planu; brak `inbox`, roli `trener` i martwych komponentów.

## US19 — Android i soft launch  **[NA KONIEC — cały US]**
**P1 · XL · Zależności** US1 (Z19), US6, US8, US10 · **Postęp** 0/2
**Cel** Publikacja i kontrolowane wejście na rynek.
**Podzadania** Z51 publikacja Android w Google Play (Data Safety, AAB, `/usun-konto`, strategia płatności) · Z52 soft launch (20–50 testerów, 2 tygodnie, KPI) i decyzja go/no-go wg sekcji 13 audytu.
**Gotowe, gdy** Aplikacja zatwierdzona w Play; kryteria „Definition of Launch" spełnione; decyzja go/no-go zapisana.

## US20 — Analityka, strona produktu, refaktor, dokumentacja
**P2 · XL · Zależności** US3 (Z12 dla Z53), US1 (Z2 dla Z76) · **Postęp** 0/4
**Cel** Dane do decyzji biznesowych, pozyskanie klientów i porządek w kodzie/dokumentach.
**Podzadania** Z53 KPI i lejek (aktywacja, retencja, konwersja w PostHog po zgodzie) · Z76 publiczna strona produktu z cennikiem · Z80 rozbicie dużych modułów (< 500 linii) · Z83 aktualizacja dokumentacji projektu.
**Gotowe, gdy** Dashboard KPI z definicjami; publiczna strona z SEO/OG; wskazane moduły podzielone bez regresji testów; dokumentacja wskazuje na ten backlog.
