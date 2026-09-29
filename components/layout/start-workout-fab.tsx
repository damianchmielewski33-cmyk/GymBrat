"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

export function StartWorkoutFab() {
  const pathname = usePathname();
  const { workoutPlanId, exercises } = useActiveWorkoutStore();

  if (pathname.startsWith("/workout-plan") || pathname.startsWith("/active-workout")) return null;
  if (pathname.startsWith("/active-workout")) return null;

  const hasActiveSession = workoutPlanId != null && exercises.length > 0;

  return (
    <Link
      href="/workout-plan"
      className={cn(
        "fixed z-[56] inline-flex items-center gap-2 rounded-2xl border border-[var(--neon)]/45",
        "bg-[linear-gradient(145deg,rgba(var(--neon-rgb),0.42),rgba(var(--neon-rgb),0.16))] px-4 py-3 text-xs font-semibold text-white",
        "shadow-[0_10px_36px_rgba(0,0,0,0.55),0_0_28px_rgba(var(--neon-rgb),0.22)] transition hover:brightness-110",
        "touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        "left-[max(0.75rem,env(safe-area-inset-left,0px))] sm:left-[max(1rem,env(safe-area-inset-left,0px))]",
        hasActiveSession
          ? "bottom-[calc(9.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))]"
          : "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-8",
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

