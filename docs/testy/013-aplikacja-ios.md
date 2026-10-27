# Testy — 013 Aplikacja iOS

## Zakres
- Detekcja UA / klienta iOS (`lib/app-webview.ts`)
- Karta Profilu `IosInstallCard` (logika widoczności)
- Dokument instalacji bez Developer
- Powłoka `ios/` — weryfikacja na Macu (poza CI Windows)

## Automatyczne
| Test | Wynik |
|---|---|
| `isIosAppWebViewUserAgent` / `parseIosAppIdentity` / `isIosPhoneBrowserUserAgent` w `lib/app-webview.test.ts` | do uruchomienia `npm test -- lib/app-webview.test.ts` |

## Eksploracyjne (manualne)
1. iPhone Safari: Profil → karta „Aplikacja iPhone” z 4 krokami PWA.
2. Desktop / Android: karta iOS niewidoczna; Android bez zmian.
3. Safari → Dodaj do ekranu → otwarcie standalone.
4. (Mac) `xcodegen generate` + Run na symulatorze — ładuje produkcję, UA zawiera `GymBratIosApp`.

## Werdykt
**ZATWIERDZONE Z UWAGAMI** — brak urządzenia iOS / Maca w tej sesji; testy jednostkowe UA; build Xcode do potwierdzenia na Macu.
