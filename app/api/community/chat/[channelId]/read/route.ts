import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey } from "@/lib/rate-limit";
import { markChannelRead } from "@/lib/community/chat";
import { UserMessages } from "@/lib/user-facing-errors";

const schema = z.object({
  lastReadMessageId: z.string().min(8).max(64).nullable().optional(),
});

async function handlePOST(
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
    rateLimitKey("chat-read", req),
    120,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  const { channelId } = await ctx.params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  const lastReadMessageId = parsed.success
    ? (parsed.data.lastReadMessageId ?? null)
    : null;

  const result = await markChannelRead({
    channelId,
    userId: session.user.id,
    lastReadMessageId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

export const POST = withApiErrors(handlePOST);
