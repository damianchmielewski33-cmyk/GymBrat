# Backlog zespołu

Kolejność zadań wynikająca z analizy bazowej (2026-10-23) i decyzji właściciela (`docs/zespol/decyzje-wlasciciela.md`). Każda pozycja to osobne zadanie z kartą w `docs/zadania/` i przejściem przez przepływ (`docs/zespol/przeplyw.md`).

## Po stronie właściciela (bez kodu)
- Założyć dedykowaną skrzynkę e-mail i ustawić `SMTP_*` na Render (warunek zadania 1).
- Sprawdzić w panelu Render: czy istnieje usługa Java, czy ustawiono `JAVA_API_BASE_URL` (D5).
- Potwierdzić regiony Turso, Sentry, PostHog, Upstash (D2).
- Przed uruchomieniem płatności: decyzja o działalności gospodarczej (D17, `docs/prawo/01-podstawy-prawne-i-retencja.md`).
- Projekty dokumentów prawnych przekazać do zatwierdzenia prawnikowi-człowiekowi.

## P0 - pilne (bezpieczeństwo produkcji)
| # | Zadanie | Przepływ | Źródło |
|---|---|---|---|
| 1 | Rejestracja: usunąć stały kod `1234` poza dev (bez SMTP rejestracja e-mail niedostępna), łączenie kont OAuth tylko przy zweryfikowanym e-mailu (Facebook), przegląd nadawania roli admina | pełny | W1 bezpieczeństwo, D3, D4, D6 |
| 2 | Java: wymagać `GYMBRAT_PROXY_TOKEN` (fail-closed), port 8080 tylko lokalnie w `docker-compose.yml` | skrócony / pełny jeśli Java działa na produkcji | W2, D5 |

## P1 - zgodność prawna
| # | Zadanie | Przepływ | Źródło |
|---|---|---|---|
| 3 | Rejestr zgód `user_consents` (zdrowie, zdjęcia, społeczność, analityka, reklamy, push), ekran zgód dla obecnych użytkowników, PostHog i Sentry klienta tylko po zgodzie | pełny | prawo R1-R5, LR |
| 4 | Wiek 16+: walidacja przy rejestracji, oświadczenie w rejestrze, obsługa istniejących kont poniżej 16, pakiety od 18 | pełny | D18 |
| 5 | Usuwanie konta z ponownym uwierzytelnieniem, anonimizacja zamówień zamiast kaskady, PostHog/Sentry, publiczna strona `/usun-konto` (Google Play); kompletny eksport; usunięcie przypomnień PWA i `push_subscriptions` | pełny | D8, D23 |
| 6 | Prompty Pollinations bez danych osobowych i zdrowotnych, oznaczenie grafik AI | pełny | D25 |
| 7 | Retencja: automatyczne usuwanie po okresach z `docs/prawo/01-podstawy-prawne-i-retencja.md` | pełny | D21 |

## P2 - decyzje produktowe i porządki
| # | Zadanie | Przepływ | Źródło |
|---|---|---|---|
| 8 | Usunąć rolę `trener` i ekran `inbox` | pełny (uprawnienia) | D7 |
| 9 | Usunąć PIN admina (`readAdminUnlockVerified`, `/api/admin/unlock`, `lock`, `ADMIN_PIN`, wpis w `admin-config-status`) | pełny (uprawnienia, env) | D15 |
| 10 | Tydzień cardio poniedziałek-niedziela w TS i Javie | pełny (zmiana reguły) | D9 |
| 11 | `getRecentWeightLogs` w `actions/weight.ts`: dodać `auth()` albo przenieść poza plik `"use server"` | skrócony | architektura R1 |
| 12 | Ujednolicić wersje i adres Androida (gradle, JSON, testy) na Render | skrócony | D16 |

## P2 - linia bazowa jakości (warunek bramek)
| # | Zadanie | Przepływ | Źródło |
|---|---|---|---|
| 13 | `npm test` na zielono: mock `server-only` w `vitest.config.ts`, nieaktualne asercje wersji Androida | skrócony | testy |
| 14 | `npm run lint` na zielono: 114 błędów (głównie reguły React Compiler) - etapami po obszarach | skrócony, kilka zadań | testy |

## P3 - wydajność i wygląd
| # | Zadanie | Przepływ | Źródło |
|---|---|---|---|
| 15 | Indeks `workouts(user_id, date)` | pełny (schemat) | wydajność D1 |
| 16 | Zdjęcia z Turso (data URL) do magazynu plików | pełny | wydajność |
| 17 | Cache danych i ograniczenie pollingu społeczności | pełny | wydajność |
| 18 | Ujednolicenie złota do tokenu, jeden kafel statystyki, kontrast tekstu | pełny (wygląd) | UX 1-5 |
| 19 | Usunąć martwe komponenty wskazane przez UX (po potwierdzeniu architekta) | skrócony | UX 11 |
| 20 | Oznaczyć `docs/performance-intelligence-engine-v2.md` i `docs/community-audit.md` jako historyczne | bez przepływu (dokumentacja) | `docs/analiza/01-aktualnosc-specyfikacji.md` |
