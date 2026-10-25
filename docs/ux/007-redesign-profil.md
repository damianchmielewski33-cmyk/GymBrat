# 007 - Ekran Profil: specyfikacja UX (etap 4)

- **Autor**: ux (etap 4 zadania 007)
- **Data**: 2026-10-25
- **Karta**: `docs/zadania/007-redesign-profil.md`
- **Wejście**: `docs/analiza/007-redesign-profil.md` (F-1..F-20, US-1..US-10, BR-1..BR-11, NFR-1..NFR-9, sekcja 4 problemy wizualne), `docs/prawo/006-redesign-profil-ocena-wejsciowa.md` (LR-1..LR-12), `docs/adr/0006-redesign-profil.md` (P-1..P-5, `ProfileSaveBlock`, podstrony, `userConsents`), `docs/ux/00-system-projektowy-stan.md` (tokeny, komponenty), wzorzec `docs/ux/006-redesign-bilansu-makro.md`.
- **Makieta statyczna**: `docs/ux/007-redesign-profil-makieta.html` (ramki 390 px: przegląd, Ciało i dane, Dieta, Konto i prywatność; panel stanów: zapis, dialogi, ostrzeżenia). Makieta jest referencją dla `frontend`. Wygrywa ten dokument, gdy się różnią, a różnice trzeba zgłosić.
- **Status treści prawnych**: wszystkie teksty zgód, eksportu, usunięcia, zastrzeżeń zdrowotnych i ostrzeżenia LR-10 są **projektem roboczym**. Przed Promote zatwierdza je prawnik-człowiek (LR-12). W tekstach miejsca w nawiasach `[do potwierdzenia]` oznaczają, że treść zależy od decyzji prawnej.

---

## 0. Kluczowe decyzje UX

1. **Przegląd zamiast przewijania.** `/profile` to lista sześciu kart-skrótów z aktualnym stanem (np. „Cel cardio 150 min/tydz.”). Każda prowadzi do podstrony. Nic nie jest zagnieżdżone głębiej niż jeden poziom (US-1, NFR-1).
2. **Jedna nawigacja.** Pasek zakładek w `profile/layout.tsx` jest zawsze w tym samym miejscu, a na każdej podstronie widać, gdzie jest użytkownik (`aria-current="page"`).
3. **Trzy rodzaje wartości, trzy wyglądy.** Pole do edycji, wartość wyliczona i stan systemowy mają różne kontenery, nie tylko różny kolor tekstu (sekcja 3). Dzięki temu nikt nie pomyli kcal z makro ze stawką, którą może zmienić.
4. **Jeden wzorzec zapisu.** Każdy blok zapisu to `ProfileSaveBlock` ze statusem „Zapisano HH:MM” albo „Niezapisane zmiany”. Przełączniki zgód i jednostki zapisują się od razu, ale pokazują ten sam status. Nie ma modalnych potwierdzeń zapisu (sekcja 4).
5. **Wartości domyślne nie są danymi.** Puste pola ciała są puste, z placeholderem i opisem. Cardio „domyślne 150 min” jest opisane jako domyślne, nie jako wpisane przez użytkownika (LR-8, US-3).
6. **Ostrzeżenie o sumie posiłków to informacja, nie wyrok.** „Suma posiłków jest o 762 kcal (37%) wyższa niż cel dnia treningowego” pokazuje różnicę i nie zaleca żadnej zmiany. Stałe zastrzeżenie „nie jest poradą medyczną ani dietetyczną” jest przy każdym wyliczeniu zdrowotnym (LR-9).
7. **Zgody bez manipulacji.** Przyciski „Akceptuj wszystkie” i „Tylko niezbędne” mają tę samą rangę wizualną (LR-3). Dane niezbędne są informacją, nie przełącznikiem (LR-2). Marketing bez aktywnego celu nie wygląda jak aktywna zgoda (LR-4).
8. **Strefa niebezpieczna wyraźnie oddzielona.** Eksport jest w bloku „Dane i eksport”. Usunięcie konta jest w osobnym kontenerze o czerwonej ramce, na samym dole, z potwierdzeniem frazą „USUŃ” (US-8, LR-7).
9. **Język bez żargonu i bez odwołań do pozycji.** Usuwamy „Keytel” i „VAPID”. Nie piszemy „sekcja poniżej” ani „jak wyżej” (NFR-9, T-7).

---

## 1. Architektura informacji i nawigacja

### 1.1 Mapa ekranów

| Trasa | Zakładka (krótka) | Tytuł H1 | Cel | Funkcje (F-ID) | Zapis |
|---|---|---|---|---|---|
| `/profile` | Przegląd | Profil | Stan wszystkich ustawień i wejście do podstron | F-1, F-2 (w layoutcie) | brak |
| `/profile/body` | Ciało | Ciało i dane | Imię, nazwisko, waga, wzrost, wiek, płeć, aktywność | F-3 | `ProfileSaveBlock` |
| `/profile/training` | Trening | Trening i postępy | Cel cardio, cykl raportów, jednostka, link do planu | F-4, F-5, F-6, F-7 | 3 bloki (cardio, cykl, jednostka autosave) |
| `/profile/diet` | Dieta | Dieta | Cele dnia, kalendarz tygodnia, makro 5 posiłków (2 zestawy) | F-8, F-9, F-10 | 2 bloki (cele + kalendarz, posiłki) |
| `/profile/reminders` | Przypomnienia | Przypomnienia | Godziny, dni, e-mail, kanał | F-11 | `ProfileSaveBlock` |
| `/profile/app` | Aplikacja | Aplikacja | Język, wersja Android | F-12, F-13 | język: autosave; wersja: brak |
| `/profile/account` | Konto | Konto i prywatność | Hasło, zgody, eksport, usunięcie | F-14..F-18 | hasło: blok; zgody: autosave; eksport: brak; usunięcie: dialog |
| `/profile/workout-plan` | (poza zakładkami) | Plan treningowy | Edytor planu, bez zmian | link z `/profile/training` i z innych ekranów | bez zmian (sekcja 1.4) |

**Reguła etykiet (T-12).** Jedna stała mapuje trasę na `{ tab, title }`. Zakładka używa krótkiej formy, tytuł H1 pełnej. Nie ma dwóch osobnych list etykiet. Zakładka „Konto” jest skrótem tytułu „Konto i prywatność”. Zakładka „Ciało” jest skrótem tytułu „Ciało i dane”.

### 1.2 Układ wspólny (`profile/layout.tsx`)

Od góry, na każdej trasie z wyjątkiem `workout-plan`:

1. **Wiersz konta** (F-1, F-2): awatar 40 px z inicjałami, imię (`text-[15px] font-semibold`), e-mail (12 px, secondary, obcinany wielokropkiem), przycisk „Wyloguj” (`Button variant="outline" size="sm"`, wysokość 44 px, ikona `LogOut` + tekst). Wysokość ok. 64 px.
2. **Pasek zakładek** (F-20): siedem pozycji (Przegląd, Ciało, Trening, Dieta, Przypomnienia, Aplikacja, Konto) w poziomym `chip-scroll`. Każda pozycja to `<Link>` z wysokością 44 px. Aktywna: obrys `--gym-gold` 60%, tekst biały, `aria-current="page"`. Na 390 px ostatnie dwie pozycje są częściowo ucięte, co sygnalizuje przewijanie. Zakładki to linki (zmiana adresu), nie `role="tab"`, więc nie stosujemy wzorca tabs ARIA.
3. **Nagłówek ekranu**: `AppPageHeader` z kickerem `PROFIL` (złoto, 11 px uppercase) i tytułem H1 z tabeli 1.1. Na przeglądzie kicker to `ZAWODNIK`, a tytuł `Profil`. Przycisk wstecz nie jest potrzebny, bo zakładki pełnią tę rolę.
4. **Treść** podstrony.
5. Dolny margines `pb-28` (miejsce na belkę `AppShell`).

**Decyzja odchodząca od ADR (sekcja 1 pkt 117 w ADR 0006):** nagłówek konta nie pokazuje już trzech kafelków wagi, wzrostu i wieku. Powód: na każdej podstronie trzy kafle zabierają ok. 100 px. Cel cardio spadłby poniżej zgięcia 844 px, a US-1 i NFR-1 tego zakazują. Wartość wagi jest widoczna w karcie „Ciało i dane” na przeglądzie i na podstronie „Ciało”, z datą (P-1). Zmiana wymaga akceptacji `architekt` (sekcja 13, pozycja U-1).

### 1.3 Przepływ i liczba kroków (NFR-1)

- Wejście w Profil z dolnej belki lub menu bocznego: 1 tap.
- Cel cardio: `/profile` -> zakładka „Trening” (lub kafelek „Trening i postępy”) -> pole cardio widoczne bez przewijania. Razem 2 tapy.
- Przypomnienia: zakładka „Przypomnienia” z dowolnego miejsca, 1 tap.
- Usunięcie konta: `Konto` -> przewinięcie na dół -> „Usuń konto” -> dialog. Celowo kilka kroków.

### 1.4 Trasa planu treningowego (`/profile/workout-plan`)

Edytor planu nie może dziedziczyć nagłówka konta ani zakładek. Trasa jest linkowana z wielu miejsc aplikacji i jej układ jest osobny. **Wymóg dla `architekt`:** trasa `workout-plan` musi leżeć poza `layout.tsx` profilu, np. przez grupę tras, która nie współdzieli layoutu. Adres URL się nie zmienia (sekcja 13, U-5).

---

## 2. Tokeny i typografia

Wyłącznie istniejące tokeny i klasy (`app/globals.css`, `components/layout/screen.tsx`, `components/ui/*`). Nie dodajemy nowych tokenów.

| Rola | Token / klasa | Uwagi |
|---|---|---|
| Tło ekranu | `--gym-black` | zawsze ciemne |
| Karta | `app-card` (22 px) | wewnątrz `p-4 sm:p-5` |
| Pole edytowalne (tło) | `bg-black/50` | jak `Input` |
| Pole edytowalne (obrys) | `--gym-border-gold` (ok. 35%) | focus: `--ring` 2 px |
| Wartość wyliczona (tło) | `--gym-surface-gold` (`#15120b`) | bez obrysu |
| Stan systemowy (obrys) | biały 15%, tło biały 5% | pill `rounded-full` |
| Akcent, przycisk główny | `--gym-gold`, `Button variant="cta"` | tekst `--neon-fg` |
| Tekst drugorzędny | `--gym-text-secondary` (`#9a9182`, ok. 6,5:1 na czerni) | zamiast `text-white/45/40/35` |
| Stan zapisany | `--gym-success` + ikona `Check` | zawsze z tekstem |
| Niezapisane zmiany | `--gym-gold` + kropka + tekst | zawsze z tekstem |
| Strefa niebezpieczna | `--destructive` (obrys 45%, tło 6%) | tylko w `ProfileDangerZone` |
| Ostrzeżenie / konflikt / offline | `InlineBanner variant="warning"` | |
| Błąd zapisu | `InlineBanner variant="error"` | |

**Typografia** (pięć poziomów, minimum 11 px):

| Poziom | Klasa | Użycie |
|---|---|---|
| H1 | `appPageTitleClass` (28 px, `font-heading`) | tytuł ekranu |
| H2 | `SectionLabel` (`titleAs="h2"`) | „Cele dnia”, „Zgody”, „Strefa niebezpieczna” |
| H3 | 15 px `font-semibold` | „Dzień treningowy”, „Posiłek 1” |
| Treść / etykiety pól | 14 px, etykieta pola 13 px `font-medium` | wartości, nazwy |
| Meta / wskazówki | 12 px `--gym-text-secondary` | „Ostatni pomiar 12.10.2026” |
| Etykieta wyliczona | 11 px uppercase `tracking-[0.14em]` | „WYLICZONE”, „KCAL” |

Liczby (waga, kcal, gramy, minuty): `tabular-nums` w każdym miejscu. Format pl-PL: spacja tysięcy (`2 050 kcal`), jednostka w tej samej linii.

**Odstępy:** skala 4/8 px. Między sekcjami `space-y-6`. Wewnątrz karty `p-4` (telefon), `p-5` od `sm`. Między polami `gap-3`. Blok zapisu oddzielony `border-t border-white/10` i `pt-4`.

**Promienie:** karta 22 px, pole i wiersz 16 px (`rounded-2xl`), chip i pill `rounded-full`, przycisk `rounded-2xl`.

**Ruch:** bez animacji wejścia na zakładkach. Rozwinięcie wierszy (jeśli będą) 200 ms. Przy `prefers-reduced-motion` żadnych pulsujących szkieletów (statyczny szary blok).

---

## 3. Trzy rodzaje wartości (US-6, R-6 analizy)

Każdy rodzaj ma inny kontener i inny sposób czytania. Kolor jest dodatkiem, nie nośnikiem.

| Rodzaj | Komponent | Wygląd | Interakcja | Dostępność |
|---|---|---|---|---|
| **Edytowalne** (pole, przełącznik, chip) | `ProfileField`, `ProfileSwitch`, `ProfileChipGroup` | pole: obrys złoty 35%, tło `bg-black/50`, wysokość 48 px; etykieta nad polem; wskazówka pod polem | fokus, wpis, zmiana | `<label>` zawsze; `inputMode` (`decimal` dla wagi, `numeric` dla wzrostu, wieku i minut); przełącznik `role="switch"`; chip `aria-pressed` |
| **Wyliczone** (kcal z makro, suma dnia, różnica do celu, cel dnia w przeglądzie) | `ProfileComputedValue` (nowy) | bez obrysu, tło `--gym-surface-gold`, etykieta `Calculator` 14 px + „WYLICZONE” 11 px uppercase; wartość biała, `tabular-nums`; wskazówka „Białko i węgle po 4 kcal, tłuszcz 9 kcal.” | nieinteraktywne (brak `tabIndex`) | `aria-readonly` nie dotyczy (nie jest polem); etykieta „wyliczone” czytana przez SR |
| **Systemowe** (kanał przypomnień, zgoda niezbędna, stan marketingu, wersja Android) | `ProfileSystemState` (nowy) | pill `rounded-full` 28 px, obrys biały 15%, tło biały 5%, ikona (`Lock`, `Bell`, `Smartphone`, `Info`) + tekst; bez przełącznika i bez pola | bez interakcji (chyba że link osobno) | tekst opisuje stan; ikona `aria-hidden` |

Zasada: użytkownik nie może pomylić pola ze stanem systemowym ani wartości wyliczonej z ustawieniem. Pill nie ma ramki pola, a wartość wyliczona nie ma obrysu.

---

## 4. Model zapisu: `ProfileSaveBlock` (R-6, T-5, US-7)

### 4.1 Anatomia (bloki z przyciskiem)

```
[ pola formularza ]
────────────────────────────────────────
● Niezapisane zmiany            (12 px, złoto + tekst)
[      Zapisz parametry ciała      ]    (cta, pełna szerokość, 48 px)
Puste pola nie zmieniają zapisanych danych.   (12 px, secondary)
```

Stany statusu (jedno miejsce, bez toastów):

| Stan | Status (linia 1) | Przycisk | Uwagi |
|---|---|---|---|
| Czysty (po zapisie lub wejściu) | `✓ Zapisano 10:42` (`Check`, secondary) | wyłączony (`aria-disabled`), ta sama etykieta | czas to godzina zapisu z serwera |
| Zmieniony | `● Niezapisane zmiany` (złoto) | aktywny | |
| Zapisywanie | `Zapisywanie…` | `Zapisywanie…`, `aria-busy="true"` | pola zablokowane tylko na czas żądania |
| Błąd | `InlineBanner error` nad przyciskiem: „Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie. Wpisane wartości zostają w formularzu.” | aktywny | wartości nie są czyszczone |
| Konflikt (US-10) | `InlineBanner warning` (sekcja 6.3) | aktywny: „Wczytaj najnowsze dane” | |
| Offline | `InlineBanner warning`: „Brak połączenia. Zapis wymaga sieci. Wpisane wartości zostają w formularzu.” | aktywny | |

**Dirty tracking:** blok porównuje wartości z wartościami z serwera (ostatnio wczytanymi), nie z wartościami domyślnymi. Przy wyjściu z zakładki (sekcja 4.4) i na pasku zakładek (kropka).

### 4.2 Wariant autozapisu (bez przycisku)

Dla przełączników i wyboru „od razu”: jednostka porównań (F-7), zgody (F-15), język (F-12, o ile obecnie działa od razu, do potwierdzenia przez `frontend`).

- Brak przycisku. Linia statusu: `Zapisywanie…` -> `✓ Zapisano 10:42`.
- Błąd: kontrolka wraca do poprzedniej wartości i pojawia się `InlineBanner error` pod nią. Stan nie zostaje „w połowie”.
- Zgody zapisują się niezależnie od sekcji, w której stoją (US-5).

### 4.3 Kopia statusu (jeden wzorzec)

Zawsze te same frazy: `Zapisano HH:MM`, `Niezapisane zmiany`, `Zapisywanie…`, `Nie udało się zapisać`. Żadnego „Sukces!”, żadnego wykrzyknika.

### 4.4 Zmiana zakładki z niezapisanymi zmianami

Kropka „niezapisane” przy zakładce (`aria-label` dopisane: „z niezapisanymi zmianami”). Przy kliknięciu linku innej zakładki, gdy któryś blok jest zmieniony, pokazujemy `ConfirmDialog`:

- Tytuł: „Masz niezapisane zmiany”.
- Treść: „W sekcji „Ciało i dane” są zmiany, których nie zapisano.”
- Przyciski (ta sama ranga wizualna, obok siebie na 390 px w kolumnie): „Zapisz i przejdź” (cta), „Odrzuć zmiany” (outline), „Zostań” (ghost).
- Fokus wraca na przycisk „Zostań”.

### 4.5 Konflikt dwóch urządzeń (US-10, BR-10)

Blok zapisuje z `expectedUpdatedAt`. Przy niezgodności serwer zwraca konflikt, a baza się nie zmienia.

- `InlineBanner variant="warning"` nad przyciskiem.
- Tekst: „Te ustawienia zmieniono na innym urządzeniu. Wczytaj najnowsze dane. Zmian z tego ekranu nie zapiszemy automatycznie.”
- Przycisk główny: „Wczytaj najnowsze dane” (`cta`).
- Przycisk drugorzędny (propozycja, decyzja w sekcji 13, U-4): „Zachowaj moje zmiany” (`ghost`), który zapisuje z nowym znacznikiem. Jeśli `architekt` nie zgodzi się na nadpisanie, przycisk znika, a w tekście zostaje tylko pierwsza opcja.

---

## 5. Specyfikacja ekranów

### 5.1 `/profile` - Przegląd

**Cel:** w 10 sekund wiadomo, co jest ustawione, a czego brakuje. Wejście do właściwej podstrony.

**Układ (390 px):** wiersz konta, pasek zakładek, nagłówek „Profil”, sekcja 01 „Ustawienia” (`SectionLabel`), lista sześciu kart-skrótów (`ProfileShortcut`) w pionie, odstęp 12 px.

**Karta-skrót (`ProfileShortcut`, nowy):** cały kafel to link, min. wysokość 72 px, `app-card p-4`. Układ: ikona w kwadracie 40 px (`--gym-gold` 12%), tytuł 15 px `font-semibold`, pod nim 1–2 linie stanu 13 px, strzałka `ChevronRight` po prawej. Na końcu kafla opcjonalnie chip stanu (`ProfileSystemState` albo tekstowy status z ikoną).

| Karta | Wypełniony | Nieustawiony / pusty | Częściowy |
|---|---|---|---|
| Ciało i dane | `58 kg · 168 cm` / `Ostatni pomiar 12.10.2026` | `Uzupełnij dane ciała` (złoto, ikona `Plus`) | `58 kg · brak wzrostu` |
| Trening i postępy | `Cel cardio 150 min/tydz. · Raport co 14 dni` / `Plan: Siła 5×/tydz.` | `Cel cardio: domyślnie 150 min/tydz.` / `Brak planu. Ustaw plan.` | `Cel cardio 150 min · brak planu` |
| Dieta | `Dzień treningowy 2050 kcal · odpoczynku 1890 kcal` + status: `Posiłki 2812 kcal: ponad cel o 762 kcal` (chip `warning`, gold) | `Brak celów dnia. Ustaw cele.` | `Odpoczynek: używa celu dnia treningowego` |
| Przypomnienia | `2 z 3 włączone` + `Alarm na tym urządzeniu` (pill) | `Wszystkie wyłączone` | — |
| Aplikacja | `Język: Polski` | — | — |
| Konto i prywatność | `Hasło, zgody, eksport danych i usunięcie konta` (bez stanu liczbowego) | — | — |

**Status sumy posiłków na przeglądzie:** gdy suma mieści się w ±10% celu, linia zmienia się na `Posiłki w granicach celu (±10%)` z ikoną `Check` (tekst, nie kolor). Różnica powyżej progu pokazuje gold chip „ponad cel o N kcal”. Brak celu: „Ustaw cele, aby zobaczyć porównanie”.

**Stany:**

- **Ładowanie:** sześć szkieletów `app-card animate-pulse` 72 px, nagłówek jako szary blok 120 px.
- **Pusty (nowy użytkownik):** wszystkie karty w wariancie „nieustawiony”. Nad listą jeden `InlineBanner info`: „Zacznij od danych ciała. Wpływają na szacunek kcal z cardio.”
- **Błąd:** `InlineBanner error` „Nie udało się wczytać profilu.” + `Button variant="outline"` „Spróbuj ponownie” (44 px). Bez starych wartości jako aktualnych.
- **Offline:** blok „Nie masz połączenia” + „Spróbuj ponownie”. Profil nie jest cache'owany, więc nie pokazujemy zer.
- **Częściowe dane:** wariant „częściowy” kart (tabela).
- **Brak uprawnień:** nie dotyczy (sesja obsługiwana globalnie).
- **Sukces:** nie dotyczy (przegląd nie zapisuje).

### 5.2 `/profile/body` - Ciało i dane

**Cel:** uzupełnić dane bez zgadywania. Każde pole mówi, czy jest puste, i nie zapisuje wartości, której użytkownik nie wpisał (T-2, LR-8, US-3).

**Układ:**

1. **Sekcja 01 „Dane osobowe”** (`SectionLabel`): Imię i Nazwisko w dwóch kolumnach (`grid-cols-2 gap-3`; na 360 px pola ok. 165 px, wystarczy na „Nazwisko”).
2. **Sekcja 02 „Parametry ciała”**: Waga (kg), Wzrost (cm), Wiek w siatce 2+1 albo w trzech kolumnach od 430 px. Pod polem wagi wskazówka z datą ostatniego pomiaru: `Ostatni pomiar: 58 kg, 12.10.2026`. Druga wskazówka: `Zmiana wagi tutaj dodaje wpis do historii wagi.` (ADR, opcja B: zmiana w profilu idzie do `weight_logs`).
3. **Płeć** (`ProfileSelect`): pierwsza opcja „Nie podano”. Wskazówka: `Nieobowiązkowe. Bez wyboru liczymy szacunek uniwersalny.` (bez „Keytel”).
4. **Poziom aktywności** (`ProfileChipGroup variant="list"`, radiogroup): trzy wiersze 56 px z opisem: „Niska: biurko, lekkie spacery”, „Średnia: 3–5 treningów tygodniowo”, „Wysoka: codziennie lub intensywnie”. Nic nie jest zaznaczone, jeśli wartość jest pusta (sekcja 13, U-3).
5. **Blok zapisu** `ProfileSaveBlock` „Zapisz parametry ciała”.

**Zachowanie pól:**

- Pole puste: placeholder `np. 78` / `np. 168` / `np. 25` w kolorze `--gym-text-secondary`. Placeholder nie jest wartością, nie zostaje zapisany. Wskazówka: `Nie podano. Pole zostanie bez zmian.`
- Pole wypełnione i poprawne: zapisywane.
- Pole wypełnione i błędne (poza zakresem 1–400 kg, 100–250 cm, 13–120 lat): błąd pod polem, `aria-invalid="true"`, `aria-describedby` na komunikat. Komunikat: „Waga musi być między 1 a 400 kg.” Nie ogólne „Błąd formularza”.
- Puste pole nie usuwa zapisanej wartości. Wskazówka pod przyciskiem to mówi.

**Stany:**

- **Ładowanie:** szkielet pól (cztery bloki 48 px, etykieta 120 px).
- **Pusty (nowy użytkownik):** wszystkie pola puste, placeholdery, wszystkie wskazówki „Nie podano”. Blok zapisu w stanie „czysty”.
- **Częściowy (makieta):** waga i wzrost wpisane, wiek pusty. Makieta pokazuje też stan „Niezapisane zmiany” po zmianie wzrostu.
- **Błąd:** `InlineBanner error` nad blokiem przy błędzie serwera; błędy pól przy walidacji.
- **Offline / sukces / brak uprawnień:** wg sekcji 4.

### 5.3 `/profile/training` - Trening i postępy

**Cel:** cel cardio i cykl raportów widoczne bez przewijania (US-1).

**Kolejność (od góry):**

1. **Sekcja 01 „Cel cardio”:** `ProfileChipGroup` (chipy 90 / 150 / 210 / 300 min, `aria-pressed`) + pole minut `inputMode="numeric"` z jednostką „min/tydz.”. Wskazówka: „Orientacyjny cel. To nie jest porada medyczna ani treningowa.” (LR-9). Blok zapisu „Zapisz cel cardio”.
2. **Sekcja 02 „Raporty”:** chipy 7 / 14 / 30 dni + pole „Co ile dni dodawać raport (3–90)” + blok „Zapisz cykl raportów”.
3. **Sekcja 03 „Porównania postępów”:** `ProfileChipGroup` z dwiema opcjami „Procenty (np. +8%)” i „Kilogramy (np. +120 kg)”. Autozapis (sekcja 4.2).
4. **Sekcja 04 „Plan treningowy”:** `ProfileShortcut` na dole: `Plan: Siła 5×/tydz.` -> `/profile/workout-plan`, albo „Brak planu. Ustaw plan.” Plan jest na końcu, bo US-1 wymaga, by cel cardio był widoczny od razu.

**Stany cardio:** wartość zapisana -> bez dopisku. Brak zapisanej wartości -> nad chipami `ProfileSystemState`: „Domyślnie: 150 min/tydz.” Wartość domyślna nie jest zapisywana, dopóki użytkownik nie kliknie zapisu (sekcja 13, U-2).

**Stany:** ładowanie (szkielety trzech kart); pusty (plan brak, cele domyślne); błąd (banner + „Spróbuj ponownie”); offline; częściowy (cardio ustawione, raporty nie); sukces (status).

### 5.4 `/profile/diet` - Dieta

**Cel:** czytelne cele dnia, kalendarz i makro posiłków, które nie rozjeżdżają się bez informacji (T-3, US-2, R-3).

**Kolejność:**

1. **Sekcja 01 „Cele dnia” (`id="cele-dnia"`):**
   - Blok „Dzień treningowy”: trzy pola B / W / T (białko, węgle, tłuszcz) w siatce 3 kolumn, `inputMode="decimal"`, jednostka „g” w polu. Pod nimi `ProfileComputedValue` „Kcal z makro: 2050 kcal”.
   - Blok „Dzień odpoczynku”: to samo, wartość 1890 kcal.
   - Wskazówka pod celami: `Wartości są orientacyjne. To nie jest porada medyczna ani dietetyczna.` (stałe, LR-9).
   - Gdy cel dnia nie jest ustawiony: wiersz systemowy „Brak celu. Dzień treningowy używa celu dnia odpoczynku.” (BR-5, zamiast cichego fallbacku, R-11).
2. **Sekcja 02 „Kalendarz tygodnia”:** siatka siedmiu przycisków (pn–nd), każdy 44 × 64 px. Górą skrót dnia („Pn”), w środku numer dnia, na dole ikona: `Dumbbell` (trening) albo `Moon` (odpoczynek). `aria-pressed` = „dzień treningowy”. Każdy przycisk ma pełną nazwę: „Poniedziałek, 19 października, dzień treningowy”. Legenda pod siatką: „Zaznaczone dni to trening. Pozostałe dni to odpoczynek.” Nagłówek sekcji z zakresem „Tydzień 19–25 paź”. Blok zapisu „Zapisz cele i kalendarz”.
3. **Sekcja 03 „Makro posiłków”:** `ProfileChipGroup` z dwiema opcjami „Dzień treningowy” / „Dzień odpoczynku” (dwa zestawy, ADR, opcja A). Pod przełącznikiem:
   - Pięć wierszy „Posiłek 1” do „Posiłek 5”. Każdy wiersz: nagłówek (nazwa 15 px, `ProfileComputedValue` kcal po prawej: „530 kcal”), pod nim trzy pola B / W / T w jednym rzędzie (wysokość 44 px). Wiersz to karta `rounded-2xl`, bez obramowania zewnętrznego.
   - Blok „Suma dnia”: `ProfileComputedValue` „Suma dnia 2812 kcal” z sumami B / W / T (174 / 124 / 180 g).
   - Porównanie z celem (jedno miejsce, `InlineBanner`):
     - różnica > 10%: `warning`: „Suma posiłków jest o 762 kcal (37%) wyższa niż cel dnia treningowego (2050 kcal).” Druga linia: „To tylko różnica, nie zalecenie.” Link „Zmień cele dnia” (44 px) do `#cele-dnia` na tej samej stronie.
     - w granicach ±10%: `info` z ikoną `Check`: „Suma posiłków mieści się w granicach celu (±10%).”
     - brak celu dla typu dnia: „Ustaw cel dnia, aby zobaczyć porównanie.” (bez liczby do porównania).
   - Wskazówka: „Zestaw dotyczy wybranego typu dnia. Zapis obejmuje oba zestawy.” Blok zapisu „Zapisz makro posiłków”.

**Dlaczego tylko ostrzeżenie, a nie blokada:** ADR (sekcja 4) nie wymusza sumy do celu i nie przeskalowuje gramów. Pokazujemy różnicę i miękkie ostrzeżenie.

**Zastrzeżenia zdrowotne (LR-9):** stała wskazówka pod celami i pod sumą.

**Osoby poniżej 18 lat (LR-10):** gdy `age < 18` i cel dnia ma deficyt kalorii (kcal celu < kcal utrzymania, wartość liczona przez `architekt`), nad sekcją 01 pojawia się `InlineBanner info`. Treść (projekt, do zatwierdzenia przez prawnika): „Cele z deficytem kalorycznym nie są zalecane w tym wieku. Jeśli jedzenie lub waga zaczynają Cię martwić, porozmawiaj z lekarzem.” Gdy wiek jest pusty, banera nie ma (ADR, sekcja 3).

**Stany diety:**

- **Ładowanie:** szkielet dwóch kart celów, siatki kalendarza (7 bloków), pięciu wierszy posiłków.
- **Pusty (pierwsze użycie):** cele puste (placeholdery `—`), kalendarz z domyślnym odpoczynkiem, posiłki puste, suma „0 kcal”. Porównanie: „Ustaw cel dnia, aby zobaczyć porównanie.”
- **Błąd:** banner błędu + „Spróbuj ponownie”. Dla zapisu konflikt (sekcja 4.5), bo cele i kalendarz są jednym JSON-em (BR-10).
- **Częściowy:** tylko cele dnia treningowego ustawione, reszta pusta. Pokazujemy fallback (BR-5).
- **Offline:** banner + zachowanie formularza.
- **Sukces:** status „Zapisano HH:MM” przy każdym bloku.

### 5.5 `/profile/reminders` - Przypomnienia

**Cel:** włączyć przypomnienie w kilka sekund, wiedząc, którym kanałem zadziała (F-11, NFR-8).

**Układ:**

- Trzy wiersze (Trening, Posiłek, Check-in dnia), każdy: nazwa 15 px, pole godziny (`type="time"`, 48 px), przełącznik `role="switch"` z `aria-label` „Trening: włącz” / „wyłącz”, pod nazwą `ProfileSystemState` kanału.
- Kanał (stan systemowy, nie edytowalny): „Alarm na tym urządzeniu” (Android, ikona `Bell`), „Powiadomienia w przeglądarce” (web), „Brak kanału. Włącz powiadomienia w ustawieniach urządzenia.” (obrys gold, tekst z instrukcją; bez czerwieni).
- Sekcja „Dni tygodnia”: siedem chipów `aria-pressed` (pn–nd, 44 px, `aria-label` z pełną nazwą).
- Przełącznik „Dzienny skrót e-mail” z opisem: „Jedna wiadomość dziennie na adres z konta.”
- Blok zapisu „Zapisz przypomnienia”.
- Link pod blokiem: „Język i wersja aplikacji” -> `/profile/app` (bez „sekcja poniżej”, R-9).

**Stany:** szkielet wierszy; pusty (wszystkie wyłączone: „Wszystkie wyłączone” w statusie); błąd; offline; częściowy (przypomnienie włączone, kanał brak: wiersz z ostrzeżeniem); brak uprawnień (kanał zablokowany w systemie: tekst z instrukcją, nie błąd aplikacji); sukces.

**Uwaga:** logika kanałów i synchronizacja z Androidem bez zmian (NFR-8). Przełączniki zachowują tę samą semantykę co dziś.

### 5.6 `/profile/app` - Aplikacja

**Cel:** język i informacja o wersji Android.

- Sekcja 01 „Język interfejsu”: `ProfileChipGroup` (dwie opcje „Polski” / „English”, `aria-pressed`, po 48 px, pełna szerokość w dwóch kolumnach). Zachowanie autozapisu, jeśli obecne (do potwierdzenia przez `frontend`).
- Sekcja 02 „Aplikacja Android”: wiersz z `ProfileSystemState` „Wersja 1.4.2” (wartość z `AndroidAppVersionCard`). W przeglądarce: „Dostępne w aplikacji Android” (`Smartphone`, bez przycisku).
- Pod sekcją: krótka wskazówka, czym jest wersja (jedno zdanie), bez żargonu.

**Stany:** szkielet; pusty (brak wersji: „Nie udało się odczytać wersji” + ponów); błąd; offline (wersja z cache = „stan z HH:MM”); brak uprawnień nie dotyczy; sukces (status przy języku).

### 5.7 `/profile/account` - Konto i prywatność

**Cel:** zgody, eksport i usunięcie konta w kolejności od bezpiecznych do nieodwracalnych. Każda sekcja mówi prawdę o tym, co się dzieje (LR-1 do LR-7).

**Kolejność:**

1. **Sekcja 01 „Hasło”** (tylko gdy konto ma hasło, F-14): pola „Obecne hasło”, „Nowe hasło” (wskazówka „Minimum 8 znaków.”), blok „Zmień hasło”. Bez hasła (konto z logowaniem Google/Facebook) sekcja jest niewidoczna, a zamiast niej jeden wiersz `ProfileSystemState` „Logowanie przez dostawcę” (bez przycisku).

2. **Sekcja 02 „Zgody”** (autozapis, sekcja 4.2):
   - Link „Polityka prywatności” na samej górze bloku (LR-5, F-18), w obrębie bloku bez przewijania poza niego.
   - Wiersz **Niezbędne** (LR-2): `ProfileSystemState` z ikoną `Lock`, tekst „Zawsze aktywne” i opis „Sesja i zabezpieczenia konta. Nie da się ich wyłączyć.” Bez przełącznika.
   - Wiersz **Statystyki użycia aplikacji** (LR-4): przełącznik `role="switch"`, nazwa „Statystyki użycia aplikacji”, opis (wariant docelowy, sekcja 8): „Wejścia i ekrany w aplikacji. Wyłączenie wstrzymuje wysyłkę tych danych z Twojego konta.” Meta: „Ostatnia decyzja: 12.10.2026”, a gdy jej nie ma: „Nie podjęto jeszcze decyzji.” (znacznik tylko przy istniejącym zapisie, LR-4).
   - Wiersz **Marketing i reklamy** (LR-4): `ProfileSystemState` „Nieaktywne w tej wersji”, bez przełącznika, bez ikony zgody. Decyzja właściciela o ukryciu (sekcja 13, U-6).
   - Dwa przyciski obok siebie, jednakowe w każdym parametrze (LR-3): „Akceptuj wszystkie” i „Tylko niezbędne”, oba `Button variant="outline"`, `h-12`, po 50% szerokości, ta sama wagi tekstu. Nie wyróżniamy żadnego z nich. Uwaga: „Akceptuj wszystkie” ustawia tylko statystyki (marketing nieaktywny), więc tekst nie obiecuje więcej.
   - Wycofanie zgody: przełącznik w jednym kliknięciu (LR-3, art. 7 ust. 3 RODO).

3. **Sekcja 03 „Dane i eksport”** (F-16):
   - Opis: „Pobierz dane z aplikacji (JSON lub CSV). Zakres eksportu: [do potwierdzenia]” (LR-6; nie piszemy „wszystkie dane”, „pełny eksport” ani „kompletna kopia”).
   - Dwa przyciski „Pobierz JSON” i „Pobierz CSV”, `outline`, 48 px, obok siebie.
   - Ostrzeżenie `InlineBanner info` nad przyciskami: „Plik zawiera dane o treningach, zdrowiu i ciele. Przechowuj go bezpiecznie.” (LR-6, do zatwierdzenia przez człowieka).
   - Eksport nie jest wysyłany e-mailem ani zapisywany na serwerze.

4. **Strefa niebezpieczna** (`ProfileDangerZone`, nowy, sekcja 12): osobny kontener z obrysem `--destructive` 45%, tłem 6%, na samym dole, z odstępem 32 px od poprzedniej sekcji. Nagłówek „Strefa niebezpieczna” z ikoną `TriangleAlert` (ikona i tekst, nie tylko kolor).
   - Treść (LR-7, do zatwierdzenia): „Usunięcie konta jest nieodwracalne. Znikną treningi, posiłki, wagi, raporty ciała, zdjęcia, posty i komentarze, znajomości oraz ustawienia. Dane mogą pozostać w kopiach zapasowych i u dostawców technicznych do czasu ich wygaśnięcia [do potwierdzenia].”
   - Przycisk „Usuń konto” w wariancie `destructive outline` (nie wypełniony czerwienią, żeby nie wyglądał jak akcja główna). Otwiera dialog (sekcja 5.7.1). Nic nie jest usuwane bez wpisania „USUŃ”.

#### 5.7.1 Dialog usunięcia

- Tytuł: „Usunąć konto?”.
- Treść: powtórzenie kategorii z sekcji 4 i zdanie „Tej operacji nie da się cofnąć.” (LR-7).
- Pole „Wpisz USUŃ, aby potwierdzić” (`aria-describedby` na wyjaśnienie).
- Przyciski: „Anuluj” (`outline`, pierwszy w kolejności fokusu) i „Usuń na zawsze” (`destructive`, **wyłączony**, dopóki pole nie zawiera dokładnie „USUŃ”). Stan wyłączenia oznaczony `aria-disabled` i tekstem pomocniczym pod przyciskiem: „Wpisz USUŃ, aby włączyć przycisk.”
- Podczas żądania: „Usuwanie…”, dialog nieprzerywalny.
- Błąd: `InlineBanner error` w dialogu: „Nie udało się usunąć konta. Konto nie zostało zmienione. Spróbuj ponownie.” (bez wartości danych).
- Po sukcesie: przekierowanie do ekranu logowania z komunikatem, nie do „Profilu”.

**Stany konta:** szkielet bloków; pusty nie dotyczy; błąd (zgody: wraca przełącznik; eksport: „Nie udało się przygotować pliku.”); offline (eksport i usunięcie wyłączone z komunikatem „Wymaga połączenia”); częściowy (brak hasła: sekcja niewidoczna, zgody wg stanu); brak uprawnień: sesja wygasła -> globalna obsługa; sukces: status zgód.

---

## 6. Stany ekranów (macierz)

Każdy ekran ma wszystkie obowiązkowe stany. Tam, gdzie stan nie dotyczy, jest to zapisane.

| Ekran | Ładowanie | Pusty | Błąd | Offline | Częściowy | Brak uprawnień | Sukces |
|---|---|---|---|---|---|---|---|
| Przegląd | 6 szkieletów kart | wszystkie „nieustawiony” + baner | banner + ponów | blok „Nie masz połączenia” | karty częściowe | sesja: globalnie | nie dotyczy |
| Ciało | szkielet pól | puste pola, placeholdery | baner nad blokiem; błędy pól | baner, wartości zostają | waga bez wzrostu | nie dotyczy | status „Zapisano” |
| Trening | 3 szkielety | cele domyślne, brak planu | baner + ponów | baner | cardio bez raportów | nie dotyczy | status |
| Dieta | szkielet celów, kalendarza, posiłków | puste cele, suma 0 | baner + ponów; konflikt | baner | tylko jeden cel dnia | nie dotyczy | status przy każdym bloku |
| Przypomnienia | 3 szkielety wierszy | wszystkie wyłączone | baner | baner | przypomnienie bez kanału | kanał zablokowany w systemie (tekst z instrukcją) | status |
| Aplikacja | szkielet | wersja nieznana | baner + ponów | wersja z cache „stan z HH:MM” | wersja bez języka | nie dotyczy | status języka |
| Konto | szkielety bloków | nie dotyczy | baner (zgody wracają) | eksport i usunięcie wyłączone | brak hasła (sekcja ukryta) | sesja wygasła: globalnie | status zgód |

---

## 7. Mikrokopia (propozycje, do zatwierdzenia przez `ux`; prawne teksty przez prawnika)

| Miejsce | Tekst |
|---|---|
| Kicker przeglądu | ZAWODNIK |
| H1 przeglądu | Profil |
| Karty przeglądu | Ciało i dane · Trening i postępy · Dieta · Przypomnienia · Aplikacja · Konto i prywatność |
| Stan: cel domyślny | Domyślnie: 150 min/tydz. |
| Stan: brak planu | Brak planu. Ustaw plan. |
| Stan: brak celów dnia | Brak celów dnia. Ustaw cele. |
| Stan: fallback celu | Brak celu. Dzień treningowy używa celu dnia odpoczynku. |
| Waga: ostatni pomiar | Ostatni pomiar: 58 kg, 12.10.2026 |
| Waga: wpis w historii | Zmiana wagi tutaj dodaje wpis do historii wagi. |
| Pole puste | Nie podano. Pole zostanie bez zmian. |
| Płeć | Nieobowiązkowe. Bez wyboru liczymy szacunek uniwersalny. |
| Błąd zakresu | Waga musi być między 1 a 400 kg. |
| Cardio: zastrzeżenie | Orientacyjny cel. To nie jest porada medyczna ani treningowa. |
| Cele: zastrzeżenie | Wartości są orientacyjne. To nie jest porada medyczna ani dietetyczna. |
| Kcal: wyliczenie | Kcal z makro: białko i węgle po 4 kcal, tłuszcz 9 kcal. |
| Suma: ponad cel | Suma posiłków jest o 762 kcal (37%) wyższa niż cel dnia treningowego (2050 kcal). |
| Suma: to nie zalecenie | To tylko różnica, nie zalecenie. |
| Suma: w granicach | Suma posiłków mieści się w granicach celu (±10%). |
| Suma: brak celu | Ustaw cel dnia, aby zobaczyć porównanie. |
| Makro: zestaw | Zestaw dotyczy wybranego typu dnia. Zapis obejmuje oba zestawy. |
| Kalendarz: legenda | Zaznaczone dni to trening. Pozostałe dni to odpoczynek. |
| Przypomnienia: kanał brak | Brak kanału. Włącz powiadomienia w ustawieniach urządzenia. |
| Przypomnienia: link | Język i wersja aplikacji |
| Status zapisu | Zapisano 10:42 · Niezapisane zmiany · Zapisywanie… |
| Błąd zapisu | Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie. Wpisane wartości zostają w formularzu. |
| Konflikt | Te ustawienia zmieniono na innym urządzeniu. Wczytaj najnowsze dane. Zmian z tego ekranu nie zapiszemy automatycznie. |
| Offline | Brak połączenia. Zapis wymaga sieci. Wpisane wartości zostają w formularzu. |
| Niezapisane przy zmianie zakładki | Masz niezapisane zmiany. Zapisz je przed przejściem dalej? |
| Zgody: niezbędne | Zawsze aktywne. Sesja i zabezpieczenia konta. Nie da się ich wyłączyć. |
| Zgody: statystyki | Wejścia i ekrany w aplikacji. Wyłączenie wstrzymuje wysyłkę tych danych z Twojego konta. [warunek: bramka serwerowa, LR-4] |
| Zgody: marketing | Nieaktywne w tej wersji. |
| Zgody: decyzja | Ostatnia decyzja: 12.10.2026 / Nie podjęto jeszcze decyzji. |
| Eksport: zakres | Pobierz dane z aplikacji (JSON lub CSV). Zakres eksportu: [do potwierdzenia]. |
| Eksport: ostrzeżenie | Plik zawiera dane o treningach, zdrowiu i ciele. Przechowuj go bezpiecznie. |
| Usunięcie: strefa | Strefa niebezpieczna |
| Usunięcie: nieodwracalne | Usunięcie konta jest nieodwracalne. [pełna treść, LR-7] |
| Usunięcie: pole | Wpisz USUŃ, aby potwierdzić |
| Usunięcie: przycisk wyłączony | Wpisz USUŃ, aby włączyć przycisk. |
| LR-10 (16–17 lat) | Cele z deficytem kalorycznym nie są zalecane w tym wieku. Jeśli jedzenie lub waga zaczynają Cię martwić, porozmawiaj z lekarzem. [do zatwierdzenia] |

**Zakazane na tym ekranie:** „przekroczone”, „za dużo”, „zjadłeś”, „błąd” przy wartościach, „sekcja poniżej”, „Keytel”, „VAPID”, wykrzykniki, emotikony, „Sukces!”.

---

## 8. Zgody, eksport i usunięcie: wymagania UX z oceny prawnika

| LR | Wymaganie | Gdzie w projekcie |
|---|---|---|
| LR-1 | Zgody zapisywane na serwerze (warunek Promote). Przełącznik działa od razu, bez zależności od sekcji. | `ProfileSaveBlock` autozapis (4.2); status „Zapisano” |
| LR-2 | Dane niezbędne to informacja, nie przełącznik. Przyszłe zgody art. 9 osobno, nieprzedwybrane. | wiersz „Niezbędne” jako `ProfileSystemState` (5.7) |
| LR-3 | Równa widoczność „Akceptuj wszystkie” i „Tylko niezbędne”. Wycofanie równie łatwe. | dwa `outline` obok siebie, po 50% (5.7) |
| LR-4 | Opis zgody = realny skutek. Marketing bez AdMob nie jest aktywnym przełącznikiem. Znacznik daty tylko przy zapisie. | statystyki: tekst docelowy; marketing: stan systemowy; „Ostatnia decyzja” warunkowo |
| LR-5 | Link do polityki prywatności w bloku zgód, bez przewijania poza blok. | pierwszy element bloku „Zgody” |
| LR-6 | Eksport opisany bez „wszystkich danych”; ostrzeżenie przed pobraniem. | blok „Dane i eksport” (5.7) |
| LR-7 | Usunięcie: nieodwracalne, kategorie, bez obietnic u dostawców, bez zamówień, fraza USUŃ, osobna strefa. | `ProfileDangerZone` + dialog (5.7.1) |
| LR-8 | Brak wartości domyślnych zapisywanych jako dane. Źródło wagi z datą. | pola puste z placeholderem; wskazówka „Ostatni pomiar” |
| LR-9 | Stałe zastrzeżenie przy kcal, makro, sumach i cardio. Bez żargonu. | wskazówki pod celami i cardio; mikrokopia 7 |
| LR-10 | Ostrzeżenie dla kont 16–17 lat przy deficycie. Brak wieku = brak ostrzeżenia. | `InlineBanner info` na `/profile/diet` (5.4) |
| LR-11 | Brak wartości pól w logach, Sentry i analityce. | sekcja 13, U-9 (dla `frontend`) |
| LR-12 | Teksty prawne zatwierdza człowiek przed Promote. Ogólne etykiety zatwierdza `ux`. | sekcja 7 (oznaczenia „[do potwierdzenia]”) |

---

## 9. Dostępność (WCAG 2.2 AA, NFR-3)

- **Kontrast:** tekst główny biały 90–92%, drugorzędny `--gym-text-secondary` (ok. 6,5:1). Zakaz `text-white/45|40|35` na tekście informacyjnym tego ekranu. Placeholdery w tym samym kolorze co tekst drugorzędny.
- **Cele dotykowe:** 44 px minimum dla wszystkich przycisków, chipów, zakładek i linków. Pola 48 px. Przyciski zapisu 48 px.
- **Nazwy:** każde pole ma `<label>` (widoczny). Każdy przycisk bez tekstu ma `aria-label`. Przełączniki `role="switch"` z `aria-checked` i nazwą. Chipy `aria-pressed`. Dni tygodnia z pełną nazwą w `aria-label`.
- **Błędy pól:** `aria-invalid`, `aria-describedby` na komunikat, komunikat tekstowy (nie tylko kolor).
- **Statusy:** `role="status"` na linii „Zapisano / Niezapisane zmiany / Zapisywanie…” (`aria-live="polite"`). Błędy: `role="alert"`.
- **Kolejność fokusu:** wiersz konta -> zakładki -> nagłówek -> treść od góry -> blok zapisu. Dialog przechwytuje fokus i wraca do przycisku, który go otworzył.
- **Klawiatura:** wszystkie kontrolki dostępne Tab. Chipy zwykłe Tab (nie strzałki). Opcje „list” (radiogroup) strzałkami.
- **Ruch:** bez animacji przy `prefers-reduced-motion`. Szkielety nie pulsują.
- **Kolor:** każdy stan ma ikonę i tekst. Kalendarz: ikona kształtu (`Dumbbell` vs `Moon`) i legenda tekstowa.
- **Tekst:** minimum 11 px dla etykiet uppercase, 12 px dla meta, 13–14 px dla treści.
- **Język:** `lang="pl"`. Jednostki pełnymi słowami w `aria-label`, np. „sto pięćdziesiąt minut tygodniowo”. Skróty tylko w warstwie wizualnej.
- **Liczby:** `inputMode` na każdym polu liczbowym (US-9). Pole nie jest ucinane na 360 px.

---

## 10. Responsywność

| Szerokość | Zmiana |
|---|---|
| 360 px (minimum) | Pola ciała w dwóch kolumnach (imię/nazwisko), wiek w pełnej szerokości w drugim wierszu. Kalendarz: 7 przycisków po 44 px z odstępem 3 px (328 px dostępne). Zakładki przewijane, dwie ucięte. |
| 390 px (wzór makiety) | Układ jak w makiecie. |
| 430 px | Waga, wzrost, wiek w trzech kolumnach. Kafelki przeglądu bez zmiany układu (jedna kolumna). |
| 640 px (`sm`) | Paddingi `p-5`. Dwa przyciski zgód i eksportu obok siebie bez zmiany. |
| 768 px (`md`) | Kontener `max-w-xl` (jak reszta aplikacji). Karty przeglądu w dwóch kolumnach, a strefa niebezpieczna na pełną szerokość. |
| Wysokość < 719 px (`compact`) | Mniejsze odstępy między sekcjami (`space-y-5`), wskazówki bez zmiany treści. |

---

## 11. Pokrycie wymagań

### 11.1 Funkcje F-1..F-20 (nic nie znika)

| ID | Funkcja | Gdzie w nowym układzie |
|---|---|---|
| F-1 | Karta konta: awatar, imię, e-mail | wiersz konta w `layout.tsx` (każda podstrona) |
| F-2 | Wylogowanie | przycisk „Wyloguj” w wierszu konta |
| F-3 | Imię, nazwisko, waga, wzrost, wiek, płeć, aktywność | `/profile/body` |
| F-4 | Link do planu treningowego (ze stanem) | `/profile/training`, sekcja 04; przegląd |
| F-5 | Cel cardio (presety 90/150/210/300) | `/profile/training`, sekcja 01 |
| F-6 | Cykl raportów (3–90, presety 7/14/30) | `/profile/training`, sekcja 02 |
| F-7 | Jednostka porównań (autozapis) | `/profile/training`, sekcja 03 |
| F-8 | Cele makro dzień treningowy i odpoczynku, kcal 4/4/9 | `/profile/diet`, sekcja 01 |
| F-9 | Kalendarz tygodnia, domyślnie odpoczynek | `/profile/diet`, sekcja 02 |
| F-10 | Makro 5 posiłków, suma dnia | `/profile/diet`, sekcja 03 (dwa zestawy) |
| F-11 | Przypomnienia: godziny, dni, e-mail, kanał | `/profile/reminders` |
| F-12 | Język (Polski / English) | `/profile/app` |
| F-13 | Informacja o wersji Android | `/profile/app`, sekcja 02 |
| F-14 | Zmiana hasła (tylko konta z hasłem) | `/profile/account`, sekcja 01 |
| F-15 | Zgody: analityka, marketing, akceptuj wszystkie, tylko niezbędne | `/profile/account`, sekcja 02 |
| F-16 | Eksport JSON i CSV | `/profile/account`, sekcja 03 |
| F-17 | Usunięcie konta z frazą „USUŃ” | `/profile/account`, strefa niebezpieczna |
| F-18 | Link do polityki prywatności | `/profile/account`, pierwszy element sekcji 02 |
| F-19 | Komunikaty zapisu i błędy walidacji | wspólny `ProfileSaveBlock` (sekcja 4), błędy pól (5.2) |
| F-20 | Nawigacja do sekcji bez JS | zakładki jako linki (`<Link>`) |

### 11.2 Historie US-1..US-10

| US | Rozwiązanie w projekcie |
|---|---|
| US-1 cel cardio bez przewijania | cardio jako pierwsza sekcja `/profile/training`; 2 tapy (1.3) |
| US-2 suma posiłków vs cel | `InlineBanner warning` + różnica w kcal i % (5.4); status na przeglądzie |
| US-3 puste pola ciała | placeholdery, brak wartości domyślnych, zapis częściowy (5.2) |
| US-4 skąd waga i kiedy | „Ostatni pomiar: 58 kg, 12.10.2026” (5.2), karta przeglądu |
| US-5 zgoda spójna i trwała | zapis serwerowy (LR-1), autozapis, niezależność od sekcji (4.2) |
| US-6 edytowalne vs wyliczone | trzy kontenery (sekcja 3) |
| US-7 przewidywalny zapis | status „Zapisano / Niezapisane zmiany” i dialog przy zmianie zakładki (4) |
| US-8 usunięcie z potwierdzeniem | strefa niebezpieczna, przycisk wyłączony do „USUŃ” (5.7.1) |
| US-9 szybka zmiana na 360 px | `inputMode`, pola 48 px, zakładki z linkiem zawsze w tym samym miejscu |
| US-10 dwa urządzenia | konflikt z wczytaniem danych (4.5) |

---

## 12. Katalog komponentów (ten ekran)

Zasada: najpierw istniejące. Nowe tylko tam, gdzie nic nie pasuje. Każdy nowy komponent trafia do katalogu `docs/ux/00-system-projektowy-stan.md` (sekcja „Klocki domenowe”) po implementacji.

| Komponent | Status | Gdzie | Warianty i stany | Uwagi |
|---|---|---|---|---|
| `AppPageHeader` | istniejący, reuse | nagłówek każdej strony | kicker, tytuł, meta | |
| `SectionLabel` | istniejący, reuse | H2 sekcji | `index`, `title`, `titleAs="h2"` | |
| `InlineBanner` | istniejący, reuse | błędy, konflikty, ostrzeżenia, zastrzeżenia | `info`, `warning`, `error`, `success` | zastrzeżenie LR-9 w `info` |
| `Button` | istniejący, reuse | zapis, eksport, zgody, dialogi | `cta`, `outline`, `ghost`, `destructive` (outline) | nie używać surowego `gym-btn-primary` |
| `ConfirmDialog` | istniejący, reuse | usunięcie, niezapisane zmiany | | |
| `ProfileField` | istniejący, rozszerzany (`profile-ui.tsx`) | pola tekstowe i liczbowe | prop `hint`, `error`, `placeholder`, `suffix` (jednostka) | `inputMode` przekazywany |
| `ProfileSelect` | istniejący, reuse | płeć | | pierwsza opcja „Nie podano” |
| `ProfileSwitch` | istniejący, reuse (usunąć kopię w `reminders-card.tsx:212-233`) | przypomnienia, zgody | `role="switch"`, `aria-checked` | |
| `ProfileChipGroup` | **nowy** (`profile-ui.tsx`, zastępuje 3 kopie) | cel cardio, raporty, jednostka, typ dnia, język, dni tygodnia | `variant="chips"` (`aria-pressed`, min 44 px), `variant="list"` (`radiogroup`, wiersz 56 px z opisem) | |
| `ProfileNav` | **zastąpiony** przez zakładki w `layout.tsx` (`ProfileTabs`) | pasek zakładek | `aria-current`, kropka „niezapisane” | kotwice usunięte |
| `ProfileShortcut` | **nowy** (`profile-ui.tsx`) | karty przeglądu i link do planu | `default`, `empty`, `partial`, `warning` (z ikoną i tekstem) | jedyny kontener przeglądu, `app-card` jako tło |
| `ProfileSaveBlock` | **nowy** (`components/profile/profile-save-block.tsx`) | każdy blok zapisu | tryby: `button`, `autosave`; stany: czysty, zmieniony, zapisywanie, błąd, konflikt, offline | ADR sekcja 5 |
| `ProfileComputedValue` | **nowy** (`profile-ui.tsx`) | kcal z makro, suma dnia, kcal posiłku | `default`, `compact` (w wierszu posiłku) | wygląd sekcji 3 |
| `ProfileSystemState` | **nowy** (`profile-ui.tsx`) | kanał przypomnień, zgoda niezbędna, marketing, wersja Android, stan „domyślne 150 min” | `neutral`, `active`, `warning` (gold), `dashed` (nieaktywne) | pill, bez przełącznika |
| `ProfileDangerZone` | **nowy** (`profile-ui.tsx`) | strefa usunięcia konta | jeden wariant | jedyne miejsce `--destructive` na ekranie tła |
| `InlineBanner` w wariancie `info` | reuse | zastrzeżenia, LR-10, eksport | | |
| `Explainer` (`progress-ui`) | reuse, opcjonalnie | „Jak liczymy?” przy kcal | | można użyć zamiast wskazówki, jeśli treść jest długa |

Usuwane w czasie implementacji: duplikaty switch (`reminders-card.tsx:212-233`), trzy kopie chipów, `gramsForKcal`, `parseGrams`, `kcalStringFromMacros`/`parseGoalsPayload` (zgodnie z ADR sekcja 7), `ProfileNav`.

---

## 13. Odstępstwa i luki (dla właściwych agentów)

Priorytet: P1 = blokuje dobre wykonanie, P2 = do rozstrzygnięcia przed implementacją, P3 = porządki.

| ID | Pr. | Temat | Kto rozstrzyga | Rekomendacja UX |
|---|---|---|---|---|
| U-1 | P2 | ADR sekcja 1 chce wagi (`ProfileStat`) w nagłówku konta na każdej podstronie. Wiersz konta ma tylko awatar, imię, e-mail, wylogowanie. | `architekt` (akceptacja odstępstwa) | Zostawić wagę w przeglądzie i na podstronie „Ciało” (sekcja 1.2) |
| U-2 | P2 | Czy baza rozróżnia cel cardio „zapisany” od „domyślnego 150” (`s?.goal ?? 150`)? Bez tego nie da się uczciwie pokazać „domyślnie”. | `architekt` / `backend` | Potrzebna informacja, czy wartość istnieje (null vs liczba). Bez zmiany schematu |
| U-3 | P1 | Poziom aktywności ma w schemacie wartość wymaganą (`z.enum`). Jeśli baza ma domyślną, zapis formularza utrwali wartość, której użytkownik nie wybrał (ta sama logika co LR-8). | `architekt` / `backend` | Pusta wartość = brak zaznaczenia; zapis nie wpisuje domyślnej. Wymaga decyzji o schemacie |
| U-4 | P2 | Konflikt: czy oferować „Zachowaj moje zmiany” (nadpisanie po świadomym wyborze)? | właściciel / `architekt` | Tak, z dwoma przyciskami (4.5). Bez tego: tylko wczytanie i ostrzeżenie o utracie zmian |
| U-5 | P1 | `/profile/workout-plan` leży pod `profile/`, więc `layout.tsx` objąłby edytor planu. | `architekt` | Grupa tras (`(hub)`) dla podstron z layoutem; `workout-plan` poza nią. URL bez zmian |
| U-6 | P2 | Marketing: pokazać jako stan „Nieaktywne w tej wersji” (obecna rekomendacja), czy ukryć? | właściciel (prawnik: LR-4) | Pokazać jako stan systemowy (F-15 zachowana), nie jako przełącznik |
| U-7 | P2 | Tekst statystyk: wariant docelowy (wymaga bramki serwerowej, LR-4) czy awaryjny z ocen prawnika (2.3: „Zapisane na tym urządzeniu”)? | `prawnik` (człowiek) | Makieta pokazuje wariant docelowy. Do Promote tylko z bramką serwerową |
| U-8 | P2 | Kalendarz tygodnia: czy oznaczenie dotyczy konkretnych dat (`dayTypes[dateKey]`), czy wzorca tygodniowego? Od tego zależy wyjaśnienie. | `analityk` (decyzja produktowa) | Makieta zakłada konkretne daty („Tydzień 19–25 paź”), z legendą |
| U-9 | P2 | LR-11: w komponentach profilu brak `console.*` z wartościami pól, bez wartości w breadcrumbs. | `frontend`, `tester-bezpieczenstwa` | Test lub reguła lintu (zalecenie prawnika) |
| U-10 | P3 | Zapis przez inline status zamiast modalu `AlertDialog` (`useSaveFeedback`, 63 pliki). To świadome odstępstwo dla profilu, zgodne z ADR sekcja 5 i z pkt 6 w 00 (modal blokujący jest problemem). | `ux` (decyzja zapisana tu) | Spójne w profilu. Zmianę w całej aplikacji prowadzi osobne zadanie |
| U-11 | P3 | Ikony lucide w specyfikacji (`Calculator`, `Lock`, `Bell`, `Smartphone`, `TriangleAlert`, `Dumbbell`, `Moon`, `LogOut`, `Check`, `Plus`) - nazwy do sprawdzenia w wersji z `package.json`. | `frontend` | Zamienić na dostępne bez zmiany znaczenia |
| U-12 | P3 | Wyrównanie wartości zakresu wagi: 1–400 kg (ADR) w profilu i wpisie wagi. | `frontend` | Jedna stała, jeden komunikat |

Brak luk blokujących etap 5 po rozstrzygnięciu U-3 i U-5 (oba dotyczą przed implementacją, nie po niej).

---

## 14. Lista zmian względem obecnego ekranu (dla `frontend`, z priorytetami)

| Pr. | Zmiana | Gdzie w kodzie (obecnie) | Powód |
|---|---|---|---|
| P1 | Podział na podstrony z layoutem (wiersz konta, zakładki), przegląd jako karty-skróty | `app/(dashboard)/profile/page.tsx`, `components/profile/profile-ui.tsx` (`ProfileNav`) | US-1, NFR-1, ADR 1 |
| P1 | Puste pola ciała bez `?? 80/180/25`; placeholdery; zapis częściowy | `components/profile/body-params-form.tsx:75,86,97` | LR-8, US-3, T-2 |
| P1 | Trzy rodzaje wartości: `ProfileComputedValue`, `ProfileSystemState` | `nutrition-plan-section.tsx`, `meal-templates-form.tsx:101-111` | US-6 |
| P1 | Zgody zapisywane na serwerze; przyciski zgód równej rangi; marketing jako stan | `components/consent/consent-settings-card.tsx` | LR-1, LR-3, LR-4 |
| P1 | Strefa niebezpieczna jako osobny kontener; eksport opisany wg LR-6 | `components/profile/personal-data-card.tsx` | LR-6, LR-7, US-8 |
| P1 | Zastrzeżenie zdrowotne stałe przy celach i cardio; bez „Keytel” | `body-params-form.tsx:106`, `nutrition-plan-section.tsx` | LR-9, NFR-9 |
| P1 | Ostrzeżenie sumy posiłków względem celu; porównanie per typ dnia | `meal-templates-form.tsx`, `nutrition-plan-section.tsx` | US-2, T-3 |
| P2 | `ProfileSaveBlock` na wszystkich blokach; kropka „niezapisane” na zakładce; dialog przy zmianie zakładki | sześć modeli zapisu (T-5) | R-6, US-7 |
| P2 | `ProfileChipGroup` zamiast trzech kopii chipów; `ProfileSwitch` zamiast ręcznego switcha | `profile-goal-form.tsx:43-60`, `report-cadence-form.tsx:45-62`, `reminders-card.tsx:212-265` | T-6 |
| P2 | Usunięcie tekstu „sekcja Aplikacja poniżej” | `reminders-card.tsx:346` | R-9 |
| P2 | Konflikt `expectedUpdatedAt` z komunikatem UX | `actions/nutrition-settings.ts`, `actions/meal-quick.ts` | US-10, T-9 |
| P3 | Wartości zakresu wagi, zaokrąglenia, etykiety zakładek z jednej stałej | `actions/profile.ts:18`, `actions/weight.ts:28` | T-12, T-13 |

---

## 15. Werdykt etapu 4

**ZATWIERDZONE Z UWAGAMI.**

Specyfikacja zachowuje wszystkie funkcje F-1..F-20 i pokrywa US-1..US-10 oraz LR-1..LR-12. Układ oparty na podstronach i wspólnym `ProfileSaveBlock` jest zgodny z ADR 0006.

Warunki przed implementacją (etap 5):

1. **U-3 i U-5 rozstrzygnięte** przez `architekt` (poziom aktywności bez domyślnej wartości zapisu; grupa tras dla `workout-plan`). To warunki wykonalności, nie ozdobniki.
2. **U-1 zaakceptowane** przez `architekt` (wiersz konta bez kafelków wagi).
3. **Teksty prawne** (LR-4 statystyki, LR-6 eksport, LR-7 usunięcie, LR-9 zastrzeżenie, LR-10 ostrzeżenie) zatwierdzone przez człowieka-prawnika przed Promote. Makieta zawiera je jako projekt.
4. **Warunek Promote z ADR i prawnika:** zapis zgód na serwerze i bramka po stronie serwera dla analityki. Bez nich wariant z tekstem „Wyłączenie wstrzymuje wysyłkę…” nie może trafić na produkcję (U-7).

Po spełnieniu warunków `ux` nie robi przeglądu kodu domyślnie. `tester` sprawdza zgodność z tym dokumentem i makietą (etap 6). Wyjątek: niejednoznaczne odstępstwo wizualne.
