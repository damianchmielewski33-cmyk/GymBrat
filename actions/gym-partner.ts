"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userConsents } from "@/db/schema";
import { guardAction } from "@/lib/action-guard";
import { CURRENT_CONSENT_TEXT_VERSION } from "@/lib/consents-client";
import { isValidCoord } from "@/lib/gym-partner/geo";
import {
  clearPresence,
  listNearbyPartners,
  respondToRequest,
  sendRequest,
  setPresence,
} from "@/lib/gym-partner/presence";
import {
  GOALS,
  LEVELS,
  SEARCH_RADIUS_M,
  TIMES,
  type MyPresence,
  type NearbyPartner,
} from "@/lib/gym-partner/types";
import { isPremiumActive } from "@/lib/user-package";
import { UserMessages } from "@/lib/user-facing-errors";

export type GpResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const PREMIUM_MSG = "Mapa siłowni i partnerzy treningowi są dostępni w pakiecie Premium.";

/** Zalogowany użytkownik z aktywnym Premium; inaczej null + powód. */
async function requirePremiumUser(): Promise<
  { userId: string } | { error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: UserMessages.sessionExpired };
  if (!(await isPremiumActive(userId))) return { error: PREMIUM_MSG };
  return { userId };
}

async function recordConsent(userId: string, granted: boolean) {
  await getDb().insert(userConsents).values({
    userId,
    type: "gym_location",
    granted,
    textVersion: CURRENT_CONSENT_TEXT_VERSION,
    source: "gym_partner",
  });
}

const startSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  goal: z.enum(Object.keys(GOALS) as [keyof typeof GOALS]),
  level: z.enum(Object.keys(LEVELS) as [keyof typeof LEVELS]),
  preferredTime: z.enum(Object.keys(TIMES) as [keyof typeof TIMES]),
  durationHours: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  consent: z.literal(true),
});

/** Zgoda + włączenie widoczności. Zapisywana jest tylko pozycja zaokrąglona do ~500 m. */
export async function startSharingAction(
  input: unknown,
): Promise<GpResult<{ presence: MyPresence }>> {
  await guardAction("gym-partner.startSharingAction", { limit: 20, windowMs: 10 * 60_000 });
  const gate = await requirePremiumUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { userId } = gate;
  const parsed = startSchema.safeParse(input);
  if (!parsed.success || !isValidCoord(parsed.data.lat, parsed.data.lng)) {
    return { ok: false, error: "Nieprawidłowe dane. Zaznacz zgodę i spróbuj ponownie." };
  }
  await recordConsent(userId, true);
  const presence = await setPresence(userId, parsed.data);
  revalidatePath("/community/map");
  return { ok: true, presence };
}

export async function stopSharingAction(): Promise<GpResult> {
  await guardAction("gym-partner.stopSharingAction");
  const gate = await requirePremiumUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { userId } = gate;
  await clearPresence(userId);
  await recordConsent(userId, false);
  revalidatePath("/community/map");
  return { ok: true };
}

const nearbySchema = z.object({ lat: z.number(), lng: z.number() });

/** Pozycja przeglądającego służy tylko do zapytania i nie jest zapisywana. */
export async function listNearbyPartnersAction(
  input: unknown,
): Promise<GpResult<{ partners: NearbyPartner[] }>> {
  await guardAction("gym-partner.listNearbyPartnersAction", { limit: 60, windowMs: 10 * 60_000 });
  const gate = await requirePremiumUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { userId } = gate;
  const parsed = nearbySchema.safeParse(input);
  if (!parsed.success || !isValidCoord(parsed.data.lat, parsed.data.lng)) {
    return { ok: false, error: "Nieprawidłowa lokalizacja." };
  }
  const partners = await listNearbyPartners(userId, parsed.data, SEARCH_RADIUS_M);
  return { ok: true, partners };
}

const idSchema = z.string().min(1).max(64);

export async function sendPartnerRequestAction(toUserId: unknown): Promise<GpResult> {
  await guardAction("gym-partner.sendPartnerRequestAction", { limit: 20, windowMs: 60 * 60_000 });
  const gate = await requirePremiumUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { userId } = gate;
  const id = idSchema.safeParse(toUserId);
  if (!id.success) return { ok: false, error: "Nieprawidłowy użytkownik." };
  const res = await sendRequest(userId, id.data);
  return res.ok ? { ok: true } : res;
}

export async function respondPartnerRequestAction(
  requestId: unknown,
  accept: unknown,
): Promise<GpResult> {
  await guardAction("gym-partner.respondPartnerRequestAction");
  const gate = await requirePremiumUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  const { userId } = gate;
  const id = idSchema.safeParse(requestId);
  if (!id.success || typeof accept !== "boolean") {
    return { ok: false, error: "Nieprawidłowe zaproszenie." };
  }
  const res = await respondToRequest(userId, id.data, accept);
  if (res.ok) {
    revalidatePath("/community/map");
    revalidatePath("/community/friends");
  }
  return res.ok ? { ok: true } : res;
}
