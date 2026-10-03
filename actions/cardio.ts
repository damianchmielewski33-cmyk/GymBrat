"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import {
  computePaceMinPerKm,
  parseCardioLog,
  type CardioLogPayload,
} from "@/lib/cardio";
import { calendarDateKey } from "@/lib/local-date";

function revalidateCardio(id?: string) {
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/workout-plan");
  revalidatePath("/treningi");
  revalidatePath("/workout-history");
  revalidatePath("/progress");
  if (id) revalidatePath(`/cardio/${id}`);
}

export async function createCardioLog(input: {
  title: string;
  cardioMinutes: number;
  notes?: string;
  distanceKm?: number | null;
  avgHr?: number | null;
  calories?: number | null;
  steps?: number | null;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie, aby zapisać wpis treningu.",
    };
  }

  const minutes = Math.max(0, Math.round(input.cardioMinutes));
  const pace = computePaceMinPerKm(input.distanceKm, minutes);
  const payload: CardioLogPayload = {
    kind: "cardio_log",
    title: input.title,
    notes: input.notes ?? null,
    distanceKm: input.distanceKm ?? null,
    avgHr: input.avgHr ?? null,
    calories: input.calories ?? null,
    steps: input.steps ?? null,
    paceMinPerKm: pace,
    devicePhotoDataUrl: null,
  };

  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(workouts).values({
    id,
    userId: session.user.id,
    date: calendarDateKey(new Date()),
    cardioMinutes: minutes,
    exercises: JSON.stringify(payload),
  });

  revalidateCardio(id);
  return { ok: true as const, id };
}

export async function updateCardioLogAction(
  _prev: unknown,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sesja wygasła." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "Brak identyfikatora." };

  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const minutes = Math.max(0, Math.round(Number(formData.get("minutes") ?? 0)));
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const distanceRaw = String(formData.get("distanceKm") ?? "")
    .trim()
    .replace(",", ".");
  const avgHrRaw = String(formData.get("avgHr") ?? "").trim();
  const distanceKm = distanceRaw ? Number(distanceRaw) : null;
  const avgHr = avgHrRaw ? Number(avgHrRaw) : null;

  const db = getDb();
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))
    .limit(1);
  if (!row) return { ok: false as const, error: "Nie znaleziono wpisu." };

  let existingPhoto: string | null = null;
  try {
    const prev = parseCardioLog(JSON.parse(row.exercises));
    existingPhoto = prev?.devicePhotoDataUrl ?? null;
  } catch {
    /* ignore */
  }

  const dist =
    distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0
      ? distanceKm
      : null;
  const hr =
    avgHr != null && Number.isFinite(avgHr) && avgHr > 0
      ? Math.round(avgHr)
      : null;

  const payload: CardioLogPayload = {
    kind: "cardio_log",
    title,
    notes: notesRaw || null,
    distanceKm: dist,
    avgHr: hr,
    calories: null,
    steps: null,
    paceMinPerKm: computePaceMinPerKm(dist, minutes),
    devicePhotoDataUrl: existingPhoto,
  };

  await db
    .update(workouts)
    .set({
      cardioMinutes: minutes,
      exercises: JSON.stringify(payload),
    })
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)));

  revalidateCardio(id);
  return { ok: true as const, id };
}

export async function deleteCardioLogAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sesja wygasła." };
  }

  const db = getDb();
  const removed = await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))
    .returning({ id: workouts.id });

  if (!removed.length) {
    return { ok: false as const, error: "Nie znaleziono wpisu." };
  }

  revalidateCardio();
  return { ok: true as const };
}

export async function setCardioDevicePhotoAction(
  id: string,
  dataUrl: string | null,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sesja wygasła." };
  }

  if (dataUrl && dataUrl.length > 2_500_000) {
    return { ok: false as const, error: "Zdjęcie jest za duże (max ~2 MB)." };
  }

  const db = getDb();
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))
    .limit(1);
  if (!row) return { ok: false as const, error: "Nie znaleziono wpisu." };

  let payload = parseCardioLog(
    (() => {
      try {
        return JSON.parse(row.exercises);
      } catch {
        return null;
      }
    })(),
  );
  if (!payload) return { ok: false as const, error: "To nie jest wpis cardio." };

  payload = { ...payload, devicePhotoDataUrl: dataUrl };
  await db
    .update(workouts)
    .set({ exercises: JSON.stringify(payload) })
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)));

  revalidateCardio(id);
  return { ok: true as const };
}
