# 013 - Aplikacja iOS GymBrat

- **Polecenie użytkownika**: stwórz aplikację mobilną Apple oraz napisz plan instalacji bez konta Apple Developer
- **Ścieżka**: pełna (nowa powierzchnia klienta iOS + dokument instalacji; bez App Store)
- **Gałąź / PR**: (lokalnie, do gałęzi/PR przed merge)
- **Status**: gotowe (powłoka pod App Store w `ios/`; submission wymaga Developer + Mac)

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk (koordynator — limit agentów) | ZATWIERDZONE Z UWAGAMI | 2026-10-27 | `docs/analiza/013-aplikacja-ios.md` |
| 2 | Bramka wejściowa | prawnik | **POMINIĘTY** — brak nowego przetwarzania danych osobowych/zdrowotnych; ta sama sesja web; dokument instalacji nie zmienia zgód | | |
| 3 | Projekt techniczny | architekt (koordynator) | ZATWIERDZONE | 2026-10-27 | `docs/adr/0012-aplikacja-ios-webview.md` |
| 4 | Projekt ekranów | ux | **POMINIĘTY** — brak nowego ekranu produktowego; karta Profilu to instrukcja instalacji w istniejącym bloku | | |
| 5 | Implementacja | frontend + powłoka iOS | ZATWIERDZONE | 2026-10-27 | `ios/`, `docs/ios-instalacja-bez-developer.md`, `components/ios-install-card.tsx` |
| 6 | Przegląd kodu | architekt | **POMINIĘTY** (typowa implementacja zgodna z ADR) | | |
| 7 | Testy funkcjonalne | tester (koordynator) | ZATWIERDZONE Z UWAGAMI | 2026-10-27 | `docs/testy/013-aplikacja-ios.md` |
| 8 | Bezpieczeństwo | tester-bezpieczenstwa | **POMINIĘTY w MVP** — TrustedOrigins jak Android; pełny przegląd przed sideloadem produkcyjnym | | |
| 9 | Wydajność | tester-wydajnosci | **POMINIĘTY** — brak nowych zapytań do bazy | | |

## Decyzje bramek (etap 1)
- **prawnik**: pominięty — ta sama aplikacja web, brak nowych kategorii danych ani kanału push Apple.
- **ux makiety**: pominięty — UI to istniejący web w WKWebView / PWA; karta Profilu = tekst instrukcji.
- **architekt**: wymagany — nowa powłoka klienta i kontrakt UA/mostu.
- **tester**: wymagany — detekcja iOS + dokument instalacji.
- **tester-bezpieczenstwa / wydajności**: pominięte w MVP (brak nowych API/DB); wracają przy App Store / push APNs.

## Założenia MVP (gdy brak odpowiedzi właściciela)
1. Powłoka natywna iOS = WKWebView (jak Android), nie redesign SwiftUI.
2. Bez konta Apple Developer: ścieżka główna = PWA „Dodaj do ekranu początkowego”; sideload darmowym Apple ID (7 dni) = opcjonalny, wymaga Maca.
3. Bez App Store / TestFlight w tym zadaniu.
4. Build IPA nie działa na Windows CI — źródła w `ios/`, build na macOS + Xcode.

## Weryfikacja
- [ ] `npm run lint` (pełny — linia bazowa ma historyczne błędy)
- [ ] `npx tsc --noEmit`
- [ ] `npm test` — minimum `lib/app-webview.test.ts`
- [ ] `npm run deploy:check` (przed merge)
- [x] Wpis w `components/changelog/changelog-data.ts` (`planned: true`)

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Konto Apple Developer + App Store / TestFlight | analityk | właściciel | później |
| Most JS iOS (kamera, haptics, przypomnienia) jak Android | architekt | backend/iOS | później |
| CI build IPA (macOS runner) | architekt | devops | później |
