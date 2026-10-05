"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { chatCoach } from "@/ai/coach";
import { isAiConfigured } from "@/ai/client";
import { buildCoachRecentContext, buildCoachUserProfile } from "@/lib/coach-context";
import {
  UserMessages,
  activeWorkoutCoachZodMessage,
} from "@/lib/user-facing-errors";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import type { ChatCoachPromptInput } from "@/ai/prompts/chatCoach";
import { isAiGloballyDisabled } from "@/lib/ai-availability";
import {
  buildLiveCoachTipAfterCompletedSet,
  buildLiveCoachTipForOpenSet,
  liveCoachTipToPlainText,
} from "@/lib/live-set-coach";
import type { WorkoutExerciseState } from "@/components/workout/types";

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
  rir: z.preprocess((v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : null;
  }, z.union([z.number().int().min(0).max(5), z.null()]).optional()),
  rpe: z.preprocess((v) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : null;
  }, z.union([z.number().int().min(1).max(10), z.null()]).optional()),
});

const ExerciseSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(120),
  sets: z.array(SetSchema).max(36),
  targetReps: z.number().int().min(1).max(99).nullish(),
  targetRir: z.number().min(0).max(5).nullish(),
  lastSessionSets: z.array(SetSchema.nullable()).max(36).optional(),
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
  | { ok: true; text: string; source: "ai" | "heuristic" | "web" }
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

function heuristicTip(
  snapshot: NonNullable<ChatCoachPromptInput["activeWorkout"]>,
  liveLine: string | null,
): string {
  const { currentExercise, restRemainingSec, lastCompletedSet, sessionSetsDone, sessionSetsTotal } =
    snapshot;
  if (liveLine) {
    if (restRemainingSec != null && restRemainingSec > 0) {
      return `${liveLine} Przerwa ${restRemainingSec} s — oddychaj spokojnie.`;
    }
    return `${liveLine} Sesja: ${sessionSetsDone}/${sessionSetsTotal} serii.`;
  }
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
    "Pierwsze serie traktuj jako rozgrzewkę pod docelowy ciężar; zapisuj każdą ukończoną serię, żeby śledzić tonaż.",
    `W sesji masz ${snapshot.exerciseCount} ćwiczeń — skup się na jednym ruchu naraz.`,
  ].join(" ");
}

function liveLineFromPayload(data: z.infer<typeof InputSchema>): string | null {
  const { selectedExerciseId, exercises, trigger } = data;
  const current =
    exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null;
  if (!current) return null;
  const mapped: WorkoutExerciseState = {
    id: current.id,
    name: current.name,
    targetReps: current.targetReps ?? undefined,
    targetRir: current.targetRir ?? undefined,
    lastSessionSets: (current.lastSessionSets ?? []).map((s) =>
      s
        ? {
            reps: s.reps,
            weight: s.weight,
            done: s.done,
            rir: s.rir ?? null,
            rpe: s.rpe ?? null,
          }
        : null,
    ),
    sets: current.sets.map((s) => ({
      reps: s.reps,
      weight: s.weight,
      done: s.done,
      rir: s.rir ?? null,
      rpe: s.rpe ?? null,
    })),
  };
  const openIdx = Math.max(
    0,
    mapped.sets.findIndex((s) => !s.done),
  );
  if (trigger === "set_done" || trigger === "rest_start") {
    let lastDone = -1;
    for (let i = 0; i < mapped.sets.length; i++) {
      if (mapped.sets[i]?.done) lastDone = i;
    }
    if (lastDone >= 0) {
      return liveCoachTipToPlainText(
        buildLiveCoachTipAfterCompletedSet(mapped, lastDone),
      );
    }
  }
  return liveCoachTipToPlainText(buildLiveCoachTipForOpenSet(mapped, openIdx));
}

const userPrompt =
  "Jesteś Trenerem AI GymBrat podczas aktywnego treningu. Odpowiedz wyłącznie 2–4 krótkimi zdaniami po polsku: konkretne rady o ciężarze, powtórzeniach lub RIR na następną serię (np. +2,5 kg, dobij powtórzenia, zdejmij ciężar przy słabej formie). Bazuj na migawce i linii analizy lokalnej, jeśli podana. Bez „cześć”, bez podpisu.";

export async function activeWorkoutCoachAction(input: unknown): Promise<ActiveWorkoutCoachResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: UserMessages.sessionExpired };

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: activeWorkoutCoachZodMessage(parsed.error) };
  }

  const { exercises } = parsed.data;
  if (exercises.length === 0) return { ok: false, error: UserMessages.coachNoExercises };

  const snapshot = buildSnapshot(parsed.data);
  const liveLine = liveLineFromPayload(parsed.data);

  const entitled = await getUserAiEntitled(session.user.id);
  const userAiOff = await getUserAiFeaturesDisabled(session.user.id);
  const globalOff = await isAiGloballyDisabled();
  if (!isAiConfigured() || !entitled || userAiOff || globalOff) {
    return {
      ok: true,
      text: heuristicTip(snapshot, liveLine),
      source: "heuristic",
    };
  }

  try {
    const [rc, profile] = await Promise.all([
      buildCoachRecentContext(session.user.id),
      buildCoachUserProfile(session.user.id),
    ]);

    const reply = await chatCoach({
      messages: [
        {
          role: "user",
          content: [
            userPrompt,
            `Zdarzenie (trigger): ${snapshot.trigger}.`,
            liveLine ? `Analiza lokalna (ciężar/powtórzenia): ${liveLine}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
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
    const t = reply.text.trim();
    if (t.length > 24) {
      return {
        ok: true,
        text: t,
        source: reply.source === "web" ? "web" : "ai",
      };
    }
  } catch {
    /* fall through */
  }

  return {
    ok: true,
    text: heuristicTip(snapshot, liveLine),
    source: "heuristic",
  };
}
