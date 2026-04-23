"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { fitnessGoalsToJson } from "@/lib/fitness-goals";

export async function completeOnboardingAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const raw = input as { weeklySessions?: unknown; skipFitatu?: unknown };
  const weekly =
    typeof raw.weeklySessions === "number" && Number.isFinite(raw.weeklySessions)
      ? Math.round(raw.weeklySessions)
      : null;

  const goals =
    weekly != null && weekly >= 1 && weekly <= 14
      ? fitnessGoalsToJson({ weeklySessionsTarget: weekly })
      : null;

  const db = getDb();
  await db
    .update(userSettings)
    .set({
      ...(goals != null ? { fitnessGoalsJson: goals } : {}),
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function dismissOnboardingAction() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const db = getDb();
  await db
    .update(userSettings)
    .set({
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

  revalidatePath("/");
  return { ok: true as const };
}
