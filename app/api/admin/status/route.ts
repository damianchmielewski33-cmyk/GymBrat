import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin2faSatisfied, isAdminEligible } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ eligible: false, unlocked: false });
  }
  const eligible = await isAdminEligible(session);
  // `unlocked` = rola admina + spełniony wymóg 2FA (gdy włączony); klient nie dostaje żadnych sekretów.
  const unlocked = eligible && (await isAdmin2faSatisfied(session));
  const res = NextResponse.json({ eligible, unlocked });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const GET = withApiErrors(handleGET);
