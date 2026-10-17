import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey } from "@/lib/rate-limit";
import { listTypingUsers, setTyping } from "@/lib/community/chat";
import { UserMessages } from "@/lib/user-facing-errors";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ channelId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const { channelId } = await ctx.params;
  const typing = await listTypingUsers(channelId, session.user.id);
  return NextResponse.json({ typing });
}

const schema = z.object({
  typing: z.boolean(),
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
    rateLimitKey("chat-typing", req),
    180,
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const result = await setTyping({
    channelId,
    userId: session.user.id,
    typing: parsed.data.typing,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
