import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";
import { parseWorkoutPlansFromDoc, parseWorkoutPlansFromDocx } from "@/lib/docx/workout-plan-import";
import { parseWorkoutPlansFromXlsx } from "@/lib/excel/workout-plan-import";
import {
  detectWorkoutPlanFileKind,
  type WorkoutPlanFileKind,
} from "@/lib/workout-plan-file-kind";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

type UploadBlob = Blob & { name?: string; type?: string };

function isUploadBlob(v: unknown): v is UploadBlob {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Blob).arrayBuffer === "function" &&
    typeof (v as Blob).size === "number"
  );
}

async function parseByKind(kind: WorkoutPlanFileKind, buffer: Buffer) {
  if (kind === "docx") return parseWorkoutPlansFromDocx(buffer);
  if (kind === "doc") return parseWorkoutPlansFromDoc(buffer);
  return parseWorkoutPlansFromXlsx(buffer);
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
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowe dane formularza." },
      { status: 400 },
    );
  }

  const raw = form.get("file");
  if (!isUploadBlob(raw)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Wybierz plik Word (.doc / .docx) albo Excel (.xlsx).",
      },
      { status: 400 },
    );
  }

  if (raw.size <= 0 || raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Plik jest pusty albo za duży (max 8 MB)." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const fileName = typeof raw.name === "string" ? raw.name : "";
  const mime = typeof raw.type === "string" ? raw.type : "";

  let kind = detectWorkoutPlanFileKind({
    name: fileName,
    mime,
    buffer,
  });

  if (!kind) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Nie rozpoznano pliku. Wybierz .doc / .docx (Word) albo .xlsx / .xls (Excel). Na Androidzie: Pliki → Pobrane.",
        debug: { name: fileName || null, mime: mime || null, bytes: buffer.length },
      },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = await parseByKind(kind, buffer);
    // OLE bywa mylone (.xls vs .doc) — spróbuj drugiej ścieżki gdy 0 planów
    if (parsed.plans.length === 0 && kind === "doc") {
      const asXlsx = parseWorkoutPlansFromXlsx(buffer);
      if (asXlsx.plans.length > 0) {
        parsed = asXlsx;
        kind = "xlsx";
      }
    } else if (parsed.plans.length === 0 && kind === "xlsx") {
      // ZIP bez xl/ mógł być docx; OLE .xls mógł być .doc
      try {
        const asDocx = await parseWorkoutPlansFromDocx(buffer);
        if (asDocx.plans.length > 0) {
          parsed = asDocx;
          kind = "docx";
        } else {
          const asDoc = await parseWorkoutPlansFromDoc(buffer);
          if (asDoc.plans.length > 0) {
            parsed = asDoc;
            kind = "doc";
          }
        }
      } catch {
        /* zostaw oryginalne ostrzeżenia */
      }
    }
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
    kind,
  });
}
