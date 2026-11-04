"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isFinalOrderStatus } from "@/lib/orders-format";

type State = { status: string; label: string; hint: string | null } | null;

/** Z20: po powrocie z bramki odpytuje status zamówienia, aż przestanie być „pending” (maks. ~60 s). */
export function OrderStatusBanner({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    async function tick() {
      if (stop) return;
      tries += 1;
      try {
        const res = await fetch(`/api/package/orders/${encodeURIComponent(orderId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const j = (await res.json()) as { ok: boolean; status: string; label: string; hint: string | null };
          if (j.ok && !stop) {
            setState({ status: j.status, label: j.label, hint: j.hint });
            if (isFinalOrderStatus(j.status)) return;
          }
        }
      } catch {
        /* sieć — spróbujemy ponownie */
      }
      if (tries >= 20) {
        if (!stop) setGaveUp(true);
        return;
      }
      setTimeout(() => void tick(), 3000);
    }
    void tick();
    return () => {
      stop = true;
    };
  }, [orderId]);

  const final = state ? isFinalOrderStatus(state.status) : false;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 px-3 py-2 text-sm text-[var(--gym-gold)]"
    >
      <p className="font-medium">{state ? state.label : "Sprawdzamy status płatności…"}</p>
      {state?.hint ? <p className="mt-0.5 text-[13px] opacity-90">{state.hint}</p> : null}
      {gaveUp && !final ? (
        <p className="mt-0.5 text-[13px] opacity-90">
          Płatność wciąż się księguje. Status zobaczysz w{" "}
          <Link href="/package/orders" className="underline">
            Moich zamówieniach
          </Link>
          .
        </p>
      ) : null}
      {state?.status === "paid" ? (
        <Link href="/package/orders" className="mt-1 inline-block text-[13px] underline">
          Moje zamówienia i potwierdzenie zakupu
        </Link>
      ) : null}
    </div>
  );
}
