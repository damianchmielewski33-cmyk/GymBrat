import { describe, expect, it } from "vitest";
import { planToHtml, type PrintablePlan } from "@/lib/pdf/workout-plan-export";

describe("planToHtml", () => {
  it("wstawia nazwy ćwiczeń i schemat serii do HTML", () => {
    const plans: PrintablePlan[] = [
      {
        id: "p1",
        plan: {
          version: 2,
          path: "custom",
          planName: "Push",
          userCustomExerciseNames: [],
          exercises: [
            {
              id: "e1",
              name: "Wyciskanie sztangi",
              categoryId: "chest",
              sets: 4,
              reps: 10,
            },
          ],
        },
      },
    ];
    const html = planToHtml(plans);
    expect(html).toContain("Push");
    expect(html).toContain("Wyciskanie sztangi");
    expect(html).toContain("4s × 10p");
    expect(html).toContain("Drukuj / Zapisz PDF");
  });
});
