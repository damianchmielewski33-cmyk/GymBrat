# 013 — System redesign bezszeryfowy (black iron & gold)

Dokument docelowy po decyzji produktowej: pełny redesign UX + typografia 100% sans; KPI na Bebas Neue.

## Stack fontów

| Rola | Font | Token / klasa |
|---|---|---|
| Body | Geist | `--font-sans` / `font-sans` |
| Nagłówki | Space Grotesk | `--font-heading` / `font-heading` |
| Display + duże KPI | Bebas Neue | `--font-display` / `font-display`, `--font-metric` / `font-metric` |
| Mono | Geist Mono | `--font-mono` |

Playfair Display i fallbacki `ui-serif` / Georgia — **zakazane**.

### Reguła Bebas

- Liczby **≥ 18 px**: `font-metric` lub `font-display` + `tabular-nums`.
- Liczby **&lt; 18 px**: `font-heading` + `tabular-nums` (Bebas w 9–15 px jest nieczytelny).

## Tokeny (źródło: `app/globals.css`)

- Typografia: `--text-label` … `--text-hero`.
- Spacing: `--space-screen-x`, `--space-screen-x-sm`, `--space-section`.
- Promienie: `--radius-card` (karty), `--radius-panel`, `--radius-nav` (belka).
- Kolory: wyłącznie `--gym-gold`, `--gym-gold-bright`, `--gym-gold-deep`, `--neon`, `--gym-on-gold`. Hexy złota (`#d4af37`, `#DDBB6D`, …) — do wymiany.

## Prymitywy

- Karty: `.app-card` / `.app-panel`; `glass-panel` tylko w auth (`AuthCard`).
- Nagłówek ekranu: `AppPageHeader` (`components/layout/screen.tsx`).
- KPI kafelek: `AppStatTile` / `StatTile` (`progress-ui`) — jedna linia wizualna.
- Segmenty: `SegmentedControl` (`progress-ui`).
- Pusty stan: `AppEmptyState` (`components/ui/app-empty-state.tsx`).
- Potwierdzenia: `ConfirmDialog` (bez `window.confirm`).

## Checklista ekranów

- [x] Shell (belka, header, menu) — tokeny spacing/radius, złoto bez `#DDBB6D`
- [x] Fundament typografii (Playfair off, Bebas KPI, skala `--text-*`)
- [x] Prymitywy: AppEmptyState, StatCard, ConfirmDialog, SegmentedControl/HoF
- [x] Pulpit `/` — kafelki KPI, kontrast etykiet, wykresy na tokenach
- [x] Trening hub + historia (małe metric → heading; MainCardShell)
- [x] Dieta + nutrition (empty state, diary confirm, macro hero)
- [x] Analiza `/progress` + reports (StatCard, małe metric, wykresy)
- [x] Community / teams (hub tabs, subnav, HoF tabs, confirms)
- [x] Auth hero / AuthCard (glass tylko auth)
- [x] Profil, legal (LegalDocShell), admin (AdminStat)
- [ ] Dalszy polish głębokich ekranów (live detail, wars cards, atlas) — iteracje PR

## A11y

- Etykiety ≤12 px: kontrast min. ~`white/55` gdy to treść.
- Cele dotykowe belki i CTA ≥44 px.
- Nowe animacje respektują `prefers-reduced-motion`.
