import { eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { sendOptionalDailyBriefEmail } from "@/lib/email";
import { parseRemindersJson } from "@/lib/reminders-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const hdr =
    req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice("Bearer ".length) : hdr;
  return token === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({
      userId: userSettings.userId,
      remindersJson: userSettings.remindersJson,
      email: users.email,
    })
    .from(userSettings)
    .innerJoin(users, eq(users.id, userSettings.userId))
    .where(isNotNull(userSettings.remindersJson));

  let sent = 0;
  for (const r of rows) {
    const prefs = parseRemindersJson(r.remindersJson);
    if (!prefs.emailDailyBrief) continue;
    const ok = await sendOptionalDailyBriefEmail({
      to: r.email,
      subject: "GymBrat — dzienny skrót",
      text: `Cześć,\n\nZajrzyj do GymBrat i zaloguj trening oraz makra na dziś.\n\n— GymBrat`,
    });
    if (ok) sent += 1;
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent });
}
