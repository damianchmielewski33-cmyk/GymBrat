"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoachChatUiStatus } from "@/actions/coach-chat";
import { CoachChatPanel } from "@/components/coach/coach-chat-panel";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function CoachChatFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hidden" | "ai" | "web" | null>(null);
  const { workoutPlanId, exercises } = useActiveWorkoutStore();

  // Must stay after all hooks — early return before useEffect breaks Rules of Hooks
  // when navigating to /progress-analysis (embedded coach chat lives on that page).
  const hideOnProgressAnalysis = pathname.startsWith("/progress-analysis");
  const activeWorkout = pathname.startsWith("/active-workout");
  const hasActiveSession = workoutPlanId != null && exercises.length > 0;

  useEffect(() => {
    if (hideOnProgressAnalysis) return;
    if (mode !== null) return;
    let cancelled = false;
    void getCoachChatUiStatus().then((r) => {
      if (!cancelled) setMode(r.mode);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, hideOnProgressAnalysis]);

  useEffect(() => {
    if (hideOnProgressAnalysis) return;
    if (!open) return;
    let cancelled = false;
    setMode(null);
    void getCoachChatUiStatus().then((r) => {
      if (!cancelled) setMode(r.mode);
    });
    return () => {
      cancelled = true;
    };
  }, [open, hideOnProgressAnalysis]);

  if (hideOnProgressAnalysis) return null;
  if (mode === "hidden") return null;
  if (mode === null) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMode(null);
      }}
    >
      <SheetTrigger
        type="button"
        className={cn(
          "fixed z-[55] flex max-w-[min(calc(100vw-1.5rem),14rem)] items-center gap-2 rounded-2xl border border-[var(--mp-teal)]/40 bg-[var(--mp-teal)] px-3.5 py-3 text-left text-xs font-semibold leading-snug text-white shadow-[0_12px_28px_-10px_rgba(0,163,148,0.65)] transition hover:bg-[var(--mp-teal-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "right-3 sm:right-4",
          activeWorkout
            ? "top-[calc(4.25rem+env(safe-area-inset-top))] md:top-[calc(4.5rem+env(safe-area-inset-top))]"
            : hasActiveSession
              ? "bottom-[calc(9.25rem+env(safe-area-inset-bottom))] md:bottom-[calc(6.5rem+env(safe-area-inset-bottom))]"
              : "bottom-[5.75rem] md:bottom-8",
        )}
        aria-label="Otwórz czat z trenerem"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <MessageCircle className="h-4 w-4 text-white" aria-hidden />
        </span>
        <span className="min-w-0 pr-0.5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/85">
            {mode === "web" ? "Trener (web)" : "Trener AI"}
          </span>
          <span className="mt-0.5 block text-[13px] font-semibold tracking-tight">Coach czat</span>
        </span>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col border-zinc-200 bg-white p-0 text-zinc-900 sm:max-w-md"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>
            {mode === "web"
              ? "Trener — czat (internet)"
              : "Trener AI — czat"}
          </SheetTitle>
          <SheetDescription>
            {mode === "web"
              ? "Podpowiedzi na podstawie publicznych źródeł z sieci i danych z aplikacji."
              : "Czat z trenerem na podstawie danych z aplikacji. Zamknij panel, aby wrócić do bieżącego ekranu."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-2 sm:px-4">
          {mode === null ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-zinc-500"
              aria-busy="true"
              aria-label="Ładowanie czatu"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[var(--neon)]" aria-hidden />
              <p className="text-sm">Ładowanie czatu…</p>
            </div>
          ) : (
            <CoachChatPanel
              mode={mode}
              className="max-h-none min-h-0 flex-1 border-zinc-200 shadow-none"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
