import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { getCatalogMealImage } from "@/lib/meal-catalog-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function decodeDataUrl(dataUrl: string): { mimeType: string; body: Buffer } | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return {
      mimeType: m[1]!.toLowerCase(),
      body: Buffer.from(m[2]!.replace(/\s/g, ""), "base64"),
    };
  } catch {
    return null;
  }
}

/** Publiczny asset grafiki przepisu (wygenerowany raz przy imporcie). */
async function handleGET(_req: Request, ctx: Ctx) {
  const { id: raw } = await ctx.params;
  const id = decodeURIComponent(raw ?? "").trim();
  if (!id || id.length > 80) {
    return NextResponse.json({ error: "Brak id" }, { status: 400 });
  }

  const row = await getCatalogMealImage(id);
  if (!row) {
    console.error(
      `[catalog-meal-image] Brak grafiki dla id=${id} — nie wygenerowano przy imporcie JSON (sprawdź POLLINATIONS_API_KEY, potem Admin → Dokończ grafiki AI).`,
    );
    return NextResponse.json(
      {
        error: "Brak grafiki",
        reason:
          "Grafika nie została wygenerowana przy imporcie JSON. Ustaw POLLINATIONS_API_KEY i uruchom „Dokończ grafiki AI”.",
      },
      { status: 404 },
    );
  }

  const parsed = decodeDataUrl(row.dataUrl);
  if (!parsed || parsed.body.length < 32) {
    return NextResponse.json({ error: "Uszkodzona grafika" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(parsed.body), {
    status: 200,
    headers: {
      "Content-Type": parsed.mimeType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "X-GymBrat-Image": "catalog",
      "X-GymBrat-Image-Updated": String(row.updatedAt.getTime()),
    },
  });
}

export const GET = withApiErrors(handleGET);
