import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getChatMessagesByIds,
  getMessagesSince,
  listTypingUsers,
} from "@/lib/community/chat";
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
  const sinceMs = Number(url.searchParams.get("since") ?? 0);
  const idsRaw = url.searchParams.get("ids") ?? "";
  const ids = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (!Number.isFinite(sinceMs) && ids.length === 0) {
    return NextResponse.json({ error: "Nieprawidłowy since." }, { status: 400 });
  }

  const [sinceMessages, byIds, typing] = await Promise.all([
    Number.isFinite(sinceMs)
      ? getMessagesSince({
          channelId,
          viewerId: session.user.id,
          sinceMs,
        })
      : Promise.resolve([]),
    ids.length > 0
      ? getChatMessagesByIds({
          channelId,
          viewerId: session.user.id,
          messageIds: ids,
        })
      : Promise.resolve([]),
    listTypingUsers(channelId, session.user.id),
  ]);

  const map = new Map<string, (typeof sinceMessages)[number]>();
  for (const m of sinceMessages) map.set(m.id, m);
  for (const m of byIds) map.set(m.id, m);

  return NextResponse.json({
    messages: [...map.values()].sort((a, b) => a.createdAt - b.createdAt),
    typing,
  });
}
