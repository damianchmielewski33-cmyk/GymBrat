# 008 - Plany treningowe, atlas ćwiczeń i import: specyfikacja UX (etap 4)

- **Autor**: ux (etap 4 zadania 008)
- **Data**: 2026-10-26
- **Karta**: `docs/zadania/008-redesign-planu-treningowego.md`
- **Wejście**: `docs/analiza/008-redesign-planu-treningowego.md` (US-1..US-16, BR-1..BR-13, sekcja 4 problemy, sekcja 10 pytania Q1-Q5), `docs/ux/00-system-projektowy-stan.md` (tokeny, komponenty), wzorzec `docs/ux/007-redesign-profil.md`. Architektura (`docs/adr/008-redesign-planu-treningowego.md`) nie istnieje jeszcze w chwili pisania; rozstrzygnięcia z niej, które zmieniają wygląd lub przepływ, trzeba potwierdzić przy przeglądzie.
- **Makieta statyczna**: `docs/ux/008-redesign-planu-treningowego-makieta.html` (14 ramek: wejście z menu, lista, wybór sposobu, edytor pusty i z ćwiczeniami, atlas, wybór ćwiczenia, karta ćwiczenia, import krok 1 i 2, panel stanów K1-K11). Makieta jest referencją dla `frontend`. Gdy różni się od tego dokumentu, wygrywa dokument, a różnicę zgłaszamy.
- **Aktualizacja 2 (2026-10-26)**: po decyzjach właściciela produktu (atlas w skali, karta ćwiczenia z sekcją prywatną, pewność odczytu w imporcie). Zmiany opisane w sekcji 18. Makieta: nowe ramki E1b, E1c, E3b; zmienione E1, E2, E3, F2; panel stanów K4b i K11-K17.
- **Status treści**: mikrokopia jest propozycją. Teksty o danych zdrowotnych w notatce i w eksporcie planu wymagają tylko przeglądu `prawnik` w zakresie LR (analiza sekcja 7 - brak nowych zgód w tym zadaniu). Opisy ćwiczeń w karcie (sekcja 6.5) są przykładami do napisania przez zespół (BR-11, AC-8.9).

---

## 0. Kluczowe decyzje UX

1. **Jedno miejsce wejścia.** Plany są w szufladzie Menu, w sekcji „Trening”, jako osobna pozycja „Plany treningowe”. Profil nie ma żadnego odniesienia do planów (AC-1.2).
2. **Jedno główne działanie na liście.** Na liście planów jest jedno CTA „Nowy plan”. Import i atlas to drogi wtórne, pokazane niżej i ciszej. Znika kafelek AI, kafelek „Dodaj swój plan”, link „Moje ćwiczenia” i karta importu nad listą (US-12, analiza 4.2.1).
3. **Jeden zapis w edytorze.** Zapis jest tylko na dolnym pasku („Zapisz plan”). W nagłówku nie ma przycisku zapisu. Zamknięcie z niezapisanymi zmianami pyta, zanim cokolwiek zniknie (AC-3.5).
4. **Ćwiczenie to wiersz, nie formularz.** Wiersz zwinięty pokazuje najważniejsze dane (nazwa, serie × powtórzenia, RIR, partia). Pola szczegółowe są w rozwiniętym wierszu, po jednym ćwiczeniu naraz (analiza 4.2.7).
5. **Atlas jest pełnoprawnym miejscem, nie dodatkiem do selecta.** Partie mają glif (sylwetka) i liczbę ćwiczeń, a wyszukiwarka i wybór do planu to ta sama lista (AC-4.1, AC-8.1).
6. **Import pokazuje wynik przed zapisem.** Użytkownik widzi wykryte plany i ćwiczenia, może je odznaczyć i poprawić, i dopiero potem zapisuje (AC-7.1, AC-7.2).
7. **Usuwanie zawsze z potwierdzeniem.** Ćwiczenie i plan: `ConfirmDialog` (zamiast natywnego `window.confirm`, analiza 4.1.5).
8. **Kolejność bez atrapy.** Uchwyt przeciągania znika. Kolejność zmienia się w trybie „Zmień kolejność” przyciskami ↑ ↓ 44 px (decyzja w sekcji 4.3).
9. **Atlas w skali** (aktualizacja 2). Partie (14, stałe) zostają nawigacją, bo rośnie liczba ćwiczeń w partii, nie liczba partii. Pasek filtrów (Partia, Sprzęt, Poziom, Rodzaj ruchu), sortowanie i paginacja po 40 zamiast jednej długiej listy (sekcja 18.2).
10. **Karta ćwiczenia: instrukcja pierwsza** (aktualizacja 2). „Jak wykonać” i wskazówki są zawsze widoczne. Film od zespołu to dodatek. Na dole karty sekcja „Tylko dla Ciebie” z własnym linkiem i notatką (sekcja 18.3).
11. **Pewność odczytu w imporcie** (aktualizacja 2). Każdy wiersz ma plakietkę z tekstem: „Wysoka pewność”, „Sprawdź nazwę”, „Sprawdź wiersz”. Wiersze z niską pewnością są domyślnie odznaczone (sekcja 18.4).

---

## 1. Stan obecny - ocena krytyczna (wg kodu i zrzutów)

Potwierdzone w kodzie (`components/workout-plan/workout-plan-editor.tsx`, `components/treningi/no-plan-card.tsx`, `app/(dashboard)/profile/page.tsx`, `components/layout/app-menu-button.tsx`):

| # | Problem | Dowód w kodzie / zrzucie | Priorytet |
|---|---|---|---|
| S-1 | Dwa przyciski zapisu na jednym ekranie i trzy wyjścia | Nagłówek „Zapisz plan” (`workout-plan-editor.tsx:407`), na dole „Zapisz”, „Anuluj”, „Zamknij edytor” (`:713`) | Wysoki |
| S-2 | Zapis przy zamknięciu gubi zmiany bez pytania | „Zamknij edytor” wywołuje `closeEditor()` bez potwierdzenia (analiza 4.1.3) | Wysoki |
| S-3 | Pięć dróg tworzenia na jednym ekranie: „Nowy plan”, „Moje ćwiczenia”, „Dodaj swój plan treningowy”, „Import”, „Stwórz plan z AI” | `:564`, `:574`, `:598`, zrzut 1, `:644` | Wysoki |
| S-4 | „Moje ćwiczenia” otwiera nowy, pusty plan (etykieta kłamie) | `:574`, analiza 4.2.3 | Średni |
| S-5 | Kafelek „Stwórz plan z AI” z wyborem dni i poziomu. Funkcja usunięta, ale UI zajmuje miejsce | `:644`, zrzut 1 | Wysoki (do usunięcia) |
| S-6 | Atrapa uchwytu przeciągania (`GripVertical`, `aria-hidden`) sugeruje funkcję, której nie ma | `:466` | Wysoki (mylące) |
| S-7 | Usuwanie ćwiczenia z listy jednym kliknięciem, bez potwierdzenia | analiza 4.1.4 | Wysoki (utrata danych) |
| S-8 | Natywny `window.confirm` przy usuwaniu planu | `:328` | Średni |
| S-9 | Nagłówek opisowy zmienia treść między listą a edytorem; dłuższy niż potrzeba | `:381` („Nadaj nazwę dnia, ustaw ćwiczenia…”), zrzut 2 („PROFIL / Plan treningowy”) | Średni |
| S-10 | Pusty stan odsyła do przycisku, który jest niżej („Wybierz „+ Nowy plan” poniżej”) | `:428` | Średni |
| S-11 | Wiersz ćwiczenia ma ok. 4 rzędy inputów naraz (strzałki, nazwa, licznik, usuń, YouTube, 4 pola liczbowe, superseria, notatka) | analiza 4.2.7 | Wysoki na telefonie |
| S-12 | Pola liczbowe bez przycisków +/−, bez klawiatury numerycznej | analiza 4.2.8 | Wysoki (dotyk w trakcie treningu) |
| S-13 | Wybór ćwiczenia: natywny select partii, wyniki bez glifów, 165 pozycji w jednej gęstej liście, „Dodaj własne” schowane za linkiem | `:754` (pusty stan), zrzut 3 | Wysoki |
| S-14 | Brak wizualnego systemu partii (tylko tekst, zero ikon i sylwetki na liście) | analiza 4.2.14 | Średni |
| S-15 | Wejście w menu „Plan treningowy” prowadzi do startu, nie do planów | `components/layout/app-menu-button.tsx:345-353` (`href="/workout-plan"`) | Wysoki (mylące) |
| S-16 | Karta planu bez CTA; trzy style kart na jednym ekranie (`glass-panel`/`app-card`/`rounded-[18px]`) | system projektowy sekcja 4 i 8 (pozycje 3-4) | Średni |
| S-17 | Akcenty neon i złoto przemiennie (kafelek AI i „Dodaj” w neonie, import w złotym) | zrzuty 1 i 3, analiza 4.2.9 | Średni |
| S-18 | Hub „Treningi” bez planu: CTA „Ustaw plan” prowadzi do Profilu | `components/treningi/no-plan-card.tsx:30` | Wysoki (z US-15) |
| S-19 | Profil: blok planu z „Ustaw plan” | `app/(dashboard)/profile/page.tsx:161` | Wysoki (AC-1.2) |

Zachować (analiza 4.4): wyszukiwarkę z normalizacją PL i aliasami EN, import z trzech formatów z walidacją, wizualne pojęcie „dnia” w Treningach.

---

## 2. Architektura informacji i nawigacja

### 2.1 Mapa ekranów

| Ekran | Trasa (propozycja, decyzja `architekt`) | Cel | Pozycja w mapie |
|---|---|---|---|
| Lista planów | `/plany` | Zarządzanie dniami planu, kolejność, nowy plan, akcje | 2 |
| Wybór sposobu | `/plany/nowy` | „Od zera” albo „Z pliku” | 3 |
| Edytor planu | `/plany/[id]` (nowy plan: `/plany/nowy?tryb=zero` i zapis tworzy `[id]`) | Nazwa, ćwiczenia, serie, zapis | 4 |
| Import | `/plany/import` (kroki 1 i 2 na jednej trasie, krok w stanie) | Wybór pliku i podgląd | 5 |
| Atlas | `/plany/atlas` (filtr partii w `?partia=`) | Przeglądanie partii i ćwiczeń | 6 |
| Wybór ćwiczenia | arkusz w edytorze (ta sama lista co atlas) | Dodanie do planu | 7 |
| Karta ćwiczenia | arkusz w atlasie, adres `?cwiczenie=<catalogId>` (link głęboki) | Opis, technika, dodaj do planu | 8 |

Stare adresy (AC-1.3, AC-1.4): `/profile/workout-plan` przekierowuje na `/plany`; `/profile/workout-plan?edit=<id>` na `/plany/<id>`. Identyfikator planu bez zmian.

**Trasy poza `profile/layout.tsx`** (zgodnie z wymaganiem z `007`, sekcja 1.4): plany nie dziedziczą wiersza konta ani zakładek Profilu.

### 2.2 Wejście z menu (A1, A2)

- Szuflada Menu, sekcja **Trening**, trzy pozycje w tej kolejności:
  1. **Treningi** - ikona `Play`, podtytuł „start dzisiejszego treningu”, prowadzi do `/workout-plan` (hub, bez zmian).
  2. **Plany treningowe** - ikona `ListChecks`, podtytuł „dni i ćwiczenia, nowy plan”, prowadzi do `/plany`.
  3. **Atlas ćwiczeń** - ikona `BookOpen`, podtytuł „partie, technika, wyszukiwarka”, prowadzi do `/plany/atlas`.
- Aktywna pozycja: `aria-current="page"`, obrys złoty 60%, tło złote 10% (jak `.mi.on` w makiecie). Kolor nie jest jedynym nośnikiem: pozycja ma też tekst i `aria-current`.
- Podtytuły małą literą, jak w reszcie menu (`00-system-projektowy-stan.md` sekcja 6).
- Po wyborze pozycji szuflada się zamyka i scroll body jest odblokowany (AC-1.7).
- **Profil** (A2): blok „Plan treningowy” usunięty. Zostają cele cardio i raporty.
- **Hub Treningi bez planu** (`NoPlanCard`, S-18): CTA „Ustaw plan” zmienia się na „Dodaj plan” prowadzące do `/plany/nowy` (AC-15.1). Hub z planami („Edytuj dzień”) prowadzi do `/plany/[id]`.

### 2.3 Belka dolna i FAB

- Belka dolna (`AppShell`) jest widoczna na liście planów i w atlasie (to sekcje „Trening”). **Ukryta** w edytorze, w imporcie i w wyborze wyniku wyszukiwania, bo dolny pasek akcji zajmuje miejsce na dole (analogicznie do `/active-workout`, bez zmian w reszcie aplikacji).
- FAB „Raport” nie pojawia się na `/plany*` (decyzja: zarządzanie planem to nie miejsce na dodawanie raportu; Q-U5 w sekcji 10).

---

## 3. Tokeny i typografia

Wyłącznie istniejące tokeny i klasy (`app/globals.css`, `components/layout/screen.tsx`, `components/ui/*`). Nowe tokeny nie są potrzebne.

| Rola | Token / klasa | Uwagi |
|---|---|---|
| Tło ekranu | `--gym-black` | |
| Karta (plan, ćwiczenie, kafel partii) | `app-card` (22 px) | wewnątrz `p-4` (zamiast `glass-panel`, S-16) |
| Akcent główny | `--gym-gold`, `Button variant="cta"` | jedno CTA na ekran; tekst `--neon-fg` |
| Akcent wtórny | `Button variant="outline"` | obrys `--gym-border-gold` |
| Destrukcyjne | `--destructive` (obrys 45%, tło 6%) | tylko przy usuwaniu i w dialogach |
| Tekst drugorzędny | `--gym-text-secondary` (`#9a9182`) | zamiast `text-white/40` (kontrast, `00-system` sekcja 7) |
| Pole edytowalne | `bg-black/50`, obrys złoty 35%, 48 px | jak `Input` |
| Wartość wyliczona (sumy, suma serii) | `--gym-surface-gold` | bez obrysu |
| Glif partii | `--gym-glyph-base`, `--gym-glyph-stroke`, akcent `--gym-gold` (główna), `--gym-gold-deep` 55% (pomocnicza) | istniejące tokeny z zadania 003 |
| Sukces / zapisano | `--gym-success` + ikona `Check` | zawsze z tekstem |
| Niezapisane zmiany | `--gym-gold` + kropka + tekst | zawsze z tekstem |
| Ostrzeżenie / błąd | `InlineBanner variant="warning"` / `"error"` | |

**Typografia** (pięć poziomów, min. 11 px):

| Poziom | Klasa | Użycie |
|---|---|---|
| H1 | `appPageTitleClass` (28 px, `font-heading`) | „Plany treningowe”, „Atlas ćwiczeń”, nazwa planu w edytorze (26 px dla długich nazw) |
| H2 | `SectionLabel` (`titleAs="h2"`) | „Twoje plany”, „Ćwiczenia · 3”, „Jak wykonać” |
| H3 | 15 px `font-semibold` | nazwa planu na karcie, nazwa ćwiczenia w wierszu |
| Treść | 14 px | opisy, pola |
| Meta | 12 px `--gym-text-secondary` | „6 ćwiczeń · 19 serii · zmiana 22.10” |
| Etykieta uppercase | 11 px, `tracking-[0.14em]` | „TRENING”, „PLANY TRENINGOWE”, rodziny partii |

Liczby (serie, powtórzenia, RIR, kcal i liczniki partii): `tabular-nums`. Format dat: `dd.mm`, w karcie planu z rokiem tylko przy datach starszych niż 12 miesięcy.

**Odstępy:** skala 4/8 px. Między sekcjami `mt-5` (20 px). Między kartami `gap-3` (12 px) lub `gap-2.5` na liście ćwiczeń. Wewnątrz karty `p-4`. Pasek zapisu: `border-t border-white/10`, `pt-3 pb-4`.

**Promienie:** karta 22 px, pole i wiersz 16 px, kafel partii 22 px, przycisk 16 px, chip i pill `rounded-full`.

**Ruch:** rozwinięcie wiersza ćwiczenia 200 ms (wysokość). Otwarcie arkuszy i dialogów jak `Sheet`/`AlertDialog`. Przy `prefers-reduced-motion` bez animacji; szkielety statyczne (bez `animate-pulse`).

---

## 4. Lista planów i kolejność (A, B1-B3, C1, K9)

### 4.1 Lista (`/plany`, B1)

**Cel:** w 5 sekund wiadomo, jakie są dni i jak się nazywają. Jedno działanie: „Nowy plan”.

**Układ (390 px, od góry):**
1. Belka górna (`BrandMark`, dzwonek, `AppMenuButton`) - jak w całej aplikacji.
2. `AppPageHeader`: kicker „TRENING”, H1 „Plany treningowe”, meta „Kolejność tutaj = kolejność w Treningach.” (jedna linia, bez akapitu).
3. **CTA „Nowy plan”**: `Button variant="cta"`, pełna szerokość, 48 px, ikona `Plus`. Jedyne główne działanie.
4. **Sekcja 01 „Twoje plany · N”** (`SectionLabel`) z przyciskiem ghost „Zmień kolejność” (44 px) po prawej.
5. **Lista kart planów** (`app-card`, patrz 4.2).
6. **Sekcja 02 „Ćwiczenia”**: jeden wiersz-link „Atlas ćwiczeń · 165 ćwiczeń w 14 partiach” (ikona `BookOpen`, strzałka `ChevronRight`). Atlas jest drogą wtórną, nie konkurencją dla CTA.
7. Belka dolna (kontekst).

**Pozycje, które znikają względem dzisiaj:** kafelek „Dodaj swój plan” (duplikat „Nowy plan”), karta „Import planu” (przeniesiona do „Nowy plan → Z pliku”), „Moje ćwiczenia” (mylące, S-4), kafelek AI (S-5).

### 4.2 Karta planu (B1)

- Cały obszar tekstu i nazwa to link do `/plany/[id]` (min. 64 px wysokości). Przycisk „⋯” (44 × 44, `aria-haspopup="menu"`) osobno.
- **Zawartość:** H3 nazwa planu (1 linia, obcięcie wielokropkiem), meta „7 ćwiczeń · 16 serii · zmiana 14.10”, rząd partii: glif 32 px (`MuscleGlyph`, rozmiar `row`) + tekst partii (główne, max 3, reszta „+2”).
- Brak ćwiczeń (szkic): status chip „Szkic” (`sys dash`) zamiast meta; tekst „Brak ćwiczeń. Dodaj co najmniej jedno, aby plan był w Treningach.”
- **Dostępność:** `aria-label` karty: „Push A, 6 ćwiczeń, 19 serii, zmiana 22.10”. Przycisk „⋯”: „Akcje planu Push A”.

### 4.3 Kolejność (B3) - decyzja o atrapie

**Decyzja:** usuwamy atrapę uchwytu i **nie** wdrażamy przeciągania (drag-and-drop) w v1. Zamiast tego tryb „Zmień kolejność”.

**Uzasadnienie:**
- Przeciąganie na dotyk w liście z przewijaniem pionowym na PWA i w WebView Androida daje konflikty gestów (przewijanie kontra przeciąganie), a w `SheetContent` i w `AppShell` bywa niestabilne.
- Przyciski ↑ ↓ 44 px działają jedną ręką, są dostępne klawiaturą i czytnikiem (AC-14.2), i dają ten sam wynik w kolejce Treningów.
- Dla 2-5 dni w planie (typowo) przycisk jest szybszy niż gest.

**Zachowanie:** po wejściu w tryb karty pokazują ↑ ↓ po prawej (44 × 36 px, `aria-label` „Przesuń Push A w górę”); pierwszy element nie ma ↑, ostatni nie ma ↓ (wyłączone, `aria-disabled`). Przycisk „Gotowe” (cta, 48 px) wychodzi z trybu. Każda zmiana zapisuje kolejność od razu (bez „Zapisz”) i pokazuje status „Zapisano 10:42” w nagłówku trybu. Błąd zapisu: kolejność wraca do poprzedniej, `InlineBanner error`.

**Zapis kolejności:** osobna akcja serwerowa (decyzja `architekt`, w analizie 3.2); UX nie zakłada pełnego zapisu planu.

### 4.4 Menu akcji planu (B2)

Arkusz `Sheet` (dolny) z tytułem nazwy planu:
1. **Edytuj plan** (`outline`, 48 px, ikona `Pencil`) → `/plany/[id]`.
2. **Duplikuj** (`outline`, ikona `Copy`) → tworzy kopię z nazwą „… (kopia)” i otwiera ją w edytorze. Nie wymaga potwierdzenia (odwracalne przez usunięcie kopii).
3. **Usuń plan** (`destructive` outline, ikona `Trash2`) → `ConfirmDialog` (K6). Brak potwierdzenia = brak usunięcia.

Ten sam zestaw w `DropdownMenu` na szerokich ekranach (od `md`). Na telefonie zawsze arkusz (łatwiejszy cel dotykowy).

### 4.5 Stany listy (K1, K2, K9, K10)

- **Ładowanie:** trzy szkielety kart (`app-card`, prostokąty 16 px w szarym `sk`), nagłówek jako szary blok 120 px. Bez pulsowania przy `prefers-reduced-motion`.
- **Pusty (pierwsze użycie, AC-2.2):** karta `flat` z ikoną `ListChecks`, tekst „Nie masz jeszcze planu”, opis „Plan to jeden dzień treningowy, np. „Push A”. Dodasz go z ćwiczeniami z atlasu.”, i dwa przyciski: „Utwórz pierwszy plan” (cta) i „Importuj z pliku” (outline). Tylko te dwa - żadnych innych kafelków (AC-2.2).
- **Błąd (K2):** `InlineBanner error` „Nie udało się wczytać planów.” + „Spróbuj ponownie” (outline, 44 px). Bez starych danych jako aktualnych.
- **Częściowe dane (K10, AC-2.3):** `InlineBanner info` nad listą „Część planów nie mogła zostać wczytana. Pozostałe są dostępne.” + link „Zgłoś problem”. Lista pokazuje pozostałe plany.
- **Offline:** `InlineBanner warning` „Brak połączenia. Plany pokażemy po powrocie sieci.” - bez zer i bez pustej listy.
- **Brak uprawnień:** sesja wygasła, obsługa globalna (`AuthPageFrame`), bez osobnego ekranu.
- **Sukces:** po zapisie planu (z edytora) status w `useSaveFeedback` (modal „Zapisano plan”, zgodnie z systemem), po czym powrót na listę z nowym planem na górze sekcji (`Nowy` chip na 5 s, z tekstem, nie kolorem).

---

## 5. Wybór sposobu (C1) i nowy plan

- Dwie karty o **równej randze** (obie `app-card`, 96 px, ikona w kwadracie 48 px):
  - **Od zera** - ikona `Pencil`. Podtytuł: „Nazwij plan i dodaj ćwiczenia z atlasu. Zaczynasz z pustą listą.”
  - **Z pliku** - ikona `FileUp`. Podtytuł: „PDF, Word albo Excel. Sprawdzisz wynik przed zapisem.”
- Brak trzeciej karty (AI usunięte, AC-11.1, AC-12.1).
- Nagłówek: kicker „NOWY PLAN”, H1 „Jak zacząć?”, meta „Plan możesz potem zmienić w każdej chwili.”.
- Przycisk wstecz (44 px, `ChevronLeft`) w belce górnej.

---

## 6. Edytor planu (D1, D2, D3, K3, K5, K7, K8)

### 6.1 Zasady

- **Jedna trasa, jeden formularz.** Nazwa i ćwiczenia na jednym ekranie, bez kroków wielostronicowych. Kreator to edytor z sekcjami 01 i 02.
- **Jeden nagłówek.** Kicker „PLAN TRENINGOWY”, H1 = nazwa planu lub „Nowy plan”. Opisowego akapitu nie ma (S-9).
- **Jedno miejsce zapisu:** dolny pasek (`stickybar`), przycisk „Zapisz plan” (cta, 48 px, pełna szerokość). Status nad przyciskiem (`role="status"`).
- **Górny pasek:** tylko „Zamknij” (`X`, 44 px, `aria-label` „Zamknij edytor”) i chip stanu zapisu („Szkic”, „Zapisano 10:42”, „Niezapisane zmiany”).
- **Brak ćwiczeń = szkic.** Zapis szkicu jest dozwolony (założenie analizy). Plan bez ćwiczeń nie pojawia się w Treningach; chip „Szkic” i status na pasku mówią to wprost: „Szkic. Dodaj ćwiczenie, aby plan pojawił się w Treningach.” Przycisk „Zapisz plan” jest wtedy wyłączony (`aria-disabled`) - decyzja z analizy: zapis do Treningów wymaga co najmniej jednego ćwiczenia. Jeśli `architekt` pozwoli na zapis szkicu, przycisk zmienia etykietę na „Zapisz szkic”.

### 6.2 Sekcja 01 - Nazwa

- Pole `Input` 48 px, etykieta „Nazwa planu”, placeholder „np. Push A, Nogi, Pull”, licznik `0/80` w prawym dolnym rogu pola (tabular).
- Wskazówka: „Krótko, np. nazwa dnia. Widać ją w Treningach.”
- Błąd: „Podaj nazwę planu.” lub „Nazwa może mieć do 80 znaków.” pod polem, `aria-invalid`, `aria-describedby` (AC-3.1). Komunikat nie jest w nagłówku.

### 6.3 Sekcja 02 - Ćwiczenia (wiersz zwinięty i rozwinięty)

**Wiersz zwinięty** (`exr`, `app-card`, `exr-h` min. 64 px):
- Numer kolejności (28 px, `tabular-nums`), H3 nazwa ćwiczenia (1 linia), pod nią meta: „4 × 8–10 · RIR 2 · Klatka piersiowa”.
- Przycisk „Rozwiń” (44 px, `ChevronDown`, `aria-expanded`). Cały wiersz nagłówka jest też celem rozwinięcia (min. 64 px).
- Superseria: złota pionowa kreska po lewej (`border-left 2 px --gym-gold`) i opis w meta „superseria z 2”. Kolor + tekst.

**Wiersz rozwinięty** (jedno ćwiczenie naraz, inne zwinięte; D2):
1. **Serie** - stepper: `[−]` 48 px, wartość (tabular, 18 px), `[+]` 48 px. Zakres 1-20. Wartość można wpisać klawiaturą numeryczną (`inputMode="numeric"`, AC-14.1).
2. **Powtórzenia** - ten sam stepper, zakres 1-999. Dla zakresu („8–10”) pole tekstowe z przełącznikiem „zakres”/„liczba” (wariant w makiecie: zakres z podpisem).
3. **RIR** - siatka 7 pól 44 px: 0, 1, 2, 3, 4, 5, „brak”. Jeden wybrany (`aria-checked`, `role="radiogroup"`). Wskazówka: „Ile powtórzeń zostawiasz w zapasie. Brak = bez wartości.”
4. **Tempo** - pole tekstowe, placeholder „np. 3010”, wskazówka „Opcjonalnie: 3 s w dół, 0 pauza, 1 s w górę, 0.”, max 8 znaków (AC-3.2).
5. **Odpoczynek** - stepper co 15 s (zakres 0-600 s), domyślnie 90 s. (Jeśli nie ma w danych obecnego planu, `architekt` potwierdza, czy pole wchodzi w v1; w makiecie jest jako wartość statyczna.)
6. **Link do techniki** - pole YouTube (`inputMode="url"`), wskazówka: „Domyślny z atlasu. Zmiana dotyczy tylko tego planu.” Gdy jest link z atlasu: ikona check i tekst (BR-12). Brak linku: „Dodaj link, jeśli chcesz mieć filmik przy ćwiczeniu.”
7. **Notatka** - `Textarea`, max 200 znaków, licznik, placeholder „np. łopatki ściągnięte”. Wskazówka stała: „Nie wpisuj danych medycznych (np. kontuzji). Notatka jest widoczna tylko dla Ciebie.” (analiza sekcja 7, prywatność).
8. **Superseria** - przełącznik „Superseria z następnym ćwiczeniem” z opisem „Pokazuje oba ćwiczenia razem w Treningach.” Ostatnie ćwiczenie w planie: przełącznik wyłączony z tekstem „Brak następnego ćwiczenia.”
9. **Akcje wiersza** - trzy przyciski 44 px w jednym rzędzie: „Wyżej” (outline, ↑), „Niżej” (outline, ↓), „Usuń” (destructive ghost, `Trash2`). Wyłączone przy skrajnych pozycjach.

**Usuwanie ćwiczenia (S-7, AC-6.2, AC-6.3):** „Usuń” otwiera `ConfirmDialog` (K7): tytuł „Usunąć „Wyciskanie żołnierskie” z planu?”, treść „Serie i ustawienia tego ćwiczenia znikną z planu. Historia treningów zostaje.”, przyciski „Anuluj” (outline) i „Usuń ćwiczenie” (destructive, wypełniony). Po usunięciu ostatniego ćwiczenia plan zostaje jako szkic z pustym stanem (6.4).

**Zmiana nazwy ćwiczenia w planie** nie ma osobnego UI - nazwa jest z atlasu. Własne ćwiczenie ma pole nazwy w wierszu (AC-5.3); zmiana nazwy przepisuje historię (BR-7) i jest opisana w wierszu hintem „Zmiana nazwy zaktualizuje też historię tego ćwiczenia.”

**Dodaj ćwiczenie:** przycisk `outline` pełnej szerokości 48 px pod listą, ikona `Plus`, tekst „Dodaj ćwiczenie”. Otwiera arkusz wyboru (E2). Ćwiczenie dodane trafia na koniec planu z domyślnymi wartościami (3 serie, 10 powtórzeń, RIR 1; AC-4.4) i jest od razu rozwinięte.

### 6.4 Pusty edytor (D1)

- Karta `flat` ze ikoną (glif 64 px, `Dumbbell` jako ikona zastępcza), H3 „Dodaj pierwsze ćwiczenie”, tekst „Wybierz partię w atlasie. Serie, powtórzenia i RIR ustawisz w wierszu ćwiczenia.” (zastępuje S-10 i obecny pusty stan).
- Pod kartą przycisk „Dodaj ćwiczenie” (outline).
- Pasek zapisu: status „Szkic. Dodaj ćwiczenie, aby plan pojawił się w Treningach.” i „Zapisz plan” wyłączony.

### 6.5 Zapis, status i wyjście (K3, K5, K8)

- **Stany zapisu:** „Szkic” (brak ćwiczeń) → „Niezapisane zmiany” (złota kropka, aktywny przycisk) → „Zapisywanie…” (przycisk `aria-busy`, pola zablokowane tylko na czas żądania) → „Zapisano 10:42” (sukces: modal `useSaveFeedback` „Zapisano plan „Push A”.”, auto-zamknięcie 3,2 s; wracamy na listę).
- **Błąd zapisu (AC-13.2):** `InlineBanner error` nad przyciskiem: „Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie. Wpisane wartości zostają w formularzu.” Przycisk „Spróbuj ponownie” w banerze. Wartości nie są czyszczone.
- **Offline (K3, AC-3.4):** `InlineBanner warning` „Brak połączenia. Zapis planu wymaga sieci. Wpisane wartości zostają w formularzu.” Lokalny szkic (AC-3.6) jest decyzją `architekt`; UX wymaga, by szkic nie zniknął po odświeżeniu, a przy powrocie pojawił się baner „Masz niezapisany szkic. Przywrócić?” z przyciskami „Przywróć” (cta) i „Odrzuć” (ghost).
- **Zamknięcie z niezapisanymi zmianami (K5, AC-3.5):** `ConfirmDialog`, tytuł „Odrzucić zmiany?”, treść „Plan „Push A” ma zmiany, których nie zapisano.”, przyciski: „Wróć do planu” (cta, pierwszy w kolejności fokusu) i „Odrzuć zmiany” (ghost w kolorze destrukcyjnym, nie pełny). Dotyczy też wyjścia wstecz z przeglądarki (`beforeunload` w PWA nie jest wiarygodny - obsługa w routerze, `architekt`).
- **Konflikt wielu urządzeń (BR-10):** `InlineBanner warning` „Ten plan zmieniono na innym urządzeniu. Wczytaj najnowszy, zanim zapiszesz.” + „Wczytaj najnowszy” (cta). Bez automatycznego nadpisania.

### 6.6 Responsywność edytora

- **360 px:** stepper w jednej kolumnie. Serie i powtórzenia obok siebie (dwie kolumny po 165 px). RIR siedem pól po 44 px z odstępem 6 px (328 px dostępne).
- **390 px:** układ z makiety.
- **Od `md` (768 px):** kontener `max-w-xl` (zgodnie z `APP_SHELL_MAX`), pasek zapisu w tym samym kontenerze, nie na pełnej szerokości ekranu.

---

## 7. Atlas ćwiczeń (E1, E2, E3)

### 7.1 Model partii i rodzin (wizualny system partii, US-9)

14 partii z `MUSCLE_CATEGORIES` pogrupowanych w **cztery rodziny**, tylko do nawigacji (chipy i nagłówki sekcji):

| Rodzina | Partie (`categoryId`) |
|---|---|
| Góra ciała | `chest`, `back_upper`, `back_mid`, `back_lower`, `shoulders`, `biceps`, `triceps`, `forearms` |
| Tułów | `core` |
| Dół ciała | `quads`, `glutes`, `hamstrings`, `calves` |
| Cardio | `cardio` |

- Każda partia ma **glif** (`MuscleGlyph`, istniejący komponent z zadania 003): sylwetka z podświetloną partią głowną (`--gym-gold`) i pomocniczymi (`--gym-gold-deep` 55%). Brak nowych ikon partii. Dla `cardio` bez glifu sylwetki: ikona `HeartPulse`.
- Każda partia ma **nazwę tekstową** i liczbę ćwiczeń. Kolor nie jest jedynym nośnikiem (AC-9.1).
- Glif poniżej 24 px nie jest używany (`00-system` sekcja 4). Na liście wyników 32 px (`row`), w kaflach 40 px, w karcie 64 px (`hero`).

### 7.2 Wyszukiwarka i filtr (E1, E2)

- **Pole wyszukiwania** `Input` 48 px, ikona `Search`, placeholder „Szukaj: wyciskanie, bench, wiosłowanie…”. Etykieta widoczna lub `aria-label` „Szukaj ćwiczenia”.
- **Debounce 250 ms** (AC-4.7 - wyniki po min. 2 znakach). Przy 1 znaku: podpowiedź „Wpisz co najmniej 2 znaki.” (małym tekstem pod polem), bez wyników.
- **Dopasowanie:** PL i EN, bez wrażliwości na ogonki (AC-4.2, AC-8.6). Logika bez zmian (`exerciseMatchesQuery`).
- **Chipy rodzin usunięte z ekranu głównego atlasu** (aktualizacja 2): zdublowały nagłówki rodzin nad kaflami. Filtrowanie żyje na liście partii w pasku filtrów (sekcja 18.2).
- **Filtr partii** jest jednym z filtrów paska (chip „Partia · …”) w atlasie i w arkuszu wyboru. Zastępuje natywny `select` (S-13). Wybór partii jest jednokrotny. Szczegóły: sekcja 18.2.

### 7.3 Widok domyślny atlasu (E1)

- Nagłówek: kicker „TRENING”, H1 „Atlas ćwiczeń”, meta „{N} ćwiczeń w 14 partiach” (N z bazy; w makiecie 165 to przykład), pod nią „Szukaj po polsku lub po angielsku.”.
- Wyszukiwarka i kafle partii (bez chipów rodzin, sekcja 18.2).
- **Kafle partii** (2 kolumny na 390 px, 3 kolumny od `md`): `app-card` 84 px min., glif 40 px po lewej, nazwa partii (14 px, semibold), liczba ćwiczeń (12 px, meta). Całość to link do `/plany/atlas?partia=<id>`.
- Nagłówki rodzin (`fam`): „GÓRA CIAŁA · 8 PARTII”, z uppercase 11 px.
- Belka dolna widoczna.

### 7.4 Wyniki (lista w arkuszu wyboru i w atlasie, E2)

- **Grupowanie:** po partii głównej, nagłówek sekcji sticky (`grp`): nazwa partii + liczba wyników, `tabular-nums`. Kolejność grup: kolejność z `MUSCLE_CATEGORIES`; wewnątrz grupy alfabetycznie (założenie AC-4.3).
- **Wiersz wyniku** (`ex`, min. 64 px): glif 32 px, nazwa PL (15 px, semibold, 1-2 linie), pod nią meta „Bench press · sztanga · średni” (EN alias, sprzęt, poziom - tylko gdy dane są znane, AC-8.2). Po prawej:
  - w **arkuszu wyboru** (z edytora): przycisk „+” 44 px, `aria-label` „Dodaj {nazwa} do planu”. Po dodaniu: przycisk zmienia się na check „Dodano” przez 1,5 s, arkusz zostaje otwarty (tryb „dodaj kolejne”, AC-4.4 - decyzja: otwarty).
  - w **atlasie**: chevron („Otwórz kartę”) - cały wiersz to link do karty ćwiczenia (E3).
- **Duplikat (AC-4.6):** ćwiczenie już w planie: wiersz z meta „W planie: 2 razy” i przyciskiem „+” (dozwolone, bez blokady; zgodnie z założeniem analizy).
- **Brak wyników (K4, AC-4.5):** karta `flat` „Brak wyników dla „…”” + tekst „Spróbuj krótszej nazwy albo po angielsku.” + przycisk „Dodaj jako własne ćwiczenie” (outline, z podaną nazwą).

### 7.5 Dodawanie własnego ćwiczenia (AC-5.1, AC-5.2)

- **Nie jest domyślną drogą.** Na końcu listy wyników, po oddzielającej linii (`border-top`), tekst „Nie ma tego ćwiczenia na liście?” i przycisk „Dodaj własne ćwiczenie” (outline, pełna szerokość, 48 px). Ta opcja jest pod wynikami, nie na górze.
- **Formularz własnego:** pole „Nazwa ćwiczenia” (2-80 znaków), wybór partii (chipy partii, wymagany), przycisk „Dodaj do planu” (cta). Podpowiedź „Nie wpisuj danych medycznych.” (prywatność).
- **Podobna nazwa do atlasu (AC-5.2):** pod polem `InlineBanner info` „Podobne w atlasie: Wyciskanie hantli na ławce płaskiej. Wybrać je zamiast tworzyć nowe?” + „Wybierz z atlasu” (outline) i „Zostaw własne” (ghost).

### 7.6 Karta ćwiczenia (E3, AC-8.3-8.5)

Arkusz (`Sheet`) otwierany z atlasu, adres `?cwiczenie=<catalogId>` (link głęboki działa po odświeżeniu):

- **Nagłówek:** kicker „ATLAS · KLATKA PIERSIOWA” (partia główna), przycisk zamknięcia (44 px).
- **Tytuł:** H2 nazwa PL (22 px), pod nią EN alias „Bench press (barbell)”. Jeśli brak aliasu, linia nie jest renderowana (AC-8.4).
- **Glif hero** (64 px, obok tytułu) + **legenda tekstowa**: „Główne: Klatka piersiowa (widok przedni)” i „Pomocnicze: triceps, przednie barki”. Widok tylny, gdy partia główna jest z tyłu (`preferBackView`, AC-9.3).
- **Chipy (tylko znane dane):** sprzęt („Sztanga”), wariant („Ławka płaska”), poziom („Poziom: średni”). Brak danej = brak chipa.
- **Sekcja „Jak wykonać”** (aktualizacja 2: pierwsza sekcja, zawsze widoczna; 2-4 kroki jako lista numerowana, 14 px, lh 21). Brak opisu: jedno zdanie „Opis techniki jeszcze nie został dodany. Możesz dodać własną notatkę poniżej.” (sekcja 18.3).
- **Sekcja „Wskazówki”** (druga w kolejności, 2-3 punkty `ul`). Brak = ukryta.
- **Sekcja „Film techniki”** (dodatek, aktualizacja 2): tylko gdy admin zatwierdził film. `outline`, 48 px, ikona `Play`, tekst „Obejrzyj technikę”, ikona `ExternalLink`, `target="_blank" rel="noopener noreferrer"`, hint „Film dodany przez zespół GymBrat. Otwiera się w YouTube w nowej karcie.” Gdy brak filmu: sekcja nie jest renderowana (bez „Brak filmu” i bez „Zgłoś brak”; zmienia to AC-8.5, patrz 18.7 Q-A12). Prywatny link użytkownika jest w osobnej sekcji (18.3).
- **Sekcja „Twoja historia”:** pokazywana tylko, gdy użytkownik ma sesje z tym ćwiczeniem (ostatnie obciążenie i data). Brak danych = sekcja ukryta.
- **Stopka:** przycisk „Dodaj do planu” (cta 48 px). Otwiera wybór planu (sheet z listą planów i „Nowy plan”). Gdy wywołane z edytora, dodaje do bieżącego planu bez wyboru.
- **Dane o zdrowiu:** karta nie zawiera pól do wpisania danych zdrowotnych. Opisy są ogólne (BR-11).

**Uwaga do treści:** opisy, wskazówki i tytuły są pisane przez zespół lub z licencją (BR-11). Makieta zawiera przykładowe zdania do zastąpienia.

---

## 8. Import z pliku (F1, F2, K4-logika)

### 8.1 Zasada

Import zostaje (analiza sekcja 11), ale jest częścią „Nowy plan → Z pliku”, nie kartą na liście. Zapis dopiero po podglądzie (AC-7.1, AC-7.2).

### 8.2 Krok 1 - wybór pliku (F1)

- Nagłówek: kicker „NOWY PLAN · Z PLIKU”, H1 „Wybierz plik”, meta „PDF, Word (.doc, .docx) albo Excel (.xlsx, .xls, .xlsm). Maks. 8 MB.” (komunikat z walidacji bez zmian, AC-7.3).
- **Obszar wyboru:** przycisk-dropzone 96-120 px, obrys przerywany złoty 50%, ikona `FileUp`, tekst „Wybierz plik z urządzenia”, pod nim „Nie wysyłamy go, dopóki nie potwierdzisz wyniku podglądu.” (**wymaga architektury dwuetapowej**, sekcja 10 pyt. U-2). Po wyborze: nazwa pliku i rozmiar, przycisk „Zmień plik”.
- **Format pliku** (karta `flat`): krótki opis (nagłówek dnia, kolumny ćwiczenie / serie / powtórzenia) i mini-tabela przykładowa (AC-7.4 wskazówka formatu). To miejsce na wskazówkę z analizy sekcja 11.
- **Przycisk „Dalej: podgląd”** (cta, 48 px). Wyłączony bez pliku, z podpowiedzią „Najpierw wybierz plik.”.
- **Błędy:** zły format, za duży plik, pusty plik - `InlineBanner error` nad dropzone z dokładnym tekstem z dzisiejszej walidacji (AC-7.3). Plik bez rozpoznanych ćwiczeń: „Nie znaleziono ćwiczeń w dokumencie. Sprawdź format.” z linkiem do opisu formatu (AC-7.4). Limit 429: „Zbyt wiele prób. Spróbuj za chwilę.” z czasem (AC-13.4).
- **Ładowanie parsowania:** szkielet listy dni (3 bloki), przycisk „Analizuję plik…” (`aria-busy`), bez spinnera na całym ekranie.

### 8.3 Krok 2 - podgląd przed zapisem (F2)

- Nagłówek: kicker „Z PLIKU · nazwa_pliku.xlsx”, H1 „Sprawdź przed zapisem”, meta „Odznacz to, czego nie chcesz zapisać. Możesz poprawić nazwy i liczby.”
- **Znacznik liczby planów** w nagłówku (`sys`, np. „3 plany”).
- **Banner zbiorczy** (warning, gdy są ćwiczenia spoza atlasu): „2 ćwiczenia nie są w atlasie. Sprawdź nazwy. Zapiszą się jako własne.”
- **Blok dnia** (sekcja H2 z nazwą dnia wykrytą z pliku, np. „Dzień A · Push”, i chip „6 ćwiczeń”). Każdy dzień ma przełącznik „Zapisz ten dzień” (`role="switch"`). Odznaczony dzień nie trafia do zapisu.
- **Tabela ćwiczeń w dniu** (`pv`): kolumny: checkbox 44 px („Zapisz”), nazwa (pole edytowalne 44 px), serie (56 px, tabular, wycentrowane), powtórzenia (56 px). Pod nazwą wskazówka dopasowania:
  - dopasowano do atlasu: ikona check (`--gym-success`), tekst „Dopasowano: Wyciskanie sztangi na ławce płaskiej”,
  - brak w atlasie: tekst „Brak w atlasie, zapisze się jako własne. Sprawdź nazwę.” (kolor błędu tylko przy błędzie walidacji; tu neutralnie),
  - pominięte: „Pominięte. Nie trafi do planu.”
- **Walidacja w miejscu:** serie 1-20, powtórzenia 1-999 (BR-5). Błędna wartość: `aria-invalid`, komunikat pod polem.
- **Stopka (sticky):** status „Zapiszesz 2 plany · 11 ćwiczeń”, przycisk „Zapisz 2 plany” (cta), „Wróć do wyboru pliku” (ghost). Gdy nic nie jest zaznaczone: przycisk wyłączony z tekstem „Zaznacz co najmniej jeden dzień.”
- **Po zapisie (AC-7.5):** przejście na listę z wyróżnieniem nowo dodanych planów (chip „Nowy” na 5 s) lub, przy jednym planie, do jego edytora (jak dziś).
- **Zapis nieudany:** banner nad stopką, wartości zostają w podglądzie.

- **Pewność odczytu** (aktualizacja 2): plakietka per wiersz, filtr „Tylko do sprawdzenia” i zasada domyślnego zaznaczenia opisane w sekcji 18.4.

**Wpływ na bezpieczeństwo:** podgląd nie zmienia parserów. Ponowne testy zgodnie z analizą sekcja 11 (`tester-bezpieczenstwa` w etapie 7, jeśli API się zmieni).

---

## 9. Stany ekranów (macierz)

| Ekran | Ładowanie | Pusty | Błąd | Offline | Częściowy | Brak uprawnień | Sukces |
|---|---|---|---|---|---|---|---|
| Lista planów | 3 szkielety kart | „Utwórz pierwszy plan” + „Importuj” (K9) | baner + ponów (K2) | baner (plany niewidoczne) | część planów (K10) | sesja: globalnie | modal zapisu, chip „Nowy” |
| Wybór sposobu | nie dotyczy | nie dotyczy | nie dotyczy | nie dotyczy (przechodzi) | nie dotyczy | sesja: globalnie | nie dotyczy |
| Edytor | szkielet pól i wierszy | „Dodaj pierwsze ćwiczenie”, „Szkic” (D1) | baner nad paskiem + ponów | baner, wartości zostają (K3) | plan bez ćwiczeń = szkic | sesja: globalnie | modal „Zapisano plan” |
| Atlas | szkielet kafli (14) i wierszy (4 wiersze) | „Brak ćwiczeń dla tych filtrów” (K4b) / „Brak wyników” (K4) | baner + ponów | baner „Pokazujemy ostatnio wczytane ćwiczenia” lub „Atlas wymaga sieci” (K16) | wiersze bez części danych; „Pokaż kolejne 40” | nie dotyczy | „Znaleziono N” i „Pokazano X z Y”; przy dużej liczbie baner K12 |
| Karta ćwiczenia | szkielet nagłówka i sekcji tekstu | brak opisu: jedno zdanie w „Jak wykonać”; brak filmu: sekcja ukryta (K11) | baner „Nie udało się wczytać” | instrukcja z ostatniego wczytania; zapis prywatnej sekcji wymaga sieci (K13-K15) | brak filmu (K11) | nie dotyczy | „Zapisano” w sekcji prywatnej (K14) |
| Import - wybór | nie dotyczy | format pliku (wskazówka) | błędy pliku (limit, typ, pusty) | baner (nie wysyłamy) | nie dotyczy | sesja: globalnie | nie dotyczy |
| Import - podgląd | szkielet dni | filtr „Tylko do sprawdzenia” bez wierszy: „Wszystkie wiersze są pewne” | baner + zachowanie podglądu | baner, podgląd zostaje | wiersz niepewny: plakietka „Sprawdź wiersz” (18.4); brak dopasowań = „Sprawdź nazwę” | sesja: globalnie | modal zapisu |

---

## 10. Pytania do decyzji (otwarte) i rozstrzygnięcia UX

| # | Pytanie | Rekomendacja UX | Kto decyduje |
|---|---|---|---|
| U-1 | Q1 - szuflada Menu jako wejście (nie stały panel) | Potwierdzić: szuflada Menu. Makieta A1 zakłada szufladę. | Użytkownik |
| U-2 | Q5 - podgląd importu przed zapisem | Wymagany w specyfikacji (F2). Wymaga API dwuetapowego (wynik parsowania zapisywany jako szkic lub przekazywany do zapisu). | `architekt` (ADR) i użytkownik |
| U-3 | Q2 - czy „Ustaw plan” w Treningach zostaje jako link do `/plany` | Zostaje jako „Dodaj plan” (link do `/plany/nowy`), bez edytora inline. | `architekt` potwierdza trasę |
| U-4 | Q3 - model dni (jeden rekord = jeden dzień) | UX używa słowa „plan” dla pojedynczego dnia i „Plany treningowe” dla listy, bez słowa „dzień” w nawigacji. Zmiana modelu na program tygodniowy zmieniłaby ekran listy (grupy tygodni) - to osobne zadanie. | Użytkownik (po ADR) |
| U-5 | FAB „Raport” na `/plany*` | Nie pokazywać (sekcja 2.3). | Właściciel produktu |
| U-6 | Odpoczynek (stepper) w wierszu ćwiczenia - czy jest w v1 | Makieta pokazuje pole statyczne. Jeśli brak danych w modelu, pole ukryte. | `architekt` |
| U-7 | Zapis szkicu bez ćwiczeń | Dozwolony jako „Szkic”, nie w Treningach (sekcja 6.1). Jeśli `architekt` zakaże, przycisk „Zapisz plan” staje się nieaktywny bez wyjaśnienia - nie przyjmujemy. | `architekt` |
| U-8 | Szkic lokalny offline (AC-3.6) | Wymagane: baner „Masz niezapisany szkic. Przywrócić?”. Technika (localStorage vs IndexedDB) - `architekt`. | `architekt` |
| U-9 | Opisy, wskazówki, sprzęt, poziom w katalogu (Q4) | Wymagane w karcie. Źródło w kodzie (statyczne) jest założeniem analizy; edycja przez admina - osobne zadanie. | Użytkownik (Q4) |

---

## 11. Dostępność (WCAG 2.2 AA)

- **Kontrast:** tekst główny biały 90-92%, drugorzędny `--gym-text-secondary` (ok. 6,5:1 na czerni). Zakaz `text-white/45|40|35` na tekście informacyjnym tych ekranów. Placeholdery w kolorze drugorzędnym.
- **Cele dotykowe:** 44 px minimum dla każdego przycisku, chipa, zakładki i wiersza-linku. Przyciski zapisu, steppery i pola 48 px. Wiersze wyników min. 64 px.
- **Nazwy:** każde pole ma `<label>` (widoczny). Przyciski bez tekstu (ikony `X`, `MoreVertical`, `ChevronDown`) mają `aria-label` z kontekstem („Akcje planu Push A”). Kafle partii czytają nazwę i liczbę („Klatka piersiowa, 14 ćwiczeń”).
- **Glif (sylwetka):** `aria-hidden`; tekstowy odpowiednik (partia główna i pomocnicze) jest w wierszu i w legendzie karty (AC-8.8).
- **Stepper:** `aria-label` na każdym przycisku („Zmniejsz serie”, „Zwiększ serie”) i na wartości (`aria-live="polite"` przy zmianie). Wartość można wpisać.
- **RIR:** `role="radiogroup"`, `aria-checked` na każdej opcji, strzałki w grupie (kolejność Tab: jedna pozycja w grupie).
- **Przełączniki:** `role="switch"`, `aria-checked`, nazwa w `aria-label` („Superseria z następnym ćwiczeniem”).
- **Chipy filtra:** `aria-pressed` (zwykły Tab, nie strzałki). Wyniki grupowane: nagłówki grup to `h3` lub `role="heading"` z poziomem.
- **Dialogi:** fokus przechwycony, wraca do przycisku, który otworzył (`ConfirmDialog`). Pierwszy przycisk w kolejności fokusu: bezpieczny (np. „Wróć do planu”, „Anuluj”).
- **Kolejność fokusu w edytorze:** Zamknij → chip stanu → nazwa planu → wiersze ćwiczeń od góry (przycisk rozwinięcia, potem pola) → „Dodaj ćwiczenie” → „Zapisz plan”. Po zapisie fokus wraca na nagłówek listy lub na baner.
- **Komunikaty:** statusy zapisu w `role="status"`, błędy w `role="alert"`. Baner sukcesu w `aria-live="polite"`.
- **Ruch:** bez animacji przy `prefers-reduced-motion`; szkielety statyczne.
- **Język:** `lang="pl"`. Jednostki pełnymi słowami w `aria-label` („cztery serie”, „pięć powtórzeń”, „trzy sekundy w dół”). Skróty tylko wizualnie (×, s, min).
- **Liczby:** `inputMode="numeric"` dla serii, powtórzeń, odpoczynku. `inputMode="url"` dla linku. `inputMode="text"` dla tempa (wartość z cyfr, ale format z „3010” nie jest liczbą).

---

## 12. Prywatność i treści wolne

- Notatka i nazwa własnego ćwiczenia są wolnym tekstem, który może zawierać dane zdrowotne (np. kontuzje). W UI: stała wskazówka „Nie wpisuj danych medycznych (np. kontuzji). Notatka jest widoczna tylko dla Ciebie.” Bez logowania treści (analiza sekcja 7; `frontend` i `architekt` pilnują logów i Sentry).
- Karta ćwiczenia nie zbiera danych o użytkowniku poza „Twoją historią” (już istniejącą) i prywatną sekcją „Tylko dla Ciebie” (aktualizacja 2): własny link i notatka (limit 300 znaków), stała wskazówka o danych medycznych, widoczne tylko dla właściciela konta. Nie trafiają do logów, Sentry, społeczności ani do wspólnego katalogu. Eksport i usuwanie: pytanie do `prawnik` (Q-A6, sekcja 18.7).
- Import: plik nie jest zapisywany na serwerze, dopóki użytkownik nie potwierdzi podglądu (wymaga U-2). Komunikat przed wyborem pliku: „Nie wysyłamy go, dopóki nie potwierdzisz wyniku podglądu.” Jeśli `architekt` wybierze inny model, komunikat zmienia się zgodnie z realnym zachowaniem (nie obiecujemy czegoś, czego system nie robi).

---

## 13. Responsywność

| Szerokość | Zmiana |
|---|---|
| 360 px (minimum) | Kafle partii w 2 kolumnach po ok. 164 px, nazwy partii w jednej linii z obcięciem. Stepper serii i powtórzeń w jednej kolumnie. RIR: 7 pól po 44 px (328 px). Podgląd importu: nazwa w pełnej szerokości, serie i powtórzenia w jednej linii pod nią. |
| 390 px (wzór makiety) | Układ jak w makiecie. |
| 768 px i więcej (`md`) | Kontener `max-w-xl` (`APP_SHELL_MAX`), 3 kolumny kafli partii, menu „⋯” jako `DropdownMenu`, pasek zapisu w kontenerze. |

Tryb pionowy (telefon w trakcie treningu) jest najważniejszy. Wejście do planu z Treningów: max 2 tapnięcia (hub → „Edytuj dzień” → edytor).

---

## 14. Katalog komponentów (z istniejących; nowe tylko tam, gdzie brak odpowiednika)

| Element | Komponent | Status |
|---|---|---|
| Nagłówek ekranu | `AppPageHeader` | istniejący |
| Sekcja | `SectionLabel` (`titleAs="h2"`) | istniejący |
| Karta | `app-card` | istniejący |
| Przycisk | `Button` (`cta`, `outline`, `ghost`, `destructive`) | istniejący |
| Pole, textarea, etykieta | `Input`, `Textarea`, `Label` | istniejący |
| Potwierdzenie | `ConfirmDialog` | istniejący |
| Baner | `InlineBanner` (`info`, `warning`, `error`, `success`) | istniejący |
| Zapis (modal sukcesu) | `useSaveFeedback` | istniejący |
| Menu akcji planu | `DropdownMenu` (md+) / `Sheet` (telefon) | istniejący |
| Arkusz | `Sheet` | istniejący |
| Glif partii | `MuscleGlyph` (`size` `row` / `hero`) | istniejący (zadanie 003) |
| Stepper (serie, powtórzenia, odpoczynek) | **nowy** `ExerciseStepper` (w `components/plany/`) | nowy - brak odpowiednika (`SetRow` ma inne pola) |
| Wybór RIR | **nowy** `RirPicker` | nowy - brak odpowiednika |
| Wiersz ćwiczenia (zwinięty/rozwinięty) | **nowy** `PlanExerciseRow` | nowy - zastępuje wiersz w `workout-plan-editor.tsx` |
| Pasek filtrów atlasu (chipy z liczbą, przewijanie poziome) | **nowy** `AtlasFilterBar` (`components/plany/atlas/`) | nowy - brak odpowiednika; wygląd jak `chp` z `components/ui` i klasy makiety |
| Arkusz filtra (jedno- lub wielokrotny wybór z liczbami wyników) | **nowy** `AtlasFilterSheet` (wewnątrz `Sheet`) | nowy; pole wyboru: reużyć `Checkbox` z `components/ui`, jeśli istnieje (potwierdza `frontend`), nie tworzyć drugiego |
| Plakietka pewności odczytu (wysoka / sprawdź / niska / poprawione) | **nowy** `ConfidenceBadge` | nowy - `sys` nie ma ikony i wariantów znaczeniowych; brak duplikatu |
| Sekcja prywatna „Tylko dla Ciebie” (link, notatka, formularz) | **nowy** `PrivateExerciseNote` (`components/plany/`) | nowy - brak odpowiednika |
| Paginacja listy wyników („Pokaż kolejne 40”) | `Button variant="outline"` | istniejący, bez nowego komponentu |
| Karta planu | **nowy** `PlanCard` | nowy - zastępuje rozwijaną listę |
| Kafel partii | **nowy** `MuscleTile` | nowy |
| Wiersz wyniku wyszukiwania | **nowy** `ExerciseResultRow` (z trybem: dodaj / otwórz) | nowy - jeden komponent dla edytora i atlasu |
| Podgląd importu | **nowy** `ImportPreviewTable` | nowy |
| Karta ćwiczenia | **nowy** `ExerciseCard` (arkusz) - uwaga: nazwa kolidująca z martwym `components/workout/ExerciseCard.tsx`, który do usunięcia (`00-system` sekcja 8, pozycja 11) | nowy |
| Pasek zapisu (dolny) | **nowy** `StickySaveBar` (status + przycisk, `ThumbActionBar` jako wzorzec) | nowy - `ThumbActionBar` nie ma statusu |

Komponenty z `components/workout-plan/` i `components/treningi/` do usunięcia po wdrożeniu (`workout-plan-editor.tsx` 1143 linie, `workout-card.tsx` martwy, `workout-plan-word-import.tsx` przepisany). Kolejność usuwania ustala `architekt`.

Zasada duplikatów (`00-system` sekcja 8, pozycja 2): nowy kafel statystyki nie jest tworzony. Liczba serii i ćwiczeń w karcie to `meta` tekstem, nie `AppStatTile`.

---

## 15. Mikrokopia

| Miejsce | Tekst |
|---|---|
| Kicker listy | TRENING |
| H1 listy | Plany treningowe |
| Meta listy | Kolejność tutaj = kolejność w Treningach. |
| CTA listy | Nowy plan |
| Sekcja listy | Twoje plany · {N} |
| Tryb kolejności | Zmień kolejność · Gotowe |
| Wiersz atlasu na liście | Atlas ćwiczeń · {N} ćwiczeń w 14 partiach |
| Karta planu - meta | {N} ćwiczeń · {S} serii · zmiana {dd.mm} |
| Karta planu - szkic | Brak ćwiczeń. Dodaj co najmniej jedno, aby plan był w Treningach. |
| Menu akcji | Edytuj plan · Duplikuj · Usuń plan |
| Pusty stan listy | Nie masz jeszcze planu. Plan to jeden dzień treningowy, np. „Push A”. Dodasz go z ćwiczeniami z atlasu. |
| Pusty: CTA | Utwórz pierwszy plan · Importuj z pliku |
| Błąd listy | Nie udało się wczytać planów. Sprawdź połączenie i spróbuj ponownie. |
| Część planów | Część planów nie mogła zostać wczytana. Pozostałe są dostępne. |
| Wybór sposobu | Od zera: Nazwij plan i dodaj ćwiczenia z atlasu. Zaczynasz z pustą listą. · Z pliku: PDF, Word albo Excel. Sprawdzisz wynik przed zapisem. |
| Nazwa: placeholder | np. Push A, Nogi, Pull |
| Nazwa: wskazówka | Krótko, np. nazwa dnia. Widać ją w Treningach. |
| Nazwa: błąd | Podaj nazwę planu. / Nazwa może mieć do 80 znaków. |
| Edytor: pusty | Dodaj pierwsze ćwiczenie. Wybierz partię w atlasie. Serie, powtórzenia i RIR ustawisz w wierszu ćwiczenia. |
| Edytor: szkic | Szkic. Dodaj ćwiczenie, aby plan pojawił się w Treningach. |
| Status zapisu | Niezapisane zmiany · Zapisywanie… · Zapisano 10:42 |
| Błąd zapisu | Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie. Wpisane wartości zostają w formularzu. |
| Offline | Brak połączenia. Zapis planu wymaga sieci. Wpisane wartości zostają w formularzu. |
| Konflikt | Ten plan zmieniono na innym urządzeniu. Wczytaj najnowszy, zanim zapiszesz. |
| Szkic przywracany | Masz niezapisany szkic. Przywrócić? |
| Zamknięcie | Odrzucić zmiany? · Plan „{nazwa}” ma zmiany, których nie zapisano. · Wróć do planu / Odrzuć zmiany |
| Tempo: wskazówka | Opcjonalnie: 3 s w dół, 0 pauza, 1 s w górę, 0. |
| RIR: wskazówka | Ile powtórzeń zostawiasz w zapasie. Brak = bez wartości. |
| Notatka: wskazówka | Nie wpisuj danych medycznych (np. kontuzji). Notatka jest widoczna tylko dla Ciebie. |
| Superseria | Superseria z następnym ćwiczeniem · Pokazuje oba ćwiczenia razem w Treningach. |
| Superseria: ostatnie | Brak następnego ćwiczenia. |
| Usuń ćwiczenie: pytanie | Usunąć „{nazwa}” z planu? |
| Usuń ćwiczenie: treść | Serie i ustawienia tego ćwiczenia znikną z planu. Historia treningów zostaje. |
| Usuń plan: pytanie | Usunąć plan „{nazwa}”? |
| Usuń plan: treść | Plan zniknie z listy i z Treningów. Historia zakończonych treningów zostaje. |
| Zmiana nazwy ćwiczenia | Zmiana nazwy zaktualizuje też historię tego ćwiczenia. |
| Zapisano plan | Zapisano plan „{nazwa}”. |
| Atlas: meta | {N} ćwiczeń w 14 partiach. Szukaj po polsku lub po angielsku. |
| Atlas: min. 2 znaki | Wpisz co najmniej 2 znaki. |
| Brak wyników | Brak wyników dla „{fraza}”. Spróbuj krótszej nazwy albo po angielsku. |
| Brak wyników: CTA | Dodaj jako własne ćwiczenie |
| Dodano | Dodano |
| Duplikat | W planie: {N} razy |
| Własne: pytanie | Nie ma tego ćwiczenia na liście? |
| Własne: podobne | Podobne w atlasie: {nazwa}. Wybrać je zamiast tworzyć nowe? |
| Karta: technika | Obejrzyj technikę · Otwiera się w YouTube w nowej karcie. |
| Karta: brak filmu | Brak filmu do tego ćwiczenia. · Zgłoś brak |
| Karta: dodaj | Dodaj do planu |
| Import: wybór | Wybierz plik z urządzenia · Nie wysyłamy go, dopóki nie potwierdzisz wyniku podglądu. |
| Import: format | Każdy dzień zaczyna się nagłówkiem (np. „Dzień A”). Pod nim: ćwiczenie, serie i powtórzenia. |
| Import: dalej | Dalej: podgląd · Najpierw wybierz plik. |
| Import: banner | {N} ćwiczeń nie jest w atlasie. Sprawdź nazwy. Zapiszą się jako własne. |
| Import: dopasowano | Dopasowano: {nazwa z atlasu} |
| Import: pominięte | Pominięte. Nie trafi do planu. |
| Import: stopka | Zapiszesz {N} plany · {M} ćwiczeń · Zapisz {N} plany · Zaznacz co najmniej jeden dzień. |
| Import: brak ćwiczeń | Nie znaleziono ćwiczeń w dokumencie. Sprawdź format. |
| Import: limit | Zbyt wiele prób. Spróbuj za chwilę. |
| Atlas: filtry (aktualizacja 2) | Partia · Sprzęt · Poziom · Rodzaj ruchu · Wyczyść |
| Atlas: sortowanie | Sortuj: A–Z · Trafność · Poziom · Partia |
| Atlas: wynik | Znaleziono {N}. Pokazano {X} z {Y}. |
| Atlas: więcej | Pokaż kolejne {N} |
| Atlas: dużo wyników | Wyników jest dużo: {N}. Zawęź filtrem albo wpisz nazwę. |
| Atlas: zero przez filtry | Brak ćwiczeń dla tych filtrów. Usuń jeden filtr, aby zobaczyć więcej. · Usuń: Poziom „początkujący” ({N}) · Wyczyść wszystkie filtry |
| Atlas: arkusz filtra | Pokaż {N} ćwiczeń |
| Atlas: offline | Brak połączenia. Pokazujemy ostatnio wczytane ćwiczenia. · Atlas wymaga sieci. |
| Karta: instrukcja pusta | Opis techniki jeszcze nie został dodany. Możesz dodać własną notatkę poniżej. |
| Karta: film | Film techniki · Film dodany przez zespół GymBrat. Otwiera się w YouTube w nowej karcie. |
| Prywatne: nagłówek | Tylko dla Ciebie · Twój link i notatka. Nikt inny ich nie zobaczy. |
| Prywatne: pusty | Dodaj swój link lub notatkę |
| Prywatne: link | Link wideo (opcjonalnie) · Dowolny adres, np. z YouTube. Widoczny tylko dla Ciebie. · To nie wygląda na link. Wpisz adres zaczynający się od https://. |
| Prywatne: notatka | Notatka (opcjonalnie) · Nie wpisuj danych medycznych (np. kontuzji). Notatka jest widoczna tylko dla Ciebie. · zostało {N} znaków |
| Prywatne: usuń | Usuń swój link i notatkę · Usunąć swój link i notatkę? · Zniknie tylko z tej karty. Plan i historia się nie zmieniają. |
| Import: pewność | Wysoka pewność · Sprawdź nazwę · Sprawdź wiersz · Poprawione ręcznie |
| Import: legenda | Pewność odczytu z pliku. Sprawdź wiersze z plakietką przed zapisem. |
| Import: filtr wierszy | Tylko do sprawdzenia · {N} |

**Zakazane:** „Sukces!”, wykrzykniki, emotikony, „Keytel”, „VAPID”, „AI” w kontekście planu, „sekcja poniżej”, „Moje ćwiczenia” jako etykieta otwierająca edytor, „Stwórz”, „Wygeneruj”, „Zapisz” w dwóch miejscach naraz.

---

## 16. Co zmienia `frontend` (lista poprawek do odwzorowania)

Priorytet A (blokuje zgodność z analizą):
1. Usunąć kafelek AI, `generateAndSaveAiWorkoutPlans` z UI i wszystkie odwołania (AC-12.1).
2. Usunąć `window.confirm` (S-8) i zastąpić `ConfirmDialog`.
3. Usunąć atrapę uchwytu (`GripVertical`) i wdrożyć tryb „Zmień kolejność” z przyciskami ↑ ↓.
4. Jeden zapis w edytorze (pasek dolny). Usunąć przycisk zapisu z nagłówka i „Anuluj”.
5. Zamknięcie edytora z niezapisanymi zmianami przez `ConfirmDialog` (K5).
6. Usuwanie ćwiczenia z potwierdzeniem (K7).
7. Menu boczne: trzy pozycje w „Trening” (A1). Profil: usunąć blok planu (A2).

Priorytet B (wygląd):
8. Wiersz ćwiczenia zwinięty/rozwinięty, steppery 48 px, RIR siatka, link i notatka w rozwinięciu (D2).
9. Lista planów: jedno CTA, karta planu z meta i partiami, „⋯” jako menu akcji (B1, B2).
10. Atlas: wyszukiwarka 48 px, chipy rodzin, kafle partii z glifem (E1). Wyniki grupowane z sticky nagłówkiem (E2).
11. Podgląd importu z edytowalną tabelą i sticky stopką (F2).
12. Stany: szkielety, pusty, błąd, offline, dialogi (K1-K11).

Priorytet C (dopracowanie):
13. Karta ćwiczenia (E3) z linkiem `_blank` i brakiem danych ukrytym.
14. Chip „Nowy” na liście po imporcie (5 s, z tekstem).
15. Stare trasy: przekierowania (AC-1.3, AC-1.4).
16. Atlas w skali (aktualizacja 2): pasek filtrów, arkusz filtra z liczbami, sortowanie, paginacja „Pokaż kolejne 40”, nagłówki liter (sekcja 18.2). Liczba ćwiczeń z bazy, nie stała 165.
17. Karta ćwiczenia (aktualizacja 2): kolejność instrukcja, wskazówki, film dodatkiem, prywatna sekcja na dole. Bez „Brak filmu” (sekcja 18.3).
18. Import (aktualizacja 2): plakietka pewności per wiersz, filtr „Tylko do sprawdzenia”, wiersze niskiej pewności domyślnie odznaczone (sekcja 18.4).
19. Prywatny link i notatka: limity 500 i 300 znaków egzekwowane także po stronie serwera; treść nie trafia do logów ani Sentry (`backend`, `architekt`).

---

## 17. Werdykt

**ZATWIERDZONE Z UWAGAMI.**

Specyfikacja, makieta i katalog komponentów są kompletne i spójne z systemem projektowym. Uwagi do zamknięcia przed implementacją (etap 5):
1. Decyzje U-1, U-2 i U-7 muszą być potwierdzone (U-2 wymaga zmiany API importu, bez tego krok podglądu nie wie, co zapisać).
2. Trasy i nazwy komponentów z sekcji 2.1 i 14 - do potwierdzenia przez `architekt` w ADR (nazwy `ExerciseCard`, `ExerciseStepper`, `PlanCard` są propozycją).
3. Tryb „Zmień kolejność” zamiast drag-and-drop (sekcja 4.3) - decyzja UX, którą właściciel produktu może zmienić; wtedy wymaga osobnego spotkania z `architekt` o gestach w WebView.
4. Opisy ćwiczeń w karcie (sekcja 7.6, BR-11) - treści do napisania przez zespół przed wdrożeniem; bez nich karta pokazuje tylko to, co jest w katalogu.

Pozycje do naprawy później (niska waga, nie blokują wdrożenia) przekazane do `docs/bledy-do-naprawy/bledy.md` przez koordynatora: pełny drag-and-drop w v1.1, osadzony odtwarzacz YouTube (poza zakresem, BR-13), przełącznik „zakres/liczba” dla powtórzeń jako dopracowanie.

5. Pytania otwarte z aktualizacji 2 (sekcja 18.7, Q-A1 do Q-A12). Q-A4 (offline atlasu), Q-A5 (hierarchia linków) i Q-A7 (domyślne zaznaczenie niskiej pewności) muszą mieć decyzję przed etapem 5 dla tych obszarów. Werdykt pozostaje ZATWIERDZONE Z UWAGAMI.

---

## 18. Aktualizacja po decyzjach właściciela produktu (wersja 2, 2026-10-26)

Zakres: atlas w skali, karta ćwiczenia (instrukcja, film, prywatna sekcja), pewność odczytu w imporcie. Decyzja o linkach YouTube potwierdzona bez zmian wizualnych. Sekcje 0, 7.2, 7.3, 7.6, 8.3, 9, 12, 14, 15, 16 i 17 zaktualizowano w miejscu. Gdy wersja 1 i ta sekcja się różnią, wygrywa ta sekcja.

### 18.1 Decyzje właściciela i ich wpływ na UX

| # | Decyzja | Wpływ na UX |
|---|---|---|
| 1 | Film YouTube: admin wyszukuje i zatwierdza ręcznie | Bez zmian wizualnych. Sekcja „Film techniki” jest dodatkiem w karcie (18.3). Panel admina poza tą specyfikacją (Q-A8). |
| 2 | Atlas w tabeli bazy, skala setek i tysięcy ćwiczeń | Nawigacja i wyszukiwanie przebudowane pod skalę (18.2). |
| 3 | Instrukcja techniki jest podstawowa, film dodatkiem, prywatny link i notatka użytkownika | Kolejność karty i prywatna sekcja (18.3). |
| 4 | Import: wskaźnik pewności odczytu per wiersz | Plakietki, filtr i domyślne zaznaczenie (18.4). |
| - | Kolejność przyciskami ↑ ↓ bez przeciągania | Bez zmian (sekcja 4.3). |

### 18.2 Atlas przy dużej skali

**Zasada.** Partii jest 14 (stała lista `MUSCLE_CATEGORIES`), a rośnie liczba ćwiczeń w partii. Dlatego zostaje dwupoziomowa nawigacja: partie, potem lista z filtrami. Wyszukiwarka jest globalna i przeszukuje wszystkie partie.

**Poziom 1: `/plany/atlas` (bez `partia`).**
- Pole szukaj 48 px, potem 14 kafli partii w czterech rodzinach (sekcja 7.1). Chipy rodzin usunięte.
- Kafel: nazwa partii i liczba ćwiczeń z bazy (w makiecie przykładowa).
- Po wpisaniu co najmniej 2 znaków kafle zamieniają się w listę wyników globalnych (poziom 2, bez partii w filtrze).

**Poziom 2: `/plany/atlas?partia=<id>` lub wyniki wyszukiwania** (ta sama komponenta w edytorze, w arkuszu wyboru):
1. Nagłówek: H1 to nazwa partii (lub „Atlas ćwiczeń” przy wyszukiwaniu), meta „{N} ćwiczeń w partii”. Przycisk wstecz 44 px.
2. Pole szukaj 48 px.
3. **Pasek filtrów** (`AtlasFilterBar`): cztery chipy 44 px, przewijane poziomo: **Partia**, **Sprzęt**, **Poziom**, **Rodzaj ruchu**. Chip pokazuje wartość lub liczbę zaznaczonych, np. „Sprzęt · 2”, z ikoną chevron. Aktywny chip ma stan `on` i tekst z wartością, więc kolor nie jest jedynym nośnikiem. Kliknięcie otwiera arkusz filtra.
4. Wiersz wyników: „Znaleziono 42” (liczby tabularne, po lewej) i „Sortuj: A–Z” (ghost 44 px, po prawej). Sortowanie: Trafność (tylko przy wyszukiwaniu), A–Z, Poziom (od początkującego), Partia.
5. Aktywne filtry jako chipy „Sztanga ×” (każdy usuwa jeden filtr, 44 px) i „Wyczyść” (44 px). Widoczne tylko przy aktywnych filtrach.
6. Lista. Nagłówki grup zależą od sortowania: przy A–Z są to litery (`letter`, sticky), w tym Ą, Ć, Ę, Ł, Ń, Ó, Ś, Ź, Ż w kolejności alfabetu PL. Przy „Partia” są to nagłówki partii z liczbą (`grp`). Przy Trafności brak nagłówków.
7. **Paginacja:** 40 wyników na stronę. Pod listą „Pokazano 40 z 86” (tabular) i przycisk „Pokaż kolejne 40” (outline, pełna szerokość, 48 px). Nie stosujemy infinite scroll: pasek belki i stopka nie zasłaniają wtedy końca listy, a fokus klawiatury i czytnika jest przewidywalny. Po kliknięciu fokus przechodzi na pierwszy nowy wiersz. Wiersz ma minimum 64 px (nazwa do 2 linii, meta 1 linia z obcięciem). Wirtualizacja DOM to decyzja `frontend` pod spodem; kontrakt wizualny pozostaje ten sam.

**Arkusz filtra** (`AtlasFilterSheet`, dolny `Sheet`, do ok. 80% wysokości):
- Tytuł (nazwa filtra, np. „Sprzęt”), link „Wyczyść” 44 px, zamknięcie X 44 px.
- Opcje w wierszach 48 px. Wielokrotny wybór (pole wyboru 24 px, `role="checkbox"` w `role="group"`). Partia to wybór jednokrotny (`role="radio"`).
- Każda opcja ma liczbę wyników przy bieżących filtrach (np. „Hantle · 24”). Opcje bez wyników są wyszarzone i mają `aria-disabled`, ale nie znikają, żeby lista nie skakała.
- Stopka: „Pokaż 42 ćwiczenia” (cta 48 px). Liczba w etykiecie aktualizuje się na bieżąco. Zmiany stosują się dopiero po przycisku. Zamknięcie X lub przesunięcie arkusza odrzuca zmiany z tego arkusza.
- W v1 są cztery filtry (Partia, Sprzęt, Poziom, Rodzaj ruchu). Więcej nie dodajemy bez danych o użyciu (Q-A1).

**Stany atlasu w skali:**
- **Dużo wyników (K12):** bez zawężenia i powyżej 200 wyników baner `info` nad listą: „Wyników jest dużo: 312. Zawęź filtrem albo wpisz nazwę.” Nie blokuje listy.
- **Zero wyników przez filtry (K4b):** karta `flat` „Brak ćwiczeń dla tych filtrów.” Pod nią przyciski usunięcia pojedynczego filtra z liczbą wyników po usunięciu (np. „Usuń: Poziom „początkujący” · 37”) i „Wyczyść wszystkie filtry”. Propozycja „Dodaj jako własne ćwiczenie” pojawia się tylko przy zapytaniu tekstowym.
- **Zero wyników przez zapytanie (K4):** bez zmian (sekcja 7.4), z „Dodaj jako własne ćwiczenie”. Gdy są i zapytanie, i filtry, najpierw sugerujemy usunięcie filtrów, potem własne ćwiczenie.
- **Ładowanie kolejnej strony:** przycisk w stanie `aria-busy` z tekstem „Wczytuję…”. Lista nie znika, pod nią trzy szkielety wierszy.
- **Offline (K16):** baner `warning` „Brak połączenia. Pokazujemy ostatnio wczytane ćwiczenia.”, gdy są w pamięci. Bez nich: „Atlas wymaga sieci.” bez pustej listy. Decyzja cache po stronie `architekt` (Q-A4).
- **Częściowe dane:** wiersz, którego nie udało się wczytać, nie blokuje listy. Komunikat jak w K10: „Część ćwiczeń nie mogła zostać wczytana.”
- **Pusty katalog (awaria, nie zwykły stan):** „Atlas chwilowo niedostępny.” z przyciskiem „Spróbuj ponownie”. Nie pokazujemy zera ćwiczeń.

Picker w edytorze (E2) używa tego samego paska filtrów, listy i stanów. Pasek jest przyklejony pod nagłówkiem arkusza.

### 18.3 Karta ćwiczenia: instrukcja pierwsza, film dodatkiem, sekcja prywatna

**Kolejność sekcji** (od góry):
1. Nagłówek: kicker partii, nazwa, alias EN, glif, legenda partii, chipy sprzętu, wariantu i poziomu (bez zmian, tylko znane dane).
2. **Jak wykonać** (podstawowa treść): 2-4 kroki jako lista numerowana, zawsze widoczna, bez zwijania. Brak opisu: jedno zdanie „Opis techniki jeszcze nie został dodany. Możesz dodać własną notatkę poniżej.”
3. **Wskazówki techniczne**: 2-3 punkty.
4. **Film techniki** (dodatek): tylko gdy admin zatwierdził film. Przycisk `outline` 48 px, hint „Film dodany przez zespół GymBrat. Otwiera się w YouTube w nowej karcie.” Gdy brak filmu, sekcja nie jest renderowana.
5. **Tylko dla Ciebie** (sekcja prywatna, niżej).
6. Historia (bez zmian, ukryta bez danych).
7. Stopka: „Dodaj do planu” (cta 48 px, przyklejona).

**Sekcja prywatna „Tylko dla Ciebie”** (`PrivateExerciseNote`):
- **Położenie i wygląd:** na dole karty, nad stopką. Obwódka przerywana złota 40%, tło złote 3%, ikona kłódki i etykieta uppercase „TYLKO DLA CIEBIE”. Odróżnia się od danych zespołu, które mają pełną obwódkę. Sam kolor nie wystarcza, więc są też ikona i tekst.
- **Nagłówek** 44 px: po prawej „Rozwiń” (ghost 44 px, `aria-expanded`). Pod nagłówkiem hint: „Twój link i notatka. Nikt inny ich nie zobaczy.”
- **Stan pusty, zwinięty:** wiersz „Dodaj swój link lub notatkę” (outline 44 px, ikona `Plus`).
- **Stan pusty, rozwinięty** (po kliknięciu): formularz (poniżej), bez automatycznego zapisu.
- **Stan wypełniony** (domyślnie rozwinięty): wiersz linku (ikona `Link`, domena, etykieta „Twój link”, data dodania) z przyciskami „Otwórz” (44 px, `target="_blank"`), „Edytuj link” (ikona `Pencil`, 44 px) i „Usuń link” (ikona `Trash2`, 44 px, z potwierdzeniem). Pod nim notatka jako tekst (`p` 14/20, do 6 linii, „Pokaż całość”, jeśli dłuższa), przyciski „Edytuj notatkę” (ghost) i „Usuń” (destructive). Może być tylko link albo tylko notatka.
- **Formularz:**
  - „Link wideo (opcjonalnie)”: pole 48 px, `inputMode="url"`, placeholder „https://…”, hint „Dowolny adres, np. z YouTube. Widoczny tylko dla Ciebie.” Błąd: „To nie wygląda na link. Wpisz adres zaczynający się od https://.” (`aria-invalid`, `aria-describedby`). Limit 500 znaków.
  - „Notatka (opcjonalnie)”: textarea min. 96 px, licznik „0/300” tabularnie w prawym dolnym rogu. Przy 280 znakach i więcej licznik pokazuje tekst „zostało N” (nie tylko kolor). Stały hint: „Nie wpisuj danych medycznych (np. kontuzji). Notatka jest widoczna tylko dla Ciebie.”
  - Przyciski: „Zapisz” (cta, pełna szerokość 48 px) i „Anuluj” (ghost 44 px).
  - W stanie wypełnionym pod formularzem „Usuń swój link i notatkę” (destructive ghost 44 px) z `ConfirmDialog`: „Usunąć swój link i notatkę?” z tekstem „Zniknie tylko z tej karty. Plan i historia się nie zmieniają.” Przyciski „Anuluj” (outline) i „Usuń” (destructive, wypełniony).
- **Błąd zapisu:** `InlineBanner error` nad przyciskami: „Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie. Wpisane wartości zostają w formularzu.”
- **Wobec planu:** patrz Q-A5. Propozycja: w wierszu ćwiczenia w planie pole linku pokazuje źródło wartości („Z atlasu”, „Twój link”, „Ustawiony w tym planie”), a użytkownik może nadpisać link w planie.

### 18.4 Import: wskaźnik pewności odczytu

Każdy wiersz ćwiczenia w podglądzie (krok 2, sekcja 8.3) ma plakietkę `ConfidenceBadge` nad polem nazwy. Plakietka to ikona i tekst, nigdy sam kolor.

| Poziom | Etykieta | Kiedy (reguła do potwierdzenia przez `architekt` i `backend`) | Wygląd |
|---|---|---|---|
| wysoka | „Wysoka pewność” | Nazwa pewnie dopasowana do atlasu, liczby poprawne | ikona `Check`, zielona obwódka 50%, tekst biały |
| sprawdź | „Sprawdź nazwę” | Dopasowanie przybliżone (literówka, inna kolejność słów) lub brak w atlasie | ikona `TriangleAlert`, złota obwódka 55%, tekst złoty |
| niska | „Sprawdź wiersz” | Niejednoznaczny układ w PDF lub Word (np. przesunięte kolumny), brak serii lub powtórzeń | ikona `CircleAlert`, czerwona obwódka 55%, tekst jasny |
| poprawione | „Poprawione ręcznie” | Użytkownik zmienił wartość w wierszu z poziomem sprawdź lub niska | neutralny, bez koloru akcentu |

Zasady:
- Plakietka ma wysokość 24 px (nie jest celem dotyku) i `aria-label` całego wiersza, np. „Pewność odczytu: sprawdź nazwę”.
- Wiersz z poziomem sprawdź lub niska ma wyraźniejszą obwódkę pola (złota albo czerwona). To drugi, niezależny sygnał.
- **Domyślne zaznaczenie** (checkbox „Zapisz”): wysoka i sprawdź zaznaczone, niska odznaczona. Użytkownik musi świadomie włączyć wiersz niskiej pewności (Q-A7).
- Nagłówek kroku: chip „N do sprawdzenia” (`sys gold`, z tekstem). Obok filtr **„Tylko do sprawdzenia · N”** (chip 44 px, przełącza listę na wiersze sprawdź i niska). Przy wielu dniach to główny sposób pracy z podglądem.
- Legenda jednym zdaniem pod nagłówkiem: „Pewność odczytu z pliku. Sprawdź wiersze z plakietką przed zapisem.”
- Banner zbiorczy (8.3) zostaje, rozszerzony o liczbę wierszy do sprawdzenia. Gdy wszystkie wiersze są wysokie, bannera nie ma: brak komunikatu też jest informacją.
- Błędy walidacji zakresu (serie 1-20, powtórzenia 1-999, BR-5) to osobny komunikat pod polem, nie mieszamy go z pewnością odczytu.
- Po ręcznej edycji wiersza z poziomem sprawdź lub niska plakietka zmienia się na „Poprawione ręcznie”, a wiersz nie jest już liczony jako do sprawdzenia.
- Na 360 px plakietka siedzi w pierwszej linii kolumny nazwy. Etykiety są krótkie i nie zmieniają się w zależności od szerokości.

### 18.5 Zmiany względem wersji 1 (skrót)

- 7.2 i 7.3: chipy rodzin usunięte z atlasu, filtry na liście partii, liczba ćwiczeń z bazy zamiast 165.
- 7.4: wyniki grupowane literami przy A–Z, partiami przy sortowaniu „Partia”, paginacja po 40.
- 7.6 i K11: instrukcja pierwsza, film dodatkiem, bez „Brak filmu”, sekcja prywatna na dole.
- 8.3 i 8.4: plakietki pewności, filtr i domyślne zaznaczenie.
- 9: stany atlasu (offline, zero przez filtry, dużo wyników), karta (brak filmu, prywatna sekcja), import (pewność).
- 12: prywatność linku i notatki.
- 14: sześć nowych pozycji katalogu (`AtlasFilterBar`, `AtlasFilterSheet`, `ConfidenceBadge`, `PrivateExerciseNote`, paginacja jako `outline`).
- 15: mikrokopia dla filtrów, paginacji, offline, prywatnej sekcji i pewności.
- 16: punkty 16-19 dla `frontend`.

### 18.6 Spójność z ADR 0007

ADR 0007 nadal opisuje w sekcji 2.4 katalog statyczny w `lib/workout-exercise-catalog.ts` i w sekcji 3 trasę `atlas/[categoryId]/[exerciseId]`. Ta specyfikacja zakłada tabelę w bazie (decyzja właściciela) i arkusz karty z adresem `?cwiczenie=`. Architekt aktualizuje ADR równolegle. Do czasu zgodności nie implementujemy atlasu na podstawie sekcji 2.4 ADR. Liczba ćwiczeń, cache offline i trasa karty to punkty do zamknięcia (Q-A4, Q-A9).

### 18.7 Pytania otwarte

| # | Pytanie | Rekomendacja UX | Kto decyduje |
|---|---|---|---|
| Q-A1 | Ile filtrów na raz na mobile? | Cztery chipy w pasku, bez więcej w v1. Kolejne (np. wariant) dopiero po danych o użyciu. | Właściciel produktu |
| Q-A2 | Co, gdy partii będzie dużo więcej niż 14? | 14 jest stałe, więc kafle zostają. Przy nowych kategoriach: wyszukiwanie partii w arkuszu. | Właściciel produktu (przy zmianie kategorii) |
| Q-A3 | Sortowanie „najczęściej używane” lub „ostatnio dodane” | Pominięte w v1. Wymaga danych o użyciu. | Właściciel produktu, `architekt` |
| Q-A4 | Offline atlasu: katalog nie jest już w bundlu | Ostatnio wczytane ćwiczenia zostają widoczne z banerem; bez cache „Atlas wymaga sieci”. Wymaga decyzji o cache (pamięć albo IndexedDB). | `architekt` (zmiana względem ADR 2.4) |
| Q-A5 | Hierarchia linków: prywatny link, link z atlasu, nadpisanie w planie | Propozycja: nadpisanie w planie > prywatny link > link z atlasu, ze wskazaniem źródła w wierszu planu. | Właściciel produktu i `architekt` |
| Q-A6 | Prywatna notatka w eksporcie danych i przy usuwaniu konta | Pytanie prawne: notatka może zawierać dane zdrowotne. UX pokazuje w formularzu tylko to, co system faktycznie robi. | `prawnik` (LR) |
| Q-A7 | Domyślne zaznaczenie wierszy z niską pewnością | Propozycja: odznaczone. | Właściciel produktu |
| Q-A8 | Panel admina atlasu: edycja w tabeli, wyszukiwanie YouTube, zatwierdzanie | Poza tą specyfikacją. Wymaga osobnej specyfikacji UX panelu admina. | Właściciel produktu (zlecenie) |
| Q-A9 | Trasa karty ćwiczenia: sekcja 3 ADR czy arkusz `?cwiczenie=` | Arkusz z adresem w query (link głęboki działa po odświeżeniu). Pełna trasa niepotrzebna. | `architekt` |
| Q-A10 | Limity długości: notatka 300, link 500 | Propozycja zostaje. | `architekt`, właściciel produktu |
| Q-A11 | Opisy techniki dla setek ćwiczeń: treść i licencje (BR-11) | Bez opisu karta pokazuje komunikat „Opis techniki jeszcze nie został dodany”. Treści muszą mieć źródło przed wdrożeniem. | Właściciel produktu |
| Q-A12 | AC-8.5 („Brak filmu do tego ćwiczenia” i „Zgłoś brak”) | Zastąpione ukrywaniem sekcji filmu (18.3). Analityk aktualizuje kryterium. | `analityk` |
