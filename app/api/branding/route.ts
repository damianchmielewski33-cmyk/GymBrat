import { NextResponse } from "next/server";
import { getBrandingPublicMap } from "@/lib/app-branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Publiczna mapa URL-i brandingu (logo / ikony). */
export async function GET() {
  try {
    const assets = await getBrandingPublicMap();
    return NextResponse.json(
      { ok: true, assets },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json({ ok: true, assets: {} });
  }
}
