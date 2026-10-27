# Aplikacja iOS GymBrat (WKWebView) — baza pod App Store

Natywna powłoka iOS ładuje produkcyjny GymBrat w `WKWebView`, z:

- splash marki i paskiem postępu,
- natywnym ekranem offline / błędu + „Spróbuj ponownie”,
- pull-to-refresh,
- mostem `window.GymBratIos` (wersja, haptics, openExternal, contentReady),
- Privacy Manifest (`PrivacyInfo.xcprivacy`),
- ikoną App Store (1024×1024 — zamień na branding przed submission),
- URL scheme `gymbrat://`,
- `ITSAppUsesNonExemptEncryption = false`.

Front pozostaje w Next.js (jak `android/`).

## Wymagania

- macOS + Xcode 15+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`) — zalecane
- Do TestFlight / App Store: **konto Apple Developer** (~99 USD/rok)
- Bez Developer: PWA albo sideload 7 dni — `docs/ios-instalacja-bez-developer.md`

## Build (symulator / urządzenie)

```bash
cd ios
xcodegen generate
open GymBrat.xcodeproj
```

1. Signing → Team = Apple ID / Organization  
2. Bundle ID: `pl.gymbrat.app` (unikalny w zespole)  
3. `API_BASE_URL` w `GymBrat/Info.plist`  
4. Run (▶)

## Archiwum pod App Store

```bash
# Po xcodegen + skonfigurowanym Team w Xcode:
xcodebuild -scheme GymBrat -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/GymBrat.xcarchive archive

xcodebuild -exportArchive \
  -archivePath build/GymBrat.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions-AppStore.plist
```

Albo: Xcode → **Product → Archive** → **Distribute App** → App Store Connect.

Checklista: [`docs/ios-app-store.md`](../docs/ios-app-store.md).

## Most JS

| Metoda | Opis |
|---|---|
| `getVersionName()` / `getVersionCode()` | Wersja z Info.plist |
| `notifyContentReady()` | Ukrywa splash |
| `vibrate(patternCsv)` | Haptics |
| `openExternalUrl(url)` | Safari (tylko http/https) |

User-Agent: `… GymBratIosApp/<ver> GymBratIosBuild/<code>`.

## Ikona

Placeholder w `Assets.xcassets/AppIcon.appiconset/AppIcon.png` (ciemne tło + złoty okrąg).
**Przed App Store** podmień na finalną grafikę brandingu (1024×1024, bez przezroczystości).

## Wersja

- Marketing: `MARKETING_VERSION` w `project.yml` (obecnie `1.0.0`)
- Build: `CURRENT_PROJECT_VERSION` (bump przy każdym uploadzie do Connect)
