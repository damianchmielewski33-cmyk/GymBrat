# GymBrat — Java backend (Android)

Spring Boot 3 serwuje publiczne endpointy aktualizacji APK dla aplikacji Android (WebView).

## Endpointy

- `GET /api/health` — status
- `GET /api/android/version` — JSON z `versionCode`, `versionName`, `apkUrl`
- `GET /api/android/download` — redirect 302 na APK

Aplikacja Android ładuje UI z Next.js GymBrat (`https://gym-brat.vercel.app`). Ten backend Java jest towarzyszącym API aktualizacji / self-hostingiem kontraktu Androida.

## Uruchomienie

```bash
cd java-backend
mvn spring-boot:run
```

Albo:

```bash
mvn -q -DskipTests package
java -jar target/gymbrat-android-backend-0.1.0.jar
```

Zmienne:

- `ANDROID_APK_URL`
- `ANDROID_VERSION_CODE`
- `ANDROID_VERSION_NAME`
- `ANDROID_NOTES`
- `PORT` (domyślnie 8080)
