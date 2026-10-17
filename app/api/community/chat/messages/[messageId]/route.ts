import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey } from "@/lib/rate-limit";
import { deleteChatMessage, editChatMessage } from "@/lib/community/chat";
import { UserMessages } from "@/lib/user-facing-errors";

const editSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function PATCH(
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
    rateLimitKey("chat-edit", req),
    40,
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
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowa treść." }, { status: 400 });
  }

  const result = await editChatMessage({
    messageId,
    userId: session.user.id,
    body: parsed.data.body,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
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
    rateLimitKey("chat-delete", req),
    40,
    60_000,
  );
  if (!limited.ok) {
    return NextResponse.json({ error: UserMessages.rateLimited }, { status: 429 });
  }

  const { messageId } = await ctx.params;
  const result = await deleteChatMessage({
    messageId,
    userId: session.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
