import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildUserDataExport } from "@/lib/user-data-export";
import { buildUserDataCsv } from "@/lib/user-data-csv";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const format = new URL(req.url).searchParams.get("format");
  const safeName = session.user.id.slice(0, 8);

  try {
    if (format === "csv") {
      const csv = await buildUserDataCsv(session.user.id);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gymbrat-export-${safeName}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const data = await buildUserDataExport(session.user.id);
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
