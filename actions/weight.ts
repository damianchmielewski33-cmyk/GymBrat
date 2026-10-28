"use server";

import { guardAction } from "@/lib/action-guard";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users, weightLogs } from "@/db/schema";
import { WEIGHT_KG_MAX, WEIGHT_KG_MIN } from "@/lib/kcal-from-macros";

export async function logWeighInFormAction(formData: FormData) {
  await guardAction("weight.logWeighInFormAction");
  const kg = Number(formData.get("weightKg") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim();
  return logWeighIn({ weightKg: kg, notes: notes || undefined });
}

export async function logWeighIn(input: { weightKg: number; notes?: string }) {
  await guardAction("weight.logWeighIn");
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      error: "Sesja wygasła. Zaloguj się ponownie, aby zapisać wagę.",
    };
  }

  const kg = Number(input.weightKg);
  if (
    !Number.isFinite(kg) ||
    kg < WEIGHT_KG_MIN ||
    kg > WEIGHT_KG_MAX
  ) {
    return {
      ok: false as const,
      error: `Podaj wagę w zakresie ${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX} kg (liczba z kropką lub przecinkiem).`,
    };
  }

  const db = getDb();
  const weightKg = Math.round(kg * 10) / 10;
  await db.insert(weightLogs).values({
    userId: session.user.id,
    weightKg,
    notes: input.notes ?? null,
    recordedAt: new Date(),
  });
  // Write-through cache (ADR 0006 §2).
  await db
    .update(users)
    .set({ weightKg })
    .where(eq(users.id, session.user.id));

  revalidatePath("/progress");
  revalidatePath("/progress-analysis");
  revalidatePath("/profile");
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

