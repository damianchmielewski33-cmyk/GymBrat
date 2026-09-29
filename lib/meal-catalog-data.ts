/** Katalog przepisów GymBrat — dane bez przechowywanych obrazów (URL z Pollinations). */
import type { CatalogMeal } from "@/lib/meal-catalog-types";

export const MEAL_CATALOG_GENERATED: CatalogMeal[] = [
  {
    id: "meal_001",
    title: "Fit Owsianka z Borówkami",
    tagline: "Wysokobiałkowe śniadanie idealne przed treningiem.",
    slot: "sniadanie",
    prepMinutes: 10,
    imagePrompt:
      "healthy oatmeal with blueberries, protein breakfast, fitness meal, professional food photography, realistic, 4k",
    approximateMacros: { calories: 420, proteinG: 28, fatG: 12, carbsG: 45 },
    ingredients: [
      "50 g płatków owsianych",
      "200 ml mleka lub napoju roślinnego",
      "100 g skyr naturalnego",
      "80 g borówek",
      "10 g miodu (opcjonalnie)",
    ],
    steps: [
      "Zagotuj płatki owsiane z mlekiem na małym ogniu, mieszając aż zgęstnieją.",
      "Zdejmij z ognia, dodaj skyr i wymieszaj.",
      "Przełóż do miski, posyp borówkami i polej miodem.",
    ],
  },
  {
    id: "meal_002",
    title: "Jajecznica Proteinowa",
    tagline: "Bogate w białko śniadanie.",
    slot: "sniadanie",
    prepMinutes: 12,
    imagePrompt:
      "protein scrambled eggs with whole grain toast, healthy breakfast, professional food photography, realistic, 4k",
    approximateMacros: { calories: 390, proteinG: 35, fatG: 21, carbsG: 14 },
    ingredients: [
      "3 jajka",
      "100 g białka jajek (płynnego lub z 3 białek)",
      "1 kromka pieczywa pełnoziarnistego",
      "5 ml oliwy z oliwek",
      "szczypta soli i pieprzu",
    ],
    steps: [
      "Roztrzepać jajka z białkiem, solą i pieprzem.",
      "Smaż na oliwie na małym ogniu, mieszając do pożądanej konsystencji.",
      "Podawaj z opiekaną kromką pieczywa.",
    ],
  },
  {
    id: "meal_003",
    title: "Kurczak z Ryżem i Brokułem",
    tagline: "Klasyczny obiad sportowca.",
    slot: "obiad",
    prepMinutes: 30,
    imagePrompt:
      "grilled chicken breast with rice and broccoli, healthy fitness meal, professional food photography, realistic, 4k",
    approximateMacros: { calories: 620, proteinG: 54, fatG: 14, carbsG: 58 },
    ingredients: [
      "180 g piersi z kurczaka",
      "70 g ryżu (suchego)",
      "200 g brokułu",
      "5 ml oliwy",
      "przyprawy: sól, pieprz, papryka",
    ],
    steps: [
      "Ugotuj ryż według instrukcji na opakowaniu.",
      "Dopraw kurczaka i usmaż lub ugriluj na oliwie do ścięcia.",
      "Brokuł ugotuj na parze 6–8 min i podawaj razem z ryżem i mięsem.",
    ],
  },
  {
    id: "meal_004",
    title: "Indyk z Batatami",
    tagline: "Posiłek potreningowy.",
    slot: "obiad",
    prepMinutes: 35,
    imagePrompt:
      "turkey breast with sweet potatoes and vegetables, healthy fitness meal, professional food photography, realistic, 4k",
    approximateMacros: { calories: 670, proteinG: 58, fatG: 18, carbsG: 62 },
    ingredients: [
      "200 g piersi z indyka",
      "250 g batatów",
      "150 g mieszanki warzyw",
      "5 ml oliwy",
      "przyprawy do smaku",
    ],
    steps: [
      "Bataty pokrój i piecz w 200°C przez ok. 25 min.",
      "Indyka dopraw i usmaż na oliwie lub upiecz.",
      "Warzywa podsmaż lub ugotuj na parze i połącz na talerzu.",
    ],
  },
  {
    id: "meal_005",
    title: "Makaron Proteinowy z Kurczakiem",
    tagline: "Duża ilość białka i energii.",
    slot: "obiad",
    prepMinutes: 25,
    imagePrompt:
      "high protein pasta with chicken breast, healthy lunch, professional food photography, realistic, 4k",
    approximateMacros: { calories: 720, proteinG: 56, fatG: 19, carbsG: 74 },
    ingredients: [
      "80 g makaronu pełnoziarnistego lub proteinowego",
      "160 g piersi z kurczaka",
      "100 g sosu pomidorowego",
      "5 ml oliwy",
      "zioła prowansalskie",
    ],
    steps: [
      "Ugotuj makaron al dente.",
      "Kurczaka pokrój w paski, usmaż na oliwie i dopraw.",
      "Wymieszaj z sosem i makaronem, podgrzej chwilę razem.",
    ],
  },
  {
    id: "meal_006",
    title: "Tortilla Fit z Kurczakiem",
    tagline: "Szybka kolacja wysokobiałkowa.",
    slot: "kolacja",
    prepMinutes: 15,
    imagePrompt:
      "healthy chicken tortilla wrap, fitness dinner, professional food photography, realistic, 4k",
    approximateMacros: { calories: 510, proteinG: 43, fatG: 18, carbsG: 36 },
    ingredients: [
      "1 tortilla pełnoziarnista",
      "120 g pieczonego kurczaka",
      "40 g sałaty",
      "50 g pomidora",
      "30 g jogurtu naturalnego lub light majonezu",
    ],
    steps: [
      "Podgrzej tortillę na suchej patelni.",
      "Na środku ułóż kurczaka, warzywa i sos.",
      "Zawiń w rulon i przekrój na pół.",
    ],
  },
  {
    id: "meal_007",
    title: "Sałatka z Tuńczykiem",
    tagline: "Lekki posiłek na redukcję.",
    slot: "kolacja",
    prepMinutes: 10,
    imagePrompt:
      "fresh tuna salad with vegetables, healthy diet meal, professional food photography, realistic, 4k",
    approximateMacros: { calories: 380, proteinG: 34, fatG: 20, carbsG: 12 },
    ingredients: [
      "1 puszka tuńczyka w sosie własnym (ok. 120 g odsączonego)",
      "80 g sałaty lub rukoli",
      "100 g ogórka",
      "80 g pomidora",
      "5 ml oliwy z oliwek",
    ],
    steps: [
      "Odsącz tuńczyka i rozdrobnij widelcem.",
      "Pokrój warzywa i ułóż na sałacie.",
      "Polej oliwą, dopraw solą i pieprzem.",
    ],
  },
  {
    id: "meal_008",
    title: "Serek Wiejski z Owocami",
    tagline: "Zdrowa przekąska.",
    slot: "podwieczorek",
    prepMinutes: 5,
    imagePrompt:
      "cottage cheese with strawberries and almonds, healthy snack, professional food photography, realistic, 4k",
    approximateMacros: { calories: 290, proteinG: 27, fatG: 10, carbsG: 22 },
    ingredients: [
      "200 g serka wiejskiego light",
      "100 g truskawek lub malin",
      "15 g migdałów",
      "5 g miodu (opcjonalnie)",
    ],
    steps: [
      "Przełóż serek do miski.",
      "Dodaj umyte owoce i posiekane migdały.",
      "Opcjonalnie polej miodem i wymieszaj.",
    ],
  },
  {
    id: "meal_009",
    title: "Proteinowy Koktajl Bananowy",
    tagline: "Idealny shake po treningu.",
    slot: "podwieczorek",
    prepMinutes: 5,
    imagePrompt:
      "banana protein shake in glass, fitness drink, professional food photography, realistic, 4k",
    approximateMacros: { calories: 330, proteinG: 32, fatG: 8, carbsG: 28 },
    ingredients: [
      "1 miarka odżywki proteinowej (ok. 30 g)",
      "1 banan",
      "250 ml mleka lub wody",
      "5 g masła orzechowego (opcjonalnie)",
    ],
    steps: [
      "Wrzuć wszystkie składniki do blendera.",
      "Blenduj 20–30 sekund do gładkiej konsystencji.",
      "Przelej do szklanki i wypij od razu.",
    ],
  },
  {
    id: "meal_010",
    title: "Łosoś z Ziemniakami i Szparagami",
    tagline: "Zdrowa kolacja bogata w omega-3.",
    slot: "kolacja",
    prepMinutes: 30,
    imagePrompt:
      "grilled salmon with potatoes and asparagus, healthy gourmet fitness meal, professional food photography, realistic, 4k",
    approximateMacros: { calories: 690, proteinG: 48, fatG: 30, carbsG: 50 },
    ingredients: [
      "160 g filetu z łososia",
      "250 g ziemniaków",
      "150 g szparagów",
      "5 ml oliwy",
      "sok z cytryny, sól, pieprz",
    ],
    steps: [
      "Ziemniaki ugotuj lub upiecz do miękkości.",
      "Łososia dopraw i piecz lub grilluj ok. 12–15 min.",
      "Szparagi podsmaż na oliwie 5–7 min, skrop cytryną i podawaj razem.",
    ],
  },
];

export const MEAL_CATALOG_GENERATED_COUNT = MEAL_CATALOG_GENERATED.length;
