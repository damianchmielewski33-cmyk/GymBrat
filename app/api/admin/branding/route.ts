import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf } from "@/lib/csrf";
import { requireAdminApi } from "@/lib/admin-api";
import { logAdminAction } from "@/lib/admin-audit";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import {
  BRANDING_SLOTS,
  BRANDING_SLOT_LABELS,
  deleteBrandingAsset,
  getBrandingPublicMap,
  isBrandingSlot,
  upsertBrandingAsset,
} from "@/lib/app-branding";
import { triggerAndroidApkBuildInBackground } from "@/lib/trigger-android-apk-build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  slot: z.string(),
  dataUrl: z.string().min(32).max(1_800_000),
});

const deleteSchema = z.object({
  slot: z.string(),
  action: z.literal("delete"),
});

export async function GET() {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const assets = await getBrandingPublicMap();
  return NextResponse.json({
    ok: true,
    slots: BRANDING_SLOTS.map((slot) => ({
      slot,
      label: BRANDING_SLOT_LABELS[slot],
      asset: assets[slot] ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-mutation", req),
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const del = deleteSchema.safeParse(json);
  if (del.success) {
    if (!isBrandingSlot(del.data.slot)) {
      return NextResponse.json({ ok: false, error: "Unknown slot" }, { status: 400 });
    }
    await deleteBrandingAsset(del.data.slot);
    await logAdminAction({
      actorUserId: admin.session.user!.id!,
      action: "branding.delete",
      meta: { slot: del.data.slot },
    });
    if (del.data.slot === "icon_android") {
      triggerAndroidApkBuildInBackground();
    }
    return NextResponse.json({ ok: true, deleted: del.data.slot });
  }

  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  if (!isBrandingSlot(parsed.data.slot)) {
    return NextResponse.json({ ok: false, error: "Unknown slot" }, { status: 400 });
  }

  try {
    const row = await upsertBrandingAsset(parsed.data.slot, parsed.data.dataUrl);
    await logAdminAction({
      actorUserId: admin.session.user!.id!,
      action: "branding.upsert",
      meta: { slot: row.slot, mimeType: row.mimeType },
    });
    if (row.slot === "icon_android") {
      triggerAndroidApkBuildInBackground();
    }
    return NextResponse.json({
      ok: true,
      slot: row.slot,
      mimeType: row.mimeType,
      updatedAt: row.updatedAt,
      url: `/api/branding/asset/${row.slot}?v=${row.updatedAt}`,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_DATA_URL") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Nieprawidłowy obraz (PNG/JPEG/WebP/SVG). Spróbuj innego pliku lub mniejszego logo.",
        },
        { status: 400 },
      );
    }
    console.error("[admin/branding] upsert failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Zapis w bazie nieudany. Sprawdź połączenie z Turso albo spróbuj za chwilę.",
      },
      { status: 500 },
    );
  }
}
