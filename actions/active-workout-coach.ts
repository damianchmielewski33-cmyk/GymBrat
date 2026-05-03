"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { chatCoach } from "@/ai/coach";
import { isAiConfigured } from "@/ai/client";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import type { ChatCoachPromptInput } from "@/ai/prompts/chatCoach";

const SetSchema = z.object({
  /** Klient może pominąć pole w JSON (undefined) — traktuj jak brak wpisu. */
  reps: z.preprocess((v) => {
    if (v === undefined) return null;
    if (v === null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(String(v).replace(",", ".").trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, z.union([z.number().finite(), z.null()])),
  weight: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(String(v).replace(",", ".").replace(/\s/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }, z.number().finite().min(0).max(2000)),
  done: z.boolean(),
});

const ExerciseSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(120),
  sets: z.array(SetSchema).max(36),
});

const InputSchema = z.object({
  title: z.string().max(120),
  elapsedSeconds: z.number().int().min(0).max(86400),
  selectedExerciseId: z.string().max(80).nullable(),
  exercises: z.array(ExerciseSchema).max(36),
  restRemaining: z.number().int().min(0).max(7200).nullable(),
  trigger: z.enum(["exercise_change", "set_done", "rest_start", "manual"]),
});

export type ActiveWorkoutCoachTrigger = z.infer<typeof InputSchema>["trigger"];

export type ActiveWorkoutCoachResult =
  | { ok: true; text: string; source: "ai" | "heuristic" }
  | { ok: false; error: string };

function triggerLabel(t: ActiveWorkoutCoachTrigger): string {
  switch (t) {
    case "exercise_change":
      return "Zmiana ćwiczenia na liście";
    case "set_done":
      return "Zapisana ukończona seria";
    case "rest_start":
      return "Start przerwy międzyseriowej";
    case "manual":
      return "Ręczne odświeżenie";
    default:
      return t;
  }
}

function formatSetLine(weight: number, reps: number | null): string {
  const r = reps != null && reps > 0 ? String(reps) : "—";
  return `${weight} kg × ${r}`;
}

function buildSnapshot(
  data: z.infer<typeof InputSchema>,
): NonNullable<ChatCoachPromptInput["activeWorkout"]> {
  const { title, elapsedSeconds, selectedExerciseId, exercises, restRemaining, trigger } = data;
  const idx = Math.max(
    0,
    exercises.findIndex((e) => e.id === selectedExerciseId),
  );
  const current = exercises[idx] ?? exercises[0];
  const name = current?.name?.trim() || "Ćwiczenie";
  let sessionDone = 0;
  let sessionTotal = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      sessionTotal += 1;
      if (s.done) sessionDone += 1;
    }
  }
  const curSets = current?.sets ?? [];
  const curDone = curSets.filter((s) => s.done).length;
  let lastCompleted: string | null = null;
  for (let i = curSets.length - 1; i >= 0; i--) {
    const s = curSets[i];
    if (s?.done && s.weight > 0) {
      lastCompleted = formatSetLine(s.weight, s.reps);
      break;
    }
  }

  return {
    sessionTitle: title.trim() || "Sesja",
    elapsedMinutes: Math.round(elapsedSeconds / 60),
    sessionSetsDone: sessionDone,
    sessionSetsTotal: sessionTotal,
    currentExercise: name,
    exerciseIndex: idx + 1,
    exerciseCount: exercises.length,
    currentExerciseSetsDone: curDone,
    currentExerciseSetCount: curSets.length,
    lastCompletedSet: lastCompleted,
    trigger: triggerLabel(trigger),
    restRemainingSec: restRemaining,
  };
}

function heuristicTip(snapshot: NonNullable<ChatCoachPromptInput["activeWorkout"]>): string {
  const { currentExercise, restRemainingSec, lastCompletedSet, sessionSetsDone, sessionSetsTotal } =
    snapshot;
  if (restRemainingSec != null && restRemainingSec > 0) {
    return [
      `Przerwa ${restRemainingSec} s przed kolejną serią ${currentExercise} — złap oddech przez nos, rozluźnij kark i barki.`,
      "Napij się wody. Przed następną serią zrób 2–3 lekkie powtórzenia rozgrzewające ten sam ruch.",
    ].join(" ");
  }
  if (lastCompletedSet) {
    return [
      `Dobra robota przy ${currentExercise} (${lastCompletedSet}).`,
      "Następna seria: utrzymuj kontrolowane opuszczanie i stabilny core — jeśli forma się sypie, lekko zdejmij ciężar.",
      `Postęp sesji: ${sessionSetsDone}/${sessionSetsTotal} serii zapisanych.`,
    ].join(" ");
  }
  return [
    `Startujesz z ${currentExercise} — ustaw stabilną pozycję stóp, świadomy zakres ruchu i spójny rytm powtórzeń.`,
    "Pierwsze serie traktuj jako rozgrzewkę pod docelowy ciężar; zapisuj każdą ukończoną serię, żeby śledzić objętość.",
    `W sesji masz ${snapshot.exerciseCount} ćwiczeń — skup się na jednym ruchu naraz.`,
  ].join(" ");
}

const userPrompt =
  "Jesteś Trenerem AI GymBrat podczas aktywnego treningu użytkownika. Odpowiedz wyłącznie 2–4 krótkimi zdaniami po polsku: konkretne wskazówki techniczne lub mentalne dopasowane do migawki i typu zdarzenia (trigger). Bez „cześć”, bez podpisu.";

export async function activeWorkoutCoachAction(input: unknown): Promise<ActiveWorkoutCoachResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Brak sesji." };

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane treningu." };

  const { exercises } = parsed.data;
  if (exercises.length === 0) return { ok: false, error: "Brak ćwiczeń w sesji." };

  const snapshot = buildSnapshot(parsed.data);

  const userAiOff = await getUserAiFeaturesDisabled(session.user.id);
  if (!isAiConfigured() || userAiOff) {
    return { ok: true, text: heuristicTip(snapshot), source: "heuristic" };
  }

  try {
    const [rc, profile] = await Promise.all([
      buildCoachRecentContext(session.user.id),
      buildCoachUserProfile(session.user.id),
    ]);

    const text = await chatCoach({
      messages: [
        {
          role: "user",
          content: `${userPrompt}\nZdarzenie (trigger): ${snapshot.trigger}.`,
        },
      ],
      context: {
        userProfile: profile,
        recentContext: rc,
        guardrails: { tone: "supportive" },
        task: "active_session_tip",
        activeWorkout: snapshot,
      },
    });
    const t = text.trim();
    if (t.length > 24) return { ok: true, text: t, source: "ai" };
  } catch {
    /* fall through */
  }

  return { ok: true, text: heuristicTip(snapshot), source: "heuristic" };
}
