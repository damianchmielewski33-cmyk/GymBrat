# 012 — Testy redesignu Team (etap 6, koordynator — limity subagentów)

- **Data**: 2026-10-28
- **Zakres**: hub „Dziś w zespole”, pierścienie, katalog odznak, zgody C-T1/C-T2, CAS wojen, rotacja misji
- **Środowisko**: lokalne Vitest + `tsc`; bez E2E przeglądarkowego w tej sesji

## Wyniki automatyczne

| Komenda | Wynik |
|---|---|
| `npx tsc --noEmit` | OK (exit 0) |
| `npm test -- lib/community` | OK — 10 plików / 33 testy |

## Przegląd zgodności z makietą UX (statyczny)

| Element | Status |
|---|---|
| Kolejność hubu (pozycja → pierścienie → poziomy → seria → misja → liga → odznaki) | OK |
| Stan domyślny bez C-T1 + CTA + ConsentSheet | OK |
| Pierścienie z `aria-label`, tokeny kolorów | OK |
| Katalog `/badges` z filtrem | OK |
| Mikrokopia PL z sekcji 8 UX | w większości dosłowna |

## Świadomie poza tą sesją / do właściciela

- Hotfixy B-1/B-2 (e-mail w discover, publiczna grupa) — w `bledy.md`, nie ruszane
- Migracja istniejących kont social (B-3 pełna) + ekran jednorazowy — domyślne nowe = private; stare wiersze bez migracji masowej
- D18 wiek 16+ (B-5) — zależność
- Powiadomienie `ranking_overtaken` (US-13) — nie wdrożone w MVP tej iteracji
- Teksty zgód wymagają zatwierdzenia prawnika-człowieka (LR-T20) przed Promote
- `npm run deploy:check` — przed PR/merge
- Agent `tester` / bezpieczeństwo / wydajność — niedostępni (limit usage); powtórzyć przed merge

## Werdykt

**ZATWIERDZONE Z UWAGAMI** — ścieżka główna skompilowana i pokryta testami jednostkowymi community; pełne bramki 7–9 oraz przegląd wizualny w przeglądarce do dokończenia po odblokowaniu limitów / przed Promote.
