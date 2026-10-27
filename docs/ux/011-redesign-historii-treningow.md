# 011 - Historia treningów: ocena UX i projekt ekranu (etap 4)

- **Autor**: ux (etap 3 bramki zadania 011; numeracja w karcie: bramka 3)
- **Data**: 2026-10-26
- **Karta**: `docs/zadania/011-redesign-historii-treningow.md`
- **Wejście**: `docs/analiza/011-redesign-historii-treningow.md` (sekcje 2-3, US-1..US-14, BR-1..BR-9, Q1-Q5 rozstrzygnięte przez właściciela), `docs/ux/00-system-projektowy-stan.md` (tokeny, komponenty, wzorce), wzorce `docs/ux/008-redesign-planu-treningowego.md` (układ listy, karta, chipy, resbar, stany) oraz `components/workout-history/workout-history-view.tsx` (stan obecny).
- **Makieta (referencja dla frontend)**: `docs/ux/011-redesign-historii-treningow-makieta.html`. Gdy makieta i ten dokument się różnią, wygrywa dokument i różnicę zgłaszamy.
- **Status**: projekt do akceptacji (werdykt w sekcji 0). Implementacja w etapie 5, po decyzjach `architekt` z ADR 0010 (routing filtra, źródło statystyk, limit 400).

---

## 0. Werdykt i kluczowe decyzje

**Werdykt: ZATWIERDZONE Z UWAGAMI.** Architektura i wygląd są spójne z systemem projektowym. Uwagi, które muszą być domknięte przed implementacją: (a) źródło statystyk per filtr i agregacja "łącznie" poza limitem 400 (decyzja `architekt`), (b) forma adresu filtra i deep linku z Pulpitu (`architekt`), (c) zgodność nazwy "Wróć" z hubem/Pulpitem (sekcja 6). Żadna uwaga nie zmienia układu ekranu.

Decyzje projektowe (rozstrzygnięcia właściciela z analizy uwzględnione):

1. **Numer sesji usunięty z karty** (Q1). Nie ma "tydz. N", nie ma "nr sesji". Karta pokazuje tylko to, co użytkownik czyta jako dane: dzień, nazwę, czas, serie, tonaż, porównanie.
2. **Statystyki reagują na filtr** (Q2). Nagłówek karty podsumowania ma etykietę zakresu ("Wszystkie treningi" albo nazwa dnia planu). Zmiana filtra przelicza trzy wartości z przejściem liczby (`AnimatedMetric`) i ogłasza zmianę w `aria-live`. Brak danych dla filtra = "—", nie 0.
3. **Limit 400 jawny** (Q3). Podpis przy "Tonaż" zawsze mówi, co liczy: "cała historia" albo "z 400 ostatnich". Gdy limit działa, pod kartą pojawia się jedna linia wyjaśnienia.
4. **Porównanie z poprzednią sesją tego samego dnia planu** (Q4). Widoczne już na zwiniętej karcie (pastylka "+5,2% · 17.10"), rozwinięte w bloku "Względem 17.10" z tonażem w kg i %, liczbą ćwiczeń w górę / w dół / bez zmian. Pierwsza sesja planu: "Pierwszy trening z tego planu", bez wartości 0. Ćwiczenia bez ciężaru nie wchodzą do porównania (zdanie w stopce bloku).
5. **Cardio poza v1** (Q5). Brak sekcji i wierszy cardio na ekranie.
6. **Usuwanie widoczne i dostępne klawiaturą** (Q6). Akcja "Usuń trening" stoi obok "Popraw" w stopce rozwiniętej karty (przyciski 48 px). Potwierdzenie `ConfirmDialog`. Przytrzymanie wiersza zostaje jako skrót (AC-7.3), ale nie jest jedyną drogą i nie jest opisywane w UI. Swipe odrzucony: koliduje z przewijaniem pionowym na telefonie i nie działa z klawiaturą.
7. **Pasek filtrów naprawiony** (Q7). Brak widocznego scrollbara (`scrollbar-width: none`, klasa `chp`/`.chip-scroll` z systemu), chip 44 px wysokości, licznik sesji w każdym chipie, stan aktywny z obrysem, tłem i tekstem "zaznaczony" (ikona check dla czytnika i kontrastu), licznik wyników pod paskiem, stan pusty dla filtra bez wyników.
8. **Hierarchia tydzień → trening → ćwiczenie**. Tydzień to nagłówek sekcji z zakresem dat i sumą (bez numerów "01"). Trening to wiersz z jedną główną liczbą (tonaż). Ćwiczenie to wiersz w rozwinięciu z tonażem per ćwiczenie i seriami. Każdy poziom ma jedną wiodącą liczbę.

---

## 1. Ocena obecnego ekranu

Punkt wyjścia: sekcja 3.2 analizy. Poniżej klasyfikacja zgodnie z `docs/zespol/przeplyw.md` (blokujące = uzasadnia ODRZUCONE w etapie; do naprawy później = trafia do `docs/bledy-do-naprawy/bledy.md`).

### 1.1 Problemy blokujące (naprawiane tą makietą)

| # | Problem | Dowód | Dlaczego blokujące |
|---|---|---|---|
| B-1 | Statystyki nie reagują na filtr. Użytkownik wybiera "Push" i widzi globalne KPI | `workout-history-view.tsx:336,379-414` | Główna ścieżka: filtr istnieje, a jego wynik nie jest pokazany. Mylące |
| B-2 | Usuwanie tylko przez przytrzymanie (520 ms) lub prawy przycisk myszy. Brak widocznej akcji, brak dostępu klawiaturą i czytnikiem | `:171-197` | Jedyna droga do usunięcia nie jest odkrywalna i nie działa z klawiaturą (WCAG 2.1.1) |
| B-3 | Znaczenie koloru PR (złoto) bez tekstu. Tooltip `title` niewidoczny na telefonie | `:84-98`, `:91` | Kolor jako jedyny nośnik informacji (WCAG 1.4.1) |
| B-4 | Kontrast etykiet i meta: `text-white/40` na `text-[10-11px]`, `text-white/35` przy KPI "ost. 8 tyg.", "łącznie" | `:204,212,239,268,381,387,412` | Poniżej 4,5:1 dla małego tekstu (WCAG 1.4.3). Zakaz wg `00-system` sekcja 7 |
| B-5 | Limit 400 cicho zaniża "Tonaż łącznie" bez informacji | `lib/workout-history-overview.ts:357`, `:412` | Wprowadza w błąd w zwykłym użyciu po ok. 2 latach; liczba wygląda na całą historię |
| B-6 | Chipy filtra ok. 32 px wysokości (`py-1.5 text-[12px]`) i widoczny scrollbar pod nimi | `:416-444` | Cel dotyku poniżej 44 px (US-13, AC-3.1); niechlujny wygląd (zrzut) |
| B-7 | Brak stanu dla filtra bez wyników (lista pusta, bez komunikatu i wyjścia) | `:447-451` | Ślepa uliczka bez informacji i CTA (US-9, AC-9.2) |

### 1.2 Problemy do naprawy później (poza tym zadaniem lub niskie ryzyko)

Wpisy trafiają do `docs/bledy-do-naprawy/bledy.md` (sekcja 11, "Historia treningów - UX"). Nie blokują zadania.

- Szerokość `max-w-lg` na ekranie zamiast `APP_SHELL_MAX` (cały ekran zamknięty w węższej kolumnie na tabletach).
- Strona szczegółu `workout-history/[id]` nie ma projektu UX i po zmianie linku z Pulpitu zostaje bez wejścia z listy (decyzja właściciela: usunąć czy przeprojektować).
- Ekran edycji `[id]/edit` ma inny nagłówek niż nowa historia (do ujednolicenia w osobnym zadaniu).
- Ujednolicenie "Ładowanie…" vs "Wczytywanie…" w historii (wzorzec z `00-system` sekcja 6).

### 1.3 Co działa i zostaje

- Szkielet tygodniowy z zakresem dat i sumą tonażu tygodnia.
- Rozwinięcie w miejscu, bez nawigacji. Pełne serie z ciężarami (pastylki `weight × reps`).
- Jawny termin edycji ("do …") i potwierdzenie usuwania z opisem skutków.
- Okno czasowe w KPI "Na tydzień" ("ost. 8 tyg.").
- Komunikaty zapisu przez `useSaveFeedback`.
- Pastylki serii o stałej szerokości z liczbami tabelarycznymi (serie równają się w pionie).

---

## 2. Architektura informacji

Ekran ma cztery warstwy, od ogółu do szczegółu. Każda ma jedną wiodącą liczbę lub informację.

```
Nagłówek                 Historia treningów · 38 treningów w historii
Podsumowanie (zakres)    Wszystkie treningi | Na tydzień 2,4 · Średni czas 69 min · Tonaż 180,6 t (cała historia)
Filtr dnia planu         [Wszystkie 38] [Push A 12] [Nogi 9] …  · Pokazano 38 treningów
Lista tygodni            TEN TYDZIEŃ · 20–26 października · 3 tr. · 12,4 t
  Wiersz treningu        Pt 24.10 | Push A | 58 min · 18 serii · 6 ćw. | 4 250 kg · +5,2% · 17.10 | ⌄
    Rozwinięcie          Względem 17.10 (blok porównania) | ćwiczenia z tonażem i seriami | Popraw · Usuń
```

Zasady:
- **Zakres jest zawsze nazwany.** Każda liczba w podsumowaniu ma etykietę zakresu (nagłówek karty) i podpis okna ("ost. 8 tyg.", "cała historia" / "z 400 ostatnich").
- **Filtr zmienia treść, nie strukturę.** Ten sam układ, tylko mniej wierszy i przeliczone liczby.
- **Brak numerów pozycji.** Nie ma indeksów tygodni ani sesji. Data i nazwa są identyfikatorem.
- **Dwa poziomy zwijania, jeden typ.** Tydzień jest zawsze rozwinięty (bez zwijania tygodni w v1, bo to dodatkowy krok na telefonie). Trening zwija się i rozwija.

---

## 3. Układ ekranu (390 px, mobile-first)

Szerokość kontenera: jedna kolumna, `max-w-lg` jak dziś w v1 (do ujednolicenia, sekcja 1.2). Odstępy: `px-4` (16 px), sekcje `mt-5` (20 px), karty wewnętrzne `p-4`.

### 3.1 Od góry

1. **Belka górna globalna** (`BrandMark`, dzwonek, `AppMenuButton`), jak w całej aplikacji.
2. **Wróć**: wiersz 44 px z `ArrowLeft` i tekstem "Wróć" (`Button variant="ghost"` albo link). Cel: wejście skąd przyszło (sekcja 6.3).
3. **Nagłówek (`AppPageHeader`)**: kicker "TRENING", H1 "Historia treningów" (28 px, `appPageTitleClass`), meta **licznik zakresu**: "38 treningów w historii" (bez filtra) albo "12 z 38 treningów" (z filtrem). Kicker nie zawiera już liczby (w zrzucie liczba była w kickerze złotym i w H1, co konkurowało).
4. **Sekcja "Podsumowanie"** (`SectionLabel`, `titleAs="h2"`) z prawej strony **chip zakresu** ("Wszystkie treningi" albo "Push A", `sys gold` gdy filtr aktywny).
5. **Karta podsumowania** (`app-card`, `grid grid-cols-3`, `py-4 px-3`): trzy kolumny (sekcja 4.1).
6. **Podpis limitu** (tylko gdy jest limit, sekcja 4.1): jedna linia pod kartą, meta 12 px: "Tonaż liczymy z 400 ostatnich treningów. Starsze się nie wliczają."
7. **Filtr dnia planu** (`fbar`, sticky `top: 0` w przewijanym obszarze, tło `--gym-black`): chipy 44 px (sekcja 4.2).
8. **Pasek wyniku** (`resbar`, 44 px): po lewej "Pokazano 12 treningów" (meta 12 px, `tabular-nums`, liczba w `b`), po prawej "Wyczyść filtr" (ghost, 44 px) gdy filtr jest aktywny.
9. **Lista tygodni**: sekcje tygodni (sekcja 4.3), każda z wierszami treningów (sekcja 4.4).
10. **Stopka listy**: gdy limit działa, "Pokazano 400 ostatnich treningów." (meta, wyśrodkowana) i odstęp 24 px nad belką.
11. **Belka dolna** (`AppShell`): zakładka "Trening" aktywna. Widoczna, bo to sekcja Treningi.

### 3.2 Stan sticky

Filtr jest przyklejony do góry obszaru przewijania (`position: sticky; top: 0; z-index: 1`), żeby zmiana dnia była dostępna przy długiej liście. Pasek wyniku nie jest sticky (oszczędność pionu). Tło filtra `--gym-black`, obramowanie dolne `border-white/10` tylko podczas przewijania (opcjonalnie; w v1 bez cienia).

---

## 4. Komponenty i warianty

Wszystko z istniejącego systemu. Nowe klasy nie są potrzebne (`app-card`, `chp`, `resbar`, `sys`, `SectionLabel`, `AnimatedMetric`, `ConfirmDialog`/`AlertDialog`, `Button`, `InlineBanner`, `AppPageHeader`).

### 4.1 Karta podsumowania (`SummaryCard`)

Trzy kolumny równej szerokości, wartości wyśrodkowane, liczby `tabular-nums`:

| Kafel | Etykieta (uppercase 11 px) | Wartość (24-28 px, `font-metric`) | Podpis (12 px, `--gym-text-secondary`) |
|---|---|---|---|
| Częstotliwość | NA TYDZIEŃ | `2,4` | średnio z 8 tyg. |
| Czas | ŚREDNI CZAS | `69 min` (jednostka mniejsza, 14 px) | z N treningów |
| Tonaż | TONAŻ | `180,6 t` | cała historia **albo** z 400 ostatnich (+ ikona `Info` 16 px, `aria-describedby` do podpisu pod kartą) |

Zasady:
- **Brak danych dla filtra** = "—" (`font-metric`, kolor drugorzędny), podpis "brak treningów" zamiast zera (AC-2.3).
- **Zmiana filtra**: wartości przechodzą `AnimatedMetric` (krótko, 200 ms; przy `prefers-reduced-motion` bez animacji). Zmiana jest ogłaszana: `aria-live="polite"` z tekstem "Statystyki: Push A. 2,1 na tydzień, 64 min, 88,4 t."
- **Podpis zakresu tonażu**: "cała historia", gdy licznik treningów ≤ 400. "z 400 ostatnich", gdy limit działa. Sformułowanie zawsze w podpisie, nie tylko w tooltipie.
- Wartości w kafelkach nie są przyciskami. Brak interakcji.

### 4.2 Filtr dnia planu (`PlanFilterBar`)

- Kontener: `fbar` (flex, `overflow-x: auto`, `scrollbar-width: none`, bez widocznego paska), `margin: 12px -16px 0; padding: 0 16px`. Prawa krawędź z maską (`mask-image` gradient 24 px), żeby sygnalizować przewijanie bez paska.
- Chip (`chp`): `min-height: 44px`, `padding: 0 14px`, `rounded-full`, tekst 13 px `font-medium`, licznik sesji 12 px `tabular-nums` w kolorze drugorzędnym, po spacji. Ikona check 14 px tylko w stanie aktywnym.
- **Stany chipa**:
  - domyślny: obrys `--gym-border-gold` (10% białego w wersji zwykłej), tekst biały 82%, licznik drugorzędny;
  - aktywny (`aria-pressed="true"`): obrys `--gym-gold` 60%, tło złote 10%, tekst biały, licznik złoty, ikona check. Kolor nie jest jedynym nośnikiem (ikona + `aria-pressed`);
  - fokus klawiatury: `focus-visible` 2 px `--ring`;
  - pusty wynik (chip bez sesji nie występuje, bo chip jest z planu; gdy wszystkie sesje dnia usunięto, chip znika po odświeżeniu).
- Kolejność: "Wszystkie", potem plany wg daty ostatniego treningu (decyzja `architekt`; makieta: wg liczby sesji malejąco).
- `aria-label` chipa: "Push A, 12 treningów". `role="group"` z etykietą "Filtr dnia planu".
- Klawiatura: zwykły Tab między chipami (`aria-pressed`, bez strzałek, zgodnie z 008 sekcja 11).

### 4.3 Nagłówek tygodnia (`WeekHeader`)

- `SectionLabel` (`titleAs="h2"`): tytuł to zakres dat w zdaniu, np. "20–26 października" (bez numeru tygodnia, bez uppercase tytułu; uppercase zostaje w etykiecie "TEN TYDZIEŃ" nad tytułem, jeśli tydzień jest bieżący).
- Etykieta nad tytułem (11 px uppercase, tracking 0.14em):
  - "TEN TYDZIEŃ" dla bieżącego tygodnia (kolor złoty + tekst, nie tylko kolor);
  - "POPRZEDNI TYDZIEŃ" dla poprzedniego;
  - brak etykiety dla starszych (rok w tytule, gdy inny niż bieżący: "20–26 października 2025").
- Po prawej (meta 12 px, `tabular-nums`): "3 tr. · 12,4 t". Skrót "tr." (treningi) i "t" (tony) zgodnie z resztą aplikacji. W `aria-label` pełnymi słowami: "trzy treningi, dwanaście i cztery dziesiąte tony".
- Odstęp: nagłówek → karty tygodnia `space-y-2.5` (10 px). Między tygodniami `mt-6` (24 px).

### 4.4 Wiersz treningu zwinięty (`SessionRow`)

Całość kontenera tygodnia: `app-panel` (16 px obrys), wiersze rozdzielone `divide-y divide-white/[0.06]`. Wiersz to przycisk (`type="button"`, `aria-expanded`, `aria-controls`), min. 72 px wysokości.

Trzy kolumny + rozwijanie:

| Kolumna | Zawartość | Typografia |
|---|---|---|
| Data (48 px) | góra: dzień skrócony "Pt" (11 px uppercase, drugorzędny); dół: "24.10" (15 px `font-metric`, `tabular-nums`). Dla dziś i wczoraj: "Dziś" / "Wczoraj" (zgodnie z Pulpitem, AC-10.3) w złocie | |
| Środek (`min-w-0`, `flex-1`) | tytuł: `planLabel` (15 px semibold, 1 linia, wielokropek); meta: "58 min · 18 serii · 6 ćw." (12 px drugorzędny) | |
| Prawa (`text-right`) | góra: tonaż "4 250 kg" (16 px `font-metric`, `tabular-nums`); dół: pastylka porównania (sekcja 4.5) | |
| Strzałka | `ChevronDown` 20 px, obrót 180° przy rozwinięciu. Dekoracyjna (`aria-hidden`) | |

- Usunięto: "tydz. N", etykietę "tonaż" (wartość jest oczywista z jednostki "kg"), numerację, drugi wiersz meta.
- Tonaż per trening w `kg` do 9 999; powyżej w tonach ("12,4 t"). Format z `formatHistoryKg` (zachowany).
- Stan naciśnięcia: tło `white/4%` (`:active`), bez animacji dłuższej niż 120 ms.
- **Dostępność**: `aria-label` przycisku: "Push A, 24.10, 4 250 kilogramów, +5,2% względem 17.10. Pokaż szczegóły". Przy rozwinięciu "Ukryj szczegóły" (zmiana `aria-label`).

### 4.5 Pastylka porównania (`CompareChip`)

Jedna linia, 12 px, z ikoną 14 px (zawsze obecną, nie tylko kolorem):

| Stan | Tekst | Ikona | Ton |
|---|---|---|---|
| wzrost tonażu | "+5,2% · 17.10" | `TrendingUp` | `--gym-success` + tekst biały |
| spadek tonażu | "−3,1% · 17.10" | `TrendingDown` | tekst drugorzędny (bez czerwieni: spadek to nie błąd) |
| bez zmiany (0%) | "bez zmiany · 17.10" | `Minus` | drugorzędny |
| pierwszy trening planu | "Pierwszy w planie" | brak (sam tekst) | drugorzędny |
| brak porównania (np. tylko ćwiczenia bez ciężaru) | "bez porównania" | `Minus` | drugorzędny |

- Data porównania ("17.10") to `prevDate` w formacie dd.mm.
- Nie pokazujemy presji ani ocen ("gorzej", "przegrywasz"). Strzałka i procent to informacja.
- `aria-label` w wierszu zawiera pełną treść.

### 4.6 Rozwinięcie (`SessionDetails`)

Panel pod wierszem, tło `--gym-surface-raised` (lub brak tła, tylko `border-t`), `px-4 pb-4 pt-3`, odstęp między blokami `space-y-4`.

**a) Blok "Względem 17.10"** (`CompareBlock`, gdy jest porównanie):
- Nagłówek 12 px uppercase drugorzędny: "WZGLĘDEM 17.10 · PUSH A".
- Dwie linie wartości: "Tonaż +220 kg (+5,2%)" i "Ćwiczenia: 3 w górę · 1 w dół · 2 bez zmian" (liczby w `b`, `tabular-nums`).
- Stopka 12 px drugorzędny, gdy są ćwiczenia bez ciężaru: "Ćwiczenia bez ciężaru nie wliczają się do porównania."
- Dla pierwszego treningu planu: zamiast bloku jedna linia "Pierwszy trening z tego planu. Porównanie pojawi się przy następnym."

**b) Lista ćwiczeń** (`ExerciseList`, `ol` z numerem kolejności nie pokazanym jako indeks; kolejność to kolejność z treningu):
- Wiersz ćwiczenia: nazwa (14 px `font-medium`, biały 90%, do 2 linii) i po prawej tonaż ćwiczenia "1 240 kg" (12 px drugorzędny, `tabular-nums`). Pod nazwą nic dodatkowego.
- Pod nazwą rząd pastylek serii (`SetPill`, sekcja 4.7), `flex-wrap`, odstęp 6 px.
- Oddzielenie ćwiczeń: `space-y-3` (12 px), bez obramowań między nimi.
- Ćwiczenie bez ciężaru (`isBodyweight`): nagłówek tonażu zastąpiony "masa ciała", pastylki pokazują "12 powt." zamiast "0 × 12".

**c) Legenda rekordów** (`PrLegend`, tylko gdy w treningu jest co najmniej jeden rekord, AC-6.3):
- Pojedynczy wiersz 12 px drugorzędny z ikoną `Star` 14 px w złocie: "Rekord - nowe najlepsze e1RM w ćwiczeniu." Umieszczony nad listą ćwiczeń.
- Brak rekordów w treningu: legendy nie ma.

**d) Stopka akcji** (`SessionActions`):
- Układ: dwa przyciski w rzędzie (`flex gap-2`), 48 px wysokości, każdy `flex-1`.
  - **Popraw**: `Button variant="outline"`, ikona `Pencil`, prowadzi do `/workout-history/[id]/edit`. Widoczny tylko, gdy `canEditWorkout` (AC-8.1).
  - **Usuń trening**: `Button variant="ghost"` z obrysem `--destructive` 45% i tekstem `--destructive` (`dz`), ikona `Trash2`. Otwiera `ConfirmDialog`.
- Pod przyciskami 12 px drugorzędny:
  - edycja dostępna: "Edycja do 31.10, 20:14." (termin z `formatEditDeadline`, zgodny z zapisanym czasem zakończenia, AC-8.3);
  - edycja niedostępna: "Edycja niedostępna po 7 dniach." (AC-8.2). W tym przypadku **przycisk "Popraw" nie jest renderowany**, a "Usuń trening" zajmuje pełną szerokość.

### 4.7 Pastylka serii (`SetPill`)

- Wymiary: wysokość 36 px (nie jest interaktywna, więc nie wymaga 44 px), `min-width: 72 px`, `rounded-lg`, `tabular-nums`, `font-metric` 13 px.
- **Zwykła seria**: obrys biały 14%, tekst biały 80%, format "80 × 8" (ciężar × powtórzenia, znak × kolor drugorzędny).
- **Rekord (PR)**: obrys złoty, tło złote 10%, tekst złoty, **ikona `Star` 12 px przed liczbą**. Kolor + ikona + tekst "rekord" w `aria-label`. Wizualny tekst nie zawiera słowa, bo legenda go wyjaśnia (AC-6.1).
- **Seria niewykonana** (`done: false`): pastylka przerywana (`border-dashed`), tekst "—", `aria-label` "seria niewykonana".
- `aria-label` pastylki pełnym zdaniem: "Seria 3: 80 kilogramów na 8 powtórzeń, rekord." (AC-6.2).
- Pastylki w kolejności serii, numeracja serii nie jest pokazywana (jest w `aria-label`).

### 4.8 Akcja "Usuń trening" - potwierdzenie (`ConfirmDialog`)

- Komponent `ConfirmDialog` (lub `AlertDialog` jak dziś, styl `app-dialog`, 22 px). Fokus na przycisku "Anuluj" (bezpieczny, pierwszy w kolejności).
- Tytuł: "Usunąć trening?". Treść: "„Push A” z 24.10 zniknie z historii wraz z seriami i tonażem. Plan się nie zmieni. Tej operacji nie można cofnąć."
- Przyciski: "Anuluj" (`outline` 48 px, pełna szerokość) i "Usuń trening" (`destructive` wypełniony 48 px). Podczas żądania: "Usuwam…", `aria-busy`, oba przyciski zablokowane.
- Po sukcesie: dialog się zamyka, wiersz znika (animacja `height` 200 ms, bez niej przy `reduced-motion`), `useSaveFeedback` "Usunięto trening z historii.", licznik w nagłówku i w pasku wyniku przelicza się.

### 4.9 Komunikaty akcji usuwania

- **Błąd sieci** (AC-7.5): w dialogu baner `InlineBanner variant="error"`: "Nie udało się usunąć treningu. Sprawdź połączenie. Wpis zostaje na liście." Przycisk "Spróbuj ponownie". Wiersz nie znika.
- **Już usunięty na innym urządzeniu** (AC-7.4): w dialogu baner `info`: "Ten trening już nie istnieje. Odświeżyliśmy listę." Wiersz znika, lista odświeżona. Bez kodu błędu.
- **Sukces**: patrz 4.8.

### 4.10 Pusty wynik filtra (`FilterEmptyState`)

- Karta `flat` (`app-card`, obrys 8% białego), wyśrodkowana, `py-10 px-5`.
- Ikona `CalendarX` w kwadracie 48 px (`glyph`-styl, złota obwódka).
- H3: "Brak treningów dla „Nogi”".
- Treść 14 px: "Ten dzień planu nie ma jeszcze zapisanych treningów albo wszystkie usunięto."
- Przycisk `outline` 48 px: "Pokaż wszystkie" (kasuje filtr).
- Pod spodem: podsumowanie w stanie "—" (sekcja 4.1), pasek wyniku: "Pokazano 0 treningów · Nogi".

### 4.11 Pusty ekran (pierwsze użycie, US-9 AC-9.1)

- Karta `flat`, wyśrodkowana: ikona `Dumbbell` 64 px w kwadracie złotym (`glyph lg`).
- H3: "Nie masz jeszcze treningów".
- Treść: "Ukończony trening pojawi się tutaj z ciężarami i tonażem."
- CTA `Button variant="cta"` 48 px pełnej szerokości: "Przejdź do Treningów" (link do `/workout-plan`).
- Bez podsumowania (brak liczb do pokazania), bez filtra (nie ma czego filtrować).

### 4.12 Ładowanie (szkielet)

- Nagłówek: dwa bloki (`sk`) 120 px i 24 px.
- Karta podsumowania: trzy bloki `sk` 40 px.
- Filtr: cztery pastylki `sk` 96 × 44 px.
- Tydzień: nagłówek `sk` 180 px; dwa wiersze `sk` 72 px w `app-panel`.
- Bez `animate-pulse` przy `prefers-reduced-motion`; w pozostałych przypadkach delikatny pulse 1,6 s.

### 4.13 Błąd i offline

- **Błąd wczytania** (nie udało się pobrać historii): `InlineBanner variant="error"` nad podsumowaniem: "Nie udało się wczytać historii." + przycisk "Spróbuj ponownie" (`outline` 44 px). Bez starych danych jako aktualnych.
- **Offline** (AC-14.1): `InlineBanner variant="warning"`: "Brak połączenia. Historia pokaże się po powrocie sieci." Lista niewidoczna (brak zer i pustej listy).
- **Częściowe dane** (np. część sesji nie daje się odczytać): wiersz z tekstem "Nie udało się odczytać szczegółów" w rozwinięciu, reszta bez zmian (`app-panel`).
- **Brak uprawnień**: obsługa globalna (`AuthPageFrame`), bez osobnego ekranu.

---

## 5. Interakcje i przepływy

### 5.1 Filtr
1. Tap na chip → `aria-pressed` zmienia się, podsumowanie przelicza się (`AnimatedMetric`), lista pokazuje tylko wybrany dzień, pasek wyniku aktualizuje się, `aria-live` ogłasza zmianę.
2. Przewijanie listy: filtr zostaje przyklejony.
3. "Wyczyść filtr" → "Wszystkie", podsumowanie wraca do całej historii.
4. Stan filtra jest w adresie (`?plan=<klucz>`, decyzja `architekt`). Wejście wstecz zachowuje wybór; odświeżenie też.

### 5.2 Rozwinięcie
1. Tap na wiersz → rozwija szczegóły poniżej, `aria-expanded="true"`. **Decyzja UX: wiele wierszy może być rozwiniętych naraz** (użytkownik porównuje sesje), bez automatycznego zwijania innych.
2. Ponowny tap zwija. Brak nawigacji.

### 5.3 Usuwanie
1. Tap "Usuń trening" w stopce → `ConfirmDialog`.
2. "Anuluj" zamyka bez zmian. "Usuń trening" wykonuje akcję (4.8).
3. Skrót: przytrzymanie wiersza (520 ms) otwiera ten sam dialog (AC-7.3). Nie jest opisany w UI, bo nie jest drogą podstawową.

### 5.4 Edycja
1. "Popraw" → `/workout-history/[id]/edit` (bez zmian formularza). Powrót wraca na listę z tym samym filtrem i rozwiniętym wierszem (AC-11; `architekt` potwierdza, czy stan rozwinięcia przechodzi przez adres, np. `?sesja=<id>`).

### 5.5 Wejście z Pulpitu
1. Wiersz na Pulpicie "Ostatnie treningi" → `/workout-history?sesja=<id>` (rekomendacja: zamiast szczegółu `[id]`, bo lista z rozwiniętą sesją jest pełniejsza). Architekt potwierdza, czy szczegół zostaje osobnym ekranem (sekcja 1.2).
2. Ekran przewija do właściwego wiersza, rozwija go i podświetla obrysem złotym 2 px na 2 s (bez animacji przy `reduced-motion`; obrys statyczny).
3. Stopka Pulpitu "Historia treningów" → `/workout-history` bez parametru (bez rozwinięcia).

### 5.6 "Wróć"
- Z Pulpitu → Pulpit (AC-11.1). Z hubu Treningi → hub (AC-11.2). Bezpośrednie wejście → hub Treningi (AC-11.3).
- Implementacja: `router.back()`, gdy poprzednia strona to aplikacja (historia przeglądarki), w przeciwnym razie `/workout-plan`. Etykieta zawsze "Wróć".

---

## 6. Mikrokopia

### 6.1 Słownik (jedna nazwa na pojęcie)
- **trening** = jedna zakończona sesja siłowa (w UI "trening", w liczbach "treningi"; "sesja" nie pojawia się w interfejsie).
- **plan** = dzień planu (np. "Push A"); w filtrze "dzień planu" tylko w `aria-label` grupy, widocznie "Filtr dnia planu" w nagłówku grupy.
- **rekord** = seria z nowym najlepszym e1RM (nie "PR" w tekście widocznym).
- **tonaż** = suma ciężar × powtórzenia; w jednostkach "kg" i "t".

### 6.2 Teksty stałe
| Miejsce | Tekst |
|---|---|
| Kicker | TRENING |
| H1 | Historia treningów |
| Meta, bez filtra | 38 treningów w historii |
| Meta, z filtrem | 12 z 38 treningów |
| Sekcja | Podsumowanie |
| Chip zakresu | Wszystkie treningi / Push A |
| Kafel | NA TYDZIEŃ / ŚREDNI CZAS / TONAŻ |
| Podpis kafla | średnio z 8 tyg. / z N treningów / cała historia / z 400 ostatnich |
| Podpis limitu | Tonaż liczymy z 400 ostatnich treningów. Starsze się nie wliczają. |
| Pasek wyniku | Pokazano 12 treningów / Wyczyść filtr |
| Etykieta tygodnia | TEN TYDZIEŃ / POPRZEDNI TYDZIEŃ |
| Meta tygodnia | 3 tr. · 12,4 t |
| Meta treningu | 58 min · 18 serii · 6 ćw. |
| Legenda rekordów | Rekord - nowe najlepsze e1RM w ćwiczeniu. |
| Pierwszy trening planu | Pierwszy trening z tego planu. Porównanie pojawi się przy następnym. |
| Stopka porównania | Ćwiczenia bez ciężaru nie wliczają się do porównania. |
| Termin edycji | Edycja do 31.10, 20:14. |
| Edycja zamknięta | Edycja niedostępna po 7 dniach. |
| Przycisk edycji | Popraw |
| Przycisk usuwania | Usuń trening |
| Stopka listy (limit) | Pokazano 400 ostatnich treningów. |

### 6.3 Komunikaty stanów
| Stan | Tekst |
|---|---|
| Pusty ekran | Nie masz jeszcze treningów. Ukończony trening pojawi się tutaj z ciężarami i tonażem. |
| Pusty filtr | Brak treningów dla „Nogi”. Ten dzień planu nie ma jeszcze zapisanych treningów albo wszystkie usunięto. |
| Błąd wczytania | Nie udało się wczytać historii. |
| Offline | Brak połączenia. Historia pokaże się po powrocie sieci. |
| Błąd usuwania | Nie udało się usunąć treningu. Sprawdź połączenie. Wpis zostaje na liście. |
| Już usunięty | Ten trening już nie istnieje. Odświeżyliśmy listę. |
| Sukces usunięcia | Usunięto trening z historii. |

### 6.4 Ton
Krótko, na "ty", bez oceniania postępu. Porównanie to liczby i strzałka, bez "lepiej/gorzej". Spadek tonażu nie jest komunikowany jako porażka (ton neutralny). Brak sformułowań o wadze, sylwetce i jedzeniu.

---

## 7. Dostępność (WCAG 2.2 AA)

- **Kontrast**: tekst główny biały 90%, drugorzędny `--gym-text-secondary` (`#9a9182`, ok. 6,5:1 na tle czarnym), kontrast ikon i obrysów ≥ 3:1. Zakaz `text-white/40|35|30` na tekście informacyjnym tego ekranu (B-4).
- **Cele dotyku**: 44 px dla chipów, wiersza treningu (min. 72 px), "Wróć", "Wyczyść filtr", przycisków stopki (48 px). Pastylki serii są nieinteraktywne (36 px).
- **Kolor nie jest jedynym nośnikiem**: rekord = gwiazdka + tekst "rekord" w `aria-label`; porównanie = strzałka + liczba + słowo; aktywny chip = check + `aria-pressed` + obrys; "Dziś" = tekst + kolor.
- **Semantyka**: lista tygodni to `section` z nagłówkiem `h2`; wiersz treningu to `button` z `aria-expanded` i `aria-controls`; pastylki serii to `span` z `aria-label`; kafle podsumowania to `dl`/`dt`/`dd` albo para `p` z `aria-label`.
- **Klawiatura**: Tab przez: Wróć → chipy → Wyczyść → wiersze (Enter/Space rozwija) → w rozwinięciu: Popraw, Usuń. Fokus `focus-visible` 2 px `--ring`.
- **Dialog**: fokus przechwycony, pierwszy "Anuluj", po zamknięciu wraca do przycisku "Usuń trening".
- **Komunikaty**: zmiana filtra w `aria-live="polite"`; błędy w `role="alert"`; sukces w `useSaveFeedback`.
- **Ruch**: przy `prefers-reduced-motion` bez `AnimatedMetric`, bez rozwijania wysokości, bez pulsu szkieletu, bez obrysu podświetlenia z Pulpitu (zostaje statyczny).
- **Język**: `lang="pl"`. Skróty wizualne ("tr.", "t", "min", "ćw.") mają pełne słowa w `aria-label`.

---

## 8. Responsywność

- **360 px**: podsumowanie w trzech kolumnach zostaje (wartości `1.5rem`, etykiety 10 px uppercase skrócone do "NA TYDZ." jeśli nie mieszczą się w kolumnie; tekst pełny w `aria-label`). Chipy przewijają się poziomo z maską. Stopka rozwinięcia: przyciski w rzędzie, tekst "Popraw" i "Usuń trening" mieszczą się w 166 px każdy.
- **390 px**: układ z makiety.
- **Od `md` (768 px)**: kontener `max-w-xl`, ta sama jedna kolumna (zgodnie z `APP_SHELL_MAX`; do wdrożenia w implementacji). Podsumowanie i filtr bez zmian.
- **Orientacja pozioma**: bez specjalnego układu (aplikacja pionowa, sekcja 4 analizy).

---

## 9. Zgodność z analizą (AC/US)

| Wymaganie | Rozwiązanie w projekcie |
|---|---|
| US-1 / AC-1.1-1.4 hierarchia tydzień | sekcje 2, 4.3; tydzień bez numeru; data w zdaniu; etykieta "TEN TYDZIEŃ" |
| US-2 / AC-2.1-2.4 statystyki zgodne z filtrem | 4.1 (zakres w chipie, "—", podpis limitu, aria-live) |
| US-3 / AC-3.1-3.5 filtr dnia | 4.2 (44 px, bez scrollbara, licznik, pusty stan 4.10); AC-3.4: przy jednym planie chip "Wszystkie" + chip planu, bez błędu |
| US-4 numeracja | usunięta z karty (4.4); "Q1" |
| US-5 / AC-5.1-5.3 porównanie | 4.5 (zwinięta), 4.6a (rozwinięta), pierwszy trening, bodyweight |
| US-6 / AC-6.1-6.3 rekordy | 4.6c, 4.7, legenda tylko gdy są rekordy |
| US-7 / AC-7.1-7.5 usuwanie | 4.6d, 4.8, 4.9; long-press jako skrót |
| US-8 / AC-8.1-8.3 edycja | 4.6d (termin, brak przycisku po 7 dniach) |
| US-9 / AC-9.1-9.3 puste | 4.10, 4.11 |
| US-10 / AC-10.1-10.3 Pulpit | 5.5 (deep link + podświetlenie), spójność "Dziś/Wczoraj" |
| US-11 / AC-11.1-11.3 Wróć | 5.6 |
| US-12 wydajność | bez wpływu na wygląd; ładowanie szkieletem (4.12); paginacja decyzja `architekt` |
| US-13 dostępność/mobile | sekcja 7, 8 |
| US-14 offline/błąd | 4.13 |

---

## 10. Otwarte pytania i zależności od `architekt`

| # | Pytanie | Rekomendacja UX | Kto |
|---|---|---|---|
| A-1 | Źródło statystyk per filtr: przeliczenie w kliencie z załadowanych sesji czy agregacja serwera | Obojętne dla UX, pod warunkiem że liczby są identyczne z Pulpitem i nie zmieniają się przy jednym dotknięciu dłużej niż 300 ms | `architekt` (ADR 0010) |
| A-2 | Limit 400 przy agregacji "łącznie": czy tonaż obejmuje całą historię | Tak (Q3). Podpis zmienia się na "cała historia", gdy limit nie obowiązuje | `architekt`, użytkownik |
| A-3 | Adres filtra i rozwinięcia (`?plan=`, `?sesja=`) | Tak, z zachowaniem przy "Wróć" i odświeżeniu | `architekt` |
| A-4 | Szczegół `[id]`: zostaje osobnym ekranem czy znika na rzecz rozwinięcia | Rekomendacja: zostaje do osobnego zadania, Pulpit prowadzi do listy z rozwiniętym wierszem | użytkownik |
| A-5 | Kolejność chipów planów | Wg ostatniego treningu (najświeższy pierwszy) albo wg liczby sesji; makieta: wg liczby | `architekt` |
| A-6 | Czy "Usuń" i "Popraw" wymagają zmiany API (kontrakt `deleteCompletedWorkout` bez zmian) | UX zakłada brak zmian kontraktu | `architekt` |
| A-7 | Czas trwania (D-05, pauzy) wpływa na "Średni czas" i pastylkę "min" | Do rozstrzygnięcia przez analityka; w makiecie wartości z obecnej definicji | analityk |
| A-8 | Pełny rozpis wszystkich sesji dnia do porównania (poza jedną poprzednią) | Poza v1: porównanie tylko z poprzednią sesją | użytkownik |

---

## 11. Checklista spójności (dla `tester`, etap 5-6)

- [ ] Brak numerów "tydz. N", "01" i indeksów przy tygodniach.
- [ ] Wszystkie chipy `min-height: 44px`, brak widocznego scrollbara w `fbar`.
- [ ] Statystyki zmieniają się z filtrem; zakres w chipie; "—" zamiast 0 dla pustego filtra.
- [ ] Podpis tonażu: "cała historia" lub "z 400 ostatnich"; podpis limitu przy limicie.
- [ ] Pastylka porównania na zwiniętej karcie: ikona + tekst; spadek w tonie neutralnym.
- [ ] Rozwinięta karta: "Względem …" albo "Pierwszy trening…"; legenda rekordów tylko gdy są rekordy.
- [ ] Rekord = gwiazdka + złoto + `aria-label` "rekord".
- [ ] Usuwanie widoczne w stopce rozwiniętej karty, `ConfirmDialog`, błędy zgodne z 4.9.
- [ ] "Popraw" tylko przy `canEditWorkout`; komunikat "Edycja niedostępna po 7 dniach" w przeciwnym razie.
- [ ] Puste stany: pierwsze użycie (4.11), pusty filtr (4.10).
- [ ] Kontrast tekstu drugorzędnego `--gym-text-secondary`; brak `text-white/40|35`.
- [ ] `aria-expanded`, `aria-pressed`, `aria-live` przy filtrze.
- [ ] Brak animacji przy `prefers-reduced-motion`.
- [ ] Belka dolna widoczna; ostatnia karta nie zasłonięta.

---

## 12. Wpisy do `docs/bledy-do-naprawy/bledy.md`

Dopisane w sekcji "Historia treningów (011): UX poza zakresem lub niskie ryzyko" (plik wspólny). Zakres: pozycje spoza tego zadania albo niskiego ryzyka (strona szczegółu `[id]`, ekran edycji, `max-w-lg`, nieużywany `cardio` w payloadzie, dług stylu chipów w innych ekranach).
