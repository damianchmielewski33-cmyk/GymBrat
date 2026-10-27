# 010 - Redesign arkusza "Dodaj cardio": specyfikacja UX (etap 4)

- **Autor**: ux (etap 4 zadania 010)
- **Data**: 2026-10-26
- **Karta**: `docs/zadania/010-redesign-dodawania-cardio.md` (zakładana przez koordynatora)
- **Wejście**: `docs/analiza/010-redesign-dodawania-cardio.md` (US-1..US-12, AC-*, BR-1..BR-11, F-1..F-14, U-1..U-12, Q-C1..Q-C5), `docs/ux/00-system-projektowy-stan.md` (tokeny, komponenty), wzorzec `docs/ux/009-redesign-analizy-postepow.md` (format, zasady stanów), makieta referencyjna `docs/ux/009-redesign-analizy-postepow-makieta.html` (zmienne CSS).
- **Zależność od ADR 0009 (architekt)**: w chwili pisania specyfikacji `docs/adr/0009-redesign-dodawania-cardio.md` **nie istnieje**. Sekcja 9 (kontrakt danych dla UI) i sekcja 7 (komunikaty serwera) opierają się na punktach, które analityk wskazał jako wejście dla ADR (kanoniczny zakres minut, źródło postępu tygodnia, reguła max tętno ≥ śr. tętno, mapowanie błędów na pola). Są oznaczone **[ADR 0009]**. Po opublikowaniu ADR koordynator porównuje je z tym dokumentem; rozbieżność rozstrzyga ADR (kontrakt danych) albo ten dokument (wygląd i kolejność), a różnicę zgłaszamy.
- **Makieta statyczna**: `docs/ux/010-redesign-dodawania-cardio-makieta.html` (trzy ramki 390 px: A dane, B błąd walidacji, C pierwszy wpis w tygodniu i błąd sieci). Makieta jest referencją dla `frontend`. Gdy różni się od tego dokumentu, wygrywa dokument.
- **Zakres**: wyłącznie arkusz `components/treningi/cardio-log-sheet.tsx` (otwierany z hubu `components/cardio/cardio-hub-view.tsx` i z kafelka `components/home/home-training-card.tsx`). Edycja wpisu (`cardio-detail-client.tsx`, `workout-finished-screen.tsx`) poza zakresem wyglądu.
- **Status**: specyfikacja do akceptacji. Mikrokopia jest propozycją do zatwierdzenia przez właściciela produktu (Q-C1..Q-C5, sekcja 14).
- **Werdykt**: patrz sekcja 15.

---

## 0. Kluczowe decyzje UX

1. **Minuty są bohaterem, reszta czeka.** Pierwszy ekran arkusza to: rodzaj, duży stepper minut z presetami, dzień. Szczegóły (dystans, tętno, wysiłek, kalorie, kroki, notatka) są w jednej zwiniętej sekcji „Szczegóły · opcjonalne”. Wpis z samymi minutami zapisuje się w 3 dotknięcia (US-1, NF-1).
2. **Postęp tygodnia jest na szczycie, a efekt wpisu przy steperze.** Zamiast statycznego „Zalecenie: 150 min / tydzień” jest karta „Ten tydzień: 120 z 150 min” z paskiem. Pod steperem pojawia się podgląd „Po zapisie: 150 z 150 min”. Użytkownik widzi wpływ minut, zanim naciśnie przycisk (US-2, U-1, U-2).
3. **Brak cichych zmian.** Pole minut nie zamienia wartości na 1 ani 30, nie zaokrągla „1,5”, nie ucina „700” do 300. Każdy błąd jest widoczny przy polu, a przycisk zapisu jest nieaktywny tylko przy błędzie minut, z wyjaśnieniem obok (BR-3, AC-1.2..1.4).
4. **Błąd przy polu, nie tylko toast.** Każde pole ma miejsce na komunikat pod sobą. Toast zostaje tylko dla błędów ogólnych (sieć, 5xx). Pierwsze błędne pole dostaje fokus (AC-4.6).
5. **Wysiłek jako skala, nie tekst.** 10 przycisków w dwóch rzędach po 5 (1..10). Nie da się wpisać 11, 0 ani 6,5 (BR-7, F-5).
6. **Jednostka widoczna w polu.** `km`, `bpm`, `kcal`, `kroków` jako sufiks wewnątrz pola, nie tylko w etykiecie (U-8).
7. **Po zapisie zostajemy w arkuszu.** Stan sukcesu w tym samym arkuszu: „Zapisano 30 min”, „Tydzień: 120 z 150 min”, przyciski „Zobacz wpis” i „Gotowe”. Brak automatycznego przekierowania, więc nie ma ryzyka powtórnego przekierowania (F-13, F-14, US-8). Domyślne rozstrzygnięcie Q-C1.
8. **Język bez oceny.** „Cel osiągnięty”, „Do celu zostało 30 min”, „To pierwszy wpis w tym tygodniu”. Bez czerwieni i bez słów o winie (analiza 009, BR-7, zakaz słów oceniających).

---

## 1. Cel, użytkownik, kontekst

| Persona | Najważniejsze w arkuszu | Na pierwszym ekranie nie potrzebuje |
|---|---|---|
| P1 Początkujący (spacer, marsz) | rodzaj, preset minut, postęp, jeden przycisk | tętna, kalorii, kroków |
| P2 Zaawansowany (wynik z zegarka) | wszystkie pola z jednostkami, błąd przy polu, wysiłek 1-10 | presetów, dużych kafli |
| P3 Redukcja (kroki, kcal) | kroki, kcal w szczegółach, postęp tygodnia | notatki, wysiłku |
| Użytkownik na siłowni (słaba sieć) | szybki zapis, dane nie znikają po błędzie | długich formularzy |

Kontekst: telefon w jednej ręce, po serii, spocone dłonie. Wszystkie cele dotykowe min. 44 px, większość 48-56 px.

---

## 2. Architektura ekranu (od góry, 390 px)

Arkusz to bottom-sheet (mobile) i wyśrodkowany dialog (od `sm`). Sekcje w kolejności:

| # | Sekcja | Wysokość (orient.) | Przewijana? | Uwagi |
|---|---|---|---|---|
| H | Nagłówek: kicker „Cardio”, tytuł „Dodaj cardio”, X | 80 px | nie (sticky) | X 44 px |
| 1 | Karta „Ten tydzień” (postęp) | 76 px | tak | zawsze widoczna przy otwarciu |
| 2 | Rodzaj (siatka 4×2) | 116 px | tak | `aria-pressed` |
| 3 | Czas: stepper, presety, podgląd po zapisie | 196 px | tak | **dominująca** sekcja |
| 4 | Dzień (wiersz z „Zmień”) | 72 px | tak | data w rozwinięciu |
| 5 | Szczegóły · opcjonalne (nagłówek zwinięty) | 56 px | tak | licznik „2 z 7 wypełnione” |
| 5a | Szczegóły (po rozwinięciu) | ok. 360-420 px | tak | pola, wysiłek, notatka |
| F | Stopka: wyjaśnienie BR-1, błąd ogólny, przycisk | 112 px | nie (sticky) | przycisk 48 px |

Wysokość arkusza: `min(88dvh, 640px)` jak dziś, z przewijaniem treści między nagłówkiem a stopką. Przy zwiniętych szczegółach cała zawartość mieści się bez przewijania na 390×844 (ok. 700 px z 742 px dostępnych). Przy `max-height: 719px` (wariant `compact`) karta postępu zwija się do jednej linii, a presety zostają.

---

## 3. Hierarchia pól

| Klasa | Pola | Wizualnie | Wymagane? | Wpływ na cel tygodnia |
|---|---|---|---|---|
| **Krytyczne** | Minuty | stepper 56 px, liczba 48 px, złota ramka; sekcja „Czas” z etykietą „wymagane” | tak (1-600) | tak |
| **Krytyczne pośrednio** | Dzień | wiersz 56 px z wartością „Dziś, pon. 26.10” | domyślnie dziś | decyduje o tygodniu |
| **Wymagane z domyślną** | Rodzaj | siatka 4×2, domyślnie „Marsz” (lub z propsa) | tak (zawsze wysłany) | nie |
| **Opcjonalne (metadane)** | Dystans, śr. tętno, maks. tętno, wysiłek, kalorie, kroki, notatka | w zwiniętej sekcji, etykieta „opcjonalne”, pola 48 px, bez złotej ramki | nie | nie |

Zasada wizualna: w ekranie jest jedna złota liczba (minuty). Pola szczegółów są neutralne (szare obramowanie, tekst 15 px).

---

## 4. Komponenty i warianty

Wszystkie elementy składane z istniejących klocków; nowe tylko tam, gdzie nic nie pasuje. Pliki w `components/treningi/` (bez nowego katalogu).

| Element | Źródło / status | Warianty i stany | Uwagi |
|---|---|---|---|
| Powłoka arkusza | `CardioLogSheet` (portal, `app-dialog`) - zostaje | mobile bottom-sheet / `sm+` dialog | zachować portal i `role="dialog"`; decyzja frontend, czy przejść na `components/ui/sheet.tsx` (pytanie P-U1) |
| Nagłówek | klasy z obecnego arkusza, kicker `--gym-gold` 11 px | - | tytuł 24 px semibold |
| Karta postępu | **nowy** `CardioWeekProgress` (w `components/treningi/`) | `loading` (szkielet `animate-pulse`), `ready`, `ready-goal-reached`, `first-entry` (0 z N), `unavailable` (postęp niedostępny) | nie woła serwera; dane z propsów (NF-7) |
| Pigułki rodzaju | obecne `MACHINES`, zamienić na `CARDIO_TYPE_LABELS_PL` (AC-6.1) | `default`, `active` (aria-pressed=true), `focus-visible` | siatka 4×2, 44 px wysokości |
| Stepper minut | **nowy** `MinutesStepper` | `valid`, `invalid` (ramka czerwona, komunikat), `at-min` (− wyłączony przy 1), `at-max` (+ wyłączony przy 600), `disabled` (pending) | przyciski 56 px, pole 48 px wysokości |
| Presety | **nowy** element w `MinutesStepper` (chipy) | `default`, `active` (aria-pressed), `disabled` | 15 / 30 / 45 / 60 |
| Podgląd po zapisie | tekst w `CardioWeekProgress` lub pod steperem | `hidden` (brak minut), `after-save` (120 → 150), `goal-reached` (170 z 150) | aria-live=off (nie ogłaszamy przy każdym ±5) |
| Wiersz daty | wiersz z przyciskiem „Zmień”; po kliku `input type="date"` | `today`, `custom`, `error` (przyszłość) | min = dziś − 60 dni, max = dziś |
| Sekcja szczegółów | **nowy** `CardioDetailsSection` (akordeon: przycisk nagłówka + `aria-expanded`, `aria-controls`) | `collapsed`, `expanded`, licznik „N z 7 wypełnione” | stan rozwinięcia pamiętany (Q-C4, założenie: zwinięte) |
| Pole liczbowe z jednostką | obecne `Input`/`fieldClass` z sufiksem | `default`, `focus`, `filled`, `invalid`, `disabled` | `inputMode="decimal"` (dystans) lub `"numeric"`, sufiks `km` / `bpm` / `kcal` / `kroków` |
| Wysiłek 1-10 | **nowy** `EffortScale` | `none`, `selected` (aria-pressed), `focus-visible` | 2 rzędy po 5 przycisków, 44 px; ponowne kliknięcie wybranego czyści wartość |
| Notatka | `textarea` (obecny styl pola) | `default`, `counting` (licznik od 240), `over` (błąd) | licznik `240/280` |
| Komunikat przy polu | **nowy** `FieldMessage` (w `components/ui/` - brak istniejącego wzorca dla błędu pola) | `error`, `hint` | tekst 12-13 px, ikona `AlertCircle` 14 px, `id` do `aria-describedby` |
| Banner błędu ogólnego | `InlineBanner variant="error"` | - | nad przyciskiem; nie blokuje wpisu |
| Stopka | sticky, `border-t`, wyjaśnienie 12 px + `Button variant="cta"` size `lg` (48 px) | `idle`, `invalid`, `pending`, `success` (przycisk zastąpiony przez „Gotowe”) | |
| Stan sukcesu | wnętrze tego samego arkusza | `saved` | ikona `CheckCircle2` złota, „Zapisano 30 min” |

Katalog komponentów w `docs/ux/00-system-projektowy-stan.md` uzupełniamy w tym samym PR co implementacja (`CardioWeekProgress`, `MinutesStepper`, `CardioDetailsSection`, `EffortScale`, `FieldMessage`).

---

## 5. Stany ekranu (macierz)

| Stan | Co widać | Przycisk | Uwagi |
|---|---|---|---|
| **Ładowanie postępu** | karta postępu jako szkielet (2 paski 12 px, `animate-pulse`, statycznie przy `prefers-reduced-motion`); reszta arkusza działa | aktywny | nie blokuje wpisu minut |
| **Pusty (pierwszy wpis w tygodniu)** | „0 z 150 min” + „To pierwszy wpis w tym tygodniu.” bez pustych kart | aktywny | nie pokazujemy „0%” jako wyniku negatywnego |
| **Pusty (brak celu w ustawieniach)** | fallback 150 min, opis „Cel domyślny: 150 min. Zmień w profilu.” (link 44 px) | aktywny | A2 |
| **Częściowe dane** (postęp niedostępny, reszta działa) | karta: „Postęp tygodnia chwilowo niedostępny.” + „Wpis zapisze się mimo to.” | aktywny | nie ukrywamy stepera |
| **Błąd pola** | komunikat pod polem, `aria-invalid="true"`, obramowanie `--destructive` | nieaktywny tylko przy błędzie minut; przy innym polu aktywny, błąd blokuje wysyłkę i przenosi fokus | szczegóły 7 |
| **Błąd ogólny** (5xx, nieznany) | `InlineBanner error`: „Nie udało się zapisać wpisu. Dane są w formularzu. Spróbuj ponownie.” | aktywny (etykieta „Spróbuj ponownie”) | wartości zostają |
| **Offline / brak sieci** | banner: „Brak połączenia. Wpis nie został zapisany, dane zostają w formularzu.” | aktywny | NF-6: bez kolejki offline |
| **Zapisywanie** | przycisk „Zapisuję…” ze spinnerem `Loader2`; pola `aria-disabled`; X wyłączony | nieaktywny | AC-12.3: brak drugiego wpisu |
| **Sukces** | sekcja 8 (ekran sukcesu w arkuszu) | zastąpiony przez „Gotowe” | brak przekierowania |
| **Sesja wygasła** | banner: „Sesja wygasła. Zaloguj się ponownie - dane w formularzu zostaną.” + link | nieaktywny | zakres globalnej sesji; arkusz nie czyści pól |
| **Brak uprawnień** | arkusz nie otwiera się bez sesji (nawigacja przekierowuje) | - | nie projektujemy osobnego ekranu |

---

## 6. Interakcje

- **Otwarcie.** Fokus trafia do pola minut z zaznaczonym tekstem (wpisanie nadpisuje). Wartość startowa: preset z ostatniego wpisu, jeśli `architekt` go dostarczy, w przeciwnym razie 30 (BR-3: nie 1). Rodzaj: `defaultTitle` z propsa, jeśli jest na liście; w przeciwnym razie „Inne” z nazwą w notatce (AC-6.3). Dzień: dziś. Szczegóły zwinięte.
- **Rodzaj.** Tap ustawia aktywny. Brak potwierdzenia. Ten sam wybór nie zmienia stanu.
- **Presety 15/30/45/60.** Ustawiają minuty i zaznaczają aktywny preset (aria-pressed). Zmiana ręczna poza presetem odznacza preset.
- **− / +.** Krok 5 minut, od ostatniej poprawnej wartości, granice 1-600. Przy granicy przycisk nieaktywny (nie znika). Krótkie przytrzymanie: nie projektujemy w tej wersji (poza zakresem).
- **Pole minut.** Przyjmuje tylko cyfry w trakcie pisania (klawiatura numeryczna `inputMode="numeric"`). Znak `,` lub `.` nie jest usuwany po cichu: pokazujemy komunikat „Minuty wpisz jako liczbę całkowitą, np. 90.” (AC-1.3). Blur nie zmienia wartości (usuwamy `onBlur` z `setMinutesText(String(minutes))`, F-3).
- **Enter w polu minut.** Wysyła formularz, jeśli jest poprawny; jeśli nie, pokazuje błąd i zostaje.
- **Data.** Tap „Zmień” rozwija `input type="date"` z min/max; zwinięcie po wyborze daty. Pusta wartość = dziś.
- **Szczegóły.** Przycisk nagłówka rozwija/zwija. Zwinięcie nie kasuje wartości (AC-3.4). Licznik aktualizuje się przy każdej zmianie.
- **Wysiłek.** Tap wybiera; ponowny tap na wybrany czyści (wartość `null`, nie 0). Brak wpisywania.
- **Notatka.** Licznik `N/280` od 240 znaków. Po 280 pole nie przyjmuje więcej znaków w UI (`maxLength=280`) i pokazuje komunikat, gdy wklejono więcej niż limit (AC-10.2, serwer też odrzuca).
- **Zapisz.** Walidacja klienta (sekcja 7). Jeśli błędy - fokus na pierwsze błędne pole w kolejności: minuty, dzień, szczegóły (rozwija sekcję, jeśli zwinięta). Jeśli OK - stan „Zapisuję…”.
- **Po sukcesie.** Stan sukcesu w arkuszu (sekcja 8). Fokus na „Gotowe”.
- **Zamknięcie.** X, Esc, tap w tło: zamykają arkusz i przywracają fokus na przycisk otwierający. W stanie „Zapisuję…” zamknięcie zablokowane (AC-12.3).

---

## 7. Walidacja inline (zgodna z `lib/cardio-utils.ts`, `CARDIO_INPUT_LIMITS`)

Zasady: (a) wartość nigdy nie zmienia się po cichu; (b) komunikat stoi pod polem; (c) pole z błędem ma `aria-invalid`; (d) serwer jest autorytatywny, klient pokazuje te same reguły; (e) komunikaty nie zawierają wartości wpisanej przez użytkownika (BR-9).

**Kiedy sprawdzamy:** minuty - przy każdej zmianie (błąd pojawia się od razu, bo to pole krytyczne). Pozostałe pola - po opuszczeniu pola (`blur`) i przy próbie zapisu; po pierwszym błędzie pole sprawdzane też przy każdej zmianie, żeby komunikat znikał, gdy wartość jest już poprawna.

| Pole | Reguła | Komunikat (PL) | Limit / źródło | Przycisk |
|---|---|---|---|---|
| Minuty | puste | „Podaj czas w minutach, 1–600.” | 1-600 (A4, Q-C2) | nieaktywny, etykieta „Podaj minuty, by zapisać” |
| Minuty | nie-całkowite (`,` `.`) lub nie-cyfry | „Minuty wpisz jako liczbę całkowitą, np. 90.” | - | nieaktywny |
| Minuty | < 1 | „Minimum to 1 minuta.” | 1 | nieaktywny |
| Minuty | > 600 | „Maksymalnie 600 minut w jednym wpisie.” | 600 (klient); serwer 1440 - **[ADR 0009]** | nieaktywny |
| Dystans | nieliczbowy lub ≤ 0 | „Podaj dystans liczbą, np. 3,5.” | > 0 | aktywny, błąd blokuje |
| Dystans | > 500 | „Dystans wygląda na pomyłkę (max 500 km).” | `distanceKmMax` 500 | j.w. |
| Śr. tętno, maks. tętno | nieliczbowe | „Podaj tętno samą liczbą, np. 125.” | - | j.w. |
| Śr. tętno, maks. tętno | poza 30-250 | „Tętno w zakresie 30–250 bpm.” | `hrMin` 30, `hrMax` 250 | j.w. |
| Maks. tętno | < śr. tętno (oba podane) | „Maksymalne tętno nie może być niższe od średniego.” (pod polem maks.) | BR-6, **[ADR 0009]** potwierdza regułę | j.w. |
| Kalorie | nieliczbowe | „Podaj kalorie liczbą, np. 280.” | - | j.w. |
| Kalorie | > 20 000 | „Kalorie wyglądają na pomyłkę (max 20 000).” | `caloriesMax` | j.w. |
| Kalorie | kcal/min > 25 | „Kalorie nierealne przy tym czasie. Sprawdź wpis.” | `caloriesPerMinMax` 25 | j.w. |
| Kroki | nieliczbowe | „Podaj liczbę kroków, np. 4500.” | - | j.w. |
| Kroki | > 500 000 | „Liczba kroków wygląda na pomyłkę.” | `stepsMax` | j.w. |
| Wysiłek | - (wybór z przycisków) | brak błędu możliwego do wpisania | 1-10 całkowite (BR-7) | - |
| Notatka | > 280 | „Notatka może mieć najwyżej 280 znaków.” | 280 (BR-11) | j.w. |
| Notatka | same spacje | brak błędu; zapisuje się jako brak notatki (US-10.3) | - | - |
| Dzień | przyszłość | „Nie można zapisać wpisu z przyszłości.” | BR-8 | j.w. |
| Dzień | > 60 dni wstecz | „Można wpisać najwyżej 60 dni wstecz.” | BR-8 | j.w. |

Puste pola opcjonalne (dystans, tętno, kalorie, kroki) są poprawne i zapisują się jako brak wartości. Nie są zamieniane na 0 i nie wymagają komunikatu (AC-7.1).

**Mapowanie błędów serwera [ADR 0009]:** błędy z akcji wracają z `fieldErrors` (nazwa pola → komunikat) i ogólnym `error`. Błąd z `fieldErrors` ustawia komunikat pod polem i fokus na pierwsze pole w kolejności z sekcji 6. Błąd bez pola idzie do bannera ogólnego. Komunikaty serwera mają być identyczne z tabelą powyżej (wspólne źródło, BR-4).

---

## 8. Stan sukcesu w arkuszu

- Ikona `CheckCircle2` 32 px złota, nagłówek „Zapisano 30 min” (24 px semibold).
- Linia 2: „Tydzień: 120 z 150 min.” (wartość z serwera, nie z podglądu; AC-2.6). Gdy cel osiągnięty: „Cel tygodnia zrobiony: 170 z 150 min.”
- Linia 3 (13 px, secondary): „Wpis trafił na Dziś, pon. 26.10.” (AC-5.5: dzień widoczny w wyniku).
- Przyciski: „Zobacz wpis” (outline, 48 px, link do `/cardio/<id>`) i „Gotowe” (cta, 48 px, zamyka arkusz).
- Dla zapisu w innym dniu: „Wpis trafił na Wt, 20.10. Tydzień 20–26.10: 90 z 150 min.”
- Brak automatycznego zamknięcia (kontekst zostaje, F-14).
- Animacja: fade + przesunięcie 8 px, 200 ms; przy `prefers-reduced-motion` tylko fade.

---

## 9. Dane dla UI [ADR 0009 - kontrakt do potwierdzenia]

UI potrzebuje od rodzica (bez zapytania przy podglądzie, NF-7):

- `weeklyCardio`: `{ goalMinutes: number; doneMinutes: number; windowLabel: string; windowStartKey: string; windowEndKey: string } | null` (`null` = częściowe dane / ładowanie). `windowLabel` to tekst gotowy do wyświetlenia (np. „20–26.10”) - wartość z jednej funkcji liczącej (BR-2, AC-2.7).
- `defaultMinutes?: number` (ostatni wpis, jeśli ADR go przewiduje; w przeciwnym razie 30).
- `defaultTitle` (istniejący prop).

Po zapisie akcja zwraca: `{ ok: true; id: string; minutes: number; dateKey: string; weekProgress: { doneMinutes; goalMinutes; windowLabel } }`. Podgląd przed zapisem liczy klient z `doneMinutes` + wpisane minuty (tylko jako podgląd; nie zapisuje lokalnej kopii, BR-2).

Gdy `weeklyCardio` wróci z innym `windowLabel` niż na ekranie głównym i w hubie (Q-C3, F-12), arkusz pokazuje swój `windowLabel`, więc użytkownik widzi zakres, do którego liczy się wpis. Ten projekt działa dla obu rozstrzygnięć: tygodnia pn-nd i kroczących 7 dni (np. „Ostatnie 7 dni”).

---

## 10. Wygląd i tokeny

Wyłącznie istniejące tokeny (`app/globals.css`) i klasy z `components/layout/screen.tsx` / `progress-ui.tsx`. Nowe tokeny niepotrzebne.

| Rola | Token / klasa | Uwagi |
|---|---|---|
| Tło arkusza | `--gym-surface-sunken` (`#141416`) z gradientem złota 16% u góry (jak dziś) | |
| Karta postępu | `app-panel` z gradientem `--gym-surface-gold` (`#15120b`), obramowanie `--gym-border-gold` | wyróżnia, ale nie jest hero |
| Akcent | `--gym-gold` `#ebc44a` | tylko: liczba minut, aktywna pigułka, aktywny preset, przycisk zapisu, ikona sukcesu |
| Tekst główny | `#fff` / 90% | |
| Tekst drugorzędny | `--gym-text-secondary` `#9a9182` (~6,5:1 na `#070708`) | zamiast `white/35`, `/40`, `/45` (kontrast, U-5, AC-9.4) |
| Błąd | `--destructive` `#ff3347` na obramowaniu i ikonie; tekst błędu w `--foreground` 90% | kontrast tekstu pewny bez zależności od odcienia czerwieni; wariant alternatywny: pytanie P-U3 |
| Potwierdzenie | `--gym-success` `#3ecf72` | tylko w sukcesie (ikona + tekst) |
| Pole | `--gym-surface-raised` `#1c1c1f`, obramowanie `white/12`, fokus `--gym-gold` 45% + ring 2 px | |
| Promienie | arkusz 22 px (góra), pola 12 px, pigułki `rounded-full`, przycisk 16 px (`rounded-2xl`) | |
| Odstępy | skala 4/8: sekcje `space-y-5` (20 px), wewnątrz sekcji 12 px, pole 8 px | |

**Typografia (5 poziomów, min. 11 px):**

| Poziom | Klasa / rozmiar | Użycie |
|---|---|---|
| H1 | 24 px semibold (`font-heading`) | „Dodaj cardio” |
| Liczba hero | `font-metric` 48 px, `tabular-nums`, złoto | minuty w steperze |
| H2 / sekcja | 11 px uppercase, `tracking-[0.14em]`, semibold, biały 90% | „Rodzaj”, „Czas”, „Dzień” |
| Treść / wartość | 15 px semibold / medium | nazwa pigułki, wartość dnia, pole |
| Meta / pomocnicze | 12-13 px, `--gym-text-secondary` | podgląd, komunikaty, licznik |

Wszystkie liczby (minuty, tętno, kcal, kroki, dystans, licznik) w `tabular-nums`. W jednostkach w polu: sufiks 12 px `--gym-text-secondary` po prawej, w obrębie pola.

**Ruch:** otwarcie arkusza 220 ms (przesunięcie od dołu), zwijanie szczegółów 200 ms (wysokość), przejście wartości „Po zapisie” bez animacji liczby. Wszystko wyłączane przy `prefers-reduced-motion`.

---

## 11. Responsywność

- **360-390 px (telefon):** arkusz pełnej szerokości, pigułki 4×2 (szerokość ok. 80 px), presety 4 w rzędzie (po ok. 80 px), pola szczegółów: 2 kolumny (dystans + śr. tętno, max tętno + kalorie, kroki samo, poniżej notatka). Na 360 px etykiety pigułek mogą się zawijać do 2 linii (`line-clamp-2`), nie obcinać.
- **Niska wysokość (`max-height: 719px`, wariant `compact`):** karta postępu w jednej linii („120 z 150 min · ten tydzień”), odstępy sekcji 16 px, pigułki bez zmiany rozmiaru dotyku.
- **`sm` i większe (dialog):** `max-w-lg`, wyśrodkowany, wysokość `auto` do `88dvh`, zaokrąglenia 22 px wszystkie rogi. Szczegóły: pola w 2 kolumnach zawsze.
- **Klawiatura systemowa:** arkusz przewija treść, pole aktywne pozostaje widoczne (`scrollIntoView` block nearest). Stopka nad klawiaturą (`env(safe-area-inset-bottom)`).

---

## 12. Dostępność (WCAG 2.2 AA)

- **Dialog:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` na tytule. Fokus wewnątrz (pułapka fokusu), Esc zamyka, po zamknięciu fokus wraca na przycisk otwierający (AC-9.3).
- **Cele dotykowe:** min. 44 px (pigułki, presety, chipy, przycisk X, „Zmień”, nagłówek szczegółów); stepper 56 px; przycisk zapisu 48 px; wysiłek 44 px.
- **Pigułki rodzaju i presety:** `aria-pressed` (AC-6.2); grupa z `role="group"` i `aria-label="Rodzaj aktywności"` / `"Preset czasu"`.
- **Stepper:** przyciski „Mniej minut” / „Więcej minut” (AC-9); pole `aria-label="Minuty"` (pole tekstowe, nie slider, więc bez `aria-valuetext`), `aria-describedby` wskazuje na podgląd i komunikat błędu, `aria-invalid` przy błędzie.
- **Wysiłek:** `role="radiogroup"` z `aria-label="Wysiłek w skali 1 do 10"`, przyciski `role="radio"` + `aria-checked`, strzałki w lewo/prawo zmieniają wybór (wzorzec radio group). Brak wyboru: żaden nie jest `checked`. Alternatywa bez zmiany wzorca: przyciski z `aria-pressed` - decyzja frontend, obie działają; preferowany radio group.
- **Komunikaty błędów:** pod polem, `id` i `aria-describedby`; jeden region `aria-live="polite"` na banner ogólny; błąd pola nie jest ogłaszany co znak (tylko przy zmianie stanu błędu).
- **Kontrast:** tekst drugorzędny 6,5:1, błąd na obramowaniu i ikonie, tekst błędu 90% biały (sekcja 10). Złoto na czerni 11:1.
- **Kolor nie jest jedynym nośnikiem:** błąd = ikona + tekst + obramowanie; sukces = ikona + tekst; cel osiągnięty = tekst „cel osiągnięty”.
- **Etykiety:** każde pole ma widoczną etykietę (nie tylko placeholder); placeholder to przykład (np. „np. 125”), nie etykieta.
- **Kolejność fokusu:** nagłówek (X) → karta postępu (nieinteraktywna) → pigułki → minuty (− / pole / +) → presety → przycisk „Zmień” daty → szczegóły (nagłówek) → (po rozwinięciu) pola → stopka (przycisk). Kolejność zgodna z DOM.
- **Mniejszy ruch:** brak animacji przy `prefers-reduced-motion`.
- **Dane zdrowotne w czytniku:** komunikaty nie czytają wartości wpisanej przez użytkownika w błędzie (BR-9).

---

## 13. Zmiany wobec obecnego arkusza (zestawienie)

| Obecnie | Po redesignie | Powód |
|---|---|---|
| „Zalecenie: X min / tydzień” (statyczne) | karta „Ten tydzień: 120 z 150 min” z paskiem i zakresem | U-1, US-2 |
| 8 pigułek, `uppercase` 11 px, bez stanu dla czytnika | 4×2, sentence case 14 px, `aria-pressed` | U-10, AC-6.2 |
| Stepper ±5 + pole, presety brak | stepper 56 px, presety 15/30/45/60, podgląd „Po zapisie” | U-6, AC-1.1 |
| Pole minut: filtr `\D`, blur zamienia na `clampMinutes`, puste = 1 | brak filtra po cichu, błędy pod polem, brak zamiany | F-1..F-3, BR-3 |
| 9 pól na jednym poziomie (w tym data) | 3 sekcje: Rodzaj, Czas, Dzień + zwinięte Szczegóły (7 pól) | U-3, U-4 |
| Pola tekstowe bez jednostki, placeholder jako etykieta | etykieta + sufiks jednostki w polu | U-8 |
| Wysiłek: wolny tekst | skala 1-10 | U-7, F-5 |
| Błędy: toast po submit | komunikat przy polu, fokus na błędnym, toast tylko ogólny | U-5, F-8, AC-4.6 |
| Sukces: toast + przekierowanie `/cardio/<id>` + `router.refresh()` | stan sukcesu w arkuszu z linkiem „Zobacz wpis” | U-9, F-13, F-14, Q-C1 |
| Przycisk „Zapisz X min” | „Zapisz 30 min” + dzień, gdy nie dziś: „Zapisz 30 min · 20.10” | U-11, AC-5.3 |
| Tekst pomocniczy `white/35`, `/45`, `/40`, placeholder `/30` | `--gym-text-secondary` | P-9, AC-9.4 |

---

## 14. Pytania do właściciela produktu

Każde pytanie ma założenie w specyfikacji, więc nie blokuje etapu 5.

- **Q-C1 Zachowanie po zapisie.** Założenie: zostajemy w arkuszu, stan sukcesu z linkiem „Zobacz wpis” (sekcja 8). Alternatywa: przekierowanie jak dziś. Decyzja wpływa na UX, nie na dane.
- **Q-C2 Limit minut.** Założenie: 1-600 w UI i w walidacji klienta, z komunikatem powyżej limitu. Serwer 1440 do decyzji ADR 0009. Otwarte, czy 600 wystarcza (np. długie wycieczki rowerowe).
- **Q-C3 Definicja tygodnia.** Projekt pokazuje zakres w karcie (`windowLabel`), więc działa dla pn-nd i dla kroczących 7 dni. Decyzja metodologiczna należy do właściciela (F-12). Blokuje tylko poprawność liczby, nie układ.
- **Q-C4 Szczegóły zwinięte czy otwarte.** Założenie: zwinięte, z licznikiem. Otwarte pytanie: pamiętać ostatni stan (dla P2)?
- **Q-C5 Domyślny rodzaj.** Założenie: „Marsz” jak dziś, lub `defaultTitle` z ekranu, z którego otwarto arkusz. Propozycja (nowe zachowanie, bez decyzji w tym zadaniu): ostatnio użyty rodzaj. Wybór właściciela.
- **P-U1 Powłoka arkusza.** Zostać przy własnym portalu (`CardioLogSheet`) czy przejść na `components/ui/sheet.tsx`? Projekt działa w obu wariantach. Decyzja `frontend` i `architekt` (dedupe).
- **P-U2 Fokus na polu minut przy otwarciu.** AC-9.3 wymaga fokusu na polu minut. Na Androidzie fokus otwiera klawiaturę numeryczną od razu i zasłania presety. Założenie: fokus na polu minut zgodnie z AC; alternatywa: fokus na tytule, a pole minut po pierwszym dotknięciu. Wybór właściciela (wpływ na NF-1).
- **P-U3 Kolor tekstu błędu.** Projekt: obramowanie i ikona w `--destructive`, tekst w `--foreground`. Alternatywa: tekst błędu w `--destructive` (wymaga sprawdzenia kontrastu `#ff3347` na `#141416`, ok. 4,6:1, do potwierdzenia przez `tester`).
- **P-U4 Wartość startowa minut.** Założenie: 30 (dziś) lub preset z ostatniego wpisu (wymaga zapytania albo pola z propsa, decyzja ADR 0009).

---

## 15. Werdykt

**ZATWIERDZONE Z UWAGAMI** (etap 4, dokument i makieta). Uwagi do rozstrzygnięcia przed etapem 5:

1. Sekcja 9 (kontrakt danych) i sekcja 7 (`fieldErrors`) czekają na `docs/adr/0009-redesign-dodawania-cardio.md`. Po publikacji ADR koordynator zgłasza rozbieżności; ten dokument nie może zmienić kontraktu bez ADR.
2. Q-C1 (stan sukcesu w arkuszu zamiast przekierowania) i P-U2 (fokus i klawiatura na Androidzie) wymagają decyzji właściciela, choć projekt ma założenie.
3. Błędy kontrastu w obecnym arkuszu (`white/35`, `/40`, `/45`, placeholder `/30`) są do naprawy w ramach tego zadania (sekcja 13).

Stan: makieta `docs/ux/010-redesign-dodawania-cardio-makieta.html` dostarczona, ramki A (dane), B (błąd walidacji), C (pierwszy wpis w tygodniu i błąd sieci).
