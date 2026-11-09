"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { matchGisAlertsForProductAction } from "@/actions/gis-alerts";
import type { GisAlert } from "@/lib/gis-alerts";
import type { FoodProduct } from "@/lib/food-products-types";

/** Ostrzeżenie GIS na ekranie produktu — tylko gdy produkt pasuje do aktywnego alertu. */
export function GisProductAlert({ product }: { product: FoodProduct }) {
  const [alerts, setAlerts] = useState<GisAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAlerts([]);
    matchGisAlertsForProductAction({
      barcode: product.barcode,
      name: product.name,
      brand: product.brand ?? null,
    })
      .then((r) => {
        if (!cancelled && r.ok) setAlerts(r.alerts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product.barcode, product.name, product.brand]);

  if (alerts.length === 0) return null;

  return (
    <div
      role="alert"
      className="mt-5 rounded-[18px] border border-rose-500/40 bg-rose-500/10 px-4 py-3.5 text-rose-50"
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        <ShieldAlert className="h-5 w-5 shrink-0 text-rose-300" aria-hidden />
        Możliwy alert GIS dla tego produktu
      </p>
      <ul className="mt-2 space-y-2">
        {alerts.map((a) => (
          <li key={a.id} className="text-[12px] leading-snug text-rose-50/85">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 underline underline-offset-2"
            >
              {a.title}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-rose-50/60">Sprawdź numer partii na opakowaniu w komunikacie GIS.</p>
    </div>
  );
}
