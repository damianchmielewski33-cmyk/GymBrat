import { withApiErrors } from "@/lib/errors/api";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  pushSubscriptions,
  reminderDispatches,
  supplementIntakes,
  userSettings,
  users,
} from "@/db/schema";
import { parseDietSupplements } from "@/lib/diet-supplements";
import { calendarDateKey } from "@/lib/local-date";
import {
  dueSupplementSlots,
  SUPPLEMENT_REMINDER_URL,
} from "@/lib/supplement-reminders";
import { isConsentGranted } from "@/lib/consents";
import { sendOptionalDailyBriefEmail } from "@/lib/email";
import { dueReminders, REMINDER_COPY, type ReminderKind } from "@/lib/reminders-schedule";
import { parseRemindersJson } from "@/lib/reminders-types";
import { isWebPushConfigured, sendWebPush } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const hdr =
    req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice("Bearer ".length) : hdr;
  return token === secret;
}

type Db = ReturnType<typeof getDb>;

/** true = to uruchomienie „zajęło” wpis (pierwsze tego dnia); false = już wysłano. */
async function claim(db: Db, userId: string, dateKey: string, kind: string): Promise<boolean> {
  const rows = await db
    .insert(reminderDispatches)
    .values({ userId, dateKey, kind })
    .onConflictDoNothing()
    .returning({ kind: reminderDispatches.kind });
  return rows.length > 0;
}

async function release(db: Db, userId: string, dateKey: string, kind: string) {
  await db
    .delete(reminderDispatches)
    .where(
      and(
        eq(reminderDispatches.userId, userId),
        eq(reminderDispatches.dateKey, dateKey),
        eq(reminderDispatches.kind, kind),
      ),
    );
}

/**
 * Wywoływane cyklicznie (zalecane co 5 min): wysyła push o wybranej godzinie
 * (w strefie użytkownika) oraz dzienny skrót e-mail — każde najwyżej raz dziennie.
 */
async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  const pushReady = isWebPushConfigured();

  const rows = await db
    .select({
      userId: userSettings.userId,
      remindersJson: userSettings.remindersJson,
      email: users.email,
    })
    .from(userSettings)
    .innerJoin(users, eq(users.id, userSettings.userId))
    .where(isNotNull(userSettings.remindersJson));

  const dueByTime = rows
    .map((r) => ({ ...r, prefs: parseRemindersJson(r.remindersJson) }))
    .map((r) => ({ ...r, due: dueReminders(r.prefs, now) }))
    .filter((r) => r.due.kinds.length > 0 || r.due.emailDue);

  // Z81: przypomnienia (push i skrót e-mail) tylko dla osób z aktualną zgodą `push` w rejestrze zgód.
  const due: typeof dueByTime = [];
  for (const r of dueByTime) {
    if (await isConsentGranted(r.userId, "push")) due.push(r);
  }

  const subsByUser = new Map<
    string,
    { id: string; endpoint: string; p256dh: string; auth: string }[]
  >();
  if (pushReady && due.length > 0) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(
        inArray(
          pushSubscriptions.userId,
          due.map((d) => d.userId),
        ),
      );
    for (const s of subs) {
      const list = subsByUser.get(s.userId) ?? [];
      list.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
      subsByUser.set(s.userId, list);
    }
  }

  let pushSent = 0;
  let emailSent = 0;
  const goneIds: string[] = [];

  for (const r of due) {
    const subs = subsByUser.get(r.userId) ?? [];

    if (subs.length > 0) {
      for (const kind of r.due.kinds as ReminderKind[]) {
        if (!(await claim(db, r.userId, r.due.dateKey, kind))) continue;
        const copy = REMINDER_COPY[kind];
        let delivered = 0;
        let failed = 0;
        for (const sub of subs) {
          const result = await sendWebPush(sub, {
            title: copy.title,
            body: copy.body,
            url: copy.url,
            tag: `gymbrat-${kind}`,
          });
          if (result === "ok") delivered += 1;
          else if (result === "gone") goneIds.push(sub.id);
          else failed += 1;
        }
        pushSent += delivered;
        // Wszystkie próby zawiodły przejściowo — pozwól następnemu uruchomieniu spróbować jeszcze raz.
        if (delivered === 0 && failed > 0) await release(db, r.userId, r.due.dateKey, kind);
      }
    }

    if (r.due.emailDue && (await claim(db, r.userId, r.due.dateKey, "email"))) {
      const ok = await sendOptionalDailyBriefEmail({
        to: r.email,
        subject: "GymBrat — dzienny skrót",
        text: `Cześć,\n\nZajrzyj do GymBrat i zaloguj trening oraz makro na dziś.\n\n— GymBrat`,
      });
      if (ok) emailSent += 1;
      else await release(db, r.userId, r.due.dateKey, "email");
    }
  }

  // Suplementy: przypomnienie, gdy godzina przyjęcia minęła, a suplement nie jest odhaczony.
  let supplementPushSent = 0;
  if (pushReady) {
    const suppRows = await db
      .select({
        userId: userSettings.userId,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
        remindersJson: userSettings.remindersJson,
      })
      .from(userSettings)
      .where(isNotNull(userSettings.fitnessGoalsJson));

    for (const r of suppRows) {
      const supplements = (parseDietSupplements(r.fitnessGoalsJson) ?? []).filter(
        (s) => s.times?.length,
      );
      if (supplements.length === 0) continue;
      const prefs = parseRemindersJson(r.remindersJson);
      const { dateKey, slots } = dueSupplementSlots(supplements, prefs, now);
      if (slots.length === 0) continue;
      if (!(await isConsentGranted(r.userId, "push"))) continue;

      const taken = await db
        .select({ name: supplementIntakes.name, slot: supplementIntakes.slot })
        .from(supplementIntakes)
        .where(
          and(
            eq(supplementIntakes.userId, r.userId),
            eq(supplementIntakes.dateKey, calendarDateKey(now)),
          ),
        );
      const takenSet = new Set(taken.map((t) => `${t.name}|${t.slot}`));
      const pending = slots.filter((s) => !takenSet.has(`${s.name}|${s.slot}`));

      const claimed: typeof pending = [];
      for (const p of pending) {
        if (await claim(db, r.userId, dateKey, p.dispatchKind)) claimed.push(p);
      }
      if (claimed.length === 0) continue;

      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, r.userId));
      const names = [...new Set(claimed.map((c) => c.name))];
      let delivered = 0;
      for (const sub of subs) {
        const result = await sendWebPush(sub, {
          title: "GymBrat — suplementy",
          body: `Nie odhaczono: ${names.join(", ")}. Oznacz, jeśli już przyjęte.`,
          url: SUPPLEMENT_REMINDER_URL,
          tag: "gymbrat-supplements",
          actions: [{ action: "taken", title: "Przyjąłem" }],
          supplements: claimed.map((c) => ({ name: c.name, slot: c.slot })),
        });
        if (result === "ok") delivered += 1;
        else if (result === "gone") goneIds.push(sub.id);
      }
      supplementPushSent += delivered;
      if (delivered === 0 && subs.length > 0) {
        for (const c of claimed) await release(db, r.userId, dateKey, c.dispatchKind);
      }
    }
  }

  if (goneIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, goneIds));
  }
  // Wpisy dedupe starsze niż 3 dni są już zbędne.
  await db
    .delete(reminderDispatches)
    .where(lt(reminderDispatches.sentAt, new Date(now.getTime() - 3 * 86_400_000)));

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    due: due.length,
    skippedNoConsent: dueByTime.length - due.length,
    pushConfigured: pushReady,
    pushSent,
    supplementPushSent,
    emailSent,
    expiredSubscriptions: goneIds.length,
  });
}

/** Vercel Cron i GitHub Actions wołają GET lub POST z `Authorization: Bearer <CRON_SECRET>`. */
async function handleGET(req: Request) {
  return handle(req);
}
async function handlePOST(req: Request) {
  return handle(req);
}

export const GET = withApiErrors(handleGET);
export const POST = withApiErrors(handlePOST);
