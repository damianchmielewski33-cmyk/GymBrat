# ADR 0012 — Aplikacja iOS (WKWebView) i instalacja bez Apple Developer

- **Status**: zaakceptowane (MVP)
- **Data**: 2026-10-27
- **Kontekst**: analiza `docs/analiza/013-aplikacja-ios.md`

## 1. Problem

Android ma natywną powłokę WebView + dystrybucję APK. Na iOS bez konta Developer nie ma równoważnego „pobierz plik i zainstaluj”. Potrzebujemy powłoki w repozytorium oraz realnej ścieżki instalacji dla użytkowników.

## 2. Decyzja

### D1 — Powłoka = WKWebView (nie Capacitor / nie czysty SwiftUI)
Jeden `WKWebView` ładujący produkcyjny Next.js, jak `android/…/MainActivity`. Katalog `ios/`.

### D2 — Dystrybucja bez Developer
| Ścieżka | Dla kogo | Wymaga Developer? |
|---|---|---|
| PWA „Dodaj do ekranu początkowego” (Safari) | Użytkownicy końcowi | Nie |
| Sideload (Xcode / AltStore, free Apple ID, ~7 dni) | Dev / tester z Maciem | Nie |
| TestFlight / App Store | Produkcja masowa | Tak ($99/rok) |

CTA w Profilu = wyłącznie PWA. Dokument: `docs/ios-instalacja-bez-developer.md`.

### D3 — Identyfikacja klienta
User-Agent: `GymBratIosApp/<version> GymBratIosBuild/<build>`.
Opcjonalny most `window.GymBratIos` (wersja) — bez kamer/haptics w MVP.
Rozszerzenie `lib/app-webview.ts` (lub cienki helper iOS) bez mieszania z logiką APK.

### D4 — Bezpieczeństwo WebView
Port reguł `TrustedOrigins`: origin aplikacji + OAuth Google/Facebook w WebView; reszta → Safari. Most JS tylko na originie aplikacji.

### D5 — Build
Źródła Swift + `project.yml` (XcodeGen) albo otwarcie w Xcode. Brak CI IPA na Windows. URL bazowy: `Info.plist` / xcconfig `API_BASE_URL`.

### D6 — Gotowość App Store (uzupełnienie 2026-10-27)
Kod powłoki obejmuje: splash, offline/błąd, pull-to-refresh, Privacy Manifest, ikona 1024 (placeholder), `ITSAppUsesNonExemptEncryption`, URL scheme, most haptics. Checklista: `docs/ios-app-store.md`. Submission nadal wymaga konta Developer i materiałów Connect (poza kodem).

### D7 — Poza zakresem kodu
`/api/ios/version`, OTA, AdMob iOS, APNs, Sign in with Apple, Associated Domains (szkielet entitlements).

## 3. Konsekwencje

- Użytkownik iPhone instaluje jak skrót PWA (ograniczenia Safari: brak pełnych push jak APNs).
- Natywna aplikacja wymaga Maca do kompilacji; Windows wystarcza do edycji źródeł.
- Parzystość funkcji natywnych z Androidem wymaga kolejnych zadań.

## 4. Werdykt

**ZATWIERDZONE**
