# 004 - Ekran aktywnego treningu: specyfikacja ekranu serii (A), przerwy (B), stanów i mikrokopii

Autor: ux. Data: 2026-10-24. Karta: `docs/zadania/004-ekran-aktywnego-treningu.md` (makieta v2 pkt 1-15, D-1..D-3, P-1..P-5).
Wejście: `docs/analiza/004-ekran-aktywnego-treningu.md` (US-1..US-14, BR-1..BR-13), `docs/prawo/004-ekran-aktywnego-treningu-wejscie.md` (LR-4, LR-5, LR-6, LR-8, LR-10), `docs/ux/00-system-projektowy-stan.md`, kod `components/active-workout/*`, `app/globals.css`.
Kontrakty danych (kierunek sugestii, wartość początkowa, dane `nextSet`, ujemne `onAddSeconds`) ustala ADR architekta; ten dokument określa wyłącznie to, co użytkownik widzi i jak reaguje ekran.

Makieta referencyjna (statyczna, wartości z tokenów): `docs/ux/004-ekran-aktywnego-treningu-makieta.html`. Ramki: A1-A4, B1-B3, M. Sprawdzona w Edge (Playwright): 390×844 (safe-area 47/34) i 360×640 (bez safe-area); żadna ramka A nie przewija się, B mieści się z przyciskiem przypiętym do dołu.

## 0. Kluczowe decyzje

1. **Złoto = istniejący token `--gym-gold` (#ebc44a), nie nowy hex.** Złoto z makiety (#F5C542) różni się od `--gym-gold` minimalnie (kontrast na tle 12,4 vs 12,0; ten sam odcień). Ekran wygląda dziś na „mniej złoty”, bo używa przygaszonego #D6B36A wpisanego w komponenty, a nie tokenu. Przejście na `--gym-gold` / `--gym-gold-bright` daje efekt, o który prosił użytkownik, i zachowuje spójność z resztą aplikacji. Nie zmieniamy globalnej wartości `--gym-gold` w tym zadaniu.
2. **Przycisk główny = `Button variant="cta"`** (`gym-btn-primary`): gradient złota z jaśniejszym obrysem `rgba(255,232,160,.72)` (odpowiada #FFDF7E z makiety), tekst `--neon-fg` #120f05 (kontrast 11,4:1; lepszy niż #241A03). „Popraw serię N” też jest złoty (przycisk to akcja, nie stan; zielony zostaje zarezerwowany dla stanu „zapisane”).
3. **Siedem nowych tokenów semantycznych** (sekcja 2) zamiast rozproszonych hexów i klas `emerald/orange/rose/amber`.
4. **Pominięta seria = pomarańczowa i inny kształt** (P-1, LR-6): segment pusty z pomarańczowym obrysem, pigułka z „–”. Zielony, złoty i pomarańczowy mają prawie tę samą jasność (kontrast między nimi 1,2:1), więc **każdy stan różni się kształtem**, nie tylko barwą.
5. **Szybkie przyciski ciężaru = ±2 kroki ćwiczenia, steppery −/+ = ±1 krok** (P-4). Krok z `weightStepKg` ćwiczenia; przełącznik „krok 0,5 / 2,5 / 5” znika (ukryty tryb).
6. **„+ Seria”, „Usuń”, „Notatka”, „Zgłoś”, „Nagraj technikę” i „Zakończ trening” przenoszą się do menu ☰** (dziś ☰ otwiera listę ćwiczeń; staje się „Menu treningu”). Bez tego RIR i przycisk główny nie mieszczą się bez przewijania (sekcja 4.3).
7. **Ghost w nagłówku jako jedna plakietka**; pełny HUD wyścigu przenosi się do rozwijanego panelu plakietki (dziś HUD zajmuje ok. 110 px nad treścią).
8. **Jeden wiersz „Ostatnio + sugestia”** (`SetSuggestionRow`) na ekranie A i w karcie „Następnie” na ekranie B, z jedną funkcją kierunku (BR-5, BR-6). Zastępuje `LiveCoachBanner` i blok coacha na przerwie („Uwaga.”, „Świetnie.”, emoji), które łamią LR-4.

## 1. Przepływ

```
[A: seria N]  --Zapisz serię (dane OK)-->  [B: przerwa]  --Zacznij serię/ćwiczenie / koniec odliczania-->  [A: następna seria]
     |  \--Zapisz serię (brak danych)--> A z walidacją (bez zapisu, fokus na polu)
     |--Pomiń--> [A: następna seria] (bez przerwy, jak dziś)
     |--Później--> [A: następne niezakończone ćwiczenie]
     |--☰--> [M: menu treningu] --Zakończ trening--> istniejące potwierdzenie --> podsumowanie
     \--ostatnia seria treningu--> [B: przerwa, wariant „Koniec treningu”] --Zakończ trening--> istniejący przepływ (dialog pominiętych lub podsumowanie)
```
Zachowania przejść, przerwy i synchronizacji bez zmian (`resolveAdvanceAfterSet`, `continueAfterRest`, `WorkoutAllSetsDoneDialog`).

## 2. Tokeny

Nowe zmienne dodać w `app/globals.css` w `:root` i `.dark` obok pozostałych `--gym-*`. Komponenty używają wyłącznie `var(--…)` (Tailwind: `bg-[var(--gym-success)]`, `text-[var(--gym-trend-down)]`), bez hexów.

| Token | Wartość | Rola | Kontrast (tekst) |
|---|---|---|---|
| `--gym-gold` (istnieje) | #ebc44a | akcent: kicker, bieżąca seria, licznik przerwy, wartość ciężaru, aktywny RIR, „=” | 12,0 na tle, 11,2 na karcie |
| `--gym-gold-bright` (istnieje) | #f7e28f | cyfra bieżącej pigułki, „✓ w celu”, tekst „Zakończ trening” w menu | 15,6 / 14,5 |
| `--neon-fg` (istnieje) | #120f05 | tekst na złotym (CTA, aktywny RIR, aktywny preset) | 11,4 na #ebc44a, 7,3 na `--gym-gold-deep` |
| `--destructive` (istnieje) | #ff3347 | obrys pola z błędem walidacji i kropka przy komunikacie | 5,2 na karcie (sam komunikat jest biały) |
| `--gym-black` (istnieje) | #070708 | tło ekranu A, B i menu | - |
| **`--gym-surface-gold`** | #15120b | karty: ciężar, powtórzenia, wiersz sugestii, „Następnie”, przyciski drugorzędne | - |
| **`--gym-border-gold`** | #33291a | obrysy kart i przycisków drugorzędnych (dekoracyjne; przyciski mają ikonę/tekst ≥ 3:1) | - |
| **`--gym-track`** | #2b2518 | segment „do zrobienia”, tło pierścienia, kropki listy | 1,3 na tle (świadomie: brak = brak; liczby w nagłówku i `aria-valuetext`) |
| **`--gym-success`** | #3ecf72 | seria zapisana, „ćwiczenie ✓”, karta „Zapisano” | 9,9 na tle, 9,2 na karcie, 8,8 na karcie „Zapisano” |
| **`--gym-trend-up`** | `var(--gym-success)` | sugestia zwiększenia ciężaru (↑) | jak wyżej |
| **`--gym-trend-down`** | #ff5a5a | sugestia obniżenia (↓), odcień informacyjny, nie alarmowy (LR-5) | 6,6 na tle, 6,1 na karcie, 5,5 w chipie |
| **`--gym-skipped`** | #ff9f43 | seria pominięta (P-1) | 9,9 na tle, 8,4 w pigułce |
| **`--gym-text-secondary`** | #9a9182 | tekst drugorzędny (ciepła szarość zamiast `white/45`) | 6,5 na tle, 6,0 na karcie, 4,9 na `--gym-track` |

Pochodne (bez nowych tokenów, przez `color-mix` lub `/<alpha>` Tailwinda):
- tło chipa: `--gym-trend-up` 12%, `--gym-trend-down` 10%, `--gym-gold` 10% na `--gym-surface-gold`; obrys chipa 50% (↑, =) i 65% (↓; przy 50% czerwony obrys miał 2,4:1);
- pigułka zapisana: tło `--gym-success` 14%, obrys 60%; pominięta: `--gym-skipped` 12% / 60%; bieżąca: `--gym-gold` 18% / 100%;
- karta „Zapisano”: tło `--gym-success` 10% na `--gym-black` (#0d1b13), obrys 45%.

Zasady:
- `--gym-trend-up` jest aliasem, żeby kod mówił o znaczeniu (kierunek), a nie o kolorze. Jeśli kiedyś zielony „zapisane” i zielony „w górę” się rozejdą, zmienia się jedna linia.
- Do tekstu na złotym nie dodawać `--gym-on-gold` z dokumentu 003: ta rola już istnieje jako `--neon-fg` / `--primary-foreground`. Do przekazania architektowi, aby 003 i 004 nie stworzyły dwóch tokenów o tej samej roli.
- Usuwane z plików ekranu: #D6B36A, #F0D58A, #E8C97A, #A8893F, #DDBB6D, #76D686, #0A1A0E, #121212, #0A0A0A, `emerald-*`, `orange-*`, `amber-*`, `rose-*` oraz lokalne stałe `GOLD`, `GOLD_SOFT`, `GOLD_GLOW` w `rest-break-screen.tsx`.
- Motyw: ekran zawsze ciemny (aplikacja nie ma jasnego motywu); wszystkie wartości przez zmienne, więc przyszły motyw nadpisze tylko tokeny.

Typografia (istniejące fonty, bez nowych): tytuł ćwiczenia `--font-heading` 22/26 (kompakt 20/24); liczby ciężaru i powtórzeń `.font-metric` 50/56 (kompakt 40/44), `tabular-nums`; licznik przerwy `--font-display` 76 (kompakt 60); reszta Geist: 17 (CTA, tytuł „Następnie”), 15 (tytuł dnia), 13-14 (treść, chipy, linki), 12 (meta, powód), 11 (kicker uppercase, tracking 0.16em). Minimum 11 px tylko dla kickera i meta w kompakcie. Wszystkie liczby `tabular-nums`. Liczby dziesiętne z przecinkiem („17,5”), półpauza w zakresach („6–8”), znak minus „−” w przyciskach i różnicach („−5 kg”).

## 3. Komponenty: co zostaje, co się zmienia (bez duplikatów)

| Element | Decyzja | Plik |
|---|---|---|
| Nagłówek sesji | rozszerzyć `SessionChromeHeader` o slot `badge` (plakietka Ghost) i `subtitle` z podpisanym czasem; ten sam komponent na A i B (dziś B ma własny nagłówek - usunąć kopię) | `session-chrome.tsx` |
| Pasek postępu | jeden komponent `SessionSegmentedProgress` (segmenty pogrupowane per ćwiczenie) w `session-chrome.tsx`, użyty na A i B. Zastępuje lokalne `SegmentedSessionProgress` (guided) i pasek 2 px na B. `SessionProgressBar` i `PlanProgressHeader` nie mają importów - do usunięcia (decyzja architekta) | `session-chrome.tsx` |
| Pigułki serii | zostają w `guided-session-layout.tsx`, nowy słownik stanów (sekcja 5.2) | - |
| Wiersz „Ostatnio + sugestia” | **jeden** komponent `SetSuggestionRow`, przebudowany z `LiveCoachBanner` (używany tylko na tym ekranie; plik zostaje, zmienia się nazwa eksportu i treść) i użyty na A oraz w karcie „Następnie” na B | `live-coach-banner.tsx` (lub zmiana nazwy pliku - architekt) |
| Karty ciężaru i powtórzeń | zostają (`metricCardClass`), tokeny zamiast hexów, nowy nagłówek karty | - |
| Przycisk główny | `Button variant="cta"` z `className` na wysokość i szerokość; koniec ręcznych klas `gym-btn-primary` i zielonego wariantu | `components/ui/button.tsx` |
| Dolne linki | 3 kolumny, surowe `<button>` z klasą wspólną (dziś też surowe) | - |
| Menu ☰ | istniejąca nakładka listy ćwiczeń w `guided-session-layout.tsx` rozszerzona o sekcję „Bieżące ćwiczenie” i „Zakończ trening” (`Button variant="outline"`) | - |
| Plakietka Ghost | `GhostPickerSheet` (zmiana tekstu i stanów), `GhostRaceHud` renderowany w jego panelu zamiast nad treścią | `ghost-picker-sheet.tsx`, `ghost-race-hud.tsx` |
| Przerwa | `RestBreakScreen` zostaje; pierścień `PremiumTimerRing` zostaje (tokeny, rozmiar, ruch); sekcja coacha usunięta | `rest-break-screen.tsx` |
| Notatka | `Textarea` (istnieje) w menu | `components/ui/textarea.tsx` |

Nowy komponent w katalogu: tylko `SessionSegmentedProgress` (w miejsce dwóch istniejących pasków) i `SetSuggestionRow` (w miejsce `LiveCoachBanner`). Po wdrożeniu dopisuję oba do `docs/ux/00-system-projektowy-stan.md`.

## 4. Ekran A - seria

Cel: zapisać serię jednym dotknięciem, gdy wartości są już wypełnione; widzieć, gdzie jestem w treningu i co proponuje historia.
Użytkownik: osoba między seriami, telefon w jednej ręce, często spocone palce, czytanie z ok. 40-60 cm.

### 4.1 Układ 390×844 (kolejność DOM = kolejność fokusu)

```
┌ nagłówek (stały) ───────────────────────────────────────────┐
│ [✕ 44]   Push A · klatka i barki              [☰ 44]        │ tytuł 15/18 600, biały, ucinany „…”
│          trening 24:05 · seria 8/16                          │ meta 12/16: podpisy --gym-text-secondary, liczby biel 600
│          (Ghost: wybierz rywala ▾)                           │ plakietka h 28 (pole dotyku 44)
│ ▬▬▬ ▬▬○▬ ▬█▬ ▬▬ ▬▬ ▬▬ ▬                                      │ pasek h 10 (segment 6, bieżący 10), mt 6, mb 10
├ treść (przewijalna awaryjnie, normalnie bez przewijania) ────┤ px 16, pt 12, odstęp bloków 12
│ ĆWICZENIE 3 Z 7                                  [▶ 44]     │ kicker złoty 11 uppercase; przycisk filmu tylko gdy URL
│ Wyciskanie hantli skos                                       │ 22/26 600, 1 linia, ucinana
│ 3 serie × 6–8 · RIR 1                 (✓)(2)(3)              │ schemat 13: liczby biel 600, reszta secondary; pigułki 34 w polu 40×44
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Ostatnio 30 × 8 · 5 dni temu          ( ↑ 32 × 6  ✓ )   │ │ SetSuggestionRow min-h 56, r 16
│ │ +2 kg · zakres zrobiony z zapasem                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌ Ciężar · krok 2 kg                    (−4) (+4) ────────┐ │ karta r 18, p 12/16; nagłówek h 24
│ │ 32 kg                                   [ − ] [ + ]      │ │ wartość 50/56 złota; steppery 64×52
│ └──────────────────────────────────────────────────────────┘ │
│ ┌ Powtórzenia                                   cel 6–8 ──┐ │
│ │ 6                                       [ − ] [ + ]      │ │ wartość 50/56 biała
│ └──────────────────────────────────────────────────────────┘ │
│ RIR · powtórzenia w zapasie · cel 1                          │ 13 600 / secondary
│ [ 0 ] [ 1 ] [ 2 ] [ 3+ ]                                     │ 4 kolumny, h 48, gap 8
├ dół (stały) ─────────────────────────────────────────────────┤ pt 10, pb max(8, safe-area)
│ [        ✓ Zapisz serię 2         ]                          │ CTA h 56, r 16, 17/700
│   Wstecz        Później        Pomiń                         │ 3 kolumny, min-h 44, 14/600 biel 82%
└──────────────────────────────────────────────────────────────┘
```

Szczegóły:
- **Nagłówek**: `X` i `☰` 44×44, obrys `--gym-border-gold`, tło `--gym-surface-gold`. Środek: tytuł; meta „trening m:ss · seria X/Y” (BR-4: X = numer bieżącej serii w całej sesji, Y = wszystkie serie; dla czasu ≥ 60 min „1:02:15”); plakietka Ghost (sekcja 8). Wiersz „A/B serii · C/D ćw.” usunięty.
- **Pasek**: sekcja 5.1.
- **Nagłówek ćwiczenia**: kicker „Ćwiczenie N z M” (uppercase przez CSS, w DOM zwykły tekst) + opcjonalnie „ · Superseria A” złotem; nazwa; wiersz: schemat po lewej, pigułki po prawej. Schemat budowany z istniejących części: „3 serie × 6–8”, „RIR 1”, „tempo 3-1-1”, łączone „ · ”; części bez danych pomijane. Przycisk filmu (`Play`) tylko przy `techniqueYoutubeUrl`. „Nagraj technikę” przenosi się do menu.
- **Przepełnienie wiersza pigułek**: gdy schemat i pigułki nie mieszczą się w jednej linii (np. 5+ serii na 360 px), schemat przechodzi do osobnej linii nad pigułkami; powyżej 8 serii pigułki przewijają się poziomo (`chip-scroll`), bieżąca jest przewijana do widoku.
- **Wiersz sugestii**: sekcja 5.3.
- **Karta ciężaru**: etykieta „Ciężar” + „· krok 2 kg” (secondary); po prawej dwa szybkie przyciski „−4” i „+4” (±2 kroki; widoczne 32×≥56, pole dotyku 44 przez ujemny margines jak dziś). Wartość: `input` z wartością (BR-7, nie placeholder), jednostka „kg” 14/600 złota 85%. Steppery „−” „+” = ±1 krok. Granice 0-999 jak dziś.
- **Karta powtórzeń**: etykieta; po prawej znacznik celu: „✓ w celu 6–8” (`--gym-gold-bright`, gdy w zakresie) albo „cel 6–8” (secondary, gdy poza; bez czerwieni - poniżej celu to nie błąd). Brak celu w planie - brak znacznika.
- **RIR**: etykieta „RIR” + „· powtórzenia w zapasie · cel 1” (brak celu: „· powtórzenia w zapasie · opcjonalnie”). Pigułki 0/1/2/3+; aktywna = styl CTA (`gym-btn-primary` w małej skali) + `aria-pressed="true"`; nieaktywne: tło `--gym-black`, obrys `--gym-border-gold`, cyfra biel 80%.
- **Dół**: CTA zawsze „Zapisz serię N” / „Popraw serię N” z ikoną `Check`. Linki: „Wstecz”, „Później”, „Pomiń”.

### 4.2 Wariant kompaktowy (360×640 i każdy ekran o wysokości < 720 px)

Warunek: `@media (max-height: 719px)` (wariant Tailwinda `[@media(max-height:719px)]:` lub `@custom-variant compact` w `globals.css` - decyzja frontend/architekt; jedna definicja). Szerokość nie jest warunkiem, bo problemem jest wysokość.

Co się zwija (w tej kolejności priorytetu):
1. Karty ciężaru i powtórzeń: padding 8/14, nagłówek 20, wartość 40/44, steppery 56×44.
2. Odstępy bloków treści 12 → 8, padding treści 8.
3. Wiersz sugestii: min-h 44, l1 12/15, l2 11/14.
4. RIR: pigułki 48 → 44, odstęp 6; etykieta skrócona do „RIR · w zapasie · cel 1”.
5. Tytuł ćwiczenia 20/24; tytuł dnia 14/17; meta 11/14; plakietka Ghost h 24 (pole dotyku nadal 44).
6. CTA 56 → 52; padding dołu 8/4.
Nigdy się nie zwija: cele dotyku ≥ 44 px, linki dolne 44, tekst ≥ 11 px, powód sugestii (zawija się do 2 linii, nie jest ucinany w środku znaczenia).
Ostatnia linia obrony: treść środkowa ma `overflow-y: auto` (jak dziś), ale przy budżecie z 4.3 nie powinna się przewijać. Nagłówek i dół są poza obszarem przewijania, więc CTA jest zawsze widoczny.

### 4.3 Budżet wysokości (zmierzone na makiecie)

| Strefa | 390×844 (763 po safe-area) | 360×640 kompakt |
|---|---|---|
| nagłówek + plakietka + pasek | 104 | 92 |
| treść: ćwiczenie, sugestia, ciężar, powtórzenia, RIR | 518 (wolne 12) | 424 (wolne 0-4) |
| dół: CTA + linki | 122 | 108 |
Wniosek: rząd „+ Seria / Usuń / Notatka / Zgłoś” (56 px) i HUD Ghost (ok. 110 px) nie mieszczą się na żadnej z szerokości - stąd przeniesienie do menu i panelu plakietki (decyzje 6 i 7). Komunikaty walidacji nie zmieniają wysokości (5.4).

### 4.4 Interakcje A
- Tap CTA z poprawnymi danymi: `hapticTap`, zapis, przejście jak dziś. `onMouseDown preventDefault` zostaje (blur pola nie może zepsuć zapisu). Dwa szybkie tapnięcia = jeden zapis.
- Tap w pigułkę: przełącza edytowaną serię (jak dziś). Pigułka zapisana otwiera „Popraw serię N”.
- Tap w lewą część wiersza sugestii („Ostatnio …”): wstawia ciężar i powtórzenia z poprzedniego treningu (dawne „Powtórz bazę”). Tap w chip: wstawia sugestię. Żadne nie zapisuje serii.
- Edycja pola: klawiatura numeryczna (`inputMode="decimal"` / `"numeric"`); pole wybiera całą zawartość przy fokusie, żeby wpisanie nadpisało wartość jednym ruchem.
- Steppery: powtarzanie przy przytrzymaniu nie jest wymagane (bez zmian).
- „Wstecz” na pierwszej serii pierwszego ćwiczenia: wyłączony. „Pomiń” na serii zapisanej: wyłączony. Wyłączone linki: `disabled`, krycie 38%.

## 5. Elementy wspólne A i B

### 5.1 Pasek segmentów `SessionSegmentedProgress`
- Segment = seria; grupy = ćwiczenia; szerokość grupy proporcjonalna do liczby serii (`flex-grow` = liczba serii). Odstęp w grupie 2 px, między grupami 6 px. Gdy serii > 32: 1 px i 4 px. Min. szerokość segmentu 2 px. Mieści 60 serii w 320 px bez przewijania.
- Wysokość wiersza 10 px; segmenty 6 px, wyśrodkowane w pionie.

| Stan | Wygląd | Kształt (niezależnie od koloru) |
|---|---|---|
| do zrobienia | `--gym-track` | niski (6 px), pełny |
| bieżąca | `--gym-gold` | **wyższy (10 px)** |
| zapisana | `--gym-success` | niski, pełny |
| pominięta | przezroczysty środek, obrys wewnętrzny 1,5 px `--gym-skipped` | **pusty w środku** |
| bieżąca i zapisana (poprawiana) | `--gym-success`, 10 px, pierścień 1,5 px `--gym-gold` z odstępem 1,5 px | wyższy + pierścień |
| bieżąca i pominięta | obrys `--gym-skipped`, 10 px | wyższy + pusty |
| ćwiczenie zaliczone (wszystkie serie zapisane, bez pominięć, BR-3) | segmenty grupy łączą się w jeden ciągły zielony pasek (odstęp 0, zaokrąglone tylko końce) | **ciągła belka** |
| ćwiczenie z pominięciem | segmenty osobno: zielone + pomarańczowy pusty | przerwy w grupie |

- Dostępność: kontener `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=Y`, `aria-valuenow=zapisane`, `aria-valuetext="Zapisano 6 z 16 serii, pominięto 1"` (bez „pominięto 0”). Segmenty `aria-hidden`. Pominięte nie liczą się jako zapisane (P-5).
- Ruch: zmiana koloru `transition-colors 200ms`, `motion-reduce:transition-none`. Bez poświaty (`shadow-[0_0_8px…]` usunąć).

### 5.2 Pigułki serii
Koło 34 px w polu 40×44, `role="tab"` w `role="tablist" aria-label="Serie ćwiczenia"` (jak dziś), `aria-selected` dla edytowanej.

| Stan | Wygląd | Zawartość | `aria-label` |
|---|---|---|---|
| do zrobienia | tło `--gym-surface-gold`, obrys `--gym-border-gold`, cyfra biel 80% | numer | „Seria 3, do zrobienia” |
| bieżąca | tło złoto 18%, obrys `--gym-gold`, cyfra `--gym-gold-bright`, pierścień 2 px `--gym-gold` z odstępem 2 px | numer | „Seria 2, bieżąca” |
| zapisana | tło zieleń 14%, obrys 60%, ikona `Check` 16 `--gym-success` | ✓ | „Seria 1, zapisana: 30 kg × 8” |
| pominięta | tło pomarańcz 12%, obrys 60%, ikona `Minus` 16 `--gym-skipped` | – | „Seria 2, pominięta” |
| zapisana + edytowana | jak zapisana + złoty pierścień | ✓ | „Seria 1, zapisana: 30 kg × 8, edytujesz” |
| pominięta + edytowana | jak pominięta + złoty pierścień | – | „Seria 2, pominięta, edytujesz” |

### 5.3 Wiersz „Ostatnio + sugestia” `SetSuggestionRow`
Karta `--gym-surface-gold`, obrys `--gym-border-gold`, r 16, min-h 56 (kompakt 44), padding 6/6/6/12. Lewa część (przycisk, min-h 44): linia 1 „Ostatnio 30 × 8 · 5 dni temu” (13/17, liczby biel, „· 5 dni temu” secondary), linia 2 (12/16, secondary): różnica w kolorze kierunku + powód. Prawa część: chip sugestii h 44, r pełne, 14/600.

Kierunek (BR-5, jedna funkcja z ADR; tolerancja 0,01 kg):

| Kierunek | Chip | Linia 2 | `aria-label` chipa |
|---|---|---|---|
| ↑ zwiększenie | obrys `--gym-trend-up` 50%, tło 12%; ikona `ArrowUp` 16 + ciężar w `--gym-trend-up`, „× 6” biel | „**+2 kg**” w `--gym-trend-up` + „ · zakres zrobiony z zapasem” | „Sugestia: więcej, 32 kg, 6 powtórzeń. Wstaw” |
| ↓ obniżenie | obrys `--gym-trend-down` 65%, tło 10%; `ArrowDown` + ciężar w `--gym-trend-down` | „**−5 kg**” w `--gym-trend-down` + „ · lżej po dłuższej przerwie” | „Sugestia: lżej, 15 kg, 5 powtórzeń. Wstaw” |
| = utrzymanie | obrys `--gym-gold` 45%, tło 10%; `Equal` + ciężar w `--gym-gold` | „ten sam ciężar · +1 powt.” (bez koloru) | „Sugestia: ten sam ciężar, 65 kg, 12 powtórzeń. Wstaw” |
| zastosowana (pola = sugestia) | jak wyżej + `Check` 12 `--gym-gold-bright` na końcu, `aria-pressed="true"` | bez zmian | „… Wstawiono” |

- Format w chipie i w „Ostatnio”: „32 × 6” bez „kg” (spójnie z „Ostatnio 30 × 8”; jednostka jest w linii 2 i w polu ciężaru). Pełne jednostki w `aria-label`.
- Kolorowany jest tylko ciężar i różnica; powód zawsze neutralny (secondary). Bez ikon ostrzeżenia, wykrzyknika, emoji (LR-5).
- Lewa część `aria-label`: „Wstaw wartości z ostatniego treningu: 30 kg, 8 powtórzeń, 5 dni temu”.
- Gdy BR-7 wypełnił pole sugestią, chip startuje jako „zastosowana”; tap w „Ostatnio” przywraca poprzedni trening, a chip traci ✓.

Krótkie powody (prezentacja według `rule` silnika; silnik bez zmian - D-3; mapowanie w jednym miejscu obok funkcji kierunku, decyzja architekta). Dzisiejsze teksty silnika („stagnacja — deload…”, „zejdź z ciężarem”) nie trafiają na ekran, bo są trybem rozkazującym lub oceniające:

| `rule` | Powód na ekranie |
|---|---|
| `top_of_range_easy` | zakres zrobiony z zapasem |
| `top_of_range_reps_only` | 2 treningi na górze zakresu |
| `in_range_add_reps` | ten sam ciężar, +1 powt. |
| `layoff_reduce` | lżej po dłuższej przerwie |
| `stagnation_deload` | lżej, nowy cykl zakresu |
| `below_range_or_hard` | lżej, ostatnio bez zapasu |
| inny / brak | na podstawie ostatnich serii |

Warianty danych:

| Dane | Wiersz |
|---|---|
| historia + sugestia | jak wyżej |
| historia, brak sugestii | linia 1 „Ostatnio 30 × 8 · 5 dni temu”, linia 2 „Dotknij, aby wstawić”; bez chipa |
| sugestia, brak historii tej serii | linia 1 „Sugestia na tę serię”, linia 2 powód; chip zawsze „=” (brak punktu odniesienia, BR-5) |
| brak historii i sugestii (pierwszy raz) | nieinteraktywny: „Pierwsza seria tego ćwiczenia” / „Wpisz ciężar, z którym zaczynasz” |
| `daysSinceLastSession` ≥ 7 lub brak | bez „· N dni temu” (jak dzisiejsze `daysAgoLabel`); „dziś”, „wczoraj”, „N dni temu” |

### 5.4 Walidacja (BR-8, P-2)
- Wyzwalacz: tap „Zapisz serię”/„Popraw serię” przy ciężarze ≤ 0 lub powtórzeniach ≤ 0. Seria nie jest zapisywana, ekran nie przechodzi dalej, brak wibracji.
- Karta pola dostaje obrys 1 px `--destructive`, `input` `aria-invalid="true"` i `aria-describedby` na komunikat.
- Komunikat zastępuje prawą stronę nagłówka karty (szybkie przyciski albo znacznik celu), więc układ nie skacze: kropka 8 px `--destructive` + tekst biały 13/600 (`role="alert"` na kontenerze istniejącym w DOM przed błędem).
- Teksty: „Podaj ciężar”, „Podaj liczbę powtórzeń”. Oba braki: oba komunikaty, fokus na ciężarze.
- Fokus programowy na pierwszym polu z błędem; klawiatura się otwiera.
- Komunikat znika, gdy wartość w polu > 0 (bez czekania na kolejny tap).
- „Popraw serię N” z błędnymi danymi: to samo; zapisane wcześniej wartości zostają w serii.
- „Pomiń” działa zawsze (bez walidacji, BR-11).

## 6. Stany ekranu A

| Stan | Co widać (różnice względem 4.1) | Makieta |
|---|---|---|
| seria bieżąca, dane wypełnione | CTA „Zapisz serię N”, pigułka bieżąca, chip „zastosowana” | A1, A2 |
| seria poprawiana (zapisana, otwarta ponownie) | pigułka zielona z pierścieniem, segment zielony 10 px z pierścieniem, CTA „Popraw serię N”, „Pomiń” wyłączony. Zmiana wartości bez tapnięcia CTA nie zmienia stanu serii | A4 |
| walidacja | 5.4 | A3 |
| sugestia ↑ / ↓ / = | 5.3 | A1 / A4 / tabela |
| brak historii (pierwszy raz) | wiersz „Pierwsza seria tego ćwiczenia”, pole ciężaru puste z placeholderem „0” w bieli 30% | A3 |
| brak celu RIR | żadna pigułka RIR nieaktywna, etykieta „· opcjonalnie”; schemat bez „RIR” | A3 |
| brak celu powtórzeń | brak znacznika celu; schemat „3 serie” | - |
| Ghost niewybrany / wybrany | sekcja 8 | A1 / A4 |
| ostatnia seria ćwiczenia | bez zmian na A (CTA „Zapisz serię 3”); po zapisie B z „ćwiczenie ✓” albo bez, gdy były pominięcia | B2 |
| ostatnia seria treningu | bez zmian na A; po zapisie B w wariancie „Koniec treningu” | B3 |
| superseria | kicker „Ćwiczenie 3 z 7 · Superseria A” | - |
| powrót do pominiętej (z dialogu) | edytowana pigułka pominięta z pierścieniem, CTA „Zapisz serię N” | - |
| wznowienie treningu / drugie urządzenie | zapisane serie zielone, bieżąca = pierwsza niezapisana, pola z wartościami z chmury (BR-7 pkt 1) | - |
| ładowanie | ekran powstaje ze stanu lokalnego (store), bez szkieletu. Wczytywanie sesji przed wejściem na ekran: istniejący stan `active-workout-view` bez zmian | - |
| offline | bez komunikatu: zapis działa lokalnie (BR-13). Jedyna funkcja sieciowa to lista rywali Ghost (sekcja 8) | - |
| błąd | brak nowych błędów sieciowych; błąd renderowania obsługuje istniejąca granica `error.tsx` | - |
| brak uprawnień | nie dotyczy (ekran własnego treningu) | - |
| brak ćwiczeń w sesji | jak dziś: „Brak ćwiczeń w sesji.” (tekst w `--gym-text-secondary`) | - |
| sukces | zapis = przejście na B z zieloną kartą „Zapisano”; bez modalnego `useSaveFeedback` | B1 |

## 7. Ekran B - przerwa

Cel: potwierdzić zapis, odpocząć, przygotować sprzęt do następnej serii.

### 7.1 Układ 390×844

```
┌ nagłówek: ten sam SessionChromeHeader + plakietka Ghost + pasek (zapisana seria już zielona) ┐
├ treść ─────────────────────────────────────────────────────────┤ px 16, pt 12, odstęp 12
│ ┌ (✓) Zapisano                              [ćwiczenie ✓] ┐    │ karta „Zapisano”: min-h 52, r 16
│ │     32 kg × 6 · RIR 1                                     │    │ linia 1 12/16 600 zielona; linia 2 16/20 600 biała, ciężar×powt. zielone
│ └───────────────────────────────────────────────────────────┘    │
│                  ◯  1:12  ◯                                     │ pierścień min(54vw, 28dvh, 224px); cyfry --font-display 76 złote
│                    PRZERWA                                      │ 11 uppercase secondary
│           [ −15 s ] [ +30 s ] [🔊]                              │ h 44, min-w 76; dźwięk 44×44
│  [ 60 s ] [ 90 s ] [ 2 min ] [ 3 min ]                          │ presety h 40 (pole 44), aktywny złoty
│ ┌ NASTĘPNIE ────────────────────────────────────────────────┐   │ karta --gym-surface-gold r 18 p 12
│ │ Seria 3 z 3 · Wyciskanie hantli skos                      │   │ 17 600 biała
│ │ cel 6–8 · RIR 1                                           │   │ 13 secondary
│ │ [ SetSuggestionRow na tle --gym-black ]                   │   │
│ └───────────────────────────────────────────────────────────┘   │
├ dół ────────────────────────────────────────────────────────────┤
│ [          ▶ Zacznij serię 3           ]                        │ Button variant="cta" h 56
└─────────────────────────────────────────────────────────────────┘
```

- **Karta „Zapisano”** (`role="status"`): ikona: koło 28 `--gym-success` z `Check` w #06210f (kontrast 8,4:1). Linia 1 „Zapisano”, linia 2 wartości. Plakietka „ćwiczenie ✓” (obrys zieleń 50%, tekst zielony 12/700) tylko gdy ćwiczenie jest zaliczone wg BR-3. Masa ciała poza zakresem (P-2), więc wariant „12 powt.” nie występuje w tym zadaniu.
- **Pierścień**: tor `--gym-track`, łuk `--gym-gold` (bez gradientu i filtra `feGaussianBlur`; prostszy, wyraźniejszy). Liczba `--gym-gold`. W ostatnich 10 s liczba przechodzi na `--gym-gold-bright` (zmiana jasności, nie pulsowanie).
- **−15 s / +30 s**: dolna granica 0 s (−15 przy 0:10 daje 0:00 i koniec przerwy), górna jak dziś. `aria-label` „Skróć przerwę o 15 sekund” / „Wydłuż przerwę o 30 sekund”. Dziś `onAddSeconds` przyjmuje tylko wartości dodatnie - zmiana w ADR.
- **Dźwięk**: przycisk ikonowy 44×44 (`Volume2`/`VolumeX`), `aria-pressed`, `aria-label` „Sygnał końca przerwy: włączony” / „wyłączony”. Wibracja na koniec wyłącznie przez istniejący `hapticRestEnd` (LR-7), bez nowego ustawienia.
- **Presety**: zostają (zapisują domyślny czas jak dziś), etykiety „60 s”, „90 s”, „2 min”, „3 min”, aktywny: `--gym-gold` + `--neon-fg`, `aria-pressed`.
- **„Następnie”**: kicker „Następnie” (kolejna seria tego ćwiczenia) albo „Następnie · ćwiczenie 4 z 7”; tytuł „Seria 3 z 3 · <nazwa>” lub nazwa ćwiczenia; schemat; `SetSuggestionRow` z tym samym słownikiem kolorów (BR-6). Bez historii: bez wiersza sugestii. Usuwamy: „🎯 Cel: …”, emoji, blok coacha „Uwaga./Trzymaj./Świetnie.”.
- **CTA**: „Zacznij serię N” (kolejna seria tego ćwiczenia) / „Zacznij ćwiczenie N” (pierwsza seria następnego; N = numer ćwiczenia w planie) z ikoną `Play`. Fokus programowy na CTA po otwarciu przerwy (jak dziś).
- Nazwa ćwiczenia pod licznikiem („Przerwa · Teres Pulldown”) znika - jest w „Następnie”.

### 7.2 Kompakt 360×640
Pierścień `min(54vw, 28dvh, 224px)` daje ok. 179 px; cyfry 60; karta „Zapisano” min-h 44 (15/18 i 11/14); odstępy 8; „Następnie” p 10/12, tytuł 16; CTA 52. Powód sugestii może zawinąć się do 2 linii. Zmierzone: mieści się z zapasem ok. 20 px (B2).

### 7.3 Stany B

| Stan | Co widać | Makieta |
|---|---|---|
| zwykła przerwa | jak 7.1 | B1 |
| ostatnia seria ćwiczenia, ćwiczenie zaliczone | „ćwiczenie ✓”, grupa w pasku jako ciągła zielona belka, „Następnie · ćwiczenie N z M”, CTA „Zacznij ćwiczenie N”; `hapticExerciseDone` jak dziś | B2 |
| ostatnia seria ćwiczenia z pominięciem w tym ćwiczeniu | bez „ćwiczenie ✓”, grupa z pomarańczowym pustym segmentem | - |
| ostatnia seria treningu | karta „Następnie” zastąpiona kartą: kicker „Koniec treningu”, tytuł „Wszystkie serie za tobą”, linia „Zapisano 15 z 16 serii · 1 pominięta” (bez pominięć: „Zapisano 16 z 16 serii”). CTA „Zakończ trening” (bez ikony `Play`) - wywołuje istniejące `continueAfterRest` (dialog pominiętych albo podsumowanie). Licznik działa dalej (można odpocząć przed zamknięciem) | B3 |
| następne ćwiczenie bez historii | „Następnie” bez wiersza sugestii | - |
| przerwa skończyła się w tle | po powrocie licznik 0:00, łuk pusty, CTA bez zmian (zachowanie liczenia od znacznika czasu bez zmian) | - |
| ograniczony ruch | patrz sekcja 11 | - |

## 8. Plakietka Ghost (D-1, LR-8)

Miejsce: trzecia linia środka nagłówka na A i B (nie w treści). Widoczna h 28 (kompakt 24), pole dotyku 44, r pełne, ikona `Ghost` (lucide) 14, tekst 12/600, `ChevronDown` 14. Zawsze widoczna (nie wiemy bez zapytania, czy rywale istnieją, a LR-9 zabrania nowych wywołań sieciowych przy wejściu na ekran).

| Stan | Plakietka | `aria-label` |
|---|---|---|
| nie wybrano rywala | „Ghost: wybierz rywala”; obrys złoto 38%, tło 8%, tekst `--gym-gold` | „Ghost: wybierz rywala do wyścigu. Twój trening zapisuje się normalnie” |
| wybrano, wynik liczy się | „Ghost: wygrywasz” / „Ghost: łeb w łeb” / „Ghost: rywal prowadzi”; obrys `--gym-gold`, tło 16% | „Wyścig Ghost z: <sourceLabel>. <wynik>. Pokaż szczegóły” |
| wybrano, przed pierwszym wyliczeniem | „Ghost: <sourceLabel>” (np. „Ghost: Ty”, „Ghost: Znajomy”) | j.w. |

Kolor plakietki nie zmienia się z wynikiem (zawsze złoty) - wyścig to zabawa, bez czerwonej presji. `aria-expanded` przy otwartym panelu.

Panel (rozwijany pod plakietką, istniejący element `GhostPickerSheet`; tło `--gym-surface-gold`, obrys `--gym-border-gold`, r 18, max-h 320, `Escape` zamyka, fokus wraca na plakietkę):
- **Bez rywala**: tytuł „Wybierz rywala” (zamiast „Wybierz ducha”), opis jednym zdaniem: „Ścigasz się z wcześniejszym treningiem. Twój dzisiejszy trening zapisuje się tak samo.” Lista opcji jak dziś (`label`, `subtitle`, wiersze min-h 52). Zakres danych rywala bez zmian (LR-8 d, e).
- **Ładowanie**: 2 wiersze szkieletu h 52 (`animate-pulse`, `motion-reduce:animate-none`) zamiast „Ładowanie…”.
- **Pusto**: „Brak treningu do wyścigu. Gdy ukończysz ten plan, pojawi się tutaj.” (zamiast „Brak dostępnych treningów (self / znajomi / lider).” - angielskie słowa i żargon).
- **Błąd / offline**: „Nie udało się wczytać rywali. Sprawdź połączenie i spróbuj ponownie.” + `Button variant="outline" size="sm"` „Spróbuj ponownie”. Wymaga rozróżnienia błędu od pustej listy (dziś `catch` daje pustą listę) - do ADR.
- **Z rywalem**: `GhostRaceHud` (przeniesiony z treści, bez zmian danych) + przyciski „Zmień rywala” (`outline`) i „Wyłącz Ghost” (`ghost`). Kolory wyniku w HUD: `--gym-trend-up` / `--gym-trend-down` / `--gym-gold` zamiast `emerald-300` / `rose-300`; wynik zawsze z tekstem (`predictedLabel`). Tekst „Ghost był na: …” zostaje (zakres jak dziś).
- Tekst „bez zapisu” znika z całej aplikacji (LR-8 a).

## 9. Menu treningu ☰

Ta sama pełnoekranowa nakładka co dziś (lista ćwiczeń), ze zmianami:
- Nagłówek: kicker „Menu treningu” (złoty), tytuł dnia 24/1.1, przycisk zamknięcia 44 (`aria-label` „Zamknij menu”). Przycisk ☰ w nagłówku sesji: `aria-label` „Menu treningu”, `aria-haspopup="dialog"`.
- Lista ćwiczeń (bez zmian zachowania): nazwa zaliczonego ćwiczenia w `--gym-success` z prefiksem „✓” (kształt, nie tylko kolor); bieżące w `--gym-gold` z tłem złoto 8% i podpisem „teraz · …”; kropki serii w słowniku z 5.1 (zapisana pełna zielona, pominięta pusta pomarańczowa, do zrobienia `--gym-track`). `emerald-400`/`orange-400` zastąpione tokenami.
- Sekcja „Bieżące ćwiczenie” (nagłówek 11 uppercase secondary): siatka 2 kolumn, przyciski min-h 44: „+ Dodaj serię”, „Usuń ostatnią serię” (tylko gdy serii > 1), „Notatka” (rozwija `Textarea` pod siatką, placeholder „Notatka do ćwiczenia…”), „Nagraj technikę” (link `/technique`), „Zgłoś problem z ćwiczeniem” (pełna szerokość, dzisiejsze `mailto`). Akcje działają jak dziś i zamykają menu, z wyjątkiem „Notatka”.
- Na dole, poza przewijaną listą: `Button variant="outline"` pełnej szerokości h 48 „Zakończ trening”; w trakcie: wyłączony, „Kończenie…”. Wywołuje dzisiejsze `flushDraft()` + `onFinishSession` z tym samym potwierdzeniem (LR-9). Kolor złoty, nie czerwony: zakończenie zapisuje trening, nie jest destrukcyjne.
- Fokus: po otwarciu na przycisku zamknięcia; pułapka fokusu w nakładce; `Escape` i systemowe „wstecz” (Android) zamykają menu jak dziś.

## 10. Mikrokopia (PL)

| Miejsce | Tekst |
|---|---|
| meta nagłówka | „trening 24:05 · seria 8/16” |
| kicker | „Ćwiczenie 3 z 7”, „Ćwiczenie 3 z 7 · Superseria A” |
| schemat | „3 serie × 6–8 · RIR 1”, „1 seria × 10”, „5 serii × 5” (odmiana: 1 seria, 2-4 serie, 5+ serii; 12-14 serii; istniejące `plSeries` poprawić: 22-24 serie, dziś „serii”) |
| wiersz sugestii | „Ostatnio 30 × 8 · 5 dni temu”, „+2 kg · zakres zrobiony z zapasem”, „−5 kg · lżej po dłuższej przerwie”, „ten sam ciężar, +1 powt.”, „Sugestia na tę serię”, „Dotknij, aby wstawić”, „Pierwsza seria tego ćwiczenia”, „Wpisz ciężar, z którym zaczynasz” |
| karta ciężaru | „Ciężar · krok 2 kg”, „−4”, „+4”, „kg” |
| karta powtórzeń | „Powtórzenia”, „✓ w celu 6–8”, „cel 6–8” |
| RIR | „RIR · powtórzenia w zapasie · cel 1”, „· opcjonalnie”, „3+” |
| walidacja | „Podaj ciężar”, „Podaj liczbę powtórzeń” |
| CTA A | „Zapisz serię 2”, „Popraw serię 1” |
| linki A | „Wstecz”, „Później”, „Pomiń” |
| karta zapisu | „Zapisano” / „32 kg × 6 · RIR 1”, „ćwiczenie ✓” |
| przerwa | „przerwa”, „−15 s”, „+30 s”, „60 s”, „90 s”, „2 min”, „3 min” |
| następnie | „Następnie”, „Następnie · ćwiczenie 4 z 7”, „Seria 3 z 3 · Wyciskanie hantli skos” |
| koniec | „Koniec treningu”, „Wszystkie serie za tobą”, „Zapisano 15 z 16 serii · 1 pominięta”, CTA „Zakończ trening” |
| CTA B | „Zacznij serię 3”, „Zacznij ćwiczenie 4” |
| Ghost | „Ghost: wybierz rywala”, „Ghost: wygrywasz”, „Ghost: łeb w łeb”, „Ghost: rywal prowadzi”, „Wybierz rywala”, „Ścigasz się z wcześniejszym treningiem. Twój dzisiejszy trening zapisuje się tak samo.”, „Brak treningu do wyścigu. Gdy ukończysz ten plan, pojawi się tutaj.”, „Nie udało się wczytać rywali. Sprawdź połączenie i spróbuj ponownie.”, „Zmień rywala”, „Wyłącz Ghost” |
| menu | „Menu treningu”, „Bieżące ćwiczenie”, „+ Dodaj serię”, „Usuń ostatnią serię”, „Notatka”, „Nagraj technikę”, „Zgłoś problem z ćwiczeniem”, „Zakończ trening”, „Kończenie…” |

Zakazane na tym ekranie (LR-4, LR-10): „Uwaga”, „Świetnie”, „Trzymaj”, „błąd”, „niepoprawne”, „za mało”, „słabo”, „nadrób”, „porażka”, „zejdź”, „stagnacja”, „szybciej”, „nie poddawaj się”, emoji (🔥 ⚠️ 📌 💡 🎯), ikony ostrzeżeń przy sugestii. Mikrokopię przed publikacją zatwierdza prawnik-człowiek (bramka prawna 004).

## 11. Dostępność (WCAG 2.2 AA)

- **Kolor nie jest jedynym nośnikiem (1.4.1)**: stany serii - kształt segmentu (wysoki / pusty / ciągła belka) i ikona pigułki (numer / ✓ / –); kierunek sugestii - ikona `ArrowUp` / `ArrowDown` / `Equal` + znak „+” / „−” + słowa „więcej / lżej / ten sam” w `aria-label`; walidacja - tekst komunikatu; aktywny RIR - wypełnienie + `aria-pressed`.
- **Kontrast (1.4.3, 1.4.11)**: wszystkie teksty ≥ 4,5:1 (tabela w sekcji 2; najniższy: secondary na `--gym-track` 4,9, czerwony w chipie 5,5). Ikony i obrysy interaktywne ≥ 3:1 (obrysy chipów 3,1+; steppery rozpoznawalne po ikonie 13:1). Nie używać `text-white/45`, `/40`, `.app-label` dla treści.
- **Cele dotyku**: wszystkie ≥ 44×44 (steppery 64×52 / 56×44, CTA 56/52, linki 44, pigułki 40×44, plakietka i szybkie przyciski 44 przez pole dotyku, RIR 48/44). Odstęp między sąsiednimi celami ≥ 8 px albo stykające się pola bez nakładania.
- **Komunikaty statusu (4.1.3)**: walidacja `role="alert"`; karta „Zapisano” `role="status"`; licznik przerwy: `role="timer"` z `aria-live="off"` i ogłaszaniem tylko przy 0:30, 0:10 i końcu („Koniec przerwy”) przez osobny `aria-live="polite"` (dziś `aria-live` co sekundę zalewa czytnik).
- **Etykiety**: `input` ciężaru i powtórzeń z `<label>`; steppery „Zmniejsz ciężar o 2 kg”, „Zwiększ ciężar o 2 kg”, szybkie „Zmniejsz ciężar o 4 kg”, „Zwiększ ciężar o 4 kg”, „Mniej powtórzeń”, „Więcej powtórzeń”; RIR „RIR 1, powtórzenia w zapasie”; linki „Wróć do poprzedniej serii”, „Odłóż ćwiczenie na później”, „Pomiń serię 2”; przycisk filmu „Film techniki: <nazwa>” (dziś „Technika”); nagłówek meta `aria-label` „Trening trwa 24 minuty 5 sekund, seria 8 z 16” (bez `aria-live`).
- **Fokus**: kolejność DOM = wizualna (nagłówek, pasek, ćwiczenie, pigułki, sugestia, ciężar, powtórzenia, RIR, CTA, linki). Widoczny pierścień fokusu z istniejącego `:focus-visible` / `Button`. Po zapisie fokus na CTA przerwy; po powrocie z przerwy fokus na CTA ekranu A (bez otwierania klawiatury).
- **Powiększenie tekstu do 200%**: treść środkowa przewija się, nagłówek i dół zostają; nic nie jest ucinane poza tytułami z `…` i pełną nazwą w `title`/`aria-label`.
- **Prywatność**: ekran nie pokazuje nowych danych o ciele; wartości treningowe nie trafiają do logów ani Sentry (LR-1) - dotyczy też komunikatów walidacji.

## 12. Ruch

- Bez nowych animacji framer-motion. Zmiany kolorów segmentów i pigułek 200 ms; `motion-reduce:transition-none`.
- Pierścień przerwy: dziś `requestAnimationFrame` 60 fps + pulsowanie `rest-ring-pulse` w pętli. Docelowo: łuk aktualizowany co sekundę z `transition: stroke-dashoffset 1s linear`; pulsowanie usunięte. Przy `prefers-reduced-motion: reduce` łuk zmienia się skokowo bez przejścia.
- Przycisk `active:scale` tylko poza `prefers-reduced-motion`.
- Przejście A ↔ B: bez animacji (jak dziś, portal).

## 13. Lista kontrolna spójności (dla `tester`) i wzorce zrzutów

1. Brak hexów z listy w sekcji 2 w `guided-session-layout.tsx`, `rest-break-screen.tsx`, `session-chrome.tsx`, `live-coach-banner.tsx`, `ghost-picker-sheet.tsx`, `ghost-race-hud.tsx`; brak klas `emerald-*`, `orange-*`, `amber-*`, `rose-*`.
2. Jeden pasek segmentów i jeden wiersz sugestii używane na A i B (ten sam komponent, nie kopia).
3. Przycisk główny A i B to `Button variant="cta"`; nigdzie „Pomiń serię” na CTA.
4. Cele dotyku ≥ 44 px w obu wariantach wysokości.
5. 390×844 i 360×640: RIR i CTA widoczne bez przewijania na A (stany A1-A4); na B CTA widoczny zawsze.
6. Stany 5.1 i 5.2 rozróżnialne w trybie skali szarości (symulacja w DevTools).
7. Brak tekstu „bez zapisu”, emoji i słów z listy zakazanej.
Wzorce zrzutów (Playwright, 390×844 i 360×640, czas zamrożony): A1 seria bieżąca ↑, A3 walidacja + pierwszy raz, A4 poprawiana ↓ + Ghost wybrany, B1 przerwa, B2 koniec ćwiczenia, B3 koniec treningu, M menu. Baseline zatwierdzam po przeglądzie wizualnym (etap 8).

## 14. Do ustalenia w ADR (architekt)

- Źródło danych chipa (sugestia silnika per seria vs `buildLiveCoachTipForOpenSet`) i jedna funkcja kierunku + mapowanie `rule` → powód (5.3).
- Krok ciężaru przy `weightStepKg` = null (propozycja UX: 2,5 kg; maszyny/hantle mają własny krok).
- Ujemne `onAddSeconds` (−15 s) i dolna granica 0.
- Dane „Następnie” (kierunek, numer ćwiczenia, liczba zapisanych/pominiętych dla wariantu „Koniec treningu”).
- Rozróżnienie błędu sieci od pustej listy w `GhostPickerSheet`.
- Wariant kompaktowy: jedna definicja `@media (max-height: 719px)` w `globals.css`.
- Usunięcie nieużywanych `SessionProgressBar` i `PlanProgressHeader`.

## Werdykt

ZATWIERDZONE Z UWAGAMI. Specyfikacja i makieta są gotowe dla `frontend`; uwagi (sekcja 14) dotyczą kontraktów danych, które rozstrzyga ADR architekta, i nie zmieniają wyglądu. Mikrokopia wymaga zatwierdzenia przez prawnika-człowieka przed publikacją.
