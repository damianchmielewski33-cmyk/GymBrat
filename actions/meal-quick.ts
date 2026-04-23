"use server";

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureMealLogsTableOncePerProcess } from "@/db/ensure-schema";
import { mealLogs, userSettings } from "@/db/schema";
import {
  parseMealTemplatesJson,
  serializeMealTemplates,
  type MealTemplate,
} from "@/lib/meal-templates";

export async function repeatLastMealAction(date: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false as const, error: "Nieprawidłowa data." };
  }

  await ensureMealLogsTableOncePerProcess();
  const db = getDb();
  const [last] = await db
    .select()
    .from(mealLogs)
    .where(eq(mealLogs.userId, session.user.id))
    .orderBy(desc(mealLogs.createdAt))
    .limit(1);

  if (!last) {
    return { ok: false as const, error: "Brak wcześniejszych posiłków do powtórzenia." };
  }

  await db.insert(mealLogs).values({
    id: randomUUID(),
    userId: session.user.id,
    date,
    name: last.name,
    calories: last.calories,
    proteinG: last.proteinG,
    fatG: last.fatG,
    carbsG: last.carbsG,
  });

  revalidatePath("/");
  return { ok: true as const };
}

export async function addMealFromTemplateAction(date: string, templateId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false as const, error: "Nieprawidłowa data." };
  }

  const db = getDb();
  const [row] = await db
    .select({ mealTemplatesJson: userSettings.mealTemplatesJson })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  const templates = parseMealTemplatesJson(row?.mealTemplatesJson ?? null);
  const t = templates.find((x) => x.id === templateId);
  if (!t) return { ok: false as const, error: "Nie znaleziono szablonu." };

  await ensureMealLogsTableOncePerProcess();
  await db.insert(mealLogs).values({
    id: randomUUID(),
    userId: session.user.id,
    date,
    name: t.name,
    calories: t.calories,
    proteinG: t.proteinG,
    fatG: t.fatG,
    carbsG: t.carbsG,
  });

  revalidatePath("/");
  return { ok: true as const };
}

export async function saveMealTemplateAction(template: Omit<MealTemplate, "id"> & { id?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const entry: MealTemplate = {
    id: template.id?.trim() || randomUUID(),
    name: template.name.trim(),
    calories: template.calories,
    proteinG: template.proteinG,
    fatG: template.fatG,
    carbsG: template.carbsG,
  };

  const db = getDb();
  const [row] = await db
    .select({ mealTemplatesJson: userSettings.mealTemplatesJson })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  const existing = parseMealTemplatesJson(row?.mealTemplatesJson ?? null);
  const without = existing.filter((x) => x.id !== entry.id);
  const next = [entry, ...without].slice(0, 24);
  const json = serializeMealTemplates(next);

  await db
    .update(userSettings)
    .set({
      mealTemplatesJson: json,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}
