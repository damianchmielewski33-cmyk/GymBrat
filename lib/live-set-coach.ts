/**
 * Aktywne rady w trakcie sesji: analiza bieżącej serii + poprzednich
 * serii w tym treningu + ostatniego treningu tego planu.
 */

import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import {
  buildSetProgressionSuggestion,
  bumpWeightByPlate,
  formatKgPl,
  resolveRepRange,
  type SetProgressionSuggestion,
} from "@/lib/set-progression-suggestion";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";

export type LiveCoachTone = "progress" | "caution" | "hold" | "info";

export type LiveCoachTip = {
  id: string;
  tone: LiveCoachTone;
  /** Pełny tekst (bez emoji). */
  body: string;
  prefix: string;
  highlight: string | null;
  suffix: string;
  /** Stuknięcie w tip wpisuje ciężar/powtórzenia. */
  apply: { weightKg: number; reps: number } | null;
};

function dropWeightByPlate(kg: number, step = 2.5): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.max(0, Math.round((kg - step) * 2) / 2);
}

function snap(s: WorkoutSetState | null | undefined) {
  if (!s) return null;
  return {
    weight: Math.max(0, Number(s.weight) || 0),
    reps:
      s.reps != null && Number.isFinite(s.reps) && s.reps > 0
        ? Math.round(s.reps)
        : null,
    rir: s.rir ?? null,
    rpe: s.rpe ?? null,
  };
}

function tipFromProgression(
  id: string,
  p: SetProgressionSuggestion,
): LiveCoachTip {
  return {
    id,
    tone: "progress",
    body: p.fullText,
    prefix: p.prefix,
    highlight: p.highlight,
    suffix: p.suffix,
    apply: { weightKg: p.weightKg, reps: p.reps },
  };
}

function tipPlain(
  id: string,
  tone: LiveCoachTone,
  body: string,
  apply: LiveCoachTip["apply"] = null,
  highlight: string | null = null,
): LiveCoachTip {
  if (highlight && body.includes(highlight)) {
    const i = body.indexOf(highlight);
    return {
      id,
      tone,
      body,
      prefix: body.slice(0, i),
      highlight,
      suffix: body.slice(i + highlight.length),
      apply,
    };
  }
  return {
    id,
    tone,
    body,
    prefix: body,
    highlight: null,
    suffix: "",
    apply,
  };
}

/**
 * Rada na otwartą (bieżącą) serię — przed zaliczeniem.
 */
export function buildLiveCoachTipForOpenSet(
  exercise: WorkoutExerciseState,
  setIndex: number,
): LiveCoachTip | null {
  const sets = exercise.sets;
  if (!sets.length || setIndex < 0 || setIndex >= sets.length) return null;

  const current = sets[setIndex]!;
  if (isCompletedWorkoutSet(current)) {
    const w = current.weight;
    const r = current.reps;
    if (w > 0 && r != null && r > 0) {
      const hl = `${formatKgPl(w)} kg × ${r}`;
      return tipPlain(
        "edit-done",
        "info",
        `Seria zapisana: ${hl}. Możesz poprawić wartości albo iść dalej.`,
        null,
        hl,
      );
    }
    return null;
  }

  const range = resolveRepRange(exercise.targetReps);
  const prevInSession =
    setIndex > 0 ? snap(sets[setIndex - 1]!) : null;
  const prevDone =
    prevInSession &&
    sets[setIndex - 1] &&
    isCompletedWorkoutSet(sets[setIndex - 1]!)
      ? prevInSession
      : null;

  // —— Analiza vs poprzednia seria w tym treningu ——
  if (prevDone && prevDone.weight > 0 && prevDone.reps != null) {
    const hard =
      (prevDone.rir != null && prevDone.rir <= 0) ||
      (prevDone.rpe != null && prevDone.rpe >= 9);
    const easy =
      (prevDone.rir != null && prevDone.rir >= 3) ||
      (prevDone.rpe != null && prevDone.rpe > 0 && prevDone.rpe <= 6);

    if (hard || (range && prevDone.reps < range.min)) {
      const nextW = dropWeightByPlate(prevDone.weight);
      const nextR = range ? range.min : prevDone.reps;
      if (nextW > 0 && nextW < prevDone.weight) {
        const hl = `${formatKgPl(nextW)} kg × ${nextR}`;
        return tipPlain(
          "session-deload",
          "caution",
          `Ostatnia seria była bardzo twarda — następna: spróbuj ${hl} (zdejmij ${formatKgPl(prevDone.weight - nextW)} kg, trzymaj formę).`,
          { weightKg: nextW, reps: nextR },
          hl,
        );
      }
      const hl = `${formatKgPl(prevDone.weight)} kg × ${range?.min ?? prevDone.reps}`;
      return tipPlain(
        "session-hold-form",
        "caution",
        `Ostatnia seria na styk — trzymaj ${hl} i pilnuj techniki; nie dokładaj ciężaru.`,
        {
          weightKg: prevDone.weight,
          reps: range?.min ?? prevDone.reps,
        },
        hl,
      );
    }

    if (easy && range && prevDone.reps >= range.max) {
      const nextW = bumpWeightByPlate(prevDone.weight);
      const hl = `${formatKgPl(nextW)} kg × ${range.min}`;
      return tipPlain(
        "session-bump",
        "progress",
        `Duży zapas w poprzedniej serii — spróbuj ${hl}.`,
        { weightKg: nextW, reps: range.min },
        hl,
      );
    }

    if (range && prevDone.reps < range.max && !hard) {
      const nextR = Math.min(range.max, prevDone.reps + 1);
      const hl = `${formatKgPl(prevDone.weight)} kg × ${nextR}`;
      return tipPlain(
        "session-reps",
        "progress",
        `Trzymaj ciężar i dobij powtórzenia: spróbuj ${hl}.`,
        { weightKg: prevDone.weight, reps: nextR },
        hl,
      );
    }

    const hl = `${formatKgPl(prevDone.weight)} kg × ${prevDone.reps}`;
    return tipPlain(
      "session-hold",
      "hold",
      `Powtórz solidną serię: ${hl} — ten sam ciężar, czysta technika.`,
      { weightKg: prevDone.weight, reps: prevDone.reps },
      hl,
    );
  }

  // —— Pierwsza otwarta seria: progresja vs ostatni trening ——
  const lastHist =
    exercise.lastSessionSets?.[setIndex] ??
    exercise.lastSessionSets?.[0] ??
    null;
  const progression = buildSetProgressionSuggestion({
    last: snap(lastHist),
    targetReps: exercise.targetReps,
  });
  if (progression) {
    return tipFromProgression("hist-progress", progression);
  }

  if (lastHist && lastHist.weight > 0 && lastHist.reps != null && lastHist.reps > 0) {
    const reps = range
      ? Math.min(Math.max(lastHist.reps, range.min), range.max)
      : lastHist.reps;
    const hl = `${formatKgPl(lastHist.weight)} kg × ${reps}`;
    return tipPlain(
      "hist-hold",
      "hold",
      `Start jak ostatnio: ${hl}.`,
      { weightKg: lastHist.weight, reps },
      hl,
    );
  }

  if (range) {
    return tipPlain(
      "plan-range",
      "info",
      `Cel planu: ${range.min}–${range.max} powt. Ustaw ciężar tak, by skończyć w zakresie z RIR ${exercise.targetRir ?? 1}.`,
    );
  }

  return tipPlain(
    "warmup",
    "info",
    "Pierwsza seria — ustaw ciężar pod czystą technikę; zapisuj każdą ukończoną serię.",
  );
}

/**
 * Rada zaraz po zaliczeniu serii (ekran przerwy / „co dalej”).
 */
export function buildLiveCoachTipAfterCompletedSet(
  exercise: WorkoutExerciseState,
  completedSetIndex: number,
): LiveCoachTip | null {
  const done = snap(exercise.sets[completedSetIndex]);
  if (!done || done.reps == null) return null;

  const nextIndex = completedSetIndex + 1;
  if (nextIndex >= exercise.sets.length) {
    if (done.weight > 0) {
      const hl = `${formatKgPl(done.weight)} kg × ${done.reps}`;
      return tipPlain(
        "ex-done",
        "info",
        `Ćwiczenie domknięte (${hl}). Oddychaj spokojnie przed następnym ruchem.`,
        null,
        hl,
      );
    }
    return tipPlain(
      "ex-done-bw",
      "info",
      "Ćwiczenie domknięte. Krótka przerwa i przejdź do kolejnego ruchu.",
    );
  }

  // Tip jak na następną otwartą serię — ale sformułowany pod przerwę.
  const nextTip = buildLiveCoachTipForOpenSet(exercise, nextIndex);
  if (!nextTip) return null;
  if (nextTip.apply) {
    const hl =
      nextTip.highlight ??
      `${formatKgPl(nextTip.apply.weightKg)} kg × ${nextTip.apply.reps}`;
    const lead =
      nextTip.tone === "caution"
        ? "Na następną serię: "
        : nextTip.tone === "progress"
          ? "Na następną serię: "
          : "Na następną serię trzymaj: ";
    return {
      ...nextTip,
      id: `rest-${nextTip.id}`,
      prefix: lead,
      highlight: hl,
      suffix:
        nextTip.tone === "caution"
          ? " — zdejmij ciężar albo skróć zakres, jeśli forma się sypie."
          : nextTip.tone === "progress"
            ? " · przygotuj talerze / hantle w przerwie."
            : " · przygotuj ten sam ciężar.",
      body: `${lead}${hl}${
        nextTip.tone === "caution"
          ? " — zdejmij ciężar albo skróć zakres, jeśli forma się sypie."
          : nextTip.tone === "progress"
            ? " · przygotuj talerze / hantle w przerwie."
            : " · przygotuj ten sam ciężar."
      }`,
    };
  }
  return {
    ...nextTip,
    id: `rest-${nextTip.id}`,
    body: `Przerwa: ${nextTip.body}`,
    prefix: `Przerwa: ${nextTip.prefix}`,
  };
}

/** Skrót tekstowy do heurystyk / AI (bez UI). */
export function liveCoachTipToPlainText(tip: LiveCoachTip | null): string | null {
  return tip?.body ?? null;
}
