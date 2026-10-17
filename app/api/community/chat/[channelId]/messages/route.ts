import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { listChatMessages, sendChatMessage } from "@/lib/community/chat";
import { UserMessages } from "@/lib/user-facing-errors";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ channelId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const { channelId } = await ctx.params;
  const url = new URL(req.url);
  const beforeRaw = url.searchParams.get("before");
  const beforeMs = beforeRaw ? Number(beforeRaw) : null;

  const result = await listChatMessages({
    channelId,
    viewerId: session.user.id,
    beforeMs: beforeMs && Number.isFinite(beforeMs) ? beforeMs : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({
    messages: result.messages,
    hasMore: result.hasMore,
  });
}

const sendSchema = z.object({
  body: z.string().min(1).max(2000),
  parentMessageId: z.string().min(8).max(64).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ channelId: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("chat-send", req),
    60,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  const { channelId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowa wiadomość." }, { status: 400 });
  }

  const result = await sendChatMessage({
    channelId,
    authorUserId: session.user.id,
    body: parsed.data.body,
    parentMessageId: parsed.data.parentMessageId ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    messageId: result.messageId,
    message: result.message,
  });
}
