# 013 — Aplikacja mobilna Apple (iOS) + instalacja bez Apple Developer

## 1. Kontekst i cel

GymBrat ma PWA oraz natywną powłokę Android (WebView). Użytkownicy iPhone nie mają odpowiednika APK. Celem jest:

1. Powłoka natywna iOS (WKWebView) w repozytorium, analogiczna do `android/`.
2. Plan instalacji **bez konta Apple Developer** ($99/rok) — App Store i TestFlight poza zakresem.

## 2. Interesariusze

| Rola | Cel |
|---|---|
| Osoba ćwicząca (iPhone) | Ikona na ekranie początkowym, pełny ekran bez paska Safari |
| Właściciel produktu | Parzystość z Androidem bez kosztu Developer na start |
| Administrator | Brak nowych sekretów hostingowych w MVP |

## 3. Założenia

- **Z-1** MVP ładuje tę samą produkcyjną stronę co Android (`API_BASE_URL` / `https://gym-brat.vercel.app`).
- **Z-2** Bez Apple Developer: nie publikujemy w App Store i nie używamy TestFlight.
- **Z-3** Ścieżka instalacji dla użytkowników końcowych: **Safari → Udostępnij → Dodaj do ekranu początkowego** (PWA). Działa na darmowym Apple ID.
- **Z-4** Sideload natywnego IPA (Xcode / AltStore, darmowy certyfikat **7 dni**) jest opcją dla dewelopera / testerów z Maciem — nie jest głównym CTA w Profilu.
- **Z-5** Build Xcode wymaga macOS; na Windows w repozytorium są tylko źródła i dokumentacja.
- **Z-6** Most JS `GymBratIos` (kamera, latarka, przypomnienia) — poza MVP; web działa jak w Safari.

## 4. Poza zakresem

- Publikacja App Store, TestFlight, Apple Pay, Sign in with Apple (osobne zadanie + Developer).
- Push APNs, widgets, HealthKit.
- Pełny redesign UI w SwiftUI.

## 5. User stories i kryteria akceptacji

### US-1 Powłoka iOS w repozytorium
Jako deweloper chcę projekt WKWebView w `ios/`, aby budować aplikację na Macu jak APK na Androidzie.

- **AC-1.1** Given repozytorium, When otwieram `ios/README.md`, Then mam kroki: Xcode, URL bazowy, Run na urządzeniu/symulatorze.
- **AC-1.2** Given build, When aplikacja startuje, Then ładuje origin GymBrat w pełnym WKWebView.
- **AC-1.3** Given nawigacja do Google/Facebook OAuth, When użytkownik loguje się, Then zostaje w WebView; hosty spoza listy zaufanych otwierają Safari.

### US-2 Instalacja bez Developer (PWA)
Jako użytkownik iPhone chcę dodać GymBrat do ekranu początkowego bez płacenia Apple.

- **AC-2.1** Given Safari na iOS i zalogowana lub publiczna strona, When Profil pokazuje kartę iOS, Then widzę instrukcję „Udostępnij → Dodaj do ekranu początkowego”.
- **AC-2.2** Given ikona na ekranie początkowym, When otwieram GymBrat, Then działa w trybie standalone (bez paska URL Safari), z `appleWebApp` już w `app/layout.tsx`.
- **AC-2.3** Given dokument `docs/ios-instalacja-bez-developer.md`, When czytam plan, Then mam: PWA (główna), sideload 7 dni (opcjonalnie), ograniczenia i kiedy potrzebny Developer.

### US-3 Rozpoznanie kontekstu
Jako produkt chcę odróżnić Safari / PWA / przyszły WebView iOS od Androida.

- **AC-3.1** Given UA z `GymBratIosApp/…`, When web sprawdza klienta, Then rozpoznaje powłokę iOS (przygotowanie pod przyszły most).
- **AC-3.2** Given iPhone Safari (nie zainstalowany WebView), When Profil w RWD telefonu, Then widać kartę instalacji iOS (nie kartę APK).

## 6. Reguły biznesowe

- **BR-1** CTA w Profilu na iPhonie = instrukcja PWA, nie pobieranie IPA (IPA nie da się legalnie rozdawać masowo bez Developer).
- **BR-2** Natywny IPA bez Developer: tylko na urządzeniach zalogowanych tym samym darmowym Apple ID, odnowienie co ~7 dni.
- **BR-3** Nie obiecywać „jak w App Store” w mikrokopii PWA.

## 7. MoSCoW

| Priorytet | Element |
|---|---|
| Must | Dokument instalacji bez Developer; źródła `ios/` WKWebView; karta Profilu PWA na iPhonie; UA `GymBratIosApp` |
| Should | TrustedOrigins jak Android; `ios/README.md` build |
| Could | Wersjonowanie `/api/ios/version` (później) |
| Won’t (teraz) | App Store, TestFlight, APNs, HealthKit |

## 8. Pytania otwarte (z założeniami domyślnymi)

| # | Pytanie | Założenie |
|---|---|---|
| Q1 | Czy MVP ma być tylko PWA, czy też projekt Xcode? | Oba: PWA dla użytkowników + `ios/` dla Mac/sideload |
| Q2 | Czy CTA Profilu ma oferować pobranie IPA? | Nie — tylko instrukcja PWA |
| Q3 | Czy budować IPA w GitHub Actions (macOS)? | Nie w tym zadaniu |
| Q4 | Czy most JS jak Android w MVP? | Nie |
| Q5 | Czy wymagać Apple Developer przed sideloadem? | Nie — opisujemy darmowe Apple ID |

## 9. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Użytkownik oczekuje IPA jak APK | Mikrokopia + dokument: Apple blokuje sideload masowy |
| Certyfikat 7 dni wygasa | Dokument: odnowienie; docelowo Developer |
| Brak Maca w zespole | Źródła w git; PWA działa bez buildu |
| OAuth w WKWebView | TrustedOrigins + cookies jak na Androidzie |

## 10. Werdykt

**ZATWIERDZONE Z UWAGAMI** — założenia Q1–Q5 przyjęte; właściciel może je zmienić przed App Store.
