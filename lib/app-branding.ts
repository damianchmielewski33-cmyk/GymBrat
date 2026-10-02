import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { appBrandingAssets } from "@/db/schema";
import {
  isBrandingSlot,
  type BrandingSlot,
} from "@/lib/app-branding-slots";

export {
  BRANDING_SLOTS,
  BRANDING_SLOT_LABELS,
  isBrandingSlot,
  type BrandingSlot,
} from "@/lib/app-branding-slots";

/** ~600 KB data URL — ikony/logo, nie pełne zdjęcia. */
export const BRANDING_MAX_DATA_URL_CHARS = 800_000;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export type BrandingAssetRow = {
  slot: BrandingSlot;
  mimeType: string;
  dataUrl: string;
  updatedAt: number;
};

export type BrandingPublicMap = Partial<
  Record<BrandingSlot, { url: string; updatedAt: number; mimeType: string }>
>;

function updatedAtMs(v: Date | number | null | undefined): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

export async function listBrandingAssets(): Promise<BrandingAssetRow[]> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db.select().from(appBrandingAssets);
  return rows
    .filter((r) => isBrandingSlot(r.slot))
    .map((r) => ({
      slot: r.slot as BrandingSlot,
      mimeType: r.mimeType,
      dataUrl: r.dataUrl,
      updatedAt: updatedAtMs(r.updatedAt),
    }));
}

export async function getBrandingAsset(
  slot: BrandingSlot,
): Promise<BrandingAssetRow | null> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(appBrandingAssets)
    .where(eq(appBrandingAssets.slot, slot))
    .limit(1);
  if (!row) return null;
  return {
    slot,
    mimeType: row.mimeType,
    dataUrl: row.dataUrl,
    updatedAt: updatedAtMs(row.updatedAt),
  };
}

export function brandingAssetPublicUrl(slot: BrandingSlot, updatedAt: number): string {
  return `/api/branding/asset/${slot}?v=${updatedAt}`;
}

export async function getBrandingPublicMap(): Promise<BrandingPublicMap> {
  const rows = await listBrandingAssets();
  const out: BrandingPublicMap = {};
  for (const r of rows) {
    out[r.slot] = {
      url: brandingAssetPublicUrl(r.slot, r.updatedAt),
      updatedAt: r.updatedAt,
      mimeType: r.mimeType,
    };
  }
  return out;
}

export function parseDataUrl(dataUrl: string): { mimeType: string; dataUrl: string } | null {
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mimeType = m[1]!.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) return null;
  if (dataUrl.length > BRANDING_MAX_DATA_URL_CHARS) return null;
  return { mimeType, dataUrl: dataUrl.trim() };
}

export async function upsertBrandingAsset(
  slot: BrandingSlot,
  dataUrl: string,
): Promise<BrandingAssetRow> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("INVALID_DATA_URL");
  }
  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  await db
    .insert(appBrandingAssets)
    .values({
      slot,
      mimeType: parsed.mimeType,
      dataUrl: parsed.dataUrl,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appBrandingAssets.slot,
      set: {
        mimeType: parsed.mimeType,
        dataUrl: parsed.dataUrl,
        updatedAt: now,
      },
    });
  return {
    slot,
    mimeType: parsed.mimeType,
    dataUrl: parsed.dataUrl,
    updatedAt: now.getTime(),
  };
}

export async function deleteBrandingAsset(slot: BrandingSlot): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  await db.delete(appBrandingAssets).where(eq(appBrandingAssets.slot, slot));
}

/** Rozpakowuje data URL do bufora (serwowanie assetu). */
export function dataUrlToBuffer(dataUrl: string): { mimeType: string; body: Buffer } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return {
      mimeType: m[1]!.trim().toLowerCase(),
      body: Buffer.from(m[2]!.replace(/\s/g, ""), "base64"),
    };
  } catch {
    return null;
  }
}
