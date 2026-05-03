import { z } from "zod";

const ApproxMacrosSchema = z.object({
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
});

const MealItemSchema = z.object({
  title: z.string().min(1).max(160),
  tagline: z.string().max(240).optional(),
  ingredients: z.array(z.string()).min(2).max(24),
  steps: z.array(z.string()).min(2).max(18),
  approximateMacros: ApproxMacrosSchema,
  imagePromptEn: z.string().max(400).optional(),
});

export const MealSuggestionsResponseSchema = z.object({
  /** Cztery wyraźnie różne propozycje (zgodnie z promptem modelu). */
  meals: z.array(MealItemSchema).length(4),
});

export type MealSuggestionItem = z.infer<typeof MealItemSchema>;

export function staticFallbackMeals(): MealSuggestionItem[] {
  return [
    {
      title: "Skyr z owocami i orzechami",
      tagline: "Szybki posiłek bogaty w białko",
      ingredients: [
        "200 g jogurtu typu skyr naturalnego",
        "100 g borówki lub maliny (świeże lub mrożone)",
        "20 g orzechów włoskich posiekanych",
        "1 łyżeczka miodu (opcjonalnie)",
      ],
      steps: [
        "Skyr przełóż do miseczki.",
        "Dodaj owoce i posiekane orzechy, skrop miodem jeśli lubisz słodszy smak.",
      ],
      approximateMacros: { calories: 320, proteinG: 28, fatG: 12, carbsG: 28 },
      imagePromptEn: "Greek yogurt bowl with berries and walnuts, wooden table",
    },
    {
      title: "Kanapki z tuńczykiem i awokado",
      tagline: "Białko + zdrowe tłuszcze",
      ingredients: [
        "2 kromki pełnoziarnistego chleba (ok. 60 g)",
        "1 małe awokado (ok. 80 g miąższu)",
        "80 g tuńczyka w wodzie (odcedzonego)",
        "Sok z cytryny, szczypta soli i pieprzu",
        "Garść rukoli",
      ],
      steps: [
        "Awokado rozgnieć widelcem z sokiem z cytryny, dopraw.",
        "Chleb opiecz lekko w tosterze, posmaruj pastą z awokado.",
        "Dodaj rukolę i tuńczyka, przykryj drugą kromką lub zostaw otwarte.",
      ],
      approximateMacros: { calories: 420, proteinG: 32, fatG: 18, carbsG: 38 },
      imagePromptEn: "Open sandwich tuna avocado whole grain bread, daylight",
    },
    {
      title: "Kasza gryczana z kurczakiem i warzywami",
      tagline: "Obiad na ciepło",
      ingredients: [
        "60 g suchej kaszy gryczanej (po ugotowaniu ok. 180 g)",
        "150 g filetu z kurczaka",
        "200 g mieszanki mrożonej lub świeżej papryki i cukinii",
        "1 łyżka oleju rzepakowego",
        "Przyprawy: papryka słodka, czosnek granulowany",
      ],
      steps: [
        "Ugotuj kaszę według instrukcji na opakowaniu.",
        "Kurczaka pokrój w paski, podsmaż na oleju, dodaj warzywa i przyprawy.",
        "Podawaj z kaszą — dopasuj porcję warzyw do smaku.",
      ],
      approximateMacros: { calories: 520, proteinG: 45, fatG: 14, carbsG: 52 },
      imagePromptEn: "Buckwheat bowl grilled chicken vegetables, top view",
    },
    {
      title: "Zupa krem z pieczonych pomidorów z soczewicą",
      tagline: "Rozgrzewające białko roślinne",
      ingredients: [
        "500 g pomidorów malinowych",
        "80 g czerwonej soczewicy suchej (lub 200 g z puszki odcedzonej)",
        "1 cebula, 2 ząbki czosnku",
        "500 ml bulionu warzywnego",
        "1 łyżka oliwy, sól, pieprz, łyżeczka suszonego oregano",
      ],
      steps: [
        "Pomidory zapiecz z oliwą i czosnkiem w 200 °C ok. 25 minut.",
        "Soczewicę ugotuj do miękkości (jeśli susza).",
        "Zblenduj pomidory z bulionem i soczewicą, dopraw, podawaj z grzanką pełnoziarnistą.",
      ],
      approximateMacros: { calories: 380, proteinG: 18, fatG: 12, carbsG: 48 },
      imagePromptEn: "Tomato lentil soup cream bowl herbs, rustic spoon",
    },
  ];
}
