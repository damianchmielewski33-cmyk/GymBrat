import { describe, expect, it } from "vitest";
import { catalogSlotToDiary, diarySlotToCatalog } from "@/lib/diet-slot-map";
import { DIET_DIARY_SLOTS } from "@/lib/diet-diary-slots";
import { MEAL_SLOTS } from "@/lib/meal-catalog";

describe("diet-slot-map", () => {
  it("maps every catalog slot to a diary slot", () => {
    for (const slot of MEAL_SLOTS) {
      expect(DIET_DIARY_SLOTS).toContain(catalogSlotToDiary(slot));
    }
  });

  it("maps diary slots into catalog filters", () => {
    expect(diarySlotToCatalog("lunch")).toBe("obiad");
    expect(diarySlotToCatalog("przekaska")).toBe("podwieczorek");
    expect(diarySlotToCatalog("sniadanie")).toBe("sniadanie");
    expect(catalogSlotToDiary("podwieczorek")).toBe("przekaska");
  });
});
