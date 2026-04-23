import { lt, or, and, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  emailVerificationCodes,
  pageViews,
  siteActivityLog,
  bodyReportPhotos,
} from "@/db/schema";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function daysAgoMs(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function isoCutoffFromDays(days: number): string {
  return new Date(daysAgoMs(days)).toISOString();
}

export type CleanupResult = {
  deleted: {
    pageViews: number;
    siteActivityLog: number;
    emailVerificationCodes: number;
    bodyReportPhotos: number;
  };
  policy: {
    pageViewsDays: number;
    activityLogDays: number;
    emailCodesDays: number;
    bodyReportPhotosDays: number | null;
  };
};

export function getRetentionPolicy(): CleanupResult["policy"] {
  const pageViewsDays = envInt("RETENTION_PAGE_VIEWS_DAYS", 30);
  const activityLogDays = envInt("RETENTION_ACTIVITY_LOG_DAYS", 90);
  const emailCodesDays = envInt("RETENTION_EMAIL_CODES_DAYS", 14);
  const photosDaysRaw = process.env.RETENTION_BODY_REPORT_PHOTOS_DAYS;
  const bodyReportPhotosDays =
    photosDaysRaw == null || photosDaysRaw.trim() === ""
      ? null
      : envInt("RETENTION_BODY_REPORT_PHOTOS_DAYS", 0);

  return {
    pageViewsDays,
    activityLogDays,
    emailCodesDays,
    bodyReportPhotosDays,
  };
}

/**
 * Czyści dane rosnące bez końca (retencja) – kluczowe dla limitów Turso.
 * Uwaga: usuwanie z SQLite/libSQL zwalnia logicznie miejsce, ale realny odzysk
 * zależy od kompakcji po stronie bazy; mimo to retencja zatrzymuje stały przyrost.
 */
export async function runDbCleanup(): Promise<CleanupResult> {
  const db = getDb();
  const policy = getRetentionPolicy();

  const pvCutoffIso = isoCutoffFromDays(policy.pageViewsDays);
  const activityCutoff = new Date(daysAgoMs(policy.activityLogDays));
  const emailCutoff = new Date(daysAgoMs(policy.emailCodesDays));
  const photosCutoff =
    policy.bodyReportPhotosDays == null
      ? null
      : new Date(daysAgoMs(policy.bodyReportPhotosDays));

  const removedPageViews = await db
    .delete(pageViews)
    .where(lt(pageViews.createdAt, pvCutoffIso))
    .returning({ id: pageViews.id });

  const removedActivity = await db
    .delete(siteActivityLog)
    .where(lt(siteActivityLog.createdAt, activityCutoff))
    .returning({ id: siteActivityLog.id });

  // Email kody: usuń przeterminowane oraz "zużyte" starsze niż retencja.
  const removedEmailCodes = await db
    .delete(emailVerificationCodes)
    .where(
      or(
        lt(emailVerificationCodes.expiresAt, new Date()),
        and(
          isNotNull(emailVerificationCodes.consumedAt),
          lt(emailVerificationCodes.createdAt, emailCutoff),
        ),
      ),
    )
    .returning({ id: emailVerificationCodes.id });

  const removedPhotos =
    photosCutoff == null
      ? []
      : await db
          .delete(bodyReportPhotos)
          .where(lt(bodyReportPhotos.createdAt, photosCutoff))
          .returning({ id: bodyReportPhotos.id });

  return {
    deleted: {
      pageViews: removedPageViews.length,
      siteActivityLog: removedActivity.length,
      emailVerificationCodes: removedEmailCodes.length,
      bodyReportPhotos: removedPhotos.length,
    },
    policy,
  };
}

