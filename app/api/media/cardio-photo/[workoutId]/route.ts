import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { parseCardioLog } from "@/lib/cardio";
import { decryptCardioDevicePhoto } from "@/lib/cardio-device-photo";
import { imageResponseFromDataUrl } from "@/lib/user-photo-response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ workoutId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { workoutId } = await ctx.params;
  const db = getDb();
  const [row] = await db
    .select({ exercises: workouts.exercises })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.exercises);
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const payload = parseCardioLog(parsed);
  const raw = payload?.devicePhotoDataUrl ?? null;
  const dataUrl = decryptCardioDevicePhoto(raw);
  if (!dataUrl) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const res = imageResponseFromDataUrl(dataUrl);
  if (!res) {
    return NextResponse.json({ ok: false, error: "Corrupt image" }, { status: 500 });
  }
  return res;
}
