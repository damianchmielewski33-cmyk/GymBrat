/**
 * Sekcje dziennika diety w stylu Fitatu.
 */
export type DietDiarySlot =
  | "sniadanie"
  | "drugie_sniadanie"
  | "lunch"
  | "obiad"
  | "przekaska"
  | "kolacja";

export const DIET_DIARY_SLOT_LABELS: Record<DietDiarySlot, string> = {
  sniadanie: "Śniadanie",
  drugie_sniadanie: "II Śniadanie",
  lunch: "Lunch",
  obiad: "Obiad",
  przekaska: "Przekąska",
  kolacja: "Kolacja",
};

export const DIET_DIARY_SLOTS: DietDiarySlot[] = [
  "sniadanie",
  "drugie_sniadanie",
  "lunch",
  "obiad",
  "przekaska",
  "kolacja",
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
  if (hour < 21) return "przekaska";
  return "kolacja";
}
