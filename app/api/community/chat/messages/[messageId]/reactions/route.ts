import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey } from "@/lib/rate-limit";
import { toggleChatReaction } from "@/lib/community/chat";
import { UserMessages } from "@/lib/user-facing-errors";

const schema = z.object({
  emoji: z.string().min(1).max(16),
});

async function handlePOST(
  req: Request,
  ctx: { params: Promise<{ messageId: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const limited = await checkRateLimitAsync(
    rateLimitKey("chat-react", req),
    120,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  const { messageId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe emoji." }, { status: 400 });
  }

  const result = await toggleChatReaction({
    messageId,
    userId: session.user.id,
    emoji: parsed.data.emoji,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, added: result.added });
}

export const POST = withApiErrors(handlePOST);
