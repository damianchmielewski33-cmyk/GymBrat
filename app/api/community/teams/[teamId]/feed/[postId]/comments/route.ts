import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTeamFeedComments } from "@/lib/community/team-feed";
import { UserMessages } from "@/lib/user-facing-errors";

/** Lazy comments — infinite / „pokaż więcej” pod postem. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ teamId: string; postId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }

  const { teamId, postId } = await ctx.params;
  const url = new URL(req.url);
  const beforeRaw = url.searchParams.get("before");
  const beforeMs = beforeRaw ? Number(beforeRaw) : null;
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(40, Math.max(1, limitRaw))
    : 20;

  const { comments, hasMore } = await listTeamFeedComments(
    teamId,
    postId,
    session.user.id,
    {
      limit,
      before:
        beforeMs && Number.isFinite(beforeMs) ? new Date(beforeMs) : undefined,
    },
  );

  return NextResponse.json({
    comments,
    hasMore,
    nextCursor:
      comments.length > 0
        ? comments[0]!.createdAt.getTime()
        : null,
  });
}
