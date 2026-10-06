import { describe, expect, it } from "vitest";
import type { WorkoutPlanPayload } from "@/lib/workout-plan-types";
import {
  applyRenamesToCustomNames,
  collectExerciseRenames,
  planExerciseNameById,
  renameExercisesInPayload,
  rewriteSessionExercisesJson,
} from "@/lib/workout-exercise-rename";

function plan(
  exercises: Array<{ id: string; name: string }>,
  custom: string[] = [],
): WorkoutPlanPayload {
  return {
    version: 2,
    path: "custom",
    planName: "Test",
    userCustomExerciseNames: custom,
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      categoryId: "chest",
      reps: 10,
      sets: 3,
    })),
  };
}

describe("workout-exercise-rename", () => {
  it("wykrywa rename po id ćwiczenia", () => {
    const prev = plan([{ id: "a", name: "Przysiad" }]);
    const next = plan([{ id: "a", name: "Przysiad ze sztangą" }]);
    expect(collectExerciseRenames(prev, next)).toEqual([
      {
        exerciseId: "a",
        fromName: "Przysiad",
        toName: "Przysiad ze sztangą",
      },
    ]);
  });

  it("nie zgłasza rename przy samym trim / nowych id", () => {
    const prev = plan([{ id: "a", name: "Przysiad" }]);
    expect(
      collectExerciseRenames(prev, plan([{ id: "a", name: "  Przysiad  " }])),
    ).toEqual([]);
    expect(
      collectExerciseRenames(prev, plan([{ id: "b", name: "Inne" }])),
    ).toEqual([]);
  });

  it("podmienia nazwę w sesji po id i po starej nazwie", () => {
    const renames = [
      {
        exerciseId: "ex-1",
        fromName: "Przysiad",
        toName: "Przysiad goblet",
      },
    ];
    const byId = renameExercisesInPayload(
      {
        kind: "completed_session",
        exercises: [{ id: "ex-1", name: "Przysiad", sets: [] }],
      },
      renames,
    );
    expect(byId.changed).toBe(true);
    expect(
      (byId.payload as { exercises: Array<{ name: string }> }).exercises[0]
        ?.name,
    ).toBe("Przysiad goblet");

    const byName = renameExercisesInPayload(
      {
        kind: "completed_session",
        exercises: [{ id: "other", name: "Przysiad", sets: [] }],
      },
      renames,
    );
    expect(
      (byName.payload as { exercises: Array<{ name: string }> }).exercises[0]
        ?.name,
    ).toBe("Przysiad goblet");
  });

  it("bezpiecznie zamienia nazwy miejscami w jednym przebiegu", () => {
    const renames = [
      { exerciseId: "a", fromName: "A", toName: "B" },
      { exerciseId: "b", fromName: "B", toName: "A" },
    ];
    const { payload } = renameExercisesInPayload(
      {
        exercises: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
      },
      renames,
    );
    const names = (
      payload as { exercises: Array<{ id: string; name: string }> }
    ).exercises.map((e) => e.name);
    expect(names).toEqual(["B", "A"]);
  });

  it("aktualizuje custom names i rewriteSessionExercisesJson", () => {
    const renames = [
      {
        exerciseId: "a",
        fromName: "Stare",
        toName: "Nowe",
      },
    ];
    expect(applyRenamesToCustomNames(["Stare", "Inne"], renames)).toEqual([
      "Nowe",
      "Inne",
    ]);
    const json = rewriteSessionExercisesJson(
      JSON.stringify({
        kind: "completed_session",
        exercises: [{ id: "a", name: "Stare" }],
      }),
      renames,
    );
    expect(json).toContain("Nowe");
    expect(rewriteSessionExercisesJson("{}", renames)).toBeNull();
  });

  it("synchronizuje nazwę po id nawet bez listy renames (leczy stare dane)", () => {
    const nameById = planExerciseNameById(
      plan([{ id: "ex-1", name: "Nowa nazwa" }]),
    );
    const { changed, payload } = renameExercisesInPayload(
      {
        kind: "completed_session",
        exercises: [{ id: "ex-1", name: "Stara nazwa", sets: [] }],
      },
      [],
      nameById,
    );
    expect(changed).toBe(true);
    expect(
      (payload as { exercises: Array<{ name: string }> }).exercises[0]?.name,
    ).toBe("Nowa nazwa");
  });
});
