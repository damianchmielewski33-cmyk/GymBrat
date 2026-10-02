import { NextResponse } from "next/server";
import {
  dataUrlToBuffer,
  getBrandingAsset,
  isBrandingSlot,
} from "@/lib/app-branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slot: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slot: raw } = await ctx.params;
  if (!isBrandingSlot(raw)) {
    return NextResponse.json({ ok: false, error: "Unknown slot" }, { status: 404 });
  }
  const row = await getBrandingAsset(raw);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Not set" }, { status: 404 });
  }
  const parsed = dataUrlToBuffer(row.dataUrl);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Corrupt asset" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(parsed.body), {
    status: 200,
    headers: {
      "Content-Type": parsed.mimeType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Branding-Updated": String(row.updatedAt),
    },
  });
}
