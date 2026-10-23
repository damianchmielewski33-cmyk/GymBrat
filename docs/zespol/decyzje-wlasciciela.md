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
