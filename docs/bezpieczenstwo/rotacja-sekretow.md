# Procedura rotacji sekretów (Z57)

**Kiedy:** co 6–12 miesięcy, natychmiast po podejrzeniu wycieku (np. sekret w historii repozytorium, laptop utracony, zmiana osoby z dostępem) oraz przed zmianą widoczności repozytorium na publiczne. Rotację wykonuje właściciel (`[NA KONIEC]` w backlogu US10). Sekretów nie wpisujemy do repozytorium, czatu ani changelogu.

Ogólna kolejność: **1)** wygeneruj nową wartość, **2)** ustaw ją na hostingu (VPS: plik `.env` / sekrety kontenera), **3)** redeploy, **4)** zweryfikuj w panelu `/admin/settings` (Konfiguracja) i testem z tabeli, **5)** unieważnij starą wartość tam, gdzie to możliwe.

| Sekret | Gdzie ustawiony | Skutek rotacji | Weryfikacja |
|---|---|---|---|
| `AUTH_SECRET` (alias `NEXTAUTH_SECRET`) | env aplikacji | **Wszystkie sesje przestają działać** — użytkownicy muszą zalogować się ponownie. Rób poza godzinami szczytu. | Logowanie hasłem i Google/Facebook działa; `/admin` wymaga ponownego PIN-u. |
| `HOTPAY_SEKRET`, `HOTPAY_NOTIFICATION_PASSWORD` | env aplikacji **i** panel HotPay | Webhook z niezgodnym hasłem jest odrzucany (403 `INVALID_HASH`); płatności w toku mogą nie zostać zaksięgowane. Zmieniaj w HotPay i w env **w tej samej chwili**, najlepiej gdy nie ma otwartych zamówień `pending` (panel `/admin/orders`). | Płatność testowa na Staging (klucze testowe); zamówienia z oknem zmiany sprawdź w `/admin/orders` i zaksięguj ręcznie, jeśli trzeba. |
| `CRON_SECRET` | env aplikacji **oraz** sekret GitHub `CRON_SECRET` (workflow Reminders cron) i konfiguracja crona (Vercel/VPS) | Zadania cron (`/api/cron/*`) zwracają 401, dopóki wartości się różnią. | Uruchom workflow `Reminders cron` (`workflow_dispatch`) i sprawdź odpowiedź 200. |
| `APP_ENCRYPTION_KEY` | env aplikacji | **Nie zmieniać bez migracji** — dane zaszyfrowane starym kluczem (np. zdjęcia raportów) staną się nieczytelne. Zmiana wymaga skryptu ponownego szyfrowania (`lib/migrate-sensitive-encryption.ts`) i kopii zapasowej. | Odczyt zdjęcia raportu po zmianie. |
| `UPSTASH_REDIS_REST_TOKEN` | env aplikacji | Limity wracają do pamięci instancji, dopóki token jest błędny. | Panel Konfiguracja: „Limity żądań” = OK. |
| `SMTP_PASS` | env aplikacji | Kody rejestracji i e-maile przestają wychodzić. | Rejestracja testowa / reset hasła. |
| `TURSO_AUTH_TOKEN` | env aplikacji | Aplikacja traci dostęp do bazy do czasu redeployu. | Strona główna i `/api/version` odpowiadają. |
| Sekret TOTP admina (2FA) | baza (`admin_two_factor`, szyfrowany `APP_ENCRYPTION_KEY`) | Po rotacji: `/admin/2fa` → „Wyłącz 2FA” (kodem) i skonfiguruj od nowa; zapisz nowe kody awaryjne. | Wejście w panel nowym kodem. |
| `AUTH_GOOGLE_SECRET`, `AUTH_FACEBOOK_SECRET` | env aplikacji + konsola dostawcy | Logowanie OAuth nie działa do czasu zgodności obu stron. | Logowanie testowe przez dostawcę. |

## Po rotacji
1. Zapisz datę rotacji (notatka właściciela, bez wartości sekretów).
2. Jeśli powodem był wyciek: sprawdź logi dostępu i panel `/admin/orders` pod kątem nietypowych płatności, a w razie potrzeby unieważnij sesje (zmiana `AUTH_SECRET`).
3. Usuń stare wartości z menedżerów haseł i z poprzednich wdrożeń (Preview).

## Skan zależności
Workflow `.github/workflows/dependency-security.yml` uruchamia `npm audit --audit-level=high` na każdym PR, pushu na `main`/`master` i co poniedziałek; zależności z lukami High/Critical blokują scalenie. PR dodatkowo przechodzi przegląd nowych zależności (`dependency-review-action`). Nie ignoruj alertu bez wpisu w tym pliku z uzasadnieniem i terminem naprawy.

## Przed zmianą repozytorium na prywatne (Z33)
- `scripts/fetch-android-apk.mjs` pobiera `gymbrat.apk` z publicznego GitHub Release. Dla repozytorium prywatnego żądanie bez uwierzytelnienia zwróci 404 i build nie dostanie APK. **Najpierw** przenieś plik na publiczny adres (np. R2/CDN) i ustaw `ANDROID_APK_URL` w środowisku budowania, albo pozostaw Release w osobnym, publicznym repozytorium z samymi plikami APK.
- Sprawdź, czy `deploy-vps.yml` i inne workflow mają dostęp do repo (tokeny, `GITHUB_TOKEN`) i czy obraz w GHCR jest prywatny.
- Wykonaj skan sekretów w historii (np. `gitleaks detect`) i zrotuj każdy znaleziony sekret według tabeli powyżej, zanim zmienisz widoczność.
