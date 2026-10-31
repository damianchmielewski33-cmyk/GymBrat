# 012 - Redesign funkcji Team (społeczność, rywalizacja, punkty, odznaki)

- **Polecenie użytkownika**: zaprojektować redesign funkcji Team jako flagowej funkcji aplikacji łączącej społeczność i rywalizację (rankingi, punkty, wirtualne odznaki). Inspiracja: Strava (segmenty, kudos, wyzwania, leaderboard) i Apple Fitness (pierścienie, odznaki, zawody tygodniowe ze znajomymi). Obecny stan uznany za słaby ("brak wow"). Zadanie analityczno-projektowe: bez kodu, bez zmian w repozytorium poza `docs/`.
- **Ścieżka**: pełna, ograniczona na tym etapie do analizy i projektu (etapy 1-4). Etapy 5-10 wykonywane po akceptacji właściciela. Brak PR, brak commitów.
- **Gałąź / PR**: feat/koniec-treningu-flow (bieżąca), brak nowego PR. Zadanie dotyczy wyłącznie dokumentacji.
- **Status**: w toku (etapy 1-4 zakończone. Etap 2: werdykt w `docs/prawo/012-redesign-funkcji-team.md` — blokady widoczności B-1 do B-5 uwzględnione w etapach 3 i 4; B-1 i B-2 to istniejące defekty do osobnego hotfixu, decyzja właściciela. Etap 4 `ux` zaprojektował hub i katalog odznak **z modelem zgody opt-in** (nie opt-out, zgodnie z werdyktem prawnika) — patrz uwaga niżej)
- **Rozszerzenie 2026-10-31**: właściciel polecił uwzględnić znajomych, powiadomienia i "ducha treningowego" (ghost training) jako element Team. Agent `analityk` (oryginalny zespół) przerwał tę pracę w połowie (limit tygodniowy API). W międzyczasie zmieniła się konfiguracja repozytorium na krótko (pojedynczy agent `webdev`, bez zespołu) i wróciła do pełnego przepływu — rozszerzenie dokończone bezpośrednio jako sekcja 17 w `docs/analiza/012-redesign-funkcji-team.md`: defekt prywatności w ścieżce `leader` ducha treningowego (pokazuje bezwzględny ciężar lidera bez jego zgody), nowe user stories US-17 do US-21, reguły BR-13 do BR-16. Na polecenie właściciela 4 rekomendowane pozycje (US-21 naprawa zgody lidera, US-20 cotygodniowe podsumowanie, US-19 odznaka za wspólny trening, US-17/18 pojedynek przez ducha) **scalono z główną tabelą zakresu w sekcji 9 i priorytetyzacją MVP** (punkty 4, 6-8) — jedno źródło prawdy, bez duplikatu w 17.7. **Sekcja 17 nie przeszła jeszcze formalnych bramek `prawnik`/`architekt`/`ux`** — zespół jest teraz znów dostępny, więc to naturalny następny krok przed implementacją, zwłaszcza dla US-21 (ekspozycja danych bez zgody) i US-17/18 (nowy mechanizm rozliczenia danych między użytkownikami).

## Bramki
| # | Etap | Agent | Werdykt | Data | Raport |
|---|---|---|---|---|---|
| 1 | Wymagania | analityk | ZATWIERDZONE (pytania Q1-Q5 otwarte z założeniami) | 2026-10-26 | `docs/analiza/012-redesign-funkcji-team.md` |
| 2 | Bramka wejściowa | prawnik | ODRZUCONE w zakresie widoczności wyników; ZATWIERDZONE dla pracy architekta i ux nad elementami bez publikacji danych innym (warunki B-1 do B-5) | 2026-10-26 | `docs/prawo/012-redesign-funkcji-team.md` |
| 3 | Projekt techniczny | architekt | ZATWIERDZONE Z UWAGAMI | 2026-10-26 | `docs/adr/0011-redesign-funkcji-team.md` |
| 4 | Projekt ekranów | ux | **ZATWIERDZONE Z UWAGAMI** — zaprojektowano hub „Dziś w zespole" i katalog odznak; dokument i makieta zaktualizowane po przeczytaniu werdyktu prawnika (etap 2) tak, by model widoczności był **opt-in** (`ConsentSheet`, dwie niezaznaczone zgody C-T1/C-T2), a nie opt-out z pierwotnego założenia analizy (Z5). 4 otwarte pytania pozostają (sekcja 12.1 specyfikacji), żadne nie blokuje layoutu | 2026-10-26 | `docs/ux/012-redesign-funkcji-team.md`, makieta `docs/ux/012-redesign-funkcji-team-makieta.html` |
| 5 | Implementacja | backend, frontend | NIE na tym etapie (brak zmian kodu) | | |
| 6 | Przegląd kodu | architekt | warunkowo (po implementacji, tylko przy zmianie schematu lub kontraktu) | | |
| 7 | Testy funkcjonalne i spójność | tester, ux | TAK w implementacji (testy domenowe: tydzień pon-nd, idempotencja XP, capy, progres względny) | | `docs/testy/` |
| 8 | Przegląd wizualny | ux | TAK w implementacji (warunkowo, jeśli odstępstwa niejednoznaczne) | | |
| 9 | Bezpieczeństwo i wydajność | tester-bezpieczenstwa, tester-wydajnosci | TAK obie w implementacji (widoczność między użytkownikami, IDOR presence znany; agregacje rzadkości, ranking, cache) | | `docs/bezpieczenstwo/`, `docs/wydajnosc/` |
| 10 | Bramka wyjściowa | prawnik | warunkowo (tylko przy udostępnianiu wyniku lub zmianie domyślnej widoczności) | | `docs/prawo/` |

### Uzasadnienie decyzji o bramkach (etap 1)
- **prawnik - TAK**: zadanie zmienia widoczność danych o aktywności fizycznej między użytkownikami (ranking grupy, odznaki, potencjalnie ranking szerszy), dotyka domyślnych ustawień profilu (`userSocialProfiles`) i kont 16-17 lat (D18). Wymaga oceny przed projektem architektury, bo decyzja o widoczności wpływa na model danych.
- **architekt - TAK**: nowy model prezentacji i agregacji (katalog odznak, rzadkość, rotacja misji, pierścienie), zależność od D9 (tydzień pon-nd) i od ścieżki zapisu treningu przez backend Java (ryzyko: Java nie publikuje feedu ani XP).
- **ux - TAK**: nowe ekrany i przepływy (hub "Dziś w zespole", kolekcja odznak, pierścienie, rotacja misji). Projekt od zera, więc model `sonnet` zgodnie z przeplywem.
- **tester-bezpieczenstwa - TAK w implementacji**: uprawnienia członkostwa, widoczność wyników, znany IDOR w presence (audyt HIGH), dane wejściowe pojedynków.
- **tester-wydajnosci - TAK w implementacji**: agregacja rzadkości, rankingi, harmonogram misji, koszty Turso.
- **tester - TAK w implementacji** (testy podstawowe; pełny plan dla logiki tygodnia i nagród).

## Weryfikacja
- [ ] `npm run lint` - nie dotyczy (brak zmian kodu w etapie 1)
- [ ] `npx tsc --noEmit` - nie dotyczy
- [ ] `npm test` - nie dotyczy
- [ ] `npm run deploy:check` (przed merge) - do wykonania po implementacji
- [ ] Wpis w `components/changelog/changelog-data.ts` (`planned: true`) - po zatwierdzeniu zakresu MVP, przy PR

## Pytania do właściciela (z analizy, sekcja 12)
1. Q1 - Kierunek: rywalizacja względna w grupie jako główny tryb, współpraca jako drugi (założenie).
2. Q2 - Monetyzacja (D10): Team w całości darmowy w v1, pakiet pozostaje "bez reklam" (założenie).
3. Q3 - Domyślna widoczność wyniku: tylko w grupie, poza grupą po świadomym wyborze (założenie; wymaga prawnika).
4. Q4 - Liczba widocznych punktów: XP osoby i XP grupy plus liga wojen; RP, FCS i XP sezonowe jako szczegół (założenie).
5. Q5 - Cardio w rywalizacji: tylko minuty, bez tętna i kalorii (założenie; wymaga prawnika).
Dodatkowo (nieformalne): baseline z PostHog i informacja, czy produkcja kieruje zapis treningu przez backend Java (D5).

## Uwagi do backlogu
| Uwaga | Źródło (agent) | Właściciel | Priorytet |
|---|---|---|---|
| Java `POST /api/workouts/complete` nie wykonuje publikacji feedu, XP ani reputacji (logika tylko w TS). Jeśli produkcja kieruje zapis przez Javę (D5), funkcja Team nie dostaje danych. Potwierdzić przed MVP | analityk, etap 1 | architekt, właściciel (D5) | Wysoki |
| **Potwierdzone przez architekta (etap 3, `docs/adr/0011-...md` sekcja 2):** ryzyko jest poważniejsze niż tylko brak feedu/XP — `WorkoutService` w `java-backend` zapisuje trening **wyłącznie w pamięci procesu** (`ConcurrentHashMap`), bez bazy danych. Jeśli `JAVA_API_BASE_URL` byłoby ustawione dla tej ścieżki, treningi nie trafiałyby do Turso w ogóle (utrata danych po restarcie, niewidoczność w historii/diecie/raportach, nie tylko w Team). Decyzja architektury: `/api/workouts/complete` zostaje wyłącznie po stronie TS do czasu dopracowania Javy. **Do właściciela**: pilnie sprawdzić w panelu Render, czy `JAVA_API_BASE_URL` jest ustawione dla tej usługi — jeśli tak, to osobny incydent, niezależny od zadania 012. | architekt, etap 3 | właściciel (pilne, poza zadaniem 012) | **Krytyczny** |
| Presence IDOR (audyt HIGH) - zamknąć przed rozszerzeniem widoków wyników grupy | analityk, etap 1 (z `docs/community-notion.md`) | tester-bezpieczenstwa | Wysoki |
| Wzorzec SELECT-then-UPDATE bez CAS w `team-wars.ts` i `team-quests.ts` (już w bledy.md); rotacja misji zwiększa ryzyko. **Rozstrzygnięte przez architekta (etap 3, ADR sekcja 6):** `team-quests.ts` jest już bezpieczne dzięki unique constraints istniejącym w schemacie (`questId`, `badgeKey`, `sourceKey`); realne, nienaprawione ryzyko dotyczy (a) nowego startu misji w rotacji bez admina — rozwiązanie: tabela-semafor `team_active_quest_lock` z PK na `teamId`, i (b) `team-wars.ts` `finalizeWarIfDue`/`applyWarResults` — brak sprawdzenia `rowsAffected` przy warunkowym UPDATE, realne podwójne naliczenie LP/wyników przy równoczesnym wejściu dwóch członków na hub po terminie wojny. Obie poprawki zaplanowane do implementacji w fazie 1 (ADR sekcja 13). | analityk, etap 1; architekt, etap 3 | backend (implementacja) | Wysoki |
| Domyślne ustawienia profilu społecznościowego (`visibility=friends`, `showOnGlobal=1`, `discoverable=1`) - ocena pod kątem widoczności wyników | analityk, etap 1 | prawnik | Wysoki |
| XP drużyny (`team_xp`) i sezonowe XP (`user_season_xp`) zapisywane, ale niewidoczne w UI | analityk, etap 1 | ux | Średni |
| Definicja tygodnia (D9): architekt ustalił (ADR sekcja 3), że `lib/community/fcs-compute.ts` **już liczy tydzień pon-nd** — D9 jest de facto wdrożone dla rankingu/Team. Luka rolling-7-day dotyczy tylko `lib/cardio.ts` (widget pulpitu poza Team), który Team nie musi współdzielić. Do potwierdzenia przez `ux`/`tester`, czy warto ujednolicić też pulpit poza zakresem zadania 012. | architekt, etap 3 | ux, tester (poza 012) | Niski |
| **Rozbieżność architekt/ux na domyślną wartość kolumny zgody.** ADR 0011 (sekcja 4.5) projektuje `user_social_profiles.hide_from_team_ranking INTEGER DEFAULT 0` jako model opt-out, zaznaczając to świadomie jako punkt otwarty do korekty (sekcja 12.1 ADR). `ux` (etap 4), po przeczytaniu werdyktu `prawnik` (ODRZUCONE w zakresie widoczności), zaprojektował model **opt-in**: kolumna powinna mieć semantykę odwrotną (np. `opted_in_to_team_ranking INTEGER DEFAULT 0`, NIE `hide_from_team_ranking DEFAULT 1`, żeby uniknąć podwójnej negacji w kodzie) i decyzja o pokazaniu w rankingu musi płynąć z zgody C-T1 (zapisanej w rejestrze zgód, B-4), nie tylko z jednej kolumny profilu. **Do rozstrzygnięcia przez `architekt` przy ewentualnym przeglądzie po implementacji** (nazwa i domyślna wartość kolumny/kolumn, relacja do rejestru zgód) — nie zmienia layoutu makiety `ux`. | ux, etap 4 | architekt (przy implementacji) | Wysoki |
| Teksty `ConsentSheet` (sekcja 8.7 specyfikacji ux) są oparte na projekcie treści prawnika (sekcja 6.2 `docs/prawo/012-...md`) i **wymagają zatwierdzenia przez prawnika-człowieka przed implementacją** (LR-T20) — nie są gotowe do wdrożenia bez tej akceptacji. | ux, etap 4; prawnik, etap 2 (LR-T20) | prawnik-człowiek | Wysoki |
| Moment otwarcia `ConsentSheet` przy dołączeniu do grupy (modal automatyczny vs. reaktywny z hubu) nieustalony — nie zmienia wyglądu arkusza, tylko moment wywołania. | ux, etap 4 (sekcja 12.2 specyfikacji) | architekt, prawnik (przy implementacji) | Średni |
| **Defekt prywatności: duch lidera bez zgody.** `lib/ghost-training/targets.ts`, `loadGhostTimelineForTarget`, gałąź `kind === "leader"` — pokazuje każdemu członkowi grupy pełny timeline treningu lidera (łącznie z bezwzględnym ciężarem na serię) bez jego zgody. Istniejący defekt, niezależny od reszty redesignu, można naprawić osobno (sekcja 17.2 analizy: US-21, BR-13, BR-14). | analityk (dokończone bez zespołu), sekcja 17.2 | właściciel, backend | **Wysoki** |
| Duch treningowy jako gotowy silnik pojedynku 1:1 — rekomendacja rozszerzenia zamiast budowy nowego systemu dla US-10 (sekcja 17.3, US-17/18). | analityk, sekcja 17.3 | architekt (przy implementacji) | Średni |
