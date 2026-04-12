/**
 * Kategorie partii mięśniowych + katalog ćwiczeń do budowy planu.
 * Polska nazwa jest kanoniczna; aliasesEn służy do wyszukiwania po angielsku (i frazach mieszanych).
 */

export type MuscleCategory = {
  id: string;
  label: string;
};

/** Wszystkie typowe partie / grupy — użytkownik przypisuje ćwiczenie do kategorii. */
export const MUSCLE_CATEGORIES: MuscleCategory[] = [
  { id: "chest", label: "Klatka piersiowa" },
  { id: "back_upper", label: "Plecy (góra)" },
  { id: "back_mid", label: "Plecy (środek)" },
  { id: "back_lower", label: "Plecy (dół) / lędźwie" },
  { id: "shoulders", label: "Barki" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms", label: "Przedramiona" },
  { id: "core", label: "Brzuch / core" },
  { id: "quads", label: "Uda (przód)" },
  { id: "glutes", label: "Pośladki" },
  { id: "hamstrings", label: "Uda (tył)" },
  { id: "calves", label: "Łydki" },
  { id: "cardio", label: "Cardio" },
];

export type CatalogExercise = {
  id: string;
  /** Kanoniczna nazwa po polsku (wyświetlanie i zapis planu). */
  name: string;
  categoryId: string;
  /** Angielskie nazwy, skróty i warianty zapisu — dopasowanie → polska nazwa. */
  aliasesEn?: string[];
};

export const CATALOG_EXERCISES: CatalogExercise[] = [
  // Klatka
  {
    id: "c-bench-bar",
    name: "Wyciskanie sztangi na ławce poziomej",
    categoryId: "chest",
    aliasesEn: [
      "bench press",
      "barbell bench press",
      "flat bench press",
      "bb bench",
    ],
  },
  {
    id: "c-bench-db",
    name: "Wyciskanie hantli na ławce poziomej",
    categoryId: "chest",
    aliasesEn: ["dumbbell bench press", "db bench press", "dumbbell bench", "flat db press"],
  },
  {
    id: "c-incline-bar",
    name: "Wyciskanie sztangi na ławce dodatniej",
    categoryId: "chest",
    aliasesEn: ["incline bench press", "incline barbell press", "incline bb press"],
  },
  {
    id: "c-incline-db",
    name: "Wyciskanie hantli na ławce dodatniej",
    categoryId: "chest",
    aliasesEn: ["incline dumbbell press", "incline db press"],
  },
  {
    id: "c-decline",
    name: "Wyciskanie na ławce ujemnej",
    categoryId: "chest",
    aliasesEn: ["decline bench press", "decline press"],
  },
  {
    id: "c-fly-db",
    name: "Rozpiętki z hantlami",
    categoryId: "chest",
    aliasesEn: ["dumbbell fly", "db fly", "chest fly", "dumbbell flyes"],
  },
  {
    id: "c-fly-cable",
    name: "Rozpiętki na wyciągu",
    categoryId: "chest",
    aliasesEn: [
      "cable fly",
      "cable crossover",
      "cable chest fly",
      "pec cable fly",
      "cable pec fly",
      "pec fly cable",
      "standing cable fly",
      "standing pec fly",
      "dual cable fly",
      "double cable fly",
      "mid cable fly",
      "horizontal cable fly",
    ],
  },
  {
    id: "c-dips",
    name: "Pompki na poręczach (klatka)",
    categoryId: "chest",
    aliasesEn: ["chest dips", "parallel bar dips", "dip"],
  },
  {
    id: "c-pushup",
    name: "Pompki klasyczne",
    categoryId: "chest",
    aliasesEn: ["push up", "pushup", "push-ups", "press up"],
  },
  {
    id: "c-pullover",
    name: "Przeciąganie hantla (pullover)",
    categoryId: "chest",
    aliasesEn: ["dumbbell pullover", "db pullover", "pullover"],
  },
  {
    id: "c-machine-press",
    name: "Wyciskanie na maszynie (klatka)",
    categoryId: "chest",
    aliasesEn: [
      "machine chest press",
      "hammer strength chest press",
      "plate loaded chest press",
    ],
  },
  {
    id: "c-smith-bench",
    name: "Wyciskanie na Smitha (ławka pozioma)",
    categoryId: "chest",
    aliasesEn: ["smith machine bench press", "smith bench press", "smith press"],
  },
  {
    id: "c-smith-incline",
    name: "Wyciskanie na Smitha (ławka dodatnia)",
    categoryId: "chest",
    aliasesEn: ["smith machine incline press", "incline smith press"],
  },
  {
    id: "c-cable-press",
    name: "Wyciskanie z wyciągu (klatka)",
    categoryId: "chest",
    aliasesEn: ["cable bench press", "standing cable press", "dual cable press"],
  },
  {
    id: "c-pec-deck",
    name: "Motyl / pec deck",
    categoryId: "chest",
    aliasesEn: ["pec deck", "pec fly machine", "butterfly machine"],
  },
  {
    id: "c-fly-low-high",
    name: "Rozpiętki wyciąg od dołu do góry",
    categoryId: "chest",
    aliasesEn: [
      "low to high cable fly",
      "low cable fly",
      "low to high pec fly",
      "pec cable fly low to high",
    ],
  },
  {
    id: "c-fly-high-low",
    name: "Rozpiętki wyciąg od góry do dołu",
    categoryId: "chest",
    aliasesEn: [
      "high to low cable fly",
      "high cable fly",
      "high to low pec fly",
      "pec cable fly high to low",
    ],
  },
  {
    id: "c-fly-cable-single",
    name: "Rozpiętki na wyciągu jednorącz",
    categoryId: "chest",
    aliasesEn: [
      "single arm cable fly",
      "one arm cable fly",
      "single arm pec cable fly",
      "unilateral cable fly",
    ],
  },
  {
    id: "c-fly-cable-incline",
    name: "Rozpiętki na wyciągu na ławce dodatniej",
    categoryId: "chest",
    aliasesEn: [
      "incline cable fly",
      "incline pec cable fly",
      "low incline cable fly",
    ],
  },
  {
    id: "c-svend",
    name: "Nacisk tarczy / Svend press",
    categoryId: "chest",
    aliasesEn: ["svend press", "plate press", "hex press"],
  },
  {
    id: "c-floor-press",
    name: "Wyciskanie ze sztangą z podłogi",
    categoryId: "chest",
    aliasesEn: ["floor press", "barbell floor press", "db floor press"],
  },
  {
    id: "c-diamond-pushup",
    name: "Pompki diamentowe",
    categoryId: "chest",
    aliasesEn: ["diamond push up", "close grip push up", "triangle pushup"],
  },
  {
    id: "c-wide-pushup",
    name: "Pompki szerokie",
    categoryId: "chest",
    aliasesEn: ["wide grip push up", "wide pushup"],
  },
  {
    id: "c-archer-pushup",
    name: "Pompki łucznicze",
    categoryId: "chest",
    aliasesEn: ["archer push up", "typewriter pushup"],
  },
  // Plecy góra
  {
    id: "bu-pullup",
    name: "Podciąganie na drążku",
    categoryId: "back_upper",
    aliasesEn: ["pull up", "pullup", "pull-up", "chin up", "chinup", "lat pull up"],
  },
  {
    id: "bu-lat-pulldown",
    name: "Ściąganie drążka wyciągu górnego",
    categoryId: "back_upper",
    aliasesEn: [
      "lat pulldown",
      "lat pull down",
      "lat pull-down",
      "cable pulldown",
      "wide grip pulldown",
    ],
  },
  {
    id: "bu-pullover-cable",
    name: "Pullover na wyciągu",
    categoryId: "back_upper",
    aliasesEn: ["cable pullover", "straight arm pulldown"],
  },
  {
    id: "bu-facepull",
    name: "Face pull",
    categoryId: "back_upper",
    aliasesEn: ["face pull", "facepull", "rope face pull"],
  },
  {
    id: "bu-pullup-assist",
    name: "Podciąganie z asystą",
    categoryId: "back_upper",
    aliasesEn: ["assisted pull up", "assisted pullup", "machine assisted pullup"],
  },
  {
    id: "bu-pullup-neutral",
    name: "Podciąganie chwytem neutralnym",
    categoryId: "back_upper",
    aliasesEn: ["neutral grip pull up", "neutral pullup", "hammer grip pullup"],
  },
  {
    id: "bu-pullup-wide",
    name: "Podciąganie szerokim chwytem",
    categoryId: "back_upper",
    aliasesEn: ["wide grip pull up", "wide pullup"],
  },
  {
    id: "bu-lat-prayer",
    name: "Modlitwa na wyciągu (lat prayer)",
    categoryId: "back_upper",
    aliasesEn: ["lat prayer", "prayer pulldown"],
  },
  {
    id: "bu-single-arm-lpd",
    name: "Ściąganie jednorącz na wyciągu",
    categoryId: "back_upper",
    aliasesEn: ["single arm lat pulldown", "one arm lat pulldown"],
  },
  {
    id: "bu-close-grip-lpd",
    name: "Ściąganie wąskim chwytem",
    categoryId: "back_upper",
    aliasesEn: ["close grip lat pulldown", "v bar pulldown"],
  },
  {
    id: "bu-pullup-weighted",
    name: "Podciąganie z obciążeniem",
    categoryId: "back_upper",
    aliasesEn: ["weighted pull up", "weighted pullup"],
  },
  // Plecy środek
  {
    id: "bm-row-barbell",
    name: "Wiosłowanie sztangą w opadzie",
    categoryId: "back_mid",
    aliasesEn: [
      "bent over row",
      "barbell row",
      "pendlay row",
      "bb row",
      "bent over barbell row",
    ],
  },
  {
    id: "bm-row-db",
    name: "Wiosłowanie hantłem jednorącz",
    categoryId: "back_mid",
    aliasesEn: [
      "dumbbell row",
      "one arm dumbbell row",
      "single arm dumbbell row",
      "db row",
      "kroczek",
    ],
  },
  {
    id: "bm-row-cable",
    name: "Wiosłowanie na wyciągu siedząc",
    categoryId: "back_mid",
    aliasesEn: [
      "seated cable row",
      "cable row",
      "single arm cable row",
      "one arm cable row",
      "unilateral cable row",
      "kneeling cable row",
      "low cable row",
      "mid row",
    ],
  },
  {
    id: "bm-chest-supported",
    name: "Wiosłowanie na ławce (chest-supported)",
    categoryId: "back_mid",
    aliasesEn: [
      "chest supported row",
      "incline bench row",
      "supported dumbbell row",
      "seal row",
    ],
  },
  {
    id: "bm-tbar",
    name: "Wiosłowanie w opadzie (T-bar)",
    categoryId: "back_mid",
    aliasesEn: ["t-bar row", "t bar row", "tbar row", "landmine row"],
  },
  {
    id: "bm-inverted-row",
    name: "Wiosłowanie pod kątem (inverted row)",
    categoryId: "back_mid",
    aliasesEn: ["inverted row", "bodyweight row", "australian pull up", "ring row"],
  },
  {
    id: "bm-meadows",
    name: "Wiosłowanie z kroczkiem (Meadows row)",
    categoryId: "back_mid",
    aliasesEn: ["meadows row", "landmine meadows row"],
  },
  {
    id: "bm-machine-row",
    name: "Wiosłowanie na maszynie",
    categoryId: "back_mid",
    aliasesEn: ["machine row", "seated row machine", "hammer strength row"],
  },
  {
    id: "bm-yates",
    name: "Wiosłowanie Yatesa (podchwyt)",
    categoryId: "back_mid",
    aliasesEn: ["yates row", "underhand barbell row"],
  },
  {
    id: "bm-renegade",
    name: "Renegade row",
    categoryId: "back_mid",
    aliasesEn: ["renegade row", "plank row"],
  },
  {
    id: "bm-gorilla",
    name: "Wiosłowanie hantlami jednocześnie (Gorilla row)",
    categoryId: "back_mid",
    aliasesEn: ["gorilla row", "bent over dual dumbbell row"],
  },
  {
    id: "bm-high-row",
    name: "Wiosłowanie wysokie na maszynie / wyciągu",
    categoryId: "back_mid",
    aliasesEn: ["machine high row", "high row", "cable high row"],
  },
  // Plecy dół / lędźwie
  {
    id: "bl-deadlift",
    name: "Martwy ciąg klasyczny",
    categoryId: "back_lower",
    aliasesEn: ["deadlift", "conventional deadlift", "bb deadlift"],
  },
  {
    id: "bl-rdl",
    name: "Rumuński martwy ciąg (RDL)",
    categoryId: "back_lower",
    aliasesEn: ["romanian deadlift", "rdl", "stiff leg deadlift"],
  },
  {
    id: "bl-hyper",
    name: "Nadprożna / hyperextension",
    categoryId: "back_lower",
    aliasesEn: ["hyperextension", "back extension", "45 hyper", "reverse hyper"],
  },
  {
    id: "bl-back-ext",
    name: "Prostowanie tułowia na ławce",
    categoryId: "back_lower",
    aliasesEn: ["back extension machine", "lower back extension"],
  },
  {
    id: "bl-sumodelift",
    name: "Martwy ciąg sumo",
    categoryId: "back_lower",
    aliasesEn: ["sumo deadlift", "wide stance deadlift"],
  },
  {
    id: "bl-trapbar",
    name: "Martwy ciąg na sztandze trapezowej",
    categoryId: "back_lower",
    aliasesEn: ["trap bar deadlift", "hex bar deadlift"],
  },
  {
    id: "bl-rack-pull",
    name: "Martwy ciąg z racka (częściowy zakres)",
    categoryId: "back_lower",
    aliasesEn: ["rack pull", "partial deadlift"],
  },
  {
    id: "bl-reverse-hyper",
    name: "Reverse hyperextension",
    categoryId: "back_lower",
    aliasesEn: ["reverse hyper", "reverse hyperextension"],
  },
  {
    id: "bl-snatch-rdl",
    name: "RDL z chwytem szerokim (snatch grip)",
    categoryId: "back_lower",
    aliasesEn: ["snatch grip rdl", "wide grip rdl"],
  },
  // Barki
  {
    id: "s-ohp-bar",
    name: "Wyciskanie nad głowę sztangą",
    categoryId: "shoulders",
    aliasesEn: ["overhead press", "ohp", "military press", "standing press", "barbell ohp"],
  },
  {
    id: "s-ohp-db",
    name: "Wyciskanie hantli nad głowę",
    categoryId: "shoulders",
    aliasesEn: ["dumbbell shoulder press", "db ohp", "seated shoulder press"],
  },
  {
    id: "s-lateral",
    name: "Unoszenie hantli bokiem",
    categoryId: "shoulders",
    aliasesEn: ["lateral raise", "side raise", "dumbbell lateral raise"],
  },
  {
    id: "s-front-raise",
    name: "Unoszenie hantli przodem",
    categoryId: "shoulders",
    aliasesEn: ["front raise", "front dumbbell raise"],
  },
  {
    id: "s-rear-fly",
    name: "Odwrócone rozpiętki / ptaki",
    categoryId: "shoulders",
    aliasesEn: ["rear delt fly", "reverse fly", "rear delt raise", "bent over lateral raise"],
  },
  {
    id: "s-upright-row",
    name: "Podciąganie sztangi pod brodę",
    categoryId: "shoulders",
    aliasesEn: ["upright row", "barbell upright row"],
  },
  {
    id: "s-arhnold",
    name: "Arnoldki",
    categoryId: "shoulders",
    aliasesEn: ["arnold press", "arnold dumbbell press"],
  },
  {
    id: "s-landmine-press",
    name: "Wyciskanie landmine",
    categoryId: "shoulders",
    aliasesEn: ["landmine press", "single arm landmine press", "angled press"],
  },
  {
    id: "s-machine-press",
    name: "Wyciskanie barków na maszynie",
    categoryId: "shoulders",
    aliasesEn: ["machine shoulder press", "plate loaded shoulder press"],
  },
  {
    id: "s-push-press",
    name: "Wyciskanie wypychane (push press)",
    categoryId: "shoulders",
    aliasesEn: ["push press", "dip and drive press"],
  },
  {
    id: "s-cable-lateral",
    name: "Unoszenie bokiem na wyciągu",
    categoryId: "shoulders",
    aliasesEn: ["cable lateral raise", "cable side raise"],
  },
  {
    id: "s-y-raise",
    name: "Unoszenie w literę Y",
    categoryId: "shoulders",
    aliasesEn: ["y raise", "dumbbell y raise", "cable y raise"],
  },
  {
    id: "s-shrug-bar",
    name: "Unoszenie barków ze sztangą (shrugs)",
    categoryId: "shoulders",
    aliasesEn: ["barbell shrug", "shrugs", "trap shrug"],
  },
  {
    id: "s-shrug-db",
    name: "Unoszenie barków z hantlami",
    categoryId: "shoulders",
    aliasesEn: ["dumbbell shrug", "db shrug"],
  },
  {
    id: "s-pike-pushup",
    name: "Pompki pike (barki)",
    categoryId: "shoulders",
    aliasesEn: ["pike push up", "pike pushup"],
  },
  {
    id: "s-cable-rear",
    name: "Tył barków na wyciągu",
    categoryId: "shoulders",
    aliasesEn: ["cable rear delt fly", "rope rear delt"],
  },
  // Biceps
  {
    id: "bi-barbell-curl",
    name: "Uginanie przedramion ze sztangą",
    categoryId: "biceps",
    aliasesEn: ["barbell curl", "bb curl", "standing curl"],
  },
  {
    id: "bi-db-curl",
    name: "Uginanie hantlami stojąc",
    categoryId: "biceps",
    aliasesEn: ["dumbbell curl", "db curl", "alternating curl"],
  },
  {
    id: "bi-hammer",
    name: "Uginanie młotkowe",
    categoryId: "biceps",
    aliasesEn: ["hammer curl", "neutral grip curl"],
  },
  {
    id: "bi-preacher",
    name: "Uginanie na modlitewniku",
    categoryId: "biceps",
    aliasesEn: ["preacher curl", "scott curl"],
  },
  {
    id: "bi-cable-curl",
    name: "Uginanie na wyciągu dolnym",
    categoryId: "biceps",
    aliasesEn: ["cable curl", "low cable curl"],
  },
  {
    id: "bi-concentration",
    name: "Uginanie koncentracyjne",
    categoryId: "biceps",
    aliasesEn: ["concentration curl"],
  },
  {
    id: "bi-incline-curl",
    name: "Uginanie hantli na ławce dodatniej",
    categoryId: "biceps",
    aliasesEn: ["incline dumbbell curl", "incline curl"],
  },
  {
    id: "bi-spider",
    name: "Uginanie „pająk” na ławce",
    categoryId: "biceps",
    aliasesEn: ["spider curl", "prone incline curl"],
  },
  {
    id: "bi-zottman",
    name: "Uginanie Zottmana",
    categoryId: "biceps",
    aliasesEn: ["zottman curl"],
  },
  {
    id: "bi-drag",
    name: "Uginanie przeciągnięte (drag curl)",
    categoryId: "biceps",
    aliasesEn: ["drag curl", "barbell drag curl"],
  },
  {
    id: "bi-bayesian",
    name: "Uginanie bayesian z wyciągu",
    categoryId: "biceps",
    aliasesEn: ["bayesian curl", "behind body cable curl"],
  },
  {
    id: "bi-machine",
    name: "Uginanie na maszynie",
    categoryId: "biceps",
    aliasesEn: ["machine curl", "preacher machine"],
  },
  // Triceps
  {
    id: "tr-pushdown",
    name: "Prostowanie na wyciągu (lina / drążek)",
    categoryId: "triceps",
    aliasesEn: ["tricep pushdown", "cable pushdown", "rope pushdown"],
  },
  {
    id: "tr-skull",
    name: "Prostowanie leżąc (francuskie)",
    categoryId: "triceps",
    aliasesEn: ["skull crusher", "lying tricep extension", "french press"],
  },
  {
    id: "tr-overhead",
    name: "Prostowanie nad głowę z hantlem",
    categoryId: "triceps",
    aliasesEn: ["overhead tricep extension", "single dumbbell extension"],
  },
  {
    id: "tr-dips",
    name: "Pompki na poręczach (triceps)",
    categoryId: "triceps",
    aliasesEn: ["tricep dips", "bench dips"],
  },
  {
    id: "tr-kickback",
    name: "Kickback z hantlem",
    categoryId: "triceps",
    aliasesEn: ["tricep kickback", "dumbbell kickback"],
  },
  {
    id: "tr-close-grip",
    name: "Wąski wycisk na ławce",
    categoryId: "triceps",
    aliasesEn: ["close grip bench press", "cgbp", "narrow bench"],
  },
  {
    id: "tr-machine-dip",
    name: "Prostowanie na maszynie (dip)",
    categoryId: "triceps",
    aliasesEn: ["machine dip", "assisted dip machine", "chest dip machine"],
  },
  {
    id: "tr-single-pushdown",
    name: "Prostowanie jednorącz na wyciągu",
    categoryId: "triceps",
    aliasesEn: ["single arm pushdown", "one arm pushdown"],
  },
  {
    id: "tr-cross-cable",
    name: "Prostowanie z górnego wyciągu (krzyżowe)",
    categoryId: "triceps",
    aliasesEn: ["cable crossover extension", "overhead cable extension"],
  },
  {
    id: "tr-jm-press",
    name: "JM press",
    categoryId: "triceps",
    aliasesEn: ["jm press"],
  },
  // Przedramiona
  {
    id: "f-wrist-curl",
    name: "Uginanie nadgarstków podchwytem",
    categoryId: "forearms",
    aliasesEn: ["wrist curl", "palms up wrist curl"],
  },
  {
    id: "f-reverse-curl",
    name: "Uginanie nachwytem",
    categoryId: "forearms",
    aliasesEn: ["reverse curl", "pronated curl"],
  },
  {
    id: "f-farmer",
    name: "Farmer walk",
    categoryId: "forearms",
    aliasesEn: ["farmer carry", "farmer walk", "loaded carry"],
  },
  {
    id: "f-wrist-ext",
    name: "Prostowanie nadgarstków",
    categoryId: "forearms",
    aliasesEn: ["wrist extension", "reverse wrist curl standing"],
  },
  {
    id: "f-dead-hang",
    name: "Zwis na drążku (chwyt)",
    categoryId: "forearms",
    aliasesEn: ["dead hang", "passive hang"],
  },
  {
    id: "f-wrist-roller",
    name: "Wałek do przedramion",
    categoryId: "forearms",
    aliasesEn: ["wrist roller", "forearm roller"],
  },
  // Core
  {
    id: "co-plank",
    name: "Deska (plank)",
    categoryId: "core",
    aliasesEn: ["plank", "front plank", "high plank"],
  },
  {
    id: "co-dead-bug",
    name: "Dead bug",
    categoryId: "core",
    aliasesEn: ["dead bug"],
  },
  {
    id: "co-crunch",
    name: "Spięcia brzucha",
    categoryId: "core",
    aliasesEn: ["crunch", "ab crunch", "sit up"],
  },
  {
    id: "co-leg-raise",
    name: "Unoszenie nóg w zwisie",
    categoryId: "core",
    aliasesEn: ["hanging leg raise", "leg raise", "knee raise"],
  },
  {
    id: "co-cable-crunch",
    name: "Spięcia brzucha na wyciągu",
    categoryId: "core",
    aliasesEn: ["cable crunch", "kneeling cable crunch"],
  },
  {
    id: "co-russian",
    name: "Russian twist",
    categoryId: "core",
    aliasesEn: ["russian twist"],
  },
  {
    id: "co-ab-wheel",
    name: "Koło do brzucha (ab wheel)",
    categoryId: "core",
    aliasesEn: ["ab wheel", "ab rollout", "rollout"],
  },
  {
    id: "co-side-plank",
    name: "Deska boczna",
    categoryId: "core",
    aliasesEn: ["side plank", "lateral plank"],
  },
  {
    id: "co-pallof",
    name: "Antyrotacja Pallofa",
    categoryId: "core",
    aliasesEn: ["pallof press", "cable anti rotation"],
  },
  {
    id: "co-woodchop",
    name: "Ścinanie drzewa na wyciągu",
    categoryId: "core",
    aliasesEn: ["cable woodchop", "wood chop"],
  },
  {
    id: "co-bicycle",
    name: "Rowerkowanie (brzuch)",
    categoryId: "core",
    aliasesEn: ["bicycle crunch", "air bike crunch"],
  },
  {
    id: "co-vup",
    name: "Spięcia V-ups",
    categoryId: "core",
    aliasesEn: ["v up", "v-up", "jackknife sit up"],
  },
  {
    id: "co-hanging-knee",
    name: "Unoszenie kolan w zwisie",
    categoryId: "core",
    aliasesEn: ["hanging knee raise", "captains chair knee raise"],
  },
  {
    id: "co-toes-bar",
    name: "Palce do drążka (toes to bar)",
    categoryId: "core",
    aliasesEn: ["toes to bar", "ttb", "strict toes to bar"],
  },
  {
    id: "co-hollow",
    name: "Hollow body hold",
    categoryId: "core",
    aliasesEn: ["hollow hold", "hollow body"],
  },
  // Uda przód
  {
    id: "q-squat",
    name: "Przysiad ze sztangą",
    categoryId: "quads",
    aliasesEn: ["squat", "back squat", "barbell squat", "bb squat"],
  },
  {
    id: "q-front-squat",
    name: "Przysiad przedni",
    categoryId: "quads",
    aliasesEn: ["front squat"],
  },
  {
    id: "q-goblet",
    name: "Przysiad goblet",
    categoryId: "quads",
    aliasesEn: ["goblet squat"],
  },
  {
    id: "q-leg-press",
    name: "Wypychanie nogami na suwnicy",
    categoryId: "quads",
    aliasesEn: ["leg press", "sled leg press"],
  },
  {
    id: "q-lunge",
    name: "Wykroki",
    categoryId: "quads",
    aliasesEn: ["lunge", "walking lunge", "forward lunge"],
  },
  {
    id: "q-bulgarian",
    name: "Wykroki bułgarskie",
    categoryId: "quads",
    aliasesEn: ["bulgarian split squat", "bss", "split squat"],
  },
  {
    id: "q-extension",
    name: "Prostowanie nóg na maszynie",
    categoryId: "quads",
    aliasesEn: ["leg extension", "quad extension"],
  },
  {
    id: "q-hack-squat",
    name: "Przysiad hack",
    categoryId: "quads",
    aliasesEn: ["hack squat", "machine hack squat"],
  },
  {
    id: "q-smith-squat",
    name: "Przysiad na Smithu",
    categoryId: "quads",
    aliasesEn: ["smith machine squat", "smith squat"],
  },
  {
    id: "q-sissy",
    name: "Przysiad Sissy",
    categoryId: "quads",
    aliasesEn: ["sissy squat", "lean back squat"],
  },
  {
    id: "q-step-up",
    name: "Wchodzenie na skrzynię (step-up)",
    categoryId: "quads",
    aliasesEn: ["step up", "box step up", "dumbbell step up"],
  },
  {
    id: "q-wall-sit",
    name: "Siad ścienny",
    categoryId: "quads",
    aliasesEn: ["wall sit", "wall squat"],
  },
  {
    id: "q-pendulum-squat",
    name: "Przysiad na maszynie wahadłowej",
    categoryId: "quads",
    aliasesEn: ["pendulum squat", "pit shark squat"],
  },
  {
    id: "q-vsquat",
    name: "Przysiad V-squat",
    categoryId: "quads",
    aliasesEn: ["v squat", "vertical leg press squat"],
  },
  // Pośladki
  {
    id: "g-hip-thrust",
    name: "Hip thrust",
    categoryId: "glutes",
    aliasesEn: ["hip thrust", "barbell hip thrust", "glute bridge weighted"],
  },
  {
    id: "g-bridge",
    name: "Mostek z hantlem",
    categoryId: "glutes",
    aliasesEn: ["glute bridge", "dumbbell glute bridge"],
  },
  {
    id: "g-kickback-cable",
    name: "Zakopy na wyciągu",
    categoryId: "glutes",
    aliasesEn: ["cable kickback", "glute kickback"],
  },
  {
    id: "g-abduction",
    name: "Odwodzenie nóg (maszyna)",
    categoryId: "glutes",
    aliasesEn: ["hip abduction", "abduction machine"],
  },
  {
    id: "g-cable-pull",
    name: "Przeciąg bioder z wyciągu (pull-through)",
    categoryId: "glutes",
    aliasesEn: ["cable pull through", "rope pull through"],
  },
  {
    id: "g-single-bridge",
    name: "Mostek jednonóż",
    categoryId: "glutes",
    aliasesEn: ["single leg glute bridge", "one leg bridge"],
  },
  {
    id: "g-curtsy",
    name: "Wykrok ułożony (curtsy lunge)",
    categoryId: "glutes",
    aliasesEn: ["curtsy lunge", "crossover lunge"],
  },
  {
    id: "g-frog",
    name: "Pompki żabie na pośladki (frog pump)",
    categoryId: "glutes",
    aliasesEn: ["frog pump", "glute bridge frog"],
  },
  {
    id: "g-smith-thrust",
    name: "Hip thrust na Smithu",
    categoryId: "glutes",
    aliasesEn: ["smith hip thrust"],
  },
  // Uda tył
  {
    id: "h-leg-curl-lying",
    name: "Uginanie nóg leżąc",
    categoryId: "hamstrings",
    aliasesEn: ["lying leg curl", "hamstring curl lying"],
  },
  {
    id: "h-leg-curl-seated",
    name: "Uginanie nóg siedząc",
    categoryId: "hamstrings",
    aliasesEn: ["seated leg curl"],
  },
  {
    id: "h-nordic",
    name: "Nordic curl (jeśli dostępne)",
    categoryId: "hamstrings",
    aliasesEn: ["nordic curl", "nordic hamstring curl"],
  },
  {
    id: "h-good-morning",
    name: "Dobry dzień",
    categoryId: "hamstrings",
    aliasesEn: ["good morning", "barbell good morning"],
  },
  {
    id: "h-ghd-curl",
    name: "Uginanie nóg na ławce GHD",
    categoryId: "hamstrings",
    aliasesEn: ["ghd hamstring curl", "glute ham raise leg curl"],
  },
  {
    id: "h-db-rdl",
    name: "RDL z hantlami",
    categoryId: "hamstrings",
    aliasesEn: ["dumbbell rdl", "dumbbell romanian deadlift"],
  },
  {
    id: "h-cable-rdl",
    name: "RDL z wyciągiem",
    categoryId: "hamstrings",
    aliasesEn: ["cable romanian deadlift", "cable rdl", "standing cable deadlift"],
  },
  {
    id: "h-single-curl",
    name: "Uginanie nóg jednonóż",
    categoryId: "hamstrings",
    aliasesEn: ["single leg curl", "one leg hamstring curl"],
  },
  // Łydki
  {
    id: "ca-standing",
    name: "Wspięcia na łydkach stojąc",
    categoryId: "calves",
    aliasesEn: ["standing calf raise", "calf raise standing"],
  },
  {
    id: "ca-seated",
    name: "Wspięcia na łydkach siedząc",
    categoryId: "calves",
    aliasesEn: ["seated calf raise"],
  },
  {
    id: "ca-donkey",
    name: "Wspięcia (donkey / maszyna)",
    categoryId: "calves",
    aliasesEn: ["donkey calf raise", "calf raise machine"],
  },
  {
    id: "ca-single-leg",
    name: "Wspięcia jednonóż stojąc",
    categoryId: "calves",
    aliasesEn: ["single leg calf raise", "one leg calf raise"],
  },
  {
    id: "ca-leg-press",
    name: "Wspięcia na suwnicy",
    categoryId: "calves",
    aliasesEn: ["leg press calf raise", "sled calf press"],
  },
  {
    id: "ca-tibialis",
    name: "Unoszenie grzbietu stopy (piszczel)",
    categoryId: "calves",
    aliasesEn: ["tibialis raise", "tibia raise", "reverse calf raise"],
  },
  // Cardio
  {
    id: "cd-treadmill",
    name: "Bieżnia",
    categoryId: "cardio",
    aliasesEn: ["treadmill", "running machine", "jog"],
  },
  {
    id: "cd-bike",
    name: "Rower stacjonarny",
    categoryId: "cardio",
    aliasesEn: ["stationary bike", "bike", "cycling", "spin bike"],
  },
  {
    id: "cd-rower",
    name: "Wioślarz",
    categoryId: "cardio",
    aliasesEn: ["rower", "rowing machine", "concept2"],
  },
  {
    id: "cd-elliptical",
    name: "Orbitrek",
    categoryId: "cardio",
    aliasesEn: ["elliptical", "cross trainer"],
  },
  {
    id: "cd-ski",
    name: "Ergometr narciarski",
    categoryId: "cardio",
    aliasesEn: ["ski erg", "ski machine"],
  },
  {
    id: "cd-jump-rope",
    name: "Skakanka",
    categoryId: "cardio",
    aliasesEn: ["jump rope", "skipping rope", "rope skip"],
  },
  {
    id: "cd-stair",
    name: "Schody (StepMill / stairmaster)",
    categoryId: "cardio",
    aliasesEn: ["stairmaster", "stair climber", "step mill"],
  },
  {
    id: "cd-assault-bike",
    name: "Rower air bike",
    categoryId: "cardio",
    aliasesEn: ["assault bike", "air bike", "fan bike"],
  },
  {
    id: "cd-battle-ropes",
    name: "Liny bojowe",
    categoryId: "cardio",
    aliasesEn: ["battle ropes", "heavy ropes"],
  },
  {
    id: "cd-burpee",
    name: "Burpee",
    categoryId: "cardio",
    aliasesEn: ["burpee", "burpees"],
  },
  {
    id: "cd-swim",
    name: "Pływanie",
    categoryId: "cardio",
    aliasesEn: ["swimming", "swim"],
  },
  {
    id: "cd-versa",
    name: "VersaClimber",
    categoryId: "cardio",
    aliasesEn: ["versa climber", "versaclimber"],
  },
  {
    id: "cd-walking",
    name: "Marsz / chód",
    categoryId: "cardio",
    aliasesEn: ["walking", "brisk walk", "incline walk"],
  },
];

/** Normalizacja zapytania: małe litery, pojedyncze spacje. */
export function normalizeForSearch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Tekst do przeszukania: polska nazwa + aliasy (bez polskich znaków opcjonalnie później). */
function exerciseSearchHaystack(ex: CatalogExercise): string {
  const parts = [ex.name, ...(ex.aliasesEn ?? [])];
  return parts.join(" ").toLowerCase();
}

/**
 * Dopasowanie po tokenach: każdy wyraz zapytania musi wystąpić w nazwie lub aliasach.
 * Dzięki temu "single arm cable row" znajdzie ćwiczenie z aliasem "single arm cable row".
 */
export function exerciseMatchesQuery(ex: CatalogExercise, rawQuery: string): boolean {
  const q = normalizeForSearch(rawQuery);
  if (!q) return true;
  const haystack = exerciseSearchHaystack(ex);
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => haystack.includes(t));
}

function scoreCatalogMatch(ex: CatalogExercise, rawQuery: string): number {
  const q = normalizeForSearch(rawQuery);
  const nameN = normalizeForSearch(ex.name);
  if (nameN === q) return 1000;
  for (const a of ex.aliasesEn ?? []) {
    const an = normalizeForSearch(a);
    if (an === q) return 950;
    if (an.includes(q) && q.length >= 3) return 800 + Math.min(q.length, 50);
  }
  if (nameN.includes(q)) return 600 + Math.min(q.length, 40);
  return 100;
}

/**
 * Najlepsze dopasowanie z katalogu po dowolnym wpisie (PL/EN).
 * Używane przy dodawaniu „własnego” ćwiczenia — jeśli trafienie, zapisujemy polską nazwę.
 */
export function findBestCatalogMatch(rawInput: string): CatalogExercise | null {
  const q = normalizeForSearch(rawInput);
  if (!q) return null;
  const candidates = CATALOG_EXERCISES.filter((ex) => exerciseMatchesQuery(ex, rawInput));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  let best = candidates[0]!;
  let bestScore = scoreCatalogMatch(best, rawInput);
  for (const ex of candidates.slice(1)) {
    const s = scoreCatalogMatch(ex, rawInput);
    if (s > bestScore) {
      bestScore = s;
      best = ex;
    }
  }
  return best;
}

export function categoryLabel(id: string): string {
  return MUSCLE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function exercisesForCategory(categoryId: string): CatalogExercise[] {
  return CATALOG_EXERCISES.filter((e) => e.categoryId === categoryId);
}

/**
 * Lista do panelu wyszukiwania: pusta fraza → tylko wybrana kategoria; z frazą → cały katalog z dopasowaniem.
 */
export function searchCatalogForPicker(
  categoryId: string,
  rawQuery: string,
): CatalogExercise[] {
  const q = normalizeForSearch(rawQuery);
  if (!q) {
    return exercisesForCategory(categoryId);
  }
  const matched = CATALOG_EXERCISES.filter((ex) => exerciseMatchesQuery(ex, rawQuery));
  const inCategory = matched.filter((ex) => ex.categoryId === categoryId);
  const rest = matched.filter((ex) => ex.categoryId !== categoryId);
  return [...inCategory, ...rest];
}
