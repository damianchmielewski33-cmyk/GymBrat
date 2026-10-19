"use server";

import { auth } from "@/auth";
import { prestigeUp } from "@/lib/community/progression";

export async function prestigeUpAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Zaloguj się." };
  return prestigeUp(userId);
}
