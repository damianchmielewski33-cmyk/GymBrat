import { withApiErrors } from "@/lib/errors/api";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { activeWorkoutSessions } from "@/db/schema";
import {
  buildActiveWorkoutClearedPayload,
  hasActiveLocalSession,
  isActiveWorkoutCloudFresh,
  isActiveWorkoutCloudPayload,
  resolveClearedSessionIdentity,
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
 * Wygasza wiersz sesji aktywnego treningu dla danego użytkownika CAS-owo (005, N-P13-8,
 * ADR 0004 p.17): `UPDATE` jest warunkowany `revision = currentRevision` — rewizją, którą
 * WYWOŁUJĄCY WŁAŚNIE odczytał w tym samym żądaniu, nigdy deklaracją klienta. Jeśli między
 * tamtym SELECT a tym UPDATE ktoś inny zapisał wiersz (rewizja już inna), `RETURNING` nie
 * zwraca wiersza — funkcja zwraca `null` (PRZEGRANA wyścigu), zamiast fałszywie zwracać
 * `nextRevision`, którego wiersz NIE przyjął. Wiersz NIE jest fizycznie usuwany — `userId`
 * jest kluczem głównym tej tabeli, więc nadpisanie w miejscu nie zwiększa liczby wierszy.
 * Współdzielona przez `handleDELETE` i (wyłącznie dla faktycznie przeterminowanej, aktywnej
 * sesji) `handleGET`/`evaluateActiveRow` — patrz ADR 0004 p.13.3 krok 7, naprawa B-1d.
 * `clearedSessionStartedAtMs` niesie tożsamość sesji, którą ten zapis wygasza (`null`, gdy nie
 * ma czyjej tożsamości do zapisania) — patrz ADR 0004 p.14, naprawa N-P13-1.
 */
async function clearRow(
  db: ReturnType<typeof getDb>,
  userId: string,
  currentRevision: number,
  clearedSessionStartedAtMs: number | null,
): Promise<number | null> {
  const nextRevision = currentRevision + 1;
  const updated = await db
    .update(activeWorkoutSessions)
    .set({
      payloadJson: JSON.stringify(buildActiveWorkoutClearedPayload(clearedSessionStartedAtMs)),
      revision: nextRevision,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(activeWorkoutSessions.userId, userId),
        eq(activeWorkoutSessions.revision, currentRevision),
      ),
    )
    .returning({ revision: activeWorkoutSessions.revision });
  return updated.length > 0 ? nextRevision : null;
}

type ActiveWorkoutSessionRow = {
  revision: number;
  payloadJson: string;
  deviceId: string;
  updatedAt: Date | number;
};

/**
 * Ocena wiersza aktywnej sesji dla `GET` (005, N-P13-8, ADR 0004 p.17.5): `GET` nie ma
 * kontraktu błędu do zwrócenia klientowi — ma tylko obowiązek zwrócić prawdziwy, aktualny
 * stan. Gdy opportunistyczne czyszczenie ducha (`clearRow`) przegra wyścig CAS, właściwa
 * odpowiedź nie jest błędem, jest ponownym odczytem i oceną od nowa (`retryFreshRead`),
 * z `allowClear: false` — głębokość retry ograniczona do 1, bez pętli (p.17.7).
 */
async function evaluateActiveRow(
  db: ReturnType<typeof getDb>,
  userId: string,
  row: ActiveWorkoutSessionRow,
  allowClear: boolean,
): Promise<Response> {
  const payload = parsePayloadJson(row.payloadJson);
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.getTime() : Number(row.updatedAt);

  if (!payload) {
    // Wiersz uszkodzony/nieparsowalny — wygaś i zgłoś jako brak sesji; nie ma tożsamości do zapisania.
    if (allowClear) {
      const next = await clearRow(db, userId, row.revision, resolveClearedSessionIdentity(null));
      if (next === null) return retryFreshRead(db, userId);
    }
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
    // (oryginalny cel tej gałęzi, zachowany z ADR 0004 p.12). Payload jest aktywny,
    // więc ma tożsamość do przeniesienia na tombstone (ADR 0004 p.14).
    if (allowClear) {
      // NOWE (005, N-P13-8): dotąd `clearRow` tutaj "wygrywał" zawsze, nawet gdy między
      // SELECT w `handleGET` i tym UPDATE ktoś zapisał FRESH, AKTYWNĄ sesję — ta świeża
      // sesja była wygaszana po cichu (utrata danych, sonda P4). Teraz: przegrana CAS →
      // odczyt świeży → ocena od nowa, bez kolejnej próby czyszczenia (`allowClear: false`).
      const next = await clearRow(db, userId, row.revision, resolveClearedSessionIdentity(payload));
      if (next === null) return retryFreshRead(db, userId);
    }
    return NextResponse.json({ ok: true, session: null });
  }

  return NextResponse.json({
    ok: true,
    session: { payload, revision: row.revision, deviceId: row.deviceId, updatedAt },
  });
}

async function retryFreshRead(db: ReturnType<typeof getDb>, userId: string): Promise<Response> {
  const [fresh] = await db
    .select()
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);
  if (!fresh) return NextResponse.json({ ok: true, session: null });
  return evaluateActiveRow(db, userId, fresh, false);
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

  return evaluateActiveRow(db, session.user.id, row, true);
}

/**
 * Odpowiedź 409 przy niezgodności rewizji (PUT i, od tej naprawy, DELETE) — jeden
 * kształt, jedno miejsce budowy, żeby nie duplikować mapowania wiersza na payload
 * odpowiedzi (005, N-P13-7, ADR p.16). `existing` to wiersz PRZED jakąkolwiek mutacją.
 */
function buildRevisionConflictResponse(existing: {
  revision: number;
  payloadJson: string;
  deviceId: string;
  updatedAt: Date | number;
}) {
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

/** Górny limit rewizji chroni przed self-DoS (F-7) — realny licznik rośnie o 1 na zapis. */
const REVISION_MAX = 1_000_000_000;

const putSchema = z.object({
  payload: z.unknown(),
  revision: z.number().int().min(0).max(REVISION_MAX),
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
    return buildRevisionConflictResponse(existing);
  }

  const nextRevision = Math.max(serverRevision, clientRevision) + 1;
  const now = new Date();
  const payloadJson = JSON.stringify(parsed.data.payload);

  if (existing) {
    const updated = await db
      .update(activeWorkoutSessions)
      .set({
        payloadJson,
        revision: nextRevision,
        deviceId: parsed.data.deviceId,
        updatedAt: now,
      })
      .where(
        and(
          eq(activeWorkoutSessions.userId, userId),
          eq(activeWorkoutSessions.revision, serverRevision),
        ),
      )
      .returning({ revision: activeWorkoutSessions.revision });

    if (updated.length === 0) {
      // PRZEGRANA wyścigu (005, N-P13-8, sonda P5): między naszym SELECT i tym UPDATE
      // ktoś inny zapisał ten wiersz. Dotąd ten UPDATE nie miał `revision` w `WHERE`,
      // więc zawsze trafiał — nadpisując cudzy, nowszy zapis, mimo że `clientRevision
      // < serverRevision` już było false w chwili SELECT (fałszywe bezpieczeństwo).
      const [fresh] = await db
        .select()
        .from(activeWorkoutSessions)
        .where(eq(activeWorkoutSessions.userId, userId))
        .limit(1);
      if (!fresh) {
        return NextResponse.json({ ok: false, error: "Nieprawidłowy payload." }, { status: 400 });
      }
      return buildRevisionConflictResponse(fresh);
    }
  } else {
    try {
      await db.insert(activeWorkoutSessions).values({
        userId,
        payloadJson,
        revision: nextRevision,
        deviceId: parsed.data.deviceId,
        updatedAt: now,
      });
    } catch (err) {
      // NOWE (005, N-P13-8, trzecia, dotąd nienazwana luka): dwa równoczesne PIERWSZE
      // zapisy (oba widzą `existing === undefined`) — `userId` jest kluczem głównym
      // (`db/schema.ts`), więc drugi `INSERT` rzuca naruszenie unikalności, nie "wygrywa
      // cicho". Przechwytujemy i odpowiadamy jak przy każdej innej przegranej wyścigu —
      // NIGDY 500 za czyjś wyścig, który przegraliśmy.
      if (!isUniqueViolation(err)) throw err;
      const [fresh] = await db
        .select()
        .from(activeWorkoutSessions)
        .where(eq(activeWorkoutSessions.userId, userId))
        .limit(1);
      if (!fresh) throw err; // naruszenie unikalności implikuje istnienie wiersza — nieosiągalne
      return buildRevisionConflictResponse(fresh);
    }
  }

  return NextResponse.json({
    ok: true,
    revision: nextRevision,
    updatedAt: now.getTime(),
  });
}

const deleteSchema = z.object({ revision: z.number().int().min(0).max(REVISION_MAX) });

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON." }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy payload." }, { status: 400 });
  }

  await ready();
  const db = getDb();
  const userId = session.user.id;

  const [existing] = await db
    .select({
      revision: activeWorkoutSessions.revision,
      payloadJson: activeWorkoutSessions.payloadJson,
      deviceId: activeWorkoutSessions.deviceId,
      updatedAt: activeWorkoutSessions.updatedAt,
    })
    .from(activeWorkoutSessions)
    .where(eq(activeWorkoutSessions.userId, userId))
    .limit(1);

  // Brak wiersza — nic do wygaszenia; kolejny PUT i tak zacznie od rewizji 1 (brak historii do chronienia).
  if (!existing) {
    return NextResponse.json({ ok: true, revision: 0 });
  }

  // NOWE (005, N-P13-7): DELETE wymaga TEJ SAMEJ kontroli optymistycznej
  // współbieżności co PUT — klient, który nie widział aktualnej rewizji wiersza,
  // nie ma prawa go wygasić. Bez tego warunku dowolne, nieinformowane urządzenie
  // (świeża/pusta karta, zero wcześniejszego kontaktu z tym wierszem) mogło
  // skasować AKTYWNY trening innego urządzenia — patrz ADR 0004 p.16.1-16.2.
  if (parsed.data.revision < existing.revision) {
    return buildRevisionConflictResponse(existing);
  }

  // Rewizja NIGDY nie wraca do zera po "usunięciu" (005, B-1b) — inkrementacja, nie reset,
  // żeby żaden zaległy klient z niższą-lub-równą rewizją nie mógł już nadpisać nowej sesji.
  // Wiersz nie jest fizycznie usuwany — nadpisujemy go wygaszonym payloadem przez `clearRow`,
  // bo `userId` jest kluczem głównym tej tabeli i tak czy inaczej nie rośnie liczba wierszy.
  // Tożsamość wygaszanej sesji trzeba wyciągnąć PRZED nadpisaniem (ADR 0004 p.14, N-P13-1).
  const existingPayload = parsePayloadJson(existing.payloadJson);
  const clearedSessionStartedAtMs = resolveClearedSessionIdentity(existingPayload);
  const nextRevision = await clearRow(db, userId, existing.revision, clearedSessionStartedAtMs);

  if (nextRevision === null) {
    // PRZEGRANA wyścigu (005, N-P13-8): między naszym SELECT i tym UPDATE ktoś inny (inne
    // urządzenie, PUT albo DELETE równoległy) zapisał ten wiersz. `existing`, które mieliśmy,
    // jest NIEAKTUALNE — nie wolno budować odpowiedzi z niego (sonda P3: 409 na podstawie
    // przestarzałego stanu wyglądałby na poprawny, ale ukrywałby, że wiersz już wygląda
    // inaczej). Odczyt PONOWNY, świeży, autorytatywny w chwili odpowiedzi.
    const [fresh] = await db
      .select({
        revision: activeWorkoutSessions.revision,
        payloadJson: activeWorkoutSessions.payloadJson,
        deviceId: activeWorkoutSessions.deviceId,
        updatedAt: activeWorkoutSessions.updatedAt,
      })
      .from(activeWorkoutSessions)
      .where(eq(activeWorkoutSessions.userId, userId))
      .limit(1);
    // Wiersz nigdy nie jest fizycznie usuwany (p.12) — skoro właśnie przegraliśmy wyścig
    // o UPDATE, wiersz musi istnieć (ktoś go właśnie zapisał). `!fresh` jest teoretycznie
    // nieosiągalne; zachowujemy fallback zamiast zakładać to w typach, żeby nie rzucić 500
    // w nieprzewidzianym przypadku.
    if (!fresh) return NextResponse.json({ ok: true, revision: 0 });
    return buildRevisionConflictResponse(fresh);
  }

  return NextResponse.json({ ok: true, revision: nextRevision });
}

export const GET = withApiErrors(handleGET);
export const PUT = withApiErrors(handlePUT);
export const DELETE = withApiErrors(handleDELETE);
