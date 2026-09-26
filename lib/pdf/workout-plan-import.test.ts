import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseCoachTablePlans,
  parseWorkoutPlansFromPdf,
} from "@/lib/pdf/workout-plan-import";
import { detectWorkoutPlanFileKind } from "@/lib/workout-plan-file-kind";

const COACH_TABLE = `
Push A
1
Pompki na
poręczach
szeroko 2s 8-10p 1 2010
2 Bench Press 1s 6-8p
1s 8-10p 1/0 3010
3 Hammer Chest
Press
1s 8-10p
1s 12-15p 1/0 2101
Pull
1 Teres Pulldown 2s 10-12p 1 2011
2
T-Bar Row
Chest
Supported
1s 8-10p
2s 10-12p 1/0 3011
Nogi
1
Uginanie nóg
leżąc 1s 8-10p
2s 12-15p 1/0 3011
2 Hack Squat 1s 8-12p
1s 12-15p 1/0 2111
5 Wyprosty nóg
na maszynie 3s 8-10 1 2021
`;

describe("detect pdf", () => {
  it("rozpoznaje PDF po magicznych bajtach", () => {
    const buffer = Buffer.from("%PDF-1.4 fake");
    expect(
      detectWorkoutPlanFileKind({ name: "", mime: "application/octet-stream", buffer }),
    ).toBe("pdf");
  });
});

describe("parseCoachTablePlans", () => {
  it("czyta dni Push/Pull/Nogi i zapis 2s 8-10p", () => {
    const { plans } = parseCoachTablePlans(COACH_TABLE);
    expect(plans.map((p) => p.planName)).toEqual(["Push A", "Pull", "Nogi"]);
    const push = plans[0]!;
    expect(push.exercises).toHaveLength(3);
    expect(push.exercises[0]!.sets).toBe(2);
    expect(push.exercises[0]!.reps).toBe(8);
    expect(push.exercises[0]!.name.toLowerCase()).toMatch(/pompk|poręcz|dips|dip/i);
    expect(push.exercises[1]!.sets).toBe(2);
    expect(push.exercises[1]!.reps).toBe(6);
    const nogi = plans[2]!;
    const wyprosty = nogi.exercises.find((e) => /wyprost/i.test(e.name));
    expect(wyprosty?.sets).toBe(3);
    expect(wyprosty?.reps).toBe(8);
  });
});

describe("parseWorkoutPlansFromPdf", () => {
  it("odczytuje plan masowy z PDF (tabele dni)", async () => {
    const path =
      "/home/ubuntu/.cursor/projects/workspace/uploads/Plan_treningowy_Damian_masa_f38e.pdf";
    let buf: Buffer;
    try {
      buf = readFileSync(path);
    } catch {
      return;
    }
    expect(detectWorkoutPlanFileKind({ name: "plan.pdf", mime: "application/pdf", buffer: buf })).toBe(
      "pdf",
    );
    const { plans } = await parseWorkoutPlansFromPdf(buf);
    expect(plans.length).toBeGreaterThanOrEqual(4);
    const names = plans.map((p) => p.planName.toLowerCase());
    expect(names.some((n) => n.includes("push"))).toBe(true);
    expect(names.some((n) => n.includes("pull"))).toBe(true);
    expect(names.some((n) => n.includes("nogi"))).toBe(true);
    expect(names.some((n) => n.includes("klatka") || n.includes("barki"))).toBe(true);
    const totalEx = plans.reduce((n, p) => n + p.exercises.length, 0);
    expect(totalEx).toBeGreaterThanOrEqual(24);
    expect(plans.every((p) => p.exercises.length >= 3)).toBe(true);
  });
});
