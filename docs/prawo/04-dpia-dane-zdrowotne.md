# 04 - Ocena skutków dla ochrony danych (DPIA, art. 35 RODO) - PROJEKT

- Wersja: 0.1 (projekt roboczy), data: 2026-11-02. **SZKIC asystenta AI. Wymaga przeglądu i zatwierdzenia przez prawnika/specjalistę ochrony danych; nie deklarować jako zakończona.**
- Zakres: dane o ciele i zdrowiu (waga, obwody, samopoczucie, dieta i cele, tętno, kontuzje), zdjęcia sylwetki i zdjęcia z urządzeń treningowych, funkcje społecznościowe.

## 1. Opis przetwarzania
Aplikacja GymBrat (web/PWA i Android) prowadzi dziennik treningów, diety i postępów. Użytkownicy 16+ wprowadzają dane ręcznie; część funkcji (raport ciała, zdjęcia, tętno) wymaga osobnych, wyraźnych zgód zapisywanych w rejestrze `user_consents` (wersjonowane, wycofywalne). Dane trafiają do bazy (Turso), zdjęcia jako szyfrowane pola. Odbiorcy: patrz `03-podmioty-przetwarzajace.md`. Retencja: `01-…` oraz cron `api/cron/cleanup`.

## 2. Konieczność i proporcjonalność
- Cel: świadczenie usługi dziennika postępów (art. 6 ust. 1 lit. b) przy wyraźnej zgodzie na dane o zdrowiu (art. 9 ust. 2 lit. a).
- Minimalizacja: brak pełnej daty urodzenia (oświadczenie wieku), brak integracji z zewnętrznymi platformami zdrowia, brak wysyłania danych osobowych do generatora grafik AI.
- Ograniczenie przechowywania: usuwanie nieaktywnych kont (24 mies.) i zdjęć (12 mies.) po ostrzeżeniu e-mail; usunięcie na żądanie natychmiast.
- Prawa osób: eksport kompletny z schematu (art. 20), usunięcie z ponownym uwierzytelnieniem (art. 17), wycofanie zgody jednym kliknięciem (art. 7 ust. 3), publiczna instrukcja `/usun-konto`.

## 3. Ryzyka dla osób i środki
| ID | Ryzyko | Prawdop. | Skutek | Środki (stan w kodzie) | Ryzyko rezydualne |
|---|---|---|---|---|---|
| D1 | Nieuprawnione ujawnienie danych o zdrowiu / zdjęć | średnie | wysoki | szyfrowanie pól, zdjęcia widoczne tylko dla autora, CSRF, rate limiting, ponowne uwierzytelnienie przy usuwaniu, log audytu admina | średnie - wymaga ustawionego `APP_ENCRYPTION_KEY` na produkcji |
| D2 | Przetwarzanie bez ważnej zgody | niskie | wysoki | blokada serwerowa (403 `CONSENT_REQUIRED`) dla raportu ciała, zdjęć, tętna; rejestr zgód append-only | niskie |
| D3 | Dane małoletnich 16-17 (zaburzenia odżywiania, wizerunek) | średnie | wysoki | próg 16+, zakup od 18+, zdjęcia nieudostępniane | średnie - do dopracowania zabezpieczenia celów kalorycznych (poza zakresem US7) |
| D4 | Wyciek przez dostawców (logi, analityka) | średnie | średni | Sentry/PostHog tylko po zgodzie, bez PII, brak treści zdrowotnych w logach | niskie |
| D5 | Zbyt długie przechowywanie | średnie | średni | cron retencji, usuwanie nieaktywnych | niskie po włączeniu flagi i zatwierdzeniu okresów |
| D6 | Niedostępność praw (eksport/usunięcie) | niskie | średni | endpointy + publiczna strona; terminy art. 12 | niskie |
| D7 | Dostęp administratora do danych użytkowników | średnie | średni | log audytu, minimalizacja widoku (do wzmocnienia - R17) | średnie |
| D8 | Transfer poza EOG | średnie | średni | wybór regionów EU, DPA/SCC (do zawarcia) | do oceny po uzupełnieniu `03-…` |

## 4. Wnioski wstępne (do oceny prawnika)
DPIA jest wymagana (dane o zdrowiu na dużą skalę, potencjalnie dzieci i młodzież). Po wdrożeniu środków z kodu ryzyko rezydualne jest akceptowalne **pod warunkiem**: (1) zawarcia umów powierzenia, (2) ustawienia klucza szyfrowania i retencji u dostawców, (3) zatwierdzenia okresów retencji, (4) włączenia retencji nieaktywnych kont, (5) przeglądu D3/D7. Przy ryzyku rezydualnym „wysokim” - konsultacja z Prezesem UODO (art. 36).

## 5. Przegląd
Aktualizować przy każdej nowej funkcji dotykającej zdrowia/zdjęć (LR-1) oraz co najmniej raz w roku. Osoba odpowiedzialna: właściciel serwisu.
