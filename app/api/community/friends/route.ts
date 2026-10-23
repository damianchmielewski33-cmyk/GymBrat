import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFriendsAndPending } from "@/lib/community/friendships";

export const runtime = "nodejs";

async function handleGET() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await listFriendsAndPending(userId);
  return NextResponse.json({ ok: true, ...data });
}

export const GET = withApiErrors(handleGET);
