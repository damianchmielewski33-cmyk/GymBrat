"use server";

import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import { loadProgressPhotoMetrics } from "@/lib/progress-metrics/photos";

export async function revealProgressPhotosAction() {
  await guardAction("progress.revealPhotos");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Sesja wygasła." };
  try {
    return { ok: true as const, data: await loadProgressPhotoMetrics(userId) };
  } catch (error) {
    console.error("[progress-photos]", error instanceof Error ? error.message : error);
    return { ok: false as const, error: "Nie udało się wczytać zdjęć." };
  }
}
