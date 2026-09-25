/** Jednostka ilości przy dodawaniu produktu (jak w Fitatu). */
export type FoodAmountUnit = "g" | "ml" | "pcs";

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
};
