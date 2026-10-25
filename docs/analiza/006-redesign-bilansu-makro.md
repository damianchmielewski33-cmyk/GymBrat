# 006 - Bilans makro „MAKRO DZIŚ” (Statystyki bilansu): audyt poprawności i redesign - wymagania

- **Zadanie**: `docs/zadania/006-redesign-bilansu-makro.md`
- **Autor**: analityk (etap 1)
- **Data**: 2026-10-25
- **Gałąź**: brak zmian kodu w tym etapie. Implementacja (po decyzji właściciela) na nowej gałęzi od `main`, NIE na `feat/koniec-treningu-flow` (ta gałąź ma niezcommitowane zmiany zadania 005).
- **Status dokumentu**: wymagania do decyzji właściciela (sekcja 13) przed etapem 3 (architekt) i 4 (ux). Dokument nie zawiera kodu ani decyzji technicznych.
- **Źródło faktów o kodzie**: wynik researchu koordynatora (pliki wskazane w sekcji 2). Fakty nie zostały ponownie zweryfikowane przez analityka; punkty wymagające potwierdzenia oznaczono jako „do weryfikacji” w sekcji 3.

---

## 1. Kontekst i cel

Ekran „Statystyki bilansu” (nagłówek „MAKRO DZIŚ”) w zakładce Dieta/Analiza pokazuje bilans makroskładników (kalorie, białko, węglowodany, tłuszcz) względem celów: dzisiaj, suma od poniedziałku do dziś oraz karty dzienne wstecz. Zlecenie obejmuje cztery obszary:

1. **Analizę techniczną i wizualną** obecnego ekranu (sekcje 2-3).
2. **Propozycję nowego wyglądu** (kierunek dla `ux`, sekcja 9).
3. **Zmiany architektoniczne i techniczne** (kierunki dla `architekt`, sekcja 10).
4. **Audyt poprawności danych i wyliczeń** - czy wszystko wyświetlane jest poprawnie przekazywane i liczone (sekcja 3).

Plus: nową architekturę i makietę - makietę wykona `ux` (etap 4), architekturę `architekt` (etap 3) na podstawie tego dokumentu.

**Cel biznesowy**: osoba prowadząca dietę po otwarciu ekranu w 5 sekund wie, czy dziś i w tygodniu trzyma się celu, co konkretnie odbiega i czy warto coś zmienić. Liczby muszą być wiarygodne - rozjazd między ekranami lub błędny status „brakuje” podważa zaufanie do całej zakładki Dieta.

**Zakres tego etapu**: wyłącznie analiza, propozycja i makieta. Brak implementacji w tym przebiegu.

---

## 2. Stan obecny (ze zrzutów i researchu kodu)

### 2.1 Elementy ekranu

| # | Element | Zawartość | Źródło (wg researchu) |
|---|---|---|---|
| E-1 | Nagłówek | „MAKRO DZIŚ”, podtytuł z zakresem dat „19-25 października 2026 · pn→dziś”, link „Tydzień →” | `components/nutrition/nutrition-today-view.tsx`, dane z `app/(dashboard)/nutrition/today/page.tsx` |
| E-2 | „BRAKI I NADWYŻKI” | Lista pozycji „dzień · makro — brakuje/za dużo X — realizacja % (odchylenie %)”, od dziś wstecz | `collectDayHighlights` w `lib/nutrition-day-balance.ts` |
| E-3 | „DZIŚ” | Data (np. „Niedziela, 25 października”), badge „3 odchył.”, 4 paski: kalorie, białko, węglowodany, tłuszcz (wartość / cel, delta, %) | `buildDayMacroBalance` |
| E-4 | „SUMA PN→DZIŚ” | 4 paski: suma spożycia vs suma celów z dni z danymi | `buildPeriodMacroBalance` (liczona lokalnie z `dayRows`) |
| E-5 | Karty dzienne | Dla każdego dnia wstecz (Czwartek, Środa, Wtorek, Poniedziałek): te same 4 paski i liczba odchyleń | `buildDaysMacroBalance`, komponent `DayCard` |
| E-6 | Wspólne elementy | `HighlightList`, `DayCard`, `MacroStatRow` | `nutrition-today-view.tsx` |

### 2.2 Przepływ danych (wg researchu)

1. `app/(dashboard)/nutrition/today/page.tsx` (RSC) wywołuje `lib/nutrition-dashboard.ts` (`loadNutritionWeekHistory`, `applyProfileGoalsAndManualConsumption`).
2. Spożycie z `meal_logs` przez `lib/meal-logs.ts`; cele z profilu przez `lib/nutrition-goals.ts` (`resolveProfileDayGoals`: training/rest wg typu dnia, fallback; `mergeSummaryWithProfileGoals`).
3. Komponent kliencki otrzymuje surowe `consumed` / `goal` i **na kliencie** w `useMemo` wylicza `%`, delty, statusy, sumy i highlights, importując `lib/nutrition-day-balance.ts` i `lib/nutrition-week-stats.ts` (`adherencePct`, `rollupMacroThroughIndex`).
4. Brak osobnego endpointu zwracającego gotowe wartości procentowe.

### 2.3 Reguły już zaszyte w kodzie (wg researchu, do potwierdzenia testami)

- Odchylenie: `delta = spożycie − cel`; `deltaPct` względem celu.
- Status „w normie”: |odchylenie| ≤ 5 pp **lub** |delta| < 1 jednostka.
- Zgodność przykładów ze zrzutu z tym wzorem: „91% (-9%)” i „107% (+7%)” - wzór `realizacja = spożycie / cel × 100`, `odchylenie % = realizacja − 100`.
- Suma PN→DZIŚ: lokalna agregacja `dayRows`, nie `buildWeeklyNutritionRollup`.

### 2.4 Powiązany ekran o podobnej funkcji

- `components/home/week-nutrition-sheet-body.tsx` (arkusz „Ten tydzień” na Start) korzysta z `buildWeeklyNutritionRollup` (`lib/nutrition-goals.ts`) - **równoległa ścieżka** sum tygodniowych. To jest główne ryzyko spójności (AU-1).

---

## 3. Audyt poprawności danych i wyliczeń

Legenda priorytetu: **W** = wysoki (wpływa na to, co użytkownik rozumie jako prawdę lub na decyzje), **Ś** = średni, **N** = niski. Kolumna „Weryfikuje” wskazuje, kto ma potwierdzić punkt w kodzie/testach.

| ID | Obszar | Obserwacja / hipoteza | Ryzyko | Pri. | Weryfikuje |
|---|---|---|---|---|---|
| AU-1 | Dwie ścieżki sum tygodniowych | Bilans liczy sumę PN→DZIŚ lokalnie (`buildPeriodMacroBalance`), arkusz Start przez `buildWeeklyNutritionRollup`. Dla tego samego tygodnia mogą wyjść różne sumy (inne dni wchodzące do sumy, inne zaokrąglanie, inna obsługa dni bez celu). | Użytkownik widzi dwie różne „sumy tygodnia”. Duplikacja logiki utrudnia każdą późniejszą zmianę. | W | architekt (test porównawczy na tych samych danych) |
| AU-2 | Suma PN→DZIŚ a dzisiejszy dzień niepełny | Suma zestawia spożycie dziś (częściowe, bo dzień trwa) z pełnym celem dziennym dziś. Skutek: systematyczne „brakuje” w sumie tylko z powodu pory dnia. | Fałszywy wniosek o niedoborze. | W | architekt, analityk (decyzja BR-5) |
| AU-3 | Ocena „brakuje” w trakcie dnia | Highlights „Dziś · Białko — brakuje 19g” są wystawiane dla dnia, który jeszcze trwa. | Ocena przedwczesna, zwłaszcza rano. | W | ux, analityk (BR-3) |
| AU-4 | Dni bez żadnego wpisu | Nie wiadomo, czy dzień bez `meal_logs` generuje pozycje „brakuje 100%” dla każdego makro (szum na liście) czy jest traktowany jako „brak danych”. Do potwierdzenia w testach. | Lista zalana fałszywymi odchyleniami; nieprawdziwa suma celów (cel dnia bez spożycia). | W | architekt, tester (przy implementacji) |
| AU-5 | Dzielenie przez zero / brak celu | Cel 0 lub `null` (np. brak ustawionych makro w profilu, fallback) może dać `NaN`/`Infinity` w `%` lub pustą wartość. | Błędne napisy na ekranie, błąd renderowania. | Ś (wysoki, jeśli wystąpi) | architekt (sprawdzenie guardów w `buildMacroBalance`) |
| AU-6 | Zaokrąglenia | Delta w jednostkach (g/kcal) i % liczone na wartościach zaokrąglanych w różnej kolejności mogą dać niezgodność pary np. „brakuje 19g” / „91%” o 1 pkt w jedną stronę. | Drobna niespójność, którą zauważy uważny użytkownik. | Ś | architekt, tester (przypadki na granicach) |
| AU-7 | „Dziś” po stronie klienta | Dane dzienne przychodzą z serwera (granice dnia wg serwera/profilu), a `useMemo` na kliencie może użyć lokalnego `Date` przeglądarki. Ryzyko: rozjazd dnia przy północy, przy zmianie strefy lub przy różnicy strefy profilu i urządzenia. | Dzisiejsza karta i lista wskazują inny dzień niż dane; zdublowany lub brakujący dzień. | W | architekt (źródło „dziś”), analityk (BR-9) |
| AU-8 | Wybór celu wg typu dnia | `resolveProfileDayGoals` wybiera cel treningowy/odpoczynkowy wg typu dnia. Nie wiadomo, czy dla dni historycznych używany jest typ dnia z chwili zapisu (snapshot), czy aktualny plan/profil. Zmiana planu może wtedy przepisać historię. | Zmiana historii bez wiedzy użytkownika; „brakuje” wg innego celu niż ten, który obowiązywał. | Ś | architekt, analityk (Q-O2) |
| AU-9 | Spójność kcal z makro | Nie wiadomo, czy cele B/W/T są zgodne z celem kcal (4/4/9 kcal/g) i czy rozbieżność jest komunikowana. | Użytkownik dostaje sprzeczne cele. | Ś | architekt (sprawdzenie generatora celów w profilu) |
| AU-10 | Wpisy ręczne a `meal_logs` | `applyProfileGoalsAndManualConsumption` łączy cele z realnym spożyciem. Do potwierdzenia, czy wpisy ręczne (manual consumption) nie dublują się z posiłkami z `meal_logs`. | Podwójne liczenie spożycia (zawyżona kcal/makro). | W (jeśli występuje) | architekt |
| AU-11 | Produkt bez wartości odżywczych | Posiłek z produktem bez części makro najpewniej liczy brak jako 0 (cicha niedoszacowanie). | Zaniżone spożycie, fałszywe „brakuje”. | W | architekt, analityk (BR-8) |
| AU-12 | Sortowanie i zakres list | Lista „BRAKI I NADWYŻKI” łączy kolejność dat (dziś wstecz) z kolejnością makro; brak jasnego kryterium ważności. | Trudność w ocenie, co pilne. | N | ux |
| AU-13 | Badge „N odchył.” | Liczba odchyleń na karcie dnia powinna być dokładnie liczbą pozycji tego dnia na liście. Do potwierdzenia. | Sprzeczne liczniki. | N | tester (przy implementacji) |
| AU-14 | Semantyka odchyleń | „Za dużo kcal” i „brakuje białka” są dziś prezentowane tym samym językiem odchylenia, bez rozróżnienia, co jest niepożądane. Węglowodany ponad cel w dzień treningu bywają celowe. | Mylące komunikaty, presja „czerwonych” pozycji. | Ś | analityk (Q-O3), ux |
| AU-15 | Kolor i dostępność | Status „w normie/odchylenie” może być komunikowany wyłącznie kolorem. | Dostępność (WCAG). | Ś | ux, tester |
| AU-16 | Parytet z Android i Java | Nie ustalono, czy Android (`android/`) lub `java-backend/` implementuje ten sam bilans/sumy. | Rozjazd między klientami. | Ś | architekt (do sprawdzenia przed projektem) |

**Wynik ogólny**: wyliczenia procentów i delt są spójne z przykładami na zrzutach. Ryzyka skupiają się w trzech miejscach: (a) dwie ścieżki sum (AU-1), (b) semantyka „dziś”/dni bez danych/dnia niepełnego (AU-2, AU-3, AU-4, AU-7), (c) liczenie po stronie klienta bez gotowego modelu widoku (AU-7, AU-5). Nie stwierdzono na tym etapie błędu, który już dziś podaje fałszywą liczbę dla pełnego, zamkniętego dnia - wymaga to potwierdzenia testami (architekt/tester).

---

## 4. Interesariusze i cele

| Interesariusz | Cel na tym ekranie |
|---|---|
| Osoba prowadząca dietę (początkująca) | Zrozumieć, co znaczy „brakuje” i co zrobić; nie czuć się oceniana za dzień, który trwa. |
| Osoba prowadząca dietę (zaawansowana) | Szybko zobaczyć odchylenia tygodnia i wzorce (np. zawsze mało białka w dni odpoczynku). |
| Osoba trenująca (dzień treningowy vs odpoczynkowy) | Widzieć właściwy cel dla danego dnia; nie dostawać fałszywego alarmu za wyższe węglowodany w dzień treningu (decyzja AU-14). |
| Administrator / właściciel produktu | Jedna prawda o sumach tygodnia w całej aplikacji; brak rozjazdu z arkuszem Start. |
| Zespół (frontend, architekt, tester) | Jedno źródło wyliczeń, testowalne funkcje czyste; prosty model widoku. |
| Użytkownik korzystający z telefonu w drodze | Odczyt na małym ekranie w kilka sekund; działanie przy słabej sieci (dane już załadowane). |

---

## 5. Założenia

- **A-1.** Zakres to ekran Bilans (`nutrition/today`) i logika, na której się opiera. Arkusz „Ten tydzień” na Start jest objęty zmianą wyłącznie w zakresie wspólnej logiki sum (AU-1), bez redesignu tego arkusza.
- **A-2.** Nie zmieniamy wzoru celów (kcal, B/W/T) ani algorytmu generowania celów w profilu - tylko sposób ich prezentacji i sumowania.
- **A-3.** „Tydzień” = poniedziałek-niedziela wg lokalnego kalendarza użytkownika; widok obejmuje dni od poniedziałku do dziś (jak dziś). Nawigacja do poprzednich tygodni (link „Tydzień →”) pozostaje, jak działa dziś.
- **A-4.** Brak nowych danych osobowych ani zdrowotnych: używamy wyłącznie tego, co już jest w `meal_logs` i profilu celów.
- **A-5.** Ekran działa na danych już załadowanych (SSR/RSC); brak nowego wywołania sieciowego przy samym renderze poza istniejącym.
- **A-6.** Próg „w normie” ±5 pp / <1 jednostki zostaje jako punkt wyjścia, do potwierdzenia przez właściciela (Q-O1).

---

## 6. Reguły biznesowe

- **BR-1 (wzór)**: `realizacja % = round(spożycie / cel × 100)`; `odchylenie % = realizacja − 100`; `delta = spożycie − cel` w jednostkach makro. Wartości wyświetlane (g, kcal, %) pochodzą z jednego zaokrąglenia, bez przeliczania w UI. Do potwierdzenia testami (AU-6).
- **BR-2 (status)**: „w normie” gdy |odchylenie %| ≤ 5 pp albo |delta| < 1 jednostki (stan obecny). Do potwierdzenia przez właściciela per makro (Q-O1).
- **BR-3 (dzień dzisiejszy)**: proponowane - dziś nie jest oceniany jako „brakuje” do końca dnia; pokazujemy „pozostało X” oraz postęp. Ocena (w normie / nadwyżka) dopiero po zakończeniu dnia lub przy przekroczeniu celu (przekroczenie jest oceniane od razu). Q-O2 i ux.
- **BR-4 (dzień bez wpisów)**: proponowane - dzień bez żadnego wpisu ma stan „brak wpisów”; nie generuje odchyleń na liście i nie wchodzi do sumy celów (do potwierdzenia, Q-O2).
- **BR-5 (suma PN→DZIŚ)**: proponowane - suma spożycia i suma celów obejmują wyłącznie dni z przynajmniej jednym wpisem; dzisiejszy cel wchodzi do sumy tylko, gdy dzisiejsze spożycie jest niezerowe, a ocena dzisiejszej części jest oznaczona jako „w trakcie” (alternatywa: cel pro-rata, do wyboru przez architekta). Jedna definicja dla wszystkich ekranów (BR-6).
- **BR-6 (jedno źródło)**: suma tygodniowa jest liczona w jednym miejscu i używana przez Bilans i arkusz Start. Wynik dla tego samego tygodnia i danych jest identyczny.
- **BR-7 (cel dnia)**: cel dla dnia historycznego odpowiada typowi dnia obowiązującemu w tym dniu (decyzja snapshot vs bieżący plan - Q-O2 / AU-8).
- **BR-8 (brak wartości)**: brakująca wartość makro produktu nie jest zerem; dzień, w którym część produktów ma niepełne dane, dostaje oznaczenie „niepełne dane” i nie jest oceniany jako niedobór bez tej adnotacji.
- **BR-9 (granice dnia)**: „dziś”, „pn→dziś” i przynależność posiłku do dnia są wyznaczane jednym źródłem (strefa czasowa ustalona w systemie) i są identyczne w danych, na liście i w nagłówku; zmiana strefy lub przejście przez północ nie duplikuje ani nie pomija dnia.
- **BR-10 (kolejność)**: lista odchyleń: najpierw dziś, potem dni wstecz; w obrębie dnia - stałe kryterium (proponowane: nadwyżki wg wagi kalorii, potem niedobory białka, potem pozostałe) - do decyzji ux.
- **BR-11 (licznik)**: badge „N odchył.” równa się liczbie pozycji tego dnia na liście odchyleń (AU-13).

---

## 7. User stories i kryteria akceptacji

**US-1 (jedna prawda o sumie tygodnia)** - Jako osoba prowadząca dietę chcę, aby suma tygodnia była taka sama na Bilansie i na arkuszu „Ten tydzień”, aby nie zastanawiać się, której liczbie wierzyć.
- *Given* ten sam użytkownik i te same wpisy posiłków za tydzień, *When* otwieram Bilans i arkusz „Ten tydzień”, *Then* sumy spożycia i celów dla każdego makro są identyczne.
- *Given* dzień bez wpisów w środku tygodnia, *When* liczę sumę, *Then* ten dzień nie zmienia sumy celów (BR-4) i obie powierzchnie to pokazują tak samo.

**US-2 (dzisiejszy dzień bez fałszywego alarmu)** - Jako osoba prowadząca dietę chcę, aby dzisiejszy dzień nie był oceniany jako niedobór przed jego końcem, aby nie dostawać mylącego „brakuje” rano.
- *Given* jest 9:00 i zjadłam 15% dziennego celu białka, *When* patrzę na kartę DZIŚ, *Then* widzę „pozostało X g” i postęp, a nie „brakuje” jako odchylenie.
- *Given* przekroczyłam cel kalorii o 10% w środku dnia, *When* patrzę na kartę DZIŚ, *Then* nadwyżka jest widoczna od razu.

**US-3 (dni bez danych)** - Jako osoba prowadząca dietę chcę, aby dzień bez wpisów był oznaczony jako „brak wpisów”, aby lista nie była zalana fałszywymi brakami.
- *Given* wczoraj nie zapisałam żadnego posiłku, *When* patrzę na listę odchyleń i kartę wczoraj, *Then* nie ma pozycji „brakuje 100%”, a karta mówi „brak wpisów”.
- *Given* pierwsze użycie: konto bez żadnego posiłku, *When* otwieram Bilans, *Then* widzę stan pustego startu z podpowiedzią, bez „0%” i bez błędów.

**US-4 (brak celu)** - Jako osoba bez ustawionego celu makro chcę widzieć czytelny komunikat, aby nie widzieć „NaN” ani „∞”.
- *Given* cel białka = 0 lub brak, *When* patrzę na paski, *Then* pasek pokazuje „brak celu” i nie generuje odchylenia.

**US-5 (zmiana dnia i strefy)** - Jako osoba podróżująca lub korzystająca o północy chcę, aby „dziś” zgadzało się z danymi, aby nie widzieć dnia podwójnie lub wcale.
- *Given* jest 23:55 i dodaję posiłek, *When* przechodzi północ, *Then* posiłek trafia do dnia zgodnego z BR-9 i nagłówek, karta DZIŚ i lista pokazują ten sam dzień.
- *Given* zmieniłam strefę czasową w telefonie, *When* otwieram Bilans, *Then* nie pojawia się dzień zdublowany ani pominięty; wynik zgadza się z dniem profilu/serwera.

**US-6 (produkt bez wartości)** - Jako osoba notująca produkty z niepełnymi danymi chcę, aby to było widoczne, aby nie wierzyć w zaniżone spożycie.
- *Given* posiłek zawiera produkt bez wartości białka, *When* patrzę na dzień, *Then* dzień ma oznaczenie „niepełne dane” i brakująca wartość nie jest liczona jako 0 bez adnotacji.

**US-7 (czytelność na telefonie)** - Jako osoba ćwicząca korzystająca z telefonu chcę, aby kluczowe liczby były czytelne w 5 sekund, aby nie przewijać w poziomie ani nie zgadywać.
- *Given* szerokość ekranu 360 px, *When* otwieram Bilans, *Then* brak przewijania poziomego, a kalorie i postęp dzisiaj są widoczne bez przewijania (pierwszy ekran).
- *Given* status odchylenia, *When* patrzę na pozycję, *Then* status jest podany tekstem (nie tylko kolorem), a kontrast spełnia WCAG AA.

**US-8 (odchylenia do działania)** - Jako osoba prowadząca dietę chcę filtrować odchylenia po makro i widzieć liczbę zgodną z listą, aby szybko znaleźć, co poprawić.
- *Given* 3 odchylenia dziś, *When* patrzę na badge, *Then* liczba jest 3 i lista ma 3 pozycje (BR-11).
- *Given* wybieram filtr „Białko”, *When* patrzę na listę, *Then* widzę tylko pozycje białka, a licznik się zgadza.

**US-9 (nawigacja tygodnia)** - Jako osoba analizująca poprzedni tydzień chcę przejść do widoku tygodnia z „Tydzień →”, aby zobaczyć historię.
- *Given* klikam „Tydzień →”, *When* otwiera się widok tygodnia, *Then* liczby zgadzają się z BR-6 dla wybranego tygodnia (zakres decyzji w Q-O4).

**US-10 (spójność z celem dnia treningowego)** - Jako osoba trenująca chcę, aby dzień treningowy i odpoczynkowy miały właściwy cel, aby ocena nie była myląca.
- *Given* dzień był treningowy, *When* patrzę na kartę tego dnia, *Then* cel jest celem treningowym z tego dnia (BR-7).

---

## 8. Wymagania niefunkcjonalne

- **Mobile first, czas czytania**: najważniejsze liczby dziś widoczne bez przewijania na 360 px.
- **Dostępność**: kontrast tekstu WCAG AA; statusy podane tekstem i ikoną, nie tylko kolorem; poprawne etykiety dla czytników ekranu dla pasków postępu (wartość / cel / %).
- **Wydajność**: brak nowych zapytań przy samym renderze (A-5); 7 dni × 4 makro to mała praca, ale przy nawigacji do dłuższych okresów - zapytania i liczenie muszą być ograniczone (wymóg dla `tester-wydajnosci`, jeśli zakres się rozszerzy).
- **Offline / PWA**: ekran powinien pokazać ostatnio załadowane dane i jasny komunikat „brak połączenia” przy braku sieci; nie wolno pokazać pustego bilansu jako prawdziwego wyniku.
- **Prywatność**: dane o spożyciu są danymi zdrowotnymi. Brak wartości spożycia w logach, Sentry i w URL. Brak nowych danych poza istniejącymi.
- **Koszty**: brak nowych usług; limity Turso/Vercel nie zmieniają się istotnie przy redesignie bez nowych zapytań.
- **Język**: interfejs po polsku, spójna mikrokopia (np. „pozostało”, „brak wpisów”, „brak celu”, „niepełne dane”).
- **Testowalność**: wyliczenia jako czyste funkcje z testami jednostkowymi (wartości graniczne, zero, brak celu, dzień niepełny, dzień bez wpisów, zaokrąglenia).

---

## 9. Kierunek nowego wyglądu (wejście dla `ux`, nie makieta)

Propozycja kierunku, którą `ux` ma zweryfikować i rozwinąć w makietę:

1. **Hero „Dziś”** na górze: cztery makro w kompaktowej formie (np. wskaźniki postępu lub paski z liczbą „zjedzone / cel” i „pozostało”), z jednym zdaniem stanu dnia zamiast etykiet „brakuje/za dużo” w połowie dnia.
2. **Pasek tygodnia** pod hero: suma PN→DZIŚ z wyraźnie opisaną bazą („N dni z wpisami”), z tym samym formatowaniem co arkusz Start.
3. **Odchylenia** jako lista zgrupowana po dniach, z filtrem po makro i licznikiem zgodnym z listą; semantyka „za dużo / za mało” zależna od makro (AU-14).
4. **Karty dni** jako zwijane wiersze: w stanie zwiniętym jeden pasek ogólny i status (w normie / odchylenie / brak wpisów / niepełne dane); po rozwinięciu cztery paski.
5. **Stany specjalne** zaprojektowane od razu: brak wpisów, brak celu, niepełne dane, dzień w trakcie, brak połączenia.
6. Zachować „Tydzień →” jako wejście do widoku tygodnia.

Tokeny kolorów i nazewnictwo mają pochodzić z istniejącego systemu projektowego (`docs/ux/`); `ux` ma wskazać, które elementy są nowe.

---

## 10. Kierunki architektoniczne (wejście dla `architekt`, decyzje po jego stronie)

Analityk nie projektuje architektury; wskazuje wymagania, które musi spełnić:

1. **Jedno źródło wyliczeń** (BR-1, BR-6, AU-1): sumy, %, delty, statusy i highlights w jednym module czystych funkcji, używanym przez Bilans i arkusz Start. Architekt decyduje, czy scala się `buildWeeklyNutritionRollup` z `buildPeriodMacroBalance`, czy wyznacza się jeden model.
2. **Gdzie liczyć model widoku** (AU-7, AU-5): do rozstrzygnięcia przez architekta - wariant A: przygotowanie gotowego modelu widoku po stronie serwera (RSC) i przekazanie go do komponentu prezentacyjnego; wariant B: utrzymanie liczenia na kliencie, ale z jednym źródłem „dziś” i strefą z profilu. Analityk zwraca uwagę, że wariant A usuwa rozjazd dnia między klientem a serwerem, ale wymaga przeczytania przewodnika Next.js w `node_modules/next/dist/docs/` przed projektem (AGENTS.md).
3. **Definicja dnia i strefy** (BR-9): jedno źródło granic dnia dla danych, listy i nagłówka.
4. **Cele historyczne** (BR-7, AU-8): decyzja, czy cel dnia jest zapisywany wraz z dniem (snapshot) czy wyliczany z bieżącego planu.
5. **Obsługa braków** (BR-4, BR-8): model stanów dnia (w toku / ocenione / brak wpisów / niepełne dane / brak celu) jako typ wyliczony, nie zestaw flag.
6. **Parytet z Android i Java** (AU-16): sprawdzić, czy istnieje tam analogiczna logika; jeśli tak, ustalić, czy zmiana wymaga zmiany kontraktu. Zmiana kontraktu API wymaga wpisu w ADR i sprawdzenia `/api/android/*`.
7. **Brak nowych zapytań** w wariancie podstawowym (A-5); jeśli nawigacja tygodnia wymaga nowych danych, architekt opisuje zapytanie i wskazuje potrzebę `tester-wydajnosci`.

---

## 11. Priorytety (MoSCoW), zależności, wpływ

| Priorytet | Pozycja |
|---|---|
| Must | Jedno źródło sum (US-1, AU-1); stan „dziś w toku” (US-2, AU-2, AU-3); brak wpisów (US-3, AU-4); brak celu (US-4, AU-5); granice dnia (US-5, AU-7); niepełne dane (US-6, AU-11); dostępność tekstowa statusów (US-7) |
| Should | Nowy układ hero + karty zwijane (sekcja 9); filtr odchyleń i licznik (US-8, AU-13); spójna semantyka makro (AU-14, US-10) |
| Could | Pełna nawigacja tygodni z „Tydzień →” (US-9, Q-O4); wykresy trendu tygodniowego |
| Won't (w tym zadaniu) | Zmiana wzoru celów lub algorytmu profilu (A-2); nowe rekomendacje AI/coach; eksport danych; zmiana arkusza Start poza wspólną logiką |

**Zależności**: Must US-1 blokuje sensowność redesignu arkusza Start; US-5 zależy od decyzji o strefie czasowej (Q-O5); US-10 zależy od AU-8.

**Wpływ**:
- Android (`android/`) i Java (`java-backend/`): do potwierdzenia (AU-16). Brak zmiany kontraktu w wariancie bez nowych endpointów.
- Changelog: wpis na PR z `planned: true`; po Promote bez `planned`.
- Dokumentacja: aktualizacja dokumentu stanu dziedziny dietetycznej w `docs/zespol/wiedza-o-projekcie.md`, gdy zmieni się opisany stan (wymóg przepływu).

---

## 12. Bramki zespołu (decyzja analityka, uzasadnienie)

- **prawnik - POMINIĘTY.** Redesign prezentuje dane już przetwarzane (spożycie z `meal_logs`, cele z profilu), bez nowych celów przetwarzania, zgód ani treści prawnych. Wracamy do bramki, jeśli zakres doda: średnie/trendy długoterminowe danych zdrowotnych, udostępnianie danych innym użytkownikom (społeczność), eksport lub nowe zgody.
- **architekt - WYMAGANY** (etap 3): ocena techniczna, audyt AU-1..AU-16, architektura jednego źródła wyliczeń, decyzje o modelu widoku i strefie czasowej.
- **ux - WYMAGANY** (etap 4): kierunek z sekcji 9 zamieniony na makietę i specyfikację stanów.
- **backend - POMINIĘTY na tym etapie** (brak implementacji). Wejdzie, jeśli architekt wskaże zmianę zapytań/API lub wspólnego modułu po stronie serwera, po decyzji właściciela.
- **frontend - POMINIĘTY na tym etapie.** Wejdzie po zatwierdzeniu makiety i architektury.
- **Przegląd architekta po implementacji - POMINIĘTY na tym etapie** (wraca przy implementacji).
- **tester - POMINIĘTY na tym etapie** (brak zmiany kodu). Wejdzie przy implementacji; przy zmianie wyliczeń wymagany pełny plan testów (logika wysokiego ryzyka: granice dni, zaokrąglenia, dzień niepełny).
- **tester-bezpieczenstwa - POMINIĘTY.** Brak zmian uwierzytelniania, uprawnień, danych wejściowych ani nowej powierzchni ataku. Wróci, jeśli pojawi się nowy endpoint lub parametr zakresu dat z wejścia użytkownika.
- **tester-wydajnosci - POMINIĘTY na tym etapie.** Wróci, jeśli nawigacja tygodni lub widok dłuższego okresu doda zapytania lub większe listy.

---

## 13. Pytania otwarte

### 13.1 Do właściciela produktu (maks. 5, do zadania zbiorczo)

- **Q-O1**: Czy próg „w normie” ±5 pp / <1 jednostki ma być taki sam dla wszystkich czterech wartości (kcal, B, W, T), czy osobny dla każdego makro? Czy kalorie w normie przy ±5 pp to właściwy próg?
- **Q-O2**: Dla dnia dzisiejszego i dni bez wpisów: czy akceptujesz BR-3 i BR-4 (dziś nie jest oceniany jako niedobór do końca dnia; dzień bez wpisów to „brak wpisów”, nie odchylenie)? Czy cel dnia historycznego ma być zamrożony w chwili dnia (snapshot), czy liczony z bieżącego planu?
- **Q-O3**: Czy nadwyżka węglowodanów w dzień treningowy ma być traktowana jako odchylenie, czy jako neutralna informacja (różna tolerancja dla dnia treningowego i odpoczynkowego)?
- **Q-O4**: Zakres nawigacji „Tydzień →”: tylko podgląd bieżącego i poprzedniego tygodnia, czy dowolny wstecz?
- **Q-O5**: Która strefa czasowa definiuje „dziś”: strefa ustawiona w profilu, czy strefa urządzenia? (Zależy od AU-7.)

### 13.2 Do architekta

1. Czy `buildWeeklyNutritionRollup` (Start) i `buildPeriodMacroBalance` (Bilans) dają dziś identyczny wynik dla tych samych danych? Proszę o test porównawczy zanim zostanie podjęta decyzja o scaleniu (AU-1).
2. Dla BR-5: wybór między sumą z dni z wpisami (z dzisiejszym celem tylko przy niezerowym spożyciu) a celem pro-rata dla dzisiaj - co jest spójne z resztą aplikacji?
3. Czy dla dni bez wpisów `buildMacroBalance` zwraca odchylenie 100%? (AU-4) Gdzie są guardy na cel 0/null? (AU-5)
4. Czy `applyProfileGoalsAndManualConsumption` może zdublować wpisy ręczne i posiłki z `meal_logs`? (AU-10)
5. Czy cele historyczne są przechowywane per dzień, czy wyliczane z bieżącego profilu/planu? (AU-8)
6. Czy istnieje odpowiednik bilansu w `android/` lub `java-backend/`? (AU-16)
7. Wariant A (model widoku po stronie serwera) czy wariant B (klient z jednym źródłem)? Proszę o rekomendację z uzasadnieniem kosztu i zgodności z przewodnikiem Next.js.

### 13.3 Do ux

1. Jak pokazać „dziś w toku” bez sugerowania oceny (BR-3) - czy wystarczy pasek „zjedzone / cel” z „pozostało”?
2. Jak oznaczyć semantykę odchylenia dla każdego makro, żeby nie używać jednego koloru „błędu” (AU-14)?
3. Czy zwijane karty dni zastępują cztery karty dzienne, czy są ich wariantem?
4. Jak wygląda stan „brak wpisów” i „niepełne dane” na karcie dnia (mikrokopia do zatwierdzenia)?
5. Czy filtr odchyleń jest częścią hero, czy osobną sekcją?

---

## 14. Ryzyka

| ID | Ryzyko | Prawd. | Wpływ | Działanie |
|---|---|---|---|---|
| R-1 | Redesign bez wcześniejszego ujednolicenia sum utrwali rozjazd z arkuszem Start | Ś | W | Najpierw US-1 (architekt, test porównawczy), potem wygląd |
| R-2 | Zmiana semantyki „dziś” zmieni sposób oceny dnia dla użytkowników przyzwyczajonych do obecnego układu | W | Ś | Changelog, jasne etykiety stanu „w toku”, ewentualnie tryb przejściowy (decyzja ux/właściciela) |
| R-3 | Zmiana historii celów (AU-8) przepisze przeszłe oceny | Ś | W | Decyzja Q-O2 przed implementacją; test regresji dla dni historycznych |
| R-4 | Błędy przy północy/strefie (AU-7) trudne do odtworzenia | W | Ś | Testy z mockowanym zegarem i zmianą strefy (tester) |
| R-5 | Nadmierne alarmowanie przez listę odchyleń obniża motywację | Ś | Ś | Stany „brak wpisów” i „w toku”, filtr, licznik zgodny z listą |
| R-6 | Dane zdrowotne w logach lub analityce przy dodawaniu zdarzeń UI | N | W | Brak wartości w logach/Sentry; przegląd przy implementacji |
| R-7 | Rozjazd z Android/Java (AU-16) | Ś | Ś | Sprawdzić przez architekta przed projektem |

---

## 15. Co dalej

1. Właściciel odpowiada na Q-O1..Q-O5 (lub akceptuje wskazane domyślne założenia BR-1..BR-11).
2. `architekt` (etap 3): ocena AU-1..AU-16, ADR z architekturą jednego źródła wyliczeń i modelu widoku.
3. `ux` (etap 4): makieta i specyfikacja stanów na podstawie sekcji 9 i 13.3.
4. Po zatwierdzeniu makiety i ADR - decyzja właściciela o implementacji; wtedy uruchomienie `backend`/`frontend`, `tester` i pozostałych bramek wg karty `docs/zadania/006-redesign-bilansu-makro.md`.
