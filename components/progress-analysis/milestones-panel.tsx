"use client";

import { cn } from "@/lib/utils";
import type { Milestone } from "@/lib/milestones";
import { Flag } from "lucide-react";

export function MilestonesPanel({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <div className="glass-panel neon-glow p-5 text-sm text-white/55">
        Ustaw cele w profilu (sesje tygodniowe lub ciężar na ćwiczenie), żeby zobaczyć kamienie milowe.
      </div>
    );
  }

  return (
    <section className="glass-panel neon-glow p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Flag className="h-4 w-4 text-[var(--neon)]" aria-hidden />
        <h3 className="font-heading text-lg font-semibold text-white">Kamienie milowe</h3>
      </div>
      <ul className="mt-4 space-y-3">
        {milestones.map((m) => (
          <li key={m.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{m.title}</p>
                <p className="mt-0.5 text-xs text-white/50">{m.description}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  m.achieved
                    ? "border border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                    : "border border-white/10 bg-white/5 text-white/45",
                )}
              >
                {m.achieved ? "OK" : `${m.progressPct}%`}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full",
                  m.achieved ? "bg-emerald-400" : "bg-[var(--neon)]",
                )}
                style={{ width: `${m.progressPct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
