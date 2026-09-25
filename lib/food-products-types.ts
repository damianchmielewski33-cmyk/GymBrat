/** Produkt spożywczy w lokalnej bazie / wyniku skanu (makro na porcję). */
export type FoodProduct = {
  id: string;
  /** Kod EAN-8 / EAN-13 / UPC — opcjonalny. */
  barcode: string | null;
  name: string;
  brand?: string;
  /** Opis porcji, np. „100 g”, „1 szt. (30 g)”. */
  servingLabel: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source: "local" | "openfoodfacts";
};
