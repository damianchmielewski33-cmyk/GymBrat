"use client";

import { useEffect, useRef } from "react";
import { PROGRESS_TABS, type ProgressTabId } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

/** Zakładki Analizy: przewijany pasek, aktywna zakładka zawsze widoczna. */
export function ProgressTabs({
  active,
  onTabChange,
}: {
  active: ProgressTabId;
  onTabChange: (tab: ProgressTabId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Sekcje analizy"
      className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {PROGRESS_TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onTabChange(t.id)}
            className={cn(
              "min-h-11 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[14px] font-semibold transition active:scale-[0.97]",
              on
                ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold-bright)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]"
                : "text-[var(--gym-text-secondary)] hover:text-white/90",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
