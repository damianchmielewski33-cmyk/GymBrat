import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  getChannelView,
  getOrCreateChallengeChatChannel,
  getOrCreateTeamChatChannel,
  getOrCreateWorkoutChatChannel,
  listChannelMentionCandidates,
  listChatMessages,
} from "@/lib/community/chat";
import { UserMessages } from "@/lib/user-facing-errors";

const openSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("team"),
    teamId: z.string().min(8).max(64),
    title: z.string().trim().max(120).optional(),
  }),
  z.object({
    kind: z.literal("workout"),
    groupSessionId: z.string().min(8).max(64),
  }),
  z.object({
    kind: z.literal("challenge"),
    challengeId: z.string().min(4).max(64),
    teamId: z.string().min(8).max(64),
    title: z.string().trim().max(120).optional(),
  }),
]);

/** Otwórz / utwórz kanał czatu + pierwsze wiadomości. */
async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("chat-open", req),
    RATE.workoutComplete.limit,
    RATE.workoutComplete.windowMs,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const parsed = openSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowy typ czatu." }, { status: 400 });
  }

  const userId = session.user.id;
  let channelId: string;

  if (parsed.data.kind === "team") {
    const result = await getOrCreateTeamChatChannel({
      teamId: parsed.data.teamId,
      userId,
      title: parsed.data.title,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    channelId = result.channelId;
  } else if (parsed.data.kind === "workout") {
    const result = await getOrCreateWorkoutChatChannel({
      groupSessionId: parsed.data.groupSessionId,
      userId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    channelId = result.channelId;
  } else {
    const result = await getOrCreateChallengeChatChannel({
      challengeId: parsed.data.challengeId,
      teamId: parsed.data.teamId,
      userId,
      title: parsed.data.title,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    channelId = result.channelId;
  }

  const [channel, messagesResult, mentions] = await Promise.all([
    getChannelView(channelId, userId),
    listChatMessages({ channelId, viewerId: userId }),
    listChannelMentionCandidates(channelId, userId),
  ]);

  if (!channel || !messagesResult.ok) {
    return NextResponse.json({ error: "Nie udało się wczytać czatu." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    channel,
    messages: messagesResult.messages,
    hasMore: messagesResult.hasMore,
    mentions,
  });
}

export const POST = withApiErrors(handlePOST);
