# GymBrat iOS — checklista App Store

Kod w `ios/` jest **gotową bazą aplikacji** do wysłania przez App Store Connect. Nadal potrzebujesz konta Developer i materiałów marketingowych — tego nie da się „dokończyć” samym kodem na Windows.

## Co jest już w kodzie (gotowe pod review)

| Element | Status |
|---|---|
| Target iOS 16+, Bundle `pl.gymbrat.app` | tak |
| WKWebView + TrustedOrigins + OAuth w WebView | tak |
| Splash, progress, offline/błąd, pull-to-refresh | tak |
| Privacy Manifest `PrivacyInfo.xcprivacy` | tak |
| Opisy kamery / zdjęć / mikrofonu | tak |
| `ITSAppUsesNonExemptEncryption = false` | tak |
| Ikona 1024 (placeholder) | zamień przed submission |
| URL scheme `gymbrat://` | tak |
| ExportOptions App Store | `ios/ExportOptions-AppStore.plist` |
| Most JS (wersja, haptics, external URL) | tak |

## Czego wymaga Apple poza kodem

1. **Apple Developer Program** (organizacja lub osoba).
2. Aplikacja w [App Store Connect](https://appstoreconnect.apple.com): nazwa, kategoria (np. Health & Fitness), wiek, cena.
3. **Privacy Policy URL** (publiczny) — zgodny z `docs/prawo/`.
4. Zrzuty ekranu iPhone (6.7" / 6.1" itd.) i opis PL/EN.
5. Formularz **App Privacy** (te same kategorie co w Privacy Manifest + polityka).
6. Finalna **ikona 1024×1024** (bez alpha).
7. Konto / certyfikaty: Archive → Upload → TestFlight → Submit for Review.

## Jak uniknąć odrzucenia „samej strony w WebView”

Apple (wytyczna 4.2) bywa surowe wobec pustych wrapperów. GymBrat ma już:

- natywny splash i stany błędów,
- haptics / deep link scheme,
- realną funkcję fitness (konto, trening, żywienie) — nie landing page.

Przy review w „Notes for Review” podaj konto testowe (e-mail + hasło) i krótko: *„Native WKWebView shell; core product is the GymBrat training journal; offline and splash are native.”*

Opcjonalnie później: Associated Domains, APNs, Sign in with Apple (jeśli zostawisz tylko Social login — sprawdź aktualne reguły Apple).

## Kroki submission (skrót)

1. Mac: `cd ios && xcodegen generate && open GymBrat.xcodeproj`
2. Podmień ikonę, ustaw Team, bump `CURRENT_PROJECT_VERSION`
3. Product → Archive → Distribute → App Store Connect
4. TestFlight (wewnętrzny) → weryfikacja na iPhonie
5. Submit for Review

Bez Developer: użytkownicy zostają przy PWA — `docs/ios-instalacja-bez-developer.md`.

## Powiązane

- Źródła: `ios/`
- ADR: `docs/adr/0012-aplikacja-ios-webview.md`
- Analiza: `docs/analiza/013-aplikacja-ios.md`
