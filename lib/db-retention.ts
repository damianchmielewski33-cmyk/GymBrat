/**
 * Retencja danych — chroni darmowy limit Turso.
 * NIE kasujemy: treningów, meal logs, wag, kont ani zdjęć użytkowników
 * (raporty ciała, media feedu, zdjęcia zgłoszeń błędów).
 * Usuwanie zwalnia miejsce logicznie; fizyczny odzysk zależy od Turso.
 */

import { and, asc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activeWorkoutSessions,
  adminAuditLog,
  chatEvents,
  chatMessages,
  chatTyping,
  emailVerificationCodes,
  friendLivePresence,
  notificationEvents,
  notifications,
  pageViews,
  siteActivityLog,
  teamFeedEvents,
} from "@/db/schema";
import {
  getDbStorageUsage,
  invalidateDbStorageUsageCache,
  type DbStorageUsage,
} from "@/lib/db-storage-budget";

const BATCH = 250;
const MAX_BATCHES_PER_TABLE = 40;
const EMERGENCY_MAX_ROWS = 2_000;

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

export type CleanupDeleted = {
  pageViews: number;
  siteActivityLog: number;
  adminAuditLog: number;
  emailVerificationCodes: number;
  teamFeedEvents: number;
  notificationEvents: number;
  notifications: number;
  chatMessages: number;
  chatEvents: number;
  chatTyping: number;
  friendLivePresence: number;
  activeWorkoutSessions: number;
  emergencyNotifications: number;
  emergencyPageViews: number;
  emergencyActivityLog: number;
};

export type CleanupResult = {
  deleted: CleanupDeleted;
  policy: {
    pageViewsDays: number;
    activityLogDays: number;
    adminAuditDays: number;
    emailCodesDays: number;
    teamFeedEventsDays: number;
    notificationEventsDays: number;
    notificationsReadDays: number;
    notificationsMaxDays: number;
    chatMessagesDays: number;
    chatEventsDays: number;
    chatTypingDays: number;
    friendLivePresenceDays: number;
    activeWorkoutSessionsDays: number;
    /** Zawsze true — zdjęcia użytkowników poza retencją. */
    preserveUserPhotos: true;
  };
  usage: DbStorageUsage;
  usageAfter: DbStorageUsage;
};

export function getRetentionPolicy(): CleanupResult["policy"] {
  return {
    pageViewsDays: envInt("RETENTION_PAGE_VIEWS_DAYS", 21),
    activityLogDays: envInt("RETENTION_ACTIVITY_LOG_DAYS", 45),
    adminAuditDays: envInt("RETENTION_ADMIN_AUDIT_DAYS", 180),
    emailCodesDays: envInt("RETENTION_EMAIL_CODES_DAYS", 14),
    teamFeedEventsDays: envInt("RETENTION_TEAM_FEED_EVENTS_DAYS", 7),
    notificationEventsDays: envInt("RETENTION_NOTIFICATION_EVENTS_DAYS", 7),
    notificationsReadDays: envInt("RETENTION_NOTIFICATIONS_READ_DAYS", 60),
    notificationsMaxDays: envInt("RETENTION_NOTIFICATIONS_MAX_DAYS", 180),
    chatMessagesDays: envInt("RETENTION_CHAT_MESSAGES_DAYS", 90),
    chatEventsDays: envInt("RETENTION_CHAT_EVENTS_DAYS", 7),
    chatTypingDays: envInt("RETENTION_CHAT_TYPING_DAYS", 2),
    friendLivePresenceDays: envInt("RETENTION_FRIEND_LIVE_PRESENCE_DAYS", 2),
    activeWorkoutSessionsDays: envInt(
      "RETENTION_ACTIVE_WORKOUT_SESSIONS_DAYS",
      7,
    ),
    preserveUserPhotos: true,
  };
}

/** Powtarzaj SELECT LIMIT + DELETE aż pusto lub max batchy. */
async function purgeBatched(
  fetchIds: () => Promise<string[]>,
  deleteIds: (ids: string[]) => Promise<void>,
  maxBatches = MAX_BATCHES_PER_TABLE,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const ids = await fetchIds();
    if (ids.length === 0) break;
    await deleteIds(ids);
    total += ids.length;
    if (ids.length < BATCH) break;
  }
  return total;
}

/**
 * Czyści dane rosnące bez końca (retencja) – kluczowe dla limitów Turso.
 * Zdjęcia użytkowników nigdy nie są usuwane.
 */
export async function runDbCleanup(): Promise<CleanupResult> {
  const db = getDb();
  const policy = getRetentionPolicy();
  const usageBefore = await getDbStorageUsage({ force: true });

  const deleted: CleanupDeleted = {
    pageViews: 0,
    siteActivityLog: 0,
    adminAuditLog: 0,
    emailVerificationCodes: 0,
    teamFeedEvents: 0,
    notificationEvents: 0,
    notifications: 0,
    chatMessages: 0,
    chatEvents: 0,
    chatTyping: 0,
    friendLivePresence: 0,
    activeWorkoutSessions: 0,
    emergencyNotifications: 0,
    emergencyPageViews: 0,
    emergencyActivityLog: 0,
  };

  // —— Analytics ——
  const pvCutoffIso = isoCutoffFromDays(policy.pageViewsDays);
  deleted.pageViews = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: pageViews.id })
        .from(pageViews)
        .where(lt(pageViews.createdAt, pvCutoffIso))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(pageViews).where(inArray(pageViews.id, ids));
    },
  );

  const activityCutoff = new Date(daysAgoMs(policy.activityLogDays));
  deleted.siteActivityLog = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: siteActivityLog.id })
        .from(siteActivityLog)
        .where(lt(siteActivityLog.createdAt, activityCutoff))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(siteActivityLog).where(inArray(siteActivityLog.id, ids));
    },
  );

  const auditCutoff = new Date(daysAgoMs(policy.adminAuditDays));
  deleted.adminAuditLog = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: adminAuditLog.id })
        .from(adminAuditLog)
        .where(lt(adminAuditLog.createdAt, auditCutoff))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(adminAuditLog).where(inArray(adminAuditLog.id, ids));
    },
  );

  const emailCutoff = new Date(daysAgoMs(policy.emailCodesDays));
  deleted.emailVerificationCodes = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: emailVerificationCodes.id })
        .from(emailVerificationCodes)
        .where(
          or(
            lt(emailVerificationCodes.expiresAt, new Date()),
            and(
              isNotNull(emailVerificationCodes.consumedAt),
              lt(emailVerificationCodes.createdAt, emailCutoff),
            ),
          ),
        )
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db
        .delete(emailVerificationCodes)
        .where(inArray(emailVerificationCodes.id, ids));
    },
  );

  // —— Community ephemeral (bez zdjęć) ——
  const feedEvCutoff = new Date(daysAgoMs(policy.teamFeedEventsDays));
  deleted.teamFeedEvents = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: teamFeedEvents.id })
        .from(teamFeedEvents)
        .where(lt(teamFeedEvents.createdAt, feedEvCutoff))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(teamFeedEvents).where(inArray(teamFeedEvents.id, ids));
    },
  );

  const notifEvCutoff = new Date(daysAgoMs(policy.notificationEventsDays));
  deleted.notificationEvents = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: notificationEvents.id })
        .from(notificationEvents)
        .where(lt(notificationEvents.createdAt, notifEvCutoff))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db
        .delete(notificationEvents)
        .where(inArray(notificationEvents.id, ids));
    },
  );

  const notifReadCutoff = new Date(daysAgoMs(policy.notificationsReadDays));
  const notifMaxCutoff = new Date(daysAgoMs(policy.notificationsMaxDays));
  deleted.notifications = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          or(
            and(
              isNotNull(notifications.readAt),
              lt(notifications.createdAt, notifReadCutoff),
            ),
            lt(notifications.createdAt, notifMaxCutoff),
          ),
        )
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(notifications).where(inArray(notifications.id, ids));
    },
  );

  const chatMsgCutoff = new Date(daysAgoMs(policy.chatMessagesDays));
  deleted.chatMessages = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(lt(chatMessages.createdAt, chatMsgCutoff))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(chatMessages).where(inArray(chatMessages.id, ids));
    },
  );

  const chatEvCutoff = new Date(daysAgoMs(policy.chatEventsDays));
  deleted.chatEvents = await purgeBatched(
    async () => {
      const rows = await db
        .select({ id: chatEvents.id })
        .from(chatEvents)
        .where(lt(chatEvents.createdAt, chatEvCutoff))
        .limit(BATCH);
      return rows.map((r) => r.id);
    },
    async (ids) => {
      await db.delete(chatEvents).where(inArray(chatEvents.id, ids));
    },
  );

  const typingCutoff = new Date(daysAgoMs(policy.chatTypingDays));
  {
    let total = 0;
    for (let i = 0; i < MAX_BATCHES_PER_TABLE; i++) {
      const rows = await db
        .select({
          channelId: chatTyping.channelId,
          userId: chatTyping.userId,
        })
        .from(chatTyping)
        .where(lt(chatTyping.updatedAt, typingCutoff))
        .limit(BATCH);
      if (rows.length === 0) break;
      for (const row of rows) {
        await db
          .delete(chatTyping)
          .where(
            and(
              eq(chatTyping.channelId, row.channelId),
              eq(chatTyping.userId, row.userId),
            ),
          );
      }
      total += rows.length;
      if (rows.length < BATCH) break;
    }
    deleted.chatTyping = total;
  }

  const liveCutoff = new Date(daysAgoMs(policy.friendLivePresenceDays));
  deleted.friendLivePresence = await purgeBatched(
    async () => {
      const rows = await db
        .select({ userId: friendLivePresence.userId })
        .from(friendLivePresence)
        .where(
          or(
            and(
              eq(friendLivePresence.active, 0),
              lt(friendLivePresence.updatedAt, liveCutoff),
            ),
            lt(friendLivePresence.updatedAt, liveCutoff),
          ),
        )
        .limit(BATCH);
      return rows.map((r) => r.userId);
    },
    async (ids) => {
      await db
        .delete(friendLivePresence)
        .where(inArray(friendLivePresence.userId, ids));
    },
  );

  const sessionCutoff = new Date(daysAgoMs(policy.activeWorkoutSessionsDays));
  deleted.activeWorkoutSessions = await purgeBatched(
    async () => {
      const rows = await db
        .select({ userId: activeWorkoutSessions.userId })
        .from(activeWorkoutSessions)
        .where(lt(activeWorkoutSessions.updatedAt, sessionCutoff))
        .limit(BATCH);
      return rows.map((r) => r.userId);
    },
    async (ids) => {
      await db
        .delete(activeWorkoutSessions)
        .where(inArray(activeWorkoutSessions.userId, ids));
    },
  );

  // —— Emergency purge przy hard limit (TYLKO ephemeral, bez zdjęć) ——
  let usageProbe = await getDbStorageUsage({ force: true });
  if (usageProbe.overHard) {
    let emergencyLeft = EMERGENCY_MAX_ROWS;

    while (emergencyLeft > 0 && usageProbe.overSoft) {
      const take = Math.min(BATCH, emergencyLeft);
      const rows = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(isNotNull(notifications.readAt))
        .orderBy(asc(notifications.createdAt))
        .limit(take);
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      await db.delete(notifications).where(inArray(notifications.id, ids));
      deleted.emergencyNotifications += ids.length;
      emergencyLeft -= ids.length;
      usageProbe = await getDbStorageUsage({ force: true });
      if (rows.length < take) break;
    }

    while (emergencyLeft > 0 && usageProbe.overSoft) {
      const take = Math.min(BATCH, emergencyLeft);
      const rows = await db
        .select({ id: pageViews.id })
        .from(pageViews)
        .orderBy(asc(pageViews.createdAt))
        .limit(take);
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      await db.delete(pageViews).where(inArray(pageViews.id, ids));
      deleted.emergencyPageViews += ids.length;
      emergencyLeft -= ids.length;
      usageProbe = await getDbStorageUsage({ force: true });
      if (rows.length < take) break;
    }

    while (emergencyLeft > 0 && usageProbe.overSoft) {
      const take = Math.min(BATCH, emergencyLeft);
      const rows = await db
        .select({ id: siteActivityLog.id })
        .from(siteActivityLog)
        .orderBy(asc(siteActivityLog.createdAt))
        .limit(take);
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      await db.delete(siteActivityLog).where(inArray(siteActivityLog.id, ids));
      deleted.emergencyActivityLog += ids.length;
      emergencyLeft -= ids.length;
      usageProbe = await getDbStorageUsage({ force: true });
      if (rows.length < take) break;
    }
  }

  invalidateDbStorageUsageCache();
  const usageAfter = await getDbStorageUsage({ force: true });

  return {
    deleted,
    policy,
    usage: usageBefore,
    usageAfter,
  };
}

/** Lekki podgląd limitu (admin / diagnostyka) — bez kasowania. */
export async function getDbCleanupPreview(): Promise<{
  policy: CleanupResult["policy"];
  usage: DbStorageUsage;
}> {
  return {
    policy: getRetentionPolicy(),
    usage: await getDbStorageUsage({ force: true }),
  };
}
