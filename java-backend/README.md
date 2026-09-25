# GymBrat — Java backend (Spring Boot)

API GymBrat napisane w **Java 17+ / Spring Boot 3**. Front (UI) zostaje w Next.js / TypeScript;
Next działa jako BFF: sesja NextAuth + opcjonalny proxy do tego serwisu (`JAVA_API_BASE_URL`).

## Endpointy

| Metoda | Ścieżka | Auth | Opis |
|--------|---------|------|------|
| GET | `/api/health` | public | status + `language: java` |
| GET | `/api/version` | public | provenance backendu GymBrat |
| GET | `/api/android/version` | public | JSON aktualizacji APK |
| GET | `/api/android/download` | public | redirect 302 na APK |
| GET | `/api/body-reports` | `X-GymBrat-User-Id` | lista raportów |
| POST | `/api/body-reports` | `X-GymBrat-User-Id` | nowy raport |
| POST | `/api/workouts/complete` | `X-GymBrat-User-Id` | zapis ukończonego treningu |

Chronione endpointy przyjmują nagłówek użytkownika od BFF Next.
Opcjonalnie wymagany jest też `X-GymBrat-Proxy-Token` (= `GYMBRAT_PROXY_TOKEN`).

## Uruchomienie

```bash
cd java-backend
mvn spring-boot:run
```

Albo:

```bash
mvn -q -DskipTests package
java -jar target/gymbrat-backend-0.2.0.jar
```

Testy:

```bash
mvn test
```

## Zmienne

| Zmienna | Opis |
|---------|------|
| `PORT` | port HTTP (domyślnie 8080) |
| `ANDROID_APK_URL` | URL APK |
| `ANDROID_VERSION_CODE` / `ANDROID_VERSION_NAME` / `ANDROID_NOTES` | nadpisania wersji |
| `GYMBRAT_PROXY_TOKEN` | wspólny sekret z Next (`GYMBRAT_PROXY_TOKEN`) |
| `GYMBRAT_CORS_ORIGINS` | CSV originów frontu |
| `GYMBRAT_SOURCE_REPO` | slug repo (domyślnie `damianchmielewski33-cmyk/GymBrat`) |
| `GYMBRAT_APP_VERSION` | wersja API |
| `GYMBRAT_GIT_SHA` | opcjonalny SHA deployu |

## Docker Compose

Z katalogu głównego repo:

```bash
docker compose up java-backend
```

Na froncie ustaw:

```bash
JAVA_API_BASE_URL=http://localhost:8080
GYMBRAT_PROXY_TOKEN=dev-shared-token
```

Bez `JAVA_API_BASE_URL` Next używa legacy handlerów TypeScript (Drizzle) — wygodne na Vercel,
dopóki Java API nie jest wdrożone osobno.
