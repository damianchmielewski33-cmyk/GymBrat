# 011 - Redesign ekranu Historia treningów (analiza)

- **Karta zadania**: `docs/zadania/011-redesign-historii-treningow.md`
- **Etap**: 1 - Wymagania (analityk). Zero zmian w kodzie, danych i kontraktach API.
- **Autor**: analityk (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Trasa**: `/workout-history` (`app/(dashboard)/workout-history/page.tsx`). Uwaga: polecenie wspominało o `/trening/historia`; w repozytorium takiej trasy nie ma.
- **Status**: do akceptacji użytkownika; wejście dla `architekt` (etap 3) i `ux` (etap 4)

---

## 1. Kontekst i cel

Ekran "Historia treningów" jest dziennikiem zakończonych sesji siłowych. Wejście: link "Historia treningów" z Pulpitu (`components/home/home-recent-workouts.tsx`, stopka karty "Ostatnie treningi") oraz "Dziennik obciążeń" w hubie Treningi (`/workout-plan`). Użytkownik zgłasza, że ekran wymaga przeprojektowania (zrzut ekranu: statystyki, pasek filtrów, tygodniowe grupy, rozwijane karty).

Cel zadania (wg polecenia):
1. Analiza architektoniczna i UX obecnego ekranu (sekcje 3 i 4) na podstawie kodu, nie tylko zrzutu.
2. Wymagania na redesign: lepsza hierarchia tydzień → trening → ćwiczenie, czytelne statystyki, szybsze filtrowanie, czytelność na telefonie.
3. Nowa architektura i wygląd zaprojektowane przez `architekt` i `ux` na makietach (etapy 3-4). Ten dokument ich nie wyprzedza.

Ten dokument zamyka etap wymagań. Nie projektuje architektury (to `architekt`) ani wyglądu (to `ux`).

---

## 2. Stan wyjściowy (zrzut + kod)

### 2.1 Co widać na zrzucie (potwierdzone w kodzie)
- Nagłówek "Historia treningów", kicker z licznikiem ("N TRENINGÓW"), link "Wróć" (zawsze do `/workout-plan`).
- Karta KPI (3 kolumny): "Na tydzień" (`avgWorkoutsPerWeekLast8`, "ost. 8 tyg."), "Średni czas" (`avgDurationMinutes`, min), "Tonaż" (`tonnageTotalKg / 1000`, "łącznie", t).
- Poziomy pasek chipów: "Wszystkie" + nazwy planów użytkownika (`planFilters`). Chipy mają widoczny scrollbar (`overflow-x-auto`, bez klasy `chip-scroll` z systemu projektowego).
- Grupy tygodniowe (poniedziałek-niedziela): numer grupy "01" (`idx + 1` w przefiltrowanej liście, nie numer tygodnia kalendarzowego), zakres dat, liczba treningów i tonaż tygodnia.
- Karty treningów: skrót dnia + data, etykieta (`planLabel`, nazwa planu lub tytuł), meta: czas · liczba serii · "tydz. N", tonaż, szewron. Rozwinięcie: ćwiczenia z tonażem i pastylkami serii (ciężar×powtórzenia, złoto = PR), przycisk "Popraw" z terminem.

### 2.2 Architektura i przepływ danych (kod)
| Element | Plik | Uwagi |
|---|---|---|
| Strona (RSC) | `app/(dashboard)/workout-history/page.tsx` | `auth()`, przekierowanie na `/login`, wywołanie `getWorkoutHistoryOverview(userId)`, render `WorkoutHistoryView` |
| Agregacja | `lib/workout-history-overview.ts` | zapytanie `workouts` sortowane malejąco po dacie, **`.limit(400)`** (linia 357), parsowanie JSON każdej sesji, KPI, karty, `planFilters` |
| Szczegóły sesji | `lib/workout-history.ts` (`computeWorkoutDetails`, `estimated1RM`) | e1RM Epley; PR = przebicie wcześniejszego bestu o > 0,25 kg (linia ~479) |
| Klucz dnia planu | `lib/workout-plan-compare-key.ts` | `name:<nazwa planu znormalizowana>`, fallback: tytuł, id planu. Grupowanie po **nazwie** planu |
| Widok klienta | `components/workout-history/workout-history-view.tsx` (~490 linii) | w jednym pliku: `SetPill`, `SessionRow` (z własnym `AlertDialog`), `WorkoutHistoryView`, `groupByWeek`, `mondayOfWeek` |
| Usuwanie | `actions/workout-history.ts` (`deleteCompletedWorkout`) | po sukcesie: lokalny `removedIds` + `router.refresh()` |
| Edycja | `app/(dashboard)/workout-history/[id]/edit/page.tsx` | link "Popraw" tylko gdy `canEditWorkout` (7 dni od zakończenia, `WORKOUT_EDIT_WINDOW_MS`) |
| Szczegół | `app/(dashboard)/workout-history/[id]/page.tsx` | istnieje, ale lista nie linkuje do niego; linkuje tylko Pulpit |
| Pulpit | `components/home/home-recent-workouts.tsx` | 4 ostatnie treningi (`workouts.slice(0, 4)`), wiersze do `/workout-history/[id]` (szczegół), stopka do `/workout-history`; dane z `RecentWorkoutItem` (`lib/treningi-hub-stats`) |
| Rewalidacja | `app/api/workouts/complete/route.ts`, `app/api/workouts/[workoutId]/cardio/route.ts` | `revalidatePath("/workout-history")` po zapisie |

### 2.3 Dane liczone na serwerze, a niewyświetlane w widoku
Widok używa z `kpis` tylko: `avgWorkoutsPerWeekLast8`, `avgDurationMinutes`, `tonnageTotalKg`, `workoutsTotal`. Poza tym serwer zwraca, ale widok nie renderuje:
- `KPI`: `workoutsThisWeek`, `tonnageThisWeekKg`, `workoutsLast30`, `tonnageLast30Kg`, `cardioMinutesLast30`, `planDaysActive`, `planDaysTotal`, `lastWorkoutDate`.
- Karta: `volumeDeltaKg`, `volumeDeltaPercent`, `compare` (w górę / w dół / pominięte), `noComparison`, `firstOfDay`, `prevDate`, `exerciseCount`, `setsTotal`, `cardioMinutes`.
- `planFilters[].count` (liczba sesji na filtr).
- `cardio` (lista wpisów cardio, do 30) - cała tablica nieużywana w historii.

To jest zarówno sygnał do uproszczenia payloadu, jak i możliwość: porównanie z poprzednią sesją tego samego dnia jest już policzone.

### 2.4 Znaczenie etykiet na zrzucie (ustalone z kodu)
- **"tydz. N"** = `planOccurrence`: N-ta sesja tego dnia planu w całej historii (liczona chronologicznie po wszystkich sesjach), a nie numer tygodnia. Użytkownik odczytuje to jako numer tygodnia - mylące.
- **"01" przy tygodniu** = pozycja grupy w przefiltrowanej liście (najnowszy tydzień = 01). Zmienia się po filtrze, nie jest numerem tygodnia.
- **Chipy** = nazwy planów wpisane przez użytkownika ("Push", "Nogi", "Barki + Plecy"), nie kategorie partii. Filtr działa po kluczu `planCompareKey` (nazwa znormalizowana).
- **Statystyki** są globalne i **nie reagują na filtr** (widok bierze `kpis` bez przefiltrowania).
- **Tonaż "łącznie" i "Średni czas"** obejmują tylko 400 ostatnich sesji (limit zapytania). Czas trwania liczony od startu do końca, z pauzami (znany rozjazd D-05 w `docs/bledy-do-naprawy/bledy.md`).

---

## 3. Analiza obecnego ekranu

### 3.1 Architektura i dane (dla `architekt` do potwierdzenia)
1. **Plik-bóg widoku**: `workout-history-view.tsx` (~490 linii) łączy filtr, KPI, grupowanie, kartę, serie i dialog usuwania. Trudne testy i zmiany.
2. **Logika zduplikowana**: `mondayOfWeek` jest identyczna w widoku i w `lib/workout-history-overview.ts`; odmiana "serie/serii/seria" powtórzona w `home-recent-workouts.tsx` (obok `formatSetsLabel` w lib).
3. **Pełny payload**: wszystkie (do 400) sesje z pełnymi seriami trafiają do klienta przy każdym wejściu. Rośnie liniowo z historią; brak paginacji i brak ładowania szczegółów na żądanie.
4. **Limit 400 bez informacji**: starsze sesje znikają z KPI "łącznie" i z tonażu bez komunikatu. Przy ok. 4 treningach/tydz. limit osiągnięty po ok. 2 latach (do oceny skala realnych użytkowników).
5. **Stan filtra w pamięci komponentu**: brak parametru w URL, brak deep linku, filtr resetuje się po nawigacji. Link z Pulpitu nie wskazuje konkretnej sesji.
6. **Usuwanie przez lokalny `removedIds`** duplikuje stan serwera; licznik nagłówka liczony z `workoutsTotal - removedIds.size` (ryzyko rozjazdu po ponownym renderze).
7. **Dwie ścieżki do tych samych danych**: Pulpit (typ `RecentWorkoutItem` z `lib/treningi-hub-stats`) i historia (`getWorkoutHistoryOverview`) pobierają i liczą dane osobno; spójność czasu trwania i tonażu między nimi nie jest gwarantowana (do weryfikacji przez `architekt`).
8. **Grupowanie po nazwie planu**: zmiana nazwy planu rozdziela historię (nowa grupa w `planCompareKey`), co wpływa też na porównania. Zjawisko istniejące; do oceny przez `architekt`.

### 3.2 UX (dla `ux` do potwierdzenia)
1. **Hierarchia**: cztery poziomy nagłówków i liczb (kicker, KPI, chipy, tydzień, karta) o podobnej wadze wizualnej. Liczby konkurują ze sobą (numer tygodnia złotym serif, tonaż w karcie, tonaż tygodnia, KPI tonażu).
2. **Mylące liczby**: "01" i "tydz. N" nie znaczą tego, co sugerują (zob. 2.4). Użytkownik może źle odczytać postęp.
3. **Filtr**:
   - statystyki nie zmieniają się po wyborze dnia (użytkownik oczekuje "statystyki dla Push");
   - scrollbar widoczny pod chipami (odstępstwo od `.chip-scroll`);
   - chipy ok. 32 px wysokości (`py-1.5 text-[12px]`), poniżej 44 px z systemu;
   - brak licznika sesji w chipie (dane `count` są w payloadzie, nieużyte);
   - brak stanu "Brak treningów dla tego dnia planu" (przy filtrze bez wyników lista po prostu pusta nie pokazuje sensownego komunikatu).
4. **Rozwinięcie karty**: przycisk-wiersz nie ma `aria-expanded`; brak wyraźnej affordancji ("pokaż serie"), tylko szewron.
5. **Kolor jako jedyny nośnik**: pastylka PR jest złota, znaczenie tylko w `title` (tooltip niewidoczny na telefonie). Brak legendy.
6. **Porównanie z poprzednią sesją** (największa luka informacyjna): dane `volumeDeltaKg` i `compare` są gotowe, a użytkownik nie widzi, czy idzie w górę.
7. **Usuwanie**: jedyna ścieżka to przytrzymanie wiersza (520 ms) lub menu kontekstowe - brak widocznej akcji, brak dostępności klawiaturą i dla czytnika ekranu. Ryzyko przypadkowej utraty wpisu jest ograniczone potwierdzeniem, ale odkrywalność jest zerowa.
8. **Edycja**: "Popraw" i termin ("do …") są dobrze opisane, ale przy zakończonym oknie edycji nie ma wyjaśnienia, dlaczego przycisku brak.
9. **Pusty stan**: tekst ogólny ("ukończ pierwszą sesję"), bez CTA do Treningów.
10. **Wróć**: zawsze do hubu Treningi, także gdy użytkownik przyszedł z Pulpitu.
11. **Spójność z Pulpitem**: Pulpit pokazuje "dziś/wczoraj", historia - tylko daty; wiersz z Pulpitu prowadzi do szczegółu, a nie do listy; tytuł wiersza z Pulpitu to `title`, a w historii `planLabel`.
12. **Kontrast**: etykiety KPI `text-white/40` i meta `text-white/35-40` przy `text-[10px]-[11px]` - poniżej celu WCAG AA (system projektowy, pkt 7).
13. **Mobile**: szerokość `max-w-lg` (odstępstwo od `APP_SHELL_MAX`), nagłówek własny zamiast `AppPageHeader`.

### 3.3 Co już działa dobrze (zachować)
- Grupowanie tygodniowe z zakresem dat i tonażem tygodnia - czytelny szkielet.
- Rozwinięcie w miejscu (bez nawigacji) i pełne serie z ciężarami.
- Jawny termin edycji ("do …") i potwierdzenie usuwania z opisem skutków.
- Liczba KPI "Na tydzień" z "ost. 8 tyg." (jasne okno czasowe).
- Komunikaty zapisu przez `useSaveFeedback`.

---

## 4. Interesariusze

| Rola | Cel na tym ekranie |
|---|---|
| Osoba ćwicząca (początkująca) | Szybko sprawdzić, co zrobiła ostatnio i ile; zrozumieć, czy idzie w górę |
| Osoba ćwicząca (zaawansowana) | Porównać sesje tego samego dnia planu, znaleźć PR, sprawdzić tonaż w czasie |
| Osoba korygująca wpis | Poprawić serię w oknie 7 dni, usunąć błędny trening bez przypadkowego kliknięcia |
| Użytkownik z Pulpitu | Przejść z "Ostatnich treningów" do właściwego wpisu |
| Właściciel produktu | Spójność z Pulpitem i resztą aplikacji; mniej dziwnych liczb |

Role poza zakresem: administrator (brak wpływu), społeczność (brak wpływu; feed publikuje po zakończeniu treningu, nie z tego ekranu).

---

## 5. Zakres

### 5.1 Wchodzi (redesign)
- Układ ekranu: nagłówek, statystyki, filtr, lista tygodni, karta treningu, rozwinięcie ćwiczeń i serii.
- Opisy i etykiety liczb (numer tygodnia / nr sesji dnia, znaczenie PR, delta vs poprzednia sesja).
- Filtr: wygląd, dostępność, stan pustego wyniku, zachowanie stanu (URL lub pamięć - decyzja `architekt`).
- Statystyki w zależności od filtra (decyzja Q2).
- Akcje sesji: "Popraw" i "Usuń" - widoczne, dostępne klawiaturą, z zachowaniem potwierdzenia.
- Pusty stan i stan "brak wyników filtra".
- Wejście z Pulpitu: deep link do sesji lub filtra (zachowanie do decyzji `ux`/`architekt`).
- Spójność nagłówka i kart z systemem projektowym (`AppPageHeader`, `app-card`, `SectionLabel`, `chp`).

### 5.2 Nie wchodzi (zostaje bez zmian)
- Zapis i logika zakończenia treningu (`/api/workouts/complete`, `lib/workout-complete-submit.ts`).
- Definicje e1RM, PR, tonażu, czasu trwania (`lib/workout-history.ts`) - bez zmiany wyników; ewentualne ujednolicenie czasu (D-05) to osobna decyzja.
- Edycja sesji (`[id]/edit`) - bez zmian formularza; zmienia się tylko wejście z listy.
- Szczegół sesji `[id]` - zostaje jako strona; ewentualne przeprojektowanie w osobnym zadaniu, chyba że `ux` uzna, że lista ma go zastąpić.
- Lista cardio w historii (`overview.cardio`) - poza zakresem v1 (założenie Q5).
- Kontrakty `/api/android/*` i Java backend - bez zmian (sprawdzić: ekran jest ścieżką WWW, WebView).
- Hub Treningi, Pulpit (poza sekcją "Ostatnie treningi" i linkiem do historii).

---

## 6. Założenia

- **Z1** Trasa zostaje `/workout-history`; nowa trasa tylko, jeśli `architekt` uzasadni (bez przekierowań nie ma zmiany).
- **Z2** Plan = dzień (model bez zmian, jak w zadaniu 008 Q3): w UI nie pokazujemy "tygodnia programu", bo takiej encji nie ma.
- **Z3** Dane wejściowe pozostają: zakończone sesje siłowe, sortowane po dacie lokalnej zapisanej przy zakończeniu.
- **Z4** Brak nowej zmiennej środowiskowej; brak nowych zewnętrznych usług.
- **Z5** Edycja w oknie 7 dni od zakończenia (lub końca dnia, gdy brak `endedAt`) - bez zmiany reguły.
- **Z6** Dane zdrowotne: na ekranie są ciężary, powtórzenia i czas; tętno z cardio nie jest tu pokazywane (jeśli to się zmieni, patrz 8, bramka prawnik).

---

## 7. User stories i kryteria akceptacji

Format: "Jako <rola> chcę <cel>, aby <korzyść>". Given/When/Then. Priorytet MoSCoW.

### US-1 Czytelna hierarchia tydzień → trening → ćwiczenie (Must)
Jako osoba ćwicząca chcę zobaczyć swoje treningi pogrupowane w tygodnie, aby szybko znaleźć sesję i ocenić tydzień.

- AC-1.1: Given historia z sesjami w 3 tygodniach, When ekran otwarty, Then każdy tydzień ma nagłówek z zakresem dat, liczbą treningów i tonażem, a najnowszy jest na górze.
- AC-1.2: Given tydzień, When pokazany, Then numeracja (jeśli zostaje) pochodzi z realnego kryterium zdefiniowanego w Q1, a nie z pozycji w filtrowanej liście.
- AC-1.3 (brzeg - tydzień bez sesji): Given brak treningów w danym tygodniu kalendarzowym, When lista, Then tydzień nie jest pokazywany jako pusta grupa (założenie: pomijamy).
- AC-1.4 (brzeg - przejście przez granicę tygodnia): Given sesja o 23:50 w niedzielę, When lista, Then trafia do tygodnia zgodnego z datą lokalną zapisaną w sesji.

### US-2 Statystyki zgodne z wybranym filtrem (Must, zależne od Q2)
Jako osoba ćwicząca chcę widzieć statystyki dla wybranego dnia planu, aby ocenić postęp konkretnego dnia.

- AC-2.1: Given filtr "Wszystkie", When ekran, Then statystyki dotyczą całej historii (z opisem zakresu).
- AC-2.2: Given wybrany dzień planu "Push", When ekran, Then statystyki (liczba, średni czas, tonaż) dotyczą tylko sesji "Push" i mają etykietę zakresu.
- AC-2.3 (brzeg - brak danych dla filtra): Given wybrany dzień bez sesji, When ekran, Then statystyki pokazują "—", a nie zero.
- AC-2.4 (brzeg - limit historii): Given więcej niż 400 sesji, When ekran, Then etykieta "łącznie" nie twierdzi o całości, dopóki limit nie zostanie usunięty (Q3).

### US-3 Szybki i dostępny filtr dnia planu (Must)
Jako osoba ćwicząca chcę jednym dotknięciem wybrać dzień planu, aby szybko zobaczyć jego historię.

- AC-3.1: Given pasek filtrów, When na telefonie, Then każdy chip ma obszar dotyku min. 44 px i nie pokazuje widocznego paska przewijania.
- AC-3.2: Given chip, When pokazany, Then zawiera liczbę sesji (dane `planFilters.count`).
- AC-3.3: Given wybrany filtr, When wracam na ekran (nawigacja wstecz), Then wybór jest zachowany (URL lub pamięć, decyzja `architekt`).
- AC-3.4 (brzeg - jeden plan): Given tylko jeden dzień planu, When ekran, Then filtr nadal pokazuje "Wszystkie" i nazwę dnia, bez błędu.
- AC-3.5 (brzeg - zmiana nazwy planu): Given użytkownik zmienił nazwę planu, When ekran, Then historia dalej pokazuje sesje w jednej grupie albo wyraźnie oznaczony nowy filtr (decyzja `architekt`, ryzyko w 3.1 pkt 8).

### US-4 Jednoznaczna numeracja sesji (Must)
Jako osoba ćwicząca chcę rozumieć znaczenie numerów przy sesji, aby nie mylić ich z tygodniem.

- AC-4.1: Given karta sesji, When pokazana, Then etykieta nie zawiera słowa "tydz." dla numeru, który nim nie jest (Q1).
- AC-4.2: Given "nr sesji dnia" (jeśli zostaje), When pokazany, Then numer odnosi się do całej historii tego dnia planu, a nie do tygodnia.

### US-5 Porównanie z poprzednią sesją (Should)
Jako osoba ćwicząca chcę widzieć, czy sesja jest lepsza od poprzedniej tego samego dnia, aby ocenić progres.

- AC-5.1: Given sesja z poprzednią sesją tego dnia planu, When rozwinięta, Then pokazana jest zmiana tonażu (kg i %) oraz liczba ćwiczeń w górę / w dół (dane `volumeDeltaKg`, `compare`).
- AC-5.2: Given pierwsza sesja dnia planu, When rozwinięta, Then tekst "Pierwszy trening tego dnia - brak porównania" (bez wartości 0).
- AC-5.3 (brzeg - ćwiczenia bodyweight): Given ćwiczenie bez ciężaru, When liczone porównanie, Then nie jest liczone jako spadek (zachowanie z N-22-1, zadanie 005).

### US-6 Czytelne rekordy (PR) (Must)
Jako osoba ćwicząca chcę wiedzieć, które serie są rekordami, bez zgadywania po kolorze.

- AC-6.1: Given seria będąca rekordem, When pokazana, Then ma oznaczenie tekstowe lub ikonę (nie tylko złoty kolor), a legenda jest dostępna na ekranie.
- AC-6.2: Given czytnik ekranu, When przegląda serię rekordu, Then ogłaszany jest tekst "rekord".
- AC-6.3 (brzeg - brak rekordów): Given sesja bez rekordów, When rozwinięta, Then nie ma pustej legendy ani pustego znacznika.

### US-7 Widoczne i bezpieczne usuwanie treningu (Must)
Jako osoba ćwicząca chcę usunąć błędnie zapisany trening, aby historia była prawdziwa, bez ryzyka przypadkowego kasowania.

- AC-7.1: Given rozwinięta sesja, When pokazana, Then jest widoczna akcja "Usuń trening" (np. w menu sesji), dostępna klawiaturą i czytnikiem ekranu.
- AC-7.2: Given akcja "Usuń", When kliknięta, Then pojawia się potwierdzenie z nazwą treningu i opisem skutków (jak dziś).
- AC-7.3: Given przytrzymanie wiersza (obecne skróty), When użyte, Then nadal działa jako skrót, ale nie jest jedyną drogą.
- AC-7.4 (brzeg - dwa urządzenia): Given trening usunięty na innym urządzeniu, When na tym urządzeniu wykonam "Usuń", Then komunikat "Ten trening już nie istnieje" i odświeżenie listy, bez błędu technicznego.
- AC-7.5 (brzeg - błąd sieci): Given brak sieci, When potwierdzam usunięcie, Then komunikat błędu, a wpis zostaje na liście (bez fałszywego zniknięcia).

### US-8 Edycja w oknie czasowym (Must, bez zmiany reguł)
Jako osoba ćwicząca chcę poprawić liczby w niedawnym treningu, aby historia była dokładna.

- AC-8.1: Given sesja zakończona mniej niż 7 dni temu, When rozwinięta, Then "Popraw" prowadzi do edycji i pokazuje termin ("do …").
- AC-8.2: Given sesja starsza niż okno edycji, When rozwinięta, Then nie ma przycisku "Popraw", a jest krótka informacja "Edycja niedostępna po 7 dniach".
- AC-8.3 (brzeg - zmiana strefy czasowej): Given sesja zakończona przed zmianą strefy, When liczony termin, Then termin zgadza się z zapisanym czasem zakończenia (bez przesunięcia o dzień).

### US-9 Pusty stan i stan bez wyników (Must)
Jako nowy użytkownik chcę wiedzieć, co zrobić, gdy nie mam treningów.

- AC-9.1: Given brak zakończonych treningów (pierwsze użycie), When ekran, Then widzę tekst i przycisk do hubu Treningi (start pierwszej sesji).
- AC-9.2: Given filtr bez wyników (np. po usunięciu wszystkich sesji dnia), When ekran, Then komunikat "Brak treningów dla tego dnia planu" i przycisk "Pokaż wszystkie".
- AC-9.3 (brzeg - trening przerwany w połowie): Given sesja przerwana, niezakończona, When otwieram historię, Then nie pojawia się na liście (jak dziś).

### US-10 Wejście z Pulpitu i spójność (Should)
Jako osoba ćwicząca chcę, aby "Ostatnie treningi" na Pulpicie prowadziły do tego samego wpisu w historii, aby nie gubić kontekstu.

- AC-10.1: Given wiersz na Pulpicie, When kliknięty, Then otwiera się historia z rozwiniętą właściwą sesją (lub szczegółem, decyzja `ux`), a nie ogólna lista.
- AC-10.2: Given Pulpit i historia, When pokazują ten sam trening, Then tonaż i czas są zgodne (ta sama definicja danych).
- AC-10.3: Given Pulpit, When pokazuje datę, Then używa tej samej etykiety względnej ("dziś", "wczoraj") co historia albo świadomie innej, opisanej w makiecie.

### US-11 Nawigacja wstecz (Should)
Jako osoba ćwicząca chcę wrócić tam, skąd przyszłam, aby nie gubić kontekstu.

- AC-11.1: Given wejście z Pulpitu, When kliknięte "Wróć", Then wracam na Pulpit.
- AC-11.2: Given wejście z hubu Treningi, When kliknięte "Wróć", Then wracam do hubu Treningi.
- AC-11.3 (brzeg - bezpośrednie wejście/odświeżenie): Given otwarty bezpośrednio adres, When "Wróć", Then trafiam na Treningi (domyślnie).

### US-12 Wydajność listy (Should, `architekt` + `tester-wydajnosci` w implementacji)
Jako osoba ćwicząca z długą historią chcę, aby lista otwierała się szybko, aby nie czekać.

- AC-12.1: Given 400 sesji, When ekran otwarty na telefonie 4G, Then pierwsza zawartość widoczna w < 2 s (SLO do potwierdzenia przez `tester-wydajnosci`).
- AC-12.2: Given lista długa, When przewijam, Then przewijanie jest płynne, a szczegóły serii nie są ładowane dla wszystkich kart naraz (paginacja, ładowanie przy rozwinięciu - decyzja `architekt`).
- AC-12.3: Given więcej niż 400 sesji, When ekran, Then lista dociera do wszystkich sesji (dopóki nie ma paginacji, komunikat o limicie).

### US-13 Dostępność i mobilność (Must)
Jako osoba ćwicząca z telefonem w ręku chcę obsługiwać ekran jedną ręką i czytnikiem.

- AC-13.1: Given wiersz sesji, When rozwinięty, Then przycisk ma `aria-expanded` i etykietę z nazwą treningu.
- AC-13.2: Given kontrast, When etykiety i meta na ciemnym tle, Then spełniają WCAG AA (paleta do potwierdzenia przez `ux`).
- AC-13.3: Given dół ekranu, When ostatnia karta, Then nie zasłania jej dolna belka nawigacji (margines).
- AC-13.4: Given karta sesji, When pokazana, Then wszystkie kluczowe akcje (Popraw, Usuń) mają obszar dotyku min. 44 px.

### US-14 Brak sieci i błędy (Should)
Jako osoba ćwicząca na siłowni chcę wiedzieć, co działa bez sieci, aby nie tracić wpisów.

- AC-14.1: Given brak sieci przy wejściu, When ekran, Then komunikat "Brak połączenia - historia pojawi się, gdy wrócisz online" (bez białego ekranu).
- AC-14.2: Given utrata sieci po załadowaniu, When próbuję usunąć lub edytować, Then komunikat przy akcji i brak fałszywego sukcesu.

---

## 8. Reguły biznesowe

- **BR-1** Historia zawiera tylko zakończone sesje siłowe; sesja przerwana nie pojawia się (bez zmiany).
- **BR-2** Grupowanie tygodniowe: tydzień = poniedziałek-niedziela, wg daty lokalnej zapisanej w sesji.
- **BR-3** "Dzień planu" = klucz `planCompareKey` (znormalizowana nazwa planu, fallback tytuł, id). Porównania i filtr działają tylko w obrębie jednego dnia planu.
- **BR-4** Edycja i usunięcie: edycja w oknie 7 dni od zakończenia; usunięcie zawsze z potwierdzeniem; usunięcie nie zmienia planu.
- **BR-5** Numer sesji dnia planu (dziś "tydz. N") jest liczony po całej historii, nie po tygodniu - do zmiany etykiety (Q1), nie wyniku.
- **BR-6** Rekord (PR) = seria, której e1RM przebija wcześniejszy best ćwiczenia o więcej niż 0,25 kg; pierwszy wpis ćwiczenia nie jest rekordem.
- **BR-7** Porównanie z poprzednią sesją: tylko w obrębie tego samego dnia planu; pierwsza sesja nie ma porównania; ćwiczenia bodyweight nie są liczone jako spadek (N-22-1).
- **BR-8** Statystyki: "Na tydzień" = sesje z ostatnich 8 tygodni kalendarzowych / 8; "Średni czas" = średnia z sesji z czasem; "Tonaż" = suma tonażu sesji w zakresie (do decyzji Q3).
- **BR-9** Dane historii nie są współdzielone z ekranem cardio w tym zadaniu.

---

## 9. Wymagania niefunkcjonalne i prywatność

- **Prywatność**: ekran pokazuje ciężary, powtórzenia i czas - dane treningowe już wyświetlane. Nie dodajemy nowych pól zdrowotnych (tętno, kroki, sylwetka) bez ponownej oceny `prawnik`. Nie logujemy nazw planów i notatek w Sentry/logach.
- **Bezpieczeństwo**: wszystkie zapytania i akcje pod `userId` z sesji (bez zmian); usuwanie i edycja bez zmiany kontraktu; CSRF i potwierdzenia jak dziś.
- **Wydajność**: 400 sesji z pełnymi seriami w jednym payloadzie to obecne ryzyko (3.1 pkt 3-4). Cel do ustalenia przez `tester-wydajnosci` (US-12).
- **Telefon w trakcie treningu**: ekran dostępny z hubu w max 2 dotknięciach; cele dotyku 44 px; tryb pionowy.
- **Offline / PWA**: lista ładowana z serwera; brak offline cache w v1 (założenie, AC-14).
- **Dostępność**: WCAG AA; `aria-expanded`; kolor nie jest jedynym nośnikiem (PR, delta).
- **Koszty**: brak nowych usług; zapytania Turso bez zmiany częstotliwości; paginacja może zmniejszyć transfer (koszt Turso przy odczytach do rozważenia przez `architekt`).
- **Android**: ekran jest ścieżką WWW w WebView; brak zmian w `/api/android/*`.
- **Java backend**: historia nie jest obsługiwana w Javie (wg mapy produktu); bez zmian.
- **Zmienne środowiskowe**: brak nowych; jeśli `architekt` doda usługę, wpis w `lib/admin-config-status.ts` i `env.example`.

---

## 10. Priorytety MoSCoW

| Pozycja | Priorytet | Uzasadnienie |
|---|---|---|
| US-1 Hierarchia tydzień → trening | Must | Główny cel redesignu |
| US-2 Statystyki zgodne z filtrem | Must | Obecna luka; zależy od Q2 |
| US-3 Filtr dnia (dotyk, licznik, stan) | Must | Wymaganie użytkownika (szybsze filtrowanie) |
| US-4 Jednoznaczna numeracja | Must | Błędna interpretacja na zrzucie |
| US-6 Czytelne rekordy | Must | Kolor jako jedyny nośnik (WCAG) |
| US-7 Widoczne usuwanie | Must | Brak odkrywalności i dostępu klawiaturą |
| US-8 Edycja w oknie | Must | Bez zmiany reguł; komunikat o braku przycisku |
| US-9 Pusty stan | Must | Pierwsze użycie |
| US-13 Dostępność i mobile | Must | Wymaganie przepływu treningowego |
| US-5 Porównanie z poprzednią sesją | Should | Dane gotowe; duża wartość dla progresu |
| US-10 Spójność z Pulpitem | Should | Zmniejsza dezorientację |
| US-11 Nawigacja wstecz | Should | Drobne, ale częste |
| US-12 Wydajność / paginacja | Should | Ryzyko rośnie z historią; decyzja `architekt` |
| US-14 Brak sieci i błędy | Should | Siłownia bez zasięgu |
| Lista cardio w historii | Won't (v1) | Poza zakresem, osobny ekran cardio |
| Eksport historii (CSV/PDF) | Won't (v1) | Nowa funkcja |
| Wykres tonażu w czasie | Could (poza v1) | Analiza postępów ma osobny ekran (`/progress`) |

---

## 11. Zależności

- US-2 zależy od Q2 i od decyzji o zakresie KPI (Q3).
- US-3 (URL filtra) zależy od decyzji `architekt` o routingu (`searchParams` vs stan lokalny).
- US-5 korzysta z danych już liczonych w `lib/workout-history-overview.ts`; wymaga tylko decyzji `ux` o prezentacji.
- US-10 zależy od wspólnej definicji danych z Pulpitem (`treningi-hub-stats` vs `workout-history-overview`).
- US-12 zależy od decyzji `architekt` o paginacji i o limicie 400.
- Wpływ na Treningi (hub) i Pulpit: niski (tylko linki i ewentualnie wspólne helpery formatowania).

---

## 12. Pytania otwarte do użytkownika

Maksymalnie 5. Przy każdym przyjęte założenie, jeśli brak odpowiedzi.

1. **Q1 - Numer przy sesji**: obecna etykieta "tydz. N" oznacza numer sesji danego dnia planu w całej historii, a nie tydzień. Czy zostawić numer sesji dnia (np. "Push · sesja 12"), czy usunąć numer? **Założenie**: zostaje jako "sesja N" dnia planu; numeru tygodnia programu nie wprowadzamy (plan = dzień, zob. zadanie 008 Q3).
2. **Q2 - Statystyki a filtr**: czy po wybraniu dnia planu KPI (na tydzień, średni czas, tonaż) mają się przeliczać? **Założenie**: tak, z etykietą zakresu; "Wszystkie" = cała historia.
3. **Q3 - Limit 400 sesji**: czy "tonaż łącznie" i "średni czas" mają obejmować całą historię? Obecnie to 400 ostatnich sesji bez komunikatu. **Założenie**: tak; wymaga agregacji po stronie serwera i/lub paginacji (decyzja `architekt`), bez zmiany wyników dla obecnych użytkowników.
4. **Q4 - Porównanie z poprzednią sesją**: dane są liczone, ale nie są pokazywane. Czy użytkownik ma je widzieć w rozwinięciu karty (zmiana tonażu, liczba ćwiczeń w górę/w dół)? **Założenie**: tak, jako jedna linia w rozwinięciu, bez osobnego ekranu.
5. **Q5 - Cardio w historii**: czy wpisy cardio (dziś w Pulpicie i na ekranie cardio) mają pojawiać się także tutaj? **Założenie**: nie w v1; ekran pokazuje tylko sesje siłowe, a minuty cardio mogą pojawić się jako informacja w karcie (do decyzji `ux`).

Dodatkowe założenia (bez osobnego pytania):
- Usunięcie zostaje w menu rozwinięcia, a przytrzymanie wiersza zostaje jako skrót.
- Stare adresy nie są zmieniane (brak przekierowań); jeśli `architekt` zmieni trasę, dodamy przekierowanie.
- Teksty i etykiety są po polsku, zgodnie z mikrokopią z `docs/ux/00-system-projektowy-stan.md`.

---

## 13. Decyzja o bramkach przepływu

| Bramka | Decyzja | Uzasadnienie |
|---|---|---|
| `analityk` (etap 1) | TAK - wykonane | Ten dokument |
| `prawnik` (etap 2) | NIE | Ekran pokazuje już istniejące dane treningowe (ciężary, powtórzenia, czas); redesign nie dodaje przetwarzania danych zdrowotnych, zgód ani treści prawnych. Wrócić do `prawnik`, jeśli w projekcie pojawi się tętno, cardio z danymi zdrowotnymi lub eksport historii (zob. `docs/bledy-do-naprawy/bledy.md`, Q-P2). |
| `architekt` (etap 3) | TAK | Podział widoku (plik-bóg), paginacja/limit 400, routing filtra, źródło KPI i spójność z Pulpitem, usuwanie i API, ewentualny ADR `docs/adr/0010-redesign-historii-treningow.md`. |
| `ux` (etap 4) | TAK | Redesign ekranu od zera (nowy układ, filtr, rozwinięcie, akcje, pusty stan), makieta HTML w `docs/ux/`. Zmiana wizualna i hierarchii. |
| `backend` / `frontend` (etap 5) | NIE na tym etapie | Brak zmian kodu (polecenie użytkownika). |
| `tester` (etap 6) | NIE na tym etapie | Brak implementacji. W implementacji: testy funkcji filtra, statystyk per filtr, numeracji, usuwania i edycji w oknie. |
| `tester-bezpieczenstwa` (etap 7) | NIE na tym etapie; **TAK warunkowo w implementacji** | Gdy zmieni się API usuwania/edycji lub stan filtra trafi do URL (parametry wejściowe). |
| `tester-wydajnosci` (etap 7) | NIE na tym etapie; **prawdopodobnie TAK w implementacji** | Zmiana limitu 400, paginacja, ładowanie szczegółów serii i payload - wpływ na obciążenie. |

---

## 14. Kryteria akceptacji etapu projektowego

### 14.1 Raport `architekt` (`docs/adr/0010-redesign-historii-treningow.md`) musi zawierać
- Ocenę obecnej struktury: podział `workout-history-view.tsx`, lokalizacja `groupByWeek`/`mondayOfWeek` (duplikat), miejsce formatowania liczby serii.
- Ocenę danych: payload (400 sesji z seriami), limit i KPI "łącznie", pola liczone i nieużywane (sekcja 2.3), ryzyko z klucza `planCompareKey` po nazwie.
- Decyzję o routingu filtra (URL vs stan lokalny) i wpływie na nawigację wstecz.
- Decyzję o źródle statystyk per filtr (klient vs serwer) i o agregacji "łącznie" poza limitem 400.
- Decyzję o paginacji lub ładowaniu szczegółów serii oraz SLO do potwierdzenia przez `tester-wydajnosci`.
- Ujednolicenie definicji danych z Pulpitem (`lib/treningi-hub-stats` vs `lib/workout-history-overview`) - jedna definicja tonażu, czasu i daty.
- Potwierdzenie, że trasa `/workout-history` zostaje, albo uzasadnienie zmiany.
- Ocenę wpływu na Android (WebView) i Java backend (brak zmiany).
- Listę zmian w kontrakcie (jeśli są), z informacją, że implementacja będzie w osobnym kroku.

### 14.2 Raport `ux` (`docs/ux/011-redesign-historii-treningow.md`) + makieta `docs/ux/011-redesign-historii-treningow-makieta.html` muszą zawierać
- Ocenę UX obecnego ekranu (sekcja 3.2 jako punkt wyjścia), z klasyfikacją problemów na blokujące i do naprawy później.
- Makietę w stylu istniejących makiet (`docs/ux/008-redesign-planu-treningowego-makieta.html`): ramka 390 px, tokeny z `app/globals.css` (`--gym-black`, `--gym-gold`, `--gym-surface`, `--gym-border-gold`, `--gym-text-secondary`, `--gym-on-gold`), klasy `app-card`/`chp`/`btn` zgodne z systemem projektowym, lucide-ikony uproszczone.
- Stany: lista z wieloma tygodniami, filtr aktywny, filtr bez wyników, pusty stan, karta zwinięta, karta rozwinięta (PR z legendą, delta vs poprzednia), karta bez porównania (pierwsza sesja), potwierdzenie usunięcia, edycja dostępna/niedostępna, błąd sieci.
- Zasady hierarchii: jedna główna liczba na tydzień lub sesję, numeracja zgodna z Q1, legenda PR.
- Dostępność: `aria-expanded`, obszar dotyku 44 px, kontrast AA, tekst zamiast samego koloru.
- Mikrokopię po polsku (tytuły, etykiety, komunikaty stanów) zgodną ze spójnym słownikiem (sesja vs trening - jedna nazwa).
- Wejście z Pulpitu (rekomendacja: deep link do sesji lub rozwinięcia) i nawigacja "Wróć".
- Zgodność z systemem projektowym: nagłówek `AppPageHeader`, sekcje `SectionLabel`, kontener `app-card`, przyciski `Button`, potwierdzenie `ConfirmDialog`/`AlertDialog`.

---

## 15. Ryzyka

| Ryzyko | Wpływ | Prawdopodobieństwo | Działanie |
|---|---|---|---|
| Użytkownik odczyta "tydz. N" jako tydzień i źle oceni progres | Średni | Wysokie | Q1, US-4 |
| Statystyki po filtrze przeliczane w kliencie rozjadą się z Pulpitem | Średni | Średnie | Wspólna definicja danych, AC-10.2 |
| Limit 400 cicho zaniża "łącznie" dla długo ćwiczących | Średni | Niskie (rośnie w czasie) | Q3, AC-2.4, AC-12.3, wpis w `docs/bledy-do-naprawy/bledy.md` |
| Paginacja zmieni zachowanie wyszukiwania/filtra po stronie klienta | Średni | Średnie | Decyzja `architekt`, testy filtra |
| Usunięcie przez menu zmienia lokalny stan `removedIds` i licznik nagłówka | Niski | Średnie | Rewalidacja listy po akcji, AC-7.4 |
| Zmiana nazwy planu rozdziela grupę w historii i filtrze | Średni | Średnie | Ocena `architekt` (3.1 pkt 8), AC-3.5 |
| PR jako kolor bez tekstu - nieczytelne dla części użytkowników | Średni | Wysokie | US-6, legenda |
| Dodanie tętna/cardio do karty (późniejszy pomysł) przesuwa ekran w dane zdrowotne | Wysoki | Niskie | Bramka `prawnik` przed takim zmianą (BR-9, sekcja 13) |
| Zmiana czasu trwania (D-05: z pauzami vs bez) zmienia liczby między Pulpitem a historią | Średni | Średnie | Osobna decyzja analityka; nie w tym zadaniu, widoczne w AC-10.2 |
| Dwa urządzenia: usunięcie na jednym, błąd na drugim | Niski | Niskie | AC-7.4 |

---

## 16. Następne kroki

1. Akceptacja użytkownika dla Q1-Q5 (lub przyjęcie założeń).
2. `architekt` (etap 3): ocena i ADR `docs/adr/0010-redesign-historii-treningow.md` wg sekcji 14.1.
3. `ux` (etap 4): raport `docs/ux/011-redesign-historii-treningow.md` i makieta HTML wg sekcji 14.2.
4. Po akceptacji makiet: implementacja w osobnym kroku (etap 5), z testami filtra, statystyk i usuwania.
5. Aktualizacja `docs/zespol/wiedza-o-projekcie.md`, jeśli zmieni się stan ekranu historii.
6. Wpis w `components/changelog/changelog-data.ts` z `planned: true` na PR.

---

Werdykt etapu 1: **ZATWIERDZONE** (analiza kompletna; pytania Q1-Q5 otwarte z założeniami).
