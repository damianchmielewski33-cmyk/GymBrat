# ADR 0014 — Usunięcie backendu Java (Spring Boot)

## Status
Accepted (DK-4, 2026-11-02); zrealizowane w US11 (Z31/Z73).

## Kontekst
`java-backend/` był opcjonalnym BFF (proxy wybranych tras `/api/*` przy `JAVA_API_BASE_URL`). Produkcja go nie używała (D7 = bez Javy), a sama obecność niosła ryzyka: pusty `GYMBRAT_PROXY_TOKEN` oznaczał brak weryfikacji nagłówka `X-GymBrat-User-Id` (podszywanie się pod użytkownika), a lokalny compose wystawiał port 8080 na wszystkich interfejsach. Java nie miała trwałego magazynu danych treningowych.

## Decyzja
Usuwamy backend Java wraz z powiązaniami: katalog `java-backend/`, `lib/java-api.ts` (+test), gałęzie proxy w trasach `/api/body-reports`, `/api/workouts/complete`, `/api/version`, `/api/android/version` i `/api/android/download`, root `docker-compose.yml` oraz wpis „Backend Java (BFF)” w panelu Konfiguracja. Wszystkie trasy działają wyłącznie w TypeScript/Drizzle (dotychczasowa ścieżka legacy). Fail-closed dla tokenu (Z31) jest przez to zbędne: nie ma komponentu, który mógłby ufać nagłówkom.

## Konsekwencje
- `GET /api/version` nie zawiera już pola `backend`.
- Zmienne `JAVA_API_BASE_URL` i `GYMBRAT_PROXY_TOKEN` nie są używane i mogą zostać usunięte z hostingu.
- Aplikacja Android (WebView) pozostaje; jej workflow budowania używa Javy tylko jako toolchainu Androida.
- Przywrócenie Javy wymagałoby pełnej implementacji z trwałością i osobnego ADR.
