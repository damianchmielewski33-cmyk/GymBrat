# 00 - Inwentaryzacja danych i stan zgodności prawnej GymBrat

- Data analizy: 2026-10-23
- Zakres: kod w repozytorium (db/, actions/, app/, lib/, ai/, instrumentation.ts, android/, env.example, docs/community-audit.md, docs/analytics-intelligence.json).
- **Status: analiza robocza sporządzona przez asystenta AI. Nie jest poradą prawną. Wymaga weryfikacji i zatwierdzenia przez prawnika-człowieka.**
- Stan prawny (RODO, UoŚUDE, ustawa o prawach konsumenta, DSA, AI Act, wytyczne UODO/EROD): NIE zweryfikowany w ISAP/EUR-Lex/UODO w tej analizie. Przed użyciem wniosków w dokumentach dla użytkowników trzeba to zrobić i wpisać datę weryfikacji.
- Nie zweryfikowano: faktycznej lokalizacji serwerów i regionów (hosting bywa opisany jako Vercel, Render i VPS - patrz pytania otwarte), podmiotu prowadzącego (administratora), umów powierzenia.

## 1. Rejestr kategorii danych

Legenda: **Z9** = dane o zdrowiu/ciele lub ujawniające je (art. 9 RODO) - ocena ostrożnościowa do potwierdzenia przez prawnika.

| # | Kategoria | Pola / tabela (plik) | Cel | Z9 | Uwagi |
|---|-----------|----------------------|-----|----|-------|
| 1 | Konto i tożsamość | `users`: email, passwordHash (bcrypt 12), name, firstName, lastName, appRole, createdAt (`db/schema.ts`) | umowa, logowanie | nie | nazwisko jest też używane w społeczności (do potwierdzenia, co widzą inni) |
| 2 | Logowanie społecznościowe | `oauth_accounts`: provider, providerAccountId; Google/Facebook przez NextAuth | logowanie | nie | konta OAuth mają losowy hash hasła |
| 3 | Kody weryfikacyjne e-mail | `email_verification_codes`: email, hash kodu, liczniki prób (`actions/auth.ts`) | weryfikacja rejestracji | nie | w trybie bez SMTP kod "1234" (mock), patrz ryzyka |
| 4 | Dane ciała w profilu | `users`: weightKg, heightCm, age, sex, activityLevel | kalkulacje kcal, plany | tak (waga, wzrost, płeć w kontekście celów) | podawane przy rejestracji (`lib/validations/register.ts`), wiek min. 13 |
| 5 | Waga | `weight_logs` (waga, notatka), `daily_checkins` (waga, sen, energia, stres, notatki, summaryJson) | śledzenie postępów | tak | notatki to tekst wolny - mogą zawierać dowolne dane zdrowotne |
| 6 | Raporty ciała | `body_reports`: obwody (talia, klatka, udo, ramię, brzuch), waga, samopoczucie (energia, sen, trawienie), zgodność z dietą/cardio, notatki | analiza postępów | tak (trawienie, samopoczucie) | import XLSX: `app/api/body-reports/import` |
| 7 | Zdjęcia sylwetki | `body_report_photos.dataUrl`, `user_settings.startPhotoDataUrl` (data URL w DB, szyfrowane AES-256-GCM przy ustawionym `APP_ENCRYPTION_KEY`; `lib/app-field-crypto.ts`) | porównanie postępów | tak (obraz ciała, możliwe dane biometryczne w rozumieniu ryzyka, wizerunek) | serwowane tylko właścicielowi (`app/api/media/body-report-photo/[id]`, `start-photo`); zdjęcia NIGDY nie są usuwane przez retencję |
| 8 | Dziennik posiłków i cele żywieniowe | `meal_logs` (nazwa, slot, EAN, kcal, makro), `user_settings`: training/restNutritionGoalsJson, nutritionDayTypesJson, mealTemplatesJson | dziennik, cele | tak (dieta, cele kaloryczne) | wpisy wolnotekstowe |
| 9 | Treningi i cardio | `workouts`, `training_sessions`, `workout_plans`, `active_workout_sessions` (payloadJson, deviceId), cardio (zapis na `/cardio/record`, GPS przez przeglądarkę, zdjęcie z urządzenia cardio szyfrowane `lib/cardio-device-photo.ts`) | dziennik, coach | pośrednio (kondycja, tętno, kontuzje w planach) | `TrainingPlanInput` zawiera `injuriesOrLimitations` (`ai/coach.ts`) |
| 10 | Cele i preferencje | `user_settings`: fitnessGoalsJson, reportCadenceDays, remindersJson, aiEntitled, aiFeaturesDisabled | personalizacja | częściowo | |
| 11 | Płatności pakietów | `subscription_orders` (kwota, status, hotpayPaymentId), `users.packageEndsAt`, `packagePlanSku`; do HotPay trafia e-mail i nazwa usługi (`app/api/package/checkout`) | umowa, księgowość | nie | CASCADE przy usunięciu konta - kolizja z obowiązkiem przechowywania dokumentów księgowych |
| 12 | Społeczność - treści | `teams` (nazwa, opis), `team_posts` (tekst, snapshot), `team_post_media` (zdjęcia, data URL), `team_post_comments`, `chat_messages`, reakcje, wzmianki, `challenges`, `user_activity_posts` | funkcje społecznościowe | zdjęcia i posty mogą ujawniać ciało/zdrowie | brak potwierdzenia szyfrowania zdjęć feedu; retencja czatu 90 dni, zdjęcia feedu bez limitu |
| 13 | Społeczność - profil i relacje | `user_social_profiles` (visibility domyślnie `friends`, bio, showStats=1, showOnGlobal=1, discoverable=1), `friendships` (w tym blocked, share_workout), `user_follows`, `friend_live_presence` (trening na żywo), `group_workout_*`, XP, reputacja, odznaki, `hof_awards` | ranking, znajomi, live | pośrednio (aktywność fizyczna na żywo) | domyślnie włączone: widoczność w rankingu globalnym i wyszukiwaniu (opt-out) |
| 14 | Powiadomienia i push | `notifications`, `push_subscriptions` (endpoint, klucze p256dh/auth, userAgent), `reminder_dispatches`, e-mail przypomnienia | przypomnienia | nie | wymaga zgody/ustawienia (ePrivacy/PKE) - mechanizm: ustawienia przypomnień + zgoda przeglądarki |
| 15 | Analityka własna | `page_views` (screenKey, pathname, userId, visitorId z localStorage, env); `site_activity_log` (akcja, metaJson, userId) | statystyki, bezpieczeństwo | nie | page_views tylko po zgodzie "analityka" (`components/analytics-tracker.tsx`); `site_activity_log` zapisywany bez zgody (np. "Rejestracja konta") |
| 16 | Analityka zewnętrzna | PostHog (EU host domyślnie), zdarzenia Community z `distinctId` = ID użytkownika (`lib/analytics/track.ts`, `posthog.ts`) | analityka produktowa | nie | wywoływane po stronie serwera BEZ sprawdzania zgody |
| 17 | Dziennik błędów | logi serwera (`lib/errors/server-log.ts`: ścieżka bez query, requestId, stack), `/api/client-errors` (komunikat do 300 znaków, ścieżka, element klikniętego), Sentry (`sendDefaultPii:false`, trace 5%) | diagnostyka | ryzyko pośrednie | stack/message wyjątków i `detail` z klienta mogą zawierać dane z treści; Sentry po stronie klienta ładowany bez zgody |
| 18 | Zgłoszenia błędów | `bug_reports` + `bug_report_photos` (zrzuty ekranu, szyfrowane), `admin_note` | wsparcie | zrzuty mogą ujawniać dane z ekranu | |
| 19 | Administracja | `admin_audit_log` (retencja 180 dni), `app_settings`, panel `/admin` z podglądem użytkowników (`api/admin/users/[id]/detail`) | utrzymanie | admin ma dostęp do danych użytkowników | brak opisanej zasady dostępu minimalnego |
| 20 | Reklamy (Android/web) | AdMob + Google UMP (`android/`, `components/ads`, `consent-preferences.ts`) | finansowanie darmowej wersji | nie | uprawnienia Androida: CAMERA, POST_NOTIFICATIONS, exact alarm, REQUEST_INSTALL_PACKAGES |
| 21 | Dane produktów | Open Food Facts (ODbL), USDA FoodData Central; zapytania wyszukiwarki i EAN wysyłane do API serwisów | katalog produktów | nie (zapytanie bez ID użytkownika - do potwierdzenia) | licencje: OFF ODbL (atrybucja, share-alike dla bazy pochodnej), USDA domena publiczna |

Wniosek ogólny: aplikacja przetwarza na dużą skalę dane o ciele i zdrowiu (waga, obwody, zdjęcia sylwetki, dieta, samopoczucie). Wymagana jest DPIA (art. 35) i podstawa z art. 9 ust. 2 lit. a (wyraźna zgoda) dla funkcji wykraczających poza to, co użytkownik sam wprowadza do własnego dziennika - ocena podstawy należy do prawnika.

## 2. Odbiorcy, podmioty przetwarzające i transfery poza EOG

Wszystkie pozycje poniżej: umowy powierzenia (DPA), lokalizacja i mechanizm transferu (decyzja adekwatności / SCC / EU-US DPF) - **do potwierdzenia, brak dokumentacji w repo**.

| Podmiot | Rola | Dane | Transfer poza EOG | Uwagi |
|---------|------|------|-------------------|-------|
| Vercel (hosting, Preview, Cron) | procesor | całość ruchu, logi | tak (USA, możliwy region EU) | `vercel.json`, `NEXT_PUBLIC_APP_URL`; dokumenty wspominają też Render i VPS (`env.example`, `.cursor/agents/vps-docker-production.md`) - ustalić produkcyjny hosting |
| Render | procesor (monitoring admin, ewent. hosting) | metryki | USA | `RENDER_API_KEY` |
| Turso / libSQL | procesor (baza główna) | wszystkie dane z sekcji 1 | zależnie od regionu | zdjęcia jako data URL w DB |
| Sentry | procesor | błędy, ścieżki, requestId, release | tak (USA/EU zależnie od DSN) | `sendDefaultPii:false`; brak scrubbingu danych w treści wyjątków |
| PostHog (EU host domyślnie) | procesor | userId, zdarzenia, team_id | EU (do potwierdzenia projekt) | brak gating zgody po stronie serwera |
| Upstash Redis | procesor | klucze rate limit (IP, userId) | zależnie od regionu | opcjonalny |
| Pollinations (`gen.pollinations.ai`) | procesor / odbiorca | prompty grafik (przepisy, "NOWY MAX"); klucz API po stronie serwera | tak (poza EOG, do potwierdzenia) | brak danych użytkownika w promptach wg kodu `lib/pr-achievement-image.ts` (do potwierdzenia, czy tytuł/ćwiczenie użytkownika trafia do promptu) |
| Dostawca SMTP (Gmail/Outlook/inny) | procesor | adres e-mail, kod weryfikacyjny, przypomnienia | USA (Gmail/Microsoft) | używanie prywatnego konta Gmail do wysyłki produkcyjnej jest ryzykowne (brak DPA B2B) |
| Google / Meta (OAuth) | odrębni administratorzy | profil z logowania | USA | |
| HotPay (bramka płatności) | odrębny administrator / procesor | e-mail, kwota, nazwa usługi | PL/UE (do potwierdzenia) | `HOTPAY_*` |
| Google AdMob / UMP | odrębny administrator | identyfikator reklamowy, dane urządzenia | USA | zgoda marketingowa tylko w localStorage + most Android |
| Open Food Facts, USDA FDC | odrębni administratorzy/źródła | zapytania wyszukiwania, EAN, IP serwera | USA/FR | |
| GitHub (releases APK, Actions cron) | procesor/hosting plików | brak danych użytkowników | USA | |
| Własny backend Java (`java-backend/`) | część systemu | j.w. | | BFF z tokenem |
| Unsplash, CARTO (CSP `img-src`) | zewnętrzne zasoby | adres IP przeglądarki | USA | patrz `next.config.ts` |
| YouTube | zewnętrzny | linki techniki | USA | osadzenia YouTube wymagają informacji o cookies |

Mechanizmy w repo mające znaczenie dla bezpieczeństwa: CSRF (`lib/csrf.ts`), rate limiting, szyfrowanie pól (AES-256-GCM), CSP-report. Szyfrowanie jest opcjonalne - bez `APP_ENCRYPTION_KEY` zdjęcia zapisują się jawnie (tylko ostrzeżenie w logu, `lib/app-field-crypto.ts`).

## 3. Istniejące zgody, dokumenty i mechanizmy

### Jest
- `/regulamin` i `/polityka-prywatnosci` (`app/(legal)/...`), data "17 października 2026", dane administratora z env `LEGAL_*` (domyślnie placeholdery: "Sprzedawca GymBrat", brak adresu); flaga `incomplete` pokazuje niekompletność.
- Link/akceptacja w formularzu rejestracji ("Rejestrując się, akceptujesz...", `components/auth/register-form.tsx:777`) - informacja, nie osobne pole wyboru; brak zapisu faktu akceptacji i wersji.
- Banner cookies i ustawienia zgód (analityka, marketing) w `components/consent/*`; zapis tylko w `localStorage` (`gymbrat_consent_v1`, wersja 1, `decidedAt`), synchronizacja z mostem Androida; domyślnie wszystko wyłączone; wycofanie w Profilu - Prywatność i zgody.
- Eksport danych JSON/CSV: `GET /api/user/export` (`lib/user-data-export.ts`).
- Usunięcie konta: `DELETE /api/user/account` (CASCADE w DB, blokada usunięcia ostatniego admina).
- Retencja: cron `GET/POST /api/cron/cleanup` (`lib/db-retention.ts`): page_views 21 dni, activity_log 45, admin_audit 180, kody e-mail 14, notyfikacje 7/60/180, czat 90 dni, presence 2 dni, sesje treningu 7 dni. Świadomie NIE usuwa: treningów, posiłków, wag, kont, zdjęć.
- Zapis zastrzeżenia "nie stanowi porady medycznej" w regulaminie §10.
- Sentry z `sendDefaultPii:false`; logi serwera bez query i body.
- Minimalny wiek 13 w walidacji rejestracji.

### Braki
1. Brak rejestru zgód po stronie serwera (kto, kiedy, jaka wersja). Zgody tylko w przeglądarce; brak dowodu zgody (art. 7 ust. 1).
2. Brak wyraźnej zgody art. 9 na dane o zdrowiu/ciele i zdjęcia sylwetki; polityka nie wymienia zdjęć, danych zdrowotnych ani art. 9.
3. Polityka prywatności niepełna: brak wskazania konkretnych odbiorców (Sentry, PostHog, Upstash, Pollinations, SMTP, Turso), transferów poza EOG i ich zabezpieczeń, retencji per kategoria (zapis ogólny "czas trwania umowy"), profilowania/zautomatyzowanych rekomendacji, prawa cofnięcia zgody, danych w społeczności, push, geolokalizacji, Open Food Facts.
4. Brak DPIA, rejestru czynności przetwarzania (art. 30), ewidencji DPA, procedury naruszeń (72 h), ewentualnej oceny potrzeby IOD.
5. Weryfikacja wieku/zgoda opiekuna: wiek 13 to tylko pole liczbowe bez weryfikacji; art. 8 RODO i ustawa PL wymagają zgody opiekuna poniżej 16 lat dla usług społeczeństwa informacyjnego opartych na zgodzie. Brak zabezpieczeń przed zaburzeniami odżywiania (cele kaloryczne dla nastolatków).
6. Regulamin: brak zasad treści użytkowników (licencja, zakaz treści bezprawnych), procedury zgłaszania naruszeń i notice-and-action (DSA art. 16), kontaktu DSA (art. 11-12), warunków moderacji i uzasadnień (art. 17), polityki wobec wizerunku na zdjęciach, informacji o AI/grafikach AI, zastrzeżenia zdrowotnego w interfejsie (poza §10), szczegółowych informacji wymaganych dla treści cyfrowych (funkcjonalność, interoperacyjność), wzoru odstąpienia, klauzul nieuczciwych do przeglądu (§12 "dalsze korzystanie = akceptacja zmian", §4 zawieszenie konta).
7. Usunięcie konta: brak potwierdzenia hasłem/e-mailem, brak informacji o skutkach (zamówienia kasowane CASCADE mimo obowiązków księgowych), brak usuwania z PostHog/Sentry, brak zapisu żądania (rozliczalność).
8. Eksport niekompletny: nie obejmuje m.in. treści społeczności, czatu, znajomości, powiadomień, zamówień, push, zdjęcia startowego, zdjęć cardio, bug_reports, XP/odznak, social profile; brak maszynowego formatu dla wszystkich danych (art. 15, 20).
9. Brak mechanizmu wycofania zgody na przetwarzanie zdjęć/danych zdrowotnych (poza usunięciem pojedynczych raportów - do sprawdzenia w UI).
10. Brak polityki cookies jako osobnego dokumentu (sekcja 7 polityki jest ogólna; nie ma listy cookies/magazynu: `gymbrat_consent_v1`, visitor id, CSRF, sesja JWT, service worker/PWA cache, push); brak informacji o service workerze i powiadomieniach push.
11. Brak dokumentacji Google Play (Data safety) i deklaracji dostępności.
12. Brak zgody na przypomnienia e-mail/push opisanej w dokumentach (mechanizm techniczny jest).
13. Licencje: brak inwentarza licencji npm/Maven (`package.json` ma m.in. nodemailer - licencja MIT-0/EUPL według wersji do sprawdzenia, bcryptjs, Sentry, Drizzle); brak atrybucji OFF (ODbL) w UI wyników (jest etykieta "Open Food Facts · na 100 g", brak linku do licencji).

## 4. Ryzyka (priorytet: P1 krytyczny, P2 wysoki, P3 średni, P4 niski)

| ID | Ryzyko | P | Prawdop. | Skutek | Środek |
|----|--------|---|----------|--------|--------|
| R1 | Brak podstawy art. 9 (wyraźna zgoda) dla wagi, obwodów, zdjęć sylwetki, diety; brak DPIA | P1 | wysokie | kary UODO, nakaz usunięcia danych | zgoda warstwowa przy pierwszym użyciu funkcji (osobno: zdjęcia, dane zdrowotne), DPIA, wersjonowany zapis zgód w DB |
| R2 | Zgody wyłącznie w localStorage; brak dowodu i synchronizacji między urządzeniami | P1 | wysokie | nie da się wykazać zgody (art. 7) | tabela `user_consents` (userId, typ, wersja tekstu, status, timestamp, źródło) + endpointy nadania/wycofania |
| R3 | Dane o zdrowiu w logach/Sentry: `captureException` z oryginalnym wyjątkiem (message może zawierać wartości z SQL/payloadu), `/api/client-errors` zapisuje `detail`/`message` z klienta, Sentry klienta włączany bez zgody | P2 | średnie | wyciek danych wrażliwych do USA | scrubbing (`beforeSend`), wyłączenie `extra`, filtr wzorców, Sentry klienta po zgodzie lub jako uzasadniony interes z informacją, DPA, region EU |
| R4 | Niepełnoletni: min. wiek 13 bez weryfikacji i zgody opiekuna; cele wagi/kalorii, ranking, czat, zdjęcia sylwetki; ryzyko zaburzeń odżywiania | P1 | wysokie | RODO art. 8, DSA art. 28 (ochrona małoletnich), reputacja | podnieść próg do 16 lub dodać zgodę opiekuna; dla <18: wyłączyć zdjęcia sylwetki, cele deficytu kalorycznego, widoczność publiczną; ostrzeżenia |
| R5 | Funkcje społecznościowe: zdjęcia sylwetki/posty widoczne dla członków; domyślne `discoverable=1`, `showOnGlobal=1` (opt-out zamiast opt-in); brak funkcji zgłoszenia treści użytkownika (w kodzie jest tylko `moderationStatus`); brak regulaminu treści | P2 | wysokie | DSA (platforma hostingowa: art. 16, 17, 11-12), wizerunek, nękanie | domyślnie prywatne, formularz zgłoszeń, procedura moderacji, regulamin UGC, punkt kontaktowy DSA, blokowanie |
| R6 | Wizerunek na zdjęciach (osoby trzecie, twarze, lustra, zdjęcia z siłowni) | P2 | średnie | roszczenia z art. 81 pr. aut. i dóbr osobistych | licencja i oświadczenie użytkownika, zakaz zdjęć osób trzecich bez zgody, narzędzie usuwania |
| R7 | Retencja: zdjęcia, treningi, posiłki, wagi i konta bez limitu czasu; brak usuwania kont nieaktywnych; `site_activity_log` bez zgody | P2 | wysokie | zasada ograniczenia przechowywania (art. 5 ust. 1 lit. e) | zdefiniować okresy (np. nieaktywność 24 mies. - ostrzeżenie i usunięcie), ujednolicić z polityką |
| R8 | Usuwanie konta: nie czyści PostHog/Sentry/Pollinations; CASCADE usuwa zamówienia mimo obowiązku księgowego; brak potwierdzenia tożsamości przy usunięciu | P2 | średnie | niezgodność z art. 17 i przepisami podatkowymi | anonimizacja zamówień zamiast kasowania, usuwanie w PostHog (API), reauth |
| R9 | Eksport niepełny (sekcja 3, pkt 8) | P2 | wysokie | naruszenie art. 15/20 | rozszerzyć eksport o brakujące tabele (zadanie `backend`) |
| R10 | Server-side `track.*` do PostHog bez sprawdzenia zgody "analityka" i z identyfikatorem użytkownika | P2 | wysokie | ePrivacy (art. 173 PKE) / RODO | warunkować zgodą zapisaną w DB; pseudonimizacja distinctId |
| R11 | Tryb mock kodu e-mail "1234" włącza się automatycznie, gdy brak SMTP (także na produkcji) | P2 | średnie | rejestracja bez weryfikacji e-mail, konta cudzych adresów; zarazem brak potwierdzenia, że dana osoba kontroluje adres | wyłączyć na produkcji (sprawa dla `tester-bezpieczenstwa`) |
| R12 | AI: grafiki Pollinations (zewnętrzny dostawca poza EOG); lokalne heurystyki coacha i "analiza zdjęć" opisana w `ai/coach.ts` (`AiImage`) - należy potwierdzić, czy zdjęcia nie są wysyłane na zewnątrz | P3 | niskie | AI Act art. 50 (oznaczanie treści generowanych syntetycznie), przejrzystość | oznaczać grafiki AI w UI, opisać w polityce, potwierdzić brak wysyłki danych osobowych; klasyfikacja systemu jako niskiego ryzyka |
| R13 | Granica wyrobu medycznego: rekomendacje kcal, planów, "recovery score", wnioskowanie o przetrenowaniu i kontuzjach (`injuriesOrLimitations`) | P3 | niskie | MDR/UoWM, odpowiedzialność | zastrzeżenia w UI (nie diagnozuje, nie leczy), unikać sformułowań diagnostycznych, ocena indywidualna |
| R14 | Dokumenty prawne z placeholderami (`Sprzedawca GymBrat`, brak adresu/telefonu), brak wersjonowania; niedozwolone klauzule; zmiany regulaminu przez dalsze korzystanie | P2 | wysokie | brak identyfikacji administratora, niezgodność z UoŚUDE/UPK | uzupełnić `LEGAL_*`, wersjonować w `docs/prawo/`, tryb zmian zgodny z art. 384 KC i ustawą o prawach konsumenta |
| R15 | Prawo odstąpienia przy pakietach cyfrowych: w regulaminie opisano zgodę przy zakupie; do sprawdzenia czy checkout zbiera wyraźną zgodę i potwierdzenie utraty prawa (art. 38 pkt 13 UPK) | P2 | średnie | zwrot środków | zweryfikować UI `package-page-client` i zapis zgody w zamówieniu |
| R16 | Reklamy AdMob: zgoda marketingowa tylko po stronie klienta; UMP wymagane na Android; brak ujawnienia w Google Play Data safety | P3 | średnie | odrzucenie w Google Play | spisać Data safety, zgodność z TCF |
| R17 | Dostęp administratora do danych użytkowników (szczegóły konta, zdjęcia w bug reports) bez rejestru dostępu do danych wrażliwych | P3 | średnie | art. 32 | rola/uprawnienia, log dostępu, minimalizacja widoku |
| R18 | Wyszukiwanie produktów po EAN/zapytaniu do zewnętrznych API (IP serwera) - niskie ryzyko; licencja ODbL OFF | P4 | niskie | licencja | atrybucja, zachowanie share-alike |
| R19 | Brak procedury naruszeń (72 h), brak rejestru incydentów | P2 | średnie | art. 33-34 | procedura w `docs/prawo/`, rola odpowiedzialna |

## 5. Reguły LR do stosowania w przyszłych zadaniach

- **LR-1 (podstawa prawna)**: każda nowa operacja na danych osobowych ma wskazaną podstawę art. 6 i, dla zdrowia/ciała/zdjęć sylwetki, art. 9 ust. 2 (domyślnie wyraźna zgoda). Wpis do rejestru czynności (`docs/prawo/`).
- **LR-2 (zgody)**: zgody osobne, nieprzedwybrane, wersjonowane, zapisywane po stronie serwera (userId, typ, wersja tekstu, status, czas, źródło), wycofywane jednym kliknięciem, wycofanie zatrzymuje przetwarzanie. Zgoda w localStorage nie wystarcza jako dowód.
- **LR-3 (DPIA)**: nowa funkcja dotykająca zdjęć sylwetki, danych zdrowotnych, profilowania lub małoletnich wymaga oceny DPIA przed wdrożeniem.
- **LR-4 (małoletni)**: nowe funkcje nie mogą obniżać ochrony użytkowników poniżej 18/16 lat; cele wagowe/kaloryczne i publikacja ciała tylko z zabezpieczeniami.
- **LR-5 (logi i Sentry)**: zakaz zapisu wartości z danych zdrowotnych, treści postów, zdjęć i notatek w logach, `captureException`, PostHog i `site_activity_log.metaJson`; logować identyfikatory i kody błędów.
- **LR-6 (analityka)**: zdarzenia analityczne (klient i serwer) tylko po zgodzie zapisanej dla użytkownika; identyfikatory pseudonimizowane.
- **LR-7 (retencja)**: każda nowa tabela ma zdefiniowany okres przechowywania i wpis w `lib/db-retention.ts` albo uzasadnienie braku; zmiana retencji wymaga aktualizacji polityki.
- **LR-8 (usuwanie i eksport)**: każda nowa tabela z danymi użytkownika jest objęta eksportem (`lib/user-data-export.ts`) i usuwaniem konta (FK `onDelete`, anonimizacja tam, gdzie obowiązuje obowiązek prawny).
- **LR-9 (UGC)**: funkcje publikacji treści muszą mieć zgłoszenie naruszenia, moderację, blokowanie i domyślną prywatność; zdjęcia ciała domyślnie niewidoczne dla innych.
- **LR-10 (AI)**: każde użycie zewnętrznego AI wymaga wpisu w polityce, braku danych osobowych w promptach, oznaczenia treści syntetycznych i możliwości wyłączenia (`aiFeaturesDisabled`).
- **LR-11 (dostawcy)**: nowy dostawca = wpis w sekcji 2, DPA, ocena transferu, aktualizacja polityki i `lib/admin-config-status.ts`.
- **LR-12 (zastrzeżenia zdrowotne)**: komunikaty o kaloriach, planach, odpoczynku i kontuzjach nie mogą brzmieć jak diagnoza lub leczenie; widoczne zastrzeżenie w ekranach z rekomendacjami.
- **LR-13 (teksty prawne)**: zmiana funkcji wpływającej na dane wymaga zmiany polityki/regulaminu (wersja i data w `docs/prawo/`) i zatwierdzenia przez prawnika-człowieka przed publikacją.
- **LR-14 (płatności)**: zakup cyfrowy wymaga informacji przedumownych i wyraźnej zgody na rozpoczęcie świadczenia przed upływem terminu odstąpienia, zapisanej w zamówieniu.
- **LR-15 (licencje)**: nowa zależność lub zewnętrzna baza danych wymaga sprawdzenia licencji i atrybucji.

## 6. Pytania otwarte (do właściciela produktu)

Stan na 2026-10-23; odpowiedzi właściciela: [decyzje-wlasciciela.md](../zespol/decyzje-wlasciciela.md). Ocena skutków prawnych: [01-podstawy-prawne-i-retencja.md](01-podstawy-prawne-i-retencja.md).

1. ROZSTRZYGNIĘTE częściowo (D17): administrator to osoba prywatna. Otwarte: adres, rejestracja działalności przed sprzedażą pakietów (D10 nieustalone) - zob. 01, sekcja 4.1 i PO-4.
2. ROZSTRZYGNIĘTE częściowo (D1, D2): produkcja Render, docelowo VPS; regiony dostawców "prawdopodobnie Europa" - do potwierdzenia w panelach (01, PO-5, PO-6).
3. ROZSTRZYGNIĘTE (D18): minimalny wiek 16 lat. Otwarte: czy istnieją konta <16 (01, PO-2).
4. ROZSTRZYGNIĘTE (D19): zdjęcia sylwetki i czat tylko dla "właściciela" - interpretacja do potwierdzenia (01, PO-1).
5. ROZSTRZYGNIĘTE (D20): analiza zdjęć w `ai/coach.ts` nieużywana (kod do usunięcia lub potwierdzenia braku wysyłki).
6. ROZSTRZYGNIĘTE (D3, D22): brak SMTP, będzie dedykowana skrzynka.
7. ROZSTRZYGNIĘTE (D23): Android będzie w Google Play (01, sekcja 4.4).
8. ROZSTRZYGNIĘTE (D24): AdMob nieskonfigurowany; wymagania Play/UMP dopiero przy uruchomieniu reklam.
9. NOWE (D25): dane użytkownika trafiają do promptów Pollinations - rekomendacja minimalizacji w 01, sekcja 4.3.
10. NOWE (D8): właściciel chce usunąć eksport i usunięcie konta - ocena w 01, sekcja 3 (nie można bez zastąpienia).

## 7. Do zatwierdzenia przez prawnika-człowieka

Cała niniejsza analiza, w szczególności: klasyfikacja danych jako Z9, wybór podstaw prawnych, ocena kwalifikacji DSA (platforma hostingowa vs wyłącznie hosting treści), próg wieku, ocena DPIA, ocena granicy wyrobu medycznego, ocena transferów i tekst przyszłych dokumentów.
