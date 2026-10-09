import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { bugReportPhotos, bugReports } from "@/db/schema";
import { encryptSensitiveField } from "@/lib/app-field-crypto";
import { BUG_PRIORITIES } from "@/lib/bug-reports";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_PHOTOS = 4;

const createSchema = z.object({
  description: z.string().trim().min(1).max(8_000),
  expectedBehavior: z.string().trim().min(1).max(8_000),
  stepsToReproduce: z.string().trim().min(1).max(8_000),
  priority: z.enum(BUG_PRIORITIES),
  photoDataUrls: z
    .array(z.string().startsWith("data:image/").max(1_500_000))
    .max(MAX_PHOTOS)
    .optional(),
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
    const photoIssue = parsed.error.issues.some((i) =>
      i.path.includes("photoDataUrls"),
    );
    return NextResponse.json(
      {
        ok: false,
        error: photoIssue
          ? "Zdjęcie jest zbyt duże lub w złym formacie — spróbuj innego."
          : "Uzupełnij opis, oczekiwany wygląd, kroki odtworzenia oraz priorytet.",
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

  const bugId = row?.id;
  if (!bugId) {
    return NextResponse.json(
      { ok: false, error: "Nie udało się zapisać zgłoszenia." },
      { status: 500 },
    );
  }

  const photos = (parsed.data.photoDataUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => u.startsWith("data:image/"))
    .slice(0, MAX_PHOTOS);

  if (photos.length > 0) {
    await db.insert(bugReportPhotos).values(
      photos.map((dataUrl) => ({
        bugReportId: bugId,
        dataUrl: encryptSensitiveField(dataUrl),
      })),
    );
  }

  return NextResponse.json({ ok: true, id: bugId });
}
