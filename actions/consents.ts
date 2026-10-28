"use server";

import { guardAction } from "@/lib/action-guard";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userConsents } from "@/db/schema";
import {
  CURRENT_CONSENT_TEXT_VERSION,
  isConsentSource,
  isConsentType,
  type ConsentSource,
  type ConsentType,
} from "@/lib/consents";
import { UserMessages } from "@/lib/user-facing-errors";

export type ConsentSaveResult =
  | { ok: true; savedAt: string }
  | { ok: false; error: string };

/** Append-only INSERT — nigdy UPDATE (ADR 0006 §9). */
export async function saveConsentAction(
  type: ConsentType,
  _prev: ConsentSaveResult | null,
  formData: FormData,
): Promise<ConsentSaveResult> {
  await guardAction("consents.saveConsentAction");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: UserMessages.sessionExpired };
  }
  if (!isConsentType(type)) {
    return { ok: false, error: "Nieznany typ zgody." };
  }

  const grantedRaw = String(formData.get("granted") ?? "");
  const granted = grantedRaw === "1" || grantedRaw === "true";
  const sourceRaw = String(formData.get("source") ?? "profile");
  const source: ConsentSource = isConsentSource(sourceRaw)
    ? sourceRaw
    : "profile";
  const textVersion =
    String(formData.get("textVersion") ?? "").trim() ||
    CURRENT_CONSENT_TEXT_VERSION;

  const db = getDb();
  const decidedAt = new Date();
  await db.insert(userConsents).values({
    userId: session.user.id,
    type,
    granted,
    textVersion,
    source,
    decidedAt,
  });

  revalidatePath("/profile");
  revalidatePath("/profile/account");
  return { ok: true, savedAt: decidedAt.toISOString() };
}

/** Zapis obu typów naraz (np. „Akceptuj wszystkie” / „Tylko niezbędne”). */
export async function saveConsentsBulkAction(
  input: {
    analytics: boolean;
    marketing: boolean;
    source?: ConsentSource;
  },
): Promise<ConsentSaveResult> {
  await guardAction("consents.saveConsentsBulkAction");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: UserMessages.sessionExpired };
  }

  const db = getDb();
  const decidedAt = new Date();
  const source = input.source ?? "profile";
  await db.insert(userConsents).values([
    {
      userId: session.user.id,
      type: "analytics",
      granted: input.analytics,
      textVersion: CURRENT_CONSENT_TEXT_VERSION,
      source,
      decidedAt,
    },
    {
      userId: session.user.id,
      type: "marketing",
      granted: input.marketing,
      textVersion: CURRENT_CONSENT_TEXT_VERSION,
      source,
      decidedAt,
    },
  ]);

  revalidatePath("/profile");
  revalidatePath("/profile/account");
  return { ok: true, savedAt: decidedAt.toISOString() };
}
