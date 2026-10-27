# Baza wiedzy o projekcie GymBrat

Stan na 2026-10-23. Dokumenty powstały z analizy kodu przez zespół agentów (bez zmian w aplikacji). Każdy agent przed zadaniem czyta dokument swojej dziedziny i ten indeks; gdy zadanie zmienia opisany stan, aktualizuje swój dokument.

| Obszar | Dokument | Właściciel |
|---|---|---|
| Produkt, role, moduły, przepływy, słownik | [docs/analiza/00-mapa-produktu.md](../analiza/00-mapa-produktu.md) | analityk |
| Architektura, katalogi, model danych, API, wdrożenie, dług techniczny | [docs/adr/0000-architektura-stanu-obecnego.md](../adr/0000-architektura-stanu-obecnego.md) | architekt |
| Ekrany, tokeny, komponenty, niespójności | [docs/ux/00-system-projektowy-stan.md](../ux/00-system-projektowy-stan.md) | ux |
| Dane osobowe i zdrowotne, zgody, ryzyka RODO, reguły LR | [docs/prawo/00-inwentaryzacja-danych.md](../prawo/00-inwentaryzacja-danych.md) | prawnik |
| Narzędzia testowe, pokrycie, linia bazowa lint/tsc/test | [docs/testy/00-stan-testow.md](../testy/00-stan-testow.md) | tester |
| Powierzchnia ataku, podatności, checklista bezpieczeństwa | [docs/bezpieczenstwo/00-model-zagrozen-bazowy.md](../bezpieczenstwo/00-model-zagrozen-bazowy.md) | tester-bezpieczenstwa |
| Ścieżki krytyczne, SLO, problemy wydajności, limity planów | [docs/wydajnosc/00-analiza-bazowa.md](../wydajnosc/00-analiza-bazowa.md) | tester-wydajnosci |
| Decyzje właściciela produktu (odpowiedzi na pytania otwarte) | [docs/zespol/decyzje-wlasciciela.md](decyzje-wlasciciela.md) | koordynator |
| Backlog zadań w kolejności priorytetu | [docs/zespol/backlog.md](backlog.md) | koordynator |
| Błędy brzegowe/niskiego priorytetu odłożone na później, cała aplikacja (jeden wspólny plik, nie per zadanie) — nie wracają do zespołu bez decyzji właściciela, zasady w `docs/zespol/przeplyw.md` | [docs/bledy-do-naprawy/bledy.md](../bledy-do-naprawy/bledy.md) | koordynator |
| Podstawy prawne i retencja (projekt roboczy) | [docs/prawo/01-podstawy-prawne-i-retencja.md](../prawo/01-podstawy-prawne-i-retencja.md) | prawnik |
| Aktualność istniejących specyfikacji w docs/ | [docs/analiza/01-aktualnosc-specyfikacji.md](../analiza/01-aktualnosc-specyfikacji.md) | analityk |

## Najważniejsze fakty w skrócie
- Polskojęzyczna aplikacja B2C dla osoby ćwiczącej samodzielnie: trening, cardio, dziennik posiłków, raporty ciała ze zdjęciami, postępy, społeczność, panel admina. Coach to heurystyki (bez LLM); AI tylko do grafik przepisów (Pollinations).
- Next 16.4 (`proxy.ts`, build `--webpack`), React 19, Tailwind 4, Drizzle + Turso, NextAuth v5. Faktyczne źródło schematu: `db/ensure-schema.ts`.
- Android to WebView na tych samych stronach; Java backend obsługuje tylko 5 tras i trzyma dane w pamięci.
- iOS: powłoka WKWebView w `ios/` (build na macOS); użytkownicy bez Apple Developer instalują PWA (Safari → Dodaj do ekranu) — `docs/ios-instalacja-bez-developer.md`.
- Design: tylko tryb ciemny "black iron & gold", tokeny w `app/globals.css`, ale wiele kolorów wpisanych na sztywno.

## Znane problemy linii bazowej (do zaplanowania jako zadania)
- Bezpieczeństwo (wysokie): rejestracja bez SMTP przyjmuje kod `1234` + łączenie kont OAuth po e-mailu + admin po e-mailu (`actions/auth.ts`, `auth.ts`); Java bez `GYMBRAT_PROXY_TOKEN` ufa nagłówkowi użytkownika.
- Bezpieczeństwo (średnie): PIN admina niesprawdzany, `getRecentWeightLogs` bez `auth()` w `actions/weight.ts`, sesje nieodświeżane po zmianie roli/hasła.
- Jakość: `npm run lint` 114 błędów, `npm test` 4 pliki nieudane (brak mocka `server-only`, nieaktualne wersje Androida w testach).
- Prawo: brak wyraźnej zgody art. 9 RODO na dane o ciele, zgody tylko w localStorage, PostHog/Sentry bez zgody, brak retencji.
- Wydajność: brak indeksu `workouts(user_id, date)`, zdjęcia jako data URL w Turso, brak cache danych.
- Pytania otwarte rozstrzygnięte w `decyzje-wlasciciela.md`; kolejność prac w `backlog.md`.
