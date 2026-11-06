---
name: gymbrat-design
description: Use when the user wants a mockup/prototype of a GymBrat screen, or asks to evaluate and improve how a screen looks ("makieta", "prototyp", "oceń wygląd", "popraw wygląd ekranu"). Routes the work through Claude Design (Design Artifact), then applies the result in code with gymbrat-ui.
---

# GymBrat Design (Claude Design)

Claude Design = typ Artifact "Design" (claude.ai/artifacts, `/design`). Używaj go do makiet i przeglądu wyglądu, zanim ruszysz kod ekranu.

## Makieta nowego lub przebudowywanego ekranu
1. `Artifact` `action: "quickstart"`, `intent: "design"`, `design_systems: false` (wejście do projektu przez `type_url` z wyniku). Nie pisz makiety jako zwykłego HTML.
2. Styl wejściowy w briefie: ciemny motyw „black iron & gold", tokeny z `app/globals.css` (kolory, `font-heading` / `font-display` / `font-metric`, promienie), mobile-first (szerokość ~390px, safe-area, cele dotykowe 44px), copy po polsku.
3. Pokaż stany: dane, loading, pusty (`app-empty-state`), błąd (`inline-banner`).
4. Link do makiety (prywatny) podaj użytkownikowi; nic nie publikuj dalej bez jego zgody. Dopiero po akceptacji implementuj w kodzie ze skillem `gymbrat-ui`.

## Ocena i poprawa istniejącego ekranu
1. Zrzut ekranu lub opis ekranu -> Design Artifact z wariantem „przed" i propozycją „po" (hierarchia, odstępy, kontrast, czytelność metryk, CTA).
2. Lista konkretnych poprawek (max ~7), każda mapowana na istniejący komponent z `components/ui`.
3. Po akceptacji: zmiany w kodzie (`gymbrat-ui`), a na końcu `gymbrat-quality-review` dla zmienionego ekranu.

## Granice
- `DesignSync` (sync design systemu do claude.ai/design) tylko gdy użytkownik wprost o to poprosi; wymaga `/design-login` w CLI i zatwierdzenia planu plików.
- Dane zdrowotne (waga, zdjęcia sylwetki, posiłki) w makietach tylko jako dane przykładowe, nigdy prawdziwe (`gymbrat-sensitive-data`).
- Makieta nie zastępuje decyzji produktowych: nowe funkcje zależne od kodu zatwierdza właściciel.
