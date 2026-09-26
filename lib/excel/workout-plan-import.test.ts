import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkoutPlansFromXlsx } from "@/lib/excel/workout-plan-import";

describe("parseWorkoutPlansFromXlsx", () => {
  it("czyta arkusz z kolumnami dzień / ćwiczenie / serie / powtórzenia", () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Dzień", "Ćwiczenie", "Serie", "Powtórzenia"],
      ["Push A", "Wyciskanie sztangi", 4, 8],
      ["Push A", "Wyciskanie żołnierskie", 3, 10],
      ["Pull B", "Podciąganie", 4, 6],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Plan");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBe(2);
    expect(plans[0]!.exercises).toHaveLength(2);
    expect(plans[0]!.exercises[0]!.sets).toBe(4);
    expect(plans[0]!.exercises[0]!.reps).toBe(8);
    expect(plans[1]!.planName).toBe("Pull B");
  });
});
