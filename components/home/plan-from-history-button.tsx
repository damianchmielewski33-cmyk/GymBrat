"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { createPlanFromHistory } from "@/actions/plan-from-history";

/** Z58: jednym tapnięciem zamienia ostatnie treningi w plan startowy. */
export function PlanFromHistoryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createPlanFromHistory();
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
        className="gym-tap inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] text-sm font-semibold text-white disabled:opacity-60"
      >
        <History className="h-4 w-4" aria-hidden />
        {pending ? "Tworzę plan…" : "Utwórz plan z ostatnich treningów"}
      </button>
      {error ? (
        <p role="alert" className="text-center text-[12px] text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
