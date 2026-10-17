import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTeamFeed } from "@/lib/community/team-feed";
import { UserMessages } from "@/lib/user-facing-errors";

/**
 * Paginated Team Feed — infinite scroll / incremental SSE refresh.
 * ?before=ms&limit=12
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const { teamId } = await ctx.params;
  const url = new URL(req.url);
  const beforeRaw = url.searchParams.get("before");
  const beforeMs = beforeRaw ? Number(beforeRaw) : null;
  const limitRaw = Number(url.searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(30, Math.max(1, limitRaw))
    : 12;

  const posts = await listTeamFeed(teamId, session.user.id, {
    limit: limit + 1,
    before:
      beforeMs && Number.isFinite(beforeMs) ? new Date(beforeMs) : undefined,
  });

  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;

  return NextResponse.json({
    posts: page,
    hasMore,
    nextCursor:
      page.length > 0 ? page[page.length - 1]!.createdAt.getTime() : null,
  });
}
