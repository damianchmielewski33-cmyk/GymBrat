import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import {
  computePaceMinPerKm,
  parseCardioLog,
  type CardioLogPayload,
} from "@/lib/cardio";
import { cardioLogHasDevicePhoto } from "@/lib/cardio-device-photo";

export type CardioActivity = {
  id: string;
  date: string;
  minutes: number;
  payload: CardioLogPayload;
  paceMinPerKm: number | null;
  hasDevicePhoto: boolean;
};

export async function getCardioActivity(
  userId: string,
  id: string,
): Promise<CardioActivity | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .limit(1);
  if (!row) return null;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.exercises);
  } catch {
    return null;
  }
  const payload = parseCardioLog(parsed);
  if (!payload) return null;

  const rawPhoto =
    parsed &&
    typeof parsed === "object" &&
    typeof (parsed as Record<string, unknown>).devicePhotoDataUrl === "string"
      ? ((parsed as Record<string, unknown>).devicePhotoDataUrl as string)
      : null;

  const minutes = row.cardioMinutes ?? 0;
  const pace =
    payload.paceMinPerKm ??
    computePaceMinPerKm(payload.distanceKm, minutes);

  return {
    id: row.id,
    date: row.date,
    minutes,
    payload: { ...payload, paceMinPerKm: pace, devicePhotoDataUrl: null },
    paceMinPerKm: pace,
    hasDevicePhoto: cardioLogHasDevicePhoto(rawPhoto),
  };
}
