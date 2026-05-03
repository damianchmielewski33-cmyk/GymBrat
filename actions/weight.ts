"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { weightLogs } from "@/db/schema";

export async function logWeighInFormAction(formData: FormData) {
  const kg = Number(formData.get("weightKg") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  return logWeighIn({ weightKg: kg, notes: notes || undefined });
}

export async function logWeighIn(input: { weightKg: number; notes?: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie, aby zapisać wagę.",
    };
  }

  const kg = Number(input.weightKg);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 600) {
    return {
      ok: false as const,
      error: "Podaj wagę w zakresie 1–600 kg (liczba z kropką lub przecinkiem).",
    };
  }

  const db = getDb();
  await db.insert(weightLogs).values({
    userId: session.user.id,
    weightKg: Math.round(kg * 10) / 10,
    notes: input.notes ?? null,
    recordedAt: new Date(),
  });

  revalidatePath("/progress-analysis");
  return { ok: true as const };
}

export async function getRecentWeightLogs(userId: string, limit = 90) {
  const db = getDb();
  return db
    .select()
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(desc(weightLogs.recordedAt))
    .limit(limit);
}

