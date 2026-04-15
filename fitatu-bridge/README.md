# Most Fitatu → GymBrat

Serwer HTTP implementujący kontrakt oczekiwany przez GymBrat (`POST /auth/login`, `GET /diary/YYYY-MM-DD`). Oficjalne API Fitatu nie istnieje — most działa w trzech trybach.

## Tryby

| `BRIDGE_MODE` | Opis |
|---------------|------|
| `mock` (domyślnie) | Logowanie zawsze udane; dziennik to deterministyczne dane demo (suma kcal = suma posiłków). Do lokalnego developmentu. |
| `forward` | Logowanie i dziennik są **przekazywane** na adresy z zmiennych `FITATU_UPSTREAM_*`. Użyj po przechwyceniu ruchu aplikacji mobilnej (np. mitmproxy, Charles) i uzupełnieniu URL-i. |
| `file` | `GET /diary/{data}` czyta plik `{FITATU_EXPORT_DIR}/diary-{data}.json` — możesz generować go własnym skryptem / eksportem. |

## Uruchomienie

```bash
cd fitatu-bridge
copy env.example .env
npm install
npm run dev
```

W GymBrat (`.env.local`):

```env
FITATU_API_BASE_URL=http://localhost:8787
```

Potem w **Profilu** zaloguj się na Fitatu (email/hasło w trybie `mock` — dowolne, byle niepuste) albo wklej token zwrócony z `/auth/login` (GymBrat zrobi to sam po zalogowaniu).

## Tryb `forward`

Uzupełnij w `.env` m.in.:

- `FITATU_UPSTREAM_LOGIN_URL` — dokładny URL `POST` z ciałem `{ "email", "password" }` (jeśli upstream wymaga innego JSON, rozszerz `forward.ts`).
- `FITATU_UPSTREAM_DIARY_URL_TEMPLATE` — np. `https://…/day/{{date}}` (placeholder `{{date}}`).
- Opcjonalnie: `FITATU_UPSTREAM_DIARY_AUTH_HEADER`, `FITATU_UPSTREAM_DIARY_AUTH_PREFIX` (domyślnie `Authorization` + `Bearer `).
- `FITATU_UPSTREAM_EXTRA_HEADERS_JSON` — np. nagłówki wymagane przez ich API.

Odpowiedź logowania jest skanowana pod kątem pól typu `accessToken`, `token`, `access_token` itd. (funkcja `extractUpstreamAuthToken`). Odpowiedź dziennika jest **normalizowana** do pól `calories`, `proteinG`, … (`normalize-diary.ts`).

## Tryb `file`

- `FITATU_EXPORT_DIR` — katalog z plikami `diary-2026-04-12.json`.
- Przykładowy kształt JSON jest w `samples/diary-2026-04-12.json`.

## Zdrowie procesu

`GET /health` — `{ "ok": true, "mode": "…" }`.

## Uwagi prawne

Automatyczne odwzorowanie nieoficjalnego API aplikacji komercyjnej może naruszać regulamin Fitatu. Tryb `forward` jest przeznaczony do **własnego** środowiska i źródeł, do których masz prawo — odpowiedzialność leży po stronie operatora mostu.
