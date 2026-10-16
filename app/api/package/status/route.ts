import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserPackageStatus } from "@/lib/user-package";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }
  const pkg = await getUserPackageStatus(session.user.id);
  return NextResponse.json({
    ok: true,
    active: pkg.active,
    daysLeft: pkg.daysLeft,
    endsLabel: pkg.endsLabel,
    planSku: pkg.planSku,
    /** true = pokaż interstitial AdMob / fallback */
    showAds: !pkg.active,
  });
}
