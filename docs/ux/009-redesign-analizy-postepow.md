# 009 - Redesign modułu Analiza postępów: specyfikacja UX (etap 4)

- **Autor**: ux (etap 4 zadania 009)
- **Data**: 2026-10-26
- **Karta**: `docs/zadania/009-redesign-analizy-postepow.md`
- **Wejście**: `docs/analiza/009-redesign-analizy-postepow.md` (US-1..US-17, BR-1..BR-12, duplikaty D1-D9, wątpliwości W1-W11, pytania Q1-Q5), `docs/ux/00-system-projektowy-stan.md` (tokeny, komponenty), wzorzec `docs/ux/008-redesign-planu-treningowego.md`.
- **Makieta statyczna**: `docs/ux/009-redesign-analizy-postepow-makieta.html` (cztery ramki 390 px: Przegląd z danymi, Przegląd pierwsze użycie, Siła, Szczegół ćwiczenia). Makieta jest referencją dla `frontend`. Gdy różni się od tego dokumentu, wygrywa dokument, a różnicę zgłaszamy.
- **Zakres**: ekrany `/progress` (Przegląd, Siła, Sylwetka, Tygodnie) i `/progress/exercises/[key]`. Zero zmian w kodzie produkcyjnym na tym etapie.
- **Status treści**: mikrokopia jest propozycją do przeglądu. Etykiety pasm zmęczenia są przeformułowane wg BR-7; definicje wskaźników (e1RM, tonaż, RIR, RPE, twarde serie) wymagają weryfikacji z kodem (`lib/intensity-analysis.ts`, `lib/analytics/`) przed wdrożeniem.
- **Werdykt**: patrz sekcja 17 i karta zadania.

---

## 0. Kluczowe decyzje UX

1. **Jedno pytanie na wejściu.** Przegląd otwiera się kartą „Ten tydzień” z jedną liczbą (`3 z 5 treningów`), jednym zdaniem werdyktu i paskiem. To odpowiedź na „czy jestem na dobrej drodze?” bez czytania reszty ekranu (US-1).
2. **Jedna metryka = jedno miejsce prawdy.** Przegląd nie powtarza szczegółów z innych zakładek. Pokazuje wynik zbiorczy i link (D1, D2, D8, D9). Regularność żyje tylko w Tygodniach. e1RM i tonaż tylko w Sile. Waga od startu w Sylwetce (Przegląd ma jeden wiersz-link do niej).
3. **Cztery sekcje na zakładkę, nie więcej.** Każda zakładka ma najwyżej cztery sekcje. Mniej ważne treści są w kartach zwijanych (`CollapsibleCard`), a nie w kolejnych kartach.
4. **Ćwiczenia w jednej liście.** Siła ma jedną listę ćwiczeń z przełącznikiem metryki (e1RM / Tonaż / Rekord) i filtrem (Wszystkie / Rośnie / Spada / Stoją). Znikają osobne listy „Rośnie/Spada”, „Rekordy”, „Ćwiczenia wg planu” jako trzy niezależne karty (D6, AC-3.3).
5. **Język bez presji.** „Regres/progres” zastępujemy opisem („Więcej niż poprzednio”, „Mniej niż poprzednio”, „Podobnie”). „Przeciążenie” zastępujemy „Wysokie obciążenie” z sugestią lżejszego dnia (BR-7). Brak czerwieni jako sygnału porażki.
6. **Za mało danych zamiast zer.** Każda liczba-trend ma próg (sekcja 11.1). Poniżej progu: komunikat z tym, ile brakuje, bez `0%` i bez pustego wykresu (BR-3).
7. **Zdjęcia tylko na żądanie w Sylwetce** (BR-8, US-10). Przegląd nie pokazuje zdjęć ani miniatur.
8. **Szczegół ćwiczenia: wykres pierwszy, KPI pod nim.** Trzy KPI zamiast ośmiu. Pozostałe wartości w kartach zwijanych (AC-12.1).

---

## 1. Diagnoza obecnego ekranu (ocena UX)

Dowody z kodu (`components/progress/*`) i opisu zrzutów. Priorytet: W = wysoki, Ś = średni, N = niski.

| # | Problem | Dowód | Priorytet |
|---|---|---|---|
| P-1 | Brak punktu wejścia. Pierwszy ekran to „Gotowość”, a odpowiedź na „czy idę do przodu?” jest rozproszona po kafelkach | `overview-tab.tsx` kolejność: Readiness, Kalendarz, Trendy, Cele, Zdobyte | W |
| P-2 | Przegląd powtarza Siłę i Tygodnie: Trendy (e1RM, tonaż, regularność) to te same wartości co w zakładkach szczegółowych | `overview-tab.tsx:72-110` vs `strength-trend-card.tsx`, `week-tab.tsx:236` (D1, D2) | W |
| P-3 | Trzy różne listy tych samych ćwiczeń w Sile (Rośnie/Spada, Ćwiczenia wg planu, Rekordy) | `strength-trend-card.tsx:151-152`, `strength-tab.tsx:355`, `strength-tab.tsx:251` (D6) | W |
| P-4 | Zbyt wiele kart na Siłę: Trend, Prognoza, Intensywność, Plan, Rekordy, Balans, Stagnacja (7 bloków) | `strength-tab.tsx`, `muscle-balance-panel.tsx` | W |
| P-5 | Zakładka Tygodnie to jeden długi scroll: porównanie, wykres, dieta, cardio, realizacja (5 bloków bez grupowania) | `week-tab.tsx` (`WeekOverWeekCard`, `WeekBarChart`, `DietTrainingSection`, `CardioSection`, `AdherenceSection`) | W |
| P-6 | Szczegół ćwiczenia: osiem KPI w pierwszym widoku, zanim pojawi się wykres i porównanie | `exercise-detail-view.tsx:206-272` | Ś |
| P-7 | Dwie etykiety „Zdobyte” i „Rekordy” dla różnych pojęć (odznaki kontra najlepsze wyniki) | `overview-tab.tsx:132`, `strength-tab.tsx:264` | Ś |
| P-8 | Żargon bez wyjaśnienia na pierwszym ekranie: e1RM, tonaż, RIR, RPE, „twarde serie”, „pasmo” | Kafelki i `Explainer` schowane w `<details>` | Ś |
| P-9 | Kolor jako nośnik znaczenia: tony `emerald`/`rose` i `text-white/35` (kontrast poniżej 4,5:1) | `progress-ui.tsx:toneText`, `Eyebrow` `text-white/40`, `StatTile` `text-white/40` | Ś |
| P-10 | Dublowanie komponentów: `VerdictBadge` w dwóch plikach, `StatusPill` w `week-tab.tsx`, `OutcomeIcon` w dwóch plikach, `MoverList` i `ExerciseRow` w `strength-tab`/`strength-trend-card` | patrz sekcja 9.2 | Ś |
| P-11 | Nazwy ćwiczeń ucięte (`truncate`) w wierszach list, kluczowa informacja (ciężar, data) przy obcięciu znika | `CollapsibleCard` `truncate`, `ExerciseRow` | Ś |
| P-12 | Ikony osiągnięć 16 px w kole 36 px, tekst opisu w `text-white/40` 11 px | `overview-tab.tsx:142-151` | N |
| P-13 | Podpowiedź coacha „Regeneracja X% …” powtarza wynik karty Gotowość | `coach-insights.ts` (W8, D7) | Ś |
| P-14 | Stagnacja i balans partii w jednej karcie, z listą bez kryterium | `muscle-balance-panel.tsx` (D4) | Ś |

**Potwierdzenie założeń analizy:** A1 (zrzuty odpowiadają kodowi) potwierdzone: cztery zakładki o identyfikatorach `przeglad | sila | sylwetka | tydzien` (`lib/progress-tabs.ts`) i szczegół `/progress/exercises/[key]`. Stare linki `?tab=zdjecia` (→ Sylwetka) zachowane.

---

## 2. Architektura informacji i nawigacja

### 2.1 Mapa ekranów (bez zmian tras)

| Ekran | Trasa | Sekcje (kolejność) |
|---|---|---|
| Przegląd | `/progress?tab=przeglad` (domyślna) | 1 Ten tydzień · 2 Gotowość · 3 Postęp 30 dni · 4 Cele i osiągnięcia |
| Siła | `/progress?tab=sila` | 1 Podsumowanie okresu · 2 Ćwiczenia · 3 Balans partii · 4 Intensywność (zwinięta) |
| Sylwetka | `/progress?tab=sylwetka` | 1 Waga teraz · 2 Wykres i tempo · 3 Obwody · 4 Zdjęcia (zwinięte, na żądanie) |
| Tygodnie | `/progress?tab=tydzien` | 1 Porównanie tygodni · 2 Ostatnie 8 tygodni · 3 Realizacja i regularność · 4 Dieta i cardio (zwinięte) |
| Szczegół ćwiczenia | `/progress/exercises/[key]` | 1 Wykres i okres · 2 Porównanie okresów · 3 Rekordy · 4 Historia · Zaawansowane (zwinięte: intensywność, prognoza) |

Zasada: **max 4 sekcje na zakładkę** (zgodnie z ryzykiem w analizie 13). Treści zwinięte liczą się jako część sekcji, nie jako nowe.

### 2.2 Nawigacja między zakładkami
- Pasek zakładek pod nagłówkiem: `SegmentedControl` (istniejący, `role="tablist"`), cztery pozycje, wysokość 44 px, tekst 13 px. Na 360 px cztery etykiety mieszczą się w jednym rzędzie (`truncate` wyłączony, testowane przez `frontend`; przy braku miejsca etykieta „Tygodnie” zostaje pełna, zmniejszamy padding).
- Stan zakładki i okresu w URL: `?tab=…&okres=7|30|90` (AC-3.1, AC-12.3). Odświeżenie i „Wróć” nie gubią wyboru.
- Szczegół ćwiczenia: przycisk „← Siła” wraca do `?tab=sila&okres=<bieżący>` (AC-12.3).

### 2.3 Belka dolna i FAB
- Bez zmian: belka `AppShell` widoczna, zakładka „Analiza” aktywna. FAB „Raport” pozostaje na `/progress` (zgodnie z obecnym zachowaniem).

---

## 3. Tokeny i typografia

Wyłącznie istniejące tokeny i klasy (`app/globals.css`, `components/progress/progress-ui.tsx`, `components/layout/screen.tsx`). Nowe tokeny nie są potrzebne.

| Rola | Token / klasa | Uwagi |
|---|---|---|
| Tło ekranu | `--gym-black` | |
| Karta standardowa | `app-panel` (`Surface variant="panel"`) | |
| Karta wyróżniona („Ten tydzień”) | `Surface variant="hero"` | jedna na zakładkę, gradient złoty 14% |
| Lista w karcie | `Surface variant="list"` | separatory `white/6` |
| Akcent | `--gym-gold` | wartość dodatnia nie ma osobnego koloru; wskaźnik kierunku to strzałka + tekst |
| Tekst drugorzędny | `--gym-text-secondary` (`#9a9182`, ok. 6,5:1) | zamiast `text-white/40` (P-9) |
| Wartość dodatnia | `--gym-success` (`#3ecf72`) + strzałka ↑ + tekst „+2,1%” | |
| Wartość ujemna / spadek | `--gym-text-secondary` + strzałka ↓ + tekst „−1,8%” | nie czerwony: spadek ciężaru to nie błąd; czerwień tylko przy błędzie danych |
| Stabilnie / podobnie | `--gym-text-secondary` + kreska ⎯ + tekst „podobnie” | |
| Za mało danych | `EmptyNote` lub tekst w `--gym-text-secondary` z ikoną `Info` | nigdy 0% |
| Glif partii | `--gym-glyph-base`, `--gym-gold` (partia główna) | tylko w Sile (lista, balans) |
| Ostrzeżenie | `InlineBanner variant="warning"` | używane rzadko: tylko przy niedoborze partii (neutralny tekst) |

**Typografia (pięć poziomów, min. 11 px):**

| Poziom | Klasa | Użycie |
|---|---|---|
| H1 | `appPageTitleClass` (28 px, `font-heading`) | „Analiza postępów”; na szczegółach nazwa ćwiczenia (24 px, 2 linie) |
| H2 | `SectionLabel` / `ProgressSection` (`titleAs="h2"`) | „Ten tydzień”, „Gotowość”, „Ćwiczenia” |
| Liczba hero | `font-metric` 44 px, `tabular-nums` | „3 z 5” |
| H3 / wartość | 15 px `font-semibold`; wartości kafelków `font-metric` 20 px | nazwa ćwiczenia w wierszu, KPI |
| Treść | 14 px, lh 20 | opisy, werdykt |
| Meta | 12 px `--gym-text-secondary` | „4 sesje · 22.10” |
| Etykieta uppercase | 11 px, `tracking-[0.14em]` (`Eyebrow`) | „TEN TYDZIEŃ”, „GOTOWOŚĆ” |

Liczby, serie, ciężary, procenty i daty: `tabular-nums`. Format dat `dd.mm`. Format liczb z przecinkiem dziesiętnym (`fmtNum`, `fmtPct`, `fmtSigned` z `lib/progress-format.ts`).

**Odstępy:** skala 4/8 px. Między sekcjami `space-y-5` (20 px). Między kartami w sekcji `gap-2.5` (10 px). Wewnątrz karty `px-3.5 py-3` (14/12 px) lub `p-4` dla hero. Wiersz listy min. 56 px wysokości.

**Promienie:** karta 22 px (`app-panel`), hero 16 px (`rounded-2xl`), kafel 12 px, chip i pill `rounded-full`.

**Ruch:** rozwinięcie karty zwijanej 200 ms (wysokość). Przełączanie okresu lub metryki: animacja wykresu max 300 ms. Przy `prefers-reduced-motion` bez animacji; `Meter` bez przejścia szerokości. Szkielety statyczne (bez pulsowania, patrz sekcja 10).

---

## 4. Przegląd (`tab=przeglad`)

**Cel:** w 5 sekund wiadomo, czy tydzień idzie dobrze i czy można dziś trenować mocno. Bez szczegółów z innych zakładek.

**Układ (390 px, od góry):**
1. Belka górna (`BrandMark`, dzwonek, `AppMenuButton`), bez zmian.
2. `AppPageHeader`: kicker „ANALIZA”, H1 „Analiza postępów”, meta „Aktualizacja 10:42” (czas ostatniego odczytu; bez liczby z 180 dni, zob. W1 w sekcji 15).
3. `SegmentedControl` z czterema zakładkami (44 px).
4. **Sekcja 1 „Ten tydzień”** (`Surface variant="hero"`):
   - Eyebrow „TEN TYDZIEŃ · 26.10–01.11”.
   - Liczba `font-metric` 44 px: „3” + tekst „z 5 treningów” (tekst obok liczby, 15 px). Nie samo „3/5”, bo bez kontekstu jest niejasne.
   - `Meter` 60% (wysokość 8 px), z ukrytym tekstem „Cel: 3 z 5”.
   - Werdykt, jedno zdanie, 15 px `font-medium`: „Na dobrej drodze. Jeszcze 2 treningi do celu.” (AC-1.1, AC-1.5).
   - Pasek dni tygodnia (`DayStrip`, sekcja 9.3): siedem komórek Pn–Nd, każda z etykietą dnia i ikoną (`Dumbbell` siła, `HeartPulse` cardio, obie = dwie ikony). Dzień dzisiejszy: obrys złoty. Puste dni: kreska „–” z tekstem dla czytnika „brak treningu”. Komórka min. 40 px wysokości, cel dotyku nie jest wymagany (nieklikalna), ale każda komórka ma `aria-label`.
   - Stopka hero: „Zostało 5 dni” (dni po dzisiaj; w niedzielę „Tydzień zamknięty”, AC-1.4). Link „Szczegóły tygodnia →” do `tab=tydzien` (44 px).
5. **Sekcja 2 „Gotowość”** (`ProgressSection`, jedna karta `app-panel`):
   - Dwa wiersze, każdy: nazwa („Zmęczenie”, „Regeneracja”), **pasmo słowne** jako tekst główny 15 px semibold („Umiarkowane”, „Dobra”), wynik liczbowy małym tekstem tabular („58 / 100”), `Meter` pod spodem.
   - Jeden wniosek (BR-6, max 1 tu): 13 px, 2 zdania max. Przykład: „Ostatnie 3 dni były intensywne. Dziś lżejszy trening będzie dobrym wyborem.”
   - Stopka 12 px `--gym-text-secondary`: „Oparte na treningach z 7 dni.” Jeśli brak check-inu: + „Dodaj check-in, aby uwzględnić samopoczucie.” (link, AC-2.2).
   - `Explainer` „Jak to liczymy”: zmęczenie = obciążenie z 7 dni vs 30 dni; regeneracja = odpoczynek od ostatniego treningu i obciążenia (wzór z `fatigue-score.ts`, weryfikacja W9).
   - Stan: patrz sekcja 10 (mało danych: mniej niż 7 dni historii, AC-2.3).
6. **Sekcja 3 „Postęp · 30 dni”** (`ProgressSection`, `Surface variant="list"`, dwa wiersze-linki, każdy min. 56 px):
   - Wiersz 1: „Siła (e1RM)”, meta „średnio po ćwiczeniach”, wartość `PctValue` „+2,1%”, chevron. Klik → `tab=sila&okres=30`.
   - Wiersz 2: „Waga od startu”, meta „teraz 82,4 kg · tempo 6 tyg. −0,4 kg/tydz.”, wartość „−1,8 kg”, chevron. Klik → `tab=sylwetka`. Wartość „od startu” z tej samej definicji co w Sylwetce (AC-9.1, BR-4).
   - Tonaż i regularność nie są tutaj (D1, D2). Są w Sile i Tygodniach.
   - Stan „za mało danych” w wierszu: „Potrzeba 3 sesji tego ćwiczenia” (BR-3), zamiast `%`.
7. **Sekcja 4 „Cele i osiągnięcia”** (`ProgressSection`):
   - Cele (maks. 3): każdy wiersz 13 px etykieta („50 t podniesione”), po prawej pozostało („12,4 t do celu”), pod spodem `Meter` 6 px. UI nie opisuje, skąd biorą się wartości celów (stałe w v1, Q-U2).
   - `CollapsibleCard` „Osiągnięcia · 7”, zwinięta domyślnie. `summary`: „Ostatnie: Pierwsze 10 treningów · 14.10”. Po rozwinięciu: lista 5 pozycji (ikona w kole 40 px, tytuł 15 px semibold, opis 13 px `--gym-text-secondary`, data 12 px) i „Pokaż wszystkie (7)”.
   - Pusty stan osiągnięć: „Pierwsze odznaki pojawią się po kilku treningach.” (bez zer).

**Czego Przegląd nie ma (świadomie):** kalendarz tygodnia z osobną kartą (zastąpiony przez `DayStrip` w hero), regularność 30/90 dni (Tygodnie), prognoza (Siła i szczegół), zdjęcia (Sylwetka), intensywność (Siła i szczegół), podpowiedzi coacha poza jednym wnioskiem w Gotowości (BR-6).

**Responsywność:** 390 px jedna kolumna. Od `md` (768 px) kontener `max-w-xl`, a sekcje „Gotowość” i „Postęp” obok siebie w dwóch kolumnach (`grid md:grid-cols-2 gap-2.5`). Hero zawsze pełna szerokość.

---

## 5. Siła (`tab=sila`)

**Cel:** zobaczyć, które ćwiczenia rosną, a które stoją, dla wybranego okresu. Każde ćwiczenie pojawia się raz (AC-3.3).

**Układ:**
1. Nagłówek jak w Przeglądzie (H1 „Analiza postępów”, zakładka „Siła” aktywna).
2. **Okres:** `SegmentedControl` „7 dni | 30 dni | 90 dni” nad sekcją 1, z etykietą widoczną „Okres”. Zmiana okresu zmienia wszystkie wskaźniki siły w zakładce (AC-3.1).
3. **Sekcja 1 „Podsumowanie”** (`Surface variant="hero"`):
   - Dwa `StatTile` obok siebie: „e1RM · średnio” z `PctValue` („+2,1%”), „Tonaż” z `PctValue` („+4,0%”), hint 11 px: „po 11 ćwiczeniach”.
   - Werdykt jednym zdaniem: „Więcej ćwiczeń rośnie niż spada: 6 z 11.” Wyjątki: „Za mało danych: potrzeba 3 sesji w okresie.” lub „Brak treningów siłowych w tym okresie.”
   - `Explainer` „Co to jest e1RM i tonaż?” (AC-13.1): e1RM to szacowany ciężar na jedno powtórzenie; tonaż to suma powtórzeń × ciężar we wszystkich seriach (wzór zgodny z kodem, W4).
4. **Sekcja 2 „Ćwiczenia”** (jedna lista):
   - Przełącznik metryki `SegmentedControl` „e1RM | Tonaż | Rekord” (44 px). Metryka zmienia wartość w każdym wierszu i sortowanie.
   - Chipy filtra (`aria-pressed`, min. 44 px, jak `chp` z 008): „Wszystkie 11”, „Rośnie 6”, „Spada 3”, „Stoją 2”. „Stoją” = stagnacja (sekcja 5.1).
   - Grupy wg dnia planu, nagłówek grupy `grp` (12 px semibold, liczba ćwiczeń `tabular`): „Dzień A · Push”, „Dzień B · Pull”, „Nogi”, „Ćwiczenia spoza planu” (AC-4.4). Bez planu: jedna grupa „Ćwiczenia” i link „Ułóż plan” (AC-4.3, do zadania 008).
   - **Wiersz ćwiczenia** (min. 56 px, cały wiersz to link do szczegółu):
     - Linia 1: nazwa ćwiczenia 15 px semibold, **do 2 linii** (bez obcinania w połowie słowa); przy 3 liniach obcięcie wielokropkiem.
     - Linia 2 (meta 12 px): „4 sesje · ostatnio 22.10”.
     - Prawa strona: `MiniSparkline` (istniejący z `components/home/mini-sparkline.tsx`, 56×20 px) i wartość metryki: w trybie e1RM/Tonaż `PctValue` („+3,2%”); w trybie Rekord „12 powt.” lub „90 kg × 5”, z `nowy` chipem (tekst „Nowy”, 21 dni, AC-5.1).
     - Ćwiczenie z 1–2 sesjami: „za mało danych” (AC-3.2) zamiast procentu.
     - Ćwiczenie bez obciążenia (masa ciała): metryka „powtórzenia”, nie kg (AC-3.4).
   - Stan pusty listy w filtrze: „Brak ćwiczeń w tej grupie w wybranym okresie.” (EmptyNote).
5. **Sekcja 3 „Balans partii · 30 dni”**:
   - Wiersze partii, sortowane malejąco po liczbie serii: nazwa partii (14 px), `Meter` z udziałem %, po prawej „14 serii · 35%” (tabular). Partia bez serii: „0 serii” (AC-6.4, nie pomijana).
   - Alert niedoboru (neutralny, `InlineBanner variant="info"`, nie „warning”): „Plecy: 12 serii, klatka: 20. Warto dodać serie na plecy.” (AC-6.2).
   - Próg: mniej niż 4 treningi w 30 dniach → `EmptyNote` „Za mało danych do oceny balansu. Potrzeba 4 treningów w 30 dniach.” (AC-6.3). Okres jest zawsze podany w tytule sekcji (BR-2).
6. **Sekcja 4 „Intensywność · ostatnie 6 treningów”** (`CollapsibleCard`, zwinięta):
   - Summary: „RIR śr. 2,1 · RPE śr. 7,8”.
   - Po rozwinięciu: trzy `StatTile` (Śr. RIR, Śr. RPE, Twarde serie) i mini wykres 6 treningów. Etykieta okresu „ostatnie 6 treningów” w tytule, bo to inna próbka niż „tydzień” w Tygodniach (W11, BR-2).
   - `Explainer`: RIR to powtórzenia w zapasie; RPE to subiektywny wysiłek 1–10; twarde serie wg definicji z `lib/intensity-analysis.ts` (do potwierdzenia, W11).

### 5.1 Stagnacja jako filtr „Stoją”
- Ćwiczenie „stoi”, gdy e1RM nie wzrósł przez 28 dni i ma co najmniej 3 sesje w tym czasie (propozycja progu, do potwierdzenia przez `architekt`, zob. sekcja 14, Q-U3).
- Wiersz w filtrze „Stoją” ma dopisek: „Brak rekordu e1RM od 28 dni.” (AC-7.1). Kryterium w jednym zdaniu w `Explainer` chipa (AC-7.2).
- Ćwiczenie z 1 sesją nie jest stagnacją (AC-7.3).
- Osobnej karty „Stagnacja” nie ma (D4).

**Responsywność:** lista w jednej kolumnie 390 px. Od `md` grupy dni w dwóch kolumnach (`grid md:grid-cols-2`).

---

## 6. Sylwetka (`tab=sylwetka`)

**Cel:** waga, tempo i obwody w jednej spójnej wartości „od startu”. Zdjęcia dopiero na żądanie.

**Układ:**
1. **Sekcja 1 „Waga teraz”** (`Surface variant="hero"`):
   - Liczba `font-metric` 44 px „82,4 kg”, obok „od startu −1,8 kg” (`PctValue`-style, tekst z kierunkiem), pod spodem meta „od 12.08 (raport)”.
   - Cel wagowy (jeśli ustawiony w profilu): „Cel 80 kg · do 15.12” + `Meter` (postęp do celu). Brak celu: link „Ustaw cel wagowy” (44 px) do profilu.
   - Definicja „startu” jest jedna (W3, BR-4): pierwszy raport lub wpis wagi; zdjęcie startowe z galerii ma pierwszeństwo tylko, gdy użytkownik je wybrał (`hasCustomStart`).
2. **Sekcja 2 „Wykres i tempo”**:
   - `SegmentedControl` zakresu: „30 dni | 90 dni | Wszystko”. Wykres `WeightAverageChart` (wysokość 180 px) z linią średniej kroczącej; legenda tekstowa („— waga · ‑‑ średnia 7 dni”).
   - Pod wykresem tekst podsumowania dla czytnika i dla osób bez wykresu: „Od 12.08 waga spadła o 1,8 kg. Średnia 7 dni: 82,6 kg.”
   - Dwa `StatTile` tempa: „Zmiana w 6 tyg.” „−0,4 kg/tydz.” i „Ostatni raport” „12.10”. Etykieta „Zmiana w 6 tyg.” zamiast „kg/tydz. 6 tygodni”, bo wartość to różnica końców okna, nie trend (W2). Gdy krócej niż 2 tygodnie danych: „Za mało danych. Potrzeba 2 tygodni wpisów.” (AC-9.2).
   - Brak wag: zachęta „Dodaj pierwszy pomiar wagi” (cta outline) bez pustego wykresu (AC-9.4).
3. **Sekcja 3 „Obwody”** (`Surface variant="list"`, cztery wiersze 56 px): nazwa (Pas, Udo, Klatka, Ramię), wartość „84,0 cm”, zmiana „−2,0 cm” z tekstem kierunku „lepiej” lub „podobnie” (AC-9.5: pas i udo mniej = lepiej; klatka i ramię więcej = lepiej). `MiniSparkline` 56×20 px. Brak pomiaru: „Brak pomiaru. Dodaj w raporcie ciała.”
4. **Sekcja 4 „Zdjęcia Start i Teraz”** (`CollapsibleCard`, zwinięta, `icon` = `Lock`):
   - Summary: „Ukryte. Pokaż po kliknięciu.”.
   - Po rozwinięciu: przycisk „Pokaż zdjęcia” (outline 48 px, ponowne ukrycie „Ukryj”). Dopiero po kliknięciu pobierane są miniatury (autoryzowany URL, bez data URL, AC-10.2).
   - Suwak porównania (`transformation-slider`, istniejący) z etykietami „Start” i „Teraz” i datami.
   - Pod suwakiem dwa kafelki: „Waga” „−1,8 kg od startu” i „Pas” „−2,0 cm”. Wartości z tych samych definicji co w sekcji 1 i 3.
   - Brak zdjęcia startowego: CTA „Dodaj zdjęcie startowe” (outline) zamiast pustego kafelka (AC-10.3).
   - `Explainer` „Skąd te zdjęcia”: zdjęcia są widoczne tylko tobie; nie są udostępniane w społeczności ani w analizie.
   - Przycisk „Zmień zdjęcie startowe” (`ChangeStartPhotoButton`, istniejący) ma `min-h-[44px]`.

**Prywatność:** zdjęcia nie są na Przeglądzie, w miniaturach ani w karcie zwiniętej (BR-8, AC-10.1). Analityka zdarzeń: tylko nazwa zakładki (BR-9).

---

## 7. Tygodnie (`tab=tydzien`)

**Cel:** porównać dwa tygodnie i zobaczyć relację treningu do diety i cardio, bez przeładowanej strony.

**Układ:**
1. **Sekcja 1 „Porównanie tygodni”** (`Surface variant="panel"`):
   - Dwa wybory tygodnia (A: bieżący, B: poprzedni) jako przyciski z datą („Tydzień A · 26.10–01.11”, „Tydzień B · 19.10–25.10”) otwierające `Sheet` z listą 12 tygodni (AC-11.1). Nie dwa inline `select`.
   - Werdykt (`StatusPill`, tekst + ikona): „Więcej niż poprzednio” (strzałka ↑), „Mniej niż poprzednio” (↓), „Podobnie” (⎯). Bez słów „progres/regres”.
   - Tabela 4 wierszy z kolumnami A | B | Zmiana: Treningi, Tonaż, Cardio (min), Śr. RPE. Liczby `tabular-nums`, kolumny równe. Dla tygodnia w toku: etykieta „do dziś” przy nagłówku kolumny (AC-11.1: jasno oznaczone).
   - `Explainer`: „Porównujemy pełne tygodnie. Bieżący tydzień liczony do dziś.”
2. **Sekcja 2 „Ostatnie 8 tygodni”**:
   - `SegmentedControl` metryki: „Treningi | Tonaż | Cardio”. Wykres słupkowy `WeekBarChart` (istniejący, 180 px).
   - Tekst podsumowania: „Średnio 3,4 treningu tygodniowo w ostatnich 8 tygodniach.” Bez linii celu w kolorze alarmowym. Linia celu (5 treningów z ustawień, BR-12) jako przerywana linia neutralna.
3. **Sekcja 3 „Realizacja i regularność”**:
   - Tabela z trzema okresami w kolumnach („7 dni | 30 dni | 90 dni”) i wierszami „Treningi”, „Dieta” (dni z wpisem), „Cardio”, „Łącznie”. Każda liczba z podanym okresem w nagłówku kolumny (BR-2).
   - To jedyne miejsce regularności 30/90 dni (D1). `architekt` potwierdza wspólną definicję „planned” (W10).
   - Brak danych diety w okresie: „Brak wpisów z dziennika” zamiast 0% (AC-11.2).
4. **Sekcja 4 „Dieta i cardio”** (`CollapsibleCard`, zwinięta, lazy-load danych po rozwinięciu):
   - Podsekcja „Dieta a trening” (8 tygodni): lista tygodni (wiersz 56 px: tydzień, kcal % celu, białko % celu, tonaż, `StatusPill` statusu). Brak danych żywienia w tygodniu: „Brak wpisów z dziennika w tym tygodniu.” (AC-11.2).
   - Produkt bez wartości odżywczych nie jest liczony jako 0 kcal (AC-11.3, W6 do potwierdzenia): w UI wpis jest „bez wartości” i nie wpływa na procent.
   - Podsekcja „Cardio”: obciążenie, kcal (tydzień), minuty w strefach tętna 1–5 jako pasek segmentowy z legendą tekstową (strefa + minuty). Brak danych tętna: „Brak danych tętna” zamiast 0 min w strefie (AC-11.4).
   - Pytanie do właściciela (Q-U5 w sekcji 14): czy dieta i cardio mają być osobnymi zakładkami. Propozycja UX: nie, zostają zwinięte.

**Język:** słowo „kalorie” bez oceny w kolorze. Nie używamy „spalone” ani „za dużo/za mało” przy kcal: „Zjedzone: 2 180 kcal, 96% celu.”

---

## 8. Szczegół ćwiczenia (`/progress/exercises/[key]`)

**Cel:** w jednym miejscu wykres, porównanie okresów i historia danego ćwiczenia (US-12).

**Układ:**
1. **Nagłówek:** przycisk „← Siła” (44 px, `aria-label` „Wróć do Siły”, `href=/progress?tab=sila&okres=…`). H1 nazwa ćwiczenia (24 px, do 2 linii, bez obcinania). Meta 12 px: „Klatka piersiowa · sztanga” (tylko znane dane; brak danej = brak fragmentu).
2. **Sekcja 1 „Wykres”** (karta `app-panel`):
   - Dwa przełączniki: metryka `SegmentedControl` „e1RM | Objętość” i okres „30 dni | 90 dni | Wszystko”, oba 44 px.
   - Wykres liniowy `LineChart` (180 px), punkty = sesje, oś Y z jednostką kg.
   - Tekst podsumowania pod wykresem: „Ostatnie 30 dni: e1RM +2,1%, 4 sesje.” Gdy 1–2 sesje w okresie: „Za mało danych do trendu. Potrzeba 3 sesji.” (BR-3, A3).
   - **KPI pod wykresem:** trzy `StatTile` w rzędzie: „Sesje” (12), „Najlepsze e1RM” (102 kg), „Najcięższa seria” (90 kg × 5). Osiem KPI z obecnego widoku (rekord sesji, najlepsza seria, RIR, RPE, twarde) przeniesione do sekcji „Zaawansowane” i rekordów.
3. **Sekcja 2 „Porównanie okresów”** (`ExercisePeriodComparePanel`, przeprojektowany):
   - `SegmentedControl` „Tydzień | Miesiąc | Rok”.
   - Lista metryk (e1RM śr., Tonaż, Najcięższa seria, Sesje): nazwa, `PctValue`, pasek `Meter` z kierunkiem. Okres bez danych: „Brak danych w tym okresie” (AC-12.2), nigdy 0%.
   - Werdykt jednym zdaniem nad listą: „W miesiącu e1RM wzrosło o 1,2%.”
4. **Sekcja 3 „Rekordy”** (`Surface variant="list"`, 3–5 wierszy): „Najwięcej powtórzeń w sesji”, „Najlepsza seria”, „Najwyższe e1RM”, „Największa objętość”, data pod każdym. Jeden „Nowy” chip dla rekordu z 21 dni (AC-5.1). Brak serii z obciążeniem: „Rekordy pojawią się po pierwszych seriach z obciążeniem.” (AC-5.3).
5. **Sekcja 4 „Historia”** (`Surface variant="list"`): ostatnie 5 sesji (data, najlepsza seria, tonaż sesji), „Pokaż wszystkie (N)”. Wiersz linkuje do szczegółu treningu z historii.
6. **Zaawansowane** (`CollapsibleCard`, zwinięta, jedna karta dla dwóch bloków):
   - „Intensywność”: Śr. RIR, Śr. RPE, Twarde serie (`StatTile`), definicje w `Explainer` (zgodne z zakładką Siła, D3).
   - „Prognoza e1RM · orientacyjnie”: wartość za 30 i 90 dni z etykietą pewności („Pewność: niska”) i zdaniem „Orientacyjnie, na podstawie ostatnich sesji.” (AC-8.1). Poniżej 5 sesji: „Prognoza pojawi się po 5 sesjach. Masz 3.” (AC-8.2). Prognoza nie pojawia się na Przeglądzie (AC-8.3).
   - Status stagnacji, jeśli dotyczy, jako jedno zdanie pod KPI, nie osobna karta: „Brak rekordu e1RM od 28 dni.” (D4).

**Stan „wróć”:** `?tab=sila&okres=30` wraca do tego samego okresu (AC-12.3).

---

## 9. Komponenty

### 9.1 Katalog używany (istniejący, bez zmian API lub z drobną zmianą)

| Komponent | Plik | Użycie w 009 | Zmiana |
|---|---|---|---|
| `ProgressSection` | `components/progress/progress-ui.tsx` | tytuł sekcji z opcjonalnym `trailing` (okres) | brak |
| `Surface` (`panel`, `hero`, `list`) | j.w. | karty i listy | brak |
| `Eyebrow` | j.w. | etykiety uppercase | kolor: `text-white/40` → `--gym-text-secondary` |
| `StatTile` | j.w. | KPI, podsumowania | hint `text-white/40` → `--gym-text-secondary`; wartość w `font-metric` |
| `SegmentedControl` | j.w. | zakładki, okresy, metryki | pozycje min. 44 px |
| `CollapsibleCard` | j.w. | Osiągnięcia, Intensywność, Zdjęcia, Dieta i cardio, Zaawansowane | `summary` bez `truncate` przy 2 liniach |
| `Explainer` | j.w. | „Jak to liczymy” | kolor `text-white/40` → `--gym-text-secondary` |
| `EmptyNote` | j.w. | „za mało danych” | brak |
| `Meter` | j.w. | cele, gotowość, balans | brak |
| `PctValue`, `ToneIcon`, `toneText` | j.w. | wartości zmian | `toneText("flat")` i `"none"` na `--gym-text-secondary` |
| `MiniSparkline` | `components/home/mini-sparkline.tsx` | wiersze ćwiczeń, obwody | brak |
| `WeekBarChart`, `WeightAverageChart` | `components/progress/` | Tygodnie, Sylwetka | wysokość 180 px, legenda tekstowa |
| `LineChart` (Recharts) | szczegół ćwiczenia | wykres | kolor linii = wartość tokenu `--gym-gold` (`#ebc44a`); Recharts wymaga stałej wartości, nie zmiennej CSS |
| `transformation-slider`, `ChangeStartPhotoButton` | `components/home/`, `components/progress/` | zdjęcia | brak |
| `ConfirmDialog`, `Sheet`, `InlineBanner` | `components/ui/` | wybór tygodnia, komunikaty | brak |
| `SectionLabel` | `components/ui/section-label.tsx` | nagłówek sekcji | brak |

### 9.2 Konsolidacja (duplikaty do usunięcia przy implementacji)

| Duplikat | Gdzie | Propozycja |
|---|---|---|
| `VerdictBadge` | `week-over-week-card.tsx`, `exercise-period-compare-panel.tsx` | jeden `StatusPill` w `progress-ui.tsx` |
| `OutcomeIcon` | `week-over-week-card.tsx`, `exercise-period-compare-panel.tsx` | jedna funkcja z `ToneIcon` (`up`/`down`/`flat`) |
| `StatusPill` (dieta) | `week-tab.tsx` | ten sam `StatusPill` z tonem i tekstem |
| `ExerciseRow` | `strength-tab.tsx` | jeden `ExerciseRow` w Sile (lista z przełącznikiem metryki) |
| `MoverList` | `strength-trend-card.tsx` | usunięty (zastąpiony filtrem listy) |
| `ChipList` / `CountChips` | `exercise-period-compare-panel.tsx`, `strength-tab.tsx` | jeden `FilterChips` |
| Kafelek statystyki w 4 wersjach (`StatTile`, `AppStatTile`, `StatCard`, `AdminStat`) | ogólnie w aplikacji (008 sekcja 8) | w tym zadaniu tylko `StatTile` z `progress-ui.tsx` |
| Martwy kod `components/progress-analysis/*`, `lib/progress-analysis.ts` | W7 | usunąć po potwierdzeniu przez `architekt` (poza zakresem UX) |

### 9.3 Nowe komponenty (dodać, dokumentować w katalogu)

| Nowy | Dlaczego nie istniejący | Opis |
|---|---|---|
| `DayStrip` | `WeekProgressCalendarCard` ma kafle z kalendarzem i liczbami, a Przegląd potrzebuje wersji jednowierszowej w hero | siedem komórek Pn–Nd, ikona siły/cardio, etykieta dnia, `aria-label` na każdej komórce, dzień dzisiejszy z obrysem |
| `StatusPill` (w `progress-ui.tsx`) | zastępuje duplikaty z 9.2 | `tone: "up" \| "down" \| "flat"`, tekst + ikona, `rounded-full`, 24 px wysokości, min. kontrast tekstu 4,5:1 |
| `FilterChips` (w `progress-ui.tsx`) | zastępuje `ChipList` i `CountChips` | chipy 44 px, `aria-pressed`, liczba w tekście („Rośnie 6”) |
| `ExerciseRow` (w `progress-ui.tsx`) | zastępuje dwie wersje z 9.2 | link cały wiersz, min. 56 px, nazwa do 2 linii, meta, sparkline, wartość metryki |

Każdy nowy komponent: jedno miejsce (`components/progress/progress-ui.tsx`) i dopisek do katalogu w `docs/ux/00-system-projektowy-stan.md` w tym samym PR co implementacja.

### 9.4 Specyfikacja `DayStrip`
- Układ: `grid grid-cols-7 gap-1`, komórka `h-14` (56 px), w środku dzień (11 px, uppercase, `--gym-text-secondary`) i ikona 16 px.
- Stany komórki: `dzień z treningiem` (ikona `Dumbbell` złota), `dzień z cardio` (`HeartPulse`), `dwa typy` (obie ikony), `pusty` (kreska, tekst „brak treningu”), `dziś` (obrys złoty 60%, tekst dla czytnika „dziś”), `przyszły` (ikona i tekst w `--gym-text-secondary`, bez wypełnienia; nie używamy `white/30`).
- `aria-label` komórki: „Wtorek 27.10, trening siłowy” / „Środa 28.10, brak treningu”.

### 9.5 Specyfikacja `StatusPill`
- Wysokość 24 px, `px-2.5`, 12 px semibold, `rounded-full`.
- Tony: `up` = tekst `--gym-success`, obrys `--gym-success` 40%, strzałka ↑; `down` = tekst `--gym-text-secondary`, obrys `white/20`, strzałka ↓; `flat` = tekst `white/80`, obrys `white/20`, kreska ⎯. Kolor nie jest jedynym nośnikiem (tekst i ikona).

### 9.6 Specyfikacja `ExerciseRow`
- Wrapper: `Link` (cały wiersz), `min-h-14` (56 px), `px-3.5 py-3`, `flex items-center gap-3`.
- Lewa kolumna `min-w-0 flex-1`: nazwa (15 px semibold, `line-clamp-2`), meta (12 px).
- Prawa kolumna `shrink-0`: sparkline 56×20 px, pod nim wartość metryki (`font-metric`, `tabular-nums`) lub tekst „za mało danych” (12 px).
- `aria-label`: „Wyciskanie sztangi na ławce płaskiej, e1RM plus 3,2 procent, 4 sesje”.

---

## 10. Stany ekranów (macierz)

Wymagane stany: ładowanie, pusty (pierwsze użycie), błąd, offline, częściowe dane, brak uprawnień, sukces.

| Ekran / sekcja | Ładowanie | Pusty (pierwsze użycie / brak danych) | Błąd | Offline | Częściowe dane | Brak uprawnień | Sukces |
|---|---|---|---|---|---|---|---|
| Przegląd (cały) | szkielet: hero (blok 140 px), 2 karty 96 px, `animate-pulse` (statycznie przy reduced motion) | ramka B: „Twoja analiza ruszy po pierwszym treningu” + lista „Co się pojawi” + CTA „Zacznij trening” + „Dodaj wagę” (outline). Bez zer. | `InlineBanner error` „Nie udało się wczytać analizy.” + „Spróbuj ponownie” (outline 44 px) | `InlineBanner warning` „Brak połączenia. Pokazujemy dane z ostatniego wczytania.” jeśli `architekt` dopuści cache (AC-14.3); inaczej „Brak połączenia. Spróbuj ponownie.” bez pustego ekranu | sekcja z błędem tylko we własnej karcie (poniżej), reszta widoczna | sesja wygasła: globalnie (`AuthPageFrame`) | brak osobnego komunikatu; wartości odświeżają się po dodaniu treningu (AC-15.2) |
| Ten tydzień (hero) | szkielet liczby i paska | „Tydzień bez treningów” + „Zaplanuj pierwszy” (link do Treningów) | błąd tylko tej karty | jw. | brak danych o cardio: pasek pokazuje tylko siłę, bez zera | - | liczba zaktualizowana po zapisie treningu |
| Gotowość | szkielet 2 wierszy | mniej niż 7 dni historii: „Za mało danych. Wróć po tygodniu treningów.” (AC-2.3) | „Nie udało się policzyć gotowości.” + ponów | jw. | bez check-inu: wynik z treningów + „oparte na treningach” (AC-2.2) | - | - |
| Postęp 30 dni | szkielet 2 wierszy | wiersz: „Potrzeba 3 sesji tego ćwiczenia” / brak wagi: „Dodaj pierwszy pomiar wagi” | błąd wiersza | jw. | jeden z dwóch wierszy | - | - |
| Cele i osiągnięcia | szkielet 3 pasków | brak celów: sekcja ukryta; brak osiągnięć: „Pierwsze odznaki pojawią się po kilku treningach.” | błąd sekcji | jw. | część osiągnięć | - | nowe osiągnięcie: tekst „Nowe” na 5 dni |
| Siła (podsumowanie) | szkielet hero i listy | mniej niż 3 sesje: „Za mało danych: potrzeba 3 sesji w okresie.” | błąd sekcji | jw. | część ćwiczeń bez danych: „za mało danych” w wierszu | - | - |
| Siła (ćwiczenia) | 4 szkielety wierszy 56 px | filtr bez wyników: „Brak ćwiczeń w tej grupie w tym okresie.” | błąd listy + ponów | jw. | wiersze bez sparkline (brak punktów) | - | - |
| Balans partii | szkielet 5 pasków | mniej niż 4 treningi/30 dni: „Za mało danych do oceny balansu.” | błąd sekcji | jw. | partia 0 serii (AC-6.4) | - | - |
| Sylwetka (waga) | szkielet wykresu 180 px | brak wag: zachęta „Dodaj pierwszy pomiar wagi” (AC-9.4) | błąd wykresu + ponów | jw. | jedno źródło wag (raporty albo wpisy) niedostępne: wykres z dostępnych punktów, z informacją, z jakiego źródła | - | - |
| Sylwetka (zdjęcia) | szkielet kafla po rozwinięciu | brak zdjęcia startowego: CTA „Dodaj zdjęcie startowe” | błąd miniatur + ponów | jw. | jedno zdjęcie: suwak wyłączony, pokazany jeden | - | „Zapisano zdjęcie startowe” (`useSaveFeedback`) |
| Tygodnie (porównanie) | szkielet tabeli | brak wyboru tygodnia z danymi: „Brak treningów w tych tygodniach.” | błąd tabeli | jw. | tydzień bez cardio: „0 min” tylko gdy są wpisy; brak wpisów: „Brak danych” | - | - |
| Tygodnie (dieta) | szkielet listy 8 tygodni (lazy po rozwinięciu) | „Brak wpisów z dziennika w tych tygodniach.” | błąd podsekcji | jw. | tydzień bez danych żywienia | - | - |
| Szczegół ćwiczenia | szkielet wykresu i KPI | 0 sesji: „Nie wykonywałeś tego ćwiczenia w historii.” + link „Wróć do Siły” | „Nie udało się wczytać ćwiczenia.” + ponów | jw. | brak rekordów: „Rekordy pojawią się po pierwszych seriach z obciążeniem.” | klucz nieznany (błędny link): „Nie znaleziono ćwiczenia” + „Wróć do Siły” | - |

**Zasada ładowania:** szkielet na każdej sekcji osobno (nie spinner na całym ekranie). Każda sekcja z błędem nie blokuje reszty (częściowe dane). Komunikat błędu mówi, co się stało i co zrobić.

**Zasada pustego stanu:** nigdy „0”, „0%” ani „0 min” tam, gdzie nie ma danych. Zero jest pokazywane tylko, gdy dane istnieją i wynoszą zero (np. 0 cardio w tygodniu z wpisami dziennika).

---

## 11. Progi, mikrokopia i słownik

### 11.1 Progi „za mało danych” (propozycja A3, do akceptacji Q4)

| Wskaźnik | Próg | Komunikat |
|---|---|---|
| Trend e1RM / tonażu ćwiczenia | 3 sesje | „Za mało danych do trendu. Potrzeba 3 sesji.” |
| Prognoza e1RM | 5 sesji | „Prognoza pojawi się po 5 sesjach. Masz N.” |
| Porównanie okresów | 2 okresy z danymi | „Brak danych w tym okresie.” |
| Balans partii | 4 treningi w 30 dniach | „Za mało danych do oceny balansu. Potrzeba 4 treningów w 30 dniach.” |
| Tempo wagi | 2 tygodnie wpisów | „Za mało danych. Potrzeba 2 tygodni wpisów.” |
| Gotowość | 7 dni historii | „Za mało danych. Wróć po tygodniu treningów.” |
| Stagnacja | 3 sesje w 28 dniach | (chip nie pokazuje ćwiczenia poniżej progu) |

### 11.2 Werdykt „Ten tydzień” (AC-1.1, AC-1.4, AC-1.5)

| Sytuacja | Tekst (jedno zdanie) |
|---|---|
| Cel osiągnięty | „Cel tygodnia zrobiony.” |
| Na drodze, dni zostały | „Na dobrej drodze. Jeszcze N treningów do celu.” |
| Za mało, dni zostały | „Do celu brakuje N treningów. Zostało M dni.” |
| Niedziela wieczór / koniec tygodnia | „Tydzień zamknięty: N z M treningów.” (bez zachęty do dalszych treningów, AC-1.4) |
| Tydzień spokojny (0–1 trening) | „Spokojniejszy tydzień. Wracasz z następnym treningiem.” (bez presji) |

### 11.3 Pasma i język (BR-7)

| Pasmo w kodzie | Etykieta w UI | Wniosek (zdanie) |
|---|---|---|
| zmęczenie: niskie | „Niskie” | „Możesz trenować normalnie.” |
| zmęczenie: umiarkowane | „Umiarkowane” | „Obciążenie na zwykłym poziomie.” |
| zmęczenie: wysokie / „przeciążenie” | „Wysokie obciążenie” | „Ostatnie dni były intensywne. Lżejszy dzień dobrze zrobi.” |
| regeneracja: dobra | „Dobra” | „Dobry moment na mocniejszy trening.” |
| regeneracja: średnia | „Średnia” | „Trenuj zgodnie z planem.” |
| regeneracja: niska | „Niska” | „Lżejszy dzień albo więcej odpoczynku.” |

Uwaga: nazwa „przeciążenie” nie pojawia się w UI (BR-7). Ostateczne brzmienie zatwierdza `ux`. Zmieniamy tylko etykiety, nie dane, więc `prawnik` wchodzi wyłącznie w razie wątpliwości (analiza 009, sekcja 13, ryzyko BR-7).

### 11.4 Słownik (jedna nazwa dla jednego pojęcia, AC-13.3)

| Pojęcie | Nazwa w UI | Definicja w `Explainer` (maks. 2 zdania) |
|---|---|---|
| e1RM | „e1RM” (pierwsze wystąpienie z opisem) | Szacowany ciężar na jedno powtórzenie, wyliczony z serii z kilkoma powtórzeniami. |
| Tonaż | „Tonaż” | Suma powtórzeń × ciężar we wszystkich seriach (zgodnie z kodem, W4). |
| RIR | „RIR” | Ile powtórzeń zostawiasz w zapasie. |
| RPE | „RPE” | Subiektywny wysiłek w skali 1–10. |
| Twarde serie | „Twarde serie” | Serie blisko granicy wysiłku (definicja z `lib/intensity-analysis.ts`, do potwierdzenia). |
| Stagnacja | „Stoją w miejscu” | Brak rekordu e1RM przez 28 dni przy co najmniej 3 sesjach. |
| Osiągnięcia | „Osiągnięcia” (było „Zdobyte”) | Odznaki za jednorazowe kamienie milowe. |
| Rekord | „Rekord” | Najlepszy wynik w ćwiczeniu (e1RM, powtórzenia, objętość). |

### 11.5 Zasady mikrokopii
- Po polsku, na „ty”, krótko. Jedno zdanie werdyktu, max 2 zdania w wniosku.
- Liczby z jednostką i okresem („+2,1% · 30 dni”).
- Zakaz słów oceniających ciało i jedzenie („spalone”, „za dużo”, „zły”, „przegrany”, „regres”). Zamiast tego opis kierunku.

---

## 12. Dostępność (WCAG 2.2 AA)

- **Kontrast:** tekst główny białe 90%, drugorzędny `--gym-text-secondary` (ok. 6,5:1 na `#070708`). Zakaz `text-white/40`, `/35`, `/30` na tekście informacyjnym tego modułu (naprawa P-9; przy implementacji zamiana w `progress-ui.tsx`).
- **Cele dotykowe:** 44 px min. dla przycisków, chipów, zakładek, wierszy-linków 56 px. Steppery nie dotyczą (brak edycji w tym module).
- **Kolor nie jest jedynym nośnikiem:** każda zmiana ma strzałkę lub kreskę i tekst („+2,1%”, „podobnie”). Wykresy mają tekst podsumowania.
- **Wykresy:** każdy wykres ma `role="img"` z `aria-label` opisującym trend i wartość końcową, plus tekst pod nim. Dane w tabeli dostępne przez „Pokaż dane” w `Explainer`, dla czytnika ekranu.
- **Nagłówki:** H1 jedna na stronę; sekcje jako `h2`; grupy ćwiczeń jako `h3`.
- **Karty zwijane:** `aria-expanded`, `aria-controls` wskazuje istniejący `id` treści (naprawa podobnego błędu z 005 S-1).
- **Zakładki:** `role="tablist"`, `role="tab"`, `aria-selected`; strzałki lewo/prawo przełączają zakładki (wzorzec ARIA tabs), Tab wchodzi w treść.
- **Chipy filtra:** `aria-pressed`, zwykły Tab.
- **Fokus:** widoczny `:focus-visible` (globalny, 2 px `--ring`). Kolejność fokusu: zakładki → okres → treść sekcji od góry.
- **Ruch:** `prefers-reduced-motion` wyłącza rozwijanie i przejścia `Meter`. `MotionConfig reducedMotion="user"` dla framer-motion, jeśli używany.
- **Język:** `lang="pl"`. Skróty w `aria-label` rozwinięte słowami (np. „e1RM” jako „szacowane maksimum na jedno powtórzenie”); w widocznym tekście skrót zostaje, a pierwsze wystąpienie ma `Explainer`.
- **Prywatność w czytniku:** zdjęcia zwinięte i nieobecne w drzewie DOM do kliknięcia (nie tylko `display:none` bez tekstu).

---

## 13. Responsywność

| Szerokość | Układ |
|---|---|
| 360 px | Zakładki w jednym rzędzie (padding 8 px); `DayStrip` komórki 40 px; KPI szczegółu w trzech kolumnach po ~108 px (zawartość wrap, wartość `font-metric` 18 px). |
| 390 px | Układ z makiety `009-…-makieta.html`. |
| 768 px (`md`) | Kontener `max-w-xl`. Przegląd: „Gotowość” i „Postęp” obok siebie. Siła: grupy ćwiczeń w dwóch kolumnach. Tygodnie: porównanie w dwóch kolumnach A/B. |
| 1024+ | Bez układu desktopowego (zgodnie z `APP_SHELL_MAX`, decyzja produktu w 008 i 007). |

---

## 14. Pytania do decyzji i rozstrzygnięcia UX

| # | Pytanie | Rekomendacja UX | Kto decyduje |
|---|---|---|---|
| Q-U1 | Q2 - przełącznik „Prosty / Zaawansowany” | Nie. Jeden ekran z progresywnym ujawnianiem (karty zwijane, filtry). Makieta nie ma przełącznika. | Użytkownik |
| Q-U2 | Q1 - cele „Następne cele” stałe czy konfigurowalne | W v1 stałe, bez opisu konfiguracji w UI. Pokazujemy tylko postęp i pozostało. | Użytkownik |
| Q-U3 | Próg stagnacji (28 dni, 3 sesje) | Akceptacja propozycji; do potwierdzenia po testach danych. | `architekt` + użytkownik |
| Q-U4 | W1 - okno 180 dni dla „od startu”, licznika treningów i nagłówka „OD … N TRENINGÓW” | Nagłówek z licznikiem lifetime **usunięty z UX**. Zamiast tego okres (30 dni, tydzień) w każdej liczbie (BR-2). Jeśli `architekt` wymaga licznika całej historii, liczony z pełnej historii (BR-5). | `architekt` |
| Q-U5 | Dieta i cardio jako osobne zakładki | Nie. Zwinięta karta w Tygodniach (lazy-load). | Właściciel produktu |
| Q-U6 | Osiągnięcia: miejsce (Q3) | Zostają na Przeglądzie w karcie zwiniętej (sekcja 4, pkt 4). | Właściciel produktu |
| Q-U7 | Pasmo „Wysokie obciążenie” i wynik 0-100 (W9, pytanie metodologiczne) | Pokazujemy pasmo słowne jako główny tekst, wynik liczbowy mniejszym drukiem. Jeśli wiarygodność wyniku jest niska, `architekt` zdecyduje o ukryciu liczby. | `ux` + właściciel produktu + `architekt` |
| Q-U8 | Zdjęcia: czy miniatury w zwiniętej karcie są pobierane przed kliknięciem | Nie. Pobranie dopiero po „Pokaż zdjęcia” (prywatność). | `architekt` potwierdza |
| Q-U9 | Metoda tempa kg/tydz. (W2) | UX używa etykiety „Zmiana w 6 tyg.”, niezależnie od metody. Zmiana metody nie zmienia UI. | `architekt` + właściciel produktu |

---

## 15. Wpływ na wątpliwości analityka (W1-W11)

| # | Wątpliwość | Wpływ na UX w tym dokumencie |
|---|---|---|
| W1 | Okno 180 dni | Nagłówek bez licznika lifetime. Liczby w każdej sekcji z okresem. Do potwierdzenia przez `architekt` (Q-U4). |
| W2 | „kg/tydz. 6 tyg.” to różnica końców okna | Etykieta „Zmiana w 6 tyg.” (sekcja 6, pkt 2). |
| W3 | Dwie definicje „wagi od startu” | Jedna wartość: Przegląd, Sylwetka, zdjęcia pokazują ten sam wynik (sekcje 4, 6). Test w `tester`. |
| W4 | Wzór objętości w tekście vs kod | Słownik (11.4) opisuje tonaż jako sumę powtórzeń × ciężar. Tekst w UI musi odpowiadać kodowi (`tester`). |
| W5 | Stałe cele w kodzie | Opisane jako zwykłe cele bez konfiguracji (Q-U2). |
| W6 | Produkt bez kcal liczony jako 0 | UI: „bez wartości”, bez wpływu na procent (sekcja 7, pkt 4). |
| W7 | Martwy kod `progress-analysis` | Poza zakresem UX; usunięcie po potwierdzeniu `architekt` (9.2). |
| W8 | Podwójna prezentacja gotowości | Jeden wniosek w karcie Gotowość; podpowiedź coacha nie powtarza liczby (sekcja 4, pkt 2). |
| W9 | Nazwa pasma „przeciążenie” | Etykiety z sekcji 11.3. |
| W10 | Regularność 30/90 w dwóch miejscach | Jedno miejsce: Tygodnie, sekcja 3 (D1). |
| W11 | „Intensywność 6 treningów” vs „tydzień” | Etykieta okresu w tytule sekcji (sekcja 5, pkt 4). |

---

## 16. Lista kontrolna spójności (dla `tester` i `frontend`)

- [ ] Każda liczba-trend ma etykietę okresu (BR-2).
- [ ] Brak `0%` i `0 kg` tam, gdzie brak danych (BR-3, sekcja 10).
- [ ] Każda metryka ma jedno miejsce prawdy; wartości zgodne między ekranami (BR-1, AC-15.1).
- [ ] Max 4 sekcje na zakładkę; karty zwijane liczone jako część sekcji.
- [ ] Brak `text-white/40|35|30` na tekście informacyjnym modułu.
- [ ] Cele dotyku 44 px; wiersze listy 56 px.
- [ ] Każdy wykres ma tekstowe podsumowanie i `role="img"`.
- [ ] Zdjęcia nieobecne w DOM przed kliknięciem; brak na Przeglądzie (BR-8).
- [ ] Analityka: tylko nazwa ekranu i zakładki (BR-9).
- [ ] Brak słów „regres”, „progres”, „przeciążenie”, „spalone”, „za dużo” w UI.
- [ ] Mikrokopia pustych stanów mówi, co zrobić dalej.
- [ ] Stan `?tab=` i `?okres=` przeżywa odświeżenie i „Wróć”.
- [ ] Nowe komponenty (`DayStrip`, `StatusPill`, `FilterChips`, `ExerciseRow`) dopisane do katalogu w `docs/ux/00-system-projektowy-stan.md`.

---

## 17. Werdykt etapu 4

**ZATWIERDZONE Z UWAGAMI.**

Specyfikacja i makieta są gotowe do przeglądu użytkownika. Warunki do przejścia do etapu 5 (implementacja):
1. **Q-U4 (W1)** rozstrzygnięte przez `architekt`: nagłówek bez licznika z 180 dni i zgodność „od startu” z pełną historią (BR-5).
2. **Q-U7** (wynik 0-100 gotowości) zaakceptowany przez właściciela produktu, albo wynik ukryty do czasu weryfikacji.
3. **Progi z sekcji 11.1** (Q4 z analizy) zaakceptowane lub skorygowane przez właściciela.
4. Mikrokopia z sekcji 11 zatwierdzona przez właściciela; zmiana etykiet pasm (BR-7) nie wymaga `prawnik`, bo nie zmienia danych ani zgód (zgodnie z decyzją w analizie 009, sekcja 12).

Uwagi niskiego/średniego ryzyka (nieblokujące) zapisane we wspólnym `docs/bledy-do-naprawy/bledy.md`.
