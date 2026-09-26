import { auth } from "@/auth";
import { createBodyReport, getBodyReports, type CreateBodyReportInput } from "@/lib/body-reports";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";
import { fetchJavaApi, isJavaApiEnabled, passThroughJavaResponse } from "@/lib/java-api";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  if (isJavaApiEnabled()) {
    const javaRes = await fetchJavaApi("/api/body-reports", { userId: session.user.id });
    if (javaRes) return passThroughJavaResponse(javaRes);
  }

  const reports = await getBodyReports(session.user.id);
  return NextResponse.json({ ok: true, reports });
}

const createSchema = z.object({
  weightKg: z.number().finite().min(0).max(1000).nullable().optional(),
  waistCm: z.number().finite().min(0).max(500).nullable().optional(),
  chestCm: z.number().finite().min(0).max(500).nullable().optional(),
  thighCm: z.number().finite().min(0).max(500).nullable().optional(),
  armCm: z.number().finite().min(0).max(500).nullable().optional(),
  abdomenCm: z.number().finite().min(0).max(500).nullable().optional(),
  trainingEnergy: z.number().finite().min(1).max(10).nullable().optional(),
  sleepQuality: z.number().finite().min(1).max(10).nullable().optional(),
  dayEnergy: z.number().finite().min(1).max(10).nullable().optional(),
  digestionScore: z.number().finite().min(1).max(10).nullable().optional(),
  cardioCompliance: z.string().max(16).nullable().optional(),
  dietCompliance: z.string().max(16).nullable().optional(),
  trainingCompliance: z.string().max(16).nullable().optional(),
  complianceNotes: z.string().max(20_000).nullable().optional(),
  additionalInfo: z.string().max(20_000).nullable().optional(),
  /** Data URL JPG — po kompresji zwykle <1 MB tekstu; limit 200k był za niski. */
  photoDataUrls: z.array(z.string().max(1_500_000)).max(8).optional(),
});

function formatBodyReportZodError(error: z.ZodError): string {
  const parts = error.issues.slice(0, 4).map((issue) => {
    const path = issue.path.join(".") || "dane";
    if (path.startsWith("photoDataUrls")) {
      return "Zdjęcie jest zbyt duże — wybierz inne albo spróbuj ponownie (skompresujemy je mocniej).";
    }
    if (path === "weightKg") return "Nieprawidłowa waga.";
    if (
      path === "trainingEnergy" ||
      path === "sleepQuality" ||
      path === "dayEnergy" ||
      path === "digestionScore"
    ) {
      return `Skala „${path}” musi być liczbą 1–10.`;
    }
    return `${path}: ${issue.message}`;
  });
  return parts.join(" ") || "Nieprawidłowe dane raportu.";
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    `body-report-create:${session.user.id}`,
    RATE.bodyReportCreate.limit,
    RATE.bodyReportCreate.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele żądań. Spróbuj za chwilę." },
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
      { ok: false, error: formatBodyReportZodError(parsed.error) },
      { status: 400 },
    );
  }

  if (isJavaApiEnabled()) {
    const javaRes = await fetchJavaApi("/api/body-reports", {
      method: "POST",
      userId: session.user.id,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (javaRes) {
      if (javaRes.ok) {
        revalidatePath("/reports");
        revalidatePath("/");
        revalidatePath("/progress-analysis");
      }
      return passThroughJavaResponse(javaRes);
    }
  }

  const id = await createBodyReport(session.user.id, parsed.data as CreateBodyReportInput);
  revalidatePath("/reports");
  revalidatePath("/");
  revalidatePath("/progress-analysis");
  return NextResponse.json({ ok: true, id });
}

