"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const COACH_HREF = "/progress-analysis#coach-chat";

export function CoachChatFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/progress-analysis")) return null;

  const activeWorkout = pathname.startsWith("/active-workout");

  return (
    <Link
      href={COACH_HREF}
      className={cn(
        "fixed z-[55] flex max-w-[min(calc(100vw-1.5rem),14rem)] items-center gap-2 rounded-2xl border border-[var(--neon)]/45 bg-[linear-gradient(145deg,rgba(230,0,35,0.42),rgba(230,0,35,0.16))] px-3.5 py-3 text-left text-xs font-semibold leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_24px_rgba(230,0,35,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
        "right-3 sm:right-4",
        activeWorkout
          ? "top-[calc(4.25rem+env(safe-area-inset-top))] md:top-[calc(4.5rem+env(safe-area-inset-top))]"
          : "bottom-[5.75rem] md:bottom-8",
      )}
      aria-label="Rozwiń temat w Coach czat"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/25">
        <MessageCircle className="h-4 w-4 text-[var(--neon)]" aria-hidden />
      </span>
      <span className="min-w-0 pr-0.5">
        <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/70">
          Trener AI
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold tracking-tight">
          Coach czat →
        </span>
      </span>
    </Link>
  );
}
