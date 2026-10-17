import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  teamFeedEvents,
  teamMembers,
  teamPostComments,
  teamPostMedia,
  teamPostMentions,
  teamPostReactions,
  teamPosts,
  users,
} from "@/db/schema";
import {
  isFeedReactionKind,
  type FeedReactionKind,
} from "@/lib/community/feed-reactions";
import { resolveMentionUserIds } from "@/lib/community/feed-mentions";
import {
  isTeamPostType,
  type TeamPostType,
} from "@/lib/community/feed-types";
import {
  cacheGet,
  cacheInvalidate,
  cacheSet,
  SSE_POLL,
} from "@/lib/community/perf-cache";
import { getActiveMembership } from "@/lib/community/teams";

const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 1_200_000;
const MAX_BODY = 2000;
const MAX_COMMENT = 1000;
/** Preview komentarzy na listę feedu — reszta lazy przez API. */
const COMMENTS_PREVIEW = 5;

export type TeamFeedAuthor = {
  userId: string;
  displayName: string;
};

export type TeamFeedMedia = {
  id: string;
  mimeType: string;
  dataUrl: string;
  sortOrder: number;
};

export type TeamFeedComment = {
  id: string;
  author: TeamFeedAuthor;
  body: string;
  parentCommentId: string | null;
  createdAt: Date;
  mentions: string[];
};

export type TeamFeedPost = {
  id: string;
  teamId: string;
  type: TeamPostType;
  body: string;
  snapshot: Record<string, unknown>;
  author: TeamFeedAuthor;
  createdAt: Date;
  reactionCount: number;
  commentCount: number;
  myReaction: FeedReactionKind | null;
  reactionBreakdown: Partial<Record<FeedReactionKind, number>>;
  media: TeamFeedMedia[];
  comments: TeamFeedComment[];
  mentionUserIds: string[];
};

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

async function emitFeedEvent(input: {
  teamId: string;
  kind: string;
  entityId: string;
  actorUserId?: string | null;
}) {
  const db = getDb();
  await db.insert(teamFeedEvents).values({
    id: crypto.randomUUID(),
    teamId: input.teamId,
    kind: input.kind,
    entityId: input.entityId,
    actorUserId: input.actorUserId ?? null,
    createdAt: new Date(),
  });
  cacheInvalidate(`feed-ev-head:${input.teamId}`);
}

async function refreshReactionCount(postId: string) {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamPostReactions)
    .where(eq(teamPostReactions.postId, postId));
  await db
    .update(teamPosts)
    .set({ reactionCount: Number(row?.count ?? 0) })
    .where(eq(teamPosts.id, postId));
}

async function refreshCommentCount(postId: string) {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(teamPostComments)
    .where(
      and(
        eq(teamPostComments.postId, postId),
        isNull(teamPostComments.deletedAt),
      ),
    );
  await db
    .update(teamPosts)
    .set({ commentCount: Number(row?.count ?? 0) })
    .where(eq(teamPosts.id, postId));
}

export async function assertActiveTeamMember(teamId: string, userId: string) {
  const membership = await getActiveMembership(teamId, userId);
  if (!membership) {
    return { ok: false as const, error: "Nie jesteś członkiem tej grupy." };
  }
  return { ok: true as const, role: membership.role };
}

export async function createTeamPost(input: {
  teamId: string;
  authorUserId: string;
  type: TeamPostType;
  body?: string;
  snapshot?: Record<string, unknown>;
  sourceKey?: string | null;
  images?: Array<{ mimeType: string; dataUrl: string }>;
}): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const member = await assertActiveTeamMember(input.teamId, input.authorUserId);
  if (!member.ok) return member;

  const body = (input.body ?? "").trim().slice(0, MAX_BODY);
  const images = (input.images ?? []).slice(0, MAX_IMAGES);
  for (const img of images) {
    if (!img.dataUrl.startsWith("data:image/")) {
      return { ok: false, error: "Dozwolone są tylko obrazy." };
    }
    if (img.dataUrl.length > MAX_IMAGE_CHARS) {
      return { ok: false, error: "Zdjęcie jest za duże — skompresuj je." };
    }
  }

  const type: TeamPostType =
    images.length > 0 && (input.type === "text" || input.type === "gallery")
      ? images.length > 1 || body.length === 0
        ? "gallery"
        : input.type
      : input.type;

  if (!body && images.length === 0 && type === "text") {
    return { ok: false, error: "Napisz coś albo dodaj zdjęcie." };
  }

  const db = getDb();
  const postId = crypto.randomUUID();
  const now = new Date();

  try {
    await db.insert(teamPosts).values({
      id: postId,
      teamId: input.teamId,
      authorUserId: input.authorUserId,
      type,
      body,
      snapshotJson: JSON.stringify(input.snapshot ?? {}),
      sourceKey: input.sourceKey ?? null,
      reactionCount: 0,
      commentCount: 0,
      createdAt: now,
    });
  } catch (e) {
    const msg = String(e);
    if (/unique|constraint/i.test(msg) && input.sourceKey) {
      return { ok: true, postId: "duplicate" };
    }
    throw e;
  }

  if (images.length > 0) {
    await db.insert(teamPostMedia).values(
      images.map((img, index) => ({
        id: crypto.randomUUID(),
        postId,
        sortOrder: index,
        mimeType: img.mimeType || "image/jpeg",
        dataUrl: img.dataUrl,
        createdAt: now,
      })),
    );
  }

  const mentionIds = await resolveMentionUserIds(input.teamId, body);
  if (mentionIds.length > 0) {
    await db.insert(teamPostMentions).values(
      mentionIds.map((mentionedUserId) => ({
        id: crypto.randomUUID(),
        postId,
        commentId: null,
        mentionedUserId,
        createdByUserId: input.authorUserId,
        createdAt: now,
      })),
    );
  }

  await emitFeedEvent({
    teamId: input.teamId,
    kind: "post_created",
    entityId: postId,
    actorUserId: input.authorUserId,
  });

  {
    const { track } = await import("@/lib/analytics/track");
    const AUTO_TYPES = new Set([
      "workout_complete",
      "personal_record",
      "achievement",
      "streak",
      "challenge_complete",
      "level_up",
    ]);
    track.postPublished(input.authorUserId, {
      team_id: input.teamId,
      post_id: postId,
      post_type: type,
      has_media: images.length > 0,
      media_count: images.length,
      body_length: body.length,
      is_auto: !!input.sourceKey || AUTO_TYPES.has(type),
      mention_count: mentionIds.length,
    });
  }

  const isAnnouncement =
    type === "text" &&
    (input.snapshot as { announcement?: unknown } | undefined)?.announcement ===
      true;
  if (isAnnouncement) {
    void (async () => {
      try {
        const { notifyTeamMembers } = await import(
          "@/lib/community/notifications"
        );
        const [actor] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, input.authorUserId))
          .limit(1);
        const actorName = actor ? displayName(actor) : "Grupa";
        await notifyTeamMembers({
          teamId: input.teamId,
          exceptUserId: input.authorUserId,
          kind: "team_announcement",
          title: "Ogłoszenie grupy",
          body: body.slice(0, 160) || `${actorName} dodał ogłoszenie.`,
          href: `/community/teams/${input.teamId}`,
          actorUserId: input.authorUserId,
          actorDisplayName: actorName,
          entityType: "post",
          entityId: postId,
          groupKey: `announce:post:${postId}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  return { ok: true, postId };
}

/** Publikuje ten sam auto-post do aktywnych teamów użytkownika (opcjonalnie filtr teamIds). */
export async function publishAutoPostToUserTeams(input: {
  authorUserId: string;
  type: TeamPostType;
  body: string;
  snapshot: Record<string, unknown>;
  sourceKeySuffix: string;
  teamIds?: string[];
}): Promise<string[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, input.authorUserId),
        eq(teamMembers.status, "active"),
      ),
    );

  const allowed = input.teamIds?.length
    ? new Set(input.teamIds)
    : null;

  const postIds: string[] = [];
  for (const m of memberships) {
    if (allowed && !allowed.has(m.teamId)) continue;
    const result = await createTeamPost({
      teamId: m.teamId,
      authorUserId: input.authorUserId,
      type: input.type,
      body: input.body,
      snapshot: input.snapshot,
      sourceKey: `${input.sourceKeySuffix}`,
    });
    if (result.ok && result.postId !== "duplicate") {
      postIds.push(result.postId);
    }
  }
  return postIds;
}

export async function listTeamFeed(
  teamId: string,
  viewerId: string,
  opts?: { limit?: number; before?: Date; commentsPreview?: number },
): Promise<TeamFeedPost[]> {
  await ensureCriticalSchema();
  const member = await assertActiveTeamMember(teamId, viewerId);
  if (!member.ok) return [];

  const db = getDb();
  const limit = Math.min(40, Math.max(1, opts?.limit ?? 20));
  const commentsPreview = Math.min(
    20,
    Math.max(1, opts?.commentsPreview ?? COMMENTS_PREVIEW),
  );

  const rows = await db
    .select({
      id: teamPosts.id,
      teamId: teamPosts.teamId,
      type: teamPosts.type,
      body: teamPosts.body,
      snapshotJson: teamPosts.snapshotJson,
      reactionCount: teamPosts.reactionCount,
      commentCount: teamPosts.commentCount,
      createdAt: teamPosts.createdAt,
      authorUserId: teamPosts.authorUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(teamPosts)
    .innerJoin(users, eq(users.id, teamPosts.authorUserId))
    .where(
      and(
        eq(teamPosts.teamId, teamId),
        isNull(teamPosts.deletedAt),
        eq(teamPosts.moderationStatus, "visible"),
        opts?.before ? sql`${teamPosts.createdAt} < ${opts.before.getTime()}` : undefined,
      ),
    )
    .orderBy(desc(teamPosts.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.id);

  const [mediaRows, reactionAgg, commentRowsDesc, mentionRows, myReactions] =
    await Promise.all([
      db
        .select()
        .from(teamPostMedia)
        .where(inArray(teamPostMedia.postId, postIds))
        .orderBy(asc(teamPostMedia.sortOrder)),
      db
        .select({
          postId: teamPostReactions.postId,
          kind: teamPostReactions.kind,
          cnt: sql<number>`count(*)`.mapWith(Number),
        })
        .from(teamPostReactions)
        .where(inArray(teamPostReactions.postId, postIds))
        .groupBy(teamPostReactions.postId, teamPostReactions.kind),
      // Ostatnie N komentarzy łącznie (DESC) — potem cap per post (bez pełnego skanu wątku).
      db
        .select({
          id: teamPostComments.id,
          postId: teamPostComments.postId,
          body: teamPostComments.body,
          parentCommentId: teamPostComments.parentCommentId,
          createdAt: teamPostComments.createdAt,
          authorUserId: teamPostComments.authorUserId,
          firstName: users.firstName,
          lastName: users.lastName,
          name: users.name,
          email: users.email,
        })
        .from(teamPostComments)
        .innerJoin(users, eq(users.id, teamPostComments.authorUserId))
        .where(
          and(
            inArray(teamPostComments.postId, postIds),
            isNull(teamPostComments.deletedAt),
          ),
        )
        .orderBy(desc(teamPostComments.createdAt))
        .limit(postIds.length * commentsPreview),
      db
        .select()
        .from(teamPostMentions)
        .where(inArray(teamPostMentions.postId, postIds)),
      db
        .select({
          postId: teamPostReactions.postId,
          kind: teamPostReactions.kind,
        })
        .from(teamPostReactions)
        .where(
          and(
            inArray(teamPostReactions.postId, postIds),
            eq(teamPostReactions.userId, viewerId),
          ),
        ),
    ]);

  const myReactionByPost = new Map(
    myReactions.map((r) => [
      r.postId,
      isFeedReactionKind(r.kind) ? r.kind : null,
    ]),
  );

  const mediaByPost = new Map<string, TeamFeedMedia[]>();
  for (const m of mediaRows) {
    const list = mediaByPost.get(m.postId) ?? [];
    list.push({
      id: m.id,
      mimeType: m.mimeType,
      dataUrl: m.dataUrl,
      sortOrder: m.sortOrder,
    });
    mediaByPost.set(m.postId, list);
  }

  const breakdownByPost = new Map<
    string,
    Partial<Record<FeedReactionKind, number>>
  >();
  for (const r of reactionAgg) {
    if (!isFeedReactionKind(r.kind)) continue;
    const map = breakdownByPost.get(r.postId) ?? {};
    map[r.kind] = Number(r.cnt ?? 0);
    breakdownByPost.set(r.postId, map);
  }

  const commentsByPost = new Map<string, TeamFeedComment[]>();
  const keptCommentIds = new Set<string>();
  for (const c of commentRowsDesc) {
    const list = commentsByPost.get(c.postId) ?? [];
    if (list.length >= commentsPreview) continue;
    list.push({
      id: c.id,
      body: c.body,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      author: {
        userId: c.authorUserId,
        displayName: displayName(c),
      },
      mentions: [],
    });
    commentsByPost.set(c.postId, list);
    keptCommentIds.add(c.id);
  }
  // Wyświetlanie chronologiczne ASC
  for (const [pid, list] of commentsByPost) {
    commentsByPost.set(
      pid,
      [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    );
  }

  const mentionsByComment = new Map<string, string[]>();
  const mentionsByPost = new Map<string, string[]>();
  for (const m of mentionRows) {
    if (m.commentId) {
      if (!keptCommentIds.has(m.commentId)) continue;
      const list = mentionsByComment.get(m.commentId) ?? [];
      list.push(m.mentionedUserId);
      mentionsByComment.set(m.commentId, list);
    } else {
      const list = mentionsByPost.get(m.postId) ?? [];
      list.push(m.mentionedUserId);
      mentionsByPost.set(m.postId, list);
    }
  }
  for (const list of commentsByPost.values()) {
    for (const c of list) {
      c.mentions = mentionsByComment.get(c.id) ?? [];
    }
  }

  return rows
    .filter((row) => isTeamPostType(row.type))
    .map((row) => {
      let snapshot: Record<string, unknown> = {};
      try {
        snapshot = JSON.parse(row.snapshotJson) as Record<string, unknown>;
      } catch {
        snapshot = {};
      }
      return {
        id: row.id,
        teamId: row.teamId,
        type: row.type as TeamPostType,
        body: row.body,
        snapshot,
        author: {
          userId: row.authorUserId,
          displayName: displayName(row),
        },
        createdAt: row.createdAt,
        reactionCount: row.reactionCount,
        commentCount: row.commentCount,
        myReaction: myReactionByPost.get(row.id) ?? null,
        reactionBreakdown: breakdownByPost.get(row.id) ?? {},
        media: mediaByPost.get(row.id) ?? [],
        comments: commentsByPost.get(row.id) ?? [],
        mentionUserIds: mentionsByPost.get(row.id) ?? [],
      };
    });
}

export async function addTeamPostComment(input: {
  teamId: string;
  postId: string;
  authorUserId: string;
  body: string;
  parentCommentId?: string | null;
}) {
  await ensureCriticalSchema();
  const member = await assertActiveTeamMember(input.teamId, input.authorUserId);
  if (!member.ok) return member;

  const body = input.body.trim().slice(0, MAX_COMMENT);
  if (body.length < 1) {
    return { ok: false as const, error: "Komentarz nie może być pusty." };
  }

  const db = getDb();
  const [post] = await db
    .select({
      id: teamPosts.id,
      teamId: teamPosts.teamId,
      authorUserId: teamPosts.authorUserId,
    })
    .from(teamPosts)
    .where(
      and(
        eq(teamPosts.id, input.postId),
        eq(teamPosts.teamId, input.teamId),
        isNull(teamPosts.deletedAt),
      ),
    )
    .limit(1);
  if (!post) return { ok: false as const, error: "Post nie istnieje." };

  if (input.parentCommentId) {
    const [parent] = await db
      .select({ id: teamPostComments.id, parentCommentId: teamPostComments.parentCommentId })
      .from(teamPostComments)
      .where(
        and(
          eq(teamPostComments.id, input.parentCommentId),
          eq(teamPostComments.postId, input.postId),
          isNull(teamPostComments.deletedAt),
        ),
      )
      .limit(1);
    if (!parent) {
      return { ok: false as const, error: "Nie znaleziono komentarza nadrzędnego." };
    }
    if (parent.parentCommentId) {
      return {
        ok: false as const,
        error: "Odpowiedzi są jedno poziomowe.",
      };
    }
  }

  const commentId = crypto.randomUUID();
  const now = new Date();
  await db.insert(teamPostComments).values({
    id: commentId,
    postId: input.postId,
    authorUserId: input.authorUserId,
    parentCommentId: input.parentCommentId ?? null,
    body,
    createdAt: now,
  });

  const mentionIds = await resolveMentionUserIds(input.teamId, body);
  if (mentionIds.length > 0) {
    await db.insert(teamPostMentions).values(
      mentionIds.map((mentionedUserId) => ({
        id: crypto.randomUUID(),
        postId: input.postId,
        commentId,
        mentionedUserId,
        createdByUserId: input.authorUserId,
        createdAt: now,
      })),
    );
  }

  await refreshCommentCount(input.postId);
  await emitFeedEvent({
    teamId: input.teamId,
    kind: "comment_created",
    entityId: commentId,
    actorUserId: input.authorUserId,
  });

  {
    const { track } = await import("@/lib/analytics/track");
    track.postCommented(input.authorUserId, {
      team_id: input.teamId,
      post_id: input.postId,
      comment_id: commentId,
      is_reply: !!input.parentCommentId,
      mention_count: mentionIds.length,
      body_length: body.length,
    });
  }

  if (post.authorUserId !== input.authorUserId) {
    void (async () => {
      try {
        const { emitNotification } = await import(
          "@/lib/community/notifications"
        );
        const [actor] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, input.authorUserId))
          .limit(1);
        const actorName = actor ? displayName(actor) : "Ktoś";
        await emitNotification({
          userId: post.authorUserId,
          kind: "comment",
          title: "Nowy komentarz",
          body: `${actorName} skomentował Twój post.`,
          href: `/community/teams/${input.teamId}`,
          actorUserId: input.authorUserId,
          actorDisplayName: actorName,
          teamId: input.teamId,
          entityType: "post",
          entityId: input.postId,
          groupKey: `comment:post:${input.postId}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  return { ok: true as const, commentId };
}

export async function setTeamPostReaction(input: {
  teamId: string;
  postId: string;
  userId: string;
  kind: FeedReactionKind | null;
}) {
  await ensureCriticalSchema();
  const member = await assertActiveTeamMember(input.teamId, input.userId);
  if (!member.ok) return member;

  const db = getDb();
  const [post] = await db
    .select({ id: teamPosts.id, authorUserId: teamPosts.authorUserId })
    .from(teamPosts)
    .where(
      and(
        eq(teamPosts.id, input.postId),
        eq(teamPosts.teamId, input.teamId),
        isNull(teamPosts.deletedAt),
      ),
    )
    .limit(1);
  if (!post) return { ok: false as const, error: "Post nie istnieje." };

  const [existing] = await db
    .select({ id: teamPostReactions.id, kind: teamPostReactions.kind })
    .from(teamPostReactions)
    .where(
      and(
        eq(teamPostReactions.postId, input.postId),
        eq(teamPostReactions.userId, input.userId),
      ),
    )
    .limit(1);

  let reactionAction: "add" | "change" | "remove" | null = null;
  let reactionKind: string | null = input.kind;

  if (input.kind == null) {
    if (existing) {
      await db
        .delete(teamPostReactions)
        .where(eq(teamPostReactions.id, existing.id));
      reactionAction = "remove";
      reactionKind = existing.kind;
    }
  } else if (existing) {
    if (existing.kind === input.kind) {
      await db
        .delete(teamPostReactions)
        .where(eq(teamPostReactions.id, existing.id));
      reactionAction = "remove";
      reactionKind = existing.kind;
    } else {
      await db
        .update(teamPostReactions)
        .set({ kind: input.kind, createdAt: new Date() })
        .where(eq(teamPostReactions.id, existing.id));
      reactionAction = "change";
    }
  } else {
    await db.insert(teamPostReactions).values({
      id: crypto.randomUUID(),
      postId: input.postId,
      userId: input.userId,
      kind: input.kind,
      createdAt: new Date(),
    });
    reactionAction = "add";
  }

  await refreshReactionCount(input.postId);
  await emitFeedEvent({
    teamId: input.teamId,
    kind: "reaction_changed",
    entityId: input.postId,
    actorUserId: input.userId,
  });

  if (reactionAction) {
    const { track } = await import("@/lib/analytics/track");
    track.postReacted(input.userId, {
      team_id: input.teamId,
      post_id: input.postId,
      reaction_kind: reactionKind,
      action: reactionAction,
    });
  }

  if (
    input.kind != null &&
    post.authorUserId !== input.userId &&
    (!existing || existing.kind !== input.kind)
  ) {
    void (async () => {
      try {
        const { emitNotification } = await import(
          "@/lib/community/notifications"
        );
        const [actor] = await db
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        const actorName = actor ? displayName(actor) : "Ktoś";
        await emitNotification({
          userId: post.authorUserId,
          kind: "reaction",
          title: "Nowa reakcja",
          body: `${actorName} zareagował na Twój post.`,
          href: `/community/teams/${input.teamId}`,
          actorUserId: input.userId,
          actorDisplayName: actorName,
          teamId: input.teamId,
          entityType: "post",
          entityId: input.postId,
          groupKey: `reaction:post:${input.postId}`,
        });
      } catch {
        /* ignore */
      }
    })();
  }

  return { ok: true as const };
}

export async function deleteTeamPost(input: {
  teamId: string;
  postId: string;
  userId: string;
}) {
  await ensureCriticalSchema();
  const member = await assertActiveTeamMember(input.teamId, input.userId);
  if (!member.ok) return member;

  const db = getDb();
  const [post] = await db
    .select({
      id: teamPosts.id,
      authorUserId: teamPosts.authorUserId,
    })
    .from(teamPosts)
    .where(
      and(
        eq(teamPosts.id, input.postId),
        eq(teamPosts.teamId, input.teamId),
        isNull(teamPosts.deletedAt),
      ),
    )
    .limit(1);
  if (!post) return { ok: false as const, error: "Post nie istnieje." };

  const canDelete =
    post.authorUserId === input.userId ||
    member.role === "owner" ||
    member.role === "admin" ||
    member.role === "moderator";
  if (!canDelete) {
    return { ok: false as const, error: "Brak uprawnień do usunięcia posta." };
  }

  await db
    .update(teamPosts)
    .set({ deletedAt: new Date() })
    .where(eq(teamPosts.id, input.postId));

  await emitFeedEvent({
    teamId: input.teamId,
    kind: "post_deleted",
    entityId: input.postId,
    actorUserId: input.userId,
  });

  return { ok: true as const };
}

export async function listTeamFeedEventsSince(
  teamId: string,
  sinceMs: number,
  limit = 50,
) {
  await ensureCriticalSchema();
  const cap = Math.min(80, Math.max(1, limit));
  const cacheKey = `feed-ev-head:${teamId}`;
  type Ev = {
    id: string;
    kind: string;
    entityId: string;
    actorUserId: string | null;
    createdAt: Date;
  };

  let head = cacheGet<Ev[]>(cacheKey);
  if (!head) {
    const db = getDb();
    head = await db
      .select({
        id: teamFeedEvents.id,
        kind: teamFeedEvents.kind,
        entityId: teamFeedEvents.entityId,
        actorUserId: teamFeedEvents.actorUserId,
        createdAt: teamFeedEvents.createdAt,
      })
      .from(teamFeedEvents)
      .where(eq(teamFeedEvents.teamId, teamId))
      .orderBy(desc(teamFeedEvents.createdAt))
      .limit(80);
    cacheSet(cacheKey, head, SSE_POLL.eventsHeadTtlMs);
  }

  return head
    .filter((e) => e.createdAt.getTime() > sinceMs)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, cap);
}

/** Lazy: pełna strona komentarzy pod postem (infinite / „pokaż więcej”). */
export async function listTeamFeedComments(
  teamId: string,
  postId: string,
  viewerId: string,
  opts?: { before?: Date; limit?: number },
): Promise<{ comments: TeamFeedComment[]; hasMore: boolean }> {
  await ensureCriticalSchema();
  const member = await assertActiveTeamMember(teamId, viewerId);
  if (!member.ok) return { comments: [], hasMore: false };

  const db = getDb();
  const [post] = await db
    .select({ id: teamPosts.id, teamId: teamPosts.teamId })
    .from(teamPosts)
    .where(
      and(
        eq(teamPosts.id, postId),
        eq(teamPosts.teamId, teamId),
        isNull(teamPosts.deletedAt),
      ),
    )
    .limit(1);
  if (!post) return { comments: [], hasMore: false };

  const limit = Math.min(40, Math.max(1, opts?.limit ?? 20));
  const rows = await db
    .select({
      id: teamPostComments.id,
      body: teamPostComments.body,
      parentCommentId: teamPostComments.parentCommentId,
      createdAt: teamPostComments.createdAt,
      authorUserId: teamPostComments.authorUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(teamPostComments)
    .innerJoin(users, eq(users.id, teamPostComments.authorUserId))
    .where(
      and(
        eq(teamPostComments.postId, postId),
        isNull(teamPostComments.deletedAt),
        opts?.before
          ? sql`${teamPostComments.createdAt} < ${opts.before.getTime()}`
          : undefined,
      ),
    )
    .orderBy(desc(teamPostComments.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
  const commentIds = page.map((c) => c.id);
  const mentionRows =
    commentIds.length === 0
      ? []
      : await db
          .select()
          .from(teamPostMentions)
          .where(inArray(teamPostMentions.commentId, commentIds));

  const mentionsByComment = new Map<string, string[]>();
  for (const m of mentionRows) {
    if (!m.commentId) continue;
    const list = mentionsByComment.get(m.commentId) ?? [];
    list.push(m.mentionedUserId);
    mentionsByComment.set(m.commentId, list);
  }

  return {
    comments: page.map((c) => ({
      id: c.id,
      body: c.body,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      author: {
        userId: c.authorUserId,
        displayName: displayName(c),
      },
      mentions: mentionsByComment.get(c.id) ?? [],
    })),
    hasMore,
  };
}
