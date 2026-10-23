# 00. Bazowy model zagrożeń GymBrat

- Data: 2026-10-23
- Autor: tester-bezpieczenstwa (analiza statyczna, bez testów na hostingu)
- Gałąź: `feat/error-handling-system`
- Zakres: `auth.ts`, `proxy.ts`, `app/api/**`, `actions/**`, `db/`, `java-backend/` (pobieżnie), upload/import, integracje AI, `next.config.ts`, `env.example`, `.gitignore`, `.github/workflows/`, `android/` (pobieżnie).
- Poza zakresem: DAST na lokalnej instancji, skan Maven (OWASP dependency-check), semgrep, weryfikacja konfiguracji na Vercel (zmienne środowiskowe), widoczność repozytorium GitHub.

## 1. Powierzchnia ataku

### 1.1 Role
| Rola | Źródło | Uwagi |
|---|---|---|
| Anonim | brak JWT | strony publiczne (`lib/auth-public-paths.ts`), wyjątki w `proxy.ts` |
| Zawodnik / trener | NextAuth JWT (`auth.ts`, 30 dni) | rola z formularza Credentials musi zgadzać się z `users.app_role` |
| Administrator | `users.app_role = admin`, `PRIMARY_ADMIN_EMAIL` (na stałe w `lib/admin-config.ts`), `ADMIN_EMAILS` | przyznawana automatycznie po e-mailu przy logowaniu (Credentials i OAuth) |
| Systemy | Vercel Cron / GitHub Actions (`CRON_SECRET`), HotPay (webhook HASH), Next do Javy (`GYMBRAT_PROXY_TOKEN`), aplikacja Android (WebView + most JS) | |

### 1.2 Punkty wejścia
- 75 route handlerów w `app/api/**/route.ts`, z czego publiczne bez sesji: `/api/android/*`, `/api/branding*`, `/api/catalog-meal-image/[id]`, `/api/csrf`, `/api/version`, `/api/client-errors`, `/api/security/csp-report`, `/api/analytics/*`, `/api/cron/*` (sekret), `/api/payments/hotpay/notify` (HASH), `/api/auth/*`.
- Server actions: 36 plików `actions/*.ts` z `"use server"`. Każda eksportowana funkcja async jest publicznym endpointem POST.
- Upload i import: `/api/workout-plans/import` (doc/docx/pdf/xlsx do 8 MB: mammoth, unpdf, word-extractor, xlsx), `/api/body-reports/import` (xlsx z pliku albo z URL, czyli pobranie po stronie serwera), zdjęcia jako data URL (`actions/start-photo.ts`, `lib/cardio-device-photo.ts`, raporty ciała, `lib/community/team-feed.ts`, branding admina).
- Java Spring (`java-backend/`): `/api/body-reports`, `/api/workouts/complete`, `/api/android/*`, `/api/version`, `/api/health`.
- Android: most `GymBratAndroid` (`android/app/src/main/java/pl/gymbrat/app/bridge/GymBratAndroidJsBridge.java`), deep linki, pobieranie i instalacja APK (`REQUEST_INSTALL_PACKAGES`).
- Generowanie grafik: `/api/recipe-image` (Pollinations, koszt).

### 1.3 Granice zaufania
1. Przeglądarka / WebView, potem Next (`proxy.ts` sprawdza tylko obecność JWT, autoryzację zasobu robi handler lub akcja).
2. Next, potem Java: nagłówek `X-GymBrat-User-Id` plus opcjonalny `X-GymBrat-Proxy-Token` (`lib/java-api.ts`).
3. Next, potem Turso/libSQL (Drizzle), Upstash, SMTP, Pollinations, HotPay, Google/Facebook OAuth.
4. Usługi zewnętrzne, potem Next: webhook HotPay, Cron, raporty CSP, pliki z URL użytkownika (SSRF).
5. CI (GitHub Actions), potem artefakty: APK, keystore, Vercel deploy hook.

### 1.4 STRIDE (skrót)
| Kategoria | Główne wektory w GymBrat |
|---|---|
| Spoofing | rejestracja bez weryfikacji e-maila (tryb mock), łączenie OAuth po e-mailu, podszycie pod Next w Javie bez tokenu |
| Tampering | IDOR w akcjach i handlerach, webhook HotPay |
| Repudiation | `lib/admin-audit.ts` (audyt admina), `site_activity_log` |
| Information disclosure | wagi, pomiary, zdjęcia (`/api/media/*`, `/api/user/export`, panel admina), błędy, Sentry |
| DoS | importy dokumentów (zip bomby), pobieranie z URL, koszt Pollinations, rate limit w pamięci |
| Elevation of privilege | auto-admin po e-mailu, niewymuszany PIN admina, rola w JWT bez odświeżania |

## 2. Mechanizmy obronne obecne w kodzie
- **Sesja**: JWT bez stałego fallbacku sekretu (`lib/auth-secret.ts`), uszkodzone ciasteczko nie powoduje 500 (`proxy.ts`), API bez sesji dostaje 401 JSON.
- **Hasła**: bcryptjs z kosztem 12 (`actions/auth.ts`, `actions/profile.ts`), zmiana hasła wymaga obecnego hasła.
- **Logowanie**: limit prób osobno na IP i na e-mail przed bcrypt (`auth.ts` `authorize`, `lib/rate-limit.ts` `RATE.loginIp/loginEmail`).
- **Kody e-mail**: HMAC-owy skrót kodu (`hashEmailCode`), ważność 10 min, atomowy licznik prób w `UPDATE` (`consumeCodeAttempt`), jednorazowe zużycie (`consumedAt`).
- **Limity akcji**: `guardAction` w każdej akcji (IP + skrót sesji + limity ścisłe) (`lib/action-guard.ts`); Upstash z fallbackiem w pamięci.
- **CSRF**: double-submit cookie + allowlista Origin + `Sec-Fetch-Site` (`lib/csrf.ts`); wszystkie mutujące route handlery poza webhookami, cronem i telemetrią wołają `assertCsrf`. Server actions mają wbudowaną kontrolę Origin Next.js.
- **Autoryzacja zasobu**: zapytania Drizzle filtrowane `userId` z sesji (np. `lib/body-report-photo-access.ts`, `app/api/media/cardio-photo/[workoutId]/route.ts`, `actions/workout-plan.ts`, `actions/meal-log.ts`); członkostwo w zespole/kanale (`assertActiveTeamMember`, `assertChannelAccess`), widoczność znajomych (`canWatchFriendLive`).
- **Admin**: `requireAdminApi` w każdym `/api/admin/*`, nadawanie roli admin tylko przez głównego admina, konto chronione (`app/api/admin/users/[id]/route.ts`), bootstrap jednorazowy z tokenem porównywanym w stałym czasie, audyt (`lib/admin-audit.ts`).
- **Szyfrowanie pól**: AES-256-GCM dla wrażliwych pól i zdjęć (`lib/app-field-crypto.ts`, `APP_ENCRYPTION_KEY`).
- **Odpowiedzi ze zdjęciami**: `Cache-Control: private, no-store`, `nosniff` (`lib/user-photo-response.ts`).
- **SQL**: wyłącznie Drizzle z parametrami; surowe `execute` tylko w `db/ensure-schema.ts` i PRAGMA (`lib/db-storage-budget.ts`) bez danych użytkownika.
- **XSS**: brak `dangerouslySetInnerHTML` w `app/`, `components/`, `lib/`; React escapuje treści społeczności.
- **Nagłówki** (`next.config.ts`): `nosniff`, `Referrer-Policy`, `frame-ancestors 'self' <AWP>`, `Permissions-Policy`, HSTS (prod), CSP Report-Only, `poweredByHeader: false`, brak map źródeł.
- **Webhook HotPay**: SHA-256 z hasłem notyfikacji, porównanie stałoczasowe, idempotencja `status = pending` (`lib/hotpay.ts`).
- **Sentry**: `sendDefaultPii: false` (`lib/sentry-init.ts`); `/api/client-errors` z Zod, limitem długości i usuwaniem znaków sterujących.
- **SSRF (częściowo)**: `/api/body-reports/import` blokuje localhost, część zakresów prywatnych, `redirect: "error"`, limit 5 MB i timeout.
- **Java**: porównanie tokenu proxy `MessageDigest.isEqual`, `redirect: "manual"` i timeout 15 s w `lib/java-api.ts`.
- **Android**: `usesCleartextTraffic=false` (wyjątek tylko dla 10.0.2.2/localhost), most JS tylko na `TrustedOrigins.isAppOrigin`, blokada `intent:`/`file:`/`javascript:`.
- **AI**: brak wbudowanego LLM (`ai/coach.ts`, `actions/backend.ts`), więc prompt injection do modelu nie dotyczy; Pollinations z limitami na użytkownika, IP i dzień oraz stałym prefiksem promptu dla trybu raw (`app/api/recipe-image/route.ts`).
- **Sekrety**: `.env*` i `*.pem` w `.gitignore`, `android/.gitignore` wyklucza `*.jks`, `*.keystore`, `keystore.properties`; `dependency-security.yml` w CI.

## 3. Podatności i słabości

### Wysokie

**W1. Rejestracja bez weryfikacji e-maila (tryb mock) połączona z automatycznym łączeniem kont OAuth i auto-adminem po e-mailu**
- Ścieżki: `actions/auth.ts:69-82` (`isRegisterEmailMockMode`: włącza się automatycznie przy braku SMTP, stały kod `1234`; komentarz „W produkcji chcemy przejściowo działać bez SMTP”), `actions/auth.ts:236`; `auth.ts` (`allowDangerousEmailAccountLinking: true` dla Google i Facebook; warunek `emailVerified === false` przepuszcza Facebooka, który nie zwraca `email_verified`); `lib/google-auth.ts` `resolveGoogleSignInUser` (łączenie po e-mailu); `lib/admin-config.ts` `parseAdminEmails` plus `auth.ts` `authorize`/`jwt` (rola admin po samym e-mailu).
- Scenariusz: gdy na hostingu nie ma SMTP, atakujący rejestruje konto na cudzy, jeszcze niezarejestrowany e-mail (kod `1234`) i zna hasło. Gdy ofiara później zaloguje się przez Google, jej logowanie OAuth zostaje dołączone do konta atakującego (pre-account takeover), a jej dane o ciele trafiają na konto, do którego atakujący ma hasło. Jeśli adres z `ADMIN_EMAILS` nie ma jeszcze konta, atakujący rejestruje go i dostaje rolę administratora z wglądem w dane zdrowotne wszystkich użytkowników.
- Dotkliwość: wysoka; krytyczna, jeśli produkcja działa bez SMTP i `ADMIN_EMAILS` zawiera adres bez konta. Do weryfikacji w panelu Konfiguracja.
- Poprawka (backend): tryb mock tylko przy `NODE_ENV !== "production"` albo wyłącznie przy jawnym `MOCK_REGISTER_EMAIL_CODE=1` na Preview, z wpisem w `lib/admin-config-status.ts`; flaga `emailVerified` na koncie i łączenie OAuth tylko z kontem o zweryfikowanym e-mailu; rola admin tylko z `app_role` w DB albo dla kont ze zweryfikowanym e-mailem; dla Facebooka nie łączyć kont automatycznie.
- Odniesienia: CWE-287, CWE-640, CWE-269; OWASP A07:2021; ASVS V2.5, V6.

**W2. Fail-open uwierzytelniania w Javie przy braku `GYMBRAT_PROXY_TOKEN` (warunkowa)**
- Ścieżki: `java-backend/src/main/java/pl/gymbrat/backend/security/UserContextFilter.java` (gdy token pusty, ufa `X-GymBrat-User-Id`), `java-backend/src/main/resources/application.yml` (`proxy-token: ${GYMBRAT_PROXY_TOKEN:}`), `docker-compose.yml` (port `8080:8080` na wszystkich interfejsach), `lib/admin-config-status.ts:352` (token oznaczony jako `optional`).
- Scenariusz: jeśli backend Java jest osiągalny z sieci bez skonfigurowanego tokenu, dowolny klient wysyła nagłówek z cudzym `userId` i czyta lub zapisuje raporty ciała (`/api/body-reports`) i treningi.
- Dotkliwość: wysoka, jeśli wdrożenie spełnia warunek; w przeciwnym razie średnia (brak defense-in-depth).
- Poprawka (backend): fail-closed (start Springa kończy się błędem bez tokenu poza profilem `local`), token wymagany w `admin-config-status` gdy ustawione `JAVA_API_BASE_URL`, bind portu do `127.0.0.1` w compose, docelowo podpisany JWT (HMAC) z `userId` i krótkim `exp` zamiast samego nagłówka.
- Odniesienia: CWE-306, CWE-290; OWASP API2:2023.

### Średnie

**S1. PIN panelu admina nie jest egzekwowany**
- Ścieżki: `lib/admin-session.ts:106` (`readAdminUnlockVerified` nigdzie niewywoływane), `app/api/admin/status/route.ts` (`unlocked: eligible`), `lib/admin-api.ts` (`requireAdminApi` bez sprawdzenia ciasteczka), `app/admin/(panel)/layout.tsx`.
- Scenariusz: przejęta sesja administratora (np. przez W1 albo kradzież ciasteczka) daje pełny dostęp do `/api/admin/users/[id]/detail` i danych zdrowotnych bez znajomości `ADMIN_PIN`. Limit prób PIN-u (`/api/admin/unlock`) chroni mechanizm, który niczego nie blokuje.
- Poprawka: wymagać `readAdminUnlockVerified` w `requireAdminApi` i w layoucie panelu albo świadomie usunąć PIN (ADR) i nie deklarować go jako zabezpieczenia.
- Odniesienia: CWE-308, ASVS V4.3.

**S2. Rola i ważność konta w JWT nie są odświeżane z bazy**
- Ścieżki: `auth.ts` callback `jwt` (`app_role` czytane z DB tylko, gdy w tokenie brak e-maila), sesja 30 dni; `actions/profile.ts` `changePassword` (bez unieważnienia sesji); brak resetu hasła.
- Scenariusz: odebranie roli admin, blokada lub usunięcie konta i zmiana hasła po wycieku nie wylogowują istniejących sesji przez maksymalnie 30 dni.
- Poprawka: pole `sessionVersion`/`tokenVersion` w `users`, sprawdzane w `jwt` (z krótkim cache), odświeżanie `app_role` przy `trigger` i co N minut.
- Odniesienia: CWE-613, ASVS V3.3.

**S3. SSRF z niepełną listą blokad w imporcie raportów z URL**
- Ścieżka: `app/api/body-reports/import/route.ts:17-60`.
- Braki: `127.0.0.0/8` poza `127.0.0.1`, adresy IPv6 mapowane na IPv4 (`::ffff:a.b.c.d`), `::`, `100.64.0.0/10`; TOCTOU (DNS rebinding między `dns.lookup` a `fetch`); komunikat ze statusem HTTP działa jak wyrocznia do skanowania; `arrayBuffer()` czyta całe ciało przed sprawdzeniem limitu.
- Scenariusz: zalogowany użytkownik sonduje usługi wewnętrzne hostingu (VPS/Docker z `docs/vps-docker-production.md`, metadane chmury).
- Poprawka: rozwiązanie DNS i połączenie przez ten sam zweryfikowany adres (agent z `lookup`), pełna lista zakresów (np. biblioteka `ipaddr.js`), strumieniowe ucięcie po 5 MB, ogólny komunikat błędu. Alternatywnie usunąć import z URL.
- Odniesienia: CWE-918; OWASP A10:2021, API7:2023.

**S4. Ukryty IDOR na wagach w server action**
- Ścieżka: `actions/weight.ts:48` `getRecentWeightLogs(userId, limit)`: eksport z pliku `"use server"`, bez `auth()` i z `userId` od klienta.
- Stan: funkcja nigdzie nie jest importowana (martwy kod), więc dziś najpewniej nie ma ID akcji w manifeście. Każde przyszłe użycie wystawi publiczny odczyt wag dowolnego użytkownika.
- Poprawka: usunąć albo przenieść do `lib/` z `import "server-only"`; reguła: w `actions/` żaden eksport nie przyjmuje `userId` od klienta.
- Odniesienia: CWE-639; OWASP API1:2023.

**S5. Android: zbyt szeroka lista zaufanych originów i pobieranie APK z dowolnego hosta**
- Ścieżki: `android/app/src/main/java/pl/gymbrat/app/security/TrustedOrigins.java` (`*.vercel.app` zawierające `gym-brat`, `*.onrender.com` zawierające `gymbrat`, dopuszczone `http`), `MainActivity.java:282` (każdy link `*.apk` pobierany przez DownloadManager).
- Scenariusz: atakujący zakłada projekt `gym-brat-x.vercel.app`; link z czatu społeczności otwiera go w WebView z dostępem do mostu `GymBratAndroid` (powiadomienia, alarmy, zewnętrzne URL-e, reklamy) i może podsunąć APK do instalacji.
- Poprawka: dokładna lista hostów (produkcja plus jawnie skonfigurowany Preview), tylko `https`, pobieranie APK wyłącznie z originu aplikacji i GitHub Releases tego repo.
- Odniesienia: CWE-940, OWASP M3/M8 (Mobile Top 10 2024).

**S6. Keystore podpisu Androida z hasłami w artefakcie CI**
- Ścieżka: `.github/workflows/android-signing-bootstrap.yml` (artefakt `gymbrat-android-release-keystore` z `.jks`, `keystore.properties`, hasłami; retencja 3 dni).
- Scenariusz: przy publicznym repozytorium artefakty może pobrać każdy zalogowany użytkownik GitHub. Wyciek klucza pozwala podpisać złośliwą aktualizację, którą Android zainstaluje jako update GymBrat.
- Poprawka: generować keystore lokalnie albo szyfrować artefakt kluczem publicznym właściciela; sprawdzić, czy workflow był uruchamiany przy publicznym repo (jeśli tak, rotacja klucza nie jest możliwa dla istniejących instalacji, więc ocenić ryzyko).
- Odniesienia: CWE-522, CWE-312.

**S7. Rate limit oparty o pierwszy `X-Forwarded-For` i fallback w pamięci**
- Ścieżki: `lib/rate-limit.ts:70` (`clientIpFromHeaders`), fallback in-memory bez Upstash.
- Scenariusz: poza Vercel (VPS za nginx z dopisywaniem nagłówka) atakujący zmienia `X-Forwarded-For` i omija limity per IP (rejestracja, PIN, import, Pollinations). Na serverless bez Upstash limit działa per instancja. Limit per e-mail przy logowaniu nadal działa.
- Poprawka: IP z `x-vercel-forwarded-for` / ostatniego zaufanego hopa (konfiguracja liczby proxy), Upstash wymagany w produkcji (wpis w `admin-config-status`).
- Odniesienia: CWE-307, CWE-348.

### Niskie
- **N1.** CSP tylko w trybie Report-Only, bez `script-src`; globalnie `Cross-Origin-Resource-Policy: cross-origin` i `COOP: unsafe-none` (`next.config.ts`). Po zebraniu raportów włączyć enforce z nonce.
- **N2.** SVG dopuszczone w data URL (`lib/app-branding-parse.ts:8`) i serwowane z originu aplikacji jako `image/svg+xml` (`/api/branding/asset/[slot]`, `/api/catalog-meal-image/[id]`, `lib/user-photo-response.ts`). Otwarcie bezpośrednie wykonuje skrypt SVG (admin lub self-XSS). Dodać `Content-Security-Policy: sandbox; default-src 'none'` dla odpowiedzi z obrazami albo odrzucać SVG poza brandingiem.
- **N3.** `app/api/cron/reminders/route.ts:27` porównuje `CRON_SECRET` przez `===` (nie w stałym czasie).
- **N4.** Webhook HotPay nie porównuje `KWOTA` z ceną zamówienia ani `SEKRET` z `HOTPAY_SEKRET` (`app/api/payments/hotpay/notify/route.ts`); ochrona opiera się wyłącznie na HASH.
- **N5.** Enumeracja kont: `sendRegisterCode` zwraca „Konto z tym e-mailem już istnieje” (`actions/auth.ts:151`); z limitem.
- **N6.** `android:allowBackup="true"` (kopie danych WebView, w tym ciasteczek sesji).
- **N7.** E-mail głównego admina na stałe w kodzie (`lib/admin-config.ts`), deweloperski PIN `1998` (tylko poza produkcją). Ujawnia cel ataku dla W1.
- **N8.** `trustHost: true` (`auth.ts`) jest bezpieczne na Vercel; na VPS wymaga proxy nadpisującego `Host`/`X-Forwarded-Host`.
- **N9.** Spring Boot 3.3.5 (`java-backend/pom.xml`) jest starszą linią; zaktualizować do bieżącej łatki (Tomcat/Spring Framework). Bez skanu Maven.
- **N10.** Import dokumentów do 8 MB parsowany w procesie (mammoth, unpdf, word-extractor, xlsx): ryzyko zip bomb i obciążenia CPU; brak limitu rozmiaru po dekompresji (`app/api/workout-plans/import/route.ts`).

## 4. Skan zależności i sekretów
- `npm audit --omit=dev`: **0 podatności**.
- `npm audit` (z dev): 9 (2 krytyczne, 1 wysoka, 6 średnich): `vitest`/`tinypool` (krytyczne), `vite` (wysoka), `esbuild`, `@esbuild-kit/*`, `drizzle-kit`, `vite-node`, `@vitest/mocker`. Dotyczą tylko narzędzi deweloperskich i CI (dev server, testy), nie bundla produkcyjnego. Zalecana aktualizacja.
- Maven: nie skanowano (brak `mvn`/dependency-check w sesji).
- Sekrety w plikach śledzonych (wzorce AWS, GitHub PAT, Google API key, klucze prywatne, URL Turso/Upstash, JWT, przypisania `secret|token|password = "<16+ znaków>"`): **brak trafień**.
- Historia git (326 commitów, `git log -G` dla tych samych wzorców; pliki `.env`, `.jks`, `.keystore`, `keystore.properties`, `.pem` kiedykolwiek dodane): **brak trafień**.
- `env.example`: same puste wartości/przykłady. `.gitignore`: `.env*` (z wyjątkiem `.env.example`), `*.pem`, APK; `android/.gitignore`: `*.jks`, `*.keystore`, `keystore.properties`, `local.properties`.

## 5. Checklista do przyszłych zadań
1. Każdy route handler: `auth()` i 401 na początku (proxy nie wystarcza: matcher pomija ścieżki kończące się na `.png/.jpg/.apk...` i `/api/android`); mutacje: `assertCsrf`.
2. Każda server action: `guardAction`, `auth()`, Zod na wejściu; **nigdy** `userId`/`ownerId` od klienta; pomocnicze funkcje z `userId` w `lib/` z `import "server-only"`, nie w `actions/`.
3. Każde zapytanie Drizzle o zasób użytkownika: `and(eq(table.id, id), eq(table.userId, session.user.id))` także w `update`/`delete`; dla zasobów współdzielonych `assertActiveTeamMember`/`assertChannelAccess`/`canWatchFriendLive`.
4. Endpointy admina: `requireAdminApi`, audyt w `lib/admin-audit.ts`, minimalizacja danych zdrowotnych w odpowiedziach.
5. Dane o ciele (waga, pomiary, zdjęcia, posiłki): szyfrowanie `encryptSensitiveField`, `Cache-Control: private, no-store`, brak w logach, Sentry, URL-ach i komunikatach błędów; sygnał do `prawnik`.
6. Upload: allowlista MIME (bez SVG dla treści użytkownika), limit rozmiaru przed parsowaniem i po dekompresji, parsowanie z timeoutem; brak `JSON.parse` wprost do obiektów bez walidacji Zod (prototype pollution).
7. Pobieranie z URL po stronie serwera: tylko z allowlisty hostów albo przez wspólny bezpieczny fetcher (pełna blokada zakresów, pin IP, bez przekierowań, strumieniowy limit).
8. Nowa zmienna środowiskowa bezpieczeństwa: wpis w `lib/admin-config-status.ts` i `env.example`; brak sekretu w produkcji = fail-closed, nie fallback.
9. Zmiany w `auth.ts`, `proxy.ts`, `lib/auth-public-paths.ts`, `lib/google-auth.ts`, `lib/admin-*`: wysokie ryzyko, obowiązkowy przegląd bezpieczeństwa i testy jednostkowe (np. `lib/auth-public-paths.test.ts`).
10. Nowe publiczne trasy: limit z `lib/rate-limit.ts`, brak danych osobowych, uzasadnienie w komentarzu w `proxy.ts`.
11. Java: każdy kontroler przez `UserContext.requireUserId`, filtr po `userId` w zapytaniach, token proxy wymagany.
12. Android: nowe metody `@JavascriptInterface` tylko dla `isAppOrigin`, walidacja argumentów; bez rozszerzania listy hostów wzorcami.
13. CI: brak sekretów w artefaktach i logach, minimalne `permissions`, akcje przypięte do wersji.
14. Przed merge: `npm audit --omit=dev` bez wysokich/krytycznych, `npm run deploy:check`, brak `dangerouslySetInnerHTML` bez sanitizacji.

## Werdykt bazowy
**ODRZUCONE** dla obecnego stanu (dotyczy przyszłych wydań, dopóki W1 i W2 nie zostaną usunięte albo wykluczone konfiguracją). Do potwierdzenia na hostingu przez właściciela: obecność SMTP i `MOCK_REGISTER_EMAIL_CODE`, zawartość `ADMIN_EMAILS`, publiczna dostępność backendu Java i `GYMBRAT_PROXY_TOKEN`, widoczność repozytorium i historia uruchomień `android-signing-bootstrap`.
Kierunek poprawek: W1, W2, S1 do S4, S7 dla `backend`; S5 i N6 dla Androida (`backend`/mobile); N1, N2 dla `frontend`/`backend`. Retest po poprawkach wykona tester-bezpieczenstwa.
