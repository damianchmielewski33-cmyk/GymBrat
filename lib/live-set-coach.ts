/**
 * Aktywne rady w trakcie sesji: kontekst serii, zmęczenia, historii planu
 * i zróżnicowane sformułowania (deterministyczne — bez migania przy re-renderze).
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

function shortExerciseName(name: string): string {
  const t = name.trim();
  if (t.length <= 28) return t;
  return `${t.slice(0, 26)}…`;
}

/** Stabilny wybór wariantu — ten sam kontekst = ten sam tekst (bez losowego migania). */
export function pickCoachVariant(seed: string, variants: readonly string[]): string {
  if (variants.length === 0) return "";
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return variants[Math.abs(h) % variants.length]!;
}

function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
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

function tipFromProgression(
  id: string,
  p: SetProgressionSuggestion,
  seed: string,
): LiveCoachTip {
  const leads =
    p.kind === "weight"
      ? [
          "Dziś celuj w {hl}",
          "Progresja: {hl}",
          "Idź wyżej ciężarem — {hl}",
          "Czas na talerz: {hl}",
        ]
      : [
          "Dziś dobij powtórzenia: {hl}",
          "Ten sam ciężar, więcej powt.: {hl}",
          "Zakres w górę: {hl}",
          "Dokładaj powtórzenia: {hl}",
        ];
  const reasons =
    p.kind === "weight"
      ? [
          ` · +${formatKgPl(p.deltaKg)} kg, bo ${p.reason}`,
          ` (+${formatKgPl(p.deltaKg)} kg vs ostatnio — ${p.reason})`,
          ` · dokładka ${formatKgPl(p.deltaKg)} kg; ${p.reason}`,
        ]
      : [
          ` · ${p.reason}`,
          ` — ${p.reason}, bez zmiany ciężaru`,
          ` · domykaj zakres; ${p.reason}`,
        ];
  const lead = pickCoachVariant(`${seed}|lead`, leads);
  const reason = pickCoachVariant(`${seed}|reason`, reasons);
  const body = `${fillTemplate(lead, { hl: p.highlight })}${reason}`;
  return tipPlain(id, "progress", body, {
    weightKg: p.weightKg,
    reps: p.reps,
  }, p.highlight);
}

function countHardStreak(sets: WorkoutSetState[], beforeIndex: number): number {
  let n = 0;
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (!isCompletedWorkoutSet(s)) break;
    const hard =
      (s.rir != null && s.rir <= 0) || (s.rpe != null && s.rpe >= 9);
    if (!hard) break;
    n += 1;
  }
  return n;
}

function sessionVolumeKg(sets: WorkoutSetState[], upToExclusive: number): number {
  let v = 0;
  for (let i = 0; i < upToExclusive; i++) {
    const s = sets[i]!;
    if (!isCompletedWorkoutSet(s) || s.reps == null) continue;
    if (s.weight > 0 && s.reps > 0) v += s.weight * s.reps;
  }
  return v;
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
  const seedBase = `${exercise.id}|${setIndex}|${exercise.name}`;
  const exName = shortExerciseName(exercise.name || "Ćwiczenie");
  const setLabel = `${setIndex + 1}/${sets.length}`;
  const isLastSet = setIndex === sets.length - 1;
  const isFirstSet = setIndex === 0;

  if (isCompletedWorkoutSet(current)) {
    const w = current.weight;
    const r = current.reps;
    if (w > 0 && r != null && r > 0) {
      const hl = `${formatKgPl(w)} kg × ${r}`;
      const body = pickCoachVariant(`${seedBase}|edit`, [
        `Seria {set} zapisana: {hl}. Możesz poprawić liczby albo iść dalej.`,
        `{ex} — seria {set} zaliczona ({hl}). Edytuj, jeśli coś poszło nie tak.`,
        `Masz {hl} w serii {set}. Zostaw albo popraw przed kolejną.`,
      ]);
      return tipPlain(
        "edit-done",
        "info",
        fillTemplate(body, { hl, set: setLabel, ex: exName }),
        null,
        hl,
      );
    }
    return null;
  }

  const range = resolveRepRange(exercise.targetReps);
  const targetRir = exercise.targetRir ?? 1;
  const prevInSession = setIndex > 0 ? snap(sets[setIndex - 1]!) : null;
  const prevDone =
    prevInSession &&
    sets[setIndex - 1] &&
    isCompletedWorkoutSet(sets[setIndex - 1]!)
      ? prevInSession
      : null;
  const hardStreak = countHardStreak(sets, setIndex);
  const doneVolume = sessionVolumeKg(sets, setIndex);

  // —— Analiza vs poprzednia seria w tym treningu ——
  if (prevDone && prevDone.weight > 0 && prevDone.reps != null) {
    const hard =
      (prevDone.rir != null && prevDone.rir <= 0) ||
      (prevDone.rpe != null && prevDone.rpe >= 9) ||
      hardStreak >= 1;
    const easy =
      (prevDone.rir != null && prevDone.rir >= 3) ||
      (prevDone.rpe != null && prevDone.rpe > 0 && prevDone.rpe <= 6);
    const belowMin = range != null && prevDone.reps < range.min;
    const atMax = range != null && prevDone.reps >= range.max;
    const midRange =
      range != null && prevDone.reps >= range.min && prevDone.reps < range.max;

    // Kilka twardych z rzędu albo zdecydowanie poniżej zakresu → deload.
    if (hard || belowMin || hardStreak >= 2) {
      const nextW = dropWeightByPlate(prevDone.weight);
      const nextR = range ? range.min : prevDone.reps;
      if (nextW > 0 && nextW < prevDone.weight) {
        const hl = `${formatKgPl(nextW)} kg × ${nextR}`;
        const drop = formatKgPl(prevDone.weight - nextW);
        const body = pickCoachVariant(`${seedBase}|deload`, [
          `Seria {set} w {ex}: poprzednia była za twarda — zejdź na {hl} (−{drop} kg) i domknij czysto.`,
          `Hamuj obciążenie: po twardej serii celuj w {hl}. Lepiej technika niż ego.`,
          `Zmęczenie rośnie (seria {set}) — spróbuj {hl}, zdejmij {drop} kg.`,
          belowMin
            ? `Nie dobiłeś zakresu — za ciężko. Na serię {set}: {hl}.`
            : `Ostatnia na styk — na {set}: {hl} (−{drop} kg).`,
        ]);
        return tipPlain(
          "session-deload",
          "caution",
          fillTemplate(body, { hl, drop, set: setLabel, ex: exName }),
          { weightKg: nextW, reps: nextR },
          hl,
        );
      }
      const hl = `${formatKgPl(prevDone.weight)} kg × ${range?.min ?? prevDone.reps}`;
      const body = pickCoachVariant(`${seedBase}|hold-form`, [
        `Nie dokładaj. Seria {set}: trzymaj {hl} i RIR ok. {rir} — czysta forma.`,
        `{ex}: po twardej serii powtórz {hl} bez dokładki.`,
        `Stabilizacja: {hl} na serię {set}. Pilnuj toru ruchu.`,
      ]);
      return tipPlain(
        "session-hold-form",
        "caution",
        fillTemplate(body, {
          hl,
          set: setLabel,
          ex: exName,
          rir: targetRir,
        }),
        {
          weightKg: prevDone.weight,
          reps: range?.min ?? prevDone.reps,
        },
        hl,
      );
    }

    // Duży zapas + góra zakresu → +ciężar.
    if (easy && atMax) {
      const nextW = bumpWeightByPlate(prevDone.weight);
      const nextR = range ? range.min : prevDone.reps;
      const hl = `${formatKgPl(nextW)} kg × ${nextR}`;
      const body = pickCoachVariant(`${seedBase}|bump`, [
        `Zapas był duży — seria {set}: idź na {hl}.`,
        `{ex}: czas na dokładkę. Cel: {hl}.`,
        `Góra zakresu przyszła łatwo → {hl} (potem wracasz do dołu zakresu).`,
        isLastSet
          ? `Ostatnia seria {ex}: jeśli forma trzyma, spróbuj {hl}.`
          : `Seria {set}/{total}: spróbuj {hl}.`,
      ]);
      return tipPlain(
        "session-bump",
        "progress",
        fillTemplate(body, {
          hl,
          set: setLabel,
          ex: exName,
          total: String(sets.length),
        }),
        { weightKg: nextW, reps: nextR },
        hl,
      );
    }

    // Środek / dół zakresu — dobij powtórzenia (różne akcenty).
    if (midRange || (range && prevDone.reps < range.max && !hard)) {
      const nextR = Math.min(range!.max, prevDone.reps + 1);
      const hl = `${formatKgPl(prevDone.weight)} kg × ${nextR}`;
      const gap = range!.max - prevDone.reps;
      const body = pickCoachVariant(`${seedBase}|reps|${gap}`, [
        gap === 1
          ? `Jesteś o 1 powt. od góry zakresu — seria {set}: {hl}.`
          : `Trzymaj {w} kg i dokładaj powtórzenia: {hl} (zakres {rmin}–{rmax}).`,
        `{ex}, seria {set}: ten sam ciężar, cel {hl}.`,
        doneVolume > 0
          ? `Objętość już rośnie — domykaj zakres przy {hl}.`
          : `Double progression: najpierw powtórzenia → {hl}.`,
        isLastSet
          ? `Domknij {ex} czysto: {hl}, bez dokładania ciężaru.`
          : `Seria {set}: spróbuj {hl} (RIR ok. {rir}).`,
        prevDone.reps <= (range?.min ?? prevDone.reps)
          ? `Był dół zakresu — dobij do {hl} zanim ruszysz ciężar.`
          : `Jeszcze miejsce w zakresie — {hl}.`,
      ]);
      return tipPlain(
        "session-reps",
        "progress",
        fillTemplate(body, {
          hl,
          w: formatKgPl(prevDone.weight),
          set: setLabel,
          ex: exName,
          rmin: String(range!.min),
          rmax: String(range!.max),
          rir: targetRir,
        }),
        { weightKg: prevDone.weight, reps: nextR },
        hl,
      );
    }

    // Solidna seria na górze bez dużego zapasu → hold.
    const hl = `${formatKgPl(prevDone.weight)} kg × ${prevDone.reps}`;
    const body = pickCoachVariant(`${seedBase}|hold`, [
      `Powtórz jakość: {hl} na serię {set}.`,
      `{ex}: utrzymaj {hl} — ten sam ciężar, czysta technika.`,
      isLastSet
        ? `Ostatnia seria: domknij na {hl}, bez forsowania.`
        : `Stabilny blok: {hl}. Nie dokładaj, jeśli RIR ≈ {rir}.`,
      doneVolume > 0
        ? `Masz już objętość — seria {set} jak poprzednia: {hl}.`
        : `Kontynuuj rytm: {hl}.`,
    ]);
    return tipPlain(
      "session-hold",
      "hold",
      fillTemplate(body, {
        hl,
        set: setLabel,
        ex: exName,
        rir: targetRir,
      }),
      { weightKg: prevDone.weight, reps: prevDone.reps },
      hl,
    );
  }

  // —— Pierwsza otwarta seria: progresja vs ostatni trening ——
  const lastHist =
    exercise.lastSessionSets?.[setIndex] ??
    exercise.lastSessionSets?.[0] ??
    null;
  const lastSnap = snap(lastHist);
  const histHard =
    lastSnap != null &&
    ((lastSnap.rir != null && lastSnap.rir <= 0) ||
      (lastSnap.rpe != null && lastSnap.rpe >= 9));

  if (histHard && lastSnap && lastSnap.weight > 0 && lastSnap.reps != null) {
    const nextW = dropWeightByPlate(lastSnap.weight);
    const reps = range
      ? Math.min(Math.max(lastSnap.reps, range.min), range.max)
      : lastSnap.reps;
    if (nextW > 0 && nextW < lastSnap.weight) {
      const hl = `${formatKgPl(nextW)} kg × ${range?.min ?? reps}`;
      const body = pickCoachVariant(`${seedBase}|hist-hard`, [
        `Ostatnio {ex} poszło bardzo ciężko — start lżej: {hl}.`,
        `Nie zaczynaj od ego. Pierwsza seria: {hl} (po twardej sesji).`,
        `Historia mówi „twardo” — dziś otwórz na {hl}.`,
      ]);
      return tipPlain(
        "hist-deload",
        "caution",
        fillTemplate(body, { hl, ex: exName }),
        { weightKg: nextW, reps: range?.min ?? reps },
        hl,
      );
    }
    const hl = `${formatKgPl(lastSnap.weight)} kg × ${reps}`;
    const body = pickCoachVariant(`${seedBase}|hist-hard-hold`, [
      `Ostatnio było ciężko — powtórz start: {hl}, bez dokładki.`,
      `Pierwsza seria {ex}: {hl}. Oceń zapas, potem ewentualnie dokładaj.`,
    ]);
    return tipPlain(
      "hist-hard-hold",
      "hold",
      fillTemplate(body, { hl, ex: exName }),
      { weightKg: lastSnap.weight, reps },
      hl,
    );
  }

  const progression = buildSetProgressionSuggestion({
    last: lastSnap,
    targetReps: exercise.targetReps,
  });
  if (progression) {
    return tipFromProgression("hist-progress", progression, seedBase);
  }

  if (lastSnap && lastSnap.weight > 0 && lastSnap.reps != null && lastSnap.reps > 0) {
    const reps = range
      ? Math.min(Math.max(lastSnap.reps, range.min), range.max)
      : lastSnap.reps;
    const hl = `${formatKgPl(lastSnap.weight)} kg × ${reps}`;
    const body = pickCoachVariant(`${seedBase}|hist-hold`, [
      `Start jak ostatnio: {hl}.`,
      `{ex} — otwórz sesję na {hl}.`,
      isFirstSet
        ? `Pierwsza seria: {hl} (bazuj na poprzednim treningu).`
        : `Seria {set}: trzymaj bazę {hl}.`,
      range
        ? `Wróć do {hl} i celuj w zakres {rmin}–{rmax}.`
        : `Powtórz bazę: {hl}.`,
    ]);
    return tipPlain(
      "hist-hold",
      "hold",
      fillTemplate(body, {
        hl,
        ex: exName,
        set: setLabel,
        rmin: String(range?.min ?? ""),
        rmax: String(range?.max ?? ""),
      }),
      { weightKg: lastSnap.weight, reps },
      hl,
    );
  }

  if (range) {
    const body = pickCoachVariant(`${seedBase}|plan`, [
      `{ex}: zakres planu {rmin}–{rmax} powt. przy RIR ≈ {rir}. Ustaw ciężar pod czystą formę.`,
      `Bez historii — dobierz ciężar tak, by skończyć w {rmin}–{rmax} z RIR {rir}.`,
      `Seria {set}: cel powtórzeń {rmin}–{rmax}. Zacznij konserwatywnie.`,
    ]);
    return tipPlain(
      "plan-range",
      "info",
      fillTemplate(body, {
        ex: exName,
        set: setLabel,
        rmin: String(range.min),
        rmax: String(range.max),
        rir: targetRir,
      }),
    );
  }

  const body = pickCoachVariant(`${seedBase}|warmup`, [
    `{ex}: pierwsza seria pod technikę — zapisuj każde zaliczenie.`,
    `Ustaw ciężar pod kontrolę toru ruchu, potem dokładaj.`,
    `Seria {set} — rozruch jakością, nie maksem.`,
  ]);
  return tipPlain(
    "warmup",
    "info",
    fillTemplate(body, { ex: exName, set: setLabel }),
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

  const seedBase = `${exercise.id}|rest|${completedSetIndex}`;
  const exName = shortExerciseName(exercise.name || "Ćwiczenie");
  const nextIndex = completedSetIndex + 1;

  if (nextIndex >= exercise.sets.length) {
    if (done.weight > 0) {
      const hl = `${formatKgPl(done.weight)} kg × ${done.reps}`;
      const body = pickCoachVariant(`${seedBase}|done`, [
        `{ex} domknięte ({hl}). Oddychaj spokojnie przed kolejnym ruchem.`,
        `Koniec {ex}: {hl}. Reset i przejdź dalej.`,
        `Blok zaliczony — {hl}. Krótka przerwa, potem następne ćwiczenie.`,
      ]);
      return tipPlain(
        "ex-done",
        "info",
        fillTemplate(body, { hl, ex: exName }),
        null,
        hl,
      );
    }
    const body = pickCoachVariant(`${seedBase}|done-bw`, [
      `{ex} domknięte. Krótka przerwa i kolejny ruch.`,
      `Koniec tego ćwiczenia — oddychaj i idź dalej.`,
    ]);
    return tipPlain(
      "ex-done-bw",
      "info",
      fillTemplate(body, { ex: exName }),
    );
  }

  const nextTip = buildLiveCoachTipForOpenSet(exercise, nextIndex);
  if (!nextTip) return null;
  if (nextTip.apply) {
    const hl =
      nextTip.highlight ??
      `${formatKgPl(nextTip.apply.weightKg)} kg × ${nextTip.apply.reps}`;
    const lead = pickCoachVariant(`${seedBase}|lead|${nextTip.tone}`, [
      nextTip.tone === "caution"
        ? "Na następną: "
        : nextTip.tone === "progress"
          ? "W przerwie celuj w "
          : "Na następną trzymaj ",
      nextTip.tone === "caution"
        ? "Przygotuj lżejszy zestaw: "
        : nextTip.tone === "progress"
          ? "Kolejna seria: "
          : "Powtórz bazę: ",
      `Seria ${nextIndex + 1}/${exercise.sets.length}: `,
      `${exName} dalej → `,
    ]);
    const tail = pickCoachVariant(`${seedBase}|tail|${nextTip.tone}`, [
      nextTip.tone === "caution"
        ? " — zdejmij ciężar, jeśli forma się sypie."
        : nextTip.tone === "progress"
          ? " · przygotuj talerze / hantle już teraz."
          : " · ten sam ciężar, czysta technika.",
      nextTip.tone === "caution"
        ? " · priorytet: tor ruchu, nie ciężar."
        : nextTip.tone === "progress"
          ? " · oddychaj i dokładaj świadomie."
          : " · nie dokładaj „na czucie”.",
    ]);
    const body = `${lead}${hl}${tail}`;
    return {
      ...nextTip,
      id: `rest-${nextTip.id}`,
      prefix: lead,
      highlight: hl,
      suffix: tail,
      body,
    };
  }
  const wrap = pickCoachVariant(`${seedBase}|wrap`, [
    `Przerwa: {body}`,
    `Zanim wrócisz: {body}`,
    `{ex} — przerwa. {body}`,
  ]);
  const body = fillTemplate(wrap, { body: nextTip.body, ex: exName });
  return {
    ...nextTip,
    id: `rest-${nextTip.id}`,
    body,
    prefix: body,
    highlight: null,
    suffix: "",
  };
}

/** Skrót tekstowy do heurystyk / AI (bez UI). */
export function liveCoachTipToPlainText(tip: LiveCoachTip | null): string | null {
  return tip?.body ?? null;
}
