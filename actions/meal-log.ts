"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { mealLogs } from "@/db/schema";
import { kcalFromMacros } from "@/lib/kcal-from-macros";

export type MealLogFormState = {
  error?: string;
  ok?: boolean;
};

const nonneg = z.preprocess(
  (val) => (val === "" || val == null ? 0 : Number(val)),
  z.number().finite().min(0),
);

/** Makra wpisu — kcal wyliczamy wyłącznie z makr (Atwater). */
const mealMacrosSchema = z.object({
  name: z.string().trim().max(120).optional(),
  proteinG: nonneg,
  fatG: nonneg,
  carbsG: nonneg,
});

function finalizeMealMacros(data: z.infer<typeof mealMacrosSchema>) {
  const calories = kcalFromMacros(data.proteinG, data.fatG, data.carbsG);
  return { ...data, calories };
}

function validateMealMacros(data: {
  proteinG: number;
  fatG: number;
  carbsG: number;
  calories: number;
}) {
  if (data.proteinG + data.fatG + data.carbsG <= 0) {
    return {
      ok: false as const,
      error: "Podaj makra posiłku (co najmniej jedno większe od zera).",
    };
  }
  if (data.calories <= 0) {
    return {
      ok: false as const,
      error: "Nieprawidłowe makra — nie da się wyliczyć kalorii.",
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
    })
    .merge(mealMacrosSchema)
    .safeParse({
      date: formData.get("date"),
      name: formData.get("name") || undefined,
      proteinG: formData.get("proteinG"),
      fatG: formData.get("fatG"),
      carbsG: formData.get("carbsG"),
    });

  if (!parsed.success) {
    return { error: "Sprawdź poprawność liczb i daty." };
  }

  const { date, ...macroRest } = parsed.data;
  const withKcal = finalizeMealMacros(macroRest);
  const check = validateMealMacros(withKcal);
  if (!check.ok) return { error: check.error };

  const { name, calories, proteinG, fatG, carbsG } = withKcal;
  const db = getDb();
  await db.insert(mealLogs).values({
    userId: session.user.id,
    date,
    name: name?.length ? name : null,
    calories,
    proteinG,
    fatG,
    carbsG,
  });

  revalidatePath("/");
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
  });

  if (!parsed.success) {
    return { error: "Sprawdź poprawność danych." };
  }

  const { id, date, ...macroRest } = parsed.data;
  const withKcal = finalizeMealMacros(macroRest);
  const check = validateMealMacros(withKcal);
  if (!check.ok) return { error: check.error };

  const { name, calories, proteinG, fatG, carbsG } = withKcal;
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
  return { ok: true };
}

/** Usuwanie wpisu — do `<form action={deleteMealLogFormAction}>`. */
export async function deleteMealLogFormAction(formData: FormData) {
  await deleteMealLogCore(formData);
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
  return { ok: true };
}
