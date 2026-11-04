import { describe, expect, it } from "vitest";
import { buildOverviewSeries, type WorkoutRow } from "@/lib/strength-overview-series";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";

const chest = CATALOG_EXERCISES.find((e) => e.categoryId === "chest")!;
const cardio = CATALOG_EXERCISES.find((e) => e.categoryId === "cardio");

const session = (
  date: string,
  exercises: Array<{ name: string; sets: Array<Record<string, unknown>> }>,
): WorkoutRow => ({
  date,
  exercisesJson: JSON.stringify({ kind: "completed_session", exercises }),
});
const set = (weight: number, reps: number, extra: Record<string, unknown> = {}) => ({
  weight,
  reps,
  done: true,
  ...extra,
});

describe("buildOverviewSeries", () => {
  it("grupuje po tożsamości ćwiczenia i etykiecie kategorii z katalogu", () => {
    const [s] = buildOverviewSeries([session("2026-10-05", [{ name: chest.name, sets: [set(60, 5)] }])]);
    expect(s!.groupId).toBe("chest");
    expect(s!.groupLabel).toBe("Klatka piersiowa");
    expect(s!.points).toHaveLength(1);
  });

  it("ćwiczenie spoza katalogu trafia do „Pozostałe ćwiczenia”", () => {
    const [s] = buildOverviewSeries([session("2026-10-05", [{ name: "Moje dziwne ćwiczenie", sets: [set(20, 8)] }])]);
    expect(s!.groupId).toBeNull();
    expect(s!.groupLabel).toBe("Pozostałe ćwiczenia");
  });

  it("pomija rozgrzewki, pominięte i niezaliczone serie oraz serie bez ciężaru", () => {
    const series = buildOverviewSeries([
      session("2026-10-05", [
        { name: chest.name, sets: [set(100, 5, { warmup: true }), set(100, 5, { skipped: true }), set(100, 5, { done: false }), set(60, 5)] },
        { name: "Podciąganie", sets: [set(0, 8)] },
      ]),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0]!.points[0]!.bestE1rm).toBeCloseTo(60 * (1 + 5 / 30), 6);
    expect(series[0]!.points[0]!.bestWeight).toBe(60);
  });

  it("łączy kilka treningów z tego samego dnia (max e1RM/ciężaru)", () => {
    const [s] = buildOverviewSeries([
      session("2026-10-25", [{ name: chest.name, sets: [set(60, 5)] }]),
      session("2026-10-25", [{ name: chest.name, sets: [set(70, 5)] }]),
    ]);
    expect(s!.points).toHaveLength(1);
    expect(s!.points[0]!.bestWeight).toBe(70);
    expect(s!.points[0]!.totalReps).toBe(10);
  });

  it("ignoruje uszkodzony JSON i wpisy, które nie są ukończoną sesją", () => {
    const series = buildOverviewSeries([
      { date: "2026-10-10", exercisesJson: "{bad json" },
      { date: "2026-10-11", exercisesJson: JSON.stringify({ kind: "cardio_log" }) },
    ]);
    expect(series).toEqual([]);
  });

  it("wyklucza kategorię cardio", () => {
    if (!cardio) return;
    expect(buildOverviewSeries([session("2026-10-12", [{ name: cardio.name, sets: [set(10, 20)] }])])).toEqual([]);
  });

  it("punkty są posortowane rosnąco po dacie", () => {
    const [s] = buildOverviewSeries([
      session("2026-10-20", [{ name: chest.name, sets: [set(60, 5)] }]),
      session("2026-10-05", [{ name: chest.name, sets: [set(60, 5)] }]),
    ]);
    expect(s!.points.map((p) => p.date)).toEqual(["2026-10-05", "2026-10-20"]);
  });
});
