# Budżety wydajności (Z41 / Z70)

Źródło liczb: [`budzety.json`](budzety.json). Sprawdzanie: `node scripts/perf-budget.mjs`.

## Jak mierzyć

```bash
npm run build && npm start            # build produkcyjny
node scripts/perf-budget.mjs --ci     # 3 strony publiczne (to samo robi CI)
# 10 kluczowych ekranów po zalogowaniu (skopiuj cookie sesji z przeglądarki):
node scripts/perf-budget.mjs --cookie="authjs.session-token=..." --lighthouse
```

Skrypt mierzy rozmiar HTML SSR (bez kompresji) i TTFB; z `--lighthouse` także LCP. Wyniki „przed/po” wklejaj do opisu PR.

## Budżety

| Ekran | HTML SSR | TTFB | LCP |
|---|---|---|---|
| `/login`, `/register`, `/regulamin` (CI) | 60–90 kB | 800 ms | 2,5 s |
| Start, Treningi, Aktywny trening, Żywienie dziś, `/nutrition/week`, Atlas | 90–110 kB | 1,2 s | 2,5 s |
| Progres, Społeczność | 120 kB | 1,5 s | 3 s |

Progi dla ekranów po zalogowaniu to propozycja startowa — **zatwierdź lub skoryguj po pierwszym pomiarze na buildzie produkcyjnym** (wartości bazowe `/nutrition/week` 209 kB i `/plany/atlas` 148 kB z audytu 2026-11-01; cel Z70 < 90 kB).

## Stan pomiarów

Pomiar na buildzie produkcyjnym **nie został jeszcze wykonany** (środowisko bez npm). Zmiany Z70 (Atlas: katalog bez opisów, szczegóły na żądanie; Żywienie/tydzień: 13 tygodni zamiast 53 na start, reszta doładowywana) są oparte na analizie kodu — ich efekt trzeba potwierdzić skryptem powyżej.
