# Decyzje właściciela produktu

Odpowiedzi właściciela na pytania otwarte zespołu (2026-10-23). Decyzje są wiążące dla analizy i projektu; zmiany w kodzie, które z nich wynikają, idą normalnym przepływem (`docs/zespol/przeplyw.md`).

## Hosting i konfiguracja
| # | Pytanie | Decyzja / stan |
|---|---|---|
| D1 | Produkcja | Obecnie Render (`gymbrat.onrender.com`), docelowo VPS. Vercel nie jest produkcją. |
| D2 | Regiony Turso, Sentry, PostHog, Upstash | Prawdopodobnie Europa - do potwierdzenia w panelach dostawców. |
| D3 | SMTP na produkcji | Brak. Konsekwencja: na produkcji działa tryb testowy kodu rejestracji `1234` (W1 w `docs/bezpieczenstwo/00-model-zagrozen-bazowy.md`) - podatność do pilnej naprawy. Docelowo dedykowana skrzynka e-mail (D22). |
| D4 | `ADMIN_EMAILS` | Pusta. |
| D5 | Backend Java na produkcji | Nieznane. W repo brak `render.yaml` i Dockerfile; do sprawdzenia w panelu Render, czy istnieje usługa Java i czy ustawiono `JAVA_API_BASE_URL`. |
| D6 | Repozytorium GitHub | Chwilowo publiczne. |
| D16 | Adres Androida | Render (`https://gymbrat.onrender.com/`). Wersje Androida w gradle / JSON / testach do ujednolicenia. |

## Produkt
| # | Pytanie | Decyzja |
|---|---|---|
| D7 | Rola `trener` | Usuwamy. Ekran `app/(dashboard)/inbox` (zaślepka pod wiadomości od coacha) usuwamy razem z nią. |
| D8 | Eksport danych, usunięcie konta, przypomnienia PWA | Właściciel uważa je za zbędne. Uwaga: usunięcie konta i eksport danych realizują prawa z RODO (art. 17, art. 20) - przed usunięciem wymagana ocena `prawnik`. Przypomnienia PWA można usunąć. |
| D9 | Tydzień cardio | Poniedziałek-niedziela (zastępuje kroczące 7 dni w `lib/cardio.ts`, także w Javie). |
| D10 | Zakres pakietu | Do ustalenia. |
| D11 | "Kody rabatowe", "Badania" | Do ustalenia. |
| D13 | Aktualność `docs/*.json` | Raczej nieaktualne - weryfikuje `analityk`. |
| D14 | Języki | Tylko polski. |
| D15 | PIN admina | Nie będzie PIN-u. Kod odblokowania (`lib/admin-session.ts`, `app/api/admin/unlock`, `lock`, `ADMIN_PIN`) do usunięcia jako martwy. |

## Prawo i dane
| # | Pytanie | Decyzja |
|---|---|---|
| D17 | Administrator danych | Osoba prywatna. |
| D18 | Minimalny wiek | 16 lat (dziś 13+). |
| D19 | Widoczność zdjęć sylwetki i czatu | Tylko dla właściciela. |
| D20 | Analiza zdjęć w `ai/coach.ts` | Nieużywana. |
| D21 | Podstawa prawna i retencja danych o ciele | Właściciel deleguje decyzję do `prawnik` (projekt roboczy do zatwierdzenia przez prawnika-człowieka). |
| D22 | Wysyłka e-maili | Będzie dedykowana skrzynka. |
| D23 | Android | Będzie publikowany w Google Play. |
| D24 | Reklamy AdMob | Jeszcze nieskonfigurowane. |
| D25 | Dane użytkownika w promptach Pollinations | Tak, trafiają (dane do odbiorcy poza EOG). |

## Zadanie 001 (2026-10-23)
| # | Pytanie | Decyzja |
|---|---|---|
| DW-1 | Czy konta admin (w tym `damianchmielewski33@gmail.com`) należą do właściciela | Tak, jedyne konto admin należy do właściciela. |
| DW-3 | `ADMIN_EMAILS` na Render przed wdrożeniem | Tak, właściciel ustawi przed Promote. |
| DW-4 | Google OAuth na produkcji | Skonfigurowany i działa. |
| DW-5 | Reguła R-B z ADR 0001 (unieważnienie hasła i sesji kont, do których Google dołączono po rejestracji hasłem) | Odrzucona. Takie konta dostają tylko `email_verified_at`; hasło i sesje bez zmian. Właściciel akceptuje ryzyko resztkowe: założyciel konta kodem `1234` może nadal znać hasło (ADR 0001, ryzyko A2/S2). |

## US1 — decyzje komercjalizacyjne (2026-11-02)
Zapisane na podstawie odpowiedzi właściciela (backlog US1). Kod zależny od decyzji ma być konfigurowalny (stała/flaga/env).

| # | Zadanie | Decyzja |
|---|---|---|
| DK-1 | Z1 Podmiot sprzedający | Osoba prywatna, **działalność nierejestrowana** (art. 5 Prawa przedsiębiorców). Warunki: limit przychodu (miesięcznie ok. 75% minimalnego wynagrodzenia) i brak działalności w ostatnich 60 miesiącach. **Do zatwierdzenia przez prawnika-człowieka**; dane sprzedawcy w `lib/legal-seller.ts` bez zmian; faktury (Z21) projektowane jako rachunki/potwierdzenia bez VAT; limit sprzedaży konfigurowalny. Zmienia D17 tylko co do formy sprzedaży. |
| DK-2 | Z2 Model Free/Premium | Cennik bez zmian (3,99 / 8,99 / 24,99 / 79,99 zł za 7 / 30 / 90 / 365 dni), płatność jednorazowa, bez odnowień automatycznych, bez okresu próbnego. |
| DK-3 | Z3 Reklamy | **Konfigurujemy AdMob**; pakiet znosi reklamy. Wymaga zgód (CMP) w US3 i konta AdMob po stronie właściciela. Uwaga: obowiązuje D18 (minimalny wiek 16 lat). |
| DK-4 | Z18 Java | Usuwamy backend Java (Z31 fail-closed na czas przejściowy, Z73 usunięcie). |
| DK-5 | Z18 iframe AWP | Zostaje bez zmian. |
| DK-6 | Z18 Repo | Prywatne, **na końcu** (Z33, rotacja sekretów Z57 robi właściciel). |
| DK-7 | Z19 Android | **Opcja B: Google Play Billing.** Konsekwencje do wyceny w US19/Z51 i US2: drugi kanał płatności, weryfikacja zakupów po stronie serwera, prowizja Google; zakupy cyfrowe w aplikacji Android muszą iść przez Play Billing. |
| DK-8 | Z82 Mapa Premium | Pierwsze dwie funkcje: zaawansowana analiza postępów i raporty PDF (PDF dotyka danych o ciele: `gymbrat-sensitive-data`). |
| DK-9 | Z54 / D11 | Kody rabatowe (`/promo-codes`) i Badania (`/labs`) ukryte za flagą do czasu definicji produktu; bez kasowania kodu. Dotyczy tylko części „decyzja" Z54. |

## US3 — decyzje (2026-11-02)
| # | Zadanie | Decyzja |
|---|---|---|
| DK-10 | Z13 Konta < 16 | Blokada do potwierdzenia wieku: konta z wiekiem < 16 wracają na uzupełnienie profilu (min. 16 + oświadczenie w rejestrze zgód). Automatycznego usuwania takich kont nie robimy bez osobnej zgody właściciela i oceny prawnika. Zakup pakietu od 18 lat. |
| DK-11 | Z81 Przypomnienia | Zostają, za zgodą `push` w rejestrze zgód (włączenie przypomnień zapisuje zgodę, wyłączenie ją cofa). |
| DK-12 | Z9/Z10 Zakres Premium i karencja | Premium blokuje wyłącznie **nowe** funkcje (raport postępów do wydruku/PDF z zaawansowaną analizą, `/progress/report`); obecne darmowe funkcje nie są zabierane. Reklamy znikają po aktywacji pakietu. **Bez karencji** po wygaśnięciu pakietu. |
| DK-13 | Z9 Checkout | Zakup pakietu wyłączony flagą (`PREMIUM_CHECKOUT_ENABLED=1` włącza); do czasu włączenia `/package` pokazuje „wkrótce”, a API zwraca 503. |
| DK-14 | Z24 Przypomnienia o końcu pakietu | Baner w aplikacji przy ≤ 7 dniach + e-mail przy ≤ 3 dniach, tylko za zgodą `push`, raz na okres (wymaga SMTP z Z17). „Przedłuż” wybiera ten sam plan; przedłużenie liczone od końca bieżącego pakietu. |
| DK-15 | Z14 Ponowne uwierzytelnienie | Usunięcie konta wymaga hasła **albo** świeżego logowania (≤ 5 min; dla Google/Facebook ponowne logowanie z `prompt=login`) oraz frazy USUŃ. Bez kodu e-mail (nie zależy od SMTP). |
| DK-16 | Z14 Termin usunięcia | Natychmiast i nieodwracalnie (bez karencji). Zamówienia odpinane od konta, dokumentacja sprzedaży zostaje (Z7). |
| DK-17 | Z14 E-mail po usunięciu | Wysyłany best-effort na adres sprzed usunięcia (po SMTP z Z17); adresu nie zapisujemy. |
| DK-18 | Z28 Retencja | Nieaktywne konta (24 mies., ostrzeżenie e-mail 30 dni wcześniej) i zdjęcia sylwetki (12 mies.) usuwa cron **domyślnie wyłączony** (flaga `RETENTION_INACTIVE_ACCOUNTS_ENABLED=1`, po zatwierdzeniu okresów przez prawnika i SMTP). Zgłoszenia błędów: zrzuty 90 dni i treść 12 mies. od rozwiązania - od razu. |

## US8 — decyzje (2026-11-02)
| # | Zadanie | Decyzja |
|---|---|---|
| DK-19 | Z50 Wsparcie i reklamacje | Zgłoszenia zapisywane w bazie (`support_requests`) i obsługiwane w panelu admina (`/admin/support`); termin odpowiedzi 14 dni (regulamin §8). Punkt wejścia: publiczna strona `/pomoc` (kontakt, FAQ, formularz dla zalogowanych) z linkami w menu, Profilu → Konto i regulaminie. E-mail potwierdzający best-effort (wymaga SMTP z Z17). Treść FAQ i §8 to szkic do zatwierdzenia przez prawnika. |


## US9 — decyzje (2026-11-02)
| # | Zadanie | Decyzja |
|---|---|---|
| DK-20 | Z22/Z75 Zamówienia i finanse | Ręczne „zaksięguj” nadaje pakiet (jak webhook, jednorazowo) i ustawia status `manual`; zwrot = notatka + status `refunded` (zwrot pieniędzy robisz w HotPay), **bez cofania dni pakietu**; przychód w panelu finansowym = zamówienia `paid`, a `manual` i `refunded` pokazane osobno; konwersja = zapłacone / utworzone zamówienia (30 dni). Doprecyzowanie z AC: `pending` > 24 h wygasa (`expired`), ponowne kliknięcie w 15 min używa istniejącego `pending`, alert dla `pending` > 1 h i `paid` bez pakietu (Sentry z tagiem `area=payments` + widżet). Dokument sprzedaży (Z21) nadal wystawiany tylko dla `paid`. |

## US10 — decyzje (2026-11-02)
| # | Zadanie | Decyzja |
|---|---|---|
| DK-21 | Z29/Z30/Z56 Utwardzenie HTTP | CSP z nonce budowana w `proxy.ts` (`lib/csp.ts`); **domyślnie Report-Only**, egzekwowanie włącza env `CSP_MODE=enforce` po analizie raportów i teście na Preview (strony renderowane per żądanie, bo nonce). `frame-ancestors` zawsze egzekwowane: domyślnie `'self'` + AWP (DK-5), własna lista w `FRAME_ANCESTORS_ALLOWED`, `none` blokuje. Produkcja za własnym proxy (Caddy): adres klienta tylko z `x-real-ip` (`TRUSTED_IP_HEADER` zmienia), `x-forwarded-for` ignorowany. Brak Upstash na produkcji: wpis „wymagane” w Konfiguracji, limity w pamięci instancji (bez blokowania logowania). |

## US11 — decyzje (2026-11-03)
| # | Zadanie | Decyzja |
|---|---|---|
| DK-22 | Z32 2FA admina | Drugi składnik: **TOTP** (aplikacja uwierzytelniająca, bez nowych bibliotek) + 10 jednorazowych kodów awaryjnych; konfiguracja na `/admin/2fa` (klucz wpisywany ręcznie, bez QR). Wymóg **za flagą `ADMIN_2FA_REQUIRED=1`, domyślnie wyłączony** (włączasz po sprawdzeniu, że kod działa; wpis w Konfiguracji). Blokada: 5 błędnych kodów 2FA lub 5 błędnych haseł na konto admina z danego adresu IP → 15 min (udane logowanie zeruje licznik; obcy z innego IP nie zablokuje właściciela). Po wejściu do panelu e-mail do admina (best-effort, wymaga SMTP) i wpis w dzienniku zdarzeń bezpieczeństwa. PIN (`ADMIN_PIN`, `/api/admin/lock`, `/unlock`) usunięty (D15). Z31/Z73: backend Java usunięty zgodnie z DK-4 (ADR 0014). |
