"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { closeDay, upsertDailyCheckin } from "@/lib/daily-checkin";

export type DailyCheckinFormState = {
  ok?: boolean;
  error?: string;
};

const score10 = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite().int().min(1).max(10).nullable(),
);

const weight = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite().min(20).max(400).nullable(),
);

const baseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleepQuality: score10,
  dayEnergy: score10,
  stress: score10,
  weightKg: weight,
  notes: z.string().trim().max(2000).nullable(),
});

export async function upsertDailyCheckinAction(
  _prev: DailyCheckinFormState,
  formData: FormData,
): Promise<DailyCheckinFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = baseSchema.safeParse({
    date: formData.get("date"),
    sleepQuality: formData.get("sleepQuality"),
    dayEnergy: formData.get("dayEnergy"),
    stress: formData.get("stress"),
    weightKg: formData.get("weightKg"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "Sprawdź poprawność danych." };

  await upsertDailyCheckin(session.user.id, parsed.data.date, {
    sleepQuality: parsed.data.sleepQuality,
    dayEnergy: parsed.data.dayEnergy,
    stress: parsed.data.stress,
    weightKg: parsed.data.weightKg,
    notes: parsed.data.notes,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function closeDayAction(
  _prev: DailyCheckinFormState,
  formData: FormData,
): Promise<DailyCheckinFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse({ date: formData.get("date") });
  if (!parsed.success) return { error: "Nieprawidłowa data." };

  // MVP: zapisujemy tylko “zamknięty dzień” + prosty obiekt na przyszłość.
  await closeDay(session.user.id, parsed.data.date, {
    kind: "day_close_v1",
    closedAt: new Date().toISOString(),
  });

  revalidatePath("/");
  return { ok: true };
}

