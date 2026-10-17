import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isNotificationKind,
  type NotificationKind,
} from "@/lib/community/notification-types";
import { listNotifications } from "@/lib/community/notifications";
import { UserMessages } from "@/lib/user-facing-errors";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("kind") ?? "";
  const kind: NotificationKind | null = isNotificationKind(kindRaw)
    ? kindRaw
    : null;
  const unreadOnly = url.searchParams.get("unreadOnly") === "1";
  const beforeRaw = url.searchParams.get("cursor");
  const beforeMs = beforeRaw ? Number(beforeRaw) : null;
  const limitRaw = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(80, Math.max(1, limitRaw))
    : 30;

  const items = await listNotifications({
    userId: session.user.id,
    kind,
    unreadOnly,
    beforeMs: beforeMs && Number.isFinite(beforeMs) ? beforeMs : null,
    limit: limit + 1,
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  return NextResponse.json({
    notifications: page,
    hasMore,
    nextCursor:
      page.length > 0 ? page[page.length - 1]!.createdAt : null,
  });
}
