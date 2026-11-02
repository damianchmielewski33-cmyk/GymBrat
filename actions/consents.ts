"use server";

import { guardAction } from "@/lib/action-guard";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userConsents } from "@/db/schema";
import {
  CURRENT_CONSENT_TEXT_VERSION,
  getCurrentConsents,
  isConsentSource,
  isConsentType,
  type ConsentSource,
  type ConsentType,
} from "@/lib/consents";
import {
  SENSITIVE_CONSENT_TEXT_VERSION,
  SENSITIVE_CONSENT_TYPES,
  type SensitiveConsentType,
} from "@/lib/consents-client";
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
    /**
     * Tylko typy bez żadnej decyzji w bazie (stary wybór z przeglądarki nie może nadpisać
     * cofnięcia zgody zrobionego na innym urządzeniu).
     */
    onlyIfUndecided?: boolean;
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
  // Bez zmiany (ta sama decyzja i wersja tekstu) nie dopisujemy wiersza — synchronizacja z banera
  // może być wołana wielokrotnie.
  const current = await getCurrentConsents(session.user.id);
  const wanted = [
    { type: "analytics" as const, granted: input.analytics },
    { type: "marketing" as const, granted: input.marketing },
  ].filter((w) => {
    const c = current[w.type];
    if (input.onlyIfUndecided) return !c;
    return !(c && c.granted === w.granted && c.textVersion === CURRENT_CONSENT_TEXT_VERSION);
  });
  if (wanted.length > 0) {
    await db.insert(userConsents).values(
      wanted.map((w) => ({
        userId: session.user.id,
        type: w.type,
        granted: w.granted,
        textVersion: CURRENT_CONSENT_TEXT_VERSION,
        source,
        decidedAt,
      })),
    );
  }

  revalidatePath("/profile");
  revalidatePath("/profile/account");
  return { ok: true, savedAt: decidedAt.toISOString() };
}

/**
 * Zgoda/cofnięcie zgody na dane o ciele (`health`) lub zdjęcia (`photos`) — Z11.
 * Append-only; treść zgody to szkic do zatwierdzenia przez prawnika (wersja `...-szkic-...`).
 */
export async function setSensitiveConsentAction(
  type: SensitiveConsentType,
  granted: boolean,
  source: ConsentSource = "profile",
): Promise<ConsentSaveResult> {
  await guardAction("consents.setSensitiveConsentAction");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: UserMessages.sessionExpired };
  }
  if (!(SENSITIVE_CONSENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Nieznany typ zgody." };
  }

  const db = getDb();
  const decidedAt = new Date();
  await db.insert(userConsents).values({
    userId: session.user.id,
    type,
    granted: Boolean(granted),
    textVersion: SENSITIVE_CONSENT_TEXT_VERSION,
    source: isConsentSource(source) ? source : "profile",
    decidedAt,
  });

  revalidatePath("/profile");
  revalidatePath("/profile/account");
  revalidatePath("/reports");
  return { ok: true, savedAt: decidedAt.toISOString() };
}
