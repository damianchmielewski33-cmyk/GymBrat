"use server";

import { auth } from "@/auth";
import { loadExerciseTechniqueUrlMap } from "@/lib/exercise-technique-store";
import { resolveTechniqueUrlForName } from "@/lib/attach-technique-urls";

/** Mapa catalogId → YouTube URL (dla zalogowanych — sesja treningu). */
export async function getExerciseTechniqueUrlMap(): Promise<Record<string, string>> {
  const session = await auth();
  if (!session?.user?.id) return {};
  return loadExerciseTechniqueUrlMap();
}

/** Jednorazowe rozwiązanie URL dla listy nazw ćwiczeń. */
export async function resolveTechniqueUrlsForNames(
  names: string[],
): Promise<Record<string, string>> {
  const session = await auth();
  if (!session?.user?.id) return {};
  const map = await loadExerciseTechniqueUrlMap();
  const out: Record<string, string> = {};
  for (const name of names) {
    const url = resolveTechniqueUrlForName(name, map);
    if (url) out[name] = url;
  }
  return out;
}
