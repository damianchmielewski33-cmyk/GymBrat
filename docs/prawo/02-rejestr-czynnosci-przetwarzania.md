# 02 - Rejestr czynności przetwarzania (art. 30 RODO) - PROJEKT

- Wersja: 0.1 (projekt roboczy), data: 2026-11-02. Powiązane: `00-inwentaryzacja-danych.md`, `01-podstawy-prawne-i-retencja.md`, `03-podmioty-przetwarzajace.md`, `04-dpia-dane-zdrowotne.md`.
- **Status: SZKIC przygotowany przez asystenta AI na podstawie kodu. NIE jest zatwierdzony przez prawnika i nie jest poradą prawną.** Numery przepisów i okresy wymagają weryfikacji (data weryfikacji: [uzupełnić]).
- Administrator: dane z `lib/legal-seller.ts` (zmienne `LEGAL_*`); wg decyzji DK-1 osoba fizyczna, działalność nierejestrowana - **stan do potwierdzenia przez prawnika/doradcę podatkowego przed uruchomieniem sprzedaży** (patrz `01-…`, sekcja 4.1).
- Kontakt w sprawach danych: adres e-mail z `LEGAL_CONTACT_EMAIL`. IOD: nie wyznaczony (ocena obowiązku - pytanie PO-3 w `01-…`).

Skróty: B = art. 6 ust. 1 lit. b; C = lit. c; F = lit. f; A = lit. a; Z9-A = art. 9 ust. 2 lit. a. Numeracja czynności jak w `01-…`, sekcja 2. Środki bezpieczeństwa wspólne: TLS, hasła hashowane (bcrypt), CSRF, ograniczanie liczby żądań, szyfrowanie pól wrażliwych (AES-256-GCM, wymaga `APP_ENCRYPTION_KEY`), dziennik audytowy administratora, rozdzielenie ról, kopie zapasowe dostawcy bazy.

| # | Czynność | Cel | Kategorie osób | Kategorie danych | Podstawa | Odbiorcy | Transfer poza EOG | Retencja | Środki szczególne |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Prowadzenie konta | umowa o konto | użytkownicy 16+ | e-mail, imię, nazwisko, hash hasła, rola, wiek (oświadczenie) | B | hosting, baza (Turso), SMTP | zależnie od regionu - do potwierdzenia | do usunięcia konta; nieaktywność 24 mies. + ostrzeżenie 30 dni (cron, flaga) | ponowne uwierzytelnienie przy usunięciu |
| 2 | Logowanie Google/Facebook | umowa | użytkownicy | identyfikator dostawcy, e-mail, profil | B | Google, Meta (odrębni administratorzy) | USA (DPF/SCC - do potwierdzenia) | jak #1 | powiązanie tylko po weryfikacji e-maila |
| 3 | Kody weryfikacyjne e-mail | bezpieczeństwo | użytkownicy | e-mail, kod | F | SMTP | USA (zależnie od dostawcy) | do 24 h (cron) | kody jednorazowe |
| 4-6, 8-10 | Dziennik ciała, wagi, check-iny, raporty, dieta, cele | świadczenie usługi dziennika | użytkownicy | waga, wzrost, obwody, samopoczucie, dieta, cele (dane o zdrowiu) | B + Z9-A (zgoda „dane o zdrowiu i ciele”, rejestr `user_consents`) | baza, hosting | j.w. | do wycofania zgody / usunięcia konta / nieaktywności | blokada serwerowa bez zgody; szyfrowanie pól; eksport i usunięcie |
| 7 | Zdjęcia sylwetki i zdjęcie startowe | dokumentowanie postępów | użytkownicy | obrazy sylwetki (możliwe dane wrażliwe, wizerunek) | Z9-A (osobna zgoda „zdjęcia”) + B | baza, hosting | j.w. | do usunięcia przez użytkownika / wycofania zgody / 12 mies. nieaktywności (cron, flaga) | tylko autor widzi; szyfrowanie |
| 9 | Treningi, cardio, plany, aktywne sesje, tętno | świadczenie usługi | użytkownicy | wpisy treningowe, tętno wpisane przez użytkownika, kontuzje/ograniczenia, zdjęcia z urządzeń | B; Z9-A dla tętna, kontuzji i zdjęć urządzeń | j.w. | j.w. | konto / zgoda; sesje aktywne 7 dni | blokada serwerowa bez zgody (tętno, zdjęcia urządzeń) |
| 11 | Zamówienia pakietów | realizacja, księgowość | kupujący (18+) | kwota, plan, status, id płatności, dowód zgód, numer potwierdzenia, opcjonalnie nazwa/NIP | B, C | HotPay, hosting | PL/UE - do potwierdzenia | 5 lat od końca roku; po usunięciu konta odpięte od użytkownika | `user_id` nullable (ON DELETE SET NULL) |
| 12-13 | Społeczność, czat, profil społecznościowy | świadczenie funkcji | użytkownicy | posty, komentarze, czat, ranking | B; A dla udostępniania | j.w. | j.w. | konto; czat 90 dni; presence 2 dni | domyślnie prywatne |
| 14 | Przypomnienia i push | przypomnienia | użytkownicy | endpoint push, godziny przypomnień, e-mail | A (zgoda „push” w rejestrze) | SMTP, usługi push przeglądarek | USA | do wycofania zgody | cron wysyła tylko za zgodą |
| 15 | Analityka własna | statystyki | odwiedzający | widoki stron, aktywność | `page_views`: A; `site_activity_log`: F | hosting | j.w. | 21 / 45 dni | bez treści zdrowotnych |
| 16-17 | PostHog, Sentry | analityka, diagnostyka | użytkownicy | zdarzenia (id), błędy, ścieżki | A (analityka); F dla diagnostyki serwerowej | PostHog, Sentry | EU/USA - do potwierdzenia | PostHog 12 mies. [ustawić]; Sentry 30-90 dni | inicjalizacja tylko po zgodzie; `sendDefaultPii:false` |
| 18 | Zgłoszenia błędów | obsługa zgłoszeń | użytkownicy | opis, zrzuty ekranu | B, A dla zrzutów | administrator | - | zrzuty 90 dni, treść 12 mies. po rozwiązaniu (cron) | szyfrowanie zrzutów |
| 19 | Dziennik audytowy admina | rozliczalność, bezpieczeństwo | administratorzy, użytkownicy objęci akcją | akcje, identyfikatory | F, C | - | - | 180 dni | dostęp tylko admin |
| 20 | Reklamy AdMob/UMP | finansowanie wersji bez pakietu | użytkownicy bez pakietu | identyfikator reklamowy, dane urządzenia | A (UMP/CMP) | Google (odrębny administrator) | USA | do wycofania zgody | reklamy tylko po zgodzie marketingowej |
| 21 | Katalog produktów OFF/USDA | wyszukiwanie produktów | użytkownicy | zapytanie wyszukiwania (bez id użytkownika) | F | Open Food Facts, USDA | USA/FR | nie przechowujemy | - |
| 22 | Rejestr zgód i żądań | rozliczalność | użytkownicy | typ, wersja tekstu, status, czas, źródło | C (art. 7 ust. 1), F | - | - | czas przetwarzania + 3 lata [prawnik: 3 czy 6] | tylko dopisywanie (append-only) |
| 23 | Oświadczenie wieku | wykazanie progu 16+/18+ | użytkownicy | oświadczenie `age_16`, wiek | B/C | - | - | jak #22 | brak pełnej daty urodzenia |
| 24 | Generowanie grafik AI (Pollinations) | grafiki przepisów i „NOWY MAX” | - | **brak danych osobowych** (prompty ogólne) | - | Pollinations | poza EOG | po stronie dostawcy | test regresji w repo (Z27) |

## Uwagi do weryfikacji przez prawnika
1. Czy tętno wpisane ręcznie przy treningu należy traktować jako dane o zdrowiu (przyjęto: tak, ostrożnościowo). Czy aplikacja przetwarza kroki z urządzeń (obecnie: nie ma integracji z Apple Health/Google Fit - jeśli zostanie dodana, wymaga aktualizacji rejestru i polityki).
2. Okresy retencji (24/12 mies., 5 lat, 3 lata) - patrz `01-…`; kod ma je jako wartości domyślne konfigurowalne zmiennymi `RETENTION_*`.
3. Podstawa art. 6 dla pozycji #15 (`site_activity_log`) - uzasadniony interes wymaga testu równowagi (do sporządzenia).
4. Rejestr należy aktualizować przy każdej nowej czynności (reguła LR-1).
