import { describe, expect, it } from "vitest";
import {
  MAX_OVERVIEW_RANGE_DAYS,
  buildStrengthOverview,
  median,
  resolveOverviewRange,
  type OverviewSeriesInput,
} from "@/lib/strength-overview";
import type { ExerciseProgressPoint } from "@/lib/exercise-progress";

function pt(date: string, bestE1rm: number): ExerciseProgressPoint {
  return {
    date,
    bestE1rm,
    bestWeight: 80,
    bestReps: 5,
    tonnageKg: 400,
    totalReps: 5,
    avgRir: null,
    avgRpe: null,
    targetRir: null,
    tempo: null,
    rirVsTarget: null,
  };
}

function series(
  key: string,
  groupId: string | null,
  groupLabel: string,
  prev: number,
  cur: number,
): OverviewSeriesInput {
  return {
    key,
    name: `Ćwiczenie ${key}`,
    groupId,
    groupLabel,
    // poprzedni okres 31.08–30.09, bieżący 01.10–31.10
    points: [pt("2026-09-05", prev), pt("2026-09-20", prev), pt("2026-10-05", cur), pt("2026-10-20", cur)],
  };
}

const FROM = "2026-10-01";
const TO = "2026-10-31";

describe("median", () => {
  it("obsługuje pustą, nieparzystą i parzystą liczbę wartości", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2])).toBe(1.5);
  });
});

describe("resolveOverviewRange", () => {
  it("presety to okna kroczące kończące się dziś", () => {
    expect(resolveOverviewRange("7", "2026-11-04")).toEqual({ from: "2026-10-29", to: "2026-11-04" });
    expect(resolveOverviewRange("30", "2026-11-04")).toEqual({ from: "2026-10-06", to: "2026-11-04" });
    expect(resolveOverviewRange("90", "2026-11-04")).toEqual({ from: "2026-08-07", to: "2026-11-04" });
  });

  it("odrzuca zakres z przyszłości, odwrócony, pusty i dłuższy niż limit", () => {
    const today = "2026-11-04";
    expect(resolveOverviewRange("range", today, { from: "2026-10-01", to: "2026-11-05" })).toBeNull();
    expect(resolveOverviewRange("range", today, { from: "2026-11-04", to: "2026-10-01" })).toBeNull();
    expect(resolveOverviewRange("range", today, {})).toBeNull();
    expect(resolveOverviewRange("range", today, { from: "2025-01-01", to: today })).toBeNull();
    expect(MAX_OVERVIEW_RANGE_DAYS).toBe(365);
    expect(resolveOverviewRange("range", today, { from: "2025-11-05", to: today })).toEqual({
      from: "2025-11-05",
      to: today,
    });
  });
});

describe("buildStrengthOverview", () => {
  it("zwraca null dla niepoprawnego zakresu", () => {
    expect(buildStrengthOverview([], "2026-10-31", "2026-10-01")).toBeNull();
  });

  it("pusty zbiór → za mało danych, bez fałszywej flagi wiarygodności", () => {
    const o = buildStrengthOverview([], FROM, TO)!;
    expect(o.verdict).toBe("insufficient");
    expect(o.indexDeltaPct).toBeNull();
    expect(o.lowConfidence).toBe(false);
    expect(o.exercises).toHaveLength(0);
    expect(o.previousFrom).toBe("2026-08-31");
    expect(o.previousTo).toBe("2026-09-30");
  });

  it("mediana po ćwiczeniach: 3 wiarygodne wzrosty → „rośnie”", () => {
    const o = buildStrengthOverview(
      [1, 2, 3].map((i) => series(String(i), "chest", "Klatka piersiowa", 100, 110)),
      FROM,
      TO,
    )!;
    expect(o.verdict).toBe("progress");
    expect(o.verdictLabel).toBe("Siła średnio rośnie");
    expect(o.indexDeltaPct).toBe(10);
    expect(o.lowConfidence).toBe(false);
    expect(o.counts).toEqual({ up: 3, flat: 0, down: 0, insufficient: 0 });
  });

  it("zmiana w paśmie ±3% → „stabilnie”", () => {
    const o = buildStrengthOverview(
      [1, 2, 3].map((i) => series(String(i), "chest", "Klatka piersiowa", 100, 101)),
      FROM,
      TO,
    )!;
    expect(o.verdict).toBe("flat");
  });

  it("jedno nietypowe ćwiczenie nie przesuwa mediany", () => {
    const o = buildStrengthOverview(
      [
        series("a", "chest", "Klatka piersiowa", 100, 101),
        series("b", "chest", "Klatka piersiowa", 100, 101),
        series("c", "chest", "Klatka piersiowa", 100, 200),
      ],
      FROM,
      TO,
    )!;
    expect(o.indexDeltaPct).toBe(1);
    expect(o.verdict).toBe("flat");
  });

  it("ćwiczenie z <2 sesjami w okresie jest „za mało danych” i nie wchodzi do mediany", () => {
    const thin: OverviewSeriesInput = {
      key: "thin",
      name: "Cienkie",
      groupId: null,
      groupLabel: "Pozostałe ćwiczenia",
      points: [pt("2026-09-05", 100), pt("2026-09-20", 100), pt("2026-10-05", 300)],
    };
    const o = buildStrengthOverview(
      [thin, ...[1, 2, 3].map((i) => series(String(i), "chest", "Klatka piersiowa", 100, 110))],
      FROM,
      TO,
    )!;
    const row = o.exercises.find((e) => e.key === "thin")!;
    expect(row.status).toBe("insufficient");
    expect(row.sessionsCurrent).toBe(1);
    expect(row.sessionsPrevious).toBe(2);
    expect(o.indexDeltaPct).toBe(10);
    expect(o.counts.insufficient).toBe(1);
    // wiarygodne najpierw, „za mało danych” na końcu
    expect(o.exercises.at(-1)!.key).toBe("thin");
  });

  it("mniej niż 3 wiarygodne ćwiczenia → lowConfidence", () => {
    const o = buildStrengthOverview(
      [series("a", "chest", "Klatka piersiowa", 100, 110), series("b", "quads", "Uda (przód)", 100, 90)],
      FROM,
      TO,
    )!;
    expect(o.lowConfidence).toBe(true);
  });

  it("grupy mięśniowe: mediana w grupie, sortowanie od największego wzrostu, grupa bez wiarygodnych na końcu", () => {
    const thin: OverviewSeriesInput = {
      key: "thin",
      name: "Cienkie",
      groupId: null,
      groupLabel: "Pozostałe ćwiczenia",
      points: [pt("2026-09-05", 100), pt("2026-10-05", 120)],
    };
    const o = buildStrengthOverview(
      [
        series("a", "chest", "Klatka piersiowa", 100, 110),
        series("b", "quads", "Uda (przód)", 100, 90),
        thin,
      ],
      FROM,
      TO,
    )!;
    expect(o.groups.map((g) => g.label)).toEqual(["Klatka piersiowa", "Uda (przód)", "Pozostałe ćwiczenia"]);
    expect(o.groups[0]).toMatchObject({ status: "up", medianDeltaPct: 10 });
    expect(o.groups[1]).toMatchObject({ status: "down", medianDeltaPct: -10 });
    expect(o.groups[2]).toMatchObject({ status: "insufficient", medianDeltaPct: null });
  });

  it("ćwiczenia bez sesji w obu okresach są pomijane", () => {
    const old: OverviewSeriesInput = {
      key: "old",
      name: "Stare",
      groupId: "chest",
      groupLabel: "Klatka piersiowa",
      points: [pt("2025-01-10", 100), pt("2025-01-20", 100)],
    };
    expect(buildStrengthOverview([old], FROM, TO)!.exercises).toHaveLength(0);
  });
});
