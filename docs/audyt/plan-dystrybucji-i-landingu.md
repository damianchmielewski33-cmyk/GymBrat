# Plan dystrybucji: Android (Google Play), iPhone (zakładka PWA), landing

Stan: 2026-11-06. Makiety i diagram: Design Artifact „GymBrat – landing i architektura dystrybucji” (prywatny, link u właściciela).

## Decyzje właściciela (2026-11-06)
- **Android**: pełna aplikacja w Google Play (flavor `play`, AAB). Publiczny `/gymbrat.apk` znika z komunikacji; APK tylko dla testerów (link niepubliczny).
- **iPhone**: bez App Store (brak konta Apple Developer). Zakładka na ekranie głównym (PWA), instrukcja `docs/ios-instalacja-bez-developer.md`. Aplikacja iOS dopiero, gdy Android i zakładka przynoszą zyski.
- **Landing**: osobny projekt (Astro) na własnej domenie `[DOMENA]`; aplikacja pod `app.[DOMENA]`.
- **Przed publikacją w Play**: przycisk „Wkrótce w Google Play” + zapis na listę powiadomień (zamiast martwego linku/APK).
- Z DK-7: zakupy cyfrowe na Androidzie przez Google Play Billing; web/iPhone przez HotPay.

## Zakres kodu (propozycja podzadań, do wciągnięcia do backlogu jako US22)
| # | Zadanie | Gdzie |
|---|---|---|
| L1 | Landing Astro: `/`, `/iphone`, FAQ, cennik, SEO/OG, sitemap, mobile + desktop wg makiet | nowe repo `gymbrat-landing` |
| L2 | `POST /api/waitlist`: zgoda, double opt-in, rate limit, CORS tylko z `[DOMENA]`, wypis, retencja; wpis w `lib/admin-config-status.ts` | aplikacja |
| L3 | `/start` → 301 na landing (po jego wdrożeniu); usunięcie CTA „Pobierz Android” (APK) z Profilu dla produkcji | aplikacja |
| L4 | Baner „Zainstaluj” w Safari (nie-standalone) + link do `/iphone`; karta w Profilu już istnieje | aplikacja |
| L5 | Android: `bundlePlayRelease`, Play Billing + weryfikacja serwerowa, `assetlinks.json`, Data Safety, test zamknięty (Z51/Z52) | android + aplikacja |
| L6 | Zmienna `NEXT_PUBLIC_LANDING_URL`, DNS, osobny deploy landingu | ops (właściciel na końcu) |

## Ryzyka
- Google Play bywa niechętny „cienkim powłokom WebView”; argumentem są funkcje natywne (przypomnienia, aparat, latarka).
- Nowe konta osobiste Google Play zwykle wymagają zamkniętego testu z grupą testerów przez ok. 2 tygodnie (zweryfikować w konsoli).
- iPhone bez App Store: ograniczone push, brak obecności w sklepie.
- Dwa kanały płatności: spójny cennik i opis w regulaminie.

## Wzorzec ruchu i dźwięku (analiza ponadlimit.pl, 2026-11-06)
Tylko jako inspiracja mechaniki; bez kopiowania treści, grafik, filmów i marki.

**Jak jest zbudowane:** Astro + Lenis (płynne przewijanie, klasa `lenis` na `html`), własny kursor (kropka + pierścień, `cursor:none`), intro z logo, czcionki Fraunces (nagłówki), Archivo (tekst), IBM Plex Mono (etykiety), tło czarne `#0a0a0b` ze złotem `#c9a45c`/`#e6c987`. Sekcje numerowane „01 / 08”, część przypięta (`position: sticky`, 100 vh).

**Ruch i dźwięk (co realnie jest na stronie):**
- Hero: zdjęcie osoby z telefonem przypięte na całą wysokość ekranu, na telefonie wideo/ekran aplikacji, przyciski sklepów.
- Sekcja „Aplikacja”: film z telefonu (MP4, `muted loop playsinline preload=none`, plakat JPG) z przyciskiem „Włącz dźwięk”; pod nim „stół” 3D z ok. 100 kartami dań (perspektywa 1100 px, owalna orbita SVG, przeciąganie obraca, licznik 001 / 100); obok 4 numerowane punkty funkcji.
- Dalej: przeciągane karty „przemian”, 16 krótkich wideo-opinii z czasem trwania, odwracana karta vouchera (`rotateY(180deg)`), przewijana „taśma filmowa” zdjęć.
- Animacje CSS: pulsujący złoty przycisk zakupu, poświata na „Oferta”, wejście kafelków (fade + przesunięcie 14–25 px), „oddychanie” (scale 1→1.04), aurora, wskaźnik przewijania. Brak GSAP/Three/WebGL.
- 17 filmów MP4 ładowanych leniwie (`preload=none` + plakaty WebP). `prefers-reduced-motion` obsłużone w 4 miejscach. Baner cookies z równorzędnym „Odrzucam”.

**Co przenosimy do landingu GymBrat (L1):**
1. Hero z filmem/ekranem aplikacji w ramce telefonu + przyciski „Google Play (wkrótce)” i „iPhone: zakładka”.
2. Sekcja „Aplikacja”: nagranie ekranu (wyciszone, pętla, plakat) z przyciskiem „Włącz dźwięk”; obok numerowane punkty funkcji.
3. Interaktywny element zamiast „stołu dań”: obracany/przeciągany „karuzel ekranów” aplikacji (trening, dieta, raport, progres) z licznikiem.
4. Wejścia sekcji (fade + przesunięcie), przycisk główny z pulsem, wskaźnik przewijania.
5. Lenis opcjonalnie (decyzja: płynne przewijanie bywa męczące na telefonie; proponuję tylko desktop).
6. Wydajność: filmy `preload=none`, plakaty WebP, wersja lekka na mobile, brak autoodtwarzania z dźwiękiem.
7. Dostępność: `prefers-reduced-motion` wyłącza ruch, napisy do filmów, kursor własny tylko na desktopie z myszą.
8. Zgody: baner z równorzędnym „Odrzuć”, analityka dopiero po zgodzie.
