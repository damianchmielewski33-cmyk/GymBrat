import { describe, expect, it } from "vitest";
import {
  resolveExerciseMuscleCategory,
  resolveExerciseMuscles,
} from "@/lib/resolve-exercise-muscles";

describe("resolveExerciseMuscles", () => {
  it("gdy brak trafienia w katalogu, używa categoryId z planu", () => {
    expect(
      resolveExerciseMuscleCategory({
        name: "Cokolwiek-xyz-nieistniejace-999",
        categoryId: "biceps",
      }),
    ).toBe("biceps");
  });

  it("nazwa z katalogu wygrywa ze starym domyślnym shoulders z importu", () => {
    expect(
      resolveExerciseMuscleCategory({
        name: "Przysiad ze sztangą",
        categoryId: "shoulders",
      }),
    ).toBe("quads");
  });

  it("heurystyka: francuz → triceps mimo złego categoryId", () => {
    expect(
      resolveExerciseMuscleCategory({
        name: "Francuz sztangą łamaną",
        categoryId: "shoulders",
      }),
    ).toBe("triceps");
  });

  it("dopasowuje biceps z katalogu po nazwie PL", () => {
    expect(
      resolveExerciseMuscleCategory({
        name: "Uginanie przedramion ze sztangą",
        categoryId: null,
      }),
    ).toBe("biceps");
  });

  it("dopasowuje biceps po nazwie bez ogonków", () => {
    expect(
      resolveExerciseMuscleCategory({
        name: "Uginanie przedramion ze sztanga",
        categoryId: null,
      }),
    ).toBe("biceps");
  });

  it("dopasowuje bench press (EN) do klatki", () => {
    expect(
      resolveExerciseMuscleCategory({
        name: "Bench press",
        categoryId: null,
      }),
    ).toBe("chest");
  });

  it("dla klatki dodaje barki i triceps jako synergistów", () => {
    const r = resolveExerciseMuscles({
      name: "Wyciskanie sztangi na ławce poziomej",
      categoryId: "chest",
    });
    expect(r.primary).toBe("chest");
    expect(r.secondary).toEqual(["shoulders", "triceps"]);
    expect(r.preferBackView).toBe(false);
  });

  it("dla pleców preferuje widok z tyłu", () => {
    const r = resolveExerciseMuscles({
      name: "Podciąganie",
      categoryId: "back_upper",
    });
    expect(r.preferBackView).toBe(true);
  });
});
