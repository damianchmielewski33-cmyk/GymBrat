/**
 * Prompt do skopiowania z panelu admina → zewnętrzny model AI generuje JSON katalogu.
 * Musi być zsynchronizowany z walidacją w `meal-catalog-import.ts` (format strict).
 */
export const MEAL_CATALOG_AI_PROMPT = `Jesteś generatorem katalogu przepisów dla aplikacji GymBrat (dieta / plan posiłków).

Zadanie: wygeneruj poprawny JSON katalogu przepisów.

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
- tagline (string, opcjonalnie, max 240): krótkie hasło po polsku.
- slot (enum, WYŁĄCZNIE jedna z wartości):
  "sniadanie" | "drugie_sniadanie" | "obiad" | "podwieczorek" | "kolacja"
- prepMinutes (integer): czas przygotowania w minutach, 1–240.
- ingredients (array string[], 2–40 pozycji): każda linia to jeden składnik z ilością
  (np. "150 g piersi z kurczaka", "1 łyżka oliwy"). Po polsku.
- steps (array string[], 2–40 pozycji): konkretne kroki gotowania po polsku.
- approximateMacros (object):
  - calories (number ≥ 0) — kcal na całą porcję opisaną składnikami
  - proteinG (number ≥ 0) — białko w gramach
  - fatG (number ≥ 0) — tłuszcz w gramach
  - carbsG (number ≥ 0) — węglowodany w gramach
- imagePromptEn (string, opcjonalnie, max 400): krótki angielski opis zdjęcia dania
  (np. "grilled chicken rice broccoli bowl"), bez polskich znaków.

## Zasady jakości
1. Makro muszą być spójne ze składnikami (Atwater: białko/węgle ≈ 4 kcal/g, tłuszcz ≈ 9 kcal/g).
   calories ≈ 4*proteinG + 4*carbsG + 9*fatG (±10% tolerancji).
2. Jedna porcja = jeden zestaw makro (nie „na 100 g”, tylko na danie jak w ingredients).
3. Przepisy realistyczne, fitness / redukcja / budowa — bez fantazyjnych dań niedostępnych w PL.
4. Różnorodność: słone i słodkie, mięso / ryby / wege / nabiał.
5. Nie duplikuj id. Nie używaj null. Nie dodawaj pól spoza listy (imageUrl tylko jeśli masz prawdziwy HTTPS URL).
6. slot musi pasować do charakteru dania (śniadanie ≠ ciężki obiad).

## Przykład jednego obiektu
{
  "id": "sniadanie-0001-owsianka-proteinowa-z-jablkiem-i-cynamonem",
  "slot": "sniadanie",
  "title": "Owsianka proteinowa z jabłkiem i cynamonem",
  "tagline": "Ciepłe śniadanie z błonnikiem",
  "ingredients": [
    "60 g płatków owsianych",
    "200 ml mleka 1,5%",
    "20 g odżywki białkowej waniliowej",
    "1 jabłko",
    "1 łyżeczka cynamonu"
  ],
  "steps": [
    "Odważ składniki wagą kuchenną.",
    "Ugotuj płatki na mleku, aż zmiękną.",
    "Zdejmij z ognia i wmieszaj białko.",
    "Dodaj pokrojone jabłko i cynamon."
  ],
  "approximateMacros": {
    "calories": 392,
    "proteinG": 28,
    "fatG": 8,
    "carbsG": 52
  },
  "imagePromptEn": "protein oatmeal apple cinnamon bowl",
  "prepMinutes": 12
}

## Twoje zadanie teraz
Wygeneruj 20 przepisów: po 4 na każdy slot
(sniadanie, drugie_sniadanie, obiad, podwieczorek, kolacja).
Zwróć wynik jako jedną tablicę JSON w bloku \`\`\`json ... \`\`\` (do skopiowania w całości).`;
