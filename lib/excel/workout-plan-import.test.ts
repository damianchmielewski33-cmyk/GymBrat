import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkoutPlansFromXlsx } from "@/lib/excel/workout-plan-import";
import { detectWorkoutPlanFileKind } from "@/lib/workout-plan-file-kind";

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

  it("omija wiersz tytułu i czyta nagłówek z 2. linii", () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Plan treningowy Damian", "", ""],
      ["Ćwiczenie", "Serie", "Powtórzenia"],
      ["Przysiady", 5, 5],
      ["Martwy ciąg", 3, 5],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Dzień A");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBe(1);
    expect(plans[0]!.exercises).toHaveLength(2);
    expect(plans[0]!.exercises[0]!.name.toLowerCase()).toContain("przysiad");
  });

  it("czyta tekstowy układ „Przysiady 4x8” bez nagłówków kolumn", () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Dzień A"],
      ["Przysiady 4x8"],
      ["Wyciskanie 3x10"],
      ["Dzień B"],
      ["Podciąganie 4x6"],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Plan");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans[0]!.exercises[0]!.sets).toBe(4);
  });
});

describe("detectWorkoutPlanFileKind", () => {
  it("rozpoznaje xlsx po magicznych bajtach gdy brak nazwy", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["a"]]),
      "S",
    );
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    expect(
      detectWorkoutPlanFileKind({ name: "", mime: "application/octet-stream", buffer }),
    ).toBe("xlsx");
  });

  it("rozpoznaje po rozszerzeniu mimo dziwnej ścieżki", () => {
    const buffer = Buffer.from([0, 1, 2, 3]);
    expect(
      detectWorkoutPlanFileKind({
        name: "content://downloads/Plan-treningowy.xlsx",
        mime: "",
        buffer,
      }),
    ).toBe("xlsx");
  });
});
