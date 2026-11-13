"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { issueReceiptAction } from "@/actions/orders";
import { Button } from "@/components/ui/button";

export function ReceiptForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nip, setNip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await issueReceiptAction({ orderId, buyerName: name, buyerTaxId: nip });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white";
  return (
    <div className="app-card space-y-3 p-5">
      <p className="text-sm text-white/70">
        Dane nabywcy są opcjonalne. Po wystawieniu dokumentu nie można ich zmienić.
      </p>
      <label className="block text-[13px] text-white/70">
        Nazwa nabywcy (opcjonalnie)
        <input className={field} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-[13px] text-white/70">
        NIP (opcjonalnie)
        <input className={field} value={nip} maxLength={20} inputMode="numeric" onChange={(e) => setNip(e.target.value)} />
      </label>
      {error ? (
        <p role="alert" className="text-[13px] text-state-error">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={pending} onClick={submit}>
        {pending ? "Wystawianie…" : "Wystaw potwierdzenie"}
      </Button>
    </div>
  );
}
