import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans, workouts } from "@/db/schema";
import { localDateKey } from "@/lib/local-date";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type CompletedWorkoutPayload = {
  title: string;
  startedAt?: number | null;
  endedAt?: number | null;
  cardioMinutes: number;
  exercises: unknown;
  workoutPlanId?: string | null;
};

export async function POST(req: Request) {
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

  const dateKey = localDateKey(startedAt);
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

  return NextResponse.json({ ok: true });
}

