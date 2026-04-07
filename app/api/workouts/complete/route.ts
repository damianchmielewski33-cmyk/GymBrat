import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { localDateKey } from "@/lib/local-date";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type CompletedWorkoutPayload = {
  title: string;
  startedAt?: number | null;
  endedAt?: number | null;
  cardioMinutes: number;
  exercises: unknown;
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

  const db = getDb();
  const dateKey = localDateKey(startedAt);
  await db.insert(workouts).values({
    userId: session.user.id,
    date: dateKey,
    cardioMinutes: Math.max(0, Math.round(cardioMinutes)),
    exercises: JSON.stringify({
      kind: "completed_session",
      title,
      startedAt: startedAt.getTime(),
      endedAt: endedAt.getTime(),
      exercises: body.exercises ?? null,
    }),
  });

  revalidatePath("/");
  revalidatePath("/reports");

  return NextResponse.json({ ok: true });
}

