# Standard jakości landingu GymBrat

Wyciąg zasad z czterech publicznych repozytoriów aievolutionpl (MIT): `agent-design-taste`, `social-motion-agent`, `meta-ads-designer`, `step-beyond`. Stan: 2026-11-06. Przeczytane tylko README, SKILL/AGENTS i wybrane referencje; **niczego z tych repozytoriów nie instalowano ani nie uruchamiano** (pominięte: `install.sh`, `pip install`, `npm ci`, klucze FAL i dostawców). Zasady sprawdzamy ręcznie na makiecie i w kodzie landingu.

## Blokery (bez nich nie wdrażamy)
- Kontrast tekstu ≥ 4,5:1 (małe etykiety mono też).
- Cele dotykowe ≥ 44 px, widoczny `:focus-visible`.
- `prefers-reduced-motion` wyłącza ruch i autoodtwarzanie.
- Brak poziomego przewijania strony na 390 px.
- Brak wymyślonych statystyk, opinii, logotypów, cen i pilności; dane przykładowe oznaczone jako przykład; placeholdery `[...]` tylko w makiecie.
- Brak martwych linków (`#`, puste `href`) i fałszywego UI (przycisk play bez filmu).

## Typografia i układ
- Role przed rodzinami: nagłówek serif (Fraunces), tekst (Archivo), etykieta mono (IBM Plex Mono); wersaliki tylko w etykietach; bez sztucznego letter-spacing w serifach.
- Jedna skala odstępów (wielokrotności 8), sekcje o różnym rytmie, bez trzech identycznych kart pod rząd.
- Maks. 2 akcenty (złoto + biel); gradient tylko dla głębi lub marki.
- Test: „czy ta strona mogłaby należeć do innego produktu?” i „co usunąłem?”.

## Copy i konwersja (z meta-ads-designer)
- Nagłówek do ok. 6 słów, jedno zdanie wsparcia, jedno główne CTA.
- Obietnica z reklamy = pierwszy komunikat landingu.
- Dowód zamiast przymiotników („premium”, „najlepszy”).

## Ruch i dźwięk (social-motion-agent, agent-design-taste)
- Ruch niesie sens: akcja → zmiana stanu → czytelny rezultat.
- Przejścia 150–250 ms; bez nieskończonych pulsów (puls CTA kilka razy, potem stop), bez scroll-jackingu i parallaxu na gęstej treści.
- Animujemy `transform` i `opacity`.
- Dźwięk tylko po kliknięciu; film `muted loop playsinline preload="none"` + plakat.
- Konkretne easingi: `skills/creative-director/references/website-design.md` w `social-motion-agent` (nieprzeczytane, do przejrzenia przy L1).

## Proces (agent-design-taste, step-beyond)
1. Kierunek przed kodem: 2–3 propozycje układu.
2. Render w 1440 / 768 / 390 i przegląd względem blokerów (próg ≥ 75/100, zero blokerów wg agent-design-taste).
3. Przegląd „slop”: generyczny gradient, glassmorphism bez celu, emoji jako ikony, powtarzalne karty ikona-tytuł-treść, fałszywy social proof.
4. Weryfikacja twierdzeń: każdy link i kontrolka sprawdzone; niesprawdzone oznaczone w raporcie.

## Czego nie przejmujemy
- Generowania reklam obrazem przez model i płatnych usług (fal.ai, dostawcy wideo).
- Instalacji skilli w `~/.claude/skills` i skryptów z tych repozytoriów bez decyzji właściciela i przeglądu kodu.
