# 005 - Koniec treningu: specyfikacja ekranów zakończenia, dialogów i stanów zapisu

- **Autor**: ux (etap 4 zadania 005)
- **Data**: 2026-10-25
- **Karta**: `docs/zadania/005-koniec-treningu-przeplyw.md` (polecenie, decyzje właściciela p. 7-8)
- **Wejście**: `docs/analiza/005-koniec-treningu-przeplyw.md` (P1-P10, AC, BR, E-1..E-17), `docs/prawo/005-koniec-treningu-przeplyw-wejscie.md` (LR-1..LR-8), `docs/adr/0004-koniec-treningu-przeplyw.md` (kontrakty, hook, lista plików), `docs/ux/00-system-projektowy-stan.md`, `docs/ux/004-ekran-aktywnego-treningu.md` (tokeny i CTA ekranu treningu)
- **Źródło wizualne**: makiety właściciela w artefakcie Claude (kierunek zaakceptowany). Ten dokument przenosi kierunek na istniejące tokeny i komponenty repo. Gdy makieta i ten dokument się różnią, wygrywa dokument, a różnicę zgłasza się w sekcji 13.
- **Zakres**: ekran aktywnego treningu (krok „ostatnia seria”), dialog pominiętych serii, dialog potwierdzenia zakończenia (pasek globalny i menu), ekran „Zapisuję trening…”, ekran „Trening zakończony” (w tym „Zobacz postęp” i pasek cardio). Nie obejmuje ekranu serii poza krokiem zakończenia (004), historii treningu ani kolejki offline poza stanem zapisu.

---

## 0. Kluczowe decyzje UX

1. **Jedna nazwa zdarzenia: „Trening zakończony”.** Nie występują: „Trening zrobiony”, „Trening zapisany”, „Koniec treningu” (jako stan przerwy), „Gotowe”, „OK”, „Zapisz i zamknij”.
2. **Jeden kolor akcji zakończenia: złoty.** Każdy przycisk kończący lub zapisujący trening i każdy przycisk „Zamknij” na ekranie końcowym używa `Button variant="cta"` (klasa `gym-btn-primary`, tekst `--neon-fg`). Czerwony `#FF1A4B` znika z przepływu. Czerwień zostaje tylko w znaczeniu semantycznym: spadek tonażu, błąd, usunięcie cardio.
3. **Zero nowych tokenów.** Wszystkie kolory, odstępy i promienie pochodzą z istniejących zmiennych (sekcja 2). Nie tworzymy `--gym-on-gold` (004 już wskazało, że ta rola jest pokryta przez `--neon-fg`; dokument 003 wprowadził duplikat, wpisany w backlog systemowy).
4. **Zapis zanim cokolwiek zostanie pokazane.** Ekran „Trening zakończony” pojawia się wyłącznie po zakończonym zapisie (sukces albo kolejka offline). Nigdy przed zapisem i nigdy po błędzie (BR-1).
5. **Każde wejście w zakończenie ma dokładnie jedno potwierdzenie.** Trzy wejścia (główny przycisk ostatniej serii, pasek globalny, menu sesji) prowadzą do tej samej logiki:
   - są pominięte lub niewykonane serie → dialog pominiętych serii (sekcja 6), bez dodatkowego pytania;
   - brak takich serii → ostatnia seria zapisuje od razu (tapnięcie to potwierdzenie, AC-2.2); pasek globalny i menu pokazują prosty dialog „Zakończyć trening?” (sekcja 7), bo nie są bezpośrednio przy zaliczaniu serii.
6. **Prawdziwe teksty o zapisie (LR-2).** Przycisk, który zapisuje, mówi to w etykiecie lub w dialogu bezpośrednio przed. Słowo „zamknij” nie sugeruje, że trening trzeba zapisać osobno. Nie używamy „Zamknij (nie zapisuje)” ani podobnych zdań.
7. **Porównanie bez danych jest pokazane uczciwie.** Brak poprzedniej sesji, brak tonażu w poprzedniej sesji i kolejka offline mają własne, krótkie komunikaty. Sekcja „Zobacz postęp” nie jest renderowana, gdy nie ma czego porównać (sekcja 8.6, decyzja D-4).
8. **Dane zdrowotne (cardio) są widoczne tylko tam, gdzie użytkownik ich dotyka.** Tętno i kroki pojawiają się w edytorze cardio, nie w podsumowaniu paska. Usunięcie cardio (0 min) mówi wprost, co zostanie usunięte (LR-4).

---

## 1. Przepływ i wejścia

```
[A: ostatnia seria, przycisk „Zakończ ostatnią serię i zapisz”]
[A: menu ☰ → „Zakończ trening”]          ─┐
[Pasek globalny → „Zakończ trening”]      ─┤
                                           ├─ brak pominiętych/niewykonanych ──> [Dialog „Zakończyć trening?”] ──Zakończ i zapisz──┐
                                           │                                                                                    │
                                           └─ są pominięte/niewykonane ─────────> [Dialog pominiętych serii] ──Zakończ i zapisz──┤
                                                                                        └──Wróć do serii──> [A: fokus na pierwszej do uzupełnienia] (bez zapisu)
[A: ostatnia seria bez pominiętych]  ──Zakończ ostatnią serię i zapisz──────────────────────────────────────────────────────────────┤
                                                                                                                                    v
                                                                                                             [B: Zapisuję trening…]
                                                                                 ├─ błąd ──> [B: błąd: Spróbuj ponownie / Wróć do treningu]
                                                                                 │              └─Wróć do treningu──> [A] (sesja nienaruszona)
                                                                                 └─ sukces lub kolejka ──> [C: Trening zakończony]
                                                                                                                 ├─ Zapisz cardio (patch) → pasek cardio
                                                                                                                 └─ Zamknij ──> /workout-plan (bez żądania zapisu)
```

Zasady:
- Przerwa po ostatniej serii nie istnieje (P1). Po zaliczeniu ostatniej serii nie pojawia się ekran „Koniec treningu”.
- Ostatnia seria pominięta linkiem „Pomiń” idzie tą samą ścieżką co zaliczona (pominięta seria jest „done”, więc trening się domyka).
- Dolne „Zakończ” w menu (Q-P4) przechodzi przez tę samą logikę co pasek globalny. Nie omija już dialogu pominiętych.
- „Popraw serię N” na serii już zaliczonej nie wywołuje potwierdzenia ani zapisu (A-9, E-14).

---

## 2. Tokeny i typografia (wyłącznie istniejące)

| Rola | Token / klasa | Uwagi |
|---|---|---|
| Tło ekranów i dialogów | `--gym-black` (`bg-[var(--gym-black)]`) | Ekran zawsze ciemny |
| Karta główna (tonaż) | `app-card` + warstwa złotej poświaty (jak dziś) | Kontener `app-card`, bez `ui/card` i `glass-panel` (00, sekcja 4) |
| Karta standardowa | `app-card` | Listy, cardio, porównanie |
| Złote CTA | `Button variant="cta"` (`gym-btn-primary`) | Wysokość 48 px, na ekranie zakończenia 56 px (`h-14`) dla głównego |
| Drugorzędny przycisk | `Button variant="outline"` z `border-[var(--gym-border-gold)]` | Tekst `--gym-gold-bright` albo biały 90% |
| Akcent, kicker, wartości | `--gym-gold`, `--gym-gold-bright` | Wartość rekordu i „Najlepsza seria” |
| Tekst drugorzędny | `--gym-text-secondary` (#9a9182, 6,5:1) | Zamiast `text-white/45` (ryzyko kontrastu, 00 pkt 7) |
| Wzrost tonażu / cel | `--gym-trend-up` (= `--gym-success`) | Strzałka w górę + tekst „+4,2%” |
| Spadek tonażu | `--gym-trend-down` (#ff5a5a) | Strzałka w dół + tekst; nie alarmowy |
| Seria pominięta | `--gym-skipped` (#ff9f43) | Zawsze z tekstem „pominięta” |
| Seria niewykonana | `--gym-text-secondary` | Zawsze z tekstem „niewykonana” |
| Błąd zapisu | `--destructive` (#ff3347) | Ikona + tekst, nigdy sam kolor |
| Obrys karty z błędem | `--destructive` 45% | Tylko przy błędzie |
| Tekst na złotym | `--neon-fg` (#120f05, 11,4:1) | Ustawiane przez `variant="cta"` |
| Tło kafla ikony | `bg-[var(--gym-gold)]/10` + obrys `/35` | Jak w dialogach dziś |

**Typografia.** Maksymalnie pięć poziomów:

| Poziom | Klasa | Użycie |
|---|---|---|
| H1 ekranu | `font-heading` 26/28 px, `font-semibold`, `text-white` (`sm:text-[29px]`) | „Trening zakończony”, „Zapisuję trening…” |
| H2 dialogu / sekcji | `font-heading` 20/24 px (dialog), `SectionLabel` (sekcje) | Tytuł dialogu, „Nowe rekordy”, „Najlepsze serie” |
| Liczba hero | `font-metric` 44 px (`sm:48 px`), `tabular-nums` | Tonaż |
| Treść | Geist 15 px (wiersze), 14 px (opisy), `font-semibold` dla nazw | Nazwy ćwiczeń, wartości |
| Meta | Geist 12-13 px, `--gym-text-secondary` | Podpisy, liczniki, drugie linie |
| Etykieta | 11 px, `uppercase`, `tracking-[0.14em]`, `font-semibold` | Kicker, „Tonaż”, „Czas”, „Serie”, „Ćwiczenia” |

Zasada: **minimum 11 px**. Obecne etykiety `text-[10px]` w `workout-finished-screen.tsx` podnieść do 11 px.

Liczby (tonaż, czas, serie, ciężary, powtórzenia, minuty, kcal, kroki) zawsze `tabular-nums`, żeby kolumny się równały.

**Odstępy:** skala 4/8 px. Wewnątrz kart `p-4` (16 px) na telefonie, `p-5` od `sm`. Odstęp między sekcjami `mt-6` (24 px), między kartami w sekcji `gap-2.5` (10 px). Zewnętrzny margines `px-4` (16 px), `sm:px-5`.

**Promienie:** karty `app-card` (22 px), przyciski `rounded-2xl` (16 px), pola `rounded-xl` (12 px), kafel ikony `rounded-2xl`.

**Ruch:** wejście ekranu i dialogów z istniejących animacji (`page-enter`, animacja Radix). Rozwinięcie „Zobacz postęp” 200 ms, `ease-out`, wysokość przez `grid-rows`. Spinner zapisu obraca się tylko bez `prefers-reduced-motion`; przy ograniczeniu ruchu statyczny pierścień z ikoną. Brak konfetti i animacji licznika tonażu.

---

## 3. Katalog komponentów (zmiany wobec stanu w repo)

Jedno źródło prawdy dla tego przepływu. Każdy element ma jedną implementację w `components/active-workout/`.

| Komponent | Status | Warianty i stany | Plik |
|---|---|---|---|
| `GuidedSessionLayout` - główny przycisk | zmiana etykiety | `Zapisz serię N` / `Popraw serię N` / `Zakończ ostatnią serię i zapisz` (gdy seria jest ostatnią otwartą w sesji i jest zaliczalna); `cta` | `guided-session-layout.tsx`, `lib/active-workout-copy.ts` |
| `WorkoutAllSetsDoneDialog` | przebudowa treści i liczników | Warianty: `skipped`, `incomplete`, `both`; wariant z zerem zaliczonych (dopisek) | `workout-all-sets-done-dialog.tsx` |
| `WorkoutFinishConfirmDialog` | **nowy (wewnątrz pliku dialogu pominiętych jako eksport obok, bez nowego katalogu)** | Jeden wariant: „Zakończyć trening?” | `workout-all-sets-done-dialog.tsx` (osobny eksport) albo `workout-finish-confirm-dialog.tsx` - decyzja frontend, ale jedna implementacja |
| `WorkoutSavingScreen` | **nowy** (ADR) | `saving`, `slow`, `error` | `workout-saving-screen.tsx` |
| `WorkoutFinishedScreen` | przebudowa (scalenie z popupem) | `saved`, `queued`; z/bez planu; z/bez porównania; z/bez rekordu; z/bez cardio; cardio `idle` / `saving` / `error` / `queued` | `workout-finished-screen.tsx` |
| `PlanCompareDialog` (zawartość) | przeniesiona jako sekcja rozwijana w ekranie końcowym (bez `AlertDialog`) | `open` / `closed`; wiersze: `up`, `down`, `same`, `new`, `skipped` (bez porównania) | wewnątrz `workout-finished-screen.tsx` |
| `PrAchievementGraphic` | bez zmian komponentu, zmiana miejsca i rozmiaru | Wariant kompakt `w-[200px]`, `aria-hidden` | `components/reports/pr-achievement-graphic.tsx` |
| `SectionLabel` | bez zmian | `index`, `title`, `trailing` (licznik) | `components/ui/section-label.tsx` |
| `Button` | bez zmian | `cta` (złoty), `outline`, `destructive` (tylko usunięcie cardio) | `components/ui/button.tsx` |
| Pasek cardio | część `WorkoutFinishedScreen` | `empty`, `filled`, `saving`, `error`, `queued`, `editing` | jak wyżej |

**Usuwane:** `components/reports/workout-complete-popup.tsx` (z montowania w `app-shell.tsx`), `components/workout/WorkoutSummary.tsx` (0 importów), czerwony `AlertDialog` w `active-workout-global-bar.tsx`, `window.alert` w tym samym pliku, lokalny `setFinishOpen`-based ekran „Trening zrobiony”.

**Uwaga o `fetchWorkoutFinishContextAction`:** dziś ekran pobiera liczbę treningów w tygodniu tylko na potrzeby stopki „Po „Gotowe” zapiszesz N. trening…”. Ta stopka znika (D-8), więc akcja zostaje do usunięcia, jeśli nie ma innego użycia (frontend sprawdza grepem).

---

## 4. Ekran aktywnego treningu - ostatnia seria

Układ bez zmian poza przyciskiem głównym (004 pozostaje obowiązujące).

**Przycisk główny (`Button variant="cta"`, `h-14`, pełna szerokość, `gap-2`):**
- ikona `Check` (20 px, `strokeWidth 2.5`), obok tekstu;
- etykieta zależna od stanu:

| Sytuacja | Etykieta | Zachowanie |
|---|---|---|
| Seria nie jest ostatnią otwartą w sesji | `Zapisz serię N` | Jak dziś, startuje przerwa wg ustawień |
| Seria już zaliczona | `Popraw serię N` | Jak dziś, bez potwierdzenia i zapisu (A-9) |
| Ostatnia otwarta seria sesji, zaliczalna (ciężar i powtórzenia spełniają regułę) | `Zakończ ostatnią serię i zapisz` | Brak przerwy. Zaliczenie i wejście w zakończenie (sekcja 6 albo od razu zapis, sekcja 5) |

- **Etykieta na wąskim ekranie (360 px):** tekst ma 16 px, `leading-tight`, `text-balance`. Przy dwóch liniach przycisk rośnie do `min-h-14`; nie skracamy tekstu, bo „i zapisz” jest tym, co chroni przed mylnym odczytaniem (LR-2).
- **Link „Pomiń”** bez zmian. Na ostatniej serii etykieta nie zmienia się. Gdy ostatnia seria zostanie pominięta, wejście w zakończenie działa jak przy zaliczeniu (dialog pominiętych).
- **Blokada podwójnego tapnięcia:** po pierwszym tapnięciu przycisk przechodzi w stan zajęty (`aria-disabled="true"`, `aria-busy`) do przejścia na ekran zapisu; ponowne tapnięcie nic nie robi.
- **Walidacja:** brak powtórzeń blokuje zaliczenie (jak dziś). Brak ciężaru **nie** blokuje serii z powtórzeniami (decyzja właściciela p. 7, `lib/workout-skipped-sets.ts`). Komunikat „Podaj ciężar” znika. Przy braku powtórzeń: „Podaj liczbę powtórzeń” (bez zmian).

---

## 5. Ekran „Zapisuję trening…” (`WorkoutSavingScreen`)

Pełny ekran nad treścią (`fixed inset-0 z-[1200] bg-[var(--gym-black)]`), bez belki, bez nagłówka sesji i bez przycisku wstecz. Treść wyśrodkowana pionowo, szerokość `max-w-lg`, `px-6`.

### 5.1 Stan `saving` (do 10 s)

- Kafel 64x64 px: okrąg `rounded-full`, obrys `--gym-gold` 35%, tło `--gym-gold` 10%, w środku ikona `Loader2` 28 px w `--gym-gold`, `animate-spin` (tylko bez ograniczenia ruchu). Przy ograniczeniu ruchu: ikona `Save` bez animacji.
- H1 (fokus po wejściu): `Zapisuję trening…`
- Pod tytułem (meta, `--gym-text-secondary`, 13 px): `Nie zamykaj aplikacji.`
- Brak przycisków.
- Kontener: `role="status"`, `aria-live="polite"`, `aria-busy="true"`.

### 5.2 Stan `slow` (po 10 s bez odpowiedzi)

- Ten sam układ, tytuł bez zmian.
- Meta zastępuje tekst: `Wolne połączenie, nadal zapisujemy…`
- Żądanie nie jest przerywane. Brak przycisków (zgodnie z A-3). Komunikat zmienia się raz (nie licznik sekund).
- Próg 10 s: do potwierdzenia przez `tester-wydajnosci` (A-4).

### 5.3 Stan `error` (zapis nieudany: sieć bez kolejki, 4xx, 5xx)

- Kafel 64x64: obrys i ikona `AlertTriangle` w `--destructive`, tło `--destructive` 10%.
- H1 (fokus po wejściu, `tabIndex -1`): `Nie udało się zapisać treningu`
- Treść (14 px, biały 85%): `Twoje serie są nadal na ekranie.`
- Przyciski (w pionie, `gap-2.5`, pełna szerokość, `max-w-sm`):
  1. `Spróbuj ponownie` - `Button variant="cta"`, `h-14`. Ponawia zapis z tym samym kluczem operacji i tym samym `endedAt`. Po kliknięciu wraca stan `saving`.
  2. `Wróć do treningu` - `Button variant="outline"`, `h-12`, obrys `--gym-border-gold`. Zamyka ekran, wraca do sesji z tym samym stanem serii, bez resetu store (E-5, E-12).
- Kontener: `role="alert"`.
- **Komunikat nie zawiera wartości treningu** (ciężar, powtórzenia, tętno) - LR-2.
- Wariant „sesja wygasła” (401): tytuł bez zmian, treść `Zaloguj się ponownie, a serie zostaną na ekranie.` Główny przycisk `Zaloguj się` (link do logowania, `variant="cta"`), `Wróć do treningu` pozostaje. Frontend decyduje, czy 401 jest rozpoznawalne; w razie wątpliwości pokazujemy wariant ogólny.

### 5.4 Stan `queued` - bez osobnego ekranu

Zapis w kolejce offline (`queued`) nie pokazuje ekranu błędu. Od razu przechodzimy na ekran „Trening zakończony” w stanie `queued` (sekcja 8.2).

### 5.5 Stany ekranu zapisu - podsumowanie

| Stan | Tytuł | Treść | Przyciski | ARIA |
|---|---|---|---|---|
| Ładowanie | Zapisuję trening… | Nie zamykaj aplikacji. | brak | `role=status`, `aria-live=polite` |
| Wolne połączenie | Zapisuję trening… | Wolne połączenie, nadal zapisujemy… | brak | jw. |
| Błąd | Nie udało się zapisać treningu | Twoje serie są nadal na ekranie. | Spróbuj ponownie, Wróć do treningu | `role=alert` |
| Błąd - sesja wygasła | Nie udało się zapisać treningu | Zaloguj się ponownie, a serie zostaną na ekranie. | Zaloguj się, Wróć do treningu | `role=alert` |

---

## 6. Dialog pominiętych serii (`WorkoutAllSetsDoneDialog`)

Dialog z Radix/base-ui `AlertDialog` (istniejący komponent, `app-dialog`, `w-[min(92vw,420px)]`, `p-5 sm:p-6`). Otwierany wyłącznie przez wejście w zakończenie, gdy istnieje co najmniej jedna seria pominięta lub niewykonana (BR-7). Nie pokazuje się przy zerze takich serii (AC-2.2).

### 6.1 Układ (od góry)

1. **Nagłówek:** kafel 44x44 px (`rounded-2xl`, obrys `--gym-gold` 35%, tło `--gym-gold` 10%) z ikoną `ListChecks` 20 px `--gym-gold`. Obok tytuł i opis.
   - Tytuł: `AlertDialogTitle`, `font-heading` 20/24 px, biały.
   - Opis: `AlertDialogDescription`, 14 px, `--gym-text-secondary`, `mt-1.5`.
2. **Liczniki** (`<dl>` w karcie `app-card` z `divide-y divide-white/[0.06]`), każdy wiersz `min-h-12` (48 px):
   - `Pominięte serie` ... `2` - ikona `SkipForward` 16 px w `--gym-skipped`; liczba `font-metric` 20 px `--gym-skipped` `tabular-nums`. Etykieta i liczba czytane razem.
   - `Niewykonane serie` ... `3` - ikona `Circle` 16 px w `--gym-text-secondary`; liczba 20 px biała 80%.
   - Wiersz pominięty się nie pokazuje, gdy licznik jest 0. Wiersz niewykonanych analogicznie.
3. **Pierwsza do uzupełnienia** (osobny blok pod licznikami, `px-4 py-3`, meta 12 px kicker `PIERWSZA DO UZUPEŁNIENIA` w `--gym-text-secondary`):
   - nazwa ćwiczenia, `font-semibold` 15 px, biała, `line-clamp-2`;
   - pod nią: `seria 4` w `tabular-nums`, 13 px, `--gym-text-secondary`.
4. **Dopisek przy zerze zaliczonych serii** (tylko gdy zaliczone = 0, Q5, założenie): akapit 13 px pod blokiem: `Nie zaliczono żadnej serii. Trening zapisze się bez tonażu.`
5. **Akcje** (`flex-col gap-2.5`, `mt-5`):
   - `Wróć do serii` - `Button variant="outline"`, `h-12`, pełna szerokość, obrys `--gym-border-gold`, tekst biały 90%. Pierwsza w kolejności i **fokus początkowy** (bezpieczna ścieżka: Enter nie zapisuje).
   - `Zakończ i zapisz` - `Button variant="cta"`, `h-14`, pełna szerokość. Na dole, w strefie kciuka.

### 6.2 Warianty

| Wariant | Tytuł | Opis | Liczniki | Pierwsza do uzupełnienia |
|---|---|---|---|---|
| `skipped` (są tylko pominięte) | Zostały pominięte serie | Blok siłowy jest zamknięty. Pominięte serie nie wejdą do tonażu. | Pominięte: N, Niewykonane: nie pokazuj | tak |
| `incomplete` (są tylko niewykonane) | Nie wszystkie serie wykonane | Niewykonane serie nie wejdą do tonażu. | Niewykonane: N, Pominięte: nie pokazuj | tak |
| `both` (są obie) | Nie wszystkie serie wykonane | Pominięte i niewykonane serie nie wejdą do tonażu. | obie liczby | tak |
| `zero` (zaliczone = 0, dodatkowo) | jak powyżej | + dopisek „Nie zaliczono żadnej serii…” | jak powyżej | tak |

Dlaczego tytuł „Nie wszystkie serie wykonane” w wariancie `both` (D-1): wariant `skipped` jest jedynym, w którym blok jest domknięty (pominięcie liczy się jako „done”), więc tytuł „Zostały pominięte serie” jest prawdziwy tylko tam. Gdy są też niewykonane, tytuł „Zostały pominięte serie” nie obejmuje ich.

Liczba w tytule: brak. Pluralizacja w opisach używa wariantu `1 / 2-4 / 5+`, a w licznikach słowa „serie” są stałe, bo liczba stoi osobno.

### 6.3 Stany i zachowanie

- **Otwarcie:** fokus na `Wróć do serii`. Tło przyciemnione, tło wcześniej przewijane nie przesuwa się.
- **Wróć do serii:** dialog się zamyka, sesja ustawia fokus na pierwszej serii z listy (`findFirstSkippedWorkoutTarget`, najpierw pominięta, potem niewykonana). **Nic nie zapisuje.** Sesja trwa.
- **Zakończ i zapisz:** dialog się zamyka, startuje ekran „Zapisuję trening…” (sekcja 5). Przycisk zablokowany przed podwójnym wysłaniem.
- **Esc, tapnięcie poza dialogiem:** zachowanie jak `Wróć do serii` (AC-2.6). Brak zapisu.
- **Zapis w toku:** dialog już zamknięty; blokada z `finishPending`.

### 6.4 Dostępność

- Rola `alertdialog`, `aria-labelledby` na tytule, `aria-describedby` na opisie.
- Liczniki jako `<dl>` z `<dt>`/`<dd>`, każda liczba z tekstem jednostki w tym samym elemencie (np. „2 pominięte”), nie sama cyfra.
- Pasek przycisków przechodzi fokus przez Tab w kolejności wizualnej: `Wróć do serii`, `Zakończ i zapisz`.
- Kolor nie niesie znaczenia: pominięte są opisane słowem, niewykonane słowem.

---

## 7. Dialog potwierdzenia zakończenia (pasek globalny i menu, bez pominiętych serii)

Pokazuje się tylko wtedy, gdy wejście jest z paska globalnego albo menu i **nie ma** pominiętych ani niewykonanych serii. Przy takich seriach od razu pojawia się dialog z sekcji 6 (bez tego pytania).

- Typ: `AlertDialog`, `app-dialog`, szerokość jak w sekcji 6.
- Ikona w kafelku 44x44: `CircleCheck` `--gym-gold`.
- Tytuł: `Zakończyć trening?`
- Opis: `Trening zostanie zapisany, a potem zobaczysz podsumowanie.`
- Akcje (pełna szerokość, w pionie):
  - `Wróć do treningu` - `outline`, `h-12`, **fokus początkowy**;
  - `Zakończ i zapisz` - `cta`, `h-14`.
- Stan zajęty po kliknięciu: etykieta `Zapisuję…`, `aria-disabled`.
- Esc i tapnięcie poza dialogiem: `Wróć do treningu`.

---

## 8. Ekran „Trening zakończony” (`WorkoutFinishedScreen`)

Pełny ekran nad treścią (`fixed inset-0 z-[1200] bg-[var(--gym-black)]`), jak dziś `WorkoutFinishedScreen`. Treść przewijana w obszarze `overflow-y-auto`. **Stopka z przyciskiem „Zamknij” przypięta do dołu** (`shrink-0`, `pb-[max(0.85rem,env(safe-area-inset-bottom))]`). Kontener to `<section aria-labelledby>`, H1 dostaje fokus po wejściu (`tabIndex -1`), żeby czytnik zaczynał od „Trening zakończony”.

### 8.1 Kolejność sekcji (od góry)

1. **Nagłówek** (sekcja 8.2)
2. **Karta tonażu** z deltą „vs ostatnio” i rzędem czas / serie / ćwiczenia (sekcja 8.3)
3. **Nowe rekordy** - tylko gdy są rekordy ciężaru (sekcja 8.4)
4. **Najlepsze serie** (sekcja 8.5)
5. **Zobacz postęp** - tylko gdy istnieje porównanie (sekcja 8.6)
6. **Cardio** - pasek (sekcja 8.7)
7. **Stopka**: `Zamknij` (sekcja 8.8)

### 8.2 Nagłówek i status zapisu

- Kafel 44x44 (`rounded-full`, obrys `--gym-gold` 35%, tło `--gym-gold` 10%) z ikoną `Trophy` 20 px, `--gym-gold`, `aria-hidden`.
- Obok kicker: nazwa planu z wielkich liter, `text-[11px] tracking-[0.18em] --gym-gold`, `truncate`. Brak nazwy: `TRENING`.
- H1: `Trening zakończony` (`font-heading` 26/28 px, biały).
- Meta pod H1 (12-13 px, `--gym-text-secondary`): data i godzina zakończenia w strefie lokalnej, format `pt, 25 paź · 18:42` (`toLocaleString("pl-PL", weekday short, day numeric, month short, hour 2-digit, minute 2-digit)`).
- **Status zapisu** (osobna linia z ikoną, `mt-3`, karta `app-card` bez obramowania akcentu, `px-3.5 py-2.5`, `role="status"`):
  - zapisany (`saved`): ikona `CircleCheck` `--gym-trend-up`; tekst `Trening jest zapisany. Ciężary są w historii i w Postępach.`
  - kolejka (`queued`): ikona `CloudOff` `--gym-gold`; tekst `Zapisany offline — wyślemy po odzyskaniu połączenia.`
- Nie ma już stopki „Po „Gotowe” zapiszesz N. trening…” (D-8).

### 8.3 Karta tonażu i „vs ostatnio”

Karta `app-card`, `p-5`, z delikatną poświatą `--gym-gold` 12% u góry (jak dziś).

- Kicker: `Tonaż` (11 px, `--gym-gold`).
- Wartość: `font-metric` 44 px (`sm:48 px`), `tabular-nums`, biała; jednostka `kg` 16 px, `font-semibold`, biała 70%. Format: spacja tysięcy pl-PL (`5 240 kg`), dokładnie `formatVolumeKg`. Tylko serie zaliczone (BR-5).
- **Delta „vs ostatnio”** (pod wartością, `mt-2`):
  - Etykieta `vs ostatnio` (12 px, `--gym-text-secondary`).
  - Chip: `inline-flex`, `rounded-full`, `px-2.5 py-1`, 14 px `font-semibold tabular-nums`.
    - wzrost: strzałka `ArrowUpRight` + `+4,2%` (lub kg wg ustawienia `progressDeltaUnit`), kolor `--gym-trend-up`, tło `--gym-trend-up` 12%, obrys 50%;
    - spadek: `ArrowDownRight` + `−3,1%`, kolor `--gym-trend-down`, tło 10%, obrys 65%;
    - bez zmiany (0): `Minus` + `0%`, `--gym-text-secondary`, obrys `--gym-border-gold`;
    - brak porównania: tekst `—`, bez chipa, kolor `--gym-text-secondary`.
  - Pod chipem (caption 12 px, `--gym-text-secondary`, `mt-1.5`): przy wzroście i spadku `wcześniej 4 820 kg` (wartość poprzedniej sesji tego samego planu). Przy braku porównania: tekst wariantu z tabeli 8.3.1.
  - **Dostępność chipa:** czytnik dostaje pełne zdanie w `aria-label` chipa: `Tonaż vs ostatnio: w górę o 4,2 procent` / `w dół o 3,1 procent` / `bez zmiany` / `brak porównania`. Strzałka `aria-hidden`.
- **Rząd czas / serie / ćwiczenia** (`grid grid-cols-3`, `border-t border-white/10`, `pt-4 mt-5`, kolumny oddzielone cienką linią):
  - `Czas` - `formatWorkoutDurationPl`, 15 px `font-semibold tabular-nums`.
  - `Serie` - liczba zaliczonych, `14`; gdy łącznie różni się od wykonanych, `14/16` (`/16` w `--gym-text-secondary`). `aria-label`: `14 z 16 serii wykonanych`.
  - `Ćwiczenia` - liczba, 15 px.
  - Wyrównanie: lewa kolumna `text-left`, środkowa `text-center`, prawa `text-right`.

**8.3.1 Warianty karty „vs ostatnio” (stany porównania)**

| Sytuacja | Chip | Caption pod chipem |
|---|---|---|
| Wzrost / spadek / bez zmiany (poprzednia sesja tego planu z tonażem > 0) | strzałka + wartość | `wcześniej 4 820 kg` |
| Pierwsza zapisana sesja tego planu (brak poprzedniej) | `—` | `Pierwsza zapisana sesja tego planu — brak porównania.` |
| Poprzednia sesja tego planu bez tonażu (tonaż = 0) | `—` | `Poprzednia sesja nie miała tonażu — brak porównania.` (D-9) |
| Trening bez planu (`workoutPlanId` brak) | `—` | `Brak zapisanej sesji tego planu.` (E-2) |
| Kolejka offline (`queued`, brak odpowiedzi serwera) | `—` | `Porównanie będzie dostępne po wysłaniu treningu.` (D-9) |
| Brak zaliczonych serii (tonaż 0) | `—` | `Brak zaliczonych serii.` |

Przy wariancie „pierwsza sesja” cała karta zachowuje układ; tylko chip i caption są inne. Nie pokazujemy pustych pasków ani wykresów.

### 8.4 Sekcja „Nowe rekordy”

- Renderowana tylko, gdy `weightRecords.length > 0`. Bez rekordu sekcji nie ma (żadnego komunikatu „brak rekordów”).
- `SectionLabel` (indeks, tytuł `Nowe rekordy`, licznik po prawej).
- Lista w `app-card`, wiersze `min-h-14` (56 px), `px-4 py-3.5`:
  - lewa: nazwa ćwiczenia, 15 px `font-semibold`, biała, `line-clamp-2`;
  - prawa: `formatWeightRecordLine` - `82,5 kg → 85 kg`, `tabular-nums`, 15 px `font-semibold`, `--gym-gold`. Strzałka `→` zostaje w tekście.
- **Grafika rekordu** (`PrAchievementGraphic`, pierwszy wpis z `newMaxHits`): wyśrodkowana, `w-[200px]` (aspect 3:4, ok. 267 px), pod listą, `mt-4`. Gdy jest więcej niż jeden rekord: podpis `+N kolejne rekordy w tej sesji` (12 px, `--gym-text-secondary`, wyśrodkowany).
  - Stan ładowania obrazka: tło gradientu z komponentu (`--gym-black` z poświatą złota) jako szkielet, bez spinnera.
  - Stan błędu obrazka: ten sam gradient (zachowanie komponentu), tekst na nakładce pozostaje czytelny.
  - `aria-hidden="true"` na kontenerze grafiki: informacja o rekordzie jest już w liście.
- Toast „NOWY MAX” z `sessionStorage` znika (AC-5.2). Jego treść jest w tej sekcji.
- Haptyka `hapticNewMax` przy wejściu na ekran z rekordem (raz). Bez rekordu `hapticWorkoutDone`.

### 8.5 Sekcja „Najlepsze serie”

- `SectionLabel` z indeksem (po „Nowe rekordy”, gdy są, inaczej po karcie), licznik = liczba ćwiczeń w sesji.
- Lista w `app-card`, `divide-y divide-white/[0.06]`. **Każdy wiersz ma dwie linie** (D-5):

**Linia 1** (`flex justify-between items-baseline gap-3`):
- lewa: nazwa ćwiczenia, 15 px `font-semibold`, biała 90%, `line-clamp-2`; gdy film techniki w nazwie: skrót jak dziś (`displayExerciseName`).
- prawa: **najlepsza seria**, 15 px `font-semibold` `tabular-nums`, `--gym-gold`:
  - z obciążeniem: `80 kg × 8` (kg w mniejszym kroju, `×` w `--gym-text-secondary`);
  - masa ciała: `12 powt.`;
  - brak zaliczonej serii w ćwiczeniu: `bez zaliczonej serii` (13 px, `--gym-text-secondary`, nie złoto).

**Linia 2** (`mt-1.5`, 13 px, `--gym-text-secondary`, `flex flex-wrap gap-x-3 gap-y-1`, lista `<ul>`):
- Wszystkie serie ćwiczenia w kolejności, każda jako `<li>`: `1: 80×8`, `2: 80×7`, `3: pominięta`, `4: niewykonana`.
- Najlepsza seria: `font-semibold` biała, z ukrytym tekstem dla czytnika `(najlepsza)`.
- Seria pominięta: tekst `pominięta` w `--gym-skipped`.
- Seria niewykonana: tekst `niewykonana` w `--gym-text-secondary`.
- Masa ciała w linii 2: `1: 12 powt.`
- Jednostka kg nie powtarza się w linii 2 (jest w linii 1 jako nagłówek wiersza). Przy zmiennych jednostkach (kg i powtórzenia) format zostaje `1: 80×8`.
- Wiersz zawija się; nie obcinamy serii (każda ma znaczenie, w tym pominięta).

- Ćwiczenia, które nie mają żadnej zaliczonej serii, **są na liście**: linia 1 z tekstem `bez zaliczonej serii`, linia 2 pokazuje ich stan (np. `1: pominięta · 2: niewykonana`). Dzięki temu użytkownik widzi pełen obraz (decyzja D-5; funkcja `bestSetsFromSession` dziś je pomija, więc listę składa widok z `exercises`).
- Pusty stan całej sesji (zero zaliczonych serii): sekcja „Najlepsze serie” nie znika, ale zamiast linii 1 pokazujemy na górze karty tekst `Brak zaliczonych serii.` (13 px, `--gym-text-secondary`), a linie 2 zostają. Gdy nie ma żadnego ćwiczenia (przypadek skrajny), sekcji nie ma.
- Wiersz najlepszej serii nie zmienia się przy zmianie na cardio. Brak tętna w tym miejscu.

### 8.6 Sekcja „Zobacz postęp” (dawny `PlanCompareDialog`)

**Warunek widoczności** (D-4): renderowana tylko, gdy `planCompare` istnieje **i** `previousVolumeKg` jest większe od 0. W pozostałych przypadkach z tabeli 8.3.1 sekcja nie istnieje (nie ma pustego przycisku).

**Przycisk-rozwijacz:** `Button variant="outline"`, `h-12`, pełna szerokość, obrys `--gym-border-gold`, tekst biały 90%, 15 px `font-semibold`.
- Zwinięty: etykieta `Zobacz postęp`, ikona `ChevronDown` po prawej.
- Rozwinięty: etykieta `Zwiń postęp`, ikona `ChevronUp`.
- `aria-expanded`, `aria-controls` na kontener treści. Fokus zostaje na przycisku po rozwinięciu.
- Animacja wysokości 200 ms (`grid-rows-[0fr]`→`[1fr]`), bez animacji przy ograniczeniu ruchu.

**Treść rozwiniętej sekcji** (`app-card`, `mt-2.5`, `p-4`, `id` z `aria-controls`):
1. Kicker `Ten sam plan` (11 px, `--gym-gold`), nagłówek `Postęp vs ostatnio` (`font-heading` 18/22 px).
2. Meta (12 px, `--gym-text-secondary`): `Nazwa planu · 18 paź → dziś` (data poprzedniej sesji, `formatHistoryShortDate`).
3. Dwie kafelki (`grid-cols-2 gap-2.5`, każdy `app-card p-3.5`):
   - `Tonaż`: wartość `5 240 kg` (`font-metric` 24 px, `--gym-gold`), pod nią `wcześniej 4 820 kg`.
   - `Zmiana objętości`: chip z deltą jak w 8.3 (ten sam komponent), pod nią liczniki w jednej linii: `2 w górę · 1 w dół · 3 bez porównania`. Każdy licznik ma słowo, nie tylko kolor.
4. Lista ćwiczeń (`mt-4`, bez wewnętrznego przewijania; całość przewija się razem z ekranem), każdy wiersz `app-card px-3.5 py-3`:
   - lewa: nazwa 15 px `font-semibold`; pod nią `82 kg · wcześniej 78 kg` (12 px, `tabular-nums`, `--gym-text-secondary`);
   - prawa: status:
     - `up`: strzałka w górę + `+4,2%` w `--gym-trend-up`;
     - `down`: strzałka w dół + `−3,1%` w `--gym-trend-down`;
     - `same`: `Minus` + `0`, `--gym-text-secondary`;
     - `new`: badge `nowe` (obrys `--gym-gold` 35%, tekst `--gym-gold`, 11 px uppercase);
     - `skipped`: badge `bez porównania` (obrys `--gym-border-gold`, tekst `--gym-text-secondary`, 11 px). **Nie** „pominięte” (AC-8.2, słowo „pominięte” tylko dla serii).

Jeśli w sesji nie ma ćwiczeń w porównaniu (pusta lista) – sekcja nie jest renderowana (warunek jak wyżej).

### 8.7 Pasek cardio

Pełna szerokość, `min-h-12`, w `app-card` (`px-4 py-3`). Zależnie od stanu:

| Stan | Wygląd | Akcja |
|---|---|---|
| `empty` (0 min) | Ikona `Flame` 16 px `--gym-gold`, tekst `Dodaj cardio po treningu` 15 px biały 90%, `ChevronRight` po prawej | Przycisk, otwiera edytor (`aria-expanded`) |
| `filled` | Etykieta `Cardio` (11 px, `--gym-gold`), wartość `Cardio: 20 min · 3,2 km · 210 kcal · 4 500 kroków` (14 px, `tabular-nums`, pomija tętno), po prawej przycisk `Edytuj` (`variant="outline"` mały, `h-11`) | Otwiera edytor |
| `saving` | Jak `filled`/`empty` z dopiskiem `Zapisuję cardio…` (12 px, `--gym-text-secondary`) i małym `Loader2` (bez animacji przy ograniczeniu ruchu); `aria-busy` | Brak akcji |
| `error` | Pod paskiem `role="alert"`: `Nie udało się zapisać cardio. Spróbuj ponownie.` (13 px, `--destructive` ikona `AlertTriangle` + tekst biały 85%); edytor pozostaje otwarty z wpisanymi wartościami | Ponów przez `Zapisz cardio` |
| `queued` (kolejka) | Wyszarzony pasek, tekst `Cardio będzie dostępne po wysłaniu treningu.` (13 px, `--gym-text-secondary`); **bez przycisku** | Brak (ADR, AC-6.7) |
| `not-found` (404 z serwera) | Pod paskiem `role="alert"`: `Nie znaleziono tego treningu. Cardio nie zostało zapisane.` | Brak |

**Edytor cardio** (rozwinięty w tej samej karcie, nie modal; `mt-3`, `pt-3`, `border-t border-white/10`):
- Minuty: stepper z przyciskami `−` i `+` (`h-12 w-12`, `rounded-full`, obrys `--gym-border-gold`, `aria-label` `Mniej minut` / `Więcej minut`), wartość `font-metric` 28 px `tabular-nums` `--gym-gold`, dopisek `min`. Krok 5 min. Zakres 0-180.
- Domyślna wartość przy dodawaniu: 20 min.
- Pola opcjonalne (grid 2 kolumny, `gap-2.5`), każde z widoczną etykietą nad polem (11 px uppercase, `--gym-text-secondary`), pole `h-12`, `rounded-xl`, tło `--gym-black` 60%, obrys `--gym-border-gold`:
  - `Dystans (km)`, `inputMode="decimal"`, placeholder `opcjonalnie`;
  - `Śr. tętno (bpm)`, `inputMode="numeric"`, placeholder `opcjonalnie`;
  - `Kalorie (kcal)`, `inputMode="numeric"`, placeholder `opcjonalnie`;
  - `Kroki`, `inputMode="numeric"`, placeholder `opcjonalnie`.
- **Informacja o usuwaniu** (13 px, `--gym-text-secondary`, pod polami): `0 min usuwa całe cardio, także tętno, kalorie i kroki.` Widoczna zawsze w edytorze (LR-4: użytkownik wie, co znika).
- Akcje (`mt-3`, dwie kolumny, `h-12`):
  - `Anuluj` - `outline`, zamyka edytor bez zmian;
  - `Zapisz cardio` - `cta` (złoty). Gdy minuty = 0 i było cardio: `Usuń cardio` w stylu `outline` z tekstem `--destructive` (semantyczna destrukcja, AC-9.3).
- Podczas zapisu: przycisk `Zapisuję cardio…`, `aria-busy`, pola `readOnly`.
- Po sukcesie: edytor się zamyka, pasek pokazuje nowe wartości (AC-6.3). Nic innego na ekranie się nie zmienia.
- Esc w edytorze zamyka edytor bez zapisu.
- Zapis cardio **nie** wpływa na feed zespołu (Q-P3); w UI nie ma o tym komunikatu.

### 8.8 Stopka: „Zamknij”

- Przypięta do dołu ekranu, `border-t border-white/[0.06]`, tło `--gym-black` 98%, `backdrop-blur-md`.
- Jeden przycisk: `Zamknij` - `Button variant="cta"`, `h-14`, pełna szerokość, `rounded-2xl`. Brak „Gotowe”, „OK”, „(nie zapisuje)”.
- Akcja: nawigacja na `/workout-plan` (A-2). **Zero żądań zapisu** (AC-4.11).
- Dostępny w każdym stanie, w tym w kolejce i przy błędzie cardio.
- Esc nie zamyka ekranu (tylko edytor cardio); to celowe, żeby uniknąć przypadkowego wyjścia.

---

## 9. Mikrokopia (pełna lista)

Ton: krótko, na „ty”, bez wykrzykników i bez oceniania ciała (zasada zaburzeń odżywiania, sekcja 6 briefu). Wyjątek: brak.

| Miejsce | Tekst |
|---|---|
| Główny przycisk ostatniej serii | `Zakończ ostatnią serię i zapisz` |
| Główny przycisk, inne serie | `Zapisz serię N` / `Popraw serię N` (bez zmian) |
| Link pominięcia | `Pomiń` (bez zmian) |
| Menu i pasek | `Zakończ trening` (zajęty: `Zapisuję…`) |
| Dialog potwierdzenia: tytuł | `Zakończyć trening?` |
| Dialog potwierdzenia: opis | `Trening zostanie zapisany, a potem zobaczysz podsumowanie.` |
| Dialog potwierdzenia: akcje | `Wróć do treningu` / `Zakończ i zapisz` |
| Dialog pominiętych: tytuł (skipped) | `Zostały pominięte serie` |
| Dialog pominiętych: tytuł (incomplete / both) | `Nie wszystkie serie wykonane` |
| Dialog pominiętych: opis (skipped) | `Blok siłowy jest zamknięty. Pominięte serie nie wejdą do tonażu.` |
| Dialog pominiętych: opis (incomplete) | `Niewykonane serie nie wejdą do tonażu.` |
| Dialog pominiętych: opis (both) | `Pominięte i niewykonane serie nie wejdą do tonażu.` |
| Dialog pominiętych: dopisek (zero zaliczonych) | `Nie zaliczono żadnej serii. Trening zapisze się bez tonażu.` |
| Dialog pominiętych: liczniki | `Pominięte serie` / `Niewykonane serie` |
| Dialog pominiętych: fokus | `Pierwsza do uzupełnienia` + `seria N` |
| Dialog pominiętych: akcje | `Wróć do serii` / `Zakończ i zapisz` |
| Zapis: tytuł | `Zapisuję trening…` |
| Zapis: meta | `Nie zamykaj aplikacji.` |
| Zapis: wolne połączenie | `Wolne połączenie, nadal zapisujemy…` |
| Błąd: tytuł | `Nie udało się zapisać treningu` |
| Błąd: treść | `Twoje serie są nadal na ekranie.` |
| Błąd: akcje | `Spróbuj ponownie` / `Wróć do treningu` |
| Błąd sesji (401): treść | `Zaloguj się ponownie, a serie zostaną na ekranie.` |
| Błąd sesji (401): akcja | `Zaloguj się` |
| Ekran końcowy: kicker bez nazwy | `TRENING` |
| Ekran końcowy: H1 | `Trening zakończony` |
| Status zapisu | `Trening jest zapisany. Ciężary są w historii i w Postępach.` |
| Status kolejki | `Zapisany offline — wyślemy po odzyskaniu połączenia.` |
| Tonaż: etykieta | `Tonaż` |
| Delta: etykieta | `vs ostatnio` |
| Delta: pierwsza sesja | `Pierwsza zapisana sesja tego planu — brak porównania.` |
| Delta: poprzedni tonaż 0 | `Poprzednia sesja nie miała tonażu — brak porównania.` |
| Delta: bez planu | `Brak zapisanej sesji tego planu.` |
| Delta: kolejka | `Porównanie będzie dostępne po wysłaniu treningu.` |
| Delta: brak zaliczonych | `Brak zaliczonych serii.` |
| Delta: wcześniej | `wcześniej 4 820 kg` |
| Karta: czas / serie / ćwiczenia | `Czas` / `Serie` / `Ćwiczenia` |
| Nowe rekordy: tytuł sekcji | `Nowe rekordy` |
| Nowe rekordy: więcej | `+N kolejne rekordy w tej sesji` (`+1 kolejny rekord w tej sesji` dla 1, `+N kolejnych rekordów` dla 5+) |
| Najlepsze serie: tytuł | `Najlepsze serie` |
| Najlepsze serie: bez serii | `bez zaliczonej serii` |
| Najlepsze serie: brak zaliczonych w sesji | `Brak zaliczonych serii.` |
| Najlepsze serie: linia 2 | `pominięta` / `niewykonana` / `powt.` (masa ciała) |
| Najlepsza seria (dla czytnika) | `(najlepsza)` |
| Zobacz postęp: zwinięte | `Zobacz postęp` |
| Zobacz postęp: rozwinięte | `Zwiń postęp` |
| Postęp: kicker | `Ten sam plan` |
| Postęp: nagłówek | `Postęp vs ostatnio` |
| Postęp: liczniki | `N w górę · N w dół · N bez porównania` |
| Postęp: status ćwiczenia | `nowe` / `bez porównania` |
| Cardio: pusty | `Dodaj cardio po treningu` |
| Cardio: wypełniony | `Cardio: 20 min · 3,2 km · 210 kcal · 4 500 kroków` (bez pól, które są puste) |
| Cardio: edycja | `Edytuj` |
| Cardio: pola | `Minuty cardio`, `Dystans (km)`, `Śr. tętno (bpm)`, `Kalorie (kcal)`, `Kroki` |
| Cardio: placeholder | `opcjonalnie` |
| Cardio: ostrzeżenie o usunięciu | `0 min usuwa całe cardio, także tętno, kalorie i kroki.` |
| Cardio: akcje | `Anuluj` / `Zapisz cardio` / `Usuń cardio` (0 min) |
| Cardio: zapisywanie | `Zapisuję cardio…` |
| Cardio: błąd | `Nie udało się zapisać cardio. Spróbuj ponownie.` |
| Cardio: 404 | `Nie znaleziono tego treningu. Cardio nie zostało zapisane.` |
| Cardio: kolejka | `Cardio będzie dostępne po wysłaniu treningu.` |
| Stopka | `Zamknij` |

**Zakazane w przepływie:** „Trening zrobiony”, „Trening zapisany”, „Koniec treningu”, „Gotowe”, „OK”, „Zamknij (nie zapisuje)”, „Wszystkie serie wykonane”, „vs poprzedni plan”, „Postęp vs poprzedni”, „pominięte” jako etykieta ćwiczenia w porównaniu, „Zapisz i zamknij”, „Po „Gotowe” zapiszesz…”, „Zakończ” bez „trening” w menu.

---

## 10. Stany ekranów (obowiązkowe)

| Ekran / element | Ładowanie | Błąd | Pusty | Offline | Częściowe dane | Brak uprawnień | Sukces |
|---|---|---|---|---|---|---|---|
| Ekran zapisu (sekcja 5) | `saving` (spinner w kaflu, bez szkieletu: operacja, nie lista) | `error` | n/d | kolejka: pominięty (przejście na ekran końcowy) | n/d | 401: „Zaloguj się” | przejście na ekran końcowy |
| Ekran końcowy | n/d (dane z odpowiedzi i store, bez zapytania) | błąd cardio (inline) | brak rekordów: sekcja ukryta; brak zaliczonych: tekst | `queued`: status, delta „—”, brak „Zobacz postęp”, cardio wyłączone | brak porównania: wariant tabeli 8.3.1; brak planu | 404 cardio | `saved` z wszystkimi sekcjami |
| Dialog pominiętych | n/d | n/d | zero pominiętych i niewykonanych: dialog nie istnieje | n/d | jeden licznik: drugi wiersz ukryty | n/d | n/d |
| Zobacz postęp | n/d | n/d | brak porównania: sekcja ukryta | `queued`: ukryta | część wierszy `new`/`skipped` | n/d | rozwinięta |
| Najlepsze serie | n/d | n/d | brak zaliczonych: tekst nad listą | n/d | ćwiczenie bez zaliczonej: `bez zaliczonej serii` | n/d | pełna lista |
| Pasek cardio | n/d | `error` pod paskiem | `empty` | `queued` | n/d | 404 | `filled` |

**Ładowanie na ekranie końcowym:** brak szkieletu, bo ekran nie czeka na sieć (wszystko jest w odpowiedzi zapisu lub w store). Gdy kiedykolwiek zostanie dołożone pobieranie dodatkowych danych, dostaje szkielet `app-card animate-pulse` (00, sekcja 5), nie spinner.

**Brak uprawnień:** patch cardio działa tylko dla właściciela; nieautoryzowany dostęp kończy się 404 (ADR), co pokazujemy jako stan `not-found`.

---

## 11. Responsywność

Projekt mobile-first. Szerokość kolumny: `max-w-lg` (512 px), na większych ekranach wyśrodkowana.

- **390 x 844** (typowy telefon, safe-area 47/34): wszystkie sekcje mieszczą się w przewijaniu; stopka „Zamknij” przypięta z `env(safe-area-inset-bottom)`.
- **360 x 640** (bez safe-area, niski ekran): nagłówek zwięzły; karta tonażu z wartością 40 px; wiersze „Najlepsze serie” zawijają linię 2; przycisk „Zobacz postęp” 48 px; stopka nie zasłania treści (treść ma `pb-6` na końcu).
- **Wariant `compact` (`max-height: 719px`, klasa `compact:`):** odstępy `gap-2` zamiast `gap-2.5`, wartość tonażu 36 px, zmniejszony kicker 11 px bez `mt`; cardio edytor z przewijaniem wewnątrz ekranu (cały ekran przewija się, bez zagnieżdżonego scrolla).
- **Dialogi:** `w-[min(92vw,420px)]`; na 360 px szerokość ~331 px. Tytuł dialogu max 2 linie. Przyciski nie zmieniają wysokości przy długim tekście (`h-12`/`h-14` stałe).
- **Przycisk „Zakończ ostatnią serię i zapisz”** na 360 px: 2 linie dopuszczalne (sekcja 4).
- **Tablet / desktop:** bez zmian układu (kolumna 512 px). Dialogi `sm:max-w-md` zostają.

Dotyk: wszystkie przyciski i wiersze interaktywne min. 44 px wysokości (w praktyce 48 px). Odstęp między sąsiednimi celami dotykowymi min. 8 px.

---

## 12. Dostępność (WCAG 2.2 AA)

- **Fokus po otwarciu:** dialog pominiętych i dialog potwierdzenia - przycisk bezpieczny (`Wróć do serii` / `Wróć do treningu`). Ekran zapisu - H1 (`tabIndex -1`). Ekran końcowy - H1 (`tabIndex -1`). Po zamknięciu dialogu fokus wraca do elementu, który go otworzył (lub do pierwszej serii, gdy wybrano „Wróć do serii”).
- **Kolejność fokusu** na ekranie końcowym: nagłówek → karta tonażu (chip, opis) → sekcje → „Zobacz postęp” → cardio → „Zamknij”. Zgodna z kolejnością wizualną.
- **Role:** `role="status"` dla zapisu i statusu zapisu; `role="alert"` dla błędu zapisu i błędu cardio; `alertdialog` dla dialogów.
- **`aria-expanded` / `aria-controls`** na „Zobacz postęp” i na rozwinięciu cardio.
- **Liczby z jednostkami** w jednym elemencie tekstowym (`2 pominięte`, `14 z 16 serii wykonanych`), żeby czytnik nie czytał samej cyfry.
- **Kolor nie jest jedynym nośnikiem:** chip delty ma strzałkę i tekst (`w górę`, `w dół`, `bez zmiany`); seria pominięta ma słowo; rekord ma tekst „Nowe rekordy”; błąd ma ikonę i tekst.
- **Kontrast:** tekst główny biały (ok. 15:1), tekst drugorzędny `--gym-text-secondary` 6,5:1 na `--gym-black`, 6,0:1 na karcie; złoto `--gym-gold` 12:1; `--neon-fg` na złotym 11,4:1; `--gym-trend-down` 6,1:1 na karcie; `--gym-skipped` 8,4:1 w pigułce. Każdy tekst ≥ 4,5:1 (AA).
- **Ruch:** `prefers-reduced-motion` wyłącza spinner, animację rozwinięcia i pulsowanie kafla. Brak migotania.
- **Grafika PR:** `aria-hidden`; informacja jest w tekście sekcji.
- **Edytor cardio:** każde pole ma widoczną etykietę (nie tylko placeholder); `inputMode` dla klawiatury numerycznej; komunikat błędu powiązany `aria-describedby`.
- **Esc:** zamyka dialogi (= „Wróć”), edytor cardio; nie zamyka ekranu końcowego ani ekranu zapisu.

---

## 13. Odstępstwa od analizy i ADR (do zatwierdzenia)

| # | Odstępstwo | Źródło | Uzasadnienie | Do zatwierdzenia przez |
|---|---|---|---|---|
| D-1 | Tytuł dialogu w wariancie „obie” to „Nie wszystkie serie wykonane” (AC-2.3 mówi „Zostały pominięte serie”) | AC-2.3 | Tytuł nie może pomijać niewykonanych serii; w wariancie „tylko pominięte” tytuł zostaje | analityk |
| D-2 | Przyciski dialogu pominiętych: `Wróć do serii` jako outline z fokusem początkowym, `Zakończ i zapisz` jako gold. AC-2.5 mówi, że główne działanie to „Wróć do serii” i oba mają ten sam kolor | AC-2.5, P9 | Jeden złoty akcent na zakończenie (P9 jest wiążące dla „Zakończ i zapisz”); bezpieczny fokus na „Wróć” chroni przed przypadkowym zapisem | analityk, właściciel |
| D-3 | Pasek i menu bez pominiętych dostają dialog „Zakończyć trening?”; przy pominiętych od razu dialog pominiętych (bez dwóch dialogów pod rząd) | ADR p. 5, AC-2.2 | ADR pozostawia to ux; wybieramy jedno potwierdzenie na wejście | architekt (potwierdzić przy implementacji) |
| D-4 | „Zobacz postęp” nie istnieje, gdy poprzedni tonaż wynosi 0 lub brak poprzedniej sesji | AC-4.8, AC-4.9 | Sekcja porównania nie ma czego pokazać; uniknięcie pustego, pozornie działającego przycisku | analityk |
| D-5 | „Najlepsze serie” pokazuje także ćwiczenia bez zaliczonej serii (`bez zaliczonej serii`); `bestSetsFromSession` takich ćwiczeń nie zwraca, lista składana jest z `exercises` | AC-4.5 | Pełny obraz sesji (pominięte, niewykonane) | frontend, analityk |
| D-6 | Komunikat błędu cardio pojawia się w edytorze (edytor zostaje otwarty), a nie pod paskiem zwiniętym | AC-6.4 | Dane wpisane przez użytkownika nie znikają | analityk (przyjęte jako odpowiednik) |
| D-7 | Przycisk `Zakończ trening` w menu sesji to gold `cta` (004 dawało outline) | P9, AC-9.1 | Jeden kolor akcji zakończenia (P9 wygrywa z 004) | właściciel |
| D-8 | Stopka „Po „Gotowe” zapiszesz N. trening w tym tygodniu…” znika. Liczba treningów w tygodniu nie jest pokazywana na ekranie końcowym | AC-7.4 (tekst do zatwierdzenia) | Zapis już nastąpił, stara treść przeczy nowemu przepływowi; liczenie tygodnia po zapisie wymagałoby dodatkowego zapytania | analityk, ux (zatwierdzone tu) |
| D-9 | Nowe krótkie komunikaty: `Poprzednia sesja nie miała tonażu…`, `Porównanie będzie dostępne po wysłaniu treningu.`, `Nie zaliczono żadnej serii…` | AC-4.3, E-6, Q5 | Brak wariantów w analizie; potrzebne do uczciwego opisu | prawnik (LR-2), właściciel (Q5) |
| D-10 | Tonaż w kg z separatorem (`formatVolumeKg`) w całym ekranie, także w „Zobacz postęp” (dziś popup używa ton) | spójność | Jedna jednostka na ekranie | ux (zatwierdzone tu) |
| D-11 | Toast „NOWY MAX” znika; treść rekordu jest w sekcji „Nowe rekordy”; grafika `w-[200px]` zamiast pełnej szerokości | AC-5.2, Q4 | Ekran końcowy nie przewija się za daleko; grafika nie dominuje nad tonażem | ux (zatwierdzone tu) |
| D-12 | Minimalny rozmiar etykiet 11 px (dziś 10 px w części ekranu) | 00, sekcja 7 | Czytelność z odległości i kontrast | ux (zatwierdzone tu) |
| D-13 | Gold CTA w pasku globalnym i w dialogu zastępuje czerwień `#FF1A4B` (`active-workout-global-bar.tsx` linie 204, 279) | AC-9.2 | Zgodne z P9 | ux (zatwierdzone tu) |
| D-14 | W `workout-plan-card.tsx:70` pozostaje czerwony badge `#FF1A4B` (poza przepływem zakończenia) | poza zakresem | Nie jest częścią zakończenia; zgłoszone do backlogu systemowego | backlog, ux |

---

## 14. Wymagania dla frontend (skrót mapowania na pliki)

- `components/active-workout/guided-session-layout.tsx`: etykieta `Zakończ ostatnią serię i zapisz` (warunek: ostatnia otwarta, zaliczalna); usunąć błąd `Podaj ciężar` dla serii bez ciężaru (decyzja p. 7); `onFinishSession` przez wspólny hook.
- `components/active-workout/session-menu-sheet.tsx`: `Zakończ trening` jako `cta`; wyświetlanie `Zapisuję…` przy `finishPending`.
- `components/active-workout/active-workout-global-bar.tsx`: `cta` zamiast `#FF1A4B`; brak `window.alert`; komunikat błędu przez ekran zapisu.
- `components/active-workout/workout-all-sets-done-dialog.tsx`: warianty z sekcji 6; liczniki rozdzielone.
- `components/active-workout/workout-saving-screen.tsx` (nowy): stany z sekcji 5.
- `components/active-workout/workout-finished-screen.tsx`: przebudowa wg sekcji 8; `PlanCompareDialog` jako sekcja; cardio patch; bez `sessionStorage`.
- `lib/active-workout-copy.ts`: `primarySetActionLabel` dla ostatniej serii; teksty z sekcji 9.
- `lib/workout-finish-format.ts`: funkcja `workoutFinishFooterLine` usunięta razem z stopką (D-8); `formatWorkoutDurationPl` zostaje.
- `components/reports/workout-complete-popup.tsx`: usunąć (wraz z montowaniem w `app-shell.tsx`).
- `components/workout/WorkoutSummary.tsx`: usunąć (0 importów).
- Sprawdzić `components/active-workout/rest-break-screen.tsx:261` (`Zakończ trening`): po usunięciu `startRest` po ostatniej serii etykieta może być martwa; zgłosić do ADR jeśli nie ma dalszego użycia.

---

## 15. Lista kontrolna dla tester (spójność wyglądu)

- [ ] Brak tekstów: „Trening zrobiony”, „Trening zapisany”, „Koniec treningu”, „Gotowe”, „OK”, „vs poprzedni plan”, „Wszystkie serie wykonane” w `components/` i `lib/` (poza testami).
- [ ] Brak `#FF1A4B` w `components/active-workout/` poza `workout-plan-card.tsx` (D-14).
- [ ] Wszystkie przyciski zakończenia (`Zakończ trening`, `Zakończ ostatnią serię i zapisz`, `Zakończ i zapisz`, `Zapisz cardio`, `Zamknij`, `Spróbuj ponownie`) używają `variant="cta"`.
- [ ] Cele dotykowe ≥ 44 px (przyciski 48 px, stepper 48 px, pola 48 px).
- [ ] Liczby w kolumnach mają `tabular-nums`.
- [ ] Stany z sekcji 10 są wyrenderowane (test z mockiem `queued`, `error`, `slow`, brak porównania, brak rekordów).
- [ ] Ekran 360 x 640 bez przewijania stopki (stopka zawsze widoczna, treść przewija się).
- [ ] Dialogi mają fokus na przycisku bezpiecznym; Esc = „Wróć”.

---

## 16. Co pozostaje otwarte

1. **Makieta właściciela** (artefakt Claude) jest referencją wizualną; ten dokument jej nie zastępuje. Przed etapem 8 właściciel potwierdza zgodność kolorów i układu z artefaktem (jeśli różnią się, decyzja: artefakt albo ten dokument, z aktualizacją tego pliku).
2. **Q5** (zapis bez zaliczonych serii): wariant z dopiskiem jest założeniem analityka. Wymaga potwierdzenia właściciela.
3. **Aktualizacja `docs/ux/00-system-projektowy-stan.md`** po implementacji (nowy ekran zapisu, scalenie popupu, usunięcie `WorkoutCompletePopup`, `WorkoutSummary`). Dodatek zrobi ux przy etapie 8.
4. **Grafika PR** (`lib/pr-achievement-image.ts`): zmiana promptu i seeda zgodnie z LR-7 wymaga przeglądu prawnika; ten dokument nie zmienia treści promptu.

---

## 17. Werdykt ux

**ZATWIERDZONE Z UWAGAMI.**

Specyfikacja jest kompletna dla ekranu zapisu, dialogów, ekranu „Trening zakończony”, pasku cardio i stanów (ładowanie, błąd, pusty, offline, częściowe dane, sukces; brak uprawnień opisany jako 404). Mikrokopia jest spójna z LR-2 i nie używa zakazanych zwrotów. Kolory i typografia wyłącznie z istniejących tokenów (bez nowych zmiennych). Odstępstwa od analizy i ADR są jawne (sekcja 13) i nie blokują implementacji; D-1, D-2 i D-3 wymagają potwierdzenia przez analityka i architekta przed kodowaniem dialogów. Uwagi niskiego ryzyka (sekcja 16) idą do backlogu z właścicielem `ux`.

---

## 18. Etap 7 - przegląd spójności wyglądu i mikrokopii (ux, 2026-10-25)

Przegląd wykonano z kodu (JSX, klasy Tailwind, teksty), bez zrzutów ekranu. Kontrasty podane jako przybliżone (tło `--gym-black`, ok. #0a0a0a). Werdykt: **ODRZUCONE** (etap 5, frontend). Po poprawkach ux powtarza przegląd tylko dla punktów 18.2 wysokich i średnich, a tester sprawdza przepływ D-3 (18.2 pkt 1).

### 18.1 Zaakceptowane zmiany względem specyfikacji (po przeglądzie)

| # | Zmiana w kodzie | Dlaczego akceptujemy |
|---|---|---|
| A-1 | Dialog „Zakończyć trening?” zamyka się od razu po „Zakończ i zapisz”; stan zajęty (`Zapisuję…`) nie jest widoczny w dialogu, bo ekran „Zapisuję trening…” przejmuje go zaraz po kliknięciu. Dotyczy `WorkoutFinishConfirmDialog` (`busy` pozostaje jako zabezpieczenie). | Ten sam wzorzec co dialog pominiętych (sekcja 6.3). Jeden widoczny stan zajęty, bez dwóch pod rząd. Sekcja 7 dopisuje: „stan zajęty: dialog zamyka się, ekran zapisu przejmuje”. |
| A-2 | Stan `saving` cardio pokazany w przycisku edytora (`Zapisuję cardio…`), a nie dopiskiem na zwiniętym pasku. | Edytor zostaje otwarty z wpisanymi wartościami (D-6), więc pasek nie musi zmieniać wyglądu w trakcie zapisu. |
| A-3 | Główny przycisk ekranu serii w trybie `compact` ma 52 px (`compact:h-[52px]`), a nie 56 px. | Wariant z 004 dla wysokości `max-height: 719px`; sekcja 2 (56 px) dotyczy ekranu zakończenia. |

### 18.2 Poprawki dla frontend (priorytet)

**Wysoki (blokuje werdykt):**

1. **D-3 nie jest zrealizowane.** Przy pominiętych lub niewykonanych seriach z paska globalnego i z menu pokazują się dwa dialogi pod rząd: najpierw „Zakończyć trening?”, potem „Zostały pominięte serie” / „Nie wszystkie serie wykonane”. Sekcja 1 i 7 wymagają jednego potwierdzenia: przy pominiętych od razu dialog pominiętych.
   - `components/active-workout/active-workout-global-bar.tsx:153-156` (`setConfirmCompleteOpen(true)` bez sprawdzenia) i `:201-206` (`WorkoutFinishConfirmDialog` zawsze).
   - `components/active-workout/active-workout-view.tsx:741` (`onFinishSession={() => setMenuFinishConfirmOpen(true)}`) i `:821-826`.
   - Poprawka: przed otwarciem dialogu „Zakończyć trening?” sprawdzić liczniki (`countSkippedWorkoutSets` + `countIncompleteWorkoutSets`). Gdy są > 0, wywołać `flow.requestFinish()` wprost (hook sam otworzy dialog pominiętych). Najlepiej jedna funkcja w `use-workout-finish-flow.ts` (np. `requestFinishFromMenuOrBar`), używana przez oba wejścia.
2. **Przycisk „Zakończ trening” w pasku globalnym nie ma nazwy na telefonie.** Etykieta jest w `<span className="hidden sm:inline">` (`active-workout-global-bar.tsx:159-161`), więc poniżej 640 px przycisk ma tylko ikonę bez nazwy dostępnej (WCAG 4.1.2). Dotyczy też stanu „Zapisuję…”. Poprawka: `aria-label` z tekstem `Zakończ trening` (albo `Zapisuję…` w stanie zajętym) i tekst widoczny lub `sr-only` na telefonie. Decyzję o widocznej etykiecie na telefonie podejmuje ux w poprawce.
3. **Kontrast etykiet na ekranie końcowym.** `text-white/45` (etykiety „Czas”, „Serie”, „Ćwiczenia”, `finished-screen.tsx:358, 366, 380`; „min” w `:638`) daje ok. 4,2:1, a `text-white/35` (`/16` przy `:375`) ok. 3:1. Oba poniżej 4,5:1 dla tekstu 11-15 px. Poprawka: `text-[var(--gym-text-secondary)]` (6,5:1), zgodnie z sekcją 2.
4. **„Usuń cardio” w stylu CTA.** `workout-finished-screen.tsx:718-736` zostawia `variant="cta"` także dla usunięcia (0 min). Sekcja 8.7 i 0.2 wymagają `outline` z tekstem `--destructive`. Złote CTA na destrukcji jest mylące przy danych zdrowotnych (LR-4).

**Średni:**

5. `workout-finished-screen.tsx:591, 595` - badge `bez porównania` i `nowe` w `text-[10px]`. Podnieść do 11 px (D-12).
6. `workout-finished-screen.tsx:425-428` - liczba mnoga. Dla 2-4 dodatkowych rekordów ma być „+N kolejne rekordy w tej sesji”; dla 5+ „+N kolejnych rekordów”. Obecnie 2-4 dostaje „kolejnych rekordów” (błędna odmiana).
7. `workout-finished-screen.tsx:224-226` (`cardioSummaryLine`) - format liczb: `3,2 km` (przecinek), `4 500 kroków` (spacja tysięcy). Obecnie `3.2 km` i `4500 kroków`.
8. `workout-finished-screen.tsx:300` - `bg-[#101010]` (hex poza tokenami). Zamienić na `app-card` z `px-3.5 py-2.5` (sekcja 8.2).
9. `workout-finished-screen.tsx:628-689` - edytor cardio: brak widocznej etykiety „Minuty cardio” przy stepperze (sekcja 9); brak obsługi Esc (sekcja 8.7 i 12). Dodać obie.
10. `active-workout-global-bar.tsx:236-269` - inline `AlertDialog` „Odrzucić aktywny trening?” dubluje `components/active-workout/workout-discard-session-dialog.tsx` (inny wygląd: bez `app-dialog`). Użyć wspólnego komponentu (zasada bez duplikatów).
11. `rest-break-screen.tsx:183` - kicker „Koniec treningu” w `WorkoutEndCard` to zakazany stan (sekcja 0.1 i 9). Zamienić na „Trening zakończony” lub „Wszystkie serie za tobą” (decyzja tekstu do zatwierdzenia przez ux; dotyczy ekranu przerwy, nie samego zakończenia).

**Niski:**

12. `workout-finished-screen.tsx:332` - jednostka `kg` ma `uppercase` (wyświetla „KG”). Sekcja 8.3 wymaga `kg`.
13. `workout-finished-screen.tsx:408` - linia rekordu: 14 px bez `tabular-nums`; sekcja 8.4 wymaga 15 px `font-semibold tabular-nums`. Nazwa ćwiczenia: 15 px `font-semibold` (obecnie 14 px `font-medium`). `lib/workout-finish-format.ts:19` zwraca `82,5 → 85 kg`; sekcja 8.4 wymaga `82,5 kg → 85 kg`.
14. `workout-finished-screen.tsx:371` - `aria-label` na `<p>` (ignorowany przez część czytników). Zamienić na tekst w `sr-only` (np. „z 16 serii wykonanych”).
15. `workout-finished-screen.tsx:290-294` - data: sekcja 8.2 wymaga `pt, 25 paź · 18:42`; obecnie separator to przecinek z `toLocaleString`.
16. `workout-finished-screen.tsx:436-490` - przy braku ćwiczeń sekcja „Najlepsze serie” ma się nie renderować (sekcja 8.5). Obecnie renderuje pustą kartę z licznikiem `0`.
17. `workout-finished-screen.tsx:319-321` - poświata `rgba(235,196,74,0.12)` na sztywno. Dopuszczalne do zostawienia, ale lepiej z tokenu `--gym-gold`.
18. `workout-finished-screen.tsx:746-748` - wiersz `empty`: brak `ChevronRight` i `aria-expanded`; wiersz `filled` nie ma etykiety „Cardio” ani przycisku „Edytuj” (sekcja 8.7). Wiersz może zostać klikalny, ale układ ma odpowiadać tabeli.
19. `workout-finished-screen.tsx:511` - `aria-controls` wskazuje na nieistniejący `id`, gdy postęp jest zwinięty. Renderować kontener zawsze (z `hidden`) albo pominąć `aria-controls`. Animacja 200 ms (sekcja 8.6) do dołożenia.
20. `workout-finished-screen.tsx:706-716` - w trakcie zapisu cardio pola nie są `readOnly`, a edytor nie ma `aria-busy` (sekcja 8.7).
21. `workout-finished-screen.tsx:275-` - kontener to `div`; sekcja 8 wymaga `<section aria-labelledby>`.
22. `workout-saving-screen.tsx:96-104` - treść błędu 13 px w `--gym-text-secondary`; sekcja 5.3 wymaga 14 px, biały 85%. Przyciski błędu: `max-w-sm` (obecnie szerokość kolumny).
23. `workout-all-sets-done-dialog.tsx:103-106, 117-120` - `aria-label` na `<dd>` z samą liczbą; sekcja 6.4 wymaga tekstu jednostki w tym samym elemencie (np. `sr-only`). Lista `dl` ma `rounded-2xl border` zamiast `app-card` (sekcja 6.1.2).
24. `guided-session-layout.tsx:636-643` - etykieta CTA `text-[17px]`; sekcja 4 wymaga 16 px, `leading-tight text-balance`. Brak `aria-busy` i blokady wizualnej na czas przejścia do zapisu (sekcja 4).
25. `guided-session-layout.tsx:384` - etykieta „Zakończ ostatnią serię i zapisz” pokazuje się dla każdej ostatniej otwartej serii. Sekcja 4 wymaga, żeby seria spełniała regułę zaliczenia (ciężar i powtórzenia). Doprecyzować z ux przed poprawką (decyzja: etykieta zawsze dla ostatniej otwartej, zalecana, albo tylko przy spełnionej regule).

### 18.3 Spójność trzech wejść

- Ekran serii (`active-workout-view.tsx`), pasek globalny (`active-workout-global-bar.tsx`) i menu sesji używają tych samych komponentów: `WorkoutFinishedScreen`, `WorkoutSavingScreen`, `WorkoutAllSetsDoneDialog`, `WorkoutFinishConfirmDialog` oraz `useWorkoutFinishFlow`. Ekran końcowy i ekran zapisu nie mają rozjazdów wizualnych między wejściami.
- Rozjazdy są tylko w wiringu (pkt 1 i 10 wyżej): dialog potwierdzenia i odrzucenia.
- `zeroCompleted` jest liczony tym samym wzorem w obu miejscach (`countSetsDone(...).done - skippedCount`).

### 18.4 Zgodność z tokenami

Brak nowych tokenów w zmienionych plikach. Hex poza tokenami: `workout-finished-screen.tsx:300` (`#101010`, pkt 8) i `:321` (rgba, pkt 17). `#FF1A4B` w przepływie nie występuje. `#FF9500` i `#0f0f0f` w `active-workout-view.tsx:766, 874-875` nie są częścią przepływu zakończenia (nie oceniano ich w tym przeglądzie); do backlogu systemowego (jak D-14).

---

## 19. Etap 7b - powtórka przeglądu po poprawkach frontend (ux, 2026-10-25)

Zakres: B-3..B-6 z 18.2 oraz licznik serii (sekcja 8.3 i 12). Pozostałe uwagi 18.2 (pkt 5-25) oceniono pod kątem blokowania werdyktu. Przegląd z kodu (JSX, klasy, hook, `app/globals.css`), bez zrzutów. Kontrasty policzono ze względnej luminancji WCAG (sRGB), a nie z nazwy klasy.

### 19.1 Poprawki wysokie

| Punkt | Werdykt | Weryfikacja w kodzie |
|---|---|---|
| **B-3 (D-3)** dwa dialogi pod rząd | **ZATWIERDZONE** | `use-workout-finish-flow.ts` → `requestFinishFromSecondaryEntry`: liczy `countSkippedWorkoutSets + countIncompleteWorkoutSets`. Przy sumie > 0 wywołuje `requestFinish()`, które ustawia `skipped-dialog` (pierwsza pętla znajduje pominiętą, a `incomplete` oznacza `!done`, więc `findFirstSkippedWorkoutTarget` zawsze zwraca cel i ścieżka bez celu nie występuje). `WorkoutFinishConfirmDialog` NIE jest otwierany. Przy sumie = 0 wywołuje `openConfirmDialog()`, a potwierdzenie woła `requestFinish()` z zerowymi licznikami, czyli `doSave`. Oba warianty spełniają sekcję 1 i 7. Pasek globalny zwraca `null` na `/active-workout` (`active-workout-global-bar.tsx`, linia ok. 97), więc dialog pominiętych nie dubluje się z tym z `active-workout-view.tsx` (linia ok. 808). Ostatnia seria nadal idzie wprost przez `requestFinish()` (zgodnie z 0.5). |
| **B-4** nazwa przycisku w pasku | **ZATWIERDZONE** | `active-workout-global-bar.tsx` ok. linia 153: `aria-label` ustawiony bezwarunkowo (bez breakpointu), w stanie zapisu `Zapisuję…`. Widoczny tekst w `<span className="hidden sm:inline" aria-hidden="true">` ma tę samą treść co nazwa, więc czytnik czyta jedno „Zakończ trening” (bez podwójnego odczytu). Zgodne z WCAG 2.5.3 (nazwa zawiera widoczny tekst). |
| **B-5** kontrast etykiet | **ZATWIERDZONE** | Token `--gym-text-secondary: #9a9182` (`app/globals.css:83`, ten sam w bloku motywu `:179`). Względna luminancja ok. 0,287. Kontrast: wobec `--gym-black` (#070708) ok. **6,5:1**; wobec `--gym-surface` (#161616) ok. **5,8:1**; wobec `--gym-surface-raised` (#1c1c1f) ok. **5,5:1**; wobec `app-card` (białe 3,8% na czerni, ok. #101010) ok. **6,1:1**. Wszystkie ≥ 4,5:1 dla 11-15 px. Dla porównania: `white/35` na czerni ok. **3,1:1** (błąd był prawdziwy), `white/45` ok. **4,5:1** (granica; zmiana zasadna z marginesem). |
| **B-6** „Usuń cardio” | **ZATWIERDZONE** | `workout-finished-screen.tsx` ok. linia 745-752: gdy `draftMinutes === 0 && cardioMinutes > 0`, wariant `outline` plus `border-[var(--destructive)]/55 text-[var(--destructive)] hover:bg-[var(--destructive)]/10`. Kontrast `#ff3347` na czerni ok. **5,6:1**. Zgodne z sekcją 8.7 i LR-4 (tekst „0 min usuwa całe cardio, także tętno, kalorie i kroki” jest widoczny nad przyciskiem). Spójność z repo: patrz 19.4 (N-2). |

### 19.2 Licznik serii (`sr-only`) - ODRZUCONE (regresja)

Obecny kod (`workout-finished-screen.tsx` ok. linia 376-400): w jednym `<p>` leży widoczne `{setsDone}` plus `<span>/{setsTotal}</span>` oraz `<span className="sr-only"> z {setsTotal} serii wykonanych</span>`. Czytnik czyta więc „**14/16 z 16 serii wykonanych**”: liczba wykonanych jest sprzeczna (14 vs 16), a skrót „z 16” powtarza całość. Sekcja 8.3 wymaga `aria-label` „14 z 16 serii wykonanych”, a sekcja 12 wymaga jednego elementu z liczbą i jednostką. Poprawka: `<span aria-hidden="true">` na widocznej liczbie i ułamku, a `<span className="sr-only">` z treścią `{setsDone} z {setsTotal} serii wykonanych` (gdy `setsTotal > 0`). Tekst sr-only musi zawierać `setsDone`, nie tylko `setsTotal`.

### 19.3 Pozostałe uwagi 18.2 (pkt 5-25) - decyzja o blokowaniu

**Blokują werdykt (poprawki małe, mechaniczne, w dwóch plikach):**

| Pkt | Problem | Poprawka |
|---|---|---|
| 6 | `workout-finished-screen.tsx:450`: „+N kolejnych rekordów” dla N = 2-4 (błędna odmiana). | Dla 2-4: `+${n} kolejne rekordy w tej sesji`; dla 5+: `+${n} kolejnych rekordów`. Błąd gramatyczny w tekście sukcesu, nie do zostawienia. |
| 7 | `workout-finished-screen.tsx:224-226` (`cardioSummaryLine`): `3.2 km`, `4500 kroków`. | Format polski: `3,2 km`, `4 500 kroków` (`Intl.NumberFormat("pl-PL")`). Ta sama funkcja, jeden wiersz. |
| 10 | `active-workout-global-bar.tsx:236-269`: inline `AlertDialog` „Odrzucić aktywny trening?” (bez `app-dialog`, `variant="destructive"`) dubluje `WorkoutDiscardSessionDialog` z menu sesji („Zakończyć bez zapisu?”, rose). To ten sam czyn w dwóch wejściach z innym tytułem, innym wyglądem i innym przyciskiem. Sekcja 18.3 twierdzi brak rozjazdów, co dla odrzucenia nie jest prawdą. | Użyć `WorkoutDiscardSessionDialog` w pasku (usunąć inline dialog). Jeden komponent, jeden tekst. |
| 11 | `rest-break-screen.tsx:183`: kicker „Koniec treningu” w `WorkoutEndCard`. Termin zakazany w sekcji 0.1 (stan przerwy). | Kicker „Trening zakończony” (nagłówek „Wszystkie serie za tobą” zostaje). |
| R-1 | Licznik serii (sekcja 19.2). Regresja względem 8.3 i 12. | Jak w 19.2. |

**Zostają w backlogu jako ZATWIERDZONE Z UWAGAMI (właściciel: frontend, uzgodnienia: ux):**

| Pkt | Problem | Priorytet |
|---|---|---|
| 5 | Badge `bez porównania` / `nowe` w `text-[10px]` (`:613`, `:617`); spec D-12 wymaga 11 px. | średni |
| 8 | `bg-[#101010]` na pasku zapisu (`:320`); zamienić na `app-card`. | niski |
| 9 | Edytor cardio: stepper minut bez widocznej etykiety „Minuty cardio” (ma `aria-label` przycisków i jednostkę `min`, więc kontekst jest); brak Esc. | średni |
| 12 | `kg` przy tonażu z `uppercase` (`:352`, wyświetla „KG”); sekcja 8.3 wymaga `kg`. | niski |
| 13 | Linia rekordu bez `tabular-nums` i 15 px; format `82,5 → 85 kg` (`lib/workout-finish-format.ts:19`) bez jednostki przy pierwszej wartości. | średni |
| 15 | Data z przecinkiem zamiast `·` (sekcja 8.2). | niski |
| 16 | Pusta karta „Najlepsze serie” przy braku ćwiczeń (sekcja 8.5 wymaga braku sekcji). | niski |
| 17 | Poświata `rgba(235,196,74,0.12)` na sztywno zamiast tokenu `--gym-gold`. | niski |
| 18 | Wiersz cardio: brak szewronu i „Edytuj” w stanie `filled`, brak `aria-expanded` w `empty`. | niski |
| 19 | `aria-controls="workout-finish-progress-panel"` wskazuje na nieistniejący `id`, gdy postęp jest zwinięty (błąd walidacji ARIA). Renderować kontener z `hidden` albo pominąć atrybut. | średni |
| 20 | Pola cardio w trakcie zapisu bez `readOnly`, brak `aria-busy` na edytorze. | niski |
| 21 | Kontener ekranu to `div`, a sekcja 8 wymaga `<section aria-labelledby>`. | niski |
| 22 | Błąd zapisu ekranu zapisu: 13 px zamiast 14 px, przyciski `max-w-sm`. | niski |
| 23 | `aria-label` na `<dd>` z samą liczbą w `workout-all-sets-done-dialog.tsx` (sekcja 6.4); lista `dl` z `rounded-2xl border` zamiast `app-card`. | średni |
| 24 | Etykieta CTA w `guided-session-layout.tsx` w `text-[17px]` (sekcja 4 wymaga 16 px). | niski |
| 25 | Etykieta „Zakończ ostatnią serię i zapisz” pokazuje się przy każdej ostatniej otwartej serii, także bez wymaganych danych. Decyzja ux (zalecane: zawsze dla ostatniej otwartej, a walidacja w komunikacie pod serią). | średni |

Pkt 14 (`aria-label` na liczniku) zamknięty przez poprawkę licznika (ale patrz 19.2: treść sr-only do korekty).

### 19.4 Nowe obserwacje (poza 18.2, backlog)

- **N-1 (średni)**: pasek globalny (wejście do zakończenia) używa `text-white/45` na etykiecie „Kontynuuj trening — wróć do sesji” (11 px) i `text-white/50`/`/45` przy czasie i postępie. Ten sam problem co B-5, tylko poza ekranem końcowym. Tło paska jest półprzezroczyste, więc kontrast trzeba zmierzyć na zrzucie; do backlogu systemowego.
- **N-2 (średni, backlog systemowy)**: w repo są trzy wzorce destrukcyjne: `Button variant="destructive"` (`components/ui/button.tsx:17`, „Odrzuć” w pasku), obrys z `--destructive` (cardio, ten przegląd) i rose-palette w `workout-discard-session-dialog.tsx` (nie używa tokenu `--destructive`). Docelowo jeden wzorzec: `variant="destructive"` z tokenem `--destructive`. Nie blokuje tego zadania.
- **N-3 (niski)**: w edytorze cardio można zejść do 0 min przy `cardioMinutes === 0`; przycisk ma wtedy wariant `cta` „Zapisz cardio” i zapisuje brak zmian. Nieszkodliwe, do doprecyzowania w backlogu.

### 19.5 Zaakceptowane zmiany (sekcja 18.1) - bez zmian

A-1..A-3 pozostają zaakceptowane (bez nowych odstępstw).

### 19.6 Werdykt ux (etap 7b)

**ODRZUCONE** (cofnięcie do etapu 5, frontend) - wyłącznie z powodu pięciu drobnych poprawek blokujących (19.2 i 19.3: pkt 6, 7, 10, 11 oraz R-1). Poprawki B-3, B-4, B-5 i B-6 są zrealizowane poprawnie i zostają zatwierdzone. Po wprowadzeniu pięciu poprawek ux wykona ponowną, ograniczoną weryfikację tylko tych punktów (bez pełnego przeglądu), a tester potwierdzi przepływ D-3. Jeśli te pięć punktów zostanie domkniętych, werdykt przechodzi na **ZATWIERDZONE Z UWAGAMI** (backlog z 19.3 i 19.4, właściciel frontend, uzgodnienia ux).
