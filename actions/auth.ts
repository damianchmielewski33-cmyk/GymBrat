"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validations/register";

export type RegisterState =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof RegisterInput, string[]>> };

export async function registerUser(
  input: unknown,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Partial<
      Record<keyof RegisterInput, string[]>
    >;
    return {
      ok: false,
      error: "Invalid form data.",
      fieldErrors,
    };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await hash(data.password, 12);
  const userId = crypto.randomUUID();
  const displayName = `${data.firstName} ${data.lastName}`.trim();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name: displayName,
    firstName: data.firstName,
    lastName: data.lastName,
    weightKg: data.weightKg,
    heightCm: data.heightCm,
    age: data.age,
    activityLevel: data.activityLevel,
    appRole: data.role,
  });
  await db.insert(userSettings).values({
    userId,
    weeklyCardioGoalMinutes: 150,
  });

  return { ok: true };
}
