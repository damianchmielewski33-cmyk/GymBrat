import { describe, expect, it } from "vitest";
import {
  buildLiveCoachTipAfterCompletedSet,
  buildLiveCoachTipForOpenSet,
  liveCoachTipToPlainText,
  pickCoachVariant,
} from "@/lib/live-set-coach";
import type { WorkoutExerciseState } from "@/components/workout/types";

function ex(partial: Partial<WorkoutExerciseState> & Pick<WorkoutExerciseState, "sets">): WorkoutExerciseState {
  return {
    id: "e1",
    name: "Incline DB Press",
    targetReps: 10,
    targetRir: 1,
    ...partial,
  };
}

describe("live-set-coach", () => {
  it("pickCoachVariant jest stabilny dla tego samego seeda", () => {
    const v = ["a", "b", "c"] as const;
    expect(pickCoachVariant("seed-x", v)).toBe(pickCoachVariant("seed-x", v));
    expect(pickCoachVariant("seed-a", v)).not.toBe(
      pickCoachVariant("seed-z-other", v),
    );
  });

  it("pierwsza seria: góra zakresu po 2 łatwych w historii → +ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: 8, weight: 0, done: false }],
        lastSessionSets: [
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: 10, weight: 36, done: true, rir: 3 },
        ],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.apply?.weightKg).toBe(38.5);
    expect(tip!.apply?.reps).toBe(8);
    expect(tip!.tone).toBe("progress");
    expect(tip!.body).toMatch(/38,5 kg × 8/);
  });

  it("pierwsza seria: jedna łatwa na górze → hold (bez +kg)", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: 8, weight: 0, done: false }],
        lastSessionSets: [{ reps: 10, weight: 36, done: true, rir: 3 }],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("hold");
    expect(tip!.apply?.weightKg).toBe(36);
  });

  it("Start jak ostatnio nie przycina powtórzeń do zakresu planu", () => {
    // Ostatnio 65×11, plan targetReps=8 → zakres 6–8; tip musi zostać 65×11
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        targetReps: 8,
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [{ reps: 11, weight: 65, done: true, rir: 2 }],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.decision).toBe("Start jak ostatnio");
    expect(tip!.apply).toEqual({ weightKg: 65, reps: 11 });
    expect(tip!.body).toMatch(/65 kg × 11/);
  });

  it("po twardej historii nie dokładaj — zejdź lub utrzymaj", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [{ reps: 8, weight: 40, done: true, rir: 0 }],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBeLessThan(40);
  });

  it("po twardej serii w sesji → zdejmij ciężar (deload %)", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 6, weight: 40, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBe(37.5);
    expect(tip!.body).toMatch(/Incline|seria|tward|zejdź|−|hamuj|styk/i);
  });

  it("po jednej łatwej na górze → hold (wymagane 2 easy)", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("hold");
    expect(tip!.apply?.weightKg).toBe(36);
  });

  it("po dwóch łatwych na górze → +ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      2,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("progress");
    expect(tip!.apply?.weightKg).toBe(38.5);
  });

  it("konflikt RIR/RPE → hold", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 60, done: true, rir: 5, rpe: 10 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("hold");
    expect(tip!.id).toBe("session-conflict-hold");
  });

  it("różne ćwiczenia → różne brzmienie tej samej logiki", () => {
    const a = buildLiveCoachTipForOpenSet(
      ex({
        id: "squat",
        name: "Przysiad",
        sets: [
          { reps: 8, weight: 100, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    const b = buildLiveCoachTipForOpenSet(
      ex({
        id: "bench",
        name: "Wyciskanie",
        sets: [
          { reps: 8, weight: 100, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(a?.apply).toEqual(b?.apply);
    expect(a?.body).not.toBe(b?.body);
  });

  it("rada na przerwie wskazuje następną serię", () => {
    const tip = buildLiveCoachTipAfterCompletedSet(
      ex({
        sets: [
          { reps: 8, weight: 36, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.apply?.reps).toBe(9);
    expect(tip!.body).toMatch(/seria|kolejn|następn|przerw|dalej|celuj|baz/i);
  });

  it("długa przerwa → deload startu", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [{ reps: 8, weight: 100, done: true, rir: 2 }],
        coachContext: {
          daysSinceLastSession: 21,
          recentSessionCount: 2,
          avgTopSetWeightKg: 100,
          stagnant: false,
        },
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBe(95);
    expect(tip!.id).toBe("hist-layoff");
  });

  it("v3: tip ma decision, reason, readiness, confidence", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      2,
    );
    expect(tip).not.toBeNull();
    expect(tip!.decision.length).toBeGreaterThan(0);
    expect(tip!.reason.length).toBeGreaterThan(0);
    expect(tip!.readiness).toBeGreaterThanOrEqual(0);
    expect(tip!.readiness).toBeLessThanOrEqual(100);
    expect(tip!.confidence).toBeGreaterThanOrEqual(0);
    expect(tip!.confidence).toBeLessThanOrEqual(100);
  });

  it("v3 trend-over-event: jedna hard + rosnący e1RM → hold, nie deload", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          // w zakresie 8–10, ale hard — bez belowMin
          { reps: 8, weight: 100, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
        coachContext: {
          daysSinceLastSession: 3,
          recentSessionCount: 4,
          avgTopSetWeightKg: 100,
          stagnant: false,
          e1rm: { last: 130, avg: 120, best: 130, trend4: "up" },
          recentSessions: [
            {
              topKg: 100,
              bestReps: 8,
              bestE1rm: 130,
              avgRir: 1,
              volumeKg: 2000,
            },
            {
              topKg: 95,
              bestReps: 8,
              bestE1rm: 120,
              avgRir: 1,
              volumeKg: 1900,
            },
            {
              topKg: 90,
              bestReps: 8,
              bestE1rm: 110,
              avgRir: 2,
              volumeKg: 1800,
            },
          ],
        },
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.id).toBe("session-hold-form");
    expect(tip!.apply?.weightKg).toBe(100);
    expect(tip!.reason).toMatch(/trend/i);
  });

  it("v3: konflikt nie ukrywa tipu — ma confidence", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 60, done: true, rir: 5, rpe: 10 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.id).toBe("session-conflict-hold");
    expect(typeof tip!.confidence).toBe("number");
    expect(tip!.suspicious || tip!.confidence < 70).toBe(true);
  });

  it("plainText: jedna linia body, bez Readiness/Confidence", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 3 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    const plain = liveCoachTipToPlainText(tip);
    expect(plain).toBeTruthy();
    expect(plain!).not.toMatch(/Readiness|Confidence|Powód:/i);
    expect(plain!.split("\n").length).toBe(1);
    expect(plain!).toBe(tip!.body.trim());
  });
});
