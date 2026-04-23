import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { trainingSessions, workouts } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { assertCsrf } from "@/lib/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const db = getDb();

  const removedWorkouts = await db
    .delete(workouts)
    .returning({ id: workouts.id });

  const removedTrainingSessions = await db
    .delete(trainingSessions)
    .returning({ id: trainingSessions.id });

  const res = NextResponse.json({
    ok: true,
    deleted: {
      workouts: removedWorkouts.length,
      trainingSessions: removedTrainingSessions.length,
    },
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

