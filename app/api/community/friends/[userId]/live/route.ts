import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFriendLivePresence } from "@/lib/community/friend-live";
import { canWatchFriendLive } from "@/lib/community/friendships";

export const runtime = "nodejs";

async function handleGET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const session = await auth().catch(() => null);
  const viewerId = session?.user?.id;
  if (!viewerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: subjectId } = await ctx.params;
  if (!subjectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canWatchFriendLive(viewerId, subjectId);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "forbidden", live: null },
      { status: 403 },
    );
  }

  const live = await getFriendLivePresence(viewerId, subjectId);
  return NextResponse.json({ ok: true, live });
}

export const GET = withApiErrors(handleGET);
