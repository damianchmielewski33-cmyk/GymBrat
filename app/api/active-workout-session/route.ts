import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { activeWorkoutSessions } from "@/db/schema";
import {
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

export async function GET(req: Request) {
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

  if (
    !payload ||
    !hasActiveLocalSession(payload) ||
    !isActiveWorkoutCloudFresh(updatedAt)
  ) {
    // Duch po nieudanym DELETE / przeterminowana sesja — nie wznawiaj.
    await db
      .delete(activeWorkoutSessions)
      .where(eq(activeWorkoutSessions.userId, session.user.id));
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

export async function PUT(req: Request) {
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

export async function DELETE(req: Request) {
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
  await db
    .delete(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, session.user.id));

  return NextResponse.json({ ok: true });
}
