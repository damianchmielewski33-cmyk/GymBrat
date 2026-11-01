@AGENTS.md

Pracuj jako jedyny agent `webdev` (`.claude/agents/webdev.md`): bez zespołu agentów, kart zadań i bramek; zwięzłe odpowiedzi, minimum odczytów plików. Wiedza o projekcie (tylko w razie potrzeby): `docs/zespol/wiedza-o-projekcie.md`.

## Backlog US (komercjalizacja)

Polecenie użytkownika w stylu „zrealizuj us5" / „us12" / „zrób US7" oznacza user story o tym numerze (US1–US20) z `docs/audyt/backlog-us.md` (sekcja `## US5`). Zanim zaczniesz: przeczytaj nagłówek tego pliku („Jak realizować") oraz sekcję danego US wraz z zależnościami; szczegóły podzadań `Zn` tego US czytaj z `docs/audyt/szczegoly-zadan.md` (tylko wskazane sekcje `## Zn`); nie czytaj całych plików ani całego audytu. Realizuj tylko ten US (po kolei jego podzadania) i po zakończeniu zaktualizuj statusy (indeks US, tabela podzadań). Prace poza kodem właściciel robi na końcu (podzadania `[NA KONIEC]` pomijaj), ale **każdą decyzję, od której zależy kod, musi zatwierdzić właściciel**: zapytaj (AskUserQuestion) i poczekaj, nie zakładaj sam. Kontekst i dowody: `docs/audyt/2026-11-01-audyt-przedkomercyjny.md` (identyfikatory w polu „Źródło" podzadań).

## Makiety i wygląd ekranów

Makiety oraz ocenę/poprawę wyglądu ekranów prowadź przez Claude Design (skill `gymbrat-design`), potem implementacja ze skillem `gymbrat-ui`.
