"use server";

import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { activityLevels } from "@/lib/validations/register";

const bodyParamsSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  weightKg: z.coerce.number().min(30).max(400),
  heightCm: z.coerce.number().int().min(100).max(250),
  age: z.coerce.number().int().min(13).max(120),
  activityLevel: z.enum(activityLevels),
});

export async function updateBodyParamsFormAction(formData: FormData) {
  const input = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    weightKg: formData.get("weightKg"),
    heightCm: formData.get("heightCm"),
    age: formData.get("age"),
    activityLevel: formData.get("activityLevel"),
  };
  return updateBodyParams(input);
}

export async function updateBodyParamsFormActionVoid(formData: FormData): Promise<void> {
  await updateBodyParamsFormAction(formData);
}

export async function updateBodyParams(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  const parsed = bodyParamsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid form data" };
  }

  const db = getDb();
  const data = parsed.data;
  const displayName = `${data.firstName} ${data.lastName}`.trim();

  await db
    .update(users)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      name: displayName,
      weightKg: Math.round(data.weightKg * 10) / 10,
      heightCm: data.heightCm,
      age: data.age,
      activityLevel: data.activityLevel,
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true as const };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function changePasswordFormAction(formData: FormData) {
  const input = {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  };
  return changePassword(input);
}

export async function changePasswordFormActionVoid(formData: FormData): Promise<void> {
  await changePasswordFormAction(formData);
}

export async function changePassword(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Unauthorized" };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid form data" };
  }

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row?.passwordHash) {
    return { ok: false as const, error: "Account has no password" };
  }

  const ok = await compare(parsed.data.currentPassword, row.passwordHash);
  if (!ok) return { ok: false as const, error: "Current password is incorrect" };

  const nextHash = await hash(parsed.data.newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: nextHash })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { ok: true as const };
}

