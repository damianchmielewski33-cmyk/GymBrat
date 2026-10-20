"use client";

import { SectionLabel } from "@/components/ui/section-label";
import type { MuscleBalanceSnapshot, StagnationItem } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function MuscleBalancePanel({
  muscle,
  stagnation,
}: {
  muscle: MuscleBalanceSnapshot;
  stagnation: StagnationItem[];
}) {
  const topGroups = [...muscle.groups]
    .filter((g) => g.days30.sets > 0)
    .sort((a, b) => b.days30.sets - a.days30.sets);

  const stagnTop = stagnation
    .filter((s) => s.status === "stagnating" || s.status === "regressing")
    .slice(0, 3);

  return (
    <section className="space-y-3.5">
      <div className="space-y-2">
        <SectionLabel
          index={1}
          title="Balans mięśniowy"
          trailing="30 dni"
          titleTone="white"
        />
        {topGroups.length === 0 ? (
          <div className="app-panel px-3.5 py-4 text-center text-[13px] text-white/45">
            Zaliczone serie pojawią się tu jako objętość na partię.
          </div>
        ) : (
          <ul className="overflow-hidden app-panel divide-y divide-white/[0.06]">
            {topGroups.map((g) => (
              <li
                key={g.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3.5 py-2.5"
              >
                <p className="text-[13px] font-semibold text-white/90">
                  {g.label}
                </p>
                <p className="font-metric text-[13px] tabular-nums text-white">
                  {g.days30.sets} serii
                </p>
                <p className="w-10 text-right text-[11px] tabular-nums text-white/40">
                  {g.days30.sharePct}%
                </p>
              </li>
            ))}
          </ul>
        )}
        {muscle.alerts[0] ? (
          <p className="px-0.5 text-[12px] leading-snug text-amber-200/90">
            {muscle.alerts[0].message}
          </p>
        ) : null}
      </div>

      {stagnTop.length > 0 ? (
        <div className="space-y-2">
          <SectionLabel index={2} title="Stagnacja" titleTone="white" />
          <ul className="overflow-hidden app-panel divide-y divide-white/[0.06]">
            {stagnTop.map((s) => (
              <li
                key={s.exerciseKey}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    Brak postępu od {s.daysWithoutProgress} dni
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    s.status === "regressing"
                      ? "bg-rose-400/15 text-rose-300"
                      : "bg-amber-400/15 text-amber-200",
                  )}
                >
                  {s.statusLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
