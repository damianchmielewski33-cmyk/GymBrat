# Aplikacja Android GymBrat (WebView + Java)

Natywna powłoka Android w **Javie** otwiera produkcyjny GymBrat w pełnoekranowym WebView.
Backend API (Java / Spring Boot) leży w `../java-backend` — wersja APK, health oraz domenowe REST.
Front web pozostaje w Next.js; przy `JAVA_API_BASE_URL` Next proxuje do Javy.

## Co dostajesz

- WebView 1:1 ze stroną `https://gym-brat.vercel.app`
- Most JS `window.GymBratAndroid` (`getVersionName`, `getVersionCode`, `checkUpdate`)
- User-Agent: `GymBratAndroidApp/<wersja> GymBratAndroidCode/<kod>`
- In-app update z `GET /api/android/version`
- Wybór plików / zdjęć z HTML (`input type=file`) przez `WebChromeClient.onShowFileChooser`

## Budowanie APK (bez Android Studio)

1. GitHub → **Actions** → **Build Android APK** → **Run workflow**
2. Po sukcesie: **Releases** → `gymbrat.apk`
3. Na telefonie: Profil / `/api/android/download` albo link z Releases

Lokalnie (wymaga Android SDK):

```bash
cd android
echo "sdk.dir=$ANDROID_HOME" > local.properties
echo "api.base.url=https://gym-brat.vercel.app/" >> local.properties
gradle :app:assembleRelease
```

APK: `app/build/outputs/apk/release/app-release.apk`

## Konfiguracja URL

- `android/gradle.properties` → `API_BASE_URL=…`
- albo secret GitHub Actions `ANDROID_API_BASE_URL`
- albo input w „Run workflow”

## Instalacja na telefonie

1. Pobierz `gymbrat.apk`
2. Zezwól na instalację z nieznanego źródła (jeśli system pyta)
3. Otwórz aplikację i zaloguj się jak na stronie
