import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { completeVision, isAiConfigured, type AiImage } from "@/ai/client";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { UserMessages } from "@/lib/user-facing-errors";
import { isAiGloballyDisabled } from "@/lib/ai-availability";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";

const bodySchema = z.object({
  imageDataUrl: z.string().min(32).max(3_500_000),
});

const resultSchema = z.object({
  name: z.string().max(120).optional(),
  kcal: z.number().finite().min(0).max(5000).optional(),
  proteinG: z.number().finite().min(0).max(500).optional(),
  fatG: z.number().finite().min(0).max(500).optional(),
  carbsG: z.number().finite().min(0).max(500).optional(),
  per: z.enum(["100g", "serving"]).optional(),
});

function dataUrlToAiImage(dataUrl: string): AiImage | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1]!, base64: m[2]! };
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: UserMessages.sessionExpired }, { status: 401 });
  }

  if (await isAiGloballyDisabled()) {
    return NextResponse.json(
      { ok: false, error: "OCR etykiety jest tymczasowo niedostępne (AI wyłączone)." },
      { status: 503 },
    );
  }
  if (await getUserAiFeaturesDisabled(userId)) {
    return NextResponse.json(
      { ok: false, error: "Włącz funkcje AI w profilu, aby skanować etykiety." },
      { status: 403 },
    );
  }
  if (!isAiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "OCR wymaga skonfigurowanego AI (vision)." },
      { status: 503 },
    );
  }

  const rl = await checkRateLimitAsync(
    rateLimitKey("food-ocr", req),
    RATE.bodyReportCreate.limit,
    RATE.bodyReportCreate.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: UserMessages.rateLimited },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Prześlij zdjęcie etykiety" }, { status: 400 });
  }
  const image = dataUrlToAiImage(parsed.data.imageDataUrl);
  if (!image) {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy format zdjęcia" }, { status: 400 });
  }

  try {
    const raw = await completeVision(
      [
        {
          role: "user",
          content:
            "Odczytaj tabelę wartości odżywczych z etykiety. Zwróć WYŁĄCZNIE JSON: " +
            '{"name":"string","kcal":number,"proteinG":number,"fatG":number,"carbsG":number,"per":"100g"|"serving"}. ' +
            "Jeśli niepewne — oszacuj z etykiety. Bez markdown.",
        },
      ],
      [image],
      { model: process.env.AI_MODEL },
    );

    const text = String(raw ?? "").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, error: "Nie udało się odczytać etykiety" },
        { status: 422 },
      );
    }
    const result = resultSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: "Nie udało się zinterpretować etykiety" },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, label: result.data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Błąd OCR etykiety" },
      { status: 500 },
    );
  }
}
