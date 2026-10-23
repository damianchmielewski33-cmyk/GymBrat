# Mapa produktu GymBrat (baza wiedzy zespołu)

Stan na 2026-10-23, gałąź `feat/error-handling-system`. Dokument opisuje wyłącznie to, co potwierdzono w kodzie i dokumentach repozytorium. Nie zmienia żadnych wymagań.

**Uwaga o decyzjach (2026-10-23):** właściciel rozstrzygnął pytania otwarte (`docs/zespol/decyzje-wlasciciela.md`, D1-D25; podsumowanie w sekcji 7). Sekcje 1-6 nadal opisują stan kodu, który **nie jest jeszcze zmieniony** zgodnie z decyzjami (rola `trener`, ekran `inbox`, PIN admina, kroczące 7 dni cardio, wiek 13+ itd.). Miejsca dotknięte decyzjami oznaczono "[decyzja Dx, niezaimplementowana]". Oznaczenie "(zapowiedź)" = wpis `planned: true` w `components/changelog/changelog-data.ts` (nie ma pewności, że jest na produkcji).

## 1. Czym jest GymBrat

GymBrat to polskojęzyczna aplikacja "fitness OS" (web/PWA + powłoka Android) dla osoby ćwiczącej na własną rękę: prowadzi dziennik treningów siłowych i cardio, dziennik posiłków (skan EAN, wyszukiwarka, katalog przepisów, makro), raporty ciała ze zdjęciami oraz analizę postępów. Podpowiedzi coacha (w trakcie serii, briefing, plan) to lokalne heurystyki, bez wbudowanego LLM (`ai/coach.ts`, `lib/live-set-coach.ts`, `lib/briefing-heuristic.ts`). Do tego dochodzi warstwa społecznościowa (grupy, wyzwania, wojny, live trening) i monetyzacja pakietami (bez pakietu: reklamy przed startem treningu i dodaniem produktu). Fokus produktu: samodzielny zawodnik B2C; CRM trener-podopieczny jest jawnie poza zakresem (`lib/product-strategy.ts`: `PRODUCT_FOCUS = "b2c"`). Problem: jedno miejsce łączące trening, dietę i pomiary ciała, z realizacją celów tygodniowych (cardio 150 min, makro).

## 2. Role i uprawnienia

Pole `users.appRole` (`db/schema.ts`, typ w `lib/auth-role.ts`): `zawodnik` | `trener` | `admin`.

| Rola | Co może (potwierdzone) |
|---|---|
| zawodnik (domyślna) | wszystkie ekrany `app/(dashboard)`: trening, cardio, dieta, raporty, analiza, społeczność, pakiety, zgłaszanie błędów, eksport i usunięcie konta (`/api/user/export`, `DELETE /api/user/account`). Rejestracja e-mail dopuszcza tylko tę rolę (`lib/validations/register.ts`: `z.literal("zawodnik")`). |
| trener | rola istnieje w typach i JWT (`auth.ts`), ale w kodzie nie znaleziono osobnych funkcji trenerskich; produkt jest B2C. [decyzja D7: rola do usunięcia, niezaimplementowana] |
| admin | to co zawodnik + panel `/admin` (`app/admin/(panel)/*`). Nadanie: `ADMIN_EMAILS` przy logowaniu (`lib/google-auth.ts`, `auth.ts`), bootstrap (`/api/admin/bootstrap`) lub edycja w panelu. Dostęp do panelu: `isAdminEligible` (`lib/admin-session.ts`) plus `ADMIN_PIN` / `api/admin/unlock`, `lock`. [decyzja D15: PIN nie będzie używany, kod odblokowania do usunięcia jako martwy; niezaimplementowana. D4: `ADMIN_EMAILS` na produkcji pusta] |
| w grupie (team_members.role) | `owner` / `admin` / `moderator` / `member` - odrębny model uprawnień w społeczności (`db/schema.ts` ~l.685, `docs/community-notion.md` sekcja 6). |
| użytkownik z/bez pakietu | nie rola, ale stan: `users.packageEndsAt`; brak aktywnego pakietu = `showAds` w `/api/package/status` -> bramka reklamowa (`components/ads/fullscreen-ad-gate.tsx`); reklamy tylko przy zgodzie marketingowej (CMP, `lib/consent-preferences.ts`). |

## 3. Moduły

| Moduł | Opis | Ekrany (`app/`) | Główne pliki |
|---|---|---|---|
| Pulpit | powitanie, "Trening na dziś", pasek cardio, kafelki makro/wagi/tempa, Sylwetka, Założenia, ostatnie treningi, skaner EAN | `(dashboard)/page.tsx` | `components/home/*`, `lib/home-start.ts` (test), `actions/daily-checkin.ts`, `lib/daily-checkin.ts` |
| Plany treningowe | hub Treningi, tworzenie/edycja planu, import z Excela/Worda/PDF, porównanie planów | `workout-plan`, `profile/workout-plan`, `start-workout` (redirect do `/workout-plan`) | `actions/workout-plan.ts`, `actions/ai-workout-plan.ts`, `lib/workout-plan-*.ts`, `lib/docx/`, `lib/pdf/`, `api/workout-plans/import`, `docs/workout-plan-creation.json` |
| Aktywny trening | prowadzona sesja: ciężar/powtórzenia/RIR/RPE, timer przerwy, podpowiedzi coacha na żywo, zapis sesji w chmurze i kolejka offline | `active-workout` | `actions/active-workout-coach.ts`, `lib/live-set-coach.ts`, `lib/active-workout-persist.ts`, `lib/workout-outbox-db.ts` (IndexedDB), `api/active-workout-session`, `api/workouts/complete`, `lib/plate-calculator.ts`, `docs/live-set-coach-tips.json` |
| Historia treningów | lista, szczegóły, edycja | `workout-history`, `workout-history/[id]`, `[id]/edit` | `actions/workout-history.ts`, `lib/workout-history-overview.ts` |
| Technika | linki do technik ćwiczeń (zarządzane w adminie) | `technique` | `actions/exercise-technique.ts`, `lib/exercise-technique-store.ts`, `api/admin/exercises/technique` |
| Cardio | log cardio, zapis z minut/tętna/kcal, zdjęcie urządzenia, cel tygodniowy (dziś kroczące 7 dni, domyślnie 150 min; [decyzja D9: docelowo tydzień pon-nd, niezaimplementowana]), dodatkowe cardio z nadwyżki makro | `cardio`, `cardio/record`, `cardio/[id]` | `actions/cardio.ts`, `lib/cardio.ts`, `lib/extra-cardio-from-macros.ts`, `docs/extra-cardio-from-macros.json`, `api/media/cardio-photo` |
| Żywienie (dziennik) | posiłki, makro, cele dni treningowego/odpoczynku, skan EAN, wyszukiwarka, produkt bez wartości | `meal-suggestions` (dziennik/plan), `nutrition/today`, `nutrition/week` | `actions/meal-log.ts`, `meal-quick.ts`, `food-lookup.ts`, `diet-day.ts`, `nutrition-settings.ts`, `lib/food-*.ts`, `lib/nutrition-goals.ts`, `docs/food-search-database.json` |
| Katalog przepisów | przepisy z gramaturą i krokami, import JSON przez admina, grafiki AI generowane raz (Pollinations) | `meal-suggestions`, `admin/catalog` | `lib/meal-catalog.ts`, `actions/meal-suggestions.ts`, `api/catalog-meal-image`, `api/admin/catalog` |
| Suplementy | lista suplementów w diecie | `supplements` | `lib/diet-supplements.ts` |
| Raporty ciała | wizard raportu: waga, obwody, zdjęcia (wymagane), cykl raportów, import z Excela | `reports` | `lib/reports.ts`, `actions/report-cadence.ts`, `api/body-reports(/import)`, `db/schema.ts` `body_reports`, `body_report_photos`, `api/media/body-report-photo` |
| Waga | ważenia, zdjęcie startowe | (Pulpit, Postępy) | `actions/weight.ts`, `actions/start-photo.ts`, `api/media/start-photo` |
| Postępy / Analiza | 4 zakładki: Przegląd, Siła, Sylwetka, Tygodnie; e1RM, balans mięśni, gotowość, osiągnięcia, porównanie zdjęć | `progress`, `progress/exercises/[key]` (`progress-analysis` redirect) | `lib/progress-analysis.ts`, `lib/intensity-analysis.ts`, `lib/exercise-progress.ts`, `lib/achievements.ts`, `actions/progress-delta-unit.ts`, `docs/progress-*.json`, `analytics-intelligence.json`, `performance-intelligence-engine-v2.md` |
| Społeczność | grupy (teams), feed, czat (SSE), znajomi, live trening znajomego, wyzwania, questy, wojny grup, Hall of Fame, XP/prestiż, powiadomienia | `community/*` (teams, friends, challenges, wars, hall-of-fame, discover, global, notifications, `u/[userId]`) | `actions/teams.ts`, `friendships.ts`, `challenges.ts`, `community-*.ts`, `team-feed.ts`, `api/community/*`, `docs/community-notion.md`, `community-audit.md` |
| Przypomnienia i push | godziny przypomnień (trening, posiłek, check-in), Web Push, alarmy w Androidzie | `profile` (sekcja Przypomnienia) | `actions/reminders*.ts`, `actions/push.ts`, `api/cron/reminders`, tabele `push_subscriptions`, `reminder_dispatches` |
| Profil i onboarding | dane ciała, cele, zgody cookies, eksport/usunięcie konta, pobranie APK, wizard po rejestracji | `profile`, `complete-profile`, `onboarding` | `actions/profile.ts`, `onboarding.ts`, `fitness-goals.ts`, `intro-tour.ts`, `lib/user-data-export.ts` |
| Pakiety i płatności | pakiety 7/30/90/365 dni, zakup HotPay, ekran "Twój pakiet", reklamy bez pakietu | `package` | `api/package/checkout`, `api/package/status`, `api/payments/hotpay/notify`, tabele `subscription_plans`, `subscription_orders` |
| Zgłoszenia błędów | opis + do 4 zdjęć + priorytet | `bug-report` | `api/bug-reports`, `bug_reports` |
| Skrzynka | ekran istnieje (zaślepka pod wiadomości od coacha) [decyzja D7: do usunięcia razem z rolą `trener`, niezaimplementowana] | `inbox` | - |
| Wkrótce | nieaktywne pozycje menu | `labs` (Badania), `promo-codes` | `components/layout/app-menu-coming-soon.tsx` |
| Panel admina | Przegląd/analityka, Użytkownicy (szczegóły, edycja, nadanie pakietu, notatka), Pakiety, Katalog przepisów, Ćwiczenia (linki techniki), Błędy, Branding (ikony, manifest, APK), Ustawienia/Konfiguracja, sprzątanie danych | `admin/(panel)/overview|users|packages|catalog|exercises|bugs|branding|settings` | `lib/admin-*.ts`, `lib/admin-config-status.ts`, `api/admin/*`, `api/cron/cleanup` |
| Prawne | regulamin, polityka prywatności | `(legal)/regulamin`, `(legal)/polityka-prywatnosci` | zgody: `components/consent/cookie-consent-banner.tsx` |
| Wdrożenia | kontrakt wersji i changelogu | - | `api/version`, `lib/deploy-changelog.ts`, `docs/vps-docker-production.md` |

Nawigacja: dolny pasek Pulpit / Trening (`/workout-plan`) / Dieta (`/meal-suggestions`) / Analiza (`/progress`) / Team (`/community/teams`) w `components/layout/app-shell.tsx`; reszta w menu bocznym `components/layout/app-menu-button.tsx`. Opis z changeloga o innym układzie paska (z przyciskiem Raport) jest starszy - kod ma dziś Team.

## 4. Kluczowe przepływy

1. **Rejestracja e-mail**: ekran startowy (Google / e-mail / Facebook) -> `sendRegisterCode` (kod e-mail SMTP, hash w `email_verification_codes`, max 5 prób) -> `registerUser` (`actions/auth.ts`) tworzy `users` + domyślne `user_settings` (cel cardio 150) -> `/complete-profile` jeśli brak danych ciała -> `/onboarding` (liczba treningów tygodniowo).
2. **Logowanie**: Credentials (bcrypt), Google, Facebook (`auth.ts`, `lib/google-auth.ts`, `oauth_accounts`); `proxy.ts` przekierowuje niezalogowanych na `/login`, API zwraca 401 JSON; niekompletny profil trafia na `/complete-profile`; limity prób per IP/konto.
3. **Trening**: `/workout-plan` -> wybór dnia planu -> `/active-workout` (seria po serii, podpowiedź coacha, timer przerwy, stan w `active_workout_sessions`, kolejka offline w IndexedDB) -> zapis przez `POST /api/workouts/complete` (Java albo TS) -> `workouts` -> historia, analiza, wpis w feedzie grupy. Przy braku pakietu przed startem bramka reklamowa.
4. **Cardio**: `/cardio/record` -> `createCardioLog` -> `workouts.cardioMinutes` -> pasek tygodnia (kroczące 7 dni w `lib/cardio.ts`; Pulpit opisuje tydzień pon-nd - patrz sekcja 7).
5. **Posiłek**: Pulpit/Dieta -> "Dodaj do dziennika" -> skan EAN / szukaj / przepis / zdjęcie etykiety -> porcja -> `addMealLogAction` -> `meal_logs` -> makro dnia vs cel; nadwyżka kcal może podnieść zalecane dodatkowe cardio.
6. **Raport i postępy**: `/reports` (wizard: waga, obwody, zdjęcia) -> `body_reports` -> `/progress` (Sylwetka: suwak Start/Teraz, tempo wagi; Siła: e1RM; Tygodnie: realizacja diety/treningu/cardio).
7. **Zakup pakietu**: `/package` -> zgoda na regulamin i politykę -> `api/package/checkout` -> HotPay -> `api/payments/hotpay/notify` -> `packageEndsAt` wydłużone.
8. **Społeczność**: utworzenie/dołączenie do grupy (kod/zaproszenie) -> feed, czat, wyzwania, wojny, live; znajomi z wzajemnym udostępnianiem podglądu treningu.
9. **Dane osobowe**: eksport (`GET /api/user/export`) i usunięcie konta (`DELETE /api/user/account`); stan sekcji w UI: changelog z 2026-10 mówi o usunięciu, wpis RODO (zapowiedź) o jej przywróceniu - do potwierdzenia.

## 5. Kanały

- **Web/PWA** (główny): Next.js 16 App Router, `public/manifest.webmanifest`, ręcznie utrzymywane `public/sw.js`, push-sw; hosting: produkcja obecnie Render (`gymbrat.onrender.com`), docelowo VPS; Vercel nie jest produkcją (D1; `docs/vps-docker-production.md`). Baza Turso/libSQL przez Drizzle.
- **Android** (`android/`): natywna powłoka Java z pełnoekranowym WebView ładującym produkcyjny adres; most JS `window.GymBratAndroid` (wersja, aktualizacja, latarka, kamera, reklama pełnoekranowa AdMob); in-app update z `GET /api/android/version`; APK budowany w GitHub Actions i serwowany z `/gymbrat.apk`. Cała logika domenowa jest w webie; zmiana UI web = zmiana w aplikacji.
- **Java backend** (`java-backend/`, Spring Boot 3): `/api/health`, `/api/version`, `/api/android/version|download`, `GET|POST /api/body-reports`, `POST /api/workouts/complete` (nagłówek `X-GymBrat-User-Id` + opcjonalny `X-GymBrat-Proxy-Token`). Next proxuje tylko te ścieżki przy `JAVA_API_BASE_URL` (`lib/java-api.ts`); bez zmiennej działają handlery TypeScript/Drizzle (stan domyślny na Vercel). Zakres Javy jest mały, reszta domeny tylko w TS.
- **Zadania cykliczne**: `api/cron/cleanup`, `api/cron/reminders` (`CRON_SECRET`, `vercel.json`).

## 6. Słownik pojęć

- **Zawodnik / trener / admin**: role konta (sekcja 2).
- **Dzień planu (D1-D5)**: jeden trening z planu (`workout_plans.planJson`); "Trening na dziś".
- **Seria, RIR, RPE, seria twarda**: zapis serii; RIR = powtórzenia w zapasie; RPE = odczuwany wysiłek; twarda = do upadku/bliska.
- **e1RM**: szacowany 1RM do trendów siły; **tonaż**: suma ciężar x powtórzenia.
- **Live Set Coach**: lokalne podpowiedzi ("Dziś spróbuj", dokładka, zdjęcie ciężaru) w trakcie treningu.
- **Cardio tygodniowe**: dziś suma minut z kroczących 7 dni vs `weeklyCardioGoalMinutes` (domyślnie 150); docelowo tydzień pon-nd (D9, niezaimplementowane).
- **Dodatkowe cardio z makro**: zalecane minuty kompensujące nadwyżkę kcal.
- **Dzień treningowy / odpoczynku**: dwa zestawy celów kcal/makro w `user_settings`.
- **Raport ciała**: pomiar okresowy (waga, obwody, zdjęcia) z cyklem w profilu; **Start / Teraz**: porównanie zdjęć.
- **Check-in / Zamknięcie dnia**: dzienna ocena formy (energia, sen, trawienie) i zamknięcie dnia (`daily_checkins`).
- **Pakiet**: płatny dostęp na N dni (d7, d30, d90, d365) bez reklam; **bramka reklamowa**.
- **Team / Grupa, Challenge, Quest, War, HoF, XP, Prestiż, FCS, Reputacja**: elementy gamifikacji społeczności (`docs/community-notion.md`).
- **Ghost training**: porównanie z wcześniejszą sesją (`api/ghost-training/*`).
- **Katalog (meal_catalog)**: przepisy zarządzane przez admina.
- **Outbox**: kolejka ukończonych treningów zapisywana offline.

## 7. Rozstrzygnięcia właściciela i pytania nadal otwarte

Źródło: `docs/zespol/decyzje-wlasciciela.md` (2026-10-23). **Zmiany wynikające z decyzji nie są jeszcze zaimplementowane** - kod i sekcje 1-6 opisują stan sprzed decyzji. Każda zmiana w kodzie idzie normalnym przepływem (`docs/zespol/przeplyw.md`).

### 7.1 Rozstrzygnięte (dawne pytania 1-8)

| Dawne pytanie | Decyzja | Skutek dla produktu / następny krok |
|---|---|---|
| 1. Rola `trener` | D7: usuwamy rolę `trener` i ekran `app/(dashboard)/inbox` | usunąć z typów, JWT i `db/schema.ts` (`appRole`); wymaga architekta (migracja danych kont z rolą `trener`, jeśli istnieją) oraz usunięcia pozycji menu "Skrzynka" |
| 2. Eksport, usunięcie konta, przypomnienia PWA | D8: właściciel uważa za zbędne. Przypomnienia PWA można usunąć. Eksport i usunięcie konta realizują prawa z RODO (art. 20, art. 17) | przed jakimkolwiek usunięciem eksportu/usunięcia konta wymagana ocena `prawnik`; do czasu oceny zostają endpointy `/api/user/export` i `DELETE /api/user/account`. Przypomnienia (`actions/reminders*.ts`, `api/cron/reminders`, push) - do usunięcia po analizie wpływu na Android (alarmy) |
| 3. Tydzień cardio | D9: poniedziałek-niedziela (zastępuje kroczące 7 dni w `lib/cardio.ts`, także w Javie) | ujednolicić definicję w web, Javie i Android; wpływa na pasek cardio, `docs/extra-cardio-from-macros.json` (już mówi pon-nd) i testy |
| 4. Host produkcji | D1: obecnie Render, docelowo VPS; Vercel nie jest produkcją | limity Vercel (cron, `vercel.json`) nie są właściwym punktem odniesienia; cron i limity do przeglądu pod Render/VPS |
| 5. Zakres pakietu; "Kody rabatowe", "Badania" | D10, D11 - patrz 7.2. `inbox`: D7 (usunąć) | - |
| 6. Dane wrażliwe: podstawa prawna i retencja | D21: właściciel deleguje do `prawnik` (projekt roboczy do zatwierdzenia przez prawnika-człowieka); D17: administrator danych to osoba prywatna; D19: zdjęcia sylwetki i czat widoczne tylko dla właściciela; D20: analiza zdjęć w `ai/coach.ts` nieużywana; D25: dane użytkownika trafiają w promptach Pollinations (odbiorca poza EOG) | `prawnik`: podstawa i retencja, zgoda na transfer poza EOG (D25), polityka prywatności. Do weryfikacji, jak D19 ma się do funkcji społecznościowych (media postów, czat, podgląd treningu znajomych) |
| 7. Aktualność `docs/*.json` | D13; wynik weryfikacji: `docs/analiza/01-aktualnosc-specyfikacji.md` (większość JSON aktualna, `performance-intelligence-engine-v2.md` historyczny) | - |
| 8. Wersje językowe | D14: tylko polski | `lib/i18n` do oceny `architekta` pod kątem uproszczenia (nie decyzja analityka) |

### 7.2 Nadal otwarte

1. **D10 - zakres pakietu**: do ustalenia przez właściciela. Dziś pakiet = brak reklam; czy dochodzą funkcje gated (pytanie wejściowe do analizy monetyzacji)?
2. **D11 - "Kody rabatowe" i "Badania"** (pozycje "Wkrótce": `promo-codes`, `labs`): plan i priorytet do ustalenia. Badania to potencjalnie dane zdrowotne (wskazać `prawnik` przed analizą wymagań).

### 7.3 Pozostałe ustalenia właściciela (nowe wymagania wynikające z decyzji, niezaimplementowane)

| Decyzja | Treść | Uwagi |
|---|---|---|
| D15 | Brak PIN-u admina; usunąć `lib/admin-session.ts` (odblokowanie), `app/api/admin/unlock`, `lock`, `ADMIN_PIN` | zmiana uwierzytelniania/uprawnień - pełny przepływ, `tester-bezpieczenstwa`. Powiązane z D4 (`ADMIN_EMAILS` pusta: bez ustawienia nikt nie dostanie roli admina przez logowanie; dostęp tylko przez bootstrap/edycję w panelu - do weryfikacji, czy to zamierzone) |
| D18 | Minimalny wiek 16 lat (dziś 13+) | zmiana regulaminu, polityki, formularza rejestracji (`prawnik` + `ux`); co z istniejącymi kontami osób 13-15 lat - pytanie do `prawnik` |
| D3, D22 | Brak SMTP na produkcji; na produkcji działa tryb testowy kodu rejestracji `1234` (W1 w `docs/bezpieczenstwo/00-model-zagrozen-bazowy.md`) - podatność do pilnej naprawy; docelowo dedykowana skrzynka e-mail | blokuje bezpieczną rejestrację e-mail; priorytet Must |
| D5 | Backend Java na produkcji: nieznany; brak `render.yaml` i Dockerfile | sprawdzić w panelu Render usługę Java i `JAVA_API_BASE_URL`; wpływa na zakres D9 (Java) |
| D16, D23 | Android: adres Render (`https://gymbrat.onrender.com/`), publikacja w Google Play; wersje w gradle/JSON/testach do ujednolicenia | Google Play wymaga m.in. polityki prywatności i deklaracji danych (`prawnik`) |
| D24 | Reklamy AdMob jeszcze nieskonfigurowane | bramka reklamowa bez pakietu działa tylko przy zgodzie CMP; do czasu konfiguracji brak realnego przychodu z reklam |
| D2, D6 | Regiony dostawców prawdopodobnie Europa - do potwierdzenia w panelach; repozytorium chwilowo publiczne | `prawnik` (transfer danych), `tester-bezpieczenstwa` (brak sekretów w publicznym repo) |

### 7.4 Niejasności, które zostają

- Luka w numeracji migracji `0017`/`0018` w `db/migrations` (patrz `01-aktualnosc-specyfikacji.md`).
- Stan sekcji eksportu/usunięcia konta w UI Profilu (changelog 10-03 vs wpis RODO "zapowiedź") - do potwierdzenia w kodzie przed decyzją `prawnika` o D8.
