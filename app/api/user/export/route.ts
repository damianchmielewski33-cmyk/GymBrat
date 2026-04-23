import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildUserDataExport } from "@/lib/user-data-export";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    `user-export:${session.user.id}`,
    RATE.userExport.limit,
    RATE.userExport.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const data = await buildUserDataExport(session.user.id);
    const safeName = session.user.id.slice(0, 8);
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="gymbrat-export-${safeName}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[user/export]", e);
    return NextResponse.json({ error: "Eksport nie powiódł się." }, { status: 500 });
  }
}
