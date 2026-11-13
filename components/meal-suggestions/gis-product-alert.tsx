"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { matchGisAlertsForProductAction } from "@/actions/gis-alerts";
import type { GisAlert } from "@/lib/gis-alerts";
import type { FoodProduct } from "@/lib/food-products-types";

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(iso));
}

/** Ostrzeżenie GIS na ekranie produktu — tylko gdy produkt pasuje do aktywnego alertu. */
export function GisProductAlert({
  product,
  onMatch,
}: {
  product: FoodProduct;
  onMatch?: (count: number) => void;
}) {
  const [alerts, setAlerts] = useState<GisAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAlerts([]);
    onMatch?.(0);
    matchGisAlertsForProductAction({
      barcode: product.barcode,
      name: product.name,
      brand: product.brand ?? null,
    })
      .then((r) => {
        if (cancelled || !r.ok) return;
        setAlerts(r.alerts);
        onMatch?.(r.alerts.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.barcode, product.name, product.brand]);

  if (alerts.length === 0) return null;

  return (
    <div
      role="alert"
      className="mt-4 rounded-2xl border border-state-error/50 bg-state-error/10 px-4 py-3.5 text-state-error"
    >
      <p className="flex items-center gap-2 text-[14px] font-semibold text-state-error">
        <ShieldAlert className="h-5 w-5 shrink-0 text-state-error" aria-hidden />
        Możliwy alert GIS dla tego produktu
      </p>
      <ul className="mt-2 space-y-1">
        {alerts.map((a) => (
          <li key={a.id} className="text-[13px] leading-snug text-state-error/85">
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold underline underline-offset-3"
            >
              {a.title}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
            {fmtDate(a.publishedAt) ? (
              <span className="block text-[12px] text-state-error/70">{fmtDate(a.publishedAt)}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-state-error/70">Sprawdź numer partii na opakowaniu w komunikacie GIS.</p>
    </div>
  );
}
