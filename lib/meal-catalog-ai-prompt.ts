/**
 * Prompt do skopiowania z panelu admina → zewnętrzny model AI generuje JSON katalogu.
 * Musi być zsynchronizowany z walidacją w `meal-catalog-import.ts` (format strict).
 * Grafiki powstają przy imporcie JSON (Pollinations) z pola imagePromptEn.
 *
 * Aplikacja skaluje gramaturę do makro posiłku z profilu (max 5 posiłków) —
 * katalog musi mieć zróżnicowane proporcje B/W/T, żeby dało się dopasować.
 */
export const MEAL_CATALOG_AI_PROMPT = `Jesteś generatorem katalogu przepisów dla aplikacji GymBrat (dieta / plan posiłków).

Zadanie: wygeneruj poprawny JSON katalogu przepisów.

W GymBrat użytkownik w profilu ustawia do 5 posiłków dziennie z własnym makro
(np. Posiłek 1: 40 g białka · 20 g węgli · 10 g tłuszczu). Aplikacja DOBIERA
przepisy do tego celu i SKALUJE gramaturę składników. Dlatego w katalogu muszą
być przepisy o RÓŻNYCH proporcjach makro (nie klony „zawsze ~30B / 40W / 10T”).

## Format wyjścia
Cały JSON MUSI być w jednym bloku kodu markdown do łatwego kopiowania, dokładnie tak:

\`\`\`json
[ ... ]
\`\`\`

Albo:

\`\`\`json
{ "meals": [ ... ] }
\`\`\`

W bloku: wyłącznie poprawny JSON (tablica przepisów albo obiekt z polem "meals").
Bez komentarzy wewnątrz JSON. Poza blokiem kodu nie dodawaj innego JSON ani długiego opisu.

## Wymagane pola każdego przepisu (format docelowy GymBrat)
- id (string, 1–80 znaków): unikalny slug ASCII, małe litery, myślniki.
  Wzorzec: "{slot}-{numer4cyfry}-{skrot-tytulu}"
  Przykład: "sniadanie-0042-omlet-ze-szpinakiem"
- title (string, 1–160): polska nazwa dania, konkretna (nie „Przepis 1”).
- tagline (string, opcjonalnie, max 240): krótkie hasło po polsku; możesz dodać
  skrót profilu makro, np. „wysokie B · niskie W”.
- slot (enum, WYŁĄCZNIE jedna z wartości):
  "sniadanie" | "drugie_sniadanie" | "obiad" | "podwieczorek" | "kolacja"
- prepMinutes (integer): czas przygotowania w minutach, 1–240.
- ingredients (array string[], 2–40 pozycji): każda linia to jeden składnik z ilością
  (np. "150 g piersi z kurczaka", "1 łyżka oliwy"). Po polsku.
  Gramatury muszą odpowiadać approximateMacros (porcja jak w ingredients = makro).
- steps (array string[], 2–40 pozycji): konkretne kroki gotowania po polsku.
- approximateMacros (object) — makro NA CAŁĄ PORCJĘ ze składników:
  - calories (number ≥ 0)
  - proteinG (number ≥ 0)
  - fatG (number ≥ 0)
  - carbsG (number ≥ 0)
- imagePromptEn (string, WYMAGANE, max 400): krótki angielski opis zdjęcia TEGO dania
  pod AI (np. "grilled chicken rice broccoli bowl on dark plate"), bez polskich znaków,
  bez ludzi, bez tekstu na grafice. GymBrat wygeneruje z tego grafikę AI przy imporcie JSON.
  NIE podawaj imageUrl (aplikacja sama tworzy URL AI).

## Spójność makro (obowiązkowe)
1. Atwater: calories ≈ 4*proteinG + 4*carbsG + 9*fatG (±8% tolerancji).
2. Jedna porcja = jeden zestaw makro (nie „na 100 g”).
3. Składniki muszą „dawać” te makro — nie zaniżaj/zawyżaj białka względem kurczaka/sera itp.
4. Typowe zakresy porcji fitness (żeby skalowanie 0,4–2,5× miało sens):
   - calories: zwykle 180–700 kcal (unikaj ekstremów <120 i >900 bez powodu),
   - proteinG: 8–55 g,
   - carbsG: 5–80 g,
   - fatG: 3–35 g.

## Różnorodność PRZEPISÓW (smak / kategoria / slot)
W całej paczce muszą pojawić się (nie wszystkie w każdym slocie, ale łącznie):
- słone i słodkie,
- mięso, ryby, wege, nabiał,
- szybkie (≤15 min) i zwykłe (15–35 min),
- różne techniki: pieczenie, patelnia, gotowanie, na zimno / słoik / wrap.
Nie powtarzaj tego samego dania pod inną nazwą. Unikalne title i imagePromptEn.

## Różnorodność MAKRO (kluczowe — dopasowanie do celów użytkownika)
Nie generuj paczki, w której wszystkie dania mają podobne B/W/T.
W każdej paczce świadomie rozłóż profile makro — min. po 2 przepisy z każdej grupy poniżej
(łącznie w całej paczce, niekoniecznie w każdym slocie):

A) Wysokie białko · niskie węgle
   proteinG ≥ 35, carbsG ≤ 25, fatG 8–20
   (np. omlet, twaróg, mięso + warzywa, sałatka z tuńczykiem)

B) Wysokie białko · umiarkowane węgle
   proteinG 28–45, carbsG 30–55, fatG 6–18
   (klasyczny fit: kurczak/ryż, owsianka proteinowa, wrap)

C) Zbalansowane
   proteinG 20–35, carbsG 25–45, fatG 10–22
   (pełny posiłek bez skrajności)

D) Wyższe węgle · umiarkowane białko
   proteinG 12–28, carbsG 45–75, fatG 5–15
   (kasza, makaron, banana bowl, kanapka treningowa)

E) Wyższy tłuszcz · niskie/umiarkowane węgle
   proteinG 15–35, carbsG ≤ 30, fatG 18–32
   (łosoś, jajka + awokado, orzechy + nabiał)

F) Lekka przekąska
   calories 180–320, proteinG 12–28, carbsG 10–35, fatG 4–14
   (idealne pod drugie śniadanie / podwieczorek)

Dodatkowo w paczce muszą znaleźć się przepisy bliskie typowym celom z profilu
(żeby skalowanie było bliskie 1×, nie zawsze 0,5× albo 2×), np. okolice:
- 40B / 20W / 10T
- 35B / 40W / 12T
- 25B / 50W / 15T
- 30B / 15W / 18T
- 20B / 35W / 8T
Nie kopiuj tych liczb 1:1 w każdym przepisie — trzymaj się ±20%, zachowując spójność ze składnikami.

W tagline możesz oznaczyć profil, np. „wysokie B · niskie W”, żeby było widać różnicę.

## Slot a makro
- sniadanie / drugie_sniadanie: częściej A, B, D, F (nie tylko owsianki o tym samym makro).
- obiad: głównie B i C, czasem E (ryba).
- podwieczorek: F i A (szybkie, mniejsze porcje).
- kolacja: A, B, C — lżejsze niż obiad, nie klony obiadu.

## Zakazy
1. Nie duplikuj id. Nie używaj null. Nie dodawaj imageUrl.
2. Nie generuj 20× tego samego makro (±5 g B/W/T od siebie = za mało różnorodności).
3. Nie dawaj wszystkim daniom ~30B / 40W / 10T.
4. slot musi pasować do charakteru dania.
5. Każdy przepis: unikalny imagePromptEn.

## Przykład jednego obiektu (profil A — wysokie B, niskie W)
{
  "id": "sniadanie-0001-omlet-twarogowy-ze-szpinakiem",
  "slot": "sniadanie",
  "title": "Omlet twarogowy ze szpinakiem",
  "tagline": "Wysokie B · niskie W",
  "ingredients": [
    "3 jajka",
    "120 g twarogu chudego",
    "80 g szpinaku",
    "5 g oliwy",
    "przyprawy"
  ],
  "steps": [
    "Roztrzep jajka z twarogiem.",
    "Na patelni podsmaż szpinak na oliwie.",
    "Wlej masę jajeczną i smaż na średnim ogniu do ścięcia.",
    "Dopraw solą i pieprzem."
  ],
  "approximateMacros": {
    "calories": 338,
    "proteinG": 40,
    "fatG": 14,
    "carbsG": 8
  },
  "imagePromptEn": "spinach cottage cheese omelette on dark plate top view",
  "prepMinutes": 12
}

## Twoje zadanie teraz
Wygeneruj 25 przepisów z wyraźnie zróżnicowanym makro:
- po 5 na każdy slot (sniadanie, drugie_sniadanie, obiad, podwieczorek, kolacja),
- w całej paczce pokryj grupy A–F (min. po 2 przepisy z każdej),
- w każdym slocie przynajmniej 3 wyraźnie różne profile B/W/T
  (różnica ≥ 10 g białka LUB ≥ 15 g węgli między przepisami w tym samym slocie).

Zwróć wynik jako jedną tablicę JSON w bloku \`\`\`json ... \`\`\` (do skopiowania w całości).`;
