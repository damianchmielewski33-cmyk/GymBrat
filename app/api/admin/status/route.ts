import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isAdminEligible,
  readAdminUnlockVerified,
} from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ eligible: false, unlocked: false });
  }
  const eligible = await isAdminEligible(session);
  const unlocked =
    eligible && (await readAdminUnlockVerified(session));
  const res = NextResponse.json({ eligible, unlocked });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
