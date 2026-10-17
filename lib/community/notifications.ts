import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  notificationEvents,
  notifications,
  teamMembers,
  users,
} from "@/db/schema";
import {
  isNotificationKind,
  NOTIFICATION_GROUP_WINDOW_MS,
  type NotificationKind,
  type NotificationView,
} from "@/lib/community/notification-types";
import { cacheGet, cacheInvalidate, cacheSet, SSE_POLL } from "@/lib/community/perf-cache";

function displayName(row: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}): string {
  const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  if (full) return full;
  if (row.name?.trim()) return row.name.trim();
  return row.email.split("@")[0] || "Zawodnik";
}

async function emitEvent(input: {
  userId: string;
  kind: "created" | "updated" | "read";
  notificationId: string;
}) {
  const db = getDb();
  await db.insert(notificationEvents).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    kind: input.kind,
    notificationId: input.notificationId,
    createdAt: new Date(),
  });
  cacheInvalidate(`notif-ev-head:${input.userId}`);
}

export type EmitNotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  teamId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  groupKey?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * Tworzy powiadomienie albo dokleja do nieprzeczytanego w oknie group_key (2h).
 */
export async function emitNotification(
  input: EmitNotificationInput,
): Promise<{ id: string; grouped: boolean } | null> {
  if (!input.userId) return null;
  if (input.actorUserId && input.actorUserId === input.userId) return null;

  try {
    await ensureCriticalSchema();
    const db = getDb();
    const now = new Date();
    const groupKey = input.groupKey?.trim() || null;

    if (groupKey) {
      const windowStart = new Date(now.getTime() - NOTIFICATION_GROUP_WINDOW_MS);
      const [existing] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, input.userId),
            eq(notifications.groupKey, groupKey),
            isNull(notifications.readAt),
            gt(notifications.createdAt, windowStart),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(1);

      if (existing) {
        const nextCount = (existing.collapsedCount || 1) + 1;
        const actorName = input.actorDisplayName?.trim() || "Ktoś";
        let body = input.body;
        if (nextCount === 2) {
          body = `${actorName} i ktoś jeszcze — ${input.body}`;
        } else if (nextCount > 2) {
          body = `${actorName} i ${nextCount - 1} innych — ${stripLeadingActors(input.body)}`;
        }

        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(existing.payloadJson || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          payload = {};
        }
        const actors = Array.isArray(payload.actorNames)
          ? (payload.actorNames as string[])
          : [];
        if (input.actorDisplayName && !actors.includes(input.actorDisplayName)) {
          actors.push(input.actorDisplayName);
        }
        payload.actorNames = actors.slice(-8);
        payload.collapsedCount = nextCount;

        await db
          .update(notifications)
          .set({
            title: input.title,
            body: body.slice(0, 400),
            href: input.href ?? existing.href,
            actorUserId: input.actorUserId ?? existing.actorUserId,
            collapsedCount: nextCount,
            payloadJson: JSON.stringify(payload),
            createdAt: now,
          })
          .where(eq(notifications.id, existing.id));

        await emitEvent({
          userId: input.userId,
          kind: "updated",
          notificationId: existing.id,
        });
        cacheInvalidate(`unread:${input.userId}`);
        return { id: existing.id, grouped: true };
      }
    }

    const id = crypto.randomUUID();
    await db.insert(notifications).values({
      id,
      userId: input.userId,
      kind: input.kind,
      title: input.title.slice(0, 120),
      body: input.body.slice(0, 400),
      href: (input.href ?? "").slice(0, 400),
      actorUserId: input.actorUserId ?? null,
      teamId: input.teamId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      groupKey,
      payloadJson: JSON.stringify({
        ...(input.payload ?? {}),
        actorNames: input.actorDisplayName ? [input.actorDisplayName] : [],
      }),
      collapsedCount: 1,
      createdAt: now,
      readAt: null,
    });
    await emitEvent({
      userId: input.userId,
      kind: "created",
      notificationId: id,
    });
    cacheInvalidate(`unread:${input.userId}`);
    return { id, grouped: false };
  } catch {
    return null;
  }
}

function stripLeadingActors(body: string): string {
  const cleaned = body.replace(/^.*?—\s*/, "").trim();
  return cleaned || body;
}

/**
 * Powiadom członków Team (active), z pominięciem muted i exceptUserId.
 */
export async function notifyTeamMembers(input: {
  teamId: string;
  exceptUserId?: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  groupKey?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureCriticalSchema();
    const db = getDb();
    const members = await db
      .select({
        userId: teamMembers.userId,
        muted: teamMembers.mutedNotifications,
      })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.status, "active"),
        ),
      );

    for (const m of members) {
      if (input.exceptUserId && m.userId === input.exceptUserId) continue;
      if (m.muted) continue;
      await emitNotification({
        userId: m.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
        actorUserId: input.actorUserId,
        actorDisplayName: input.actorDisplayName,
        teamId: input.teamId,
        entityType: input.entityType,
        entityId: input.entityId,
        groupKey: input.groupKey,
        payload: input.payload,
      });
    }
  } catch {
    /* nie psuj ścieżki biznesowej */
  }
}

export async function listNotifications(input: {
  userId: string;
  kind?: NotificationKind | null;
  unreadOnly?: boolean;
  beforeMs?: number | null;
  limit?: number;
}): Promise<NotificationView[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 80);

  const conds = [eq(notifications.userId, input.userId)];
  if (input.kind) conds.push(eq(notifications.kind, input.kind));
  if (input.unreadOnly) conds.push(isNull(notifications.readAt));
  if (input.beforeMs) {
    conds.push(lt(notifications.createdAt, new Date(input.beforeMs)));
  }

  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      actorUserId: notifications.actorUserId,
      teamId: notifications.teamId,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      groupKey: notifications.groupKey,
      collapsedCount: notifications.collapsedCount,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorUserId))
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const kind = isNotificationKind(r.kind) ? r.kind : "achievement";
    return {
      id: r.id,
      kind,
      title: r.title,
      body: r.body,
      href: r.href,
      actorUserId: r.actorUserId,
      actorDisplayName: r.actorUserId
        ? displayName({
            firstName: r.firstName,
            lastName: r.lastName,
            name: r.name,
            email: r.email ?? "",
          })
        : null,
      teamId: r.teamId,
      entityType: r.entityType,
      entityId: r.entityId,
      groupKey: r.groupKey,
      collapsedCount: r.collapsedCount,
      createdAt: r.createdAt.getTime(),
      readAt: r.readAt ? r.readAt.getTime() : null,
      unread: !r.readAt,
    };
  });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const cacheKey = `unread:${userId}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached != null) return cached;

  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  const count = Number(row?.count ?? 0);
  cacheSet(cacheKey, count, SSE_POLL.unreadTtlMs);
  return count;
}

export async function markNotificationsRead(input: {
  userId: string;
  ids?: string[] | null;
  all?: boolean;
}): Promise<{ ok: true; marked: number } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();

  if (input.all) {
    const unread = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(eq(notifications.userId, input.userId), isNull(notifications.readAt)),
      )
      .limit(500);
    if (unread.length === 0) return { ok: true, marked: 0 };
    const ids = unread.map((u) => u.id);
    await db
      .update(notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(notifications.userId, input.userId),
          inArray(notifications.id, ids),
        ),
      );
    for (const id of ids.slice(0, 40)) {
      await emitEvent({
        userId: input.userId,
        kind: "read",
        notificationId: id,
      });
    }
    cacheInvalidate(`unread:${input.userId}`);
    return { ok: true, marked: ids.length };
  }

  const ids = (input.ids ?? []).filter(Boolean).slice(0, 50);
  if (ids.length === 0) {
    return { ok: false, error: "Brak powiadomień do oznaczenia." };
  }

  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, input.userId),
        inArray(notifications.id, ids),
        isNull(notifications.readAt),
      ),
    );

  for (const id of ids) {
    await emitEvent({
      userId: input.userId,
      kind: "read",
      notificationId: id,
    });
  }
  cacheInvalidate(`unread:${input.userId}`);
  return { ok: true, marked: ids.length };
}

export async function listNotificationEventsSince(
  userId: string,
  sinceMs: number,
  limit = 40,
) {
  const cap = Math.min(80, Math.max(1, limit));
  const cacheKey = `notif-ev-head:${userId}`;
  type Ev = {
    id: string;
    kind: string;
    notificationId: string;
    createdAt: Date;
  };

  let head = cacheGet<Ev[]>(cacheKey);
  if (!head) {
    const db = getDb();
    head = await db
      .select({
        id: notificationEvents.id,
        kind: notificationEvents.kind,
        notificationId: notificationEvents.notificationId,
        createdAt: notificationEvents.createdAt,
      })
      .from(notificationEvents)
      .where(eq(notificationEvents.userId, userId))
      .orderBy(desc(notificationEvents.createdAt))
      .limit(80);
    cacheSet(cacheKey, head, SSE_POLL.eventsHeadTtlMs);
  }

  return head
    .filter((e) => e.createdAt.getTime() > sinceMs)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, cap);
}

/** Stub helpers — HoF / ranking podłączą się gdy moduły będą live. */
export async function notifyRankingChange(input: {
  teamId: string;
  weekKey: string;
  topDisplayName: string;
  scoreLabel: string;
  /** distinct_id emitenta (system / cron) — opcjonalnie. */
  actorUserId?: string | null;
}): Promise<void> {
  await notifyTeamMembers({
    teamId: input.teamId,
    kind: "ranking",
    title: "Nowy lider rankingu",
    body: `${input.topDisplayName} prowadzi (${input.scoreLabel}).`,
    href: `/community/teams/${input.teamId}`,
    groupKey: `ranking:week:${input.teamId}:${input.weekKey}`,
    entityType: "ranking",
    entityId: input.weekKey,
  });

  const { track } = await import("@/lib/analytics/track");
  track.rankingLeaderChanged(input.actorUserId || `system:team:${input.teamId}`, {
    team_id: input.teamId,
    week_key: input.weekKey,
    score_label: input.scoreLabel,
    top_display_name: input.topDisplayName,
  });
}

export async function notifyHallOfFameWin(input: {
  userId: string;
  teamId?: string | null;
  seasonKey: string;
  categoryLabel: string;
}): Promise<void> {
  await emitNotification({
    userId: input.userId,
    kind: "hall_of_fame",
    title: "Hall of Fame",
    body: `Wygrałeś kategorię ${input.categoryLabel} w sezonie ${input.seasonKey}.`,
    href: "/community/hall-of-fame",
    teamId: input.teamId ?? null,
    groupKey: `hof:${input.seasonKey}:${input.categoryLabel}`,
    entityType: "hof",
    entityId: input.seasonKey,
  });

  {
    const { track } = await import("@/lib/analytics/track");
    track.hofAwarded(input.userId, {
      season_key: input.seasonKey,
      category_label: input.categoryLabel,
      team_id: input.teamId ?? null,
    });
  }
  if (input.teamId) {
    await notifyTeamMembers({
      teamId: input.teamId,
      exceptUserId: input.userId,
      kind: "hall_of_fame",
      title: "Hall of Fame Team",
      body: `Nowy zwycięzca: ${input.categoryLabel} · ${input.seasonKey}.`,
      href: "/community/hall-of-fame",
      groupKey: `hof:team:${input.teamId}:${input.seasonKey}:${input.categoryLabel}`,
      entityType: "hof",
      entityId: input.seasonKey,
    });
  }
}
