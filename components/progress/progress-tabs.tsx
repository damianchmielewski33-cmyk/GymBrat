"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PROGRESS_TABS, type ProgressTabId } from "@/lib/progress-tabs";

export function ProgressTabs({ active }: { active: ProgressTabId }) {
  return (
    <nav
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
      aria-label="Zakładki postępów"
    >
      {PROGRESS_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={`/progress?tab=${tab.id}`}
            scroll={false}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
              isActive
                ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
                : "border border-transparent bg-[var(--gym-surface-sunken)] text-white/70",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
