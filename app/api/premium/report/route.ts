import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withApiErrors } from "@/lib/errors/api";
import { getPremiumReport } from "@/lib/premium-report-access";

export const runtime = "nodejs";

/** Raport Premium jako JSON. Bez aktywnego pakietu → 402 (`PREMIUM_REQUIRED`). */
async function handleGET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }
  const report = await getPremiumReport(session.user.id);
  return NextResponse.json({ ok: true, report });
}

export const GET = withApiErrors(handleGET);
