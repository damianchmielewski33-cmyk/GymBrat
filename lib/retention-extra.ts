import { deleteObjectKeys, listUserPhotoObjectKeys } from "@/lib/photo-objects-cleanup";
import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { bodyReports, bodyReportPhotos, bugReportPhotos, bugReports, userSettings, users } from "@/db/schema";
import { deleteUserAccount } from "@/lib/account-delete";

/**
 * Retencja wg projektu `docs/prawo/01-podstawy-prawne-i-retencja.md` (Z28). Okresy to PROJEKT do
 * zatwierdzenia przez prawnika; nieaktywne konta i zdjęcia są kasowane wyłącznie po włączeniu flagi
 * `RETENTION_INACTIVE_ACCOUNTS_ENABLED=1` i tylko po wysłanym ostrzeżeniu e-mail (brak SMTP = brak kasowania).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;

function envInt(name: string, fallback: number, env: Record<string, string | undefined>): number {
  const raw = env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export type ExtraRetentionPolicy = {
  inactiveAccountsEnabled: boolean;
  inactiveAccountMonths: number;
  inactivePhotosMonths: number;
  warnDays: number;
  bugReportDays: number;
  bugScreenshotDays: number;
};

export function getExtraRetentionPolicy(
  env: Record<string, string | undefined> = process.env,
): ExtraRetentionPolicy {
  return {
    inactiveAccountsEnabled: env.RETENTION_INACTIVE_ACCOUNTS_ENABLED?.trim() === "1",
    inactiveAccountMonths: envInt("RETENTION_INACTIVE_ACCOUNT_MONTHS", 24, env),
    inactivePhotosMonths: envInt("RETENTION_INACTIVE_PHOTOS_MONTHS", 12, env),
    // Ostrzeżenie co najmniej 7 dni przed usunięciem — zmienna nie skróci tego do zera.
    warnDays: Math.max(7, envInt("RETENTION_INACTIVE_WARN_DAYS", 30, env)),
    bugReportDays: envInt("RETENTION_BUG_REPORT_DAYS", 365, env),
    bugScreenshotDays: envInt("RETENTION_BUG_SCREENSHOT_DAYS", 90, env),
  };
}

function monthsAgo(now: number, months: number): number {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
}

export type BugRetentionResult = { screenshotsDeleted: number; reportsDeleted: number };

/** Zrzuty ekranu i zgłoszenia zamknięte (status „fixed”) po upływie okresu od rozwiązania. */
export async function runBugReportRetention(
  db: Database,
  now: number,
  policy: ExtraRetentionPolicy,
): Promise<BugRetentionResult> {
  const shotCutoff = new Date(now - policy.bugScreenshotDays * DAY_MS);
  const reportCutoff = new Date(now - policy.bugReportDays * DAY_MS);

  const closedBefore = (cutoff: Date) =>
    and(eq(bugReports.status, "fixed"), isNotNull(bugReports.resolvedAt), lt(bugReports.resolvedAt, cutoff));

  const shots = await db
    .delete(bugReportPhotos)
    .where(
      inArray(
        bugReportPhotos.bugReportId,
        db.select({ id: bugReports.id }).from(bugReports).where(closedBefore(shotCutoff)),
      ),
    )
    .returning({ id: bugReportPhotos.id });

  const old = await db.select({ id: bugReports.id }).from(bugReports).where(closedBefore(reportCutoff)).limit(500);
  let reportsDeleted = 0;
  if (old.length > 0) {
    const ids = old.map((r) => r.id);
    // Klucze obce mogą być wyłączone (Turso) — dzieci usuwamy jawnie.
    await db.delete(bugReportPhotos).where(inArray(bugReportPhotos.bugReportId, ids));
    const gone = await db.delete(bugReports).where(inArray(bugReports.id, ids)).returning({ id: bugReports.id });
    reportsDeleted = gone.length;
  }
  return { screenshotsDeleted: shots.length, reportsDeleted };
}

export type InactiveRetentionDeps = {
  sendWarning: (args: { to: string; kind: "photos" | "account"; daysToDelete: number }) => Promise<boolean>;
};

export type InactiveRetentionResult = {
  photosWarned: number;
  photosPurged: number;
  accountsWarned: number;
  accountsDeleted: number;
};

const lastActivity = sql<number>`coalesce(${users.lastActiveAt}, ${users.createdAt})`;

/** Konta bez pakietu i bez roli admina — ich nie ruszamy automatycznie. */
const protectedFromPurge = (now: number) =>
  or(eq(users.appRole, "admin"), sql`coalesce(${users.packageEndsAt}, 0) > ${now}`);

export async function runInactiveRetention(
  db: Database,
  now: number,
  policy: ExtraRetentionPolicy,
  deps: InactiveRetentionDeps,
): Promise<InactiveRetentionResult> {
  const result: InactiveRetentionResult = { photosWarned: 0, photosPurged: 0, accountsWarned: 0, accountsDeleted: 0 };
  if (!policy.inactiveAccountsEnabled) return result;

  const warnMs = policy.warnDays * DAY_MS;
  const photosCutoff = monthsAgo(now, policy.inactivePhotosMonths);
  const accountCutoff = monthsAgo(now, policy.inactiveAccountMonths);

  // —— 1. Zdjęcia: ostrzeżenie → po warnDays kasowanie samych zdjęć ——
  const photoWarn = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(
        sql`${lastActivity} < ${photosCutoff}`,
        // Kto kwalifikuje się już do ostrzeżenia o koncie, dostaje jedną wiadomość (konto obejmuje zdjęcia).
        sql`${lastActivity} >= ${accountCutoff}`,
        isNull(users.photosWarnedAt),
        sql`not (${protectedFromPurge(now)})`,
      ))
    .limit(BATCH);
  for (const u of photoWarn) {
    if (!u.email) continue;
    const sent = await deps.sendWarning({ to: u.email, kind: "photos", daysToDelete: policy.warnDays }).catch(() => false);
    if (!sent) continue; // bez wysłanego ostrzeżenia nie kasujemy
    await db.update(users).set({ photosWarnedAt: new Date(now) }).where(eq(users.id, u.id));
    result.photosWarned += 1;
  }

  const photoDue = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${lastActivity} < ${photosCutoff}`,
        isNotNull(users.photosWarnedAt),
        lt(users.photosWarnedAt, new Date(now - warnMs)),
        sql`not (${protectedFromPurge(now)})`,
      ),
    )
    .limit(BATCH);
  for (const u of photoDue) {
    const reportIds = (await db.select({ id: bodyReports.id }).from(bodyReports).where(eq(bodyReports.userId, u.id))).map(
      (r) => r.id,
    );
    if (reportIds.length > 0) {
      const photoKeys = await listUserPhotoObjectKeys(db, u.id);
      await db.delete(bodyReportPhotos).where(inArray(bodyReportPhotos.reportId, reportIds));
      await deleteObjectKeys(photoKeys);
    }
    await db.update(userSettings).set({ startPhotoDataUrl: null }).where(eq(userSettings.userId, u.id));
    result.photosPurged += 1;
  }

  // —— 2. Konta: ostrzeżenie → po warnDays usunięcie ——
  const accWarn = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(sql`${lastActivity} < ${accountCutoff}`, isNull(users.inactivityWarnedAt), sql`not (${protectedFromPurge(now)})`))
    .limit(BATCH);
  for (const u of accWarn) {
    if (!u.email) continue;
    const sent = await deps.sendWarning({ to: u.email, kind: "account", daysToDelete: policy.warnDays }).catch(() => false);
    if (!sent) continue;
    await db.update(users).set({ inactivityWarnedAt: new Date(now) }).where(eq(users.id, u.id));
    result.accountsWarned += 1;
  }

  const accDue = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${lastActivity} < ${accountCutoff}`,
        isNotNull(users.inactivityWarnedAt),
        lt(users.inactivityWarnedAt, new Date(now - warnMs)),
        sql`not (${protectedFromPurge(now)})`,
      ),
    )
    .limit(BATCH);
  for (const u of accDue) {
    await deleteUserAccount(db, u.id);
    result.accountsDeleted += 1;
  }
  return result;
}
