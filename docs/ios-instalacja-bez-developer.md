# Instalacja GymBrat na iPhone / iPad bez konta Apple Developer

Konto **Apple Developer** (ok. 99 USD/rok) jest wymagane do publikacji w App Store i TestFlight. **Nie jest wymagane**, żeby korzystać z GymBrat na iPhonie.

## Co wybrać

| Sposób | Dla kogo | Koszt | Trwałość | Wymaga Maca |
|---|---|---|---|---|
| **A. Dodaj do ekranu początkowego (PWA)** | Każdy użytkownik | 0 zł | Stała (dopóki nie usuniesz ikony) | Nie |
| **B. Sideload z Xcode (darmowe Apple ID)** | Dev / tester | 0 zł | Certyfikat ~**7 dni** — potem ponowny podpis | Tak |
| **C. AltStore / podobne** | Zaawansowany tester | 0 zł | Odświeżanie co ~7 dni | Zwykle tak (PC/Mac) |
| App Store / TestFlight | Produkcja masowa | Developer | Stała | Proces Apple |

**Dla użytkowników końcowych wybieraj zawsze ścieżkę A.**

---

## A. Instalacja PWA (zalecana) — bez Maca, bez Developer

Działa na iOS 16+ (Safari). Chrome/Firefox na iOS i tak używają silnika WebKit, ale **„Dodaj do ekranu początkowego” jest najpewniejsze w Safari**.

1. Na iPhonie otwórz **Safari**.
2. Wejdź na produkcję: [https://gym-brat.vercel.app](https://gym-brat.vercel.app) (albo swój Preview).
3. Zaloguj się jak zwykle (opcjonalnie — możesz dodać ikonę też przed logowaniem).
4. Stuknij przycisk **Udostępnij** (kwadrat ze strzałką w górę).
5. Przewiń listę i wybierz **Dodaj do ekranu początkowego**.
6. Nazwa: `GymBrat` → **Dodaj**.
7. Na ekranie początkowym pojawi się ikona GymBrat. Otwieraj aplikację **z tej ikony** (tryb pełnoekranowy, bez paska adresu).

### W Profilu aplikacji

Na iPhonie w Safari (widok telefonu) w **Profilu** jest karta **Aplikacja iPhone** z tą samą instrukcją.

### Ograniczenia PWA na iOS (świadomie)

- Powiadomienia push (Web Push) na iOS są ograniczone względem Androida / APNs — GymBrat i tak opiera się głównie na webie.
- Ikona i splash zależą od brandingu (`icon_ios` / `icon_pwa` w panelu admina).
- To nie jest pakiet z App Store — aktualizacje UI wchodzą wraz z wdrożeniem strony (bez osobnej instalacji).

---

## B. Natywna powłoka WKWebView (opcjonalnie) — darmowe Apple ID

Źródła: katalog [`ios/`](../ios/) w repozytorium. Build tylko na **macOS + Xcode**.

### Wymagania

- Mac z Xcode (App Store, darmowe).
- Darmowe **Apple ID** (to samo, którym logujesz się do iCloud).
- Fizyczny iPhone lub symulator.
- Kabel USB (urządzenie) + zaufanie komputerowi.

### Kroki (Xcode, ~7-dniowy profil)

1. Sklonuj repozytorium GymBrat na Macu.
2. Otwórz projekt według [`ios/README.md`](../ios/README.md) (XcodeGen lub otwarcie `.xcodeproj`).
3. W Xcode: **Signing & Capabilities** → Team = Twoje osobiste Apple ID (Add Account…).
4. Bundle ID np. `pl.gymbrat.app` (unikalny w Twoim Apple ID).
5. Ustaw `API_BASE_URL` na produkcję lub Preview.
6. Podłącz iPhone → wybierz urządzenie → **Run** (▶).
7. Na iPhonie: **Ustawienia → Ogólne → VPN i zarządzanie urządzeniem** (lub „Urządzenia”) → zaufaj deweloperowi.

Aplikacja działa jak APK Androida: pełny ekran, ta sama strona webowa.

### Co się dzieje po ~7 dniach

Apple unieważnia darmowy profil. Objaw: aplikacja się nie uruchamia. Rozwiązanie: ponownie **Run** z Xcode na tym samym Apple ID (lub odświeżenie przez AltStore). Konto Developer usuwa ten limit i pozwala na TestFlight / App Store.

### Czego nie rób bez Developer

- Nie rozsyłaj pliku `.ipa` „jak APK” znajomym przez link — iOS tego nie instaluje jak Android.
- Nie obiecuj w produkcie „pobierz IPA” — to nie jest równoważnik `/gymbrat.apk`.

---

## C. AltStore / Sideloadly (skrót)

Narzędzia typu AltStore pozwalają instalować IPA podpisane darmowym Apple ID i odświeżać podpis w sieci lokalnej. Nadal obowiązuje limit 7 dni i limit aplikacji na darmowym koncie. Szczegóły zmieniają się z wersjami iOS — traktuj to jako ścieżkę techniczną dla testerów, nie dla wszystkich użytkowników GymBrat.

---

## Kiedy potrzebujesz Apple Developer

- Publikacja w **App Store**
- **TestFlight** dla wielu testerów bez kabla
- Dłuższe certyfikaty, CI z podpisem dystrybucyjnym, Push APNs produkcyjne, część API Apple

Do codziennego treningu z GymBrat na iPhonie **wystarczy ścieżka A (PWA)**.

---

## Powiązane pliki

- Analiza: `docs/analiza/013-aplikacja-ios.md`
- ADR: `docs/adr/0012-aplikacja-ios-webview.md`
- Powłoka: `ios/`
- Checklista App Store (gdy masz Developer): `docs/ios-app-store.md`
- Android (odniesienie): `android/README.md`
