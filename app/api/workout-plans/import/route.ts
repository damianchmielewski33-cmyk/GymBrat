import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";
import { parseWorkoutPlansFromDoc, parseWorkoutPlansFromDocx } from "@/lib/docx/workout-plan-import";
import { parseWorkoutPlansFromXlsx } from "@/lib/excel/workout-plan-import";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

function fileKind(name: string): "docx" | "doc" | "xlsx" | null {
  const n = name.toLowerCase();
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "xlsx";
  return null;
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    rateLimitKey("workout-plan-import", req),
    RATE.bodyReportImport.limit,
    RATE.bodyReportImport.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele prób. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowe dane formularza." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Wybierz plik Word (.doc / .docx) albo Excel (.xlsx)." },
      { status: 400 },
    );
  }

  const kind = fileKind(file.name || "");
  if (!kind) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Obsługiwane formaty: .doc, .docx (Word) i .xlsx (Excel). Na Androidzie wybierz plik z „Pliki” / Pobrane.",
      },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Plik jest pusty albo za duży (max 8 MB)." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed =
      kind === "docx"
        ? await parseWorkoutPlansFromDocx(buffer)
        : kind === "doc"
          ? await parseWorkoutPlansFromDoc(buffer)
          : parseWorkoutPlansFromXlsx(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Nie udało się odczytać pliku.",
      },
      { status: 400 },
    );
  }

  if (parsed.plans.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.warnings[0] ??
          "Nie znaleziono ćwiczeń w dokumencie.",
        warnings: parsed.warnings,
      },
      { status: 400 },
    );
  }

  const db = getDb();
  const userId = session.user.id;
  const now = new Date();
  const insertedIds: string[] = [];

  for (const plan of parsed.plans) {
    const id = crypto.randomUUID();
    await db.insert(workoutPlans).values({
      id,
      userId,
      planJson: JSON.stringify(plan),
      createdAt: now,
      updatedAt: now,
    });
    insertedIds.push(id);
  }

  revalidatePath("/profile/workout-plan");
  revalidatePath("/profile");
  revalidatePath("/workout-plan");
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    imported: insertedIds.length,
    ids: insertedIds,
    warnings: parsed.warnings,
    planNames: parsed.plans.map((p) => p.planName),
  });
}
