import { withApiErrors } from "@/lib/errors/api";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { pickUploadBlob, resolveUploadName } from "@/lib/workout-plan-upload";
import { parseWorkoutPlanUpload } from "@/lib/workout-plan/import-parse";
import { getExercisesAsCatalog } from "@/lib/exercises/exercises-repository";
import { CATALOG_EXERCISES } from "@/lib/workout-exercise-catalog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak sesji." }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    rateLimitKey("workout-plan-import-preview", req),
    RATE.workoutPlanImport.limit,
    RATE.workoutPlanImport.windowMs,
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

  const { blob: raw, filenameHint } = pickUploadBlob(form);
  if (!raw) {
    return NextResponse.json(
      {
        ok: false,
        error: "Wybierz plik Word (.doc / .docx), Excel (.xlsx) albo PDF.",
      },
      { status: 400 },
    );
  }
  if (raw.size <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Plik przyszedł pusty — Android nie przekazał treści. Wybierz ponownie z folderu Pobrane (nie z galerii).",
      },
      { status: 400 },
    );
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Plik jest za duży (max 8 MB)." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await raw.arrayBuffer());
  const fileName = resolveUploadName(raw, filenameHint);
  const mime = typeof raw.type === "string" ? raw.type : "";

  let catalog = CATALOG_EXERCISES;
  try {
    const fromDb = await getExercisesAsCatalog();
    if (fromDb.length > 0) catalog = fromDb;
  } catch {
    /* fallback */
  }

  const parsed = await parseWorkoutPlanUpload({
    buffer,
    fileName,
    mime,
    catalog,
  });
  if (!parsed.ok) {
    return NextResponse.json(parsed, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    kind: parsed.kind,
    warnings: parsed.warnings,
    days: parsed.days,
    fileName,
  });
}

export const POST = withApiErrors(handlePOST);
