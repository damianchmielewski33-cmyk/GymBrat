"use server";

import { guardAction } from "@/lib/action-guard";
import { auth } from "@/auth";
import { prestigeUp } from "@/lib/community/progression";

export async function prestigeUpAction() {
  await guardAction("community-progression.prestigeUpAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Zaloguj się." };
  return prestigeUp(userId);
}
