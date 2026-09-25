/**
 * Lokalny katalog posiłków GymBrat — wyłącznie unikalne dania (bez kombinatorów
 * „jajecznica + X + Y”). Uruchom: node scripts/generate-meal-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../lib/meal-catalog-data.ts");

/** @typedef {"sniadanie"|"drugie_sniadanie"|"obiad"|"podwieczorek"|"kolacja"} MealSlot */

function kcal(p, c, f) {
  return Math.round(4 * p + 4 * c + 9 * f);
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

/**
 * @typedef {{
 *   slot: MealSlot,
 *   title: string,
 *   tagline: string,
 *   ingredients: string[],
 *   steps: string[],
 *   p: number,
 *   c: number,
 *   f: number,
 *   imagePromptEn: string,
 *   prepMinutes: number,
 * }} MealDraft
 */

/** @type {MealDraft[]} */
const meals = [];

/** @param {MealDraft} entry */
function add(entry) {
  meals.push(entry);
}

/** @param {MealSlot} slot @param {Omit<MealDraft,"slot">[]} list */
function addMany(slot, list) {
  for (const m of list) add({ ...m, slot });
}

// ——— ŚNIADANIE (różne kultury / techniki, bez klonów jajecznicy) ———
addMany("sniadanie", [
  {
    title: "Owsianka proteinowa z jabłkiem i cynamonem",
    tagline: "Ciepłe śniadanie z błonnikiem",
    ingredients: ["60 g płatków owsianych", "200 ml mleka 1,5%", "20 g odżywki białkowej waniliowej", "1 jabłko", "1 łyżeczka cynamonu"],
    steps: ["Ugotuj płatki na mleku.", "Zdejmij z ognia, wmieszaj białko.", "Dodaj pokrojone jabłko i cynamon."],
    p: 28, c: 52, f: 8, imagePromptEn: "protein oatmeal apple cinnamon bowl", prepMinutes: 12,
  },
  {
    title: "Tosty francuskie pełnoziarniste z twarogiem",
    tagline: "Słodko-słone śniadanie",
    ingredients: ["2 kromki chleba pełnoziarnistego", "1 jajko", "80 g twarogu chudego", "50 ml mleka", "1 łyżeczka miodu"],
    steps: ["Roztrzep jajko z mlekiem.", "Obtocz chleb i podsmaż na patelni.", "Podawaj z twarogiem i miodem."],
    p: 26, c: 42, f: 12, imagePromptEn: "whole grain french toast cottage cheese", prepMinutes: 15,
  },
  {
    title: "Shakshuka z ciecierzycą",
    tagline: "Bliskowschodnie śniadanie na ciepło",
    ingredients: ["2 jajka", "150 g pomidorów krojonych", "80 g ciecierzycy z puszki", "1/2 cebuli", "przyprawy: kumin, papryka, czosnek"],
    steps: ["Zeszklij cebulę, dodaj pomidory i przyprawy.", "Dodaj ciecierzycę, wbij jajka.", "Duś pod przykryciem do ścięcia białka."],
    p: 22, c: 28, f: 14, imagePromptEn: "shakshuka chickpeas skillet breakfast", prepMinutes: 20,
  },
  {
    title: "Kanapka club z indykiem i jajkiem",
    tagline: "Sycące śniadanie do pracy",
    ingredients: ["3 kromki tosta graham", "80 g pieczonej piersi indyka", "1 jajko na twardo", "liście sałaty", "1 łyżeczka musztardy"],
    steps: ["Opiecz tosty.", "Ułóż warstwy: indyk, jajko, sałata, musztarda.", "Przekrój na pół."],
    p: 32, c: 36, f: 10, imagePromptEn: "turkey egg club sandwich", prepMinutes: 12,
  },
  {
    title: "Pancakes bananowe z jogurtem greckim",
    tagline: "Bez mąki — tylko banan i jajka",
    ingredients: ["1 banan", "2 jajka", "150 g jogurtu greckiego 0%", "szczypta proszku do pieczenia", "kilka malin"],
    steps: ["Zblenduj banana z jajkami.", "Smaż małe placki na nieprzywierającej patelni.", "Podawaj z jogurtem i malinami."],
    p: 24, c: 38, f: 10, imagePromptEn: "banana egg pancakes greek yogurt berries", prepMinutes: 15,
  },
  {
    title: "Kasza jaglana na mleku z gruszką",
    tagline: "Bezglutenowe śniadanie",
    ingredients: ["50 g kaszy jaglanej", "250 ml mleka 1,5%", "1 gruszka", "10 g orzechów laskowych", "szczypta wanilii"],
    steps: ["Ugotuj jagłę na mleku.", "Dodaj pokrojoną gruszkę.", "Posyp orzechami."],
    p: 14, c: 55, f: 12, imagePromptEn: "millet porridge pear hazelnuts", prepMinutes: 20,
  },
  {
    title: "Frittata ze szpinakiem i fetą",
    tagline: "Pieczony omlet na kilka porcji",
    ingredients: ["3 jajka", "80 g szpinaku", "40 g fety", "1 pomidor", "1 łyżeczka oliwy"],
    steps: ["Podduś szpinak.", "Wymieszaj z jajkami i fetą, przelej do formy.", "Piecz 15 min w 180°C."],
    p: 26, c: 8, f: 22, imagePromptEn: "spinach feta frittata slice", prepMinutes: 25,
  },
  {
    title: "Bowl chia z mango i kokosem",
    tagline: "Przygotuj wieczorem",
    ingredients: ["30 g nasion chia", "200 ml napoju sojowego", "1/2 mango", "10 g wiórków kokosowych", "1 łyżeczka miodu"],
    steps: ["Wymieszaj chia z napojem, odstaw na noc.", "Rano dodaj mango i kokos.", "Posłodź miodem."],
    p: 12, c: 36, f: 14, imagePromptEn: "chia pudding mango coconut bowl", prepMinutes: 5,
  },
  {
    title: "Quesadilla śniadaniowa z jajkiem i fasolą",
    tagline: "Meksykański start dnia",
    ingredients: ["1 tortilla pełnoziarnista", "1 jajko", "80 g czarnej fasoli", "30 g sera light", "salsa lub pomidor"],
    steps: ["Usmaż jajko na placku.", "Dodaj fasolę i ser, złóż tortillę.", "Zrumień z obu stron."],
    p: 24, c: 40, f: 14, imagePromptEn: "breakfast quesadilla egg black beans", prepMinutes: 12,
  },
  {
    title: "Smothie bowl z jagodami i granolą",
    tagline: "Zimne śniadanie w misce",
    ingredients: ["150 g mrożonych jagód", "120 g skyru", "1/2 banana", "25 g granoli", "5 g masła orzechowego"],
    steps: ["Zblenduj jagody, skyr i banana.", "Przelej do miski.", "Posyp granolą i masłem orzechowym."],
    p: 22, c: 42, f: 10, imagePromptEn: "berry smoothie bowl granola", prepMinutes: 8,
  },
  {
    title: "Jajka w koszulkach na toście z awokado",
    tagline: "Klasyka po nowemu",
    ingredients: ["2 jajka", "1 tost graham", "1/2 awokado", "szczypta chili", "sok z cytryny"],
    steps: ["Ugotuj jajka w koszulkach.", "Rozgnieć awokado z cytryną na toście.", "Ułóż jajka, posyp chili."],
    p: 18, c: 22, f: 20, imagePromptEn: "poached eggs avocado toast", prepMinutes: 15,
  },
  {
    title: "Ryż jaśminowy na mleku kokosowym z kardamonem",
    tagline: "Azjatyckie śniadanie",
    ingredients: ["50 g ryżu jaśminowego", "150 ml mleka kokosowego light", "100 ml wody", "szczypta kardamonu", "kilka orzechów nerkowca"],
    steps: ["Ugotuj ryż na mieszance mleka i wody.", "Dopraw kardamonem.", "Posyp nerkowcami."],
    p: 8, c: 48, f: 16, imagePromptEn: "jasmine rice coconut milk cardamom breakfast", prepMinutes: 25,
  },
  {
    title: "Wrap śniadaniowy z łososiem wędzonym",
    tagline: "Omega-3 na start",
    ingredients: ["1 tortilla", "60 g łososia wędzonego", "80 g serka wiejskiego light", "ogórek", "koperek"],
    steps: ["Posmaruj tortillę serkiem.", "Ułóż łososia, ogórek i koper.", "Zwiń ciasno."],
    p: 26, c: 30, f: 12, imagePromptEn: "smoked salmon breakfast wrap", prepMinutes: 8,
  },
  {
    title: "Polenta z jajkiem i pieczarkami",
    tagline: "Włoski poranek",
    ingredients: ["50 g polenty", "1 jajko", "100 g pieczarek", "10 g parmezanu", "szczypta tymianku"],
    steps: ["Ugotuj polentę.", "Usmaż pieczarki z tymiankiem.", "Podawaj z jajkiem sadzonym i parmezanem."],
    p: 16, c: 36, f: 14, imagePromptEn: "polenta fried egg mushrooms", prepMinutes: 20,
  },
  {
    title: "Budyń jaglany z kakao i bananem",
    tagline: "Na słodko bez cukru",
    ingredients: ["45 g kaszy jaglanej", "250 ml mleka", "1 łyżeczka kakao", "1 banan", "5 g gorzkiej czekolady"],
    steps: ["Ugotuj jagłę na mleku z kakao.", "Zblenduj z połową banana.", "Udekoruj bananem i czekoladą."],
    p: 12, c: 58, f: 8, imagePromptEn: "millet cocoa banana pudding breakfast", prepMinutes: 20,
  },
  {
    title: "Omlet japoński tamagoyaki z ryżem",
    tagline: "Słodkawy omlet rolka",
    ingredients: ["3 jajka", "1 łyżeczka sosu sojowego", "1 łyżeczka mirinu lub miodu", "80 g ugotowanego ryżu", "nori (opcjonalnie)"],
    steps: ["Roztrzep jajka z soją i mirinem.", "Smaż warstwami i zwijaj.", "Podawaj z ryżem."],
    p: 20, c: 34, f: 14, imagePromptEn: "tamagoyaki japanese omelette rice", prepMinutes: 18,
  },
  {
    title: "Placki z cukinii z sosem jogurtowym",
    tagline: "Warzywne śniadanie",
    ingredients: ["1 mała cukinia", "1 jajko", "30 g mąki owsianej", "100 g jogurtu naturalnego", "czosnek i koper"],
    steps: ["Zetrzyj cukinię, odsącz.", "Wymieszaj z jajkiem i mąką, smaż placki.", "Podawaj z jogurtem czosnkowym."],
    p: 16, c: 28, f: 10, imagePromptEn: "zucchini fritters yogurt dip breakfast", prepMinutes: 20,
  },
  {
    title: "Kasza manna z kakao i twarogiem",
    tagline: "Dzieciństwo w wersji fitness",
    ingredients: ["40 g kaszy manny", "250 ml mleka 1,5%", "100 g twarogu", "1 łyżeczka kakao", "1 łyżeczka miodu"],
    steps: ["Ugotuj manną na mleku z kakao.", "Przełóż do miski z twarogiem.", "Posłodź miodem."],
    p: 24, c: 44, f: 8, imagePromptEn: "semolina cocoa cottage cheese bowl", prepMinutes: 12,
  },
  {
    title: "Bagel z humusem, jajkiem i pieczywem",
    tagline: "Śródziemnomorski talerz",
    ingredients: ["2 jajka na twardo", "50 g humusu", "2 kromki chleba żytniego", "ogórek i pomidor", "oliwa + za'atar"],
    steps: ["Ugotuj jajka.", "Ułóż humus, warzywa i jajka.", "Skrop oliwą, posyp za'atar, podawaj z chlebem."],
    p: 22, c: 40, f: 18, imagePromptEn: "hummus eggs mediterranean breakfast plate", prepMinutes: 15,
  },
  {
    title: "Gofry owsiane z serkiem wiejskim",
    tagline: "Na gofrownicy lub patelni",
    ingredients: ["50 g płatków owsianych", "1 jajko", "80 ml mleka", "150 g serka wiejskiego light", "owoce sezonowe"],
    steps: ["Zblenduj płatki z jajkiem i mlekiem.", "Piecz gofry.", "Podawaj z serkiem i owocami."],
    p: 28, c: 40, f: 10, imagePromptEn: "oat waffles cottage cheese fruit", prepMinutes: 20,
  },
]);

// ——— DRUGIE ŚNIADANIE ———
addMany("drugie_sniadanie", [
  {
    title: "Kanapka żytnia z pastą z tuńczyka i ogórkiem",
    tagline: "Wysokobiałkowa przekąska",
    ingredients: ["2 kromki chleba żytniego", "80 g tuńczyka w wodzie", "1 łyżeczka jogurtu", "ogórek", "szczypiorek"],
    steps: ["Odcedź tuńczyka, wymieszaj z jogurtem.", "Posmaruj pieczywo.", "Dodaj ogórek i szczypiorek."],
    p: 28, c: 30, f: 4, imagePromptEn: "rye tuna cucumber sandwich", prepMinutes: 8,
  },
  {
    title: "Wrap z kurczakiem teriyaki i kapustą",
    tagline: "Azjatycki lunchbox",
    ingredients: ["1 tortilla", "100 g kurczaka", "1 łyżeczka sosu teriyaki", "kapusta pekińska", "marchewka starta"],
    steps: ["Usmaż kurczaka, polej teriyaki.", "Ułóż z warzywami na tortilli.", "Zwiń wrap."],
    p: 30, c: 34, f: 8, imagePromptEn: "chicken teriyaki wrap cabbage", prepMinutes: 15,
  },
  {
    title: "Skyr z granolą i malinami",
    tagline: "Szybkie białko",
    ingredients: ["200 g skyru naturalnego", "30 g granoli", "80 g malin"],
    steps: ["Przełóż skyr do miski.", "Posyp granolą i malinami."],
    p: 24, c: 32, f: 6, imagePromptEn: "skyr granola raspberries bowl", prepMinutes: 3,
  },
  {
    title: "Sałatka grecka mini z fetą light",
    tagline: "Warzywa w drodze",
    ingredients: ["100 g ogórka", "100 g pomidora", "40 g fety light", "oliwki", "1 łyżeczka oliwy", "oregano"],
    steps: ["Pokrój warzywa.", "Dodaj fetę i oliwki.", "Skrop oliwą, posyp oregano."],
    p: 12, c: 12, f: 14, imagePromptEn: "mini greek salad feta light", prepMinutes: 8,
  },
  {
    title: "Shake czekoladowy z masłem orzechowym",
    tagline: "Po treningu rano",
    ingredients: ["30 g białka czekoladowego", "250 ml mleka 1,5%", "10 g masła orzechowego", "1/2 banana"],
    steps: ["Zblenduj wszystkie składniki.", "Wypij schłodzony."],
    p: 32, c: 28, f: 12, imagePromptEn: "chocolate peanut butter protein shake", prepMinutes: 4,
  },
  {
    title: "Tost z awokado, pomidorem i mozarellą light",
    tagline: "Włoska nuta",
    ingredients: ["1 duży tost", "1/3 awokado", "1 pomidor", "40 g mozzarelli light", "bazylia"],
    steps: ["Opiecz tost.", "Rozgnieć awokado, dodaj pomidor i ser.", "Posyp bazylią."],
    p: 16, c: 28, f: 14, imagePromptEn: "avocado tomato mozzarella toast", prepMinutes: 7,
  },
  {
    title: "Rollsy z szynką drobiową i warzywami",
    tagline: "Bez pieczywa",
    ingredients: ["4 plastry szynki drobiowej", "40 g serka śmietankowego light", "papryka", "ogórek", "rukola"],
    steps: ["Posmaruj szynkę serkiem.", "Ułóż warzywa i zwiń rolady."],
    p: 22, c: 8, f: 8, imagePromptEn: "turkey ham veggie rolls", prepMinutes: 8,
  },
  {
    title: "Hummus z marchewką i pieczywem chrupkim",
    tagline: "Roślinna przekąska",
    ingredients: ["80 g humusu", "2 marchewki", "2 pieczywa chrupkie", "papryka"],
    steps: ["Pokrój warzywa w słupki.", "Podawaj z humusem i pieczywem."],
    p: 10, c: 36, f: 12, imagePromptEn: "hummus carrot crispbread snack", prepMinutes: 5,
  },
  {
    title: "Omlet w kubku z mikrofalówki",
    tagline: "Biurowe 3 minuty",
    ingredients: ["2 jajka", "30 ml mleka", "szpinak", "20 g sera", "sól, pieprz"],
    steps: ["Roztrzep jajka z mlekiem w kubku.", "Dodaj szpinak i ser.", "Mikrofaluj 60–90 s, mieszając w połowie."],
    p: 18, c: 4, f: 14, imagePromptEn: "microwave mug omelette spinach", prepMinutes: 5,
  },
  {
    title: "Jogurt grecki z miodem i orzechami włoskimi",
    tagline: "Prosta klasyka",
    ingredients: ["200 g jogurtu greckiego 0%", "1 łyżeczka miodu", "15 g orzechów włoskich"],
    steps: ["Jogurt przełóż do miski.", "Polej miodem, posyp orzechami."],
    p: 20, c: 18, f: 10, imagePromptEn: "greek yogurt honey walnuts", prepMinutes: 2,
  },
  {
    title: "Kanapka z pastą jajeczną i rukolą",
    tagline: "Klasyka lunchboxa",
    ingredients: ["2 kromki chleba", "2 jajka", "1 łyżeczka majonezu light", "rukola", "szczypiorek"],
    steps: ["Ugotuj jajka, zrób pastę.", "Posmaruj pieczywo, dodaj rukolę."],
    p: 18, c: 28, f: 12, imagePromptEn: "egg salad sandwich rocket", prepMinutes: 12,
  },
  {
    title: "Edamame z solą morską i chili",
    tagline: "Azjatycka przekąska",
    ingredients: ["150 g edamame w strąkach", "sól morska", "szczypta chili", "sok z limonki"],
    steps: ["Ugotuj lub podgrzej edamame.", "Posól, dodaj chili i limonkę."],
    p: 18, c: 14, f: 8, imagePromptEn: "edamame sea salt chili snack", prepMinutes: 8,
  },
  {
    title: "Twarożek z rzodkiewką i szczypiorkiem na pieczywie",
    tagline: "Polski klasyk",
    ingredients: ["150 g twarogu", "rzodkiewka", "szczypiorek", "2 kromki chleba", "szczypta soli"],
    steps: ["Rozduś twaróg z warzywami.", "Posmaruj pieczywo."],
    p: 24, c: 30, f: 6, imagePromptEn: "cottage cheese radish chives bread", prepMinutes: 7,
  },
  {
    title: "Sushi bowl mini z tuńczykiem i ryżem",
    tagline: "Bez rolowania",
    ingredients: ["80 g ryżu sushi ugotowanego", "70 g tuńczyka", "ogórek", "awokado 1/4", "sos sojowy light"],
    steps: ["Ułóż ryż w misce.", "Dodaj tuńczyka i warzywa.", "Polej soją."],
    p: 24, c: 36, f: 8, imagePromptEn: "mini tuna sushi bowl", prepMinutes: 10,
  },
  {
    title: "Naleśnik owsiany z twarogiem i truskawkami",
    tagline: "Jeden duży naleśnik",
    ingredients: ["40 g płatków owsianych", "1 jajko", "100 g twarogu", "80 g truskawek", "odrobina mleka"],
    steps: ["Zblenduj płatki z jajkiem i mlekiem, usmaż naleśnik.", "Nałóż twaróg i truskawki, zwiń."],
    p: 26, c: 36, f: 10, imagePromptEn: "oat pancake cottage cheese strawberries", prepMinutes: 12,
  },
]);

// ——— OBIAD ———
addMany("obiad", [
  {
    title: "Pierś z kurczaka sous-vide styl z kaszą gryczaną i burakiem",
    tagline: "Polski talerz siłowy",
    ingredients: ["150 g piersi kurczaka", "70 g kaszy gryczanej", "150 g buraka pieczonego", "szczypta majeranku", "1 łyżeczka oliwy"],
    steps: ["Usmaż lub upiecz kurczaka.", "Ugotuj kaszę.", "Podawaj z burakiem i majerankiem."],
    p: 42, c: 48, f: 12, imagePromptEn: "chicken buckwheat roasted beet plate", prepMinutes: 30,
  },
  {
    title: "Łosoś pieczony z batatem i brokułem",
    tagline: "Omega-3 + warzywa",
    ingredients: ["150 g łososia", "200 g batata", "150 g brokułu", "cytryna", "koperek"],
    steps: ["Piecz łososia 15 min w 190°C.", "Ugotuj lub upiecz batata.", "Blanszuj brokuł, skrop cytryną."],
    p: 34, c: 40, f: 18, imagePromptEn: "baked salmon sweet potato broccoli", prepMinutes: 30,
  },
  {
    title: "Bowl buddha z tofu, quinoa i warzywami",
    tagline: "Wegański obiad",
    ingredients: ["120 g tofu", "60 g quinoa", "czerwona kapusta", "marchewka", "sos tahini 1 łyżeczka"],
    steps: ["Ugotuj quinoa.", "Usmaż tofu na złoto.", "Ułóż bowl, polej tahini."],
    p: 24, c: 42, f: 16, imagePromptEn: "tofu quinoa buddha bowl tahini", prepMinutes: 25,
  },
  {
    title: "Chili con carne z indykiem i ryżem",
    tagline: "Lżejsza wersja klasyki",
    ingredients: ["150 g mięsa z indyka", "100 g czerwonej fasoli", "pomidory krojone", "60 g ryżu", "przyprawy chili"],
    steps: ["Zrumień indyka z przyprawami.", "Dodaj pomidory i fasolę, duś 15 min.", "Podawaj z ryżem."],
    p: 40, c: 50, f: 10, imagePromptEn: "turkey chili con carne rice", prepMinutes: 35,
  },
  {
    title: "Dorsz w panierce panko z puree z kalafiora",
    tagline: "Ryba w lekkiej panierce",
    ingredients: ["160 g dorsza", "30 g panko", "1 jajko", "300 g kalafiora", "szczypta gałki"],
    steps: ["Obtocz rybę w jajku i panko, upiecz.", "Ugotuj kalafior, zblenduj na puree.", "Dopraw gałką."],
    p: 36, c: 28, f: 10, imagePromptEn: "panko cod cauliflower mash", prepMinutes: 30,
  },
  {
    title: "Pad thai z krewetkami (wersja light)",
    tagline: "Azjatycki wok",
    ingredients: ["120 g krewetek", "80 g makaronu ryżowego", "kiełki", "1 jajko", "sos rybny + limonka (odrobina)"],
    steps: ["Ugotuj makaron.", "Smaż krewetki i jajko.", "Wymieszaj z makaronem i kiełkami."],
    p: 32, c: 48, f: 10, imagePromptEn: "light prawn pad thai", prepMinutes: 25,
  },
  {
    title: "Gulasz wołowy z papryką i kaszą jęczmienną",
    tagline: "Sycący obiad",
    ingredients: ["140 g chudej wołowiny", "papryka", "cebula", "60 g kaszy jęczmiennej", "papryka słodka"],
    steps: ["Zrumień mięso.", "Duś z warzywami i przyprawami.", "Podawaj z kaszą."],
    p: 38, c: 44, f: 14, imagePromptEn: "beef paprika stew barley", prepMinutes: 50,
  },
  {
    title: "Kurczak tikka z ryżem basmati i raita",
    tagline: "Indyjskie aromaty",
    ingredients: ["150 g kurczaka", "jogurt + przyprawy tikka", "60 g ryżu basmati", "ogórek + jogurt na raita"],
    steps: ["Marynuj kurczaka w jogurcie i przyprawach, upiecz.", "Ugotuj ryż.", "Zrób raita z ogórka."],
    p: 40, c: 48, f: 10, imagePromptEn: "chicken tikka basmati raita", prepMinutes: 40,
  },
  {
    title: "Makaron pełnoziarnisty z tuńczykiem i cukinią",
    tagline: "Szybki obiad z puszki",
    ingredients: ["70 g makaronu pełnoziarnistego", "80 g tuńczyka", "1 cukinia", "czosnek", "pomidorki koktajlowe"],
    steps: ["Ugotuj makaron.", "Smaż cukinię z czosnkiem.", "Wymieszaj z tuńczykiem i makaronem."],
    p: 34, c: 52, f: 8, imagePromptEn: "wholewheat pasta tuna zucchini", prepMinutes: 20,
  },
  {
    title: "Kaczka confit styl light z puree z selera",
    tagline: "Odświętny obiad",
    ingredients: ["150 g udźca kaczki bez skóry", "300 g selera", "jabłko", "tymianek"],
    steps: ["Upiecz kaczkę z tymiankiem.", "Ugotuj seler z jabłkiem, zrób puree.", "Podawaj razem."],
    p: 32, c: 28, f: 16, imagePromptEn: "duck breast celery apple puree", prepMinutes: 45,
  },
  {
    title: "Falafel pieczony z sałatką tabbouleh",
    tagline: "Bliski Wschód bez smażenia",
    ingredients: ["4–5 falafel z ciecierzycy (pieczone)", "bulgur 40 g", "pietruszka", "pomidor", "sok z cytryny"],
    steps: ["Upiecz falafel.", "Ugotuj bulgur, wymieszaj tabbouleh.", "Podawaj razem."],
    p: 18, c: 48, f: 12, imagePromptEn: "baked falafel tabbouleh plate", prepMinutes: 35,
  },
  {
    title: "Risotto z krewetkami i szparagami",
    tagline: "Kremowe bez śmietany",
    ingredients: ["70 g ryżu arborio", "100 g krewetek", "szparagi", "bulion warzywny", "parmezan 10 g"],
    steps: ["Smaż ryż, dolewaj bulion.", "Dodaj szparagi i krewetki pod koniec.", "Dopraw parmezanem."],
    p: 28, c: 54, f: 8, imagePromptEn: "prawn asparagus risotto", prepMinutes: 35,
  },
  {
    title: "Schab pieczony z ziemniakami i surówką z kapusty",
    tagline: "Domowy obiad",
    ingredients: ["140 g schabu", "200 g ziemniaków", "kapusta + marchewka", "musztarda"],
    steps: ["Natrij schab musztardą, upiecz.", "Upiecz ziemniaki.", "Zrób surówkę."],
    p: 36, c: 42, f: 12, imagePromptEn: "roast pork potatoes cabbage salad", prepMinutes: 45,
  },
  {
    title: "Moussaka light z bakłażanem i indykiem",
    tagline: "Grecka zapiekanka",
    ingredients: ["1 bakłażan", "120 g indyka mielonego", "sos pomidorowy", "beszamel light z mleka i mąki"],
    steps: ["Podpiecz bakłażana.", "Usmaż indyka z sosem.", "Ułóż warstwy, zalej beszamelem, piecz."],
    p: 32, c: 30, f: 14, imagePromptEn: "light turkey moussaka eggplant", prepMinutes: 50,
  },
  {
    title: "Krewetki w sosie czosnkowym z kaszą jaglaną",
    tagline: "Szybki wok",
    ingredients: ["140 g krewetek", "60 g kaszy jaglanej", "czosnek", "natka pietruszki", "oliwa 1 łyżeczka"],
    steps: ["Ugotuj jagłę.", "Smaż krewetki z czosnkiem.", "Podawaj z pietruszką."],
    p: 30, c: 40, f: 8, imagePromptEn: "garlic prawns millet", prepMinutes: 20,
  },
  {
    title: "Burger z indyka z pieczywem pełnoziarnistym i sałatką",
    tagline: "Comfort food fitness",
    ingredients: ["140 g mielonego indyka", "bułka pełnoziarnista", "sałata, pomidor", "sos jogurtowy"],
    steps: ["Uformuj i usmaż kotleta.", "Złóż burgera.", "Dodaj sałatkę z boku."],
    p: 38, c: 40, f: 12, imagePromptEn: "turkey burger wholegrain bun salad", prepMinutes: 25,
  },
  {
    title: "Paella warzywna z kurczakiem",
    tagline: "Hiszpański ryż",
    ingredients: ["60 g ryżu", "100 g kurczaka", "papryka, groszek", "szafran lub kurkuma", "bulion"],
    steps: ["Zrumień kurczaka.", "Dodaj ryż, warzywa i bulion.", "Duś bez mieszania do wchłonięcia."],
    p: 32, c: 50, f: 8, imagePromptEn: "chicken vegetable paella", prepMinutes: 40,
  },
  {
    title: "Zupa tom yum z kurczakiem i makaronem ryżowym",
    tagline: "Pikantna zupa-danie",
    ingredients: ["120 g kurczaka", "pasta tom yum", "80 g makaronu ryżowego", "pieczarki", "limonka"],
    steps: ["Ugotuj bulion z pastą.", "Dodaj kurczaka i pieczarki.", "Na końcu makaron i limonkę."],
    p: 30, c: 40, f: 8, imagePromptEn: "tom yum chicken rice noodles", prepMinutes: 25,
  },
  {
    title: "Pieczona pierś z kaczki z kaszą i żurawiną",
    tagline: "Wykwintny obiad",
    ingredients: ["140 g piersi kaczki bez skóry", "60 g kaszy gryczanej", "żurawina", "rozmaryn"],
    steps: ["Usmaż/upiecz pierś.", "Ugotuj kaszę.", "Podawaj z żurawiną."],
    p: 34, c: 40, f: 14, imagePromptEn: "duck breast buckwheat cranberry", prepMinutes: 35,
  },
  {
    title: "Spaghetti bolońskie z soczewicą",
    tagline: "Roślinna bolończyzna",
    ingredients: ["70 g spaghetti pełnoziarnistego", "80 g czerwonej soczewicy", "sos pomidorowy", "marchew, seler", "oregano"],
    steps: ["Ugotuj soczewicę z warzywami w sosie.", "Ugotuj makaron.", "Połącz."],
    p: 24, c: 58, f: 6, imagePromptEn: "lentil bolognese wholewheat spaghetti", prepMinutes: 30,
  },
]);

// ——— PODWIECZOREK ———
addMany("podwieczorek", [
  {
    title: "Jogurt naturalny z kakao i bananem",
    tagline: "Słodka mini porcja",
    ingredients: ["150 g jogurtu naturalnego", "1 łyżeczka kakao", "1/2 banana"],
    steps: ["Wymieszaj jogurt z kakao.", "Dodaj banana."],
    p: 12, c: 24, f: 4, imagePromptEn: "yogurt cocoa banana snack", prepMinutes: 3,
  },
  {
    title: "Garść migdałów i jabłko",
    tagline: "Proste combo",
    ingredients: ["20 g migdałów", "1 jabłko"],
    steps: ["Umyj jabłko.", "Jedz z migdałami."],
    p: 5, c: 22, f: 12, imagePromptEn: "almonds apple snack", prepMinutes: 1,
  },
  {
    title: "Koktajl truskawkowy na kefirze",
    tagline: "Orzeźwienie",
    ingredients: ["200 ml kefiru", "100 g truskawek", "5 g miodu"],
    steps: ["Zblenduj składniki."],
    p: 10, c: 20, f: 2, imagePromptEn: "strawberry kefir smoothie", prepMinutes: 4,
  },
  {
    title: "Ryżówki z twarogiem i miodem",
    tagline: "Chrupiąco",
    ingredients: ["3 wafle ryżowe", "80 g twarogu", "1 łyżeczka miodu"],
    steps: ["Posmaruj wafle twarogiem.", "Polej miodem."],
    p: 14, c: 28, f: 2, imagePromptEn: "rice cakes cottage cheese honey", prepMinutes: 3,
  },
  {
    title: "Marchewki baby z hummusem",
    tagline: "Warzywny dip",
    ingredients: ["150 g marchewek baby", "40 g humusu"],
    steps: ["Podawaj marchewki z hummusem."],
    p: 6, c: 20, f: 6, imagePromptEn: "baby carrots hummus snack", prepMinutes: 2,
  },
  {
    title: "Serek wiejski z ananasem",
    tagline: "Szybkie białko",
    ingredients: ["150 g serka wiejskiego", "80 g ananasa"],
    steps: ["Wymieszaj serek z ananasem."],
    p: 18, c: 14, f: 4, imagePromptEn: "cottage cheese pineapple snack", prepMinutes: 2,
  },
  {
    title: "Herbata matcha latte z mlekiem i białkiem",
    tagline: "Napój zamiast przekąski",
    ingredients: ["1 łyżeczka matchy", "200 ml mleka", "15 g białka waniliowego"],
    steps: ["Rozprowadź matchę.", "Dodaj ciepłe mleko i białko, spień."],
    p: 16, c: 12, f: 4, imagePromptEn: "matcha protein latte", prepMinutes: 5,
  },
  {
    title: "Pieczone chipsy z ciecierzycy",
    tagline: "Chrupiące",
    ingredients: ["100 g ciecierzycy z puszki", "przyprawy", "1 łyżeczka oliwy"],
    steps: ["Osusz ciecierzycę, wymieszaj z oliwą i przyprawami.", "Piecz 25 min w 200°C."],
    p: 10, c: 22, f: 6, imagePromptEn: "roasted chickpea chips", prepMinutes: 30,
  },
  {
    title: "Kanapka mini z pastą z avocado i jajkiem",
    tagline: "Pół porcji",
    ingredients: ["1 kromka chleba", "1/4 awokado", "1 jajko na twardo"],
    steps: ["Rozgnieć awokado na chlebie.", "Dodaj pokrojone jajko."],
    p: 12, c: 16, f: 12, imagePromptEn: "mini avocado egg open sandwich", prepMinutes: 8,
  },
  {
    title: "Galaretka proteinowa z owocami",
    tagline: "Na zimno",
    ingredients: ["galaretka bez cukru", "15 g żelatyny lub białka", "owoce"],
    steps: ["Przygotuj galaretkę według przepisu.", "Dodaj owoce, schłodź."],
    p: 12, c: 12, f: 0, imagePromptEn: "protein jelly fruit cup", prepMinutes: 10,
  },
  {
    title: "Tortilla chips pieczone z salsą",
    tagline: "Domowe chipsy",
    ingredients: ["1 tortilla pokrojona w trójkąty", "salsa pomidorowa", "przyprawy"],
    steps: ["Upiecz trójkąty tortilli.", "Podawaj z salsą."],
    p: 6, c: 28, f: 4, imagePromptEn: "baked tortilla chips salsa", prepMinutes: 15,
  },
  {
    title: "Shake kawowy proteinowy",
    tagline: "Popołudniowy boost",
    ingredients: ["espresso lub kawa", "25 g białka", "200 ml mleka", "lód"],
    steps: ["Zblenduj kawę, białko i mleko z lodem."],
    p: 26, c: 12, f: 4, imagePromptEn: "iced coffee protein shake", prepMinutes: 4,
  },
]);

// ——— KOLACJA ———
addMany("kolacja", [
  {
    title: "Sałatka Cobb light z kurczakiem",
    tagline: "Lekka kolacja",
    ingredients: ["120 g kurczaka", "sałata rzymska", "1 jajko", "pomidor", "ogórek", "dressing jogurtowy"],
    steps: ["Usmaż kurczaka.", "Ułóż sałatkę z jajkiem i warzywami.", "Polej dressingiem."],
    p: 36, c: 12, f: 12, imagePromptEn: "light chicken cobb salad", prepMinutes: 20,
  },
  {
    title: "Pieczony dorsz z cukinią i pomidorami",
    tagline: "Jedna blacha",
    ingredients: ["160 g dorsza", "cukinia", "pomidorki koktajlowe", "czosnek", "zioła"],
    steps: ["Ułóż rybę i warzywa na blaszce.", "Piecz 18 min w 190°C."],
    p: 34, c: 10, f: 6, imagePromptEn: "baked cod zucchini tomatoes tray", prepMinutes: 25,
  },
  {
    title: "Omlet na kolację z pieczarkami i szpinakiem",
    tagline: "Szybko i lekko",
    ingredients: ["3 jajka", "pieczarki", "szpinak", "szczypta sera"],
    steps: ["Usmaż pieczarki i szpinak.", "Wlej jajka, zetnij omlet."],
    p: 22, c: 6, f: 16, imagePromptEn: "mushroom spinach dinner omelette", prepMinutes: 12,
  },
  {
    title: "Zupa krem z pieczonej papryki z grzanką",
    tagline: "Rozgrzewająca kolacja",
    ingredients: ["2 czerwone papryki", "cebula", "bulion", "1 kromka pieczywa", "odrobina śmietany 12%"],
    steps: ["Upiecz papryki, zblenduj z bulionem.", "Dopraw śmietaną.", "Podawaj z grzanką."],
    p: 8, c: 28, f: 6, imagePromptEn: "roasted pepper soup crouton", prepMinutes: 35,
  },
  {
    title: "Tacos rybne z salsą mango",
    tagline: "Lekka kolacja meksykańska",
    ingredients: ["120 g białej ryby", "2 małe tortille", "mango", "cebula czerwona", "limonka"],
    steps: ["Usmaż rybę.", "Zrób salsę z mango.", "Złóż tacos."],
    p: 28, c: 36, f: 8, imagePromptEn: "fish tacos mango salsa", prepMinutes: 20,
  },
  {
    title: "Sałatka z komosy, pieczonego buraka i koziego sera",
    tagline: "Kolorowa miska",
    ingredients: ["50 g quinoa", "burak pieczony", "40 g sera koziego", "rukola", "pestki dyni"],
    steps: ["Ugotuj quinoa.", "Ułóż z burakiem i serem.", "Posyp pestkami."],
    p: 18, c: 36, f: 14, imagePromptEn: "quinoa beet goat cheese salad", prepMinutes: 25,
  },
  {
    title: "Kurczak w sosie musztardowym z puree z kalafiora",
    tagline: "Low-carb kolacja",
    ingredients: ["150 g kurczaka", "musztarda + jogurt", "kalafior na puree", "szczypiorek"],
    steps: ["Usmaż kurczaka, polej sosem.", "Zrób puree z kalafiora."],
    p: 40, c: 16, f: 10, imagePromptEn: "mustard chicken cauliflower mash", prepMinutes: 25,
  },
  {
    title: "Risotto grzybowe light",
    tagline: "Wegańskie opcje: bulion warzywny",
    ingredients: ["60 g ryżu arborio", "mieszanka grzybów", "cebula", "bulion", "natka"],
    steps: ["Smaż ryż i grzyby.", "Dolewaj bulion.", "Dopraw natką."],
    p: 10, c: 52, f: 4, imagePromptEn: "light mushroom risotto", prepMinutes: 35,
  },
  {
    title: "Stek z tofu z warzywami stir-fry",
    tagline: "Azjatycka kolacja roślinna",
    ingredients: ["140 g tofu", "brokuł, papryka", "sos sojowy light", "imbir", "ryż 40 g (opcjonalnie)"],
    steps: ["Usmaż tofu.", "Dodaj warzywa i sos.", "Podawaj z ryżem lub bez."],
    p: 22, c: 30, f: 12, imagePromptEn: "tofu stir fry vegetables", prepMinutes: 20,
  },
  {
    title: "Zapiekanka z cukinii i mielonego indyka",
    tagline: "Bez makaronu",
    ingredients: ["1 cukinia", "120 g indyka mielonego", "sos pomidorowy", "ser light 30 g"],
    steps: ["Usmaż indyka z sosem.", "Ułóż z cukinią, posyp serem, zapiecz."],
    p: 32, c: 16, f: 12, imagePromptEn: "zucchini turkey bake", prepMinutes: 35,
  },
  {
    title: "Sałatka niçoise light",
    tagline: "Francuska klasyka",
    ingredients: ["tuńczyk 80 g", "jajko", "fasolka szparagowa", "ziemniak 1 mały", "oliwki", "sałata"],
    steps: ["Ugotuj jajko, ziemniak i fasolkę.", "Ułóż z tuńczykiem i oliwkami."],
    p: 30, c: 24, f: 10, imagePromptEn: "light salade nicoise", prepMinutes: 25,
  },
  {
    title: "Krewetki z czosnkiem na sałacie lodowej",
    tagline: "Bardzo lekko",
    ingredients: ["140 g krewetek", "czosnek", "sałata lodowa", "limonka", "1 łyżeczka oliwy"],
    steps: ["Smaż krewetki z czosnkiem.", "Podawaj na sałacie z limonką."],
    p: 28, c: 6, f: 8, imagePromptEn: "garlic shrimp iceberg salad", prepMinutes: 12,
  },
  {
    title: "Tortilla pizza z kurczakiem i warzywami",
    tagline: "Szybka „pizza”",
    ingredients: ["1 tortilla", "sos pomidorowy", "80 g kurczaka", "papryka", "ser light"],
    steps: ["Posmaruj tortillę sosem.", "Dodaj dodatki, piecz 8 min."],
    p: 28, c: 32, f: 10, imagePromptEn: "tortilla pizza chicken vegetables", prepMinutes: 15,
  },
  {
    title: "Krem z cukinii z grzanką pełnoziarnistą",
    tagline: "Kolacja-zupa",
    ingredients: ["2 cukinie", "cebula", "bulion", "1 kromka chleba", "odrobina jogurtu"],
    steps: ["Ugotuj warzywa w bulionie, zblenduj.", "Dopraw jogurtem.", "Podawaj z grzanką."],
    p: 8, c: 24, f: 4, imagePromptEn: "zucchini cream soup wholegrain toast", prepMinutes: 25,
  },
  {
    title: "Bowl z łososiem, ryżem i edamame",
    tagline: "Kolacja z bilansem makro",
    ingredients: ["100 g łososia", "50 g ryżu", "80 g edamame", "ogórek", "sos sojowy"],
    steps: ["Upiecz łososia.", "Ugotuj ryż i edamame.", "Ułóż bowl."],
    p: 32, c: 40, f: 14, imagePromptEn: "salmon rice edamame bowl", prepMinutes: 25,
  },
  {
    title: "Placki z tuńczyka z sosem jogurtowym",
    tagline: "Bez panierki",
    ingredients: ["1 puszka tuńczyka", "1 jajko", "2 łyżki płatków owsianych", "jogurt + koper"],
    steps: ["Wymieszaj tuńczyka z jajkiem i płatkami.", "Usmaż placki.", "Podawaj z sosem."],
    p: 30, c: 16, f: 8, imagePromptEn: "tuna fritters yogurt dill sauce", prepMinutes: 15,
  },
  {
    title: "Wrap z falafellem i tahini light",
    tagline: "Wegetariańska kolacja",
    ingredients: ["3 falafle pieczone", "tortilla pełnoziarnista", "sałata", "ogórek", "sos tahini rozcieńczony jogurtem"],
    steps: ["Podgrzej falafle.", "Zawiń w tortillę z warzywami i sosem."],
    p: 22, c: 48, f: 14, imagePromptEn: "falafel wrap tahini yogurt", prepMinutes: 15,
  },
  {
    title: "Omlet z pieczarkami i szczypiorkiem",
    tagline: "Klasyczna kolacja białkowa",
    ingredients: ["3 jajka", "100 g pieczarek", "szczypiorek", "1 łyżeczka oliwy"],
    steps: ["Podsmaż pieczarki.", "Zalej jajkami, posyp szczypiorkiem."],
    p: 22, c: 4, f: 16, imagePromptEn: "mushroom chive omelette", prepMinutes: 12,
  },
]);

// ——— DODATKOWE DRUGIE ŚNIADANIE / PODWIECZOREK (więcej różnorodności) ———
addMany("drugie_sniadanie", [
  {
    title: "Tost z pastą z tuńczyka i ogórkiem",
    tagline: "Szybkie drugie śniadanie",
    ingredients: ["2 kromki chleba", "1/2 puszki tuńczyka", "jogurt naturalny", "ogórek"],
    steps: ["Wymieszaj tuńczyka z jogurtem.", "Posmaruj tosty, dodaj ogórek."],
    p: 24, c: 28, f: 6, imagePromptEn: "tuna yogurt toast cucumber", prepMinutes: 8,
  },
  {
    title: "Jogurt islandzki z mango i limonką",
    tagline: "Świeży, wysokobiałkowy",
    ingredients: ["200 g skyr", "80 g mango", "sok z limonki", "mięta"],
    steps: ["Pokrój mango.", "Wymieszaj ze skyrem, dopraw limonką i miętą."],
    p: 24, c: 22, f: 2, imagePromptEn: "skyr mango lime mint bowl", prepMinutes: 5,
  },
  {
    title: "Mini wrap z szynką drobiową i rukolą",
    tagline: "Na wynos",
    ingredients: ["1 mała tortilla", "60 g szynki drobiowej", "rukola", "ser light", "pomidor"],
    steps: ["Ułóż składniki na tortilli.", "Zawiń i przekrój na pół."],
    p: 22, c: 26, f: 8, imagePromptEn: "turkey ham arugula mini wrap", prepMinutes: 7,
  },
  {
    title: "Koktajl truskawkowy z kefirem",
    tagline: "Probiotyczny napój-posiłek",
    ingredients: ["250 ml kefiru", "150 g truskawek", "10 g płatków owsianych", "odrobina miodu"],
    steps: ["Zblenduj wszystko na gładko."],
    p: 14, c: 32, f: 4, imagePromptEn: "strawberry kefir smoothie oats", prepMinutes: 5,
  },
  {
    title: "Sałatka z soczewicą i fetą light",
    tagline: "Syty lunchbox",
    ingredients: ["100 g soczewicy ugotowanej", "30 g fety light", "ogórek", "pomidor", "oliwa 1 łyżeczka"],
    steps: ["Wymieszaj soczewicę z warzywami.", "Dodaj fetę i oliwę."],
    p: 18, c: 28, f: 8, imagePromptEn: "lentil feta cucumber tomato salad", prepMinutes: 10,
  },
]);

addMany("podwieczorek", [
  {
    title: "Ryżówki z twarogiem i owocami leśnymi",
    tagline: "Chrupiący podwieczorek",
    ingredients: ["2 wafle ryżowe", "80 g twarogu", "garść owoców leśnych", "cynamon"],
    steps: ["Posmaruj wafle twarogiem.", "Ułóż owoce, posyp cynamonem."],
    p: 16, c: 28, f: 4, imagePromptEn: "rice cakes cottage cheese berries", prepMinutes: 5,
  },
  {
    title: "Shake czekoladowy z bananem",
    tagline: "Po treningu",
    ingredients: ["30 g białka czekoladowego", "1 mały banan", "250 ml mleka 1,5%"],
    steps: ["Zblenduj składniki na 20 sekund."],
    p: 30, c: 30, f: 5, imagePromptEn: "chocolate protein banana shake", prepMinutes: 3,
  },
  {
    title: "Hummus z marchewką i papryką",
    tagline: "Warzywny snack",
    ingredients: ["80 g humusu", "marchew", "papryka"],
    steps: ["Pokrój warzywa w słupki.", "Podawaj z hummusem."],
    p: 8, c: 22, f: 10, imagePromptEn: "hummus carrot pepper sticks", prepMinutes: 5,
  },
  {
    title: "Twarożek z rzodkiewką i szczypiorkiem",
    tagline: "Słony podwieczorek",
    ingredients: ["150 g twarogu chudego", "rzodkiewka", "szczypiorek", "1 kromka chleba"],
    steps: ["Wymieszaj twaróg z warzywami.", "Jedz z pieczywem."],
    p: 22, c: 20, f: 4, imagePromptEn: "cottage cheese radish chives bread", prepMinutes: 7,
  },
  {
    title: "Edamame z solą morską i sezamem",
    tagline: "Azjatycki snack",
    ingredients: ["150 g edamame w strąkach", "sól morska", "sezam"],
    steps: ["Obgotuj edamame 4 min.", "Posyp solą i sezamem."],
    p: 16, c: 12, f: 6, imagePromptEn: "edamame sea salt sesame", prepMinutes: 6,
  },
  {
    title: "Kisiel proteinowy z wiśniami",
    tagline: "Słodki, ale lekki",
    ingredients: ["15 g żelatyny lub kisielu", "20 g białka waniliowego", "100 g wiśni", "woda"],
    steps: ["Przygotuj kisiel według opakowania.", "Wmieszaj białko i wiśnie na ciepło."],
    p: 22, c: 18, f: 1, imagePromptEn: "protein cherry jelly dessert", prepMinutes: 10,
  },
]);

addMany("sniadanie", [
  {
    title: "Bowl chia z mlekiem kokosowym light i kiwi",
    tagline: "Na zimno z błonnikiem",
    ingredients: ["30 g nasion chia", "200 ml mleka kokosowego light", "1 kiwi", "10 g wiórków kokosowych"],
    steps: ["Zamocz chia na noc.", "Rano dodaj kiwi i wiórki."],
    p: 10, c: 28, f: 14, imagePromptEn: "chia pudding kiwi coconut", prepMinutes: 5,
  },
  {
    title: "Jajka w koszulkach na szpinaku z pomidorkami",
    tagline: "Lekkie śniadanie warzywne",
    ingredients: ["2 jajka", "100 g szpinaku", "pomidorki koktajlowe", "czosnek"],
    steps: ["Zeszklij szpinak z czosnkiem.", "Ugotuj jajka w koszulkach.", "Podawaj z pomidorkami."],
    p: 18, c: 6, f: 12, imagePromptEn: "poached eggs spinach cherry tomatoes", prepMinutes: 15,
  },
  {
    title: "Kasza manna na mleku z kakao i gruszką",
    tagline: "Dzieciństwo w wersji fitness",
    ingredients: ["40 g kaszy manny", "250 ml mleka", "1 łyżeczka kakao", "1 gruszka"],
    steps: ["Ugotuj mannę na mleku z kakao.", "Dodaj pokrojoną gruszkę."],
    p: 14, c: 48, f: 8, imagePromptEn: "semolina cocoa pear porridge", prepMinutes: 12,
  },
]);

addMany("obiad", [
  {
    title: "Kurczak teriyaki z brokułem i ryżem",
    tagline: "Azjatycki klasyk",
    ingredients: ["140 g kurczaka", "sos teriyaki light", "150 g brokułu", "50 g ryżu"],
    steps: ["Usmaż kurczaka, polej teriyaki.", "Ugotuj ryż i brokuł na parze."],
    p: 38, c: 48, f: 8, imagePromptEn: "chicken teriyaki broccoli rice", prepMinutes: 25,
  },
  {
    title: "Gulasz z indyka z papryką i kaszą gryczaną",
    tagline: "Rozgrzewający obiad",
    ingredients: ["150 g indyka", "papryka, cebula", "przyprawy do gulaszu", "60 g kaszy gryczanej"],
    steps: ["Duś mięso z warzywami.", "Ugotuj grykę osobno."],
    p: 36, c: 40, f: 10, imagePromptEn: "turkey paprika goulash buckwheat", prepMinutes: 45,
  },
  {
    title: "Dorsz w panierce z płatków z puree z kalafiora",
    tagline: "Low-carb obiad rybny",
    ingredients: ["160 g dorsza", "płatki owsiane + jajko do panierki", "kalafior na puree", "sok z cytryny"],
    steps: ["Obtocz rybę, usmaż.", "Zblenduj ugotowany kalafior.", "Dopraw cytryną."],
    p: 36, c: 22, f: 10, imagePromptEn: "oat crusted cod cauliflower mash", prepMinutes: 30,
  },
]);

// Dedup titles
const seen = new Set();
const unique = [];
for (const m of meals) {
  const key = m.title.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(m);
}

const bySlot = {};
for (const m of unique) {
  bySlot[m.slot] = (bySlot[m.slot] ?? 0) + 1;
}

const lines = [
  "/** Autogenerowane przez scripts/generate-meal-catalog.mjs — unikalne dania, bez kombinatorów. */",
  'import type { CatalogMeal } from "@/lib/meal-catalog-types";',
  "",
  "export const MEAL_CATALOG_GENERATED: CatalogMeal[] = [",
];

unique.forEach((m, i) => {
  const id = `${m.slot}-${String(i + 1).padStart(4, "0")}-${slug(m.title)}`;
  const cal = kcal(m.p, m.c, m.f);
  lines.push("  {");
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
  lines.push("  },");
});

lines.push("];");
lines.push("");
lines.push(`export const MEAL_CATALOG_GENERATED_COUNT = ${unique.length};`);
lines.push("");

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${unique.length} unique meals → ${outPath}`);
console.log(bySlot);
