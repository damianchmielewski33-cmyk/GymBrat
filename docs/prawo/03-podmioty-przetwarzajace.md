# 03 - Podmioty przetwarzające i umowy powierzenia (art. 28 RODO) - PROJEKT

- Wersja: 0.1 (projekt roboczy), data: 2026-11-02. **SZKIC asystenta AI; wymaga weryfikacji i zawarcia umów przez człowieka (właściciela/prawnika).** W repo nie ma żadnej zawartej umowy powierzenia - kolumna „Status DPA” jest celowo „do zawarcia”.
- Źródło listy: kod i konfiguracja (`lib/admin-config-status.ts`, `package.json`, `00-inwentaryzacja-danych.md` sekcja 2).

| Dostawca | Usługa / rola | Dane | Lokalizacja i transfer (do potwierdzenia) | Status DPA | Uwagi |
|---|---|---|---|---|---|
| Turso (libSQL) | baza główna - procesor | wszystkie dane użytkowników | wybrany region bazy; jeśli poza EOG - SCC/DPF | **do zawarcia** (DPA z panelu dostawcy) | w bazie są zdjęcia (data URL, szyfrowane przy ustawionym `APP_ENCRYPTION_KEY`) |
| Vercel (lub inny hosting) | hosting, cron - procesor | ruch, logi | region funkcji (EU preferowany) | **do zawarcia** | ustalić hosting produkcyjny (Vercel / Render / VPS) |
| Sentry | monitoring błędów - procesor | błędy, ścieżki, requestId | EU/USA zależnie od DSN | **do zawarcia** | po zgodzie na analitykę (klient); serwer bez PII; ustawić retencję 30-90 dni |
| PostHog | analityka produktowa - procesor | id użytkownika (docelowo pseudonim), zdarzenia | host EU (potwierdzić projekt) | **do zawarcia** | tylko za zgodą „analityka” (serwerowo, Z12) |
| Upstash Redis | ograniczanie żądań - procesor | klucze (IP, id) | region bazy | **do zawarcia** (opcjonalny dostawca) | |
| Dostawca SMTP | e-maile transakcyjne i przypomnienia - procesor | e-mail, treść wiadomości | zależnie od dostawcy | **do zawarcia** | prywatne konto Gmail nie jest odpowiednie do produkcji (brak DPA B2B) - Z17 |
| HotPay | operator płatności - odrębny administrator / procesor (do ustalenia) | e-mail, kwota, nazwa usługi | PL/UE | **do zawarcia/ustalenia roli** | regulamin operatora; webhook z weryfikacją HASH |
| Google (AdMob/UMP, OAuth) | odrębny administrator | id reklamowy, profil logowania | USA | warunki Google (nie DPA) | reklamy tylko po zgodzie; Data Safety w Play Console |
| Meta (OAuth Facebook) | odrębny administrator | profil logowania | USA | warunki Meta | opcjonalne |
| Pollinations | generowanie grafik AI - odbiorca | **brak danych osobowych** (Z27) | poza EOG | nie wymagane przy braku danych osobowych (potwierdzić z prawnikiem) | utrzymać test regresji |
| Open Food Facts, USDA FDC | źródła danych | zapytania bez id użytkownika | FR/USA | n/d | licencja ODbL (atrybucja) |
| GitHub | repozytorium, wydania APK | brak danych użytkowników | USA | n/d | |

## Minimalna treść umowy powierzenia (checklista art. 28 ust. 3)
Przedmiot, czas, charakter i cel przetwarzania; rodzaj danych i kategorie osób; przetwarzanie tylko na udokumentowane polecenie; poufność personelu; środki bezpieczeństwa (art. 32); zasady podpowierzenia; pomoc przy prawach osób i naruszeniach (72 h); usunięcie/zwrot danych po zakończeniu; audyty i udostępnianie informacji; mechanizm transferu poza EOG.

## Co musi zrobić człowiek
1. Dla każdego dostawcy w statusie „do zawarcia”: zaakceptować DPA w panelu dostawcy lub podpisać; zapisać datę i wersję.
2. Potwierdzić region przetwarzania i mechanizm transferu; uzupełnić tabelę.
3. Ustawić retencję po stronie Sentry/PostHog (patrz `01-…`).
4. Po uzupełnieniu przekazać tabelę prawnikowi do akceptacji.
