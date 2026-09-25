"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureMealLogsTableOncePerProcess } from "@/db/ensure-schema";
import { mealLogs } from "@/db/schema";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import { isDietDiarySlot } from "@/lib/diet-diary-slots";

export type MealLogFormState = {
  error?: string;
  ok?: boolean;
};

const nonneg = z.preprocess(
  (val) => (val === "" || val == null ? 0 : Number(val)),
  z.number().finite().min(0),
);

/** Makroskładniki wpisu — kcal można wyliczyć z gramów B/W/T lub nadpisać ręcznie. */
const mealMacrosSchema = z.object({
  name: z.string().trim().max(120).optional(),
  proteinG: nonneg,
  fatG: nonneg,
  carbsG: nonneg,
  calories: nonneg.optional(),
});

function finalizeMealMacros(data: z.infer<typeof mealMacrosSchema>) {
  const computed = kcalFromMacros(data.proteinG, data.fatG, data.carbsG);
  const manual =
    typeof data.calories === "number" && Number.isFinite(data.calories) && data.calories > 0
      ? Math.round(data.calories)
      : null;
  return {
    ...data,
    calories: manual ?? computed,
  };
}

function validateMealMacros(data: {
  proteinG: number;
  fatG: number;
  carbsG: number;
  calories: number;
}) {
  if (data.proteinG + data.fatG + data.carbsG <= 0 && data.calories <= 0) {
    return {
      ok: false as const,
      error: "Podaj makroskładniki posiłku lub wpisz kalorie.",
    };
  }
  if (data.calories <= 0) {
    return {
      ok: false as const,
      error: "Nieprawidłowe wartości makroskładników — nie da się wyliczyć kalorii.",
    };
  }
  return { ok: true as const };
}

export async function addMealLogAction(
  _prev: MealLogFormState,
  formData: FormData,
): Promise<MealLogFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.string().trim().optional(),
      barcode: z.string().trim().max(32).optional(),
    })
    .merge(mealMacrosSchema)
    .safeParse({
      date: formData.get("date"),
      slot: formData.get("slot") || undefined,
      barcode: formData.get("barcode") || undefined,
      name: formData.get("name") || undefined,
      proteinG: formData.get("proteinG"),
      fatG: formData.get("fatG"),
      carbsG: formData.get("carbsG"),
      calories: formData.get("calories"),
    });

  if (!parsed.success) {
    return { error: "Sprawdź poprawność liczb i daty." };
  }

  const { date, slot: rawSlot, barcode, ...macroRest } = parsed.data;
  const withKcal = finalizeMealMacros(macroRest);
  const check = validateMealMacros(withKcal);
  if (!check.ok) return { error: check.error };

  const slot = rawSlot && isDietDiarySlot(rawSlot) ? rawSlot : null;
  const { name, calories, proteinG, fatG, carbsG } = withKcal;
  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  await db.insert(mealLogs).values({
    userId: session.user.id,
    date,
    name: name?.length ? name : null,
    slot,
    barcode: barcode?.length ? barcode.replace(/\D/g, "") : null,
    calories,
    proteinG,
    fatG,
    carbsG,
  });

  revalidatePath("/");
  revalidatePath("/meal-suggestions");
  return { ok: true };
}

/** Dodanie produktu ze skanu / bazy (bez FormData) — po odczycie kodu EAN. */
export async function addMealProductAction(input: {
  date: string;
  slot?: string | null;
  barcode?: string | null;
  name: string;
  proteinG: number;
  fatG: number;
  carbsG: number;
  calories?: number;
}): Promise<MealLogFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.string().trim().optional().nullable(),
      barcode: z.string().trim().max(32).optional().nullable(),
      name: z.string().trim().min(1).max(120),
      proteinG: z.number().finite().min(0),
      fatG: z.number().finite().min(0),
      carbsG: z.number().finite().min(0),
      calories: z.number().finite().min(0).optional(),
    })
    .safeParse(input);

  if (!parsed.success) return { error: "Sprawdź dane produktu." };

  const withKcal = finalizeMealMacros({
    name: parsed.data.name,
    proteinG: parsed.data.proteinG,
    fatG: parsed.data.fatG,
    carbsG: parsed.data.carbsG,
    calories: parsed.data.calories,
  });
  const check = validateMealMacros(withKcal);
  if (!check.ok) return { error: check.error };

  const slot =
    parsed.data.slot && isDietDiarySlot(parsed.data.slot) ? parsed.data.slot : null;

  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  await db.insert(mealLogs).values({
    userId: session.user.id,
    date: parsed.data.date,
    name: withKcal.name ?? parsed.data.name,
    slot,
    barcode: parsed.data.barcode?.replace(/\D/g, "") || null,
    calories: withKcal.calories,
    proteinG: withKcal.proteinG,
    fatG: withKcal.fatG,
    carbsG: withKcal.carbsG,
  });

  revalidatePath("/");
  revalidatePath("/meal-suggestions");
  return { ok: true };
}

const updateSchema = z
  .object({
    id: z.string().trim().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .merge(mealMacrosSchema);

export async function updateMealLogAction(
  _prev: MealLogFormState,
  formData: FormData,
): Promise<MealLogFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    date: formData.get("date"),
    name: formData.get("name") || undefined,
    proteinG: formData.get("proteinG"),
    fatG: formData.get("fatG"),
    carbsG: formData.get("carbsG"),
    calories: formData.get("calories"),
  });

  if (!parsed.success) {
    return { error: "Sprawdź poprawność danych." };
  }

  const { id, date, ...macroRest } = parsed.data;
  const withKcal = finalizeMealMacros(macroRest);
  const check = validateMealMacros(withKcal);
  if (!check.ok) return { error: check.error };

  const { name, calories, proteinG, fatG, carbsG } = withKcal;
  await ensureMealLogsTableOncePerProcess();
  const db = getDb();

  const updated = await db
    .update(mealLogs)
    .set({
      date,
      name: name?.length ? name : null,
      calories,
      proteinG,
      fatG,
      carbsG,
    })
    .where(and(eq(mealLogs.id, id), eq(mealLogs.userId, session.user.id)))
    .returning({ id: mealLogs.id });

  if (updated.length === 0) {
    return { error: "Nie znaleziono wpisu lub brak uprawnień." };
  }

  revalidatePath("/");
  revalidatePath("/meal-suggestions");
  return { ok: true };
}

/** Usuwanie wpisu — do `<form action={deleteMealLogFormAction}>`. */
export async function deleteMealLogFormAction(
  _prevState: unknown,
  formData: FormData,
): Promise<MealLogFormState> {
  return deleteMealLogCore(formData);
}

async function deleteMealLogCore(
  formData: FormData,
): Promise<MealLogFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Brak sesji." };

  const parsed = z
    .object({ id: z.string().trim().min(1) })
    .safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { error: "Nieprawidłowy identyfikator wpisu." };
  }

  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  const removed = await db
    .delete(mealLogs)
    .where(
      and(
        eq(mealLogs.id, parsed.data.id),
        eq(mealLogs.userId, session.user.id),
      ),
    )
    .returning({ id: mealLogs.id });

  if (removed.length === 0) {
    return { error: "Nie znaleziono wpisu lub brak uprawnień." };
  }

  revalidatePath("/");
  revalidatePath("/meal-suggestions");
  return { ok: true };
}