"use server";

import { guardAction } from "@/lib/action-guard";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users, workouts } from "@/db/schema";
import {
  computePaceMinPerKm,
  heartRateZoneFromHr,
  isCardioTypeSlug,
  parseCardioLog,
  resolveCardioType,
  validateCardioMetrics,
  type CardioLogPayload,
  type CardioTypeSlug,
  type HeartRateZone,
} from "@/lib/cardio";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { encryptCardioDevicePhoto } from "@/lib/cardio-device-photo";
import {
  isCompletedStrengthSession,
  parseWorkoutSessionJson,
} from "@/lib/workout-cardio-attribution";

/** Ile dni wstecz można dopisać cardio. */
const CARDIO_BACKDATE_MAX_DAYS = 60;

/** Pusta data = dziś; inaczej YYYY-MM-DD z zakresu [dziś−60, dziś]. */
function resolveCardioLogDate(
  dateKey: string | null | undefined,
): { ok: true; date: string } | { ok: false; error: string } {
  const todayKey = calendarDateKey(new Date());
  const raw = (dateKey ?? "").trim();
  if (!raw) return { ok: true, date: todayKey };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    return { ok: false, error: "Nieprawidłowa data cardio." };
  }
  if (raw > todayKey) {
    return { ok: false, error: "Nie można zapisać cardio z przyszłości." };
  }
  if (raw < addCalendarDays(todayKey, -CARDIO_BACKDATE_MAX_DAYS)) {
    return {
      ok: false,
      error: `Cardio można dopisać maksymalnie ${CARDIO_BACKDATE_MAX_DAYS} dni wstecz.`,
    };
  }
  return { ok: true, date: raw };
}

function revalidateCardio(id?: string) {
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/workout-plan");
  revalidatePath("/treningi");
  revalidatePath("/workout-history");
  revalidatePath("/progress");
  revalidatePath("/cardio");
  if (id) revalidatePath(`/cardio/${id}`);
}

export async function createCardioLog(input: {
  title: string;
  cardioMinutes: number;
  notes?: string;
  cardioType?: CardioTypeSlug | null;
  distanceKm?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  steps?: number | null;
  paceMinPerKm?: number | null;
  effortScore?: number | null;
  /** YYYY-MM-DD; puste = dziś. Do 60 dni wstecz. */
  date?: string | null;
}) {
  await guardAction("cardio.createCardioLog");
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie, aby zapisać wpis treningu.",
    };
  }

  const metrics = validateCardioMetrics({
    minutes: input.cardioMinutes,
    distanceKm: input.distanceKm,
    avgHr: input.avgHr,
    maxHr: input.maxHr,
    calories: input.calories,
    steps: input.steps,
  });
  if (!metrics.ok) {
    return { ok: false as const, error: metrics.error };
  }
  const logDate = resolveCardioLogDate(input.date);
  if (!logDate.ok) {
    return { ok: false as const, error: logDate.error };
  }

  const { minutes, distanceKm, avgHr, maxHr, calories, steps } = metrics;
  const pace =
    input.paceMinPerKm != null &&
    Number.isFinite(input.paceMinPerKm) &&
    input.paceMinPerKm > 0 &&
    input.paceMinPerKm <= 120
      ? input.paceMinPerKm
      : computePaceMinPerKm(distanceKm, minutes);
  const cardioType =
    (isCardioTypeSlug(input.cardioType) ? input.cardioType : null) ??
    resolveCardioType(input.title);

  let ageYears: number | null = null;
  try {
    const dbAge = getDb();
    const [u] = await dbAge
      .select({ age: users.age })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    ageYears = u?.age ?? null;
  } catch {
    /* ignore */
  }
  const hrMax =
    ageYears != null && Number.isFinite(ageYears) ? 220 - ageYears : null;
  const zone: HeartRateZone | null = heartRateZoneFromHr(
    avgHr,
    hrMax ?? maxHr,
  );
  const effort =
    input.effortScore != null &&
    Number.isFinite(input.effortScore) &&
    input.effortScore >= 1 &&
    input.effortScore <= 10
      ? Math.round(input.effortScore)
      : null;

  const payload: CardioLogPayload = {
    kind: "cardio_log",
    title: input.title,
    notes: input.notes ?? null,
    cardioType,
    distanceKm,
    avgHr,
    maxHr,
    calories,
    caloriesBurned: calories,
    steps,
    paceMinPerKm: pace,
    effortScore: effort,
    heartRateZone: zone,
    devicePhotoDataUrl: null,
  };

  const id = crypto.randomUUID();
  const db = getDb();
  await db.insert(workouts).values({
    id,
    userId: session.user.id,
    date: logDate.date,
    cardioMinutes: minutes,
    exercises: JSON.stringify(payload),
    tonnageKg: null,
  });

  revalidateCardio(id);
  return { ok: true as const, id };
}

export async function updateCardioLogAction(
  _prev: unknown,
  formData: FormData,
) {
  await guardAction("cardio.updateCardioLogAction");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sesja wygasła." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false as const, error: "Brak identyfikatora." };

  const title = String(formData.get("title") ?? "Cardio").trim() || "Cardio";
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const distanceRaw = String(formData.get("distanceKm") ?? "")
    .trim()
    .replace(",", ".");
  const avgHrRaw = String(formData.get("avgHr") ?? "").trim();
  const maxHrRaw = String(formData.get("maxHr") ?? "").trim();
  const caloriesRaw = String(formData.get("calories") ?? "").trim();
  const stepsRaw = String(formData.get("steps") ?? "").trim();
  const effortRaw = String(formData.get("effortScore") ?? "").trim();
  const typeRaw = String(formData.get("cardioType") ?? "").trim();
  const effortScore = effortRaw ? Number(effortRaw) : null;

  const metrics = validateCardioMetrics({
    minutes: formData.get("minutes") ?? 0,
    distanceKm: distanceRaw || null,
    avgHr: avgHrRaw || null,
    maxHr: maxHrRaw || null,
    calories: caloriesRaw || null,
    steps: stepsRaw || null,
  });
  if (!metrics.ok) return { ok: false as const, error: metrics.error };
  const {
    minutes,
    distanceKm: dist,
    avgHr: hr,
    maxHr: maxHrN,
    calories: kcal,
    steps: stepN,
  } = metrics;

  const db = getDb();
  const [row] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)))
    .limit(1);
  if (!row) return { ok: false as const, error: "Nie znaleziono wpisu." };

  let existingPhoto: string | null = null;
  let prevPace: number | null = null;
  let prevDist: number | null = null;
  try {
    const parsedRow = JSON.parse(row.exercises) as unknown;
    // Nie nadpisuj zaliczonego treningu siłowego wpisem cardio.
    if (isCompletedStrengthSession(parseWorkoutSessionJson(row.exercises))) {
      return { ok: false as const, error: "To nie jest wpis cardio." };
    }
    const prev = parseCardioLog(parsedRow);
    existingPhoto = prev?.devicePhotoDataUrl ?? null;
    prevPace = prev?.paceMinPerKm ?? null;
    prevDist = prev?.distanceKm ?? null;
  } catch {
    /* ignore */
  }

  // Własne tempo użytkownika zostaje, jeśli dystans i czas się nie zmieniły.
  const unchangedForPace =
    prevPace != null &&
    prevDist === dist &&
    Math.round(row.cardioMinutes ?? 0) === minutes;
  const pace = unchangedForPace ? prevPace : computePaceMinPerKm(dist, minutes);

  const effort =
    effortScore != null &&
    Number.isFinite(effortScore) &&
    effortScore >= 1 &&
    effortScore <= 10
      ? Math.round(effortScore)
      : null;
  const cardioType =
    (isCardioTypeSlug(typeRaw) ? typeRaw : null) ?? resolveCardioType(title);

  let ageYears: number | null = null;
  try {
    const [u] = await db
      .select({ age: users.age })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    ageYears = u?.age ?? null;
  } catch {
    /* ignore */
  }
  const hrMaxEst =
    ageYears != null && Number.isFinite(ageYears) ? 220 - ageYears : null;
  const zone = heartRateZoneFromHr(hr, hrMaxEst ?? maxHrN);

  const payload: CardioLogPayload = {
    kind: "cardio_log",
    title,
    notes: notesRaw || null,
    cardioType,
    distanceKm: dist,
    avgHr: hr,
    maxHr: maxHrN,
    calories: kcal,
    caloriesBurned: kcal,
    steps: stepN,
    paceMinPerKm: pace,
    effortScore: effort,
    heartRateZone: zone,
    devicePhotoDataUrl: encryptCardioDevicePhoto(existingPhoto),
  };

  await db
    .update(workouts)
    .set({
      cardioMinutes: minutes,
      exercises: JSON.stringify(payload),
      tonnageKg: null,
    })
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)));

  revalidateCardio(id);
  return { ok: true as const, id };
}

export async function deleteCardioLogAction(id: string) {
  await guardAction("cardio.deleteCardioLogAction");
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
  await guardAction("cardio.setCardioDevicePhotoAction");
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

  payload = {
    ...payload,
    devicePhotoDataUrl: dataUrl ? encryptCardioDevicePhoto(dataUrl) : null,
  };
  await db
    .update(workouts)
    .set({ exercises: JSON.stringify(payload), tonnageKg: null })
    .where(and(eq(workouts.id, id), eq(workouts.userId, session.user.id)));

  revalidateCardio(id);
  return { ok: true as const };
}
