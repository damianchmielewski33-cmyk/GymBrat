import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";

type CompletedWorkoutPayload = {
  title: string;
  startedAt?: number | null;
  endedAt?: number | null;
  cardioMinutes: number;
  exercises: unknown;
  workoutPlanId?: string | null;
};

function parseCompletedWorkout(json: string): {
  kind?: string;
  startedAt?: number;
  exercises?: unknown;
} | null {
  try {
    const o = JSON.parse(json) as unknown;
    if (!o || typeof o !== "object") return null;
    return o as { kind?: string; startedAt?: number; exercises?: unknown };
  } catch {
    return null;
  }
}

function safeSessionVolume(exercises: unknown): number {
  if (!Array.isArray(exercises)) return 0;
  return sessionVolume(
    exercises as ReadonlyArray<{
      sets: ReadonlyArray<{ reps: number | null; weight: number }>;
    }>,
  );
}

function deltaPct(current: number, prev: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((current - prev) / prev) * 100;
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Brak autoryzacji" },
      { status: 401 },
    );
  }

  let body: CompletedWorkoutPayload;
  try {
    body = (await req.json()) as CompletedWorkoutPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowy JSON" },
      { status: 400 },
    );
  }

  const title = String(body.title ?? "Sesja").trim() || "Sesja";
  const cardioMinutes = Number(body.cardioMinutes ?? 0);
  const startedAt =
    typeof body.startedAt === "number" && Number.isFinite(body.startedAt)
      ? new Date(body.startedAt)
      : new Date();
  const endedAt =
    typeof body.endedAt === "number" && Number.isFinite(body.endedAt)
      ? new Date(body.endedAt)
      : new Date();

  const rawPlanId =
    typeof body.workoutPlanId === "string" && body.workoutPlanId.trim().length > 0
      ? body.workoutPlanId.trim()
      : null;

  const db = getDb();
  if (rawPlanId) {
    const [owned] = await db
      .select({ id: workoutPlans.id })
      .from(workoutPlans)
      .where(and(eq(workoutPlans.id, rawPlanId), eq(workoutPlans.userId, session.user.id)))
      .limit(1);
    if (!owned) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy plan treningowy" },
        { status: 400 },
      );
    }
  }

  // Strength proxy: session volume compared to previous workout from the same plan.
  let strengthDeltaPercent: number | null = null;
  if (rawPlanId) {
    const currentVol = safeSessionVolume(body.exercises);
    const currentStartedAtMs = startedAt.getTime();

    const recent = await db
      .select({ exercises: workouts.exercises })
      .from(workouts)
      .where(and(eq(workouts.userId, session.user.id), eq(workouts.workoutPlanId, rawPlanId)))
      .orderBy(desc(workouts.date))
      .limit(12);

    let prevVol: number | null = null;
    for (const r of recent) {
      const parsed = parseCompletedWorkout(r.exercises);
      if (!parsed || parsed.kind !== "completed_session") continue;
      const prevStartedAtMs = typeof parsed.startedAt === "number" ? parsed.startedAt : null;
      if (prevStartedAtMs == null || !Number.isFinite(prevStartedAtMs)) continue;
      if (prevStartedAtMs >= currentStartedAtMs) continue;
      prevVol = safeSessionVolume(parsed.exercises);
      break;
    }

    if (prevVol != null) {
      strengthDeltaPercent = deltaPct(currentVol, prevVol);
    }
  }

  const dateKey = calendarDateKey(startedAt);
  await db.insert(workouts).values({
    userId: session.user.id,
    workoutPlanId: rawPlanId,
    date: dateKey,
    cardioMinutes: Math.max(0, Math.round(cardioMinutes)),
    exercises: JSON.stringify({
      kind: "completed_session",
      title,
      startedAt: startedAt.getTime(),
      endedAt: endedAt.getTime(),
      workoutPlanId: rawPlanId,
      exercises: body.exercises ?? null,
    }),
  });

  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/active-workout");

  return NextResponse.json({ ok: true, strengthDeltaPercent });
}

