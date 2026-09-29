import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import type { MealSlot } from "@/lib/meal-catalog-types";

/** Katalog → dziennik (Fitatu). */
export function catalogSlotToDiary(slot: MealSlot): DietDiarySlot {
  switch (slot) {
    case "sniadanie":
      return "sniadanie";
    case "drugie_sniadanie":
      return "drugie_sniadanie";
    case "obiad":
      return "obiad";
    case "podwieczorek":
      return "przekaska";
    case "kolacja":
      return "kolacja";
    default:
      return "obiad";
  }
}

/**
 * Dziennik → filtr katalogu.
 * Lunch nie ma 1:1 w katalogu → obiad; przekąska → podwieczorek.
 */
export function diarySlotToCatalog(slot: DietDiarySlot): MealSlot {
  switch (slot) {
    case "sniadanie":
      return "sniadanie";
    case "drugie_sniadanie":
      return "drugie_sniadanie";
    case "lunch":
      return "obiad";
    case "obiad":
      return "obiad";
    case "przekaska":
      return "podwieczorek";
    case "kolacja":
      return "kolacja";
    default:
      return "obiad";
  }
}
