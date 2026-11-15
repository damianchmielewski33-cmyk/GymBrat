import { and, eq, gt, gte, lte, ne, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  friendships,
  gymPartnerPresence,
  gymPartnerRequests,
  users,
} from "@/db/schema";
import { canonicalPair } from "@/lib/community/friend-types";
import {
  boundingBox,
  fuzzLocation,
  haversineMeters,
  roundedDistanceKm,
} from "@/lib/gym-partner/geo";
import type {
  Goal,
  IncomingRequest,
  Level,
  MyPresence,
  NearbyPartner,
  PreferredTime,
} from "@/lib/gym-partner/types";

export const MAX_PENDING_OUT = 10;

/** Pseudonim: tylko imię (bez nazwiska i e-maila). */
export function publicName(u: {
  firstName: string | null;
  name: string | null;
}): string {
  const first = u.firstName?.trim() || u.name?.trim().split(/\s+/)[0];
  return first || "Zawodnik";
}

export async function setPresence(
  userId: string,
  input: {
    lat: number;
    lng: number;
    goal: Goal;
    level: Level;
    preferredTime: PreferredTime;
    durationHours: number;
  },
): Promise<MyPresence> {
  await ensureCriticalSchema();
  const db = getDb();
  // Minimalizacja danych: wygasłe pozycje usuwamy przy okazji (oraz w cronie cleanup).
  await purgeExpiredPresence();
  const pos = fuzzLocation(input.lat, input.lng);
  const expiresAt = new Date(Date.now() + input.durationHours * 3_600_000);
  const row = {
    ...pos,
    goal: input.goal,
    level: input.level,
    preferredTime: input.preferredTime,
    expiresAt,
    updatedAt: new Date(),
  };
  await db
    .insert(gymPartnerPresence)
    .values({ userId, ...row })
    .onConflictDoUpdate({ target: gymPartnerPresence.userId, set: row });
  return {
    goal: input.goal,
    level: input.level,
    preferredTime: input.preferredTime,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function clearPresence(userId: string): Promise<void> {
  await ensureCriticalSchema();
  await getDb().delete(gymPartnerPresence).where(eq(gymPartnerPresence.userId, userId));
}

export async function getMyPresence(userId: string): Promise<MyPresence | null> {
  await ensureCriticalSchema();
  const [row] = await getDb()
    .select()
    .from(gymPartnerPresence)
    .where(
      and(eq(gymPartnerPresence.userId, userId), gt(gymPartnerPresence.expiresAt, new Date())),
    )
    .limit(1);
  if (!row) return null;
  return {
    goal: row.goal as Goal,
    level: row.level as Level,
    preferredTime: row.preferredTime as PreferredTime,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function listNearbyPartners(
  userId: string,
  center: { lat: number; lng: number },
  radiusMeters: number,
): Promise<NearbyPartner[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const box = boundingBox(center, radiusMeters);
  const rows = await db
    .select({
      userId: gymPartnerPresence.userId,
      lat: gymPartnerPresence.lat,
      lng: gymPartnerPresence.lng,
      goal: gymPartnerPresence.goal,
      level: gymPartnerPresence.level,
      preferredTime: gymPartnerPresence.preferredTime,
      firstName: users.firstName,
      name: users.name,
    })
    .from(gymPartnerPresence)
    .innerJoin(users, eq(users.id, gymPartnerPresence.userId))
    .where(
      and(
        gt(gymPartnerPresence.expiresAt, new Date()),
        ne(gymPartnerPresence.userId, userId),
        gte(gymPartnerPresence.lat, box.minLat),
        lte(gymPartnerPresence.lat, box.maxLat),
        gte(gymPartnerPresence.lng, box.minLng),
        lte(gymPartnerPresence.lng, box.maxLng),
      ),
    )
    .limit(200);

  const near = rows
    .map((r) => ({ r, d: haversineMeters(center, r) }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d)
    .slice(0, 50);
  if (near.length === 0) return [];

  const sent = await db
    .select({ toUserId: gymPartnerRequests.toUserId, status: gymPartnerRequests.status })
    .from(gymPartnerRequests)
    .where(
      and(
        eq(gymPartnerRequests.fromUserId, userId),
        inArray(gymPartnerRequests.toUserId, near.map((x) => x.r.userId)),
      ),
    );
  const statusByUser = new Map(sent.map((s) => [s.toUserId, s.status]));

  return near.map(({ r, d }) => ({
    userId: r.userId,
    name: publicName(r),
    goal: r.goal as Goal,
    level: r.level as Level,
    preferredTime: r.preferredTime as PreferredTime,
    lat: r.lat,
    lng: r.lng,
    distanceKm: roundedDistanceKm(d),
    requestStatus: (statusByUser.get(r.userId) ?? "none") as NearbyPartner["requestStatus"],
  }));
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendRequest(fromUserId: string, toUserId: string): Promise<SendResult> {
  await ensureCriticalSchema();
  const db = getDb();
  if (fromUserId === toUserId) return { ok: false, error: "Nie możesz zaprosić samego siebie." };
  const [target] = await db
    .select({ userId: gymPartnerPresence.userId })
    .from(gymPartnerPresence)
    .where(
      and(eq(gymPartnerPresence.userId, toUserId), gt(gymPartnerPresence.expiresAt, new Date())),
    )
    .limit(1);
  if (!target) return { ok: false, error: "Ta osoba już nie szuka partnera." };

  const pending = await db
    .select({ id: gymPartnerRequests.id })
    .from(gymPartnerRequests)
    .where(
      and(eq(gymPartnerRequests.fromUserId, fromUserId), eq(gymPartnerRequests.status, "pending")),
    );
  if (pending.length >= MAX_PENDING_OUT) {
    return { ok: false, error: "Masz zbyt wiele oczekujących zaproszeń. Poczekaj na odpowiedzi." };
  }
  // Brak ponowienia po odrzuceniu (ochrona przed nękaniem): unikalny indeks pary.
  const inserted = await db
    .insert(gymPartnerRequests)
    .values({ fromUserId, toUserId })
    .onConflictDoNothing()
    .returning({ id: gymPartnerRequests.id });
  if (inserted.length === 0) {
    return { ok: false, error: "Zaproszenie do tej osoby już zostało wysłane." };
  }
  return { ok: true };
}

export async function listIncoming(userId: string): Promise<IncomingRequest[]> {
  await ensureCriticalSchema();
  const rows = await getDb()
    .select({
      id: gymPartnerRequests.id,
      fromUserId: gymPartnerRequests.fromUserId,
      createdAt: gymPartnerRequests.createdAt,
      firstName: users.firstName,
      name: users.name,
    })
    .from(gymPartnerRequests)
    .innerJoin(users, eq(users.id, gymPartnerRequests.fromUserId))
    .where(and(eq(gymPartnerRequests.toUserId, userId), eq(gymPartnerRequests.status, "pending")))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    name: publicName(r),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Akceptacja tworzy znajomość (kontakt przez istniejące Community → Znajomi). */
export async function respondToRequest(
  userId: string,
  requestId: string,
  accept: boolean,
): Promise<SendResult> {
  await ensureCriticalSchema();
  const db = getDb();
  const [req] = await db
    .select()
    .from(gymPartnerRequests)
    .where(
      and(
        eq(gymPartnerRequests.id, requestId),
        eq(gymPartnerRequests.toUserId, userId),
        eq(gymPartnerRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (!req) return { ok: false, error: "Nie znaleziono zaproszenia." };
  const now = new Date();
  await db
    .update(gymPartnerRequests)
    .set({ status: accept ? "accepted" : "declined", respondedAt: now })
    .where(eq(gymPartnerRequests.id, requestId));
  if (accept) {
    const pair = canonicalPair(req.fromUserId, req.toUserId);
    await db
      .insert(friendships)
      .values({
        ...pair,
        status: "accepted",
        requestedBy: req.fromUserId,
        respondedAt: now,
      })
      .onConflictDoUpdate({
        target: [friendships.userAId, friendships.userBId],
        set: { status: "accepted", respondedAt: now, updatedAt: now },
      });
  }
  return { ok: true };
}

/** Sprzątanie wygasłych pozycji (cron / okazjonalnie). */
export async function purgeExpiredPresence(): Promise<void> {
  await ensureCriticalSchema();
  await getDb()
    .delete(gymPartnerPresence)
    .where(lte(gymPartnerPresence.expiresAt, new Date()));
}
