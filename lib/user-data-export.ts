import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bodyReportPhotos,
  bodyReports,
  dailyCheckins,
  mealLogs,
  trainingSessions,
  userSettings,
  users,
  weightLogs,
  workoutPlans,
  workouts,
} from "@/db/schema";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";

export type UserDataExport = {
  exportVersion: 1;
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    weightKg: number | null;
    heightCm: number | null;
    age: number | null;
    activityLevel: string | null;
    appRole: string | null;
    /** Odszyfrowany token połączenia Fitatu (wrażliwy). */
    fitatuAccessToken: string | null;
    createdAt: string;
  };
  settings: Record<string, unknown> | null;
  workoutPlans: Record<string, unknown>[];
  workouts: Record<string, unknown>[];
  mealLogs: Record<string, unknown>[];
  bodyReports: Array<
    Record<string, unknown> & {
      photos: Array<{ id: string; dataUrl: string }>;
    }
  >;
  dailyCheckins: Record<string, unknown>[];
  weightLogs: Record<string, unknown>[];
  trainingSessions: Record<string, unknown>[];
};

export async function buildUserDataExport(userId: string): Promise<UserDataExport> {
  const db = getDb();

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new Error("Użytkownik nie istnieje.");

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const plans = await db.select().from(workoutPlans).where(eq(workoutPlans.userId, userId));
  const wos = await db.select().from(workouts).where(eq(workouts.userId, userId));
  const meals = await db.select().from(mealLogs).where(eq(mealLogs.userId, userId));
  const reports = await db.select().from(bodyReports).where(eq(bodyReports.userId, userId));
  const checkins = await db.select().from(dailyCheckins).where(eq(dailyCheckins.userId, userId));
  const weights = await db.select().from(weightLogs).where(eq(weightLogs.userId, userId));
  const sessions = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.userId, userId));

  const reportIds = reports.map((r) => r.id);
  const photos =
    reportIds.length === 0
      ? []
      : await db
          .select()
          .from(bodyReportPhotos)
          .where(
            reportIds.length === 1
              ? eq(bodyReportPhotos.reportId, reportIds[0]!)
              : inArray(bodyReportPhotos.reportId, reportIds),
          );

  const photosByReport = new Map<string, { id: string; dataUrl: string }[]>();
  for (const p of photos) {
    const arr = photosByReport.get(p.reportId) ?? [];
    arr.push({
      id: p.id,
      dataUrl: maybeDecryptSensitiveField(p.dataUrl) ?? "",
    });
    photosByReport.set(p.reportId, arr);
  }

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    user: {
      id: u.id,
      email: u.email,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      weightKg: u.weightKg ?? null,
      heightCm: u.heightCm ?? null,
      age: u.age ?? null,
      activityLevel: u.activityLevel ?? null,
      appRole: u.appRole ?? null,
      fitatuAccessToken: maybeDecryptSensitiveField(u.fitatuAccessToken),
      createdAt: u.createdAt.toISOString(),
    },
    settings: settings ? { ...settings } : null,
    workoutPlans: plans.map((p) => ({ ...p })),
    workouts: wos.map((w) => ({ ...w })),
    mealLogs: meals.map((m) => ({ ...m })),
    bodyReports: reports.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      photos: photosByReport.get(r.id) ?? [],
    })),
    dailyCheckins: checkins.map((c) => ({ ...c })),
    weightLogs: weights.map((w) => ({ ...w })),
    trainingSessions: sessions.map((s) => ({ ...s })),
  };
}
