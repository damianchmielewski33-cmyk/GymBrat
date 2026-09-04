"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Trophy, X } from "lucide-react";
import { AWP_SITE_NAME, getAwpCrossLink } from "@/lib/sister-sites";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "gymbrat-sister-from-awp-dismissed";

/** Pasek powitalny, gdy użytkownik przyszedł z AWP (?from=awp). */
export function SisterSiteArrivalBanner({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const from = searchParams.get("from");
    if (from !== "awp") return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [searchParams]);

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative z-30 border-b border-emerald-400/30 bg-gradient-to-r from-emerald-950/90 via-zinc-950/90 to-rose-950/80 px-3 py-2.5 text-sm text-emerald-50",
        className
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
          <Trophy className="h-4 w-4 text-emerald-200" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">Cześć z {AWP_SITE_NAME}!</p>
          <p className="mt-0.5 text-xs text-emerald-100/85 sm:text-sm">
            Jesteś w GymBrat — treningu i diecie. Wróć na boisko kiedy chcesz.
          </p>
          <a
            href={getAwpCrossLink("/")}
            className="mt-1.5 inline-flex text-xs font-semibold text-emerald-200 underline-offset-2 hover:underline"
          >
            Otwórz {AWP_SITE_NAME} →
          </a>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1.5 text-emerald-100/70 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="Zamknij"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
