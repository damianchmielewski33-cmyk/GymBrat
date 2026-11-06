# Pulpit (ekran startowy): audyt i redesign

Stan: 2026-11-06. Źródło audytu: zrzut ekranu pulpitu (390 px, motyw ciemny) + kod `components/home/*`. Makieta nowego pulpitu: Design Artifact „GymBrat – Pulpit (redesign)” (prywatny). Nic z tego nie jest jeszcze zaimplementowane.

## Audyt (co jest, co nie działa)
**Błędy do naprawy niezależnie od redesignu**
- Podwojone „ostatnio ostatnio 7 dni temu”: `components/home/home-training-card.tsx:130` dokleja `ostatnio` do wyniku `formatPlanLastDoneRelative` (`lib/workout-plan-queue.ts:60`), który już zaczyna się od `ostatnio`.
- Waga „20,3 kg” w nagłówku sekcji Sylwetka przy wykresie 68 → 66,1 kg oraz pas „24 cm” przy wykresie 78 cm: wartości rozjeżdżają się. Do zweryfikowania w kodzie i danych (jednostka lub błędne pole).
- Trzy pierścienie „29%” z napisem „świetnie” i kafle „Forma” z samymi „2” bez skali: znaczenie niejasne.
- Przeglądarka proponuje tłumaczenie strony (`lang="pl"` jest, ale nazwy planów po angielsku, np. „Push A”): dodać `translate="no"` do nazw planów.

**UX i hierarchia**
- Około 10 kart o równej wadze; główna akcja (Zacznij trening) ginie wśród nich.
- Dwie prawie identyczne karty makro (dziś i tydzień) jedna pod drugą.
- Wykres z dwiema osiami (waga i pas) w jednej karcie: ciasny, etykiety kilka pikseli.
- Zbyt wiele akcentów kolorystycznych (złoto, niebieski, fiolet, żółty, różowy, zielony); makro rozróżniane głównie kolorem.
- Drobne teksty 9–10 px, przyciski zakresu 1M/3M/1R/Całość poniżej 44 px.
- Pływający przycisk „+ Raport” nachodzi na pasek nawigacji i treść.
- Tekst pomocniczy (suplementy, podpisy) ma niski kontrast i jest obcinany.

## Redesign (propozycja)
1. Nagłówek: powitanie + data; ikony powiadomień i profilu 44 px.
2. Hero „Trening na dziś”: nazwa planu dużą liczbą (Bebas), meta w jednej linii, jeden duży przycisk „Zacznij trening”, drugorzędny „Zmień dzień”.
3. „Ten tydzień”: treningi, seria tygodni, cardio w jednej karcie (3 liczby + 1 pasek).
4. „Makro”: jedna karta z przełącznikiem Dziś / Tydzień, duża liczba „kcal zostało” i trzy paski; przekroczenie pomarańczowe z tekstem „+50 g ponad cel” (nie sam kolor).
5. „Sylwetka”: przełącznik Waga / Pas, jedna duża wartość, zmiana, mały wykres; zakresy czasu przeniesione do Analizy.
6. „Realizacja założeń”: trzy paski z procentem i słownym statusem zamiast pierścieni.
7. „Suplementy na dziś”: przełączane chipy („wzięte”) zamiast długiej linii tekstu.
8. Dolna nawigacja: Pulpit, Trening, (+) Dodaj raport w środku, Dieta, Analiza. **Zespół trafia do profilu: wymaga decyzji właściciela.**
9. Stany: dane, nowy użytkownik (puste), ładowanie (szkielety), błąd części danych (baner + karta z ponowieniem).
10. Palette: czerń + szampańskie złoto `#c9a45c` + pomarańcz dla przekroczeń + zieleń dla poprawy. Dwa akcenty zamiast sześciu.

## Do decyzji właściciela przed kodem
- Przeniesienie „Zespół” z dolnej nawigacji do profilu i scalenie przycisku „Raport” ze środkiem paska.
- Usunięcie pierścieni „założeń” i kafli „Forma z ostatniego raportu” z pulpitu (albo ich nowa definicja).
- Przeniesienie zakresów wykresu (1M/3M/1R) do ekranu Analiza.
