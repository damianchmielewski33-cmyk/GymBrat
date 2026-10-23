# 003 - Przebudowa ekranu Trening: wymagania i kryteria akceptacji

Karta: `docs/zadania/003-przebudowa-ekranu-trening.md` (zatwierdzona propozycja układu = zakres). Etap 1 przepływu (analityk). Dokument nie projektuje architektury; decyzje techniczne wskazuje jako wejście dla `architekt`.

## 1. Kontekst i cel

Ekran Trening (`/workout-plan`, `WorkoutPlanPageContent` -> `TreningiHubClient` -> `TreningiHub`) jest głównym punktem startu treningu. Dane: `getWorkoutPlansWithLastWorkout()` (plany + `lastWorkoutDate` = `max(workouts.date)` po `workout_plan_id`) i `getTreningiHubStats()` (tydzień pon-nd, `workoutsThisWeek`, `cardioMinutesThisWeek`, `cardioSessionsThisWeek`, `streakWeeks`).

Cel: ekran, na którym w 2 s widać (a) co zrobiłem w tym tygodniu, (b) co trenuję teraz, jakimi ciężarami, (c) jakie partie to obejmuje, i z którego start treningu to jedno, jednoznaczne dotknięcie. Usunięcie dubli i szumu (patrz tabela problemów).

### Co już działa i zostaje (nie opisywać od nowa)
- Start sesji z planu (`beginWorkoutFromPlanRow`) + wybór solo/grupa (`StartWorkoutModeSheet`), wznowienie niedokończonego treningu (`useActiveWorkoutStore`, po hydratacji), PDF planu (`printWorkoutPlans`), przejścia do `/workout-history`, `/technique`, `/cardio`, `/profile/workout-plan`.
- Kolejka planów `comparePlansByWorkoutRecencyAsc` (używana też w `lib/home-start.ts` i `actions/workout-plan.ts`).

### Problemy obecnego ekranu -> wymaganie, które je zamyka
| Problem | Zamknięcie |
|---|---|
| Dzisiejszy plan podwójnie (karta + wiersz „Dziś”) | US-3, US-4: karta „Następny” + w liście tylko znacznik „Następny” (bez drugiego CTA „Dziś”) |
| Kicker „PLAN · 5 DNI · 4 TYG.”, cyfra bez jednostki | US-1: usunięte; chip serii z jednostką |
| Uboga karta „Trening na dziś” | US-3 |
| Trzy cele kliknięcia w wierszu, stopka „Tap/Notes”, podwójna strzałka | US-4: tap = start, reszta w menu ⋮ |
| Podwójna data | BR-9 |
| Zielony chip „Wykonano” spoza palety | US-4: ptaszek w złotej palecie |
| Sekcje 02-04 po 1-2 linki, „Postępy” dubluje Analizę | US-5 |
| Minuty cardio dwa razy | US-2/US-5: minuty tylko w karcie tygodnia |

## 2. Interesariusze
- Osoba ćwicząca początkująca: ma plan z 1-3 dniami, brak historii obciążeń; potrzebuje jednoznacznego „co teraz”.
- Osoba ćwicząca zaawansowana: split 4-7 dni, interesują ją ciężary z poprzedniej sesji i szybki start; tapnięcie w wiersz nie może uruchamiać nie tego dnia.
- Osoba bez planu / z planem w trakcie edycji (puste dni).
- Administrator / właściciel: spójność z paletą (złoto), brak regresji na home i w Androidzie (WebView).
- Użytkownik społeczności: start grupowy musi dalej działać z tego ekranu (bez zmian).

## 3. Definicje (podstawa kryteriów)

### D-1 Tydzień
Poniedziałek-niedziela, dzień lokalny użytkownika (`calendarDateKey`, `weekDateKeysMondayFirst`). Zgodne z D9 właściciela (tydzień cardio pon-nd) i z `treningi-hub-stats.ts`.

### D-2 „Dzień N” (numer dnia planu)
Obecny kod zdradza problem: lista jest sortowana kolejką aktywności (`out.sort(comparePlansByWorkoutRecencyAsc)`), a etykieta to `D{idx+1}` - numer zmienia się po każdym treningu. W nowym ekranie „Dzień N” ma być stały.
- **Założenie**: N = pozycja planu wg `createdAt` rosnąco (to już jest kolejność bazowa zapytania przed sortem). Lista dni w panelu jest wyświetlana w kolejności Dzień 1..N (nie w kolejności kolejki), a „Następny” jest tylko znacznikiem. Zmiana kolejności planów przez użytkownika nie istnieje w tym ekranie (edycja w Profilu) - nie jest w zakresie.
- Wymagana zmiana danych (do `architekt`): DTO musi nieść stabilny numer/kolejność niezależny od sortu kolejki.

### D-3 „Wykonany w tym tygodniu”
Dzień planu jest wykonany, gdy `lastWorkoutDate` (max data zapisanej sesji z `workout_plan_id` = ten plan) należy do bieżącego tygodnia pon-nd. Tak liczy obecny kod (`weekKeys.has(row.lastWorkoutDate)`). Konsekwencje, które należy zapisać jako regułę, nie błąd:
- wielokrotne wykonanie tego samego dnia w tygodniu = nadal jedno wypełnienie segmentu;
- sesja bez powiązania z planem (`workout_plan_id` null) nie wypełnia żadnego segmentu;
- tylko zapisane (zakończone) sesje się liczą; niedokończony trening z lokalnego store - nie.
- Ryzyko niespójności stref: `today` w kliencie (`calendarDateKey()` w przeglądarce) vs w `getTreningiHubStats` (serwer). Wymaganie: jedna wspólna definicja „dziś/tydzień” dla segmentów i licznika (patrz AC-2.4).

### D-4 „Następny dzień”
Dokładnie wynik `comparePlansByWorkoutRecencyAsc(...)[0]`: (1) plan nigdy nie wykonany, (2) w przeciwnym razie ten z najstarszą `lastWorkoutDate`, (3) remis dat -> kolejność wejściowa (sort stabilny). Dla dwóch nigdy niewykonanych: wg `updatedAt` malejąco (ostatnio edytowany pierwszy) - to zachowanie jest nieintuicyjne („Dzień 3 jako pierwszy, bo edytowałem”).
- **Znalezisko**: wejściowa kolejność różni się między ekranami: hub = `createdAt` asc, `home-start.getNextWorkoutPlan` = `updatedAt` desc. Przy remisie dat (np. dwa dni zrobione tego samego dnia) Home i Trening mogą wskazać różny „następny”.
- **Rekomendacja (BR-3)**: nie zmieniać reguły kolejki, ale ustalić wspólny deterministyczny tie-break: nigdy niewykonane i remisy -> najniższy numer dnia (createdAt asc). Zmiana dotyka `lib/workout-plan-queue.ts` i `home-start` (współdzielone), więc test jednostkowy kolejki musi to pokrywać. Wymaga akceptacji (pytanie P-2).
- Dzień bez ćwiczeń nie może być „Następny” jeśli istnieje dzień z ćwiczeniami (BR-4).

### D-5 „Ostatnie obciążenie” ćwiczenia
Propozycja:
- **Źródło**: ostatnia zapisana sesja **tego samego planu** (`workouts.workout_plan_id = plan.id`, najnowsza `date`, remis -> najnowszy wpis), tylko dla ćwiczeń z karty „Następny” (max 3), czyli jedno zapytanie + parsowanie jednego JSON-a.
- **Dopasowanie ćwiczeń**: po tożsamości ćwiczenia (`resolveExerciseIdentity`, jak w `workout-plan-compare.ts`), nie po surowej nazwie.
- **Wybór serii**: seria „robocza” = ukończona (`done`, nie `skipped`, `reps > 0`) o największym ciężarze; remis -> więcej powtórzeń. Wyświetlenie `80 kg × 8`.
- Uzasadnienie: (a) ta sama sesja pokazywana w „ostatnio DD.MM” jest spójna z ciężarami (jeden punkt odniesienia), (b) najcięższa seria odfiltrowuje rozgrzewki i serie spadkowe, a ostatnia seria bywa najlżejsza lub przerwana, (c) „najcięższa kiedykolwiek” to rekord (Analiza), nie punkt startu, (d) koszt: jeden odczyt zamiast skanowania historii (limity Turso).
- Przypadki: ćwiczenie bez ukończonych serii w ostatniej sesji, albo nieobecne w niej -> brak ciężaru (BR-6). Ciężar 0 / ćwiczenie z masą ciała -> pokaż tylko `× N powt.`. Jednostka zawsze kg (aplikacja nie ma przełącznika jednostek - założenie).
- Odrzucone: „ostatnia sesja z dowolnego planu zawierającego to ćwiczenie” (więcej zapytań, mylące przy różnych celach powtórzeń); do rozważenia jako Could.

### D-6 Grupy mięśni dnia planu (max 3)
Wejście: ćwiczenia planu. Mięsień ćwiczenia = `resolveExerciseMuscles({name, categoryId}).primary` -> `regionToAnalyticsGroup` (9 grup: klatka, plecy, barki, biceps, triceps, nogi, pośladki, łydki, brzuch). Tylko partia główna (secondary ignorujemy, inaczej każdy dzień „ma” triceps i barki). `cardio` i `null` nie liczą się.
Wybór:
1. liczba ćwiczeń w grupie malejąco;
2. remis -> grupa, której ćwiczenie występuje wcześniej w planie;
3. remis nadal (praktycznie niemożliwy) -> stała kolejność `ANALYTICS_MUSCLE_GROUPS`.
Wynik: 0-3 grupy, deterministyczny. Uwagi:
- `forearms` mapuje się na `biceps`, `quads`+`hamstrings` na `nogi` - przyjmujemy istniejące mapowanie, bez zmian.
- **Założenie**: biceps i triceps zajmują osobne sloty, ale w sylwetce oba rysują „ramiona” (zgodnie z kartą). Alternatywa (jedna grupa „Ramiona” do liczenia) dałaby lepsze dni push/pull - pytanie P-3 (nieblokujące, domyślnie zostaje osobno).
- Widok: tył, gdy wśród wybranych grup jest plecy lub pośladki i nie ma klatki ani brzucha; w przeciwnym razie przód. Uwaga: to węższe niż `BACK_PRIMARY` w `resolve-exercise-muscles.ts` (tam tył także dla ścięgien, łydek, tricepsa) - świadoma decyzja z karty; nogi-tylko, łydki-tylko i triceps-only = przód.
- Dostępność: sama ikona nie niesie informacji - wiersz musi mieć tekstowy odpowiednik (np. `aria-label`/podpis „Klatka, barki, triceps”).

### D-7 Seria tygodni („N tyg. z rzędu”)
`streakWeeks` ze stats = kolejne tygodnie (wstecz od bieżącego) z co najmniej jedną zakończoną sesją siłową (także bez planu).
- **Znalezisko**: pętla zaczyna od bieżącego tygodnia i przerywa przy braku sesji; w poniedziałek rano (jeszcze bez treningu) seria = 0 mimo 10 poprzednich tygodni. Chip „N tyg. z rzędu” będzie wtedy znikał/kłamał.
- **Rekomendacja (BR-8, Should)**: jeśli bieżący tydzień nie ma jeszcze sesji, licz serię od poprzedniego tygodnia (seria „żyje” do końca bieżącego tygodnia). Zmiana w współdzielonym `treningi-hub-stats` (używa tego też `actions/workout-finish-context.ts` oraz Home) - wymaga uwagi architekta i testu. Jeśli odrzucone: chip ukryty przy 0 (nie „0 tyg.”).

## 4. Założenia
- Z1: Zakres = tylko ekran Trening; dolne menu, `/active-workout`, `/workout-history`, `/progress`, kreator planu w Profilu bez zmian.
- Z2: Liczba dni planu 1..7 (potwierdzone w poleceniu); nie ma w kodzie twardego limitu - ekran musi znieść więcej (np. 10) bez złamania układu (pasek segmentów zawija lub skaluje się).
- Z3: Nowa treść pochodzi z istniejących danych (`workouts.exercises` JSON, plany). Zero nowych kolumn i zero nowego zbierania danych.
- Z4: Interfejs po polsku, złota paleta aplikacji; brak koloru zielonego i czerwonego dla stanu „wykonany”.
- Z5: Ciężary w kg.

## 5. User stories i kryteria akceptacji

### US-1 Nagłówek i status tygodnia (Must)
Jako osoba ćwicząca chcę widzieć w nagłówku nazwę ekranu, zakres bieżącego tygodnia i serię tygodni, aby od razu wiedzieć, w którym punkcie tygodnia jestem.

- AC-1.1 Given dowolny stan, When ekran się ładuje, Then nagłówek zawiera „Trening”, zakres tygodnia w formacie „pon-ndz DD.MM-DD.MM” (dni lokalne) i nie zawiera kickera „PLAN · N DNI · N TYG.” ani samotnej cyfry bez jednostki.
- AC-1.2 Given `streakWeeks >= 1`, When render, Then chip „N tyg. z rzędu” z poprawną odmianą (1 tydzień z rzędu / 2-4 tygodnie z rzędu / 5+ tygodni z rzędu); Given `streakWeeks = 0`, Then chip jest ukryty (nie „0”).
- AC-1.3 Given zmiana tygodnia o północy lokalnej (aplikacja otwarta w niedzielę 23:59), When użytkownik wraca na ekran w poniedziałek, Then zakres, segmenty i liczniki dotyczą nowego tygodnia (ekran odświeża `today`, bez przeładowania ręcznego po wejściu na kartę).
- AC-1.4 Given zmiana strefy czasowej urządzenia, When ekran się renderuje, Then „dziś” i tydzień liczone są w jednej strefie dla segmentów i liczników (patrz AC-2.4).

### US-2 Karta tygodnia (Must)
Jako osoba ćwicząca chcę widzieć jedną kartę z realizacją siłowni i cardio w tygodniu, aby ocenić, czy trzymam plan.

- AC-2.1 Given plan z N dniami, When render, Then „Siłownia X / N” i pasek z dokładnie N segmentów (N = liczba dni planu, 1..7, a dla >7 nadal 1 segment na dzień bez przepełnienia kontenera); X = liczba segmentów wypełnionych (D-3).
- AC-2.2 Given segment dnia wykonanego w tygodniu, Then jest wypełniony; Given dzień „Następny”, Then ma obrys; Given dzień następny i jednocześnie wykonany (wszystko zrobione), Then jest wypełniony z obrysem; stan nie opiera się wyłącznie na kolorze (każdy segment ma tekstowy odpowiednik dla czytnika ekranu, np. „Dzień 2, wykonany”).
- AC-2.3 Given użytkownik zrobił w tygodniu 4 sesje, w tym 2 razy ten sam dzień i 1 bez planu, a plan ma 3 dni, Then X = liczba różnych dni planu wykonanych (np. 2), nie 4; X nigdy nie przekracza N. (Nie używać surowego `workoutsThisWeek` jako X; ten licznik pozostaje dla innych widoków.)
- AC-2.4 Given segmenty i X, Then wyliczone są z jednego `today` i jednego zestawu danych (nie z dwóch zegarów serwer/klient w sposób dający różne tygodnie).
- AC-2.5 Given cardio w tygodniu, Then pokazane „Cardio M min · S sesji” (odmiana: 1 sesja / 2-4 sesje / 5+ sesji; `M` i `S` z `cardioMinutesThisWeek` i `cardioSessionsThisWeek`, definicja jak w `countableCardioMinutes`); Given brak cardio, Then „Cardio 0 min” bez „0 sesji” lub z neutralnym tekstem; minuty nie pojawiają się nigdzie indziej na ekranie.
- AC-2.6 Given brak planu (N = 0), Then karta pokazuje tylko cardio (brak „0 / 0” i brak pustego paska).
- AC-2.7 Given pierwszy raz bez żadnej historii, Then „Siłownia 0 / N”, wszystkie segmenty puste, bez błędu.

### US-3 Karta „Następny · Dzień N” (Must)
Jako osoba ćwicząca chcę widzieć szczegóły następnego treningu wraz z ostatnimi ciężarami i partiami mięśni, aby wystartować bez wchodzenia w szczegóły.

- AC-3.1 Given co najmniej jeden plan z ćwiczeniami i brak niedokończonego treningu, Then karta pokazuje: „Następny · Dzień N”, nazwę planu (długie nazwy: zawijanie do max 2 linii, potem przycięcie, pełna nazwa dostępna np. przez atrybut tytułu), „N ćwiczeń · ostatnio DD.MM (relatywnie)” z poprawną odmianą liczby (1 ćwiczenie / 2-4 ćwiczenia / 5+ ćwiczeń), pierwsze 3 ćwiczenia, sylwetkę partii, przycisk „Rozpocznij trening”.
- AC-3.2 Given dzień „Następny” jest zgodny z D-4 (test na zestawie: nigdy niewykonany wygrywa; najstarsza data; remis -> najniższy numer dnia po zatwierdzeniu P-2).
- AC-3.3 Given plan ma więcej niż 3 ćwiczenia, Then pod trzema widać „+ N kolejne” (poprawna odmiana: +1 kolejne, +2..4 kolejne, +5 kolejnych - brzmienie do zatwierdzenia przez ux); Given dokładnie 3 lub mniej, Then bez tej linii.
- AC-3.4 Given ostatnia sesja tego planu zawiera ćwiczenie z ukończonymi seriami, Then przy ćwiczeniu widać „ciężar × powtórzenia” serii wg D-5 (np. „80 kg × 8”); ciężary dziesiętne w formacie polskim (np. „52,5 kg”).
- AC-3.5 Given pierwszy trening tego planu (brak historii), Then zamiast ciężarów widać docelowe „serie × powtórzenia” z planu (np. „3 × 10”) lub brak wartości w jednolity sposób; w linii meta „pierwszy raz” (nie „ostatnio —”); brak błędu i brak pustych nawiasów.
- AC-3.6 Given ćwiczenie nowe w planie (nie było w ostatniej sesji) albo bez ukończonych serii, Then to ćwiczenie pokazuje spójny zamiennik (np. „nowe”/cel z planu), a pozostałe nadal mają ciężary.
- AC-3.7 Given ćwiczenie z masą ciała (ciężar 0), Then wyświetla „× N powt.” bez „0 kg”.
- AC-3.8 Given dzień bez rozpoznanych mięśni (wszystkie `null`/`cardio`), Then w miejscu sylwetki ikona sztangi, bez błędu, bez pustego obszaru.
- AC-3.9 Given kliknięcie „Rozpocznij trening”, Then otwiera się ten sam wybór solo/grupa co dziś, a sesja startuje z wybranego planu; w trakcie ładowania przycisk blokowany z etykietą „Startuję…” (bez podwójnego startu).
- AC-3.10 Given brak sieci przy starcie (PWA/offline) i dane planu już załadowane, Then start solo działa jak dziś (stan lokalny); brak ciężarów z poprzedniej sesji nie blokuje startu. Ekran nie pokazuje błędu zamiast karty.
- AC-3.11 Given plan następny ma 0 ćwiczeń i nie ma innego dnia z ćwiczeniami, Then karta pokazuje „Dzień N jest pusty” i przycisk „Uzupełnij plan” (link do edycji planu) zamiast nieaktywnego startu.
- AC-3.12 Given niedokończony trening (lokalny store, po hydratacji), Then zamiast karty „Następny” pokazana jest karta „Niedokończony trening” z: nazwą, liczbą ćwiczeń i podglądem, „Zaczęty dziś / Sesja w toku”, przyciskiem „Kontynuuj trening”, linkiem „Dziennik obciążeń” i akcją „Porzuć” (zachowanie obecne). „Porzuć” wymaga potwierdzenia (obecnie kasuje stan jednym tapem - ryzyko utraty serii; Should, P-5).
- AC-3.13 Given trwa hydratacja store, Then nie dochodzi do skoku układu: rezerwowane miejsce karty lub neutralny szkielet, a nie mignięcie karty „Następny” zastąpionej „Niedokończonym”.
- AC-3.14 Given brak planów, Then karta „Dodaj plan treningowy” z jednym CTA „Ustaw plan” (obecny tekst zachowany; w dolnej sekcji dni nie powtarzać drugiego tego samego CTA - jedna droga do ustawienia planu na ekranie, patrz AC-4.9).
- AC-3.15 Given dwa urządzenia, na jednym trwa trening, Then drugie urządzenie nie ma obowiązku pokazywać „Niedokończony” (stan lokalny + chmurowy push jak dziś); ekran nie może wywołać startu drugiej sesji bez uprzedniego ostrzeżenia, jeśli stan niedokończony jest znany (zachowanie obecne - nie pogarszać).

### US-4 Dni planu w jednym panelu (Must)
Jako osoba ćwicząca chcę zwartej listy dni z ikoną partii mięśni i statusem, aby szybko wybrać dzień, także inny niż „następny”.

- AC-4.1 Given N dni (1..7 i więcej), Then jeden panel z N wierszami i separatorami, w kolejności Dzień 1..N (D-2); brak etykiet „D1..D5”.
- AC-4.2 Given wiersz, Then zawiera: ikonę-sylwetkę z max 3 zaznaczonymi grupami (D-6), nazwę planu, podpis „Dzień N · N ćw. · DD.MM” (lub „jeszcze nie robiony” gdy nigdy; data tylko raz - BR-9).
- AC-4.3 Given dzień wykonany w tygodniu, Then ptaszek w rogu ikony w kolorze złotym/neutralnym z palety (bez zielonego chipu „Wykonano”).
- AC-4.4 Given dzień „Następny”, Then złota ramka i etykieta „Następny”; nie ma etykiety „Dziś” i nie ma drugiego przycisku startu w tym wierszu poza standardowym tapem.
- AC-4.5 Given tap w wiersz, Then start treningu tego dnia (ta sama ścieżka co przycisk karty, z wyborem solo/grupa). Brak osobnych celów kliknięcia w wierszu poza menu ⋮ (min. 44 px dla obu).
- AC-4.6 Given menu ⋮, Then trzy pozycje: Start, Dziennik obciążeń, Podgląd ćwiczeń. „Dziennik obciążeń” prowadzi do `/workout-history` (jak dziś; przekierowanie filtrujące po planie poza zakresem), „Podgląd ćwiczeń” otwiera listę ćwiczeń dnia (nazwa, serie × powtórzenia) bez startu. Menu obsługiwane klawiaturą i czytnikiem ekranu, zamykane Esc/tapem poza.
- AC-4.7 Given dzień bez ćwiczeń, Then wiersz pokazuje ikonę sztangi i „0 ćw.”; tap prowadzi do edycji planu (nie jest martwy); „Start” w menu nieaktywny z powodem.
- AC-4.8 Given długa nazwa (np. 60 znaków, emoji, brak spacji), Then nazwa przycinana w jednej linii z wielokropkiem, układ nie wypycha ikony, ⋮ ani etykiety „Następny”; testowane przy szerokości 320 px.
- AC-4.9 Given nagłówek sekcji, Then akcje „PDF” i „Edytuj” (obie, gdy są plany); Given brak planów, Then sekcja pokazuje pusty stan z jednym CTA prowadzącym do `/profile/workout-plan` (bez duplikatu CTA z karty z AC-3.14 w tym samym widoku: wystarczy jedno wyróżnione CTA, drugie jako link tekstowy, do decyzji `ux`).
- AC-4.10 Given brak stopki „Tap = … Notes = …”, Then ekran nie zawiera instrukcji tekstowej opisującej gesty.
- AC-4.11 Given dwa plany o tej samej nazwie, Then rozróżnia je numer dnia.
- AC-4.12 Given plan dla 1 dnia, Then panel ma jeden wiersz, a ten dzień jest jednocześnie „Następny”; bez separatora zbędnego.
- AC-4.13 Given ćwiczenie bez rozpoznanego mięśnia w dniu z innymi rozpoznanymi, Then brakujące jest pomijane przy liczeniu D-6.

### US-5 Narzędzia (Must/Should)
Jako osoba ćwicząca chcę mieć pod ręką szybkie skróty, które nie dublują reszty aplikacji, aby szybko dodać cardio, przejrzeć historię lub nagrać technikę.

- AC-5.1 Given ekran, Then narzędzia jako siatka kafelków zamiast sekcji 02-04: Dodaj cardio (`/cardio`), Dziennik (`/workout-history`), Technika (`/technique`); kafelek Rekordy wg rekomendacji poniżej.
- AC-5.2 Given kafelek, Then ma cel dotyku min. 44 px, etykietę tekstową i jedną akcję; nie pokazuje minut cardio (BR-9).
- AC-5.3 Given kafelek Dziennik, Then mówi „historia”/„dziennik”, nie „Postępy” (nazwa „Postępy” jest zajęta przez Analizę).

**Kafelek Rekordy - rekomendacja: usunąć (Won't w tym zadaniu).** Powody: duplikuje dolną zakładkę Analiza (`/progress`), której karta wprost nie zmienia; link i tak prowadzi do ogólnego `/progress`, a nie do rekordów; w poprzednim ekranie „Postępy” było zgłoszone jako dublowanie. Konsekwencja: trzy kafelki (jeden rząd 3 kolumny lub 2×2 z kafelkiem „Edytuj plan” - nie rekomendowane, bo „Edytuj” jest już w nagłówku dni). Jeśli właściciel chce 2×2: czwarty kafelek zamiast Rekordów = „Plan (edytuj)”; to decyzja P-1 (domyślnie: 3 kafelki).

### US-6 Dostępność i użycie jedną ręką (Must)
Jako osoba ćwicząca na siłowni chcę, aby ekran był czytelny i obsługiwalny jedną ręką na telefonie, aby nie tracić czasu między seriami.
- AC-6.1 Given 320-430 px szerokości, Then brak poziomego przewijania, wszystkie cele dotyku >= 44 px, kontrast tekstu >= 4,5:1 (mały tekst na tle karty).
- AC-6.2 Given czytnik ekranu, Then segmenty tygodnia, ikony partii i status wiersza mają tekstowy odpowiednik (np. „Dzień 2: Klatka, barki, triceps, wykonany w tym tygodniu, następny”).
- AC-6.3 Given `prefers-reduced-motion`, Then animowane metryki nie animują się.
- AC-6.4 Given pełna pozycja przewijania, Then przycisk „Rozpocznij trening” jest w pierwszym ekranie (above the fold) na 360×640 px.

## 6. Reguły biznesowe
- BR-1 Tydzień = pon-nd lokalnie; jeden „dziś” dla wszystkich obliczeń ekranu.
- BR-2 Wykonany w tygodniu = `lastWorkoutDate` planu w bieżącym tygodniu (D-3); sesje bez planu nie wypełniają segmentów.
- BR-3 Następny dzień = kolejka `comparePlansByWorkoutRecencyAsc`; tie-break wspólny z Home: najniższy numer dnia (po zatwierdzeniu P-2).
- BR-4 Dzień bez ćwiczeń nie jest „Następny”, jeśli istnieje dzień z ćwiczeniami; nigdy martwy tap.
- BR-5 Numer dnia stały (createdAt asc), lista w kolejności numerów, nie kolejki.
- BR-6 Ostatnie obciążenie = najcięższa ukończona seria ćwiczenia w ostatniej sesji tego planu; brak -> zamiennik, nigdy „0 kg”/„NaN”.
- BR-7 Grupy mięśni: wg D-6; max 3; deterministyczne; tylko partia główna; widok przód/tył wg zasady z karty.
- BR-8 Seria tygodni nie zeruje się w tygodniu, w którym jeszcze nie było treningu (Should).
- BR-9 Każda informacja raz: data ostatniego treningu raz w wierszu, minuty cardio raz w karcie tygodnia, jedno CTA startu na dzień.
- BR-10 Kolor stanu wykonanego z palety złota; stan nigdy tylko kolorem.
- BR-11 Niedokończony trening ma pierwszeństwo przed kartą „Następny”.
- BR-12 Odmiana polska liczebników (ćwiczenie/ćwiczenia/ćwiczeń, tydzień/tygodnie/tygodni, sesja/sesje/sesji) w jednym miejscu, z testem jednostkowym.

## 7. Priorytety (MoSCoW) i zależności
| Priorytet | Pozycje |
|---|---|
| Must | US-1, US-2, US-3 (w tym stany: niedokończony, brak planu, pusty plan), US-4, US-6, BR-5 (stały numer dnia) |
| Should | BR-8 (seria nie zeruje się w poniedziałek), BR-3 wspólny tie-break z Home, potwierdzenie „Porzuć” (AC-3.12), podgląd ćwiczeń w menu |
| Could | Ciężar z dowolnego planu jako fallback; cel cardio (np. „/ 150 min”) na karcie tygodnia |
| Won't (teraz) | Kafelek Rekordy, zmiany dolnego menu, filtr dziennika po planie, edycja kolejności dni z tego ekranu |

Zależności: US-3 (ciężary) zależy od nowego zapytania o ostatnią sesję planu; US-4/US-3 (ikony) od D-6 (mapowanie z `resolve-exercise-muscles` + `analytics/muscle-groups`) i od ikon sylwetki (`ux`); US-2 zależy od D-2 (stały numer) i D-3.

## 8. Wpływ na Android i Java backend
- `app/api/android/*` zawiera tylko `version` i `download`; ekran Trening z nich nie korzysta. Java backend (`/api/body-reports`, `/api/workouts/complete`, version/health) też nie dostarcza danych tego ekranu - dane przychodzą z handlerów TS/Drizzle przez RSC.
- Android = WebView produkcyjnej strony: zmiana UI jest automatycznie widoczna, bez nowej wersji APK; wymaga testu w WebView (cele dotyku, safe-area, menu ⋮).
- Kontrakty współdzielone w web: `getWorkoutPlansWithLastWorkout` (używane przez `/active-workout` i Home) oraz `getTreningiHubStats` (Home, `workout-finish-context`). Zmiany DTO mają być addytywne; zmiana definicji serii (BR-8) i tie-breaku kolejki (BR-3) wpływa na Home i ekran „Trening zrobiony” - uwzględnić w testach regresji.
- Zapis `workouts/complete` w Javie: bez zmian (ekran tylko czyta).

## 9. Wymagania niefunkcjonalne
- Wydajność: ekran renderowany serwerowo; dodatkowe dane (ostatnia sesja następnego planu) to maks. 1 dodatkowe zapytanie i parsowanie jednego JSON-a; bez N+1 po dniach planu; cel LCP < 2,5 s na 4G. Limity Turso (odczyty) - nie skanować historii.
- Offline/PWA: stan karty „Niedokończony”, start solo i wyświetlenie ostatnio załadowanego ekranu działają bez sieci; ciężary to dane z ładowania serwerowego (brak = zamiennik, bez błędu).
- Spójność z `lib/admin-config-status.ts`: brak nowych zmiennych środowiskowych.
- Bezpieczeństwo: dane tylko zalogowanego użytkownika (filtr `user_id`); brak nowych endpointów publicznych (decyzja architektoniczna po stronie `architekt`).
- Telemetria/logi: brak wartości ciężarów i nazw ćwiczeń w logach i Sentry.

## 10. Prywatność (do `prawnik`)
Ekran nie wprowadza nowych danych: ciężary i ćwiczenia już są zapisane w `workouts.exercises`, a grupy mięśni są wyliczane w locie i nie są przechowywane. Dane treningowe są danymi o zdrowiu/aktywności; wymagania: brak ich w logach i Sentry, brak nowego udostępniania (start grupowy nie przekazuje ciężarów), brak cache współdzielonego między użytkownikami. Oczekiwany werdykt: brak wpływu / bez nowej zgody.

## 11. Ryzyka
| Ryzyko | Skutek | Mitygacja |
|---|---|---|
| Zmiana tie-breaku/serii wpływa na Home i ekran końca treningu | Regresja widoków poza zakresem | Zmiany addytywne, testy `workout-plan-queue` i `treningi-hub-stats` |
| Nieregularne JSON-y sesji (stare formaty, brak `done`) | Błędne ciężary | Parser odporny, zamiennik zamiast błędu (AC-3.6) |
| Niedopasowanie ćwiczeń po nazwie | Brak/mylny ciężar | Dopasowanie po tożsamości ćwiczenia (D-5) |
| Mapowanie mięśni heurystyczne (`inferMuscleCategoryFromName`) | Błędna ikona dla niestandardowych ćwiczeń | Brak rozpoznania -> sztanga; podpis tekstowy |
| Niedokończony trening z innego dnia | Mylące „Sesja w toku” | Zachowane jawne rozróżnienie „Zaczęty dziś / Sesja w toku” |
| Mignięcie karty po hydratacji | Skok układu | AC-3.13 |
| Różnica stref czasowych serwer/klient | Zły tydzień | AC-1.4, AC-2.4 |
| Przycisk „Porzuć” bez potwierdzenia | Utrata serii | Potwierdzenie (Should) |

## 12. Pytania otwarte (nieblokujące; z odpowiedzią domyślną)
- P-1 Czy zostawić kafelek Rekordy? Domyślnie: nie, 3 kafelki (Dodaj cardio, Dziennik, Technika).
- P-2 Czy ujednolicić tie-break kolejki (najniższy numer dnia) także dla Home? Domyślnie: tak, mała zmiana w `lib/workout-plan-queue.ts` z testem.
- P-3 Czy biceps i triceps liczyć jako jedną grupę „Ramiona” przy wyborze max 3? Domyślnie: nie, osobno (zgodnie z kartą).
- P-4 Czy poprawić serię tygodni (nie zerować w poniedziałek rano)? Domyślnie: tak (BR-8, Should).
- P-5 Czy dodać potwierdzenie „Porzuć”? Domyślnie: tak.

Żadne z pytań nie blokuje etapu 2 (prawnik) ani 3 (architekt); decyzje domyślne zapisano jako założenia.

## Werdykt
ZATWIERDZONE Z UWAGAMI. Uwagi dla kolejnych etapów: architekt - stały numer dnia w DTO, jedno zapytanie o ostatnią sesję, wspólna definicja „dziś/tydzień”, współdzielone kontrakty z Home; ux - tekstowe odpowiedniki ikon, stany z sekcji 5; prawnik - sekcja 10.
