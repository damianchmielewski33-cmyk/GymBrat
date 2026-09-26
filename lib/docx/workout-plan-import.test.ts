import { describe, expect, it } from "vitest";
import { parseWorkoutPlansFromText } from "@/lib/docx/workout-plan-import";

describe("parseWorkoutPlansFromText", () => {
  it("rozbija Word-like tekst na dni z seriami i powtórzeniami", () => {
    const text = `
Dzień A - Push
1. Wyciskanie sztangi na ławce 4x8
2. Wyciskanie żołnierskie 3x10
3. Rozpiętki 3x12

Dzień B - Pull
- Podciąganie 4x6
- Wiosłowanie sztangą 3x10
`;
    const { plans, warnings } = parseWorkoutPlansFromText(text);
    expect(plans.length).toBe(2);
    expect(plans[0]!.planName.toLowerCase()).toContain("dzień a");
    expect(plans[0]!.exercises.length).toBe(3);
    expect(plans[0]!.exercises[0]!.sets).toBe(4);
    expect(plans[0]!.exercises[0]!.reps).toBe(8);
    expect(plans[1]!.exercises.length).toBe(2);
    expect(warnings.some((w) => /2 dni/i.test(w))).toBe(true);
  });

  it("bez nagłówków tworzy jeden plan", () => {
    const { plans } = parseWorkoutPlansFromText(`
Przysiady 5x5
Martwy ciąg 3x5
`);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.planName).toBe("Plan z Worda");
    expect(plans[0]!.exercises).toHaveLength(2);
  });

  it("zwraca ostrzeżenie gdy brak ćwiczeń", () => {
    const { plans, warnings } = parseWorkoutPlansFromText("Dzień A");
    expect(plans).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
