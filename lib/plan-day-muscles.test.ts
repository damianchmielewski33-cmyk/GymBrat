import { describe, expect, it } from "vitest";
import {
  PLAN_DAY_MUSCLE_LIMIT,
  summarizePlanDayMuscles,
} from "@/lib/plan-day-muscles";

const ex = (name: string, categoryId = "") => ({ name, categoryId });

const CHEST = ex("Wyciskanie sztangi na ławce poziomej");
const BACK = ex("Wiosłowanie sztangą w opadzie");
const SHOULDERS = ex("Wyciskanie nad głowę sztangą");
const BICEPS = ex("Uginanie przedramion ze sztangą");
const TRICEPS = ex("Prostowanie na wyciągu (lina / drążek)");
const FOREARMS = ex("Uginanie nadgarstków podchwytem");
const CORE = ex("Deska (plank)");
const QUADS = ex("Przysiad ze sztangą");
const GLUTES = ex("Hip thrust");
const CALVES = ex("Wspięcia na łydkach stojąc");
const CARDIO = ex("Bieżnia");
const UNKNOWN = ex("Qwxz zzz");

describe("summarizePlanDayMuscles", () => {
  it("najwyżej 3 grupy, liczność malejąco", () => {
    const s = summarizePlanDayMuscles([CHEST, QUADS, QUADS, CALVES, SHOULDERS, QUADS, CALVES]);
    expect(s?.groups).toHaveLength(PLAN_DAY_MUSCLE_LIMIT);
    expect(s?.groups).toEqual(["nogi", "lydki", "klatka"]);
  });

  it("remis liczności → pierwsze wystąpienie", () => {
    expect(summarizePlanDayMuscles([SHOULDERS, CHEST, CORE])?.groups).toEqual([
      "barki",
      "klatka",
      "brzuch",
    ]);
  });

  it("remis liczności przy odcięciu limitu → pierwsze wystąpienie, nie kolejność katalogu", () => {
    const s = summarizePlanDayMuscles([CALVES, CORE, CHEST, BACK, CHEST, BACK, CALVES, CORE]);
    expect(s?.groups).toEqual(["lydki", "brzuch", "klatka"]);
  });

  it("biceps, triceps i przedramiona liczone jako jedna grupa „Ramiona”", () => {
    const s = summarizePlanDayMuscles([CHEST, BICEPS, TRICEPS, FOREARMS, SHOULDERS, SHOULDERS]);
    expect(s?.groups).toEqual(["ramiona", "barki", "klatka"]);
    expect(s?.labels).toEqual(["Ramiona", "Barki", "Klatka"]);
  });

  it("nierozpoznane i cardio pominięte", () => {
    const s = summarizePlanDayMuscles([UNKNOWN, CARDIO, CHEST, UNKNOWN]);
    expect(s?.groups).toEqual(["klatka"]);
  });

  it("wszystkie nierozpoznane lub cardio → null", () => {
    expect(summarizePlanDayMuscles([UNKNOWN, CARDIO])).toBeNull();
    expect(summarizePlanDayMuscles([])).toBeNull();
  });

  it("widok back: plecy lub pośladki bez klatki i brzucha", () => {
    expect(summarizePlanDayMuscles([BACK, BICEPS])?.view).toBe("back");
    expect(summarizePlanDayMuscles([GLUTES, QUADS])?.view).toBe("back");
  });

  it("widok front: nogi, łydki, ramiona osobno oraz plecy z brzuchem", () => {
    expect(summarizePlanDayMuscles([QUADS])?.view).toBe("front");
    expect(summarizePlanDayMuscles([CALVES])?.view).toBe("front");
    expect(summarizePlanDayMuscles([BICEPS, TRICEPS])?.view).toBe("front");
    expect(summarizePlanDayMuscles([BACK, CORE])?.view).toBe("front");
    expect(summarizePlanDayMuscles([BACK, CHEST])?.view).toBe("front");
  });

  it("labels zgodne z groups", () => {
    const s = summarizePlanDayMuscles([GLUTES, BACK, CALVES]);
    expect(s?.groups).toEqual(["posladki", "plecy", "lydki"]);
    expect(s?.labels).toEqual(["Pośladki", "Plecy", "Łydki"]);
  });

  it("categoryId z planu, gdy nazwa nierozpoznana", () => {
    expect(summarizePlanDayMuscles([ex("Qwxz zzz", "chest")])?.groups).toEqual(["klatka"]);
  });
});
