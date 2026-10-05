import "server-only";

import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReports, userSettings, users } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";

export type HomeTodayHeaderData = {
  firstName: string | null;
  lastName: string | null;
  reportCount: number;
  daysSinceLastReport: number | null;
  reportCadenceDays: number;
};

export async function getHomeTodayHeaderData(
  userId: string,
): Promise<HomeTodayHeaderData> {
  const db = getDb();
  const today = calendarDateKey();

  const [userRow, settingsRow, countRow, latestReport] = await Promise.all([
    db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ reportCadenceDays: userSettings.reportCadenceDays })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ reportCount: count() })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId))
      .then((rows) => rows[0] ?? null),
    db
      .select({ createdAt: bodyReports.createdAt })
      .from(bodyReports)
      .where(eq(bodyReports.userId, userId))
      .orderBy(desc(bodyReports.createdAt), desc(bodyReports.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const firstName =
    userRow?.firstName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/)[0] ||
    null;
  const lastName =
    userRow?.lastName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/).slice(1).join(" ") ||
    null;

  const reportCadenceDays = Math.min(
    90,
    Math.max(3, settingsRow?.reportCadenceDays ?? 14),
  );

  let daysSinceLastReport: number | null = null;
  if (latestReport?.createdAt) {
    const latestKey = calendarDateKey(new Date(latestReport.createdAt));
    const t0 = new Date(`${latestKey}T12:00:00`).getTime();
    const t1 = new Date(`${today}T12:00:00`).getTime();
    daysSinceLastReport = Math.max(
      0,
      Math.round((t1 - t0) / 86_400_000),
    );
  }

  return {
    firstName,
    lastName,
    reportCount: Number(countRow?.reportCount ?? 0),
    daysSinceLastReport,
    reportCadenceDays,
  };
}
