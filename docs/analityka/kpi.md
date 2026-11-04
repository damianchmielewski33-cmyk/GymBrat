# KPI i lejek GymBrat (Z53)

Zdarzenia wysyła **serwer** (`lib/analytics/track-kpi.ts`) wyłącznie dla użytkownika z aktualną zgodą `analytics` zapisaną w bazie (Z12). Bez zgody lub bez `POSTHOG_KEY` nic nie wychodzi. Properties nie zawierają danych osobowych ani zdrowotnych. `distinct_id` = identyfikator konta; wszystkie zdarzenia mają `surface = "kpi"`, `analytics_schema = 1`.

## Zdarzenia

| Zdarzenie | Kiedy | Properties | Miejsce w kodzie |
|---|---|---|---|
| `kpi_user_registered` | konto utworzone | `role` | `actions/auth.ts` (`registerUser`) |
| `kpi_workout_completed` | zapisany trening siłowy | `kind` | `app/api/workouts/complete/route.ts` |
| `kpi_package_viewed` | wejście na `/package` | — | `app/(dashboard)/package/page.tsx` |
| `kpi_checkout_started` | nowe zamówienie (nie ponowne użycie `pending`) | `plan_sku`, `amount_grosze` | `app/api/package/checkout/route.ts` |
| `kpi_checkout_completed` | przejście `pending → paid` (webhook HotPay) | `plan_sku`, `amount_grosze` | `app/api/payments/hotpay/notify/route.ts` |

**Uwaga o zgodzie:** zgoda `analytics` jest opcjonalna na rejestracji; jeśli nie została wyrażona, rejestracja i późniejsze zdarzenia tego użytkownika nie są liczone. KPI w PostHog to zatem **próba użytkowników ze zgodą**, nie pełna populacja — pełne liczby (rejestracje, płatności) są w bazie i w panelu admina.

## Definicje metryk

- **Aktywacja** — konto, które w ciągu 7 dni od `kpi_user_registered` ma co najmniej jedno `kpi_workout_completed`.
- **Retencja D7 / D30** — odsetek zarejestrowanych, którzy mają `kpi_workout_completed` w dniu 7. / 30. po rejestracji (okno ±1 dzień; PostHog: Retention, zdarzenie początkowe `kpi_user_registered`, zdarzenie powrotu `kpi_workout_completed`).
- **Zainteresowanie płatnym pakietem** — odsetek zarejestrowanych z `kpi_package_viewed` w ciągu 30 dni.
- **Konwersja do płatności** — odsetek zarejestrowanych z `kpi_checkout_completed` w ciągu 30 dni.
- **Konwersja koszyka** — `kpi_checkout_completed / kpi_checkout_started` (w oknie 24 h).

## Lejek do odtworzenia w PostHog (ręcznie, w interfejsie)

Insight → Funnels, kolejność ścisła, okno 30 dni:

1. `kpi_user_registered`
2. `kpi_workout_completed`
3. `kpi_package_viewed`
4. `kpi_checkout_started`
5. `kpi_checkout_completed`

Dashboard „GymBrat KPI”: ten lejek, Retention (D7/D30) i trend `kpi_checkout_completed` z sumą `amount_grosze`. PostHog nie jest tworzony z repo — dashboard zakłada właściciel (zadanie poza kodem).

## Dodawanie zdarzeń

Dopisz nazwę i typ properties w `lib/analytics/kpi-events.ts`, wywołaj `trackKpi(...)` na serwerze po udanej mutacji i uzupełnij tabelę powyżej.
