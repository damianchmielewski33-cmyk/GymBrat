import { describe, expect, it } from "vitest";
import { buildPremiumReport } from "@/lib/premium-report";
import type { ProgressHubData } from "@/lib/progress-hub";

const hub = {
  strength: {
    workoutCount: 12,
    sinceDate: "2026-09-01",
    volumeCounts: { up: 3, flat: 1, down: 0 },
    maxes: [
      { name: "Przysiad", bestE1rm: 140.04, bestWeight: 120, bestReps: 3, date: "2026-10-30", isNew: true, kind: "weighted" },
      { name: "Wyciskanie", bestE1rm: 100, bestWeight: 90, bestReps: 2, date: "2026-10-20", isNew: false, kind: "weighted" },
      { name: "Podciąganie", bestE1rm: 0, bestWeight: 0, bestReps: 12, date: "2026-10-01", isNew: false, kind: "bodyweight" },
    ],
  },
  body: {
    tempo: { currentKg: 80, startKg: 85, deltaFromStartKg: -5, kgPerWeekLast6: -0.4 },
    measures: [{ label: "Talia", currentCm: 85, deltaFromStartCm: -4 }],
  },
  week: {
    summary: { streakWeeks: 4 },
    last8: [{ label: "27 paź", workouts: 3, tonnageKg: 9000, cardioMinutes: 40 }],
  },
} as unknown as ProgressHubData;

describe("buildPremiumReport", () => {
  it("bierze maksy z obciążeniem, sortuje po e1RM i zaokrągla", () => {
    const r = buildPremiumReport(hub, { includeBody: true });
    expect(r.strength.topMaxes.map((m) => m.name)).toEqual(["Przysiad", "Wyciskanie"]);
    expect(r.strength.topMaxes[0].e1rm).toBe(140);
  });
  it("bez zgody health pomija sekcję ciała", () => {
    expect(buildPremiumReport(hub, { includeBody: false }).body).toBeNull();
    expect(buildPremiumReport(hub, { includeBody: true }).body?.currentKg).toBe(80);
  });
});
