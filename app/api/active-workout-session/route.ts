import { withApiErrors } from "@/lib/errors/api";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { activeWorkoutSessions } from "@/db/schema";
import {
  ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD,
  hasActiveLocalSession,
  isActiveWorkoutCloudFresh,
  isActiveWorkoutCloudPayload,
  type ActiveWorkoutCloudPayload,
} from "@/lib/active-workout-cloud";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, RATE, rateLimitKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

async function ready() {
  await ensureCriticalSchema();
}

function parsePayloadJson(raw: string): ActiveWorkoutCloudPayload | null {
  try {
    const o = JSON.parse(raw) as unknown;
    return isActiveWorkoutCloudPayload(o) ? o : null;
  } catch {
    return null;
  }
}

/**
 * Wygasza wiersz sesji aktywnego treningu dla danego użytkownika: nadpisuje payload
 * wygaszonym stanem i inkrementuje rewizję (005, B-1b — rewizja nigdy nie wraca do zera,
 * ADR 0004 p.12). Wiersz NIE jest fizycznie usuwany — `userId` jest kluczem głównym tej
 * tabeli, więc nadpisanie w miejscu nie zwiększa liczby wierszy. Współdzielona przez
 * `handleDELETE` i (wyłącznie dla faktycznie przeterminowanej, aktywnej sesji) `handleGET`
 * — patrz ADR 0004 p.13.3 krok 7, naprawa B-1d.
 */
async function clearRow(
  db: ReturnType<typeof getDb>,
  userId: string,
  currentRevision: number,
): Promise<number> {
  const nextRevision = currentRevision + 1;
  await db
    .update(activeWorkoutSessions)
    .set({
      payloadJson: JSON.stringify(ACTIVE_WORKOUT_CLOUD_CLEARED_PAYLOAD),
      revision: nextRevision,
      updatedAt: new Date(),
    })
    .where(eq(activeWorkoutSessions.userId, userId));
  return nextRevision;
}

async function handleGET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }
  const rl = await checkRateLimitAsync(
    rateLimitKey("active-workout-get", req),
    RATE.activeWorkoutSession.limit,
    RATE.activeWorkoutSession.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele zapytań." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  await ready();
  const db = getDb();
  const [row] = await db
    .select()
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, session.user.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ ok: true, session: null });
  }
  const payload = parsePayloadJson(row.payloadJson);
  const updatedAt =
    row.updatedAt instanceof Date
      ? row.updatedAt.getTime()
      : Number(row.updatedAt);

  if (!payload) {
    // Wiersz uszkodzony/nieparsowalny — wygaś i zgłoś jako brak sesji.
    await clearRow(db, session.user.id, row.revision);
    return NextResponse.json({ ok: true, session: null });
  }

  if (!hasActiveLocalSession(payload)) {
    // Już wygaszony (poprzedni DELETE/GET) — czysty odczyt, BEZ mutacji, BEZ bumpa
    // rewizji (005, B-1d: odczyt nie może być operacją z efektem ubocznym; wygaszanie
    // już wygaszonego wiersza przy każdym GET psuło monotoniczność rewizji w sposób,
    // który kasował świeżo zapisywane sesje — patrz ADR 0004 p.13.2).
    return NextResponse.json({ ok: true, session: null });
  }

  if (!isActiveWorkoutCloudFresh(updatedAt)) {
    // Prawdziwy ghost: aktywny payload, ale przeterminowany (nieudany DELETE
    // w przeszłości) — to jest jedyny przypadek, w którym GET ma prawo mutować
    // (oryginalny cel tej gałęzi, zachowany z ADR 0004 p.12).
    await clearRow(db, session.user.id, row.revision);
    return NextResponse.json({ ok: true, session: null });
  }

  return NextResponse.json({
    ok: true,
    session: {
      payload,
      revision: row.revision,
      deviceId: row.deviceId,
      updatedAt,
    },
  });
}

const putSchema = z.object({
  payload: z.unknown(),
  revision: z.number().int().min(0),
  deviceId: z.string().min(8).max(80),
});

async function handlePUT(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }
  const rl = await checkRateLimitAsync(
    rateLimitKey("active-workout-put", req),
    RATE.activeWorkoutSession.limit,
    RATE.activeWorkoutSession.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele zapytań." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON." }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success || !isActiveWorkoutCloudPayload(parsed.data.payload)) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy payload." }, { status: 400 });
  }
  if (!hasActiveLocalSession(parsed.data.payload)) {
    return NextResponse.json(
      { ok: false, error: "Pusta sesja — użyj DELETE." },
      { status: 400 },
    );
  }

  await ready();
  const db = getDb();
  const userId = session.user.id;
  const [existing] = await db
    .select()
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);

  const clientRevision = parsed.data.revision;
  const serverRevision = existing?.revision ?? 0;

  if (existing && clientRevision < serverRevision) {
    const payload = parsePayloadJson(existing.payloadJson);
    return NextResponse.json(
      {
        ok: false,
        conflict: true,
        session: payload
          ? {
              payload,
              revision: existing.revision,
              deviceId: existing.deviceId,
              updatedAt:
                existing.updatedAt instanceof Date
                  ? existing.updatedAt.getTime()
                  : Number(existing.updatedAt),
            }
          : null,
      },
      { status: 409 },
    );
  }

  const nextRevision = Math.max(serverRevision, clientRevision) + 1;
  const now = new Date();
  const payloadJson = JSON.stringify(parsed.data.payload);

  if (existing) {
    await db
      .update(activeWorkoutSessions)
      .set({
        payloadJson,
        revision: nextRevision,
        deviceId: parsed.data.deviceId,
        updatedAt: now,
      })
      .where(eq(activeWorkoutSessions.userId, userId));
  } else {
    await db.insert(activeWorkoutSessions).values({
      userId,
      payloadJson,
      revision: nextRevision,
      deviceId: parsed.data.deviceId,
      updatedAt: now,
    });
  }

  return NextResponse.json({
    ok: true,
    revision: nextRevision,
    updatedAt: now.getTime(),
  });
}

async function handleDELETE(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }
  const rl = await checkRateLimitAsync(
    rateLimitKey("active-workout-del", req),
    RATE.activeWorkoutSession.limit,
    RATE.activeWorkoutSession.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele zapytań." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  await ready();
  const db = getDb();
  const userId = session.user.id;

  const [existing] = await db
    .select({ revision: activeWorkoutSessions.revision })
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);

  // Brak wiersza — nic do wygaszenia; kolejny PUT i tak zacznie od rewizji 1 (brak historii do chronienia).
  if (!existing) {
    return NextResponse.json({ ok: true, revision: 0 });
  }

  // Rewizja NIGDY nie wraca do zera po "usunięciu" (005, B-1b) — inkrementacja, nie reset,
  // żeby żaden zaległy klient z niższą-lub-równą rewizją nie mógł już nadpisać nowej sesji.
  // Wiersz nie jest fizycznie usuwany — nadpisujemy go wygaszonym payloadem przez `clearRow`,
  // bo `userId` jest kluczem głównym tej tabeli i tak czy inaczej nie rośnie liczba wierszy.
  const nextRevision = await clearRow(db, userId, existing.revision);

  return NextResponse.json({ ok: true, revision: nextRevision });
}

export const GET = withApiErrors(handleGET);
export const PUT = withApiErrors(handlePUT);
export const DELETE = withApiErrors(handleDELETE);
