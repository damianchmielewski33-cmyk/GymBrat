import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchChatMessages } from "@/lib/community/chat";
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
  const q = url.searchParams.get("q") ?? "";

  const result = await searchChatMessages({
    channelId,
    viewerId: session.user.id,
    query: q,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ messages: result.messages });
}
