# 012 - Redesign funkcji Team: specyfikacja UX (etap 4)

- **Karta zadania**: `docs/zadania/012-redesign-funkcji-team.md`
- **Analiza biznesowa**: `docs/analiza/012-redesign-funkcji-team.md` (dalej "analiza")
- **System projektowy (stan)**: `docs/ux/00-system-projektowy-stan.md` (dalej "system 00")
- **Makieta**: `docs/ux/012-redesign-funkcji-team-makieta.html`
- **Autor**: ux (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: projekt zaktualizowany po wynikach równoległych bramek: `docs/prawo/012-redesign-funkcji-team.md` (werdykt: **ODRZUCONE w zakresie widoczności wyników**, ZATWIERDZONE dla reszty) i `docs/adr/0011-redesign-funkcji-team.md` (ZATWIERDZONE Z UWAGAMI). Ten dokument **zastępuje model opt-out (ukrywanie) modelem opt-in (zgoda)** w sekcjach 5.1, 5.2, 5.8, 7 i 8 — zgodnie z wiążącą oceną prawną (sekcja 0, 3.4, 6 dokumentu prawnika). Pierwotny projekt zakładał opt-out (Z5/BR-9 analizy, zgodnie z założeniem analityka); prawnik ustalił, że to niezgodne z art. 25 ust. 2 RODO (privacy-by-default) — patrz uzasadnienie w sekcji 12.1 poniżej.
- **Werdykt etapu**: **ZATWIERDZONE Z UWAGAMI** (uwagi: sekcja 12, bez wpływu blokującego na makietę — każda uwaga ma zaprojektowaną alternatywę)

Ten dokument nie zmienia algorytmów (FCS, XP, LP wojen pozostają jak w `lib/community/`, Z3 analizy) ani schematu danych (to `architekt`). Projektuje wyłącznie prezentację, hierarchię informacji i mikrokopię.

---

## 1. Cel i zakres tego etapu

Zaprojektować nowy hub grupy "Dziś w zespole" i katalog odznak z progresem jako elementy flagowej funkcji Team (US-1, US-2, US-3, US-4, US-5, US-6, US-8, US-11, US-15 z analizy), zgodnie z zasadą Z1 (bez nowych tras poza uzasadnionymi) i Z6/BR-3/BR-12 (zakaz danych o wadze, kaloriach, makro, obwodach, zdjęciach, tętnie w rankingach, odznakach i pierścieniach).

Poza zakresem tego dokumentu (zaprojektowane tylko jako notatka/otwarte pytanie, do doprecyzowania przy v1.1): pojedynek 1 na 1 ze znajomym (US-10), udostępnianie karty wyniku, sezon z przepustką.

---

## 2. Diagnoza obecnego ekranu (ocena ux)

Źródła: `components/community/team-detail-view.tsx`, `team-fcs-leaderboard.tsx`, `progression-card.tsx`, `hof/hof-badge-gallery.tsx`, `wars/war-league-badge.tsx`, `app/(dashboard)/community/page.tsx`.

### 2.1 Blokujące dla celu "flagowa funkcja" (naprawiamy w tym zadaniu)
1. Strona grupy to **pionowa lista 8 niezależnych sekcji** (banner, zaproszenia, aktywne treningi, tablica, chat, ranking, osiągnięcia, członkowie, wyzwania) bez jednego "zdjęcia sytuacji" na górze. Użytkownik musi przewinąć, żeby zrozumieć, gdzie stoi w tym tygodniu.
2. **Ranking (`TeamFcsLeaderboard`) pokazuje pełną listę od razu**, zamiast najpierw odpowiedzieć na pytanie "gdzie ja jestem i co mam zrobić" (US-1). Własny wiersz trzeba znaleźć w liście.
3. **XP osoby i grupy nie ma na tej stronie wcale** (potwierdzone w analizie, sekcja 2.1) — `ProgressionCard`/`CommunityLevelBanner` żyją tylko na `/community/challenges` i w hubie `/community`.
4. **Liga wojny (`WarLeagueBadge`) nie ma miejsca na stronie grupy** — trzeba wejść na `/community/wars`.
5. **Katalog odznak nie istnieje.** `HofBadgeGallery` pokazuje tylko 7 kategorii HoF jako emoji w siatce 2/4/7 kolumn, bez dat, bez rozróżnienia zdobyte/zablokowane, bez progresu liczbowego, bez rzadkości (potwierdza lukę z analizy, US-5/US-6).
6. **Brak serii tygodni jako licznika** — streak istnieje tylko jako jeden z 8 składników FCS, niewidoczny bez rozwinięcia wiersza rankingu.
7. **Pusty stan grupy jednoosobowej nie istnieje** — `TeamFcsLeaderboard` pokazuje po prostu listę 1 wiersza zamiast zachęty do zaproszeń (US-1 AC-1.3).

### 2.2 Do naprawy później (nie blokują tego zadania, odnotowane w sekcji 14)
- Niespójność nazewnictwa "Team" / "grupa" / "drużyna" (system 00, sekcja 6).
- Ligi wojny po angielsku (Bronze/Silver/Gold/Platinum/Diamond) — zostają bez zmian w tym zadaniu (nie są to nowe teksty, zmiana wymagałaby przeglądu całego modułu wojen, poza zakresem 012).
- Kafel statystyki w kilku wersjach (`AppStatTile` używany w `team-detail-view.tsx`) — zostaje, bo system 00 już to zna (duplikat #2), nowy hub też używa `AppStatTile`, nie tworzy piątej wersji.
- Potwierdzenia `window.confirm` w `notification-center.tsx`, `team-settings-form.tsx` — poza zakresem tego zadania.

### 2.3 Co zostaje bez zmian wizualnych
`TeamFeedSection` (tablica), `WorkoutChatPanel`, sekcja "Aktywne treningi", lista członków, panel zaproszeń — US-12/US-14 chcą tylko dodanie oznaczenia "gratulacje" w istniejącym feedzie (sekcja 8.6), bez przebudowy układu tych sekcji.

---

## 3. Słownik mikrokopii (decyzja jednorazowa)

Zgodnie z poleceniem "jeden słownik, ustalony raz":

| Pojęcie | Wybrana nazwa w UI | Uzasadnienie |
|---|---|---|
| Encja `teams` (jednostka społeczności) | **"grupa"** w zdaniach i treści (np. "Dołącz do grupy", "Opuść grupę") | Już ugruntowane w `team-detail-view.tsx` ("Opuszczono grupę", "Dołącz do grupy, aby..."). Zmiana całej bazy tekstu na "drużyna" byłaby przebudową poza zakresem 012. |
| Nazwa funkcji / zakładka dolnej belki / brand | **"Team"** (wielka litera, bez odmiany) | Istniejący, ugruntowany element nawigacji (`app-shell.tsx`) i routing (`/community/teams`). Nowy hub to podekran **w ramach** zakładki Team, nie zmieniamy nazwy zakładki. |
| Nowy ekran hubu grupy | **"Dziś w zespole"** | Nazwa z polecenia zadania; "zespół" jako synonim potoczny grupy, używany wyłącznie w tym jednym nagłówku (eyebrow), nie zastępuje "grupy" gdzie indziej. |
| Katalog odznak | **"Odznaki"** (kicker: "Twoja kolekcja") | Krótkie, jednoznaczne, zgodne z istniejącym `user_badges`. |
| Pierścienie tygodnia | **"Tydzień w pierścieniach"** (nagłówek sekcji), pierścienie nazwane "Trening" i "Cardio" | Unika bezpośredniego cytowania Apple ("Activity rings"), czytelne dla PL. |

**Nie zmieniamy** w tym zadaniu: nazw lig wojny (Bronze-Diamond), nazwy "FCS", nazw szablonów wyzwań/misji — to osobny dług (sekcja 2.2).

---

## 4. Architektura informacji i nawigacja

### 4.1 Trasy (zgodnie z Z1 analizy — bez nowych tras bez uzasadnienia)

- `/community/teams/[teamId]` — **zmieniony układ**: nowa sekcja hubu "Dziś w zespole" wchodzi na sam szczyt (zaraz pod nagłówkiem grupy, przed sekcją "Aktywne treningi"). Reszta sekcji (tablica, chat, ranking pełny, osiągnięcia, członkowie, wyzwania) zostaje pod spodem, w obecnej kolejności.
- `/community/teams/[teamId]/badges` — **nowa trasa**, uzasadnienie: katalog odznak (20+ pozycji z progresem) nie mieści się jako sekcja na stronie grupy bez przytłoczenia hubu; potrzebuje własnego ekranu z przewijaniem i filtrem zdobyte/zablokowane. Wejście: kafel "Odznaki" w hubie + link z menu bocznego (grupa "Społeczność").
- Ustawienie widoczności rankingu: **bez nowej trasy**. Dostępne jako arkusz (`Sheet`) otwierany (a) z ikony oka przy pasku "Twoje miejsce" w hubie, (b) z istniejącej `/community/teams/[teamId]/settings` (nowa sekcja w istniejącym formularzu `team-settings-form.tsx`, poza zakresem przeglądu wizualnego tego zadania poza samym przełącznikiem).

### 4.2 Mapa przepływu (tekstowo)

```
/community/teams/[teamId]
 └─ Hub "Dziś w zespole" (góra strony)
     ├─ Pasek "Twoje miejsce w tygodniu" ─(tap wiersza)→ rozwinięcie rozbicia FCS (istniejące, bez zmian)
     │                                    ─(ikona ustawień zgody / CTA "Dołącz do rankingu")→ Arkusz "Udział w rankingu grupy" (`ConsentSheet`)
     ├─ Tydzień w pierścieniach (2 pierścienie) ─(tap)→ bez nawigacji (informacyjne), link "Ustaw cel" → /profile (cele onboardingu)
     ├─ Poziomy (XP osoba + grupa) ─(tap "Szczegóły")→ /community/challenges (istniejący `ProgressionCard`, bez duplikowania logiki)
     ├─ Seria tygodni (licznik) — bez nawigacji, informacyjny
     ├─ Misja/wyzwanie tygodnia ─(tap)→ /community/teams/[teamId]/quests albo /challenges/[id] (istniejące trasy)
     ├─ Liga wojny ─(tap "Zobacz wojny")→ /community/wars
     └─ Kafel "Odznaki · X/Y zdobytych" ─(tap)→ /community/teams/[teamId]/badges
 └─ (sekcje istniejące bez zmian układu: Aktywne treningi, Tablica, Chat, Ranking pełny, Osiągnięcia, Członkowie, Wyzwania)

/community/teams/[teamId]/badges
 ├─ Segmentowany filtr: Wszystkie / Zdobyte / Zablokowane
 └─ Siatka kart odznak ─(tap zdobytej)→ arkusz ze szczegółem (data, źródło, rzadkość)
                        ─(tap zablokowanej)→ arkusz z progresem i wskazówką "co zrobić"
```

### 4.3 Hierarchia na hubie (jeden ekran, jedna historia)

Kolejność odpowiada na pytania w naturalnej sekwencji "gdzie jestem → co robię teraz → co osiągnęłam → do czego dążę":
1. **Twoje miejsce w tygodniu** (US-1) — najważniejsze, na samej górze, jeden wynik + jedna wskazówka.
2. **Tydzień w pierścieniach** (US-3) — "co mam zrobić dziś/w tym tygodniu", wizualnie najbardziej angażujące.
3. **Poziomy** (US-2) — "ile już zbudowałam" (dwa liczniki, nie więcej — Q4 analizy).
4. **Seria tygodni** (US-4) — mały, poziomy pasek pod poziomami, nie osobna duża karta (niska waga informacyjna względem 1-3).
5. **Misja tygodnia** (US-8) — "co robimy razem".
6. **Liga wojny** (US-11) — "jak wypadamy na tle innych grup".
7. **Kafel Odznaki** — wejście do kolekcji, zamyka hub zachętą "zbierz więcej".

---

## 5. Komponenty (nowe i rozszerzone)

Zasada: rozszerzamy istniejące klocki (`app-card`, `AppStatTile`, `Button`, `SectionLabel`, wzorce z `progress-ui.tsx`), nie tworzymy równoległego języka wizualnego. Żaden nowy kolor na sztywno — wyłącznie tokeny z `app/globals.css` wymienione w komentarzu makiety.

### 5.1 `TeamWeekPositionCard` (nowy, zastępuje widoczność na starcie — `TeamFcsLeaderboard` zostaje, ale niżej na stronie jako "pełny ranking")
- **Cel**: jedna liczba (miejsce), jedna wskazówka tekstowa, link do pełnego rozbicia.
- **Układ**: wariant `hero` karty (gradient `--gym-gold` jak w `009`), duża liczba miejsca (`.font-metric`), tekst wskazówki pod spodem, mały pasek postępu do pozycji wyżej.
- **Model zgody (poprawiony po bramce `prawnik`, opt-in zamiast opt-out):** karta ma **trzy** stany nadrzędne, nie dwa:
  1. **Zgoda nie udzielona** (domyślny stan każdego nowego członka, zgodnie z C-T1 — patrz sekcja 5.8) — karta nie pokazuje żadnej liczby ani miejsca (bo go po prostu nie ma — serwer nie liczy wiersza tej osoby w rankingu bez zgody), tylko CTA "Dołącz do rankingu grupy" (otwiera `ConsentSheet`, sekcja 5.8).
  2. **Zgoda udzielona, w rankingu** — pełny wariant jak w sekcji 7, stan 2-3.
  3. **Zgoda wycofana** (osoba była w rankingu, wyłączyła) — skrócony wariant "Twój wynik jest ukryty dla grupy" + CTA "Dołącz ponownie" (sekcja 7, stan 10).
- **Ikona ustawień zgody**: `Settings2`/`Eye` (lucide) w rogu karty, `button` 44×44 px, `aria-label="Ustawienia udziału w rankingu"` — otwiera `ConsentSheet` niezależnie od aktualnego stanu (żeby wycofać albo dołączyć ponownie).

### 5.2 `WeeklyRings` (nowy)
- **Cel**: 2 pierścienie koncentryczne — zewnętrzny "Trening" (złoty `--gym-gold`), wewnętrzny "Cardio" (zielony `--gym-success`, odróżnienie bez polegania tylko na pozycji).
- **Różnica względem Apple Fitness (świadoma)**: tylko 2 pierścienie (nie 3), środek wypełniony ikoną (hantla dla treningu jako dominujący, serce dla cardio jako mały badge przy pierścieniu wewnętrznym — kolor nie jest jedynym nośnikiem), brak gradientu tęczowego (tylko dwa tony z palety marki), stan "zamknięty" pokazuje **plakietkę ze znacznikiem ✓ i jednorazowy pulsujący pierścień (`prefers-reduced-motion`: bez animacji, statyczna plakietka)**, nie confetti ani fajerwerki.
- **Dane**: wyłącznie liczba treningów / cel tygodniowy i minuty cardio / cel tygodniowy (Z6, BR-3). Żadnych kalorii w etykiecie.
- **Tekst pod pierścieniami**: "X z Y treningów" i "X z Y min cardio", liczby `tabular-nums`.
- **Stan bez ustawionego celu** (AC-3.3): domyślna wartość widoczna wprost w tekście ("cel domyślny: 3 treningi/tydz.") + link "Zmień cel" → `/profile`.
- **Pierścień "Trening" jest zawsze widoczny właścicielowi** — to dane wyłącznie osobiste (nikt inny ich nie widzi na tym etapie, zgoda C-T1 dotyczy pokazywania **innym** w rankingu grupy, nie dotyczy własnego hubu), zgodnie z zakresem prawnika ("ZATWIERDZONE dla pracy architekta i ux... własne XP, katalog odznak, pierścienie i seria tygodni widoczne tylko dla właściciela").
- **Pierścień "Cardio" wymaga osobnej zgody C-T2** tylko w momencie, gdy wartość miałaby trafić do rankingu grupy lub tablicy — na własnym hubie (widoczne tylko dla właściciela, jak wyżej) pierścień cardio jest pokazywany bez dodatkowej zgody. Jeśli `prawnik`/`architekt` ostatecznie zdecydują inaczej (że nawet widok własny wymaga C-T2, bo np. dane trafiają też do rankingu równolegle), pierścień cardio dostaje 4. stan: "Zablokowany do czasu zgody" z przyciskiem "Pokazuj minuty cardio" (ten sam `ConsentSheet`, sekcja 5.8) — layout nie wymaga przeprojektowania, tylko podmiany treści drugiego pierścienia na placeholder z `Lock`.

### 5.3 `TeamLevelsCard` (rozszerza `ProgressionCard`/`CommunityLevelBanner`, nowe miejsce — nie duplikat)
- Dwa mini-paski w jednej karcie: "Ty" (poziom + pasek do następnego) i "Grupa" (poziom + pasek). Jedna karta, nie dwie osobne (BR-1 — jedna widoczna hierarchia, RP/FCS/sezonowe XP nie pojawiają się tutaj).
- Link "Szczegóły poziomu" → `/community/challenges` (gdzie już są `ProgressionCard`/`ReputationCard` pełne — nie kopiujemy ich logiki).

### 5.4 `StreakStrip` (nowy, lekki)
- Jedna linia: ikona płomienia (istniejąca `i-flame`/`Flame` z lucide, już używana w `009`), liczba tygodni, tekst statusu. Nie osobna duża karta — pasek wysokości ~56 px pod `TeamLevelsCard`.
- Stan ostrzeżenia (AC-4.2): kolor tekstu pozostaje neutralny (nie czerwony — to nie błąd, to zachęta), ale dochodzi ikona z wykrzyknikiem i tekst "Zrób dziś trening, by nie przerwać serii".

### 5.5 `TeamMissionCard` (rozszerza wzorzec `ChallengeCard`, nowe dane: progres grupowy)
- Pasek postępu **grupowy** (suma wkładu członków), nie indywidualny — odróżnia misję (US-8) od wyzwania osobistego.
- Nagłówek: nazwa misji + ikona celu (pulsujący dumbbell/serce zależnie od typu metryki).
- Stan "grupa zbyt mała" (AC-8.3): baner `InlineBanner variant="info"` pod paskiem: "Misje zespołowe działają najlepiej w grupie 3+ osób. Zaproś kogoś, aby przyspieszyć."

### 5.6 `WarLeagueCard` (nowa karta na hubie, reużywa `WarLeagueBadge`)
- Plakietka ligi (istniejący komponent, bez zmian wizualnych) + pasek LP do progu następnej ligi + CTA "Zobacz wojny".
- Stan "zespół bez wojen" (AC-11.2): plakietka "Bronze" + tekst "Jeszcze nie graliście. Dołączcie do kolejki wojny." + przycisk.

### 5.7 `BadgeTile` i katalog `/badges` (nowy, zastępuje `HofBadgeGallery` jako docelowy wzorzec — `HofBadgeGallery` zostaje bez zmian na `/hall-of-fame`, to osobny ekran; nowy komponent żyje w `community/badges/`)
- **Kształt ramki koduje kategorię** (dodatkowy nośnik obok koloru, WCAG — "kolor nigdy nie jest jedynym nośnikiem"):
  - koło (`border-radius: 999px`) = odznaka wyzwania (challenge),
  - zaokrojony sześciokąt (`clip-path` heksagon) = odznaka misji zespołu (team quest),
  - gwiazda z wycięciem (`clip-path` gwiazda 6-ramienna, uproszczona) = odznaka galerii sławy (rzadka).
  Każda ramka ma też tekstową etykietę kategorii pod spodem — kształt wspiera, nie zastępuje tekstu.
- **Zdobyta**: pełny kolor (złoto na krawędzi), emoji/ikona w środku, data pod spodem (`14.10.2026`), źródło (np. "Wyzwanie: 50 treningów"), opcjonalny pill rzadkości (AC-6.1/6.2).
- **Zablokowana**: ta sama ramka w konturze (`opacity: .45`, `border-style: dashed` dla dodatkowego sygnału nie tylko koloru), ikona `Lock` 14 px w rogu, pasek progresu pod spodem ("37/50"), bez daty.
- **Siatka**: `grid-cols-2 sm:grid-cols-3`, karty min. 140×160 px (dotyk > 44 px na całej karcie, nie tylko ikonie).

### 5.8 `ConsentSheet` (nowy, US-15 — **poprawiony model: opt-in, nie opt-out**)

Zgodnie z werdyktem `prawnik` (etap 2, sekcja 0 i 6.3 `docs/prawo/012-...md`): udział w rankingu grupy wymaga **aktywnej, niezaznaczonej domyślnie zgody** (C-T1), nie jest to przełącznik "ukryj" dla czegoś domyślnie widocznego. Pierwotna nazwa `VisibilitySheet`/"ukryj mój wynik" (opt-out) **zastąpiona** przez `ConsentSheet` z dwoma niezaznaczonymi checkboxami, zgodnie z projektem treści prawnika (sekcja 6.2 dokumentu prawnego):

- `Sheet` (istniejący komponent) z:
  1. Checkbox **"Biorę udział w rankingu grupy"** (C-T1) — **niezaznaczony domyślnie**. Opis: "Członkowie grupy zobaczą Twój pseudonim, liczbę treningów, serie tygodni, postęp względny i odznaki. Nikt spoza grupy tego nie zobaczy."
  2. Checkbox **"Pokazuj też minuty cardio"** (C-T2) — **niezaznaczony domyślnie**, aktywny tylko gdy checkbox 1 jest zaznaczony (szary/disabled, gdy nie). Opis: "Minuty cardio w rankingu i pierścieniu widocznym dla grupy. Bez tętna i kalorii — to nigdy nie trafia do rankingu."
  3. Przycisk **"Zapisz"** (nie "Zapisz zmiany" domyślny z `useSaveFeedback`, ale ten sam mechanizm powiadomienia o sukcesie).
- Gdy oba checkboxy odznaczone i użytkownik zapisuje: komunikat "Nie bierzesz udziału w rankingu grupy. Nadal widzisz tablicę, czat i możesz trenować razem z grupą." (zamiast poprzedniego copy "Ukryto wynik" — teraz to stan domyślny, nie akcja ukrycia).
- Otwierany: (a) z CTA "Dołącz do rankingu grupy" na `TeamWeekPositionCard` w stanie "zgoda nie udzielona"; (b) z ikony `Settings2` na karcie w pozostałych stanach; (c) docelowo też z przepływu dołączania do grupy (`teams.ts` join flow, poza zakresem wizualnym tego dokumentu — `architekt`/`prawnik` ustalają dokładny moment, sekcja 6.2 dokumentu prawnego proponuje ekran "Twoje wyniki" przy dołączeniu).
- Potwierdzenie zmiany przez `useSaveFeedback` (istniejący wzorzec, bez nowego systemu powiadomień).
- **Nazwa wyświetlana w rankingu**: zgodnie z LR-T7, domyślnie pseudonim ustawiony przez użytkownika, nigdy prefiks e-maila. To dotyczy danych już istniejących (`displayName`) — `ConsentSheet` nie dodaje nowego pola, tylko korzysta z tego, co użytkownik już ma ustawione w profilu; jeśli pseudonim nie jest ustawiony, arkusz pokazuje link "Ustaw pseudonim w profilu" zamiast pozwalać zapisać zgodę bez niego (żeby uniknąć fallbacku na e-mail, B-1/LR-T7).

---

## 6. Rozmiar i proporcje (zasady ogólne hubu)

- Jeden **główny** element na ekranie na raz (zasada z karty zadania): `TeamWeekPositionCard` ma być wizualnie największy (hero, pełna szerokość, min. 180 px wysokości); pozostałe karty to wsparcie, mniejsze.
- Odstęp między sekcjami hubu: `gap: 12px` (gęściej niż `space-y-5` reszty strony — to ma być "jeden pulpit", nie seria osobnych sekcji) — w ramach jednego kontenera `app-card` z wewnętrznymi separatorami, **nie** 7 osobnych `app-card`. Wyjątek: `WeeklyRings` i `TeamMissionCard` mają własne tło/akcent (gradient), więc zostają wizualnie wydzielone jako karty w obrębie tego samego kontenera (patrz makieta).
- Maksymalna liczba "liczników" widocznych jednocześnie bez przewijania: 4 (miejsce w rankingu, 2 pierścienie liczone jako jeden blok, poziom osoby, seria) — reszta (grupa, misja, liga, odznaki) wymaga przewinięcia w dół tego samego huba, zgodnie z priorytetem w sekcji 4.3.

---

## 7. Stany ekranów (wymagane przez kartę zadania, sekcja 15.3 analizy)

| # | Stan | Opis | Pokazane w makiecie |
|---|---|---|---|
| 0 | **Zgoda na ranking nie udzielona (domyślny stan nowego/obecnego członka)** | `TeamWeekPositionCard` bez liczby miejsca (serwer jej nie liczy dla tej osoby bez C-T1): nagłówek "Dołącz do rankingu grupy" + jedno zdanie wyjaśnienia (sekcja 8.7) + CTA otwierający `ConsentSheet`. **To jest stan domyślny po wdrożeniu dla wszystkich kont (migracja B-3), nie przypadek brzegowy** | Tak (Ramka C, wariant 1) |
| 1 | Pierwszy tydzień grupy (1 osoba, zgoda udzielona) | `TeamWeekPositionCard` zastąpiony kartą zaproszenia: "Zaproś kogoś, aby zobaczyć ranking tygodnia" + kod grupy + przycisk "Udostępnij kod" (AC-1.3). Pierścienie i poziom osoby **zostają widoczne** (dane indywidualne, nie zależą od grupy ani od zgody C-T1 — patrz sekcja 5.2) | Tak (Ramka B) |
| 2 | Grupa aktywna, członek w środku rankingu, zgoda udzielona | Pełny hub z wynikiem "4. miejsce z 9", wskazówką "Brakuje 1 treningu do 3. miejsca" | Tak (Ramka A) |
| 3 | Członek na końcu rankingu | Wskazówka zmienia ton na wspierający, nie porównawczy: "Zrób trening w tym tygodniu, aby wejść na tablicę" zamiast "Brakuje X do ostatniego". Brak numeru "9/9" z negatywnym kolorem — neutralny, bez czerwieni (unikanie wstydu, ryzyko z analizy sekcja 13; zgodne z LR-T14 prawnika — zakaz publicznych wskaźników nieaktywności) | Opisane w sekcji 8.1, nie osobna ramka w HTML (wariant tekstu) |
| 4 | Zamknięty pierścień | Plakietka ✓ nad pierścieniem + jedno zdarzenie w tablicy (nie duplikowane przy ponownym wejściu — logika po stronie backend, UI pokazuje stan trwały) | Tak (Ramka C, wariant 2) |
| 5 | Misja aktywna | Pasek postępu grupowego z wartością < 100% | Tak (Ramka A) |
| 6 | Misja zakończona | Karta zmienia nagłówek na "Misja ukończona!" + lista nagród (odznaka + XP dla każdego), CTA znika, pasek 100% w kolorze sukcesu | Opisane (sekcja 8.5), wariant tekstowy |
| 7 | Brak odznak (nowy użytkownik) | Katalog pokazuje 1 wyróżnioną kartę "Pierwszy trening" na górze (AC-5.3) + resztę zablokowanych w szarości | Tak (Ramka E) |
| 8 | Katalog z progresem | Mieszanka zdobytych i zablokowanych z paskami | Tak (Ramka D) |
| 9 | Rzadkość ukryta (mało użytkowników / niezdefiniowany próg N) | Karta zdobytej odznaki bez pilla procentowego — nie "0%", po prostu brak elementu (AC-6.2; `architekt` i `prawnik` ustalają próg N w agregacie globalnym — sekcja 9 ADR 0011, LR-T12 prawnika) | Tak (Ramka D, jedna z kart) |
| 10 | Zgoda wycofana (była udzielona, użytkownik ją cofnął) | `TeamWeekPositionCard` zamieniona na skróconą wersję: "Nie bierzesz udziału w rankingu grupy" + przycisk "Dołącz ponownie" — treść neutralna, bez implikacji "ukrywania się" | Tak (Ramka C, wariant 3) |
| 11 | Błąd sieci | Cała sekcja hubu: `InlineBanner variant="error"` + "Nie udało się wczytać danych tygodnia. Spróbuj ponownie." + przycisk odświeżenia; pierścienie i karty pod spodem pokazują ostatnio znaną wartość z etykietą "dane sprzed 12 min" (zgodnie z wymaganiem niefunkcjonalnym offline/PWA z analizy, sekcja 10) | Opisane (sekcja 8.8), nie osobna ramka (powtarzalny wzorzec `InlineBanner`, już w systemie 00) |
| 12 | Ładowanie | Szkielet: prostokąty `animate-pulse` w kształcie docelowych kart (hero, 2 koła, 2 paski) — wzorzec zgodny z `DashboardRouteSkeleton` | Opisane (sekcja 8.8), nie osobna ramka |

**Uwaga o zmianie modelu:** poprzednia wersja tego dokumentu projektowała stan 0 i 10 jako jeden stan "opt-out/ukryty" (domyślnie widoczny, z przełącznikiem ukrycia). Po werdykcie `prawnik` (etap 2, ODRZUCONE w zakresie widoczności) model zmienia się na opt-in: stan 0 (brak zgody) jest teraz **stanem domyślnym i najczęstszym** tuż po wdrożeniu, a stan 2 (pełny ranking) jest tym, do którego użytkownik świadomie dochodzi przez `ConsentSheet`. Hierarchia makiety (Ramka A jako "stan docelowy po zgodzie") się nie zmienia, zmienia się tylko to, który stan jest punktem wyjścia.

---

## 8. Mikrokopia (PL, do wdrożenia dosłownie lub z uzasadnioną korektą `frontend`)

### 8.1 Pasek miejsca w rankingu
- Nagłówek (eyebrow): "Dziś w zespole"
- Wynik: "{rank}. miejsce" + mały tekst "z {total} w tym tygodniu"
- Wskazówka (środek rankingu): "Brakuje {N} treningu/treningów do {rank-1}. miejsca" (odmiana liczebnika wg reguł PL — "1 treningu", "2-4 treningów" jeśli trzeba prościej: zawsze "treningów")
- Wskazówka (lider): "Jesteś na czele tego tygodnia. Utrzymaj tempo."
- Wskazówka (ostatnie miejsce / brak aktywności): "Zrób trening w tym tygodniu, aby wejść na tablicę."
- Tytuł sekcji przy rozbiciu (bez zmian): istniejące "FCS 0–100: progres, regularność, plan, streak, challenge, social, pomoc, live — nie same kg."

### 8.2 Pierścienie
- Nagłówek: "Tydzień w pierścieniach"
- Podtytuł: "Poniedziałek–niedziela"
- Etykieta pierścienia 1: "Trening" / wartość "{x} z {y}"
- Etykieta pierścienia 2: "Cardio" / wartość "{x} z {y} min"
- Zamknięty cel: "Cel zrealizowany"
- Brak ustawionego celu: "Używamy domyślnego celu: {y}. Zmień go w profilu."

### 8.3 Poziomy
- Nagłówek: "Poziomy"
- "Ty" / "Grupa"
- Pasek: "{into} / {need} XP do poziomu {next}"
- Link: "Szczegóły poziomu"

### 8.4 Seria tygodni
- Aktywna: "{N} tyg. z rzędu z treningiem"
- Ostrzeżenie: "Zrób dziś trening, by nie przerwać serii"
- Zerowa (nowy użytkownik): "Zacznij serię — zrób trening w tym tygodniu"

### 8.5 Misja
- Nagłówek: "Misja tygodnia"
- Aktywna: "{nazwa misji}" / pasek / "{postęp} z {cel}"
- Zakończona: "Misja ukończona! Każdy aktywny członek dostał odznakę i XP."
- Zbyt mała grupa: "Misje zespołowe działają najlepiej w grupie 3+ osób. Zaproś kogoś, aby przyspieszyć."

### 8.6 Tablica — wyróżnienie "gratulacje" (US-12, bez przebudowy układu)
- Etykieta na auto-poście typu `personal_record`: pill "Gratulacje 🎉" obok istniejącej etykiety typu posta.
- Przy długiej serii (≥4 tygodnie): dodatkowy pill "{N} tyg. z rzędu".
- Limit: maks. 1 pill gratulacji na post (AC-12.2 — jeśli wiele rekordów w treningu, jeden post zbiorczy, bez zmiany tego mechanizmu backendowego, tylko front pokazuje jeden pill zbiorczy "Kilka rekordów naraz!").

### 8.7 Zgoda na ranking (US-15, model opt-in — teksty zgodne z projektem prawnika, sekcja 6.2 `docs/prawo/012-...md`; **wymagają zatwierdzenia przez prawnika-człowieka przed implementacją**, LR-T20)
- Tytuł arkusza: "Udział w rankingu grupy"
- Opis wprowadzający: "Członkowie grupy [nazwa grupy] zobaczą w rankingu tygodniowym: Twój pseudonim, liczbę treningów w tygodniu, serie tygodni, postęp siły w procentach względem Twoich wcześniejszych wyników oraz XP i odznaki. Nikt spoza grupy tych danych nie zobaczy. Nie pokażemy innym Twojej wagi, pomiarów, zdjęć, posiłków, tętna ani kalorii."
- Checkbox 1 (niezaznaczony): "Biorę udział w rankingu grupy (opcjonalne)"
- Checkbox 2 (niezaznaczony, aktywny tylko po zaznaczeniu 1): "Pokazuj też minuty cardio (osobna zgoda, opcjonalna)"
- Przycisk: "Zapisz"
- Stan przed zgodą na hubie: "Dołącz do rankingu grupy" + jedno zdanie: "Zobacz, jak wypadasz na tle grupy w tym tygodniu."
- Potwierdzenie (toast/`useSaveFeedback`) po zapisaniu zgody: "Zapisano Twój udział w rankingu."
- Potwierdzenie po wycofaniu: "Nie bierzesz już udziału w rankingu grupy."
- Stan wycofanej zgody na hubie: "Nie bierzesz udziału w rankingu grupy." + link "Dołącz ponownie"

### 8.8 Błąd / offline
- Błąd: "Nie udało się wczytać danych tygodnia." + przycisk "Spróbuj ponownie"
- Dane nieaktualne: "Dane sprzed {N} min"

### 8.9 Odznaki
- Nagłówek ekranu: eyebrow "Twoja kolekcja", h1 "Odznaki"
- Filtr: "Wszystkie" / "Zdobyte ({n})" / "Zablokowane ({n})"
- Karta zdobyta: nazwa, data, źródło (np. "Wyzwanie: 50 treningów"), opcjonalnie "Zdobyło {pct}% osób"
- Karta zablokowana: nazwa, pasek, "{postęp}/{cel}"
- Pusty katalog (nowy użytkownik): baner nad siatką "Zacznij od najprostszej: {nazwa sugerowanej odznaki}" z CTA do akcji (np. "Zacznij trening")

---

## 9. Uzasadnienie wobec Strava i Apple Fitness

| Element | Co przejęto | Co świadomie zmieniono | Dlaczego |
|---|---|---|---|
| Pierścienie | Ideę jednego czytelnego celu widocznego na pierwszym ekranie | 2 zamiast 3 pierścienie, bez celu kalorycznego, własna paleta (złoto/zielony zamiast czerwony/zielony/niebieski Apple), środek z ikoną zamiast pustego kółka, celebracja statyczną plakietką zamiast animacji konfetti | BR-3/BR-12 wykluczają kalorie; różna paleta i kształt środka odróżniają produkt, nie kopiują 1:1; spokojniejsza celebracja pasuje do zasady "unikaj komunikatów wzmacniających presję" |
| Ranking tygodniowy | Ideę "segmentu" jako powracającego, zamkniętego okresu rywalizacji | Zamiast rankingu czasu na odcinku — ranking FCS (progres względny), zamiast pełnej listy na starcie — najpierw własne miejsce + wskazówka | BR-3/US-16: zakaz rankingów absolutnych, priorytet "co mam zrobić" nad "cała tabela" |
| Kudos / reakcje | Już zaimplementowane (6 typów), zostają bez zmian wizualnych | Dodano tylko pill "Gratulacje" przy PR i serii | Nie duplikujemy mechaniki, tylko podkreślamy wyjątkowe momenty (US-12) |
| Odznaki (koło/sześciokąt Apple) | Ideę różnych kształtów dla różnych typów nagród jako dodatkowy nośnik informacji | 3 kształty własne (koło/hex/gwiazda) powiązane z istniejącym podziałem domenowym GymBrat (wyzwania/misje/HoF), nie z podziałem Apple (rekord/seria) | Dopasowanie do istniejącego modelu danych (`challenges`, `team-quests`, `hof`), a nie importowanie obcej taksonomii |
| Zawody tygodniowe 1 na 1 | Zanotowane jako najsilniejsza pętla Apple | **Nie projektowane w tym etapie** (US-10 to Should/v1.1) | Zgodnie z priorytetyzacją MVP w analizie (sekcja 9), ten etap obejmuje hub + odznaki |
| Local legend / tytuł dożywotni | — | **Odrzucone w całości** (zgodnie z analizą, sekcja 3.3) | Blokuje nowych członków, sprzeczne z BR "rywalizacja względna, nie wykluczająca" |

---

## 10. Dostępność (WCAG 2.2 AA)

- Pierścienie: `role="img"` z `aria-label` opisującym oba wyniki słownie (np. "Trening: 2 z 4, Cardio: 60 z 150 minut"), nie tylko wizualny SVG.
- Kolor nigdy jedynym nośnikiem: pierścienie mają ikony w środku, odznaki mają kształt + ikonę `Lock` + tekst "zablokowana", wskazówki rankingu są tekstowe (nie tylko kolor paska).
- Wszystkie interaktywne elementy (ikona oka, karty odznak, przyciski CTA) min. 44×44 px (karty odznak liczone jako cała powierzchnia karty, nie tylko ikona).
- Fokus: standardowy `:focus-visible` z systemu 00, bez nowych wzorców.
- Ruch: pulsująca plakietka zamkniętego pierścienia i ewentualny `animate-ping` na hubie respektują `prefers-reduced-motion` (zgodnie z lukami odnotowanymi w systemie 00, sekcja 7 — nowy kod ma **nie powtarzać** tego długu).
- Czytniki ekranu: pasek postępu misji ma `aria-valuenow/min/max` lub tekstowy odpowiednik procentu.

---

## 11. Responsywność

- Mobile-first, szerokość referencyjna 390 px (telefon), zgodnie z resztą makiet `docs/ux/00*`.
- Hub: jedna kolumna na mobile; od `sm` pierścienie i poziomy mogą ułożyć się w 2 kolumny wewnątrz tej samej karty (nie zmienia hierarchii, tylko gęstość).
- Katalog odznak: `grid-cols-2` na mobile, `sm:grid-cols-3`, zgodnie z istniejącym wzorcem `HofBadgeGallery` (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-7` — tu węższe karty z progresem wymagają mniej kolumn niż emoji HoF).
- Desktop: `APP_SHELL_MAX` z systemu 00 (jedna kolumna nawet na szerokich ekranach) — bez nowego układu desktopowego, zgodnie z resztą aplikacji.

---

## 12. Otwarte pytania i stan po bramkach `prawnik`/`architekt`

Ta sekcja była pierwotnie napisana przed wynikami etapów 2 (`prawnik`) i 3 (`architekt`), które zapadły równolegle. Poniżej stan **po** ich uwzględnieniu — co było otwarte i zostało rozstrzygnięte (poprawiono w sekcjach 5.1/5.2/5.8/7/8.7), i co zostaje otwarte dalej.

### 12.0 Rozstrzygnięte (nie są już pytaniami)
- **Model widoczności: opt-in, nie opt-out.** `prawnik` (etap 2, werdykt ODRZUCONE w zakresie widoczności) ustalił wiążąco, że domyślna widoczność wyniku musi być "brak" do czasu świadomej zgody (art. 25 ust. 2 RODO), nie "widoczny, można ukryć". Zastosowane w całym dokumencie (sekcje 5.1, 5.2, 5.8, 7, 8.7).
- **Nazwa w rankingu: pseudonim, nigdy prefiks e-maila** (LR-T7) — zastosowane w sekcji 5.8.
- **Minuty cardio: dopuszczalne, ale za osobną zgodą C-T2**, nigdy razem z tętnem/kcal/strefami w tym samym payloadzie (sekcja 3.3 dokumentu prawnika) — zastosowane w sekcji 5.2. To odpowiada dawnemu pytaniu 4 poniżej.
- **Komponent "live"/obecność na żywo na hubie: wyłączony w MVP** (rekomendacja prawnika PO-T4, zgodna z blokadą `architekt` w ADR sekcja 11 — IDOR presence nienaprawiony). Hub w tym projekcie **nie pokazuje** "kto trenuje teraz" — żadna z zaprojektowanych kart (pozycja, pierścienie, poziomy, streak, misja, liga, odznaki) nie wymaga danych presence, więc to nie wymaga zmiany makiety.

### 12.1 Nadal otwarte (nie blokują tej makiety, każde ma zaprojektowaną alternatywę)

1. **Zakres zgody — per grupa czy globalnie dla użytkownika?** `architekt` (ADR 0011, sekcja 4.5 i 12.1) zaprojektował `hide_from_team_ranking`/zgodę jako kolumnę **globalną** w `user_social_profiles` (prostsza, tańsza w zapytaniu), ale zostawił otwarte, czy `prawnik`/`ux` uzna model per-grupa za konieczny. **Stanowisko ux**: model globalny jest wystarczający dla czytelności UI (jeden `ConsentSheet`, jeden stan na hubie) i zgodny z tym, że ranking pokazuje te same typy danych w każdej grupie — rekomendujemy zostać przy globalnym, chyba że `prawnik` wskaże konkretne ryzyko (np. osoba w dwóch grupach o różnym charakterze chce różnicować). Jeśli jednak ma być per grupa: `ConsentSheet` nie zmienia układu, tylko traci frazę "wszystkie Twoje grupy" i zapisuje zgodę per `teamId` (zmiana tekstu, nie layoutu).
2. **Czy wycofanie zgody ukrywa też auto-posty w tablicy (np. "zamknięty pierścień", gratulacje)?** `prawnik` (LR-T10) rozstrzygnął, że auto-posty i wzmianki o wkładzie w misji **wymagają aktywnej zgody C-T1** — więc odpowiedź brzmi: tak, bez zgody dana osoba nie pojawia się w auto-postach ani w ich treści. Zastosowane domyślnie: sekcja 8.6 (gratulacje) dotyczy tylko osób z C-T1. **Pozostaje otwarte dla `tester`/`frontend` przy implementacji**: dokładny UX komunikatu w tablicy, gdy ktoś bez zgody kończy trening (czy pojawia się post "neutralny" bez wyniku, czy nic) — do ustalenia przy implementacji, nie zmienia projektu hubu.
3. **Konta 16-17 lat (AC-15.4, D18, B-5 prawnika).** To jest **zależność blokująca wdrożenie** (nie tylko pytanie projektowe) — `prawnik` ustalił w sekcji 4 swojego dokumentu, że Team ma być zablokowany dla kont <16 i ograniczony dla 16-17 (tylko grupy prywatne, bez widoczności poza grupą, bez rankingu minut cardio domyślnie). Projekt w tym dokumencie **nie różnicuje wizualnie** konta nastoletniego od dorosłego na poziomie hubu (ten sam układ, ta sama logika opt-in). Jeśli przy implementacji D18 wejdzie w życie, hub nie wymaga nowego stanu wizualnego — tylko serwer filtruje dane inaczej dla segmentu wieku (zgodnie z ADR sekcja 12.3); ewentualny dodatkowy komunikat ograniczający (np. "Twoja grupa jest widoczna tylko dla rówieśników") to nowy, prosty wariant tekstu w istniejącej karcie, nie nowy layout.
4. **Próg rzadkości N i sposób liczenia (globalnie vs per grupa).** `prawnik` (LR-T12) wymaga liczenia globalnego z progiem **co najmniej 50** (surowszy niż założenie analizy "20"), żeby uniknąć reidentyfikacji w małej grupie. Zastosowane w sekcji 7 (stan 9) jako odniesienie do ostatecznej decyzji `architekt`+`prawnik`; sama makieta pokazuje mechanizm (pill znika poniżej progu) niezależnie od finalnej liczby.

### 12.2 Zależność od implementacji `ConsentSheet` w przepływie dołączania do grupy
`prawnik` (sekcja 6.2 dokumentu prawnego) proponuje, żeby pytanie o zgodę C-T1/C-T2 pojawiało się **przy dołączeniu do grupy** (`teams.ts` join flow), nie tylko reaktywnie z hubu. Ten dokument projektuje `ConsentSheet` jako komponent uniwersalny (otwierany z kilku miejsc, sekcja 5.8) — czy pierwsze wejście do nowej grupy pokazuje go automatycznie (modal), czy czeka na akcję użytkownika z hubu, to decyzja do podjęcia wspólnie z `architekt`/`prawnik` przy implementacji (nie zmienia treści ani wyglądu samego arkusza).

---

## 13. Zależność od decyzji `architekt` (nie blokuje makiety, blokuje implementację)

- Definicja tygodnia (D9, pon-nd) — makieta zakłada, że jest wdrożona; jeśli nie, etykieta "Poniedziałek–niedziela" pod pierścieniami i misją musi poczekać lub pokazać okres faktycznie liczony, z notatką (ryzyko z analizy, sekcja 11 pkt 2, AC-3.4).
- Źródło progresu w katalogu odznak (agregacja/cache rzadkości) — wizualnie pill rzadkości jest opcjonalny (znika, gdy dana niedostępna z cache), więc brak danych nie blokuje reszty ekranu.
- Rotacja misji (US-8) — jeśli `architekt` zdecyduje, że w danym tygodniu może nie być żadnej aktywnej misji, `TeamMissionCard` potrzebuje 13. stanu: "Brak aktywnej misji w tym tygodniu" z neutralnym tekstem (nie błąd) — dodać przy implementacji, jeśli scenariusz jest możliwy.

---

## 14. Uwagi do wspólnego backlogu (`docs/bledy-do-naprawy/bledy.md`)

Zapisane w pliku wspólnym (sekcja "UX"), nie blokują tego zadania:
- Niespójność "Team"/"grupa"/"drużyna" w pozostałych ekranach społeczności poza zakresem 012 (nazewnictwo w tym dokumencie dotyczy tylko nowych tekstów).
- Ligi wojny po angielsku (`WAR_LEAGUE_META`) — tłumaczenie na PL to osobna decyzja produktowa (ryzyko: zmiana identyfikatorów lig w logice `team-wars.ts`, nie tylko etykiet).
- `HofBadgeGallery` (osobny ekran `/hall-of-fame`) ma inny, starszy wzorzec siatki odznak (emoji bez progresu) niż nowy `BadgeTile` — docelowo warto ujednolicić, poza zakresem 012 (inna trasa, inny cel ekranu: ranking historyczny, nie kolekcja osobista).

---

## 15. Zgodność z systemem projektowym — checklista

- [x] Kontener: `app-card` (nie `ui/card`, nie `glass-panel` poza istniejącym wyjątkiem hero-gradientu, który już występuje w `009`/`010`).
- [x] Nagłówek sekcji: `SectionLabel`/wzorzec `sec-h` z `009`.
- [x] Przyciski: warianty istniejącego `Button` (`cta`, `outline`, `ghost`).
- [x] Liczby: `.font-metric`, `tabular-nums`.
- [x] Tokeny kolorów: wyłącznie `--gym-gold*`, `--gym-success`, `--gym-surface*`, `--gym-text-secondary`, `--destructive` — zero nowych hexów.
- [x] Dotyk: min. 44 px na każdym interaktywnym elemencie.
- [x] Mikrokopia PL wyłącznie (brak nowych anglicyzmów poza ugruntowanym "Team" jako nazwą funkcji, sekcja 3).

---

**Werdykt: ZATWIERDZONE Z UWAGAMI.** Dokument został zaktualizowany po wynikach równoległych bramek `prawnik` (etap 2, ODRZUCONE w zakresie widoczności wyników — wymusiło zmianę modelu z opt-out na opt-in w sekcjach 5.1, 5.2, 5.8, 7, 8.7) i `architekt` (etap 3, ZATWIERDZONE Z UWAGAMI, ADR 0011). Uwagi to 4 nadal otwarte pytania (sekcja 12.1) bez wpływu blokującego na layout, hierarchię i mikrokopię — każde ma zaprojektowaną alternatywę, która nie wymaga przerysowania reszty hubu. Najważniejsza zmiana względem pierwszej wersji tego dokumentu: domyślny stan hubu dla każdego członka (nowego i istniejącego, po migracji B-3) to teraz "zgoda nie udzielona" z CTA "Dołącz do rankingu grupy", a nie pełny ranking z opcją ukrycia.
