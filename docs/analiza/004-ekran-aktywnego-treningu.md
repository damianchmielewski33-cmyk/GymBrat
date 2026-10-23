# 004 - Ekran aktywnego treningu: wymagania i kryteria akceptacji

Karta: `docs/zadania/004-ekran-aktywnego-treningu.md` (zatwierdzona makieta v2, punkty 1-15, decyzje D-1..D-3, błąd = zakres). Etap 1 przepływu (analityk). Dokument nie projektuje architektury; decyzje techniczne są wejściem dla `architekt` i `ux`. Nie obejmuje huba Trening (zadanie 003).

## 1. Kontekst i cel

Ekran aktywnego treningu (`guided-session-layout.tsx`: seria; `rest-break-screen.tsx`: przerwa) jest używany z telefonu, jedną ręką, między seriami. Cel: zapis serii w 1-2 dotknięciach, bez dubli informacji i bez niejasnych stanów, z czytelnym postępem (zapisane = zielone) i sugestią progresji w kolorze kierunku zmiany ciężaru.

### Co już działa i zostaje (nie opisywać od nowa)
- Store `useActiveWorkoutStore` + synchronizacja w chmurze (`active-workout-cloud-sync.tsx`, `requestActiveWorkoutCloudPush`), wznowienie treningu, auto-przejście do następnej serii/ćwiczenia (`resolveAdvanceAfterSet`), „Później” (`onDeferExercise`), Live Coach (`buildLiveCoachTipForOpenSet`), przerwa z licznikiem i `hapticTap`, Ghost (wyścig z poprzednim treningiem).
- Silnik progresji `buildSetProgressionSuggestion` (D-3: bez zmian), `suggestedWeights`, `lastSessionSets` z `last-workout-hints.ts`.
- Stany serii w kodzie: `done`, `skipped`, `isSkippedWorkoutSet`, `isCompletedWorkoutSet`. Pigułka serii pominiętej jest dziś pomarańczowa.

### Ustalenia z kodu (podstawa reguł)
1. **Błąd „Pomiń serię” przy widocznym 65 kg**: `weightText` jest synchronizowany tylko z `set.weight` (l. 301), a `suggestedWeight` trafia wyłącznie do `placeholder` (l. 759). Przy `set.weight = 0` `canZaliczyc` = false, więc `primaryLabel` = „Pomiń serię”, a `completeSet` przy braku danych wraca po cichu (l. 446-449).
2. **RIR**: store przy starcie sesji wpisuje `rir: e.targetRir ?? null` do każdej serii (`stores/active-workout.ts:140`), a `completeSet` zapisuje `set.rir ?? null`. Ekran pokazuje `rirValue = set.rir ?? targetRir ?? 1` (fallback 1 tylko do wyświetlenia). Czyli „domyślnie cel” już dziś oznacza zapisaną wartość = cel; makieta tego nie zmienia, jeśli utrzymamy tę regułę (patrz BR-9, R-2).
3. **Sugestia**: `deltaKg` jest > 0 tylko dla `kind="weight"`. Obniżenia (deload: `layoff_reduce`, `stagnation_deload`, `below_range_or_hard`) mają `kind="reps"`, `deltaKg = 0`, ale niższe `weightKg`. Sam `deltaKg` nie rozróżnia „utrzymania” i „obniżenia” - patrz BR-5.
4. **Postęp**: `totals.done` liczy `s.done`, więc seria pominięta liczy się jak zapisana; `exercisesDone` także.
5. Android/WebView: w `app/api/android/*` brak odwołań do aktywnego treningu; ekran jest webowy (WebView/PWA). Synchronizacja chmury używa istniejącego kształtu stanu serii.

## 2. Interesariusze
- Osoba ćwicząca początkująca: pierwszy trening, brak historii (brak „ostatnio”, brak sugestii), potrzebuje jednoznacznego „Zapisz serię”.
- Osoba ćwicząca zaawansowana: progresja ciężaru, RIR, szybkie ±kroki, nie chce przypadkowo zmienić sugestii ani zgubić serii.
- Osoba z ćwiczeniami z masą ciała (pompki, podciąganie, plank): ciężar 0 jest poprawny.
- Użytkownik trybu grupowego/Ghost: plakietka Ghost ma być zrozumiała.
- Właściciel/administrator: spójność z paletą, brak regresji PWA/Android, brak nowych kosztów (brak nowych zapytań, kontraktów, schematu).

## 3. Założenia
- Z1: Kolor jest dodatkiem, nigdy jedynym nośnikiem informacji (WCAG 1.4.1); każdy stan ma też ikonę/tekst/aria-label.
- Z2: Brak zmian schematu Drizzle, `/api/android/*`, Javy i kształtu stanu synchronizowanego w chmurze (zmiany tylko prezentacyjne + reguły wyliczeń po stronie klienta). Jeśli `architekt` uzna inaczej - wraca do analityka.
- Z3: Wibracja na koniec przerwy: tylko jeśli istnieje dziś (`hapticTap`/zachowanie licznika); bez nowych uprawnień.
- Z4: „Dzień lokalny” nie dotyczy tego ekranu (licznik czasu liczy się w sekundach od startu sesji); zmiana strefy w trakcie treningu nie zmienia danych.
- Z5: Tokeny kolorów (złoto, zielony, czerwony) ustala `ux`; wartości z makiety (np. #F5C542) są orientacyjne.

## 4. Definicje i reguły biznesowe

- **BR-1 Stany serii** (rozłączne): `do zrobienia` (`!done`), `bieżąca` (aktywna, `!done`), `zapisana` (`isCompletedWorkoutSet`), `pominięta` (`isSkippedWorkoutSet`). Seria bieżąca, która jest już zapisana (edycja), pokazuje się jako zapisana + obrys bieżącej.
- **BR-2 Kolor i znacznik segmentu/pigułki** (pasek postępu i pigułki serii, ten sam słownik):
  - zapisana: zielona + ✓ (pigułka), pełny segment;
  - bieżąca: złota, obrys/ring (kształt, nie tylko kolor);
  - do zrobienia: ciemna;
  - **pominięta: szara (neutralna), z ukośnym przekreśleniem w segmencie i symbolem „–” w pigułce; NIE zielona**. Zastępuje dzisiejszy pomarańcz (spoza palety makiety); aria-label „seria N pominięta”.
- **BR-3 „Ćwiczenie zaliczone”**: wszystkie serie ćwiczenia mają `done` i **żadna** nie jest pominięta. Wtedy cała grupa segmentów jest zielona, a na przerwie pojawia się „ćwiczenie ✓”. Jeśli ćwiczenie ma serie zapisane i pominięte (wszystkie `done`), jest „zakończone z pominięciami”: grupa zachowuje kolor per segment (zielone zapisane + szare pominięte), bez „ćwiczenie ✓” i bez zielonej obwódki grupy. Reguła zgodna ze znaczeniem `findFirstSkippedWorkoutTarget` / `countSkippedWorkoutSets`.
- **BR-4 Licznik „seria X/Y” w nagłówku**: X = numer bieżącej serii w całej sesji (po kolei, 1-based), Y = liczba wszystkich serii; osobny wiersz „0/16 serii · 0/7 ćw.” znika. Postęp liczbowy dla czytników ekranu jest w aria-label paska („zapisano A z Y serii, pominięto B”). Pominięte nie zwiększają „zapisanych”. Założenie: pasek bez cyfr, bo cyfry są w nagłówku.
- **BR-5 Kierunek sugestii** (reguła prezentacji; silnik bez zmian, D-3). Dla sugestii o ciężarze `S` i ciężarze odniesienia `B` (B = ciężar tej samej serii z poprzedniego treningu `lastSessionSets[i].weight`; gdy brak, B = bieżąca wartość pola ciężaru):
  - `S > B` -> **zwiększenie**: zielony, strzałka ↑, tekst „+X kg”;
  - `S < B` -> **obniżenie**: czerwony, strzałka ↓, tekst „-X kg”;
  - `S = B` (w tym `kind="reps"` z `deltaKg = 0`, „więcej powtórzeń”, hold) -> **utrzymanie**: neutralny złoty/biały, symbol „=”, bez znaku zmiany ciężaru.
  Uzasadnienie: `kind="reps"` oznacza „dołóż powtórzenie”, ale deload też ma `kind="reps"` i `deltaKg=0`, więc o kolorze decyduje porównanie ciężarów, nie samo `kind`/`deltaKg`. Porównanie wykonuje się z tolerancją 0,01 kg (zaokrąglenia `round2`). Kolorowany jest tylko fragment z ciężarem (np. „70 kg × 6”); powód („bo …”) jest neutralny.
- **BR-6 Ekran przerwy „NASTĘPNIE”**: ta sama funkcja kierunku i te same kolory/symbole co BR-5 dla następnej serii; dla następnego ćwiczenia kierunek względem jego pierwszej serii z poprzedniego treningu. Brak sugestii lub brak danych historycznych -> wiersz bez koloru i bez strzałki.
- **BR-7 Wartość początkowa ciężaru** (zastępuje samo `placeholder`), pierwsza dostępna w kolejności:
  1. ciężar już wpisany/zapisany w tej serii (`set.weight > 0`; edycja, wznowienie, drugie urządzenie);
  2. sugestia silnika dla tej serii (`suggestedWeights[i] > 0`);
  3. ciężar tej samej serii z poprzedniego treningu (`lastSessionSets[i]`);
  4. ciężar poprzedniej zapisanej serii tego ćwiczenia w bieżącej sesji;
  5. pusty (ćwiczenie nowe, bez historii) - pole pokazuje placeholder „0” i walidację przy zapisie.
  Wartość jest wstawiana do pola i do stanu serii (nie tylko do placeholdera), jednokrotnie przy wejściu na serię, i nigdy nie nadpisuje tego, co użytkownik już wpisał. Powtórzenia: analogicznie (wpisane -> poprzedni trening -> cel planu). Wiersz „Ostatnio” zostaje jako informacja; tap w chip sugestii wstawia sugerowany ciężar (i powtórzenia sugestii), tap w „Ostatnio” (zamiast „Powtórz bazę”) wraca do wartości z poprzedniego treningu.
- **BR-8 Przycisk główny** (D-2): etykieta zawsze „Zapisz serię N”; po zapisie serii „Popraw serię N”. Nigdy „Pomiń serię”. Pomijanie jest wyłącznie linkiem „Pomiń” w dolnym rzędzie. Walidacja zapisu: ciężar zewnętrzny > 0 **albo** ćwiczenie z masą ciała (ciężar 0 dopuszczony), oraz powtórzenia > 0.
  - Ćwiczenie „z masą ciała” = rozpoznane jak dziś w komentarzu `hasPerformedReps` (pompki, podciąganie, plank itp.). Jeśli `architekt` nie ma wiarygodnej flagi (patrz P-2), reguła zastępcza: ciężar 0 wymaga jawnego potwierdzenia „Bez obciążenia”.
  - Brak ciężaru (dla ćwiczenia z obciążeniem) lub powtórzeń: seria **nie jest zapisana**, pole z błędem dostaje fokus i komunikat inline, np. „Podaj ciężar” / „Podaj liczbę powtórzeń”, wibracja jak przy innych akcjach nie jest wymagana. Brak cichego powrotu.
  - Zmiana semantyki `canCompleteWorkoutSet`/`isSkippedWorkoutSet` dla masy ciała dotyka też raportów i zapisu treningu (seria „0 kg” jest dziś traktowana jako pominięta) - wskazuję `architektowi` jako ryzyko R-3.
- **BR-9 RIR**: pigułki 0 / 1 / 2 / 3+ w jednym rzędzie, podświetlony jest `set.rir ?? targetRir`; brak podświetlonego 0, gdy cel nie wynosi 0. Zapisywana wartość to dalej `set.rir` ze store (domyślnie cel planu z inicjalizacji sesji, albo wybór użytkownika). **Nie zmieniamy tego, co trafia do bazy ani silnika** (D-3). Ryzyko i warunek: patrz R-2 i P-3. Gdy plan nie ma celu RIR (`targetRir` null), nic nie jest podświetlone ani zapisywane, dopóki użytkownik nie wybierze (zamiast dzisiejszego wyświetlania „1”, które sugeruje wartość, której nie ma w danych).
- **BR-10 „Zakończ” w menu ☰**: akcja `onFinishSession` przeniesiona z dolnego rzędu do menu nagłówka, z tym samym potwierdzeniem i `flushDraft()` przed wywołaniem; stan `finishPending` pokazany w menu (wyłączona pozycja + „Kończenie…”). Dolny rząd: Wstecz · Później · Pomiń (3 równe kolumny, cel dotyku >= 44 px).
- **BR-11 „Pomiń” (link)**: zapisuje serię jako `done: true, skipped: true` (jak dziś `skipSet`), zachowuje wpisane wartości, przechodzi dalej. Dostępny zawsze (także gdy dane niekompletne - to jedyna droga pominięcia); wyłączony tylko dla serii już zapisanej (poprawiasz, nie pomijasz). Zmiana względem dziś: link nie jest zależny od `canZaliczyc`.
- **BR-12 Ghost (D-1)**: plakietka w nagłówku pokazuje stan wyboru przeciwnika, nie zapisu. Bez wybranego przeciwnika: „Ghost: wybierz rywala” (propozycja mikrokopii, finalnie `ux`); z wybranym: „Ghost: vs <data treningu>”. Tekst „bez zapisu” znika z całego ekranu i z `ghost-picker-sheet.tsx`. Ghost nie zmienia zapisu treningu (zapisuje się zawsze).
- **BR-13 Brak sieci / dwa urządzenia**: zapis serii dotyczy wyłącznie lokalnego store + istniejący push; ekran nie wprowadza nowych wywołań sieciowych. Konflikt dwóch urządzeń rozstrzyga istniejąca synchronizacja (bez zmian).

## 5. User stories i kryteria akceptacji

Numeracja punktów odnosi się do makiety w karcie 004. Priorytet MoSCoW w nawiasie.

### US-1 Nagłówek z czasem i numerem serii (pkt 1) (Must)
Jako osoba ćwicząca chcę widzieć w nagłówku „trening m:ss · seria X/Y”, aby wiedzieć, ile jestem w treningu i ile zostało, bez dodatkowego wiersza.
- Given trwa trening, When otwieram ekran serii, Then pod tytułem dnia widzę czas i „seria X/Y” zgodnie z BR-4, a wiersza „A/B serii · C/D ćw.” nie ma.
- Given pierwsze użycie (żadna seria zapisana), Then X = 1, pasek bez zielonych segmentów.
- Given pominąłem serię 3, When jestem na serii 4, Then nagłówek pokazuje „seria 4/Y”.
- Given zmieniła się strefa czasowa lub dzień w trakcie treningu, Then czas nadal rośnie od startu sesji, bez skoku.
- Given czytnik ekranu, Then aria-label nagłówka zawiera pełne zdanie („Trening trwa 12 minut 5 sekund, seria 4 z 16”).

### US-2 Pasek postępu z zielonymi zapisanymi seriami (pkt 2, 11) (Must)
Jako osoba ćwicząca chcę, aby pasek pokazywał per seria i per ćwiczenie, co zapisałem, aby jednym spojrzeniem ocenić postęp.
- Given 16 serii w 7 ćwiczeniach, Then pasek ma 16 segmentów pogrupowanych per ćwiczenie z odstępem między grupami.
- Given zapisałem serię, Then jej segment jest zielony; bieżąca złota; reszta ciemna (BR-2).
- Given ćwiczenie ma wszystkie serie zapisane, Then jego grupa jest w całości zielona (BR-3).
- Given ćwiczenie ma jedną serię pominiętą, Then jej segment jest szary z przekreśleniem, pozostałe zielone, grupa nie jest oznaczona jako zaliczona.
- Given ćwiczenie ma 1 serię lub 10 serii, Then segmenty zawsze mieszczą się w szerokości 320 px bez przewijania.
- Given edytuję zapisaną serię (zmiana wartości bez ponownego zapisu), Then segment pozostaje zielony do czasu świadomego „Popraw serię”.
- Given ekran przerwy, Then ten sam pasek jest widoczny i spójny z ekranem serii.
- Given dostępność, Then kolor nie jest jedynym nośnikiem: pominięta ma wzór, bieżąca ring, aria-label paska zawiera liczby (BR-4).

### US-3 Nagłówek ćwiczenia i pigułki serii (pkt 3) (Must)
Jako osoba ćwicząca chcę zobaczyć numer ćwiczenia, schemat i stan każdej serii, aby wiedzieć, co jest celem.
- Given ćwiczenie 3 z 7 o schemacie 2 serie × 6-8, RIR 1, Then widzę „ĆWICZENIE 3 Z 7”, nazwę, „2 serie × 6-8 · RIR 1” i przycisk wideo (jeśli jest `techniqueYoutubeUrl`).
- Given brak URL techniki, Then przycisk wideo nie jest renderowany (bez martwego przycisku).
- Given plan bez zakresu powtórzeń lub RIR, Then odpowiedni fragment schematu jest pomijany, bez „null”/„undefined”.
- Given pigułki serii: zapisana = zielona z ✓, bieżąca = złota z ringiem, pominięta = szara z „–” (BR-2); dotyk w pigułkę przełącza edytowaną serię (zachowanie jak dziś, `manualSetIndex`).
- Given superseria, Then etykieta superserii (dziś `buildSupersetLabels`) pozostaje.

### US-4 Jeden wiersz „ostatnio + sugestia” (pkt 4) (Must)
Jako osoba ćwicząca chcę jednej linii z ostatnim wynikiem i sugestią, aby szybko zdecydować o ciężarze.
- Given jest historia i sugestia, Then widzę „Ostatnio 65×11 · 5 dni”, chip sugestii i krótki powód (cztery dotychczasowe elementy: baner, karta, „Powtórz bazę”, „Sugestia” zastąpione jednym wierszem).
- Given sugestia ma wyższy ciężar niż ostatnio, Then fragment „70 kg × 6” jest zielony z ↑ i „+5 kg” (BR-5).
- Given sugestia ma niższy ciężar (deload), Then fragment jest czerwony z ↓ i „-X kg”.
- Given sugestia ma ten sam ciężar (więcej powtórzeń lub hold), Then fragment jest neutralny z „=” i opisem „więcej powtórzeń”/„utrzymaj”.
- Given tap w chip, Then ciężar i powtórzenia sugestii trafiają do pól i do stanu serii (jak `applyLiveTip`), bez zapisu serii.
- Given pierwsze użycie ćwiczenia (brak historii), Then wiersz nie jest renderowany albo pokazuje „Pierwszy raz - dobierz ciężar” (do `ux`), bez „—” w roli etykiety.
- Given sugestia istnieje, a „Ostatnio” brak (np. dane ucięte), Then chip jest neutralny (brak punktu odniesienia, BR-5 B = pole ciężaru).
- Given produkt/ćwiczenie z `suggestedWeights` równym 0 lub brakiem, Then chip nie jest renderowany.
- Dostępność: aria-label chipa np. „Sugestia: zwiększ do 70 kg, 6 powtórzeń. Zastosuj”; kontrast tekstu zielonego i czerwonego >= 4.5:1 na tle ekranu (R-4).

### US-5 Ciężar z wartością i szybkimi zmianami (pkt 5) i naprawa błędu (Must)
Jako osoba ćwicząca chcę, aby pole ciężaru było już wypełnione sensowną wartością, aby zapisać serię jednym dotknięciem.
- Given seria bez wpisanego ciężaru i ostatnio 65 kg, When wchodzę na serię, Then pole zawiera 65 (nie placeholder), a przycisk to „Zapisz serię N” (naprawa błędu z karty).
- Given jest sugestia 70 kg i ostatnio 65 kg, Then pole zawiera 70 (BR-7 pkt 2 ma pierwszeństwo przed pkt 3); chip pokazuje ↑.
- Given brak historii i sugestii, a zapisałem już serię 1 na 40 kg, Then seria 2 startuje od 40.
- Given pierwsze użycie ćwiczenia, Then pole jest puste (placeholder „0”), „Zapisz serię” nadal widoczny; po tapnięciu pojawia się komunikat „Podaj ciężar” i fokus na polu (BR-8).
- Given użytkownik już wpisał wartość i wraca na serię (np. „Wstecz”), Then wartość nie jest nadpisywana wartością początkową.
- Given steppery −/+ i szybkie przyciski ±2,5/±5 (lub wielokrotność kroku ćwiczenia, decyzja `ux`/`architekt`), Then ciężar nie spada poniżej 0 i nie przekracza 999 (`clampWeight`).
- Given hantle z krokiem 2 kg lub maszyna z krokiem 1,25 kg, Then szybkie przyciski nie wprowadzają wartości niemożliwych do załadowania (wielokrotność kroku ćwiczenia) - P-4.
- Given ćwiczenie z masą ciała (ciężar 0 dopuszczalny), Then „Zapisz serię” zapisuje serię z `weight = 0` bez komunikatu o ciężarze (BR-8).
- Given wznowienie treningu na drugim urządzeniu z wartością już zapisaną w chmurze, Then pole pokazuje zapisaną wartość (BR-7 pkt 1).

### US-6 Powtórzenia ze wskazaniem celu (pkt 6) (Must)
Jako osoba ćwicząca chcę zmieniać powtórzenia steperami i widzieć, czy mieszczę się w celu.
- Given cel 6-8 i wartość 7, Then widzę „✓ w celu 6-8”; przy 5 lub 9 znacznika ✓ nie ma, a pokazane jest „cel 6-8” neutralnie (bez czerwieni - powtórzenia poniżej celu nie są błędem).
- Given plan bez celu powtórzeń, Then brak znacznika celu; pole startuje z wartości poprzedniego treningu albo puste z walidacją (BR-7).
- Given powtórzenia 0 lub puste, When „Zapisz serię”, Then komunikat „Podaj liczbę powtórzeń”, seria nie jest zapisana.
- Given limit `clampReps`, Then wartości poza zakresem są przycinane jak dziś.

### US-7 RIR w jednym rzędzie (pkt 7) (Should)
Jako osoba ćwicząca chcę wybrać RIR 0/1/2/3+ w jednym rzędzie bez przewijania, aby szybko opisać wysiłek.
- Given ekran 360×640, Then cztery pigułki RIR mieszczą się wraz z przyciskiem głównym bez przewijania (cel >= 44 px).
- Given cel RIR 1 i brak mojego wyboru, Then podświetlone jest „1” (BR-9), nie „0”.
- Given brak celu RIR w planie, Then żadna pigułka nie jest podświetlona, a zapis bez wyboru zapisuje `rir = null` (jak dziś).
- Given wybrałem „3+”, Then zapisuje się 3 (jak dziś) i pigułka „3+” jest aktywna dla każdej wartości >= 3.
- Given zmieniam RIR po zapisaniu serii, Then stan zapisanej serii się nie zmienia (jak dziś: `done`/`skipped` zachowane).
- Given kolor aktywnej pigułki, Then aktywna ma też obrys i `aria-pressed="true"`.

### US-8 Zawsze „Zapisz serię” (pkt 8, D-2) (Must)
Jako osoba ćwicząca chcę, aby główny przycisk zawsze zapisywał serię, aby nie pominąć jej przez przypadek.
- Given dowolne dane w polach, Then etykieta to „Zapisz serię N”; po zapisie „Popraw serię N”; nigdy „Pomiń serię”.
- Given poprawne dane, When tap „Zapisz serię”, Then seria jest `done: true, skipped: false`, uruchamia się przerwa lub przejście do następnego ćwiczenia (zachowanie `resolveAdvanceAfterSet`) i push do chmury.
- Given niepoprawne dane (BR-8), Then brak zapisu, komunikat inline, fokus na polu; stan serii bez zmian; ekran nie przechodzi dalej.
- Given dwukrotne szybkie dotknięcie, Then zapisuje się jedna seria i uruchamia się jedna przerwa (`onMouseDown preventDefault` zostaje; brak podwójnego `onPatchSet`).
- Given trening przerwany w połowie (zamknięcie aplikacji po 3 seriach), Then po wznowieniu zapisane serie są zielone, a bieżąca to pierwsza niezapisana.
- Given offline na siłowni, Then zapis serii działa lokalnie, bez komunikatu o błędzie sieci; sync nadrabia po powrocie sieci (istniejące zachowanie).
- Given seria poprawiana („Popraw serię N”) z niepoprawnymi danymi, Then jak wyżej - brak zapisu z komunikatem, poprzednia zapisana wartość pozostaje.

### US-9 Dolne linki i „Zakończ” w menu (pkt 9) (Must)
Jako osoba ćwicząca chcę, aby przypadkowe „Zakończ” nie było obok „Pomiń”, aby nie przerwać treningu omyłkowo.
- Given ekran serii, Then dolny rząd ma Wstecz · Później · Pomiń (BR-10, BR-11); „Zakończ” nie występuje w dolnym rzędzie.
- Given menu ☰, When wybieram „Zakończ trening”, Then widzę to samo potwierdzenie co dziś; po zatwierdzeniu wykonuje się `flushDraft` i `onFinishSession`.
- Given `finishPending`, Then pozycja menu jest nieaktywna z „Kończenie…”, bez podwójnego zakończenia.
- Given „Wstecz” na pierwszej serii pierwszego ćwiczenia, Then link jest nieaktywny (nie wychodzi z treningu).
- Given „Później” na ostatnim niezakończonym ćwiczeniu, Then zachowanie jak dziś (brak następnego -> zostajemy na ćwiczeniu).
- Given „Pomiń” na serii zapisanej, Then link nieaktywny (BR-11); na niezapisanej tworzy serię pominiętą szarą (BR-2).
- Given wszystkie serie `done`, Then ścieżka do zakończenia (dialog „wszystkie serie”) pozostaje osiągalna z menu; brak sytuacji, w której nie da się zakończyć treningu.
- Given Android WebView, Then przycisk wstecz systemu zachowuje się jak dziś (bez zmian).

### US-10 Złota estetyka (pkt 10) (Should)
Jako osoba ćwicząca chcę spójnej, bardziej złotej palety, aby ekran pasował do aplikacji.
- Given ekran serii i przerwy, Then akcenty (kicker, przycisk główny, bieżący segment, ring) używają tokenów złota, a nie rozproszonych wartości hex (`#D6B36A`, `#F0D58A`, `#E8C97A` w komponencie zastępuje wspólny token), za ustalenie tokenów odpowiada `ux`.
- Given kontrast tekstu na przycisku głównym (ciemny na złotym) i elementów interaktywnych, Then >= 4.5:1 (tekst) i >= 3:1 (obrysy/ikony).
- Given tryb jasny lub zmiana motywu, jeśli istnieje, Then ekran treningu pozostaje ciemny jak dziś (Założenie; brak przełącznika na tym ekranie).
- Given zielony i czerwony sugestii, Then są dobrane tak, aby oba były rozróżnialne przy deuteranopii (potwierdza symbol ↑/↓, nie kolor).

### US-11 Ekran przerwy: potwierdzenie i licznik (pkt 12, 13, 15) (Must)
Jako osoba ćwicząca chcę po zapisie zobaczyć potwierdzenie i odliczanie przerwy, aby bezpiecznie odpocząć.
- Given zapisałem serię 70 kg × 8 z RIR 1, Then zielona karta: „Zapisano · 70 kg × 8 · RIR 1” z ✓ (RIR pominięty, gdy `rir` null).
- Given seria bez RIR, Then „Zapisano · 70 kg × 8”.
- Given masa ciała, Then „Zapisano · 12 powt.” (bez „0 kg”).
- Given była to ostatnia seria ćwiczenia i zgodnie z BR-3 ćwiczenie jest zaliczone, Then dopisek „ćwiczenie ✓”; przy pominięciach w tym ćwiczeniu dopisku nie ma.
- Given licznik przerwy, Then duży złoty licznik z pierścieniem, −15 s / +30 s (dolna granica 0; górna zgodna z dzisiejszym limitem), wibracja na koniec tylko jeśli istnieje dziś (Z3).
- Given aplikacja w tle lub ekran zablokowany, Then czas przerwy jest liczony od znacznika czasu (jak dziś); brak regresji.
- Given przycisk „Zacznij serię N” / „Zacznij ćwiczenie N”, Then etykieta zależy od tego, czy następny krok to kolejna seria tego ćwiczenia, czy pierwsza seria następnego; po ostatniej serii treningu przycisk prowadzi do zakończenia (etykieta do `ux`, np. „Zakończ trening”).
- Given tap „Zacznij”, Then przerwa jest zamykana natychmiast i nie zapisuje się żadna nowa seria.

### US-12 „NASTĘPNIE” z kolorami sugestii (pkt 14) (Must)
Jako osoba ćwicząca chcę na przerwie zobaczyć, co robię dalej i czy ciężar rośnie, aby przygotować sprzęt.
- Given następna seria ma sugestię wyższą niż ostatnio, Then wiersz sugestii ma ↑ i zielony fragment ciężaru (BR-6).
- Given sugestia niższa, Then ↓ i czerwony; równa, Then „=” neutralny.
- Given następne ćwiczenie bez historii, Then „NASTĘPNIE” pokazuje nazwę, schemat, bez wiersza sugestii.
- Given ostatnia seria treningu, Then sekcja „NASTĘPNIE” jest zastąpiona komunikatem o końcu treningu (do `ux`).
- Given dane `nextSet` nie niosą dziś kierunku sugestii (`setLine`, `schemeLine`, `rirLine`, `targetLine`), Then rozszerzenie danych jest wejściem dla `architekta` (R-5); reguła kierunku jest wspólna z ekranem serii (BR-5 w jednym miejscu, bez duplikatu).

### US-13 Plakietka Ghost (D-1) (Should)
Jako osoba korzystająca z Ghost Training chcę zrozumieć, że plakietka dotyczy rywala, a nie zapisu, aby nie bać się, że trening się nie zapisze.
- Given nie wybrano przeciwnika, Then plakietka w nagłówku (nie w treści) pokazuje „Ghost: wybierz rywala” (BR-12), a nigdzie nie ma tekstu „bez zapisu”.
- Given wybrano poprzedni trening jako przeciwnika, Then plakietka pokazuje „Ghost: vs <data>”, a HUD wyścigu działa jak dziś.
- Given brak poprzedniego treningu, Then plakietka jest ukryta lub nieaktywna z opisem „Brak treningu do wyścigu” (jedno z dwóch, `ux`).
- Given zapis serii z Ghost włączonym i wyłączonym, Then zapis i synchronizacja są identyczne (test regresji).
- Given wybór Ghosta, Then plakietka jest przyciskiem >= 44 px z aria-label opisującym akcję.

### US-14 Dostępność i prywatność ekranu (Must)
Jako osoba ćwicząca korzystająca z czytnika ekranu lub z zaburzeniem widzenia barw chcę mieć te same informacje bez koloru.
- Given każdy stan z BR-2 i BR-5, Then ma ikonę/symbol i tekst alternatywny (aria-label); weryfikacja listą kontrolną `ux`/`tester`.
- Given walidacja BR-8, Then komunikat błędu ma `role="alert"` lub `aria-live`, a pole `aria-invalid`.
- Given ciężar, powtórzenia, RIR i notatki z treningu (dane o zdrowiu/ciele), Then ekran nie dodaje ich do logów, Sentry (breadcrumbs, tagi) ani analityki; zmiana nie wprowadza nowych zbieranych danych (przekazać `prawnikowi`; wg oczekiwania brak wpływu).

## 6. Zmiany a Android, Java, chmura
- `/api/android/*` i Java: brak zmian kontraktów (w `app/api/android` brak odwołań do aktywnego treningu). Ekran jest renderowany w WebView/PWA, więc zmiana jest widoczna po wdrożeniu webu; wymagane sprawdzenie rozmiaru dotyku i `safe-area` na WebView (tester).
- Synchronizacja w chmurze: kształt stanu serii (`done`, `skipped`, `weight`, `reps`, `rir`) bez zmian; nowość to tylko wcześniejsze wypełnienie `weight`/`reps` wartością początkową (BR-7), co powoduje dodatkowy push po wejściu na serię. Wymóg: wartość początkowa nie może wywołać `requestActiveWorkoutCloudPush(true)`; użyć trybu nieimmediate/debounced jak przy edycji (koszty Turso/Upstash), a przy braku zmiany wartości w ogóle nie pushować.
- Schemat Drizzle i migracje: brak zmian.
- `/api/version` i changelog: wpis `planned: true` (proces).
- Zmienne środowiskowe: brak nowych (`admin-config-status` bez zmian).

## 7. Wymagania niefunkcjonalne
- Telefon, jedna ręka: cele dotyku >= 44 px; przycisk główny w zasięgu kciuka; ekran serii 360×640 bez przewijania w trybie bazowym (zawartość: nagłówek, ćwiczenie, wiersz „ostatnio”, ciężar, powtórzenia, RIR, przycisk, linki).
- Szybkość logowania: zapis serii <= 1 dotknięcie przy wypełnionych wartościach; reakcja UI <= 100 ms (lokalnie, bez czekania na sieć).
- Offline/PWA: pełna funkcja bez sieci; brak nowych zapytań.
- Dostępność: WCAG 2.1 AA (1.4.1 użycie koloru, 1.4.3 kontrast, 2.5.5 rozmiar celu, 4.1.3 komunikaty statusu).
- Bezpieczeństwo: brak nowych punktów wejścia; dane wejściowe nadal przycinane (`clampWeight`, `clampReps`).
- Koszty: bez nowych zapytań Turso/Vercel/Upstash; patrz ograniczenie pushu w pkt 6.
- Wydajność: pasek postępu liczy się w `useMemo`; ponowne renderowanie nie rośnie wraz z liczbą serii (do 60 serii).

## 8. MoSCoW i zależności
| Pozycja | Priorytet | Zależność |
|---|---|---|
| Naprawa błędu (BR-7, BR-8), US-5, US-8 | Must | brak; podstawa pozostałych |
| Pasek postępu, pigułki, BR-2/BR-3 (US-2, US-3) | Must | słownik stanów BR-1 |
| Sugestia w kolorach i „Następnie” (US-4, US-12) | Must | wspólna funkcja kierunku BR-5 (jedno miejsce) |
| Dolne linki i „Zakończ” w menu (US-9) | Must | menu ☰ w `session-chrome` |
| Ekran przerwy (US-11) | Must | BR-3, dane `nextSet` |
| Dostępność (US-14) | Must | wszystkie powyższe |
| RIR (US-7), złoto (US-10), Ghost (US-13) | Should | tokeny `ux`; mikrokopia |
| Szybkie ±2,5/±5 | Should | P-4 |
| Wiersz „pierwszy raz” (US-4) | Could | `ux` |
Wpływ na Androida: brak zmian po stronie natywnej; Java: brak.

## 9. Pytania do użytkownika

- **P-1 (kolor serii pominiętej)**: zakładamy szary z przekreśleniem (BR-2), a nie zielony i nie pomarańczowy. Rekomendacja: zatwierdzić. Czy akceptujesz?
- **P-2 (masa ciała)**: dziś seria z ciężarem 0 jest traktowana jako pominięta (`isSkippedWorkoutSet`), choć komentarz w kodzie dopuszcza „masę ciała”. Rekomendacja: ćwiczenie z masą ciała rozpoznawać po istniejącej klasyfikacji ruchu/nazwie (jeśli jej brak - jawny wybór „Bez obciążenia” przy zapisie) i traktować jako zapisaną; wymaga decyzji `architekta` o zakresie (dotyka raportów). Czy zamykamy to w zadaniu 004, czy zostawiamy dzisiejsze zachowanie (0 kg = komunikat „Podaj ciężar”)?
- **P-3 (RIR nietknięty)**: domyślnie cel planu jest już dziś zapisywany w każdej serii. Silnik w sesji traktuje RIR >= 2 jako „łatwa”, więc przy planie z celem RIR >= 2 nietknięte serie wyglądają jak łatwe i mogą podbić progresję (historyczny silnik tego broni przez `effortLogged`, ale Live Coach w trakcie sesji nie). Rekomendacja: zachować zapis jak dziś (zero zmian silnika, D-3) i zaakceptować ryzyko R-2, a rozważyć osobne zadanie „oznacz RIR jako wybrany/domyślny”. Alternatywa: nie zapisywać nietkniętego RIR (`null`), co jednak zmienia dane i wymaga zgody (wpływ na zgodność wsteczną i wykresy). Czy zostajemy przy zapisie wartości domyślnej?
- **P-4 (szybkie przyciski)**: ±2,5/±5 czy wielokrotności kroku ćwiczenia? Rekomendacja: wielokrotności kroku (np. ×1 i ×2 kroku), żeby nie dostać nieładowalnych wartości na hantlach i maszynach.
- **P-5 (pominięta seria w licznikach)**: czy w nagłówku i na pasku „zapisane” mają liczyć wyłącznie serie faktycznie zapisane (rekomendacja: tak, BR-4)? Dziś pominięte liczą się jak wykonane (`totals.done`).

## 10. Ryzyka
- R-1 Regresja przepływu zapisu: zmiana semantyki przycisku głównego i walidacji dotyka serca ekranu. Mitygacja: testy jednostkowe `canCompleteWorkoutSet`/BR-8 i testy E2E scenariuszy z US-8.
- R-2 RIR domyślny jako dane silnika: patrz P-3. Źle dobrana decyzja zniekształca progresję (zbyt agresywne dokładanie ciężaru) - ryzyko zdrowotne niskie, ale istotne dla zaufania.
- R-3 Zmiana semantyki „0 kg” dla masy ciała (P-2) zmienia raporty, historię i Ghost; wymaga przeglądu `architekta`.
- R-4 Kontrast zielonego i czerwonego na czarnym tle: czerwony tekst o niskiej jasności bywa poniżej 4.5:1; użyć jaśniejszego odcienia i symbolu.
- R-5 Dane `nextSet` na przerwie nie niosą dziś sugestii/kierunku; duplikacja logiki kierunku (ekran serii vs przerwa) byłaby zakazana - wymaga jednej funkcji.
- R-6 Wartość początkowa wywołująca zbędne pushe do chmury (koszty Turso/Upstash, nadpisanie edycji z drugiego urządzenia). Mitygacja: pkt 6.
- R-7 Zbyt gęsty ekran 360×640 po dodaniu steppera, szybkich przycisków, RIR i chipa. Mitygacja: weryfikacja wizualna `ux` i jeden wiersz sugestii.
- R-8 Dane wrażliwe (waga, wyniki) nie powinny trafić do Sentry przy nowych komunikatach walidacji - brak logowania wartości pól.

## 11. Przekazanie
- `prawnik`: brak nowych danych ani zgód (przetwarzanie bez zmian); potwierdzić brak wpływu oraz brak logowania wartości do Sentry.
- `architekt`: P-2/R-3, wspólna funkcja kierunku sugestii (BR-5/BR-6), źródło wartości początkowej bez pushu, menu ☰ z „Zakończ”, dane `nextSet`.
- `ux`: tokeny złota/zieleni/czerwieni, wzór segmentu pominiętego, mikrokopia Ghost i walidacji, układ 360×640.

## Werdykt
ZATWIERDZONE Z UWAGAMI: wymagania są testowalne; do rozstrzygnięcia przed etapami 3-4 pytania P-1..P-5 (rekomendacje zapisane, można przyjąć je jako domyślne).
