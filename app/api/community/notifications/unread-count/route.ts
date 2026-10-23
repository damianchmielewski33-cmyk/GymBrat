import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countUnreadNotifications } from "@/lib/community/notifications";
import { UserMessages } from "@/lib/user-facing-errors";

async function handleGET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: UserMessages.sessionExpired }, { status: 401 });
  }
  const count = await countUnreadNotifications(session.user.id);
  return NextResponse.json({ count });
}

export const GET = withApiErrors(handleGET);
