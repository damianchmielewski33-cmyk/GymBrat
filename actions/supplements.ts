"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import { setIntakes } from "@/lib/supplement-intake";

/** Odhacza / cofa przyjęcie suplementu na dziś. Nazwa i slot muszą istnieć na liście użytkownika. */
export async function setSupplementTakenAction(
  name: string,
  slot: string,
  taken: boolean,
) {
  await guardAction("supplements.setSupplementTakenAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Brak sesji." };

  const n = await setIntakes(userId, [{ name, slot }], taken);
  if (n === 0) return { ok: false as const, error: "Nie ma takiego suplementu." };
  revalidatePath("/");
  return { ok: true as const };
}
