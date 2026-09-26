/** Jednostka ilości przy dodawaniu produktu (jak w Fitatu). */
export type FoodAmountUnit = "g" | "ml" | "pcs";

/** Wartość odżywcza — null = brak danych (b.d.). */
export type NutrientValue = number | null;

/** Szczegóły odżywcze na 100 g (lub 100 ml) — jak w karcie Fitatu. */
export type FoodNutritionDetails = {
  saturatedFatG: NutrientValue;
  monoFatG: NutrientValue;
  polyFatG: NutrientValue;
  omega3G: NutrientValue;
  omega6G: NutrientValue;
  sugarsG: NutrientValue;
  fiberG: NutrientValue;
  saltG: NutrientValue;
  sodiumMg: NutrientValue;
  cholesterolMg: NutrientValue;
  caffeineMg: NutrientValue;
  vitaminAUg: NutrientValue;
  vitaminCMg: NutrientValue;
  vitaminDUg: NutrientValue;
  calciumMg: NutrientValue;
  ironMg: NutrientValue;
  /** Składniki tekstowe (z etykiety / OFF). */
  ingredientsText: string | null;
};

/** Produkt spożywczy w lokalnej bazie / wyniku skanu. */
export type FoodProduct = {
  id: string;
  /** Kod EAN-8 / EAN-13 / UPC — opcjonalny. */
  barcode: string | null;
  name: string;
  brand?: string;
  /** Opis porcji bazowej, np. „100 g”, „1 szt. (30 g)”. */
  servingLabel: string;
  /**
   * Makro dla `basisAmount` w `basisUnit` (domyślnie 100 g).
   * Po skanie OFF ustawiamy zawsze na 100 g — jak Fitatu.
   */
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: "local" | "openfoodfacts";
  /** Ilość, do której odnoszą się makro (domyślnie 100). */
  basisAmount?: number;
  /** Jednostka bazy makro (domyślnie g). */
  basisUnit?: FoodAmountUnit;
  /** Dla sztuk: ile gramów ma 1 sztuka (do przeliczenia na g). */
  gramsPerPiece?: number;
  /**
   * Gramatura / objętość opakowania z etykiety (np. kubek 330 g).
   * Makro nadal są na `basisAmount` (zwykle 100 g) — to tylko podpowiedź porcji.
   */
  packageAmount?: number;
  packageUnit?: FoodAmountUnit;
  /** Szczegóły mikro / tłuszcze / cukry — na 100 g. */
  details?: FoodNutritionDetails;
};
