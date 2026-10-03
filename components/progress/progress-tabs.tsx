"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { PROGRESS_TABS, type ProgressTabId } from "@/lib/progress-tabs";

export function ProgressTabs({ active }: { active: ProgressTabId }) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-1"
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
              "min-w-0 flex-1 rounded-xl px-2.5 py-2.5 text-center text-[12px] font-semibold tracking-wide transition-colors",
              isActive
                ? "bg-[var(--gym-gold)]/18 text-[var(--gym-gold-bright)] shadow-[0_0_24px_rgba(235,196,74,0.18)]"
                : "text-white/45 hover:text-white/70",
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
