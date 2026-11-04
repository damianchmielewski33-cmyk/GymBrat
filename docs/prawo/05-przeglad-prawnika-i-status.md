# 05 - Pakiet dla prawnika: status dokumentów i otwarte kwestie (US7/Z15, Z28)

- Data: 2026-11-02. **Żaden dokument z tego pakietu nie jest zatwierdzony. Stan „gotowy” nastąpi dopiero po akceptacji prawnika-człowieka.**

## Dokumenty i teksty w aplikacji
| Element | Gdzie | Wersja | Status |
|---|---|---|---|
| Regulamin | `app/(legal)/regulamin/page.tsx` | `LEGAL_VERSIONS.documents` | szkic, baner „wersja robocza” widoczny |
| Polityka prywatności | `app/(legal)/polityka-prywatnosci/page.tsx` | j.w. | szkic |
| Usuwanie konta | `app/(legal)/usun-konto/page.tsx` | j.w. | szkic |
| Zgody przy zakupie | `lib/order-consents.ts` | `LEGAL_VERSIONS.orderTerms` | szkic |
| Zgody na dane wrażliwe | `lib/consents-client.ts` | `LEGAL_VERSIONS.sensitiveConsents` | szkic |
| Rejestr czynności | `02-rejestr-czynnosci-przetwarzania.md` | 0.1 | szkic |
| Podmioty i DPA | `03-podmioty-przetwarzajace.md` | 0.1 | szkic, brak zawartych umów |
| DPIA | `04-dpia-dane-zdrowotne.md` | 0.1 | szkic |
| Retencja | `01-podstawy-prawne-i-retencja.md` + `lib/retention-extra.ts`, `lib/db-retention.ts` | 0.1 | okresy do zatwierdzenia |

## Jak zatwierdzić (po akceptacji prawnika)
1. Wprowadzić poprawki w tekstach aplikacji i dokumentach.
2. W `lib/legal-versions.ts` podbić wersje (bez „szkic”) i ustawić `LEGAL_DOCS_APPROVED_BY_LAWYER = true` (znika baner „wersja robocza”).
3. Zatwierdzić okresy retencji; ustawić `RETENTION_INACTIVE_ACCOUNTS_ENABLED=1` dopiero po konfiguracji SMTP (bez wysłanego ostrzeżenia konta nie są kasowane).
4. Uzupełnić dane sprzedawcy (`LEGAL_*`) i zawrzeć umowy powierzenia (`03-…`).

## Retencja w kodzie (Z28) - domyślne wartości
| Dane | Okres | Mechanizm | Zmienna |
|---|---|---|---|
| Kody e-mail | 24 h | `api/cron/cleanup` | `RETENTION_EMAIL_CODES_HOURS` (tylko skracanie) |
| Aktywne sesje treningu | 7 dni | j.w. | `RETENTION_ACTIVE_WORKOUT_SESSIONS_DAYS` |
| Logi (page views / aktywność / audyt) | 21 / 45 / 180 dni | j.w. | `RETENTION_*` |
| Zgłoszenia błędów: zrzuty / treść | 90 / 365 dni od rozwiązania | `lib/retention-extra.ts` | `RETENTION_BUG_SCREENSHOT_DAYS`, `RETENTION_BUG_REPORT_DAYS` |
| Zdjęcia sylwetki | 12 mies. nieaktywności + ostrzeżenie 30 dni | j.w., **flaga domyślnie wyłączona** | `RETENTION_INACTIVE_PHOTOS_MONTHS` |
| Konta nieaktywne | 24 mies. + ostrzeżenie 30 dni | j.w., **flaga domyślnie wyłączona** | `RETENTION_INACTIVE_ACCOUNT_MONTHS`, `RETENTION_INACTIVE_WARN_DAYS`, `RETENTION_INACTIVE_ACCOUNTS_ENABLED` |

Wyłączone z automatu: administratorzy i konta z aktywnym pakietem. Nieaktywność = brak aktywności sesji (`users.last_active_at`, odświeżane co najwyżej raz na 12 h), a dla kont bez zapisu - data utworzenia.

## Otwarte kwestie dla prawnika
1. Role: czy HotPay to odrębny administrator czy procesor; czy Pollinations bez danych osobowych wymaga umowy.
2. Retencja rejestru zgód (3 czy 6 lat) i rejestru żądań.
3. Czy osoba prywatna bez działalności może sprzedawać pakiety (DK-1) - wpływ na regulamin, potwierdzenie zakupu bez VAT i obowiązek informacyjny.
4. Teksty zgód (zakup, zdrowie, zdjęcia, push), informacja o transferach poza EOG, polityka cookies (osobny dokument?).
5. DSA: punkt kontaktowy, zgłaszanie treści (funkcje społecznościowe) - poza zakresem tego pakietu.
6. Procedura naruszeń (72 h, R19) - jeszcze nie napisana.
