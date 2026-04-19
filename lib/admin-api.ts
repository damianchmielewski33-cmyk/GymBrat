import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import {
  isAdminEligible,
  readAdminUnlockVerified,
} from "@/lib/admin-session";

export async function requireAdminApi(): Promise<
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const eligible = await isAdminEligible(session);
  if (!eligible) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  const unlocked = await readAdminUnlockVerified(session);
  if (!unlocked) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin PIN required" }, { status: 403 }),
    };
  }
  return { ok: true, session };
}
