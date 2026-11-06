"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** „Spróbuj ponownie” — odświeża dane serwerowe bez pełnego przeładowania. */
export function HomeRetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="gym-tap mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Odświeżam…" : "Spróbuj ponownie"}
    </button>
  );
}
