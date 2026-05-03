"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoachChatUiStatus } from "@/actions/coach-chat";
import { CoachChatPanel } from "@/components/coach/coach-chat-panel";
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
  const [modelEnabled, setModelEnabled] = useState<boolean | null>(null);

  if (pathname.startsWith("/progress-analysis")) return null;

  const activeWorkout = pathname.startsWith("/active-workout");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setModelEnabled(null);
    void getCoachChatUiStatus().then((r) => {
      if (!cancelled) setModelEnabled(r.modelEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setModelEnabled(null);
      }}
    >
      <SheetTrigger
        type="button"
        className={cn(
          "fixed z-[55] flex max-w-[min(calc(100vw-1.5rem),14rem)] items-center gap-2 rounded-2xl border border-[var(--neon)]/45 bg-[linear-gradient(145deg,rgba(230,0,35,0.42),rgba(230,0,35,0.16))] px-3.5 py-3 text-left text-xs font-semibold leading-snug text-white shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_24px_rgba(230,0,35,0.22)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]",
          "right-3 sm:right-4",
          activeWorkout
            ? "top-[calc(4.25rem+env(safe-area-inset-top))] md:top-[calc(4.5rem+env(safe-area-inset-top))]"
            : "bottom-[5.75rem] md:bottom-8",
        )}
        aria-label="Otwórz czat z trenerem AI"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/25">
          <MessageCircle className="h-4 w-4 text-[var(--neon)]" aria-hidden />
        </span>
        <span className="min-w-0 pr-0.5">
          <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-white/70">
            Trener AI
          </span>
          <span className="mt-0.5 block text-[13px] font-semibold tracking-tight">Coach czat</span>
        </span>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-col border-white/10 bg-[#0a0a0f] p-0 text-white sm:max-w-md"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Trener AI — Coach czat</SheetTitle>
          <SheetDescription>
            Czat z trenerem AI na podstawie danych z aplikacji. Zamknij panel, aby wrócić do bieżącego ekranu.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-2 sm:px-4">
          {modelEnabled === null ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-white/55"
              aria-busy="true"
              aria-label="Ładowanie czatu"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[var(--neon)]" aria-hidden />
              <p className="text-sm">Ładowanie czatu…</p>
            </div>
          ) : (
            <CoachChatPanel
              modelEnabled={modelEnabled}
              className="max-h-none min-h-0 flex-1 border-white/10 shadow-none"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
