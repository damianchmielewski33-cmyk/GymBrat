# 006 - Bilans makro „Statystyki bilansu” (MAKRO DZIŚ): specyfikacja i makieta

- **Autor**: ux (etap 4 zadania 006)
- **Data**: 2026-10-25
- **Karta**: `docs/zadania/006-redesign-bilansu-makro.md`
- **Wejście**: `docs/analiza/006-redesign-bilansu-makro.md` (US-1..US-10, BR-1..BR-11, AU-1..AU-16, Q-O1..Q-O5), `docs/ux/00-system-projektowy-stan.md`, `docs/ux/005-koniec-treningu-przeplyw.md` (tokeny, typografia, dialogi), kod obecnego ekranu `components/nutrition/nutrition-today-view.tsx`
- **Makieta statyczna**: `docs/ux/006-redesign-bilansu-makro-makieta.html` (ramki 360x640 i 390x844, stany). Makieta jest referencją dla `frontend`; wygrywa ten dokument, gdy się różnią.
- **Równoległość**: dokument powstaje równolegle z `architekt` (etap 3). Pola danych z sekcji 9 to wymagania UX wobec modelu widoku, a nie decyzje architektury. Ostateczny kształt DTO należy do `architekt`.
- **Zakres**: ekran `nutrition/today` (zakładka Dieta/Analiza). Arkusz „Ten tydzień” na Start nie jest redesignowany (A-1); dotyczy go tylko wspólna logika sum (BR-6).

---

## 0. Kluczowe decyzje UX

1. **Jedno miejsce dla każdego faktu.** Dzisiejszy dzień żyje tylko w karcie „Dziś” (hero). Lista odchyleń nie powtarza dzisiejszych wartości. Każdy zamknięty dzień ma jedną kartę, w której są jego odchylenia. Duplikacja ze zrzutu (Czwartek/Kalorie w dwóch miejscach) znika.
2. **Kolejność od dziś.** Na górze: stan dnia, który trwa (kalorie widoczne bez przewijania na 360 px). Pod spodem: tydzień. Na dole: zamknięte dni.
3. **Dzień w toku nie jest oceniany jako niedobór (BR-3, US-2).** W karcie „Dziś” niedobór nie ma etykiety „brakuje”. Jest „do celu zostało X”. Przekroczenie celu jest pokazywane od razu, w neutralnym tonie „ponad cel”.
4. **Suma tygodnia pokazuje, co jest zamknięte, a co trwa (AU-2).** Pasek sumy ma dwa odcinki: dni zamknięte (pełny kolor) i dziś w toku (jaśniejszy odcinek). Użytkownik nie czyta niedoboru z pory dnia.
5. **Semantyka odchyleń bez „czerwonego = źle” (AU-14, Q-O3).** Niedobór = złoty akcent („do uzupełnienia”). Nadwyżka = neutralna biel z ikoną strzałki i tekstem „ponad cel”. „W normie” = zielony z ikoną `Check`. Czerwień nie występuje na tym ekranie w znaczeniu statusu żywieniowego. Kolor nigdy nie jest jedynym nośnikiem (US-7).
6. **Zero nowych tokenów i zero hexów.** Kolor makro (Tailwind `sky`, `rose`, `violet`, `amber`) znika. Tożsamość makro niosą ikona i etykieta. Paski są w złocie (`--gym-gold`), a nadwyżka ma biały odcinek za linią celu.
7. **Dane zdrowotne tylko tam, gdzie są potrzebne.** Bez wartości spożycia w URL, w logach i w tytułach przycisków. Stan filtra i rozwinięcia dnia trzymamy w stanie komponentu (nie w URL).
8. **Język bez oceniania.** Słowa „przekroczone”, „za dużo”, „zjadłeś”, „błąd”, „grzech” nie występują. Używamy „ponad cel”, „do celu zostało”, „brakuje”, „w normie”, „brak wpisów”. Brak streaków, brak wyróżnień za „trzymanie się”, brak czerwonych alarmów.

---

## 1. Hierarchia informacji i przepływ

Kolejność na ekranie (od góry, 360 px):

| # | Blok | Rola | Wysokość (orientacyjnie) | Komponent (sekcja 3) |
|---|---|---|---|---|
| 1 | Nagłówek ekranu | Kontekst: „MAKRO DZIŚ”, zakres dat, wstecz | ~72 px | `AppPageHeader` |
| 2 | Banner stanu (tylko offline / błąd odświeżenia) | Komunikat o danych | 0 lub ~56 px | `InlineBanner` |
| 3 | **Dziś** (hero) | Cztery makro dnia w toku, cel, pozostało | ~248 px | `SectionLabel` + `app-card` + `MacroTodayTile` x4 |
| 4 | **Tydzień PN→dziś** | Suma tygodnia, dni z wpisami, trend | ~240 px | `SectionLabel` + `app-card` + `MacroMeter` x4 + `WeekTrendBars` |
| 5 | **Odchylenia** | Lista zamkniętych dni z odchyleniami, filtr | nagłówek ~88 px + karty | `SectionLabel` + `MacroFilterChips` + `DayBalanceCard` xN |
| 6 | Wyjaśnienie reguł | „Jak liczymy?” | ~24 px | `Explainer` |

Na pierwszym ekranie 360x640 widoczne są: nagłówek, hero z kaloriami (liczba i pasek), początek sekcji „Dziś” z trzema makro. Pozostałe makro i tydzień wymagają przewinięcia (US-7: kluczowe liczby dziś są w pierwszym kadrze; pełne makro dnia to drugi kadr).

Przepływ interakcji:
- Tap karty dnia (przycisk na całej karcie) -> rozwinięcie czterech makro (`aria-expanded`). Domyślnie wszystkie zwinięte; wyjątek w sekcji 4.4.
- Tap chipa filtra (np. „Białko”) -> lista pokazuje tylko dni z odchyleniem białka; w rozwiniętej karcie tylko wiersz białka; licznik na chipach i w nagłówku sekcji przelicza się.
- Tap słupka trendu -> pod wykresem podpis dnia (wartość kcal i %). Brak tooltipa hover (ekran dotykowy).
- „Tydzień →” w karcie tygodnia -> widok tygodnia (`nutrition/week`); zakres nawigacji wg Q-O4 (sekcja 10).

---

## 2. Tokeny i typografia

Wyłącznie istniejące tokeny (`app/globals.css`) i klasy systemu (`app-card`, `app-label`, `SectionLabel`).

| Rola | Token / klasa | Uwagi |
|---|---|---|
| Tło ekranu | `--gym-black` | Ekran zawsze ciemny |
| Kontener karty | `app-card` (22 px) | Hero wyróżniony poświatą `--gym-gold` 12% u góry (jak karta tonażu w 005) |
| Kontener wiersza (wewnątrz karty) | `rounded-2xl` + `bg-black/25` + obrys `--gym-border-gold` | Wiersze dnia w rozwinięciu |
| Akcent, wypełnienie pasków, wartość kcal | `--gym-gold` | Jeden kolor postępu dla wszystkich makro |
| Odcinek „dziś w toku” | `--gym-gold` 45% | Jaśniejszy/przygaszony odcinek paska tygodnia |
| Odcinek nadwyżki | biały 70% (`--foreground` 70%) | Pasek na celu, wychodzi poza linię 100% |
| W normie | `--gym-trend-up` (= `--gym-success`) | Zawsze z ikoną `Check` i tekstem |
| Niedobór („brakuje”, „do celu”) | `--gym-gold` tekst + ikona `ArrowDownRight` | Obrys `--gym-gold` 35%, tło 10% |
| Nadwyżka („ponad cel”) | biały 90% tekst + ikona `ArrowUpRight` | Obrys biały 25%, tło biały 8%. Brak czerwieni |
| Brak celu / brak wpisów | `--gym-text-secondary` | Ikona `Minus`, obrys przerywany |
| Tekst drugorzędny | `--gym-text-secondary` (#9a9182, ok. 6,5:1) | Zamiast `text-white/45`, `/40`, `/35` |
| Banner ostrzeżenia (offline) | `InlineBanner variant="warning"` | Ikona + tekst |
| Błąd ładowania | `--destructive` ikona + tekst | Tylko w stanie błędu |
| Tekst na złotym CTA | `--neon-fg` | Przez `Button variant="cta"` |
| Pusty odcinek / tor paska | `--gym-track` (#2b2518) | Już zdefiniowany w makiecie 004 |

**Typografia** (maks. pięć poziomów, minimum 11 px):

| Poziom | Klasa | Użycie |
|---|---|---|
| H1 ekranu | `appPageTitleClass` (28 px, `font-heading`) | „Statystyki bilansu” |
| H2 sekcji | `SectionLabel` (indeks, tytuł, licznik) | „Dziś”, „Tydzień PN→dziś”, „Odchylenia” |
| Liczba hero | `font-metric` 40 px (`sm:44 px`), `tabular-nums` | Kcal dziś |
| Wartość makro | 20 px `font-semibold tabular-nums` (kafel), 15 px (wiersz rozwinięty) | Gramy, procenty |
| Treść | Geist 14-15 px `font-semibold` dla nazw; 13 px dla statusów | Nazwy dni, makro, statusy |
| Meta | 12 px `--gym-text-secondary` | Cel, zakres, „z 2 400 kcal” |
| Etykieta | 11 px `uppercase tracking-[0.14em] font-semibold` | „KCAL”, „BIAŁKO”, „WĘGLE”, „TŁUSZCZ” |

Zasady:
- Każda liczba (kcal, g, %) z `tabular-nums`, kolumny się równają.
- Format liczby: spacja tysięcy pl-PL (`1 412 kcal`), jednostka w tej samej linii, np. `96 / 170 g`.
- Procenty bez miejsc po przecinku. Delta w gramach/kcal bez znaku „+” przy braku przekroczenia.

**Odstępy:** skala 4/8 px. Wewnątrz kart `p-4` (16 px) na telefonie, `p-5` od `sm`. Między sekcjami `space-y-6`, między kartami w sekcji `gap-2.5`. Zewnętrzny margines `px-4` / `sm:px-5`.

**Promienie:** karty 22 px, chipy `rounded-full`, przyciski `rounded-2xl`, wiersze `rounded-2xl`.

**Ruch:** wypełnienie paska `transition-[width] duration-500 ease-out` (bez animacji przy `prefers-reduced-motion`). Rozwinięcie karty dnia 200 ms przez `grid-rows-[0fr]` -> `[1fr]`. Brak licznika animowanego (liczby od razu w stanie końcowym).

---

## 3. Katalog komponentów (ten ekran)

Zasada: najpierw istniejące komponenty. Nowe tylko tam, gdzie nic nie pasuje. Wszystkie dokumentowane tu klocki trafiają do `docs/ux/00-system-projektowy-stan.md` po implementacji (sekcja „Klocki domenowe”).

| Komponent | Status | Gdzie | Warianty i stany | Uwagi |
|---|---|---|---|---|
| `AppPageHeader` | istniejący, reuse | nagłówek | z kickerem „MAKRO DZIŚ”, z przyciskiem wstecz (44 px) | Zamiast obecnego inline nagłówka |
| `SectionLabel` | istniejący, reuse | H2 sekcji | `index`, `title`, `trailing` (licznik lub link) | `titleAs="h2"` |
| `InlineBanner` | istniejący, reuse | banner stanu | `warning` (offline), `error` (nie udało się odświeżyć) | |
| `Button` | istniejący, reuse | CTA pustego dnia, „Spróbuj ponownie” | `cta`, `outline`, `ghost` | |
| `Explainer` | istniejący, reuse (`progress-ui`) | „Jak liczymy?” pod tygodniem | | |
| `EmptyNote` | istniejący, reuse (`progress-ui`) | tydzień bez dni z wpisami, brak odchyleń | | |
| `Meter` | istniejący, **rozszerzany** (`progress-ui`) | pasek makro (hero, tydzień, wiersz dnia) | prop `overflow` (odcinek nadwyżki za 100%), prop `segments` (zamknięte + dziś w toku), wariant `size: "sm" (4 px) / "md" (6 px) / "lg" (8 px)`, stan `none` (brak celu: tor przerywany bez wypełnienia) | Jedna implementacja paska w aplikacji; nie kopiować `h-1.5` inline |
| `MacroTodayTile` | **nowy** (`components/nutrition/`) | kafel makro w hero (B, W, T) | `in_progress`, `over`, `no_goal`, `partial` | Jedna definicja kafla; kcal to osobny wariant `hero` tego samego komponentu |
| `MacroMeter` (wiersz tygodnia) | **nowy** (`components/nutrition/`), cienki wrapper na `Meter` | wiersz sumy tygodnia | `closed+today`, `no_goal`, `partial` | Łączy etykietę, wartości „z X”, % i pasek |
| `WeekTrendBars` | **nowy** (`components/nutrition/`) | 7 słupków kcal w tygodniu | `filled`, `today` (przerywany obrys), `empty` (kreska „brak”), `selected` | Jedyny nowy klocek wizualny; SVG/CSS, bez Recharts (7 wartości) |
| `DayBalanceCard` | **przebudowa** `DayCard` (ten sam plik) | karta zamkniętego dnia | `collapsed`, `expanded`; statusy sekcji 4.3 | Zastępuje `DayCard` i `MacroStatRow` |
| `DayStatusChip` | **nowy** (wewnątrz `DayBalanceCard`) | status dnia | `in_range`, `deviations(n)`, `empty`, `partial`, `no_goal`, `in_progress` | Mapa status -> ikona + tekst + ton |
| `MacroFilterChips` | **nowy** (`components/nutrition/`), wzór z `chip-scroll` | filtr odchyleń | `all`, `kcal`, `protein`, `carbs`, `fat`, każdy z licznikiem | Nie używa `SegmentedControl` (5 segmentów nie mieści się w 360 px) |
| `DayTypeChip` | **nowy**, mały (wewnątrz hero i karty dnia) | „Trening” / „Odpoczynek” | `training`, `rest`, `unknown` (bez chipa) | Ikona `Dumbbell` / `Moon` + tekst |

Usuwane: `HighlightList` (zastąpiona sekcją „Odchylenia”), `MacroStatRow` (zastąpiony przez `MacroTodayTile` i wiersz rozwinięcia), `statusTone`/`statusChip` z kolorami Tailwind (zastąpione mapą statusów z sekcji 2), `MACRO_BAR` (gradienty Tailwind).

---

## 4. Specyfikacja ekranu

### 4.1 Nagłówek

- `AppPageHeader`: kicker `MAKRO DZIŚ` (złoto, uppercase), tytuł `Statystyki bilansu`, meta `19–25 paź 2026 · pn→dziś` (12 px, `--gym-text-secondary`).
- Lewa strona: przycisk wstecz (44x44, `ArrowLeft`, `aria-label="Wróć do diety"`).
- Link „Tydzień →” przenosimy do nagłówka karty tygodnia (sekcja 4.3). W nagłówku ekranu nie ma akcji, żeby hierarchia zaczynała się od liczb.

### 4.2 Karta „Dziś” (hero)

Kontener: `app-card` z poświatą `--gym-gold` 12%, `p-4 sm:p-5`. Nad kartą `SectionLabel` (index `01`, tytuł `Dziś`, `trailing`: `DayTypeChip`).

Układ (360 px):

```
01 DZIŚ                                     [Dumbbell Trening]
Niedziela, 25 paź · dzień w toku            (meta, 12 px)

1 412  kcal                              988 kcal do celu
z 2 400 kcal                                  (13 px, tabular)
[=========================-----------------]  (Meter lg, 8 px, znacznik celu na końcu)

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ BIAŁKO       │ │ WĘGLE        │ │ TŁUSZCZ      │
│ 96 g         │ │ 118 g        │ │ 41 g         │
│ z 170 g      │ │ z 260 g      │ │ z 70 g       │
│ [=====----]  │ │ [====-----]  │ │ [=====----]  │
│ do celu 74 g│ │ do celu 142 g│ │ do celu 29 g │
└──────────────┘ └──────────────┘ └──────────────┘
```

Elementy:
- **Kicker/meta**: data w formacie `Niedziela, 25 paź`, po kropce stan: `dzień w toku` (zawsze dla dziś). Nie pokazujemy godziny jako licznika.
- **Kcal (wariant `hero` `MacroTodayTile`)**: liczba spożycia `font-metric` 40 px; pod nią `z 2 400 kcal` (12 px). Po prawej: `988 kcal do celu` (14 px, `--gym-gold`) albo `ponad cel o 120 kcal` (14 px, biały 90%, ikona `ArrowUpRight`), gdy przekroczono.
- **Pasek kcal**: `Meter size="lg"`. Wypełnienie do 100%; jeśli >100%, pełny tor + biały odcinek za znacznikiem celu (`overflow`).
- **Trzy kafle B/W/T**: grid 3 kolumny, `gap-2`, każdy kafel `rounded-2xl`, `bg-black/25`, obrys `--gym-border-gold`, `p-2.5`. Wartość 18-20 px `tabular-nums`, pod nią `z X g` (12 px, secondary), `Meter size="sm"`, status 12 px: `do celu N g` (złoto) albo `ponad cel o N g` (biały).
- Na 360 px szerokość kafla ~104 px. Etykieta `WĘGLE` i wartość `118 g` mieszczą się bez zawijania; `z 260 g` pod wartością.
- Mikro-status słowny (zawsze): „do celu” / „ponad cel” / „brak celu” / „niepełne dane”. Kolor jest dodatkiem.

Ton stanu dnia w hero (jedna linia meta, bez oceny):
- dzień w toku, brak przekroczeń: `dzień w toku`;
- dzień w toku, co najmniej jedno makro ponad cel: `dzień w toku · ponad cel: białko` (lista nazw, max 2, dalej „i N więcej”).
- Brak żadnego wpisu: patrz 5.1.

### 4.3 Karta „Tydzień PN→dziś”

`SectionLabel` (index `02`, tytuł `Tydzień PN→dziś`, `trailing`: link `Tydzień →` 12 px, złoto, min 44 px dotyku). Karta `app-card` `p-4 sm:p-5`.

Nagłówek karty (12 px, secondary): `5 z 7 dni z wpisami`. Pod tym: `Explainer` „Jak liczymy?” (rozwija: „Suma obejmuje dni z co najmniej jednym wpisem. Dziś wlicza się do sumy od pierwszego wpisu; jego cel jest w sumie, a odcinek ‘dziś w toku’ jest jaśniejszy.”). Treść wyjaśnienia dopasuje się do decyzji BR-5 (sekcja 10).

Cztery wiersze `MacroMeter`:

```
KALORIE                                 8 420 / 12 000 kcal   70%
[=====================----------------]  (Meter md, odcinek zamknięty + jasny odcinek „dziś”)
w tym dziś w toku: 1 412 kcal (12 px, secondary)
```

- Wartość: `suma / suma celów` w jednej linii, `tabular-nums`; % z prawej, 14 px `font-semibold`.
- Pasek: dwa odcinki (`segments`): dni zamknięte pełnym złotem, dziś w toku przygaszonym złotem 45%. Nadwyżka jako biały odcinek za 100%.
- Pod paskiem (12 px, secondary) tylko przy dziś w toku: `w tym dziś w toku: 1 412 kcal`.
- Kolejność makro: Kalorie, Białko, Węgle, Tłuszcz (jak w hero).

Trend (`WeekTrendBars`), pod wierszami makro, oddzielony `border-t border-white/10` (kolor `--gym-border-gold`), `mt-4 pt-4`:
- Tytuł małą etykietą `KALORIE DNIA, % CELU` (11 px uppercase).
- 7 słupków Pn–Nd, wysokość obszaru 72 px, skala 0–150% celu kcal, przerywana linia 100% (`--gym-text-secondary`, 1 px).
- Słupek zamknięty: wypełnienie `--gym-gold` 70%. Dziś: obrys przerywany `--gym-gold`, wypełnienie 25%. Dzień bez wpisów: brak słupka, kreska `—` i pod etykietą `brak`. Dzień bez celu: szary tor bez wypełnienia, pod etykietą `brak celu`.
- Podpisy osi: `P W Ś C P S N` (11 px, secondary), dziś podpisany `dziś` lub pogrubiony.
- Każdy słupek to przycisk (44 px szerokości kolumny). Tap: pod wykresem pojawia się jedna linia: `Czwartek · 2 210 z 2 400 kcal · 92%`. Domyślnie żadna linia (brak zaznaczenia) albo `dziś` gdy są wpisy.
- Dostępność: kontener `role="group"`, `aria-label="Kalorie dnia w tygodniu, procent celu"`; każdy słupek ma `aria-label` pełne zdanie („Czwartek: 92 procent celu, 2 210 z 2 400 kcal”). Sekcja alternatywna dla czytnika: lista sr-only z 7 wierszami (ten sam tekst).

Stan tygodnia z 0 dniami z wpisami: `EmptyNote` „Tydzień zacznie się liczyć po pierwszym wpisie posiłku.” Bez sum, bez wykresu (wykres z samymi kreskami nie jest wykresem danych). `Tydzień →` zostaje.

### 4.4 Sekcja „Odchylenia”

`SectionLabel` (index `03`, tytuł `Odchylenia`, `trailing`: `6 w 3 dniach`). Licznik w nagłówku = suma pozycji na liście po aktywnym filtrze, z podpisem dni. (BR-11: licznik równa się liczbie pozycji.)

Filtr: `MacroFilterChips` (scrollowalny poziomo `chip-scroll`, bez przewijania na 360 px dla 5 chipów; jeśli się nie mieści, ostatni chip częściowo widoczny jako sygnał).

```
[ Wszystkie 6 ] [ Kalorie 1 ] [ Białko 2 ] [ Węgle 2 ] [ Tłuszcz 1 ]
```

- Chip: wysokość 36 px wizualnie, hit-area 44 px (padding). Aktywny: obrys `--gym-gold` 60%, tekst biały, `aria-pressed="true"`. Nieaktywny: obrys `--gym-border-gold`, tekst biały 80%.
- Licznik w chipie to liczba pozycji tego makro w tygodniu (zamknięte dni). Dziś nie wchodzi, bo dzisiejsze przekroczenia są w hero.
- Grupa: `role="group" aria-label="Filtruj odchylenia po makro"`.
- Filtr jest stanem lokalnym; nie zapisuje się w URL.

Lista: `DayBalanceCard` dla każdego zamkniętego dnia, od najnowszego (Sobota przed Piątkiem itd.). Dni bez odchyleń w ogóle (`in_range`, `empty`, `no_goal`, `partial`) są też na liście, bo to ich status. Przy filtrze: pokazujemy tylko dni z odchyleniem tego makro; dni `empty` i `partial` znikają, a ich status pozostaje w widoku bez filtra.

Zero odchyleń w tygodniu (w zamkniętych dniach): `EmptyNote` „Brak odchyleń w zamkniętych dniach tego tygodnia.”. Filtr ukryty.

#### 4.4.1 Karta zamkniętego dnia (`DayBalanceCard`), stan zwinięty

```
Sobota                                          [2 odchylenia ▾]
24 paź · Trening · cel treningowy
┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│KCAL     ││BIAŁKO   ││WĘGLE    ││TŁUSZCZ  │
│106%  ↑  ││96%      ││112% ↑   ││96%      │
│[======]││[====  ] ││[======+]││[=====  ]│
└─────────┘└─────────┘└─────────┘└─────────┘
```

- Cały wiersz to przycisk (min 64 px wysokości), `aria-expanded`, `aria-controls`.
- Nagłówek: nazwa dnia 15 px `font-semibold` (`Sobota`), data `24 paź` 12 px secondary w tej samej linii lub pod spodem na 360 px; `DayTypeChip` (`Trening` / `Odpoczynek`) w linii meta.
- Prawa strona: `DayStatusChip`, potem `ChevronDown`.
- Cztery mini-kolumny (`grid-cols-4 gap-2`): etykieta 11 px uppercase, wartość % 13 px `tabular-nums` (+ ikona strzałki, jeśli odchylenie), `Meter size="sm"`.
- Mini-kolumna nie pokazuje gramów: liczby pełne są po rozwinięciu (oszczędność miejsca i mniej danych w pierwszym kadrze).

#### 4.4.2 Stan rozwinięty

Pod nagłówkiem (`border-t border-white/10`, `mt-3 pt-3`), cztery wiersze makro:

```
[icon] Kalorie                                 ↑ ponad cel +84 kcal
       1 484 z 1 400 kcal                                     106%
       [=========================================+]
[icon] Białko                                   ↓ brakuje 31 g
       84 z 115 g                                              73%
       [=================--------]
```

- Wiersz: ikona makro 16 px `aria-hidden` (lucide: `Flame`, `Beef`, `Wheat`, `Droplets`), nazwa 14 px `font-semibold`, wartość `spożycie z celu` 12 px `tabular-nums`.
- Prawa kolumna: status z ikoną (13 px), pod nim % (12 px `tabular-nums`).
- Pasek `Meter size="md"` (6 px) z odcinkiem nadwyżki, jeśli >100%.
- Wiersz bez celu: status `brak celu`, pasek tor przerywany, wartość `84 g` bez `z`.
- Wiersz z niepełnymi danymi: dopisek 12 px pod wartością (sekcja 5.4).
- Odstęp między wierszami `space-y-3`. Separator między wierszami: `divide-y divide-white/[0.06]`.

#### 4.4.3 Statusy (`DayStatusChip` i status wiersza)

| Status | Warunek (wejście od architekt, BR-2) | Ikona | Tekst na chipie | Tekst w wierszu | Ton |
|---|---|---|---|---|---|
| `in_range` | wszystkie makro w normie | `Check` | `W normie` | `W normie` | zielony `--gym-trend-up` |
| `deviations(n)` | n >= 1 makro poza normą | `Dot` (bez ikony) | `N odchylenia` / `1 odchylenie` / `N odchyleń` (pluralizacja 1 / 2-4 / 5+) | `brakuje X` / `ponad cel +X` | niedobór: złoto; nadwyżka: biały |
| `empty` | brak wpisów (BR-4) | `Minus` | `Brak wpisów` | - | secondary, obrys przerywany |
| `partial` | co najmniej jeden produkt bez wartości makro (BR-8) | `Info` | `Niepełne dane` | dopisek | secondary, obrys zwykły |
| `no_goal` | brak celu dla dnia (cel 0 lub brak) | `Minus` | `Brak celu` | `brak celu` | secondary |
| `in_progress` | tylko dziś; nie w liście zamkniętych dni | `Clock` | `Dzień w toku` | - | złoto 35% obrys |

Reguła wyświetlania odchylenia: makro jest w normie, gdy |odchylenie %| ≤ 5 pp lub |delta| < 1 jednostki (stan obecny, A-6; próg do potwierdzenia, Q-O1). Niedobór i nadwyżka rozróżnione (sekcja 0 pkt 5).

Semantyka per makro (Q-O3, AU-14), domyślna do decyzji właściciela:

| Makro | Niedobór | Nadwyżka | Uwagi |
|---|---|---|---|
| Kalorie | `brakuje` (złoto) | `ponad cel` (biały) | Bez wartościowania |
| Białko | `brakuje` (złoto) | `ponad cel` (biały) | Niedobór najczęściej wymaga działania; tekst wprost |
| Węglowodany | `brakuje` (złoto) | `ponad cel` (biały), w dniu treningowym dopisek `dzień treningowy` | Q-O3: nadwyżka w dniu treningowym domyślnie liczona jako odchylenie, ale neutralna; właściciel może wyłączyć |
| Tłuszcz | `brakuje` (złoto) | `ponad cel` (biały) | Jak kalorie |

Dla dni odpoczynku dopisek „dzień treningowy” nie występuje.

#### 4.4.4 Kolejność

- Dni: od najnowszego zamkniętego dnia w dół (nie ma pozycji „dziś” na liście).
- Odchylenia w dniu: stała kolejność makro (kalorie, białko, węglowodany, tłuszcz) – nie sortujemy po wielkości (BR-10 ustala kryterium wagi dla listy; tu stały porządek jest czytelniejszy na 360 px). Do potwierdzenia przez właściciela; jeśli wymagane sortowanie po wadze, zmieniamy na: nadwyżka kcal, niedobór białka, pozostałe.
- Domyślnie rozwinięta jest karta ostatniego zamkniętego dnia z odchyleniami (jedna, żeby pierwszy kadr listy pokazał przykład). Pozostałe zwinięte.

### 4.5 Responsywność

| Szerokość | Zmiana |
|---|---|
| 360 px (minimum) | Układ jak w makiecie. Kafle B/W/T w 3 kolumnach, `text-[11px]` na etykietach. Filtr scrollowalny. |
| 390 px | Bez zmian; kafle z większym oddechem. |
| 640 px i więcej (`sm`) | Paddingi `p-5`, kcal `sm:44 px`. |
| 768 px i więcej (`md`) | Kontener `max-w-xl` (jak reszta aplikacji). Karty dni w siatce 2 kolumny (`md:grid-cols-2`). Hero bez zmian. |
| Wysoki ekran (`max-height: 719px`) | Wariant `compact` (jak 003/004): mniejsze odstępy, bez wykresu tygodnia, wykres dostępny po rozwinięciu „Tydzień”. |

Brak przewijania poziomego na 360 px poza filtrem (celowe scrollowanie chipów z widocznym ucięciem).

### 4.6 Ruch i preferencje

- `prefers-reduced-motion`: bez animacji pasków, bez rozwinięcia animowanego (przełączenie natychmiastowe), bez pulsowania.
- Brak konfetti, brak animacji liczb.

---

## 5. Stany ekranu (obowiązkowe)

### 5.1 Pusty start (pierwsze użycie, zero wpisów w ogóle)

- Hero: kcal `0` (`z 2 400 kcal`), status `Brak wpisów dziś`; kafle B/W/T z `0 g`, statusy `do celu …`. Nie pokazujemy „0%” jako wyniku oceny – pasek pusty, procent ukryty.
- Pod hero (wewnątrz karty, `mt-4`): tekst `Nie zapisano jeszcze posiłków tego dnia.` (13 px, secondary) + `Button variant="cta"` „Dodaj posiłek” -> hub Dieta (`/meal-suggestions`).
- Tydzień: `EmptyNote` (sekcja 4.3).
- Odchylenia: `EmptyNote` „Tu pojawią się odchylenia, gdy zapiszesz posiłki z kilku dni.”, bez filtra.

### 5.2 Dzień bez wpisów (dziś lub wstecz)

- Hero dziś: jak 5.1 (dzień w toku, bez wpisów). Zwykły dzień „w toku” bez wpisów rano to normalny stan – bez alarmu.
- Karta zamkniętego dnia: `DayStatusChip` `Brak wpisów`, mini-kolumny kreski `—`, rozwinięcie: jeden tekst `Nie zapisano posiłków tego dnia. Dzień nie wchodzi do sumy tygodnia.` (13 px). Brak pozycji „brakuje 100%” (US-3, BR-4).
- Słupek trendu: kreska i `brak`.

### 5.3 Cel nieustawiony lub zero (US-4)

- Kafel/wiersz bez celu: wartość spożycia bez „z X”, pasek jako tor przerywany, status `brak celu`. Brak „NaN”, brak „∞”, brak „0%”.
- Kcal bez celu w hero: liczba spożycia, tekst `Brak celu kalorii`, link `Ustaw cele w profilu` (14 px, złoto, min 44 px) -> `/profile`.
- Jeśli nie ma celu dla żadnego makro w tygodniu: sekcja tygodnia pokazuje sumy spożycia bez % i bez paska, z `Explainer` „Cele ustawisz w profilu.”
- Odchylenia dla dnia bez celu: `DayStatusChip` `Brak celu`; nie generuje pozycji odchylenia.

### 5.4 Niepełne dane (US-6, BR-8)

- Wartość makro z brakiem danych produktów: obok wartości ikona `Info` (16 px) i dopisek 12 px: `Część produktów nie ma wartości białka. Wynik może być zaniżony.` (nazwa makro dynamiczna).
- Dzień ze statusem `partial`: `DayStatusChip` `Niepełne dane`, bez oceny jako niedobór; odchylenie nie liczy się jako „brakuje” bez adnotacji.
- Dziś: dopisek w hero pod kaflem, ten sam tekst.

### 5.5 Dzień w toku (BR-3, US-2)

- Wyłącznie dziś. Hero: `Dzień w toku`, „do celu zostało”. Brak „brakuje” i brak statusu oceny.
- Przekroczenie celu: od razu, neutralnie (`ponad cel o N`), bez czerwieni.
- W tygodniu: odcinek „dziś w toku” przygaszony (sekcja 4.3).

### 5.6 Ładowanie (szkielet, nie spinner)

- Hero: `app-card animate-pulse` 248 px, wewnątrz bloki: linia 120 px (etykieta), blok 64 px (liczba), pasek 8 px, trzy kafle 72 px.
- Tydzień: `app-card animate-pulse` 240 px.
- Odchylenia: 3 karty szkieletowe 64 px. `aria-busy="true"` na kontenerze sekcji.

### 5.7 Błąd

- Hero i tydzień: `InlineBanner variant="error"` „Nie udało się wczytać bilansu.” + `Button variant="outline"` „Spróbuj ponownie” (min 44 px). Brak wartości z poprzedniego ładowania nie jest pokazywany jako aktualny – jeśli dane są, zostają z dopiskiem „stan z HH:MM” (patrz 5.8).
- Brak uprawnień lub niepełny profil: link `Uzupełnij profil, aby zobaczyć cele` -> `/complete-profile` (jeśli zachodzi). Sesja wygasła: obsługa globalna (layout), bez osobnego ekranu.

### 5.8 Offline / PWA (analiza, sekcja 8)

- Dane już załadowane: zostają widoczne, banner `InlineBanner variant="warning"` nad hero: `Brak połączenia. Pokazujemy dane z 13:05. Odśwież po powrocie do sieci.` (12-13 px). Godzina to czas ostatniego pobrania, nie „teraz”.
- Brak danych w cache (pierwsze otwarcie offline): zamiast bilansu jeden blok `app-card`: `Nie masz połączenia` + `Spróbuj ponownie` (`Button outline`). Nie pokazujemy zer ani pustego bilansu jako wyniku.
- Po odzyskaniu sieci banner znika bez powiadomienia (nieblokujące).

---

## 6. Dostępność (WCAG 2.2 AA)

- **Kontrast**: tekst główny biały 90-92%, drugorzędny `--gym-text-secondary` (ok. 6,5:1 na czerni). Zakaz `text-white/45|40|35|30` na tekście informacyjnym tego ekranu. Etykiety 11 px uppercase w `--gym-text-secondary`.
- **Statusy**: zawsze ikona + tekst + kolor (trzy kanały). Test: w skali szarości statusy muszą być rozróżnialne tekstem.
- **Paski** (`Meter`): `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow` = min(%, 100), `aria-valuetext` pełne zdanie: `Białko: 96 z 170 g, 56 procent celu, do celu zostało 74 g`. Nadwyżka: `Węgle: 118 procent celu, ponad cel o 18 g`. Brak celu: `Tłuszcz: 41 g, brak celu`.
- **Hero**: `<section aria-labelledby>` z H2 „Dziś”. Kcal jako `<p>` z tekstem jednostki w tym samym elemencie (`1 412 kcal`).
- **Karty dni**: przycisk z `aria-expanded` i `aria-controls`; nazwa przycisku zawiera dzień, datę i status („Sobota, 24 paź, 2 odchylenia, rozwiń”).
- **Filtr**: `aria-pressed` na każdym chipie, grupa z `aria-label`. Zmiana filtra ogłaszana przez `aria-live="polite"` w jednej linii pod listą: `Pokazuję 2 dni z odchyleniem: białko`.
- **Wykres tygodnia**: opis zbiorczy + lista sr-only (sekcja 4.3). Brak samego koloru jako nośnika słupka (wartość w aria i w linii po tapnięciu).
- **Fokus**: kolejność Tab: wstecz -> link „Tydzień →” -> przycisk „Jak liczymy?” -> filtr -> karty dni (każda przycisk) -> dopisek. Fokus widoczny (`:focus-visible` z globalnego stylu, 2 px `--ring`).
- **Cele dotykowe**: min 44x44 px dla wszystkich przycisków i chipów (system; ten ekran nie jest trybem treningu, więc 44 px wystarcza). Słupki wykresu: kolumna 44 px szerokości.
- **Czytelność**: minimum 11 px dla etykiet, 12 px dla meta, 13-14 px dla treści.
- **Język**: `lang="pl"` jak reszta. Jednostki w `aria-label` i `aria-valuetext` zapisane pełnymi słowami (np. „procent celu”, „gramów” w zdaniu), skróty tylko w warstwie wizualnej.

---

## 7. Mikrokopia (zatwierdzona lista)

| Miejsce | Tekst |
|---|---|
| Kicker | MAKRO DZIŚ |
| H1 | Statystyki bilansu |
| Meta zakresu | 19–25 paź 2026 · pn→dziś |
| Hero: dzień trwa | Dzień w toku |
| Hero: zostało | 988 kcal do celu |
| Hero: przekroczenie | ponad cel o 120 kcal |
| Hero: brak wpisów | Brak wpisów dziś |
| Hero: pusty start | Nie zapisano jeszcze posiłków tego dnia. |
| Hero: CTA pusty start | Dodaj posiłek |
| Hero: brak celu kcal | Brak celu kalorii · Ustaw cele w profilu |
| Tydzień: liczba dni | 5 z 7 dni z wpisami |
| Tydzień: dziś w toku | w tym dziś w toku: 1 412 kcal |
| Tydzień: wyjaśnienie | Suma obejmuje dni z co najmniej jednym wpisem. Dzisiejszy dzień jest w sumie w trakcie – odcinek jaśniejszy. |
| Tydzień: brak dni | Tydzień zacznie się liczyć po pierwszym wpisie posiłku. |
| Tydzień link | Tydzień → |
| Odchylenia: nagłówek | Odchylenia · 6 w 3 dniach |
| Odchylenia: zero | Brak odchyleń w zamkniętych dniach tego tygodnia. |
| Odchylenia: filtr aria | Pokazuję 2 dni z odchyleniem: białko |
| Status: w normie | W normie |
| Status: niedobór | brakuje 31 g |
| Status: nadwyżka | ponad cel +120 kcal |
| Status: odchylenia | 1 odchylenie · 2–4 odchylenia · 5+ odchyleń (pluralizacja wg liczby) |
| Status: brak wpisów | Brak wpisów |
| Status: brak celu | Brak celu |
| Status: niepełne dane | Niepełne dane |
| Dopisek niepełne | Część produktów nie ma wartości białka. Wynik może być zaniżony. |
| Dzień bez wpisów (rozwinięty) | Nie zapisano posiłków tego dnia. Dzień nie wchodzi do sumy tygodnia. |
| Typ dnia | Trening · Odpoczynek |
| Offline | Brak połączenia. Pokazujemy dane z 13:05. Odśwież po powrocie do sieci. |
| Offline bez danych | Nie masz połączenia. Spróbuj ponownie, gdy wrócisz do sieci. |
| Błąd | Nie udało się wczytać bilansu. |
| Błąd CTA | Spróbuj ponownie |

Zakazane w tym ekranie: „przekroczone”, „za dużo”, „zjadłeś”, „zaległe”, „błąd” przy makro, „brakuje 100%”, „0%” przy dniu bez wpisów, emotikony, wykrzykniki.

---

## 8. Pokrycie wymagań analityka

| Wymaganie | Rozwiązanie w specyfikacji |
|---|---|
| US-1 jedna suma tygodnia | Jedna sekcja tygodnia (sekcja 4.3) z tą samą liczbą, co w arkuszu Start (warunek: wspólna logika BR-6, decyzja architekta) |
| US-2 dziś bez fałszywego alarmu | Hero „dzień w toku”, „do celu zostało”, brak „brakuje” (4.2, 5.5) |
| US-3 dni bez danych | Status `Brak wpisów`, bez pozycji 100% (4.4.3, 5.2) |
| US-4 brak celu | Kafel/wiersz `brak celu`, tor przerywany, bez NaN/∞ (5.3) |
| US-5 zmiana dnia i strefy | UX pokazuje etykietę dnia z DTO (nie liczy daty w przeglądarce, sekcja 9) |
| US-6 niepełne dane | Status `Niepełne dane` + dopisek (5.4) |
| US-7 czytelność 360 px | Kcal w pierwszym kadrze, statusy tekstowe, kontrast (1, 6) |
| US-8 filtr i licznik | `MacroFilterChips` + licznik zgodny z listą (4.4) |
| US-9 nawigacja tygodnia | Link „Tydzień →” zachowany (4.3, sekcja 10 Q-O4) |
| US-10 cel dnia treningowego | `DayTypeChip` i dopisek w wierszu węgli (4.4.3) |
| AU-3 ocena w trakcie dnia | Hero bez oceny, nadwyżka od razu (4.2) |
| AU-2 suma z częściowym dniem | Odcinek „dziś w toku” w pasku tygodnia (4.3) |
| AU-12 kolejność listy | Dni od najnowszego, makro w stałej kolejności (4.4.4) |
| AU-13/BR-11 licznik | Licznik z listy (4.4) |
| AU-14 semantyka | Złoto/biały/zielony + słowa, bez czerwieni (0, 4.4.3) |
| AU-15 kolor i dostępność | Trzy kanały (6) |
| Duplikacja (analiza sekcja 1) | Jedno miejsce dla dziś (hero) i dla każdego dnia (karta) |

---

## 9. Wejście od architekta (wymagania UX wobec modelu widoku)

UX zakłada, że widok dostaje gotowe wartości. Nie liczymy % ani statusów w komponentach. Pola potrzebne do makiety (nazwy orientacyjne, decyduje `architekt`):

- **Dzień** (dziś i zamknięte): etykieta dnia i data w strefie z profilu/serwera (BR-9); typ dnia `training | rest | unknown` (BR-7); stan `in_progress | closed`; status `in_range | deviations | empty | partial | no_goal`; liczba odchyleń = liczba pozycji (BR-11).
- **Makro** (cztery na dzień i tydzień): klucz (`kcal | protein | carbs | fat`), `consumed`, `goal | null`, `remaining | null` (tylko dziś), `pct | null` (zaokrąglone raz, BR-1), `deltaPct`, `direction: under | over | in_range | none`, `isPartial`, dla tygodnia `consumedClosed`, `consumedToday`, `goalClosed`, `goalToday` (do odcinków paska).
- **Tydzień**: `daysWithEntries`, `daysInWeek`, sumy (BR-5, jedna definicja, BR-6), 7 wartości `kcalPctByDay | null` do wykresu.
- **Filtr**: liczniki per makro w tygodniu (`deviationCountByMacro`).
- **Znaczniki**: `stateAsOf` (czas ostatniego odświeżenia do banera offline).

Zasady dla frontendu wynikające z UX: brak liczenia gramów/procentów w komponentach; brak `Date` w przeglądarce do wyznaczania dziś; `null` zamiast 0 dla braku celu.

---

## 10. Decyzje pod pytania otwarte (rekomendacja UX)

### 10.1 Q-O1-Q-O5 (właściciel)

| Pytanie | Rekomendacja UX | Wpływ na ekran |
|---|---|---|
| Q-O1 próg „w normie” | Jeden próg ±5 pp dla wszystkich czterech wartości (prostsza komunikacja); |delta| < 1 jednostki zostaje jako ochrona dla małych celów | Tylko etykiety statusu; bez zmian układu |
| Q-O2 BR-3, BR-4, cel historyczny | Akceptacja BR-3 i BR-4 (dziś bez oceny niedoboru; dzień bez wpisów = `Brak wpisów`). Cel historyczny: decyzja architekta (snapshot dla spójności historii, AU-8) | Tekst „dzień w toku”, statusy |
| Q-O3 nadwyżka węgli w dzień treningowy | Neutralna (biały, „ponad cel”, dopisek „dzień treningowy”), liczona w liście, bez czerwieni. Właściciel może wyłączyć z licznika | Kolory i licznik filtra |
| Q-O4 zakres „Tydzień →” | MVP: bieżący i poprzedni tydzień ze strzałkami ‹ ›; starsze tygodnie w kolejnym zadaniu (wymaga osobnego wejścia danych i testu wydajności) | Widok tygodnia poza tym zadaniem |
| Q-O5 strefa „dziś” | Strefa z profilu (serwer), spójna z danymi; urządzenie tylko do formatowania | Brak wpływu na układ; wpływ na US-5 |

### 10.2 Odpowiedzi na 13.3 (ux)

1. **„Dziś w toku” bez oceny**: wystarczy pasek „zjedzone / cel” z „do celu zostało” (sekcja 4.2). Dodatkowy status nie jest potrzebny.
2. **Semantyka per makro**: tabela 4.4.3 (złoto niedobór, biały nadwyżka, zielony w normie; zawsze z tekstem).
3. **Zwijane karty vs cztery karty dzienne**: karty zwijane zastępują cztery karty dzienne. To jeden komponent w dwóch stanach; w stanie zwiniętym cztery mini-paski zastępują jeden ogólny (decyzja 4.4.1: osobny pasek ogólny nie jest potrzebny, bo cztery mini-kolumny już niosą stan).
4. **Stan „brak wpisów” i „niepełne dane”**: mikrokopia w sekcji 7 i 5.2 / 5.4.
5. **Filtr**: osobna sekcja „Odchylenia” pod tygodniem (nie w hero), bo dotyczy zamkniętych dni.

---

## 11. Lista zmian względem obecnego ekranu (dla `frontend`, z priorytetami)

| Pr. | Zmiana | Gdzie w kodzie (obecnie) | Powód |
|---|---|---|---|
| P1 | Usunąć dwie ścieżki prezentacji (lista `HighlightList` + karty dzienne): zastąpić sekcją „Odchylenia” i `DayBalanceCard` | `nutrition-today-view.tsx` (`HighlightList`, `DayCard`) | Duplikacja, płaska lista |
| P1 | Dziś bez „brakuje” w trakcie dnia; „do celu zostało” | `collectDayHighlights`, `MacroStatRow` | US-2, AU-3 |
| P1 | Kolor statusu bez palety Tailwind (`sky`, `rose`, `emerald`, `violet`, `amber`) i bez czerwieni dla nadwyżki | `statusTone`, `statusChip`, `MACRO_BAR` | AU-14, system (wspólne tokeny) |
| P1 | Pasek nadwyżki: odcinek za 100%, nie „ucięcie do 100 i różowy” | `MacroStatRow` (`over ? "bg-rose-400"`) | Czytelność nadwyżki |
| P1 | Kafle/wiersze bez `text-white/45|40|35`; etykiety min 11 px | cały plik | WCAG AA, system pkt 7 |
| P1 | `null` cel -> stan `brak celu`, nie `—` bez kontekstu | `MacroStatRow` | US-4, AU-5 |
| P2 | `Meter` z `overflow` i `segments` (rozszerzenie istniejącego) zamiast lokalnego paska | `MacroStatRow` | Jedna implementacja |
| P2 | Sekcja tygodnia z odcinkiem „dziś w toku” i `Explainer` | brak | AU-2 |
| P2 | `WeekTrendBars` (7 słupków) | brak | Trend, analiza sekcja 1 |
| P2 | `MacroFilterChips` i licznik zgodny z listą | brak | US-8, BR-11 |
| P2 | Nagłówek przez `AppPageHeader` (kicker, H1, meta) | obecny inline `h1` | Spójność systemu (pkt 9 sekcja 8) |
| P3 | Typ dnia (`DayTypeChip`) | brak | US-10 |
| P3 | Stany offline / szkielet / pusty start według 5 | brak | Obowiązkowe stany |

---

## 12. Makieta i weryfikacja

- Makieta: `docs/ux/006-redesign-bilansu-makro-makieta.html` (statyczna, ramki 360x640 i 390x844; stany: główny, dzień bez wpisów + brak celu, niepełne dane + offline, pusty start). Dane przykładowe, zgodne z przykładami z tej specyfikacji.
- `frontend` odwzorowuje makietę tokenami z sekcji 2; odstępstwa wymagają zgody `ux`.
- `tester` (etap 6) sprawdza: spójność z sekcją 2 i 3, brak `text-white/4x|3x` na tym ekranie, brak czerwieni dla nadwyżki, minimum 11 px, cele 44 px, aria pasków i chipów, brak przewijania poziomego na 360 px poza filtrem, zachowanie stanów z sekcji 5.

---

## 13. Werdykt etapu 4

**ZATWIERDZONE Z UWAGAMI**

Warunki implementacji (uwagi, bez tego nie wchodzimy w kod):
1. **Q-O1-Q-O3 zatwierdzone przez właściciela** (lub przyjęte rekomendacje z sekcji 10.1). Bez tego statusy i licznik odchyleń nie mają ostatecznej semantyki.
2. **Odpowiedź architekta na BR-5 (suma tygodnia dziś w toku: cel pełnego dnia vs pro-rata)** i na AU-1 (jedna definicja sumy). Układ z odcinkami (4.3) działa dla obu wariantów, ale tekst wyjaśnienia zależy od wyboru.
3. **Model widoku zgodny z sekcją 9** (architekt). Jeśli architekt wybierze wariant B (liczenie na kliencie), statusy i „dziś” muszą pochodzić z jednego źródła czasu/strefy (BR-9).
4. Uwagi niskiego ryzyka do backlogu (właściciel: `ux`): sortowanie listy odchyleń po wadze (BR-10) – decyzja w 4.4.4; wariant `md` z siatką kart dni; ujednolicenie pozostałych hexów `#DDBB6D`/`#d4af37` jest poza tym zadaniem (system, pkt 1 sekcja 8).

Po spełnieniu warunków 1-3 ux nie robi przeglądu kodu domyślnie; `tester` sprawdza zgodność wizualną (zadanie 006, etap 6). Wyjątek: niejednoznaczne odstępstwo wizualne.
