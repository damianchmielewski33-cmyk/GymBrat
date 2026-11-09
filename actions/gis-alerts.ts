"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { guardAction } from "@/lib/action-guard";
import { fetchGisAlerts, matchGisAlerts, type GisAlert } from "@/lib/gis-alerts";

export type GisAlertsActionResult = { ok: boolean; alerts: GisAlert[] };

const productSchema = z.object({
  barcode: z.string().max(20).nullable().optional(),
  name: z.string().min(1).max(200),
  brand: z.string().max(120).nullable().optional(),
});

/** Ostatnie ostrzeżenia GIS (lista w aplikacji). */
export async function listGisAlertsAction(): Promise<GisAlertsActionResult> {
  await guardAction("gis-alerts.listGisAlertsAction", { limit: 30, windowMs: 60000 });
  const session = await auth();
  if (!session?.user?.id) return { ok: false, alerts: [] };
  return fetchGisAlerts();
}

/** Alerty GIS dopasowane do produktu (nazwa / marka / EAN). */
export async function matchGisAlertsForProductAction(
  input: unknown,
): Promise<GisAlertsActionResult> {
  await guardAction("gis-alerts.matchGisAlertsForProductAction", { limit: 90, windowMs: 60000 });
  const session = await auth();
  if (!session?.user?.id) return { ok: false, alerts: [] };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, alerts: [] };

  const res = await fetchGisAlerts();
  if (!res.ok) return { ok: false, alerts: [] };
  const p = parsed.data;
  const alerts = matchGisAlerts(res.alerts, {
    id: "gis-match",
    barcode: p.barcode ?? null,
    name: p.name,
    brand: p.brand ?? undefined,
    servingLabel: "",
    calories: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    source: "local",
  });
  return { ok: true, alerts: alerts.slice(0, 3) };
}
