import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countUnreadNotifications } from "@/lib/community/notifications";
import { UserMessages } from "@/lib/user-facing-errors";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }
  const count = await countUnreadNotifications(session.user.id);
  return NextResponse.json({ count });
}
