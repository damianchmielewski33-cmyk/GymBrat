/**
 * Generuje lokalny katalog posiłków GymBrat (kilkaset pozycji).
 * Uruchom: node scripts/generate-meal-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../lib/meal-catalog-data.ts");

/** @typedef {"sniadanie"|"drugie_sniadanie"|"obiad"|"podwieczorek"|"kolacja"} MealSlot */

/**
 * @param {number} p
 * @param {number} c
 * @param {number} f
 */
function kcal(p, c, f) {
  return Math.round(4 * p + 4 * c + 9 * f);
}

/**
 * @param {string} s
 */
function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** @type {Array<{slot: MealSlot, title: string, tagline: string, ingredients: string[], steps: string[], p: number, c: number, f: number, imagePromptEn: string, prepMinutes: number}>} */
const meals = [];

function add(entry) {
  meals.push(entry);
}

// ——— ŚNIADANIE ———
const breakfastProteins = [
  { name: "jajecznica z 3 jaj", amount: "3 jajka", p: 18, f: 15, c: 1, image: "scrambled eggs plate" },
  { name: "omlet z 3 jaj", amount: "3 jajka", p: 18, f: 14, c: 1, image: "omelette plate" },
  { name: "jajka na twardo", amount: "2 jajka", p: 12, f: 10, c: 1, image: "boiled eggs breakfast" },
  { name: "twaróg naturalny", amount: "200 g twarogu", p: 24, f: 8, c: 6, image: "cottage cheese bowl" },
  { name: "skyr naturalny", amount: "200 g skyru", p: 22, f: 0, c: 8, image: "skyr yogurt bowl" },
  { name: "jajecznica z szynką drobiową", amount: "2 jajka + 40 g szynki", p: 22, f: 12, c: 2, image: "eggs with ham" },
  { name: "omlet z serem", amount: "3 jajka + 30 g sera", p: 24, f: 20, c: 2, image: "cheese omelette" },
  { name: "jajka sadzone", amount: "2 jajka sadzone", p: 12, f: 14, c: 1, image: "fried eggs breakfast" },
];

const breakfastCarbs = [
  { name: "pieczywo pełnoziarniste", amount: "2 kromki pieczywa pełnoziarnistego (60 g)", p: 6, f: 2, c: 28, image: "whole grain bread" },
  { name: "owsianka", amount: "50 g płatków owsianych na wodzie", p: 6, f: 4, c: 32, image: "oatmeal bowl" },
  { name: "kasza manna", amount: "40 g kaszy manny na mleku 1,5%", p: 8, f: 4, c: 36, image: "semolina porridge" },
  { name: "tosty graham", amount: "2 tosty graham (70 g)", p: 7, f: 3, c: 34, image: "graham toast" },
  { name: "banan", amount: "1 banan (120 g)", p: 1, f: 0, c: 27, image: "banana breakfast" },
  { name: "ryż na mleku", amount: "40 g ryżu na mleku 1,5%", p: 6, f: 3, c: 38, image: "rice pudding breakfast" },
];

const breakfastSides = [
  { name: "awokado", amount: "1/2 awokado", p: 2, f: 12, c: 4, image: "avocado" },
  { name: "pomidor i ogórek", amount: "pomidor + ogórek", p: 1, f: 0, c: 6, image: "tomato cucumber" },
  { name: "borówki", amount: "80 g borówek", p: 1, f: 0, c: 12, image: "blueberries" },
  { name: "orzechy włoskie", amount: "15 g orzechów", p: 2, f: 10, c: 2, image: "walnuts" },
  { name: "miód", amount: "1 łyżeczka miodu", p: 0, f: 0, c: 8, image: "honey drizzle" },
  { name: "szpinak", amount: "garść szpinaku", p: 1, f: 0, c: 1, image: "spinach" },
];

for (const prot of breakfastProteins) {
  for (const carb of breakfastCarbs) {
    for (const side of breakfastSides.slice(0, 4)) {
      const p = prot.p + carb.p + side.p;
      const c = prot.c + carb.c + side.c;
      const f = prot.f + carb.f + side.f;
      const title = `${prot.name[0].toUpperCase()}${prot.name.slice(1)} z dodatkiem: ${carb.name}, ${side.name}`;
      add({
        slot: "sniadanie",
        title,
        tagline: "Śniadanie z białkiem i węglowodanami",
        ingredients: [prot.amount, carb.amount, side.amount, "szczypta soli i pieprzu"],
        steps: [
          `Przygotuj bazę białkową: ${prot.amount}.`,
          `Dodaj węglowodany: ${carb.amount}.`,
          `Uzupełnij talerz o ${side.amount}, dopraw do smaku.`,
        ],
        p,
        c,
        f,
        imagePromptEn: `${prot.image}, ${carb.image}, ${side.image}, breakfast plate, natural light`,
        prepMinutes: 15,
      });
    }
  }
}

// ——— DRUGIE ŚNIADANIE ———
const snack2Bases = [
  { name: "Kanapka z twarogiem", base: ["2 kromki chleba pełnoziarnistego", "120 g twarogu"], p: 22, c: 30, f: 8, steps: ["Rozsmaruj twaróg na pieczywie.", "Dodaj warzywa i dopraw."], img: "cottage cheese sandwich" },
  { name: "Wrap z kurczakiem", base: ["1 tortilla pełnoziarnista", "100 g pieczonego kurczaka"], p: 28, c: 32, f: 8, steps: ["Podgrzej tortillę.", "Ułóż kurczaka i warzywa, zwiń wrap."], img: "chicken wrap" },
  { name: "Jogurt grecki z owocami", base: ["200 g jogurtu greckiego 0%", "100 g owoców"], p: 20, c: 22, f: 2, steps: ["Jogurt przełóż do miseczki.", "Dodaj owoce i ewentualnie nasiona."], img: "greek yogurt fruit" },
  { name: "Skyr z granolą", base: ["180 g skyru", "30 g granoli"], p: 22, c: 28, f: 6, steps: ["Skyr przełóż do miseczki.", "Posyp granolą tuż przed jedzeniem."], img: "skyr granola" },
  { name: "Kanapka z tuńczykiem", base: ["2 kromki chleba", "80 g tuńczyka w wodzie"], p: 28, c: 28, f: 4, steps: ["Odcedź tuńczyka.", "Nałóż na pieczywo z warzywami."], img: "tuna sandwich" },
  { name: "Shake proteinowy z bananem", base: ["30 g odżywki białkowej", "1 banan", "250 ml mleka 1,5%"], p: 30, c: 40, f: 6, steps: ["Zblenduj składniki na gładko.", "Wypij od razu lub schłodź."], img: "protein shake banana" },
  { name: "Ryżówki z pastą jajeczną", base: ["3 wafle ryżowe", "2 jajka na pastę"], p: 14, c: 24, f: 10, steps: ["Ugotuj jajka, zrób pastę.", "Posmaruj wafle i dodaj warzywo."], img: "rice cakes egg paste" },
  { name: "Sałatka z jajkiem", base: ["2 jajka", "mieszanka sałat 100 g", "10 g oliwy"], p: 14, c: 6, f: 16, steps: ["Ugotuj jajka.", "Wymieszaj z sałatą i oliwą."], img: "egg salad bowl" },
];

const snack2Extras = [
  { name: "ogórek", amount: "1 ogórek", p: 1, c: 4, f: 0 },
  { name: "pomidor", amount: "1 pomidor", p: 1, c: 5, f: 0 },
  { name: "papryka", amount: "1/2 papryki", p: 1, c: 5, f: 0 },
  { name: "jabłko", amount: "1 jabłko", p: 0, c: 20, f: 0 },
  { name: "migdały", amount: "15 g migdałów", p: 3, c: 3, f: 8 },
  { name: "hummus", amount: "30 g humusu", p: 2, c: 6, f: 5 },
  { name: "rukola", amount: "garść rukoli", p: 1, c: 1, f: 0 },
  { name: "ser mozzarella light", amount: "40 g mozzarelli light", p: 8, c: 1, f: 6 },
];

for (const base of snack2Bases) {
  for (const extra of snack2Extras) {
    const p = base.p + extra.p;
    const c = base.c + extra.c;
    const f = base.f + extra.f;
    add({
      slot: "drugie_sniadanie",
      title: `${base.name} + ${extra.name}`,
      tagline: "Lekkie drugie śniadanie",
      ingredients: [...base.base, extra.amount],
      steps: [...base.steps, `Dodaj ${extra.amount} tuż przed podaniem.`],
      p,
      c,
      f,
      imagePromptEn: `${base.img}, ${extra.name}, light lunch snack, daylight`,
      prepMinutes: 10,
    });
  }
}

// ——— OBIAD ———
const lunchProteins = [
  { name: "filet z kurczaka", amount: "150 g filetu z kurczaka", p: 35, f: 4, c: 0, cook: "podsmaż lub upiecz", img: "grilled chicken breast" },
  { name: "udko z indyka", amount: "160 g indyka bez skóry", p: 34, f: 5, c: 0, cook: "upiecz w piekarniku", img: "roast turkey" },
  { name: "łosoś pieczony", amount: "140 g łososia", p: 28, f: 18, c: 0, cook: "upiecz 12–15 min w 180 °C", img: "baked salmon" },
  { name: "mintaj", amount: "160 g mintaja", p: 30, f: 2, c: 0, cook: "upiecz lub ugotuj na parze", img: "white fish fillet" },
  { name: "schab pieczony", amount: "140 g schabu", p: 32, f: 8, c: 0, cook: "upiecz do 72 °C wewnątrz", img: "roast pork loin" },
  { name: "tofu pieczone", amount: "180 g tofu naturalnego", p: 22, f: 12, c: 4, cook: "upiecz z przyprawami", img: "baked tofu" },
  { name: "soczewica", amount: "80 g suchej czerwonej soczewicy", p: 20, f: 1, c: 40, cook: "ugotuj do miękkości", img: "lentil stew" },
  { name: "cielęcina duszona", amount: "140 g cielęciny", p: 30, f: 6, c: 0, cook: "duś z warzywami", img: "braised veal" },
  { name: "krewetki", amount: "150 g krewetek", p: 28, f: 2, c: 2, cook: "podsmaż 2–3 min", img: "shrimp skillet" },
  { name: "udko z kurczaka bez skóry", amount: "180 g mięsa z udka", p: 32, f: 8, c: 0, cook: "upiecz lub zduś", img: "chicken thigh" },
];

const lunchCarbs = [
  { name: "ryż basmati", amount: "60 g suchego ryżu", p: 4, f: 1, c: 48, img: "basmati rice" },
  { name: "kasza gryczana", amount: "60 g kaszy gryczanej", p: 7, f: 2, c: 40, img: "buckwheat" },
  { name: "ziemniaki", amount: "250 g ziemniaków", p: 5, f: 0, c: 45, img: "boiled potatoes" },
  { name: "makaron pełnoziarnisty", amount: "70 g suchego makaronu", p: 8, f: 2, c: 48, img: "whole wheat pasta" },
  { name: "kasza jaglana", amount: "60 g kaszy jaglanej", p: 6, f: 2, c: 42, img: "millet" },
  { name: "quinoa", amount: "60 g komosy ryżowej", p: 8, f: 4, c: 36, img: "quinoa bowl" },
  { name: "bataty", amount: "220 g batatów", p: 3, f: 0, c: 46, img: "sweet potato" },
];

const lunchVeggies = [
  { name: "brokuł", amount: "200 g brokułu", p: 5, f: 0, c: 8, img: "broccoli" },
  { name: "cukinia i papryka", amount: "250 g cukinii i papryki", p: 3, f: 0, c: 12, img: "zucchini peppers" },
  { name: "surówka z kapusty", amount: "150 g kapusty z marchewką", p: 2, f: 2, c: 10, img: "cabbage salad" },
  { name: "szpinak duszony", amount: "200 g szpinaku", p: 5, f: 1, c: 4, img: "sauteed spinach" },
  { name: "mieszanka mrożona", amount: "200 g warzyw mrożonych", p: 4, f: 0, c: 14, img: "mixed vegetables" },
  { name: "sałatka grecka light", amount: "sałata, ogórek, pomidor, 30 g fety", p: 6, f: 8, c: 8, img: "greek salad" },
];

for (const prot of lunchProteins) {
  for (const carb of lunchCarbs) {
    for (const veg of lunchVeggies.slice(0, 3)) {
      const oil = 1; // łyżka oliwy ~9g fat approx as 8
      const p = prot.p + carb.p + veg.p;
      const c = prot.c + carb.c + veg.c;
      const f = prot.f + carb.f + veg.f + 8;
      add({
        slot: "obiad",
        title: `${prot.name[0].toUpperCase()}${prot.name.slice(1)} z ${carb.name} i ${veg.name}`,
        tagline: "Pełny obiad treningowy",
        ingredients: [
          prot.amount,
          carb.amount,
          veg.amount,
          "1 łyżka oliwy lub oleju rzepakowego",
          "sól, pieprz, ulubione przyprawy",
        ],
        steps: [
          `Białko: ${prot.cook} (${prot.amount}).`,
          `Ugotuj lub upiecz dodatek węglowodanowy: ${carb.amount}.`,
          `Przygotuj warzywa: ${veg.amount}, skrop olejem i dopraw.`,
          "Ułóż na talerzu i podawaj od razu.",
        ],
        p,
        c,
        f,
        imagePromptEn: `${prot.img}, ${carb.img}, ${veg.img}, dinner plate, top view`,
        prepMinutes: 35,
      });
    }
  }
}

// ——— PODWIECZOREK ———
const teatime = [
  { name: "Jogurt naturalny z kakao", ingredients: ["200 g jogurtu naturalnego", "1 łyżeczka kakao", "10 g miodu"], steps: ["Wymieszaj jogurt z kakao.", "Dosłodź miodem."], p: 12, c: 18, f: 6, img: "yogurt cocoa" },
  { name: "Owoce z orzechami", ingredients: ["1 jabłko", "1 kiwi", "15 g orzechów"], steps: ["Pokrój owoce.", "Posyp orzechami."], p: 4, c: 30, f: 10, img: "fruit nuts plate" },
  { name: "Kanapka z pastą z ciecierzycy", ingredients: ["2 kromki chleba", "60 g pasty z ciecierzycy"], steps: ["Posmaruj pieczywo pastą.", "Dodaj ogórek lub rukolę."], p: 10, c: 36, f: 8, img: "hummus sandwich" },
  { name: "Ser wiejski z rzodkiewką", ingredients: ["200 g sera wiejskiego", "5 rzodkiewek", "szczypiorek"], steps: ["Pokrój rzodkiewkę.", "Wymieszaj z serem i szczypiorkiem."], p: 22, c: 8, f: 8, img: "cottage cheese radish" },
  { name: "Koktajl truskawkowy", ingredients: ["150 g truskawek", "150 ml kefiru", "10 g odżywki białkowej"], steps: ["Zblenduj składniki.", "Podawaj schłodzony."], p: 16, c: 18, f: 2, img: "strawberry smoothie" },
  { name: "Pieczywo chrupkie z awokado", ingredients: ["3 pieczywa chrupkie", "1/2 awokado", "sok z cytryny"], steps: ["Rozgnieć awokado z cytryną.", "Posmaruj pieczywo."], p: 6, c: 24, f: 12, img: "crispbread avocado" },
  { name: "Budyń proteinowy", ingredients: ["250 ml mleka 1,5%", "30 g odżywki waniliowej", "10 g skrobi ziemniaczanej"], steps: ["Zagotuj mleko ze skrobią.", "Zdejmij z ognia, wymieszaj z odżywką."], p: 28, c: 22, f: 5, img: "protein pudding" },
  { name: "Sałatka z tuńczykiem light", ingredients: ["80 g tuńczyka", "sałata", "ogórek", "10 g oliwy"], steps: ["Wymieszaj składniki.", "Dopraw pieprzem."], p: 22, c: 6, f: 10, img: "tuna salad light" },
];

const teatimeAddons = [
  { name: "cynamon", amount: "szczypta cynamonu", p: 0, c: 1, f: 0 },
  { name: "siemię lniane", amount: "1 łyżka siemienia", p: 2, c: 2, f: 4 },
  { name: "banan", amount: "1/2 banana", p: 1, c: 14, f: 0 },
  { name: "maliny", amount: "80 g malin", p: 1, c: 10, f: 0 },
  { name: "kakao", amount: "1 łyżeczka kakao", p: 1, c: 2, f: 1 },
  { name: "miód", amount: "1 łyżeczka miodu", p: 0, c: 8, f: 0 },
  { name: "pestki dyni", amount: "10 g pestek dyni", p: 3, c: 2, f: 5 },
  { name: "jogurt 0%", amount: "50 g jogurtu 0%", p: 5, c: 3, f: 0 },
];

for (const base of teatime) {
  for (const addOn of teatimeAddons) {
    add({
      slot: "podwieczorek",
      title: `${base.name} z dodatkiem: ${addOn.name}`,
      tagline: "Podwieczorek bez ciężkiego brzucha",
      ingredients: [...base.ingredients, addOn.amount],
      steps: [...base.steps, `Na koniec dodaj ${addOn.amount}.`],
      p: base.p + addOn.p,
      c: base.c + addOn.c,
      f: base.f + addOn.f,
      imagePromptEn: `${base.img}, ${addOn.name}, afternoon snack, soft light`,
      prepMinutes: 8,
    });
  }
}

// ——— KOLACJA ———
const dinnerMains = [
  { name: "Omlet warzywny", ingredients: ["3 jajka", "papryka", "cukinia", "szpinak"], steps: ["Roztrzep jajka.", "Podsmaz warzywa, wlej jajka, smaż pod pokrywką."], p: 20, c: 10, f: 16, img: "vegetable omelette" },
  { name: "Dorsz z warzywami", ingredients: ["160 g dorsza", "cukinia", "pomidory koktajlowe", "1 łyżeczka oliwy"], steps: ["Ułóż rybę i warzywa na blaszce.", "Piecz 15 min w 190 °C."], p: 32, c: 12, f: 6, img: "baked cod vegetables" },
  { name: "Kurczak grillowany z sałatą", ingredients: ["140 g kurczaka", "mieszanka sałat", "ogórek", "10 g oliwy"], steps: ["Usmaż lub upiecz kurczaka.", "Podawaj na sałacie z oliwą."], p: 34, c: 8, f: 12, img: "grilled chicken salad" },
  { name: "Tofu z warzywami stir-fry", ingredients: ["160 g tofu", "brokuł", "marchew", "sos sojowy"], steps: ["Podsmaz tofu.", "Dodaj warzywa i sos, smaż 5 min."], p: 20, c: 18, f: 12, img: "tofu stir fry" },
  { name: "Zupa krem z cukinii z jajkiem", ingredients: ["400 g cukinii", "bulion", "1 jajko", "jogurt naturalny"], steps: ["Ugotuj cukinię w bulionie, zblenduj.", "Dodaj jajko na twardo i łyżkę jogurtu."], p: 14, c: 16, f: 8, img: "zucchini soup" },
  { name: "Indyk duszony z pieczarkami", ingredients: ["150 g indyka", "200 g pieczarek", "cebula"], steps: ["Zduś mięso z cebulą.", "Dodaj pieczarki i dusź do miękkości."], p: 34, c: 10, f: 8, img: "turkey mushrooms" },
  { name: "Sałatka Cezar light", ingredients: ["sałata rzymska", "120 g kurczaka", "20 g parmezanu", "dressing jogurtowy"], steps: ["Usmaż kurczaka.", "Wymieszaj z sałatą, serem i dressingiem."], p: 32, c: 10, f: 14, img: "caesar salad light" },
  { name: "Jajka w pomidorach", ingredients: ["2 jajka", "400 g pomidorów krojących", "czosnek", "przyprawy"], steps: ["Podsmaz czosnek z pomidorami.", "Wbij jajka, duś pod pokrywką."], p: 16, c: 14, f: 12, img: "eggs in tomato sauce" },
  { name: "Krewetki z cukinią", ingredients: ["140 g krewetek", "2 cukinie", "czosnek", "oliwa"], steps: ["Podsmaz czosnek.", "Dodaj cukinię i krewetki na 3–4 min."], p: 28, c: 10, f: 10, img: "shrimp zucchini" },
  { name: "Pieczona papryka z twarogiem", ingredients: ["2 papryki", "150 g twarogu", "zioła"], steps: ["Upiecz papryki.", "Nadziewaj twarogiem z ziołami."], p: 22, c: 16, f: 8, img: "stuffed peppers cottage" },
];

const dinnerSides = [
  { name: "kasza bulgur", amount: "40 g kaszy bulgur", p: 4, c: 28, f: 1 },
  { name: "ryż brązowy", amount: "40 g ryżu brązowego", p: 3, c: 30, f: 1 },
  { name: "pieczywo pełnoziarniste", amount: "1 kromka", p: 3, c: 14, f: 1 },
  { name: "bez dodatku skrobi", amount: "więcej warzyw zamiast kaszy", p: 2, c: 8, f: 0 },
  { name: "ziemniak pieczony", amount: "150 g ziemniaka", p: 3, c: 28, f: 0 },
  { name: "komosa", amount: "40 g quinoa", p: 5, c: 24, f: 3 },
];

for (const main of dinnerMains) {
  for (const side of dinnerSides) {
    add({
      slot: "kolacja",
      title: `${main.name} + ${side.name}`,
      tagline: "Lżejsza kolacja",
      ingredients: [...main.ingredients, side.amount],
      steps: [...main.steps, `Dodatek: przygotuj ${side.amount}.`],
      p: main.p + side.p,
      c: main.c + side.c,
      f: main.f + side.f,
      imagePromptEn: `${main.img}, ${side.name}, evening dinner plate, soft light`,
      prepMinutes: 25,
    });
  }
}

// Deduplicate titles
const seen = new Set();
const unique = [];
let idx = 0;
for (const m of meals) {
  let title = m.title;
  if (seen.has(title)) {
    title = `${title} · wariant ${idx + 1}`;
  }
  if (seen.has(title)) continue;
  seen.add(title);
  idx += 1;
  unique.push({ ...m, title, seq: idx });
}

const bySlot = {};
for (const m of unique) {
  bySlot[m.slot] = (bySlot[m.slot] ?? 0) + 1;
}

const lines = [];
lines.push(`/** Autogenerowane przez scripts/generate-meal-catalog.mjs — nie edytuj ręcznie. */`);
lines.push(`import type { CatalogMeal } from "@/lib/meal-catalog-types";`);
lines.push(``);
lines.push(`export const MEAL_CATALOG_GENERATED: CatalogMeal[] = [`);

for (const m of unique) {
  const id = `${m.slot}-${String(m.seq).padStart(4, "0")}-${slug(m.title)}`;
  const cal = kcal(m.p, m.c, m.f);
  lines.push(`  {`);
  lines.push(`    id: ${JSON.stringify(id)},`);
  lines.push(`    slot: ${JSON.stringify(m.slot)},`);
  lines.push(`    title: ${JSON.stringify(m.title)},`);
  lines.push(`    tagline: ${JSON.stringify(m.tagline)},`);
  lines.push(`    ingredients: ${JSON.stringify(m.ingredients)},`);
  lines.push(`    steps: ${JSON.stringify(m.steps)},`);
  lines.push(
    `    approximateMacros: { calories: ${cal}, proteinG: ${m.p}, fatG: ${m.f}, carbsG: ${m.c} },`,
  );
  lines.push(`    imagePromptEn: ${JSON.stringify(m.imagePromptEn)},`);
  lines.push(`    prepMinutes: ${m.prepMinutes},`);
  lines.push(`  },`);
}

lines.push(`];`);
lines.push(``);
lines.push(`export const MEAL_CATALOG_GENERATED_COUNT = ${unique.length};`);
lines.push(``);

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${unique.length} meals → ${outPath}`);
console.log(bySlot);
