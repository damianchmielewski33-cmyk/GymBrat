import { and, asc, desc, eq, gt, inArray, isNull, like, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  chatChannels,
  chatEvents,
  chatMentions,
  chatMessageReactions,
  chatMessages,
  chatReadStates,
  chatTyping,
  groupWorkoutParticipants,
  groupWorkoutSessions,
  users,
} from "@/db/schema";
import {
  extractMentionTokens,
  listTeamMentionCandidates,
  resolveMentionUserIds,
  type MentionCandidate,
} from "@/lib/community/feed-mentions";
import { getActiveMembership } from "@/lib/community/teams";
import {
  CHAT_KINDS,
  CHAT_QUICK_EMOJI,
  type ChatChannelView,
  type ChatKind,
  type ChatMessageView,
  type ChatReactionBucket,
  type ChatTypingUser,
} from "@/lib/community/chat-types";
import {
  cacheGet,
  cacheInvalidate,
  cacheSet,
  SSE_POLL,
} from "@/lib/community/perf-cache";

const MAX_BODY = 2000;
const TYPING_TTL_MS = 4000;
const MESSAGE_PAGE = 40;

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

export function isChatKind(value: string): value is ChatKind {
  return (CHAT_KINDS as readonly string[]).includes(value);
}

export function isAllowedChatEmoji(emoji: string): boolean {
  if ((CHAT_QUICK_EMOJI as readonly string[]).includes(emoji)) return true;
  // Pozwól na pojedyncze emoji Unicode (1–8 code points / surrogate pairs).
  const trimmed = emoji.trim();
  if (trimmed.length < 1 || trimmed.length > 16) return false;
  return /\p{Extended_Pictographic}/u.test(trimmed);
}

function scopeKeyFor(kind: ChatKind, id: string): string {
  return `${kind}:${id}`;
}

async function emitChatEvent(input: {
  channelId: string;
  kind: string;
  entityId: string;
  actorUserId?: string | null;
}) {
  const db = getDb();
  await db.insert(chatEvents).values({
    id: crypto.randomUUID(),
    channelId: input.channelId,
    kind: input.kind,
    entityId: input.entityId,
    actorUserId: input.actorUserId ?? null,
    createdAt: new Date(),
  });
  cacheInvalidate(`chat-ev-head:${input.channelId}`);
}

export async function assertChannelAccess(
  channelId: string,
  userId: string,
): Promise<
  | { ok: true; channel: typeof chatChannels.$inferSelect }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const db = getDb();
  const [channel] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId))
    .limit(1);
  if (!channel) return { ok: false, error: "Czat nie istnieje." };

  if (channel.kind === "team" || channel.kind === "challenge") {
    if (!channel.teamId) {
      return { ok: false, error: "Brak dostępu do czatu." };
    }
    const membership = await getActiveMembership(channel.teamId, userId);
    if (!membership) {
      return { ok: false, error: "Musisz być w Team, by korzystać z czatu." };
    }
    return { ok: true, channel };
  }

  if (channel.kind === "workout") {
    if (!channel.groupSessionId) {
      return { ok: false, error: "Brak dostępu do czatu treningowego." };
    }
    const [session] = await db
      .select({
        teamId: groupWorkoutSessions.teamId,
        status: groupWorkoutSessions.status,
      })
      .from(groupWorkoutSessions)
      .where(eq(groupWorkoutSessions.id, channel.groupSessionId))
      .limit(1);
    if (!session) return { ok: false, error: "Sesja treningowa nie istnieje." };

    const membership = await getActiveMembership(session.teamId, userId);
    if (!membership) {
      return { ok: false, error: "Musisz być w Team tej sesji." };
    }

    const [participant] = await db
      .select({ status: groupWorkoutParticipants.status })
      .from(groupWorkoutParticipants)
      .where(
        and(
          eq(groupWorkoutParticipants.sessionId, channel.groupSessionId),
          eq(groupWorkoutParticipants.userId, userId),
        ),
      )
      .limit(1);

    // Członek Team widzi historię; aktywny uczestnik może pisać (sprawdzane przy write).
    if (!participant && session.status === "live") {
      // Dozwolone czytanie dla członków Team — write wymaga join.
    }
    return { ok: true, channel };
  }

  return { ok: false, error: "Nieznany typ czatu." };
}

async function assertCanWrite(
  channel: typeof chatChannels.$inferSelect,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (channel.kind === "workout" && channel.groupSessionId) {
    const db = getDb();
    const [participant] = await db
      .select({ status: groupWorkoutParticipants.status })
      .from(groupWorkoutParticipants)
      .where(
        and(
          eq(groupWorkoutParticipants.sessionId, channel.groupSessionId),
          eq(groupWorkoutParticipants.userId, userId),
          eq(groupWorkoutParticipants.status, "joined"),
        ),
      )
      .limit(1);
    if (!participant) {
      return {
        ok: false,
        error: "Dołącz do sesji grupowej, aby pisać na czacie treningowym.",
      };
    }
  }
  return { ok: true };
}

export async function getOrCreateTeamChatChannel(input: {
  teamId: string;
  userId: string;
  title?: string;
}): Promise<
  | { ok: true; channelId: string }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const membership = await getActiveMembership(input.teamId, input.userId);
  if (!membership) {
    return { ok: false, error: "Musisz być w Team." };
  }

  const scopeKey = scopeKeyFor("team", input.teamId);
  const db = getDb();
  const [existing] = await db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(eq(chatChannels.scopeKey, scopeKey))
    .limit(1);
  if (existing) return { ok: true, channelId: existing.id };

  const id = crypto.randomUUID();
  try {
    await db.insert(chatChannels).values({
      id,
      scopeKey,
      kind: "team",
      teamId: input.teamId,
      title: input.title?.trim() || "Czat grupy",
      createdAt: new Date(),
    });
  } catch {
    const [race] = await db
      .select({ id: chatChannels.id })
      .from(chatChannels)
      .where(eq(chatChannels.scopeKey, scopeKey))
      .limit(1);
    if (race) return { ok: true, channelId: race.id };
    return { ok: false, error: "Nie udało się otworzyć czatu." };
  }
  return { ok: true, channelId: id };
}

export async function getOrCreateWorkoutChatChannel(input: {
  groupSessionId: string;
  userId: string;
}): Promise<
  | { ok: true; channelId: string; teamId: string }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const db = getDb();
  const [session] = await db
    .select({
      id: groupWorkoutSessions.id,
      teamId: groupWorkoutSessions.teamId,
      title: groupWorkoutSessions.title,
      status: groupWorkoutSessions.status,
    })
    .from(groupWorkoutSessions)
    .where(eq(groupWorkoutSessions.id, input.groupSessionId))
    .limit(1);
  if (!session) return { ok: false, error: "Sesja nie istnieje." };

  const membership = await getActiveMembership(session.teamId, input.userId);
  if (!membership) {
    return { ok: false, error: "Musisz być w Team tej sesji." };
  }

  const scopeKey = scopeKeyFor("workout", session.id);
  const [existing] = await db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(eq(chatChannels.scopeKey, scopeKey))
    .limit(1);
  if (existing) {
    return { ok: true, channelId: existing.id, teamId: session.teamId };
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(chatChannels).values({
      id,
      scopeKey,
      kind: "workout",
      teamId: session.teamId,
      groupSessionId: session.id,
      title: session.title || "Czat treningowy",
      createdAt: new Date(),
    });
  } catch {
    const [race] = await db
      .select({ id: chatChannels.id })
      .from(chatChannels)
      .where(eq(chatChannels.scopeKey, scopeKey))
      .limit(1);
    if (race) {
      return { ok: true, channelId: race.id, teamId: session.teamId };
    }
    return { ok: false, error: "Nie udało się otworzyć czatu treningowego." };
  }
  return { ok: true, channelId: id, teamId: session.teamId };
}

export async function getOrCreateChallengeChatChannel(input: {
  challengeId: string;
  teamId: string;
  userId: string;
  title?: string;
}): Promise<
  | { ok: true; channelId: string }
  | { ok: false; error: string }
> {
  await ensureCriticalSchema();
  const membership = await getActiveMembership(input.teamId, input.userId);
  if (!membership) {
    return { ok: false, error: "Musisz być w Team challenge'u." };
  }

  const scopeKey = scopeKeyFor("challenge", input.challengeId);
  const db = getDb();
  const [existing] = await db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(eq(chatChannels.scopeKey, scopeKey))
    .limit(1);
  if (existing) return { ok: true, channelId: existing.id };

  const id = crypto.randomUUID();
  try {
    await db.insert(chatChannels).values({
      id,
      scopeKey,
      kind: "challenge",
      teamId: input.teamId,
      challengeId: input.challengeId,
      title: input.title?.trim() || "Czat challenge",
      createdAt: new Date(),
    });
  } catch {
    const [race] = await db
      .select({ id: chatChannels.id })
      .from(chatChannels)
      .where(eq(chatChannels.scopeKey, scopeKey))
      .limit(1);
    if (race) return { ok: true, channelId: race.id };
    return { ok: false, error: "Nie udało się otworzyć czatu challenge." };
  }
  return { ok: true, channelId: id };
}

async function loadMessagesByIds(
  messageIds: string[],
  viewerId: string,
): Promise<ChatMessageView[]> {
  if (messageIds.length === 0) return [];
  const db = getDb();

  const rows = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      body: chatMessages.body,
      parentMessageId: chatMessages.parentMessageId,
      createdAt: chatMessages.createdAt,
      editedAt: chatMessages.editedAt,
      deletedAt: chatMessages.deletedAt,
      authorUserId: chatMessages.authorUserId,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.authorUserId))
    .where(inArray(chatMessages.id, messageIds));

  const parentIds = [
    ...new Set(
      rows
        .map((r) => r.parentMessageId)
        .filter((id): id is string => !!id),
    ),
  ];
  const parentMap = new Map<string, string>();
  if (parentIds.length > 0) {
    const parents = await db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        deletedAt: chatMessages.deletedAt,
      })
      .from(chatMessages)
      .where(inArray(chatMessages.id, parentIds));
    for (const p of parents) {
      parentMap.set(
        p.id,
        p.deletedAt ? "(usunięta wiadomość)" : p.body.slice(0, 120),
      );
    }
  }

  const reactions = await db
    .select({
      messageId: chatMessageReactions.messageId,
      emoji: chatMessageReactions.emoji,
      userId: chatMessageReactions.userId,
    })
    .from(chatMessageReactions)
    .where(inArray(chatMessageReactions.messageId, messageIds));

  const reactionMap = new Map<string, ChatReactionBucket[]>();
  for (const r of reactions) {
    const list = reactionMap.get(r.messageId) ?? [];
    const existing = list.find((b) => b.emoji === r.emoji);
    if (existing) {
      existing.count += 1;
      if (r.userId === viewerId) existing.me = true;
    } else {
      list.push({
        emoji: r.emoji,
        count: 1,
        me: r.userId === viewerId,
      });
    }
    reactionMap.set(r.messageId, list);
  }

  const mentions = await db
    .select({
      messageId: chatMentions.messageId,
      mentionedUserId: chatMentions.mentionedUserId,
    })
    .from(chatMentions)
    .where(inArray(chatMentions.messageId, messageIds));
  const mentionMap = new Map<string, string[]>();
  for (const m of mentions) {
    const list = mentionMap.get(m.messageId) ?? [];
    list.push(m.mentionedUserId);
    mentionMap.set(m.messageId, list);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return messageIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => {
      const deleted = !!r.deletedAt;
      return {
        id: r.id,
        channelId: r.channelId,
        body: deleted ? "Wiadomość usunięta" : r.body,
        author: {
          userId: r.authorUserId,
          displayName: displayName(r),
        },
        parentMessageId: r.parentMessageId,
        parentPreview: r.parentMessageId
          ? (parentMap.get(r.parentMessageId) ?? null)
          : null,
        createdAt: r.createdAt.getTime(),
        editedAt: r.editedAt ? r.editedAt.getTime() : null,
        deleted,
        reactions: deleted
          ? []
          : (reactionMap.get(r.id) ?? []).sort((a, b) =>
              a.emoji.localeCompare(b.emoji),
            ),
        mentionUserIds: deleted ? [] : (mentionMap.get(r.id) ?? []),
      } satisfies ChatMessageView;
    });
}

export async function listChatMessages(input: {
  channelId: string;
  viewerId: string;
  beforeMs?: number | null;
  limit?: number;
}): Promise<
  | { ok: true; messages: ChatMessageView[]; hasMore: boolean }
  | { ok: false; error: string }
> {
  const access = await assertChannelAccess(input.channelId, input.viewerId);
  if (!access.ok) return access;

  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? MESSAGE_PAGE, 1), 80);
  const before = input.beforeMs ? new Date(input.beforeMs) : null;

  const rows = await db
    .select({
      id: chatMessages.id,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(
      before
        ? and(
            eq(chatMessages.channelId, input.channelId),
            lt(chatMessages.createdAt, before),
          )
        : eq(chatMessages.channelId, input.channelId),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const messages = await loadMessagesByIds(
    page.map((r) => r.id),
    input.viewerId,
  );
  return { ok: true, messages, hasMore };
}

export async function searchChatMessages(input: {
  channelId: string;
  viewerId: string;
  query: string;
  limit?: number;
}): Promise<
  | { ok: true; messages: ChatMessageView[] }
  | { ok: false; error: string }
> {
  const access = await assertChannelAccess(input.channelId, input.viewerId);
  if (!access.ok) return access;

  const q = input.query.trim().slice(0, 80);
  if (q.length < 2) {
    return { ok: false, error: "Wpisz co najmniej 2 znaki." };
  }
  const escaped = q.replace(/[%_\\]/g, "");
  if (escaped.length < 2) {
    return { ok: false, error: "Wpisz co najmniej 2 znaki." };
  }

  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
  const rows = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.channelId, input.channelId),
        isNull(chatMessages.deletedAt),
        like(chatMessages.body, `%${escaped}%`),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  const messages = await loadMessagesByIds(
    rows.map((r) => r.id),
    input.viewerId,
  );
  return { ok: true, messages };
}

export async function sendChatMessage(input: {
  channelId: string;
  authorUserId: string;
  body: string;
  parentMessageId?: string | null;
}): Promise<
  | { ok: true; messageId: string; message: ChatMessageView }
  | { ok: false; error: string }
> {
  const access = await assertChannelAccess(input.channelId, input.authorUserId);
  if (!access.ok) return access;

  const canWrite = await assertCanWrite(access.channel, input.authorUserId);
  if (!canWrite.ok) return canWrite;

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Wiadomość nie może być pusta." };
  if (body.length > MAX_BODY) {
    return { ok: false, error: `Maks. ${MAX_BODY} znaków.` };
  }

  const db = getDb();
  if (input.parentMessageId) {
    const [parent] = await db
      .select({ id: chatMessages.id, channelId: chatMessages.channelId })
      .from(chatMessages)
      .where(eq(chatMessages.id, input.parentMessageId))
      .limit(1);
    if (!parent || parent.channelId !== input.channelId) {
      return { ok: false, error: "Nieprawidłowa wiadomość do odpowiedzi." };
    }
  }

  const messageId = crypto.randomUUID();
  const now = new Date();
  await db.insert(chatMessages).values({
    id: messageId,
    channelId: input.channelId,
    authorUserId: input.authorUserId,
    body,
    parentMessageId: input.parentMessageId ?? null,
    createdAt: now,
  });

  const teamId = access.channel.teamId;
  if (teamId) {
    const mentionIds = await resolveMentionUserIds(teamId, body);
    if (mentionIds.length > 0) {
      await db.insert(chatMentions).values(
        mentionIds.map((mentionedUserId) => ({
          id: crypto.randomUUID(),
          messageId,
          mentionedUserId,
          createdAt: now,
        })),
      );
    }
  } else {
    // workout bez teamId — nie powinno się zdarzyć; tokens ignorowane
    void extractMentionTokens(body);
  }

  await emitChatEvent({
    channelId: input.channelId,
    kind: "message",
    entityId: messageId,
    actorUserId: input.authorUserId,
  });

  // Wyczyść typing autora
  await db
    .delete(chatTyping)
    .where(
      and(
        eq(chatTyping.channelId, input.channelId),
        eq(chatTyping.userId, input.authorUserId),
      ),
    );

  const [loaded] = await loadMessagesByIds([messageId], input.authorUserId);
  if (!loaded) {
    return { ok: false, error: "Nie udało się wczytać wiadomości." };
  }
  return { ok: true, messageId, message: loaded };
}

export async function editChatMessage(input: {
  messageId: string;
  userId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const db = getDb();
  const [msg] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, input.messageId))
    .limit(1);
  if (!msg || msg.deletedAt) {
    return { ok: false, error: "Wiadomość nie istnieje." };
  }
  if (msg.authorUserId !== input.userId) {
    return { ok: false, error: "Możesz edytować tylko własne wiadomości." };
  }

  const access = await assertChannelAccess(msg.channelId, input.userId);
  if (!access.ok) return access;

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Wiadomość nie może być pusta." };
  if (body.length > MAX_BODY) {
    return { ok: false, error: `Maks. ${MAX_BODY} znaków.` };
  }

  await db
    .update(chatMessages)
    .set({ body, editedAt: new Date() })
    .where(eq(chatMessages.id, input.messageId));

  await db.delete(chatMentions).where(eq(chatMentions.messageId, input.messageId));
  if (access.channel.teamId) {
    const mentionIds = await resolveMentionUserIds(access.channel.teamId, body);
    if (mentionIds.length > 0) {
      await db.insert(chatMentions).values(
        mentionIds.map((mentionedUserId) => ({
          id: crypto.randomUUID(),
          messageId: input.messageId,
          mentionedUserId,
          createdAt: new Date(),
        })),
      );
    }
  }

  await emitChatEvent({
    channelId: msg.channelId,
    kind: "message",
    entityId: input.messageId,
    actorUserId: input.userId,
  });
  return { ok: true };
}

export async function deleteChatMessage(input: {
  messageId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const db = getDb();
  const [msg] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, input.messageId))
    .limit(1);
  if (!msg) return { ok: false, error: "Wiadomość nie istnieje." };

  const access = await assertChannelAccess(msg.channelId, input.userId);
  if (!access.ok) return access;

  if (msg.authorUserId !== input.userId) {
    return { ok: false, error: "Możesz usuwać tylko własne wiadomości." };
  }

  await db
    .update(chatMessages)
    .set({ deletedAt: new Date(), body: "" })
    .where(eq(chatMessages.id, input.messageId));

  await emitChatEvent({
    channelId: msg.channelId,
    kind: "message",
    entityId: input.messageId,
    actorUserId: input.userId,
  });
  return { ok: true };
}

export async function toggleChatReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<
  | { ok: true; added: boolean }
  | { ok: false; error: string }
> {
  if (!isAllowedChatEmoji(input.emoji)) {
    return { ok: false, error: "Niedozwolone emoji." };
  }

  await ensureCriticalSchema();
  const db = getDb();
  const [msg] = await db
    .select({
      id: chatMessages.id,
      channelId: chatMessages.channelId,
      deletedAt: chatMessages.deletedAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.id, input.messageId))
    .limit(1);
  if (!msg || msg.deletedAt) {
    return { ok: false, error: "Wiadomość nie istnieje." };
  }

  const access = await assertChannelAccess(msg.channelId, input.userId);
  if (!access.ok) return access;

  const [existing] = await db
    .select({ id: chatMessageReactions.id })
    .from(chatMessageReactions)
    .where(
      and(
        eq(chatMessageReactions.messageId, input.messageId),
        eq(chatMessageReactions.userId, input.userId),
        eq(chatMessageReactions.emoji, input.emoji),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .delete(chatMessageReactions)
      .where(eq(chatMessageReactions.id, existing.id));
    await emitChatEvent({
      channelId: msg.channelId,
      kind: "reaction",
      entityId: input.messageId,
      actorUserId: input.userId,
    });
    return { ok: true, added: false };
  }

  await db.insert(chatMessageReactions).values({
    id: crypto.randomUUID(),
    messageId: input.messageId,
    userId: input.userId,
    emoji: input.emoji,
    createdAt: new Date(),
  });
  await emitChatEvent({
    channelId: msg.channelId,
    kind: "reaction",
    entityId: input.messageId,
    actorUserId: input.userId,
  });
  return { ok: true, added: true };
}

export async function markChannelRead(input: {
  channelId: string;
  userId: string;
  lastReadMessageId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await assertChannelAccess(input.channelId, input.userId);
  if (!access.ok) return access;

  const db = getDb();
  let lastId = input.lastReadMessageId ?? null;
  if (!lastId) {
    const [latest] = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.channelId, input.channelId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);
    lastId = latest?.id ?? null;
  }

  const now = new Date();
  const [existing] = await db
    .select({ userId: chatReadStates.userId })
    .from(chatReadStates)
    .where(
      and(
        eq(chatReadStates.userId, input.userId),
        eq(chatReadStates.channelId, input.channelId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(chatReadStates)
      .set({
        lastReadMessageId: lastId,
        lastReadAt: now,
      })
      .where(
        and(
          eq(chatReadStates.userId, input.userId),
          eq(chatReadStates.channelId, input.channelId),
        ),
      );
  } else {
    await db.insert(chatReadStates).values({
      userId: input.userId,
      channelId: input.channelId,
      lastReadMessageId: lastId,
      lastReadAt: now,
    });
  }

  await emitChatEvent({
    channelId: input.channelId,
    kind: "read",
    entityId: lastId ?? input.channelId,
    actorUserId: input.userId,
  });
  return { ok: true };
}

export async function setTyping(input: {
  channelId: string;
  userId: string;
  typing: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await assertChannelAccess(input.channelId, input.userId);
  if (!access.ok) return access;

  const db = getDb();
  if (!input.typing) {
    await db
      .delete(chatTyping)
      .where(
        and(
          eq(chatTyping.channelId, input.channelId),
          eq(chatTyping.userId, input.userId),
        ),
      );
  } else {
    const [existing] = await db
      .select({ userId: chatTyping.userId })
      .from(chatTyping)
      .where(
        and(
          eq(chatTyping.channelId, input.channelId),
          eq(chatTyping.userId, input.userId),
        ),
      )
      .limit(1);
    const now = new Date();
    if (existing) {
      await db
        .update(chatTyping)
        .set({ updatedAt: now })
        .where(
          and(
            eq(chatTyping.channelId, input.channelId),
            eq(chatTyping.userId, input.userId),
          ),
        );
    } else {
      await db.insert(chatTyping).values({
        channelId: input.channelId,
        userId: input.userId,
        updatedAt: now,
      });
    }
  }

  await emitChatEvent({
    channelId: input.channelId,
    kind: "typing",
    entityId: input.userId,
    actorUserId: input.userId,
  });
  return { ok: true };
}

export async function listTypingUsers(
  channelId: string,
  viewerId: string,
): Promise<ChatTypingUser[]> {
  const access = await assertChannelAccess(channelId, viewerId);
  if (!access.ok) return [];

  const db = getDb();
  const cutoff = new Date(Date.now() - TYPING_TTL_MS);
  const rows = await db
    .select({
      userId: chatTyping.userId,
      updatedAt: chatTyping.updatedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
    })
    .from(chatTyping)
    .innerJoin(users, eq(users.id, chatTyping.userId))
    .where(
      and(eq(chatTyping.channelId, channelId), gt(chatTyping.updatedAt, cutoff)),
    );

  return rows
    .filter((r) => r.userId !== viewerId)
    .map((r) => ({
      userId: r.userId,
      displayName: displayName(r),
    }));
}

export async function getChannelView(
  channelId: string,
  viewerId: string,
): Promise<ChatChannelView | null> {
  const access = await assertChannelAccess(channelId, viewerId);
  if (!access.ok) return null;

  const db = getDb();
  const [read] = await db
    .select({
      lastReadAt: chatReadStates.lastReadAt,
      lastReadMessageId: chatReadStates.lastReadMessageId,
    })
    .from(chatReadStates)
    .where(
      and(
        eq(chatReadStates.userId, viewerId),
        eq(chatReadStates.channelId, channelId),
      ),
    )
    .limit(1);

  let unreadCount = 0;
  if (read?.lastReadAt) {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channelId),
          gt(chatMessages.createdAt, read.lastReadAt),
          isNull(chatMessages.deletedAt),
        ),
      );
    unreadCount = Number(row?.count ?? 0);
  } else {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.channelId, channelId),
          isNull(chatMessages.deletedAt),
        ),
      );
    unreadCount = Number(row?.count ?? 0);
  }

  return {
    id: access.channel.id,
    kind: access.channel.kind as ChatKind,
    title: access.channel.title,
    teamId: access.channel.teamId,
    groupSessionId: access.channel.groupSessionId,
    challengeId: access.channel.challengeId,
    unreadCount,
  };
}

export async function listChatEventsSince(
  channelId: string,
  sinceMs: number,
  limit = 40,
) {
  const cap = Math.min(80, Math.max(1, limit));
  const cacheKey = `chat-ev-head:${channelId}`;
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
        id: chatEvents.id,
        kind: chatEvents.kind,
        entityId: chatEvents.entityId,
        actorUserId: chatEvents.actorUserId,
        createdAt: chatEvents.createdAt,
      })
      .from(chatEvents)
      .where(eq(chatEvents.channelId, channelId))
      .orderBy(desc(chatEvents.createdAt))
      .limit(80);
    cacheSet(cacheKey, head, SSE_POLL.eventsHeadTtlMs);
  }

  return head
    .filter((e) => e.createdAt.getTime() > sinceMs)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, cap);
}

export async function listChannelMentionCandidates(
  channelId: string,
  userId: string,
): Promise<MentionCandidate[]> {
  const access = await assertChannelAccess(channelId, userId);
  if (!access.ok || !access.channel.teamId) return [];
  return listTeamMentionCandidates(access.channel.teamId);
}

export async function getMessagesSince(input: {
  channelId: string;
  viewerId: string;
  sinceMs: number;
}): Promise<ChatMessageView[]> {
  const access = await assertChannelAccess(input.channelId, input.viewerId);
  if (!access.ok) return [];

  const db = getDb();
  const rows = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.channelId, input.channelId),
        gt(chatMessages.createdAt, new Date(input.sinceMs)),
      ),
    )
    .orderBy(asc(chatMessages.createdAt))
    .limit(80);

  return loadMessagesByIds(
    rows.map((r) => r.id),
    input.viewerId,
  );
}

export async function getChatMessagesByIds(input: {
  channelId: string;
  viewerId: string;
  messageIds: string[];
}): Promise<ChatMessageView[]> {
  const access = await assertChannelAccess(input.channelId, input.viewerId);
  if (!access.ok) return [];
  const ids = [...new Set(input.messageIds)].slice(0, 50);
  if (ids.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.channelId, input.channelId),
        inArray(chatMessages.id, ids),
      ),
    );
  return loadMessagesByIds(
    rows.map((r) => r.id),
    input.viewerId,
  );
}
