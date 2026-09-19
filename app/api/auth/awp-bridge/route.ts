import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  fetchAwpProfileByToken,
  upsertGymBratUserFromAwp,
} from "@/lib/awp-account";
import { isTrustedAwpOrigin } from "@/lib/awp-origin";
import { establishCredentialsSession } from "@/lib/establish-session";
import { getDb } from "@/db";
import { siteActivityLog } from "@/db/schema";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().trim().min(20).max(8192),
  /** Opcjonalnie — skąd przyszedł most (analityka). */
  from: z.string().trim().max(64).optional(),
});

/**
 * Most SSO: wymienia Bearer JWT Akademii na sesję GymBrat.
 * Wywołanie z iframe / WebView po zalogowaniu w AWP (postMessage albo redirect z tokenem).
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Brak tokenu Akademii." }, { status: 400 });
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  let refererOrigin: string | null = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = null;
    }
  }
  // Same-origin (GymBrat) albo zaufany parent AWP — nie przyjmuj tokenów z obcych stron.
  let reqOrigin: string | null = null;
  try {
    reqOrigin = new URL(req.url).origin;
  } catch {
    reqOrigin = null;
  }
  const originOk =
    !origin ||
    origin === "null" ||
    (reqOrigin && origin === reqOrigin) ||
    isTrustedAwpOrigin(origin) ||
    isTrustedAwpOrigin(refererOrigin);

  if (!originOk) {
    return NextResponse.json({ ok: false, error: "Niedozwolony origin." }, { status: 403 });
  }

  await ensureCriticalSchema();

  const me = await fetchAwpProfileByToken(parsed.data.token);
  if (!me.ok) {
    return NextResponse.json({ ok: false, error: me.error }, { status: 401 });
  }

  const linked = await upsertGymBratUserFromAwp(me.profile);
  const signedIn = await establishCredentialsSession({
    id: linked.id,
    email: linked.email,
    name: linked.name,
    role: linked.role,
  });

  if (!signedIn) {
    return NextResponse.json(
      { ok: false, error: "Nie udało się ustawić sesji GymBrat." },
      { status: 500 },
    );
  }

  try {
    const db = getDb();
    await db.insert(siteActivityLog).values({
      userId: linked.id,
      action: "Logowanie (most Akademii)",
      deploymentEnv: getAnalyticsDeployment(),
    });
  } catch {
    /* nie blokuj */
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: linked.id,
      name: linked.name,
      first_name: me.profile.firstName,
      last_name: me.profile.lastName,
    },
  });
}
