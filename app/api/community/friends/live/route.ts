import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listLiveFriendsForViewer } from "@/lib/community/friend-live";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const friends = await listLiveFriendsForViewer(userId);
  return NextResponse.json({ ok: true, friends });
}
