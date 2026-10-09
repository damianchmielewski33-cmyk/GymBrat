import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { bugReports } from "@/db/schema";
import { BUG_PRIORITIES } from "@/lib/bug-reports";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const createSchema = z.object({
  description: z.string().trim().min(1).max(8_000),
  expectedBehavior: z.string().trim().min(1).max(8_000),
  stepsToReproduce: z.string().trim().min(1).max(8_000),
  priority: z.enum(BUG_PRIORITIES),
});

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    `bug-report-create:${session.user.id}`,
    RATE.bugReportCreate.limit,
    RATE.bugReportCreate.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele zgłoszeń. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Uzupełnij opis, oczekiwany wygląd, kroki odtworzenia oraz priorytet.",
      },
      { status: 400 },
    );
  }

  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .insert(bugReports)
    .values({
      userId: session.user.id,
      description: parsed.data.description,
      expectedBehavior: parsed.data.expectedBehavior,
      stepsToReproduce: parsed.data.stepsToReproduce,
      priority: parsed.data.priority,
      status: "open",
    })
    .returning({ id: bugReports.id });

  return NextResponse.json({ ok: true, id: row?.id });
}
