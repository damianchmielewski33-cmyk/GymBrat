"use client";

import { cn } from "@/lib/utils";
import { PROGRESS_TABS, type ProgressTabId } from "@/lib/progress-tabs";

export function ProgressTabs({
  active,
  onTabChange,
}: {
  active: ProgressTabId;
  onTabChange: (tab: ProgressTabId) => void;
}) {
  return (
    <nav
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1"
      aria-label="Zakładki postępów"
    >
      {PROGRESS_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold leading-none transition active:scale-[0.97]",
              isActive
                ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
                : "border border-transparent bg-[var(--gym-surface-sunken)] text-white/65",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
