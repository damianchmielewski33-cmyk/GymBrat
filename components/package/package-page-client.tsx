"use client";

import { useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";
import { cn } from "@/lib/utils";

export type PackagePlanCard = {
  sku: string;
  title: string;
  description: string;
  days: number;
  priceGrosze: number;
};

export function PackagePageClient({
  plans,
  packageActive,
  daysLeft,
  endsLabel,
  planSku,
  paidHint,
}: {
  plans: PackagePlanCard[];
  packageActive: boolean;
  daysLeft: number | null;
  endsLabel: string | null;
  planSku: string | null;
  paidHint?: boolean;
}) {
  const { notifyError, notifySaved } = useSaveFeedback();
  const [busySku, setBusySku] = useState<string | null>(null);

  async function checkout(sku: string) {
    setBusySku(sku);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/package/checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ sku }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        paymentUrl?: string;
        fields?: Record<string, string>;
      } | null;
      if (!res.ok || !data?.ok || !data.paymentUrl || !data.fields) {
        notifyError(data?.error ?? "Nie udało się rozpocząć płatności.");
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.paymentUrl;
      form.acceptCharset = "UTF-8";
      for (const [name, value] of Object.entries(data.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      notifyError("Nie udało się rozpocząć płatności.");
    } finally {
      setBusySku(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 pb-28 pt-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
          Twój pakiet
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-white">
          {packageActive ? "Pakiet aktywny" : "Bez reklam — wybierz pakiet"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          {packageActive
            ? `Zostało ${daysLeft ?? "—"} dni${endsLabel ? ` (do ${endsLabel})` : ""}${
                planSku ? ` · ${planSku}` : ""
              }.`
            : "Bez aktywnego pakietu w aplikacji pojawiają się pełnoekranowe reklamy (AdMob) przed treningiem i dodaniem produktu."}
        </p>
        {paidHint ? (
          <p className="mt-3 rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 px-3 py-2 text-sm text-[var(--gym-gold)]">
            Dziękujemy — po potwierdzeniu płatności HotPay pakiet aktywuje się
            automatycznie (zwykle w ciągu kilku sekund).
          </p>
        ) : null}
      </header>

      <div className="space-y-3">
        {plans.map((p) => {
          const featured = p.sku === "d30";
          return (
            <article
              key={p.sku}
              className={cn(
                "rounded-2xl border p-4",
                featured
                  ? "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/[0.07]"
                  : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{p.title}</h2>
                  <p className="mt-1 text-sm text-white/55">{p.description}</p>
                </div>
                <p className="shrink-0 font-display text-xl text-[var(--gym-gold)]">
                  {formatPlnFromGrosze(p.priceGrosze)}
                </p>
              </div>
              <Button
                type="button"
                className="gym-btn-primary mt-4 w-full"
                disabled={busySku != null}
                onClick={() => void checkout(p.sku)}
              >
                {busySku === p.sku ? "Przekierowanie…" : "Kup przez HotPay"}
              </Button>
            </article>
          );
        })}
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-white/45">Brak aktywnych pakietów w ofercie.</p>
      ) : null}

      <button
        type="button"
        className="text-xs text-white/35 underline-offset-2 hover:text-white/55 hover:underline"
        onClick={() => notifySaved("Status pakietu odświeżany przy każdym wejściu.")}
      >
        Problemy z płatnością? Sprawdź e-mail / wróć tu po chwili.
      </button>
    </div>
  );
}
