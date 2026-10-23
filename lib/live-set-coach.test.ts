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
    // Sztanga (krok 2,5 kg) — hantle / maszyny mają osobne testy kroku ciężaru.
    name: "Incline Barbell Press",
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

describe("live-set-coach — RIR ≥ 2 i profile ruchu", () => {
  it("dwie serie z RIR 2 na górze zakresu → +ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 2 },
          { reps: 10, weight: 36, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      2,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("progress");
    expect(tip!.apply?.weightKg).toBe(38.5);
  });

  it("jedna seria z RIR 2 na górze → hold (wymagane 2 łatwe)", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [
          { reps: 10, weight: 36, done: true, rir: 2 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip!.tone).toBe("hold");
    expect(tip!.apply?.weightKg).toBe(36);
  });

  it("uginanie do upadku (RIR 0, cel RIR 0–1) nie ściąga ciężaru", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        name: "Uginanie ze sztangą",
        targetReps: 12,
        sets: [
          { reps: 12, weight: 20, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).not.toBe("caution");
    expect(tip!.bumpKind).not.toBe("deload");
    expect(tip!.apply?.weightKg).toBe(20);
  });

  it("wyciskanie leżąc: RIR 0 to nadal twarda seria → zdejmij", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        name: "Wyciskanie sztangi leżąc (bench)",
        targetReps: 12,
        sets: [
          { reps: 12, weight: 20, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBe(17.5);
  });

  it("cel RIR 0 z planu: seria do upadku nie jest twarda", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        name: "Wyciskanie sztangi leżąc (bench)",
        targetRir: 0,
        sets: [
          { reps: 8, weight: 80, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).not.toBe("caution");
    expect(tip!.apply?.weightKg).toBe(80);
  });
});

describe("live-set-coach — krok ciężaru ćwiczenia", () => {
  const twoEasyAtTop = [
    { reps: 10, weight: 36, done: true, rir: 3 },
    { reps: 10, weight: 36, done: true, rir: 3 },
    { reps: null, weight: 0, done: false },
  ];

  it("hantle: dokładka +2 kg zamiast +2,5", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({ name: "Incline DB Press", sets: twoEasyAtTop }),
      2,
    );
    expect(tip!.apply?.weightKg).toBe(38);
  });

  it("jawny weightStepKg (stos maszyny +5) wygrywa z nazwą", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({ name: "Incline DB Press", weightStepKg: 5, sets: twoEasyAtTop }),
      2,
    );
    expect(tip!.apply?.weightKg).toBe(41);
  });

  it("deload hantli ląduje na ładowalnym ciężarze (40 → 38)", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        name: "Incline DB Press",
        sets: [
          { reps: 6, weight: 40, done: true, rir: 0 },
          { reps: null, weight: 0, done: false },
        ],
      }),
      1,
    );
    expect(tip!.tone).toBe("caution");
    expect(tip!.apply?.weightKg).toBe(38);
  });

  it("start po długiej przerwie: sztanga 100 → 95, hantle 100 → 94", () => {
    const ctx = {
      daysSinceLastSession: 21,
      recentSessionCount: 2,
      avgTopSetWeightKg: 100,
      stagnant: false,
    };
    const barbell = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [{ reps: 8, weight: 100, done: true, rir: 2 }],
        coachContext: ctx,
      }),
      0,
    );
    const dumbbell = buildLiveCoachTipForOpenSet(
      ex({
        name: "Wyciskanie hantli",
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [{ reps: 8, weight: 100, done: true, rir: 2 }],
        coachContext: ctx,
      }),
      0,
    );
    expect(barbell!.apply?.weightKg).toBe(95);
    expect(dumbbell!.apply?.weightKg).toBe(94);
  });
});

describe("live-set-coach — progresja z samych powtórzeń", () => {
  const hist = [
    { reps: 10, weight: 36, done: true },
    { reps: 10, weight: 36, done: true },
    { reps: 10, weight: 36, done: true },
  ];
  const sessionSnap = (over: Record<string, unknown> = {}) => ({
    topKg: 36,
    bestReps: 10,
    bestE1rm: 48,
    avgRir: null,
    volumeKg: 1080,
    minRepsAtTop: 10,
    setsAtTop: 3,
    effortLogged: false,
    ...over,
  });
  const coachContext = (recent: ReturnType<typeof sessionSnap>[]) => ({
    daysSinceLastSession: 4,
    recentSessionCount: recent.length,
    avgTopSetWeightKg: 36,
    stagnant: false,
    recentSessions: recent,
  });

  it("2 treningi ze wszystkimi seriami na górze, bez RIR/RPE → +ciężar", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: hist,
        coachContext: coachContext([sessionSnap(), sessionSnap()]),
      }),
      0,
    );
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("progress");
    expect(tip!.apply).toEqual({ weightKg: 38.5, reps: 8 });
  });

  it("tylko jeden taki trening → start jak ostatnio", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: hist,
        coachContext: coachContext([sessionSnap()]),
      }),
      0,
    );
    expect(tip!.tone).toBe("hold");
    expect(tip!.apply?.weightKg).toBe(36);
  });

  it("gdy w jednej sesji realnie logowano RIR → ścieżka z powtórzeń wyłączona", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: hist,
        coachContext: coachContext([
          sessionSnap({ effortLogged: true }),
          sessionSnap(),
        ]),
      }),
      0,
    );
    expect(tip!.tone).toBe("hold");
    expect(tip!.apply?.weightKg).toBe(36);
  });

  it("twarda ostatnia seria z historii blokuje dokładkę", () => {
    const tip = buildLiveCoachTipForOpenSet(
      ex({
        sets: [{ reps: null, weight: 0, done: false }],
        lastSessionSets: [
          { reps: 10, weight: 36, done: true },
          { reps: 10, weight: 36, done: true },
          { reps: 10, weight: 36, done: true, rir: 0 },
        ],
        coachContext: coachContext([sessionSnap(), sessionSnap()]),
      }),
      0,
    );
    // Ostatnia seria bloku była do upadku → żadnej dokładki; start zostaje na 36.
    expect(tip).not.toBeNull();
    expect(tip!.tone).toBe("hold");
    expect(tip!.apply?.weightKg).toBe(36);
  });
});
