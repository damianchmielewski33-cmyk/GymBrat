import { describe, expect, it } from "vitest";
import { buildGhostTimeline } from "@/lib/ghost-training/timeline";

describe("buildGhostTimeline", () => {
  // LR-3 / V-2 (bramka wyjściowa prawnika, zadanie 004): niezaliczona seria
  // (done !== true, np. draft zapisany przez flushDraft przy nawigacji/blur,
  // bez kliknięcia „Zapisz serię”) nie może trafić do osi czasu Ghost Training —
  // ta oś jest widoczna dla rywala wybierającego tego użytkownika w wyścigu.
  it("nie dodaje do osi czasu serii z done=false, nawet z wyróżniającą się wartością", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Martwy ciąg",
          sets: [
            // Zapisana wartość draftu (prefill/flush), seria NIE zaliczona.
            { reps: 50, weight: 500, done: false, elapsedSecondsAtCompletion: 10 },
          ],
        },
      ]),
    });

    expect(timeline.checkpoints).toHaveLength(0);
    expect(timeline.totalSets).toBe(0);
    expect(timeline.totalVolumeKg).toBe(0);
  });

  it("nie dodaje serii oznaczonej jako pominięta (skipped), mimo done=true", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Wyciskanie",
          sets: [{ reps: 10, weight: 80, done: true, skipped: true }],
        },
      ]),
    });

    expect(timeline.checkpoints).toHaveLength(0);
  });

  it("regresja: serie faktycznie zaliczone (done=true, niepominięte, z ciężarem i powtórzeniami) tworzą oś czasu jak dotąd", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Przysiad",
          sets: [
            { reps: 5, weight: 100, done: true, elapsedSecondsAtCompletion: 60 },
            { reps: 5, weight: 100, done: true, elapsedSecondsAtCompletion: 180 },
          ],
        },
      ]),
    });

    expect(timeline.checkpoints).toHaveLength(2);
    expect(timeline.totalSets).toBe(2);
    expect(timeline.totalVolumeKg).toBe(1000);
    expect(timeline.synthetic).toBe(false);
  });

  // 005 p.7 / Q-P1: seria na masę ciała (0 kg + powtórzenia > 0) jest zaliczona także
  // w Ghost Training — bez osobnej reguły. Tonaż pozostaje 0, liczniki serii rosną.
  it("masa ciała (0 kg, powt. > 0, done) wchodzi na oś czasu jako zaliczona, tonaż 0 (Q-P1)", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Pompki",
          sets: [
            { reps: 12, weight: 0, done: true, elapsedSecondsAtCompletion: 60 },
            { reps: 10, weight: 0, done: true, elapsedSecondsAtCompletion: 150 },
          ],
        },
      ]),
    });

    expect(timeline.checkpoints).toHaveLength(2);
    expect(timeline.totalSets).toBe(2);
    expect(timeline.totalVolumeKg).toBe(0);
    expect(timeline.checkpoints[1]!.cumulativeSets).toBe(2);
  });

  it("seria bez powtórzeń (done, reps null, 0 kg) nadal jest pominięta i poza osią czasu", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Pompki",
          sets: [
            { reps: null, weight: 0, done: true, elapsedSecondsAtCompletion: 60 },
            { reps: 10, weight: 0, done: true, elapsedSecondsAtCompletion: 150 },
          ],
        },
      ]),
    });

    expect(timeline.checkpoints).toHaveLength(1);
    expect(timeline.totalSets).toBe(1);
  });

  it("miesza zaliczone i niezaliczone serie — do osi czasu wchodzą tylko zaliczone", () => {
    const timeline = buildGhostTimeline({
      sourceKind: "self",
      sourceUserId: "u1",
      sourceLabel: "Ty",
      workoutId: "w1",
      planId: null,
      title: "Test",
      exercisesJson: JSON.stringify([
        {
          id: "e1",
          name: "Wiosłowanie",
          sets: [
            { reps: 8, weight: 60, done: true, elapsedSecondsAtCompletion: 30 },
            // Draft/prefill, seria nigdy nie zaliczona — wyróżniająca się wartość.
            { reps: 999, weight: 999, done: false, elapsedSecondsAtCompletion: 45 },
          ],
        },
      ]),
    });

    expect(timeline.checkpoints).toHaveLength(1);
    expect(timeline.totalSets).toBe(1);
    expect(timeline.totalVolumeKg).toBe(480);
    expect(
      timeline.checkpoints.some((c) => c.weight === 999 || c.reps === 999),
    ).toBe(false);
  });
});
