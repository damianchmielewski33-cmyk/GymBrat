# 003 - Przebudowa ekranu Trening: specyfikacja ekranu, stanów i mikrokopii

Autor: ux. Data: 2026-10-23. Karta: `docs/zadania/003-przebudowa-ekranu-trening.md`.
Wejście: zatwierdzona makieta z karty + decyzje P-1..P-5, `docs/analiza/003-przebudowa-ekranu-trening.md` (US-1..US-6, BR-1..BR-12), `docs/prawo/003-przebudowa-ekranu-trening-wejscie.md` (LR-5, LR-6, LR-7, LR-8), `docs/ux/00-system-projektowy-stan.md`. Dane i kontrakty (numer dnia, „następny”, ostatnie obciążenie, grupy mięśni) ustala ADR `docs/adr/0002-ekran-trening-dane-huba.md`; ten dokument określa tylko, co użytkownik widzi.

Makieta referencyjna HTML (statyczna, wartości 1:1 z tokenów): `docs/ux/003-przebudowa-ekranu-trening-makieta.html`. Sprawdzona w 320, 380 i 430 px (render Edge/Playwright).

## 0. Zasady wspólne

- **Bez nowych wzorców tam, gdzie istnieje komponent.** Ekran składamy z: klasy `app-card` (karty główne), `app-panel` (panel dni, kafelki narzędzi), `Button` (`components/ui/button.tsx`, `variant="cta"` dla akcji głównej), `SectionLabel` (bez `index`, `titleTone="white"`), `AppPageHeader` (`components/layout/screen.tsx`), `DropdownMenu*` (`components/ui/dropdown-menu.tsx`, base-ui Menu), `Sheet` (`components/ui/sheet.tsx`, `side="bottom"`), `ConfirmDialog` (`components/ui/confirm-dialog.tsx`), `AnimatedMetric` (szanuje `prefers-reduced-motion`).
- **Jeden nowy komponent**: `MuscleGlyph` (sekcja 6). Miejsce: `components/treningi/muscle-glyph.tsx` (domena treningu; nie `components/ui`, bo nie jest prymitywem). Po wdrożeniu dopisuję go do katalogu w `docs/ux/00-system-projektowy-stan.md`.
- **Usuwamy z ekranu**: kicker „PLAN · N DNI · N TYG.”, samotną cyfrę `AnimatedMetric` w nagłówku, zielony chip „Wykonano” (`emerald-*`), chip „Dziś”, ikonę dziennika i strzałkę w wierszu, stopkę „Tap = … Notes = …”, sekcje 02-04 (Korekta techniki, Postępy, Cardio), etykiety `D1..Dn`, kafelek Rekordy (P-1). Ręczne `gold-btn` zastępujemy `Button variant="cta"`. Twardy hex `bg-[#0E0E0E]` znika.
- **Kolor**: wyłącznie `var(--gym-gold)` (+ `-bright`, `-deep`), biel z przezroczystością, powierzchnie `--gym-surface*`. Tekst na złotym tle: `#1A1408` (jak dotąd w kodzie; dodać token `--gym-on-gold: #1a1408` w `app/globals.css` obok `--gym-gold`, bo kolor pojawia się w trzech miejscach: przycisk, ptaszek, aktywne tło). Dwa nowe tokeny sylwetki: `--gym-glyph-base: #262626`, `--gym-glyph-stroke: #4a4a4a` (w `:root` i `.dark`, przy pozostałych `--gym-*`). Żadnego zielonego ani czerwonego dla stanu wykonania (BR-10). Jedyny czerwony odcień na ekranie to `ConfirmDialog` dla „Porzuć” (akcja destrukcyjna, istniejący komponent).
- **Kontrast (LR-5)**: tekst drugorzędny minimum `text-white/60` (ok. 7:1 na `--gym-surface-sunken`). Nie używać `text-white/45`, `/40`, `.app-label` (white 38%) dla treści. Etykiety metryk 11 px tylko z `text-white/60` lub złotem.
- **Liczby**: wszystkie liczby (ciężary, powtórzenia, X / N, minuty, daty) z `tabular-nums`.
- **Motyw**: aplikacja ma tylko ciemny motyw (`<html class="dark">` na stałe). Kolory wyłącznie przez zmienne CSS, więc ewentualny jasny motyw w przyszłości nadpisze tylko tokeny.
- **Ruch**: brak nowych animacji. Liczby przez `AnimatedMetric` (ma już obsługę reduced-motion). Pasek segmentów, ptaszek, ramka „Następny” bez animacji wejścia. Sheen kart `app-card::after` jest już wyłączany w `prefers-reduced-motion`. Zakaz framer-motion na tym ekranie.
- **Mikrokopia (LR-6)**: opisowo, bez oceny i presji. Zakazane m.in.: „nie strać serii”, „nadrób”, „zaległy”, „za mało”, „zwiększ do …”, „brawo/świetnie” przy liczbach, ikona płomienia przy serii.
- **Odmiana (BR-12)**: jedna funkcja odmiany PL (`one / few / many`, reguła 12-14 = many) w jednym miejscu, z testem. Tabela form w sekcji 9.

## 1. Struktura ekranu (mobile-first, kolejność DOM = kolejność fokusu)

Kontener: obecny `mx-auto w-full max-w-lg space-y-5 pb-8` (rama `AppShell` daje `px-3 py-3 sm:px-5`).

```
1. Nagłówek          AppPageHeader: „Trening” + „Tydzień 20–26.10” + chip serii
2. Karta tygodnia    app-card: Siłownia X / N | Cardio M min · S sesji, pasek segmentów
3. Karta główna      jeden z wariantów: Niedokończony | Następny | Dzień pusty | Brak planu
4. Dni planu         SectionLabel (PDF, Edytuj) + app-panel z wierszami
5. Narzędzia         SectionLabel + siatka 3 kafelków app-panel
```

Rytm pionowy: `space-y-5` (20 px) między blokami; `space-y-2.5` (10 px) między `SectionLabel` a jego panelem.

## 2. Nagłówek (US-1)

Komponent: `AppPageHeader` bez `kicker` i bez `actions` (na mobile `actions` lądują pod tytułem i kosztują wysokość).

- `title="Trening"` (h1, `appPageTitleClass`, 24 px / sm 28 px).
- `description` = wiersz `flex flex-wrap items-center gap-x-2.5 gap-y-1.5`:
  - zakres tygodnia: `<span class="text-white/65 tabular-nums">Tydzień 20–26.10</span>` (nadpisuje `white/45` z `appPageSubtitleClass`, który nie spełnia 4,5:1);
  - chip serii (tylko gdy `streakWeeks >= 1`): `<span class="inline-flex h-7 items-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/[0.08] px-3 text-[12px] font-semibold tabular-nums text-[var(--gym-gold)]">`. Bez ikony (płomień = presja). Element nieinteraktywny.

Format zakresu tygodnia (pon-nd, dni lokalne, półpauza `–` bez spacji):
| Przypadek | Widoczny tekst | `aria-label` na spanie |
|---|---|---|
| ten sam miesiąc | `Tydzień 20–26.10` | `Tydzień od 20 do 26 października` |
| różne miesiące | `Tydzień 27.10–02.11` | `Tydzień od 27 października do 2 listopada` |
| przełom roku | `Tydzień 29.12–04.01` | `Tydzień od 29 grudnia do 4 stycznia` |

Chip serii:
- widoczny tekst: `N tyg. z rzędu` (zatwierdzony w makiecie; skrót „tyg.” jest poprawny dla każdej liczby);
- `aria-label` z pełną odmianą (AC-1.2): `1 tydzień z rzędu z treningiem`, `3 tygodnie z rzędu z treningiem`, `5 tygodni z rzędu z treningiem`, `22 tygodnie…`, `12 tygodni…`;
- `streakWeeks = 0`: chip nie renderuje się (nie „0 tyg.”), bez tekstu zastępczego.
- Uwaga dla `tester`: AC-1.2 sprawdzać na `aria-label`, nie na widocznym tekście.

## 3. Karta tygodnia (US-2)

`<section class="app-card p-4" aria-labelledby="week-card-title">`, tytuł sekcji ukryty wizualnie: `<h2 id="week-card-title" class="sr-only">Ten tydzień</h2>`.

Układ: `grid grid-cols-2 gap-3`; druga kolumna `border-l border-white/[0.06] pl-3`.
- Etykieta: `text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60` - „Siłownia”, „Cardio”.
- Wartość: `mt-2`, liczba `font-metric text-[26px] leading-none tabular-nums text-white` (przez `AnimatedMetric`), dopisek `text-[17px] text-white/60` - `/ 5` lub `min`.
- Cardio, druga linia: `mt-1 text-[13px] text-white/60 tabular-nums` - `2 sesje`.
- Pasek segmentów: `mt-4`.

### Pasek segmentów
`<ol class="mt-4 flex gap-1.5" aria-label="Dni planu w tym tygodniu">`, jeden `<li>` na dzień planu w kolejności Dzień 1..N, każdy `h-2 min-w-[6px] flex-1 rounded-full`:
| Stan | Klasy | Tekst `sr-only` w `<li>` |
|---|---|---|
| niewykonany | `bg-white/10` | `Dzień 2: jeszcze nie w tym tygodniu` |
| wykonany | `bg-[var(--gym-gold)]` | `Dzień 2: wykonany w tym tygodniu` |
| następny | `bg-transparent shadow-[inset_0_0_0_1.5px_var(--gym-gold)]` | `Dzień 3: następny` |
| wykonany i następny | `bg-[var(--gym-gold)]` + `ring-[1.5px] ring-[var(--gym-gold)]/60 ring-offset-2 ring-offset-[var(--gym-surface)]` | `Dzień 1: wykonany w tym tygodniu, następny` |

Stan nie jest niesiony samym kolorem: wypełnienie vs puste i obrys vs brak obrysu różnią się kształtem i jasnością, a licznik `X / N` podaje to samo liczbowo. N > 7 (np. 10): segmenty się zwężają, `min-w-[6px]` + `gap-1.5` mieszczą 12 dni w 320 px bez przepełnienia; powyżej 12 dni `gap-1`. Brak zawijania.

### Warianty karty tygodnia
| Stan | Siłownia | Cardio |
|---|---|---|
| typowy | `2 / 5` + pasek | `48 min`, `2 sesje` |
| brak historii (pierwsze użycie, AC-2.7) | `0 / 5`, wszystkie segmenty puste, „następny” z obrysem | `0 min`, `brak sesji` |
| wszystko zrobione | `5 / 5`, wszystkie wypełnione | jak typowy |
| brak cardio (AC-2.5) | jak typowy | `0 min`, druga linia `brak sesji` |
| brak planu (AC-2.6) | kolumna znika, siatka `grid-cols-1`, brak paska, brak `0 / 0` | jedyna kolumna |

Minuty cardio pojawiają się tylko tu (BR-9).

## 4. Karta główna (US-3) - cztery warianty, jeden slot

Priorytet: Niedokończony > Następny > Dzień pusty > Brak planu (BR-11). Wszystkie warianty: `app-card relative overflow-hidden p-4`, istniejąca nakładka gradientowa `linear-gradient(165deg, rgba(235,196,74,0.16) 0%, transparent 58%)` zostaje (`aria-hidden`). Tytuł karty to `h2`.

### 4A. „Następny · Dzień N” (domyślny)
```
[Następny · Dzień 3                    ] [glyph 64]
[Push - klatka i barki (max 2 linie)   ]
[6 ćwiczeń · ostatnio 14.10 (9 dni temu)]
---------------------------------------------------
Wyciskanie sztangi leżąc            80 kg × 8
Wyciskanie hantli skos            27,5 kg × 10
Pompki na poręczach                 × 12 powt.
---------------------------------------------------
+ 3 kolejne ćwiczenia
[        ▶ Rozpocznij trening (48 px)        ]
```
- Góra: `flex items-start gap-3`; kolumna tekstu `min-w-0 flex-1`; sylwetka `MuscleGlyph size={64}` `shrink-0`, bez tła (makieta).
- Kicker: `text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]` - `Następny · Dzień 3`.
- Nazwa: `h2 mt-1.5 font-heading text-[22px] font-semibold leading-tight text-white line-clamp-2 [overflow-wrap:anywhere]`, `title={pełna nazwa}`. Na niskich ekranach `[@media(max-height:680px)]:line-clamp-1` (budżet „above the fold”, sekcja 10). Pusta nazwa → `Dzień 3`.
- Meta: `mt-1.5 text-[13px] text-white/60 tabular-nums`.
- Lista ćwiczeń: `<ul class="mt-3 border-t border-white/[0.06]">`, `<li class="flex min-h-8 items-center justify-between gap-3 border-b border-white/[0.06]">`; nazwa `truncate text-[14px] text-white/85` z `title`; wartość `shrink-0 text-[14px] font-semibold tabular-nums text-white`. Lista nieinteraktywna (nie ma celów dotyku).
- `+ N kolejne`: `mt-2 text-[12px] text-white/60` (tylko gdy ćwiczeń > 3).
- CTA: `<Button variant="cta" className="mt-4 w-full">` z `Play` (`fill-current`, `aria-hidden`) - `Rozpocznij trening`.

Linia meta:
| Przypadek | Tekst |
|---|---|
| nigdy nie robiony | `6 ćwiczeń · pierwszy raz` |
| dziś | `6 ćwiczeń · ostatnio 23.10 (dziś)` |
| 1 dzień | `6 ćwiczeń · ostatnio 22.10 (wczoraj)` |
| 2-13 dni | `6 ćwiczeń · ostatnio 14.10 (9 dni temu)` („dni” dla każdej liczby ≥ 2) |
| 14 dni i więcej, ten sam rok | `6 ćwiczeń · ostatnio 02.09` |
| inny rok | `6 ćwiczeń · ostatnio 02.09.2025` |
To zmiana formatu względem `formatPlanLastDoneRelative` („ostatnio 9 dni temu · 14.10”); `frontend` dodaje wariant formatera w `lib/workout-plan-queue.ts`, nie drugą funkcję w komponencie.

Wartość w wierszu ćwiczenia (D-5, AC-3.4..3.7):
| Przypadek | Widoczne | Styl | `sr-only` / `aria-label` wiersza |
|---|---|---|---|
| ciężar i powtórzenia z ostatniej sesji | `80 kg × 8` | biały, semibold | `Wyciskanie sztangi leżąc: ostatnio 80 kg, 8 powtórzeń` |
| ciężar dziesiętny | `27,5 kg × 10` (przecinek, bez zbędnego `,0`) | jw. | `27,5 kg, 10 powtórzeń` |
| ciężar 0 / masa ciała | `× 12 powt.` (nigdy `0 kg`) | jw. | `ostatnio 12 powtórzeń, bez obciążenia` |
| brak historii ćwiczenia (pierwszy raz, nowe w planie, brak ukończonych serii) | `plan 3 × 10` | `font-normal text-white/60` | `w planie 3 serie po 10 powtórzeń` |
| brak historii i brak celu w planie (`sets`/`reps` 0) | `nowe` | `font-normal text-white/60` | `nowe ćwiczenie, bez historii` |
Słowo „plan”/„nowe” odróżnia cel od historii nie tylko kolorem. Nigdy `NaN`, `undefined kg`, puste nawiasy.

Pending startu (AC-3.9): po tapnięciu CTA przycisk `disabled` + `aria-busy="true"`, etykieta `Startuję…` (ikona `Play` zostaje; bez spinnera). Jednocześnie wszystkie inne cele startu na ekranie (wiersze dni, `Start` w menu, CTA w podglądzie) są nieaktywne do zamknięcia wyboru solo/grupa. Zamknięcie arkusza bez wyboru przywraca stan.

### 4B. „Niedokończony trening” (AC-3.12, LR-8, P-5)
Ten sam szkielet karty, mocniejszy akcent: `border-[var(--gym-gold)]/35 shadow-[0_0_40px_rgba(235,196,74,0.12)]` (jak dziś).
- Kicker: `Niedokończony trening`.
- Nazwa: tytuł sesji lub `Trening`; reguły jak 4A.
- Meta: `4 ćwiczenia · Wyciskanie, Wiosłowanie, Przysiad…` (`truncate`, `title` z pełną listą; odmiana pełna, nie `4 ćw.`).
- Info: `text-[13px] text-white/60` - `Zaczęty dziś. Odhaczone serie są zapamiętane.` albo `Sesja w toku. Odhaczone serie są zapamiętane.`
- Sylwetka: `MuscleGlyph` z grup ćwiczeń sesji, jeśli ADR je dostarcza; inaczej brak (nie sztanga, żeby nie udawać braku rozpoznania).
- CTA: `Button variant="cta"` jako `Link` do `/active-workout` - `Kontynuuj trening`.
- Stopka `mt-1 flex items-center justify-between`: 
  - `Link` `/workout-history`: `inline-flex h-11 items-center gap-1.5 px-1 text-[12px] font-semibold text-[var(--gym-gold)]` z `NotebookPen` - `Dziennik obciążeń`;
  - `Button variant="ghost" size="sm"` (40 px + `min-h-11`) - `Porzuć`, kolor `text-white/70`. Nie czerwony (akcja drugorzędna, czerwień dopiero w potwierdzeniu).
- Tap `Porzuć` → `ConfirmDialog`:
  - `title`: `Porzucić trening?`
  - `description`: `Odhaczone serie z tej sesji zostaną usunięte i nie trafią do dziennika. Zapisane wcześniej treningi zostają bez zmian.`
  - `confirmLabel`: `Porzuć trening`; `cancelLabel`: `Wróć do treningu`.
  - Po potwierdzeniu: karta przełącza się na 4A/4C/4D, fokus programowo na `h2` nowej karty (`tabIndex={-1}`), komunikat w regionie `aria-live="polite"`: `Trening porzucony.` Bez modalnego `useSaveFeedback` (akcja nie jest zapisem).
  - Anulowanie / Esc: fokus wraca na `Porzuć` (zachowanie AlertDialog base-ui).

Start innego dnia przy niedokończonym treningu (AC-3.15, LR-8): `beginWorkoutFromPlanRow` wywołuje `store.reset()`, więc dziś tap w wiersz po cichu kasuje niedokończoną sesję. Wymóg UX: gdy `unfinished`, tap w wiersz dnia i `Start` w menu najpierw otwierają `ConfirmDialog`:
- `title`: `Zacząć nowy trening?`
- `description`: `Masz niedokończony trening. Nowy trening zastąpi go, a odhaczone serie zostaną usunięte.`
- `confirmLabel`: `Zacznij nowy`; `cancelLabel`: `Wróć`.
Status: rekomendacja ux zgodna z P-5 i LR-8; koordynator potwierdza zakres (jeśli odrzucone - do backlogu, bez wpływu na resztę specyfikacji).

### 4C. „Dzień N jest pusty” (AC-3.11)
Gdy „następny” nie ma ćwiczeń i żaden dzień ich nie ma (BR-4).
- Kicker: `Następny · Dzień 1`; `h2`: `Dzień 1 jest pusty`; tekst `text-[13px] text-white/65`: `Dodaj ćwiczenia, żeby zacząć trening z planu.`
- Po prawej sztanga w kafelku (jak 6.4, 64 px).
- CTA: `Button variant="cta"` jako `Link` `/profile/workout-plan` z ikoną `PencilLine` - `Uzupełnij plan`. Brak nieaktywnego „Rozpocznij”.

### 4D. Brak planu (AC-3.14, AC-4.9)
- Kicker: `Plan treningowy`; `h2`: `Dodaj plan treningowy`; tekst: `Ustaw dni planu, żeby szybko startować sesję.` (obecny tekst).
- CTA: `Button variant="cta"` jako `Link` `/profile/workout-plan` z ikoną `Plus` - `Ustaw plan`.
- **Decyzja ux dla AC-4.9**: przy braku planów sekcja „Dni planu” nie renderuje się wcale (ani nagłówek, ani drugi CTA). Jedna droga do ustawienia planu na ekranie. Narzędzia zostają. `tester` czyta AC-4.9 w tym brzmieniu.

### 4E. Hydratacja store (AC-3.13)
Do `hydrated === true` slot karty głównej renderuje szkielet: `<div class="app-card min-h-[296px] animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label="Ładowanie treningu">` z trzema blokami `rounded-lg bg-white/[0.05]` (kicker 12×120, tytuł 24×200, przycisk 48×pełna szerokość u dołu). Wysokość 296 px = typowa karta 4A, więc po hydratacji brak skoku. Nie renderować najpierw 4A, a potem 4B.

## 5. Dni planu (US-4)

Nagłówek: `SectionLabel title="Dni planu" titleTone="white"` (bez `index`), `trailing`:
- `Button variant="ghost" size="sm"` z `Download` - `PDF`, `aria-label="Pobierz plan jako PDF"`, klasy `h-11 px-2 text-[12px] text-[var(--gym-gold)]`;
- `Link` `/profile/workout-plan` w tych samych klasach z `PencilLine` - `Edytuj`, `aria-label="Edytuj plan"`.
`trailing` w `SectionLabel` ma `text-[11px] text-white/45` - przekazywane elementy nadpisują kolor i rozmiar.

Panel: `<div class="app-panel"><ul class="divide-y divide-white/[0.06]" aria-label="Dni planu">`. Kolejność Dzień 1..N (stały numer, BR-5), nie kolejka.

### Wiersz dnia
```
<li class="flex items-center">
  <button class="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-1 text-left
                 rounded-l-[16px] hover:bg-white/[0.03] focus-visible:ring-2 ring-inset">
    [kafelek ikony 42]  [nazwa + podpis]  [Następny]
  </button>
  [⋮ 44×44, mr-1.5]
</li>
```
- Kafelek ikony: `relative flex size-[42px] shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[var(--gym-surface-raised)]`, w środku `MuscleGlyph size={32}` (albo sztanga 20 px, 6.4).
- Następny: kafelek `border-[1.5px] border-[var(--gym-gold)]` (zamiast `border-white/8`). Ramka jest na kafelku, nie na całym wierszu: w zwartym panelu ramka wiersza rozbijałaby separatory.
- Ptaszek „wykonany w tym tygodniu”: `absolute -right-[5px] -top-[5px] flex size-4 items-center justify-center rounded-full bg-[var(--gym-gold)] shadow-[0_0_0_2px_var(--gym-surface-sunken)]` z lucide `Check` `size-2.5 text-[var(--gym-on-gold)]` `strokeWidth={3.5}`, `aria-hidden` (informacja jest w etykiecie wiersza).
- Tekst: `min-w-0 flex-1`; nazwa `block truncate text-[15px] font-semibold text-white` (`title` = pełna nazwa; pusta → `Dzień N`); podpis `mt-0.5 block truncate text-[12px] text-white/60 tabular-nums`.
- Etykieta „Następny”: `shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-gold)]`, `aria-hidden` (w etykiecie wiersza).
- Menu ⋮: patrz 5.2.

Podpis wiersza (BR-9, data raz):
| Stan | Podpis |
|---|---|
| zrobiony kiedyś | `Dzień 2 · 5 ćw. · 22.10` (inny rok: `22.10.2025`) |
| nigdy | `Dzień 4 · 3 ćw. · jeszcze nie robiony` |
| 0 ćwiczeń | `Dzień 5 · 0 ćw. · uzupełnij plan` |
| pending (ten wiersz) | `Startuję…` (zastępuje podpis, `aria-live="polite"` na podpisie) |

Dostępna nazwa przycisku wiersza (`aria-label`, AC-6.2, LR-5) - kolejno: akcja, dzień, nazwa, partie, status:
- `Rozpocznij: Dzień 2, Nogi. Partie: nogi, łydki, brzuch. Wykonany w tym tygodniu.`
- `Rozpocznij: Dzień 3, Push. Partie: klatka, barki, ramiona. Następny. Ostatnio 14 października.`
- `Rozpocznij: Dzień 4, Mobilność. Partie nierozpoznane. Jeszcze nie robiony.`
- dzień pusty: `Uzupełnij plan: Dzień 5, brak ćwiczeń.`
Partie małą literą, w kolejności zaznaczenia; biceps/triceps jako `ramiona` (P-3).

Zachowanie:
- Tap wiersza z ćwiczeniami → ten sam start co CTA (wybór solo/grupa). Przy `unfinished` najpierw potwierdzenie z 4B.
- Tap wiersza bez ćwiczeń → nawigacja do `/profile/workout-plan` (nigdy martwy tap, AC-4.7). Wiersz renderowany jako `Link`, nie `button`.
- Przy pending wszystkie wiersze `aria-disabled="true"` i `opacity-60`, ⋮ pozostaje aktywne (podgląd nie startuje sesji).
- Jeden dzień: jeden wiersz, `divide-y` nie rysuje separatora (AC-4.12).
- Dwa dni o tej samej nazwie rozróżnia „Dzień N” w podpisie (AC-4.11).

### 5.2 Menu ⋮ (AC-4.6)
Komponent: `DropdownMenu` z `components/ui/dropdown-menu.tsx` (base-ui Menu: klawiatura, strzałki, Esc, tap poza, zarządzanie fokusem, `aria-haspopup`/`aria-expanded` są wbudowane). Wzorzec użycia jak w `components/admin/admin-users-client.tsx`.
- Trigger: `DropdownMenuTrigger` `className="mr-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-white/70 hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--ring)]"`, ikona `EllipsisVertical` `size-5`, `aria-label="Więcej opcji: Dzień 3, Push"`.
- Content: `align="end" className="w-auto min-w-[13rem] rounded-xl border border-white/10 bg-[var(--gym-surface-raised)] p-1.5 text-white"` (`w-auto` nadpisuje `w-(--anchor-width)`, który dałby 44 px).
- Itemy: `className="min-h-11 gap-3 rounded-lg px-3 text-[14px]"`, ikony `size-4 text-[var(--gym-gold)]`:
  1. `Play` - `Rozpocznij trening` (krótko „Start” w zatwierdzonej makiecie; w menu pełny czasownik czytelniejszy). Dzień pusty: item `disabled`, pod etykietą `text-[12px] text-white/60` `Brak ćwiczeń w tym dniu` (powód widoczny, nie tylko w `title`).
  2. `NotebookPen` - `Dziennik obciążeń` → `/workout-history`.
  3. `ListChecks` - `Podgląd ćwiczeń` → arkusz 5.3.
- Brak pozycji destrukcyjnych. Menu bez animacji poza wbudowanym fade/zoom 100 ms; przy `prefers-reduced-motion` dodać `motion-reduce:animate-none` do Content.

### 5.3 Podgląd ćwiczeń (arkusz)
`Sheet side="bottom"` (istniejący), `max-h-[80dvh]`, przewijana lista, `pb-[env(safe-area-inset-bottom)]`.
- Tytuł (`SheetTitle`): `Dzień 3 · Push - klatka i barki` (`line-clamp-2`).
- Podtytuł: `6 ćwiczeń` + gdy są partie: ` · klatka, barki, ramiona`.
- Lista `divide-y divide-white/[0.06]`, wiersz `min-h-12 flex justify-between gap-3`: nazwa `text-[15px] text-white` (zawija się, bez `truncate` - to jest miejsce na pełne nazwy), cel `shrink-0 text-[14px] text-white/60 tabular-nums` - `3 × 10`; superseria: przed nazwą znacznik `SS` `text-[11px] font-semibold text-[var(--gym-gold)]` z `aria-label="superseria"`. Ostatnich ciężarów tu nie pokazujemy (dane tylko dla „następnego”, ADR).
- Stopka: `Button variant="cta" className="w-full"` `Rozpocznij trening` (zamyka arkusz i startuje; reguły pending/unfinished jak wyżej). Dzień pusty: zamiast listy tekst `Ten dzień nie ma jeszcze ćwiczeń.` i CTA `Uzupełnij plan` (link).
- Zamykanie: Esc, tap w tło, przycisk zamknięcia `Sheet` (`aria-label="Zamknij"`). Fokus po zamknięciu wraca na ⋮.

## 6. `MuscleGlyph` - specyfikacja

Plik: `components/treningi/muscle-glyph.tsx`. Własny rysunek (LR-7: bez zdjęć osób, bez zewnętrznych assetów, bez nowej zależności npm; źródło: zespół GymBrat, ta specyfikacja). Sztanga z `lucide-react` (licencja ISC, już w projekcie).

### 6.1 API (prezentacyjne, bez logiki)
```ts
type GlyphRegion = "barki" | "klatka" | "brzuch" | "plecy" | "ramiona" | "posladki" | "uda" | "lydki";
type MuscleGlyphProps = {
  view: "front" | "back";
  highlighted: GlyphRegion[];   // już po ograniczeniu do max 3 grup (ADR/D-6)
  size?: 24 | 32 | 64;          // px, domyślnie 32
  label?: string;               // gdy podany: role="img" + aria-label; gdy brak: aria-hidden
  className?: string;
};
```
Wybór grup (max 3, P-3 „Ramiona”) i widoku liczy warstwa danych (ADR 0002); komponent tylko rysuje. Mapowanie grupa analityczna → bryła:
| Grupa (`lib/analytics/muscle-groups.ts`) | Bryła | Widok przód | Widok tył |
|---|---|---|---|
| klatka | `klatka` | tak | niewidoczna |
| brzuch | `brzuch` | tak | niewidoczna |
| plecy | `plecy` | niewidoczne | tak |
| pośladki | `posladki` | niewidoczne | tak |
| barki | `barki` (2 bryły) | tak | tak |
| biceps, triceps (= „Ramiona”) | `ramiona` (2 bryły) | tak | tak |
| nogi | `uda` (2 bryły) | tak | tak |
| łydki | `lydki` (2 bryły) | tak | tak |
Widok tył: gdy wybrane zawierają plecy lub pośladki i nie zawierają klatki ani brzucha; inaczej przód. Grupa niewidoczna w wybranym widoku (np. klatka + plecy) nie jest rysowana - informację niesie tekst (etykieta wiersza, podtytuł podglądu). Bez przełącznika widoku.

### 6.2 Geometria (viewBox `0 0 24 24`)
Wszystkie kształty: `stroke-width="1"` + `vector-effect="non-scaling-stroke"` (obrys 1 px w każdym rozmiarze). Odstępy między bryłami ≥ 0,6 j. (≥ 0,8 px przy 32 px).

Wspólne dla obu widoków:
| Bryła | Kształt |
|---|---|
| głowa (zawsze baza) | `<circle cx="12" cy="3" r="2.2"/>` |
| barki L / P | `<rect x="6" y="6" width="2.6" height="2.6" rx="1.3"/>`, `<rect x="15.4" y="6" width="2.6" height="2.6" rx="1.3"/>` |
| ramiona L / P | `<rect x="5.6" y="9.3" width="2.6" height="5.6" rx="1.3"/>`, `<rect x="15.8" y="9.3" width="2.6" height="5.6" rx="1.3"/>` |
| łydki L / P | `<rect x="9.5" y="21" width="2" height="2.6" rx="1"/>`, `<rect x="12.5" y="21" width="2" height="2.6" rx="1"/>` |

Przód:
| Bryła | Kształt |
|---|---|
| klatka | `<rect x="9.3" y="6" width="5.4" height="3.8" rx="1.2"/>` |
| brzuch | `<rect x="9.6" y="10.5" width="4.8" height="4.3" rx="1"/>` |
| uda L / P | `<rect x="9.3" y="15.5" width="2.4" height="4.9" rx="1.2"/>`, `<rect x="12.3" y="15.5" width="2.4" height="4.9" rx="1.2"/>` |

Tył:
| Bryła | Kształt |
|---|---|
| plecy | `<rect x="9.3" y="6" width="5.4" height="6.3" rx="1.4"/>` + kręgosłup `<line x1="12" y1="6.8" x2="12" y2="11.5" stroke-linecap="round"/>` (wyróżnik widoku z tyłu) |
| pośladki L / P | `<rect x="9.3" y="13" width="2.4" height="2.5" rx="1.2"/>`, `<rect x="12.3" y="13" width="2.4" height="2.5" rx="1.2"/>` |
| uda L / P | `<rect x="9.3" y="16.2" width="2.4" height="4.3" rx="1.2"/>`, `<rect x="12.3" y="16.2" width="2.4" height="4.3" rx="1.2"/>` |

Kolory (tokeny z sekcji 0):
| Stan bryły | `fill` | `stroke` |
|---|---|---|
| baza | `var(--gym-glyph-base)` #262626 | `var(--gym-glyph-stroke)` #4a4a4a |
| zaznaczona | `var(--gym-gold)` | `var(--gym-gold-deep)` |
| kręgosłup | - | jak obrys pleców (baza: glyph-stroke; zaznaczone: gold-deep) |

### 6.3 Rozmiary i użycie
| Miejsce | Rozmiar | Kontener |
|---|---|---|
| karta „Następny” | 64 px (`size-16`) | bez kontenera |
| wiersz dnia | 32 px | kafelek 42 px (sekcja 5) |
| 24 px | zarezerwowany (np. przyszły Home); poniżej 24 px nie używać - bryły się zlewają | - |

### 6.4 Brak rozpoznanych mięśni (AC-3.8, AC-4.7)
Zamiast sylwetki lucide `Dumbbell` `text-white/60`, `strokeWidth={2}`:
- wiersz: `size-5` w tym samym kafelku 42 px;
- karta 4A/4C: kafelek `flex size-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-[var(--gym-surface-raised)]` z ikoną `size-8`.
Nie rysujemy pustej (szarej) sylwetki - wyglądałaby jak „żadna partia”, a nie „nie wiemy”.

### 6.5 Dostępność
- W wierszu dnia i karcie: sylwetka `aria-hidden` (bez `label`), bo partie są w nazwie przycisku wiersza / w tekście `sr-only` karty: `<span class="sr-only">Partie: klatka, barki, ramiona.</span>` po metadanych karty. Brak rozpoznania: `Partie nierozpoznane.`
- Gdy sylwetka występuje samodzielnie (bez tekstu obok), `label` = `Partie mięśni: klatka, barki, ramiona` → `role="img"`.
- Kontrast niegraficzny: zaznaczenie złote vs baza ≈ 7:1 (spełnia 1.4.11); baza vs tło karty jest niska celowo - kształt sylwetki jest dekoracyjny, informację niosą zaznaczenia i tekst.

## 7. Narzędzia (US-5, P-1)

`SectionLabel title="Narzędzia" titleTone="white"`, pod nim `<ul class="grid grid-cols-3 gap-2.5">`. Kafelek: `Link` z klasami `app-panel flex min-h-[88px] flex-col justify-between p-3 hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-[var(--ring)]`; ikona `size-5 text-[var(--gym-gold)]` `aria-hidden`; tytuł `text-[13px] font-semibold leading-tight text-white` (może zawinąć do 2 linii przy 320 px); opis `mt-0.5 text-[12px] text-white/60`.

| Kafelek | Ikona | Tytuł | Opis | Cel |
|---|---|---|---|---|
| 1 | `Footprints` | Dodaj cardio | marsz, bieg | `/cardio` |
| 2 | `History` | Dziennik | historia | `/workout-history` |
| 3 | `Video` | Technika | filmy | `/technique` |
Dostępna nazwa = tytuł + opis (np. „Dziennik, historia”). Brak minut cardio w kafelku (BR-9). Słowo „Postępy” nie występuje (AC-5.3).

## 8. Pozostałe stany ekranu

| Stan | Zachowanie |
|---|---|
| Ładowanie trasy (RSC) | istniejący `app/(dashboard)/loading.tsx` / `DashboardRouteSkeleton` - bez zmian w tym zadaniu. Uwaga do backlogu: szkielet o kształcie tego ekranu (nagłówek 58, karta 104, karta 296, panel 5×64) ograniczyłby skok układu; niski priorytet. |
| Hydratacja karty | 4E |
| Pending startu | 4A, 5 |
| Pusty (pierwsze użycie bez planu) | 3 (tylko cardio) + 4D + Narzędzia; sekcja Dni planu ukryta |
| Plan bez historii | `0 / N`, „pierwszy raz”, wartości `plan 3 × 10`, wszystkie wiersze „jeszcze nie robiony” |
| Częściowe dane (brak ostatnich obciążeń, błąd parsowania sesji, brak grup) | każdy element ma zamiennik: `plan 3 × 10` / `nowe`, sztanga; nigdy komunikat błędu w miejscu karty (AC-3.10). Brak serii tygodni → chip ukryty. |
| Błąd serwera (dane ekranu nie przyszły) | istniejąca granica `app/(dashboard)/error.tsx` („Coś poszło nie tak”, kod referencyjny, „Spróbuj ponownie”). Bez nowego wariantu. |
| Błąd startu grupowego | jak dziś: `notifyError` z komunikatem serwera lub `Nie udało się utworzyć sesji grupowej. Spróbuj ponownie albo zacznij solo.` (doprecyzowana kopia: co zrobić). |
| Offline | ekran pozostaje (dane z ostatniego renderu); start solo działa lokalnie, zapis trafia do istniejącej kolejki outbox. Nowego banera offline nie dodajemy (brak globalnego wskaźnika w systemie - pozycja backlogu w `00-system-projektowy-stan.md`). Start grupowy offline: komunikat jak przy błędzie startu grupowego. |
| Brak uprawnień | niezalogowany / bez profilu: istniejąca rama `AuthPageFrame` w `app/(dashboard)/layout.tsx`. Bez zmian. |
| Sukces | start → przejście do `/active-workout` (sukces = zmiana ekranu, bez toastu); porzucenie → `Trening porzucony.` w `aria-live`. |
| Zmiana tygodnia (AC-1.3) | po powrocie na kartę (visibilitychange/focus) zakres, segmenty i licznik dotyczą nowego tygodnia; bez animacji i bez komunikatu. |

## 9. Mikrokopia - komplet (PL)

| Klucz | Tekst |
|---|---|
| tytuł ekranu | Trening |
| zakres | Tydzień 20–26.10 / Tydzień 27.10–02.11 |
| seria | N tyg. z rzędu (aria: 1 tydzień / 2-4 tygodnie / 5+ tygodni z rzędu z treningiem) |
| etykiety karty tygodnia | Siłownia, Cardio |
| cardio | 48 min · 1 sesja / 2 sesje / 5 sesji; zero: 0 min, brak sesji |
| kicker | Następny · Dzień 3 / Niedokończony trening / Plan treningowy |
| meta | 1 ćwiczenie / 2 ćwiczenia / 5 ćwiczeń / 12 ćwiczeń / 22 ćwiczenia · ostatnio 14.10 (9 dni temu) / (wczoraj) / (dziś) / pierwszy raz |
| więcej | + 1 kolejne ćwiczenie / + 2 kolejne ćwiczenia / + 5 kolejnych ćwiczeń / + 12 kolejnych ćwiczeń / + 22 kolejne ćwiczenia |
| wartości | 80 kg × 8 · 27,5 kg × 10 · × 12 powt. · plan 3 × 10 · nowe |
| CTA | Rozpocznij trening / Startuję… / Kontynuuj trening / Uzupełnij plan / Ustaw plan |
| pusty dzień | Dzień 1 jest pusty · Dodaj ćwiczenia, żeby zacząć trening z planu. |
| brak planu | Dodaj plan treningowy · Ustaw dni planu, żeby szybko startować sesję. |
| niedokończony | Zaczęty dziś. / Sesja w toku. + Odhaczone serie są zapamiętane. · Dziennik obciążeń · Porzuć |
| potwierdzenie porzucenia | Porzucić trening? · Odhaczone serie z tej sesji zostaną usunięte i nie trafią do dziennika. Zapisane wcześniej treningi zostają bez zmian. · Porzuć trening · Wróć do treningu |
| potwierdzenie nowego startu | Zacząć nowy trening? · Masz niedokończony trening. Nowy trening zastąpi go, a odhaczone serie zostaną usunięte. · Zacznij nowy · Wróć |
| porzucono (aria-live) | Trening porzucony. |
| sekcje | Dni planu (PDF, Edytuj) · Narzędzia |
| podpis wiersza | Dzień 2 · 5 ćw. · 22.10 / jeszcze nie robiony / uzupełnij plan |
| znacznik | Następny |
| menu | Rozpocznij trening · Dziennik obciążeń · Podgląd ćwiczeń · (powód) Brak ćwiczeń w tym dniu |
| podgląd | Dzień 3 · {nazwa} · 6 ćwiczeń · klatka, barki, ramiona · Ten dzień nie ma jeszcze ćwiczeń. |
| narzędzia | Dodaj cardio (marsz, bieg) · Dziennik (historia) · Technika (filmy) |
| nazwy partii (sr) | klatka, plecy, barki, ramiona, nogi, pośladki, łydki, brzuch · Partie nierozpoznane. |

Odmiana `kolejne`: forma „few” = `kolejne ćwiczenia`, „many” = `kolejnych ćwiczeń`, „one” = `kolejne ćwiczenie`. Skrót `ćw.` (podpis wiersza) jest nieodmienny.

## 10. Responsywność

- 320 px: wszystko w jednej kolumnie, brak poziomego przewijania; „Następny” + ⋮ + kafelek mieszczą się, nazwa przycinana (makieta `#p320`). Kafelki narzędzi ok. 92 px, tytuł może zawinąć do 2 linii.
- 360-430 px: układ docelowy (makieta 380).
- `sm` i szerzej: ta sama kolumna (`APP_SHELL_MAX`); nagłówek `text-[28px]`; brak zmian siatki.
- Budżet „above the fold” 360×640 (AC-6.4): nagłówek aplikacji ok. 56 + nagłówek ekranu 58 + karta tygodnia 104 + odstępy 2×20 + karta „Następny” do dolnej krawędzi CTA ok. 270 (nazwa 1 linia) = ok. 530 px, czyli powyżej pływającej belki i FAB „Raport” (ok. 90 px od dołu). Dlatego `line-clamp-1` dla nazwy przy `max-height: 680px`. `tester` weryfikuje zrzutem 360×640 z 3 ćwiczeniami i linią „+ N kolejne”.
- Android WebView: cele 44 px, arkusz z `safe-area-inset-bottom`, menu otwierane w górę, gdy brak miejsca (base-ui robi to automatycznie przez `side` flip).

## 11. Dostępność (WCAG 2.2 AA, LR-5)

- Cele dotyku: wiersz 64 px wysokości, ⋮ 44×44, PDF/Edytuj 44 px wysokości, kafelki 88 px, CTA 48 px, `Porzuć` min. 44 px, itemy menu 44 px. Brak celów 28/36 px.
- Kolejność fokusu = DOM: nagłówek → karta tygodnia (brak elementów fokusowalnych) → CTA karty (i stopka w 4B) → PDF → Edytuj → [wiersz → ⋮] × N → kafelki.
- Fokus: globalny `:focus-visible` + `Button` ring; wiersz `ring-inset` (żeby nie był ucinany przez `overflow-hidden` panelu).
- Teksty alternatywne: segmenty (3), wiersze (5), sylwetka (6.5), seria i zakres tygodnia (2).
- Stan nie tylko kolorem: wykonany = wypełnienie + ptaszek (kształt) + tekst; następny = obrys + słowo „Następny” + tekst; cel vs historia = prefiks „plan”/„nowe”.
- Kontrast: tekst ≥ `white/60`; złoto #ebc44a na #141416/#161616 ≈ 10:1; `#1A1408` na złocie ≈ 11:1.
- Ruch: sekcja 0; szkielet z `motion-reduce:animate-none`.
- Nagłówki: `h1` Trening; `h2`: Ten tydzień (sr-only), tytuł karty głównej; sekcje Dni planu i Narzędzia jako `h2` (przekazać `SectionLabel` tytuł w `h2` - jeżeli komponent renderuje `span`, `frontend` dodaje prop `as` w `SectionLabel`, nie tworzy nowego komponentu).

## 12. Lista kontrolna dla `frontend` i `tester`

1. Brak `D1..Dn`, kickera „PLAN · …”, chipu „Wykonano”, „Dziś”, stopki gestów, sekcji 02-04, kafelka Rekordy.
2. Brak hexów w JSX poza tokenami; brak `emerald-*`; brak `gold-btn` (używany `Button variant="cta"`).
3. Wszystkie stany z sekcji 4 i 8 osiągalne w testach (fixtures: brak planu, plan pusty, 1 dzień, 7 dni, 10 dni, długie nazwy 60 znaków bez spacji, ciężar 0, ciężar 52,5, brak historii, niedokończony dziś / wczoraj).
4. Odmiany z sekcji 9 pokryte testem jednostkowym (1, 2, 4, 5, 12, 14, 21, 22, 25).
5. `aria-label` wierszy i `sr-only` segmentów zgodne z sekcjami 3 i 5.
6. Zrzuty bazowe do regresji wizualnej (zatwierdza ux): 320 i 380 px dla: typowy, brak planu, niedokończony, plan pusty.

## Werdykt

ZATWIERDZONE Z UWAGAMI.

Uwagi:
1. Potwierdzenie przed startem nowego dnia przy niedokończonym treningu (4B) to rekomendacja ux wynikająca z LR-8 i P-5 - koordynator potwierdza, czy wchodzi w zakres.
2. AC-4.9 interpretowane jako „sekcja Dni planu ukryta przy braku planów” - `analityk`/`tester` przyjmują to brzmienie.
3. AC-1.2 (pełna odmiana serii) realizowana przez `aria-label`; widoczny tekst to zatwierdzony skrót „N tyg. z rzędu”.
4. Kontrakt danych dla sylwetki (lista max 3 grup po scaleniu „Ramiona”, widok przód/tył) i dla wartości ćwiczenia (ciężar, powtórzenia, cel planu) musi wynikać z ADR 0002; komponent tylko rysuje.
5. Backlog (niski): szkielet trasy o kształcie ekranu Trening; globalny wskaźnik offline.

## Przegląd wizualny (etap 8)

Autor: ux. Data: 2026-10-24. Razem z etapem 7 (spójność; `tester`: `docs/testy/003-przebudowa-ekranu-trening.md`).

### Metoda i ograniczenia
Aplikacji nie uruchamiałem (brak konta i bazy). Komponenty hubu wyrenderowałem w izolacji: esbuild (kod z repozytorium, `next/link` i eksport PDF zastąpione stubami), CSS z prawdziwego `app/globals.css` przez Tailwind 4, Edge/Playwright, 320 i 380 px (DPR 2) oraz 360x640. Stany: typowy, niedokończony, pending, dzień pusty, brak planu, skrajne (10 dni, nazwa 60 znaków bez spacji, data z innego roku), menu ⋮ (także pozycja wyłączona), arkusz podglądu, `ConfirmDialog`, fokus klawiatury, sylwetki w 32 i 64 px (DPR 1 i 2). Pliki robocze są w katalogu tymczasowym sesji, poza repozytorium.
Nie zobaczyłem: ramy `AppShell` (nagłówek, belka dolna, FAB „Raport”), `loading.tsx`, Androida WebView, prawdziwych danych, szkieletu hydratacji (tylko z kodu), jasnego motywu (aplikacja jest tylko ciemna).

### Zgodność ze specyfikacją (potwierdzone)
- Układ, kolejność DOM, rytm `space-y-5` / `space-y-2.5`, typografia (kicker 11, nazwa 22, meta 13, wiersz 15/12), liczby `tabular-nums`: zgodne. Brak poziomego przewijania w 320 i 380 px; 10 segmentów mieści się w 320 px.
- Tokeny: w `components/treningi/**` brak hexów, `emerald-*`, `gold-btn`, `framer-motion` i `white/45` lub niżej. Jedyny surowy kolor to `rgba(235,196,74,…)` w `main-card-shell.tsx` (gradient i poświata zatwierdzone w specyfikacji, ten sam odcień co `--gym-gold`). Zielony nie występuje na ekranie.
- Mikrokopia PL i LR-6: zgodna z sekcją 9, bez presji, bez płomienia, bez „brawo”. Odmiany poprawne (1 tydzień / 2 tygodnie, „+ 1 kolejne ćwiczenie”, „+ 3 kolejne ćwiczenia”).
- Stan nie tylko kolorem: wykonany = wypełnienie + ptaszek + tekst; następny = obrys + słowo „Następny”; „plan 3 × 10” vs wartość historyczna. Potwierdzone na zrzutach.
- Cele dotyku (pomiar w DOM): wszystkie przyciski i linki >= 44x44, w tym ⋮, pozycje menu i `Zamknij` arkusza (44x44).
- Fokus: pierścień wiersza `ring-inset` widoczny i nieucięty; po Esc w menu i po zamknięciu arkusza fokus wraca na ⋮ właściwego dnia (zmierzone).
- `MuscleGlyph`: geometria 1:1 ze specyfikacją 6.2, tokeny `--gym-glyph-*`. Przy 64 px czytelny we wszystkich kombinacjach (przód, tył z kręgosłupem, uda, łydki, brzuch). Przy 32 px czytelny dla klatki, barków+ramion, pleców, ud i brzucha; łydki (ok. 2,7 px) i same barki to małe kropki, rozpoznawalne tylko jako „coś złotego”, co jest akceptowalne, bo partie niesie tekst (sr-only, podpis podglądu). Kręgosłup przy 32 px prawie niewidoczny (wyróżnik widoku z tyłu działa dopiero w 64 px). Bez zmian geometrii.

### Decyzje w sprawie odstępstw frontendu
1. `ConfirmDialog` z kopią ux zamiast `WorkoutDiscardSessionDialog`: ZATWIERDZONE. Jedyny czerwony akcent na ekranie, jak w 4B; kosz trafnie opisuje skutek (serie są usuwane); „Wróć do treningu” jest wyraźnie drugi w hierarchii. Brak własnej kopii dialogu = brak duplikatu.
2. Teksty czytnika w `sr-only` zamiast `aria-label` na `<span>`: ZATWIERDZONE, lepsze niż zapis w specyfikacji (`aria-label` na elemencie bez roli bywa pomijany). Sekcje 2 i 5 czytać jako „treść `sr-only`”; `tester` sprawdza AC-1.2 w tekście `sr-only`.
3. Grupa `nogi` rysowana jako uda: ZATWIERDZONE, zgodne z tabelą 6.1 (`nogi` = `uda`, łydki osobno).
4. Wyłączona pozycja menu z `opacity-50`: ODRZUCONE w obecnej formie (F-2).

### Odchylenia i poprawki dla `frontend`
| ID | Priorytet | Plik, linia | Opis i oczekiwana poprawka |
|---|---|---|---|
| F-1 | Wysoki | `components/treningi/plan-day-row.tsx:83-101` | 320 px: etykieta „Następny” zabiera ok. 85 px; nazwa dnia zostaje „Push - klat…”, a podpis „Dzień 3 · 6 ćw. · …” traci datę; podobnie „jeszcze nie ro…” w dniu 4. To utrata informacji, nie tylko przycięcie nazwy (spec 10 dopuszczał przycięcie samej nazwy). Poprawka: podpis `line-clamp-2` zamiast `truncate`, a przy braku miejsca nazwa traci szerokość, nie podpis; słowo „Następny” zostaje tekstem (stan nie tylko ramką). Po poprawce zrzut 320 do akceptacji ux. |
| F-2 | Wysoki (LR-5) | `components/treningi/plan-day-row.tsx:145-158` | Wyłączona pozycja „Rozpocznij trening” dla dnia pustego dziedziczy `data-disabled:opacity-50`; zmierzone: opacity 0,5 razy `white/60` daje ok. 30% bieli (ok. 2,3:1). Powód „Brak ćwiczeń w tym dniu” jest treścią informacyjną i wymaga >= 4,5:1. Poprawka: `data-disabled:opacity-100` na pozycji, przyciemnić tylko etykietę i ikonę (`opacity-50`), powód zostawić w `text-white/60`. |
| F-3 | Średni | `next-workout-card.tsx`, `treningi-header.tsx`, `week-progress-card.tsx` | Budżet „above the fold” 360x640 (AC-6.4) prawdopodobnie niespełniony. Zmierzone w izolacji (bez ramy aplikacji): nagłówek 84 px (spec 58), karta tygodnia 136 px (spec 104), CTA kończy się na y = 583 px; z nagłówkiem `AppShell` (ok. 56 px) to ok. 640 px, a belka z FAB zaczyna się ok. 90 px od dołu. Przyczyna częściowo w specyfikacji (szacunki 58/104 były za niskie, luka projektowa po stronie ux). Poprawka: przy niskim ekranie pokaż 2 ćwiczenia zamiast 3, ukryj „+ N kolejne”, `mt-4` paska tygodnia zmniejsz do `mt-3`. `tester` weryfikuje zrzutem 360x640 w prawdziwej aplikacji; CTA ma być w całości nad belką. |
| F-4 | Średni | `app/globals.css:6-7` vs `main-card-shell.tsx:10` | Dwa różne progi niskiego ekranu: wariant `compact` (max-height 719 px, zadanie 004) i `[@media(max-height:680px)]`. Ujednolicić na `compact`. Uwaga: w diffie `globals.css` są też tokeny zadania 004 (`--gym-success`, `--gym-trend-down`, `--gym-skipped`); nie należą do 003 i nie są użyte na ekranie Trening. |
| F-5 | Niski | `plan-days-panel.tsx:57-63` | Link „Edytuj” nie ma hover jak sąsiedni `Button ghost` „PDF”. Użyj `buttonVariants({variant:"ghost",size:"sm"})` albo dodaj te same klasy hover. |
| F-6 | Niski | `plan-day-row.tsx:111,123` | Pending: cały wiersz `opacity-60` obniża kontrast do ok. 3:1; stan przejściowy i nieaktywny (1.4.3 wyłącza), więc akceptuję, ale lepiej przyciemnić kafelek i nazwę, a „Startuję…” zostawić w pełnym `white/60`. |
| F-7 | Niski | `treningi-hub.tsx:31-35` | Szkielet: `aria-label` na `div` bez roli nie jest ogłaszany. Dodać `role="status"` albo `sr-only` „Ładowanie treningu”. |
| F-8 | Niski (system) | `.font-metric` w `app/globals.css` | Playfair Display ma domyślnie cyfry oldstyle: „0 min” wygląda jak „o min”, „125” ma cyfry różnej wysokości; `tabular-nums` tego nie zmienia. Wzorzec całej aplikacji (50 plików), nie blokuje. Rekomendacja: `font-variant-numeric: lining-nums tabular-nums` w `.font-metric` jako osobne zadanie (dotyka Home i Postępy); decyzja ux: TAK. |
| F-9 | Niski | `main-card-shell.tsx:31,35` | Surowe `rgba(235,196,74,…)`; zastąpić `color-mix(in srgb, var(--gym-gold) 12%, transparent)`. Hex `#1A1408` w `components/meal-suggestions/diet-diary-panel.tsx:560` i `meal-suggestions-view.tsx:158` powinien używać `--gym-on-gold` (poza zakresem 003, backlog systemowy). |

### Spójność z resztą aplikacji (etap 7, strona ux)
- Użyte istniejące komponenty: `AppPageHeader`, `SectionLabel` (prop `titleAs`, bez nowego komponentu), `app-card`/`app-panel`, `Button variant="cta"`, `Sheet`, `DropdownMenu`, `ConfirmDialog`, `AnimatedMetric`. Nowy jest tylko `MuscleGlyph`, zgodnie ze specyfikacją. Brak zdublowanych wzorców.
- Różnica względem Home i Dieta: tam `SectionLabel` ma numerację 01-05 i złoty tytuł; Trening ma biały tytuł bez indeksu (jak Postępy, zgodnie z sekcją 0). Świadome, nie błąd.
- Po poprawkach F-1..F-3 dopiszę do `docs/ux/00-system-projektowy-stan.md`: `MuscleGlyph`, tokeny `--gym-glyph-base`, `--gym-glyph-stroke`, `--gym-on-gold`, `SectionLabel.titleAs`.
- Zrzuty bazowe (320 i 380 px: typowy, brak planu, niedokończony, dzień pusty): jeszcze nie zatwierdzam; będą wzorcowe po F-1, F-2, F-3, bo zmieniają wygląd.
- Luka projektowa (moja): budżet wysokości z sekcji 10 (58/104/270 px) był zaniżony; przyjmuję wartości zmierzone (84/136) i zastępuję go wymaganiem F-3.

### Werdykty
- Etap 7, spójność wyglądu i komponentów (ux): ZATWIERDZONE Z UWAGAMI (F-4, F-5, F-8, F-9; backlog frontend).
- Etap 8, przegląd wizualny (pierwszy przebieg): ZATWIERDZONE Z UWAGAMI pod warunkiem poprawek F-1 i F-2 oraz weryfikacji F-3. Wynik ponownego przeglądu: sekcja poniżej.

### Ponowny przegląd (etap 8, delta, 2026-10-24)
Metoda jak wyżej (esbuild + prawdziwy `globals.css` + Edge/Playwright, DPR 2; 320, 380, 360x640; dodatkowo replika ramy: nagłówek 56 px, belka i FAB „Raport” z klas `app-shell.tsx`; na `/workout-plan` FAB jest widoczny). Nie widziałem prawdziwego `AppShell` (logo z brandingu daje nagłówek do 64 px) ani fontów produkcyjnych.

| ID | Wynik | Pomiar |
|---|---|---|
| F-1 | OK | 320 px: podpis zawija się do 2 linii i zachowuje datę („Dzień 3 · 5 ćw. · 14.10”, „… jeszcze nie robiony”); nazwa przycinana, „Następny” jako tekst; brak poziomego przewijania (scrollWidth 320), także dla nazwy 49 znaków bez spacji. Nazwa dnia 3 skraca się do „Push - klat…” - akceptowane (spec 10). |
| F-2 | OK | Powód „Brak ćwiczeń w tym dniu”: biel 60% na `rgb(28,28,31)`, opacity przodków = 1, kontrast ok. 6,8:1 (>= 4,5:1). Przyciemnione tylko etykieta i ikona (opacity 0,5), pozycja ma `aria-disabled`. |
| F-4, F-5, F-7, F-9, T-3 | OK z kodu i zrzutów | jeden próg `compact`; gradient karty bez zmiany wyglądu; szkielet z `role="status"`; `aria-live` stały na podpisie. |
| F-6 | pominięte, akceptuję | stan przejściowy (1.4.3 wyłącza). |
| F-8 | zostaje | decyzja systemowa, osobne zadanie. |
| F-3 | CZĘŚCIOWO | 360x640 z replika ramy: CTA y = 499-547 px; FAB „Raport” y od 517,6 (x 122-238), górna krawędź belki y = 541,6. CTA jest więc zasłonięte przez FAB o ok. 29 px (środek etykiety „Rozpocznij trening”) i przez belkę o ok. 5 px w pierwszym widoku. Poprawa względem pierwszego przebiegu: CTA o ok. 93 px wyżej względem zakładanych ok. 640 (karta tygodnia 130 zamiast 136 px, 2 ćwiczenia, bez „+ N kolejne”). Przy nagłówku 64 px (logo) zasłonięcie rośnie o 8 px. Po przewinięciu CTA jest w pełni dostępne (`pb` 124 px zostawia miejsce nad belką i FAB), więc to nie jest martwy cel, tylko niespełnione AC-6.4 dla ekranu o wysokości 640 px. |

Margines bezpieczeństwa, którego brakuje: do czystego CTA nad FAB potrzeba jeszcze ok. 35-45 px. Rekomendacja (niski priorytet, backlog `frontend`, `compact`): `space-y-3` zamiast `space-y-5` (-16 px), karta tygodnia `p-3` i `mt-3` paska (-12 px), jedno ćwiczenie zamiast dwóch (-32 px). Ekrany >= 720 px wysokości nie są dotknięte.

Zrzuty bazowe (ZATWIERDZAM): typowy 320 i 380 (pełna strona), menu ⋮ z wyłączoną pozycją 320 i 380, nazwa 49 znaków bez spacji 320, widok 360x640 z ramą jako wzorzec „stan znany, F-3 w backlogu”. Stany niedokończony, dzień pusty i brak planu: zatwierdzone z poprzedniego przebiegu (kod tych wariantów nie zmienił wyglądu; zmiana gradientu F-9 ma tę samą wartość koloru).

Wpisano do `docs/ux/00-system-projektowy-stan.md`: `MuscleGlyph`, tokeny `--gym-glyph-base`, `--gym-glyph-stroke`, `--gym-on-gold`, `SectionLabel.titleAs`.

Werdykt ponownego przeglądu: ZATWIERDZONE Z UWAGAMI (F-3: AC-6.4 spełnione tylko częściowo przy 360x640, ryzyko niskie, właściciel `frontend`).

### Trzeci przebieg (etap 8, wariant `compact`, 2026-10-24)
Metoda jak w drugim przebiegu (esbuild + prawdziwy `globals.css` + Edge/Playwright, DPR 2, replika ramy: nagłówek 56 i 64 px, belka i FAB „Raport” z klas `app-shell.tsx`; store niedokończonego treningu ustawiany przed renderem). Nie widziałem prawdziwego `AppShell`, logo ani fontów produkcyjnych (fallback szeryfowy; wysokości linii mogą się różnić o kilka px).

| Pomiar (y w px od góry viewportu) | 360x640, nagłówek 56 / 64 | 320x568, nagłówek 56 / 64 | 380x720 (powyżej `compact`) |
|---|---|---|---|
| dolna krawędź CTA | 481 / 489 | 500,5 / 508,5 | 617 / 625 |
| górna krawędź FAB / belki | 517,6 / 541,6 | 445,6 / 469,6 | 597,6 / 621,6 |
| zapas CTA nad FAB / nad belką | +36,6 / +60,6 (64 px: +28,6 / +52,6) | -54,9 / -30,9 (64 px: -62,9 / -38,9) | -19,4 / +4,6 (64 px: -27,4 / -3,4) |

- **F-3 / AC-6.4 przy 360x640: SPEŁNIONE.** CTA „Rozpocznij trening” (y 433-481, nagłówek 64 px: 441-489) kończy się powyżej FAB (517,6) i belki (541,6). Poprawa względem poprzedniego przebiegu o 66 px (CTA 499-547). Karta tygodnia 121,5 px, karta „Następny” 206,5 px (1 ćwiczenie, bez „+ N kolejne”), odstępy 12 px. Brak poziomego przewijania (scrollWidth = szerokość viewportu we wszystkich wariantach).
- 320x568 (bardzo niski ekran): AC-6.4 nie dotyczy (wymaganie definiuje 360x640), ale CTA wchodzi pod FAB o ok. 55 px i pod belkę o ok. 31 px; po przewinięciu dostępne (`pb` zostawia miejsce). Backlog niski, bez wymogu.
- Powyżej `compact`: wszystkie nowe klasy mają prefiks `compact:` (diff), więc układ >= 720 px się nie zmienił. 380x800 i 360x800: karta tygodnia 133,5, karta główna 308,5, CTA 569-617, FAB 677,6 (zapas 60 px); 3 ćwiczenia i „+ 2 kolejne ćwiczenia” widoczne. Uwaga (backlog niski, właściciel `ux`/`frontend`): próg 719 px tworzy klif; dla wysokości 720-739 px (nagłówek 56 px; do 747 px przy 64 px) CTA jest jeszcze do 27 px pod FAB (przy 720 px: 19 / 27 px; belka: zapas +4,6 / -3,4 px). Do rozważenia podniesienie progu `compact` do ok. 750 px (zmiana wspólna z zadaniem 004, wymaga sprawdzenia ekranu aktywnego treningu).
- **Usunięcie szkieletu, stany:** brak planu (karta cardio 101,5 px + „Dodaj plan treningowy” + „Ustaw plan”, sekcja Dni planu ukryta, CTA 376-424 przy 360x640), dzień pusty („Dzień 4 jest pusty”, „Uzupełnij plan”, CTA 415,5-463,5) i typowy renderują się od razu z danych serwera, bez pustych miejsc, nakładania i przewijania poziomego; CTA wszystkich trzech nad FAB przy 360x640. Wygląd bez regresji.
- **„Niedokończony” vs „Następny” (podmiana po zamontowaniu):** góra karty stabilna (y 233,5 bez ramy, 289,5 z ramą), ale wysokość się zmienia, więc treść poniżej przesuwa się. Poza `compact` (min-h 296): 308,5 -> 296, przesunięcie w górę o 12,5 px; CTA przeskakuje o 109,5 px w górę (569 -> 459,5), bo karta „Niedokończony” nie ma listy ćwiczeń. W `compact` (min-h 0): 206,5 -> 243 (360x640) i 226 -> 243 (320x568), przesunięcie w dół o 36,5 / 17 px, CTA o 11,5 px w górę. Wniosek: bez skoku górnej części karty i nagłówka, ale „bez skoku układu” spełnione tylko dla elementów nad kartą; przesunięcie poniżej to jednorazowe 12-37 px zaraz po hydratacji (CTA „Kontynuuj trening” 421,5-469,5 przy 360x640, nad FAB). Akceptuję (niskie ryzyko: dotyczy tylko użytkowników z niedokończoną sesją, dzieje się przed interakcją). Ewentualne dopracowanie (backlog): rezerwować wysokość karty „Następny” w `compact` (min-h ok. 243) tylko jeśli pomiar CLS w produkcji to potwierdzi.
- Niedokończony 360x640: stopka „Dziennik obciążeń / Porzuć” kończy się y = 532,5 (FAB zaczyna się 517,6 w środku, x 122-238): tekst odsłonięty (y ok. 495-515), pole dotyku linku 7 px pod FAB w okolicy x 122-160; drobne, bez wpływu na kontrast i tekst.

**Zrzuty bazowe (ZATWIERDZAM, tylko w katalogu tymczasowym sesji, poza repozytorium):** typowy 360x640 z ramą (nagłówek 56 i 64), 320x568, 380x720, 380x800 i 360x800; niedokończony 360x640, 320x568, 380x800; brak planu 360x640, 320x568, 380x800; dzień pusty 360x640, 320x568, 380x800. Zastępują zrzut „stan znany, F-3 w backlogu” z poprzedniego przebiegu.

Werdykt trzeciego przebiegu: ZATWIERDZONE Z UWAGAMI. F-3 zamknięte (AC-6.4 spełnione przy 360x640). Uwagi niskiego ryzyka do backlogu: klif progu `compact` (720-755 px), CTA pod FAB przy 320x568, jednorazowe przesunięcie 12-37 px przy podmianie na „Niedokończony”.
