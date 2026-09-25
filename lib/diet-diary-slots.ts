/**
 * Sekcje dziennika diety w stylu Fitatu (na dole ekranu Dieta).
 * Osobne od slotów katalogu przepisów (`MealSlot` w meal-catalog-types).
 */
export type DietDiarySlot =
  | "sniadanie"
  | "drugie_sniadanie"
  | "lunch"
  | "obiad"
  | "przekaska";

export const DIET_DIARY_SLOT_LABELS: Record<DietDiarySlot, string> = {
  sniadanie: "Śniadanie",
  drugie_sniadanie: "Drugie śniadanie",
  lunch: "Lunch",
  obiad: "Obiad",
  przekaska: "Przekąska",
};

export const DIET_DIARY_SLOTS: DietDiarySlot[] = [
  "sniadanie",
  "drugie_sniadanie",
  "lunch",
  "obiad",
  "przekaska",
];

export function isDietDiarySlot(v: unknown): v is DietDiarySlot {
  return typeof v === "string" && (DIET_DIARY_SLOTS as string[]).includes(v);
}

/** Domyślna sekcja wg godziny lokalnej (jak w Fitatu). */
export function dietDiarySlotFromHour(hour: number): DietDiarySlot {
  if (hour < 10) return "sniadanie";
  if (hour < 12) return "drugie_sniadanie";
  if (hour < 15) return "lunch";
  if (hour < 18) return "obiad";
  return "przekaska";
}
