"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { saveStartPhotoDataUrl } from "@/lib/start-photo";

function revalidateStartPhotoPaths() {
  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath("/progress-analysis");
}

/** Zapis zdjęcia startowego (data URL JPEG) z galerii. */
export async function saveStartPhotoAction(dataUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sesja wygasła." };
  }

  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:image/")) {
    return { ok: false as const, error: "To nie jest poprawne zdjęcie." };
  }
  if (trimmed.length > 1_800_000) {
    return { ok: false as const, error: "Zdjęcie jest za duże." };
  }

  await saveStartPhotoDataUrl(session.user.id, trimmed);
  revalidateStartPhotoPaths();
  return { ok: true as const };
}

export async function clearStartPhotoAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "Sesja wygasła." };
  }

  await saveStartPhotoDataUrl(session.user.id, null);
  revalidateStartPhotoPaths();
  return { ok: true as const };
}
