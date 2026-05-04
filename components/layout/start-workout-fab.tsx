"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function StartWorkoutFab() {
  const pathname = usePathname();

  if (pathname.startsWith("/start-workout")) return null;
  if (pathname.startsWith("/active-workout")) return null;

  return (
    <Link
      href="/start-workout"
      className={cn(
        "fixed z-[56] inline-flex items-center gap-2 rounded-2xl border border-[var(--neon)]/45",
        "bg-[linear-gradient(145deg,rgba(230,0,35,0.42),rgba(230,0,35,0.16))] px-4 py-3 text-xs font-semibold text-white",
        "shadow-[0_10px_36px_rgba(0,0,0,0.55),0_0_28px_rgba(230,0,35,0.22)] transition hover:brightness-110",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        "right-3 sm:right-4",
        "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-8",
      )}
      aria-label="Rozpocznij trening"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/25">
        <Activity className="h-4 w-4 text-[var(--neon)]" aria-hidden />
      </span>
      <span className="min-w-0 pr-0.5">
        <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/70">
          Trening
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold tracking-tight">
          Rozpocznij
        </span>
      </span>
    </Link>
  );
}

