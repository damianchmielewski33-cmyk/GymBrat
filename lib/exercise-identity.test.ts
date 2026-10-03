import { describe, expect, it } from "vitest";
import {
  foldExerciseText,
  isSameExercise,
  resolveExerciseIdentity,
} from "@/lib/exercise-identity";

describe("exercise-identity", () => {
  it("składa warianty zapisu do jednego klucza", () => {
    expect(foldExerciseText("Bench  Press")).toBe("bench press");
    expect(foldExerciseText("bench-press")).toBe("bench press");
    expect(foldExerciseText("Wyciskanie sztangi na ławce")).toBe(
      "wyciskanie sztangi na lawce",
    );
  });

  it("scala EN alias z polską nazwą katalogu", () => {
    const a = resolveExerciseIdentity("Bench Press");
    const b = resolveExerciseIdentity(
      "Wyciskanie sztangi na ławce poziomej",
    );
    const c = resolveExerciseIdentity("barbell bench press");
    expect(a.catalogId).toBe("c-bench-bar");
    expect(a.key).toBe(b.key);
    expect(a.key).toBe(c.key);
    expect(a.displayName).toBe("Wyciskanie sztangi na ławce poziomej");
    expect(isSameExercise("BB Bench", "Flat Bench Press")).toBe(true);
  });

  it("nie scala różnych ćwiczeń z podobnym słowem", () => {
    expect(
      isSameExercise("Bench Press", "Incline Bench Press"),
    ).toBe(false);
    expect(isSameExercise("Pull Up", "Push Up")).toBe(false);
  });

  it("poza katalogiem scala tylko normalizację zapisu", () => {
    const a = resolveExerciseIdentity("Moje Ćwiczenie");
    const b = resolveExerciseIdentity("moje cwiczenie");
    const c = resolveExerciseIdentity("Inne ćwiczenie");
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
    expect(a.catalogId).toBeNull();
  });
});
