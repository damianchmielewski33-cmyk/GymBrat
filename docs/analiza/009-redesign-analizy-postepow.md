# 009 - Redesign modułu Analiza postępów (analiza wymagań)

- **Karta zadania**: `docs/zadania/009-redesign-analizy-postepow.md`
- **Etap**: 1 - Wymagania (analityk). Zero zmian w kodzie produkcyjnym.
- **Autor**: analityk (agent zespołu GymBrat)
- **Data**: 2026-10-26
- **Status**: do akceptacji użytkownika; wejście dla `architekt` (etap 3), `ux` (etap 4) i weryfikacji mapowania opisanej w sekcji 10
- **Źródła**: zrzuty ekranów z polecenia (opis w zleceniu, bez plików w repozytorium), kod `app/(dashboard)/progress/`, `components/progress/`, `lib/progress-hub.ts`, `lib/progress-tabs.ts`, `lib/analytics/`, `lib/intensity-analysis.ts`, `docs/analiza/008-redesign-planu-treningowego.md` (konwencja).

Uwaga o metodzie: dokument opiera się na czytaniu kodu i opisie zrzutów z polecenia. Nie widziałem pikseli ekranów. Mapowanie "co widać na zrzucie" do "który komponent to renderuje" jest oparte na tytułach sekcji i etykietach z kodu. Weryfikację wizualną robi `ux` (etap 4).

---

## 1. Kontekst i cel

Moduł "Analiza postępów" (`/progress`, tytuł "Analiza postępów") ma dziś 4 zakładki: **Przegląd**, **Siła**, **Sylwetka**, **Tygodnie**, oraz szczegół pojedynczego ćwiczenia (`/progress/exercises/[key]`). Dane liczy `lib/progress-hub.ts` (`getProgressHubData`), a silniki wskaźników siedzą w `lib/analytics/` (zmęczenie, regeneracja, balans mięśniowy, stagnacja, konsekwencja, adherencja, prognoza, velocity siły, cardio 2.0, coach insights).

Użytkownik zgłasza bałagan: wiele nakładających się kart, powtórzone treści, niespójną hierarchię. Na zrzutach widać, że ta sama informacja pojawia się w 2-3 miejscach, a ekran nie mówi, co jest najważniejsze.

Cel zlecenia (zakres tego etapu):
1. Zebrać wymagania biznesowe i zakres redesignu (ten dokument).
2. Ocenić, które metryki są potrzebne, które zbędne i które się dublują.
3. Zdefiniować kryteria "łatwej biznesowo" analizy (czytelność, priorytety, brak przeładowania).
4. Ustalić decyzję o bramkach zespołu (sekcja 12).
5. Zebrać wątpliwości mapowania i wyliczeń do weryfikacji (sekcja 10). Nie naprawiać ich w tym zadaniu.

Poza zakresem tego etapu: architektura, wygląd, implementacja. Te rzeczy przechodzą do `architekt` i `ux`.

---

## 2. Zakres

### 2.1 Wchodzi
- Nowa struktura informacji modułu (zakładki, sekcje, kolejność, hierarchia).
- Konsolidacja duplikatów (sekcja 4).
- Nowe wyliczenie wskaźników tam, gdzie obecne jest błędne lub niejednoznaczne (sekcja 10), wyłącznie jako wymaganie "poprawne i spójne", bez wymyślania nowych danych.
- Wspólne zasady prezentacji: okresy, progi "za mało danych", jednostki, etykiety, język.
- Szczegół ćwiczenia: zachowanie funkcji, uporządkowanie sekcji.
- Zachowanie linków i przekierowań (sekcja 9.5).

### 2.2 Nie wchodzi
- Zmiany zapisu treningów, dziennika posiłków, wagi i raportów ciała (źródła danych zostają).
- Sesja aktywnego treningu i podpowiedzi coacha w serii (`lib/live-coach/*`, `lib/live-set-coach.ts`).
- Nowe metryki zdrowotne (HRV, sen z zewnętrznych urządzeń, integracje z Apple Health / Google Fit).
- Eksport raportu (PDF/CSV) i udostępnianie analizy innym (patrz pytanie Q5 i sekcja 12).
- Generator AI / wnioski LLM. Coach to heurystyki (bez LLM), tak jak dziś.
- Moduł społeczności (`/community`), w tym wyzwania i rankingi.
- Zmiany w Javie (`java-backend/`) i Androidzie, poza tym, że WebView ładuje te same strony (sekcja 9.6).
- Sam ekran "Ustaw plan" i plany treningowe (zadanie 008).

---

## 3. Stan obecny (mapa z kodu)

Legenda decyzji dla każdej pozycji: **Z** = zostaje (jako treść), **P** = przeprojektować (przenieść/połączyć/zmienić prezentację), **U** = usunąć lub złączyć z inną pozycją, **?** = do decyzji właściciela.

### 3.1 Przegląd (`components/progress/overview-tab.tsx`)

| Blok (tytuł na ekranie) | Źródło danych | Co pokazuje | Decyzja |
|---|---|---|---|
| Gotowość (`ReadinessCard`) | `intelligence.fatigue`, `recovery`, `insights` | Zmęczenie (wynik, pasmo, delta 7/30 d), regeneracja (wynik, pasmo, linia gotowości), 1-2 podpowiedzi coacha | Z, ale uporządkować (sekcja 7, US-2) |
| Kalendarz tygodnia (`WeekProgressCalendarCard`) | `week.summary` | Dni Pn-Nd z ikonami siły/cardio, tonaż, cardio min, seria; "X z Y treningów" | Z (główny cel tygodnia), P |
| Trendy (4 kafelki, 30 dni) | `velocity.overall` (e1RM, tonaż), `tempo`, `consistency.month` | Siła e1RM %, tonaż %, waga od startu, regularność % | P: dublują Siłę i Tygodnie |
| Następne cele (3 paski) | `week.goals` | "−15 cm w pasie", "50 t podniesione", "4 tygodnie z rzędu" | P: wartości stałe w kodzie (sekcja 10) |
| Zdobyte (osiągnięcia, podgląd 3) | `week.achievements` | Lista odblokowanych odznak z datą | ? (Q3): inny koncept niż rekordy |

### 3.2 Siła (`components/progress/strength-tab.tsx`)

| Blok | Źródło | Co pokazuje | Decyzja |
|---|---|---|---|
| Trend siły (`StrengthTrendCard`) | `velocity` 7/30/90 dni | e1RM śr., tonaż, listy "Rośnie" / "Spada" wg partii | Z, P (łączy się z Przeglądem) |
| Prognoza e1RM (`StrengthForecastCard`, zwijana) | `predictions` | e1RM za 30 i 90 dni, pewność | Z, P (ukryć, gdy mało danych) |
| Intensywność | `intensity` (ostatnie 6 treningów) | Śr. RIR, śr. RPE, twarde serie | P: duplikuje Tygodnie i szczegół ćwiczenia |
| Ćwiczenia wg planu (`planGroups`) | `planGroups` + `volumeCounts` | Grupy wg planu (zwijane), strzałka objętości ostatni vs poprzedni | Z (najbardziej użyteczne), P |
| Rekordy (`RecordsCard`, zwijana) | `maxes` | Top e1RM, PR z 21 dni, rekordy powtórzeń (masa ciała) | Z, P (powtarza movers i szczegół) |
| Balans mięśniowy (`MuscleBalancePanel`) | `muscle` (30 dni), `stagnation` | Serie wg partii z %, alerty niedoboru, lista stagnacji | Z, P (stagnacja powtarza się w szczególe) |

### 3.3 Sylwetka (`components/progress/body-tab.tsx`)

| Blok | Źródło | Co pokazuje | Decyzja |
|---|---|---|---|
| Hero wagi | `body.weights`, `tempo` | Obecna waga, zmiana | Z |
| Wykres średniej kroczącej (`WeightAverageChart`) | `body.weights` | Wykres wagi ze średnią | Z |
| Tempo | `tempo` | kg/tydz. (6 tyg.), od startu, ostatni raport | Z, P (wzór "6 tygodni" przy krótkiej historii) |
| Obwody | `measures` | Pas, udo, klatka, ramię (kierunek "lepiej") | Z |
| Zdjęcia Start / Teraz (`PhotoCompareSection`) | `photos` | Dwa zdjęcia, różnica wagi i pasa | Z, ale wrażliwe (sekcja 9.2) |

### 3.4 Tygodnie (`components/progress/week-tab.tsx`)

| Blok | Źródło | Co pokazuje | Decyzja |
|---|---|---|---|
| Porównanie tygodni A/B (`WeekOverWeekCard`) | `week.compareWeeks`, `weekCompare` | Wybór dwóch tygodni, werdykt, metryki | Z |
| Ostatnie 8 tygodni (`WeekBarChart`) | `week.last8` | Słupki: treningi / tonaż / cardio | Z |
| Dieta a trening (`DietTrainingSection`) | `week.dietTraining` | kcal/białko vs tonaż/RPE, 8 tyg. | Z, ale tylko gdy są dane żywienia |
| Cardio (`CardioSection`) | `intelligence.cardio` | Obciążenie, kcal (tydz.), strefy tętna | Z |
| Realizacja i regularność (`AdherenceSection`) | `adherence`, `consistency` (tydz./30/90 d) | Łącznie / trening / dieta / cardio; regularność | Z, P (regularność dubluje Przegląd) |

### 3.5 Szczegół ćwiczenia (`components/progress/exercise-detail-view.tsx`, `/progress/exercises/[key]`)

Sekcje: KPI (treningi, rekord sesji, najlepsza seria, rekord, najcięższa seria, śr. RIR, śr. RPE, twarde), wykres objętości i e1RM, porównania okresów (tydzień/miesiąc/rok, `ExercisePeriodComparePanel`), prognoza i stagnacja pojedynczego ćwiczenia, rekordy (5 pozycji), historia treningów (lista). Ten ekran jest najbogatszy merytorycznie i jest celem "drill-down" z Siły.

### 3.6 Martwy kod do potwierdzenia (wątpliwość techniczna)
- `components/progress-analysis/*` (m.in. `progress-charts-dynamic.tsx`, `exercise-progress-dynamic.tsx`, `progress-charts.tsx`, `exercise-progress-client.tsx`, `weigh-in-card.tsx`) i `lib/progress-analysis.ts` (`getProgressAnalysisData`). Z przeszukania importów wynika, że żadna trasa ani komponent nie importuje ich poza nimi samymi. Stara trasa `app/(dashboard)/progress-analysis/page.tsx` to już tylko przekierowanie. Do potwierdzenia przez `architekt` i usunięcia w implementacji (osobna pozycja w zakresie, nie w widoku użytkownika).
- `lib/exercise-progress.ts` (`getExerciseProgressSeries`, `listExerciseNameSuggestions`) - sprawdzić, czy szczegół ćwiczenia używa go, czy ma osobną ścieżkę (`app/api/progress/exercise/route.ts`).

---

## 4. Ocena: co jest zbędne, co się dubluje, co brakuje

### 4.1 Duplikaty (ta sama informacja w 2-3 miejscach)

| # | Informacja | Gdzie się pojawia | Propozycja |
|---|---|---|---|
| D1 | Regularność (30 dni) | Przegląd (kafelek) i Tygodnie (Realizacja) | Jedno miejsce: Tygodnie (pełne 7/30/90), na Przeglądzie tylko wynik "X z Y tygodnia" |
| D2 | Trend e1RM i tonażu (30 dni) | Przegląd (kafelki) i Siła (Trend siły 30 dni) | Przegląd pokazuje jeden wynik zbiorczy i link do Siły; szczegóły w Sile |
| D3 | Intensywność (RIR/RPE) | Siła (Intensywność), Tygodnie (średnie w porównaniu), szczegół ćwiczenia (KPI) | Ten sam wskaźnik w jednej definicji; w Sile tylko agregat, w szczególe ćwiczenia wartości dla ćwiczenia |
| D4 | Stagnacja | Balans mięśniowy (lista) i szczegół ćwiczenia | Lista w Sile, w szczególe tylko status ćwiczenia |
| D5 | Prognoza e1RM | Siła (zwijana) i szczegół ćwiczenia | Zostaje w szczególe ćwiczenia; w Sile tylko zbiorczo, jeśli w ogóle |
| D6 | Te same ćwiczenia w 3 listach | Trend siły (movers), Ćwiczenia wg planu, Rekordy | Jedna lista ćwiczeń z przełącznikiem metryki (e1RM / tonaż / rekord) |
| D7 | Zmęczenie i regeneracja | Przegląd (ReadinessCard) i podpowiedzi coacha w tym samym bloku | Jedna sekcja "Gotowość" z jednym wnioskiem; komunikat "Regeneracja 80% - ..." nie powinien powtarzać się w podpowiedziach |
| D8 | Waga od startu | Przegląd (kafelek), Sylwetka (Tempo "od startu"), Zdjęcia (różnica wagi) | Jedna definicja "startu" (sekcja 10, W3) i jedna wartość w module |
| D9 | Cardio tygodniowe | Przegląd (kalendarz: cardio min), Tygodnie (Cardio, Last 8) | Przegląd: tylko licznik; szczegóły w Tygodniach |

### 4.2 Zbędne lub niejasne
- **Zbędne (propozycja U)**: osobny kafelek "Regularność" na Przeglądzie (duplikat D1), intensywność jako osobna karta w Sile (łączy się z D3), martwy kod z sekcji 3.6.
- **Niejasne nazewnictwo**: "Zdobyte" (osiągnięcia) i "Rekordy" (PR) to dwa różne pojęcia o podobnej nazwie. Dla początkującego to nie jest czytelne. Propozycja: "Osiągnięcia" (odznaki, jednorazowe) i "Rekordy" (najlepsze wyniki), z opisem.
- **Żargon bez wyjaśnienia**: e1RM, RIR, RPE, tonaż, "twarde serie", "pasmo regeneracji", "stagnacja". Dla początkującego wymagany jest krótki opis przy pierwszym pojawieniu się (tooltip lub Explainer), nie długi tekst.
- **Nagłówek z datą "OD ... · N TRENINGÓW"** nad zakładkami: wartość pochodzi z okna 180 dni (sekcja 10, W1). Wymaga weryfikacji, zanim ekran zostanie uznany za poprawny.
- **Teksty wyjaśniające niezgodne z obliczeniem** (sekcja 10, W4).

### 4.3 Czego brakuje (luka względem topowych aplikacji fitness-analytics)
- Jedna odpowiedź na pytanie "czy idę do przodu?" na pierwszym ekranie (werdykt tygodnia/miesiąca z 2-3 powodami). Dziś to rozproszone po kafelkach.
- Stan "za mało danych" zamiast pustych lub niepewnych liczb (dziś część kart po prostu znika albo pokazuje "0").
- Wyraźny filtr okresu (7/30/90 dni, cała historia) używany konsekwentnie w całym module, a nie w losowych kartach.
- Powiązanie: od wniosku do działania (np. "Balans: plecy 30% mniej serii niż klatka" -> link do ćwiczeń partii). Bez nowych danych, tylko nawigacja.
- Wprowadzenie dla nowego użytkownika (co liczy się po 3 treningach, po 2 tygodniach).

Uwaga: brak tych elementów nie blokuje dzisiejszego działania; to wartość redesignu.

---

## 5. Interesariusze i persony

| Persona | Opis | Co jest naprawdę potrzebne | Czego nie potrzebuje na pierwszym ekranie |
|---|---|---|---|
| **P1 Początkujący** (0-3 miesiące, 0-20 treningów) | Chce wiedzieć, czy robi dobrze i co dalej | Werdykt tygodnia (X z Y), trend wagi i siły w prostym języku, 1-2 konkretne wskazówki, informacja "co będzie widać po X treningach" | e1RM w tabelach, RIR/RPE, prognozy 90 dni, balans mięśniowy z %, rekordy wielu ćwiczeń |
| **P2 Zaawansowany** (6+ miesięcy, plan dnia, RIR/RPE) | Analizuje progres, planuje deloady i zmiany obciążeń | Trend e1RM per ćwiczenie, porównania okresów, stagnacja, balans partii, intensywność, historia i rekordy w szczególe ćwiczenia | Motywujące odznaki na pierwszym planie |
| **P3 Osoba na redukcji / prowadząca dietę** | Patrzy na wagę, tempo i zgodność dieta vs trening | Tempo kg/tydz., zgodność kcal/białko z celem, dieta vs trening w Tygodniach, pomiary | Zdjęcia na pierwszym ekranie (wrażliwe, sekcja 9.2) |
| **Administrator** | Brak bezpośredniego użycia modułu; może ustawiać progi wyliczeń przez kod | Stabilne wyniki i wiarygodne definicje (BR-1, BR-2) | - |
| **Użytkownik społeczności** | Nie korzysta z analizy bezpośrednio; może widzieć wynik w profilu publicznym (poza zakresem) | - | - |

Założenie: P1 stanowi większość nowych użytkowników, P2 - użytkowników najbardziej aktywnych (ci, którzy wracają do modułu). Redesign musi obsłużyć obie grupy bez przełącznika "prosty/zaawansowany" (Q2).

---

## 6. Założenia

- **A1** Zrzuty z zlecenia odpowiadają obecnemu kodowi (ta sama struktura zakładek). Jeśli nie, `ux` zgłasza rozbieżność w etapie 4.
- **A2** Redesign nie zmienia źródeł danych (tabele `workouts`, `workout_plans`, `weight_logs`, `body_reports`, `daily_checkins`, `user_settings`). Nowe wyliczenia są tylko nad istniejącymi danymi.
- **A3** Progi "za mało danych" ustala `architekt` i `ux` razem; propozycja analityka: trend (30 dni) od 3 sesji ćwiczenia, prognoza od 5 sesji, porównanie okresów od 2 okresów z danymi, balans mięśniowy od 4 treningów w 30 dniach. To założenie do zatwierdzenia.
- **A4** Cele "Następne cele" (15 cm w pasie, 50 t, 4 tygodnie z rzędu) zostają w v1 jako stałe wartości (bez konfiguracji). Patrz Q1.
- **A5** Cel tygodniowy "X z Y" używa `weeklySessionsTarget` z celów użytkownika (domyślnie 5), a cardio celu `weeklyCardioGoalMinutes` (domyślnie 150 min, jak w wiedzy o projekcie).
- **A6** Zachowujemy `/progress` jako jedyne miejsce modułu. Nie tworzymy drugiego hubu.
- **A7** Wskaźniki zdrowotne są przedstawiane jako opisy stanu i tendencje, bez diagnoz ("przetrenowanie" to nazwa pasma w kodzie, która wymaga neutralnego języka - sekcja 8, BR-7).
- **A8** Preferencja jednostki zmian (`percent` / `kg`, `lib/progress-delta-unit.ts`, domyślnie procent) zostaje i obowiązuje w całym module.
- **A9** Limit dotyczący wydajności: hub ładuje dane jednym wywołaniem (`getProgressHubData`); redesign nie może dołożyć ciężkich zapytań bez oceny `tester-wydajnosci`.

---

## 7. User stories i kryteria akceptacji

Format: "Jako <rola> chcę <cel>, aby <korzyść>". Kryteria w Given/When/Then. Priorytet MoSCoW.

### US-1 Jeden werdykt tygodnia na pierwszym ekranie (Must)
Jako osoba ćwicząca chcę zobaczyć na wejściu, czy realizuję swój tydzień, aby od razu wiedzieć, czy jest dobrze.

- AC-1.1: Given użytkownik ma cel X treningów tygodniowo, When otwiera Analizę postępów, Then pierwsza sekcja pokazuje "X z Y treningów" z paskiem i jednym zdaniem werdyktu (np. "Na dobrej drodze" / "Jeszcze 2 treningi do celu").
- AC-1.2 (brzeg - pierwszy tydzień, pierwsze użycie bez danych): Given brak treningów, When otwiera moduł, Then widzi stan pusty z opisem, co pojawi się po pierwszym treningu, i jednym CTA "Zacznij trening" (bez pustych kart z zerami).
- AC-1.3 (brzeg - zmiana dnia lokalnego): Given użytkownik trenuje o 23:50 w strefie lokalnej i wraca 00:10, When otwiera moduł, Then tydzień i licznik liczą się wg dnia lokalnego użytkownika (zgodnie z `calendarDateKey`), a trening nie przechodzi do innego tygodnia.
- AC-1.4 (brzeg - po niedzieli): Given jest niedziela wieczór, When otwiera moduł, Then "dni do końca tygodnia" = 0 i werdykt opisuje wynik tygodnia zamiast zachęty do dalszych treningów.
- AC-1.5: Given werdykt, When pokazany, Then nie zawiera więcej niż 1 zdania rekomendacji.

### US-2 Gotowość: zmęczenie i regeneracja w jednym, prostym miejscu (Must)
Jako zaawansowany użytkownik chcę widzieć, czy mogę dziś mocniej trenować, aby dobrze planować obciążenie.

- AC-2.1: Given wyliczone zmęczenie i regeneracja, When sekcja się pokazuje, Then zmęczenie i regeneracja są w jednej karcie z wynikiem, pasmem słownym i jednym wnioskiem; nie ma osobnego powtórzenia linii gotowości w podpowiedziach.
- AC-2.2 (brzeg - brak danych o samopoczuciu): Given brak `daily_checkins` i raportów ciała, When sekcja, Then pokazuje wynik z obciążenia treningowego z adnotacją "oparte na treningach" i zachętą do check-inu (bez zgadywania).
- AC-2.3 (brzeg - mało danych): Given mniej niż 7 dni historii, When sekcja, Then zamiast wyniku pokazuje "Za mało danych - wróć po tygodniu treningów".
- AC-2.4: Given pasmo "przeciążenie" (overreached), When wyświetlone, Then tekst jest neutralny, opisuje obciążenie w ostatnich dniach i sugeruje lżejszy dzień, bez diagnozy zdrowotnej (BR-7).

### US-3 Trend siły w jednym miejscu, z wyborem okresu (Must)
Jako zaawansowany użytkownik chcę zobaczyć trend siły dla wybranego okresu, aby porównać progres bez szukania w kilku kartach.

- AC-3.1: Given wybór 7 / 30 / 90 dni, When zmieniony, Then wszystkie wskaźniki siły w module (lista ćwiczeń, e1RM, tonaż) zmieniają się spójnie, a etykieta okresu jest widoczna.
- AC-3.2: Given ćwiczenie z mniej niż 2 sesjami w okresie, When na liście, Then pokazuje "za mało danych" zamiast procentu.
- AC-3.3: Given ćwiczenie rosnące i spadające w tej samej partii, When listy wyświetlone, Then każde ćwiczenie pojawia się raz (bez duplikatów z innych kart).
- AC-3.4 (brzeg - masa ciała): Given ćwiczenie bez obciążenia (np. podciąganie bez dodatkowego ciężaru), When na liście, Then metryka to powtórzenia, a nie e1RM w kg.

### US-4 Ćwiczenia wg planu z jedną listą i przełącznikiem metryki (Must)
Jako osoba ćwicząca wg planu chcę widzieć postęp swoich ćwiczeń pogrupowany wg dni planu, aby oceniać każdy dzień osobno.

- AC-4.1: Given plan z 5 ćwiczeniami, When otwieram listę, Then każdy dzień planu jest zwijany, pokazuje liczbę ćwiczeń i strzałkę zmiany ostatni vs poprzedni trening.
- AC-4.2: Given ćwiczenie w dwóch planach, When lista, Then pojawia się w obu grupach (zgodnie z obecnym zachowaniem), ale liczniki są spójne.
- AC-4.3: Given brak planu, When lista, Then grupa "Ćwiczenia" z najczęstszymi ćwiczeniami i CTA "Ułóż plan" (link do planów, zadanie 008).
- AC-4.4: Given ćwiczenie usunięte z planu, When z historią, Then pojawia się w grupie "Inne" (zgodnie z dzisiejszym działaniem), bez utraty historii.

### US-5 Rekordy: jasno, bez powtórzeń (Must)
Jako zaawansowany użytkownik chcę widzieć swoje rekordy i to, które są nowe, aby celebrować progres.

- AC-5.1: Given rekord w ostatnich 21 dniach, When lista, Then oznaczenie "nowy" jest widoczne, a data rekordu podana.
- AC-5.2: Given rekord w ćwiczeniu z kilku wariantów nazw (np. "Wyciskanie sztangi" i "Bench press"), When lista, Then liczony jest raz (tożsamość ćwiczenia, `resolveExerciseIdentity`).
- AC-5.3 (brzeg - brak rekordów): Given brak serii z obciążeniem, When sekcja, Then komunikat "Rekordy pojawią się po pierwszych seriach z obciążeniem".

### US-6 Balans mięśniowy z czytelnym ostrzeżeniem (Must)
Jako zaawansowany użytkownik chcę wiedzieć, które partie dostają za mało lub za dużo serii, aby korygować plan.

- AC-6.1: Given dane z 30 dni, When sekcja, Then pokazuje serie wg partii z udziałem % i sumą; kolejność od największej.
- AC-6.2: Given alert niedoboru (np. plecy < 70% serii klatki), When wyświetlony, Then tekst opisuje różnicę liczbowo i jest neutralny ("warto dodać serie"), bez oceny.
- AC-6.3: Given mniej niż 4 treningi w 30 dniach, When sekcja, Then "Za mało danych do oceny balansu".
- AC-6.4: Given partia bez przypisanych ćwiczeń w historii, When lista, Then partia ma 0 serii, a nie jest pomijana (czytelny brak).

### US-7 Stagnacja: jedna lista, wyjaśnione kryterium (Should)
Jako zaawansowany użytkownik chcę wiedzieć, które ćwiczenia stoją w miejscu i od kiedy, aby zmienić bodziec.

- AC-7.1: Given ćwiczenie bez wzrostu e1RM przez X dni, When na liście stagnacji, Then pokazuje liczbę dni i kryterium (np. "brak rekordu od 28 dni").
- AC-7.2: Given kryterium stagnacji, When użytkownik otwiera pomoc, Then widzi definicję (Explainer) w jednym zdaniu.
- AC-7.3 (brzeg - nowe ćwiczenie): Given ćwiczenie z 1 sesją, When liczona stagnacja, Then nie jest oznaczane jako stagnacja.

### US-8 Prognoza z zastrzeżeniem pewności (Should)
Jako zaawansowany użytkownik chcę orientacyjnej prognozy e1RM, aby planować cele, rozumiejąc jej niepewność.

- AC-8.1: Given prognoza z pewnością "niska", When wyświetlona, Then etykieta pewności i zdanie "orientacyjnie" są widoczne.
- AC-8.2: Given mniej niż próg (A3), When ćwiczenie, Then prognoza nie jest pokazywana, a komunikat mówi, ile sesji brakuje.
- AC-8.3: Prognoza nie pojawia się na Przeglądzie (tylko w Sile i szczególe ćwiczenia).

### US-9 Sylwetka: waga, tempo i pomiary z jednym źródłem startu (Must)
Jako osoba na redukcji chcę widzieć wagę, tempo zmian i pomiary, aby oceniać kierunek.

- AC-9.1: Given raporty wagi, When sekcja, Then wartość "od startu" jest taka sama na Przeglądzie, w Sylwetce i w porównaniu zdjęć (BR-4).
- AC-9.2: Given tempo kg/tydz., When krócej niż 2 tygodnie danych, Then pokazuje "za mało danych".
- AC-9.3 (brzeg - dwie wagi tego samego dnia): Given raport i wpis wagi tego samego dnia, When liczone, Then bierze się wartość z raportu ciała (zgodnie z obecnym `weightByDay`) i nie dubluje punktu wykresu.
- AC-9.4 (brzeg - brak wagi w ogóle): Given brak wpisów, When sekcja, Then zachęta do dodania wagi, bez pustego wykresu.
- AC-9.5: Given obwody, When wyświetlone, Then kierunek "lepiej" jest zgodny z definicją (pas/udo: mniej; klatka/ramię: więcej).

### US-10 Zdjęcia: prywatnie i na żądanie (Must)
Jako użytkownik chcę, aby zdjęcia sylwetki nie były widoczne przypadkowo, aby chronić prywatność.

- AC-10.1: Given Przegląd, When otwarty, Then nie pokazuje zdjęć sylwetki ani miniatur (BR-8).
- AC-10.2: Given zakładka Sylwetka, When zdjęcia pokazane, Then są tylko dla bieżącego użytkownika, z autoryzowanym URL (bez data URL w payloadzie) - zgodnie z obecnym `photos.src`.
- AC-10.3: Given brak zdjęcia startowego, When Porównanie Start/Teraz, Then pokazuje CTA "Dodaj zdjęcie startowe" zamiast pustego kafelka.

### US-11 Tygodnie: porównanie i historia bez dublowania (Must)
Jako osoba prowadząca dietę chcę porównać tygodnie i zobaczyć zgodność z dietą i treningiem, aby widzieć zależności.

- AC-11.1: Given wybór dwóch tygodni z listy 12, When porównanie, Then metryki (treningi, tonaż, cardio, RPE, RIR) są z tych samych okresów (pełny tydzień lub do dziś - jasno oznaczone).
- AC-11.2: Given tydzień bez danych żywienia, When sekcja "Dieta a trening", Then pokazuje "Brak wpisów z dziennika w tych tygodniach" zamiast zer.
- AC-11.3 (brzeg - produkt bez wartości odżywczych): Given wpis posiłku bez kcal/białka, When liczona zgodność, Then wpis nie jest liczony jako 0 kcal (wymaganie dla dziennika; sprawdzić, czy agregacja to respektuje - sekcja 10, W6).
- AC-11.4: Given cardio, When sekcja, Then obciążenie, kcal i strefy tętna są opisane, a brak tętna oznacza "brak danych HR" (nie 0 min w strefie).

### US-12 Szczegół ćwiczenia: porównanie okresów i historia (Must)
Jako zaawansowany użytkownik chcę w jednym miejscu zobaczyć wykres, porównania i historię ćwiczenia, aby ocenić jego progres.

- AC-12.1: Given szczegół ćwiczenia, When otwarty, Then pierwsza sekcja to wykres e1RM/objętości z wyborem okresu, a KPI są pod wykresem.
- AC-12.2: Given porównanie tydzień / miesiąc / rok, When brak danych w porównywanym okresie, Then pokazuje "brak danych w tym okresie" (nie 0%).
- AC-12.3: Given szczegół, When wejście z Siły, Then przycisk "Wróć do Siły" wraca do tej samej zakładki i okresu (stan w URL).
- AC-12.4: Given ćwiczenie usunięte z planu, When link z historii, Then szczegół działa (klucz wg nazwy, `exerciseProgressKey`).

### US-13 Język i wyjaśnienia dla początkujących (Must)
Jako początkujący chcę rozumieć skróty i wskaźniki bez szukania w Internecie, aby korzystać z analizy od pierwszego dnia.

- AC-13.1: Given pierwsze wystąpienie e1RM, RIR, RPE, tonaż, when na ekranie, Then obok jest krótki opis (Explainer, maks. 2 zdania) - jedna definicja w całym module.
- AC-13.2: Given wyjaśnienie wzoru tonażu, When pokazane, Then opis odpowiada obliczeniu (sekcja 10, W4).
- AC-13.3: Given tekst w module, When sprawdzony, Then jest po polsku, spójnie nazywa wskaźniki (jedna nazwa dla jednego pojęcia).

### US-14 Wydajność i działanie w siłowni (Must)
Jako osoba ćwicząca chcę, żeby analiza ładowała się szybko na telefonie, aby sprawdzić wynik między seriami.

- AC-14.1: Given telefon 4G, When otwieram Przegląd, Then pierwszy ekran (werdykt, gotowość) jest widoczny w < 2 s (SLO do ustalenia z `tester-wydajnosci`).
- AC-14.2: Given ciężkie sekcje (szczegół ćwiczenia, dieta vs trening), When otwarte, Then ładowane są leniwie, a przełączanie zakładek nie przeładowuje całego hubu.
- AC-14.3 (brzeg - brak sieci): Given brak połączenia, When otwieram moduł, Then widzę ostatnie dane z pamięci podręcznej (jeśli `architekt` ją dopuści) albo komunikat "Brak połączenia - spróbuj ponownie", bez pustego ekranu.
- AC-14.4: Given tryb pionowy telefonu, When przewijam, Then każda karta ma cele dotyku min. 44 px i nie wymaga poziomego przewijania.

### US-15 Spójność danych między ekranami (Must)
Jako użytkownik chcę, aby ta sama liczba była taka sama wszędzie, aby ufać analizie.

- AC-15.1: Given ta sama metryka (np. regularność 30 dni, waga od startu) na dwóch ekranach, When porównane, Then wartość i okres są identyczne.
- AC-15.2: Given dodanie treningu, When wracam do modułu, Then wszystkie sekcje odświeżają się spójnie (bez starych danych w jednej karcie).
- AC-15.3: Given dwa urządzenia (telefon i komputer) z tym samym kontem, When dodaję trening na jednym, Then po odświeżeniu drugiego wyniki są takie same (dane z serwera; brak lokalnych kopii liczb).

### US-16 Zachowanie linków i historii (Must)
Jako użytkownik ze starymi zakładkami chcę, aby stare linki nadal działały, aby nie trafić na błąd.

- AC-16.1: Given `/progress?tab=zdjecia`, When otwarty, Then przekierowanie do Sylwetki (dziś działa).
- AC-16.2: Given `/progress-analysis?q=...` lub `?tab=...`, When otwarty, Then przekierowanie na `/progress/exercises/...` lub `/progress?tab=...` (dziś działa).
- AC-16.3: Given `/progress/exercises/<klucz>`, When klucz z polskimi znakami lub spacjami, Then nazwa jest poprawnie zdekodowana (`decodeExerciseProgressKey`).
- AC-16.4: Given zalogowanego użytkownika bez sesji, When wejście na `/progress`, Then przekierowanie do logowania (jak dziś).

### US-17 Usunięcie duplikatów i martwego kodu (Should, dług techniczny)
Jako zespół chcę usunąć nieużywane komponenty analizy, aby zmniejszyć koszt utrzymania.

- AC-17.1: Given `components/progress-analysis/*` i `lib/progress-analysis.ts` nieużywane (sekcja 3.6), When implementacja, Then są usunięte po potwierdzeniu przez `architekt`, a `npm run lint` i `npx tsc --noEmit` przechodzą.
- AC-17.2: Given usunięcie, When przeszukanie repozytorium, Then brak importów do usuniętych plików.

---

## 8. Reguły biznesowe

- **BR-1 Jedna definicja na metrykę.** Każda metryka (np. regularność, waga od startu, e1RM trend, tonaż 30 dni) ma jedną definicję, jedno źródło w kodzie i jedną prezentację w całym module. Różne ekrany mogą pokazywać różne szczegóły, ale nie inne wyniki.
- **BR-2 Okres jest zawsze podany.** Każda liczba-trend ma etykietę okresu (7 / 30 / 90 dni, tydzień, cała historia). Liczba bez okresu nie jest pokazywana.
- **BR-3 Za mało danych zamiast liczby.** Poniżej progu (A3) pokazujemy komunikat "za mało danych" z tym, ile brakuje, a nie wartość lub 0%.
- **BR-4 Start jest jeden.** "Start" dla wagi i zdjęć to ta sama data i ten sam raport (do potwierdzenia przez `architekt`, sekcja 10, W3). Zdjęcie startowe z galerii (`hasCustomStart`) ma pierwszeństwo tylko wtedy, gdy użytkownik je wybrał - zachowanie dzisiejsze.
- **BR-5 Historia "od startu" liczona z pełnej historii.** Wartości typu "od pierwszego treningu", "łączny tonaż", "liczba treningów", "cele 50 t" muszą być liczone z całej historii użytkownika, a nie z okna ostatnich 180 dni (sekcja 10, W1).
- **BR-6 Jeden wnioskodawca.** Podpowiedź coacha jest pokazywana maksymalnie 2 na ekranie i nie powtarza liczby z karty gotowości.
- **BR-7 Język bez diagnoz.** Wskaźniki zdrowia i obciążenia opisują tendencję i zalecenie treningowe (np. lżejszy dzień), nie stawiają diagnozy. Nazwy pasm w kodzie (np. "przeciążenie") są przeformułowane w UI, a dokładne brzmienie zatwierdza `ux` i `prawnik` przy zmianie etykiet.
- **BR-8 Zdjęcia poza Przeglądem.** Zdjęcia sylwetki są pokazywane tylko w zakładce Sylwetka, na żądanie użytkownika (kliknięcie), a nie jako domyślna część ekranu startowego.
- **BR-9 Brak wartości w analityce zdarzeń.** Zdarzenia analityczne (PostHog, page-view) nie zawierają wartości wagi, pomiarów, e1RM, nazw ćwiczeń ani notatek; tylko nazwa ekranu i zakładki (zgodnie z `lib/analytics-screen.ts`). To wymaganie dla każdej nowej zmiany w module.
- **BR-10 Tożsamość ćwiczenia.** Ćwiczenie liczy się jako jedno, wg `resolveExerciseIdentity` (ta sama tożsamość dla planu, historii, rekordów i szczegółu).
- **BR-11 Jednostki.** Zmiany delta w całym module zgodne z preferencją użytkownika (`percent` domyślnie, `kg` opcjonalnie). Wagi i obwody zawsze w kg / cm.
- **BR-12 Cele tygodnia z ustawień.** Cel treningów (domyślnie 5) i cel cardio (domyślnie 150 min) pochodzą z ustawień użytkownika, nie z wartości w kodzie.

---

## 9. Wymagania niefunkcjonalne i prywatność

### 9.1 Dane wrażliwe
Waga, pomiary (pas, udo, klatka, ramię), zdjęcia sylwetki, samopoczucie (sen, energia, stres z check-inu), tętno i kalorie z cardio to dane o zdrowiu i ciele. Redesign prezentacji **nie dodaje nowych kategorii danych** względem obecnego modułu. Minimalizacja: nie pokazujemy więcej, niż jest potrzebne do werdyktu.

### 9.2 Zdjęcia
Zdjęcia są wrażliwsze niż liczby (może je zobaczyć ktoś stojący za użytkownikiem). Wymaganie: zdjęcia nie są pokazywane na Przeglądzie domyślnie; w zakładce Sylwetka wymagają kliknięcia (BR-8); brak zdjęć w kodzie poza serwerowym URL do autoryzowanego zasobu.

### 9.3 Logi i Sentry
Wyjątki w `loadProgressHubData` nie mogą logować wartości (wagi, e1RM, nazwy). Obecny `console.error("[progress-hub] intelligence", message)` loguje tylko komunikat błędu - zachować tę zasadę.

### 9.4 Wydajność
- Dziś: zapytanie o treningi z ostatnich 180 dni (limit 400), pełne raporty ciała bez blobów, wagi (limit 300), check-iny (21), agregacje w pamięci, obliczenia dietowe. Każda zmiana musi być oceniona przez `tester-wydajnosci` (etap 9).
- SLO (propozycja, do potwierdzenia): pierwsza zakładka < 2 s na 4G; przełączenie zakładki < 300 ms (dane już w pamięci lub lazy).
- Limit Turso (plan darmowy): unikać powtórnego odczytu tych samych danych przy każdej zakładce.

### 9.5 Zgodność linków
Zachować: `/progress`, `/progress?tab=przeglad|sila|sylwetka|tydzien`, `zdjecia` -> `sylwetka`, `/progress/exercises/[key]`, przekierowania z `/progress-analysis`.

### 9.6 Android i Java
- Android (WebView) otwiera te same strony; brak zmian kontraktu `/api/android/*` w tym zakresie (do potwierdzenia przez `architekt`).
- Java backend: w tej analizie nie znaleziono wpływu (wg `docs/analiza/00` i `analytics-intelligence.json`, wyliczenia są w TypeScript). Potwierdzi `architekt`.

### 9.7 Dostępność
WCAG AA; wykresy z tekstowym podsumowaniem (nie sam kolor); karty zwijane z `aria-expanded`; kontrast tekstu `white/40` na ciemnym tle do sprawdzenia przez `ux` (dziś w kodzie często użyte).

### 9.8 Koszty
Brak nowych usług zewnętrznych w zakresie analizy. Zdjęcia nadal z Turso (wg wiedzy o projekcie, to znany problem wydajnościowy poza zakresem tego zadania).

### 9.9 Zmienne środowiskowe
Brak nowych zmiennych w zakresie analizy. Jeśli `architekt` doda cache (np. Upstash), wymagany wpis w `lib/admin-config-status.ts` i `env.example`.

---

## 10. Wątpliwości mapowania i wyliczeń (do weryfikacji, bez naprawiania w tym zadaniu)

Każda pozycja to hipoteza wynikająca z czytania kodu. Weryfikacja: `architekt` (kod i zapytania) oraz `tester` (testy na danych). Klasyfikacja: **do potwierdzenia przed redesignem** (może być defekt blokujący dla wiarygodności wyników).

- **W1 - Okno 180 dni dla wartości "od początku".** `loadProgressHubData` pobiera treningi tylko z ostatnich 180 dni (`gte(workouts.date, from180)`, limit 400). Z tego okna liczone są: `strength.sinceDate` (nagłówek "OD ... "), `strength.workoutCount` (nagłówek "N TRENINGÓW"), `totalTonnageKg` (cel "50 t podniesione" i osiągnięcia), `firstWorkoutDate` (osiągnięcia), `streakWeeks` (w zakresie 12 tygodni). Jeśli użytkownik trenuje dłużej niż 180 dni, nagłówek i licznik mogą być zaniżone, a "50 t" - liczone od nowa. Wymaga weryfikacji i decyzji (BR-5).
- **W2 - Nazwa "kgPerWeekLast6" vs obliczenie.** Tempo kg/tydz. "6 tygodni" to różnica między pierwszym a ostatnim punktem wagi w oknie 42 dni, nie regresja ani średnia. Przy jednym skoku wagi wynik jest zniekształcony. Do decyzji: regresja liniowa albo średnia krocząca (wymaga zgody właściciela na metodę).
- **W3 - Dwie definicje "wagi od startu".** Przegląd i Sylwetka (tempo) używają pierwszego punktu z `weights` (raporty + logi wagi). Kafelek "Zdjęcia" (`weightDeltaKg`) bierze wagę z pierwszego raportu ze zdjęciem albo z zdjęcia startowego z galerii. Te dwie wartości mogą się różnić (BR-1, BR-4).
- **W4 - Wyjaśnienie wzoru objętości.** W `strength-tab.tsx` (wyjaśnienie zwijane pod "Ćwiczenia wg planu") tekst mówi "Objętość = powtórzenia × kg × serie", a kod (`volumeFromExercises`, `dayVolKg`) sumuje `reps × weight` po seriach, bez mnożenia przez liczbę serii. Tekst albo kod jest błędny; do zweryfikowania, co jest zamierzone (tonaż = suma reps × kg).
- **W5 - Stałe cele w kodzie.** "−15 cm w pasie", "50 t", "4 tygodnie z rzędu" są wpisane w `loadProgressHubData` (`waistGoalCm = 15`, `tonnageGoalKg = 50_000`, `streakGoal = 4`). Nie są konfigurowalne ani opisane w UI jako cel użytkownika. Decyzja: Q1.
- **W6 - Agregacja dziennika bez wartości.** Czy zgodność kcal/białka w `diet-training-weeks` traktuje produkt bez wartości odżywczych jako brak danych, a nie jako 0 kcal. Do sprawdzenia w `lib/diet-training-weeks.ts` (nie czytano w tym etapie w całości).
- **W7 - Martwy kod analizy.** `components/progress-analysis/*` i `lib/progress-analysis.ts` wyglądają na nieużywane (sekcja 3.6). Do potwierdzenia przez wyszukiwanie importów w etapie 3.
- **W8 - Podwójna prezentacja gotowości.** Podpowiedź coacha "Regeneracja X% - ..." (`lib/analytics/coach-insights.ts`) powtarza wynik z `ReadinessCard`. To nie jest błąd liczenia, ale redundancja (D7).
- **W9 - Pasmo "przeciążenie" (overreached) i język.** Nazwa pasma i etykieta (`bandLabel`) są generowane w `lib/analytics/fatigue-score.ts`. Ich brzmienie wymaga neutralizacji (BR-7). Nie oceniano tu słów w kodzie.
- **W10 - Regularność 30/90 dni.** Przegląd pokazuje `consistency.month`; Tygodnie pokazują `consistency` tydz./30/90 i `adherence`. Trzeba potwierdzić, że "planned" (ile treningów zaplanowano) jest liczone tą samą definicją w obu miejscach (BR-1).
- **W11 - Zakres "ostatnie 6 treningów" w intensywności.** Karta "Intensywność" mówi o ostatnich 6 treningach, a "Tygodnie" o tygodniu. Dwie różne próbki o tej samej nazwie (BR-2: etykieta okresu musi być jednoznaczna).

Pytanie metodologiczne: czy wskaźniki zmęczenia/regeneracji są wystarczająco wiarygodne, by pokazywać je jako "wynik" (liczba 0-100). To decyzja produktu i etapu 3 (architekt), nie blokuje analizy wymagań.

---

## 11. Pytania otwarte do właściciela produktu

Maksymalnie 5 najważniejszych. Żadne nie blokuje etapów 3-4 (wszystkie mają założenie).

- **Q1 - Cele "Następne cele".** Czy zostają stałe (15 cm, 50 t, 4 tygodnie) w v1, czy użytkownik ma je ustawiać w profilu? Założenie: stałe w v1, bez konfiguracji (A4). Wpływa na: zakres, nie na architekturę.
- **Q2 - Tryb prosty czy zaawansowany.** Czy robimy przełącznik "Prosty / Zaawansowany", czy jeden ekran z progresywnym ujawnianiem (więcej szczegółów po rozwinięciu)? Założenie: jeden ekran, progresywne ujawnianie (bez przełącznika). Decyzja wpływa na projekt UX.
- **Q3 - Osiągnięcia ("Zdobyte").** Czy odznaki zostają na Przeglądzie (niżej), w Tygodniach czy w profilu? Założenie: zostają, ale niżej i zwinięte. Nie blokuje.
- **Q4 - Progi "za mało danych".** Akceptacja propozycji z A3 (3 sesje, 5 sesji, 4 treningi/30 dni). Założenie: tak, do korekty po testach.
- **Q5 - Eksport i udostępnianie.** Czy w przyszłości planowany jest eksport raportu analizy (PDF/CSV) albo udostępnianie wykresu (np. w społeczności)? Założenie: nie w tym zakresie. Gdyby tak, wymagany byłby `prawnik` (sekcja 12).

Dodatkowo do ustalenia przy implementacji (nie pytania do właściciela): W2 (metoda tempa), W1 (okno historii) - to decyzja techniczna i weryfikacja `architekt`.

---

## 12. Decyzja o bramkach (etap 1, wg `docs/zespol/przeplyw.md` "Dobór ról")

| Bramka | Decyzja | Uzasadnienie |
|---|---|---|
| `prawnik` | **POMINIĘTA** | Redesign prezentacji nad istniejącymi danymi nie wprowadza nowego przetwarzania danych osobowych/zdrowotnych: te same źródła, te same kategorie (waga, pomiary, zdjęcia, check-iny, cardio), te same odbiorca (osoba zalogowana), bez zewnętrznych usług i bez nowej retencji. Nie zmienia się zgoda ani treść prawna. |
| `architekt` | **TAK** (etap 3 i przegląd etapu 6 w zakresie wyjątku) | Zmiana struktury danych hubu, potencjalnie zakres okna historii (W1), źródło "startu" (W3), usunięcie martwego kodu, decyzje o cache. |
| `ux` | **TAK** (etap 4) | Redesign ekranów od zera w sensie hierarchii i treści; wymaga makiet i przeglądu spójności (sekcja 7 zakłada ten etap). |
| `backend` / `frontend` | **TAK** (etap 5) | Implementacja w `lib/progress-hub.ts` (liczenia) i w komponentach `components/progress/`. |
| `tester` | **TAK** (etap 7), w trybie **pełnego planu** | Złożona logika domenowa: okna czasowe, dzień lokalny (AC-1.3), tożsamość ćwiczeń, poprawność liczb (W1-W4). Zgodnie z przeplywem: złożona logika domenowa -> `sonnet` i pełny plan testów. |
| `tester-bezpieczenstwa` | **POMINIĘTY** na etapie 1 | Zadanie nie zmienia uwierzytelniania, uprawnień ani sekretów. Powierzchnia wejścia się nie zwiększa (brak nowych danych wejściowych użytkownika). Wyjątek: jeśli etap 3 doda nowy endpoint, eksport, cache lub udostępnianie zdjęć, bramka wchodzi (wywołać wtedy wyjątkowo). |
| `tester-wydajnosci` | **TAK** (etap 9) | Hub ładuje wiele agregatów (180 dni, 400 treningów, raporty, zdjęcia). Redesign zmienia sposób ładowania zakładek (lazy), co wpływa na obciążenie. |

Ścieżka: **pełna**. Zadanie zostaje w etapie 1-4 (analiza, projekt, makiety), implementacja tylko po akceptacji użytkownika. Karta: `docs/zadania/009-redesign-analizy-postepow.md`.

---

## 13. Ryzyka

| Ryzyko | Prawdopodobieństwo / wpływ | Ograniczenie |
|---|---|---|
| Zmiana definicji wskaźników zmieni liczby, które użytkownik już zna (np. "od startu", "regularność") | Średnie / średni | Komunikat zmiany w changelogu; zachowanie etykiet, jeśli definicja jest poprawna |
| Błędne liczby (W1, W3) zostaną przeniesione do nowego układu zamiast naprawione | Wysokie / wysoki | Weryfikacja W1-W4 jako warunek wejścia do implementacji (sekcja 10) |
| Przeładowanie wraca przez "dodanie jeszcze jednej karty" | Średnie / średni | Reguła: max 1 werdykt, max 2 wnioski, max 4 sekcje na zakładkę (do potwierdzenia przez `ux`) |
| Zbyt duża zmiana naraz (4 zakładki, szczegół ćwiczenia, dane) | Wysokie / wysoki | Etapy implementacji: (1) poprawność liczb, (2) Przegląd i Gotowość, (3) Siła i szczegół ćwiczenia, (4) Sylwetka i Tygodnie |
| Ukrycie zdjęć z Przeglądu zostanie uznane za regresję przez użytkowników | Niskie / niski | Zdjęcia zostają w Sylwetce; zmiana opisana w changelogu |
| Usunięcie martwego kodu analizy zepsuje ukryte importy (np. dynamiczne) | Niskie / średni | Przeszukanie całego repozytorium przez `architekt` i `npm run lint` |
| Język "przeciążenie" (BR-7) zostanie odebrany jako ocena zdrowotna | Średnie / średni | Neutralne sformułowanie zatwierdzone przez `ux`; w razie wątpliwości `prawnik` (zmiana etykiet, nie danych) |
| Wydajność hubu po dodaniu sekcji lub zwiększeniu okna historii | Średnie / wysoki | `tester-wydajnosci` w etapie 9; cache tylko po decyzji `architekt` |

---

## 14. Zależności i wpływ

- Zależy od: decyzji Q1-Q2 (zakres UX), weryfikacji W1-W4 (liczby), oraz od zadania 008 w zakresie linku "Plan" z ekranu Treningów (sekcja 3.3 w `008`) - ścieżka do planów z analizy (AC-4.3).
- Wpływa na: `docs/ux/00-system-projektowy-stan.md` (nowe wzorce kart), `docs/wydajnosc/00-analiza-bazowa.md` (obciążenie hubu), `docs/analiza/00-mapa-produktu.md` (opis modułu po wdrożeniu), `docs/zespol/wiedza-o-projekcie.md` (po implementacji).
- Android: bez zmian kontraktu (WebView). Java: bez wpływu wg przeglądu; potwierdzi `architekt`.
- Changelog: wpis `planned: true` na PR; opis zmian w definicjach (sekcja 13).
- Zmienne środowiskowe: brak nowych (sekcja 9.9).

---

## 15. Kolejność proponowana dla etapów 3-4

1. `architekt`: weryfikacja W1-W4, W7 (kod i zapytania), decyzja o cache i podziale ładowania zakładek, ADR z listą sekcji po redesignie.
2. `ux`: makiety Przeglądu (werdykt, gotowość, cele tygodnia, osiągnięcia zwinięte), Siły (lista ćwiczeń z przełącznikiem metryki, balans, stagnacja), Sylwetki (zdjęcia na żądanie), Tygodni (porównanie, dieta, cardio), szczegółu ćwiczenia (wykres na górze, KPI pod spodem).
3. Akceptacja użytkownika przed etapem 5.
