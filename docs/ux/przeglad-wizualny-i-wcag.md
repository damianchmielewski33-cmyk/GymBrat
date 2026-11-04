# Przegląd wizualny (Z69) i dostępność WCAG AA (Z74)

Status: **procedura i lista kontrolna gotowe; zrzuty i axe NIEWYKONANE** (środowisko bez uruchomionej aplikacji). Wyniki wpisz w tabelach poniżej.

## Jak uruchomić

```bash
npm run build && npm start
node scripts/ui-review.mjs --cookie="authjs.session-token=..." --axe   # wymaga: npm i -D axe-core
```
Skrypt zapisuje zrzuty (375×667, 412×915, desktop) 16 ekranów do `tmp/ui-review/` i `axe.json`; zgłasza też ostrzeżenia wymiarów wykresów (Z61).

## Zrobione statycznie (bez uruchamiania aplikacji)

| Obszar | Zmiana | Pilnuje |
|---|---|---|
| Z60 tytuły | `metadata.title` we wszystkich 65 trasach dashboardu (szablon „%s · GymBrat”) | `lib/page-titles.test.ts` |
| Z66 tokeny | literały złota → `var(--gym-gold)` / `rgba(var(--neon-rgb),α)`; kontekst bez CSS → `lib/brand-colors.ts` | `lib/brand-color-literals.test.ts` |
| Z66 kontrast | tokeny tekstu ≥ 4,5:1 (min. 5,46:1); `text-white/20…45` (674 użycia) podniesione do `/50` (≥ 5,1:1) | j.w. |
| Z67 kafel | `components/ui/stat-tile.tsx`; `AppStatTile`, `StatTile` (Analiza), `StatCard` (raporty) i `Stat` (Społeczność) to nakładki | — |
| Z68 strefa dolna | tokeny `--bottom-nav-h`, `--fab-overhang`, `--bottom-gap`, `--bottom-chrome` | test wizualny 375×667 / 412×915 (do wykonania) |
| Z59 przycisk | kontekstowy środkowy przycisk belki | `lib/context-fab.test.ts` |
| Z65 nagłówek | `AppPageHeader` ma `backHref`/`backLabel`; podekrany: raport postępów, zamówienia, potwierdzenie, raport ciała, technika, nowa/dołącz do grupy, członkowie | — |
| Z61 wykresy | wszystkie 13 `ResponsiveContainer` z `minHeight` i `initialDimension`; Analiza ma szkielet z opisem i własny `error.tsx` | sprawdzić brak „width(-1)” w konsoli |

## Znaleziska do Z65–Z68 (z analizy kodu)

- `components/layout/start-workout-fab.tsx` nie jest nigdzie używany (martwy kod) — prawdziwy pływający przycisk to środkowy przycisk belki (Z59).
- Ustawienia profilu mają własne zakładki (`ProfileTabs`), nie wymagają strzałki wstecz.
- `thumb-action-bar` i `active-workout-global-bar` mają własne stałe offsety (4,75 rem / 72 px) — do zbadania na zrzutach, czy nie nakładają się na belkę.

## Lista kontrolna ekranów (Z69)

Raport ciała (kroki 3–5) · Plany: atlas, import · Profil · Społeczność: zespoły, wojny, wyzwania · Admin: konfiguracja, błędy, katalog, ćwiczenia, branding. Dla każdego: zrzut mobile i desktop, defekty → tabela.

| Ekran | Mobile | Desktop | Defekty |
|---|---|---|---|
| (do uzupełnienia po uruchomieniu skryptu) | | | |

## Wyniki axe (Z74)

| Ekran | Krytyczne | Poważne | Uwagi |
|---|---|---|---|
| (do uzupełnienia po `--axe`) | | | |

Priorytety napraw: kontrast, etykiety pól, kolejność fokusu, obsługa klawiatury; błędy krytyczne i poważne blokują zamknięcie Z74.
