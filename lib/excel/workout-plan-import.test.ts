import { describe, expect, it } from "vitest";
import { parseWorkoutPlansFromXlsx } from "@/lib/excel/workout-plan-import";
import type { CellValue } from "@/lib/excel/read-xlsx";
import { buildTestXlsx } from "@/lib/excel/xlsx-test-builder";
import { detectWorkoutPlanFileKind } from "@/lib/workout-plan-file-kind";

function xlsxBuffer(name: string, rows: CellValue[][]): Buffer {
  return Buffer.from(buildTestXlsx([{ name, rows }]));
}

describe("parseWorkoutPlansFromXlsx", () => {
  it("czyta arkusz z kolumnami dzień / ćwiczenie / serie / powtórzenia", () => {
    const buffer = xlsxBuffer("Plan", [
      ["Dzień", "Ćwiczenie", "Serie", "Powtórzenia"],
      ["Push A", "Wyciskanie sztangi", 4, 8],
      ["Push A", "Wyciskanie żołnierskie", 3, 10],
      ["Pull B", "Podciąganie", 4, 6],
    ]);
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBe(2);
    expect(plans[0]!.exercises).toHaveLength(2);
    expect(plans[0]!.exercises[0]!.sets).toBe(4);
    expect(plans[0]!.exercises[0]!.reps).toBe(8);
    expect(plans[1]!.planName).toBe("Pull B");
  });

  it("omija wiersz tytułu i czyta nagłówek z 2. linii", () => {
    const buffer = xlsxBuffer("Dzień A", [
      ["Plan treningowy Damian", "", ""],
      ["Ćwiczenie", "Serie", "Powtórzenia"],
      ["Przysiady", 5, 5],
      ["Martwy ciąg", 3, 5],
    ]);
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBe(1);
    expect(plans[0]!.exercises).toHaveLength(2);
    expect(plans[0]!.exercises[0]!.name.toLowerCase()).toContain("przysiad");
  });

  it("czyta tekstowy układ „Przysiady 4x8” bez nagłówków kolumn", () => {
    const buffer = xlsxBuffer("Plan", [
      ["Dzień A"],
      ["Przysiady 4x8"],
      ["Wyciskanie 3x10"],
      ["Dzień B"],
      ["Podciąganie 4x6"],
    ]);
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBeGreaterThanOrEqual(2);
    expect(plans[0]!.exercises[0]!.sets).toBe(4);
  });

  it("nagłówek „__proto__” w pliku nie zanieczyszcza prototypów", () => {
    const buffer = xlsxBuffer("Plan", [
      ["__proto__", "Ćwiczenie", "Serie", "Powtórzenia"],
      ["polluted", "Przysiady", 4, 8],
    ]);
    const { plans } = parseWorkoutPlansFromXlsx(buffer);
    expect(plans.length).toBeGreaterThan(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("uszkodzony plik daje ostrzeżenie zamiast wyjątku", () => {
    const { plans, warnings } = parseWorkoutPlansFromXlsx(Buffer.from("to nie jest excel"));
    expect(plans).toEqual([]);
    expect(warnings[0]).toMatch(/Excel/);
  });

  it("stary format .xls nie jest obsługiwany i użytkownik dostaje wskazówkę", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const { plans, warnings } = parseWorkoutPlansFromXlsx(ole);
    expect(plans).toEqual([]);
    expect(warnings[0]).toMatch(/\.xlsx/);
  });
});

describe("detectWorkoutPlanFileKind", () => {
  it("rozpoznaje xlsx po magicznych bajtach gdy brak nazwy", () => {
    const buffer = xlsxBuffer("S", [["a"]]);
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
