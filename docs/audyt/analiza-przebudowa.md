# Analiza: przebudowa od zera

Stan: 2026-11-06. Makiety: Design Artifact „GymBrat – Analiza (przebudowa)” (prywatny). Nic nie jest zaimplementowane. Inwentarz obecnego stanu: `docs/progress-screens.json`.

## Co jest dziś (i dlaczego jest nieczytelne)
- 4 zakładki (Przegląd, Siła, Sylwetka, Tygodnie), ok. 20 bloków, kilka tras (`/progress`, `/progress/exercises/[key]`, `objetosc`, `przeglad-planu`, `report`, `/reports`, `/workout-history`).
- Dane ważne są **zwinięte** (rekordy, prognoza e1RM, plany w „Ćwiczeniach wg planu”) albo **ukryte pod „i”** (definicje).
- Język techniczny bez wyjaśnienia w miejscu: e1RM, tonaż, RIR, RPE, „twarde serie”, tempo, gotowość.
- Liczby bez kontekstu (procenty „vs co?”), wiele bramek „Za mało danych”.
- Przegląd powtarza informacje z zakładek, a 4 zakładki odpowiadają na pytania oderwane od siebie.

## Zasady nowej Analizy
1. Najpierw odpowiedź słowami („Robisz postępy”), potem liczby, potem szczegóły.
2. Nic ważnego nie jest zwinięte ani ukryte. Definicje stoją obok liczby, jednym zdaniem.
3. Każda liczba ma jednostkę i punkt odniesienia („+4% względem poprzednich 30 dni”).
4. Jeden wspólny wybór okresu na ekranie, ta sama konstrukcja wykresu (osie z wartościami, ostatni punkt, opis dla czytnika).
5. Kolor zawsze z tekstem (rośnie/spada), nigdy sam.
6. Pusty stan mówi, co zrobić.

## Nowa struktura (4 sekcje + szczegół)
- **Podsumowanie:** werdykt, trzy liczby (siła, waga, regularność), jak dziś możesz trenować, na co uważać, cele.
- **Siła:** licznik rośnie/stoi/spada, lista wszystkich ćwiczeń z sortowaniem, balans mięśni (widoczny), rekordy (widoczne). Wiersz otwiera szczegół ćwiczenia.
- **Szczegół ćwiczenia:** szacowany max, wykres z zakresami, najlepsza seria, objętość, częstość, cel, ostatnie treningi.
- **Ciało:** waga z celem i szacowanym terminem, obwody z deltą, porównanie zdjęć (suwak).
- **Regularność:** kalendarz 8 tygodni, tydzień po tygodniu (treningi / tonaż / cardio), dieta a trening, cardio w strefach.

Zmiany nazw: Przegląd → Podsumowanie, Sylwetka → Ciało, Tygodnie → Regularność.

## Przegląd algorytmu „zmęczenie” (`lib/analytics/fatigue-score.ts`)
Wynik 0–100 to suma 7 składników (tonaż vs norma do 35 pkt, trend tygodnia do 15, ciężkie serie do 20, RPE do 18, liczba treningów do 12, cardio do 15, dni z rzędu do 18), obcięta do 0–100. Progi: 0–30 świeżość, 31–60 normalne, 61–80 wysokie zmęczenie, 81–100 przeciążenie. Regeneracja: z ankiety (sen 40%, energia 35%, stres 25%, kary za cardio i szybki spadek wagi, 70% ankiety + 30% „100 minus zmęczenie”); bez ankiety to po prostu „100 minus zmęczenie”.

Ustalone z kodu (testów nie uruchamiano, liczby nie były liczone na realnych danych):
1. **Okno „7 dni” ma 8 dni.** `inWindow(date, end, 7)` używa `t >= end − 7 dni` i `t <= end`, czyli obejmuje oba końce. Trening w tym samym dniu tygodnia sprzed tygodnia liczy się do bieżącego tygodnia, co zawyża tonaż, liczbę treningów i RPE (i zaniża bazę, bo baza odejmuje sesje „tygodnia”). Poprawka: okno otwarte z jednej strony (`t > start`).
2. **Baza zawsze dzielona przez 3**, także gdy użytkownik ma mniej niż 3 tygodnie historii. Stosunek tonażu jest wtedy zawyżony i zmęczenie rośnie. Poprawka: dzielić przez liczbę tygodni z danymi albo nie liczyć składnika przy < 3 tygodniach.
3. **Normalny tydzień daje ~25 pkt z samego tonażu** (stosunek 1,0 → 25 z 35). „Świeżość” (≤ 30) osiąga się więc tylko przy bardzo lekkim tygodniu. Progi i wagi są arbitralne, bez źródła.
4. **Brak RPE lub ciężkich serii daje 0 pkt po cichu** (składniki do 38 pkt). Wynik zależy od tego, co ktoś zapisuje. Trzeba pokazywać, których danych brakuje.
5. **To obciążenie, nie zmęczenie.** Algorytm nie używa snu ani samopoczucia, tylko danych treningowych. Nazwa „zmęczenie” sugeruje więcej, niż mierzy. Bez ankiety „regeneracja” jest tą samą liczbą odwróconą, więc pokazywanie obu jest mylące.
6. Okno prostokątne: trening sprzed 7 dni waży tyle co wczorajszy; standardem jest wygładzanie wykładnicze.

W makiecie pokazujemy składniki z punktami i sumę, żeby wynik był sprawdzalny.

## Do decyzji właściciela
- Zmiana nazw i podziału zakładek oraz usunięcie osobnej karty „Gotowość/Zmęczenie” na rzecz zdania „Jak dziś możesz trenować”.
- Zdjęcia: zostają w Ciele (zgodnie z `docs/progress-screens.json`) czy wracają do osobnej zakładki.
- Co dzieje się z trasami `objetosc`, `przeglad-planu`, `report`, `/workout-history` (włączyć do nowej struktury albo zostawić).
- Czy wersje „prognoza e1RM” i „intensywność (RIR/RPE)” zostają jako szczegóły ćwiczenia, czy znikają.

## Wdrożenie (kolejność)
Fundament i komponenty (wykres, miernik, przełącznik okresu, lista z sortowaniem) → Podsumowanie → Siła i szczegół → Ciało → Regularność → usunięcie starych bloków. Dane i formuły zostają (`lib/progress-hub.ts`, `docs/progress-training-analysis.json`), zmienia się warstwa UI.
