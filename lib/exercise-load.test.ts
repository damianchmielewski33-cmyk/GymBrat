import { describe, expect, it } from "vitest";
import { exerciseUsesExternalLoad } from "@/lib/exercise-load";

const set = (weight: number) => ({ reps: 8, weight, done: false });
const ex = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  sets: [set(0)],
  ...extra,
});

describe("exerciseUsesExternalLoad", () => {
  it("ćwiczenia ze sprzętem z obciążeniem po nazwie", () => {
    expect(exerciseUsesExternalLoad(ex("Wyciskanie sztangi leżąc"))).toBe(true);
    expect(exerciseUsesExternalLoad(ex("Uginanie z hantlami"))).toBe(true);
    expect(exerciseUsesExternalLoad(ex("Leg press"))).toBe(true);
    expect(exerciseUsesExternalLoad(ex("Martwy ciąg"))).toBe(true);
  });

  it("ćwiczenia z masą ciała nie wymagają obciążenia", () => {
    expect(exerciseUsesExternalLoad(ex("Pompki"))).toBe(false);
    expect(exerciseUsesExternalLoad(ex("Podciąganie nachwytem"))).toBe(false);
    expect(exerciseUsesExternalLoad(ex("Plank"))).toBe(false);
  });

  it("dowód z danych wygrywa z nazwą", () => {
    expect(
      exerciseUsesExternalLoad(ex("Podciąganie", { lastSessionSets: [{ ...set(10), done: true }] })),
    ).toBe(true);
    expect(exerciseUsesExternalLoad({ name: "Pompki", sets: [set(0), set(20)] })).toBe(true);
    expect(exerciseUsesExternalLoad(ex("Nieznane", { suggestedWeights: [null, 12.5] }))).toBe(true);
  });

  it("nieznana nazwa bez danych — bez pytania", () => {
    expect(exerciseUsesExternalLoad(ex("Ćwiczenie dowolne"))).toBe(false);
  });
});
